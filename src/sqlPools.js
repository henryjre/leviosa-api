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

const managementPool = mysql.createPool({
  ...commonPoolConfig,
  connectionLimit: 10,
  database: "management",
});

const leviosaPool = mysql.createPool({
  ...commonPoolConfig,
  connectionLimit: 10,
  database: "defaultdb",
});

const inventoryPool = mysql.createPool({
  ...commonPoolConfig,
  connectionLimit: 10,
  database: "inventory",
});

const pools = {
  managementPool,
  leviosaPool,
  inventoryPool,
};

export default pools;
