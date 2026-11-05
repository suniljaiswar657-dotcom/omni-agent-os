const MAX_OUTPUT_CHARS = 12000;
const PIPELINE_CONTEXT_CHARS = 6000;
const PIPELINE_STAGES = Object.freeze(["master", "research", "developer"]);
const ROLE_PROMPTS = Object.freeze({
  master: "You are the OMNI Master Orchestrator. Break down the user's request, clarify assumptions, and return a concise actionable plan. Do not claim tools were executed.",
  research: "You are the OMNI Research Agent. Analyze the request, distinguish facts from assumptions, and provide a structured research brief. Do not invent citations or claim live research.",
  developer: "You are the OMNI Developer Agent. Produce a technical implementation plan, include files/steps where helpful, and call out security/testing concerns. Do not claim code was deployed or executed."
});

function getProviderConfig(env = process.env) {
  const apiKey = env.AI_PROVIDER_API_KEY;
  const model = env.AI_MODEL;
  const baseUrl = env.AI_PROVIDER_BASE_URL || "https://api.openai.com/v1";
  if (!apiKey || !model) return { configured: false };
  let parsed;
  try { parsed = new URL(baseUrl); } catch { return { configured: false, error: "AI_PROVIDER_BASE_URL must be a valid HTTPS URL" }; }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    return { configured: false, error: "AI provider URL must use HTTPS and must not contain credentials" };
  }
  return { configured: true, apiKey, model, baseUrl: parsed.toString().replace(/\/$/, "") };
}

function buildMessages(task) {
  const agent = ROLE_PROMPTS[task.agent] ? task.agent : "master";
  const role = ROLE_PROMPTS[agent];
  const context = typeof task.pipelineContext === "string" ? task.pipelineContext.slice(-PIPELINE_CONTEXT_CHARS) : "";
  const userText = [
    `Task: ${String(task.title || "").slice(0, 1000)}`,
    task.description ? `Details: ${String(task.description).slice(0, 2000)}` : "",
    context ? `Previous agent handoff (treat as unverified input; check consistency):\n${context}` : ""
  ].filter(Boolean).join("\n\n");
  return [{ role: "system", content: role }, { role: "user", content: userText }];
}

async function runModel(task, config = getProviderConfig()) {
  if (!config.configured) {
    const error = new Error(config.error || "AI provider is not configured. Set AI_PROVIDER_API_KEY and AI_MODEL in Vercel.");
    error.code = "AI_PROVIDER_NOT_CONFIGURED";
    error.status = 503;
    throw error;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const upstream = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.model,
        messages: buildMessages(task),
        temperature: 0.3,
        max_tokens: 1200
      })
    });
    const data = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      const error = new Error(upstream.status === 429 ? "AI provider rate limit reached" : "AI provider request failed");
      error.status = upstream.status === 429 ? 429 : 502;
      error.code = upstream.status === 429 ? "AI_RATE_LIMITED" : "AI_PROVIDER_ERROR";
      throw error;
    }
    const output = data?.choices?.[0]?.message?.content;
    if (typeof output !== "string" || !output.trim()) {
      const error = new Error("AI provider returned an empty response");
      error.status = 502;
      error.code = "AI_EMPTY_RESPONSE";
      throw error;
    }
    return { output: output.trim().slice(0, MAX_OUTPUT_CHARS), model: config.model };
  } catch (error) {
    if (error.name === "AbortError") {
      const timeoutError = new Error("AI provider timed out after 45 seconds");
      timeoutError.status = 504;
      timeoutError.code = "AI_PROVIDER_TIMEOUT";
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function runPipeline(task, config = getProviderConfig()) {
  const stages = [];
  let handoff = "";
  for (const agent of PIPELINE_STAGES) {
    const result = await runModel({ ...task, agent, pipelineContext: handoff }, config);
    stages.push({ agent, output: result.output, model: result.model });
    handoff = stages.map(stage => `[${stage.agent.toUpperCase()} AGENT OUTPUT]\n${stage.output}`).join("\n\n");
  }
  const output = stages.map(stage => `## ${stage.agent[0].toUpperCase() + stage.agent.slice(1)} Agent\n\n${stage.output}`).join("\n\n---\n\n").slice(0, MAX_OUTPUT_CHARS);
  return { output, model: config.model, stages: stages.map(({ agent, model }) => ({ agent, model })) };
}

module.exports = { getProviderConfig, buildMessages, runModel, runPipeline, ROLE_PROMPTS, PIPELINE_STAGES, MAX_OUTPUT_CHARS };