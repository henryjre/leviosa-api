import pools from "../sqlPools.js";

export async function addShopeeInventory() {
  const secretId = process.env.shopee_secrets_id;

  try {
    const def_connection = await pools.leviosaPool.getConnection();
    const inv_connection = await pools.inventoryPool.getConnection();

    try {
      const selectQuery = `
        SELECT * FROM Cancelled_Inventory_Out UNION ALL SELECT ID,ORDER_ID,PRODUCT_SKU,PRODUCT_NAME,ORDER_CREATED,PLATFORM,PRODUCT_COGS,SHOPEE,LAZADA,TIKTOK FROM Completed_Inventory_In WHERE PLATFORM IN ('LAZADA', 'TIKTOK') AND SHOPEE = 0 LIMIT 20;`;
      const [selectResult] = await inv_connection.query(selectQuery);

      if (!selectResult.length) {
        throw new Error("No products to deduct");
      }

      const querySecrets = "SELECT * FROM Shop_Tokens WHERE ID = ?";
      const [secretsResult] = await def_connection.query(querySecrets, [
        secretId,
      ]);

      if (secretsResult.length <= 0) {
        throw new Error("No secrets found.");
      }

      const secrets = secretsResult[0];


    } finally {
      def_connection.release();
      inv_connection.release();
    }
  } catch (error) {
    console.log(error.toString());
  }
}
