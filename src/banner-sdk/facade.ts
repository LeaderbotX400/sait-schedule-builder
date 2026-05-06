import { nanoid } from "nanoid";
import { createGeneralClient } from "./apps/general";
import { createRegistrationClient } from "./apps/registration";
import { createSelfServiceClient } from "./apps/selfService";
import { type BannerHostConfig, DEFAULT_HOSTS } from "./config/hosts";
import { HostPrimer, primedTransport } from "./core/primer";
import { RegistrationSession } from "./core/session";
import type { BannerTransport } from "./transport/types";

export interface BannerSdkOptions {
  hosts?: BannerHostConfig;
  uniqueSessionId?: string;
}

export function createBannerSdk(transport: BannerTransport, opts: BannerSdkOptions = {}) {
  const hosts = opts.hosts ?? DEFAULT_HOSTS;
  const session = new RegistrationSession(
    transport,
    hosts,
    opts.uniqueSessionId ?? `sched-${nanoid()}`,
  );

  // ssag1 (StudentSelfService) and ssag2 (BannerGeneralSsb) need a one-shot
  // credentialed GET against their host root to bootstrap per-host JSESSIONID
  // + NLB cookies via the existing SSO session. ssag6 is already primed by
  // the login popup, so registration goes through the raw transport.
  const primer = new HostPrimer(transport);
  const selfServiceTransport = primedTransport(transport, primer, `${hosts.selfService}/`);
  const generalTransport = primedTransport(transport, primer, `${hosts.general}/`);

  return {
    session,
    disconnect: (): void => {
      session.invalidate();
      primer.reset();
    },
    registration: createRegistrationClient(session),
    general: createGeneralClient(generalTransport, hosts),
    selfService: createSelfServiceClient(selfServiceTransport, hosts),
  };
}

export type BannerSdk = ReturnType<typeof createBannerSdk>;
