import {
  lazadaGetAPIRequest,
  shopeeGetAPIRequest,
  shopeePostAPIRequest,
  tiktokPostAPIRequest,
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
        "SELECT * FROM Pending_Inventory_Out WHERE PLATFORM IN ('LAZADA', 'TIKTOK') AND SHOPEE = 0 LIMIT 20";
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
        const productIndex = productsToDeduct.findIndex(
          (p) => p.sku === product.PRODUCT_SKU
        );

        if (productIndex === -1) {
          productsToDeduct.push({ sku: product.PRODUCT_SKU, quantity: 1 });
        } else {
          productsToDeduct[productIndex].quantity += 1;
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

////////////
// DEDUCT LAZADA PRODUCTS
export async function deductLazadaProducts() {
  const secretId = process.env.lazada_secrets_id;

  try {
    const def_connection = await pools.leviosaPool.getConnection();
    const inv_connection = await pools.inventoryPool.getConnection();

    try {
      const selectQuery =
        "SELECT * FROM Pending_Inventory_Out WHERE PLATFORM IN ('SHOPEE', 'TIKTOK') AND LAZADA = 0 LIMIT 20";
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

      const update = await getUpdateLazadaProductStock(
        secrets,
        filteredProducts
      );

      if (!update.ok) {
        console.log(update);
      }
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

async function getUpdateLazadaProductStock(secrets, skus) {
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

////////////
// DEDUCT TIKTOK PRODUCTS
export async function deductTiktokProducts() {
  const secretId = process.env.tiktok_secrets_id;

  try {
    const def_connection = await pools.leviosaPool.getConnection();
    const inv_connection = await pools.inventoryPool.getConnection();

    try {
      const selectQuery =
        "SELECT * FROM Pending_Inventory_Out WHERE PLATFORM IN ('SHOPEE', 'LAZADA') AND TIKTOK = 0 LIMIT 20";
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
          productsToDeduct.push({
            sku: product.PRODUCT_SKU,
            quantity: 1,
          });
        } else {
          productsToDeduct[index].quantity += 1;
        }
      }

      const productSkus = selectResult.map((p) => p.PRODUCT_SKU);

      let productsQuery = await getTiktokProductsInfo(secrets, productSkus);
      const totalQueryCount = productsQuery.data.data.total_count;
      let tiktokProducts = productsQuery.data.data.products;

      while (tiktokProducts.length < totalQueryCount) {
        if (!productsQuery.data.data.next_page_token.length) break;

        productsQuery = await getTiktokProductsInfo(
          secrets,
          productSkus,
          productsQuery.data.data.next_page_token
        );
        const newProducts = productsQuery.data.data.products;

        tiktokProducts = [...tiktokProducts, ...newProducts];
      }

      if (!tiktokProducts) {
        throw new Error("No Tiktok products to deduct");
      }

      for (const ttsProduct of tiktokProducts) {
        const index = productsToDeduct.findIndex(
          (p) => p.sku === ttsProduct.skus[0].seller_sku
        );

        if (index !== -1) {
          const currentStock = ttsProduct.skus[0].inventory[0].quantity;
          const stockToDeduct = currentStock - productsToDeduct[index].quantity;

          productsToDeduct[index].productId = ttsProduct.id;
          productsToDeduct[index].updateData = {
            id: ttsProduct.skus[0].id,
            inventory: [
              {
                quantity: stockToDeduct,
              },
            ],
          };
        }
      }

      const filteredProducts = productsToDeduct.filter((p) => p.productId);

      const notUpdated = [];
      for (const product of filteredProducts) {
        const update = await postUpdateLazadaProductStock(
          secrets,
          product.productId,
          product.updateData
        );

        if (!update.ok) {
          notUpdated.push({ sku: product.sku, quantity: product.quantity });
          console.log(update);
          continue;
        }
      }
    } finally {
      def_connection.release();
      inv_connection.release();
    }
  } catch (error) {
    console.log(error.toString());
  }
}

async function getTiktokProductsInfo(secrets, skuIds, pageToken) {
  const path = `/product/202312/products/search`;
  const params = {
    page_size: 100,
  };
  const payload = {
    seller_skus: ["8801954185957"],
  };

  if (pageToken) {
    params.page_token = pageToken;
  }

  return tiktokPostAPIRequest(secrets, path, payload, params);
}

async function postUpdateLazadaProductStock(secrets, productId, updateData) {
  const path = `/product/202309/products/${productId}/inventory/update`;
  const payload = {
    skus: [updateData],
  };

  return tiktokPostAPIRequest(secrets, path, payload);
}
