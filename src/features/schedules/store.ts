import { acceptHMRUpdate, defineStore } from "pinia";
import { ref, shallowRef } from "vue";
import { explainEmpty } from "@/domain/explain";
import { generateSchedules } from "@/domain/scheduler";
import type { CourseSection, Schedule } from "@/domain/types";
import { useCoursesStore } from "@/features/courses/store";
import { usePinnedSectionsStore } from "@/features/schedules/pinnedSections";
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

        const pinnedCrns = usePinnedSectionsStore().pinnedSections;
        const result = generateSchedules(filtered, { rules, pinnedCrns });
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

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSchedulesStore, import.meta.hot));
}
