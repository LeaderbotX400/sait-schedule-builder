import type {
  CourseSection,
  DayOfWeek,
  Schedule,
  ScheduleRules,
  ScheduleWarning,
  BlockoutGrid,
} from "./types";
import { ALL_DAYS, GRID_HOURS } from "./types";

function timeToMinutes(time: number): number {
  return Math.floor(time / 100) * 60 + (time % 100);
}

/**
 * Score how well a schedule matches the blockout grid (0-100).
 *
 * - Classes in "preferred" slots: +points
 * - Classes in "blocked" slots: -points (and generate warnings)
 * - Classes in "neutral" slots: 0
 *
 * Returns the fit score and any blockout conflict warnings.
 */
function scoreBlockoutFit(
  courses: CourseSection[],
  blockout: BlockoutGrid,
): { fitScore: number; warnings: ScheduleWarning[] } {
  let preferredHits = 0;
  let preferredTotal = 0;
  let blockedHits = 0;
  const warnings: ScheduleWarning[] = [];

  // Count total preferred cells
  for (const day of ALL_DAYS) {
    for (const hour of GRID_HOURS) {
      if (blockout[day]?.[hour] === "preferred") preferredTotal++;
    }
  }

  // No preferences painted — everything is a perfect fit
  const hasAnyPreference = preferredTotal > 0 ||
    ALL_DAYS.some((d) => GRID_HOURS.some((h) => blockout[d]?.[h] === "blocked"));
  if (!hasAnyPreference) return { fitScore: 100, warnings: [] };

  for (const course of courses) {
    for (const meeting of course.meetings) {
      const startHour = Math.floor(meeting.startTime / 100);
      const endHour = Math.ceil(meeting.endTime / 100);

      for (const day of meeting.days) {
        for (let h = startHour; h < endHour; h++) {
          const cell = blockout[day]?.[h];
          if (cell === "preferred") {
            preferredHits++;
          } else if (cell === "blocked") {
            blockedHits++;
            warnings.push({
              kind: "blockout_conflict",
              message: `${course.identifier} on ${day} at ${h}:00 conflicts with a blocked time slot`,
              courseIds: [course.identifier],
              days: [day],
              times: [[meeting.startTime, meeting.endTime]],
            });
          }
        }
      }
    }
  }

  // Score: reward covering preferred slots, heavily penalize blocked slots
  let fitScore = 50; // baseline
  if (preferredTotal > 0) {
    fitScore += (preferredHits / preferredTotal) * 50;
  }
  fitScore -= blockedHits * 15;

  return {
    fitScore: Math.max(0, Math.min(100, Math.round(fitScore))),
    warnings,
  };
}

export function scoreSchedule(
  courses: CourseSection[],
  id: number,
  rules: ScheduleRules,
  isPartial: boolean,
  omittedCourses: import("./types").OmittedCourse[],
): Schedule {
  const warnings: ScheduleWarning[] = [];
  let score = 100;

  // Collect per-day meetings with course info for warning attribution
  interface DayMeeting {
    startTime: number;
    endTime: number;
    isOnline: boolean;
    courseId: string;
  }
  const dayMeetings: Record<string, DayMeeting[]> = {};
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
          courseId: course.identifier,
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

  // --- Penalty: early morning classes ---
  let earlyCount = 0;
  for (const course of courses) {
    for (const m of course.meetings) {
      if (!m.isOnline && m.startTime <= 800) {
        earlyCount += m.days.length;
        warnings.push({
          kind: "early_morning",
          message: `${course.identifier} starts at ${formatTimeShort(m.startTime)} on ${m.days.join(", ")}`,
          courseIds: [course.identifier],
          days: [...m.days],
          times: [[m.startTime, m.endTime]],
        });
      }
    }
  }
  const earlyMorningPenalty = earlyCount * 10;
  score -= earlyMorningPenalty;

  // --- Penalty: insufficient travel gaps ---
  let travelGapViolations = 0;
  for (const day of daysUsed) {
    const meetings = dayMeetings[day];
    if (!meetings || meetings.length < 2) continue;

    const sorted = [...meetings].sort((a, b) => a.startTime - b.startTime);
    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];

      if (current.isOnline !== next.isOnline) {
        const gapMinutes =
          timeToMinutes(next.startTime) - timeToMinutes(current.endTime);
        if (gapMinutes < rules.minTravelGapMinutes) {
          travelGapViolations++;
          warnings.push({
            kind: "travel_gap",
            message: `${gapMinutes}min gap between ${current.courseId} and ${next.courseId} on ${day} (need ${rules.minTravelGapMinutes}min for ${current.isOnline ? "online" : "campus"}\u2192${next.isOnline ? "online" : "campus"})`,
            courseIds: [current.courseId, next.courseId],
            days: [day as DayOfWeek],
            times: [[current.startTime, current.endTime], [next.startTime, next.endTime]],
          });
        }
      }
    }
  }
  const travelTimePenalty = travelGapViolations * 5;
  score -= travelTimePenalty;

  // --- Penalty: too many on-campus days ---
  if (onCampusDays.length > rules.maxOnCampusDays) {
    const excess = onCampusDays.length - rules.maxOnCampusDays;
    score -= excess * 10;
    warnings.push({
      kind: "campus_days",
      message: `${onCampusDays.length} on-campus days (preferred max: ${rules.maxOnCampusDays})`,
      courseIds: [],
      days: onCampusDays,
      times: [],
    });
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
          warnings.push({
            kind: "large_gap",
            message: `${gap}min gap on ${day} between ${sorted[i].courseId} and ${sorted[i + 1].courseId}`,
            courseIds: [sorted[i].courseId, sorted[i + 1].courseId],
            days: [day as DayOfWeek],
            times: [[sorted[i].startTime, sorted[i].endTime], [sorted[i + 1].startTime, sorted[i + 1].endTime]],
          });
        }
      }
    }
  }

  // --- Penalty: partial schedule ---
  if (isPartial) {
    score -= 20;
    const names = omittedCourses.map((o) => o.subjectCourse).join(", ");
    warnings.push({
      kind: "partial",
      message: `Partial schedule \u2014 missing ${names}`,
      courseIds: [],
      days: [],
      times: [],
    });
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

  // --- Blockout fit ---
  const { fitScore: blockoutFitScore, warnings: blockoutWarnings } =
    scoreBlockoutFit(courses, rules.blockout);
  warnings.push(...blockoutWarnings);

  // Blend blockout score into main score
  const weight = rules.blockoutWeight / 100;
  const baseScore = Math.max(0, Math.min(100, score));
  const blendedScore = Math.round(
    baseScore * (1 - weight) + blockoutFitScore * weight,
  );

  return {
    id,
    qualityScore: Math.max(0, Math.min(100, blendedScore)),
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
    blockoutFitScore,
  };
}

function formatTimeShort(t: number): string {
  const h = Math.floor(t / 100);
  const m = (t % 100).toString().padStart(2, "0");
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m}${period}`;
}
