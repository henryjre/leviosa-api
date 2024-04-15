import crypto from "crypto";
import conn from "../../../sqlConnections.js";
import moment from "moment";

export {
  pingMySQL,
  refreshConnections,
  refreshShopeeToken,
  refreshLazadaToken,
  refreshTiktokToken,
};

async function refreshConnections(req, res) {
  try {
    const def_connection = await conn.leviosaConnection();
    try {
      const sqlQuery = "SHOW PROCESSLIST";

      const [processes] = await def_connection.query(sqlQuery);

      const terminated = {
        success: 0,
        fail: 0,
        total_idle: processes.filter((p) => p.Command === "Sleep").length,
        total: processes.filter((p) => p.db !== null).length,
      };

      for (const process of processes) {
        if (process.Command === "Sleep") {
          const killQuery = `KILL '${process.Id}'`;
          try {
            await def_connection.query(killQuery);
            terminated.success += 1;
          } catch (killError) {
            console.error("Error terminating connection: " + killError.stack);
            terminated.fail += 1;
          }
        }
      }

      return res.status(200).json({
        message: "Connection termination success.",
        total_open_connections: terminated.total,
        total_idle_connections: terminated.total_idle,
        success_count: terminated.success,
        fail_count: terminated.fail,
      });
    } finally {
      await def_connection.destroy();
    }
  } catch (error) {
    console.error("Error in terminating connection:", error.stack);
    return res.status(400).json({
      message: "Connection termination failed.",
      total_open_connections: null,
      total_idle_connections: null,
      success_count: null,
      fail_count: null,
    });
  }
}

async function pingMySQL(req, res) {
  try {
    const def_connection = await conn.leviosaConnection();
    const mgmt_connection = await conn.managementConnection();
    const inv_connection = await conn.inventoryConnection();
    try {
      await def_connection.ping();
      await mgmt_connection.ping();
      await inv_connection.ping();

      return res.status(200).json({
        message: "🟢 All SQL servers are reachable.",
        time: moment().format("MMMM DD, YYYY [at] h:mm A"),
      });
    } finally {
      await def_connection.destroy();
      await mgmt_connection.destroy();
      await inv_connection.destroy();
    }
  } catch (error) {
    console.error("Error pinging MySQL server:", error.message);
    return res.status(400).send("🔴 SQL servers unreachable.");
  }
}

async function refreshShopeeToken(req, res) {
  console.log("Refreshing shopee tokens");
  const host = "https://partner.shopeemobile.com";
  const secretId = process.env.shopee_secrets_id;

  try {
    const connection = await conn.leviosaConnection();

    try {
      const queryShopee = "SELECT * FROM Shop_Tokens WHERE ID = ?";
      const [shopeeSecrets] = await connection.query(queryShopee, [secretId]);

      if (shopeeSecrets.length <= 0) {
        throw new Error("No secrets found.");
      }

      const secrets = shopeeSecrets[0];

      const timest = Math.floor(Date.now() / 1000);
      const path = "/api/v2/auth/access_token/get";

      const partnerKey = secrets.APP_KEY;
      const partnerId = Number(secrets.PARTNER_ID);
      const refreshToken = secrets.REFRESH_TOKEN;
      const shopId = Number(secrets.SHOP_ID);

      const baseString = `${partnerId}${path}${timest}`;
      const sign = signRequest(baseString, partnerKey);

      const params = {
        partner_id: partnerId,
        timestamp: timest,
        sign: sign,
      };

      const body = {
        partner_id: partnerId,
        shop_id: shopId,
        refresh_token: refreshToken,
      };

      const url = `${host}${path}?${Object.entries(params)
        .map(([key, value]) => `${key}=${value}`)
        .join("&")}`;

      const options = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      };
      const result = await fetch(url, options);
      const response = await result.json();

      if (!response.error) {
        const updateQuery =
          "UPDATE Shop_Tokens SET ACCESS_TOKEN = ?, REFRESH_TOKEN = ? WHERE ID = ?";
        await connection.query(updateQuery, [
          response.access_token,
          response.refresh_token,
          secretId,
        ]);
        console.log("SHOPEE SECRETS UPDATED", response);
        return res.status(200).json({ ok: true, message: "success" });
      } else {
        console.log("SHOPEE SECRETS ERROR", response);
        return res.status(400).json({ ok: false, message: "fail" });
      }
    } finally {
      await connection.destroy();
    }
  } catch (error) {
    console.log("SHOPEE SECRETS ERROR", error);
    return res.status(400).json({ ok: false, message: "fail" });
  }

  function signRequest(input, partnerKey) {
    const inputBuffer = Buffer.from(input, "utf-8");
    const keyBuffer = Buffer.from(partnerKey, "utf-8");
    const hmac = crypto.createHmac("sha256", keyBuffer);
    hmac.update(inputBuffer);

    return hmac.digest("hex");
  }
}

