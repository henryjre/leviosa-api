import fetch from "node-fetch";

const rpcUrl = "https://omnilert.odoo.com/jsonrpc";

export async function jsonRpc(method, params) {
  const data = {
    jsonrpc: "2.0",
    method: method,
    params: params,
    id: Math.floor(Math.random() * 1000000000),
  };

  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  };

  try {
    const response = await fetch(rpcUrl, options);
    const responseData = await response.json();

    if (responseData.error) {
      throw new Error(responseData.error.message || "Unknown error");
    }

    return responseData;
  } catch (error) {
    console.error("Error in jsonRpc:", error);
    throw error;
  }
}

export async function odooLogin() {
  try {
    // Log in to the given database
    const uid = await jsonRpc("call", {
      service: "common",
      method: "login",
      args: [
        process.env.odoo_db,
        process.env.odoo_username,
        process.env.odoo_password,
      ],
    });

    console.log("Logged in as UID:", uid.result);

    return uid.result;
  } catch (error) {
    console.error("Login Error:", error);
    return null;
  }
}
