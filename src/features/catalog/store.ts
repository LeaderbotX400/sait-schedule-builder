import { acceptHMRUpdate, defineStore } from "pinia";
import type { CourseSection } from "@/domain/types";
import { useTermStore } from "@/features/term/store";
import { createTermSlots } from "@/lib/termSlots";

/**
 * Per-term course catalog: `Map<subjectCourse, CourseSection[]>` per
 * term, with the active term's slot exposed as `courseGroups`. Not
 * persisted — it's a cache rebuilt from live Banner data (listActive
 * for the live term, search.byCourses for future planning terms).
 *
 * Pure slot CRUD only. Cross-store workflows (removing a course from
 * the selection too, clearing schedules) live in planner actions.
 */
export const useCatalogStore = defineStore("catalog", () => {
  const termStore = useTermStore();
  const s = createTermSlots<Map<string, CourseSection[]>>({
    term: () => termStore.term,
    empty: () => new Map(),
  });

  function setCourseGroups(groups: Map<string, CourseSection[]>): void {
    s.write(termStore.term, groups);
  }

  /** Merge new search results into the active term's catalog. */
  function mergeCourseGroups(groups: Map<string, CourseSection[]>): void {
    s.update((prev) => {
      const merged = new Map(prev);
      for (const [name, sections] of groups) merged.set(name, sections);
      return merged;
    });
  }

  /** Drop one course from the active term's catalog. */
  function removeCourse(subjectCourse: string): void {
    s.update((prev) => {
      if (!prev.has(subjectCourse)) return prev;
      const next = new Map(prev);
      next.delete(subjectCourse);
      return next;
    });
  }

  function clearCourses(): void {
    s.write(termStore.term, new Map());
  }

  return {
    slots: s.slots,
    courseGroups: s.active,
    setCourseGroups,
    mergeCourseGroups,
    removeCourse,
    clearCourses,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useCatalogStore, import.meta.hot));
}
