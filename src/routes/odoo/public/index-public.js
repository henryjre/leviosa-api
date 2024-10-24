import { Router } from "express";
const publicEndpoint = Router();

import * as loyalty_card from "./loyalty_card.js";

// "/api/odoo/public/getLoyaltyCardData"
publicEndpoint.get("/getLoyaltyCardData", loyalty_card.getLoyaltyCardData);

export default publicEndpoint;
