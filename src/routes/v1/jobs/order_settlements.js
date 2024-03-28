import moment from "moment-timezone";

import {
  lazadaGetAPIRequest,
  shopeeGetAPIRequest,
  tiktokGetAPIRequest,
} from "../../../functions/api_request_functions.js";
import pools from "../../../sqlPools.js";

export {
  checkForLazadaSettlements,
  checkForShopeeSettlements,
  checkForTiktokSettlements,
};

//FOR TIKTOK SETTLEMENTS
async function checkForTiktokSettlements(req, res) {
  const secretId = process.env.tiktok_secrets_id;

  try {
    const def_connection = await pools.leviosaPool.getConnection();
    const inv_connection = await pools.inventoryPool.getConnection();

    try {
      const querySecrets = "SELECT * FROM Shop_Tokens WHERE ID = ?";
      const [secretsResult] = await def_connection.query(querySecrets, [
        secretId,
      ]);

      if (!secretsResult.length) {
        throw new Error("No Tiktok secrets found. Ending job...");
      }

      const secrets = secretsResult[0];

      const statementFetch = await getTiktokDailyStatement(secrets);
      if (!statementFetch.ok) {
        console.log(statementFetch);
        throw new Error("There was an error while fetching the statement.");
      }

      const statement = statementFetch.data.data.statements[0];
      //   const statementId = statement.id;
      //   const statementPaymentId = statement.payment_id;
      //   const statementRevenue = Number(statement.revenue_amount);
      //   const statementAmount = Number(statement.settlement_amount);
      //   const statementFees = Math.abs(statement.fee_amount);
      //   const statementTime = moment
      //     .unix(statement.statement_time)
      //     .tz("Asia/Manila")
      //     .format("YYYY-MM-DD HH:mm:ss");

      //   const valuesToInsert = [
      //     statementId,
      //     statementPaymentId,
      //     statementRevenue,
      //     statementAmount,
      //     statementFees,
      //     statementTime,
      //   ];

      const orderStatementFetch = await getTiktokStatementTransactions(
        secrets,
        statement.id
      );
      if (!orderStatementFetch.ok) {
        console.log(orderStatementFetch);
        throw new Error(
          "There was an error while fetching the statement for tiktok orders."
        );
      }

      const statementOrders =
        orderStatementFetch.data.data.statement_transactions;

      if (!statementOrders.length) {
        throw new Error("No Tiktok orders to settle. Ending job...");
      }

      const toSettleOrders = statementOrders.map((order) => ({
        orderId: order.id,
        settlementAmount: Number(order.settlement_amount),
        settlementFees: Math.abs(order.fee_amount),
      }));

      if (toSettleOrders.length === 0) {
        console.log("No Tiktok orders to settle. Ending job...");
        return res.status(200).json({ ok: true, message: "success" });
      }

      const updateOrders = `
        UPDATE Orders_Tiktok
        SET 
            NET_SETTLEMENT_AMOUNT = CASE ORDER_ID
                ${toSettleOrders
                  .map(
                    (order) =>
                      `WHEN '${order.orderId}' THEN ${order.settlementAmount}`
                  )
                  .join(" ")}
                ELSE NET_SETTLEMENT_AMOUNT
            END,
            NET_SETTLEMENT_FEES = CASE ORDER_ID
                ${toSettleOrders
                  .map(
                    (order) =>
                      `WHEN '${order.orderId}' THEN ${order.settlementFees}`
                  )
                  .join(" ")}
                ELSE NET_SETTLEMENT_FEES
            END,
            SETTLED = 1
        WHERE ORDER_ID IN (${toSettleOrders
          .map((order) => `'${order.orderId}'`)
          .join(", ")});`;
      await inv_connection.query(updateOrders);
      console.log("TIKTOK ORDERS WERE SETTLED");
      return res.status(200).json({ ok: true, message: "success" });

      //   const inserSettlement = `INSERT IGNORE INTO Statements_Tiktok (STATEMENT_ID, PAYMENT_ID, REVENUE, SETTLEMENT_AMOUNT, SETTLEMENT_FEES, STATEMENT_TIME) VALUES (?, ?, ?, ?, ?, ?)`;
      //   await inv_connection.query(inserSettlement, valuesToInsert);
    } finally {
      def_connection.release();
      inv_connection.release();
    }
  } catch (error) {
    console.log(error.toString());
    return res.status(400).json({ ok: false, message: "fail" });
  }
}

