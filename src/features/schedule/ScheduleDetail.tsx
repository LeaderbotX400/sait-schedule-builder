import { useMemo } from "react";
import { downloadICal } from "../../domain/ical";
import { formatTime } from "../../domain/time";
import type { Schedule, ScheduleRules, ScheduleWarning } from "../../lib/types";

interface Props {
  schedule: Schedule;
  rules?: ScheduleRules;
}

const WARNING_STYLES: Record<string, WarningStyle> = {
  early_morning: {
    icon: "\u23F0",
    color: "text-orange-400",
    bg: "bg-orange-900/20",
    border: "border-orange-800/50",
  },
  travel_gap: {
    icon: "\uD83D\uDE97",
    color: "text-red-400",
    bg: "bg-red-900/20",
    border: "border-red-800/50",
  },
  campus_days: {
    icon: "\uD83C\uDFEB",
    color: "text-yellow-400",
    bg: "bg-yellow-900/20",
    border: "border-yellow-800/50",
  },
  large_gap: {
    icon: "\u23F3",
    color: "text-amber-400",
    bg: "bg-amber-900/20",
    border: "border-amber-800/50",
  },
  partial: {
    icon: "\u2702\uFE0F",
    color: "text-yellow-400",
    bg: "bg-yellow-900/20",
    border: "border-yellow-800/50",
  },
  blockout_conflict: {
    icon: "\uD83D\uDEAB",
    color: "text-red-400",
    bg: "bg-red-900/20",
    border: "border-red-800/50",
  },
};

interface WarningStyle {
  icon: string;
  color: string;
  bg: string;
  border: string;
}

const FALLBACK_STYLE: WarningStyle = WARNING_STYLES.partial!;
function getWarningStyle(kind: string): WarningStyle {
  return WARNING_STYLES[kind] ?? FALLBACK_STYLE;
}

function WarningCard({ warning }: { warning: ScheduleWarning }) {
  const style = getWarningStyle(warning.kind);
  return (
    <div
      className={`rounded-lg ${style.bg} border ${style.border} px-3 py-2 flex items-start gap-2`}
    >
      <span className="text-sm mt-0.5">{style.icon}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-xs ${style.color}`}>{warning.message}</p>
        {warning.courseIds.length > 0 && (
          <p className="text-[10px] text-gray-500 mt-0.5">
            Affects: {warning.courseIds.join(", ")}
          </p>
        )}
      </div>
    </div>
  );
}

/** Group warnings so we don't repeat the same blockout conflict per hour */
function dedupeBlockoutWarnings(warnings: ScheduleWarning[]): ScheduleWarning[] {
  const seen = new Set<string>();
  const result: ScheduleWarning[] = [];
  for (const w of warnings) {
    if (w.kind === "blockout_conflict") {
      const key = `${w.courseIds.join(",")}-${w.days.join(",")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      // Merge into a single warning per course+day
      result.push({
        ...w,
        message: `${w.courseIds[0]} on ${w.days[0]} overlaps with blocked time`,
      });
    } else {
      result.push(w);
    }
  }
  return result;
}

export default function ScheduleDetail({ schedule }: Props) {
  const handleExportICal = () => downloadICal(schedule);

  const dedupedWarnings = useMemo(
    () => dedupeBlockoutWarnings(schedule.warnings),
    [schedule.warnings],
  );

  // Build per-course warning map for the course cards
  const courseWarnings = useMemo(() => {
    const map = new Map<string, ScheduleWarning[]>();
    for (const w of dedupedWarnings) {
      for (const id of w.courseIds) {
        const existing = map.get(id) ?? [];
        existing.push(w);
        map.set(id, existing);
      }
    }
    return map;
  }, [dedupedWarnings]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Schedule #{schedule.id}</h2>
          <div className="flex items-center gap-3 text-sm text-gray-400">
            <span>{schedule.courses.length} courses</span>
            <span>{schedule.daysCount} days</span>
            <span>{schedule.onCampusDaysCount} on-campus</span>
            {schedule.blockoutFitScore < 100 && schedule.blockoutFitScore > 0 && (
              <span className="text-xs text-blue-400">
                {schedule.blockoutFitScore}% blockout match
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-2xl font-bold ${
              schedule.qualityScore >= 80
                ? "text-emerald-400"
                : schedule.qualityScore >= 60
                  ? "text-yellow-400"
                  : schedule.qualityScore >= 40
                    ? "text-orange-400"
                    : "text-red-400"
            }`}
          >
            {schedule.qualityScore}
          </span>
          <span className="text-xs text-gray-500">/100</span>
        </div>
      </div>

      {/* Warnings */}
      {dedupedWarnings.length > 0 && (
        <div className="space-y-1.5">
          {dedupedWarnings.map((w, i) => (
            <WarningCard key={i} warning={w} />
          ))}
        </div>
      )}

      {/* Excluded courses with explanations */}
      {schedule.omittedCourses.length > 0 && (
        <div className="rounded-lg bg-gray-900/40 border border-gray-800 px-3 py-2 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
            Not included in this schedule
          </p>
          {schedule.omittedCourses.map((o) => (
            <div key={o.subjectCourse} className="flex items-baseline gap-2 text-xs">
              <span className="font-mono font-semibold text-gray-300 shrink-0">
                {o.subjectCourse}
              </span>
              <span className="text-gray-500">{o.reason}</span>
            </div>
          ))}
        </div>
      )}

      {/* Course list */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-gray-300">Course Details</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {schedule.courses.map((course) => {
            const cWarnings = courseWarnings.get(course.identifier);
            const hasIssue = !!cWarnings && cWarnings.length > 0;

            return (
              <div
                key={course.crn}
                className={`rounded-lg px-3 py-2 ${
                  hasIssue
                    ? "bg-red-950/30 border border-red-900/50"
                    : "bg-gray-800/50 border border-gray-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-semibold text-white">
                    {hasIssue && <span className="text-red-400 mr-1">&#x26A0;</span>}
                    {course.identifier}
                  </span>
                  <span className="text-xs text-gray-500">CRN: {course.crn}</span>
                </div>
                <div className="text-sm text-gray-300">{course.title}</div>
                <div className="text-xs text-gray-500">
                  {course.instructor} &middot; {course.instructionalMethod}
                </div>
                <div className="text-xs text-gray-500">
                  {course.seatsAvailable}/{course.maximumEnrollment} seats available
                </div>
                <div className="mt-1 space-y-0.5">
                  {course.meetings.map((m, i) => (
                    <div key={i} className="text-xs text-gray-400">
                      {m.days.join(", ")} {formatTime(m.startTime)}-{formatTime(m.endTime)}
                      <span className="text-gray-600 ml-1">
                        {m.building} {m.room}
                      </span>
                    </div>
                  ))}
                </div>
                {/* Per-course warnings */}
                {cWarnings && cWarnings.length > 0 && (
                  <div className="mt-1.5 space-y-0.5">
                    {cWarnings.map((w, i) => {
                      const style = getWarningStyle(w.kind);
                      return (
                        <div key={i} className={`text-[10px] ${style.color}`}>
                          {style.icon} {w.message}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Export */}
      <div className="flex gap-2">
        <button
          onClick={handleExportICal}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
        >
          Export to iCal (.ics)
        </button>
      </div>
    </div>
  );
}
