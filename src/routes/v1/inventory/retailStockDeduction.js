import * as deduction from "../../../jobs/retail_stock_deduction.js";

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
        await deduction.deductShopeeInventory();
        break;
      case "lazada":
        await deduction.deductLazadaInventory();
        break;
      case "tiktok":
        await deduction.deductTiktokInventory();
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