async function getTiktokDailyStatement(secrets) {
  const path = "/finance/202309/statements";
  const queryParams = {
    page_size: 1,
    sort_field: "statement_time",
    sort_order: "DESC",
  };

  return tiktokGetAPIRequest(secrets, path, queryParams);
}

async function getTiktokStatementTransactions(secrets, statementId) {
  const path = `/finance/202309/statements/${statementId}/statement_transactions`;
  const queryParams = {
    sort_field: "order_create_time",
    page_size: 50,
  };

  return tiktokGetAPIRequest(secrets, path, queryParams);
}

//
//
//FOR LAZADA SETTLEMENTS
async function checkForLazadaSettlements(req, res) {
  const secretId = process.env.lazada_secrets_id;

  try {
    const def_connection = await pools.leviosaPool.getConnection();
    const inv_connection = await pools.inventoryPool.getConnection();

    try {
      const selectOrders = `SELECT * FROM Orders_Lazada WHERE ORDER_STATUS = 'delivered' AND SETTLED = 0 ORDER BY CREATED_DATE ASC LIMIT 10`;
      const [settledOrders] = await inv_connection.query(selectOrders);

      if (!settledOrders.length) {
        console.log("No Lazada orders to settle. Ending job...");
        return res.status(200).json({ ok: true, message: "success" });
      }

      let startDate = moment(0);
      let endDate = moment();

      for (const order of settledOrders) {
        const createdDate = moment(order.CREATED_DATE).subtract(2, "days");
        const deliveredDate = moment(order.CREATED_DATE).add(14, "days");

        if (deliveredDate.isBefore(endDate)) {
          endDate = deliveredDate;
        }

        if (createdDate.isAfter(startDate)) {
          startDate = createdDate;
        }
      }

      const endTime = endDate.format("YYYY-MM-DD");
      const startTime = startDate.format("YYYY-MM-DD");

      const querySecrets = "SELECT * FROM Shop_Tokens WHERE ID = ?";
      const [secretsResult] = await def_connection.query(querySecrets, [
        secretId,
      ]);

      if (!secretsResult.length) {
        throw new Error("No Lazada secrets found. Ending job...");
      }

      const secrets = secretsResult[0];

      const settlementFetch = await queryOrderSettlements(
        secrets,
        startTime,
        endTime
      );

      if (!settlementFetch.ok) {
        console.log(settlementFetch);
        throw new Error(
          "There was an error while fetching the statement for lazada orders."
        );
      }

      const settlements = settlementFetch.data.data;

      if (!settlements.length) {
        throw new Error("No Lazada orders to settle. Ending job...");
      }

      const paidSettlements = settlements.filter(
        (s) => s.paid_status === "paid"
      );

      if (!paidSettlements.length) {
        throw new Error("No paid Lazada settlements. Ending job...");
      }

      const toSettleOrders = [];
      for (const order of settledOrders) {
        const orderSettlements = paidSettlements.filter(
          (s) => s.order_no === order.ORDER_ID
        );

        if (!orderSettlements.length) continue;

        const totalItemPriceCredit = orderSettlements.reduce((sum, s_order) => {
          if (s_order.fee_name === "Item Price Credit") {
            const cleanedAmount = s_order.amount.replace(/,/g, "");
            const amount = Number(Math.abs(cleanedAmount));
            console.log(amount);
            sum += isNaN(amount) ? 0 : amount;
          }
          return sum;
        }, 0);

        const totalSettlementFees = orderSettlements.reduce((sum, s_order) => {
          if (s_order.fee_name !== "Item Price Credit") {
            const cleanedAmount = s_order.amount.replace(/,/g, "");
            const amount = Number(Math.abs(cleanedAmount));
            sum += isNaN(amount) ? 0 : amount;
          }
          return sum;
        }, 0);

        const totalSettledAmount =
          Number(totalItemPriceCredit.toFixed(2)) -
          Number(totalSettlementFees.toFixed(2));

        toSettleOrders.push({
          orderId: order.ORDER_ID,
          settlementAmount: Number(totalSettledAmount.toFixed(2)),
          settlementFees: Number(totalSettlementFees.toFixed(2)),
        });
      }

      if (toSettleOrders.length === 0) {
        console.log("No Lazada orders to settle. Ending job...");
        return res.status(200).json({ ok: true, message: "success" });
      }

      const updateOrders = `
      UPDATE Orders_Lazada
      SET 
          NET_SETTLEMENT_AMOUNT = CASE ORDER_ID
              ${toSettleOrders
                .map(
                  (order) =>
                    `WHEN '${order.orderId}' THEN ${order.settlementAmount}`
                )
                .join(" ")}
              ELSE NET_SETTLEMENT_AMOUNT
          END,
          NET_SETTLEMENT_FEES = CASE ORDER_ID
              ${toSettleOrders
                .map(
                  (order) =>
                    `WHEN '${order.orderId}' THEN ${order.settlementFees}`
                )
                .join(" ")}
              ELSE NET_SETTLEMENT_FEES
          END,
          SETTLED = 1
      WHERE ORDER_ID IN (${toSettleOrders
        .map((order) => `'${order.orderId}'`)
        .join(", ")});`;
      await inv_connection.query(updateOrders);

      console.log("LAZADA ORDERS WERE SETTLED");
      return res.status(200).json({ ok: true, message: "success" });
    } finally {
      def_connection.release();
      inv_connection.release();
    }
  } catch (error) {
    console.log(error.toString());
    return res.status(400).json({ ok: false, message: "fail" });
  }
}

