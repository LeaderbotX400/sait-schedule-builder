import { acceptHMRUpdate, defineStore } from "pinia";
import { ref } from "vue";
import { DEFAULT_TERM, TERM_OPTIONS, type TermOption } from "@/lib/terms";
import { persistStore } from "@/lib/persistence";
import { useSchedulesStore } from "@/features/schedules/store";
import { useUiStore } from "@/features/ui-state/store";

/**
 * Active term + the picker option list. Each per-term store (courses,
 * selection, current-reg) keeps its own slot keyed by termCode, so
 * switching the active term swaps which slot is exposed — it does NOT
 * wipe state. That lets the user plan a future term (e.g. Fall 2026),
 * leave, come back, and pick up where they left off.
 *
 * Schedules ARE wiped on term switch: they're a derived view of the
 * active slot and would otherwise flash stale data while the sync
 * watcher refetches.
 */
export const useTermStore = defineStore("term", () => {
  const term = ref<string>(DEFAULT_TERM);
  const termOptions = ref<TermOption[]>([...TERM_OPTIONS]);

  function setTerm(nextTerm: string): void {
    if (term.value === nextTerm) return;
    term.value = nextTerm;

    // Schedules are a derived view of the active slot — wipe so the
    // user doesn't see the previous term's schedules during refetch.
    useSchedulesStore().clearSchedules();

    const ui = useUiStore();
    ui.setLoadError(null);
    ui.setSlotWarnings([]);
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

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useTermStore, import.meta.hot));
}
