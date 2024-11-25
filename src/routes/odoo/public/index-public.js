import { Router } from "express";
const publicEndpoint = Router();

import { getLoyaltyCardData } from "./loyalty_card.js";
import { getLoyaltyRewards } from "./discount.js";
import {
  getAverageTransactionValue,
  getOrderSalesJournal,
} from "./employees.js";

// "/api/odoo/public/getLoyaltyCardData"
publicEndpoint.get("/getLoyaltyCardData", getLoyaltyCardData);

// "/api/odoo/public/getLoyaltyCardData"
publicEndpoint.get("/getLoyaltyRewards", getLoyaltyRewards);

// "/api/odoo/public/getATV"
publicEndpoint.post("/getATV", getAverageTransactionValue);

// "/api/odoo/public/getOrderSales"
publicEndpoint.post("/getOrderSales", getOrderSalesJournal);

export default publicEndpoint;
