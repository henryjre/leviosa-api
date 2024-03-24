import {
  tiktokPostAPIRequest,
  tiktokGetAPIRequest,
} from "./api_request_functions.js";

export async function getTiktokProductsInfo(secrets, skuIds, pageToken) {
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

export async function postUpdateTiktokProductStock(
  secrets,
  productId,
  updateData
) {
  const path = `/product/202309/products/${productId}/inventory/update`;
  const payload = {
    skus: [updateData],
  };

  return tiktokPostAPIRequest(secrets, path, payload);
}

export async function getTiktokOrdersDetails(secrets, orderIds) {
  const path = "/order/202309/orders";
  const queryParams = {
    ids: JSON.stringify(orderIds),
  };

  return tiktokGetAPIRequest(secrets, path, queryParams);
}

export async function getTiktokOrderList(secrets, start_time, end_time) {
  const path = "/order/202309/orders/search";
  const params = {
    page_size: 100,
  };
  const payload = {
    order_status: "AWAITING_SHIPMENT",
    create_time_ge: start_time,
    create_time_lt: end_time,
  };

  return tiktokPostAPIRequest(secrets, path, payload, params);
}
