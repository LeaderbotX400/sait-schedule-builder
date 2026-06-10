// Background service worker for the SAIT Schedule Builder extension.
// Detects Banner login (JSESSIONID + NLB cookies) and proxies Banner fetches.
//
// The message protocol shared with the app lives in
// src/lib/bridge/protocol.ts — both sides compile against the same types.
// All chrome.* listener registrations stay synchronous at top level
// (MV3 requirement: listeners must exist before the SW finishes booting).

import { createBridgeRouter, LOGIN_PORT_NAMES } from "../src/lib/bridge/protocol";
import { handleBannerFetch, handleBannerPrime } from "./bannerProxy";
import { checkCookies, clearBannerSession } from "./cookies";
import { runLoginFlow } from "./login";

// Open the extension's UI page when the toolbar icon is clicked.
chrome.action.onClicked.addListener(async () => {
  const url = chrome.runtime.getURL("index.html");
  const existing = await chrome.tabs.query({ url });
  const first = existing[0];
  if (first?.id != null) {
    await chrome.tabs.update(first.id, { active: true });
    if (first.windowId != null) {
      await chrome.windows.update(first.windowId, { focused: true });
    }
    return;
  }
  await chrome.tabs.create({ url });
});

const routeMessage = createBridgeRouter({
  PING: () => ({ ok: true, version: chrome.runtime.getManifest().version }),
  CHECK_LOGIN: () => checkCookies(),
  CLEAR_SESSION: async () => {
    await clearBannerSession();
    return { ok: true };
  },
  BANNER_FETCH: handleBannerFetch,
  BANNER_PRIME: handleBannerPrime,
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) =>
  routeMessage(message, sendResponse),
);

// Web pages allowed in manifest.externally_connectable reach the SW through
// the *External listeners. The handlers are identical; only the listener
// registration differs.
chrome.runtime.onMessageExternal.addListener((message, _sender, sendResponse) =>
  routeMessage(message, sendResponse),
);

// Port-based login flow keeps the MV3 service worker alive for the entire
// SAML dance (can exceed the 30-second idle timeout).
chrome.runtime.onConnect.addListener((port) => {
  if ((LOGIN_PORT_NAMES as readonly string[]).includes(port.name)) {
    void runLoginFlow(port);
  }
});

chrome.runtime.onConnectExternal.addListener((port) => {
  if ((LOGIN_PORT_NAMES as readonly string[]).includes(port.name)) {
    void runLoginFlow(port);
  }
});
