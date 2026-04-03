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
