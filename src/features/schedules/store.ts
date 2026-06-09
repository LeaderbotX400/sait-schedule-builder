import { defineStore } from "pinia";
import { ref, shallowRef } from "vue";
import { generateSchedules } from "@/domain/scheduler";
import type { CourseSection, Schedule, ScheduleRules } from "@/domain/types";
import { useCoursesStore } from "@/features/courses/store";
import { useRulesStore } from "@/features/rules/store";
import { useSelectionStore } from "@/features/selection/store";
import { useUiStore } from "@/features/ui-state/store";

export type GenerationStatus =
  | { kind: "idle" }
  | { kind: "generating" }
  | { kind: "success"; count: number }
  | { kind: "empty"; reason: string }
  | { kind: "error"; message: string };

/**
 * Generated schedules — output of the domain scheduler. `generate()`
 * yields once before the (potentially expensive) Cartesian-product
 * loop runs so the "generating" spinner has time to render.
 */
export const useSchedulesStore = defineStore("schedules", () => {
  const schedules = shallowRef<Schedule[]>([]);
  const activeScheduleIndex = ref(0);
  const generationStatus = ref<GenerationStatus>({ kind: "idle" });

  function setSchedules(s: Schedule[]): void {
    schedules.value = s;
  }
  function setActiveScheduleIndex(i: number): void {
    activeScheduleIndex.value = i;
  }
  function clearSchedules(): void {
    schedules.value = [];
    activeScheduleIndex.value = 0;
    generationStatus.value = { kind: "idle" };
  }

  function generate(): void {
    generationStatus.value = { kind: "generating" };
    useUiStore().setLoadError(null);

    setTimeout(() => {
      try {
        const courses = useCoursesStore();
        const selection = useSelectionStore();
        const rules = useRulesStore().rules;

        const filtered = new Map<string, CourseSection[]>();
        for (const [name, sections] of courses.courseGroups) {
          if (selection.selectedCourses.has(name)) filtered.set(name, sections);
        }

        if (filtered.size === 0) {
          generationStatus.value = {
            kind: "empty",
            reason: "No courses selected. Select at least one course in the sidebar.",
          };
          return;
        }

        const result = generateSchedules(filtered, { rules });
        schedules.value = result;
        activeScheduleIndex.value = 0;

        generationStatus.value =
          result.length === 0
            ? { kind: "empty", reason: explainEmpty(filtered, rules) }
            : { kind: "success", count: result.length };
      } catch (e) {
        generationStatus.value = {
          kind: "error",
          message:
            e instanceof Error
              ? e.message
              : "An unexpected error occurred during schedule generation.",
        };
      }
    }, 10);
  }

  return {
    schedules,
    activeScheduleIndex,
    generationStatus,
    setSchedules,
    setActiveScheduleIndex,
    clearSchedules,
    generate,
  };
});

/**
 * Diagnose why a non-empty selection produced zero schedules. Returns
 * a single sentence-cased blurb that the UI surfaces verbatim.
 */
function explainEmpty(filtered: Map<string, CourseSection[]>, rules: ScheduleRules): string {
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
