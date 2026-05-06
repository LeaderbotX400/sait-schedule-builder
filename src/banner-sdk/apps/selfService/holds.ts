import { type BannerHostConfig, ssag1Url } from "../../config/hosts";
import { bannerRequest } from "../../core/request";
import type { BannerTransport } from "../../transport/types";
import type { HoldsCount } from "./types";

export function createHoldsClient(transport: BannerTransport, hosts: BannerHostConfig) {
  const ctx = { transport, hosts };
  return {
    async getHoldsCount(studentId: string): Promise<HoldsCount | null> {
      try {
        return await bannerRequest<HoldsCount>(
          ctx,
          ssag1Url(
            ctx.hosts,
            `/studentHolds/getHoldsCountCacheHolds?studentId=${encodeURIComponent(studentId)}`,
          ),
        );
      } catch {
        return null;
      }
    },
  };
}
