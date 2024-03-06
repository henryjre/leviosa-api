import mysql from "mysql2/promise";

const dbHost = process.env.db_host;
const dbPort = process.env.db_port;
const dbUsername = process.env.db_username;
const dbPassword = process.env.db_password;
const caCertificate = process.env.db_cert;

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

export default { managementPool, leviosaPool, inventoryPool };
