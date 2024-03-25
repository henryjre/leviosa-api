import { Router } from "express";
const v1 = Router();
import { authenticate } from "../../auth.js";

import webhooks from "./webhooks/index-webhook.js";
import inventory from "./inventory/index-inventory.js";
import orders from "./orders/index-orders.js";
import jobs from "./jobs/index-jobs.js";

v1.get("/webhooks", (req, res) => {
  return res
    .status(200)
    .json({ message: "This is the official API for Leviosa." });
});

// "/api/v1/webhook"
v1.use("/webhooks", webhooks);

// "/api/v1/orders"
v1.use("/orders", orders);

// "/api/v1/orders"
v1.use("/jobs", jobs);

// "/api/v1/inventory"
v1.use("/inventory", authenticate, inventory);

export default v1;
