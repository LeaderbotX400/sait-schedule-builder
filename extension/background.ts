// Background service worker for the SAIT Schedule Builder extension.
// Owns Banner credential capture and the login popup flow.

const BANNER_DOMAIN = "sait-sust-prd-prd1-ban-ss-ssag6.sait.ca";
// const BANNER_BASE = `https://${BANNER_DOMAIN}/StudentRegistrationSsb`;
// const REGISTRATION_URL = `${BANNER_BASE}/ssb/registration`;
// const REGISTRATION_URL = `${BANNER_BASE}/StudentRegistrationSsb/ssb/registrationHistory/registrationHistory`;
// const PERSONAL_INFO_URL =
//   "https://sait-sust-prd-prd1-ban-ss-ssag2.sait.ca/BannerGeneralSsb/ssb/personalInformation#/personalInformationMain";
const LOGIN_URL = `https://sait-sust-prd-prd1-eid-idm-wso2.sait.ca/cas-web/login?TARGET=https%3A%2F%2Fsait-sust-prd-prd1-ban-ss-ssag6.sait.ca%2FStudentRegistrationSsb%2Flogin%2Fcas`;
// Directly hits ssag6 with the user's existing JSESSIONID; the response HTML
// carries the synchronizerToken meta. Going through LOGIN_URL instead lands on
// an Azure B2C JS-redirect page that fetch() can't unwrap.
const REGISTRATION_URL = `https://sait-sust-prd-prd1-ban-ss-ssag6.sait.ca/StudentRegistrationSsb/ssb/registration`;

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

// Port-based login flow. Ports keep the MV3 service worker alive for
// their entire lifetime, so the long auth flow (B2C login form, SAML
// dance, redirects back to Banner) doesn't get killed by the 30-second
// idle timeout. Local listeners registered inside `runLoginFlow` survive
// because the worker stays up.
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "login" || port.name === "force-reauth") {
    void runLoginFlow(port);
  }
});
chrome.runtime.onConnectExternal.addListener((port) => {
  if (port.name === "login" || port.name === "force-reauth") {
    void runLoginFlow(port);
  }
});

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
    const init: RequestInit = {
      method: req.init?.method ?? "GET",
      credentials: "include",
      // Use manual redirect mode to avoid CORS errors on cross-origin redirects
      // (e.g., redirects to b2clogin.com during auth). When a redirect is
      // detected, we return empty so polling can retry after the popup completes
      // the auth flow. The popup window itself handles redirects fine because
      // it's a regular browser tab.
      redirect: "manual",
    };
    if (req.init?.headers) init.headers = req.init.headers;
    if (req.init?.body !== undefined) init.body = req.init.body;
    const res = await fetch(req.url, init);
    if (res.type === "opaqueredirect") {
      // Redirect detected - likely due to session expiry or ongoing auth.
      // Return empty response to allow polling to continue. The popup window
      // handles the redirect naturally; we'll retry after the popup completes auth.
      return {
        ok: false,
        status: 0,
        contentType: "",
        body: "",
      };
    }
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
        message:
          "JSESSIONID cookie not found. Your Banner session may have expired.",
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
      message:
        err instanceof Error
          ? err.message
          : "Unknown error reading credentials",
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
  const entries = Object.entries(cookies).filter(
    ([, v]) => typeof v === "string" && v.length > 0,
  );
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
 * Run the SAIT login flow against a long-lived port from the React side.
 *
 * Why a port? MV3 service workers idle out after 30 seconds without
 * activity, which would normally kill any in-memory listeners we set up
 * inside this function. An open port keeps the worker alive for as long
 * as the React side is connected — which is the entire login flow,
 * including the time the user spends typing their password into B2C.
 *
 * Four triggers race to capture credentials; whichever lands them first wins:
 *
 *   1. cookies.onChanged on JSESSIONID/ssag6 — strongest signal that the
 *      SAML dance landed and Banner gave the popup a session.
 *   2. SYNC_TOKEN_FOUND from the content script — fires when the Banner
 *      page's `<meta name="synchronizerToken">` is scraped.
 *   3. tabs.onUpdated "complete" + 2s — covers redirect chains where
 *      neither cookie nor message fires immediately.
 *   4. 1-second poll — final safety net for the case where the user
 *      lands on a page outside `/StudentRegistrationSsb/*`.
 *
 * Caps total wait at 2 minutes so a stuck popup doesn't hang forever.
 *
 * Session validation (was: `validateSession` calling getBannerId) lives
 * in the SDK now (`sdk.connectAndValidate`); the React caller decides
 * whether to retry. The extension stays a thin credential-capture shim.
 */
