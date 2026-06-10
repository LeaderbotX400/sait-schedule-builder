import { generateSchedules } from "@/domain/scheduler";
import type { CourseSection, ScheduleRules } from "@/domain/types";

interface GenerateRequest {
  id: number;
  courses: Map<string, CourseSection[]>;
  rules: ScheduleRules;
  pinnedCrns: Map<string, string>;
}

self.onmessage = (e: MessageEvent<GenerateRequest>) => {
  const { id, courses, rules, pinnedCrns } = e.data;
  try {
    const schedules = generateSchedules(courses, { rules, pinnedCrns });
    self.postMessage({ id, ok: true, schedules });
  } catch (err) {
    self.postMessage({
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