async function queryOrderSettlements(secrets, startTime, endTime) {
  const path = "/finance/transaction/details/get";
  const params = { start_time: startTime, end_time: endTime };
  return lazadaGetAPIRequest(secrets, path, params);
}

//
//
// FOR SHOPEE SETTLEMENTS
async function checkForShopeeSettlements(req, res) {
  const secretId = process.env.shopee_secrets_id;
  try {
    const def_connection = await pools.leviosaPool.getConnection();
    const inv_connection = await pools.inventoryPool.getConnection();

    try {
      const querySecrets = "SELECT * FROM Shop_Tokens WHERE ID = ?";
      const [secretsResult] = await def_connection.query(querySecrets, [
        secretId,
      ]);

      if (!secretsResult.length) {
        throw new Error("No Shopee secrets found. Ending job...");
      }

      const secrets = secretsResult[0];

      const selectOrders = `SELECT * FROM Orders_Shopee WHERE ORDER_STATUS = 'COMPLETED' AND SETTLED = 0 ORDER BY CREATED_DATE ASC LIMIT 10`;
      const [settledOrders] = await inv_connection.query(selectOrders);

      if (!settledOrders.length) {
        throw new Error("No Shopee orders to settle. Ending job...");
      }

      const toSettleOrders = [];
      for (const order of settledOrders) {
        const settlementFetch = await getShopeeOrderSettlement(
          secrets,
          order.ORDER_ID
        );

        if (!settlementFetch.ok) {
          console.log(
            `Could not settle shopee order #${order.ORDER_ID}. Ignoring...`
          );
          continue;
        }

        const settlement = settlementFetch.data.response.order_income;

        const totalSubtotal = Number(settlement.cost_of_goods_sold);
        const totalSettlement = Number(
          settlement.escrow_amount_after_adjustment
        );
        const totalFees = totalSubtotal - totalSettlement;

        toSettleOrders.push({
          orderId: order.ORDER_ID,
          settlementAmount: totalSettlement,
          settlementFees: totalFees,
        });
      }

      if (toSettleOrders.length === 0) {
        console.log("No Shopee orders to settle. Ending job...");
        return res.status(200).json({ ok: true, message: "success" });
      }

      const updateOrders = `
      UPDATE Orders_Shopee
      SET 
          NET_SETTLEMENT_AMOUNT = CASE ORDER_ID
              ${toSettleOrders
                .map(
                  (order) =>
                    `WHEN '${order.orderId}' THEN ${order.settlementAmount}`
                )
                .join(" ")}
              ELSE NET_SETTLEMENT_AMOUNT
          END,
          NET_SETTLEMENT_FEES = CASE ORDER_ID
              ${toSettleOrders
                .map(
                  (order) =>
                    `WHEN '${order.orderId}' THEN ${order.settlementFees}`
                )
                .join(" ")}
              ELSE NET_SETTLEMENT_FEES
          END,
          SETTLED = 1
      WHERE ORDER_ID IN (${toSettleOrders
        .map((order) => `'${order.orderId}'`)
        .join(", ")});`;
      await inv_connection.query(updateOrders);

      console.log("SHOPEE ORDERS WERE SETTLED");
      return res.status(200).json({ ok: true, message: "success" });
    } finally {
      def_connection.release();
      inv_connection.release();
    }
  } catch (error) {
    console.log(error.toString());
    return res.status(400).json({ ok: false, message: "fail" });
  }
}

async function getShopeeOrderSettlement(secrets, orderId) {
  const path = "/api/v2/payment/get_escrow_detail";
  const params = {
    order_sn: orderId,
  };

  return shopeeGetAPIRequest(secrets, path, params);
}
