// Background service worker for the SAIT Schedule Builder extension.
// Owns Banner credential capture and the login popup flow.

const BANNER_DOMAIN = "sait-sust-prd-prd1-ban-ss-ssag6.sait.ca";
const BANNER_BASE = `https://${BANNER_DOMAIN}/StudentRegistrationSsb`;
const REGISTRATION_URL = `${BANNER_BASE}/ssb/registration`;

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

function routeMessage(
  message: unknown,
  sendResponse: SendResponse,
): boolean {
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

async function handleBannerFetch(req: BannerFetchRequest): Promise<BannerFetchResponse> {
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
    const cookies = await chrome.cookies.getAll({ domain: BANNER_DOMAIN });
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
        message: "JSESSIONID cookie not found. Your Banner session may have expired.",
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
        message: "Couldn't get the Banner synchronizer token. Open the registration page once, then retry.",
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
      message: err instanceof Error ? err.message : "Unknown error reading credentials",
    };
  }
}

async function clearBannerSession(): Promise<void> {
  const cookies = await chrome.cookies.getAll({ domain: BANNER_DOMAIN });
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
 * Open a SAIT login tab, wait for auth to complete, then return credentials.
 *
 * Always clears existing Banner cookies first — Banner sessions can be
 * invalidated server-side without the cookie expiring client-side, so a
 * cached session is never trustworthy.
 */
async function handleTriggerLogin(): Promise<CredentialResult> {
  await clearBannerSession();

  return new Promise((resolve) => {
    chrome.windows.create(
      { url: REGISTRATION_URL, type: "popup", width: 520, height: 680 },
      (win) => {
        if (!win || !win.tabs || win.tabs.length === 0) {
          resolve({ ok: false, error: "NO_WINDOW", message: "Could not open login window." });
          return;
        }
        const winId = win.id!;
        const tabId = win.tabs[0].id!;
        let settled = false;

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

        const onUpdated = (
          id: number,
          changeInfo: { status?: string },
          updatedTab: chrome.tabs.Tab,
        ) => {
          if (id !== tabId || changeInfo.status !== "complete") return;
          const url = updatedTab.url ?? "";
          if (!url.includes("StudentRegistrationSsb/ssb/")) return;

          // Give the content script time to extract the sync token.
          setTimeout(async () => {
            const creds = await handleGetCredentials();
            if (creds.ok) chrome.windows.remove(winId).catch(() => {});
            settle(creds);
          }, 2000);
        };

        const onRemoved = (id: number) => {
          if (id !== tabId) return;
          settle({
            ok: false,
            error: "TAB_CLOSED",
            message: "Login tab was closed before completing. Please try again.",
          });
        };

        chrome.tabs.onUpdated.addListener(onUpdated);
        chrome.tabs.onRemoved.addListener(onRemoved);
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
