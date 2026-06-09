/**
 * Deterministic color assignment for calendar blocks. Shared by CalendarGrid
 * and any other view that needs courses to render with a consistent hue
 * across re-renders (same course → same color, regardless of render order).
 */
import type { ScheduleWarning } from "../../domain/types";

/** Pixel height of a single hour-row in the calendar grid. */
export const HOUR_HEIGHT = 60;

export interface CourseColorSet {
  bg: string;
  bgWarn: string;
  border: string;
  borderWarn: string;
  text: string;
}

export interface CourseColor {
  dark: CourseColorSet;
  light: CourseColorSet;
}

/**
 * Per-course color palette used by both the schedule calendar and the
 * shape calendar. Index assignment is `i % len` against the schedule's
 * course-ID list, so the same course gets the same color across both views.
 */
export const COURSE_COLORS: CourseColor[] = [
  {
    dark: {
      bg: "bg-blue-900/60",
      bgWarn: "bg-blue-900/30",
      border: "border-l-blue-500",
      borderWarn: "border-l-red-500",
      text: "text-blue-200",
    },
    light: {
      bg: "bg-blue-100",
      bgWarn: "bg-red-50",
      border: "border-l-blue-500",
      borderWarn: "border-l-red-500",
      text: "text-blue-800",
    },
  },
  {
    dark: {
      bg: "bg-emerald-900/60",
      bgWarn: "bg-emerald-900/30",
      border: "border-l-emerald-500",
      borderWarn: "border-l-red-500",
      text: "text-emerald-200",
    },
    light: {
      bg: "bg-emerald-100",
      bgWarn: "bg-red-50",
      border: "border-l-emerald-600",
      borderWarn: "border-l-red-500",
      text: "text-emerald-800",
    },
  },
  {
    dark: {
      bg: "bg-purple-900/60",
      bgWarn: "bg-purple-900/30",
      border: "border-l-purple-500",
      borderWarn: "border-l-red-500",
      text: "text-purple-200",
    },
    light: {
      bg: "bg-purple-100",
      bgWarn: "bg-red-50",
      border: "border-l-purple-600",
      borderWarn: "border-l-red-500",
      text: "text-purple-800",
    },
  },
  {
    dark: {
      bg: "bg-amber-900/60",
      bgWarn: "bg-amber-900/30",
      border: "border-l-amber-500",
      borderWarn: "border-l-red-500",
      text: "text-amber-200",
    },
    light: {
      bg: "bg-amber-100",
      bgWarn: "bg-red-50",
      border: "border-l-amber-600",
      borderWarn: "border-l-red-500",
      text: "text-amber-800",
    },
  },
  {
    dark: {
      bg: "bg-rose-900/60",
      bgWarn: "bg-rose-900/30",
      border: "border-l-rose-500",
      borderWarn: "border-l-red-500",
      text: "text-rose-200",
    },
    light: {
      bg: "bg-rose-100",
      bgWarn: "bg-red-50",
      border: "border-l-rose-500",
      borderWarn: "border-l-red-500",
      text: "text-rose-800",
    },
  },
  {
    dark: {
      bg: "bg-cyan-900/60",
      bgWarn: "bg-cyan-900/30",
      border: "border-l-cyan-500",
      borderWarn: "border-l-red-500",
      text: "text-cyan-200",
    },
    light: {
      bg: "bg-cyan-100",
      bgWarn: "bg-red-50",
      border: "border-l-cyan-600",
      borderWarn: "border-l-red-500",
      text: "text-cyan-800",
    },
  },
  {
    dark: {
      bg: "bg-orange-900/60",
      bgWarn: "bg-orange-900/30",
      border: "border-l-orange-500",
      borderWarn: "border-l-red-500",
      text: "text-orange-200",
    },
    light: {
      bg: "bg-orange-100",
      bgWarn: "bg-red-50",
      border: "border-l-orange-600",
      borderWarn: "border-l-red-500",
      text: "text-orange-800",
    },
  },
  {
    dark: {
      bg: "bg-indigo-900/60",
      bgWarn: "bg-indigo-900/30",
      border: "border-l-indigo-500",
      borderWarn: "border-l-red-500",
      text: "text-indigo-200",
    },
    light: {
      bg: "bg-indigo-100",
      bgWarn: "bg-red-50",
      border: "border-l-indigo-600",
      borderWarn: "border-l-red-500",
      text: "text-indigo-800",
    },
  },
] as const;

/** Build a stable courseId → color map matching the existing `i % len` policy. */
export function buildColorMap(courseIds: string[]): Map<string, CourseColor> {
  const m = new Map<string, CourseColor>();
  courseIds.forEach((id, i) => {
    const color = COURSE_COLORS[i % COURSE_COLORS.length];
    if (color) m.set(id, color);
  });
  return m;
}

/** Derive a light/dark mode string from a resolved theme id. */
export function getThemeMode(resolvedTheme: string): "light" | "dark" {
  return resolvedTheme === "light" || resolvedTheme.endsWith("-light") ? "light" : "dark";
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
