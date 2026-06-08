/**
 * Bridge to the SAIT Schedule Builder extension service worker.
 *
 * Works in two contexts:
 *   - in-extension: app loaded at chrome-extension://<id>/index.html.
 *     `chrome.runtime.sendMessage(msg, cb)` routes to the same extension.
 *   - web: app loaded at localhost / pages.dev. The extension ID must be
 *     provided explicitly: `chrome.runtime.sendMessage(extensionId, msg, cb)`.
 *     The manifest's externally_connectable list authorizes the origin.
 */

import { getExtensionId, isExtensionContext } from "./extensionId";

export interface BannerFetchResponse {
  ok: boolean;
  status: number;
  contentType: string;
  body: string;
  error?: string;
  message?: string;
}

type ErrorEnvelope = { ok: false; error: string; message: string };

function noExtensionError(message: string): ErrorEnvelope {
  return { ok: false, error: "NO_EXTENSION", message };
}

function send<T>(message: { type: string; [k: string]: unknown }): Promise<T> {
  if (typeof chrome === "undefined" || !chrome.runtime) {
    return Promise.resolve(noExtensionError("Chrome extension runtime is unavailable.") as T);
  }

  if (isExtensionContext()) {
    return new Promise<T>((resolve) => {
      chrome.runtime.sendMessage(message, (response: T) => {
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
      });
    });
  }

  const extensionId = getExtensionId();
  if (!extensionId) {
    return Promise.resolve(
      noExtensionError(
        "Extension ID is not set. Install the SAIT Schedule Builder extension or paste its ID in settings.",
      ) as T,
    );
  }

  return new Promise<T>((resolve) => {
    chrome.runtime.sendMessage(extensionId, message, (response: T) => {
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
    });
  });
}

export function bannerFetch(
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
): Promise<BannerFetchResponse> {
  return send<BannerFetchResponse>({ type: "BANNER_FETCH", url, init });
}

export interface BannerPrimeResponse {
  ok: boolean;
  error?: string;
  message?: string;
}

/**
 * Asks the SW to issue a credentialed, follow-redirect GET to a host root so
 * Banner's CAS/SAML bounce can mint per-host JSESSIONID + NLB cookies. Used to
 * bootstrap ssag1/ssag2 sessions; ssag6 is primed by the login popup.
 */
export function bannerPrime(url: string): Promise<BannerPrimeResponse> {
  return send<BannerPrimeResponse>({ type: "BANNER_PRIME", url });
}
