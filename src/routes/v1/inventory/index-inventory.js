import { Router } from "express";
const inventory = Router();

import * as get from "./getFunctions.js";
import * as deduction from "./retailStockChange.js";

// "/api/v1/inventory/getInventoryProductOrders"
inventory.get("/getInventoryProductOrders", get.getInventoryProductOrders);

// "/api/v1/inventory/getRetailOrders"
inventory.get("/getRetailOrders", get.getRetailOrders);

// "/api/v1/inventory/deductRetailStock"
inventory.get("/deductRetailStock", deduction.deductRetailInventory);

// "/api/v1/inventory/markSoldOutProduct"
inventory.get("/markSoldOutProduct", deduction.soldOutRetailStock);

// "/api/v1/inventory/syncInventory"
inventory.get("/syncInventory", deduction.syncInventories);

export default inventory;
