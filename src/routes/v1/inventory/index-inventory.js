import { Router } from "express";
const inventory = Router();

import * as get from "./getFunctions.js";
import * as deduction from "./retailStockDeduction.js";

inventory.get("/getInventoryProductOrders", get.getInventoryProductOrders);
inventory.get("/getRetailOrders", get.getRetailOrders);
inventory.get("/deductRetailStock", deduction.deductRetailInventory);

export default inventory;
