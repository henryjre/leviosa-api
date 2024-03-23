import crypto from "crypto";
import moment from "moment-timezone";
import fetch from "node-fetch";

import pools from "../../../sqlPools.js";
import {
  queryProductsPlacement,
  queryProductsCancel,
  decrementInventory,
  incrementInventoryAndCost,
} from "../../../functions/inventory.js";
import { signTiktokRequest } from "../../../functions/api_sign_functions.js";
import { botApiPostCall } from "../../../functions/api_request_functions.js";

export async function catchWebhook(req, res) {
  const secretId = process.env.tiktok_secrets_id;

  try {
    await res.status(200).json({ ok: true, message: "success" });
    const def_connection = await pools.leviosaPool.getConnection();
    const inv_connection = await pools.inventoryPool.getConnection();
    const mgmt_connection = await pools.managementPool.getConnection();

    try {
      const querySecrets = "SELECT * FROM Shop_Tokens WHERE ID = ?";
      const [secretsResult] = await def_connection.query(querySecrets, [
        secretId,
      ]);

      if (secretsResult.length <= 0) {
        throw new Error("No secrets found.");
      }

      // const receivedSignature = req.headers.authorization;
      const body = req.body;

      const secrets = secretsResult[0];
      // const appKey = secrets.APP_KEY;
      // const appSecret = secrets.APP_SECRET;

      // const stringToSign = appKey + JSON.stringify(body);
      // const sign = signWebhookRequest(stringToSign, appSecret);

      // if (sign !== receivedSignature) {
      //   throw new Error("Tiktok signature mismatch!");
      // }

      switch (body.type) {
        case 1:
          await orderStatusChange(
            body,
            secrets,
            def_connection,
            inv_connection,
            mgmt_connection
          );
          break;
        default:
          break;
      }
    } finally {
      def_connection.release();
      inv_connection.release();
      mgmt_connection.release();
    }
  } catch (error) {
    console.log(error.toString());
    return res.status(401).json({ ok: false, message: "unauthorized" });
  }
}

