import { acceptHMRUpdate, defineStore } from "pinia";
import { ref } from "vue";
import { DEFAULT_TERM, TERM_OPTIONS, type TermOption } from "@/lib/terms";

/**
 * Active term + the picker option list — pure state, no cascade logic.
 * Switching terms swaps which slot every per-term store exposes; the
 * orchestrated side effects (clearing derived schedules, re-syncing
 * from Banner) live in `features/planner/actions.ts#switchTerm`, which
 * is the only writer of `term` outside hydration.
 */
export const useTermStore = defineStore(
  "term",
  () => {
    const term = ref<string>(DEFAULT_TERM);
    const termOptions = ref<TermOption[]>([...TERM_OPTIONS]);

    function set(nextTerm: string): void {
      term.value = nextTerm;
    }

    function setTermOptions(options: TermOption[]): void {
      termOptions.value = options;
    }

    return { term, termOptions, set, setTermOptions };
  },
  {
    persist: {
      key: "term",
      version: 1,
      pick: (store) => store.term,
      apply: (store, data) => {
        if (typeof data === "string" && data.length > 0) store.set(data);
      },
    },
  },
);

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useTermStore, import.meta.hot));
}
