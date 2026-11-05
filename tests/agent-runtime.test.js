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
