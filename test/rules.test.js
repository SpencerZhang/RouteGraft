import test from "node:test";
import assert from "node:assert/strict";
import {
  compileHeader,
  compileRedirect,
  compileState,
  simulateRedirect,
  wildcardToRegex,
} from "../src/rules.js";

test("prefix redirect preserves the remaining path and query", () => {
  const rule = compileRedirect(
    {
      matchType: "prefix",
      source: "https://api.example.com/v1/",
      target: "http://127.0.0.1:8080/",
      preserveSuffix: true,
      resourceTypes: ["xmlhttprequest"],
    },
    1,
  );

  assert.equal(rule.condition.regexFilter, "^https://api\\.example\\.com/v1([/?#].*)?$");
  assert.deepEqual(rule.condition.resourceTypes, ["xmlhttprequest"]);
  assert.equal(rule.action.redirect.regexSubstitution, "http://127.0.0.1:8080\\1");
});

test("prefix redirect does not accidentally match a longer path segment", () => {
  const rule = compileRedirect(
    {
      matchType: "prefix",
      source: "https://api.example.com/v1",
      target: "http://127.0.0.1:8080",
      preserveSuffix: true,
      resourceTypes: ["xmlhttprequest"],
    },
    2,
  );
  const matcher = new RegExp(rule.condition.regexFilter);
  assert.equal(matcher.test("https://api.example.com/v1/users"), true);
  assert.equal(matcher.test("https://api.example.com/v10/users"), false);
});

test("prefix redirect accepts the familiar trailing slash-star notation", () => {
  const rule = compileRedirect(
    {
      matchType: "prefix",
      source: "https://api.example.com/gtw/hfins/*",
      target: "http://127.0.0.1:8080/hfins/*",
      preserveSuffix: true,
      resourceTypes: ["xmlhttprequest"],
    },
    3,
  );

  assert.equal(
    rule.condition.regexFilter,
    "^https://api\\.example\\.com/gtw/hfins([/?#].*)?$",
  );
  assert.equal(
    rule.action.redirect.regexSubstitution,
    "http://127.0.0.1:8080/hfins\\1",
  );
  assert.equal(
    new RegExp(rule.condition.regexFilter).test(
      "https://api.example.com/gtw/hfins/v2/0/jobs?page=0",
    ),
    true,
  );
});

test("redirect simulation reports the exact destination URL", () => {
  const result = simulateRedirect(
    {
      matchType: "prefix",
      source: "https://api.example.com/gtw/hfins/*",
      target: "http://127.0.0.1:8080/local/hfins",
      preserveSuffix: true,
      resourceTypes: ["xmlhttprequest"],
    },
    "https://api.example.com/gtw/hfins/v2/jobs?page=0",
  );

  assert.deepEqual(result, {
    matched: true,
    target: "http://127.0.0.1:8080/local/hfins/v2/jobs?page=0",
    regexFilter: "^https://api\\.example\\.com/gtw/hfins([/?#].*)?$",
  });
});

test("redirect rules preserve the selected Chrome resource classification", () => {
  const rule = compileRedirect(
    {
      matchType: "prefix",
      source: "https://api.example.com",
      target: "http://127.0.0.1:8080",
      preserveSuffix: true,
      resourceTypes: ["xmlhttprequest"],
    },
    7,
  );

  assert.deepEqual(rule.condition.resourceTypes, ["xmlhttprequest"]);
});

test("redirect target can be any HTTP environment, not only localhost", () => {
  const rule = compileRedirect(
    {
      matchType: "prefix",
      source: "https://api.example.com",
      target: "https://api.staging.example.net",
      preserveSuffix: true,
      resourceTypes: ["xmlhttprequest"],
    },
    2,
  );

  assert.equal(rule.action.redirect.regexSubstitution, "https://api.staging.example.net\\1");
});

test("wildcard rules expose capture groups to the target", () => {
  const rule = compileRedirect(
    {
      matchType: "wildcard",
      source: "https://*.example.com/api/*",
      target: "http://dev.internal/$2",
      resourceTypes: ["xmlhttprequest"],
    },
    3,
  );

  assert.equal(rule.condition.regexFilter, "^https://(.*)\\.example\\.com/api/(.*)$");
  assert.equal(rule.action.redirect.regexSubstitution, "http://dev.internal/\\2");
});

test("header remove omits a value", () => {
  const rule = compileHeader(
    {
      target: "response",
      operation: "remove",
      header: "content-security-policy",
      value: "",
      matchType: "prefix",
      urlPattern: "https://app.example.com",
      resourceTypes: ["main_frame"],
    },
    4,
  );

  assert.deepEqual(rule.action.responseHeaders, [
    { header: "content-security-policy", operation: "remove" },
  ]);
});

test("enabled header rules compile with their profile", () => {
  const result = compileState({
    masterEnabled: true,
    profiles: [{
      id: "dev",
      name: "Dev",
      enabled: true,
      redirects: [],
      headers: [{
        id: "header",
        enabled: true,
        target: "request",
        operation: "set",
        header: "X-Development-Mode",
        value: "true",
        matchType: "prefix",
        urlPattern: "https://app.example.com",
        resourceTypes: ["xmlhttprequest"],
      }],
    }],
  });

  assert.equal(result.errors.length, 0);
  assert.equal(result.rules.length, 1);
  assert.deepEqual(result.rules[0], {
    id: 1,
    priority: 101,
    action: {
      type: "modifyHeaders",
      requestHeaders: [{
        header: "X-Development-Mode",
        operation: "set",
        value: "true",
      }],
    },
    condition: {
      resourceTypes: ["xmlhttprequest"],
      regexFilter: "^https://app\\.example\\.com([/?#].*)?$",
    },
  });
});

test("invalid header rules report validation errors", () => {
  const result = compileState({
    masterEnabled: true,
    profiles: [{
      id: "dev",
      name: "Dev",
      enabled: true,
      redirects: [],
      headers: [{
        id: "missing-value",
        enabled: true,
        target: "request",
        operation: "set",
        header: "X-Development-Mode",
        value: "",
        matchType: "prefix",
        urlPattern: "https://app.example.com",
        resourceTypes: ["xmlhttprequest"],
      }],
    }],
  });

  assert.equal(result.rules.length, 0);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].ruleName, "X-Development-Mode");
  assert.match(result.errors[0].message, /value is required/i);
});

test("only enabled profiles and rules compile", () => {
  const result = compileState({
    masterEnabled: true,
    profiles: [
      {
        id: "one",
        name: "One",
        enabled: true,
        redirects: [
          {
            id: "off",
            enabled: false,
            matchType: "prefix",
            source: "https://a.example",
            target: "http://a.local",
            preserveSuffix: true,
          },
        ],
        headers: [],
      },
    ],
  });
  assert.equal(result.rules.length, 0);
  assert.equal(result.errors.length, 0);
});

test("wildcard rules reject more than nine captures", () => {
  assert.throws(() => wildcardToRegex("**********"), /at most 9/);
});
