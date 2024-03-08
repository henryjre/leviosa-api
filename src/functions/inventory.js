export async function queryProductsPlacement(connection, itemsArray) {
  try {
    if (!connection || !itemsArray || !itemsArray.length) {
      throw new Error("Invalid parameters");
    }

    const processedSkus = await processLineItems(itemsArray, connection);
    const skuArray = processedSkus.map((obj) => obj.sku);

    const skuPlaceholder = Array.from(
      { length: skuArray.length },
      (_, index) => "?"
    ).join(", ");
    const queryString = `SELECT SKU, PRODUCT_NAME, COST_OF_GOODS FROM Leviosa_Inventory WHERE SKU IN (${skuPlaceholder})`;
    const [productsArray] = await connection.query(queryString, skuArray);

    if (productsArray.length <= 0) {
      throw new Error("No products found.");
    }

    const productsMap = productsArray.map((p) => {
      const product = processedSkus.find((product) => product.sku === p.SKU);

      return {
        sku: p.SKU,
        name: p.PRODUCT_NAME,
        cost: Number(p.COST_OF_GOODS),
        quantity: product.quantity,
      };
    });

    return { ok: true, error: null, products: productsMap };
  } catch (error) {
    console.log(error);
    return { ok: false, error: error, products: [] };
  }
}

export async function queryProductsCancel(connection, itemsArray) {
  try {
    if (!connection || !itemsArray || !itemsArray.length) {
      throw new Error("Invalid parameters");
    }

    const processedSkus = await processLineItems(itemsArray, connection);
    const skuArray = processedSkus.map((obj) => obj.sku);

    const skuPlaceholder = Array.from(
      { length: skuArray.length },
      (_, index) => "?"
    ).join(", ");
    const queryString = `SELECT SKU, PRODUCT_NAME, COST_OF_GOODS, TOTAL_QUANTITY FROM Leviosa_Inventory WHERE SKU IN (${skuPlaceholder})`;
    const [productsArray] = await connection.query(queryString, skuArray);

    if (productsArray.length <= 0) {
      throw new Error("No products found.");
    }

    const productsMap = productsArray.map((p) => ({
      sku: p.SKU,
      name: p.PRODUCT_NAME,
      cost: p.COST_OF_GOODS,
      quantity: p.TOTAL_QUANTITY,
    }));

    return { ok: true, error: null, products: productsMap };
  } catch (error) {
    console.log(error);
    return { ok: false, error: error, products: [] };
  }
}

export async function decrementInventory(connection, lineItems) {
  try {
    const updateProductQuery = `
        UPDATE Leviosa_Inventory
            SET TOTAL_QUANTITY = TOTAL_QUANTITY - CASE SKU
                ${lineItems
                  .map(
                    (product) =>
                      `WHEN '${product.sku}' THEN ${product.quantity}`
                  )
                  .join(" ")}
            END
        WHERE SKU IN (${lineItems
          .map((product) => `'${product.sku}'`)
          .join(", ")});`;
    await connection.query(updateProductQuery);
    return;
  } catch (error) {
    console.log(error);
    return;
  }
}

export async function incrementInventoryAndCost(connection, lineItems) {
  try {
    const updateProductQuery = `
        UPDATE Leviosa_Inventory
            SET TOTAL_QUANTITY = TOTAL_QUANTITY + CASE SKU
                ${lineItems
                  .map(
                    (product) =>
                      `WHEN '${product.sku}' THEN ${product.quantity}`
                  )
                  .join(" ")}
            END,
                OLD_QUANTITY = OLD_QUANTITY + CASE SKU
                ${lineItems
                  .map(
                    (product) =>
                      `WHEN '${product.sku}' THEN ${product.quantity}`
                  )
                  .join(" ")}
            END,
                COST_OF_GOODS = CASE SKU
                ${lineItems
                  .map(
                    (product) => `WHEN '${product.sku}' THEN ${product.newCost}`
                  )
                  .join(" ")}
            END
        WHERE SKU IN (${lineItems
          .map((product) => `'${product.sku}'`)
          .join(", ")});`;
    await connection.query(updateProductQuery);
    return;
  } catch (error) {
    console.log(error);
    return;
  }
}

async function processLineItems(lineItemsArray, connection) {
  const newLineItemsSet = new Set();

  async function fetchListings() {
    const queryListings = `SELECT * FROM Bundle_Listing`;
    const [listingItems] = await connection.query(queryListings);
    return { bundleListings: listingItems };
  }

  function updateLineItemsSet(sku, quantity) {
    const existingItem = Array.from(newLineItemsSet).find(
      (item) => item.sku === sku
    );
    if (existingItem) {
      // Remove the existing item
      newLineItemsSet.delete(existingItem);
      // Update quantity
      existingItem.quantity += quantity;
      // Add the updated item back to the set
      newLineItemsSet.add(existingItem);
    } else {
      // Add new entry
      newLineItemsSet.add({ sku, quantity });
    }
  }

  function processBundle(bundleItem, lineItem) {
    for (const sku of bundleItem.PRODUCTS_SKU) {
      updateLineItemsSet(sku, lineItem.quantity);
    }
  }

  const { bundleListings } = await fetchListings();

  for (const item of lineItemsArray) {
    const bundleItem = bundleListings.find((obj) => obj.SKU === item.sku);
    if (bundleItem) {
      processBundle(bundleItem, item);
      continue;
    }

    updateLineItemsSet(item.sku, item.quantity);
  }

  return Array.from(newLineItemsSet).map((obj) => ({
    sku: obj.sku,
    quantity: obj.quantity,
  }));
}
