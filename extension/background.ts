// Background service worker for the SAIT Schedule Builder extension.
// Owns Banner credential capture and the login popup flow.

const BANNER_DOMAIN = "sait-sust-prd-prd1-ban-ss-ssag6.sait.ca";
const BANNER_BASE = `https://${BANNER_DOMAIN}/StudentRegistrationSsb`;
// const REGISTRATION_URL = `${BANNER_BASE}/ssb/registration`;
const REGISTRATION_URL = `${BANNER_BASE}/StudentRegistrationSsb/ssb/registrationHistory/registrationHistory`;
// const PERSONAL_INFO_URL =
//   "https://sait-sust-prd-prd1-ban-ss-ssag2.sait.ca/BannerGeneralSsb/ssb/personalInformation#/personalInformationMain";

// All Banner hosts that may hold an authenticated session — clear cookies on
// every reauth so the user can't be left half-logged-in across subdomains.
const BANNER_HOSTS = [
  "sait-sust-prd-prd1-ban-ss-ssag6.sait.ca",
  "sait-sust-prd-prd1-ban-ss-ssag2.sait.ca",
  "sait-sust-prd-prd1-ban-ss-ssag1.sait.ca",
];

export interface BannerCredentialPayload {
  synchronizerToken: string;
  uniqueSessionId: string;
}

export type CredentialResult =
  | { ok: true; credentials: BannerCredentialPayload }
  | { ok: false; error: string; message: string; loginUrl?: string };

let cachedSyncToken = "";
let cachedUniqueSessionId = "";

// Open the extension's UI page when the toolbar icon is clicked.
chrome.action.onClicked.addListener(async () => {
  const url = chrome.runtime.getURL("index.html");
  const existing = await chrome.tabs.query({ url });
  if (existing.length > 0 && existing[0].id != null) {
    await chrome.tabs.update(existing[0].id, { active: true });
    if (existing[0].windowId != null) {
      await chrome.windows.update(existing[0].windowId, { focused: true });
    }
    return;
  }
  await chrome.tabs.create({ url });
});

type SendResponse = (response?: unknown) => void;

function routeMessage(message: unknown, sendResponse: SendResponse): boolean {
  if (!message || typeof message !== "object") return false;
  const m = message as { type?: string };

  switch (m.type) {
    case "PING":
      sendResponse({ ok: true, version: chrome.runtime.getManifest().version });
      return false;

    case "SYNC_TOKEN_FOUND": {
      const msg = m as { token?: unknown; uniqueSessionId?: unknown };
      cachedSyncToken = String(msg.token ?? "");
      cachedUniqueSessionId = String(msg.uniqueSessionId ?? "");
      sendResponse({ ok: true });
      return false;
    }

    case "GET_CREDENTIALS":
      handleGetCredentials().then(sendResponse);
      return true;

    case "LOGIN":
    case "FORCE_REAUTH":
      handleTriggerLogin().then(sendResponse);
      return true;

    case "OPEN_AUTH_URL":
      handleOpenAuthUrl().then(sendResponse);
      return true;

    case "BANNER_FETCH":
      handleBannerFetch(message as BannerFetchRequest).then(sendResponse);
      return true;
  }
  return false;
}

// In-extension (same origin) messages.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) =>
  routeMessage(message, sendResponse),
);

// External messages from the web app (localhost / prod host).
chrome.runtime.onMessageExternal.addListener((message, _sender, sendResponse) =>
  routeMessage(message, sendResponse),
);

interface BannerFetchRequest {
  type: "BANNER_FETCH";
  url: string;
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  };
}

interface BannerFetchResponse {
  ok: boolean;
  status: number;
  contentType: string;
  body: string;
  error?: string;
}

async function handleBannerFetch(
  req: BannerFetchRequest,
): Promise<BannerFetchResponse> {
  try {
    const res = await fetch(req.url, {
      method: req.init?.method ?? "GET",
      headers: req.init?.headers,
      body: req.init?.body,
      credentials: "include",
    });
    const body = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      contentType: res.headers.get("content-type") ?? "",
      body,
    };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      contentType: "",
      body: "",
      error: e instanceof Error ? e.message : "Network error",
    };
  }
}

