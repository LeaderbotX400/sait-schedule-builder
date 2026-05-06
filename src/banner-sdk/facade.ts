import { nanoid } from "nanoid";
import { createGeneralClient } from "./apps/general";
import { createRegistrationClient } from "./apps/registration";
import { createSelfServiceClient } from "./apps/selfService";
import { type BannerHostConfig, DEFAULT_HOSTS } from "./config/hosts";
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

  return {
    session,
    disconnect: (): void => session.invalidate(),
    registration: createRegistrationClient(session),
    general: createGeneralClient(transport, hosts),
    selfService: createSelfServiceClient(transport, hosts),
  };
}

export type BannerSdk = ReturnType<typeof createBannerSdk>;
