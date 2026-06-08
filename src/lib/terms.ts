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

export function describeTerm(
  code: string | null | undefined,
  options: TermOption[] = TERM_OPTIONS,
): string | null {
  if (!code) return null;
  return options.find((t) => t.code === code)?.description ?? code;
}

/**
 * Merge a live term list (from Banner) with the static fallback, dedupe by
 * code, sort newest-first (SAIT term codes increase monotonically). The
 * static list is the floor — users always see the recent past even if Banner
 * truncates older terms.
 */
export function mergeTermOptions(live: TermOption[]): TermOption[] {
  const byCode = new Map<string, TermOption>();
  for (const t of TERM_OPTIONS) byCode.set(t.code, t);
  for (const t of live) byCode.set(t.code, t);
  return [...byCode.values()].sort((a, b) => b.code.localeCompare(a.code));
}
