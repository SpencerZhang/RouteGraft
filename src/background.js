import { createInitialState, normalizeState, STORAGE_KEY } from "./model.js";
import { compileState } from "./rules.js";

let applyQueue = Promise.resolve();
const MATCH_LOG_KEY = "localRouteRuntimeMatches";

chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
  void appendRuntimeMatch({
    source: "DNR",
    ruleId: info.rule.ruleId,
    rulesetId: info.rule.rulesetId,
    url: info.request.url,
    type: info.request.type,
    method: info.request.method,
    initiator: info.request.initiator || "",
    tabId: info.request.tabId,
    time: Date.now(),
  });
});

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  if (!stored[STORAGE_KEY]) {
    await chrome.storage.local.set({ [STORAGE_KEY]: createInitialState() });
  }
  await queueApply();
});

chrome.runtime.onStartup.addListener(queueApply);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "record-page-match") {
    appendRuntimeMatch({
      source: "Page fallback",
      ruleId: null,
      rulesetId: "page",
      url: message.match.from,
      target: message.match.to,
      type: message.match.requestType,
      method: "",
      initiator: _sender.url || "",
      tabId: _sender.tab?.id ?? -1,
      time: message.match.time || Date.now(),
    })
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, message: error.message }));
    return true;
  }

  if (message?.type === "get-runtime-matches") {
    chrome.storage.session
      .get(MATCH_LOG_KEY)
      .then((stored) => sendResponse({
        ok: true,
        matches: stored[MATCH_LOG_KEY] || [],
      }))
      .catch((error) => sendResponse({ ok: false, message: error.message }));
    return true;
  }

  if (message?.type === "clear-runtime-matches") {
    chrome.storage.session
      .set({ [MATCH_LOG_KEY]: [] })
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, message: error.message }));
    return true;
  }

  if (message?.type === "load-state") {
    queueLoadState()
      .then((state) => sendResponse({ ok: true, state }))
      .catch((error) => sendResponse({ ok: false, message: error.message }));
    return true;
  }

  if (message?.type === "save-state") {
    queueSaveAndApply(message.state)
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, message: error.message }));
    return true;
  }

  if (message?.type !== "validate-and-apply") return false;
  queueApply()
    .then(sendResponse)
    .catch((error) => sendResponse({ ok: false, message: error.message }));
  return true;
});

async function appendRuntimeMatch(entry) {
  const stored = await chrome.storage.session.get(MATCH_LOG_KEY);
  const matches = stored[MATCH_LOG_KEY] || [];
  matches.unshift(entry);
  await chrome.storage.session.set({
    [MATCH_LOG_KEY]: matches.slice(0, 30),
  });
}

function queueApply() {
  applyQueue = applyQueue.catch(() => undefined).then(applyStoredRules);
  return applyQueue;
}

function queueLoadState() {
  // Opening a new popup waits for every save sent by the previous popup.
  applyQueue = applyQueue.catch(() => undefined).then(loadState);
  return applyQueue;
}

function queueSaveAndApply(value) {
  // The message payload is structured-cloned by Chrome before the popup can
  // close, so the service worker owns the complete save transaction.
  const snapshot = normalizeState(value);
  applyQueue = applyQueue
    .catch(() => undefined)
    .then(() => saveAndApplyState(snapshot));
  return applyQueue;
}

async function loadState() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  if (stored[STORAGE_KEY]) return normalizeState(stored[STORAGE_KEY]);
  const initialState = createInitialState();
  await chrome.storage.local.set({ [STORAGE_KEY]: initialState });
  return initialState;
}

async function applyStoredRules() {
  return applyState(await loadState());
}

async function saveAndApplyState(value) {
  const state = normalizeState(value);
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const current = stored[STORAGE_KEY]
    ? normalizeState(stored[STORAGE_KEY])
    : null;

  // A slow, older edit must never overwrite a newer snapshot.
  if (current && current.revision > state.revision) {
    return applyState(current);
  }

  await chrome.storage.local.set({ [STORAGE_KEY]: state });
  return applyState(state);
}

async function applyState(state) {
  const { rules, errors } = compileState(state);
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();

  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingRules.map((rule) => rule.id),
      addRules: rules,
    });
  } catch (error) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingRules.map((rule) => rule.id),
    });
    errors.push({
      profileName: message("extension", "Extension"),
      ruleName: message("ruleValidation", "Rule validation"),
      message: error.message,
    });
  }

  const appliedRules = await chrome.declarativeNetRequest.getDynamicRules();

  const enabledProfileCount = state.masterEnabled
    ? state.profiles.filter((profile) => profile.enabled).length
    : 0;
  await chrome.action.setBadgeText({
    text: enabledProfileCount > 0 ? String(enabledProfileCount) : "",
  });
  await chrome.action.setBadgeBackgroundColor({ color: "#2563eb" });
  await chrome.action.setTitle({
    title: state.masterEnabled
      ? message("activeRulesTitle", `RouteGraft · ${appliedRules.length} active rules`, String(appliedRules.length))
      : message("pausedTitle", "RouteGraft · paused"),
  });

  return {
    ok: errors.length === 0,
    errors,
    ruleCount: appliedRules.length,
  };
}

function message(key, fallback, substitutions) {
  return chrome.i18n.getMessage(key, substitutions) || fallback;
}
