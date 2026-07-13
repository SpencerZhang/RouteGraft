(() => {
  const STORAGE_KEY = "localRouteState";
  const BRIDGE_SOURCE = "localroute-bridge";
  const ROUTER_SOURCE = "localroute-page-router";

  async function publishState() {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    window.postMessage({
      source: BRIDGE_SOURCE,
      type: "config",
      state: stored[STORAGE_KEY],
    }, "*");
  }

  void publishState();
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes[STORAGE_KEY]) void publishState();
  });

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.data?.source !== ROUTER_SOURCE) return;
    if (event.data.type === "ready") {
      void publishState();
      return;
    }
    if (event.data.type === "match") {
      void chrome.runtime.sendMessage({
        type: "record-page-match",
        match: event.data,
      }).catch(() => undefined);
    }
  });
})();
