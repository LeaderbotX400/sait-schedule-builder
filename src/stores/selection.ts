import { defineStore } from "pinia";
import { shallowRef } from "vue";
import { persistStore } from "./persistence";

/**
 * Set of currently-selected `subjectCourse` keys — the courses the
 * planner feeds into `generateSchedules`. Backed by a shallow ref so
 * Set instances are swapped wholesale rather than deep-proxied; this
 * matches the immutable-update pattern used across the store.
 */
export const useSelectionStore = defineStore("selection", () => {
  const selectedCourses = shallowRef<Set<string>>(new Set());

  function setSelectedCourses(next: Set<string> | ((prev: Set<string>) => Set<string>)): void {
    selectedCourses.value =
      typeof next === "function" ? next(selectedCourses.value) : next;
  }

  function toggleCourse(subjectCourse: string): void {
    const next = new Set(selectedCourses.value);
    if (next.has(subjectCourse)) next.delete(subjectCourse);
    else next.add(subjectCourse);
    selectedCourses.value = next;
  }

  return { selectedCourses, setSelectedCourses, toggleCourse };
});

export function persistSelectionStore(): void {
  const store = useSelectionStore();
  persistStore({
    store,
    key: "sait-sb-v1:selectedCourses",
    pickState: () => [...store.selectedCourses],
    hydrate: (data) => {
      if (Array.isArray(data)) store.setSelectedCourses(new Set(data));
    },
  });
}
