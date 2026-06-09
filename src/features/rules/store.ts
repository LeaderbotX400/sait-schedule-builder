import { defineStore } from "pinia";
import { ref } from "vue";
import { DEFAULT_RULES } from "@/domain/blockout";
import type { ScheduleRules } from "@/domain/types";
import { persistStore } from "@/lib/persistence";

/**
 * Scheduling rules — time bounds, blockout grid, weights, section
 * prefix filter. Cross-term preferences, so they persist across
 * sessions and survive term switches.
 */
export const useRulesStore = defineStore("rules", () => {
  const rules = ref<ScheduleRules>({ ...DEFAULT_RULES });

  function setRules(next: ScheduleRules | ((prev: ScheduleRules) => ScheduleRules)): void {
    rules.value = typeof next === "function" ? next(rules.value) : next;
  }

  function patchRules(patch: Partial<ScheduleRules>): void {
    rules.value = { ...rules.value, ...patch };
  }

  return { rules, setRules, patchRules };
});

/**
 * Install persistence for the rules store. Called once from main.ts
 * (after `createPinia()`) so hydration happens before the first paint.
 */
export function persistRulesStore(): void {
  const store = useRulesStore();
  persistStore({
    store,
    key: "sait-sb-v1:rules",
    pickState: () => store.rules,
    hydrate: (data) => {
      // Merge with DEFAULT_RULES so any newly-added rule fields stay defined.
      store.setRules({ ...DEFAULT_RULES, ...data });
    },
  });
}
