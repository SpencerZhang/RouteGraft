export const STORAGE_KEY = "localRouteState";
export const SCHEMA_VERSION = 1;

export const RESOURCE_TYPES = [
  "main_frame",
  "sub_frame",
  "xmlhttprequest",
  "script",
  "stylesheet",
  "image",
  "font",
  "media",
  "websocket",
  "other",
];

export function createId(prefix = "item") {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function createRedirectRule() {
  return {
    id: createId("redirect"),
    enabled: true,
    name: message("apiToDevelopmentService", "API to development service"),
    matchType: "prefix",
    source: "https://api.example.com",
    target: "http://127.0.0.1:8080",
    preserveSuffix: true,
    resourceTypes: ["xmlhttprequest"],
  };
}

export function createHeaderRule() {
  return {
    id: createId("header"),
    enabled: true,
    target: "request",
    operation: "set",
    header: "X-Development-Mode",
    value: "true",
    matchType: "prefix",
    urlPattern: "https://api.example.com",
    resourceTypes: ["xmlhttprequest"],
  };
}

export function createProfile(name = message("localDevelopment", "Local development")) {
  return {
    id: createId("profile"),
    name,
    enabled: false,
    redirects: [createRedirectRule()],
    headers: [],
  };
}

export function createInitialState() {
  const profile = createProfile();
  return {
    version: SCHEMA_VERSION,
    revision: Date.now(),
    masterEnabled: true,
    selectedProfileId: profile.id,
    profiles: [profile],
  };
}

export function normalizeState(value) {
  if (!value || !Array.isArray(value.profiles)) return createInitialState();

  const profiles = value.profiles.map((profile, profileIndex) => ({
    id: profile.id || createId("profile"),
    name: profile.name || message("profileNumber", `Profile ${profileIndex + 1}`, String(profileIndex + 1)),
    enabled: Boolean(profile.enabled),
    redirects: Array.isArray(profile.redirects)
      ? profile.redirects.map(normalizeRedirect)
      : [],
    headers: Array.isArray(profile.headers)
      ? profile.headers.map(normalizeHeader)
      : [],
  }));

  if (profiles.length === 0) profiles.push(createProfile());
  const selectedProfileId = profiles.some(
    (profile) => profile.id === value.selectedProfileId,
  )
    ? value.selectedProfileId
    : profiles[0].id;

  return {
    version: SCHEMA_VERSION,
    revision: Number.isSafeInteger(value.revision) ? value.revision : 0,
    masterEnabled: value.masterEnabled !== false,
    selectedProfileId,
    profiles,
  };
}

function normalizeRedirect(rule) {
  return {
    id: rule.id || createId("redirect"),
    enabled: rule.enabled !== false,
    name: rule.name || message("redirect", "Redirect"),
    matchType: ["prefix", "wildcard", "regex"].includes(rule.matchType)
      ? rule.matchType
      : "prefix",
    source: String(rule.source || ""),
    target: String(rule.target || ""),
    preserveSuffix: rule.preserveSuffix !== false,
    resourceTypes: normalizeResourceTypes(rule.resourceTypes),
  };
}

function normalizeHeader(rule) {
  return {
    id: rule.id || createId("header"),
    enabled: rule.enabled !== false,
    target: rule.target === "response" ? "response" : "request",
    operation: rule.operation === "remove" ? "remove" : "set",
    header: String(rule.header || ""),
    value: String(rule.value || ""),
    matchType: ["prefix", "wildcard", "regex"].includes(rule.matchType)
      ? rule.matchType
      : "prefix",
    urlPattern: String(rule.urlPattern || ""),
    resourceTypes: normalizeResourceTypes(rule.resourceTypes),
  };
}

function normalizeResourceTypes(types) {
  const valid = Array.isArray(types)
    ? types.filter((type) => RESOURCE_TYPES.includes(type))
    : [];
  return valid.length > 0 ? valid : ["xmlhttprequest"];
}

function message(key, fallback, substitutions) {
  return globalThis.chrome?.i18n?.getMessage(key, substitutions) || fallback;
}
