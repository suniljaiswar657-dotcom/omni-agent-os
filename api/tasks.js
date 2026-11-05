const { response, authenticate, supabaseRequest } = require("./_lib/supabase");

const AGENTS = new Set(["master", "research", "developer"]);
const MAX_TITLE = 100;
const MAX_DESCRIPTION = 2000;

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const auth = await authenticate(req, res);
  if (!auth) return;

  if (req.method === "GET") {
    const { response: upstream, data } = await supabaseRequest(
      "omni_tasks?select=id,title,description,agent,status,created_at,updated_at&order=created_at.desc&limit=100",
      auth.token
    );
    if (!upstream.ok) return response(res, upstream.status, { error: "Could not load tasks" });
    return response(res, 200, { tasks: data || [] });
  }

  if (req.method === "POST") {
    const body = req.body || {};
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const agent = typeof body.agent === "string" ? body.agent : "master";

    if (!title || title.length > MAX_TITLE) {
      return response(res, 400, { error: `Title must be 1-${MAX_TITLE} characters` });
    }
    if (description.length > MAX_DESCRIPTION) {
      return response(res, 400, { error: `Description must be at most ${MAX_DESCRIPTION} characters` });
    }
    if (!AGENTS.has(agent)) return response(res, 400, { error: "Unknown agent" });

    const { response: upstream, data } = await supabaseRequest("omni_tasks", auth.token, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ title, description, agent, status: "queued" })
    });
    if (!upstream.ok) return response(res, upstream.status, { error: "Could not create task" });
    return response(res, 201, { task: Array.isArray(data) ? data[0] : data });
  }

  res.setHeader("Allow", "GET, POST");
  return response(res, 405, { error: "Method not allowed" });
};