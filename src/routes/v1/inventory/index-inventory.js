import { Router } from "express";
const inventory = Router();

import * as get from "./getFunctions.js";

inventory.get("/getPendingInventoryOut", get.getPendingInventoryOut);

export default inventory;
