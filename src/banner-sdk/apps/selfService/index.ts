import type { BannerHostConfig } from "../../config/hosts";
import type { SyncTokenCache } from "../../core/syncToken";
import type { BannerTransport } from "../../transport/types";
import { createHoldsClient } from "./holds";
import { pictureUrl } from "./picture";
import { createProfileClient } from "./profile";

export function createSelfServiceClient(
  transport: BannerTransport,
  hosts: BannerHostConfig,
  tokens: SyncTokenCache,
) {
  return {
    profile: createProfileClient(transport, hosts, tokens),
    holds: createHoldsClient(transport, hosts, tokens),
    picture: {
      url: (bannerId: string) => pictureUrl(hosts, bannerId),
    },
  };
}

export type SelfServiceClient = ReturnType<typeof createSelfServiceClient>;
