import type { BannerCredentials } from "./api";

/**
 * Communication bridge with the SAIT Schedule Builder Chrome extension.
 *
 * The extension exposes credentials via chrome.runtime.sendMessage
 * using the externally_connectable API.
 */

// The extension ID — after publishing or loading unpacked, update this.
// During development with an unpacked extension, the ID is shown in chrome://extensions.
// Users can also set this dynamically.
let extensionId: string | null = null;

export function setExtensionId(id: string) {
  extensionId = id;
}

export function getExtensionId(): string | null {
  return extensionId;
}

function getChromeRuntime(): typeof chrome.runtime | null {
  if (typeof chrome !== "undefined" && chrome.runtime) {
    return chrome.runtime;
  }
  return null;
}

/** Check if the extension is installed and reachable */
export async function detectExtension(id: string): Promise<boolean> {
  const runtime = getChromeRuntime();
  if (!runtime) return false;

  return new Promise((resolve) => {
    try {
      runtime.sendMessage(id, { type: "PING" }, (response) => {
        if (chrome.runtime.lastError) {
          resolve(false);
          return;
        }
        resolve(response?.ok === true);
      });
    } catch {
      resolve(false);
    }
  });
}

export interface ExtensionResult {
  ok: boolean;
  credentials?: BannerCredentials;
  error?: string;
  message?: string;
  loginUrl?: string;
}

/** Open a long-lived port to the extension for a login flow and resolve when done. */
function connectForLogin(id: string, portName: "TRIGGER_LOGIN" | "FORCE_REAUTH"): Promise<ExtensionResult> {
  const runtime = getChromeRuntime();
  if (!runtime) {
    return Promise.resolve({ ok: false, error: "NO_CHROME", message: "Chrome runtime not available" });
  }

  return new Promise((resolve) => {
    let port: chrome.runtime.Port;
    try {
      port = runtime.connect(id, { name: portName });
    } catch (e) {
      resolve({
        ok: false,
        error: "CONNECT_FAILED",
        message: e instanceof Error ? e.message : "Failed to connect to extension",
      });
      return;
    }

    let settled = false;

    port.onMessage.addListener((msg: ExtensionResult) => {
      settled = true;
      resolve(msg);
      port.disconnect();
    });

    port.onDisconnect.addListener(() => {
      if (settled) return;
      const err = chrome.runtime.lastError;
      resolve({
        ok: false,
        error: "PORT_CLOSED",
        message: err?.message ?? "Extension disconnected before login completed",
      });
    });
  });
}

/**
 * Ask the extension to open a SAIT login tab, complete auth, and return
 * credentials. Resolves once the user finishes logging in (or the tab is
 * closed). The extension auto-closes the tab on success.
 *
 * Uses a long-lived port so the MV3 service worker stays alive during login.
 */
export function triggerLogin(id: string): Promise<ExtensionResult> {
  return connectForLogin(id, "TRIGGER_LOGIN");
}

/**
 * Clear all Banner cookies and the cached sync token, then open a fresh SAIT
 * login tab. Use when the session has expired and you need new credentials.
 *
 * Uses a long-lived port so the MV3 service worker stays alive during login.
 */
export function forceReauth(id: string): Promise<ExtensionResult> {
  return connectForLogin(id, "FORCE_REAUTH");
}

/** Request credentials from the extension */
export async function getCredentialsFromExtension(
  id: string,
): Promise<ExtensionResult> {
  const runtime = getChromeRuntime();
  if (!runtime) {
    return { ok: false, error: "NO_CHROME", message: "Chrome runtime not available" };
  }

  return new Promise((resolve) => {
    try {
      runtime.sendMessage(
        id,
        { type: "GET_CREDENTIALS" },
        (response: ExtensionResult) => {
          if (chrome.runtime.lastError) {
            resolve({
              ok: false,
              error: "EXTENSION_ERROR",
              message: chrome.runtime.lastError.message ?? "Extension communication failed",
            });
            return;
          }
          resolve(response);
        },
      );
    } catch (e) {
      resolve({
        ok: false,
        error: "SEND_FAILED",
        message: e instanceof Error ? e.message : "Failed to contact extension",
      });
    }
  });
}
