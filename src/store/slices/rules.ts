import type { StateCreator } from "zustand";
import { DEFAULT_RULES } from "../../domain/blockout";
import type { ScheduleRules } from "../../domain/types";

export interface RulesSlice {
  rules: ScheduleRules;
  setRules: (next: ScheduleRules | ((prev: ScheduleRules) => ScheduleRules)) => void;
}

export const createRulesSlice: StateCreator<RulesSlice, [], [], RulesSlice> = (set) => ({
  rules: DEFAULT_RULES,
  setRules(next) {
    set((s) => ({ rules: typeof next === "function" ? next(s.rules) : next }));
  },
});
