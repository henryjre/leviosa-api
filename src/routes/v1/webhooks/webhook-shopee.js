import crypto from "crypto";
import moment from "moment-timezone";

import conn from "../../../sqlConnections.js";
import {
  queryProductsPlacement,
  queryProductsCancel,
  decrementInventory,
  incrementInventoryAndCost,
} from "../../../functions/inventory.js";
import {
  botApiPostCall,
  shopeeGetAPIRequest,
} from "../../../functions/api_request_functions.js";

export async function catchWebhook(req, res) {
  const secretId = process.env.shopee_secrets_id;

  try {
    const def_connection = await conn.leviosaConnection();
    const inv_connection = await conn.inventoryConnection();

    try {
      const querySecrets = "SELECT * FROM Shop_Tokens WHERE ID = ?";
      const [secretsResult] = await def_connection.query(querySecrets, [
        secretId,
      ]);

      if (secretsResult.length <= 0) {
        throw new Error("No secrets found.");
      }

      const secrets = secretsResult[0];

      // const receivedSignature = req.get("Authorization");
      const body = req.body;

      // const url =
      //   "https://jellyfish-app-yevob.ondigitalocean.app/api/v1/webhooks/shopee";
      // const responseContent = JSON.stringify(body);
      // const partnerKey = secrets.APP_KEY;
      // const sign = signWebhookRequest(url, responseContent, partnerKey);

      // if (sign !== receivedSignature) {
      //   throw new Error("Shopee signature mismatch!");
      // }

      switch (parseInt(body.code)) {
        case 3:
          return await orderStatusChange(
            body,
            secrets,
            def_connection,
            inv_connection,
            res
          );
        default:
          return res.status(200).json({ ok: true, message: "success" });
      }
    } finally {
      await def_connection.end();
      await inv_connection.end();
    }
  } catch (error) {
    console.log(error.toString());

    return res.status(400).json({ ok: false, message: "fail" });
  }
}

