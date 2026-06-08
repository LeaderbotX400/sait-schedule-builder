import { ssag6Url } from "../../config/hosts";
import { bannerRequest } from "../../core/request";
import type { RegistrationSession } from "../../core/session";
import type { TermOption } from "./types";

export interface ListTermsOptions {
  searchTerm?: string;
  offset?: number;
  max?: number;
}

/**
 * Term picker for the *search* mode (lists every term with an active
 * catalogue, including non-credit and apprenticeship sub-terms).
 */
export function createTermsClient(session: RegistrationSession) {
  return {
    async list(opts: ListTermsOptions = {}): Promise<TermOption[]> {
      const params = new URLSearchParams({
        searchTerm: opts.searchTerm ?? "",
        offset: String(opts.offset ?? 1),
        max: String(opts.max ?? 20),
      });
      return bannerRequest<TermOption[]>(
        session,
        ssag6Url(session.hosts, `/ssb/classSearch/getTerms?${params}`),
      );
    },

    /** Term picker scoped to *registration* mode — only terms the student can register in. */
    async listForRegistration(opts: ListTermsOptions = {}): Promise<TermOption[]> {
      const params = new URLSearchParams({
        searchTerm: opts.searchTerm ?? "",
        offset: String(opts.offset ?? 1),
        max: String(opts.max ?? 10),
      });
      return bannerRequest<TermOption[]>(
        session,
        ssag6Url(session.hosts, `/ssb/classRegistration/getTerms?${params}`),
      );
    },
  };
}
