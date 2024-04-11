import conn from "../../../sqlConnections.js";
import {
  getLazadaProductsInfo,
  getUpdateLazadaProductStock,
} from "../../../functions/lazada.js";
import {
  getShopeeProductsInfo,
  postUpdateShopeeProductStock,
  searchShopeeProduct,
} from "../../../functions/shopee.js";
import {
  getTiktokProductsInfo,
  postUpdateTiktokProductStock,
} from "../../../functions/tiktok.js";

// DEDUCT SHOPEE PRODUCTS
export async function changeShopeeInventory(type) {
  const secretId = process.env.shopee_secrets_id;

  try {
    const def_connection = await conn.leviosaConnection();
    const inv_connection = await conn.inventoryConnection();

    try {
      let selectQuery;
      if (type === 0) {
        selectQuery =
          "SELECT * FROM Pending_Inventory_Out WHERE PLATFORM IN ('LAZADA', 'TIKTOK') AND SHOPEE = 0 LIMIT 20";
      } else if (type === 1) {
        selectQuery = `
          (SELECT * FROM Cancelled_Inventory_Out WHERE PLATFORM IN ('LAZADA', 'TIKTOK') AND SHOPEE = 0 LIMIT 10)
          UNION ALL
          (SELECT ID, ORDER_ID, PRODUCT_SKU, PRODUCT_NAME, ORDER_CREATED, PLATFORM, PRODUCT_COGS, SHOPEE, LAZADA, TIKTOK
          FROM Completed_Inventory_In
          WHERE PLATFORM IN ('LAZADA', 'TIKTOK') AND SHOPEE = 0
          LIMIT 10);
          `;
      } else {
        throw new Error("Invalid type");
      }

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

      const productsToChange = [];
      const idsToComplete = [];
      for (const product of selectResult) {
        const productIndex = productsToChange.findIndex(
          (p) => p.sku === product.PRODUCT_SKU
        );

        if (productIndex === -1) {
          productsToChange.push({
            sku: product.PRODUCT_SKU,
            quantity: 1,
          });
        } else {
          productsToChange[productIndex].quantity += 1;
        }

        idsToComplete.push(product.ID);
      }

      const shopeeIds = [];
      for (const product of productsToChange) {
        const shopeeProduct = await searchShopeeProduct(secrets, product.sku);
        if (!shopeeProduct.data.response.item_id_list.length) continue;

        product.shopeeId = shopeeProduct.data.response.item_id_list[0];
        shopeeIds.push(shopeeProduct.data.response.item_id_list[0]);
      }

      if (!shopeeIds.length) {
        await onComplete();
        throw new Error("No Shopee products to deduct");
      }

      const shopeeProductsInfo = await getShopeeProductsInfo(
        secrets,
        shopeeIds
      );

      if (!shopeeProductsInfo.ok) {
        console.log(shopeeProductsInfo);
        throw new Error("Error in function getShopeeProductsInfo()");
      }

      for (const shopeeProduct of shopeeProductsInfo.data.response.item_list) {
        const index = productsToChange.findIndex(
          (p) => p.shopeeId === shopeeProduct.item_id
        );

        const currentStock = shopeeProduct.stock_info_v2.seller_stock[0].stock;
        let stockUpdate;
        if (type === 0) {
          stockUpdate = currentStock - productsToChange[index].quantity;
        } else if (type === 1) {
          stockUpdate = currentStock + productsToChange[index].quantity;
        }

        productsToChange[index].updatedStock = stockUpdate;
      }

      const notUpdated = [];
      for (const product of productsToChange) {
        const stockUpdate = await postUpdateShopeeProductStock(
          secrets,
          product.shopeeId,
          product.updatedStock
        );

        if (!stockUpdate.ok) {
          notUpdated.push(product);
        }
      }

      await onComplete();

      if (!notUpdated.length) {
        console.log("No errors in updating Shopee products.");
        return;
      }

      async function onComplete() {
        const listOfIds = idsToComplete.map((id) => `'${id}'`).join(", ");

        if (type === 0) {
          const completeQuery = `UPDATE Pending_Inventory_Out SET SHOPEE = 1 WHERE ID IN (${listOfIds});`;
          await inv_connection.query(completeQuery);
        } else if (type === 1) {
          const update1 = `UPDATE Cancelled_Inventory_Out SET SHOPEE = 1 WHERE ID IN (${listOfIds});`;
          const update2 = `UPDATE Completed_Inventory_In SET SHOPEE = 1 WHERE ID IN (${listOfIds});`;

          await inv_connection.query(update1);
          await inv_connection.query(update2);
        }
      }
    } finally {
      await def_connection.end();
      await inv_connection.end();
    }
  } catch (error) {
    console.log(error.toString());
  }
}

