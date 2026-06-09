import { acceptHMRUpdate, defineStore } from "pinia";
import { computed, shallowRef } from "vue";
import type { BannerResponse } from "@/banner-sdk/apps/registration/types";
import { parseBannerData } from "@/domain/parser";
import type { CourseSection } from "@/domain/types";
import { useCurrentRegStore } from "@/features/current/store";
import { useSchedulesStore } from "@/features/schedules/store";
import { useSelectionStore } from "@/features/selection/store";
import { useTermStore } from "@/features/term/store";
import { useUiStore } from "@/features/ui-state/store";

/**
 * Per-term course catalog. Each term owns its own slot:
 * `Map<subjectCourse, CourseSection[]>`. The active term's slot is
 * exposed as `courseGroups`. Slot data is NOT persisted — it's a
 * cache rebuilt from live Banner data (listActive for the live term,
 * search.byCourses for future planning terms).
 */
export const useCoursesStore = defineStore("courses", () => {
  const termStore = useTermStore();
  const slots = shallowRef<Map<string, Map<string, CourseSection[]>>>(new Map());

  /** Shared empty so reads on a missing slot are reference-stable. */
  const EMPTY: Map<string, CourseSection[]> = new Map();

  const courseGroups = computed<Map<string, CourseSection[]>>(
    () => slots.value.get(termStore.term) ?? EMPTY,
  );

  function writeSlot(termCode: string, next: Map<string, CourseSection[]>): void {
    const map = new Map(slots.value);
    map.set(termCode, next);
    slots.value = map;
  }

  function setCourseGroups(groups: Map<string, CourseSection[]>): void {
    writeSlot(termStore.term, groups);
  }

  /**
   * Merge a Banner search response into the active term's catalog;
   * also unions the new subjectCourse keys into the selection slot
   * and resets the generated-schedules pane. Returns the section
   * count from the response.
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
    writeSlot(termStore.term, merged);

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
   * Drop a single course from the active-term catalog plus every
   * dependent slice (selection, currentReg, sectionOverrides). Re-
   * running search adds it back.
   */
  function removeCourse(subjectCourse: string): void {
    const cur = courseGroups.value;
    if (!cur.has(subjectCourse)) return;

    const next = new Map(cur);
    next.delete(subjectCourse);
    writeSlot(termStore.term, next);

    useSelectionStore().setSelectedCourses((prev) => {
      if (!prev.has(subjectCourse)) return prev;
      const reduced = new Set(prev);
      reduced.delete(subjectCourse);
      return reduced;
    });

    useCurrentRegStore().forgetCourse(subjectCourse);
    useSchedulesStore().clearSchedules();
  }

  /** Wipe the active term's slot and every dependent slice. */
  function clearCourses(): void {
    writeSlot(termStore.term, new Map());
    useSelectionStore().setSelectedCourses(new Set());
    useSchedulesStore().clearSchedules();
    useCurrentRegStore().clearCurrentReg();
    useUiStore().setLoadError(null);
  }

  function setSlots(next: Map<string, Map<string, CourseSection[]>>): void {
    slots.value = next;
  }

  return {
    slots,
    courseGroups,
    setCourseGroups,
    loadBannerResponse,
    removeCourse,
    clearCourses,
    setSlots,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useCoursesStore, import.meta.hot));
}
