// Background service worker for the SAIT Schedule Builder extension.
// Handles messages from the web app requesting Banner session credentials.

const BANNER_DOMAIN = "sait-sust-prd-prd1-ban-ss-ssag6.sait.ca";
const BANNER_BASE = `https://${BANNER_DOMAIN}/StudentRegistrationSsb`;

// Listen for messages from the web app (via externally_connectable)
chrome.runtime.onMessageExternal.addListener(
  (message, _sender, sendResponse) => {
    if (message.type === "GET_CREDENTIALS") {
      handleGetCredentials().then(sendResponse);
      return true; // keep channel open for async response
    }

    if (message.type === "TRIGGER_LOGIN") {
      handleTriggerLogin().then(sendResponse);
      return true;
    }

    if (message.type === "FORCE_REAUTH") {
      handleForceReauth().then(sendResponse);
      return true;
    }

    if (message.type === "PING") {
      sendResponse({ ok: true, version: chrome.runtime.getManifest().version });
      return false;
    }
  },
);

// Long-lived ports for login flows — keeps the service worker alive while the
// user completes the SAIT login in the opened tab.
chrome.runtime.onConnectExternal.addListener((port) => {
  if (port.name === "TRIGGER_LOGIN") {
    handleTriggerLogin().then((result) => {
      port.postMessage(result);
      port.disconnect();
    });
  }

  if (port.name === "FORCE_REAUTH") {
    handleForceReauth().then((result) => {
      port.postMessage(result);
      port.disconnect();
    });
  }
});

// Also listen from content scripts
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "SYNC_TOKEN_FOUND") {
    // Content script found the synchronizer token on the Banner page
    cachedSyncToken = message.token;
    cachedUniqueSessionId = message.uniqueSessionId ?? "";
    sendResponse({ ok: true });
  }
  return false;
});

let cachedSyncToken = "";
let cachedUniqueSessionId = "";

async function handleGetCredentials() {
  try {
    // 1. Read cookies for the Banner domain
    const cookies = await chrome.cookies.getAll({ domain: BANNER_DOMAIN });

    if (cookies.length === 0) {
      return {
        ok: false,
        error: "NOT_LOGGED_IN",
        message:
          "No Banner cookies found. Please log into SAIT Banner first, then try again.",
        loginUrl: BANNER_BASE + "/ssb/registration",
      };
    }

    const cookieMap = {};
    for (const c of cookies) {
      cookieMap[c.name] = c.value;
    }

    // Check for required cookies
    if (!cookieMap["JSESSIONID"]) {
      return {
        ok: false,
        error: "MISSING_SESSION",
        message:
          "JSESSIONID cookie not found. Your Banner session may have expired. Please log in again.",
        loginUrl: BANNER_BASE + "/ssb/registration",
      };
    }

    // 2. If we don't have a cached sync token, try to fetch one
    if (!cachedSyncToken) {
      try {
        const token = await fetchSyncToken(cookieMap);
        if (token) cachedSyncToken = token;
      } catch {
        // Non-fatal — user can still paste headers manually
      }
    }

    if (!cachedSyncToken) {
      return {
        ok: false,
        error: "NO_SYNC_TOKEN",
        message:
          "Cookies found but couldn't get synchronizer token. Please open the Banner registration page first, then try again.",
        loginUrl: BANNER_BASE + "/ssb/registration",
      };
    }

    return {
      ok: true,
      credentials: {
        cookies: cookieMap,
        synchronizerToken: cachedSyncToken,
        uniqueSessionId: cachedUniqueSessionId,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: "UNKNOWN",
      message: err.message ?? "Unknown error reading credentials",
    };
  }
}

/**
 * Clear all Banner domain cookies and the cached sync token, then run the
 * full login flow. Use this when the session has expired and you need fresh
 * credentials rather than reusing an existing (possibly stale) session.
 */
async function handleForceReauth() {
  const cookies = await chrome.cookies.getAll({ domain: BANNER_DOMAIN });
  await Promise.all(
    cookies.map((c) => {
      const url = `${c.secure ? "https" : "http"}://${c.domain.replace(/^\./, "")}${c.path}`;
      return chrome.cookies.remove({ url, name: c.name });
    }),
  );
  cachedSyncToken = "";
  cachedUniqueSessionId = "";
  return handleTriggerLogin();
}

/**
 * Open a SAIT login tab, wait for auth to complete, then return credentials.
 * The message channel is kept open (caller returns true) so this can take as
 * long as the user needs to log in — Chrome keeps the service worker alive
 * while a message port is open.
 */
async function handleTriggerLogin() {
  // Already authenticated? Return credentials immediately.
  const existing = await handleGetCredentials();
  if (existing.ok) return existing;

  return new Promise((resolve) => {
    chrome.windows.create(
      { url: BANNER_BASE + "/ssb/registration", type: "popup", width: 520, height: 680 },
      (win) => {
      const winId = win.id;
      const tab = win.tabs[0];
      const tabId = tab.id;
      let settled = false;

      function cleanup() {
        chrome.tabs.onUpdated.removeListener(onUpdated);
        chrome.tabs.onRemoved.removeListener(onRemoved);
      }

      function settle(result) {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(result);
      }

      async function onUpdated(id, changeInfo, updatedTab) {
        if (id !== tabId || changeInfo.status !== "complete") return;
        const url = updatedTab.url ?? "";
        // Auth is done when we land on the actual registration app (not the CAS/login redirect)
        if (!url.includes("StudentRegistrationSsb/ssb/")) return;

        // Give the content script time to extract the sync token
        setTimeout(async () => {
          const creds = await handleGetCredentials();
          if (creds.ok) chrome.windows.remove(winId).catch(() => {});
          settle(creds);
        }, 2000);
      }

      function onRemoved(id) {
        if (id !== tabId) return;
        settle({
          ok: false,
          error: "TAB_CLOSED",
          message: "Login tab was closed before completing. Please try again.",
        });
      }

      chrome.tabs.onUpdated.addListener(onUpdated);
      chrome.tabs.onRemoved.addListener(onRemoved);
    });
  });
}

/**
 * Attempt to fetch the synchronizer token by loading a Banner page
 * and extracting it from the response.
 */
async function fetchSyncToken(cookieMap) {
  const cookieStr = Object.entries(cookieMap)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");

  const res = await fetch(BANNER_BASE + "/ssb/registration", {
    headers: { Cookie: cookieStr },
    credentials: "include",
  });

  // The sync token is often in a meta tag or set via a response header
  const syncHeader = res.headers.get("X-Synchronizer-Token");
  if (syncHeader) return syncHeader;

  // Try extracting from HTML body
  const html = await res.text();

  // Look for the token in common Banner patterns
  const metaMatch = html.match(
    /name=["']synchronizerToken["']\s+content=["']([^"']+)["']/,
  );
  if (metaMatch) return metaMatch[1];

  const jsMatch = html.match(
    /synchronizerToken["']?\s*[:=]\s*["']([a-f0-9-]+)["']/i,
  );
  if (jsMatch) return jsMatch[1];

  return null;
}
