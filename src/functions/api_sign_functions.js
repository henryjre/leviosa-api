import crypto from "crypto";

//SIGN SHOPEE API REQUESTS
export function signShopeeRequest(input, partnerKey) {
  const inputBuffer = Buffer.from(input, "utf-8");
  const keyBuffer = Buffer.from(partnerKey, "utf-8");
  const hmac = crypto.createHmac("sha256", keyBuffer);
  hmac.update(inputBuffer);

  return hmac.digest("hex");
}

//SIGN LAZADA API REQUESTS
export function signLazadaRequest(apiEndpoint, params, appSecret) {
  const signature = generateSignature(apiEndpoint, params, appSecret);
  return signature;

  function generateSignature(apiName, parameters, key) {
    const filteredParams = Object.entries(parameters)
      .filter(([key, value]) => typeof value !== "object" && key !== "sign")
      .sort((a, b) => a[0].localeCompare(b[0])); // Sort parameters by name

    const concatenatedString = filteredParams
      .map(([key, value]) => `${key}${value}`)
      .join("");

    const stringToSign = `${apiName}${concatenatedString}`;
    const hmac = crypto.createHmac("sha256", key);
    hmac.update(stringToSign, "utf8");

    const hexSignature = hmac.digest("hex").toUpperCase();
    return hexSignature;
  }
}

//SIGN TIKTOK API REQUESTS
export function signTiktokRequest(reqOptions, appSecret) {
  const signature = CalSign(reqOptions, appSecret);
  return signature;

  function CalSign(req, secret) {
    const { url, headers, body } = req;
    const path = url.split("?")[0];
    const queryString = url.split("?")[1] || "";

    const queryParameters = Object.fromEntries(
      new URLSearchParams(queryString)
    );
    const keys = Object.keys(queryParameters).filter(
      (k) => k !== "sign" && k !== "access_token"
    );
    keys.sort();

    let input = keys.map((key) => key + queryParameters[key]).join("");
    input = path + input;

    if (body) {
      input += JSON.stringify(body);
    }

    input = secret + input + secret;

    return generateSHA256(input, secret);
  }

  function generateSHA256(input, secret) {
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(input);
    return hmac.digest("hex");
  }
}
