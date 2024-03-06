import { Router } from "express";
const webhooks = Router();

import * as lazada from "./webhook-lazada.js";
import * as shopee from "./webhook-shopee.js";

webhooks.post("/lazada", lazada.catchWebhook);
webhooks.post("/shopee", shopee.catchWebhook);

export default webhooks;
