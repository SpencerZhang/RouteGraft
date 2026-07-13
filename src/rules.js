const MAX_REGEX_CAPTURE_GROUPS = 9;
// Reserved for a later major release. Header modification has not completed
// browser-level verification and must not create active DNR rules yet.
export const ENABLE_HEADER_RULES = false;

export function compileState(state) {
  const rules = [];
  const errors = [];
  if (!state.masterEnabled) return { rules, errors };

  let nextRuleId = 1;
  for (const profile of state.profiles) {
    if (!profile.enabled) continue;

    for (const redirect of profile.redirects) {
      if (!redirect.enabled) continue;
      try {
        rules.push(compileRedirect(redirect, nextRuleId++));
      } catch (error) {
        errors.push(formatError(profile, redirect, error));
      }
    }

    if (ENABLE_HEADER_RULES) {
      for (const header of profile.headers) {
        if (!header.enabled) continue;
        try {
          rules.push(compileHeader(header, nextRuleId++));
        } catch (error) {
          errors.push(formatError(profile, header, error));
        }
      }
    }
  }

  return { rules, errors };
}

export function compileRedirect(rule, id) {
  requireValue(rule.source, message("sourceRequired", "Source URL/pattern is required"));
  requireValue(rule.target, message("targetRequired", "Target URL/substitution is required"));

  const condition = {
    resourceTypes: normalizeTypes(rule.resourceTypes),
  };
  let regexSubstitution;

  if (rule.matchType === "regex") {
    condition.regexFilter = rule.source;
    regexSubstitution = normalizeSubstitution(rule.target);
  } else if (rule.matchType === "wildcard") {
    const compiled = wildcardToRegex(rule.source);
    condition.regexFilter = compiled.regex;
    regexSubstitution = normalizeSubstitution(rule.target);
    if (!hasSubstitution(regexSubstitution) && compiled.captureCount > 0) {
      regexSubstitution += "\\1";
    }
  } else {
    const sourceBase = normalizePrefixBase(rule.source);
    const targetBase = normalizePrefixBase(rule.target);
    assertHttpUrl(sourceBase, message("sourceHttpRequired", "Source must be an HTTP(S) URL"));
    assertHttpUrl(targetBase, message("targetHttpRequired", "Target must be an HTTP(S) URL"));
    const source = escapeRegex(sourceBase);
    condition.regexFilter = rule.preserveSuffix
      ? `^${source}([/?#].*)?$`
      : `^${source}(?:[/?#].*)?$`;
    regexSubstitution = targetBase;
    if (rule.preserveSuffix) regexSubstitution += "\\1";
  }

  return {
    id,
    priority: 1_000 + id,
    action: {
      type: "redirect",
      redirect: { regexSubstitution },
    },
    condition,
  };
}

export function simulateRedirect(rule, url) {
  const compiled = compileRedirect(rule, 1);
  const regex = new RegExp(compiled.condition.regexFilter);
  const match = regex.exec(url);
  if (!match) {
    return {
      matched: false,
      regexFilter: compiled.condition.regexFilter,
    };
  }

  const substitution = compiled.action.redirect.regexSubstitution;
  const target = substitution.replace(/\\([0-9])/g, (_token, index) => {
    return match[Number(index)] || "";
  });
  return {
    matched: true,
    target,
    regexFilter: compiled.condition.regexFilter,
  };
}

export function compileHeader(rule, id) {
  requireValue(rule.header, message("headerNameRequired", "Header name is required"));
  requireValue(rule.urlPattern, message("headerPatternRequired", "Header URL pattern is required"));
  if (rule.operation !== "remove") {
    requireValue(rule.value, message("headerValueRequired", "Header value is required for set operations"));
  }

  const condition = {
    resourceTypes: normalizeTypes(rule.resourceTypes),
    ...compileUrlCondition(rule.matchType, rule.urlPattern),
  };
  const change = {
    header: rule.header,
    operation: rule.operation === "remove" ? "remove" : "set",
  };
  if (change.operation === "set") change.value = rule.value;

  const key = rule.target === "response" ? "responseHeaders" : "requestHeaders";
  return {
    id,
    priority: 100 + id,
    action: {
      type: "modifyHeaders",
      [key]: [change],
    },
    condition,
  };
}

function compileUrlCondition(matchType, pattern) {
  if (matchType === "regex") return { regexFilter: pattern };
  if (matchType === "wildcard") return { regexFilter: wildcardToRegex(pattern).regex };
  assertHttpUrl(pattern, message("headerPrefixHttpRequired", "Header URL prefix must be an HTTP(S) URL"));
  return {
    regexFilter: `^${escapeRegex(trimTrailingSlash(pattern))}([/?#].*)?$`,
  };
}

export function wildcardToRegex(pattern) {
  let captureCount = 0;
  let regex = "^";
  for (const character of pattern) {
    if (character === "*") {
      captureCount += 1;
      if (captureCount > MAX_REGEX_CAPTURE_GROUPS) {
        throw new Error(message("wildcardLimit", "Wildcard rules support at most 9 * placeholders"));
      }
      regex += "(.*)";
    } else {
      regex += escapeRegex(character);
    }
  }
  return { regex: `${regex}$`, captureCount };
}

function normalizeSubstitution(value) {
  return value.replace(/\$(\d)/g, "\\$1");
}

function hasSubstitution(value) {
  return /\\[0-9]/.test(value);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function trimTrailingSlash(value) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function normalizePrefixBase(value) {
  const trimmed = String(value || "").trim();
  const withoutOptionalWildcard = trimmed.endsWith("/*")
    ? trimmed.slice(0, -2)
    : trimmed;
  return trimTrailingSlash(withoutOptionalWildcard);
}

function assertHttpUrl(value, message) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
  } catch {
    throw new Error(message);
  }
}

function requireValue(value, message) {
  if (!String(value || "").trim()) throw new Error(message);
}

function normalizeTypes(types) {
  return Array.isArray(types) && types.length > 0 ? types : ["xmlhttprequest"];
}

function formatError(profile, rule, error) {
  return {
    profileId: profile.id,
    profileName: profile.name,
    ruleId: rule.id,
    ruleName: rule.name || rule.header || message("rule", "Rule"),
    message: error.message,
  };
}

function message(key, fallback, substitutions) {
  return globalThis.chrome?.i18n?.getMessage(key, substitutions) || fallback;
}
