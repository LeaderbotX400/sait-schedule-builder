import { type BannerHostConfig, ssag6Url } from "../config/hosts";
import { BannerSessionExpiredError } from "../transport/errors";
import type { BannerTransport } from "../transport/types";

/**
 * Per-page CSRF token Banner emits on every HTML response.
 *
 * Lifecycle:
 *   1. Initial value is set when the chrome extension scrapes the meta tag
 *      from a Banner page (extension/content.ts) and the SDK's `connect()`
 *      installs it via `set()`.
 *   2. `refresh()` re-fetches `/StudentRegistrationSsb/ssb/registration`
 *      and re-extracts the token; called by `core/request.ts` when an XHR
 *      comes back as HTML (sign of a stale token / session cycle).
 *   3. If `refresh()` itself returns HTML, the JSESSIONID is dead and the
 *      cache throws BannerSessionExpiredError so the UI can prompt reauth.
 */
const META_RE = /name=["']synchronizerToken["']\s+content=["']([^"']+)["']/;

export class SyncTokenCache {
  private token: string | null = null;

  get(): string | null {
    return this.token;
  }

  set(token: string): void {
    this.token = token;
  }

  clear(): void {
    this.token = null;
  }

  async refresh(transport: BannerTransport, hosts: BannerHostConfig): Promise<string> {
    const raw = await transport.fetch(ssag6Url(hosts, "/ssb/registration"));
    if (!raw.ok || raw.status === 0) {
      throw new BannerSessionExpiredError(
        `Could not refresh synchronizer token: HTTP ${raw.status} ${raw.error ?? ""}`.trim(),
      );
    }
    if (!raw.contentType.includes("text/html")) {
      // Banner usually returns HTML here; if it's something else the session
      // is misbehaving. Treat as expired so the UI re-authenticates.
      throw new BannerSessionExpiredError(
        `Synchronizer-token refresh returned ${raw.contentType || "no content-type"}.`,
      );
    }
    const match = raw.body.match(META_RE);
    if (!match?.[1]) {
      throw new BannerSessionExpiredError(
        "Could not find synchronizerToken meta tag in Banner registration page.",
      );
    }
    this.token = match[1];
    return match[1];
  }
}
