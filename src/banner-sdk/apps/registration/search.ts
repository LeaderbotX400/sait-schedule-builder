import { ssag6Url } from "../../config/hosts";
import { bannerRequest } from "../../core/request";
import type { RegistrationSession } from "../../core/session";
import type { BannerResponse, SearchPerCode } from "./types";

export interface SearchOptions {
  pageOffset?: number;
  pageMaxSize?: number;
  sortColumn?: string;
  sortDirection?: "asc" | "desc";
}

export interface SearchByCoursesResult {
  response: BannerResponse;
  perCode: SearchPerCode[];
}

/** Class-search endpoints under `/ssb/searchResults/`. */
export function createSearchClient(session: RegistrationSession) {
  async function byCourse(
    code: string,
    term: string,
    opts: SearchOptions = {},
  ): Promise<BannerResponse> {
    await session.ensureTermPrimed(term);
    const params = new URLSearchParams({
      txt_subjectcoursecombo: code,
      txt_term: term,
      startDatepicker: "",
      endDatepicker: "",
      uniqueSessionId: session.uniqueSessionId,
      pageOffset: String(opts.pageOffset ?? 0),
      pageMaxSize: String(opts.pageMaxSize ?? 500),
      sortColumn: opts.sortColumn ?? "subjectDescription",
      sortDirection: opts.sortDirection ?? "asc",
    });
    return bannerRequest<BannerResponse>(
      session,
      ssag6Url(session.hosts, `/ssb/searchResults/searchResults?${params}`),
    );
  }

  /**
   * Run `byCourse` for every code in the list, aggregating results into
   * one response. This replaces the per-code loop that lived inside
   * the legacy `api.ts:searchCourses`.
   */
  async function byCourses(
    codes: string[],
    term: string,
    opts: SearchOptions = {},
  ): Promise<SearchByCoursesResult> {
    const allData: BannerResponse["data"] = [];
    const perCode: SearchPerCode[] = [];

    for (const code of codes) {
      try {
        const json = await byCourse(code, term, opts);
        const count = json.data?.length ?? 0;
        if (json.data && count > 0) allData.push(...json.data);
        perCode.push({ code, count });
      } catch (e) {
        perCode.push({
          code,
          count: 0,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return {
      response: { success: true, totalCount: allData.length, data: allData },
      perCode,
    };
  }

  return { byCourse, byCourses };
}
