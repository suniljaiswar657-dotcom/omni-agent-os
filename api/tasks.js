const { response, authenticate, supabaseRequest } = require("./_lib/supabase");
const { validateTaskInput } = require("./_lib/tasks");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const auth = await authenticate(req, res);
  if (!auth) return;

  try {
    if (req.method === "GET") {
      const { response: upstream, data } = await supabaseRequest(
        "omni_tasks?select=id,title,description,agent,status,created_at,updated_at&order=created_at.desc&limit=100",
        auth.token
      );
      if (!upstream.ok) return response(res, upstream.status, { error: "Could not load tasks" });
      return response(res, 200, { tasks: data || [] });
    }

    if (req.method === "POST") {
      const validation = validateTaskInput(req.body);
      if (validation.error) return response(res, 400, { error: validation.error });
      const { title, description, agent } = validation.value;
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
  } catch (error) {
    console.error("Task API failure:", error);
    return response(res, 502, { error: "Task service temporarily unavailable", code: "TASK_SERVICE_UNAVAILABLE" });
  }
};
