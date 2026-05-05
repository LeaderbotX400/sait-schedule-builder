/**
 * Bridge to the SAIT Schedule Builder extension service worker.
 * The app always runs as the extension's own page (chrome-extension://),
 * so chrome.runtime is always available directly.
 */

export interface BannerFetchResponse {
  ok: boolean;
  status: number;
  contentType: string;
  body: string;
  error?: string;
}

function send<T>(message: { type: string; [k: string]: unknown }): Promise<T> {
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

export function bannerFetch(
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
): Promise<BannerFetchResponse> {
  return send<BannerFetchResponse>({ type: "BANNER_FETCH", url, init });
}
