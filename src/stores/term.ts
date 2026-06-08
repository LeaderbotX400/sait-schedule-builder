import { defineStore } from "pinia";
import { ref } from "vue";
import { DEFAULT_TERM, TERM_OPTIONS, type TermOption } from "../lib/terms";
import { useCoursesStore } from "./courses";
import { useCurrentRegStore } from "./currentReg";
import { persistStore } from "./persistence";
import { useSchedulesStore } from "./schedules";
import { useSelectionStore } from "./selection";
import { useUiStore } from "./ui";

/**
 * Active term + the picker option list. A subjectCourse key has no
 * meaning across terms (sections differ, prereqs differ, the course
 * may not even exist) — so changing the term wipes all per-term state.
 * Only `rules` survives, since those are real cross-term preferences.
 */
export const useTermStore = defineStore("term", () => {
  const term = ref<string>(DEFAULT_TERM);
  const termOptions = ref<TermOption[]>([...TERM_OPTIONS]);

  function setTerm(nextTerm: string): void {
    if (term.value === nextTerm) return;
    term.value = nextTerm;

    // Cascade-wipe every per-term slice. Each store owns its own
    // "clear" so we don't have to know its internal shape from here.
    useCoursesStore().clearCourses();
    useSchedulesStore().clearSchedules();
    useSelectionStore().setSelectedCourses(new Set());
    useCurrentRegStore().clearCurrentReg();
    useUiStore().setLoadError(null);
  }

  function setTermOptions(options: TermOption[]): void {
    termOptions.value = options;
  }

  return { term, termOptions, setTerm, setTermOptions };
});

/** Persist only `term`; termOptions is fetched live from Banner. */
export function persistTermStore(): void {
  const store = useTermStore();
  persistStore({
    store,
    key: "sait-sb-v1:term",
    pickState: () => store.term,
    hydrate: (data) => {
      if (typeof data === "string" && data.length > 0) store.term = data;
    },
  });
}
