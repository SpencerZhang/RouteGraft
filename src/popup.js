import {
  createHeaderRule,
  createId,
  createProfile,
  createRedirectRule,
  normalizeState,
  STORAGE_KEY,
} from "./model.js";
import { importConfiguration } from "./import.js";
import { normalizePrefixBase, simulateRedirect } from "./rules.js";

let state;
const expandedRedirects = new Map();

const RESOURCE_PRESETS = {
  xhr: ["xmlhttprequest"],
  document: ["main_frame", "sub_frame"],
  script: ["script"],
  stylesheet: ["stylesheet"],
  image: ["image"],
  font: ["font"],
  media: ["media"],
  websocket: ["websocket"],
  all: [
    "main_frame", "sub_frame", "xmlhttprequest", "script", "stylesheet",
    "image", "font", "media", "websocket", "other",
  ],
};

const elements = {
  masterEnabled: document.querySelector("#master-enabled"),
  profileList: document.querySelector("#profile-list"),
  redirectList: document.querySelector("#redirect-list"),
  headerList: document.querySelector("#header-list"),
  expandRedirects: document.querySelector("#expand-redirects"),
  collapseRedirects: document.querySelector("#collapse-redirects"),
  status: document.querySelector("#status"),
};

localizeTree(document);
elements.runtimeList = document.querySelector("#runtime-list");
elements.runtimeList.dataset.emptyMessage = t("noRuntimeMatches");
await initialize();

function t(key, substitutions) {
  return chrome.i18n.getMessage(key, substitutions) || key;
}

function localizeTree(root) {
  root.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  for (const attribute of ["title", "placeholder", "aria-label"]) {
    root.querySelectorAll(`[data-i18n-${attribute}]`).forEach((element) => {
      element.setAttribute(attribute, t(element.dataset[`i18n${attribute
        .split("-")
        .map((part) => part[0].toUpperCase() + part.slice(1))
        .join("")}`]));
    });
  }
}

async function initialize() {
  document.querySelector("#app-version").textContent =
    `v${chrome.runtime.getManifest().version}`;
  const response = await chrome.runtime.sendMessage({ type: "load-state" });
  if (!response?.ok) throw new Error(response?.message || t("couldNotLoadProfiles"));
  state = normalizeState(response.state);
  bindStaticEvents();
  render();
}

function bindStaticEvents() {
  elements.masterEnabled.addEventListener("change", () => {
    state.masterEnabled = elements.masterEnabled.checked;
    scheduleSave();
  });

  document.querySelector("#add-profile").addEventListener("click", () => {
    const profile = createProfile(t("profileNumberNew", String(state.profiles.length + 1)));
    profile.redirects = [];
    state.profiles.push(profile);
    state.selectedProfileId = profile.id;
    render();
    scheduleSave();
  });

  document.querySelector("#add-redirect").addEventListener("click", () => {
    const rule = createRedirectRule();
    selectedProfile().redirects.push(rule);
    expandedRedirects.set(rule.id, true);
    renderRules();
    scheduleSave();
  });

  elements.expandRedirects.addEventListener("click", () => {
    selectedProfile().redirects.forEach((rule) => expandedRedirects.set(rule.id, true));
    renderRules();
  });

  elements.collapseRedirects.addEventListener("click", () => {
    selectedProfile().redirects.forEach((rule) => expandedRedirects.set(rule.id, false));
    renderRules();
  });

  document.querySelector("#add-header").addEventListener("click", () => {
    selectedProfile().headers.push(createHeaderRule());
    renderRules();
    scheduleSave();
  });

  document.querySelector("#export-config").addEventListener("click", exportConfig);
  document.querySelector("#import-config").addEventListener("click", () => {
    document.querySelector("#import-file").click();
  });
  document.querySelector("#import-file").addEventListener("change", importConfig);
  document.querySelector("#toggle-runtime").addEventListener("click", async () => {
    const panel = document.querySelector("#runtime-panel");
    panel.hidden = !panel.hidden;
    if (!panel.hidden) await refreshRuntimeMatches();
  });
  document.querySelector("#refresh-runtime").addEventListener("click", refreshRuntimeMatches);
  document.querySelector("#clear-runtime").addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ type: "clear-runtime-matches" });
    await refreshRuntimeMatches();
  });

  // Closing a popup destroys its JavaScript context. Send a final snapshot
  // synchronously to the independent service worker; no popup timer or
  // response callback is required for the worker to finish the transaction.
  window.addEventListener("pagehide", flushLatestSnapshot);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushLatestSnapshot();
  });
}

