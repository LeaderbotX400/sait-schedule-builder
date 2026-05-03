import { type BannerHostConfig, ssag2Url } from "../../config/hosts";
import { bannerHeaders } from "../../core/headers";
import { parseJsonOrThrow } from "../../core/json";
import type { SyncTokenCache } from "../../core/syncToken";
import { BannerNetworkError } from "../../transport/errors";
import type { BannerTransport } from "../../transport/types";
import type { BannerIdResponse } from "./types";

export type LoginValidation =
  | { valid: true; studentId: string }
  | {
      valid: false;
      reason: "NETWORK" | "NOT_LOGGED_IN" | "MALFORMED";
      error: string;
    };

/**
 * Single source of truth for "is the user logged in?".
 *
 * Hits getBannerId on ssag2. Any of: network failure, non-2xx, redirect to
 * login (non-JSON response), empty body, missing/falsy bannerId — counts
 * as logged out. The host-pinned status taxonomy in §3 doesn't apply here:
 * ssag2 only returns 404 vs 200, so we don't need the access-denied
 * heuristic.
 */
export async function validateLogin(
  transport: BannerTransport,
  hosts: BannerHostConfig,
  tokens?: SyncTokenCache,
): Promise<LoginValidation> {
  let raw: Awaited<ReturnType<BannerTransport["fetch"]>>;
  try {
    raw = await transport.fetch(ssag2Url(hosts, "/ssb/PersonalInformationDetails/getBannerId"), {
      headers: bannerHeaders({ syncToken: tokens?.get() ?? null }),
    });
  } catch (e) {
    return {
      valid: false,
      reason: "NETWORK",
      error: e instanceof BannerNetworkError ? e.message : `Could not reach Banner: ${String(e)}`,
    };
  }

  if (raw.error) {
    return { valid: false, reason: "NETWORK", error: `Could not reach Banner: ${raw.error}` };
  }
  if (!raw.ok) {
    return {
      valid: false,
      reason: "NOT_LOGGED_IN",
      error: `Banner returned ${raw.status}. Sign in and refresh your credentials.`,
    };
  }
  if (
    !raw.contentType.includes("application/json") &&
    !raw.contentType.includes("text/javascript")
  ) {
    return {
      valid: false,
      reason: "NOT_LOGGED_IN",
      error: "Session has expired — Banner redirected to login. Please refresh your credentials.",
    };
  }
  let body: BannerIdResponse;
  try {
    body = parseJsonOrThrow<BannerIdResponse>(raw);
  } catch {
    return {
      valid: false,
      reason: "MALFORMED",
      error: "Banner returned an unexpected payload for getBannerId.",
    };
  }
  const bannerId = body?.bannerId;
  if (!bannerId) {
    return {
      valid: false,
      reason: "NOT_LOGGED_IN",
      error: "You're not signed in to SAIT Banner. Sign in and refresh your credentials.",
    };
  }
  return { valid: true, studentId: String(bannerId) };
}
