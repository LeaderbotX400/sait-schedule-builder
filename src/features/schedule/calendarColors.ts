import type { ScheduleWarning } from "../../domain/types";

/** Pixel height of a single hour-row in the calendar grid. */
export const HOUR_HEIGHT = 60;

/**
 * Per-course color palette used by both the schedule calendar and the
 * shape calendar. Index assignment is `i % len` against the schedule's
 * course-ID list, so the same course gets the same color across both views.
 */
export const COURSE_COLORS = [
  {
    bg: "bg-blue-900/60",
    bgWarn: "bg-blue-900/30",
    border: "border-l-blue-500",
    borderWarn: "border-l-red-500",
    text: "text-blue-200",
  },
  {
    bg: "bg-emerald-900/60",
    bgWarn: "bg-emerald-900/30",
    border: "border-l-emerald-500",
    borderWarn: "border-l-red-500",
    text: "text-emerald-200",
  },
  {
    bg: "bg-purple-900/60",
    bgWarn: "bg-purple-900/30",
    border: "border-l-purple-500",
    borderWarn: "border-l-red-500",
    text: "text-purple-200",
  },
  {
    bg: "bg-amber-900/60",
    bgWarn: "bg-amber-900/30",
    border: "border-l-amber-500",
    borderWarn: "border-l-red-500",
    text: "text-amber-200",
  },
  {
    bg: "bg-rose-900/60",
    bgWarn: "bg-rose-900/30",
    border: "border-l-rose-500",
    borderWarn: "border-l-red-500",
    text: "text-rose-200",
  },
  {
    bg: "bg-cyan-900/60",
    bgWarn: "bg-cyan-900/30",
    border: "border-l-cyan-500",
    borderWarn: "border-l-red-500",
    text: "text-cyan-200",
  },
  {
    bg: "bg-orange-900/60",
    bgWarn: "bg-orange-900/30",
    border: "border-l-orange-500",
    borderWarn: "border-l-red-500",
    text: "text-orange-200",
  },
  {
    bg: "bg-indigo-900/60",
    bgWarn: "bg-indigo-900/30",
    border: "border-l-indigo-500",
    borderWarn: "border-l-red-500",
    text: "text-indigo-200",
  },
] as const;

export type CourseColor = (typeof COURSE_COLORS)[number];

/** Build a stable courseId → color map matching the existing `i % len` policy. */
export function buildColorMap(courseIds: string[]): Map<string, CourseColor> {
  const m = new Map<string, CourseColor>();
  courseIds.forEach((id, i) => {
    const color = COURSE_COLORS[i % COURSE_COLORS.length];
    if (color) m.set(id, color);
  });
  return m;
}

/** "courseId|day|startTime" lookup keys for per-block warning highlighting. */
export function buildWarningKeys(warnings: ScheduleWarning[]): Set<string> {
  const keys = new Set<string>();
  for (const w of warnings)
    for (const courseId of w.courseIds)
      for (const day of w.days)
        for (const [start] of w.times) keys.add(`${courseId}|${day}|${start}`);
  return keys;
}

/** Course IDs that appear in any warning — used for whole-course tinting. */
export function buildWarnedCourseIds(warnings: ScheduleWarning[]): Set<string> {
  const ids = new Set<string>();
  for (const w of warnings) for (const id of w.courseIds) ids.add(id);
  return ids;
}
