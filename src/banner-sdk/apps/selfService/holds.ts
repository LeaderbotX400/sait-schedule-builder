import { createLogger } from "../../../lib/logger";
import { ssag1Url } from "../../config/hosts";
import { bannerRequest, type RequestContext } from "../../core/request";
import { withNullFallback } from "./fallback";
import type { HoldsCount } from "./types";

const log = createLogger("holds");

export function createHoldsClient(ctx: RequestContext) {
  return {
    getHoldsCount(studentId: string): Promise<HoldsCount | null> {
      return withNullFallback(log, `getHoldsCount(${studentId})`, () =>
        bannerRequest<HoldsCount>(
          ctx,
          ssag1Url(
            ctx.hosts,
            `/studentHolds/getHoldsCountCacheHolds?studentId=${encodeURIComponent(studentId)}`,
          ),
        ),
      );
    },
  };
}