const LOGIN_TIMEOUT_MS = 2 * 60 * 1000;
const LOGIN_POLL_INTERVAL_MS = 1000;

async function runLoginFlow(port: chrome.runtime.Port): Promise<void> {
  console.log("[sait-ext] runLoginFlow start", port.name);
  await clearBannerSession();

  let win: chrome.windows.Window | undefined;
  try {
    win = await chrome.windows.create({
      url: LOGIN_URL,
      type: "popup",
      width: 520,
      height: 680,
    });
  } catch (e) {
    console.error("[sait-ext] windows.create failed", e);
  }

  if (
    !win ||
    !win.tabs ||
    win.tabs.length === 0 ||
    win.id == null ||
    win.tabs[0]?.id == null
  ) {
    safePost(port, {
      ok: false,
      error: "NO_WINDOW",
      message: "Could not open login window.",
    });
    return;
  }

  const winId = win.id;
  const tabId = win.tabs[0].id;
  console.log("[sait-ext] popup opened", { winId, tabId });

  let settled = false;

  const cleanup = () => {
    chrome.tabs.onUpdated.removeListener(onUpdated);
    chrome.tabs.onRemoved.removeListener(onRemoved);
    chrome.runtime.onMessage.removeListener(onMessage);
    chrome.cookies.onChanged.removeListener(onCookieChanged);
    clearInterval(pollId);
    clearTimeout(timeoutId);
  };

  const settle = (result: CredentialResult) => {
    if (settled) return;
    settled = true;
    cleanup();
    console.log(
      "[sait-ext] settle",
      result.ok ? "ok" : `${result.error}: ${result.message}`,
    );
    safePost(port, result);
    try {
      port.disconnect();
    } catch {
      /* port already disconnected */
    }
  };

  const tryCapture = async (source: string): Promise<void> => {
    if (settled) return;
    const creds = await handleGetCredentials();
    console.log(
      "[sait-ext] tryCapture",
      source,
      creds.ok ? "ok" : `fail: ${creds.error}`,
    );
    if (!creds.ok) return;
    // DIAG: dump JSESSIONID presence on each Banner host right before we
    // declare success. If ssag2/ssag1 are empty here, the session-expired
    // false positive on validateLogin is the ssag2-not-primed case.
    const cookieDump = await Promise.all(
      BANNER_HOSTS.map(async (host) => {
        const cs = await chrome.cookies.getAll({ domain: host });
        const j = cs.find((c) => c.name === "JSESSIONID");
        return `${host.split(".")[0]?.split("-").pop()}=${j ? "set" : "MISSING"}`;
      }),
    );
    console.log("[sait-ext] capture cookies", source, cookieDump.join(" "));
    chrome.windows.remove(winId).catch(() => {});
    settle(creds);
  };

  // Trigger 1 — JSESSIONID set on ssag6 means SAML landed.
  const onCookieChanged = (info: chrome.cookies.CookieChangeInfo) => {
    if (info.removed) return;
    const c = info.cookie;
    if (c.name !== "JSESSIONID") return;
    if (!c.domain.includes("ssag6.sait.ca")) return;
    console.log("[sait-ext] JSESSIONID cookie set on ssag6");
    setTimeout(() => void tryCapture("cookie"), 200);
  };

  // Trigger 2 — content script reports the sync token.
  const onMessage = (
    message: unknown,
    sender: chrome.runtime.MessageSender,
  ) => {
    if (sender.tab?.id !== tabId) return;
    const m = message as { type?: string };
    if (m?.type !== "SYNC_TOKEN_FOUND") return;
    console.log("[sait-ext] SYNC_TOKEN_FOUND from popup tab");
    // Defer one tick so the global routeMessage handler runs first
    // and writes to cachedSyncToken before we read it.
    setTimeout(() => void tryCapture("sync-token"), 50);
  };

  // Trigger 3 — popup tab finishes navigation.
  const onUpdated = (
    id: number,
    changeInfo: { status?: string },
    _tab: chrome.tabs.Tab,
  ) => {
    if (id !== tabId || changeInfo.status !== "complete") return;
    console.log("[sait-ext] popup tab complete", _tab.url);
    setTimeout(() => void tryCapture("tab-complete"), 2000);
  };

  // Trigger 4 — final safety-net poll.
  const pollId = setInterval(() => {
    void tryCapture("poll");
  }, LOGIN_POLL_INTERVAL_MS);

  // Hard ceiling.
  const timeoutId = setTimeout(() => {
    settle({
      ok: false,
      error: "TIMEOUT",
      message:
        "Sign-in took too long. If you completed login but the popup didn't close, please close it and try again.",
    });
  }, LOGIN_TIMEOUT_MS);

  const onRemoved = (id: number) => {
    if (id !== tabId) return;
    console.log("[sait-ext] popup tab closed by user");
    settle({
      ok: false,
      error: "TAB_CLOSED",
      message: "Login tab was closed before completing. Please try again.",
    });
  };

  chrome.tabs.onUpdated.addListener(onUpdated);
  chrome.tabs.onRemoved.addListener(onRemoved);
  chrome.runtime.onMessage.addListener(onMessage);
  chrome.cookies.onChanged.addListener(onCookieChanged);

  // If the React side disconnects (page reload, tab close, etc.) before
  // login completes, give up cleanly so we don't leak listeners.
  port.onDisconnect.addListener(() => {
    if (settled) return;
    console.log("[sait-ext] port disconnected by client; aborting login");
    cleanup();
    settled = true;
  });

  // First probe immediately in case the user is already authenticated
  // and the popup just redirects through CAS without showing a form.
  void tryCapture("initial");
}

