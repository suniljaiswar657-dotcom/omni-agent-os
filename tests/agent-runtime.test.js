const test = require("node:test");
const assert = require("node:assert/strict");
const { getProviderConfig, buildMessages, runModel } = require("../api/_lib/agent-runtime");

test("provider config requires key and model", () => {
  assert.equal(getProviderConfig({}).configured, false);
  assert.equal(getProviderConfig({AI_PROVIDER_API_KEY:"secret"}).configured, false);
});
test("provider config normalizes trailing slash and keeps secret server-side", () => {
  const config = getProviderConfig({AI_PROVIDER_API_KEY:"test-secret",AI_MODEL:"test-model",AI_PROVIDER_BASE_URL:"https://provider.example/v1/"});
  assert.equal(config.configured, true);
  assert.equal(config.baseUrl, "https://provider.example/v1");
  assert.equal(config.model, "test-model");
  assert.equal(config.apiKey, "test-secret");
});
test("rejects insecure provider URLs", () => {
  const config = getProviderConfig({AI_PROVIDER_API_KEY:"x",AI_MODEL:"m",AI_PROVIDER_BASE_URL:"http://provider.example"});
  assert.equal(config.configured, false);
  assert.match(config.error, /HTTPS/);
});
test("agent prompts are role-specific and task content is included", () => {
  const messages = buildMessages({agent:"developer",title:"Build API",description:"Add tests"});
  assert.equal(messages.length, 2);
  assert.match(messages[0].content, /Developer Agent/);
  assert.match(messages[1].content, /Build API/);
  assert.match(messages[1].content, /Add tests/);
});
test("runModel refuses to call provider when not configured", async () => {
  await assert.rejects(() => runModel({title:"Test",agent:"master"}, {configured:false}), /AI provider is not configured/);
});


test("pipeline stages are ordered Master, Research, Developer", async () => {
  const { PIPELINE_STAGES } = require("../api/_lib/agent-runtime");
  assert.deepEqual(PIPELINE_STAGES, ["master", "research", "developer"]);
});

test("pipeline passes earlier agent output into the next handoff", async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    calls.push(body.messages[1].content);
    const stage = calls.length;
    return {
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: `Stage ${stage} result` } }] })
    };
  };
  try {
    const { runPipeline } = require("../api/_lib/agent-runtime");
    const result = await runPipeline(
      { title: "Create a safe feature", description: "Include tests" },
      { configured: true, apiKey: "test-key", model: "mock-model", baseUrl: "https://mock.example/v1" }
    );
    assert.equal(calls.length, 3);
    assert.match(calls[0], /Create a safe feature/);
    assert.match(calls[1], /Stage 1 result/);
    assert.match(calls[2], /Stage 1 result/);
    assert.match(calls[2], /Stage 2 result/);
    assert.deepEqual(result.stages.map(s => s.agent), ["master", "research", "developer"]);
    assert.match(result.output, /## Master Agent/);
    assert.match(result.output, /## Developer Agent/);
  } finally {
    global.fetch = originalFetch;
  }
});

test("pipeline stops if one agent stage fails", async () => {
  const originalFetch = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls++;
    return { ok: false, status: 429, json: async () => ({}) };
  };
  try {
    const { runPipeline } = require("../api/_lib/agent-runtime");
    await assert.rejects(
      () => runPipeline({ title: "test" }, { configured: true, apiKey: "x", model: "m", baseUrl: "https://mock.example/v1" }),
      error => error.code === "AI_RATE_LIMITED"
    );
    assert.equal(calls, 1);
  } finally {
    global.fetch = originalFetch;
  }
});
