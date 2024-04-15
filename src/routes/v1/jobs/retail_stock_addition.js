import { searchShopeeProduct } from "../../../functions/shopee.js";
import conn from "../../../sqlConnections.js";

export async function addShopeeInventory() {
  const secretId = process.env.shopee_secrets_id;

  try {
    const def_connection = await conn.leviosaConnection();
    const inv_connection = await conn.inventoryConnection();

    try {
      const selectQuery = `
        (SELECT * FROM Cancelled_Inventory_Out WHERE PLATFORM IN ('LAZADA', 'TIKTOK') AND SHOPEE = 0 LIMIT 20) UNION ALL (SELECT ID,ORDER_ID,PRODUCT_SKU,PRODUCT_NAME,ORDER_CREATED,PLATFORM,PRODUCT_COGS,SHOPEE,LAZADA,TIKTOK FROM Completed_Inventory_In WHERE PLATFORM IN ('LAZADA', 'TIKTOK') AND SHOPEE = 0 LIMIT 20)`;
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

      const productsToIncrease = [];
      const idsToComplete = [];
      for (const product of selectResult) {
        const productIndex = productsToIncrease.findIndex(
          (p) => p.sku === product.PRODUCT_SKU
        );

        if (productIndex === -1) {
          productsToIncrease.push({
            sku: product.PRODUCT_SKU,
            quantity: 1,
          });
        } else {
          productsToIncrease[productIndex].quantity += 1;
        }

        idsToComplete.push(product.ID);
      }

      const shopeeIds = [];
      for (const product of productsToDeduct) {
        const shopeeProduct = await searchShopeeProduct(secrets, product.sku);
        product.shopeeId = shopeeProduct.data.response.item_id_list[0];
        shopeeIds.push(shopeeProduct.data.response.item_id_list[0]);
      }

      const shopeeProductsInfo = await getShopeeProductsInfo(
        secrets,
        shopeeIds
      );

      for (const shopeeProduct of shopeeProductsInfo.data.response.item_list) {
        const index = productsToDeduct.findIndex(
          (p) => p.shopeeId === shopeeProduct.item_id
        );

        const currentStock = shopeeProduct.stock_info_v2.seller_stock[0].stock;
        const stockToDeduct = currentStock - productsToDeduct[index].quantity;
        productsToDeduct[index].updatedStock = stockToDeduct;
      }
    } finally {
      await def_connection.destroy();
      await inv_connection.destroy();
    }
  } catch (error) {
    console.log(error.toString());
  }
}
