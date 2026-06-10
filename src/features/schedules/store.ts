import { acceptHMRUpdate, defineStore } from "pinia";
import { ref, shallowRef } from "vue";
import { explainEmpty } from "@/domain/explain";
import type { Schedule } from "@/domain/types";
import {
  createWorkerExecutor,
  type GenerateInput,
  type ScheduleExecutor,
  syncExecutor,
} from "./executor";

export type GenerationStatus =
  | { kind: "idle" }
  | { kind: "generating" }
  | { kind: "success"; count: number }
  | { kind: "empty"; reason: string }
  | { kind: "error"; message: string };

// Vitest runs in workers already; the app gets the off-main-thread executor.
const defaultExecutor: ScheduleExecutor = import.meta.env.MODE === "test"
  ? syncExecutor
  : createWorkerExecutor();

/**
 * Generated schedules — the derived output of the domain scheduler over
 * the planner inputs the caller assembles (selected catalog slice +
 * rules + pins). `generate()` is awaitable and latest-wins: a re-entrant
 * call supersedes the in-flight one, whose result is discarded.
 */
export const useSchedulesStore = defineStore("schedules", () => {
  const schedules = shallowRef<Schedule[]>([]);
  const activeScheduleIndex = ref(0);
  const generationStatus = ref<GenerationStatus>({ kind: "idle" });

  let executor = defaultExecutor;
  let runId = 0;

  function setSchedules(next: Schedule[]): void {
    schedules.value = next;
  }
  function setActiveScheduleIndex(i: number): void {
    activeScheduleIndex.value = i;
  }
  function clearSchedules(): void {
    runId++;
    schedules.value = [];
    activeScheduleIndex.value = 0;
    generationStatus.value = { kind: "idle" };
  }

  async function generate(input: GenerateInput): Promise<Schedule[]> {
    const myRunId = ++runId;

    if (input.courses.size === 0) {
      generationStatus.value = {
        kind: "empty",
        reason: "No courses selected. Select at least one course in the sidebar.",
      };
      return [];
    }

    generationStatus.value = { kind: "generating" };
    try {
      const result = await executor(input);
      if (myRunId !== runId) return result;

      schedules.value = result;
      activeScheduleIndex.value = 0;
      generationStatus.value =
        result.length === 0
          ? { kind: "empty", reason: explainEmpty(input.courses, input.rules) }
          : { kind: "success", count: result.length };
      return result;
    } catch (e) {
      if (myRunId === runId) {
        generationStatus.value = {
          kind: "error",
          message:
            e instanceof Error
              ? e.message
              : "An unexpected error occurred during schedule generation.",
        };
      }
      return [];
    }
  }

  /** Test hook — swap the executor (e.g. for a failing or recording one). */
  function _setExecutorForTesting(next: ScheduleExecutor | null): void {
    executor = next ?? defaultExecutor;
  }

  return {
    schedules,
    activeScheduleIndex,
    generationStatus,
    setSchedules,
    setActiveScheduleIndex,
    clearSchedules,
    generate,
    _setExecutorForTesting,
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSchedulesStore, import.meta.hot));
}
