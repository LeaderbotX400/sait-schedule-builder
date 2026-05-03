import { type BannerHostConfig, ssag1Url } from "../../config/hosts";
import { bannerHeaders } from "../../core/headers";
import { bannerRequest } from "../../core/request";
import type { SyncTokenCache } from "../../core/syncToken";
import type { BannerTransport } from "../../transport/types";
import type { HoldsCount } from "./types";

interface Ctx {
  transport: BannerTransport;
  hosts: BannerHostConfig;
  tokens: SyncTokenCache;
}

export function createHoldsClient(
  transport: BannerTransport,
  hosts: BannerHostConfig,
  tokens: SyncTokenCache,
) {
  const ctx: Ctx = { transport, hosts, tokens };
  return {
    async getHoldsCount(studentId: string): Promise<HoldsCount | null> {
      try {
        return await bannerRequest<HoldsCount>(
          ctx,
          ssag1Url(
            ctx.hosts,
            `/studentHolds/getHoldsCountCacheHolds?studentId=${encodeURIComponent(studentId)}`,
          ),
          { headers: bannerHeaders() },
        );
      } catch {
        return null;
      }
    },
  };
}
