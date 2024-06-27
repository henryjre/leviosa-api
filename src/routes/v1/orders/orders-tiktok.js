import {
  decrementInventory,
  queryProductsPlacement,
} from "../../../functions/inventory.js";
import { getTiktokOrderList } from "../../../functions/tiktok.js";
// import conn from "../../../sqlConnections.js";
import pools from "../../../sqlPools.js";
import moment from "moment-timezone";

const secretId = process.env.tiktok_secrets_id;

export async function getPendingTiktokOrders(req, res) {
  try {
    // const def_connection = await conn.leviosaConnection();
    const def_connection = await pools.leviosaPool.getConnection();
    // const inv_connection = await conn.inventoryConnection();
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

      const currentDate = moment();

      const startTime = currentDate.clone().subtract(7, "days").startOf("day");
      const endTime = currentDate.endOf("day");

      const startTimeUnix = startTime.unix();
      const endTimeUnix = endTime.unix();

      const startTimeSql = startTime.format("YYYY-MM-DD HH:mm:ss");
      const endTimeSql = endTime.format("YYYY-MM-DD HH:mm:ss");

      const tiktokOrdersFetch = await getTiktokOrderList(
        secrets,
        startTimeUnix,
        endTimeUnix,
        "AWAITING_SHIPMENT"
      );

      if (!tiktokOrdersFetch.ok) {
        throw new Error(
          "There was an error while getting the Tiktok Orders. Please try again"
        );
      }

      if (tiktokOrdersFetch.data.data.total_count === 0) {
        return res
          .status(200)
          .json({ ok: true, message: "No pending orders found." });
      }

      const tiktokOrdersResult = tiktokOrdersFetch.data.data.orders;

      const selectQuery = `
        SELECT ORDER_ID FROM Orders_Tiktok
        WHERE CREATED_DATE BETWEEN ? AND ? 
        AND ORDER_STATUS = 'AWAITING_SHIPMENT' 
        ORDER BY CREATED_DATE ASC;
      `;
      const [dbOrdersFetch] = await inv_connection.query(selectQuery, [
        startTimeSql,
        endTimeSql,
      ]);
      const dbOrdersId = dbOrdersFetch.map((item) => item.ORDER_ID);

      const pendingOrders = tiktokOrdersResult.filter(
        (order) => !dbOrdersId.includes(order.id)
      );

      if (pendingOrders.length <= 0) {
        return res
          .status(200)
          .json({ ok: true, message: "No pending orders to record." });
      }

      for (const order of pendingOrders) {
        const skuArray = order.line_items.map((item) => ({
          sku: item.seller_sku,
          quantity: 1,
        }));

        const totalReceivables =
          Number(order.payment.sub_total) +
          Number(order.payment.platform_discount) -
          Number(order.payment.shipping_fee_seller_discount);

        const orderCreatedDate = moment
          .unix(order.create_time)
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
        let totalCost = 0;

        for (const item of splittedProducts) {
          const uniqueId = `TIKTOK_${order.id}_${counter}`;
          pendingItems.push([
            uniqueId,
            order.id,
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
          order.id,
          order.status,
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

        console.log(`Pending Tiktok order #${order.id} recorded!`);
      }

      return res
        .status(200)
        .json({ ok: true, message: "All orders were recorded!" });
    } finally {
      // await def_connection.end();
      def_connection.release();
      // await inv_connection.end();
      inv_connection.release();
    }
  } catch (error) {
    console.log(
      `Error in function getPendingTiktokOrders: ${error.message}\n\nFull details:\n${error}`
    );

    return res.status(400).json({ ok: false, message: error.message });
  }
}

export async function updateTiktokOrderStatuses(req, res) {
  try {
    // const def_connection = await conn.leviosaConnection();
    const def_connection = await pools.leviosaPool.getConnection();
    // const inv_connection = await conn.inventoryConnection();
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

      const selectQuery = `
      SELECT *
      FROM Orders_Tiktok 
      WHERE ORDER_STATUS NOT IN ('COMPLETED', 'CANCELLED', 'RTS')
      AND CREATED_DATE <= DATE_SUB(CURDATE(), INTERVAL 3 DAY)
      ORDER BY CREATED_DATE ASC 
      LIMIT 30;
    `;

      const [orders] = await inv_connection.query(selectQuery);

      if (orders.length === 0) {
        return res
          .status(200)
          .json({ ok: true, message: "No orders to update found." });
      }

      let startDate = moment();
      let endDate = moment(0);

      for (const order of orders) {
        const createdDate = moment(order.CREATED_DATE);

        if (createdDate.isBefore(startDate)) {
          startDate = createdDate;
        }

        if (createdDate.isAfter(endDate)) {
          endDate = createdDate;
        }
      }

      const startTimeUnix = startDate.unix();
      const endTimeUnix = endDate.unix();

      const tiktokOrdersFetch = await getTiktokOrderList(
        secrets,
        startTimeUnix,
        endTimeUnix,
        "COMPLETED"
      );

      if (!tiktokOrdersFetch.ok) {
        throw new Error(
          "There was an error while getting the Tiktok Orders. Please try again"
        );
      }

      if (tiktokOrdersFetch.data.data.total_count === 0) {
        return res
          .status(200)
          .json({ ok: true, message: "No orders to update found." });
      }

      const tiktokOrdersResult = tiktokOrdersFetch.data.data.orders;

      const ordersResult = tiktokOrdersResult.map((order) => ({
        order_id: order.id,
        status: order.status,
      }));

      const orderIdsCsv = ordersResult
        .map((order) => `'${order.order_id}'`)
        .join(", ");

      const updateProductQuery = `
        UPDATE Orders_Tiktok
            SET ORDER_STATUS = CASE ORDER_ID
                ${ordersResult
                  .map(
                    (order) => `WHEN '${order.order_id}' THEN '${order.status}'`
                  )
                  .join(" ")}
            END
        WHERE ORDER_ID IN (${orderIdsCsv});`;

      const [query] = await inv_connection.query(updateProductQuery);

      if (query.changedRows === 0) {
        return res.status(200).json({
          ok: true,
          message: "No orders were updated",
          length: ordersResult.length,
          updated: query.changedRows,
        });
      } else {
        return res.status(200).json({
          ok: true,
          message: "Order statuses updated!",
          length: ordersResult.length,
          updated: query.changedRows,
        });
      }
    } finally {
      // await def_connection.end();
      def_connection.release();
      // await inv_connection.end();
      inv_connection.release();
    }
  } catch (error) {
    console.log(
      `Error in function updateTiktokOrderStatuses: ${error.message}\n\nFull details:\n${error}`
    );

    return res.status(400).json({ ok: false, message: error.message });
  }
}
