import type { Schedule, DayOfWeek } from "../lib/types";
import { getExpandedMeetings } from "../lib/scheduler";

interface Props {
  schedule: Schedule;
}

const DISPLAY_DAYS: DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];

const COLORS = [
  { bg: "bg-blue-900/60", border: "border-l-blue-500", text: "text-blue-200" },
  { bg: "bg-emerald-900/60", border: "border-l-emerald-500", text: "text-emerald-200" },
  { bg: "bg-purple-900/60", border: "border-l-purple-500", text: "text-purple-200" },
  { bg: "bg-amber-900/60", border: "border-l-amber-500", text: "text-amber-200" },
  { bg: "bg-rose-900/60", border: "border-l-rose-500", text: "text-rose-200" },
  { bg: "bg-cyan-900/60", border: "border-l-cyan-500", text: "text-cyan-200" },
  { bg: "bg-orange-900/60", border: "border-l-orange-500", text: "text-orange-200" },
  { bg: "bg-indigo-900/60", border: "border-l-indigo-500", text: "text-indigo-200" },
];

function timeToMinutes(t: number): number {
  return Math.floor(t / 100) * 60 + (t % 100);
}

function formatTime(t: number): string {
  const h = Math.floor(t / 100);
  const m = (t % 100).toString().padStart(2, "0");
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m} ${period}`;
}

const HOUR_HEIGHT = 60; // px per hour

export default function CalendarGrid({ schedule }: Props) {
  const expanded = getExpandedMeetings(schedule);

  // Determine time range
  let minTime = 2400;
  let maxTime = 0;
  for (const { meeting } of expanded) {
    if (meeting.startTime < minTime) minTime = meeting.startTime;
    if (meeting.endTime > maxTime) maxTime = meeting.endTime;
  }
  const startHour = Math.floor(minTime / 100);
  const endHour = Math.ceil(maxTime / 100);
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const gridStartMinutes = startHour * 60;
  const totalHeight = hours.length * HOUR_HEIGHT;

  // Color map
  const courseIds = [...new Set(schedule.courses.map((c) => c.identifier))];
  const colorMap = new Map<string, (typeof COLORS)[number]>();
  courseIds.forEach((id, i) => colorMap.set(id, COLORS[i % COLORS.length]));

  // Weekend columns if needed
  const hasSat = expanded.some((e) => e.day === "Sat");
  const hasSun = expanded.some((e) => e.day === "Sun");
  const displayDays = [
    ...DISPLAY_DAYS,
    ...(hasSat ? ["Sat" as DayOfWeek] : []),
    ...(hasSun ? ["Sun" as DayOfWeek] : []),
  ];

  // Group events by day
  const dayEvents = new Map<DayOfWeek, typeof expanded>();
  for (const entry of expanded) {
    if (!displayDays.includes(entry.day)) continue;
    const existing = dayEvents.get(entry.day) ?? [];
    existing.push(entry);
    dayEvents.set(entry.day, existing);
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-[640px]">
        {/* Time labels column */}
        <div className="w-16 shrink-0">
          <div className="h-8" /> {/* Header spacer */}
          <div className="relative" style={{ height: totalHeight }}>
            {hours.map((h, i) => (
              <div
                key={h}
                className="absolute right-1 text-xs text-gray-500"
                style={{ top: i * HOUR_HEIGHT }}
              >
                {formatTime(h * 100)}
              </div>
            ))}
          </div>
        </div>

        {/* Day columns */}
        {displayDays.map((day) => (
          <div key={day} className="flex-1 min-w-[100px]">
            {/* Day header */}
            <div className="h-8 flex items-center justify-center text-sm font-medium text-gray-300 border-b border-gray-700">
              {day}
            </div>
            {/* Time grid + events */}
            <div className="relative border-l border-gray-800/50" style={{ height: totalHeight }}>
              {/* Hour grid lines */}
              {hours.map((_, i) => (
                <div
                  key={i}
                  className="absolute w-full border-b border-gray-800/50"
                  style={{ top: i * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                />
              ))}
              {/* Events */}
              {(dayEvents.get(day) ?? []).map(({ course, meeting }) => {
                const startMin = timeToMinutes(meeting.startTime) - gridStartMinutes;
                const endMin = timeToMinutes(meeting.endTime) - gridStartMinutes;
                const top = (startMin / 60) * HOUR_HEIGHT;
                const height = ((endMin - startMin) / 60) * HOUR_HEIGHT;
                const color = colorMap.get(course.identifier) ?? COLORS[0];

                return (
                  <div
                    key={`${course.crn}-${day}-${meeting.startTime}`}
                    className={`absolute left-0.5 right-0.5 ${color.bg} ${color.border} border-l-3 rounded-r-md overflow-hidden flex flex-col justify-center px-1.5 cursor-default`}
                    style={{ top, height }}
                    title={`${course.identifier} - ${course.title}\n${course.instructor}\n${meeting.building} ${meeting.room}\n${formatTime(meeting.startTime)} - ${formatTime(meeting.endTime)}`}
                  >
                    <div className={`text-xs font-semibold ${color.text} truncate leading-tight`}>
                      {course.identifier}
                    </div>
                    {height > 35 && (
                      <div className="text-[10px] text-gray-400 truncate leading-tight">
                        {meeting.building} {meeting.room}
                      </div>
                    )}
                    {height > 50 && (
                      <div className="text-[10px] text-gray-500 truncate leading-tight">
                        {formatTime(meeting.startTime)}-{formatTime(meeting.endTime)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
