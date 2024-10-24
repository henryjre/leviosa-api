import { Router } from "express";
const odooRouter = Router();

import publicEndpoint from "./public/index-public.js";

odooRouter.get("/", (req, res) => {
  return res
    .status(200)
    .json({ message: "This is the middleware API for Odoo FBW DHVSU Branch." });
});

// "/api/odoo/public"
odooRouter.use("/public", publicEndpoint);

export default odooRouter;
