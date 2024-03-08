import { Router } from "express";
const inventory = Router();

import * as get from "./getFunctions.js";

inventory.get("/getInventoryProductOrders", get.getInventoryProductOrders);
inventory.get("/getRetailOrders", get.getRetailOrders);

export default inventory;