async function orderStatusChange(
  body,
  secrets,
  def_connection,
  inv_connection,
  res
) {
  const status = body.data.status;
  const orderId = body.data.ordersn;

  if (status === "READY_TO_SHIP") {
    const selectOrderQuery = "SELECT * FROM Orders_Shopee WHERE ORDER_ID = ?";
    const [order] = await inv_connection.query(selectOrderQuery, [orderId]);

    if (order.length > 0) {
      if (order[0].status === "IN_CANCEL") {
        const insertOrdersQuery =
          "INSERT IGNORE INTO Pending_Inventory_Out SELECT * FROM Cancelled_Inventory_Out WHERE ORDER_ID = ?";
        const deleteOrdersQuery =
          "DELETE FROM Cancelled_Inventory_Out WHERE ORDER_ID = ?";

        const updateQuery =
          "UPDATE Orders_Shopee SET ORDER_STATUS = ? WHERE ORDER_ID = ?";
        await inv_connection.query(updateQuery, [status, orderId]);

        await inv_connection.query(insertOrdersQuery, [orderId]);
        await inv_connection.query(deleteOrdersQuery, [orderId]);

        return res.status(200).json({ ok: true, message: "success" });
      } else {
        console.log(
          `Shopee order #${orderId} is already in database. Ignoring...`
        );
        return res.status(200).json({ ok: true, message: "success" });
      }
    }

    const orderFetch = await getOrderDetail(secrets, orderId);
    if (!orderFetch.ok) {
      console.log(orderFetch);
      return res.status(400).json({ ok: false, message: "fail" });
    }

    const orderData = orderFetch.data.response.order_list[0];

    const skuArray = orderData.item_list.map((item) => ({
      sku: item.model_sku.length > 0 ? item.model_sku : item.item_sku,
      quantity: item.model_quantity_purchased,
    }));

    const totalReceivables = orderData.item_list.reduce((total, obj) => {
      const discountedPrice = obj.model_discounted_price;
      const quantityPurchased = obj.model_quantity_purchased;
      const subtotal = discountedPrice * quantityPurchased;

      return total + subtotal;
    }, 0);

    const orderCreatedDate = moment
      .unix(orderData.create_time)
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
      const uniqueId = `SHOPEE_${orderData.order_sn}_${counter}`;
      pendingItems.push([
        uniqueId,
        orderData.order_sn,
        item.sku,
        item.name,
        orderCreatedDate,
        "SHOPEE",
        parseFloat(item.cost),
      ]);
      totalCost += parseFloat(item.cost);
      counter++;
    }

    const insertOrder =
      "INSERT IGNORE INTO Orders_Shopee (ORDER_ID, ORDER_STATUS, RECEIVABLES_AMOUNT, TOTAL_COST, CREATED_DATE) VALUES (?, ?, ?, ?, ?)";
    const [insert] = await inv_connection.query(insertOrder, [
      orderData.order_sn,
      status,
      Number(totalReceivables.toFixed(2)),
      totalCost,
      orderCreatedDate,
    ]);

    const insertPending =
      "INSERT IGNORE INTO Pending_Inventory_Out (ID, ORDER_ID, PRODUCT_SKU, PRODUCT_NAME, ORDER_CREATED, PLATFORM, PRODUCT_COGS) VALUES ?";
    await inv_connection.query(insertPending, [pendingItems]);

    if (insert.affectedRows !== 0) {
      await decrementInventory(def_connection, lineItems.products);
    }

    console.log(`Pending Shopee order #${orderId} recorded!`);
    return res.status(200).json({ ok: true, message: "success" });
  } else if (status === "IN_CANCEL") {
    const selectOrderQuery = "SELECT * FROM Orders_Shopee WHERE ORDER_ID = ?";
    const [order] = await inv_connection.query(selectOrderQuery, [orderId]);

    if (order.length <= 0) {
      console.log(
        `Cancelled Shopee order #${orderId} not found in database. Ignoring...`
      );
      return res.status(200).json({ ok: true, message: "success" });
    }

    if (order[0].ORDER_STATUS === "IN_CANCEL") {
      console.log(
        `Pending cancel Shopee order #${orderId} is already recorded. Ignoring...`
      );
      return res.status(200).json({ ok: true, message: "success" });
    }

    const insertOrdersQuery =
      "INSERT IGNORE INTO Cancelled_Inventory_Out SELECT * FROM Pending_Inventory_Out WHERE ORDER_ID = ?";
    const deleteOrdersQuery =
      "DELETE FROM Pending_Inventory_Out WHERE ORDER_ID = ?";

    const updateQuery =
      "UPDATE Orders_Shopee SET ORDER_STATUS = ? WHERE ORDER_ID = ?";
    await inv_connection.query(updateQuery, [status, orderId]);

    await inv_connection.query(insertOrdersQuery, [orderId]);
    await inv_connection.query(deleteOrdersQuery, [orderId]);

    return res.status(200).json({ ok: true, message: "success" });
  } else if (status === "CANCELLED") {
    const selectOrderQuery = "SELECT * FROM Orders_Shopee WHERE ORDER_ID = ?";
    const [order] = await inv_connection.query(selectOrderQuery, [orderId]);

    if (order.length <= 0) {
      console.log(
        `Cancelled Shopee order #${orderId} not found in database. Ignoring...`
      );
      return res.status(200).json({ ok: true, message: "success" });
    }

    if (["RTS", "CANCELLED"].includes(order[0].ORDER_STATUS)) {
      console.log(
        `Cancelled Shopee order #${orderId} is already recorded. Ignoring...`
      );
      return res.status(200).json({ ok: true, message: "success" });
    }

    const orderFetch = await getOrderDetail(secrets, orderId);
    if (!orderFetch.ok) {
      console.log(orderFetch);
      return res.status(400).json({ ok: false, message: "fail" });
    }

    const orderData = orderFetch.data.response.order_list[0];

    let deleteOrdersQuery, insertOrdersQuery, cancelStatus;
    if (orderData.cancel_reason === "Failed Delivery") {
      insertOrdersQuery = `INSERT IGNORE INTO Pending_Inventory_In (ID, ORDER_ID, PRODUCT_SKU, PRODUCT_NAME, ORDER_CREATED, PLATFORM, PRODUCT_COGS)
      SELECT ID, ORDER_ID, PRODUCT_SKU, PRODUCT_NAME, ORDER_CREATED, PLATFORM, PRODUCT_COGS
      FROM Completed_Inventory_Out
      WHERE ORDER_ID = ?`;
      deleteOrdersQuery =
        "DELETE FROM Completed_Inventory_Out WHERE ORDER_ID = ?";
      cancelStatus = "RTS";
    } else {
      insertOrdersQuery =
        "INSERT IGNORE INTO Cancelled_Inventory_Out SELECT * FROM Pending_Inventory_Out WHERE ORDER_ID = ?";
      deleteOrdersQuery =
        "DELETE FROM Pending_Inventory_Out WHERE ORDER_ID = ?";
      cancelStatus = "CANCELLED";
    }

    await inv_connection.query(insertOrdersQuery, [orderData.order_sn]);

    const orderCancelDate = moment
      .unix(orderData.update_time)
      .format("YYYY-MM-DD HH:mm:ss");

    const updateQuery =
      "UPDATE Orders_Shopee SET ORDER_STATUS = ?, CANCEL_DATE = ? WHERE ORDER_ID = ?";
    await inv_connection.query(updateQuery, [
      cancelStatus,
      orderCancelDate,
      orderData.order_sn,
    ]);

    let table;
    if (cancelStatus === "CANCELLED") {
      table = "Cancelled_Inventory_Out";
    } else {
      table = "Completed_Inventory_Out";
    }

    const selectQuery = `SELECT * FROM ${table} WHERE ORDER_ID = ?`;
    const [products] = await inv_connection.query(selectQuery, [
      orderData.order_sn,
    ]);

    if (products.length > 0) {
      const skuArray = orderData.item_list.map((item) => {
        const itemSku =
          item.model_sku.length > 0 ? item.model_sku : item.item_sku;
        const product = products.find((p) => p.PRODUCT_SKU === itemSku);
        return {
          sku: itemSku,
          name: product.PRODUCT_NAME,
          quantity: item.model_quantity_purchased,
          cost: product.PRODUCT_COGS,
        };
      });
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

    await inv_connection.query(deleteOrdersQuery, [orderData.order_sn]);

    return res.status(200).json({ ok: true, message: "success" });
  } else {
    const selectQuery =
      "SELECT DISCORD_CHANNEL FROM Orders_Shopee WHERE ORDER_ID = ?";
    const [order] = await inv_connection.query(selectQuery, [orderId]);

    if (!order.length) {
      return res.status(200).json({ ok: true, message: "success" });
    }

    const updateQuery =
      "UPDATE Orders_Shopee SET ORDER_STATUS = ? WHERE ORDER_ID = ?";
    await inv_connection.query(updateQuery, [status, orderId]);

    const path = "/api/notifications/orders/updateOrderThread";
    const fetchBody = {
      status: status,
      threadId: order[0].DISCORD_CHANNEL,
      platform: "SHOPEE",
    };
    await botApiPostCall(fetchBody, path);

    return res.status(200).json({ ok: true, message: "success" });
  }
}

function signWebhookRequest(url, responseContent, partnerKey) {
  const signatureBaseString = `${url}|${responseContent}`;
  const keyBuffer = Buffer.from(partnerKey, "utf-8");
  const hmac = crypto.createHmac("sha256", keyBuffer);
  hmac.update(signatureBaseString);
  return hmac.digest("hex");
}

//GET SHOPEE ORDER DETAIL
async function getOrderDetail(secrets, orderId) {
  const path = "/api/v2/order/get_order_detail";

  const optionalFields = [
    "buyer_user_id",
    "buyer_username",
    "item_list",
    "invoice_data",
    "payment_method",
    "total_amount",
    "cancel_reason",
  ];

  const params = {
    order_sn_list: orderId,
    response_optional_fields: optionalFields.join(","),
  };

  return shopeeGetAPIRequest(secrets, path, params);
}
