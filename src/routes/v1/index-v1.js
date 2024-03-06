import { Router } from "express";
const v1 = Router();

import webhooks from "./webhooks/index-webhook.js";

v1.get("/", (req, res) => {
  return res
    .status(200)
    .json({ message: "This is the official API for Leviosa." });
});

v1.use("/webhooks", webhooks);

export default v1;
