const { response, authenticate, supabaseRequest } = require("../_lib/supabase");
const { isValidTaskId, canTransition, isSupportedNextStatus } = require("../_lib/tasks");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const auth = await authenticate(req, res);
  if (!auth) return;

  const id = req.query?.id;
  if (!isValidTaskId(id)) return response(res, 400, { error: "Invalid task ID" });
  if (req.method !== "PATCH") {
    res.setHeader("Allow", "PATCH");
    return response(res, 405, { error: "Method not allowed" });
  }

  const nextStatus = req.body?.status;
  if (!isSupportedNextStatus(nextStatus)) {
    return response(res, 400, { error: "Unsupported status transition" });
  }

  try {
    // RLS ensures this lookup and update only affect the authenticated user's rows.
    const { response: currentResponse, data: currentRows } = await supabaseRequest(
      `omni_tasks?select=id,status&id=eq.${encodeURIComponent(id)}&limit=1`,
      auth.token
    );
    if (!currentResponse.ok) return response(res, currentResponse.status, { error: "Could not read task" });
    const current = Array.isArray(currentRows) ? currentRows[0] : null;
    if (!current) return response(res, 404, { error: "Task not found" });
    if (!canTransition(current.status, nextStatus)) {
      return response(res, 409, { error: `Cannot move task from ${current.status} to ${nextStatus}` });
    }

    const { response: updateResponse, data } = await supabaseRequest(
      `omni_tasks?id=eq.${encodeURIComponent(id)}`,
      auth.token,
      { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status: nextStatus }) }
    );
    if (!updateResponse.ok) return response(res, updateResponse.status, { error: "Could not update task" });
    const task = Array.isArray(data) ? data[0] : data;
    if (!task) return response(res, 409, { error: "Task changed before update; refresh and retry" });
    return response(res, 200, { task });
  } catch (error) {
    console.error("Task update failure:", error);
    return response(res, 502, { error: "Task service temporarily unavailable", code: "TASK_SERVICE_UNAVAILABLE" });
  }
};
