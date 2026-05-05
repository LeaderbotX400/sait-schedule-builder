import type { RawResponse } from "./types";

/**
 * Base class for every error the SDK raises. All thrown errors are subclasses
 * of this so callers can `catch (e) { if (e instanceof BannerError) ... }`.
 */
export class BannerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BannerError";
  }
}

/**
 * The user's Banner session is gone or unrecoverable.
 *
 * Typical triggers: a request that should return JSON returned HTML
 * (Banner redirected to the SAML login flow), or refreshing the sync
 * token also returned HTML — meaning the underlying JSESSIONID is dead
 * and the user has to re-authenticate via the extension popup.
 */
export class BannerSessionExpiredError extends BannerError {
  constructor(message = "Banner session has expired — please reconnect.") {
    super(message);
    this.name = "BannerSessionExpiredError";
  }
}

/**
 * The endpoint exists on the Banner server but is gated by a fresh-SAML
 * AuthnRequest the XHR cannot satisfy.
 *
 * Concretely: ssag6 returned 403 with the small `{"error":"access denied"}`
 * JSON body. Usually means the user isn't permitted to use this feature
 * (e.g. registrationStatus, personaChange, scheduleAndOptions). Refreshing
 * the sync token won't help; the caller should degrade gracefully.
 */
export class BannerNotPermittedError extends BannerError {
  readonly url: string;
  readonly raw: RawResponse;
  constructor(url: string, raw: RawResponse) {
    super(`Banner denied access to ${url} (HTTP ${raw.status}).`);
    this.name = "BannerNotPermittedError";
    this.url = url;
    this.raw = raw;
  }
}

/**
 * Banner accepted the request shape but rejected its content. The most
 * common case is `submitRegistration/batch` returning per-CRN errors
 * (registration restrictions, missing prerequisites, full sections, etc.).
 */
export class BannerValidationError extends BannerError {
  readonly details: Record<string, unknown>;
  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "BannerValidationError";
    this.details = details;
  }
}

/** A network-layer failure (DNS, TCP, CORS preflight, etc.). */
export class BannerNetworkError extends BannerError {
  constructor(message: string) {
    super(message);
    this.name = "BannerNetworkError";
  }
}

/**
 * Banner returned a non-2xx HTTP status that wasn't classified into one
 * of the more specific cases above.
 */
export class BannerHttpError extends BannerError {
  readonly status: number;
  readonly body: string;
  constructor(status: number, body: string) {
    super(`Banner returned HTTP ${status}.`);
    this.name = "BannerHttpError";
    this.status = status;
    this.body = body;
  }
}

/** A request failed CSRF validation (sync token mismatch). Rare. */
export class BannerCsrfError extends BannerError {
  constructor(message = "Banner rejected the synchronizer token.") {
    super(message);
    this.name = "BannerCsrfError";
  }
}

/**
 * The extension couldn't reach Banner, likely because credentials are missing
 * or expired. The user needs to log in via the extension popup to refresh
 * their cookies.
 *
 * Typical triggers: extension lost the JSESSIONID cookie, or the Banner
 * service is unreachable due to network/auth issues (status 0).
 */
export class BannerAuthRequiredError extends BannerError {
  constructor(
    message = "Banner returned 0. Sign in and refresh your credentials.",
  ) {
    super(message);
    this.name = "BannerAuthRequiredError";
  }
}

export function isBannerError(e: unknown): e is BannerError {
  return e instanceof BannerError;
}

/**
 * Detect ssag6's "endpoint exists but is SAML-gated" 403 response.
 *
 * The body is exactly `{"error":"access denied"}` (30 bytes). We use the
 * length + content-type + body content together so a coincidentally-30-byte
 * legitimate JSON response wouldn't trigger the false positive.
 */
export function looksLikeAccessDenied(raw: RawResponse): boolean {
  return (
    raw.status === 403 &&
    raw.contentType.includes("application/json") &&
    raw.body.length < 100 &&
    raw.body.includes('"access denied"')
  );
}
