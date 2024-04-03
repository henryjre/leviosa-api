import { Router } from "express";
const orders = Router();

import * as shopee from "./orders-shopee.js";
import * as lazada from "./orders-lazada.js";
import * as tiktok from "./orders-tiktok.js";

// "/api/v1/orders/getPendingShopeeOrders"
orders.get("/getPendingShopeeOrders", shopee.getPendingShopeeOrders);
// "/api/v1/orders/updateShopeeOrderStatus"
orders.get("/updateShopeeOrderStatus", shopee.updateShopeeOrderStatuses);

// "/api/v1/orders/getPendingLazadaOrders"
orders.get("/getPendingLazadaOrders", lazada.getPendingLazadaOrders);
// "/api/v1/orders/updateLazadaOrderStatus"
orders.get("/updateLazadaOrderStatus", lazada.updateLazadaOrderStatuses);

// "/api/v1/orders/getPendingTiktokOrders"
orders.get("/getPendingTiktokOrders", tiktok.getPendingTiktokOrders);
// "/api/v1/orders/updateTiktokOrderStatus"
orders.get("/updateTiktokOrderStatus", tiktok.updateTiktokOrderStatuses);

export default orders;