async function orderStatusChange(
  body,
  secrets,
  def_connection,
  inv_connection,
  mgmt_connection
) {
  const status = body.data.order_status;
  const orderId = body.data.order_id;

  const updateLiveStreamOrders =
    "UPDATE Tiktok_Livestream_Orders SET ORDER_STATUS = ? WHERE ORDER_ID = ?";
  await mgmt_connection.query(updateLiveStreamOrders, [status, orderId]);

  if (status === "AWAITING_SHIPMENT") {
    const selectOrderQuery = "SELECT * FROM Orders_Tiktok WHERE ORDER_ID = ?";
    const [order] = await inv_connection.query(selectOrderQuery, [orderId]);

    if (order.length > 0) {
      console.log(
        `Tiktok order #${orderId} is already in database. Ignoring...`
      );
      return;
    }

    const orderFetch = await getOrderDetail(secrets, orderId);
    if (!orderFetch.ok) {
      console.log(orderFetch);
      return;
    }

    const orderData = orderFetch.data.data.orders[0];
    const skuArray = orderData.line_items.map((item) => ({
      sku: item.seller_sku,
      quantity: 1,
    }));

    const totalReceivables =
      Number(orderData.payment.sub_total) +
      Number(orderData.payment.platform_discount) -
      Number(orderData.payment.shipping_fee_seller_discount);

    const orderCreatedDate = moment
      .unix(orderData.create_time)
      .tz("Asia/Manila")
      .format("YYYY-MM-DD HH:mm:ss");

    const lineItems = await queryProductsPlacement(def_connection, skuArray);

    const splittedProducts = lineItems.products.flatMap((product) => {
      return Array.from({ length: product.quantity }, () => ({
        ...product,
      }));
    });

    const pendingItems = [];
    let counter = 1;
    let totalCost = 0;

    for (const item of splittedProducts) {
      const uniqueId = `TIKTOK_${orderId}_${counter}`;
      pendingItems.push([
        uniqueId,
        orderId,
        item.sku,
        item.name,
        orderCreatedDate,
        "TIKTOK",
        parseFloat(item.cost),
      ]);
      totalCost += parseFloat(item.cost);
      counter++;
    }

    const insertOrder =
      "INSERT INTO Orders_Tiktok (ORDER_ID, ORDER_STATUS, RECEIVABLES_AMOUNT, TOTAL_COST, CREATED_DATE) VALUES (?, ?, ?, ?, ?)";
    const [insert] = await inv_connection.query(insertOrder, [
      orderId,
      status,
      Number(totalReceivables.toFixed(2)),
      totalCost,
      orderCreatedDate,
    ]);

    const insertPending =
      "INSERT INTO Pending_Inventory_Out (ID, ORDER_ID, PRODUCT_SKU, PRODUCT_NAME, ORDER_CREATED, PLATFORM, PRODUCT_COGS) VALUES ?";
    await inv_connection.query(insertPending, [pendingItems]);

    if (insert.affectedRows !== 0) {
      await decrementInventory(def_connection, lineItems.products);
    }

    console.log(`Pending Tiktok order #${orderId} recorded!`);
    return;
  } else if (status === "CANCEL") {
    const selectOrderQuery = "SELECT * FROM Orders_Tiktok WHERE ORDER_ID = ?";
    const [order] = await inv_connection.query(selectOrderQuery, [orderId]);

    if (order.length <= 0) {
      console.log(
        `Cancelled Tiktok order #${orderId} not found in database. Ignoring...`
      );
      return;
    }

    if (["RTS", "CANCELLED"].includes(order[0].ORDER_STATUS)) {
      console.log(
        `Cancelled Shopee order #${orderId} is already recorded. Ignoring...`
      );
      return;
    }

    const orderFetch = await getOrderDetail(secrets, orderId);
    if (!orderFetch.ok) {
      console.log(orderFetch);
      return;
    }

    const orderData = orderFetch.data.data.orders[0];

    let deleteOrdersQuery, insertOrdersQuery, cancelStatus;
    if (orderData.cancel_reason === "Package delivery failed") {
      insertOrdersQuery = `INSERT INTO Pending_Inventory_In (ID, ORDER_ID, PRODUCT_SKU, PRODUCT_NAME, ORDER_CREATED, PLATFORM, PRODUCT_COGS)
      SELECT ID, ORDER_ID, PRODUCT_SKU, PRODUCT_NAME, ORDER_CREATED, PLATFORM, PRODUCT_COGS
      FROM Completed_Inventory_Out
      WHERE ORDER_ID = ?`;
      deleteOrdersQuery =
        "DELETE FROM Completed_Inventory_Out WHERE ORDER_ID = ?";
      cancelStatus = "RTS";
    } else {
      insertOrdersQuery =
        "INSERT INTO Cancelled_Inventory_Out SELECT * FROM Pending_Inventory_Out WHERE ORDER_ID = ?";
      deleteOrdersQuery =
        "DELETE FROM Pending_Inventory_Out WHERE ORDER_ID = ?";
      cancelStatus = "CANCELLED";
    }

    await inv_connection.query(insertOrdersQuery, [orderId]);

    const updateQuery =
      "UPDATE Orders_Tiktok SET ORDER_STATUS = ? WHERE ORDER_ID = ?";
    await inv_connection.query(updateQuery, [cancelStatus, orderId]);

    if (cancelStatus === "CANCELLED") {
      const selectQuery =
        "SELECT * FROM Pending_Inventory_Out WHERE ORDER_ID = ?";
      const [products] = await inv_connection.query(selectQuery, [orderId]);

      if (products.length > 0) {
        const skuArray = [];
        for (const item of orderData.line_items) {
          const itemIndex = skuArray.findIndex(
            (i) => i.sku === item.seller_sku
          );

          if (itemIndex === -1) {
            const product = products.find(
              (p) => p.PRODUCT_SKU === item.seller_sku
            );

            if (!product) continue;
            skuArray.push({
              sku: item.seller_sku,
              name: product.PRODUCT_NAME,
              quantity: 1,
              cost: product.PRODUCT_COGS,
            });
          } else {
            skuArray[itemIndex].quantity += 1;
          }
        }

        const lineItems = await queryProductsCancel(def_connection, skuArray);

        const toUpdate = [];
        for (const product of skuArray) {
          const item = lineItems.products.find((i) => i.sku === product.sku);

          const totalProductCost =
            Number(product.quantity) * Number(product.cost) +
            Number(item.quantity) * Number(item.cost);
          const totalProductQuantity =
            Number(product.quantity) + Number(item.quantity);

          const totalNewCost = parseFloat(
            (totalProductCost / totalProductQuantity).toFixed(2)
          );

          toUpdate.push({
            sku: product.sku,
            name: product.name,
            quantity: product.quantity,
            newCost: totalNewCost,
          });
        }

        await incrementInventoryAndCost(def_connection, toUpdate);
      }
    }

    await inv_connection.query(deleteOrdersQuery, [orderId]);
  } else if (status !== "UNPAID") {
    const selectQuery =
      "SELECT DISCORD_CHANNEL FROM Orders_Tiktok WHERE ORDER_ID = ?";
    const [order] = await inv_connection.query(selectQuery, [orderId]);

    if (!order.length) {
      return;
    }

    const updateQuery =
      "UPDATE Orders_Tiktok SET ORDER_STATUS = ? WHERE ORDER_ID = ?";
    await inv_connection.query(updateQuery, [status, orderId]);

    const path = "/api/notifications/orders/updateOrderThread";
    const fetchBody = {
      status: status,
      threadId: order[0].DISCORD_CHANNEL,
      platform: "TIKTOK",
    };
    await botApiPostCall(fetchBody, path);
  }
}

function signWebhookRequest(input, secret) {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(input);

  return hmac.digest("hex");
}

//GET SHOPEE ORDER DETAIL
async function getOrderDetail(secrets, orderId) {
  const host = "https://open-api.tiktokglobalshop.com";
  const path = `/order/202309/orders`;
  const timest = Math.floor(Date.now() / 1000);

  const accessToken = secrets.ACCESS_TOKEN;
  const appKey = secrets.APP_KEY;
  const appSecret = secrets.APP_SECRET;
  const shopCipher = secrets.SHOP_CIPHER;

  const params = {
    app_key: appKey,
    shop_cipher: shopCipher,
    timestamp: timest,
    ids: orderId,
  };

  let parsedParams = Object.entries(params)
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  const urlPath = `${path}?${parsedParams}`;

  const signReqOptions = {
    url: urlPath,
    headers: { "content-type": "application/json" },
  };

  const signature = signTiktokRequest(signReqOptions, appSecret);

  parsedParams += `&sign=${signature}`;

  const url = `${host}${path}?${parsedParams}`;

  try {
    const options = {
      method: "GET",
      headers: {
        "content-type": "application/json",
        "x-tts-access-token": accessToken,
      },
    };
    const response = await fetch(url, options);
    const responseData = await response.json();

    if (responseData.code !== 0) {
      return { ok: false, data: responseData };
    } else {
      if (Number(responseData.data.orders[0].payment.sub_total) <= 0) {
        return {
          ok: false,
          error: "The order is a gift.",
          data: responseData,
        };
      } else {
        return { ok: true, data: responseData };
      }
    }
  } catch (error) {
    console.log("TIKTOK FETCH ERROR: ", error);
    return { ok: false, data: null, error: error.toString() };
  }
}
