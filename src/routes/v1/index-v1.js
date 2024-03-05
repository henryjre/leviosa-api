import { Router } from "express";
const v1 = Router();

v1.get("/", (req, res) => {
  return res
    .status(200)
    .json({ message: "This is the official API for Leviosa." });
});

export default v1;
