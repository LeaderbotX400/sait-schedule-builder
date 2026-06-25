import { sectionsHaveConflict } from "./conflicts";
import type { CourseSection, ScheduleRules } from "./types";

/**
 * A locked section that conflicts with another selected course makes the
 * whole selection unschedulable (unless partial schedules are allowed, in
 * which case the other course is dropped instead). Find the first such
 * conflict and word it as actionable advice. Returns null when no lock is
 * the culprit.
 */
function explainLockedConflict(
  filtered: Map<string, CourseSection[]>,
  pinnedCrns: Map<string, string>,
): string | null {
  for (const [subjectCourse, crn] of pinnedCrns) {
    const locked = filtered.get(subjectCourse)?.find((s) => s.crn === crn);
    if (!locked) continue; // not selected, or section no longer offered

    for (const [otherCourse, sections] of filtered) {
      if (otherCourse === subjectCourse || sections.length === 0) continue;
      // Every one of this course's sections clashes with the locked one.
      if (!sections.every((s) => sectionsHaveConflict(s, locked))) continue;

      if (pinnedCrns.has(otherCourse)) {
        return `Locked ${locked.identifier} and locked ${sections[0]!.identifier} have a time conflict — they can't both be in a schedule. Unlock one of them.`;
      }
      return `Locked ${locked.identifier} has a time conflict with ${otherCourse}. Enable partial schedules to drop ${otherCourse} and keep the lock, or unlock ${locked.identifier}.`;
    }
  }
  return null;
}

/**
 * Diagnose why a non-empty selection produced zero schedules. Returns
 * a single sentence-cased blurb that the UI surfaces verbatim.
 */
export function explainEmpty(
  filtered: Map<string, CourseSection[]>,
  rules: ScheduleRules,
  pinnedCrns?: Map<string, string>,
): string {
  const reasons: string[] = [];
  const earliest = parseInt(rules.earliestStart, 10);
  const latest = parseInt(rules.latestEnd, 10);
  const allowedPrefixes = rules.sectionPrefixes
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => s.length > 0);

  let allFilteredByTime = true;
  let allFilteredBySeats = true;
  let allFilteredByDays = true;
  let allFilteredByPrefix = allowedPrefixes.length > 0;

  for (const sections of filtered.values()) {
    for (const section of sections) {
      let timeOk = true;
      let dayOk = true;
      for (const m of section.meetings) {
        if (m.startTime < earliest || m.endTime > latest) timeOk = false;
        for (const d of m.days) {
          if (rules.freeDays.includes(d)) dayOk = false;
        }
      }
      if (timeOk) allFilteredByTime = false;
      if (dayOk) allFilteredByDays = false;
      if (section.seatsAvailable > 0) allFilteredBySeats = false;
      if (allowedPrefixes.length > 0) {
        const seq = section.sequenceNumber.toUpperCase();
        // Mirror scheduler.matchesAllowedPrefix: single-char seq numbers
        // bypass the filter, so they shouldn't count as "filtered out" here.
        if (seq.length <= 1 || allowedPrefixes.some((p) => seq.startsWith(p))) {
          allFilteredByPrefix = false;
        }
      }
    }
  }

  if (rules.requireOpenSeats && allFilteredBySeats) {
    reasons.push('All sections are full. Try unchecking "Only show sections with open seats".');
  }
  if (allFilteredByTime) {
    const fmt = (s: string) => s.replace(/(\d{2})(\d{2})/, "$1:$2");
    reasons.push(
      `All sections fall outside your ${fmt(rules.earliestStart)}-${fmt(rules.latestEnd)} time window. Try widening the time range.`,
    );
  }
  if (allFilteredByDays) {
    reasons.push(
      `All sections have classes on your designated free days (${rules.freeDays.join(", ")}). Try removing some free days.`,
    );
  }
  if (allFilteredByPrefix) {
    reasons.push(
      `No sections match the section-prefix filter (${allowedPrefixes.join(", ")}). Clear the prefix field or add another prefix.`,
    );
  }
  if (reasons.length === 0) {
    // No rule filtered everything out — the failure is a pure conflict. If a
    // lock is the cause, name it; otherwise fall back to the generic blurb.
    const lockReason = pinnedCrns && pinnedCrns.size > 0
      ? explainLockedConflict(filtered, pinnedCrns)
      : null;
    reasons.push(
      lockReason ??
        "Every combination of sections has a time conflict. Try selecting fewer courses, allowing partial schedules, or relaxing your rules.",
    );
  }
  return reasons.join(" ");
}