////////////
// DEDUCT LAZADA PRODUCTS
export async function changeLazadaInventory(type) {
  const secretId = process.env.lazada_secrets_id;

  try {
    const def_connection = await conn.leviosaConnection();
    const inv_connection = await conn.inventoryConnection();

    try {
      let selectQuery;
      if (type === 0) {
        selectQuery =
          "SELECT * FROM Pending_Inventory_Out WHERE PLATFORM IN ('SHOPEE', 'TIKTOK') AND LAZADA = 0 LIMIT 20";
      } else if (type === 1) {
        selectQuery = `
          (SELECT * FROM Cancelled_Inventory_Out WHERE PLATFORM IN ('SHOPEE', 'TIKTOK') AND LAZADA = 0 LIMIT 10)
          UNION ALL
          (SELECT ID, ORDER_ID, PRODUCT_SKU, PRODUCT_NAME, ORDER_CREATED, PLATFORM, PRODUCT_COGS, SHOPEE, LAZADA, TIKTOK
          FROM Completed_Inventory_In
          WHERE PLATFORM IN ('SHOPEE', 'TIKTOK') AND LAZADA = 0
          LIMIT 10);
          `;
      } else {
        throw new Error("Invalid type");
      }

      const [selectResult] = await inv_connection.query(selectQuery);

      if (!selectResult.length) {
        throw new Error("No Lazada products to deduct in database");
      }

      const querySecrets = "SELECT * FROM Shop_Tokens WHERE ID = ?";
      const [secretsResult] = await def_connection.query(querySecrets, [
        secretId,
      ]);

      if (secretsResult.length <= 0) {
        throw new Error("No secrets found.");
      }

      const secrets = secretsResult[0];

      const productsToChange = [];
      const idsToComplete = [];
      for (const product of selectResult) {
        const index = productsToChange.findIndex(
          (p) => p.SellerSku === product.PRODUCT_SKU
        );

        if (index === -1) {
          productsToChange.push({
            SellerSku: product.PRODUCT_SKU,
            quantity: 1,
          });
        } else {
          productsToChange[index].quantity += 1;
        }

        idsToComplete.push(product.ID);
      }

      const productSkus = productsToChange.map((p) => p.SellerSku);

      const productsInfo = await getLazadaProductsInfo(secrets, productSkus);

      if (!productsInfo.ok) {
        console.log(productsInfo);
        throw new Error("Error in function getLazadaProductsInfo()");
      }

      const lazadaProducts = productsInfo.data.data.products;

      if (!lazadaProducts) {
        await onComplete();
        throw new Error("No Lazada products to deduct");
      }

      for (const lazProduct of lazadaProducts) {
        const index = productsToChange.findIndex(
          (p) => p.SellerSku === lazProduct.skus[0].SellerSku
        );

        if (index !== -1) {
          productsToChange[index].ItemId = lazProduct.item_id;
          productsToChange[index].SkuId = lazProduct.skus[0].SkuId;

          const currentStock = lazProduct.skus[0].quantity;

          let stockUpdate;
          if (type === 0) {
            stockUpdate = currentStock - productsToChange[index].quantity;
          } else if (type === 1) {
            stockUpdate = currentStock + productsToChange[index].quantity;
          }

          productsToChange[index].SellableQuantity = stockUpdate;
        }
      }

      const filteredProducts = productsToChange
        .filter((p) => p.SellableQuantity)
        .map((p) => {
          delete p.quantity;
          return p;
        });

      const update = await getUpdateLazadaProductStock(
        secrets,
        filteredProducts
      );

      await onComplete();

      if (!update.ok) {
        console.log(update);
        return;
      }

      async function onComplete() {
        const listOfIds = idsToComplete.map((id) => `'${id}'`).join(", ");

        if (type === 0) {
          const completeQuery = `UPDATE Pending_Inventory_Out SET LAZADA = 1 WHERE ID IN (${listOfIds});`;
          await inv_connection.query(completeQuery);
        } else if (type === 1) {
          const update1 = `UPDATE Cancelled_Inventory_Out SET LAZADA = 1 WHERE ID IN (${listOfIds});`;
          const update2 = `UPDATE Completed_Inventory_In SET LAZADA = 1 WHERE ID IN (${listOfIds});`;

          await inv_connection.query(update1);
          await inv_connection.query(update2);
        }
      }
    } finally {
      await def_connection.end();
      await inv_connection.end();
    }
  } catch (error) {
    console.log(error.toString());
  }
}

