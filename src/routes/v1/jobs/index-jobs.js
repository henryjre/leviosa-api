import { Router } from "express";
const jobs = Router();

import * as refresh from "./refresh_secrets.js";
import * as discord from "./discord_order_notifications.js";
import * as settlement from "./order_settlements.js";

// "/api/v1/jobs/sample"
jobs.get("/sample", refresh.sampleJob);
// "/api/v1/jobs/refreshShopeeTokens"
jobs.get("/refreshShopeeTokens", refresh.refreshShopeeToken);
// "/api/v1/jobs/refreshLazadaTokens"
jobs.get("/refreshLazadaTokens", refresh.refreshLazadaToken);
// "/api/v1/jobs/refreshTiktokTokens"
jobs.get("/refreshTiktokTokens", refresh.refreshTiktokToken);

// "/api/v1/jobs/runDiscordNotif"
jobs.get("/runDiscordNotif", discord.runDiscordNotifs);

// "/api/v1/jobs/settleShopee"
jobs.get("/settleShopee", settlement.checkForShopeeSettlements);
// "/api/v1/jobs/settleLazada"
jobs.get("/settleLazada", settlement.checkForLazadaSettlements);
// "/api/v1/jobs/settleTiktok"
jobs.get("/settleTiktok", settlement.checkForTiktokSettlements);

export default jobs;
