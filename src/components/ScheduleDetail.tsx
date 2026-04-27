import { useMemo, useState, useCallback } from "react";
import type { Schedule, ScheduleWarning, ScheduleRules, RegistrationBatchResult } from "../lib/types";
import { downloadICal } from "../lib/ical";
import type { BannerCredentials } from "../lib/api";
import { registerSchedule } from "../lib/api";

interface Props {
  schedule: Schedule;
  rules?: ScheduleRules;
  credentials?: BannerCredentials | null;
  term?: string | null;
  /** CRNs the student is already enrolled in — these are skipped on register */
  registeredCrns?: Set<string>;
}

function formatTime(t: number): string {
  const h = Math.floor(t / 100);
  const m = (t % 100).toString().padStart(2, "0");
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m} ${period}`;
}

const WARNING_STYLES: Record<string, { icon: string; color: string; bg: string; border: string }> = {
  early_morning: { icon: "\u23F0", color: "text-orange-400", bg: "bg-orange-900/20", border: "border-orange-800/50" },
  travel_gap: { icon: "\uD83D\uDE97", color: "text-red-400", bg: "bg-red-900/20", border: "border-red-800/50" },
  campus_days: { icon: "\uD83C\uDFEB", color: "text-yellow-400", bg: "bg-yellow-900/20", border: "border-yellow-800/50" },
  large_gap: { icon: "\u23F3", color: "text-amber-400", bg: "bg-amber-900/20", border: "border-amber-800/50" },
  partial: { icon: "\u2702\uFE0F", color: "text-yellow-400", bg: "bg-yellow-900/20", border: "border-yellow-800/50" },
  blockout_conflict: { icon: "\uD83D\uDEAB", color: "text-red-400", bg: "bg-red-900/20", border: "border-red-800/50" },
};

function WarningCard({ warning }: { warning: ScheduleWarning }) {
  const style = WARNING_STYLES[warning.kind] ?? WARNING_STYLES.partial;
  return (
    <div className={`rounded-lg ${style.bg} border ${style.border} px-3 py-2 flex items-start gap-2`}>
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

type RegisterState =
  | { kind: "idle" }
  | { kind: "confirming" }
  | { kind: "loading" }
  | { kind: "done"; result: RegistrationBatchResult };

export default function ScheduleDetail({ schedule, credentials, term, registeredCrns }: Props) {
  const [registerState, setRegisterState] = useState<RegisterState>({ kind: "idle" });

  const newCrns = useMemo(
    () => schedule.courses.map((c) => c.crn).filter((crn) => !registeredCrns?.has(crn)),
    [schedule.courses, registeredCrns],
  );

  const handleRegister = useCallback(async () => {
    if (!credentials || !term) return;
    setRegisterState({ kind: "loading" });
    const result = await registerSchedule(credentials, term, newCrns);
    setRegisterState({ kind: "done", result });
  }, [credentials, term, newCrns]);

  const handleExportICal = () => {
    const start = new Date(2026, 4, 4);
    const end = new Date(2026, 7, 14);
    downloadICal(schedule, start, end);
  };

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
          <h2 className="text-lg font-semibold text-white">
            Schedule #{schedule.id}
          </h2>
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
                      {m.days.join(", ")} {formatTime(m.startTime)}-
                      {formatTime(m.endTime)}
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
                      const style = WARNING_STYLES[w.kind] ?? WARNING_STYLES.partial;
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

      {/* Registration */}
      {credentials && term && (
        <div className="space-y-2">
          {registerState.kind === "idle" && (
            newCrns.length > 0 ? (
              <button
                onClick={() => setRegisterState({ kind: "confirming" })}
                className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
              >
                Register This Schedule ({newCrns.length} new course{newCrns.length !== 1 ? "s" : ""})
              </button>
            ) : (
              <div className="rounded-lg bg-emerald-900/30 border border-emerald-800 px-3 py-2 text-xs text-emerald-300">
                All courses in this schedule are already registered.
              </div>
            )
          )}

          {registerState.kind === "confirming" && (
            <div className="rounded-lg bg-yellow-900/20 border border-yellow-800 p-3 space-y-3">
              <p className="text-sm text-yellow-200 font-medium">Register {newCrns.length} course{newCrns.length !== 1 ? "s" : ""} in Banner?</p>
              <ul className="space-y-0.5">
                {schedule.courses
                  .filter((c) => newCrns.includes(c.crn))
                  .map((c) => (
                    <li key={c.crn} className="text-xs text-gray-300">
                      {c.identifier} — {c.title} <span className="text-gray-500">(CRN {c.crn})</span>
                    </li>
                  ))}
              </ul>
              <div className="flex gap-2">
                <button
                  onClick={handleRegister}
                  className="flex-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
                >
                  Confirm Registration
                </button>
                <button
                  onClick={() => setRegisterState({ kind: "idle" })}
                  className="rounded-lg bg-gray-700 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {registerState.kind === "loading" && (
            <div className="rounded-lg bg-gray-800 border border-gray-700 px-4 py-3 flex items-center gap-3">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-blue-400 border-r-transparent" />
              <span className="text-sm text-gray-300">Registering courses in Banner…</span>
            </div>
          )}

          {registerState.kind === "done" && (
            <div className="space-y-2">
              {registerState.result.error && (
                <div className="rounded-lg bg-red-900/30 border border-red-800 px-3 py-2 text-xs text-red-400">
                  {registerState.result.error}
                </div>
              )}
              {registerState.result.items.map((item) => (
                <div
                  key={item.crn}
                  className={`rounded-lg px-3 py-2 flex items-start gap-2 ${
                    item.success
                      ? "bg-emerald-900/20 border border-emerald-800"
                      : "bg-red-900/20 border border-red-800"
                  }`}
                >
                  <span className={`text-sm mt-0.5 ${item.success ? "text-emerald-400" : "text-red-400"}`}>
                    {item.success ? "✓" : "✗"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium ${item.success ? "text-emerald-300" : "text-red-300"}`}>
                      {item.courseTitle}
                      <span className="text-gray-500 ml-1 font-normal">(CRN {item.crn})</span>
                    </p>
                    {item.errors.length > 0 && (
                      <ul className="mt-0.5 space-y-0.5">
                        {item.errors.map((e, i) => (
                          <li key={i} className="text-xs text-red-400 flex items-baseline gap-1.5">
                            {e.messageType && (
                              <span className="shrink-0 font-mono text-[10px] bg-red-900/50 px-1 rounded">
                                {e.messageType}
                              </span>
                            )}
                            {e.message}
                          </li>
                        ))}
                      </ul>
                    )}
                    {item.success && (
                      <p className="text-xs text-gray-500">Status: {item.finalStatus}</p>
                    )}
                  </div>
                </div>
              ))}
              <button
                onClick={() => setRegisterState({ kind: "idle" })}
                className="text-xs text-gray-500 hover:text-gray-300"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      )}

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
