const { response, authenticate, supabaseRequest } = require("../_lib/supabase");
const { isValidTaskId } = require("../_lib/tasks");
const { getProviderConfig, runModel } = require("../_lib/agent-runtime");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const auth = await authenticate(req, res);
  if (!auth) return;
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return response(res, 405, { error: "Method not allowed" });
  }

  const taskId = req.body?.taskId;
  if (!isValidTaskId(taskId)) return response(res, 400, { error: "Valid taskId is required" });
  const provider = getProviderConfig();
  if (!provider.configured) {
    return response(res, 503, {
      error: provider.error || "AI provider is not configured",
      code: "AI_PROVIDER_NOT_CONFIGURED",
      setup: "Set AI_PROVIDER_API_KEY and AI_MODEL in Vercel server-side environment variables."
    });
  }

  try {
    const { response: readResponse, data: rows } = await supabaseRequest(
      `omni_tasks?select=id,title,description,agent,status&id=eq.${encodeURIComponent(taskId)}&limit=1`,
      auth.token
    );
    if (!readResponse.ok) return response(res, readResponse.status, { error: "Could not load task" });
    const task = Array.isArray(rows) ? rows[0] : null;
    if (!task) return response(res, 404, { error: "Task not found" });
    if (task.status !== "queued") return response(res, 409, { error: "Only queued tasks can be run", status: task.status });

    // Atomic compare-and-set: a task can only be claimed once while queued.
    const { response: claimResponse, data: claimedRows } = await supabaseRequest(
      `omni_tasks?id=eq.${encodeURIComponent(taskId)}&status=eq.queued`,
      auth.token,
      { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status: "in_progress", run_started_at: new Date().toISOString(), run_error: null }) }
    );
    if (!claimResponse.ok) return response(res, claimResponse.status, { error: "Could not claim task for execution" });
    if (!Array.isArray(claimedRows) || !claimedRows[0]) {
      return response(res, 409, { error: "Task was claimed by another request; refresh and retry" });
    }

    try {
      const result = await runModel(task, provider);
      const { response: finishResponse, data: finishedRows } = await supabaseRequest(
        `omni_tasks?id=eq.${encodeURIComponent(taskId)}&status=eq.in_progress`,
        auth.token,
        { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({
          status: "awaiting_approval",
          agent_output: result.output,
          agent_model: result.model,
          run_completed_at: new Date().toISOString(),
          run_error: null
        }) }
      );
      if (!finishResponse.ok) throw new Error("AI finished, but task result could not be saved");
      if (!Array.isArray(finishedRows) || !finishedRows[0]) {
        return response(res, 409, { error: "Task state changed while the AI was running. Refresh before proceeding." });
      }
      return response(res, 200, { task: finishedRows[0], output: result.output, model: result.model, requiresApproval: true });
    } catch (error) {
      const safeMessage = error.code || "AI_RUN_FAILED";
      await supabaseRequest(
        `omni_tasks?id=eq.${encodeURIComponent(taskId)}&status=eq.in_progress`,
        auth.token,
        { method: "PATCH", body: JSON.stringify({ status: "queued", run_error: safeMessage }) }
      ).catch(() => null);
      console.error("OMNI agent run failed:", error.code || error.message);
      return response(res, error.status || 502, {
        error: error.status === 503 ? error.message : "AI agent run failed. The task was returned to the queue.",
        code: error.code || "AI_RUN_FAILED"
      });
    }
  } catch (error) {
    console.error("Agent run API failure:", error);
    return response(res, 502, { error: "Agent runtime temporarily unavailable", code: "AGENT_RUNTIME_UNAVAILABLE" });
  }
};
