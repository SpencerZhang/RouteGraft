# RouteGraft

[English](README.md) | [简体中文](README.zh-CN.md)

![RouteGraft icon](assets/icons/icon-128.png)

RouteGraft is an open-source Manifest V3 browser extension for switching HTTP
requests between development environments. A redirect target is always
configurable; it can point to localhost, a LAN host, staging, or any other
HTTP(S) service.

## Features

- Multiple reusable profiles, with more than one profile active at once
- Master pause switch and per-profile/per-rule switches
- URL redirects using prefix, wildcard, or regular-expression matching
- Request and response Header rules using set or remove operations
- Configurable source and target addresses
- Optional preservation of the remaining path and query string
- Local-only persistence through `chrome.storage.local`
- RouteGraft JSON import/export
- Best-effort import of common legacy ModHeader export shapes
- English and Simplified Chinese UI, selected automatically from the browser language
- No account, analytics, ads, remote scripts, or backend service

## Example

Configure this prefix redirect:

```text
Source: https://api.example.com/v1
Target: http://127.0.0.1:8080
Preserve remaining path and query: enabled
```

It produces mappings such as:

```text
https://api.example.com/v1/users?id=42
→ http://127.0.0.1:8080/users?id=42
```

The target can equally be `https://api.staging.example.net`; localhost is not
hard-coded.

## Install for development

1. Open `chrome://extensions` in Chrome, Edge, Brave, or another Chromium browser.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select this repository directory (the directory containing `manifest.json`).
5. Pin RouteGraft and open its popup.

No build or dependency installation is required.

## Redirect modes

### URL prefix

The simplest and safest mode. The source must be an HTTP(S) URL. RouteGraft
matches the exact base or a `/`, `?`, or `#` boundary, so `/v1` does not
accidentally match `/v10`. A trailing `/*` is accepted as a familiar shorthand
and is treated the same as the base prefix without `/*`.

### Wildcard

Each `*` in the source becomes a capture. Use `$1` through `$9` in the target.

```text
Source: https://*.example.com/api/*
Target: http://dev.internal/$2
```

### Regular expression

Uses the RE2 syntax supported by Chrome `declarativeNetRequest`. Captures in
the target use `$1` through `$9` in the UI.

## Header rules

Header rules can set or remove a request or response Header for matching URLs.
Each rule supports the same prefix, wildcard, and regular-expression match
modes, plus a resource type such as Fetch / XHR or Documents / Frames. Header
changes are applied by Chrome's native Manifest V3 `modifyHeaders` rules and
remain scoped to the enabled profile and rule.

## Important browser behavior

- Redirecting a request does not bypass CORS. The target service must accept
  the web application's origin when CORS applies.
- HTTPS-to-HTTP behavior is controlled by the browser. Loopback development
  addresses are commonly supported, but a local HTTPS endpoint is the most
  predictable option for secure applications.
- Service workers and application caches may need to be cleared when testing
  changed routes.
- The extension requests access to all URLs because users can configure any
  source and target. All rule data remains in local browser storage.
- Conflicting redirect extensions may affect which rule wins.

## Testing

Requires a recent Node.js version, but no third-party packages:

```sh
npm test
```

## Project structure

```text
manifest.json       Extension manifest
src/background.js   Profile compilation and DNR rule application
src/rules.js        Pure URL/header rule compiler
src/model.js        Persistent data model and normalization
src/import.js       RouteGraft and legacy ModHeader imports
src/popup.*         Extension user interface
test/               Node test suite for the rule compiler
```

## Privacy and security

RouteGraft deliberately has no network client of its own. It does not upload
profiles, request metadata, URLs, or headers. Be careful when exporting
profiles containing credentials such as `Authorization` values.

See the [Privacy Policy](PRIVACY.md).

## License

[MIT](LICENSE)
