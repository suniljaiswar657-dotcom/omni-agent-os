const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

function response(res, status, body) {
  res.status(status).json(body);
}

function configReady() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

async function authenticate(req, res) {
  if (!configReady()) {
    response(res, 503, { error: "Backend is not configured", code: "SUPABASE_NOT_CONFIGURED" });
    return null;
  }

  const authorization = req.headers.authorization || "";
  if (!authorization.startsWith("Bearer ")) {
    response(res, 401, { error: "Sign in required", code: "AUTH_REQUIRED" });
    return null;
  }

  const token = authorization.slice(7).trim();
  if (!token) {
    response(res, 401, { error: "Invalid authorization token", code: "AUTH_INVALID" });
    return null;
  }

  try {
    const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` }
    });
    if (!userResponse.ok) {
      response(res, 401, { error: "Session is invalid or expired", code: "AUTH_INVALID" });
      return null;
    }
    const user = await userResponse.json();
    if (!user?.id) {
      response(res, 401, { error: "Could not verify user", code: "AUTH_INVALID" });
      return null;
    }
    return { user, token };
  } catch {
    response(res, 502, { error: "Authentication service unavailable", code: "AUTH_SERVICE_UNAVAILABLE" });
    return null;
  }
}

async function supabaseRequest(path, token, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { response, data };
}

module.exports = { response, authenticate, supabaseRequest };