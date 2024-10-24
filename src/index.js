// Bring in our dependencies
import express from "express";
import helmet from "helmet";
import cors from "cors";

import "dotenv/config";
import "./functions/cron.js";

const app = express();
const PORT = process.env.PORT || 8080;

import routes from "./routes/index-routes.js";

app.use(helmet());
app.use(express.json());
app.use(cors());

// "/api"
app.use("/api", routes);

app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
});
