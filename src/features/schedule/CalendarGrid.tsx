import { useMemo, useRef, useState } from "react";
import { getExpandedMeetings } from "../../domain/scheduler";
import { formatTime, timeToMinutes } from "../../domain/time";
import type {
  BlockoutGrid,
  CourseSection,
  DayOfWeek,
  MeetingBlock,
  Schedule,
} from "../../lib/types";
import { getThemeMode, useTheme } from "../../theme/useTheme";
import {
  buildColorMap,
  buildWarnedCourseIds,
  buildWarningKeys,
  COURSE_COLORS,
  HOUR_HEIGHT,
} from "../schedule/calendarColors";

interface Props {
  schedule: Schedule;
  /** Optional: show blockout shading behind the calendar */
  blockout?: BlockoutGrid;
}

const DISPLAY_DAYS: DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];

interface HoveredEvent {
  course: CourseSection;
  meeting: MeetingBlock;
  blockTop: number;
  blockBottom: number;
  blockCenterX: number;
}

const TOOLTIP_WIDTH = 240;
const TOOLTIP_HEIGHT = 170;
const ARROW_SIZE = 8;
const TOOLTIP_PADDING = 8;

function EventTooltip({
  event,
  containerRef,
}: {
  event: HoveredEvent;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { course, meeting } = event;
  const showAbove = event.blockTop >= TOOLTIP_HEIGHT + ARROW_SIZE + TOOLTIP_PADDING;
  const top = showAbove
    ? event.blockTop - TOOLTIP_HEIGHT - ARROW_SIZE
    : event.blockBottom + ARROW_SIZE;
  const containerWidth = containerRef.current?.scrollWidth ?? 800;
  const rawLeft = event.blockCenterX - TOOLTIP_WIDTH / 2;
  const left = Math.max(
    TOOLTIP_PADDING,
    Math.min(rawLeft, containerWidth - TOOLTIP_WIDTH - TOOLTIP_PADDING),
  );

  const seatsColor = course.seatsAvailable > 0 ? "text-success" : "text-destructive";

  return (
    <div
      className="absolute z-50 pointer-events-none rounded-lg border border-edge bg-surface/95 shadow-xl backdrop-blur-sm p-2.5"
      style={{ top, left, width: TOOLTIP_WIDTH }}
    >
      {/* Arrow */}
      <div
        className="absolute border-transparent"
        style={
          showAbove
            ? {
                bottom: -ARROW_SIZE,
                left: event.blockCenterX - left - ARROW_SIZE,
                borderWidth: `${ARROW_SIZE}px ${ARROW_SIZE}px 0`,
                borderTopColor: "var(--color-edge)",
              }
            : {
                top: -ARROW_SIZE,
                left: event.blockCenterX - left - ARROW_SIZE,
                borderWidth: `0 ${ARROW_SIZE}px ${ARROW_SIZE}px`,
                borderBottomColor: "var(--color-edge)",
              }
        }
      />
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono font-semibold text-sm text-fg leading-tight">
          {course.identifier}
        </span>
        <span className="text-[10px] text-fg-faint font-mono shrink-0 mt-0.5">
          CRN {course.crn}
        </span>
      </div>
      <div className="text-xs text-fg-muted mt-0.5 leading-snug">{course.title}</div>

      <div className="border-t border-edge-subtle my-1.5" />

      {/* Time */}
      <div className="flex items-center gap-1.5 text-xs text-fg">
        <span className="text-fg-faint text-[10px]">⏱</span>
        {formatTime(meeting.startTime)} – {formatTime(meeting.endTime)}
      </div>
      {/* Location */}
      <div className="flex items-center gap-1.5 text-xs text-fg mt-0.5">
        <span className="text-fg-faint text-[10px]">📍</span>
        {meeting.isOnline ? "Online" : `${meeting.building} ${meeting.room}`}
      </div>
      {/* Instructor */}
      <div className="text-xs text-fg-muted mt-0.5 truncate">{course.instructor}</div>

      <div className="border-t border-edge-subtle my-1.5" />

      {/* Bottom metadata */}
      <div className="grid grid-cols-3 gap-x-2">
        <div>
          <div className="text-[9px] text-fg-faint uppercase tracking-wide">Method</div>
          <div className="text-xs text-fg font-medium truncate">{course.instructionalMethod}</div>
        </div>
        <div>
          <div className="text-[9px] text-fg-faint uppercase tracking-wide">Seats</div>
          <div className={`text-xs font-medium ${seatsColor}`}>
            {course.seatsAvailable}/{course.maximumEnrollment}
          </div>
        </div>
        <div>
          <div className="text-[9px] text-fg-faint uppercase tracking-wide">Credits</div>
          <div className="text-xs text-fg font-medium">{course.creditHours ?? "—"}</div>
        </div>
      </div>
    </div>
  );
}

export default function CalendarGrid({ schedule, blockout }: Props) {
  const [hoveredEvent, setHoveredEvent] = useState<HoveredEvent | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const themeMode = getThemeMode(useTheme((s) => s.resolved));

  const expanded = getExpandedMeetings(schedule);

  // Determine time range; fall back to a sensible default when no courses are loaded
  let minTime = 2400;
  let maxTime = 0;
  for (const { meeting } of expanded) {
    if (meeting.startTime < minTime) minTime = meeting.startTime;
    if (meeting.endTime > maxTime) maxTime = meeting.endTime;
  }
  const startHour = expanded.length > 0 ? Math.floor(minTime / 100) : 8;
  const endHour = expanded.length > 0 ? Math.ceil(maxTime / 100) : 21;
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const gridStartMinutes = startHour * 60;
  const totalHeight = hours.length * HOUR_HEIGHT;

  // Color map
  const courseIds = [...new Set(schedule.courses.map((c) => c.identifier))];
  const colorMap = buildColorMap(courseIds);

  // Warning lookups
  const warningKeys = useMemo(() => buildWarningKeys(schedule.warnings), [schedule.warnings]);
  const warnedCourseIds = useMemo(
    () => buildWarnedCourseIds(schedule.warnings),
    [schedule.warnings],
  );

  // Weekend columns if needed
  const displayDays: DayOfWeek[] = [...DISPLAY_DAYS];

  // Group events by day
  const dayEvents = new Map<DayOfWeek, typeof expanded>();
  for (const entry of expanded) {
    if (!displayDays.includes(entry.day)) continue;
    const existing = dayEvents.get(entry.day) ?? [];
    existing.push(entry);
    dayEvents.set(entry.day, existing);
  }

  return (
    <div
      className="overflow-x-auto relative"
      ref={containerRef}
      onScroll={() => setHoveredEvent(null)}
    >
      <div className="flex min-w-[640px]">
        {/* Time labels column */}
        <div className="w-16 shrink-0">
          <div className="h-8" />
          <div className="relative" style={{ height: totalHeight }}>
            {hours.map((h, i) => (
              <div
                key={h}
                className="absolute right-1 text-xs text-fg-faint"
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
            <div className="h-8 flex items-center justify-center text-sm font-medium text-fg-muted border-b border-edge">
              {day}
            </div>
            <div className="relative border-l border-edge-subtle" style={{ height: totalHeight }}>
              {/* Blockout shading */}
              {blockout &&
                hours.map((h, i) => {
                  const cell = blockout[day]?.[h];
                  if (!cell || cell === "neutral") return null;
                  return (
                    <div
                      key={`bo-${h}`}
                      className={`absolute w-full ${
                        cell === "preferred" ? "bg-success/8" : "bg-destructive/8"
                      }`}
                      style={{ top: i * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                    />
                  );
                })}

              {/* Hour grid lines */}
              {hours.map((_, i) => (
                <div
                  key={i}
                  className="absolute w-full border-b border-edge-subtle"
                  style={{ top: i * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                />
              ))}

              {/* Events */}
              {(dayEvents.get(day) ?? []).map(({ course, meeting }) => {
                const startMin = timeToMinutes(meeting.startTime) - gridStartMinutes;
                const endMin = timeToMinutes(meeting.endTime) - gridStartMinutes;
                const top = (startMin / 60) * HOUR_HEIGHT;
                const height = ((endMin - startMin) / 60) * HOUR_HEIGHT;
                const colorSlot = colorMap.get(course.identifier) ?? COURSE_COLORS[0]!;
                const color = themeMode === "light" ? colorSlot.light : colorSlot.dark;

                // Check if this specific block has a warning
                const blockKey = `${course.identifier}|${day}|${meeting.startTime}`;
                const hasBlockWarning = warningKeys.has(blockKey);
                const hasCourseWarning = warnedCourseIds.has(course.identifier);
                const isWarned = hasBlockWarning || hasCourseWarning;

                return (
                  <div
                    key={`course-${course.identifier}-${day}-${meeting.startTime}`}
                    className={`absolute left-0.5 right-0.5 ${isWarned ? color.bgWarn : color.bg} ${isWarned ? color.borderWarn : color.border} border-l-3 rounded-r-md overflow-hidden flex flex-col justify-center px-1.5 cursor-default transition-colors`}
                    style={{ top, height }}
                    onMouseEnter={(e) => {
                      if (!containerRef.current) return;
                      const br = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      const cr = containerRef.current.getBoundingClientRect();
                      const sl = containerRef.current.scrollLeft;
                      setHoveredEvent({
                        course,
                        meeting,
                        blockTop: br.top - cr.top + containerRef.current.scrollTop,
                        blockBottom: br.bottom - cr.top + containerRef.current.scrollTop,
                        blockCenterX: br.left - cr.left + sl + br.width / 2,
                      });
                    }}
                    onMouseLeave={() => setHoveredEvent(null)}
                  >
                    <div className="flex items-center gap-1">
                      {isWarned && (
                        <span
                          className="text-[10px] text-destructive shrink-0"
                          title="This class has a scheduling issue"
                        >
                          &#x26A0;
                        </span>
                      )}
                      <span
                        className={`text-xs font-semibold ${color.text} truncate leading-tight`}
                      >
                        {course.identifier}
                      </span>
                    </div>
                    {height > 35 && (
                      <div className="text-[10px] text-fg-muted truncate leading-tight">
                        {meeting.building} {meeting.room}
                      </div>
                    )}
                    {height > 50 && (
                      <div className="text-[10px] text-fg-faint truncate leading-tight">
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
      {hoveredEvent && <EventTooltip event={hoveredEvent} containerRef={containerRef} />}
    </div>
  );
}
