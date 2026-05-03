import type { BannerHostConfig } from "../../config/hosts";
import type { SyncTokenCache } from "../../core/syncToken";
import type { BannerTransport } from "../../transport/types";
import { validateLogin } from "./identity";
import { createGeneralLookupsClient } from "./lookups";
import { createPersonalInfoClient } from "./personalInfo";
import { pictureUrl } from "./picture";

export function createGeneralClient(
  transport: BannerTransport,
  hosts: BannerHostConfig,
  tokens: SyncTokenCache,
) {
  return {
    identity: {
      validateLogin: () => validateLogin(transport, hosts),
    },
    personalInfo: createPersonalInfoClient(transport, hosts, tokens),
    lookups: createGeneralLookupsClient(transport, hosts, tokens),
    picture: {
      url: (bannerId: string) => pictureUrl(hosts, bannerId),
    },
  };
}

export type GeneralClient = ReturnType<typeof createGeneralClient>;
