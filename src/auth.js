function checkAuthentication(req) {
  const providedApiKey = req.headers["x-api-key"];
  if (providedApiKey && providedApiKey === process.env.api_key) {
    return true;
  }
  return false;
}

export function authenticate(req, res, next) {
  const isAuthenticated = checkAuthentication(req);

  if (isAuthenticated) {
    next();
  } else {
    return res.status(401).json({ message: "Unauthorized" });
  }
}
