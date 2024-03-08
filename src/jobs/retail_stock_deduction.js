import pools from "../sqlPools.js";

// DEDUCT SHOPEE PRODUCTS
export async function deductShopeeProducts() {
  const secretId = process.env.shopee_secrets_id;

  try {
    const def_connection = await pools.leviosaPool.getConnection();
    const inv_connection = await pools.inventoryPool.getConnection();

    try {
      const selectQuery =
        "SELECT * FROM Pending_Inventory_Out WHERE PLATFORM = ? AND SHOPEE = 1";
      const [selectResult] = await def_connection.query(selectQuery, [
        "SHOPEE",
      ]);

      if (!selectResult.length) {
        throw new Error("No products to deduct");
      }

      const productsToDeduct = selectResult[0];

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

async function searchShopeeProduct() {
  const path = "/api/v2/product/search_item";
}
