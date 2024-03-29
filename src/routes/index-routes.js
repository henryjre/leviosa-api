import Router from "express-promise-router";
import v1 from "./v1/index-v1.js";

const routes = Router();

routes.get("/", (req, res) => {
  return res
    .status(200)
    .json({ message: "This is the official API for Leviosa Philippines." });
});

// "/api/v1"
routes.use("/v1", v1);

export default routes;
