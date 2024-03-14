import { Router } from "express";
const webhooks = Router();

import * as lazada from "./webhook-lazada.js";
import * as shopee from "./webhook-shopee.js";
import * as tiktok from "./webhook-tiktok.js";

// "/api/v1/webhook/lazada"
webhooks.post("/lazada", lazada.catchWebhook);

// "/api/v1/webhook/shopee"
webhooks.post("/shopee", shopee.catchWebhook);

// "/api/v1/webhook/tiktok"
webhooks.post("/tiktok", tiktok.catchWebhook);

export default webhooks;
