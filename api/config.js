module.exports = function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json");
  const url = process.env.SUPABASE_URL || "";
  const anonKey = process.env.SUPABASE_ANON_KEY || "";
  if (!url || !anonKey) {
    return res.status(200).json({ configured: false });
  }
  // Supabase anon/publishable key is designed for client use; database access
  // remains protected by Auth + RLS. Never return a service-role key here.
  return res.status(200).json({ configured: true, url, anonKey });
};