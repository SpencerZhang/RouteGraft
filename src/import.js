import { createId, normalizeState, SCHEMA_VERSION } from "./model.js";

export function importConfiguration(input) {
  let parsed = input;
  if (typeof input === "string") {
    try {
      parsed = JSON.parse(input);
    } catch {
      throw new Error(message("invalidJson", "Invalid JSON document"));
    }
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error(message("invalidJson", "Invalid JSON document"));
  }

  if (Array.isArray(parsed.profiles) && parsed.version === SCHEMA_VERSION) {
    return normalizeState(parsed);
  }

  return normalizeState(convertModHeader(parsed));
}

export function convertModHeader(document) {
  const sourceProfiles = findProfiles(document);
  if (sourceProfiles.length === 0) {
    throw new Error(message(
      "noRecognizableProfiles",
      "No RouteGraft or recognizable ModHeader profiles found",
    ));
  }

  return {
    version: SCHEMA_VERSION,
    masterEnabled: true,
    profiles: sourceProfiles.map((source, index) => {
      const profile = source.profile || source;
      const redirects = pickArray(profile, [
        "redirects",
        "urlRedirects",
        "urlReplacements",
        "replaceUrls",
      ]).map(convertRedirect).filter(Boolean);

      const requestHeaders = pickArray(profile, ["requestHeaders", "headers"])
        .map((header) => convertHeader(header, "request"))
        .filter(Boolean);
      const responseHeaders = pickArray(profile, ["responseHeaders"])
        .map((header) => convertHeader(header, "response"))
        .filter(Boolean);

      return {
        id: createId("profile"),
        name: profile.name || profile.title || message(
          "importedProfileNumber",
          `Imported profile ${index + 1}`,
          String(index + 1),
        ),
        enabled: Boolean(profile.enabled || profile.active || source.active),
        redirects,
        headers: [...requestHeaders, ...responseHeaders],
      };
    }),
  };
}

function findProfiles(document) {
  if (Array.isArray(document)) return document;
  for (const key of ["profiles", "profileList", "items"]) {
    if (Array.isArray(document[key])) return document[key];
  }
  if (document.profile && typeof document.profile === "object") return [document.profile];
  return [];
}

function convertRedirect(source) {
  const from = source.source || source.from || source.match || source.name;
  const to = source.target || source.to || source.replace || source.value;
  if (!from || !to) return null;
  return {
    id: createId("redirect"),
    enabled: source.enabled !== false,
    name: source.label || source.comment || message("importedRedirect", "Imported redirect"),
    matchType: source.isRegex || source.regex ? "regex" : "prefix",
    source: String(from),
    target: String(to),
    preserveSuffix: source.preserveSuffix !== false,
    resourceTypes: normalizeImportedTypes(source.resourceTypes),
  };
}

function convertHeader(source, target) {
  const name = source.header || source.name;
  if (!name) return null;
  return {
    id: createId("header"),
    enabled: source.enabled !== false,
    target,
    operation: source.operation === "remove" || source.remove ? "remove" : "set",
    header: String(name),
    value: String(source.value || ""),
    matchType: source.isRegex || source.regex ? "regex" : "prefix",
    urlPattern: String(
      source.urlPattern || source.url || source.filter || source.applyTo || "http",
    ),
    resourceTypes: normalizeImportedTypes(source.resourceTypes),
  };
}

function pickArray(source, keys) {
  for (const key of keys) {
    if (Array.isArray(source[key])) return source[key];
  }
  return [];
}

function normalizeImportedTypes(types) {
  return Array.isArray(types) && types.length > 0 ? types : ["xmlhttprequest"];
}

function message(key, fallback, substitutions) {
  return globalThis.chrome?.i18n?.getMessage(key, substitutions) || fallback;
}
