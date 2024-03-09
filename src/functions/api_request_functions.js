import {
  signLazadaRequest,
  signShopeeRequest,
  signTiktokRequest,
} from "./api_sign_functions.js";
import fetch from "node-fetch";

export async function tiktokGetAPIRequest(secrets, path, queryParams) {
  const host = "https://open-api.tiktokglobalshop.com";
  const timest = Math.floor(Date.now() / 1000);

  const accessToken = secrets.ACCESS_TOKEN;
  const appKey = secrets.APP_KEY;
  const appSecret = secrets.APP_SECRET;
  const shopCipher = secrets.SHOP_CIPHER;

  const params = {
    app_key: appKey,
    shop_cipher: shopCipher,
    timestamp: timest,
    ...queryParams,
  };

  let parsedParams = Object.entries(params)
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  const urlPath = `${path}?${parsedParams}`;
  const signReqOptions = {
    url: urlPath,
    headers: { "content-type": "application/json" },
  };

  const signature = signTiktokRequest(signReqOptions, appSecret);

  parsedParams += `&sign=${signature}`;

  const url = `${host}${path}?${parsedParams}`;

  try {
    const options = {
      method: "GET",
      headers: {
        "content-type": "application/json",
        "x-tts-access-token": accessToken,
      },
    };
    const response = await fetch(url, options);
    const responseData = await response.json();

    if (responseData.code !== 0) {
      return { ok: false, data: responseData };
    } else {
      return { ok: true, data: responseData };
    }
  } catch (error) {
    console.log("TIKTOK FETCH ERROR: ", error);
    return { ok: false, data: null, error: error.toString() };
  }
}

export async function tiktokPostAPIRequest(
  secrets,
  path,
  payload,
  queryParams
) {
  const host = "https://open-api.tiktokglobalshop.com";
  const timest = Math.floor(Date.now() / 1000);

  const accessToken = secrets.ACCESS_TOKEN;
  const appKey = secrets.APP_KEY;
  const appSecret = secrets.APP_SECRET;
  const shopCipher = secrets.SHOP_CIPHER;

  const params = {
    app_key: appKey,
    shop_cipher: shopCipher,
    timestamp: timest,
  };

  if (queryParams) {
    Object.assign(params, queryParams);
  }

  let parsedParams = Object.entries(params)
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  const urlPath = `${path}?${parsedParams}`;
  const signReqOptions = {
    url: urlPath,
    headers: { "content-type": "application/json" },
    body: payload,
  };

  const signature = signTiktokRequest(signReqOptions, appSecret);

  parsedParams += `&sign=${signature}`;

  const url = `${host}${path}?${parsedParams}`;

  try {
    const options = {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-tts-access-token": accessToken,
      },
      body: JSON.stringify(payload),
    };
    const response = await fetch(url, options);
    const responseData = await response.json();

    if (responseData.code !== 0) {
      return { ok: false, data: responseData };
    } else {
      return { ok: true, data: responseData };
    }
  } catch (error) {
    console.log("TIKTOK FETCH ERROR: ", error);
    return { ok: false, data: null, error: error.toString() };
  }
}

export async function lazadaGetAPIRequest(secrets, path, queryParams) {
  const accessToken = secrets.ACCESS_TOKEN;
  const appKey = secrets.APP_KEY;
  const appSecret = secrets.APP_SECRET;
  const currentTimestamp = Date.now();

  const host = "https://api.lazada.com.ph/rest";
  const params = {
    timestamp: currentTimestamp,
    access_token: accessToken,
    sign_method: "sha256",
    app_key: appKey,
    ...queryParams,
  };

  let parsedParams = Object.entries(params)
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  const signature = signLazadaRequest(path, params, appSecret);
  parsedParams += `&sign=${signature}`;

  const url = `${host}${path}?${parsedParams}`;

  try {
    const options = {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    };
    const response = await fetch(url, options);
    const responseData = await response.json();

    if (responseData.code === 0) {
      return { ok: true, data: responseData };
    } else {
      return { ok: false, data: responseData, error: responseData.error };
    }
  } catch (error) {
    console.log("LAZADA FETCH ERROR: ", error);
    return { ok: false, data: null, error: error.toString() };
  }
}

