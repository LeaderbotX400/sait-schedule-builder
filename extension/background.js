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

    if (message.type === "PING") {
      sendResponse({ ok: true, version: chrome.runtime.getManifest().version });
      return false;
    }
  },
);

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
