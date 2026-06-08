import type { StateCreator } from "zustand";
import { generateSchedules } from "../../domain/scheduler";
import type { CourseSection, Schedule } from "../../domain/types";
import type { CoursesSlice } from "./courses";
import type { RulesSlice } from "./rules";
import type { SelectionSlice } from "./selection";
import type { UiSlice } from "./ui";

export type GenerationStatus =
  | { kind: "idle" }
  | { kind: "generating" }
  | { kind: "success"; count: number }
  | { kind: "empty"; reason: string }
  | { kind: "error"; message: string };

export interface SchedulesSlice {
  schedules: Schedule[];
  activeScheduleIndex: number;
  generationStatus: GenerationStatus;
  setSchedules: (s: Schedule[]) => void;
  setActiveScheduleIndex: (i: number) => void;
  /**
   * Generate schedules from the currently-selected courses + rules.
   * Pushes a 'generating' status, then yields to the next tick so the
   * spinner has time to render before the (potentially expensive)
   * Cartesian-product loop runs.
   */
  generate: () => void;
}

export const createSchedulesSlice: StateCreator<
  SchedulesSlice & CoursesSlice & RulesSlice & SelectionSlice & UiSlice,
  [],
  [],
  SchedulesSlice
> = (set, get) => ({
  schedules: [],
  activeScheduleIndex: 0,
  generationStatus: { kind: "idle" },

  setSchedules(s) {
    set({ schedules: s });
  },

  setActiveScheduleIndex(i) {
    set({ activeScheduleIndex: i });
  },

  generate() {
    set({ generationStatus: { kind: "generating" } });
    get().setLoadError(null);
    setTimeout(() => {
      try {
        const { courseGroups, selectedCourses, rules } = get();
        const filtered = new Map<string, CourseSection[]>();
        for (const [name, sections] of courseGroups) {
          if (selectedCourses.has(name)) filtered.set(name, sections);
        }

        if (filtered.size === 0) {
          set({
            generationStatus: {
              kind: "empty",
              reason: "No courses selected. Select at least one course in the sidebar.",
            },
          });
          return;
        }

        const result = generateSchedules(filtered, { rules });
        set({ schedules: result, activeScheduleIndex: 0 });

        if (result.length === 0) {
          set({ generationStatus: { kind: "empty", reason: explainEmpty(filtered, rules) } });
        } else {
          set({ generationStatus: { kind: "success", count: result.length } });
        }
      } catch (e) {
        set({
          generationStatus: {
            kind: "error",
            message:
              e instanceof Error
                ? e.message
                : "An unexpected error occurred during schedule generation.",
          },
        });
      }
    }, 10);
  },
});

function explainEmpty(
  filtered: Map<string, CourseSection[]>,
  rules: import("../../domain/types").ScheduleRules,
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
        if (allowedPrefixes.some((p) => seq.startsWith(p))) allFilteredByPrefix = false;
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
    reasons.push(
      "Every combination of sections has a time conflict. Try selecting fewer courses, allowing partial schedules, or relaxing your rules.",
    );
  }
  return reasons.join(" ");
}
