import {
  decrementInventory,
  queryProductsPlacement,
} from "../../../functions/inventory.js";
import {
  getShopeeOrderList,
  getShopeeOrders,
} from "../../../functions/shopee.js";
import pools from "../../../sqlPools.js";
import moment from "moment-timezone";

export async function getPendingShopeeOrders(req, res) {
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

      const currentDate = moment();

      const startTime = currentDate.clone().subtract(7, "days").startOf("day");
      const endTime = currentDate.endOf("day");

      const startTimeUnix = startTime.unix();
      const endTimeUnix = endTime.unix();

      const startTimeSql = startTime.format("YYYY-MM-DD HH:mm:ss");
      const endTimeSql = endTime.format("YYYY-MM-DD HH:mm:ss");

      const shopeeOrdersFetch = await getShopeeOrderList(
        secrets,
        startTimeUnix,
        endTimeUnix
      );

      if (!shopeeOrdersFetch.ok) {
        throw new Error(
          "There was an error while getting the Shopee Orders. Please try again"
        );
      }

      const shopeeOrdersResult = shopeeOrdersFetch.data.response.order_list;

      if (shopeeOrdersResult.length <= 0) {
        return res
          .status(200)
          .json({ ok: true, message: "No pending orders found." });
      }

      const selectQuery = `
      SELECT ORDER_ID FROM Orders_Shopee 
      WHERE CREATED_DATE BETWEEN ? AND ? 
      AND ORDER_STATUS IN ('UNPAID', 'READY_TO_SHIP') 
      ORDER BY CREATED_DATE ASC;
    `;
      const [dbOrdersFetch] = await inv_connection.query(selectQuery, [
        startTimeSql,
        endTimeSql,
      ]);

      const shopeeOrdersId = shopeeOrdersResult.map((o) => o.order_sn);
      const dbOrdersId = dbOrdersFetch.map((item) => item.ORDER_ID);

      const pendingOrdersId = shopeeOrdersId.filter(
        (orderId) => !dbOrdersId.includes(orderId)
      );

      if (pendingOrdersId.length <= 0) {
        return res
          .status(200)
          .json({ ok: true, message: "No pending orders to record." });
      }

      const shopeeOrdersDataFetch = await getShopeeOrders(
        secrets,
        pendingOrdersId
      );

      if (!shopeeOrdersDataFetch.ok) {
        throw new Error(
          "There was an error while getting order data. Please try again."
        );
      }

      const ordersData = shopeeOrdersDataFetch.data.response.order_list;

      for (const order of ordersData) {
        const skuArray = order.item_list.map((item) => ({
          sku: item.model_sku.length > 0 ? item.model_sku : item.item_sku,
          quantity: item.model_quantity_purchased,
        }));

        const totalReceivables = order.item_list.reduce((total, obj) => {
          const discountedPrice = obj.model_discounted_price;
          const quantityPurchased = obj.model_quantity_purchased;
          const subtotal = discountedPrice * quantityPurchased;

          return total + subtotal;
        }, 0);

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
          const uniqueId = `SHOPEE_${order.order_sn}_${counter}`;
          pendingItems.push([
            uniqueId,
            order.order_sn,
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
          order.order_sn,
          order.order_status,
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

        console.log(`Pending Shopee order #${order.order_sn} recorded!`);
      }

      return res
        .status(200)
        .json({ ok: true, message: "All orders were recorded!" });
    } finally {
      def_connection.release();
      inv_connection.release();
    }
  } catch (error) {
    console.log(`Error in function getPendingShopeeOrders: ${error.message}`);

    return res.status(400).json({ ok: false, message: error.message });
  }
}
