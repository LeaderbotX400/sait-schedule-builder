import { formatTimeCompact, timeToMinutes } from "./time";
import type {
  BlockoutGrid,
  CourseSection,
  DayOfWeek,
  OmittedCourse,
  Schedule,
  ScheduleRules,
  ScheduleWarning,
} from "./types";
import { ALL_DAYS, GRID_HOURS } from "./types";

/**
 * Scoring philosophy: each schedule starts at SCORE_BASELINE (100) and
 * accumulates penalties (subtractions) plus two clustering bonuses (squared
 * meeting counts per day reward dense days over scattered days). The
 * blockout-fit score (0–100, computed independently) is then blended in,
 * weighted by `rules.blockoutWeight / 100`. Final score is clamped to [0, 100].
 *
 * Penalty weights are intentionally relative: early-morning is the harshest
 * hit because students rank it as the worst attribute, while per-day-used at
 * -1 just nudges toward fewer days when other factors tie.
 */
const SCORE_BASELINE = 100;

// Class times <= this count as "early morning" (HHMM, so 0800 = 8:00 AM).
const EARLY_MORNING_THRESHOLD = 800;

const PENALTY_EARLY_MORNING_PER_MEETING = 10;
const PENALTY_TRAVEL_GAP_PER_VIOLATION = 5;
const PENALTY_EXCESS_CAMPUS_DAY = 10;
const PENALTY_PER_CAMPUS_DAY = 5;
const PENALTY_PER_DAY_USED = 1;
const PENALTY_LARGE_GAP = 3;
const PENALTY_PARTIAL_SCHEDULE = 20;

// Reward dense days: each day contributes (meetings_on_day)^2 to a sum that
// is multiplied by the per-square weight. Campus-cluster only counts on-campus
// meetings; day-cluster counts all meetings (online + campus).
const BONUS_CAMPUS_CLUSTER_PER_SQUARE = 3;
const BONUS_DAY_CLUSTER_PER_SQUARE = 1;