////////////
// DEDUCT TIKTOK PRODUCTS
export async function changeTiktokInventory(type) {
  const secretId = process.env.tiktok_secrets_id;

  try {
    const def_connection = await conn.leviosaConnection();
    const inv_connection = await conn.inventoryConnection();

    try {
      let selectQuery;
      if (type === 0) {
        selectQuery =
          "SELECT * FROM Pending_Inventory_Out WHERE PLATFORM IN ('SHOPEE', 'LAZADA') AND TIKTOK = 0 LIMIT 20";
      } else if (type === 1) {
        selectQuery = `
          (SELECT * FROM Cancelled_Inventory_Out WHERE PLATFORM IN ('SHOPEE', 'LAZADA') AND TIKTOK = 0 LIMIT 10)
          UNION ALL
          (SELECT ID, ORDER_ID, PRODUCT_SKU, PRODUCT_NAME, ORDER_CREATED, PLATFORM, PRODUCT_COGS, SHOPEE, LAZADA, TIKTOK
          FROM Completed_Inventory_In
          WHERE PLATFORM IN ('SHOPEE', 'LAZADA') AND TIKTOK = 0
          LIMIT 10);
          `;
      } else {
        throw new Error("Invalid type");
      }

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

      const productsToChange = [];
      const idsToComplete = [];
      for (const product of selectResult) {
        const index = productsToChange.findIndex(
          (p) => p.sku === product.PRODUCT_SKU
        );

        if (index === -1) {
          productsToChange.push({
            sku: product.PRODUCT_SKU,
            quantity: 1,
          });
        } else {
          productsToChange[index].quantity += 1;
        }

        idsToComplete.push(product.ID);
      }

      const productSkus = productsToChange.map((p) => p.sku);

      let productsQuery = await getTiktokProductsInfo(secrets, productSkus);
      if (!productsQuery.ok) {
        console.log(productsQuery);
        throw new Error("Error in function getTiktokProductsInfo()");
      }
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
        await onComplete();
        throw new Error("No Tiktok products to deduct");
      }

      for (const ttsProduct of tiktokProducts) {
        const index = productsToChange.findIndex(
          (p) => p.sku === ttsProduct.skus[0].seller_sku
        );

        if (index !== -1) {
          const currentStock = ttsProduct.skus[0].inventory[0].quantity;
          let stockUpdate;
          if (type === 0) {
            stockUpdate = currentStock - productsToChange[index].quantity;
          } else if (type === 1) {
            stockUpdate = currentStock + productsToChange[index].quantity;
          }

          productsToChange[index].productId = ttsProduct.id;
          productsToChange[index].updateData = {
            id: ttsProduct.skus[0].id,
            inventory: [
              {
                quantity: stockUpdate,
              },
            ],
          };
        }
      }

      const filteredProducts = productsToChange.filter((p) => p.productId);

      const notUpdated = [];
      for (const product of filteredProducts) {
        const update = await postUpdateTiktokProductStock(
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

      await onComplete();

      if (!notUpdated.length) {
        console.log("No errors in updating tiktok products.");
      }

      async function onComplete() {
        const listOfIds = idsToComplete.map((id) => `'${id}'`).join(", ");

        if (type === 0) {
          const completeQuery = `UPDATE Pending_Inventory_Out SET TIKTOK = 1 WHERE ID IN (${listOfIds});`;
          await inv_connection.query(completeQuery);
        } else if (type === 1) {
          const update1 = `UPDATE Cancelled_Inventory_Out SET TIKTOK = 1 WHERE ID IN (${listOfIds});`;
          const update2 = `UPDATE Completed_Inventory_In SET TIKTOK = 1 WHERE ID IN (${listOfIds});`;

          await inv_connection.query(update1);
          await inv_connection.query(update2);
        }
      }
    } finally {
      await def_connection.end();
      await inv_connection.end();
    }
  } catch (error) {
    console.log(error.toString());
  }
}

export async function onAddInventory(data) {
  try {
    const def_connection = await conn.leviosaConnection();

    try {
      const querySecrets = "SELECT * FROM Shop_Tokens";
      const [secretsResult] = await def_connection.query(querySecrets);

      const secrets_shopee = secretsResult.find((s) => s.PLATFORM === "SHOPEE");
      const secrets_lazada = secretsResult.find((s) => s.PLATFORM === "LAZADA");
      const secrets_tiktok = secretsResult.find((s) => s.PLATFORM === "TIKTOK");

      const shopeeResult = await changeShopeeStock(secrets_shopee, data, "add");
      const lazadaResult = await changeLazadaStock(secrets_lazada, data, "add");
      const tiktokResult = await changeTiktokStock(secrets_tiktok, data, "add");

      console.log(shopeeResult);
      console.log(lazadaResult);
      console.log(tiktokResult);
    } finally {
      await def_connection.end();
    }
  } catch (error) {
    console.log(error.toString());
  }
}

async function changeShopeeStock(secrets, data, type) {
  try {
    const productsToChange = data;
    const shopeeIds = [];
    for (const product of productsToChange) {
      const shopeeProduct = await searchShopeeProduct(secrets, product.sku);
      if (!shopeeProduct.data.response.item_id_list.length) continue;

      product.shopeeId = shopeeProduct.data.response.item_id_list[0];
      shopeeIds.push(shopeeProduct.data.response.item_id_list[0]);
    }

    if (!shopeeIds.length) {
      return { code: 3, ok: true, message: "No Shopee products found." };
    }

    const shopeeProductsInfo = await getShopeeProductsInfo(secrets, shopeeIds);
    if (!shopeeProductsInfo.ok) {
      console.log(shopeeProductsInfo);
      throw new Error("Error in function getShopeeProductsInfo()");
    }

    for (const shopeeProduct of shopeeProductsInfo.data.response.item_list) {
      const index = productsToChange.findIndex(
        (p) => p.shopeeId === shopeeProduct.item_id
      );

      const currentStock = shopeeProduct.stock_info_v2.seller_stock[0].stock;
      let stockUpdate;
      if (type === "add") {
        stockUpdate = currentStock + productsToChange[index].quantity;
      } else if (type === "soldout") {
        stockUpdate = productsToChange[index].quantity;
      }

      productsToChange[index].updatedStock = stockUpdate;
    }

    const notUpdated = [];
    for (const product of productsToChange) {
      const stockUpdate = await postUpdateShopeeProductStock(
        secrets,
        product.shopeeId,
        product.updatedStock
      );

      if (!stockUpdate.ok) {
        notUpdated.push(product);
      }
    }

    if (!notUpdated.length) {
      return { code: 1, ok: true, message: "success" };
    } else {
      return {
        code: 2,
        ok: true,
        message: "there were products that were not updated",
        not_updated: notUpdated,
      };
    }
  } catch (error) {
    console.log(error.toString());
    return { code: 0, ok: false, message: error.message };
  }
}

async function changeLazadaStock(secrets, data, type) {
  try {
    const productsToChange = data.map((p) => ({
      SellerSku: p.sku,
      quantity: p.quantity,
    }));
    const productSkus = productsToChange.map((p) => p.SellerSku);
    const productsInfo = await getLazadaProductsInfo(secrets, productSkus);

    if (!productsInfo.ok) {
      console.log(productsInfo);
      throw new Error("Error in function getLazadaProductsInfo()");
    }

    const lazadaProducts = productsInfo.data.data.products;

    if (!lazadaProducts) {
      return { code: 3, ok: true, message: "No Lazada products found." };
    }

    for (const lazProduct of lazadaProducts) {
      const index = productsToChange.findIndex(
        (p) => p.SellerSku === lazProduct.skus[0].SellerSku
      );

      if (index !== -1) {
        productsToChange[index].ItemId = lazProduct.item_id;
        productsToChange[index].SkuId = lazProduct.skus[0].SkuId;

        const currentStock = lazProduct.skus[0].quantity;
        let stockUpdate;
        if (type === "add") {
          stockUpdate = currentStock + productsToChange[index].quantity;
        } else if (type === "soldout") {
          stockUpdate = productsToChange[index].quantity;
        }

        productsToChange[index].SellableQuantity = stockUpdate;
      }
    }

    const filteredProducts = productsToChange
      .filter((p) => p.SellableQuantity)
      .map((p) => {
        delete p.quantity;
        return p;
      });

    const update = await getUpdateLazadaProductStock(secrets, filteredProducts);
    if (!update.ok) {
      console.log(update);
      throw new Error("There was an error while updating lazada products.");
    } else {
      return { code: 1, ok: true, message: "success" };
    }
  } catch (error) {
    console.log(error.toString());
    return { code: 0, ok: false, message: error.message };
  }
}

async function changeTiktokStock(secrets, data, type) {
  try {
    const productsToChange = data;
    const productSkus = productsToChange.map((p) => p.sku);

    let productsQuery = await getTiktokProductsInfo(secrets, productSkus);
    if (!productsQuery.ok) {
      console.log(productsQuery);
      throw new Error("Error in function getTiktokProductsInfo()");
    }
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
      return { code: 3, ok: true, message: "No Tiktok products found." };
    }

    for (const ttsProduct of tiktokProducts) {
      const index = productsToChange.findIndex(
        (p) => p.sku === ttsProduct.skus[0].seller_sku
      );

      if (index !== -1) {
        const currentStock = ttsProduct.skus[0].inventory[0].quantity;
        let stockUpdate;
        if (type === "add") {
          stockUpdate = currentStock + productsToChange[index].quantity;
        } else if (type === "soldout") {
          stockUpdate = productsToChange[index].quantity;
        }

        productsToChange[index].productId = ttsProduct.id;
        productsToChange[index].updateData = {
          id: ttsProduct.skus[0].id,
          inventory: [
            {
              quantity: stockUpdate,
            },
          ],
        };
      }
    }
    const filteredProducts = productsToChange.filter((p) => p.productId);

    const notUpdated = [];
    for (const product of filteredProducts) {
      const update = await postUpdateTiktokProductStock(
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

    if (!notUpdated.length) {
      return { code: 1, ok: true, message: "success" };
    } else {
      return {
        code: 2,
        ok: true,
        message: "there were products that were not updated",
        not_updated: notUpdated,
      };
    }
  } catch (error) {
    console.log(error.toString());
    return { code: 0, ok: false, message: error.message };
  }
}

export async function setProductQuantity(data) {
  try {
    const def_connection = await conn.leviosaConnection();

    try {
      const querySecrets = "SELECT * FROM Shop_Tokens";
      const [secretsResult] = await def_connection.query(querySecrets);

      const secrets_shopee = secretsResult.find((s) => s.PLATFORM === "SHOPEE");
      const secrets_lazada = secretsResult.find((s) => s.PLATFORM === "LAZADA");
      const secrets_tiktok = secretsResult.find((s) => s.PLATFORM === "TIKTOK");

      const shopeeResult = await changeShopeeStock(
        secrets_shopee,
        data,
        "soldout"
      );
      const lazadaResult = await changeLazadaStock(
        secrets_lazada,
        data,
        "soldout"
      );
      const tiktokResult = await changeTiktokStock(
        secrets_tiktok,
        data,
        "soldout"
      );

      let errorsData = [];
      let warningsData = [];
      let successData = [];

      processResult(shopeeResult, errorsData, successData, warningsData);
      processResult(lazadaResult, errorsData, successData, warningsData);
      processResult(tiktokResult, errorsData, successData, warningsData);

      function processResult(result, errors, success, warnings) {
        if (result.code === 0) {
          errors.push(result);
        } else if (result.code === 1) {
          success.push(result);
        } else {
          warnings.push(result);
        }
      }

      return {
        code: 1,
        message: "success",
        errors: errorsData,
        warnings: warningsData,
        success: successData,
      };
    } finally {
      await def_connection.end();
    }
  } catch (error) {
    console.log(error.toString());
    return {
      code: 1,
      message: error.message,
      errors: [],
      warnings: [],
      success: [],
    };
  }
}