async function refreshRuntimeMatches() {
  const list = document.querySelector("#runtime-list");
  const response = await chrome.runtime.sendMessage({ type: "get-runtime-matches" });
  if (!response?.ok) {
    list.replaceChildren(createRuntimeEntry({
      error: response?.message || t("couldNotReadRuntime"),
    }));
    return;
  }
  list.replaceChildren(...response.matches.map(createRuntimeEntry));
}

function createRuntimeEntry(match) {
  const entry = document.createElement("div");
  entry.className = "runtime-entry";
  if (match.error) {
    entry.textContent = match.error;
    return entry;
  }

  const redirect = findMatchingRedirect(match.url);
  const target = match.target || (redirect
    ? simulateRedirect(redirect, match.url).target
    : t("unknownTarget"));
  const headline = document.createElement("strong");
  const ruleLabel = match.ruleId == null
    ? t("pageHook")
    : t("ruleNumber", String(match.ruleId));
  headline.textContent = `${new Date(match.time).toLocaleTimeString()} · ${match.source || "DNR"} · ${match.type} · ${ruleLabel}`;
  const route = document.createElement("div");
  route.textContent = `${match.url} → ${target}`;
  entry.append(headline, route);
  return entry;
}

function findMatchingRedirect(url) {
  for (const profile of state.profiles) {
    if (!profile.enabled) continue;
    for (const redirect of profile.redirects) {
      if (!redirect.enabled) continue;
      try {
        if (simulateRedirect(redirect, url).matched) return redirect;
      } catch {
        // Invalid rules are already surfaced by the save status.
      }
    }
  }
  return null;
}

function render() {
  elements.masterEnabled.checked = state.masterEnabled;
  renderProfileTabs();
  renderRules();
}

function renderProfileTabs() {
  elements.profileList.replaceChildren(
    ...state.profiles.map((profile) => {
      const tab = document.createElement("div");
      tab.className = "profile-tab";
      tab.classList.toggle("selected", profile.id === state.selectedProfileId);
      tab.classList.toggle("enabled", profile.enabled);
      tab.dataset.profileId = profile.id;

      const enabled = document.createElement("input");
      enabled.type = "checkbox";
      enabled.checked = profile.enabled;
      enabled.title = profile.enabled ? t("disableProfile") : t("enableProfile", profile.name);
      enabled.setAttribute("aria-label", t("enableProfile", profile.name));
      enabled.addEventListener("change", () => {
        profile.enabled = enabled.checked;
        tab.classList.toggle("enabled", profile.enabled);
        enabled.title = profile.enabled ? t("disableProfile") : t("enableProfile", profile.name);
        scheduleSave();
      });

      const name = document.createElement("input");
      name.type = "text";
      name.className = "profile-tab-name";
      name.value = profile.name;
      name.title = t("editProfileName");
      name.setAttribute("aria-label", t("profileNameLabel", profile.name));
      name.addEventListener("focus", () => selectProfile(profile.id));
      name.addEventListener("input", () => {
        profile.name = name.value;
        scheduleSave();
      });

      const actions = document.createElement("div");
      actions.className = "profile-tab-actions";

      const clone = document.createElement("button");
      clone.type = "button";
      clone.className = "profile-tab-action clone";
      clone.textContent = "⧉";
      clone.title = t("cloneProfile", profile.name);
      clone.setAttribute("aria-label", clone.title);
      clone.addEventListener("click", (event) => {
        event.stopPropagation();
        cloneProfile(profile);
      });

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "profile-tab-action delete";
      remove.textContent = "×";
      remove.title = t("deleteProfile", profile.name);
      remove.setAttribute("aria-label", remove.title);
      remove.addEventListener("click", (event) => {
        event.stopPropagation();
        deleteProfile(profile);
      });

      actions.append(clone, remove);

      tab.addEventListener("click", (event) => {
        if (event.target === enabled) return;
        selectProfile(profile.id);
      });
      tab.append(enabled, name, actions);
      return tab;
    }),
  );
}

function cloneProfile(profile) {
  const copy = structuredClone(profile);
  copy.id = createId("profile");
  copy.name = t("copySuffix", copy.name);
  copy.enabled = false;
  copy.redirects.forEach((rule) => (rule.id = createId("redirect")));
  copy.headers.forEach((rule) => (rule.id = createId("header")));
  state.profiles.push(copy);
  state.selectedProfileId = copy.id;
  render();
  scheduleSave();
}

function deleteProfile(profile) {
  if (state.profiles.length === 1) {
    showStatus(t("atLeastOneProfile"), true);
    return;
  }
  if (!confirm(t("deleteProfileConfirm", profile.name))) return;
  state.profiles = state.profiles.filter((item) => item.id !== profile.id);
  if (state.selectedProfileId === profile.id) {
    state.selectedProfileId = state.profiles[0].id;
  }
  render();
  scheduleSave();
}

