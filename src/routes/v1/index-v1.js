import { Router } from "express";
const v1 = Router();
import { authenticate } from "../../auth.js";

import webhooks from "./webhooks/index-webhook.js";
import inventory from "./inventory/index-inventory.js";

v1.get("/webhooks", (req, res) => {
  return res
    .status(200)
    .json({ message: "This is the official API for Leviosa." });
});

v1.use("/webhooks", webhooks);
v1.use("/inventory", authenticate, inventory);

export default v1;
