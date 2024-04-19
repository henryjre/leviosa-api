import conn from "../../../sqlConnections.js";

export async function getExecutiveTasks(req, res) {
  const { executive_id } = req.query;

  try {
    if (!executive_id) {
      throw new Error("Invalid parameters");
    }

    const mgmt_connections = await conn.managementConnection();

    try {
      const selectQuery = `SELECT * FROM Executive_Tasks WHERE EXECUTIVE_ID = ?;`;
      const queryResult = await mgmt_connections.query(selectQuery, [
        executive_id,
      ]);

      const selectResult = queryResult[0];

      if (!selectResult.length) {
        return res.status(200).json({ ok: true, message: "success", data: [] });
      } else {
        return res
          .status(200)
          .json({ ok: true, message: "success", data: selectResult });
      }
    } finally {
      await mgmt_connections.destroy();
    }
  } catch (error) {
    console.log(error.toString());
    return res
      .status(404)
      .json({ ok: false, message: error.message, data: [] });
  }
}
