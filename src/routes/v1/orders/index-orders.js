import { Router } from "express";
const orders = Router();

import * as shopee from "./orders-shopee.js";
import * as lazada from "./orders-lazada.js";
import * as tiktok from "./orders-tiktok.js"

// "/api/v1/orders/getPendingShopeeOrders"
orders.get("/getPendingShopeeOrders", shopee.getPendingShopeeOrders);

// "/api/v1/orders/getPendingLazadaOrders"
orders.get("/getPendingLazadaOrders", lazada.getPendingLazadaOrders);

// "/api/v1/orders/getPendingTiktokOrders"
orders.get("/getPendingTiktokOrders", tiktok.getPendingTiktokOrders);

export default orders;
