import mysql from "mysql2/promise";

const environment = process.env.node_env;

let caCertificate;
if (environment === "prod") {
  console.log("SQL Running on production environment.");
  const fs = require("fs");
  const path = require("path");
  const caCertificatePath = path.join(__dirname, "../cert/DO_Certificate.crt");
  caCertificate = fs.readFileSync(caCertificatePath);
} else if (environment === "dev") {
  console.log("SQL Running on development environment.");
  caCertificate = process.env.db_cert;
}

const dbHost = process.env.db_host;
const dbPort = process.env.db_port;
const dbUsername = process.env.db_username;
const dbPassword = process.env.db_password;

const commonPoolConfig = {
  host: dbHost,
  port: dbPort,
  user: dbUsername,
  password: dbPassword,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: {
    ca: caCertificate,
    rejectUnauthorized: true,
  },
};

const managementPool = mysql.createPool({
  ...commonPoolConfig,
  database: "management",
});

const leviosaPool = mysql.createPool({
  ...commonPoolConfig,
  database: "defaultdb",
});

const inventoryPool = mysql.createPool({
  ...commonPoolConfig,
  database: "inventory",
});

const pools = { managementPool, leviosaPool, inventoryPool };

export default pools;
