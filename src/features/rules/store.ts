import { acceptHMRUpdate, defineStore } from "pinia";
import { shallowRef } from "vue";
import { DEFAULT_RULES } from "@/domain/blockout";
import type { ScheduleRules } from "@/domain/types";

/**
 * Scheduling rules — time bounds, blockout grid, weights, section
 * prefix filter. Cross-term preferences, so they persist across
 * sessions and survive term switches.
 */
export const useRulesStore = defineStore(
  "rules",
  () => {
    // shallowRef so reads stay raw (no reactive Proxy): rules cross the
    // schedule-worker boundary via structured clone, which rejects Proxies.
    // Updates always replace the whole object, never mutate in place.
    const rules = shallowRef<ScheduleRules>({ ...DEFAULT_RULES });

    function setRules(next: ScheduleRules | ((prev: ScheduleRules) => ScheduleRules)): void {
      rules.value = typeof next === "function" ? next(rules.value) : next;
    }

    function patchRules(patch: Partial<ScheduleRules>): void {
      rules.value = { ...rules.value, ...patch };
    }

    return { rules, setRules, patchRules };
  },
  {
    persist: {
      key: "rules",
      version: 1,
      pick: (store) => store.rules,
      apply: (store, data) => {
        if (typeof data !== "object" || data === null || Array.isArray(data)) return;
        // Merge with DEFAULT_RULES so any newly-added rule fields stay defined.
        store.setRules({ ...DEFAULT_RULES, ...data });
      },
    },
  },
);

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useRulesStore, import.meta.hot));
}
