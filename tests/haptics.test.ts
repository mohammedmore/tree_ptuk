import assert from "node:assert/strict";
import { test } from "node:test";
import { isHapticsSupported, triggerHaptic } from "../src/utils/haptics";

test("isHapticsSupported returns boolean safely without crashing", () => {
  const supported = isHapticsSupported();
  assert.equal(typeof supported, "boolean");
});

test("triggerHaptic executes gracefully even in environments without vibrator", () => {
  const result = triggerHaptic("success");
  assert.equal(typeof result, "boolean");
});
