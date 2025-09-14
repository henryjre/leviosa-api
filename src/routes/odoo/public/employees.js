import { odooLogin, jsonRpc } from "../../../functions/odoo_rpc.js";
import moment from "moment-timezone";

const dbName = process.env.odoo_db;
const password = process.env.odoo_password;

//
// GETTING ATV
//

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

//
// GETTING DAILY SALES
//

export async function getOrderSalesJournal(req, res) {
  const { date } = req.body;

  if (!date) {
    return res
      .status(400)
      .json({ ok: false, message: "No date specified", data: [] });
  }

  const { start_date, end_date } = getStartAndEndOfDay(date);

  try {
    const sessions = await getSessions(start_date, end_date);

    if (!sessions.ok) {
      throw new Error(sessions.message);
    }

    const sessionData = sessions.data;
    const sessionNames = sessionData.map((item) => item.display_name);

    const sessionJournals = await getSessionJournalEntries(sessionNames);

    if (!sessionJournals.ok) {
      throw new Error(sessionJournals.message);
    }

    const fullSessionCombined = combineArrays(
      sessionData,
      sessionJournals.data
    );

    const fullTotalSession = calculateTotal(fullSessionCombined);

    const aggregatedSessions = aggregateByCompany(fullTotalSession);

    return res
      .status(200)
      .json({ ok: true, message: "success", data: aggregatedSessions });
  } catch (error) {
    console.error("Error:", error.message);
    return res
      .status(404)
      .json({ ok: false, message: error.message, data: [] });
  }

  async function getSessions(dateStart, dateEnd) {
    try {
      const params = {
        model: "pos.session",
        method: "search_read",
        domain: [
          ["start_at", ">=", dateStart],
          ["start_at", "<=", dateEnd],
          // ["stop_at", "<=", dateEnd],
          ["state", "=", "closed"],
          ["user_id", "=", 7],
        ],
        fields: ["company_id", "display_name"],
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
        ],
      });

      if (request.error) {
        throw new Error("rpc_error");
      }

      if (!request.result.length) {
        throw new Error("no_data_found");
      }

      return { ok: true, message: "success", data: request.result };
    } catch (error) {
      console.error("Error:", error.message);
      return { ok: false, message: error.message, data: [] };
    }
  }

  async function getSessionJournalEntries(sessionNames) {
    try {
      const params = {
        model: "account.move.line",
        method: "search_read",
        domain: [["ref", "in", sessionNames]],
        fields: ["move_name", "account_id", "ref", "name", "debit", "credit"],
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
        ],
      });

      if (request.error) {
        throw new Error("rpc_error");
      }

      if (!request.result.length) {
        throw new Error("no_data_found");
      }

      return { ok: true, message: "success", data: request.result };
    } catch (error) {
      console.error("Error:", error.message);
      return { ok: false, message: error.message, data: [] };
    }
  }
}

//
// GETTING EMPLOYEE SCHEDULE BASED ON DATE
//

export async function getAttendance(req, res) {
  const { date } = req.body;

  try {
    if (!date) {
      throw new Error("No date specified");
    }

    const { start_date, end_date } = getStartAndEndOfDay(date);

    // const uid = await odooLogin();

    const params = {
      model: "hr.attendance",
      method: "search_read",
      domain: [
        // ["check_in", ">=", start_date],
        ["check_in", ">=", start_date],
        ["check_in", "<=", end_date],
        ["department_id", "in", [1, 4, 5, 7]],
      ],
      fields: [
        "employee_id",
        "department_id",
        "check_in",
        "check_out",
        "worked_hours",
      ], //discount mode: per_order, per_point, percent
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

    const groupedData = request.result.reduce((acc, curr) => {
      const departmentId = curr.department_id[0];
      if (!acc[departmentId]) {
        acc[departmentId] = {
          department_name: curr.department_id[1],
          employees: [],
        };
      }
      // Format the dates
      curr.check_in = moment(curr.check_in)
        .tz("Asia/Manila")
        .format("MMMM DD, YYYY h:mm A");
      curr.check_out = moment(curr.check_out)
        .tz("Asia/Manila")
        .format("MMMM DD, YYYY h:mm A");

      acc[departmentId].employees.push({
        id: curr.id,
        employee: curr.employee_id[1],
        check_in: curr.check_in,
        check_out: curr.check_out,
        worked_hours: parseFloat(curr.worked_hours.toFixed(2)),
      });
      return acc;
    }, {});

    const result = Object.values(groupedData);

    return res.status(200).json({ ok: true, message: "success", data: result });
  } catch (error) {
    console.error("Error:", error);
    return res
      .status(404)
      .json({ ok: false, message: error.message, data: [] });
  }
}

// EXTERIOR FUNCTIONS

function getStartAndEndOfDay(dateString) {
  const date = new Date(dateString);
  // Use moment to parse the input date and set the time zone to Philippine Time (Asia/Manila)
  let startOfDay = moment(date).tz("Asia/Manila").startOf("day"); // Set to 12:00:00 AM
  let endOfDay = moment(date).tz("Asia/Manila").endOf("day"); // Set to 11:59:59 PM

  return {
    start_date: startOfDay.toISOString(),
    end_date: endOfDay.toISOString(),
  };
}

function getTotalATVAmount(data) {
  return Object.values(
    data.reduce((acc, item) => {
      if (!item.employee_id) {
        return acc;
      }

      const employeeName = item.employee_id[1].split("-")[1].trim(); // Use the unique employee ID for grouping

      // Initialize the sum, count, and entries for the employee if it's encountered for the first time
      if (!acc[employeeName]) {
        acc[employeeName] = {
          badge: item.employee_id[1].split("-")[0].trim(),
          employee: employeeName,
          total_amount: 0,
          transaction_count: 0,
        };
      }

      // Add the amount_total to the employee's sum and increment the count
      acc[employeeName].total_amount += item.amount_total;
      acc[employeeName].transaction_count += 1;

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

// FOR DAILY SALES QUOTA
const combineArrays = (array1, array2) => {
  return array1.map((item) => {
    const journalEntries = array2.filter(
      (entry) => entry.ref === item.display_name
    );
    return {
      ...item,
      journal_entries: journalEntries,
    };
  });
};

const calculateTotal = (data) => {
  return data.map((session) => {
    let totalSales = 0;
    let totalRefunds = 0;

    session.journal_entries.forEach(({ name, debit, credit }) => {
      if (name && name.trim().toLowerCase() === "sales untaxed") {
        totalSales += credit;
      } else if (name && name.trim().toLowerCase() === "refund untaxed") {
        totalRefunds += debit;
      }
    });

    const totalDifference = totalSales - totalRefunds;

    return {
      company_id: session.company_id,
      display_name: session.display_name,
      total_sales: totalSales,
      total_deductibles: totalRefunds,
      total_difference: totalDifference,
    };
  });
};

const aggregateByCompany = (data) => {
  const aggregated = data.reduce(
    (acc, { company_id, display_name, total_sales, total_deductibles }) => {
      const [companyId, companyName] = company_id;
      if (!acc[companyId]) {
        acc[companyId] = {
          company_id: company_id,
          total_sales: 0,
          total_deductibles: 0,
          total_difference: 0,
          display_name: "",
        };
      }

      acc[companyId].total_sales += total_sales;
      acc[companyId].total_deductibles += total_deductibles;
      acc[companyId].total_difference =
        acc[companyId].total_sales - acc[companyId].total_deductibles;
      acc[companyId].display_name +=
        (acc[companyId].display_name ? "\n" : "") + display_name;

      return acc;
    },
    {}
  );

  return Object.values(aggregated);
};
