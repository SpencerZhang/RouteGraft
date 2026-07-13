import test from "node:test";
import assert from "node:assert/strict";
import { importConfiguration } from "../src/import.js";

test("imports a RouteGraft export", () => {
  const state = importConfiguration({
    version: 1,
    masterEnabled: true,
    selectedProfileId: "dev",
    profiles: [
      { id: "dev", name: "Development", enabled: true, redirects: [], headers: [] },
    ],
  });

  assert.equal(state.profiles[0].name, "Development");
  assert.equal(state.profiles[0].enabled, true);
});

test("converts a common legacy ModHeader profile shape", () => {
  const state = importConfiguration({
    profiles: [
      {
        title: "Legacy dev",
        active: true,
        requestHeaders: [{ name: "X-Test", value: "yes" }],
        urlReplacements: [
          { from: "https://api.example.com", to: "http://127.0.0.1:8080" },
        ],
      },
    ],
  });

  assert.equal(state.profiles[0].name, "Legacy dev");
  assert.equal(state.profiles[0].redirects[0].target, "http://127.0.0.1:8080");
  assert.equal(state.profiles[0].headers[0].header, "X-Test");
});
