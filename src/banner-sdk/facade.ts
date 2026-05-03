import { nanoid } from "nanoid";
import { createGeneralClient } from "./apps/general";
import { type LoginValidation, validateLogin } from "./apps/general/identity";
import { createRegistrationClient } from "./apps/registration";
import { createSelfServiceClient } from "./apps/selfService";
import { type BannerHostConfig, DEFAULT_HOSTS } from "./config/hosts";
import { RegistrationSession } from "./core/session";
import { SyncTokenCache } from "./core/syncToken";
import type { BannerCredentials, BannerTransport } from "./transport/types";

export interface BannerSdkOptions {
  hosts?: BannerHostConfig;
  /** Override the default `sched-<nanoid>` if the caller wants a stable id. */
  uniqueSessionId?: string;
}

/**
 * One-line entry point. Components don't construct the SDK directly — they
 * pull a singleton out of the store via `useStore(s => s.sdk)`.
 */
export function createBannerSdk(transport: BannerTransport, opts: BannerSdkOptions = {}) {
  const hosts = opts.hosts ?? DEFAULT_HOSTS;
  const tokens = new SyncTokenCache();
  const session = new RegistrationSession(
    transport,
    hosts,
    tokens,
    opts.uniqueSessionId ?? `sched-${nanoid()}`,
  );

  return {
    session,

    /** Probe getBannerId on ssag2 to confirm we're logged in. */
    validateLogin: (): Promise<LoginValidation> => validateLogin(transport, hosts, tokens),

    /** Install Banner credentials (synchronizer token + uniqueSessionId). */
    connect: (creds: BannerCredentials): void => session.applyCredentials(creds),

    /** connect + immediately validateLogin. The common case from the UI. */
    async connectAndValidate(creds: BannerCredentials): Promise<LoginValidation> {
      session.applyCredentials(creds);
      return validateLogin(transport, hosts, tokens);
    },

    /** Drop primed term + cached sync token. UI calls this on disconnect. */
    disconnect: (): void => session.invalidate(),

    registration: createRegistrationClient(session),
    general: createGeneralClient(transport, hosts, tokens),
    selfService: createSelfServiceClient(transport, hosts, tokens),
  };
}

export type BannerSdk = ReturnType<typeof createBannerSdk>;
