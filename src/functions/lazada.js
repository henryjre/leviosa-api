import { lazadaGetAPIRequest } from "./api_request_functions.js";

export async function getLazadaProductsInfo(secrets, skus) {
  const path = "/products/get";
  const params = { sku_seller_list: JSON.stringify(skus) };
  return lazadaGetAPIRequest(secrets, path, params);
}

export async function getUpdateLazadaProductStock(secrets, skus) {
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

export async function getMultipleLazOrders(secrets, orderIds) {
  const path = "/orders/items/get";
  const params = { order_ids: JSON.stringify(orderIds) };
  return lazadaGetAPIRequest(secrets, path, params);
}

export async function getLazadaOrderList(secrets, start_time, end_time) {
  const path = "/orders/get";
  const params = {
    created_before: end_time,
    created_after: start_time,
    status: "pending",
  };
  return lazadaGetAPIRequest(secrets, path, params);
}
