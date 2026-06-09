---
name: security-banner-fetch-allowlist
description: "Real SSRF risk — inject.ts broadcasts ext ID via postMessage('*'); BANNER_FETCH in background.ts accepts arbitrary URLs with session cookies. Fix: *.sait.ca allowlist."
metadata: 
  node_type: memory
  type: project
  originSessionId: 05df18e6-4bd0-4dd4-a4b8-439ea5176112
---

There is a real, non-trivial security gap in the extension's message pipeline.

**The chain:**
1. `extension/inject.ts` runs as a content script on `localhost` and `pages.dev` and broadcasts the extension ID via `window.postMessage("*")` so the page can find it.
2. The page calls `chrome.runtime.sendMessage(extId, { type: "BANNER_FETCH", url: ..., ... })`.
3. `extension/background.ts` `onMessageExternal` routes to `handleBannerFetch`, which performs `fetch(url, { credentials: 'include' })` — sending the user's live SAIT session cookies.

**Why it's risky.** The extension ID is not secret by Chrome's design. Any script co-resident on `localhost` (any other local dev server, a compromised npm dev dependency that runs a local server, a malicious page on a `*.pages.dev` subdomain) can read the ID and call `BANNER_FETCH` with arbitrary SAIT URLs using the user's authenticated session. This is structurally the same class as the LayerX "ClaudeBleed" issue ([writeup](https://layerxsecurity.com/blog/a-flaw-in-claudes-browser-extension-allows-any-extension-to-hijack-it/)).

**For a personal student tool this is low-severity** — the worst case is reading data the student already has access to. But the fix is two lines and eliminates the entire class.

## Concrete fix

In `extension/background.ts`, inside `handleBannerFetch` (before the `fetch` call), add a URL allowlist:

```ts
const allowed = /^https:\/\/[a-z0-9-]+\.sait\.ca\//i;
if (!allowed.test(url)) {
  return { ok: false, error: 'URL not in allowlist' };
}
```

The SW already knows the only valid hosts are `ssag1.sait.ca`, `ssag2.sait.ca`, `ssag6.sait.ca` — narrow the regex to those three subdomains specifically if there's no other SAIT host the app needs to hit.

## Optional hardening (more invasive)

- **Nonce-based session token** between inject.ts and background.ts — SW generates a per-session token, stores in `chrome.storage.session`, inject.ts delivers to the page via `postMessage` (targeted, not `"*"`), every `BANNER_FETCH` carries the token, SW validates. Protects against the case where a malicious page somehow learns the ext ID without the inject script being loaded.
- **Targeted `postMessage`** in `inject.ts` — use `window.postMessage(msg, window.location.origin)` instead of `"*"`. Doesn't change the attack surface (any same-origin script can still read), but is best practice.
- **Tighter `externally_connectable`** in manifest — `matches` list only the specific origins, never `"*"` in `ids`. Don't allow other extensions to message this one.

## Don't do these "fixes"

- **Don't hardcode the ext ID** — it changes when the extension is updated/republished, and the dev/prod IDs differ. The auto-discovery via `inject.ts` exists for a reason.
- **Don't drop the dev-server bridge** — it's how localhost development works. Just gate what the bridge will fetch.

The two-line URL allowlist eliminates the SSRF vector regardless of who calls. Do that first; consider the nonce hardening only if the extension goes into wider distribution.

Related: [[crxjs-status]]
