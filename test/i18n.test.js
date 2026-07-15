import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
}

test("English and Simplified Chinese expose the same message keys", async () => {
  const [english, chinese] = await Promise.all([
    readJson("../_locales/en/messages.json"),
    readJson("../_locales/zh_CN/messages.json"),
  ]);
  assert.deepEqual(Object.keys(chinese).sort(), Object.keys(english).sort());
});

test("every popup localization key exists in both locales", async () => {
  const [html, english, chinese] = await Promise.all([
    readFile(new URL("../src/popup.html", import.meta.url), "utf8"),
    readJson("../_locales/en/messages.json"),
    readJson("../_locales/zh_CN/messages.json"),
  ]);
  const keys = [...html.matchAll(/data-i18n(?:-[\w-]+)?="([\w]+)"/g)]
    .map((match) => match[1]);
  for (const key of keys) {
    assert.ok(english[key], `missing English message: ${key}`);
    assert.ok(chinese[key], `missing Chinese message: ${key}`);
  }
});

test("manifest enables Chrome locale selection", async () => {
  const manifest = await readJson("../manifest.json");
  assert.equal(manifest.default_locale, "en");
  assert.equal(manifest.name, "__MSG_appName__");
  assert.equal(manifest.description, "__MSG_appDescription__");
});

test("redirect editor exposes individual and bulk collapse controls", async () => {
  const [html, css] = await Promise.all([
    readFile(new URL("../src/popup.html", import.meta.url), "utf8"),
    readFile(new URL("../src/popup.css", import.meta.url), "utf8"),
  ]);
  assert.match(html, /id="expand-redirects"/);
  assert.match(html, /id="collapse-redirects"/);
  assert.match(html, /data-action="toggle"/);
  assert.match(html, /class="rule-body"/);
  assert.match(html, /data-role="summary"/);
  assert.match(css, /\.rule-card\.collapsed \.rule-body\s*\{\s*display:\s*none/);
});

test("header editor is enabled with resource and collapse controls", async () => {
  const html = await readFile(new URL("../src/popup.html", import.meta.url), "utf8");
  const section = html.match(/<section>\s*<div class="section-heading">[\s\S]*?<h2 data-i18n="headers">[\s\S]*?<\/section>/)?.[0];
  assert.ok(section, "visible Header section is missing");
  assert.match(section, /id="expand-headers"/);
  assert.match(section, /id="collapse-headers"/);
  assert.match(section, /id="add-header"/);
  assert.doesNotMatch(section, /aria-hidden="true"/);

  const template = html.match(/<template id="header-template">[\s\S]*?<\/template>/)?.[0];
  assert.ok(template, "Header template is missing");
  assert.match(template, /data-action="toggle"/);
  assert.match(template, /data-field="resourceTypes"/);
  assert.match(template, /data-field="target"/);
  assert.match(template, /data-field="operation"/);
});