function selectProfile(profileId) {
  if (state.selectedProfileId === profileId) return;
  state.selectedProfileId = profileId;
  elements.profileList.querySelectorAll(".profile-tab").forEach((tab) => {
    tab.classList.toggle("selected", tab.dataset.profileId === profileId);
  });
  renderRules();
  scheduleSave();
}

function renderRules() {
  const profile = selectedProfile();
  profile.redirects.forEach((rule, index) => {
    if (!expandedRedirects.has(rule.id)) expandedRedirects.set(rule.id, index === 0);
  });
  const showBulkActions = profile.redirects.length > 1;
  elements.expandRedirects.hidden = !showBulkActions;
  elements.collapseRedirects.hidden = !showBulkActions;
  elements.redirectList.replaceChildren(
    ...profile.redirects.map((rule) => renderRedirect(rule)),
  );
  elements.headerList.replaceChildren(...profile.headers.map((rule) => renderHeader(rule)));
}

function renderRedirect(rule) {
  const card = document.querySelector("#redirect-template").content.firstElementChild.cloneNode(true);
  localizeTree(card);
  card.dataset.ruleId = rule.id;
  setFields(card, rule);
  updateRedirectCard(card, rule);
  setRedirectExpanded(card, rule.id, expandedRedirects.get(rule.id));

  const toggle = card.querySelector('[data-action="toggle"]');
  const body = card.querySelector(".rule-body");
  body.id = `redirect-body-${rule.id}`;
  toggle.setAttribute("aria-controls", body.id);
  toggle.addEventListener("click", () => toggleRedirect(card, rule.id));
  card.querySelector('[data-role="summary"]').addEventListener("click", () => {
    toggleRedirect(card, rule.id);
  });
  card.querySelector(".rule-topline").addEventListener("click", (event) => {
    if (event.target.closest("input, button, label")) return;
    toggleRedirect(card, rule.id);
  });

  card.addEventListener("input", (event) => {
    updateRuleFromField(rule, event.target);
    updateRedirectCard(card, rule);
    scheduleSave();
  });
  card.addEventListener("change", (event) => {
    updateRuleFromField(rule, event.target);
    updateRedirectCard(card, rule);
    scheduleSave();
  });
  card.querySelector('[data-action="delete"]').addEventListener("click", () => {
    expandedRedirects.delete(rule.id);
    selectedProfile().redirects = selectedProfile().redirects.filter((item) => item.id !== rule.id);
    renderRules();
    scheduleSave();
  });
  card.querySelector('[data-action="test"]').addEventListener("click", () => {
    void testRedirect(card, rule);
  });
  return card;
}

function toggleRedirect(card, ruleId) {
  setRedirectExpanded(card, ruleId, card.classList.contains("collapsed"));
}

function setRedirectExpanded(card, ruleId, expanded) {
  expandedRedirects.set(ruleId, expanded);
  card.classList.toggle("collapsed", !expanded);
  const toggle = card.querySelector('[data-action="toggle"]');
  toggle.setAttribute("aria-expanded", String(expanded));
  toggle.title = t(expanded ? "collapseRule" : "expandRule");
}

async function testRedirect(card, rule) {
  const input = card.querySelector('[data-role="test-url"]');
  const output = card.querySelector('[data-role="test-result"]');
  const url = input.value.trim();
  output.hidden = false;
  output.classList.remove("error");

  try {
    new URL(url);
    const simulated = simulateRedirect(rule, url);
    if (!simulated.matched) {
      output.classList.add("error");
      output.textContent = t("notMatchedPattern", simulated.regexFilter);
      return;
    }

    await persist(true);
    const outcome = await chrome.declarativeNetRequest.testMatchOutcome({
      url,
      type: "xmlhttprequest",
    });
    if (outcome.matchedRules.length === 0) {
      output.classList.add("error");
      output.textContent = t("inactiveMatchingRule");
      return;
    }

    output.textContent = t("matchedTarget", simulated.target);
  } catch (error) {
    output.classList.add("error");
    output.textContent = error.message;
  }
}

