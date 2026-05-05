import { nanoid } from "nanoid";
import { createRegistrationClient } from "./apps/registration";
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
  };
}

export type BannerSdk = ReturnType<typeof createBannerSdk>;
