import {
  lazadaGetAPIRequest,
  lazadaPostAPIRequest,
  shopeeGetAPIRequest,
  shopeePostAPIRequest,
} from "../functions/api_request_functions.js";
import pools from "../sqlPools.js";

// DEDUCT SHOPEE PRODUCTS
export async function deductShopeeProducts() {
  const secretId = process.env.shopee_secrets_id;

  try {
    const def_connection = await pools.leviosaPool.getConnection();
    const inv_connection = await pools.inventoryPool.getConnection();

    try {
      const selectQuery =
        "SELECT * FROM Pending_Inventory_Out WHERE PLATFORM IN ('LAZADA', 'TIKTOK') AND SHOPEE = 0";
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

      const productsToDeduct = [];
      for (const product of selectResult) {
        const index = productsToDeduct.findIndex(
          (p) => p.sku === product.PRODUCT_SKU
        );

        if (index === -1) {
          productsToDeduct.push({ sku: product.PRODUCT_SKU, quantity: 1 });
        } else {
          productsToDeduct[index].quantity += 1;
        }
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

      for (const product of productsToDeduct) {
        await postUpdateShopeeProductStock(
          secrets,
          product.shopeeId,
          product.updatedStock
        );
      }
    } finally {
      def_connection.release();
      inv_connection.release();
    }
  } catch (error) {
    console.log(error.toString());
  }
}

async function searchShopeeProduct(secrets, productSku) {
  const path = "/api/v2/product/search_item";

  const params = {
    page_size: 1,
    attribute_status: 2,
    item_sku: productSku,
  };

  return shopeeGetAPIRequest(secrets, path, params);
}

async function getShopeeProductsInfo(secrets, shopeeIds) {
  const path = "/api/v2/product/get_item_base_info";

  const params = {
    item_id_list: shopeeIds,
  };

  return shopeeGetAPIRequest(secrets, path, params);
}

async function postUpdateShopeeProductStock(secrets, itemId, stock) {
  const path = "/api/v2/product/update_stock";

  const payload = {
    item_id: itemId,
    stock_list: [
      {
        model_id: 0,
        seller_stock: [
          {
            stock: stock,
          },
        ],
      },
    ],
  };

  return shopeePostAPIRequest(secrets, path, payload);
}

// DEDUCT LAZADA PRODUCTS
export async function deductLazadaProducts() {
  const secretId = process.env.lazada_secrets_id;

  try {
    const def_connection = await pools.leviosaPool.getConnection();
    const inv_connection = await pools.inventoryPool.getConnection();

    try {
      const selectQuery =
        "SELECT * FROM Pending_Inventory_Out WHERE PLATFORM IN ('SHOPEE', 'TIKTOK') AND LAZADA = 0";
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

      const productsToDeduct = [];
      for (const product of selectResult) {
        const index = productsToDeduct.findIndex(
          (p) => p.SellerSku === product.PRODUCT_SKU
        );

        if (index === -1) {
          productsToDeduct.push({
            SellerSku: product.PRODUCT_SKU,
            quantity: 1,
          });
        } else {
          productsToDeduct[index].quantity += 1;
        }
      }

      const secrets = secretsResult[0];

      const productSkus = selectResult.map((p) => p.PRODUCT_SKU);

      const productsInfo = await getLazadaProductsInfo(secrets, productSkus);

      const lazadaProducts = productsInfo.data.data.products;

      if (!lazadaProducts) {
        throw new Error("No Lazada products to deduct");
      }

      for (const lazProduct of lazadaProducts) {
        const index = productsToDeduct.findIndex(
          (p) => p.SellerSku === lazProduct.skus[0].SellerSku
        );

        if (index !== -1) {
          productsToDeduct[index].ItemId = lazProduct.item_id;
          productsToDeduct[index].SkuId = lazProduct.skus[0].SkuId;

          const currentStock = lazProduct.skus[0].quantity;
          const stockToDeduct = currentStock - productsToDeduct[index].quantity;
          productsToDeduct[index].SellableQuantity = stockToDeduct;
        }
      }

      const filteredProducts = productsToDeduct
        .filter((p) => p.SellableQuantity)
        .map((p) => {
          delete p.quantity;
          return p;
        });

      const update = await postUpdateLazadaProductStock(
        secrets,
        filteredProducts
      );
      console.log(update);
    } finally {
      def_connection.release();
      inv_connection.release();
    }
  } catch (error) {
    console.log(error.toString());
  }
}

async function getLazadaProductsInfo(secrets, skus) {
  const path = "/products/get";
  const params = { sku_seller_list: JSON.stringify(skus) };
  return lazadaGetAPIRequest(secrets, path, params);
}

async function postUpdateLazadaProductStock(secrets, skus) {
  const path = "/product/stock/sellable/update";

  const xmlBuilder = (data) => {
    const skusXml = data
      .map(
        (item) =>
          `<Sku><ItemId>${item.ItemId}</ItemId><SkuId>${item.SkuId}</SkuId><SellerSku>${item.SellerSku}</SellerSku><SellableQuantity>${item.SellableQuantity}</SellableQuantity></Sku>`
      )
      .join("");

    const xmlString = `<Request><Product><Skus>${skusXml}</Skus></Product></Request>`;

    return xmlString;
  };

  const xmlData = xmlBuilder(skus);
  const params = {
    payload: xmlData,
  };

  return lazadaGetAPIRequest(secrets, path, params);
}
