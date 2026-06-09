import { createLogger } from "../../../lib/logger";
import { type BannerHostConfig, ssag1Url } from "../../config/hosts";
import { type BannerSdkHooks, bannerRequestRaw } from "../../core/request";
import { BannerHttpError } from "../../transport/errors";
import type { BannerRequestInit, BannerTransport, RawResponse } from "../../transport/types";
import { createHoldsClient } from "./holds";
import { pictureUrl } from "./picture";
import { createProfileClient } from "./profile";

const log = createLogger("selfService");

/**
 * /studentProfile/* and /studentHolds/* JSON endpoints depend on a server-side
 * session attribute (`primaryCurriculum`) that is only set as a side effect of
 * GETing the SPA shell page /ssb/studentProfile/studentProfile. Without it the
 * data endpoints 404, or 500 with "Cannot get property 'primaryCurriculum' on
 * null object". `prime()` runs that GET once per SDK instance.
 */
const PRIME_URL_PATH = "/ssb/studentProfile/studentProfile";
// Matches /StudentSelfService/studentProfile/... and /StudentSelfService/studentHolds/...
// but NOT /StudentSelfService/ssb/studentProfile/studentProfile (the prime URL itself).
const NEEDS_PRIME = /\/StudentSelfService\/(studentProfile|studentHolds)\//;

export function createSelfServiceClient(
  transport: BannerTransport,
  hosts: BannerHostConfig,
  hooks?: BannerSdkHooks,
) {
  const ctx = { transport, hosts, hooks };
  let primedPromise: Promise<void> | null = null;

  function prime(): Promise<void> {
    if (!primedPromise) {
      log.debug("priming studentProfile shell");
      primedPromise = bannerRequestRaw(ctx, ssag1Url(hosts, PRIME_URL_PATH))
        .then((raw) => {
          if (!raw.ok) throw new BannerHttpError(raw.status, raw.body);
          log.info("studentProfile primed");
          return undefined;
        })
        .catch((err) => {
          primedPromise = null;
          log.warn(
            `studentProfile prime failed — ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}`,
          );
          throw err;
        });
    }
    return primedPromise;
  }

  function invalidate(): void {
    primedPromise = null;
  }

  const dataTransport: BannerTransport = {
    async fetch(url: string, init?: BannerRequestInit): Promise<RawResponse> {
      if (NEEDS_PRIME.test(url)) await prime();
      return transport.fetch(url, init);
    },
  };

  const dataCtx = { transport: dataTransport, hosts, hooks };

  return {
    prime,
    invalidate,
    profile: createProfileClient(dataCtx),
    holds: createHoldsClient(dataCtx),
    picture: {
      url: (bannerId: string) => pictureUrl(hosts, bannerId),
    },
  };
}

export type SelfServiceClient = ReturnType<typeof createSelfServiceClient>;
