import pools from "../../../sqlPools.js";

export async function queryTest(req, res) {
  try {
    const idParams = req.query.sku;

    if (!idParams) {
      return res.status(400).json({ result: "No SKU found" });
    }

    const connection = await pools.leviosaPool.getConnection();

    try {
      const query = "SELECT * FROM Leviosa_Inventory WHERE SKU = ?";
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
