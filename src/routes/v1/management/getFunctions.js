import conn from "../../../sqlConnections.js";

export async function getExecutiveTasks(req, res) {
  const { executive_id } = req.query;

  try {
    if (!executive_id) {
      throw new Error("Invalid parameters");
    }

    const mgmt_connections = await conn.managementConnection();

    try {
      const selectQuery = `SELECT * FROM Executive_Tasks WHERE EXECUTIVE_ID = ? ORDER BY TIME_RENDERED DESC;`;
      const queryResult = await mgmt_connections.query(selectQuery, [
        executive_id,
      ]);

      const selectExecutive = `SELECT * FROM Executives WHERE MEMBER_ID = ?;`;
      const [executiveResult] = await mgmt_connections.query(selectExecutive, [
        executive_id,
      ]);

      const selectResult = queryResult[0];
      const executive = executiveResult[0];

      if (!selectResult.length) {
        return res.status(200).json({ ok: true, message: "success", data: [] });
      } else {
        const filteredResult = selectResult.map((obj) => {
          const totalHoursRendered = obj.TIME_RENDERED;
          const totalRenderedTime = formatRenderedTime(totalHoursRendered);

          obj.TOTAL_TIME = totalRenderedTime;

          return obj;
        });

        const totalTime = executive.TIME_RENDERED;
        const totalExecutiveTime = formatRenderedTime(totalTime);

        const totalDeductions = executive.TIME_DEDUCTION;
        const totalExecutiveDeductions = formatRenderedTime(totalDeductions);

        return res.status(200).json({
          ok: true,
          message: "success",
          data: filteredResult,
          executive: {
            total_time: totalExecutiveTime,
            deducted_time: totalExecutiveDeductions,
          },
        });
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

  function formatRenderedTime(totalTime) {
    const totalHours = Math.floor(totalTime / 60);
    const totalMinutes = totalTime % 60;

    const formattedTime = `${totalHours} ${
      totalHours === 1 ? "hour" : "hours"
    } and ${totalMinutes} ${totalMinutes === 1 ? "minute" : "minutes"}`;

    return formattedTime;
  }
}
