import { generateSchedules } from "@/domain/scheduler";
import type { CourseSection, Schedule, ScheduleRules } from "@/domain/types";
import { createLogger } from "@/lib/logger";

const log = createLogger("schedules");

export interface GenerateInput {
  /** Selected courses only: subjectCourse → candidate sections. */
  courses: Map<string, CourseSection[]>;
  rules: ScheduleRules;
  pinnedCrns: Map<string, string>;
}

export type ScheduleExecutor = (input: GenerateInput) => Promise<Schedule[]>;

/** Direct call on the current thread — used in tests and as the fallback. */
export const syncExecutor: ScheduleExecutor = (input) =>
  Promise.resolve(
    generateSchedules(input.courses, { rules: input.rules, pinnedCrns: input.pinnedCrns }),
  );

interface WorkerReply {
  id: number;
  ok: boolean;
  schedules?: Schedule[];
  error?: string;
}

/**
 * Off-main-thread executor: one lazily-created module Worker, requests
 * matched to replies by id. Maps and plain objects cross the boundary
 * via structured clone. Falls back to `syncExecutor` permanently if the
 * Worker can't be constructed (e.g. an exotic extension context).
 */
export function createWorkerExecutor(): ScheduleExecutor {
  let worker: Worker | null = null;
  let broken = false;
  let nextId = 0;
  const pending = new Map<number, (reply: WorkerReply) => void>();

  function ensureWorker(): Worker | null {
    if (broken) return null;
    if (worker) return worker;
    try {
      worker = new Worker(new URL("./generate.worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = (e: MessageEvent<WorkerReply>) => {
        const resolve = pending.get(e.data.id);
        if (resolve) {
          pending.delete(e.data.id);
          resolve(e.data);
        }
      };
      worker.onerror = (e) => {
        log.warn(`schedule worker error — falling back to sync (${e.message})`);
        failAllPending();
        worker?.terminate();
        worker = null;
        broken = true;
      };
      return worker;
    } catch (err) {
      log.warn(
        `schedule worker unavailable — using sync executor (${err instanceof Error ? err.message : String(err)})`,
      );
      broken = true;
      return null;
    }
  }

  function failAllPending(): void {
    for (const [id, resolve] of pending) {
      resolve({ id, ok: false, error: "worker terminated" });
    }
    pending.clear();
  }

  return async (input) => {
    const w = ensureWorker();
    if (!w) return syncExecutor(input);

    const id = ++nextId;
    const reply = await new Promise<WorkerReply>((resolve) => {
      pending.set(id, resolve);
      w.postMessage({ id, ...input });
    });
    if (!reply.ok || !reply.schedules) {
      if (broken) return syncExecutor(input);
      throw new Error(reply.error ?? "Schedule generation failed in worker.");
    }
    return reply.schedules;
  };
}
