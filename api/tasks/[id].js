const { response, authenticate, supabaseRequest } = require("../_lib/supabase");

const TRANSITIONS = {
  queued: ["in_progress"],
  in_progress: ["awaiting_approval"],
  awaiting_approval: ["completed", "rejected"]
};

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const auth = await authenticate(req, res);
  if (!auth) return;

  const id = req.query?.id;
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) {
    return response(res, 400, { error: "Invalid task ID" });
  }

  if (req.method !== "PATCH") {
    res.setHeader("Allow", "PATCH");
    return response(res, 405, { error: "Method not allowed" });
  }

  const nextStatus = req.body?.status;
  if (!Object.values(TRANSITIONS).some(states => states.includes(nextStatus))) {
    return response(res, 400, { error: "Unsupported status transition" });
  }

  // Fetch the current task through the caller's JWT; RLS limits access to their own rows.
  const { response: currentResponse, data: currentRows } = await supabaseRequest(
    `omni_tasks?select=id,status&id=eq.${encodeURIComponent(id)}&limit=1`,
    auth.token
  );
  if (!currentResponse.ok) return response(res, currentResponse.status, { error: "Could not read task" });
  const current = Array.isArray(currentRows) ? currentRows[0] : null;
  if (!current) return response(res, 404, { error: "Task not found" });

  if (!TRANSITIONS[current.status]?.includes(nextStatus)) {
    return response(res, 409, { error: `Cannot move task from ${current.status} to ${nextStatus}` });
  }

  const { response: updateResponse, data } = await supabaseRequest(
    `omni_tasks?id=eq.${encodeURIComponent(id)}`,
    auth.token,
    { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status: nextStatus }) }
  );
  if (!updateResponse.ok) return response(res, updateResponse.status, { error: "Could not update task" });
  return response(res, 200, { task: Array.isArray(data) ? data[0] : data });
};