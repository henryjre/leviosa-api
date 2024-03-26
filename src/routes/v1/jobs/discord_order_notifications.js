import { botApiPostCall } from "../../../functions/api_request_functions.js";
import { getMultipleLazOrders } from "../../../functions/lazada.js";
import { getShopeeOrders } from "../../../functions/shopee.js";
import { getTiktokOrdersDetails } from "../../../functions/tiktok.js";
import pools from "../../../sqlPools.js";

const path = "/api/notifications/orders/createOrderThread";

export async function runDiscordNotifs(req, res) {
  try {
    console.log("Running shopee discord notifications...");
    await shopeeOrderNotif();
    console.log("Running lazada discord notifications...");
    await lazadaOrderNotif();
    console.log("Running tiktok discord notifications...");
    await tiktokOrderNotif();
    return res.status(200).json({ ok: true, message: "success" });
  } catch (error) {
    console.log(error.toString());
    return res.status(400).json({ ok: false, message: "fail" });
  }
}

async function shopeeOrderNotif() {
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

      if (shopeeOrdersDb.length === 0) {
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

      const orders = shopeeOrdersFetch.data.response.order_list;

      const fetchBody = {
        data: orders,
        platform: "SHOPEE",
      };

      const fetchResult = await botApiPostCall(fetchBody, path);
      if (fetchResult === null) {
        throw new Error(
          "There was a problem while creating threads for shopee notifications."
        );
      }

      const updateData = fetchResult.updated;

      if (updateData.length <= 0) {
        throw new Error("No threads were created for shopee orders.");
      }

      const updateQuery = `
  UPDATE Orders_Shopee
  SET DISCORD_CHANNEL = CASE ORDER_ID
    ${updateData
      .map((order) => `WHEN '${order.orderId}' THEN ${order.threadId}`)
      .join(" ")}
  END
  WHERE ORDER_ID IN (${updateData
    .map((order) => `'${order.orderId}'`)
    .join(", ")});
`;
      await inv_connection.query(updateQuery);
    } finally {
      inv_connection.release();
    }
  } catch (error) {
    console.log(error.toString());
  }
}

async function lazadaOrderNotif() {
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

      if (lazOrdersDb.length === 0) {
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

      const fetchResult = await botApiPostCall(fetchBody, path);
      if (fetchResult === null) {
        throw new Error(
          "There was a problem while creating threads for lazada notifications."
        );
      }

      const updateData = fetchResult.updated;

      if (updateData.length <= 0) {
        throw new Error("No threads were created for lazada orders.");
      }

      const updateQuery = `
  UPDATE Orders_Lazada
  SET DISCORD_CHANNEL = CASE ORDER_ID
    ${updateData
      .map((order) => `WHEN '${order.orderId}' THEN ${order.threadId}`)
      .join(" ")}
  END
  WHERE ORDER_ID IN (${updateData
    .map((order) => `'${order.orderId}'`)
    .join(", ")});
`;
      await inv_connection.query(updateQuery);
    } finally {
      inv_connection.release();
    }
  } catch (error) {
    console.log(error.toString());
  }
}

async function tiktokOrderNotif() {
  const secretId = process.env.tiktok_secrets_id;

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

      const selectOrdersQuery = `SELECT * FROM Orders_Tiktok WHERE DISCORD_CHANNEL IS NULL ORDER BY CREATED_DATE ASC LIMIT 10`;
      const [tiktokOrdersDb] = await inv_connection.query(selectOrdersQuery);

      if (tiktokOrdersDb.length === 0) {
        console.log("No tiktok orders for new discord notification");
        return;
      }

      const orderIds = tiktokOrdersDb.map((o) => o.ORDER_ID);

      const tiktokOrdersFetch = await getTiktokOrdersDetails(secrets, orderIds);

      if (!tiktokOrdersFetch.ok) {
        console.log(tiktokOrdersFetch);
        throw new Error(
          "There was a problem while fetching shopee orders from function shopeeOrderNotif()"
        );
      }

      if (tiktokOrdersFetch.data.code !== 0) {
        console.log(tiktokOrdersFetch.data);
        throw new Error(
          "There was a problem while fetching shopee orders from function shopeeOrderNotif()"
        );
      }

      const orders = tiktokOrdersFetch.data.data.orders;

      const fetchBody = {
        data: orders,
        platform: "TIKTOK",
      };

      const fetchResult = await botApiPostCall(fetchBody, path);
      if (fetchResult === null) {
        throw new Error(
          "There was a problem while creating threads for tiktok notifications."
        );
      }

      const updateData = fetchResult.updated;

      if (updateData.length <= 0) {
        throw new Error("No threads were created for tiktok orders.");
      }

      const updateQuery = `
  UPDATE Orders_Tiktok
  SET DISCORD_CHANNEL = CASE ORDER_ID
    ${updateData
      .map((order) => `WHEN '${order.orderId}' THEN ${order.threadId}`)
      .join(" ")}
  END
  WHERE ORDER_ID IN (${updateData
    .map((order) => `'${order.orderId}'`)
    .join(", ")});
`;
      await inv_connection.query(updateQuery);
    } finally {
      inv_connection.release();
    }
  } catch (error) {
    console.log(error.toString());
  }
}
