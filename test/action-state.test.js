import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createActionState } from "../src/action-state.js";

test("toolbar badge stays hidden in every state", () => {
  assert.equal(createActionState(true).badgeText, "");
  assert.equal(createActionState(false).badgeText, "");
});

test("toolbar icon switches between active and paused assets", () => {
  assert.deepEqual(createActionState(true).icon, {
    16: "assets/icons/icon-16.png",
    32: "assets/icons/icon-32.png",
  });
  assert.deepEqual(createActionState(false).icon, {
    16: "assets/icons/icon-paused-16.png",
    32: "assets/icons/icon-paused-32.png",
  });
});

test("service worker resolves toolbar icons before passing image data to Chrome", async () => {
  const background = await readFile(
    new URL("../src/background.js", import.meta.url),
    "utf8",
  );
  assert.match(background, /fetch\(chrome\.runtime\.getURL\(path\)\)/);
  assert.match(background, /setIcon\(\{ imageData:/);
  assert.doesNotMatch(background, /setIcon\(\{ path:/);
});
