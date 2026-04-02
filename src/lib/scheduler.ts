import type {
  CourseSection,
  DayOfWeek,
  MeetingBlock,
  Schedule,
  ScheduleRules,
} from "./types";
import { DEFAULT_RULES } from "./types";
import { scoreSchedule } from "./scoring";

/** Check if two time ranges overlap on the same day */
function timesOverlap(
  start1: number,
  end1: number,
  start2: number,
  end2: number,
): boolean {
  return start1 < end2 && start2 < end1;
}

/** Check if two course sections have any time conflicts */
function hasConflict(a: CourseSection, b: CourseSection): boolean {
  for (const ma of a.meetings) {
    for (const mb of b.meetings) {
      // Check if they share any day
      const sharedDays = ma.days.filter((d) => mb.days.includes(d));
      if (sharedDays.length === 0) continue;
      if (timesOverlap(ma.startTime, ma.endTime, mb.startTime, mb.endTime)) {
        return true;
      }
    }
  }
  return false;
}

/** Check if a section violates hard rules (free days, time bounds) */
function violatesRules(
  section: CourseSection,
  rules: ScheduleRules,
): boolean {
  const earliest = parseInt(rules.earliestStart, 10);
  const latest = parseInt(rules.latestEnd, 10);

  for (const meeting of section.meetings) {
    // Check time bounds
    if (meeting.startTime < earliest || meeting.endTime > latest) {
      return true;
    }
    // Check free days
    for (const day of meeting.days) {
      if (rules.freeDays.includes(day)) {
        return true;
      }
    }
  }

  if (rules.requireOpenSeats && section.seatsAvailable <= 0) {
    return true;
  }

  return false;
}

/** Cartesian product of arrays */
function cartesianProduct<T>(arrays: T[][]): T[][] {
  if (arrays.length === 0) return [[]];
  return arrays.reduce<T[][]>(
    (acc, curr) => acc.flatMap((combo) => curr.map((item) => [...combo, item])),
    [[]],
  );
}

/** Collect all days with on-campus meetings for a set of courses */
function getOnCampusDays(courses: CourseSection[]): DayOfWeek[] {
  const days = new Set<DayOfWeek>();
  for (const course of courses) {
    for (const m of course.meetings) {
      if (!m.isOnline) {
        for (const d of m.days) days.add(d);
      }
    }
  }
  return [...days];
}

export interface GenerateOptions {
  rules?: ScheduleRules;
  /** If set, only generate up to this many schedules (sorted by score) */
  limit?: number;
  /** Progress callback: (completed combinations, total combinations) */
  onProgress?: (done: number, total: number) => void;
}

/** Generate all valid, conflict-free schedules from grouped course sections */
export function generateSchedules(
  courseGroups: Map<string, CourseSection[]>,
  options: GenerateOptions = {},
): Schedule[] {
  const rules = options.rules ?? DEFAULT_RULES;

  // Filter sections that violate hard rules
  const filteredGroups: CourseSection[][] = [];
  const courseNames: string[] = [];

  for (const [name, sections] of courseGroups) {
    const valid = sections.filter((s) => !violatesRules(s, rules));
    if (valid.length > 0) {
      filteredGroups.push(valid);
      courseNames.push(name);
    }
  }

  if (filteredGroups.length === 0) return [];

  // Generate combinations for complete schedules
  const allCombinations = cartesianProduct(filteredGroups);
  const schedules: Schedule[] = [];
  let scheduleId = 1;

  for (let i = 0; i < allCombinations.length; i++) {
    const combo = allCombinations[i];

    // Check for pairwise conflicts
    let valid = true;
    for (let a = 0; a < combo.length && valid; a++) {
      for (let b = a + 1; b < combo.length && valid; b++) {
        if (hasConflict(combo[a], combo[b])) {
          valid = false;
        }
      }
    }
    if (!valid) continue;

    // Check on-campus day limit
    const onCampusDays = getOnCampusDays(combo);
    if (onCampusDays.length > rules.maxOnCampusDays) continue;

    const schedule = scoreSchedule(combo, scheduleId++, rules, false, []);
    schedules.push(schedule);

    if (options.onProgress && i % 500 === 0) {
      options.onProgress(i, allCombinations.length);
    }
  }

  // Optionally generate partial schedules
  if (rules.allowPartialSchedules && filteredGroups.length > 1) {
    for (let omitIdx = 0; omitIdx < filteredGroups.length; omitIdx++) {
      const partialGroups = filteredGroups.filter((_, i) => i !== omitIdx);
      const omittedName = courseNames[omitIdx];
      const partialCombos = cartesianProduct(partialGroups);

      for (const combo of partialCombos) {
        let valid = true;
        for (let a = 0; a < combo.length && valid; a++) {
          for (let b = a + 1; b < combo.length && valid; b++) {
            if (hasConflict(combo[a], combo[b])) valid = false;
          }
        }
        if (!valid) continue;

        const onCampusDays = getOnCampusDays(combo);
        if (onCampusDays.length > rules.maxOnCampusDays) continue;

        const schedule = scoreSchedule(combo, scheduleId++, rules, true, [omittedName]);
        schedules.push(schedule);
      }
    }
  }

  // Sort by quality score descending
  schedules.sort((a, b) => b.qualityScore - a.qualityScore);

  if (options.limit) {
    return schedules.slice(0, options.limit);
  }

  return schedules;
}

/** Get all unique meeting blocks for a schedule, expanded per-day */
export function getExpandedMeetings(
  schedule: Schedule,
): { course: CourseSection; meeting: MeetingBlock; day: DayOfWeek }[] {
  const result: { course: CourseSection; meeting: MeetingBlock; day: DayOfWeek }[] = [];
  for (const course of schedule.courses) {
    for (const meeting of course.meetings) {
      for (const day of meeting.days) {
        result.push({ course, meeting, day });
      }
    }
  }
  return result;
}
