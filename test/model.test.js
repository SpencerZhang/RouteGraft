import test from "node:test";
import assert from "node:assert/strict";
import { normalizeState } from "../src/model.js";

test("normalization preserves the monotonic save revision", () => {
  const state = normalizeState({
    version: 1,
    revision: 123456,
    masterEnabled: true,
    selectedProfileId: "dev",
    profiles: [
      { id: "dev", name: "Dev", enabled: true, redirects: [], headers: [] },
    ],
  });

  assert.equal(state.revision, 123456);
});

test("legacy saved state receives a safe baseline revision", () => {
  const state = normalizeState({
    version: 1,
    profiles: [
      { id: "dev", name: "Dev", enabled: false, redirects: [], headers: [] },
    ],
  });

  assert.equal(state.revision, 0);
});