function renderHeader(rule) {
  const card = document.querySelector("#header-template").content.firstElementChild.cloneNode(true);
  localizeTree(card);
  setFields(card, rule);
  updateHeaderCard(card, rule);

  card.addEventListener("input", (event) => {
    updateRuleFromField(rule, event.target);
    updateHeaderCard(card, rule);
    scheduleSave();
  });
  card.addEventListener("change", (event) => {
    updateRuleFromField(rule, event.target);
    updateHeaderCard(card, rule);
    scheduleSave();
  });
  card.querySelector('[data-action="delete"]').addEventListener("click", () => {
    selectedProfile().headers = selectedProfile().headers.filter((item) => item.id !== rule.id);
    renderRules();
    scheduleSave();
  });
  return card;
}

function setFields(card, rule) {
  card.querySelectorAll("[data-field]").forEach((control) => {
    const field = control.dataset.field;
    if (!(field in rule)) return;
    if (field === "resourceTypes") control.value = resourcePresetFor(rule[field]);
    else if (control.type === "checkbox") control.checked = Boolean(rule[field]);
    else control.value = rule[field];
  });
}

function updateRuleFromField(rule, control) {
  const field = control.dataset.field;
  if (!field) return;
  if (field === "resourceTypes") {
    rule[field] = [...RESOURCE_PRESETS[control.value]];
  } else {
    rule[field] = control.type === "checkbox" ? control.checked : control.value;
  }
}

function resourcePresetFor(resourceTypes) {
  const normalized = [...(resourceTypes || ["xmlhttprequest"])].sort().join(",");
  return Object.entries(RESOURCE_PRESETS).find(([, types]) =>
    [...types].sort().join(",") === normalized,
  )?.[0] || "xhr";
}

function updateRedirectCard(card, rule) {
  const summary = card.querySelector('[data-role="summary"]');
  const sourceSummary = String(rule.source || "").trim() || t("source");
  const targetSummary = String(rule.target || "").trim() || t("target");
  summary.textContent = `${sourceSummary} → ${targetSummary}`;
  summary.title = summary.textContent;
  const preserveRow = card.querySelector(".preserve-row");
  preserveRow.hidden = rule.matchType !== "prefix";
  const preview = card.querySelector('[data-role="preview"]');
  if (rule.matchType === "prefix") {
    const source = normalizePrefixBase(rule.source);
    const target = normalizePrefixBase(rule.target);
    preview.textContent = rule.preserveSuffix
      ? `${source}/users?id=1 → ${target}/users?id=1`
      : `${source}… → ${target}`;
  } else if (rule.matchType === "wildcard") {
    preview.textContent = t("wildcardPreview");
  } else {
    preview.textContent = t("regexPreview");
  }
}

function updateHeaderCard(card, rule) {
  card.querySelector(".value-field").hidden = rule.operation === "remove";
}

function selectedProfile() {
  return state.profiles.find((profile) => profile.id === state.selectedProfileId) || state.profiles[0];
}

function scheduleSave() {
  markChanged();
  showStatus(t("saving"));
  // Start the storage write in the same event turn. Popup timers and queued
  // callbacks are cancelled when the user closes the popup.
  void persist(false).catch((error) => showStatus(error.message, true));
}

function markChanged() {
  state.revision = Math.max(Number(state.revision || 0) + 1, Date.now());
}

function flushLatestSnapshot() {
  if (!state) return;
  markChanged();
  const snapshot = normalizeState(structuredClone(state));
  chrome.runtime.sendMessage({ type: "save-state", state: snapshot }).catch(() => undefined);
}

async function persist(silent) {
  // Keep the live state object intact. Rendered controls close over its nested
  // rule objects; replacing it here would make subsequent input mutate stale
  // references and a later render would appear to reset the form.
  const snapshot = normalizeState(structuredClone(state));
  // Calling sendMessage transfers the snapshot to the service worker in this
  // event turn. Saving and applying no longer depend on the popup staying open.
  const result = await chrome.runtime.sendMessage({
    type: "save-state",
    state: snapshot,
  });
  if (result?.ok) {
    if (!silent) showStatus(t("rulesActive", String(result.ruleCount)));
  } else {
    const message = result?.errors?.map((error) => `${error.ruleName}: ${error.message}`).join(" · ") || result?.message || t("couldNotApplyRules");
    showStatus(message, true);
  }
}

function exportConfig() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `routegraft-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function importConfig(event) {
  const [file] = event.target.files;
  if (!file) return;
  try {
    state = importConfiguration(await file.text());
    state.selectedProfileId = state.profiles[0].id;
    markChanged();
    render();
    await persist(false);
    showStatus(t("profilesImported", String(state.profiles.length)));
  } catch (error) {
    showStatus(error.message, true);
  } finally {
    event.target.value = "";
  }
}

function showStatus(message, isError = false) {
  elements.status.hidden = false;
  elements.status.textContent = message;
  elements.status.classList.toggle("error", isError);
}
