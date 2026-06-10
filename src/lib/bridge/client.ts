import { getExtensionId, isExtensionContext } from "../extensionId";
import type {
  BridgeErrorEnvelope,
  BridgeMessageKind,
  BridgeRequests,
  BridgeResult,
} from "./protocol";

/**
 * App-side bridge sender. Works in two contexts:
 *   - in-extension: app loaded at chrome-extension://<id>/index.html.
 *     `chrome.runtime.sendMessage(msg, cb)` routes to the same extension.
 *   - web: app loaded at localhost / pages.dev. The extension ID must be
 *     provided explicitly and the manifest's externally_connectable list
 *     authorizes the origin.
 *
 * Failures to reach the extension resolve (never reject) with a
 * `BridgeErrorEnvelope` so transports can classify them uniformly.
 */
export function sendBridgeMessage<K extends BridgeMessageKind>(
  message: BridgeRequests[K],
): Promise<BridgeResult<K>> {
  if (typeof chrome === "undefined" || !chrome.runtime) {
    return Promise.resolve(noExtension("Chrome extension runtime is unavailable."));
  }

  if (isExtensionContext()) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response: BridgeResult<K>) => {
        resolve(resolveResponse(response));
      });
    });
  }

  const extensionId = getExtensionId();
  if (!extensionId) {
    return Promise.resolve(
      noExtension(
        "Extension ID is not set. Install the SAIT Schedule Builder extension or paste its ID in settings.",
      ),
    );
  }

  return new Promise((resolve) => {
    chrome.runtime.sendMessage(extensionId, message, (response: BridgeResult<K>) => {
      resolve(resolveResponse(response));
    });
  });
}

function resolveResponse<K extends BridgeMessageKind>(response: BridgeResult<K>): BridgeResult<K> {
  const err = chrome.runtime.lastError;
  if (err) {
    return {
      ok: false,
      error: "RUNTIME_ERROR",
      message: err.message ?? "Extension messaging failed",
    };
  }
  return response;
}

function noExtension(message: string): BridgeErrorEnvelope {
  return { ok: false, error: "NO_EXTENSION", message };
}
