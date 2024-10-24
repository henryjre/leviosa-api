import { CronJob } from "cron";
import fetch from "node-fetch";

const hostUrl = "https://seal-app-2toa6.ondigitalocean.app";

function createCronJob(cronTime, endpoint) {
  return new CronJob(
    cronTime,
    async () => {
      try {
        const response = await getRequest(endpoint);
        console.log(`Job for ${endpoint} completed:`, response);
      } catch (error) {
        console.error(`Error executing job for ${endpoint}:`, error);
      }
    },
    null,
    true, // Start the job right away
    "Asia/Manila"
  );
}

// createCronJob("30 */3 * * *", "/api/v1/jobs/refreshShopeeTokens"); //refreshing shopee tokens
// createCronJob("0 0 */5 * * *", "/api/v1/jobs/refreshTiktokTokens"); //refreshing tiktok tokens
// createCronJob("0 0 */29 * * *", "/api/v1/jobs/refreshLazadaTokens"); //refreshing lazada tokens

// createCronJob("10 */4 * * *", "/api/v1/jobs/settleShopee"); //settle shopee orders
// createCronJob("20 */4 * * *", "/api/v1/jobs/settleLazada"); //settle lazada orders
// createCronJob("0 0 * * *", "/api/v1/jobs/settleTiktokOrders"); //settle tiktok orders

// createCronJob("*/15 * * * *", "/api/v1/jobs/runDiscordNotif"); //running discord notifications
// createCronJob("0 */2 * * *", "/api/v1/jobs/refreshConnections"); //refreshing mysql connections

async function getRequest(endpoint) {
  const options = {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  };

  const url = hostUrl + endpoint;

  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const responseData = await response.json();
    return responseData;
  } catch (error) {
    console.error(`Error fetching data from ${url}:`, error);
    throw error; // Rethrow to handle it in the cron job
  }
}

console.log("cron is running...");
