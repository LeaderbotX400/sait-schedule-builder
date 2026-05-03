// Background service worker for the SAIT Schedule Builder extension.
// Owns Banner credential capture and the login popup flow.

const BANNER_DOMAIN = "sait-sust-prd-prd1-ban-ss-ssag6.sait.ca";
// const BANNER_BASE = `https://${BANNER_DOMAIN}/StudentRegistrationSsb`;
// const REGISTRATION_URL = `${BANNER_BASE}/ssb/registration`;
// const REGISTRATION_URL = `${BANNER_BASE}/StudentRegistrationSsb/ssb/registrationHistory/registrationHistory`;
// const PERSONAL_INFO_URL =
//   "https://sait-sust-prd-prd1-ban-ss-ssag2.sait.ca/BannerGeneralSsb/ssb/personalInformation#/personalInformationMain";
const LOGIN_URL = `https://sait-sust-prd-prd1-eid-idm-wso2.sait.ca/cas-web/login?TARGET=https%3A%2F%2Fsait-sust-prd-prd1-ban-ss-ssag6.sait.ca%2FStudentRegistrationSsb%2Flogin%2Fcas`;

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

    case "SET_COOKIES": {
      const msg = m as { cookies?: Record<string, string> };
      handleSetCookies(msg.cookies ?? {}).then(sendResponse);
      return true;
    }
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
    const init: RequestInit = {
      method: req.init?.method ?? "GET",
      credentials: "include",
    };
    if (req.init?.headers) init.headers = req.init.headers;
    if (req.init?.body !== undefined) init.body = req.init.body;
    const res = await fetch(req.url, init);
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
        loginUrl: LOGIN_URL,
      };
    }

    const cookieMap: Record<string, string> = {};
    for (const c of cookies) cookieMap[c.name] = c.value;

    if (!cookieMap["JSESSIONID"]) {
      return {
        ok: false,
        error: "MISSING_SESSION",
        message: "JSESSIONID cookie not found. Your Banner session may have expired.",
        loginUrl: LOGIN_URL,
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
        loginUrl: LOGIN_URL,
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

/**
 * Install user-supplied auth cookies (typically JSESSIONID + NLB) on every
 * Banner host. Used by the manual header-paste flow so users can authenticate
 * without going through the popup login. Banner cookies are set HttpOnly and
 * Secure to match how Banner itself issues them.
 */
async function handleSetCookies(
  cookies: Record<string, string>,
): Promise<{ ok: boolean; message?: string }> {
  const entries = Object.entries(cookies).filter(([, v]) => typeof v === "string" && v.length > 0);
  if (entries.length === 0) {
    return { ok: false, message: "No cookies provided" };
  }
  try {
    for (const host of BANNER_HOSTS) {
      for (const [name, value] of entries) {
        await chrome.cookies.set({
          url: `https://${host}/`,
          name,
          value,
          path: "/",
          secure: true,
          httpOnly: true,
          sameSite: "no_restriction",
        });
      }
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Failed to set cookies",
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
 * Open a SAIT login tab and resolve once we can capture credentials.
 *
 * Always clears existing Banner cookies first — Banner sessions can be
 * invalidated server-side without the cookie expiring client-side, so a
 * cached session is never trustworthy.
 *
 * Once the user finishes signing in and lands back on Banner, the
 * content script (or our fallback fetch) picks up the sync token; we
 * grab the credentials via `handleGetCredentials` and resolve.
 *
 * Session validation (was: `validateSession` calling getBannerId) now
 * lives in the SDK (`sdk.connectAndValidate`); the React caller decides
 * whether to retry. This keeps the extension a thin credential-capture
 * shim.
 */
async function handleTriggerLogin(): Promise<CredentialResult> {
  await clearBannerSession();

  return new Promise((resolve) => {
    chrome.windows.create({ url: LOGIN_URL, type: "popup", width: 520, height: 680 }, (win) => {
      if (!win || !win.tabs || win.tabs.length === 0) {
        resolve({
          ok: false,
          error: "NO_WINDOW",
          message: "Could not open login window.",
        });
        return;
      }
      const winId = win.id!;
      const tabId = win.tabs[0]!.id!;
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
        _updatedTab: chrome.tabs.Tab,
      ) => {
        if (id !== tabId || changeInfo.status !== "complete") return;

        // Allow time for cookies to settle and for the content script
        // (on ssag6) to extract the sync token.
        setTimeout(async () => {
          if (settled) return;
          const creds = await handleGetCredentials();
          if (!creds.ok) return; // Wait for the next page-load tick.
          chrome.windows.remove(winId).catch(() => {});
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
    });
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
    chrome.windows.create({ url: LOGIN_URL, type: "popup", width: 520, height: 680 }, (win) => {
      if (!win) {
        resolve({
          ok: false,
          error: "NO_WINDOW",
          message: "Could not open auth window.",
        });
        return;
      }
      resolve({ ok: true });
    });
  });
}

/**
 * Fetch the synchronizer token by loading the Banner registration page.
 * Cookies are attached automatically because of host_permissions + the user's
 * existing session; no manual Cookie header needed.
 */
async function fetchSyncToken(): Promise<string | null> {
  const res = await fetch(LOGIN_URL, { credentials: "include" });

  const syncHeader = res.headers.get("X-Synchronizer-Token");
  if (syncHeader) return syncHeader;

  const html = await res.text();
  const metaMatch = html.match(/name=["']synchronizerToken["']\s+content=["']([^"']+)["']/);
  if (metaMatch?.[1]) return metaMatch[1];

  const jsMatch = html.match(/synchronizerToken["']?\s*[:=]\s*["']([a-f0-9-]+)["']/i);
  if (jsMatch?.[1]) return jsMatch[1];

  return null;
}
