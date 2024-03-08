import fetch from "node-fetch";
import crypto from "crypto";
import moment from "moment-timezone";

import pools from "../../../sqlPools.js";
import {
  queryProductsCancel,
  queryProductsPlacement,
} from "../../../functions/inventory.js";
import { lazadaGetAPIRequest } from "../../../functions/api_request_functions.js";

const processedLazadaOrders = new Set();
export async function catchWebhook(req, res) {
  try {
    const body = req.body;
    const auth = req.headers.authorization;
    const secretId = process.env.lazada_secrets_id;

    const def_connection = await pools.leviosaPool.getConnection();
    const inv_connection = await pools.inventoryPool.getConnection();

    try {
      const querySecrets = "SELECT * FROM Shop_Tokens WHERE ID = ?";
      const [secretsResult] = await def_connection.query(querySecrets, [
        secretId,
      ]);

      if (secretsResult.length <= 0) {
        throw new Error("No secrets found.");
      }
      const secrets = secretsResult[0];

      const appKey = secrets.APP_KEY;
      const secretKey = secrets.APP_SECRET;

      const stringToSign = appKey + JSON.stringify(body);
      const sign = signWebhookRequest(stringToSign, secretKey);

      if (sign !== auth) {
        throw new Error("Lazada signature mismatch!");
      }

      res.status(200).json({ ok: true, message: "success" });

      switch (body.message_type) {
        case 0:
          await orderStatusChange();
          break;
        default:
          break;
      }

      async function orderStatusChange() {
        const status = body.data.order_status;
        const orderId = body.data.trade_order_id;
        const checkDupeId = `${orderId}-${status}`;

        if (status === "unpaid") {
          console.log(
            `Unpaid Lazada order received: ${checkDupeId}. Ignoring...`
          );
          return;
        }

        if (processedLazadaOrders.has(checkDupeId)) {
          console.log(
            `Duplicate Lazada order push received: ${checkDupeId}. Ignoring...`
          );
          return;
        }

        processedLazadaOrders.add(checkDupeId);

        if (status === "pending") {
          const orderFetch = await getOrderDetail(secrets, orderId);
          if (!orderFetch.ok) {
            console.log(orderFetch);
            return;
          }

          const skuArray = orderFetch.data.data.map((item) => ({
            sku: item.sku.split("-")[0],
            quantity: 1,
          }));

          const totalReceivables = orderFetch.data.data.reduce(
            (sum, obj) => sum + obj.item_price,
            0
          );

          const orderCreatedDate = moment(
            orderFetch.data.data[0].created_at,
            "YYYY-MM-DD HH:mm:ss ZZ"
          )
            .tz("Asia/Manila")
            .format("YYYY-MM-DD HH:mm:ss");

          const lineItems = await queryProductsPlacement(
            def_connection,
            skuArray
          );

          const splittedProducts = lineItems.products.flatMap((product) => {
            return Array.from({ length: product.quantity }, () => ({
              ...product,
            }));
          });

          const pendingItems = [];
          let counter = 1;

          for (const item of splittedProducts) {
            const uniqueId = `LAZADA_${orderId}_${counter}`;
            pendingItems.push([
              uniqueId,
              orderId,
              item.sku,
              item.name,
              orderCreatedDate,
              "LAZADA",
              parseFloat(item.cost),
            ]);
            counter++;
          }

          const insertPending =
            "INSERT IGNORE INTO Pending_Inventory_Out (ID, ORDER_ID, PRODUCT_SKU, PRODUCT_NAME, ORDER_CREATED, PLATFORM, PRODUCT_COGS) VALUES ?";
          await inv_connection.query(insertPending, [pendingItems]);

          const insertOrder =
            "INSERT IGNORE INTO Orders_Lazada (ORDER_ID, ORDER_STATUS, RECEIVABLES_AMOUNT) VALUES (?, ?, ?)";
          await inv_connection.query(insertOrder, [
            orderId,
            status,
            Number(totalReceivables.toFixed(2)),
          ]);

          // await decrementInventory(def_connection, lineItems.products);
        } else if (["canceled", "shipped_back"].includes(status)) {
          const selectOrderQuery =
            "SELECT * FROM Orders_Lazada WHERE ORDER_ID = ?";
          const [order] = await inv_connection.query(selectOrderQuery, [
            orderId,
          ]);

          if (order.length <= 0) {
            console.log(
              `Cancelled Lazada order #${orderId} not found in database. Ignoring...`
            );
            return;
          }

          if (["RTS", "CANCELLED"].includes(order[0].ORDER_STATUS)) {
            console.log(
              `Cancelled Lazada order #${orderId} is already recorded. Ignoring...`
            );
            return;
          }

          const orderFetch = await getOrderDetail(secrets, orderId);
          if (!orderFetch.ok) {
            console.log(orderFetch);
            return;
          }

          let deleteOrdersQuery, insertOrdersQuery, cancelStatus;
          if (status === "canceled") {
            insertOrdersQuery =
              "INSERT IGNORE INTO Cancelled_Inventory_Out SELECT * FROM Pending_Inventory_Out WHERE ORDER_ID = ?";
            deleteOrdersQuery =
              "DELETE FROM Pending_Inventory_Out WHERE ORDER_ID = ?";
            cancelStatus = "CANCELLED";
          } else {
            insertOrdersQuery = `INSERT IGNORE INTO Pending_Inventory_In (ID, ORDER_ID, PRODUCT_SKU, PRODUCT_NAME, ORDER_CREATED, PLATFORM, PRODUCT_COGS)
            SELECT ID, ORDER_ID, PRODUCT_SKU, PRODUCT_NAME, ORDER_CREATED, PLATFORM, PRODUCT_COGS
            FROM Completed_Inventory_Out
            WHERE ORDER_ID = ?`;
            deleteOrdersQuery =
              "DELETE FROM Completed_Inventory_Out WHERE ORDER_ID = ?";
            cancelStatus = "RTS";
          }

          await inv_connection.query(insertOrdersQuery, [orderId]);

          const updateQuery =
            "UPDATE Orders_Lazada SET ORDER_STATUS = ? WHERE ORDER_ID = ?";
          await inv_connection.query(updateQuery, [cancelStatus, orderId]);

          if (status === "canceled") {
            const selectQuery =
              "SELECT * FROM Pending_Inventory_Out WHERE ORDER_ID = ?";
            const [products] = await inv_connection.query(selectQuery, [
              orderId,
            ]);

            const skuArray = [];
            for (const item of orderFetch.data.data) {
              const itemIndex = skuArray.findIndex((i) => i.sku === item.sku);
              if (itemIndex === -1) {
                const product = products.find(
                  (p) => p.PRODUCT_SKU === item.sku
                );

                if (!product) continue;
                skuArray.push({
                  sku: item.sku,
                  name: product.PRODUCT_NAME,
                  quantity: 1,
                  cost: product.PRODUCT_COGS,
                });
              } else {
                skuArray[itemIndex].quantity += 1;
              }
            }

            const lineItems = await queryProductsCancel(
              def_connection,
              skuArray
            );

            const toUpdate = [];
            for (const product of skuArray) {
              const item = lineItems.products.find(
                (i) => i.sku === product.sku
              );

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

            // await incrementInventoryAndCost(def_connection, toUpdate);
          }

          await inv_connection.query(deleteOrdersQuery, [orderId]);
        } else {
          const updateQuery =
            "UPDATE Orders_Lazada SET ORDER_STATUS = ? WHERE ORDER_ID = ?";
          await inv_connection.query(updateQuery, [status, orderId]);
        }
      }
    } finally {
      def_connection.release();
      inv_connection.release();
    }
  } catch (error) {
    console.error(error.toString());
    return res.status(404).json({ ok: false, message: error.toString() });
  }
}

function signWebhookRequest(input, secret) {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(input);

  return hmac.digest("hex");
}

//GET LAZADA ORDER DETAIL
async function getOrderDetail(secrets, orderId) {
  const path = "/order/items/get";
  const params = { order_id: orderId };
  return lazadaGetAPIRequest(secrets, path, params);
}