async function refreshTiktokToken(req, res) {
  console.log("Refreshing tiktok tokens");
  const secretId = process.env.tiktok_secrets_id;

  try {
    const connection = await conn.leviosaConnection();

    try {
      const queryTiktok = "SELECT * FROM Shop_Tokens WHERE ID = ?";
      const [tiktokSecrets] = await connection.query(queryTiktok, [secretId]);

      if (tiktokSecrets.length <= 0) {
        throw new Error("No secrets found.");
      }

      const secrets = tiktokSecrets[0];

      const refreshToken = secrets.REFRESH_TOKEN;
      const appKey = secrets.APP_KEY;
      const appSecret = secrets.APP_SECRET;

      const url = `https://auth.tiktok-shops.com/api/v2/token/refresh?app_key=${appKey}&app_secret=${appSecret}&refresh_token=${refreshToken}&grant_type=refresh_token`;
      const options = {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      };

      const result = await fetch(url, options);
      const response = await result.json();

      if (response.code === 0) {
        const updateQuery =
          "UPDATE Shop_Tokens SET ACCESS_TOKEN = ?, REFRESH_TOKEN = ? WHERE ID = ?";
        await connection.query(updateQuery, [
          response.data.access_token,
          response.data.refresh_token,
          secretId,
        ]);
        console.log("TIKTOK SECRETS UPDATED", response);
        return res.status(200).json({ ok: true, message: "success" });
      } else {
        console.log("TIKTOK SECRETS ERROR", response);
        return res.status(400).json({ ok: false, message: "fail" });
      }
    } finally {
      await connection.destroy();
    }
  } catch (error) {
    console.log("TIKTOK SECRETS ERROR", error);
    return res.status(400).json({ ok: false, message: "fail" });
  }
}

async function refreshLazadaToken(req, res) {
  console.log("Refreshing lazada tokens");
  const apiUrl = "https://auth.lazada.com/rest";
  const secretId = process.env.lazada_secrets_id;

  try {
    const connection = await conn.leviosaConnection();

    try {
      const queryLazada = "SELECT * FROM Shop_Tokens WHERE ID = ?";
      const [lazadaSecrets] = await connection.query(queryLazada, [secretId]);

      if (lazadaSecrets.length <= 0) {
        throw new Error("No secrets found.");
      }

      const secrets = lazadaSecrets[0];

      const appKey = Number(secrets.APP_KEY);
      const refreshToken = secrets.REFRESH_TOKEN;
      const currentTimestamp = Date.now();

      const api = "/auth/token/refresh";
      const params = {
        timestamp: currentTimestamp,
        sign_method: "sha256",
        app_key: appKey,
        refresh_token: refreshToken,
      };

      const sign = await signRequest(api, params, secrets);
      const urlPath = `${api}?app_key=${params.app_key}&timestamp=${params.timestamp}&refresh_token=${params.refresh_token}&sign_method=${params.sign_method}&sign=${sign}`;

      const url = apiUrl + urlPath;
      const options = {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
      };

      const result = await fetch(url, options);
      const response = await result.json();

      if (response.code == 0) {
        const updateQuery =
          "UPDATE Shop_Tokens SET ACCESS_TOKEN = ?, REFRESH_TOKEN = ? WHERE ID = ?";
        await connection.query(updateQuery, [
          response.access_token,
          response.refresh_token,
          secretId,
        ]);
        console.log("LAZADA SECRETS UPDATED", response);
        return res.status(200).json({ ok: true, message: "success" });
      } else {
        console.log("LAZADA SECRETS ERROR", response);
        return res.status(400).json({ ok: false, message: "fail" });
      }
    } finally {
      await connection.destroy();
    }
  } catch (error) {
    console.log("LAZADA SECRETS ERROR", error);
    return res.status(400).json({ ok: false, message: "fail" });
  }

  async function signRequest(api, params, secrets) {
    const secretKey = secrets.APP_SECRET;
    const signature = generateSignature(api, params, secretKey);
    return signature;

    function generateSignature(apiName, parameters, key) {
      // Filter out parameters with byte array type and "sign"
      const filteredParams = Object.entries(parameters)
        .filter(([key, value]) => typeof value !== "object" && key !== "sign")
        .sort((a, b) => a[0].localeCompare(b[0])); // Sort parameters by name

      // Concatenate sorted parameters and their values into a string
      const concatenatedString = filteredParams
        .map(([key, value]) => `${key}${value}`)
        .join("");

      // Add the API name in front of the concatenated string
      const stringToSign = `${apiName}${concatenatedString}`;

      // Encode the concatenated string in UTF-8 format
      const utf8String = Buffer.from(stringToSign, "utf-8");

      // Create a digest using HMAC_SHA256
      const hmac = crypto.createHmac("sha256", key);
      hmac.update(utf8String);

      // Convert the digest to hexadecimal format
      const hexSignature = hmac.digest("hex").toUpperCase();

      return hexSignature;
    }
  }
}
