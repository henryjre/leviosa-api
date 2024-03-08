import { Router } from "express";
const webhooks = Router();

import * as lazada from "./webhook-lazada.js";
import * as shopee from "./webhook-shopee.js";
import * as tiktok from "./webhook-tiktok.js";

webhooks.post("/lazada", lazada.catchWebhook);
webhooks.post("/shopee", shopee.catchWebhook);
webhooks.post("/tiktok", tiktok.catchWebhook);

export default webhooks;