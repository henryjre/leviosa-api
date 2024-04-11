import * as deduction from "../jobs/retail_stock_change.js";
import conn from "../../../sqlConnections.js";

export async function deductRetailInventory(req, res) {
  const { platform } = req.query;
  if (!platform) {
    return res.status(400).send({ ok: false, message: "No plaform specified" });
  }

  if (!["shopee", "lazada", "tiktok"].includes(platform.toLowerCase())) {
    return res
      .status(400)
      .send({ ok: false, message: "Invalid plaform specified" });
  }

  try {
    switch (platform.toLowerCase()) {
      case "shopee":
        await deduction.changeShopeeInventory(0);
        break;
      case "lazada":
        await deduction.changeLazadaInventory(0);
        break;
      case "tiktok":
        await deduction.changeTiktokInventory(0);
        break;

      default:
        return res
          .status(400)
          .send({ ok: false, message: "Invalid plaform specified" });
    }

    return res
      .status(200)
      .send({ ok: true, message: "Successfully called the stock deduction" });
  } catch (error) {
    return res.status(400).send({ ok: false, message: error.message });
  }
}

// export async function addRetailOnAddInventory(req, res) {
//   const { data } = req.body;

//   try {

//   } catch (error) {

//   }
// }

export async function soldOutRetailStock(req, res) {
  const { sku } = req.query;
  if (!sku) {
    return res.status(400).send({ ok: false, message: "No sku specified" });
  }

  const data = [{ sku: sku, quantity: 0 }];

  const soldOutResult = await deduction.setProductQuantity(data);

  return res.status(200).json(soldOutResult);
}

export async function syncInventories(req, res) {
  try {
    const def_connection = await conn.leviosaConnection();

    try {
      const selectQuery = `SELECT JSON_OBJECT('sku', SKU, 'quantity', TOTAL_QUANTITY) AS result FROM Leviosa_Inventory`;
      const [selectResult] = await def_connection.query(selectQuery);

      const inventorySetResult = await deduction.setProductQuantity(
        selectResult
      );

      return res.status(200).json(inventorySetResult);
    } finally {
      await def_connection.end();
    }
  } catch (error) {
    console.log(error.toString());
    return res.send(400).json({ code: 0, message: error.message });
  }
}
