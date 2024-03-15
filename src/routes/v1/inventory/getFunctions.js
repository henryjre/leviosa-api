import moment from "moment-timezone";
import pools from "../../../sqlPools.js";

export async function getInventoryProductOrders(req, res) {
  const { start_date, end_date, platform, status } = req.query;

  try {
    if (!start_date || !end_date || !platform) {
      throw new Error("Invalid parameters");
    }

    if (
      ![
        "PENDING IN",
        "PENDING OUT",
        "COMPLETED IN",
        "COMPLETED OUT",
        "CANCELLED",
      ].includes(status)
    ) {
      throw new Error("Invalid status");
    }

    let table;
    switch (status) {
      case "PENDING IN":
        table = "Pending_Inventory_In";
        break;
      case "PENDING OUT":
        table = "Pending_Inventory_Out";
        break;
      case "COMPLETED IN":
        table = "Completed_Inventory_In";
        break;
      case "COMPLETED OUT":
        table = "Completed_Inventory_Out";
        break;
      case "CANCELLED":
        table = "Cancelled_Inventory_Out";
        break;

      default:
        throw new Error("Invalid status");
    }

    const inv_connection = await pools.inventoryPool.getConnection();

    try {
      let queryResult;
      if (platform !== "ALL") {
        const selectQuery = `SELECT * FROM ${table} WHERE ORDER_CREATED BETWEEN ? AND ? AND PLATFORM = ? ORDER BY ORDER_CREATED ASC;`;
        queryResult = await inv_connection.query(selectQuery, [
          start_date,
          end_date,
          platform,
        ]);
      } else if (platform === "ALL") {
        const selectQuery = `SELECT * FROM ${table} WHERE ORDER_CREATED BETWEEN ? AND ? ORDER BY ORDER_CREATED ASC;`;
        queryResult = await inv_connection.query(selectQuery, [
          start_date,
          end_date,
        ]);
      }

      const selectResult = queryResult[0];

      if (!selectResult.length) {
        return res.status(200).json({ ok: true, message: "success", data: [] });
      } else {
        const filteredResult = selectResult.map((obj) => {
          delete obj.ID;
          delete obj.SHOPEE;
          delete obj.LAZADA;
          delete obj.TIKTOK;

          obj.ORDER_CREATED = moment(obj.ORDER_CREATED).format(
            "MMMM DD, YYYY h:mm A"
          );
          obj.PRODUCT_COGS = Number(obj.PRODUCT_COGS);

          return obj;
        });

        return res
          .status(200)
          .json({ ok: true, message: "success", data: filteredResult });
      }
    } finally {
      inv_connection.release();
    }
  } catch (error) {
    console.log(error.toString());
    return res
      .status(404)
      .json({ ok: false, message: error.message, data: [] });
  }
}

export async function getRetailOrders(req, res) {
  const { start_date, end_date, platform } = req.query;

  try {
    if (!start_date || !end_date || !platform) {
      throw new Error("Invalid parameters");
    }

    if (!["SHOPEE", "LAZADA", "TIKTOK", "ALL"].includes(platform)) {
      throw new Error("Invalid platform");
    }

    let queryString;
    switch (platform) {
      case "SHOPEE":
        queryString = `SELECT *, 'SHOPEE' AS PLATFORM FROM Orders_Shopee WHERE CREATED_DATE BETWEEN ? AND ? ORDER BY CREATED_DATE ASC;`;
        break;
      case "LAZADA":
        queryString = `SELECT *, 'LAZADA' AS PLATFORM FROM Orders_Lazada WHERE CREATED_DATE BETWEEN ? AND ? ORDER BY CREATED_DATE ASC;`;
        break;
      case "TIKTOK":
        queryString = `SELECT *, 'TIKTOK' AS PLATFORM FROM Orders_Tiktok WHERE CREATED_DATE BETWEEN ? AND ? ORDER BY CREATED_DATE ASC;`;
        break;
      case "ALL":
        queryString = null;
        break;

      default:
        throw new Error("Invalid platform");
    }

    const inv_connection = await pools.inventoryPool.getConnection();

    try {
      let queryResult;
      if (queryString === null) {
        const selectQuery = `
  SELECT * FROM (
    (SELECT *, 'SHOPEE' AS PLATFORM FROM Orders_Shopee WHERE CREATED_DATE BETWEEN ? AND ?)
    UNION ALL
    (SELECT *, 'LAZADA' AS PLATFORM FROM Orders_Lazada WHERE CREATED_DATE BETWEEN ? AND ?)
    UNION ALL
    (SELECT *, 'TIKTOK' AS PLATFORM FROM Orders_Tiktok WHERE CREATED_DATE BETWEEN ? AND ?)
  ) AS CombinedOrders
  ORDER BY CREATED_DATE ASC;
`;
        queryResult = await inv_connection.query(selectQuery, [
          start_date,
          end_date,
          start_date,
          end_date,
          start_date,
          end_date,
        ]);
      } else {
        queryResult = await inv_connection.query(queryString, [
          start_date,
          end_date,
        ]);
      }

      const selectResult = queryResult[0];

      if (!selectResult.length) {
        return res.status(200).json({ ok: true, message: "success", data: [] });
      } else {
        const filteredResult = selectResult.map((obj) => {
          delete obj.LAST_UPDATED;
          delete obj.DISCORD_CHANNEL;

          obj.SETTLED = parseInt(obj.SETTLED) === 0 ? "NO" : "YES";
          obj.CREATED_DATE = moment(obj.CREATED_DATE).format(
            "MMMM DD, YYYY h:mm A"
          );
          obj.ORDER_STATUS = obj.ORDER_STATUS.replace(/_/g, " ");
          obj.RECEIVABLES_AMOUNT = Number(obj.RECEIVABLES_AMOUNT);

          return obj;
        });

        return res
          .status(200)
          .json({ ok: true, message: "success", data: filteredResult });
      }
    } finally {
      inv_connection.release();
    }
  } catch (error) {
    console.log(error.toString());
    return res
      .status(404)
      .json({ ok: false, message: error.message, data: [] });
  }
}

export async function getMainInventory(req, res) {
  try {
    const def_connection = await pools.leviosaPool.getConnection();
    try {
      const queryString = `SELECT 
                SINGLE_LISTING, 
                SKU,
                BRAND,
                PRODUCT_NAME,
                TOTAL_QUANTITY,
                OLD_QUANTITY,
                NEW_QUANTITY,
                OLD_EXPIRATION_DATE,
                NEW_EXPIRATION_DATE,
                WEIGHT,
                "L(cm)",
                "W(cm)",
                "H(cm)",
                SRP,
                REGULAR_DISCOUNTED_PRICE,
                RESELLER_PRICE,
                CAMPAIGN_PRICE,
                COST_OF_GOODS,
                PRODUCT_DESCRIPTION,
                HOW_TO_USE,
                INGREDIENTS,
                BENEFITS,
                DISCLAIMER 
            FROM 
                Leviosa_Inventory 
            ORDER BY 
                PRODUCT_NAME ASC;
`;
      const [rows] = await connection.execute(queryString);

      return res
        .status(200)
        .json({ ok: true, message: error.message, data: rows });
    } finally {
      def_connection.release();
    }
  } catch (error) {
    console.log(error.toString());
    return res
      .status(404)
      .json({ ok: false, message: error.message, data: [] });
  }
}
