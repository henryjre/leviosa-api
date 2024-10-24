import { odooLogin, jsonRpc } from "../../../functions/odoo_rpc.js";

const dbName = process.env.odoo_db;
const password = process.env.odoo_password;

export async function getLoyaltyCardData(req, res) {
  const { partner_id } = req.query;

  try {
    if (!partner_id) {
      throw new Error("no_barcode_found");
    }

    const uid = await odooLogin();

    const params = {
      model: "loyalty.card",
      method: "search_read",
      domain: [
        ["partner_id", "=", partner_id],
        // ["company_id", "in", [branch.cid]],
      ],
      fields: ["points"],
      offset: null,
      limit: null,
      //   order: "date asc",
    };

    const request = await jsonRpc("call", {
      service: "object",
      method: "execute",
      args: [
        dbName,
        uid,
        password,
        params.model,
        params.method,
        params.domain,
        params.fields,
        params.offset,
        params.limit,
        // params.order,
      ],
    });

    if (request.error) {
      throw new Error("rpc_error");
    }

    if (!request.result.length) {
      throw new Error("invalid_barcode");
    }

    return res
      .status(200)
      .json({ ok: true, message: "success", data: request.result });
  } catch (error) {
    console.error("Error:", error);
    return res
      .status(404)
      .json({ ok: false, message: error.message, data: [] });
  }
}
