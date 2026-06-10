// Port-based SAML login flow. The long-lived port keeps the MV3 service
// worker alive for the entire dance (can exceed the 30-second idle timeout).

import type { LoginPortResult } from "../src/lib/bridge/protocol";
import { checkCookies, clearBannerSession } from "./cookies";

const LOGIN_URL =
  "https://sait-sust-prd-prd1-eid-idm-wso2.sait.ca/cas-web/login?TARGET=https%3A%2F%2Fsait-sust-prd-prd1-ban-ss-ssag6.sait.ca%2FStudentRegistrationSsb%2Flogin%2Fcas";

const LOGIN_TIMEOUT_MS = 2 * 60 * 1000;
const LOGIN_POLL_INTERVAL_MS = 1000;

export async function runLoginFlow(port: chrome.runtime.Port): Promise<void> {
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

  const settle = (result: LoginPortResult) => {
    if (settled) return;
    settled = true;
    cleanup();
    // biome-ignore lint/suspicious/noConsole: SW debug logging
    console.log("[sait-ext] settle", result.ok ? "ok" : `${result.error}: ${result.message}`);
    safePost(port, result);
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
