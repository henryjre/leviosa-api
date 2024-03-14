import {
  shopeeGetAPIRequest,
  shopeePostAPIRequest,
} from "./api_request_functions.js";

export async function searchShopeeProduct(secrets, productSku) {
  const path = "/api/v2/product/search_item";

  const params = {
    page_size: 1,
    attribute_status: 2,
    item_sku: productSku,
  };

  return shopeeGetAPIRequest(secrets, path, params);
}

export async function getShopeeProductsInfo(secrets, shopeeIds) {
  const path = "/api/v2/product/get_item_base_info";

  const params = {
    item_id_list: shopeeIds,
  };

  return shopeeGetAPIRequest(secrets, path, params);
}

export async function postUpdateShopeeProductStock(secrets, itemId, stock) {
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

export async function getShopeeOrders(secrets, orderIds) {
  const orderIdList = orderIds.join(",");

  const path = "/api/v2/order/get_order_detail";

  const optionalFields = [
    "buyer_user_id",
    "buyer_username",
    "item_list",
    "invoice_data",
    "payment_method",
    "total_amount",
    "cancel_reason",
  ];

  const params = {
    order_sn_list: orderIdList,
    response_optional_fields: optionalFields.join(","),
  };

  return shopeeGetAPIRequest(secrets, path, params);
}
