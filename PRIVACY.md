# RouteGraft Privacy Policy

Effective date: July 13, 2026

RouteGraft is a developer tool that redirects browser requests according to rules configured by the user. This policy explains how the extension handles information.

## Information processed

RouteGraft processes request URLs on the user's device to determine whether they match an enabled redirect rule. It stores user-created profiles, redirect rules, and preferences in `chrome.storage.local`. A short runtime log of matched request URLs and their redirect targets is kept in `chrome.storage.session` for diagnostics.

RouteGraft does not collect, transmit, sell, or share this information with the developer or any third party. It has no analytics, advertising, tracking, account system, or backend service.

## Permissions

- Access to HTTP and HTTPS sites is required because users may configure redirect rules for any development host.
- `declarativeNetRequest` applies the configured redirects.
- `declarativeNetRequestFeedback` reports rules that actually matched so the user can diagnose routing behavior.
- `storage` saves profiles locally and keeps temporary diagnostic matches for the browser session.

## Retention and deletion

Profiles remain in the browser's local extension storage until the user changes them, clears extension data, or uninstalls RouteGraft. Session diagnostic logs are temporary and can also be cleared from the extension UI.

## Remote code and external services

RouteGraft does not download or execute remote code and does not send information to an external service.

## Limited Use

RouteGraft's use of information is limited to providing and improving its single user-facing purpose: routing developer requests according to user-configured rules. Information is not used for advertising, credit decisions, or any unrelated purpose, and humans are not given access to it.

## Changes

Material changes to this policy will be published with a new extension release and reflected in the Chrome Web Store listing.

## Contact

Questions can be submitted through [GitHub Issues](https://github.com/SpencerZhang/RouteGraft/issues).
