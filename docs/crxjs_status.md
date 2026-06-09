---
name: crxjs-status
description: "@crxjs/vite-plugin v2.5 is effectively unmaintained — peer deps still cover Vite 8, but WXT is the actively-maintained successor for any future restructure."
metadata: 
  node_type: memory
  type: reference
  originSessionId: 05df18e6-4bd0-4dd4-a4b8-439ea5176112
---

`@crxjs/vite-plugin@2.5.0` (the Chrome MV3 build plugin this repo uses) is **effectively unmaintained** as of mid-2026.

- Latest published version 2.4.0; the project sought new maintainers with a June 2025 archival deadline ([GitHub discussion #872](https://github.com/crxjs/chrome-extension-tools/discussions/872)).
- `peerDependencies` explicitly list Vite `^3 || ^4 || ^5 || ^6 || ^7 || ^8.0.0-beta.0` — Vite 8 is supported, the harmless `rolldownOptions` warning notwithstanding (see [[dev-server-gotchas]]).
- Popup-page HMR works. Service worker "HMR" is actually fetch-intercepted reload, which is the correct MV3 behavior — SWs cannot hot-patch.

**Successor: [WXT](https://wxt.dev/).** Actively maintained, supports Vue, has a CRXJS migration guide. Don't migrate just to migrate — CRXJS still works fine — but if the build setup needs significant rework, jump to WXT instead of patching CRXJS. WXT also ships first-class typed messaging via `@webext-core/messaging`.

**Manifest pattern.** Use `defineManifest` from `@crxjs/vite-plugin` in a typed `manifest.config.ts`, import into `vite.config.ts`. Gives TypeScript on the manifest. ([CRXJS DeepWiki](https://deepwiki.com/crxjs/chrome-extension-tools))

**MV3 service worker reality:**
- SW dies after 30s inactivity or 5min per request ([Chrome lifecycle docs](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)).
- Globals don't survive restart. `localStorage` and `sessionStorage` don't exist in SWs.
- `chrome.storage.session` for ephemeral SW state (cleared on browser close); `chrome.storage.local` for anything that must survive browser restart.
- This repo's port-based login flow (`onConnect` in `background.ts` for the SAML dance) is correct — ports keep the SW alive for the full handshake.
- Cookies are the real session vehicle — the SW reads them fresh each time rather than caching in memory, which is right.

**Message passing.** Vanilla `chrome.runtime.onMessage` / `onMessageExternal` + a discriminated-union `m.type` switch is fine for ~5 message types. If the surface grows, `@webext-core/proxy-service` is the most ergonomic upgrade — define a service in the background, call it as a typed async function from any context.

Related: [[security-banner-fetch-allowlist]], [[dev-server-gotchas]]