async function handleGetCredentials(): Promise<CredentialResult> {
  try {
    let cookies = await chrome.cookies.getAll({ domain: BANNER_DOMAIN });

    // Login may have happened via personalInformation (ssag2), which gives
    // ssag2 a JSESSIONID but leaves ssag6 empty. Fetching the registration
    // URL lets the SSO session flow to ssag6 and also grabs the sync token
    // in one shot — so try this before giving up.
    if (cookies.length === 0) {
      try {
        const token = await fetchSyncToken();
        if (token) cachedSyncToken = token;
      } catch {
        // best-effort; if network fails we'll return NOT_LOGGED_IN below
      }
      cookies = await chrome.cookies.getAll({ domain: BANNER_DOMAIN });
    }

    if (cookies.length === 0) {
      return {
        ok: false,
        error: "NOT_LOGGED_IN",
        message: "No Banner cookies found. Sign in to SAIT Banner first.",
        loginUrl: REGISTRATION_URL,
      };
    }

    const cookieMap: Record<string, string> = {};
    for (const c of cookies) cookieMap[c.name] = c.value;

    if (!cookieMap["JSESSIONID"]) {
      return {
        ok: false,
        error: "MISSING_SESSION",
        message:
          "JSESSIONID cookie not found. Your Banner session may have expired.",
        loginUrl: REGISTRATION_URL,
      };
    }

    if (!cachedSyncToken) {
      try {
        const token = await fetchSyncToken();
        if (token) cachedSyncToken = token;
      } catch {
        // best-effort
      }
    }

    if (!cachedSyncToken) {
      return {
        ok: false,
        error: "NO_SYNC_TOKEN",
        message:
          "Couldn't get the Banner synchronizer token. Open the registration page once, then retry.",
        loginUrl: REGISTRATION_URL,
      };
    }

    return {
      ok: true,
      credentials: {
        synchronizerToken: cachedSyncToken,
        uniqueSessionId: cachedUniqueSessionId,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: "UNKNOWN",
      message:
        err instanceof Error
          ? err.message
          : "Unknown error reading credentials",
    };
  }
}

async function clearBannerSession(): Promise<void> {
  const cookieLists = await Promise.all(
    BANNER_HOSTS.map((host) => chrome.cookies.getAll({ domain: host })),
  );
  const cookies = cookieLists.flat();
  await Promise.all(
    cookies.map((c) => {
      const url = `${c.secure ? "https" : "http"}://${c.domain.replace(/^\./, "")}${c.path}`;
      return chrome.cookies.remove({ url, name: c.name });
    }),
  );
  cachedSyncToken = "";
  cachedUniqueSessionId = "";
}

/**
 * Confirm the session is genuinely usable by calling getBannerId.
 * Returns the bannerId string on success, null on any failure.
 */
async function validateSession(
  synchronizerToken: string,
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://sait-sust-prd-prd1-ban-ss-ssag2.sait.ca/BannerGeneralSsb/ssb/PersonalInformationDetails/getBannerId`,
      {
        headers: {
          Accept: "application/json, text/javascript, */*; q=0.01",
          "X-Requested-With": "XMLHttpRequest",
          "X-Synchronizer-Token": synchronizerToken,
        },
        credentials: "include",
      },
    );
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("application/json") && !ct.includes("text/javascript"))
      return null;
    const json = (await res.json()) as { bannerId?: string };
    return json?.bannerId ? String(json.bannerId) : null;
  } catch {
    return null;
  }
}

/**
 * Open a SAIT login tab, wait for auth to complete, then return credentials.
 *
 * Always clears existing Banner cookies first — Banner sessions can be
 * invalidated server-side without the cookie expiring client-side, so a
 * cached session is never trustworthy.
 *
 * After Banner redirects back post-login, the session is validated with a
 * real API call before the window is closed. If the session doesn't check
 * out we re-navigate to the auth URL so the user can sign in again.
 */
