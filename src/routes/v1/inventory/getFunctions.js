import moment from "moment-timezone";
import pools from "../../../sqlPools.js";

export async function getPendingInventoryOut(req, res) {
  const { start_date, end_date, platform } = req.query;

  try {
    if (!start_date || !end_date || !platform) {
      throw new Error("Invalid parameters");
    }

    const inv_connection = await pools.inventoryPool.getConnection();

    try {
      const selectQuery = `SELECT * FROM Pending_Inventory_Out WHERE ORDER_CREATED BETWEEN ? AND ? AND PLATFORM = ? ORDER BY ORDER_CREATED ASC;`;
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
