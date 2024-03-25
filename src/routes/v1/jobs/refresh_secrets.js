import * as cron from "cron";
import crypto from "crypto";
import pools from "../../../sqlPools.js";

const cronJob = cron.CronJob;

//Refresh shopee secrets every 4 hours
const shopeeSecrets = new cronJob(
  "0 */3 * * *",
  async () => {
    console.log("Refreshing shopee tokens");
    await refreshShopeeToken();
  },
  null,
  false,
  "Asia/Manila"
);

const tiktokSecrets = new cronJob(
  "0 0 */5 * *",
  async () => {
    console.log("Refreshing tiktok tokens");
    await refreshTiktokToken();
  },
  null,
  false,
  "Asia/Manila"
);

const lazadaSecrets = new cronJob(
  "0 0 */29 * *",
  async () => {
    console.log("Refreshing tiktok tokens");
    await refreshLazadaToken();
  },
  null,
  false,
  "Asia/Manila"
);

export {
  sampleJob,
  refreshShopeeToken,
  refreshLazadaToken,
  refreshTiktokToken,
};

async function sampleJob(req, res) {
  console.log("sample job running");
  return res.status(200).json({ ok: true, message: "success" });
}

async function refreshShopeeToken(req, res) {
  const host = "https://partner.shopeemobile.com";
  const secretId = process.env.shopee_secrets_id;

  try {
    const connection = await pools.leviosaPool.getConnection();

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
      connection.release();
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
  const secretId = process.env.tiktok_secrets_id;

  try {
    const connection = await pools.leviosaPool.getConnection();

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
      connection.release();
    }
  } catch (error) {
    console.log("TIKTOK SECRETS ERROR", error);
    return res.status(400).json({ ok: false, message: "fail" });
  }
}

async function refreshLazadaToken(req, res) {
  const apiUrl = "https://auth.lazada.com/rest";
  const secretId = process.env.lazada_secrets_id;

  try {
    const connection = await pools.leviosaPool.getConnection();

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
      connection.release();
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
