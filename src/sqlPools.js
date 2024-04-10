import mysql from "mysql2/promise";

const environment = process.env.node_env;

let caCertificate;
if (environment === "prod") {
  const fs = require("fs");
  const path = require("path");
  const caCertificatePath = path.join(__dirname, "../cert/DO_Certificate.crt");
  caCertificate = fs.readFileSync(caCertificatePath);
} else if (environment === "dev") {
  caCertificate = process.env.db_cert;
}

const dbHost = process.env.db_host;
const dbPort = process.env.db_port;
const dbUsername = process.env.db_username;
const dbPassword = process.env.db_password;

function createPool(database) {
  return mysql.createPool({
    host: dbHost,
    port: dbPort,
    user: dbUsername,
    password: dbPassword,
    database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: {
      ca: caCertificate,
      rejectUnauthorized: true,
    },
  });
}

const managementPool = createPool("management");
const leviosaPool = createPool("defaultdb");
const inventoryPool = createPool("inventory");

const pools = { managementPool, leviosaPool, inventoryPool };

export default pools;
