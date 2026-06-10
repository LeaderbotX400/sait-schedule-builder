import { watchDebounced } from "@vueuse/core";
import { storeToRefs } from "pinia";
import { watch } from "vue";
import { useAuthStore } from "@/features/auth/store";
import { useCatalogStore } from "@/features/catalog/store";
import { currentGenerateInput, regenerate, syncActiveTerm } from "@/features/planner/actions";
import { useRulesStore } from "@/features/rules/store";
import { useSelectionStore } from "@/features/selection/store";

/** Debounce window for auto-regenerate when selection / rules change. */
const REGEN_DEBOUNCE_MS = 200;

/**
 * Background data sync — thin watcher wiring over the planner actions.
 * Mount once at the root of App.vue.
 *
 * - On becoming authenticated (with the live check done), pull the
 *   plannable terms + the active term's data from Banner. Explicit term
 *   switches re-sync via `planner.switchTerm`, not a watcher.
 * - Debounce a regenerate whenever the planner inputs change.
 */
export function useScheduleSync(): void {
  const { status: authStatus, liveChecked } = storeToRefs(useAuthStore());

  watch(
    [authStatus, liveChecked],
    ([status, checked]) => {
      if (!checked || status !== "authenticated") return;
      void syncActiveTerm({ background: true });
    },
    { immediate: true },
  );

  const { courseGroups } = storeToRefs(useCatalogStore());
  const { selectedCourses, pinnedSections } = storeToRefs(useSelectionStore());
  const { rules } = storeToRefs(useRulesStore());

  watchDebounced(
    [courseGroups, selectedCourses, pinnedSections, rules],
    () => {
      if (currentGenerateInput().courses.size === 0) return;
      void regenerate();
    },
    { debounce: REGEN_DEBOUNCE_MS, deep: true },
  );
}
