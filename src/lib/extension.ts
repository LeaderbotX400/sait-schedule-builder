import type { BannerCredentials } from "../banner-sdk";

/**
 * Bridge to the SAIT Schedule Builder extension.
 *
 * The app can run in two contexts:
 *   1. As the extension's own page (chrome-extension://<id>/index.html) —
 *      `chrome.runtime` is available; we sendMessage with no extension ID.
 *   2. As a regular web page on localhost or the prod host — the extension
 *      injects a content script that posts its ID via window.postMessage,
 *      and we route messages through `externally_connectable`.
 */

export interface ExtensionResult {
  ok: boolean;
  credentials?: BannerCredentials;
  error?: string;
  message?: string;
  loginUrl?: string;
}

let cachedExtensionId: string | null = null;
const idWaiters: Array<(id: string) => void> = [];

function isExtensionPage(): boolean {
  // chrome.runtime.id is only set in extension pages and content scripts.
  return (
    typeof chrome !== "undefined" &&
    !!chrome.runtime &&
    !!(chrome.runtime as { id?: string }).id &&
    location.protocol === "chrome-extension:"
  );
}

function isMessagingAvailable(): boolean {
  return typeof chrome !== "undefined" && !!chrome.runtime?.sendMessage;
}

if (typeof window !== "undefined") {
  window.addEventListener("message", (e) => {
    if (e.source !== window) return;
    const data = e.data as { source?: string; type?: string; id?: string } | null;
    if (!data || data.source !== "sait-ext" || data.type !== "EXT_ID" || !data.id) return;
    cachedExtensionId = data.id;
    while (idWaiters.length) idWaiters.shift()!(data.id);
  });
  // Prompt the content script to (re)send its ID in case we missed the initial message.
  window.postMessage({ source: "sait-app", type: "REQUEST_EXT_ID" }, "*");
}

function getExtensionId(timeoutMs = 1500): Promise<string | null> {
  if (cachedExtensionId) return Promise.resolve(cachedExtensionId);
  if (typeof window === "undefined") return Promise.resolve(null);
  window.postMessage({ source: "sait-app", type: "REQUEST_EXT_ID" }, "*");
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(cachedExtensionId), timeoutMs);
    idWaiters.push((id) => {
      clearTimeout(timer);
      resolve(id);
    });
  });
}

async function send<T = ExtensionResult>(message: {
  type: string;
  [k: string]: unknown;
}): Promise<T> {
  if (!isMessagingAvailable()) {
    return Promise.resolve({
      ok: false,
      error: "NO_RUNTIME",
      message: "Browser extension is not installed or not reachable.",
    } as T);
  }

  const extensionId = isExtensionPage() ? null : await getExtensionId();
  if (!isExtensionPage() && !extensionId) {
    return Promise.resolve({
      ok: false,
      error: "EXTENSION_NOT_DETECTED",
      message:
        "Schedule Builder extension not detected on this page. Install it and reload, or open the app from the extension's icon.",
    } as T);
  }

  return new Promise<T>((resolve) => {
    const cb = (response: T) => {
      const err = chrome.runtime.lastError;
      if (err) {
        resolve({
          ok: false,
          error: "RUNTIME_ERROR",
          message: err.message ?? "Extension messaging failed",
        } as T);
        return;
      }
      resolve(response);
    };
    try {
      if (extensionId) {
        chrome.runtime.sendMessage(extensionId, message, cb);
      } else {
        chrome.runtime.sendMessage(message, cb);
      }
    } catch (e) {
      resolve({
        ok: false,
        error: "SEND_FAILED",
        message: e instanceof Error ? e.message : "Failed to message background worker",
      } as T);
    }
  });
}

export function isExtensionAvailable(): boolean {
  return isExtensionPage() || cachedExtensionId !== null;
}

export async function waitForExtension(timeoutMs = 1500): Promise<boolean> {
  if (isExtensionPage()) return true;
  const id = await getExtensionId(timeoutMs);
  return !!id;
}

export function triggerLogin(): Promise<ExtensionResult> {
  return send({ type: "LOGIN" });
}

export function forceReauth(): Promise<ExtensionResult> {
  return send({ type: "FORCE_REAUTH" });
}

export function getCredentialsFromExtension(): Promise<ExtensionResult> {
  return send({ type: "GET_CREDENTIALS" });
}

export function openAuthUrl(): Promise<ExtensionResult> {
  return send({ type: "OPEN_AUTH_URL" });
}

export interface BannerFetchResponse {
  ok: boolean;
  status: number;
  contentType: string;
  body: string;
  error?: string;
}

export function installBannerCookies(cookies: Record<string, string>): Promise<ExtensionResult> {
  return send({ type: "SET_COOKIES", cookies });
}

export function bannerFetch(
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
): Promise<BannerFetchResponse> {
  return send<BannerFetchResponse>({ type: "BANNER_FETCH", url, init });
}
