import mysql from "mysql2/promise";

const dbHost = process.env.db_host;
const dbPort = process.env.db_port;
const dbUsername = process.env.db_username;
const dbPassword = process.env.db_password;
const caCertificate = process.env.db_cert;

const commonPoolConfig = {
  host: dbHost,
  port: dbPort,
  user: dbUsername,
  password: dbPassword,
  ssl: {
    ca: caCertificate,
    rejectUnauthorized: true,
  },
};

const managementConnection = async () =>
  await mysql.createConnection({
    ...commonPoolConfig,
    database: "management",
  });

const leviosaConnection = async () =>
  await mysql.createConnection({
    ...commonPoolConfig,
    database: "defaultdb",
  });

const inventoryConnection = async () =>
  await mysql.createConnection({
    ...commonPoolConfig,
    database: "inventory",
  });

const conn = {
  managementConnection,
  leviosaConnection,
  inventoryConnection,
};

export default conn;
