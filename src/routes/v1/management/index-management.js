import { Router } from "express";
const management = Router();

import * as get from "./getFunctions.js";

// "/api/v1/management/getExecutiveTasks"
management.get("/getExecutiveTasks", get.getExecutiveTasks);
// "/api/v1/management/getVotingRights"
management.get("/getVotingRights", get.getVotingRights);

export default management;
