import { Router } from "express";
const webhooks = Router();

v1.get("/", (req, res) => {
  return res
    .status(200)
    .json({ message: "This is the official API for Leviosa." });
});

export default v1;
