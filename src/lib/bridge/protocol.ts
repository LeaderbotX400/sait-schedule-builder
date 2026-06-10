/**
 * The single source of truth for the app ↔ extension message protocol.
 * Both sides import this module: the service worker builds its listener
 * from `createBridgeRouter`, and the app sends through `sendBridgeMessage`
 * (see `lib/bridge/client.ts`).
 *
 * The on-the-wire message names and payload shapes are frozen — a newer
 * web app may be talking to an older installed extension — so this module
 * only adds compile-time typing, never changes runtime values.
 */

export interface BridgeFetchInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface BannerFetchResult {
  ok: boolean;
  status: number;
  contentType: string;
  body: string;
  error?: string;
}

export interface BannerPrimeResult {
  ok: boolean;
  error?: string;
}

export interface BridgeRequests {
  PING: { type: "PING" };
  CHECK_LOGIN: { type: "CHECK_LOGIN" };
  CLEAR_SESSION: { type: "CLEAR_SESSION" };
  BANNER_FETCH: { type: "BANNER_FETCH"; url: string; init?: BridgeFetchInit };
  BANNER_PRIME: { type: "BANNER_PRIME"; url: string };
}

export interface BridgeResponses {
  PING: { ok: true; version: string };
  CHECK_LOGIN: { loggedIn: boolean };
  CLEAR_SESSION: { ok: true };
  BANNER_FETCH: BannerFetchResult;
  BANNER_PRIME: BannerPrimeResult;
}

export type BridgeMessageKind = keyof BridgeRequests;
export type BridgeRequest = BridgeRequests[BridgeMessageKind];

/**
 * App-side failure envelope produced when the message never reached the
 * extension (no runtime, no extension ID, or a runtime messaging error).
 */
export interface BridgeErrorEnvelope {
  ok: false;
  error: "NO_EXTENSION" | "RUNTIME_ERROR" | string;
  message: string;
}

export type BridgeResult<K extends BridgeMessageKind> = BridgeResponses[K] | BridgeErrorEnvelope;

/** Port names for the long-lived login flow (keeps the MV3 SW alive). */
export type LoginPortName = "login" | "force-reauth";
export const LOGIN_PORT_NAMES: readonly LoginPortName[] = ["login", "force-reauth"];

export type LoginPortResult = { ok: true } | { ok: false; error: string; message: string };

/** Broadcast from the SW after a login flow settles. */
export interface LoginStateChangedMessage {
  type: "LOGIN_STATE_CHANGED";
  loggedIn: boolean;
}

export type BridgeHandlers = {
  [K in BridgeMessageKind]: (req: BridgeRequests[K]) => BridgeResponses[K] | Promise<BridgeResponses[K]>;
};

/**
 * Build the `(message, sendResponse) => boolean` listener body shared by
 * `chrome.runtime.onMessage` and `onMessageExternal`. Returns true when
 * the response is delivered asynchronously (the MV3 keep-channel-open
 * signal); false for unknown or synchronous messages.
 */
export function createBridgeRouter(handlers: BridgeHandlers) {
  return (message: unknown, sendResponse: (response?: unknown) => void): boolean => {
    if (!message || typeof message !== "object") return false;
    const kind = (message as { type?: string }).type as BridgeMessageKind | undefined;
    if (!kind || !(kind in handlers)) return false;

    const result = handlers[kind](message as never);
    if (result instanceof Promise) {
      void result.then(sendResponse);
      return true;
    }
    sendResponse(result);
    return false;
  };
}
