import { Router } from "express";
const publicEndpoint = Router();

import { getLoyaltyCardData } from "./loyalty_card.js";
import { getLoyaltyRewards } from "./discount.js";

// "/api/odoo/public/getLoyaltyCardData"
publicEndpoint.get("/getLoyaltyCardData", getLoyaltyCardData);

// "/api/odoo/public/getLoyaltyCardData"
publicEndpoint.get("/getLoyaltyRewards", getLoyaltyRewards);

export default publicEndpoint;
