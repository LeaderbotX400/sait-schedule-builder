import type {
  CourseSection,
  DayOfWeek,
  Schedule,
  ScheduleRules,
} from "./types";

const ALL_DAYS: DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Convert "HHMM" time integer to minutes since midnight */
function timeToMinutes(time: number): number {
  const hours = Math.floor(time / 100);
  const minutes = time % 100;
  return hours * 60 + minutes;
}

export function scoreSchedule(
  courses: CourseSection[],
  id: number,
  rules: ScheduleRules,
  isPartial: boolean,
  omittedCourses: string[],
): Schedule {
  const warnings: string[] = [];
  let score = 100;

  // Collect per-day meetings
  const dayMeetings: Record<string, { startTime: number; endTime: number; isOnline: boolean }[]> = {};
  const daysUsedSet = new Set<DayOfWeek>();
  const onCampusDaysSet = new Set<DayOfWeek>();
  const onCampusPerDay: Record<string, number> = {};

  for (const course of courses) {
    for (const m of course.meetings) {
      for (const day of m.days) {
        daysUsedSet.add(day);
        if (!dayMeetings[day]) dayMeetings[day] = [];
        dayMeetings[day].push({
          startTime: m.startTime,
          endTime: m.endTime,
          isOnline: m.isOnline,
        });
        if (!m.isOnline) {
          onCampusDaysSet.add(day);
          onCampusPerDay[day] = (onCampusPerDay[day] ?? 0) + 1;
        }
      }
    }
  }

  const daysUsed = ALL_DAYS.filter((d) => daysUsedSet.has(d));
  const onCampusDays = ALL_DAYS.filter((d) => onCampusDaysSet.has(d));

  // --- Penalty: early morning classes (before preferred start) ---
  const earliestPreferred = parseInt(rules.earliestStart, 10);
  let earlyCount = 0;
  for (const course of courses) {
    for (const m of course.meetings) {
      if (!m.isOnline && m.startTime < earliestPreferred + 100) {
        // Classes starting within 1hr of earliest preferred get penalized
        // Classes at 0800 when preferred is 0900 get a penalty
        if (m.startTime <= 800) {
          earlyCount += m.days.length;
        }
      }
    }
  }
  const earlyMorningPenalty = earlyCount * 10;
  if (earlyCount > 0) {
    warnings.push(`${earlyCount} early morning on-campus class(es)`);
  }
  score -= earlyMorningPenalty;

  // --- Penalty: insufficient travel gaps ---
  let travelGapViolations = 0;
  for (const day of daysUsed) {
    const meetings = dayMeetings[day];
    if (!meetings || meetings.length < 2) continue;

    // Sort by start time
    const sorted = [...meetings].sort((a, b) => a.startTime - b.startTime);
    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];

      // Check online-to-campus transitions
      if (current.isOnline !== next.isOnline) {
        const gapMinutes =
          timeToMinutes(next.startTime) - timeToMinutes(current.endTime);
        if (gapMinutes < rules.minTravelGapMinutes) {
          travelGapViolations++;
        }
      }
    }
  }
  const travelTimePenalty = travelGapViolations * 5;
  if (travelGapViolations > 0) {
    warnings.push(`${travelGapViolations} insufficient travel gap(s)`);
  }
  score -= travelTimePenalty;

  // --- Penalty: too many on-campus days ---
  if (onCampusDays.length > rules.maxOnCampusDays) {
    const excess = onCampusDays.length - rules.maxOnCampusDays;
    score -= excess * 10;
    warnings.push(`${onCampusDays.length} on-campus days (preferred max: ${rules.maxOnCampusDays})`);
  }

  // --- Penalty: on-campus day spread ---
  score -= onCampusDays.length * 5;

  // --- Bonus: on-campus day concentration ---
  if (rules.preferClusteredCampusDays) {
    let concentration = 0;
    for (const count of Object.values(onCampusPerDay)) {
      concentration += count * count;
    }
    score += concentration * 3;
  }

  // --- Penalty: total days used ---
  score -= daysUsed.length;

  // --- Penalty: large gaps between classes ---
  if (rules.maxGapBetweenClasses > 0) {
    for (const day of daysUsed) {
      const meetings = dayMeetings[day];
      if (!meetings || meetings.length < 2) continue;
      const sorted = [...meetings].sort((a, b) => a.startTime - b.startTime);
      for (let i = 0; i < sorted.length - 1; i++) {
        const gap = timeToMinutes(sorted[i + 1].startTime) - timeToMinutes(sorted[i].endTime);
        if (gap > rules.maxGapBetweenClasses) {
          score -= 3;
          warnings.push(
            `${gap}min gap on ${day} exceeds preferred max of ${rules.maxGapBetweenClasses}min`,
          );
        }
      }
    }
  }

  // --- Penalty: partial schedule ---
  if (isPartial) {
    score -= 20;
    warnings.push(`Partial schedule — missing ${omittedCourses.join(", ")}`);
  }

  // --- Day concentration bonus ---
  const dayCourseCount: Record<string, number> = {};
  for (const day of daysUsed) {
    dayCourseCount[day] = dayMeetings[day]?.length ?? 0;
  }
  let dayConcentration = 0;
  for (const count of Object.values(dayCourseCount)) {
    dayConcentration += count * count;
  }
  score += dayConcentration;

  return {
    id,
    qualityScore: Math.max(0, Math.min(100, score)),
    warnings,
    courses,
    daysUsed,
    daysCount: daysUsed.length,
    onCampusDays,
    onCampusDaysCount: onCampusDays.length,
    onCampusPerDay,
    earlyMorningPenalty,
    travelTimePenalty,
    isPartial,
    omittedCourses,
  };
}
