import pools from "../../../sqlPools.js";
import fetch from "node-fetch";
import crypto from "crypto";

export async function catchWebhook(req, res) {
  res.status(200).json({ ok: true, message: "success" });
  try {
    const body = req.body;
    const auth = req.headers.authorization;

    if (!idParams) {
      return res.status(400).json({ result: "No SKU found" });
    }

    const connection = await pools.managementPool.getConnection();

    try {
      const query = "SELECT * FROM Executives WHERE MEMBER_ID = ?";
      const [product] = await connection.query(query, [idParams]);

      if (product.length > 0) {
        return res.status(200).json({ result: product[0] });
      } else {
        return res.status(404).json({ result: "No product found" });
      }
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error(error.toString());
    return res.status(500).json({ result: "Internal Server Error" });
  }
}
