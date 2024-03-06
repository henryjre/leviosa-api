import { Router } from "express";
const webhooks = Router();

import * as lazada from "./lazadaWebhook.js";

webhooks.get("/lazada", lazada.queryTest);

export default webhooks;
