import { getMultipleLazOrders } from "../functions/lazada.js";
import { getShopeeOrders } from "../functions/shopee.js";
import pools from "../sqlPools.js";
import fetch from "node-fetch";

export async function shopeeOrderNotif() {
  const secretId = process.env.shopee_secrets_id;

  try {
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

      const selectOrdersQuery = `SELECT * FROM Orders_Shopee WHERE DISCORD_CHANNEL IS NULL ORDER BY CREATED_DATE ASC LIMIT 10`;
      const [shopeeOrdersDb] = await inv_connection.query(selectOrdersQuery);

      if (!shopeeOrdersDb.length) {
        console.log("No shopee orders for new discord notification");
        return;
      }

      const orderIds = shopeeOrdersDb.map((o) => o.ORDER_ID);
      const shopeeOrdersFetch = await getShopeeOrders(secrets, orderIds);

      if (!shopeeOrdersFetch.ok) {
        console.log(shopeeOrdersFetch);
        throw new Error(
          "There was a problem while fetching shopee orders from function shopeeOrderNotif()"
        );
      }

      const orders = shopeeOrdersFetch.data.response.order_list[0];

      const fetchBody = {
        data: orders,
        platform: "SHOPEE",
      };

      const fetchResult = await sendNotificationData(fetchBody);
      console.log(fetchResult);
    } finally {
      inv_connection.release();
    }
  } catch (error) {
    console.log(error.toString());
  }
}

export async function lazadaOrderNotif() {
  const secretId = process.env.lazada_secrets_id;

  try {
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

      const selectOrdersQuery = `SELECT * FROM Orders_Lazada WHERE DISCORD_CHANNEL IS NULL ORDER BY CREATED_DATE ASC LIMIT 10`;
      const [lazOrdersDb] = await inv_connection.query(selectOrdersQuery);

      if (!lazOrdersDb.length) {
        console.log("No lazada orders for new discord notification");
        return;
      }

      const orderIds = lazOrdersDb.map((o) => o.ORDER_ID);
      const lazOrderFetch = await getMultipleLazOrders(secrets, orderIds);

      if (!lazOrderFetch.ok) {
        console.log(lazOrderFetch);
        throw new Error(
          "There was a problem while fetching shopee orders from function shopeeOrderNotif()"
        );
      }

      const orders = lazOrderFetch.data.data;

      const fetchBody = {
        data: orders,
        platform: "LAZADA",
      };

      const fetchResult = await sendNotificationData(fetchBody);
      console.log(fetchResult);
    } finally {
      inv_connection.release();
    }
  } catch (error) {
    console.log(error.toString());
  }
}

async function sendNotificationData(fetchBody) {
  const apiUrl = "https://leviosa.mysrv.us";
  const path = "/api/notifications/orders/createOrderThread";

  const url = `${apiUrl}${path}`;

  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.apiKey,
    },
    body: JSON.stringify(fetchBody),
  };

  const response = await fetch(url, options);
  const responseData = await response.json();

  return responseData;
}
