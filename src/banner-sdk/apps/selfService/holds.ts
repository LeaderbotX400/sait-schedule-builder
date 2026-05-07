import { createLogger } from "../../../lib/logger";
import { type BannerHostConfig, ssag1Url } from "../../config/hosts";
import { bannerRequest } from "../../core/request";
import type { BannerTransport } from "../../transport/types";
import type { HoldsCount } from "./types";

const log = createLogger("holds");

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
      } catch (err) {
        log.warn(
          `getHoldsCount(${studentId}) failed — ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}`,
        );
        return null;
      }
    },
  };
}
