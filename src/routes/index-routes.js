import { Router } from "express";
import v1 from "./v1/index-v1.js";
import { authenticate } from "../auth.js";

const routes = Router();

routes.get("/", (req, res) => {
  return res
    .status(200)
    .json({ message: "This is the official API for Leviosa Philippines." });
});

// routes.use(authenticate);
routes.use("/v1", v1);

export default routes;