function safePost(port: chrome.runtime.Port, message: unknown): void {
  try {
    port.postMessage(message);
  } catch (e) {
    console.warn("[sait-ext] safePost failed (port likely closed)", e);
  }
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
      { url: LOGIN_URL, type: "popup", width: 520, height: 680 },
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
 *
 * Uses redirect:"manual" to avoid CORS errors on cross-origin redirects.
 * When a redirect is detected (popup still authenticating), returns null
 * to let the login flow's polling retry after the popup completes auth.
 */
async function fetchSyncToken(): Promise<string | null> {
  const res = await fetch(REGISTRATION_URL, {
    credentials: "include",
    redirect: "manual",
  });

  // If the registration page redirects (e.g., to login due to expired session),
  // return null and let polling retry after the popup auth flow completes.
  if (res.type === "opaqueredirect") return null;

  const syncHeader = res.headers.get("X-Synchronizer-Token");
  if (syncHeader) return syncHeader;

  const html = await res.text();
  const metaMatch = html.match(
    /name=["']synchronizerToken["']\s+content=["']([^"']+)["']/,
  );
  if (metaMatch?.[1]) return metaMatch[1];

  const jsMatch = html.match(
    /synchronizerToken["']?\s*[:=]\s*["']([a-f0-9-]+)["']/i,
  );
  if (jsMatch?.[1]) return jsMatch[1];

  return null;
}
