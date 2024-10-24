import { Router } from "express";

import v1 from "./v1/index-v1.js";
import odooRouter from "./odoo/index-odoo.js";

const routes = Router();

routes.get("/", (req, res) => {
  return res
    .status(200)
    .json({ message: "This is the official API for Leviosa Philippines." });
});

// "/api/echo"
routes.post("/echo", (req, res) => {
  return res
    .status(200)
    .json({ message: "Echoing post message.", body: req.body });
});

// "/api/v1"
routes.use("/v1", v1);

// "/api/odoo"
routes.use("/odoo", odooRouter);

export default routes;
