import { acceptHMRUpdate, defineStore } from "pinia";
import { shallowRef } from "vue";
import type { BannerResponse } from "@/banner-sdk/apps/registration/types";
import { parseBannerData } from "@/domain/parser";
import type { CourseSection } from "@/domain/types";
import { useCurrentRegStore } from "@/features/current/store";
import { useSchedulesStore } from "@/features/schedules/store";
import { useSelectionStore } from "@/features/selection/store";
import { useUiStore } from "@/features/ui-state/store";

/**
 * Course catalog for the active term. Indexed by `subjectCourse`
 * (Banner's group key — see [[sait-data-model]]). Mutations are
 * immutable: a new Map is assigned to trigger reactivity, mirroring
 * the Zustand `set((s) => new Map(s.courseGroups))` pattern.
 */
export const useCoursesStore = defineStore("courses", () => {
  const courseGroups = shallowRef<Map<string, CourseSection[]>>(new Map());

  function setCourseGroups(groups: Map<string, CourseSection[]>): void {
    courseGroups.value = groups;
  }

  /**
   * Merge a Banner search response into the existing catalog; also
   * adds the new subjectCourse keys to the selection set and resets
   * the generated-schedules pane. Returns the count of new sections.
   */
  function loadBannerResponse(response: BannerResponse): number {
    const ui = useUiStore();

    if (!response.data || response.data.length === 0) {
      ui.setLoadError(
        "Banner returned no course sections. Double-check that the course codes exist for the selected term.",
      );
      return 0;
    }
    const newGroups = parseBannerData(response);
    if (newGroups.size === 0) {
      ui.setLoadError("Received data but no valid course sections could be parsed.");
      return 0;
    }

    const merged = new Map(courseGroups.value);
    for (const [name, sections] of newGroups) merged.set(name, sections);
    courseGroups.value = merged;

    const selection = useSelectionStore();
    selection.setSelectedCourses((prev) => {
      const next = new Set(prev);
      for (const name of newGroups.keys()) next.add(name);
      return next;
    });

    useSchedulesStore().clearSchedules();
    ui.setLoadError(null);

    return response.data.length;
  }

  /**
   * Drop a single course from the catalog plus every dependent slice
   * (selection, currentReg, sectionOverrides, includedCourses) so the
   * planner stops considering it. Re-running search adds it back.
   */
  function removeCourse(subjectCourse: string): void {
    if (!courseGroups.value.has(subjectCourse)) return;

    const next = new Map(courseGroups.value);
    next.delete(subjectCourse);
    courseGroups.value = next;

    useSelectionStore().setSelectedCourses((prev) => {
      if (!prev.has(subjectCourse)) return prev;
      const reduced = new Set(prev);
      reduced.delete(subjectCourse);
      return reduced;
    });

    useCurrentRegStore().forgetCourse(subjectCourse);
    useSchedulesStore().clearSchedules();
  }

  function clearCourses(): void {
    courseGroups.value = new Map();
    useSelectionStore().setSelectedCourses(new Set());
    useSchedulesStore().clearSchedules();
    useCurrentRegStore().clearCurrentReg();
    useUiStore().setLoadError(null);
  }

  return {
    courseGroups,
    setCourseGroups,
    loadBannerResponse,
    removeCourse,
    clearCourses,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useCoursesStore, import.meta.hot));
}
