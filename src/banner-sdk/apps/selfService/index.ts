import type { BannerHostConfig } from "../../config/hosts";
import type { BannerTransport } from "../../transport/types";
import { createHoldsClient } from "./holds";
import { pictureUrl } from "./picture";
import { createProfileClient } from "./profile";

export function createSelfServiceClient(transport: BannerTransport, hosts: BannerHostConfig) {
  return {
    profile: createProfileClient(transport, hosts),
    holds: createHoldsClient(transport, hosts),
    picture: {
      url: (bannerId: string) => pictureUrl(hosts, bannerId),
    },
  };
}

export type SelfServiceClient = ReturnType<typeof createSelfServiceClient>;
