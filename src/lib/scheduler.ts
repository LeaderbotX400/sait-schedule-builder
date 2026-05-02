import type {
  CourseSection,
  DayOfWeek,
  MeetingBlock,
  OmittedCourse,
  Schedule,
  ScheduleRules,
} from "./types";
import { DEFAULT_RULES, sectionsHaveConflict } from "./types";
import { scoreSchedule } from "./scoring";
import { formatTime } from "./time";

/**
 * Explain why every section of a course was filtered out by the rules.
 * Returns the most specific reason(s) we can determine.
 */
function explainFilteredOut(
  sections: CourseSection[],
  rules: ScheduleRules,
): string {
  if (sections.length === 0) return "No sections were loaded for this course.";

  const earliest = parseInt(rules.earliestStart, 10);
  const latest = parseInt(rules.latestEnd, 10);

  let allTooEarly = true;
  let allTooLate = true;
  let allOnFreeDays = true;
  let allFull = true;

  for (const section of sections) {
    let tooEarly = false;
    let tooLate = false;
    let onFreeDay = false;
    for (const m of section.meetings) {
      if (m.startTime < earliest) tooEarly = true;
      if (m.endTime > latest) tooLate = true;
      for (const d of m.days) {
        if (rules.freeDays.includes(d)) onFreeDay = true;
      }
    }
    if (!tooEarly) allTooEarly = false;
    if (!tooLate) allTooLate = false;
    if (!onFreeDay) allOnFreeDays = false;
    if (section.seatsAvailable > 0) allFull = false;
  }

  const reasons: string[] = [];
  if (allTooEarly) reasons.push(`every section starts before ${formatTime(earliest)}`);
  if (allTooLate) reasons.push(`every section ends after ${formatTime(latest)}`);
  if (allOnFreeDays && rules.freeDays.length > 0) {
    reasons.push(`every section meets on a free day (${rules.freeDays.join(", ")})`);
  }
  if (rules.requireOpenSeats && allFull) reasons.push("every section is full");

  if (reasons.length > 0) return `Filtered: ${reasons.join("; ")}.`;
  return "No sections satisfy your scheduling rules.";
}

/** Explain why a course had to be dropped from a partial schedule. */
function explainConflict(
  omittedSections: CourseSection[],
  chosen: CourseSection[],
): string {
  const conflictingCourses = new Set<string>();
  let allConflict = true;
  for (const section of omittedSections) {
    let conflicts = false;
    for (const other of chosen) {
      if (sectionsHaveConflict(section, other)) {
        conflictingCourses.add(other.identifier);
        conflicts = true;
      }
    }
    if (!conflicts) allConflict = false;
  }
  if (allConflict && conflictingCourses.size > 0) {
    return `Time conflict with ${[...conflictingCourses].join(", ")}.`;
  }
  return "No section fits without violating your on-campus day or conflict rules.";
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
  /** Globally-excluded courses — applies to every generated schedule */
  const baselineOmitted: OmittedCourse[] = [];

  for (const [name, sections] of courseGroups) {
    const valid = sections.filter((s) => !violatesRules(s, rules));
    if (valid.length > 0) {
      filteredGroups.push(valid);
      courseNames.push(name);
    } else {
      baselineOmitted.push({
        subjectCourse: name,
        reason: explainFilteredOut(sections, rules),
      });
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
        if (sectionsHaveConflict(combo[a], combo[b])) {
          valid = false;
        }
      }
    }
    if (!valid) continue;

    // Check on-campus day limit
    const onCampusDays = getOnCampusDays(combo);
    if (onCampusDays.length > rules.maxOnCampusDays) continue;

    const schedule = scoreSchedule(combo, scheduleId++, rules, false, baselineOmitted);
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
      const omittedSections = filteredGroups[omitIdx];
      const partialCombos = cartesianProduct(partialGroups);

      for (const combo of partialCombos) {
        let valid = true;
        for (let a = 0; a < combo.length && valid; a++) {
          for (let b = a + 1; b < combo.length && valid; b++) {
            if (sectionsHaveConflict(combo[a], combo[b])) valid = false;
          }
        }
        if (!valid) continue;

        const onCampusDays = getOnCampusDays(combo);
        if (onCampusDays.length > rules.maxOnCampusDays) continue;

        const omittedForThisSchedule: OmittedCourse[] = [
          ...baselineOmitted,
          {
            subjectCourse: omittedName,
            reason: explainConflict(omittedSections, combo),
          },
        ];
        const schedule = scoreSchedule(combo, scheduleId++, rules, true, omittedForThisSchedule);
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
