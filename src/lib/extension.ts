import type { BannerCredentials } from "./api";

/**
 * In-process messaging to the extension's background service worker.
 * Because the UI runs as an extension page, chrome.runtime is always available
 * and intra-extension messages don't need an extension ID.
 */

export interface ExtensionResult {
  ok: boolean;
  credentials?: BannerCredentials;
  error?: string;
  message?: string;
  loginUrl?: string;
}

function send(message: { type: string }): Promise<ExtensionResult> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (response: ExtensionResult) => {
        const err = chrome.runtime.lastError;
        if (err) {
          resolve({ ok: false, error: "RUNTIME_ERROR", message: err.message ?? "Extension messaging failed" });
          return;
        }
        resolve(response);
      });
    } catch (e) {
      resolve({
        ok: false,
        error: "SEND_FAILED",
        message: e instanceof Error ? e.message : "Failed to message background worker",
      });
    }
  });
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