export async function lazadaPostAPIRequest(secrets, path, payload) {
  const accessToken = secrets.ACCESS_TOKEN;
  const appKey = secrets.APP_KEY;
  const appSecret = secrets.APP_SECRET;
  const currentTimestamp = Date.now();

  const host = "https://api.lazada.com.ph/rest";
  const params = {
    timestamp: currentTimestamp,
    access_token: accessToken,
    sign_method: "sha256",
    app_key: appKey,
  };

  let parsedParams = Object.entries(params)
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  const signature = signLazadaRequest(path, params, appSecret);
  parsedParams += `&sign=${signature}`;

  const url = `${host}${path}?${parsedParams}`;

  try {
    const options = {
      method: "GET",
      headers: {
        "Content-Type": "application/xml",
      },
      body: JSON.stringify(payload),
    };
    const response = await fetch(url, options);
    const responseData = await response.json();

    if (responseData.code == 0) {
      return { ok: true, data: responseData };
    } else {
      return { ok: false, data: responseData, error: responseData.error };
    }
  } catch (error) {
    console.log("LAZADA FETCH ERROR: ", error);
    return { ok: false, data: null, error: error.toString() };
  }
}

export async function shopeeGetAPIRequest(secrets, path, params) {
  const host = "https://partner.shopeemobile.com";
  const timest = Math.floor(Date.now() / 1000);

  const partnerKey = secrets.APP_KEY;
  const partnerId = Number(secrets.PARTNER_ID);
  const accessToken = secrets.ACCESS_TOKEN;
  const shopId = Number(secrets.SHOP_ID);

  const baseString = `${partnerId}${path}${timest}${accessToken}${shopId}`;
  const sign = signShopeeRequest(baseString, partnerKey);

  const parameters = {
    partner_id: partnerId,
    timestamp: timest,
    access_token: accessToken,
    shop_id: shopId,
    sign: sign,
    ...params,
  };

  const url = `${host}${path}?${Object.entries(parameters)
    .map(([key, value]) => `${key}=${value}`)
    .join("&")}`;

  try {
    const options = {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    };
    const response = await fetch(url, options);
    const responseData = await response.json();

    if (!responseData.error) {
      return { ok: true, data: responseData };
    } else {
      return { ok: false, data: responseData, error: responseData.error };
    }
  } catch (error) {
    console.log("SHOPEE FETCH ERROR: ", error);
    return { ok: false, data: null, error: error.toString() };
  }
}

export async function shopeePostAPIRequest(secrets, path, payload) {
  const host = "https://partner.shopeemobile.com";
  const timest = Math.floor(Date.now() / 1000);

  const partnerKey = secrets.APP_KEY;
  const partnerId = Number(secrets.PARTNER_ID);
  const accessToken = secrets.ACCESS_TOKEN;
  const shopId = Number(secrets.SHOP_ID);

  const baseString = `${partnerId}${path}${timest}${accessToken}${shopId}`;
  const sign = signShopeeRequest(baseString, partnerKey);

  const parameters = {
    partner_id: partnerId,
    timestamp: timest,
    access_token: accessToken,
    shop_id: shopId,
    sign: sign,
  };

  const url = `${host}${path}?${Object.entries(parameters)
    .map(([key, value]) => `${key}=${value}`)
    .join("&")}`;

  try {
    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    };
    const response = await fetch(url, options);
    const responseData = await response.json();

    if (!responseData.error) {
      return { ok: true, data: responseData };
    } else {
      return { ok: false, data: responseData, error: responseData.error };
    }
  } catch (error) {
    console.log("SHOPEE FETCH ERROR: ", error);
    return { ok: false, data: null, error: error.toString() };
  }
}
