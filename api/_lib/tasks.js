const AGENTS = new Set(["master", "research", "developer"]);
const TRANSITIONS = Object.freeze({
  queued: ["in_progress"],
  in_progress: ["awaiting_approval"],
  awaiting_approval: ["completed", "rejected"]
});
const TASK_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateTaskInput(body = {}) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const agent = typeof body.agent === "string" ? body.agent : "master";
  if (!title || title.length > 100) return { error: "Title must be 1-100 characters" };
  if (description.length > 2000) return { error: "Description must be at most 2000 characters" };
  if (!AGENTS.has(agent)) return { error: "Unknown agent" };
  return { value: { title, description, agent } };
}

function isValidTaskId(id) {
  return typeof id === "string" && TASK_ID_PATTERN.test(id);
}

function canTransition(currentStatus, nextStatus) {
  return Boolean(TRANSITIONS[currentStatus]?.includes(nextStatus));
}

function isSupportedNextStatus(status) {
  return Object.values(TRANSITIONS).some(statuses => statuses.includes(status));
}

module.exports = { validateTaskInput, isValidTaskId, canTransition, isSupportedNextStatus, TRANSITIONS };
