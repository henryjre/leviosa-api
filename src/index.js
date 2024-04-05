// Bring in our dependencies
import express from "express";
import helmet from "helmet";
import "dotenv/config";

const app = express();
const PORT = process.env.PORT || 8080;

import routes from "./routes/index-routes.js";

app.use(helmet());
app.use(express.json());

// "/api"
app.use("/api", routes);

app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
});