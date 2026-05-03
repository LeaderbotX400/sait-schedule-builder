import { ssag6Url } from "../../config/hosts";
import { bannerRequest } from "../../core/request";
import type { RegistrationSession } from "../../core/session";

export interface CodeOption {
  code: string;
  description: string;
}

interface LookupParams {
  term: string;
  searchTerm?: string;
  offset?: number;
  max?: number;
}

/**
 * Discovery / lookup endpoints under `/ssb/classSearch/get_*`. Every one
 * returns the same `{code, description}[]` shape. Keep the typed wrappers
 * thin — this is mostly an enum of enums.
 */
export function createLookupsClient(session: RegistrationSession) {
  function run(name: string) {
    return async (opts: LookupParams): Promise<CodeOption[]> => {
      const params = new URLSearchParams({
        searchTerm: opts.searchTerm ?? "",
        term: opts.term,
        offset: String(opts.offset ?? 1),
        max: String(opts.max ?? 50),
      });
      return bannerRequest<CodeOption[]>(
        session,
        ssag6Url(session.hosts, `/ssb/classSearch/${name}?${params}`),
      );
    };
  }

  return {
    subject: run("get_subject"),
    /** "CPRG307 - Programming Principles" matches; the most common autocomplete. */
    subjectCourseCombo: run("get_subjectcoursecombo"),
    instructor: run("get_instructor"),
    campus: run("get_campus"),
    attribute: run("get_attribute"),
    level: run("get_level"),
    partOfTerm: run("get_partOfTerm"),
    session: run("get_session"),
    instructionalMethod: run("get_instructionalMethod"),
  };
}
