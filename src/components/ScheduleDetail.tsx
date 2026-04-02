import type { Schedule } from "../lib/types";
import { downloadICal } from "../lib/ical";
import CalendarGrid from "./CalendarGrid";

interface Props {
  schedule: Schedule;
}

function formatTime(t: number): string {
  const h = Math.floor(t / 100);
  const m = (t % 100).toString().padStart(2, "0");
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m} ${period}`;
}

export default function ScheduleDetail({ schedule }: Props) {
  const handleExportICal = () => {
    // Default semester dates — user could customize these
    const start = new Date(2026, 4, 4); // May 4, 2026 (Monday)
    const end = new Date(2026, 7, 14); // Aug 14, 2026
    downloadICal(schedule, start, end);
  };

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
      {schedule.warnings.length > 0 && (
        <div className="rounded-lg bg-yellow-900/20 border border-yellow-800/50 px-3 py-2 space-y-1">
          {schedule.warnings.map((w, i) => (
            <div key={i} className="text-xs text-yellow-400">
              &#x26A0; {w}
            </div>
          ))}
        </div>
      )}

      {/* Calendar */}
      <div className="rounded-lg bg-gray-800/50 border border-gray-700 p-3">
        <CalendarGrid schedule={schedule} />
      </div>

      {/* Course list */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-gray-300">Course Details</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {schedule.courses.map((course) => (
            <div
              key={course.crn}
              className="rounded-lg bg-gray-800/50 border border-gray-700 px-3 py-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-semibold text-white">
                  {course.identifier}
                </span>
                <span className="text-xs text-gray-500">CRN: {course.crn}</span>
              </div>
              <div className="text-sm text-gray-300">{course.title}</div>
              <div className="text-xs text-gray-500">
                {course.instructor} &middot; {course.instructionalMethod}
              </div>
              <div className="text-xs text-gray-500">
                {course.seatsAvailable}/{course.maximumEnrollment} seats
                available
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
            </div>
          ))}
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
