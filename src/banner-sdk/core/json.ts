import { BannerHttpError } from "../transport/errors";
import type { RawResponse } from "../transport/types";

/**
 * Parse the body as JSON or throw `BannerHttpError`. Callers should already
 * have classified the response status (HTML detection lives in
 * `core/request.ts`); this is the last-mile parse step.
 */
export function parseJsonOrThrow<T>(raw: RawResponse): T {
  try {
    return JSON.parse(raw.body) as T;
  } catch {
    throw new BannerHttpError(
      raw.status,
      `Banner returned non-JSON content (${raw.contentType || "unknown"}): ${raw.body.slice(0, 200)}`,
    );
  }
}
