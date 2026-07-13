(() => {
  if (globalThis.__localRoutePageRouterInstalled) return;
  globalThis.__localRoutePageRouterInstalled = true;

  const BRIDGE_SOURCE = "localroute-bridge";
  const ROUTER_SOURCE = "localroute-page-router";
  let redirects = [];

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.data?.source !== BRIDGE_SOURCE) return;
    if (event.data.type !== "config") return;
    const state = event.data.state;
    redirects = state?.masterEnabled
      ? (state.profiles || []).flatMap((profile) =>
          profile.enabled
            ? (profile.redirects || []).filter((rule) =>
                rule.enabled && supportsPageRequest(rule.resourceTypes),
              )
            : [],
        )
      : [];
  });

  const originalFetch = window.fetch;
  window.fetch = function localRouteFetch(input, init) {
    const originalUrl = input instanceof Request ? input.url : String(input);
    const routedUrl = rewriteUrl(originalUrl);
    if (!routedUrl || routedUrl === originalUrl) {
      return originalFetch.call(this, input, init);
    }

    reportMatch("fetch", originalUrl, routedUrl);
    const routedInput = input instanceof Request
      ? new Request(routedUrl, input)
      : routedUrl;
    return originalFetch.call(this, routedInput, init);
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function localRouteXhrOpen(...args) {
    const originalUrl = String(args[1]);
    const routedUrl = rewriteUrl(originalUrl);
    if (routedUrl && routedUrl !== originalUrl) {
      args[1] = routedUrl;
      reportMatch("xmlhttprequest", originalUrl, routedUrl);
    }
    return originalOpen.apply(this, args);
  };

  function rewriteUrl(value) {
    let absoluteUrl;
    try {
      absoluteUrl = new URL(value, location.href).href;
    } catch {
      return value;
    }

    for (const rule of redirects) {
      try {
        const result = applyRule(rule, absoluteUrl);
        if (result) return result;
      } catch {
        // Invalid rules are surfaced by the extension popup.
      }
    }
    return null;
  }

  function applyRule(rule, url) {
    if (rule.matchType === "regex") {
      const regex = new RegExp(rule.source);
      return regex.test(url) ? url.replace(regex, rule.target) : null;
    }

    if (rule.matchType === "wildcard") {
      const regex = wildcardRegex(rule.source);
      return regex.test(url) ? url.replace(regex, rule.target) : null;
    }

    const source = normalizePrefix(rule.source);
    const target = normalizePrefix(rule.target);
    const isExact = url === source;
    const hasBoundary = ["/", "?", "#"].some((separator) =>
      url.startsWith(`${source}${separator}`),
    );
    if (!isExact && !hasBoundary) return null;
    return rule.preserveSuffix === false
      ? target
      : `${target}${url.slice(source.length)}`;
  }

  function normalizePrefix(value) {
    let result = String(value || "").trim();
    if (result.endsWith("/*")) result = result.slice(0, -2);
    if (result.endsWith("/")) result = result.slice(0, -1);
    return result;
  }

  function wildcardRegex(pattern) {
    let source = "^";
    for (const character of String(pattern)) {
      source += character === "*"
        ? "(.*)"
        : character.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
    return new RegExp(`${source}$`);
  }

  function reportMatch(type, from, to) {
    window.postMessage({
      source: ROUTER_SOURCE,
      type: "match",
      requestType: type,
      from,
      to,
      time: Date.now(),
    }, "*");
  }

  window.postMessage({ source: ROUTER_SOURCE, type: "ready" }, "*");

  function supportsPageRequest(resourceTypes) {
    return !Array.isArray(resourceTypes)
      || resourceTypes.length === 0
      || resourceTypes.includes("xmlhttprequest");
  }
})();
