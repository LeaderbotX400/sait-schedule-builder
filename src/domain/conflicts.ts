import type { CourseSection, CurrentRegistration } from "./types";

/** Two HHMM time ranges overlap on the same day. */
export function timesOverlap(start1: number, end1: number, start2: number, end2: number): boolean {
  return start1 < end2 && start2 < end1;
}

/** Two sections meet on the same day at overlapping times. */
export function sectionsHaveConflict(a: CourseSection, b: CourseSection): boolean {
  for (const ma of a.meetings) {
    for (const mb of b.meetings) {
      const sharedDays = ma.days.filter((d) => mb.days.includes(d));
      if (sharedDays.length === 0) continue;
      if (timesOverlap(ma.startTime, ma.endTime, mb.startTime, mb.endTime)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Resolve the section currently active for a course: the swap override (if
 * the user picked a different section) else the original currentSection from
 * Banner. Returns undefined when the course isn't tracked or the override
 * identifier no longer matches a known section.
 */
export function resolveCurrentSection(
  subjectCourse: string,
  currentRegs: Map<string, CurrentRegistration>,
  sectionOverrides: Map<string, string>,
  courseGroups: Map<string, CourseSection[]>,
): CourseSection | undefined {
  const reg = currentRegs.get(subjectCourse);
  if (!reg) return undefined;
  const overrideId = sectionOverrides.get(subjectCourse);
  if (overrideId) {
    return courseGroups.get(subjectCourse)?.find((s) => s.identifier === overrideId);
  }
  return reg.currentSection;
}
