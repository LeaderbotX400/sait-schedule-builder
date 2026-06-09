import { ssag6Url } from "../../config/hosts";
import { FORM_URLENCODED, formUrlEncoded } from "../../core/forms";
import { bannerHeaders } from "../../core/headers";
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
  /**
   * Banner's /searchResults reads its filter from session-side state, not from
   * the query string. Without clearing that state, the second byCourse() call
   * in a row returns the FIRST call's sections again (verified live against
   * ssag6 on 2026-06-08 for both Spring and Fall 2026: `txt_subjectcoursecombo`
   * in the URL is ignored once the session has a stored filter). resetDataForm
   * blanks the criteria so each call stands alone.
   */
  async function resetSearchForm(): Promise<void> {
    const body = formUrlEncoded({ uniqueSessionId: session.uniqueSessionId });
    await session.transport.fetch(ssag6Url(session.hosts, "/ssb/classSearch/resetDataForm"), {
      method: "POST",
      headers: bannerHeaders({ contentType: FORM_URLENCODED }),
      body,
    });
  }

  async function byCourse(
    code: string,
    term: string,
    opts: SearchOptions = {},
  ): Promise<BannerResponse> {
    await session.ensureTermPrimed(term);
    await resetSearchForm();
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
