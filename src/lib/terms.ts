export interface TermOption {
  code: string;
  description: string;
}

/**
 * Hardcoded term list shown in the term picker. Banner exposes terms via
 * /ssb/classSearch/getTerms but we fetch eagerly only for active-term
 * detection (see useScheduler). The picker offers the user manual override
 * across recent semesters.
 */
export const TERM_OPTIONS: TermOption[] = [
  { code: "202540", description: "Spring 2026" },
  { code: "202530", description: "Winter 2026" },
  { code: "202520", description: "Fall 2025" },
  { code: "202510", description: "Spring 2025" },
];

export const DEFAULT_TERM = TERM_OPTIONS[0]!.code;

export function describeTerm(code: string | null | undefined): string | null {
  if (!code) return null;
  return TERM_OPTIONS.find((t) => t.code === code)?.description ?? code;
}
