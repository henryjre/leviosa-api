import { odooLogin, jsonRpc } from "../../../functions/odoo_rpc.js";

const dbName = process.env.odoo_db;
const password = process.env.odoo_password;

export async function getLoyaltyRewards(req, res) {
  // const { category } = req.body;

  try {
    // if (!category) {
    //   throw new Error("No product category specified");
    // }

    // const uid = await odooLogin();

    const params = {
      model: "loyalty.reward",
      method: "search_read",
      domain: [
        ["program_id", "in", ["Reward Card"]],
        // ["company_id", "in", [branch.cid]],
      ],
      fields: ["description", "required_points", "discount", "discount_mode"], //discount mode: per_order, per_point, percent
      offset: null,
      limit: null,
      //   order: "date asc",
    };

    const request = await jsonRpc("call", {
      service: "object",
      method: "execute",
      args: [
        dbName,
        2,
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
      throw new Error("no_data_found");
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
