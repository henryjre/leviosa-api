// Bring in our dependencies
import express from "express";
import helmet from "helmet";
import "dotenv/config";

const app = express();
const PORT = process.env.PORT || 3000;

import routes from "./routes/index-routes.js";

app.use(helmet());
app.use(express.json());

app.use("/api", routes);

// Turn on that server!
app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
});

// SCHEDULED JOBS
import refresh from "./jobs/refresh_secrets.js";
import settlements from "./jobs/order_settlements.js";
import { deductLazadaProducts } from "./jobs/retail_stock_deduction.js";

// REFRESH SCHEDULES
// refresh.shopeeSecrets.start();
// refresh.tiktokSecrets.start();
// refresh.lazadaSecrets.start();

// SETTLEMENTS SCHEDULES
// settlements.checkShopeeSettlements.start();
// settlements.checkTiktokSettlements.start();
// settlements.checkLazadaSettlements.start();

await deductLazadaProducts();
