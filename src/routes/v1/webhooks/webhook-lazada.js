import pools from "../../../sqlPools.js";
import fetch from "node-fetch";
import crypto from "crypto";

export async function catchWebhook(req, res) {
  try {
    const body = req.body;
    const auth = req.headers.authorization;
    const secretId = process.env.shopee_secrets_id;

    const def_connection = await pools.leviosaPool.getConnection();
    const inv_connection = await pools.inventoryPool.getConnection();

    try {
      const querySecrets = "SELECT * FROM Shop_Tokens WHERE ID = ?";
      const [secretsResult] = await def_connection.query(querySecrets, [
        secretId,
      ]);

      if (secretsResult.length <= 0) {
        throw new Error("No secrets found.");
      }
      const secrets = secretsResult[0];

      const appKey = secrets.APP_KEY;
      const secretKey = secrets.APP_SECRET;

      const stringToSign = appKey + JSON.stringify(body);
      const sign = signWebhookRequest(stringToSign, secretKey);

      if (sign !== auth) {
        throw new Error("Lazada signature mismatch!");
      }

      res.status(200).json({ ok: true, message: "success" });
    } finally {
      def_connection.release();
      inv_connection.release();
    }
  } catch (error) {
    console.error(error.toString());
    return res.status(401).json({ ok: false, message: "unauthorized" });
  }
}

function signWebhookRequest(input, secret) {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(input);

  return hmac.digest("hex");
}
