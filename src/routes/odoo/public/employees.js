import { odooLogin, jsonRpc } from "../../../functions/odoo_rpc.js";

const dbName = process.env.odoo_db;
const password = process.env.odoo_password;

export async function getAverageTransactionValue(req, res) {
  const { date } = req.body;

  try {
    if (!date) {
      throw new Error("No date specified");
    }

    const { start_date, end_date } = getStartAndEndOfDay(date);

    // const uid = await odooLogin();

    const params = {
      model: "pos.order",
      method: "search_read",
      domain: [
        ["state", "=", "done"],
        ["date_order", ">=", start_date],
        ["date_order", "<=", end_date],
        ["amount_total", ">=", 40],
        ["employee_id", "not ilike", "POS System"], // 4000 - POS System (employee)
        // ["company_id", "in", [branch.cid]],
      ],
      fields: ["amount_total", "employee_id"], //discount mode: per_order, per_point, percent
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

    const parsedData = getTotalATVAmount(request.result);

    return res
      .status(200)
      .json({ ok: true, message: "success", data: parsedData });
  } catch (error) {
    console.error("Error:", error);
    return res
      .status(404)
      .json({ ok: false, message: error.message, data: [] });
  }
}

function getStartAndEndOfDay(date) {
  let startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0); // Set to 12:00:00 AM

  let endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999); // Set to 11:59:59 PM

  return {
    start_date: startOfDay.toISOString(),
    end_date: endOfDay.toISOString(),
  };
}

function getTotalATVAmount(data) {
  return Object.values(
    data.reduce((acc, item) => {
      const employeeId = item.employee_id[0]; // Use the unique employee ID for grouping

      // Initialize the sum, count, and entries for the employee if it's encountered for the first time
      if (!acc[employeeId]) {
        acc[employeeId] = {
          badge: item.employee_id[1].split("-")[0].trim(),
          employee: item.employee_id[1].split("-")[1].trim(),
          total_amount: 0,
          transaction_count: 0,
        };
      }

      // Add the amount_total to the employee's sum and increment the count
      acc[employeeId].total_amount += item.amount_total;
      acc[employeeId].transaction_count += 1;

      return acc;
    }, {})
  )
    .map((entry) => ({
      ...entry,
      total_amount: parseFloat(entry.total_amount.toFixed(2)),
      average_amount: parseFloat(
        (entry.total_amount / entry.transaction_count).toFixed(2)
      ), // Calculate average and round to 2 decimals
    }))
    .sort((a, b) => b.average_amount - a.average_amount);
}
