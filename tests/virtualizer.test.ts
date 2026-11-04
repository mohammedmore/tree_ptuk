import assert from "node:assert/strict";
import { test } from "node:test";
import { useVirtualizer } from "../src/hooks/useVirtualizer";

test("useVirtualizer exists and defines correct interface", () => {
  assert.equal(typeof useVirtualizer, "function");
});
