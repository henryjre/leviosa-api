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
      const selectQuery = `SELECT * FROM ${table} WHERE ORDER_CREATED BETWEEN ? AND ? AND PLATFORM = ? ORDER BY ORDER_CREATED ASC;`;
      const [selectResult] = await inv_connection.query(selectQuery, [
        start_date,
        end_date,
        platform,
      ]);

      if (!selectResult.length) {
        return res.status(200).json({ ok: true, message: "success", data: [] });
      } else {
        const filteredResult = selectResult.map((obj) => {
          delete obj.ID;
          delete obj.SHOPEE;
          delete obj.LAZADA;
          delete obj.TIKTOK;

          obj.ORDER_CREATED = moment(obj.ORDER_CREATED)
            .tz("Asia/Manila")
            .format("MMMM DD, YYYY h:mm A");
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

export async function getRetailOrders() {
  const { start_date, end_date, platform } = req.query;

  try {
    if (!start_date || !end_date || !platform) {
      throw new Error("Invalid parameters");
    }

    if (!["SHOPEE", "LAZADA", "TIKTOK"].includes(platform)) {
      throw new Error("Invalid platform");
    }

    let table;
    switch (platform) {
      case "SHOPEE":
        table = "Orders_Shopee";
        break;
      case "LAZADA":
        table = "Orders_Lazada";
        break;
      case "TIKTOK":
        table = "Orders_Tiktok";
        break;

      default:
        throw new Error("Invalid platform");
    }

    const inv_connection = await pools.inventoryPool.getConnection();

    try {
      const selectQuery = `SELECT * FROM ${table} WHERE CREATED_DATE BETWEEN ? AND ? ORDER BY CREATED_DATE ASC;`;
      const [selectResult] = await inv_connection.query(selectQuery, [
        start_date,
        end_date,
      ]);

      if (!selectResult.length) {
        return res.status(200).json({ ok: true, message: "success", data: [] });
      } else {
        const filteredResult = selectResult.map((obj) => {
          delete obj.LAST_UPDATED;
          delete obj.DISCORD_CHANNEL;

          obj.ORDER_CREATED = moment(obj.ORDER_CREATED)
            .tz("Asia/Manila")
            .format("MMMM DD, YYYY h:mm A");
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