const BLOCKOUT_FIT_BASELINE = 50;
const BLOCKOUT_FIT_PREFERRED_BONUS_MAX = 50;
const BLOCKOUT_FIT_BLOCKED_PENALTY_PER_HIT = 15;
const BLOCKOUT_FIT_NO_PREFERENCE_SCORE = 100;

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
  const hasAnyPreference =
    preferredTotal > 0 ||
    ALL_DAYS.some((d) => GRID_HOURS.some((h) => blockout[d]?.[h] === "blocked"));
  if (!hasAnyPreference) return { fitScore: BLOCKOUT_FIT_NO_PREFERENCE_SCORE, warnings: [] };

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
  let fitScore = BLOCKOUT_FIT_BASELINE;
  if (preferredTotal > 0) {
    fitScore += (preferredHits / preferredTotal) * BLOCKOUT_FIT_PREFERRED_BONUS_MAX;
  }
  fitScore -= blockedHits * BLOCKOUT_FIT_BLOCKED_PENALTY_PER_HIT;

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
  omittedCourses: OmittedCourse[],
): Schedule {
  const warnings: ScheduleWarning[] = [];
  let score = SCORE_BASELINE;

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
      if (!m.isOnline && m.startTime <= EARLY_MORNING_THRESHOLD) {
        earlyCount += m.days.length;
        warnings.push({
          kind: "early_morning",
          message: `${course.identifier} starts at ${formatTimeCompact(m.startTime)} on ${m.days.join(", ")}`,
          courseIds: [course.identifier],
          days: [...m.days],
          times: [[m.startTime, m.endTime]],
        });
      }
    }
  }
  const earlyMorningPenalty = earlyCount * PENALTY_EARLY_MORNING_PER_MEETING;
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
      if (!current || !next) continue;

      if (current.isOnline !== next.isOnline) {
        const gapMinutes = timeToMinutes(next.startTime) - timeToMinutes(current.endTime);
        if (gapMinutes < rules.minTravelGapMinutes) {
          travelGapViolations++;
          warnings.push({
            kind: "travel_gap",
            message: `${gapMinutes}min gap between ${current.courseId} and ${next.courseId} on ${day} (need ${rules.minTravelGapMinutes}min for ${current.isOnline ? "online" : "campus"}→${next.isOnline ? "online" : "campus"})`,
            courseIds: [current.courseId, next.courseId],
            days: [day],
            times: [
              [current.startTime, current.endTime],
              [next.startTime, next.endTime],
            ],
          });
        }
      }
    }
  }
  const travelTimePenalty = travelGapViolations * PENALTY_TRAVEL_GAP_PER_VIOLATION;
  score -= travelTimePenalty;

  // --- Penalty: too many on-campus days ---
  if (onCampusDays.length > rules.maxOnCampusDays) {
    const excess = onCampusDays.length - rules.maxOnCampusDays;
    score -= excess * PENALTY_EXCESS_CAMPUS_DAY;
    warnings.push({
      kind: "campus_days",
      message: `${onCampusDays.length} on-campus days (preferred max: ${rules.maxOnCampusDays})`,
      courseIds: [],
      days: onCampusDays,
      times: [],
    });
  }

  // --- Penalty: on-campus day spread ---
  score -= onCampusDays.length * PENALTY_PER_CAMPUS_DAY;

  // --- Bonus: on-campus day concentration (rewards dense campus days) ---
  if (rules.preferClusteredCampusDays) {
    let concentration = 0;
    for (const count of Object.values(onCampusPerDay)) {
      concentration += count * count;
    }
    score += concentration * BONUS_CAMPUS_CLUSTER_PER_SQUARE;
  }

  // --- Penalty: total days used ---
  score -= daysUsed.length * PENALTY_PER_DAY_USED;

  // --- Penalty: large gaps between classes ---
  if (rules.maxGapBetweenClasses > 0) {
    for (const day of daysUsed) {
      const meetings = dayMeetings[day];
      if (!meetings || meetings.length < 2) continue;
      const sorted = [...meetings].sort((a, b) => a.startTime - b.startTime);
      for (let i = 0; i < sorted.length - 1; i++) {
        const current = sorted[i];
        const next = sorted[i + 1];
        if (!current || !next) continue;
        const gap = timeToMinutes(next.startTime) - timeToMinutes(current.endTime);
        if (gap > rules.maxGapBetweenClasses) {
          score -= PENALTY_LARGE_GAP;
          warnings.push({
            kind: "large_gap",
            message: `${gap}min gap on ${day} between ${current.courseId} and ${next.courseId}`,
            courseIds: [current.courseId, next.courseId],
            days: [day],
            times: [
              [current.startTime, current.endTime],
              [next.startTime, next.endTime],
            ],
          });
        }
      }
    }
  }

  // --- Penalty: partial schedule ---
  if (isPartial) {
    score -= PENALTY_PARTIAL_SCHEDULE;
    const names = omittedCourses.map((o) => o.subjectCourse).join(", ");
    warnings.push({
      kind: "partial",
      message: `Partial schedule — missing ${names}`,
      courseIds: [],
      days: [],
      times: [],
    });
  }

  // --- Bonus: per-day meeting concentration (rewards dense days overall) ---
  const dayCourseCount: Record<string, number> = {};
  for (const day of daysUsed) {
    dayCourseCount[day] = dayMeetings[day]?.length ?? 0;
  }
  let dayConcentration = 0;
  for (const count of Object.values(dayCourseCount)) {
    dayConcentration += count * count;
  }
  score += dayConcentration * BONUS_DAY_CLUSTER_PER_SQUARE;

  // --- Blockout fit ---
  const { fitScore: blockoutFitScore, warnings: blockoutWarnings } = scoreBlockoutFit(
    courses,
    rules.blockout,
  );
  warnings.push(...blockoutWarnings);

  // Blend blockout score into main score
  const weight = rules.blockoutWeight / 100;
  const baseScore = Math.max(0, Math.min(100, score));
  const blendedScore = Math.round(baseScore * (1 - weight) + blockoutFitScore * weight);

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
