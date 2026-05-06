// Background service worker for the SAIT Schedule Builder extension.
// Detects Banner login (JSESSIONID + NLB cookies) and proxies Banner fetches.

const BANNER_DOMAIN = "sait-sust-prd-prd1-ban-ss-ssag6.sait.ca";
const LOGIN_URL = `https://sait-sust-prd-prd1-eid-idm-wso2.sait.ca/cas-web/login?TARGET=https%3A%2F%2Fsait-sust-prd-prd1-ban-ss-ssag6.sait.ca%2FStudentRegistrationSsb%2Flogin%2Fcas`;

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

async function checkCookies(): Promise<{ loggedIn: boolean }> {
  const cookies = await chrome.cookies.getAll({ domain: BANNER_DOMAIN });
  const map = Object.fromEntries(cookies.map((c) => [c.name, c.value]));
  return { loggedIn: !!(map.JSESSIONID && map.NLB) };
}

async function clearBannerSession(): Promise<void> {
  const cookies = await chrome.cookies.getAll({ domain: BANNER_DOMAIN });
  await Promise.all(
    cookies.map((c) => {
      const url = `${c.secure ? "https" : "http"}://${c.domain.replace(/^\./, "")}${c.path}`;
      return chrome.cookies.remove({ url, name: c.name });
    }),
  );
}

type SendResponse = (response?: unknown) => void;

function routeMessage(message: unknown, sendResponse: SendResponse): boolean {
  if (!message || typeof message !== "object") return false;
  const m = message as { type?: string };

  switch (m.type) {
    case "PING":
      sendResponse({ ok: true, version: chrome.runtime.getManifest().version });
      return false;

    case "CHECK_LOGIN":
      checkCookies().then(sendResponse);
      return true;

    case "CLEAR_SESSION":
      clearBannerSession().then(() => sendResponse({ ok: true }));
      return true;

    case "BANNER_FETCH":
      handleBannerFetch(message as BannerFetchRequest).then(sendResponse);
      return true;
  }
  return false;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) =>
  routeMessage(message, sendResponse),
);

// Port-based login flow keeps the MV3 service worker alive for the entire
// SAML dance (can exceed the 30-second idle timeout).
chrome.runtime.onConnect.addListener((port) => {
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

async function handleBannerFetch(req: BannerFetchRequest): Promise<BannerFetchResponse> {
  try {
    const init: RequestInit = {
      method: req.init?.method ?? "GET",
      credentials: "include",
      redirect: "manual",
    };
    if (req.init?.headers) init.headers = req.init.headers;
    if (req.init?.body !== undefined) init.body = req.init.body;
    const res = await fetch(req.url, init);
    if (res.type === "opaqueredirect") {
      return { ok: false, status: 0, contentType: "", body: "" };
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

const LOGIN_TIMEOUT_MS = 2 * 60 * 1000;
const LOGIN_POLL_INTERVAL_MS = 1000;

async function runLoginFlow(port: chrome.runtime.Port): Promise<void> {
  // biome-ignore lint/suspicious/noConsole: SW debug logging
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

  if (!win?.tabs?.length || win.id == null || win.tabs[0]?.id == null) {
    safePost(port, {
      ok: false,
      error: "NO_WINDOW",
      message: "Could not open login window.",
    });
    return;
  }

  const winId = win.id;
  const tabId = win.tabs[0].id;
  // biome-ignore lint/suspicious/noConsole: SW debug logging
  console.log("[sait-ext] popup opened", { winId, tabId });

  let settled = false;

  const cleanup = () => {
    chrome.tabs.onUpdated.removeListener(onUpdated);
    chrome.tabs.onRemoved.removeListener(onRemoved);
    chrome.cookies.onChanged.removeListener(onCookieChanged);
    clearInterval(pollId);
    clearTimeout(timeoutId);
  };

  type LoginResult = { ok: true } | { ok: false; error: string; message: string };

  const settle = (result: LoginResult) => {
    if (settled) return;
    settled = true;
    cleanup();
    // biome-ignore lint/suspicious/noConsole: SW debug logging
    console.log("[sait-ext] settle", result.ok ? "ok" : `${result.error}: ${result.message}`);
    safePost(port, result);
    // Broadcast to any open app tabs so they update their isLoggedIn state.
    chrome.runtime
      .sendMessage({ type: "LOGIN_STATE_CHANGED", loggedIn: result.ok })
      .catch(() => {});
    try {
      port.disconnect();
    } catch {
      /* port already disconnected */
    }
  };

  const tryCapture = async (source: string): Promise<void> => {
    if (settled) return;
    const { loggedIn } = await checkCookies();
    // biome-ignore lint/suspicious/noConsole: SW debug logging
    console.log("[sait-ext] tryCapture", source, loggedIn ? "ok" : "not yet");
    if (!loggedIn) return;
    chrome.windows.remove(winId).catch(() => {});
    settle({ ok: true });
  };

  // Trigger 1 — JSESSIONID set on ssag6 means SAML landed.
  const onCookieChanged = (info: chrome.cookies.CookieChangeInfo) => {
    if (info.removed) return;
    const c = info.cookie;
    if (c.name !== "JSESSIONID") return;
    if (!c.domain.includes("ssag6.sait.ca")) return;
    // biome-ignore lint/suspicious/noConsole: SW debug logging
    console.log("[sait-ext] JSESSIONID cookie set on ssag6");
    setTimeout(() => void tryCapture("cookie"), 200);
  };

  // Trigger 2 — popup tab finishes navigation.
  const onUpdated = (id: number, changeInfo: { status?: string }, _tab: chrome.tabs.Tab) => {
    if (id !== tabId || changeInfo.status !== "complete") return;
    // biome-ignore lint/suspicious/noConsole: SW debug logging
    console.log("[sait-ext] popup tab complete", _tab.url);
    setTimeout(() => void tryCapture("tab-complete"), 2000);
  };

  // Trigger 3 — safety-net poll.
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
    // biome-ignore lint/suspicious/noConsole: SW debug logging
    console.log("[sait-ext] popup tab closed by user");
    settle({
      ok: false,
      error: "TAB_CLOSED",
      message: "Login tab was closed before completing. Please try again.",
    });
  };

  chrome.tabs.onUpdated.addListener(onUpdated);
  chrome.tabs.onRemoved.addListener(onRemoved);
  chrome.cookies.onChanged.addListener(onCookieChanged);

  port.onDisconnect.addListener(() => {
    if (settled) return;
    // biome-ignore lint/suspicious/noConsole: SW debug logging
    console.log("[sait-ext] port disconnected by client; aborting login");
    cleanup();
    settled = true;
  });

  void tryCapture("initial");
}

function safePost(port: chrome.runtime.Port, message: unknown): void {
  try {
    port.postMessage(message);
  } catch (e) {
    console.warn("[sait-ext] safePost failed (port likely closed)", e);
  }
}
