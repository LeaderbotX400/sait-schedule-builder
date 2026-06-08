/**
 * Per-host session priming.
 *
 * Banner runs three apps on three separate Tomcat hosts (ssag1/ssag2/ssag6),
 * each with its own JSESSIONID + NLB cookies. The login popup only navigates
 * through CAS to ssag6, so a first XHR to ssag1 or ssag2 lands on a node that
 * has never seen this user — Banner responds with a 404 (or a redirect to the
 * login page). The fix is to issue a credentialed, follow-redirect GET to the
 * host root once: SSO is already established at the IdP, so the CAS bounce
 * completes silently and ssag1/ssag2 mint their own cookies.
 *
 * `HostPrimer` single-flights this per host root URL for the lifetime of the
 * SDK instance. `primedTransport` wraps a transport so every fetch waits for
 * the relevant host to be primed first. Both are no-ops when the underlying
 * transport doesn't implement `prime()` (DirectTransport, MockTransport).
 */

import type { BannerRequestInit, BannerTransport, RawResponse } from "../transport/types";

export class HostPrimer {
  private readonly inflight = new Map<string, Promise<void>>();
  private readonly transport: BannerTransport;

  constructor(transport: BannerTransport) {
    this.transport = transport;
  }

  ensure(hostRoot: string): Promise<void> {
    const existing = this.inflight.get(hostRoot);
    if (existing) return existing;
    const p = this.run(hostRoot).catch((e) => {
      // Drop on failure so a later request can retry priming.
      this.inflight.delete(hostRoot);
      throw e;
    });
    this.inflight.set(hostRoot, p);
    return p;
  }

  reset(): void {
    this.inflight.clear();
  }

  private async run(hostRoot: string): Promise<void> {
    if (!this.transport.prime) return;
    await this.transport.prime(hostRoot);
  }
}

/**
 * Wraps a transport so that every `fetch` awaits `primer.ensure(hostRoot)` first.
 * The wrapped transport is otherwise a passthrough — it does not implement
 * `prime` itself (that responsibility belongs to the underlying transport).
 */
export function primedTransport(
  transport: BannerTransport,
  primer: HostPrimer,
  hostRoot: string,
): BannerTransport {
  return {
    async fetch(url: string, init?: BannerRequestInit): Promise<RawResponse> {
      await primer.ensure(hostRoot);
      return transport.fetch(url, init);
    },
  };
}