async function handleTriggerLogin(): Promise<CredentialResult> {
  await clearBannerSession();

  return new Promise((resolve) => {
    chrome.windows.create(
      { url: REGISTRATION_URL, type: "popup", width: 520, height: 680 },
      (win) => {
        if (!win || !win.tabs || win.tabs.length === 0) {
          resolve({
            ok: false,
            error: "NO_WINDOW",
            message: "Could not open login window.",
          });
          return;
        }
        const winId = win.id!;
        const tabId = win.tabs[0].id!;
        let settled = false;
        let attempts = 0;
        const MAX_ATTEMPTS = 4;

        const cleanup = () => {
          chrome.tabs.onUpdated.removeListener(onUpdated);
          chrome.tabs.onRemoved.removeListener(onRemoved);
        };

        const settle = (result: CredentialResult) => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve(result);
        };

        const retry = () => {
          // Clear stale cached tokens so the next attempt fetches fresh ones.
          cachedSyncToken = "";
          cachedUniqueSessionId = "";
          chrome.tabs.update(tabId, { url: REGISTRATION_URL }).catch(() => {});
        };

        const onUpdated = (
          id: number,
          changeInfo: { status?: string },
          updatedTab: chrome.tabs.Tab,
        ) => {
          if (id !== tabId || changeInfo.status !== "complete") return;
          const url = updatedTab.url ?? "";
          // Only act once we're back on a real Banner page — not on the SSO
          // login form or any intermediate redirect.
          if (
            url.includes("sait.ca") ||
            (!url.includes("personalInformation") &&
              !url.includes("StudentRegistrationSsb/ssb/"))
          ) {
            return;
          }

          attempts++;

          // Allow time for the session cookies to fully settle and for the
          // content script (on ssag6 pages) to extract the sync token.
          setTimeout(async () => {
            if (settled) return;

            const creds = await handleGetCredentials();

            if (!creds.ok) {
              // Couldn't capture credentials — re-navigate so the user can
              // complete login again.
              if (attempts < MAX_ATTEMPTS) {
                retry();
              } else {
                settle(creds);
              }
              return;
            }

            // Credentials captured — now confirm the session actually works
            // before closing the window.
            const bannerId = await validateSession(
              creds.credentials.synchronizerToken,
            );
            if (!bannerId) {
              // On Banner but session is invalid — rerun the auth flow.
              if (attempts < MAX_ATTEMPTS) {
                retry();
              } else {
                settle({
                  ok: false,
                  error: "SESSION_INVALID",
                  message:
                    "Signed in but the session couldn't be verified. Please try again.",
                });
              }
              return;
            }

            // Session confirmed working — close the popup and return.
            chrome.windows.remove(winId).catch(() => {});
            settle(creds);
          }, 2000);
        };

        const onRemoved = (id: number) => {
          if (id !== tabId) return;
          settle({
            ok: false,
            error: "TAB_CLOSED",
            message:
              "Login tab was closed before completing. Please try again.",
          });
        };

        chrome.tabs.onUpdated.addListener(onUpdated);
        chrome.tabs.onRemoved.addListener(onRemoved);
      },
    );
  });
}

/**
 * Open the SAIT auth/registration URL in a popup without touching cookies.
 * Used by a dev button so you can manually inspect current login state.
 */
async function handleOpenAuthUrl(): Promise<
  { ok: true } | { ok: false; error: string; message: string }
> {
  return new Promise((resolve) => {
    chrome.windows.create(
      { url: REGISTRATION_URL, type: "popup", width: 520, height: 680 },
      (win) => {
        if (!win) {
          resolve({
            ok: false,
            error: "NO_WINDOW",
            message: "Could not open auth window.",
          });
          return;
        }
        resolve({ ok: true });
      },
    );
  });
}

/**
 * Fetch the synchronizer token by loading the Banner registration page.
 * Cookies are attached automatically because of host_permissions + the user's
 * existing session; no manual Cookie header needed.
 */
async function fetchSyncToken(): Promise<string | null> {
  const res = await fetch(REGISTRATION_URL, { credentials: "include" });

  const syncHeader = res.headers.get("X-Synchronizer-Token");
  if (syncHeader) return syncHeader;

  const html = await res.text();
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
