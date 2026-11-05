const test = require("node:test");
const assert = require("node:assert/strict");
const { validateTaskInput, isValidTaskId, canTransition, isSupportedNextStatus } = require("../api/_lib/tasks");

test("validates and trims input", () => {
  assert.deepEqual(validateTaskInput({title:" Plan ",description:" notes ",agent:"research"}).value,
    {title:"Plan",description:"notes",agent:"research"});
});
test("rejects invalid title, description, and agent", () => {
  assert.ok(validateTaskInput({title:" "}).error);
  assert.ok(validateTaskInput({title:"x".repeat(101)}).error);
  assert.ok(validateTaskInput({title:"ok",description:"x".repeat(2001)}).error);
  assert.ok(validateTaskInput({title:"ok",agent:"unknown"}).error);
});
test("validates UUID format", () => {
  assert.equal(isValidTaskId("123e4567-e89b-12d3-a456-426614174000"),true);
  assert.equal(isValidTaskId("bad-id"),false);
});
test("allows only sequential workflow transitions", () => {
  assert.equal(canTransition("queued","in_progress"),true);
  assert.equal(canTransition("in_progress","awaiting_approval"),true);
  assert.equal(canTransition("awaiting_approval","completed"),true);
  assert.equal(canTransition("queued","completed"),false);
  assert.equal(canTransition("completed","queued"),false);
});
test("rejects unsupported statuses", () => {
  assert.equal(isSupportedNextStatus("completed"),true);
  assert.equal(isSupportedNextStatus("failed"),false);
});
