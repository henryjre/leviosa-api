import {
  decrementInventory,
  queryProductsPlacement,
} from "../../../functions/inventory.js";
import {
  getLazadaOrderList,
  getMultipleLazOrders,
} from "../../../functions/lazada.js";
import pools from "../../../sqlPools.js";
import moment from "moment-timezone";

export async function getPendingLazadaOrders(req, res) {
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

      const currentDate = moment();

      const startTime = currentDate.clone().subtract(7, "days").startOf("day");
      const endTime = currentDate.endOf("day");

      const startTimeUnix = startTime.toISOString();
      const endTimeUnix = endTime.toISOString();

      const startTimeSql = startTime.format("YYYY-MM-DD HH:mm:ss");
      const endTimeSql = endTime.format("YYYY-MM-DD HH:mm:ss");

      const lazadaOrdersFetch = await getLazadaOrderList(
        secrets,
        startTimeUnix,
        endTimeUnix
      );

      if (!lazadaOrdersFetch.ok) {
        throw new Error(
          "There was an error while getting the Lazada Orders. Please try again"
        );
      }

      const lazadaOrdersResult = lazadaOrdersFetch.data.data.orders;

      if (lazadaOrdersResult.length <= 0) {
        return res
          .status(200)
          .json({ ok: true, message: "No pending orders found." });
      }

      const selectQuery = `
        SELECT ORDER_ID FROM Orders_Lazada 
        WHERE CREATED_DATE BETWEEN ? AND ? 
        AND ORDER_STATUS = 'pending' 
        ORDER BY CREATED_DATE ASC;
      `;
      const [dbOrdersFetch] = await inv_connection.query(selectQuery, [
        startTimeSql,
        endTimeSql,
      ]);

      const lazadaOrdersId = lazadaOrdersResult.map((o) =>
        String(o.order_number)
      );
      const dbOrdersId = dbOrdersFetch.map((item) => item.ORDER_ID);

      const pendingOrdersId = lazadaOrdersId.filter(
        (orderId) => !dbOrdersId.includes(orderId)
      );

      if (pendingOrdersId.length <= 0) {
        return res
          .status(200)
          .json({ ok: true, message: "No pending orders to record." });
      }

      const lazadaOrdersDataFetch = await getMultipleLazOrders(
        secrets,
        pendingOrdersId
      );

      if (!lazadaOrdersDataFetch.ok) {
        throw new Error(
          "There was an error while getting order data. Please try again."
        );
      }

      const ordersData = lazadaOrdersDataFetch.data.data;

      for (const order of ordersData) {
        const skuArray = order.order_items.map((item) => ({
          sku: item.sku.split("-")[0],
          quantity: 1,
        }));

        const totalReceivables = order.order_items.reduce(
          (sum, obj) => sum + obj.item_price,
          0
        );

        const orderCreatedDate = moment(
          order.order_items[0].created_at,
          "YYYY-MM-DD HH:mm:ss ZZ"
        ).format("YYYY-MM-DD HH:mm:ss");

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
          const uniqueId = `LAZADA_${order.order_number}_${counter}`;
          pendingItems.push([
            uniqueId,
            String(order.order_number),
            item.sku,
            item.name,
            orderCreatedDate,
            "LAZADA",
            parseFloat(item.cost),
          ]);
          totalCost += parseFloat(item.cost);
          counter++;
        }

        const insertOrder =
          "INSERT IGNORE INTO Orders_Lazada (ORDER_ID, ORDER_STATUS, RECEIVABLES_AMOUNT, TOTAL_COST, CREATED_DATE) VALUES (?, ?, ?, ?, ?)";
        const [insert] = await inv_connection.query(insertOrder, [
          String(order.order_number),
          "pending",
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

        console.log(`Pending Lazada order #${order.order_number} recorded!`);
      }

      return res
        .status(200)
        .json({ ok: true, message: "All orders were recorded!" });
    } finally {
      def_connection.release();
      inv_connection.release();
    }
  } catch (error) {
    console.log(`Error in function getPendingLazadaOrders: ${error.message}`);

    return res.status(400).json({ ok: false, message: error.message });
  }
}
