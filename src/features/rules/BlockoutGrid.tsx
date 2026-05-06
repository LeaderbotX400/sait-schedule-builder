import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { getExpandedMeetings } from "../../domain/scheduler";
import { formatHour, formatTime, timeToMinutes } from "../../domain/time";
import type {
  BlockoutCell,
  BlockoutGrid as BlockoutGridType,
  CourseSection,
  DayOfWeek,
  MeetingBlock,
  Schedule,
  ScheduleRules,
} from "../../lib/types";
import { createEmptyBlockout, GRID_HOURS, WEEKDAYS } from "../../lib/types";
import {
  buildColorMap,
  buildWarnedCourseIds,
  buildWarningKeys,
  COURSE_COLORS,
  HOUR_HEIGHT,
} from "../schedule/calendarColors";

interface Props {
  blockout: BlockoutGridType;
  onBlockoutChange: (blockout: BlockoutGridType) => void;
  rules: ScheduleRules;
  blockoutWeight: number;
  onBlockoutWeightChange: (weight: number) => void;
  schedule?: Schedule | null;
  /** All sections for the selected courses — alternative sections are rendered as grey ghosts */
  courseGroups?: Map<string, CourseSection[]>;
  selectedCourses?: Set<string>;
}

interface ExpandedMeeting {
  course: CourseSection;
  meeting: MeetingBlock;
  day: DayOfWeek;
}

const PAINT_MODES: { value: BlockoutCell; label: string }[] = [
  { value: "preferred", label: "Classes here" },
  { value: "blocked", label: "No classes" },
  { value: "neutral", label: "Erase" },
];

const HARD_BLOCKED_STYLE: React.CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(135deg, transparent, transparent 3px, rgba(255,255,255,0.035) 3px, rgba(255,255,255,0.035) 6px)",
  backgroundColor: "rgba(0,0,0,0.32)",
};

interface DayCellsProps {
  day: DayOfWeek;
  hours: number[];
  dayBlockout: Record<number, BlockoutCell> | undefined;
  isHardBlocked: (day: DayOfWeek, hour: number) => boolean;
  onMouseDown: (day: DayOfWeek, hour: number) => void;
  onMouseEnter: (day: DayOfWeek, hour: number) => void;
}

const DayCells = React.memo(function DayCells({
  day,
  hours,
  dayBlockout,
  isHardBlocked,
  onMouseDown,
  onMouseEnter,
}: DayCellsProps) {
  return (
    <>
      {hours.map((h, i) => {
        const hardBlocked = isHardBlocked(day, h);
        const cell = dayBlockout?.[h] ?? "neutral";
        return (
          <div
            key={`cell-${h}`}
            className={`absolute w-full border-b border-gray-800/30 ${
              hardBlocked
                ? ""
                : cell === "preferred"
                  ? "bg-emerald-500/[.22]"
                  : cell === "blocked"
                    ? "bg-red-500/[.22]"
                    : ""
            }`}
            style={{
              top: i * HOUR_HEIGHT,
              height: HOUR_HEIGHT,
              zIndex: 0,
              ...(hardBlocked ? HARD_BLOCKED_STYLE : {}),
              cursor: hardBlocked ? "not-allowed" : "crosshair",
            }}
            onMouseDown={() => onMouseDown(day, h)}
            onMouseEnter={() => onMouseEnter(day, h)}
          />
        );
      })}
    </>
  );
});

function fitBadgeStyle(score: number): string {
  if (score >= 80) return "bg-emerald-900/60 text-emerald-300 border border-emerald-700/60";
  if (score >= 60) return "bg-amber-900/60 text-amber-300 border border-amber-700/60";
  return "bg-red-900/60 text-red-300 border border-red-700/60";
}

export default function BlockoutGrid({
  blockout,
  onBlockoutChange,
  rules,
  blockoutWeight,
  onBlockoutWeightChange,
  schedule,
  courseGroups,
  selectedCourses,
}: Props) {
  const [paintMode, setPaintMode] = useState<BlockoutCell>("preferred");
  const [isPainting, setIsPainting] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const blockoutRef = useRef(blockout);
  useLayoutEffect(() => {
    blockoutRef.current = blockout;
  });

  const winStartHour = useMemo(
    () => Math.floor(parseInt(rules.earliestStart, 10) / 100),
    [rules.earliestStart],
  );
  const winEndHour = useMemo(
    () => Math.ceil(parseInt(rules.latestEnd, 10) / 100),
    [rules.latestEnd],
  );
  const hardBlockedDays = useMemo(() => new Set(rules.freeDays), [rules.freeDays]);

  const isHardBlocked = useCallback(
    (day: DayOfWeek, hour: number): boolean => {
      if (!WEEKDAYS.includes(day)) return true;
      if (hardBlockedDays.has(day)) return true;
      if (hour < winStartHour || hour >= winEndHour) return true;
      return false;
    },
    [hardBlockedDays, winStartHour, winEndHour],
  );

  // Schedule event helpers
  const expanded = useMemo(() => (schedule ? getExpandedMeetings(schedule) : []), [schedule]);

  // Ghost (alternative) meetings: any section of a selected course that isn't
  // chosen for the active schedule. Lets the user see the options that were
  // available but not picked.
  const ghosts = useMemo((): ExpandedMeeting[] => {
    if (!courseGroups || !selectedCourses) return [];
    const activeCrns = new Set(schedule?.courses.map((c) => c.crn) ?? []);
    const out: ExpandedMeeting[] = [];
    for (const subjectCourse of selectedCourses) {
      const sections = courseGroups.get(subjectCourse) ?? [];
      for (const section of sections) {
        if (activeCrns.has(section.crn)) continue;
        for (const meeting of section.meetings) {
          for (const day of meeting.days) {
            out.push({ course: section, meeting, day });
          }
        }
      }
    }
    return out;
  }, [courseGroups, selectedCourses, schedule]);

  // Time range: GRID_HOURS, expanded by both active and ghost events
  const hours = useMemo(() => {
    let minHour = GRID_HOURS[0] ?? 7;
    let maxHour = (GRID_HOURS[GRID_HOURS.length - 1] ?? 21) + 1;
    const consider = (m: MeetingBlock) => {
      const sh = Math.floor(m.startTime / 100);
      const eh = Math.ceil(m.endTime / 100);
      if (sh < minHour) minHour = sh;
      if (eh > maxHour) maxHour = eh;
    };
    for (const { meeting } of expanded) consider(meeting);
    for (const { meeting } of ghosts) consider(meeting);
    return Array.from({ length: maxHour - minHour }, (_, i) => minHour + i);
  }, [expanded, ghosts]);

  const gridStartMinutes = (hours[0] ?? 7) * 60;
  const totalHeight = hours.length * HOUR_HEIGHT;

  // Weekend columns when active or ghost meetings need them
  const displayDays = useMemo((): DayOfWeek[] => {
    const hasSat = expanded.some((e) => e.day === "Sat") || ghosts.some((g) => g.day === "Sat");
    const hasSun = expanded.some((e) => e.day === "Sun") || ghosts.some((g) => g.day === "Sun");
    return [
      ...WEEKDAYS,
      ...(hasSat ? (["Sat"] as DayOfWeek[]) : []),
      ...(hasSun ? (["Sun"] as DayOfWeek[]) : []),
    ];
  }, [expanded, ghosts]);
  const courseIds = useMemo(
    () => [...new Set(schedule?.courses.map((c) => c.identifier) ?? [])],
    [schedule],
  );
  const colorMap = useMemo(() => buildColorMap(courseIds), [courseIds]);
  const warningKeys = useMemo(() => buildWarningKeys(schedule?.warnings ?? []), [schedule]);
  const warnedCourseIds = useMemo(() => buildWarnedCourseIds(schedule?.warnings ?? []), [schedule]);

  const dayEvents = useMemo(() => {
    const m = new Map<DayOfWeek, ExpandedMeeting[]>();
    for (const entry of expanded) {
      if (!displayDays.includes(entry.day)) continue;
      const existing = m.get(entry.day) ?? [];
      existing.push(entry);
      m.set(entry.day, existing);
    }
    return m;
  }, [expanded, displayDays]);

  const dayGhosts = useMemo(() => {
    const m = new Map<DayOfWeek, ExpandedMeeting[]>();
    for (const entry of ghosts) {
      if (!displayDays.includes(entry.day)) continue;
      const existing = m.get(entry.day) ?? [];
      existing.push(entry);
      m.set(entry.day, existing);
    }
    return m;
  }, [ghosts, displayDays]);

  // Paint interaction
  const paint = useCallback(
    (day: DayOfWeek, hour: number) => {
      if (isHardBlocked(day, hour)) return;
      const next = { ...blockoutRef.current };
      next[day] = { ...next[day], [hour]: paintMode };
      onBlockoutChange(next);
    },
    [onBlockoutChange, paintMode, isHardBlocked],
  );

  const handleMouseDown = useCallback(
    (day: DayOfWeek, hour: number) => {
      if (isHardBlocked(day, hour)) return;
      setIsPainting(true);
      paint(day, hour);
    },
    [paint, isHardBlocked],
  );

  const handleMouseEnter = useCallback(
    (day: DayOfWeek, hour: number) => {
      if (isPainting) paint(day, hour);
    },
    [isPainting, paint],
  );

  const handleMouseUp = useCallback(() => setIsPainting(false), []);

  return (
    <div className="rounded-xl bg-gray-900/60 border border-gray-800/80 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-800/80 bg-gray-900/40 flex-wrap gap-y-2">
        {/* Paint mode segmented control */}
        <div className="flex rounded-lg overflow-hidden border border-gray-700/60 text-xs font-medium shrink-0">
          {PAINT_MODES.map((mode, i) => (
            <button
              key={mode.value}
              onClick={() => setPaintMode(mode.value)}
              className={`px-3 py-1.5 transition-colors ${i > 0 ? "border-l border-gray-700/60" : ""} ${
                paintMode === mode.value
                  ? mode.value === "preferred"
                    ? "bg-emerald-700 text-white"
                    : mode.value === "blocked"
                      ? "bg-red-700 text-white"
                      : "bg-gray-600 text-white"
                  : "bg-gray-800/80 text-gray-400 hover:text-gray-200 hover:bg-gray-700/60"
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => onBlockoutChange(createEmptyBlockout())}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors shrink-0"
        >
          Clear
        </button>

        <div className="flex-1" />

        {/* Shape influence slider */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-gray-500 hidden sm:block">Shape influence</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={blockoutWeight}
            onChange={(e) => onBlockoutWeightChange(parseInt(e.target.value, 10))}
            className="w-20 accent-blue-500"
          />
          <span className="text-xs font-medium text-gray-300 tabular-nums w-8">
            {blockoutWeight}%
          </span>
        </div>

        {/* Fit score badge */}
        {schedule && (
          <div
            className={`shrink-0 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${fitBadgeStyle(schedule.blockoutFitScore)}`}
          >
            <span>Shape match</span>
            <span>{schedule.blockoutFitScore}%</span>
          </div>
        )}
      </div>

      {/* Scrollable calendar */}
      <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-300px)]">
        <div
          ref={gridRef}
          className="flex min-w-[560px] select-none"
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Time label column */}
          <div className="w-14 shrink-0">
            <div className="h-8" />
            <div className="relative" style={{ height: totalHeight }}>
              {hours.map((h, i) => (
                <div
                  key={h}
                  className="absolute right-2 text-[10px] text-gray-500 leading-none"
                  style={{ top: i * HOUR_HEIGHT - 6 }}
                >
                  {formatHour(h)}
                </div>
              ))}
            </div>
          </div>

          {/* Day columns */}
          {displayDays.map((day) => {
            const isDayHardBlocked = hardBlockedDays.has(day) || !WEEKDAYS.includes(day);
            return (
              <div key={day} className="flex-1 min-w-[80px]">
                {/* Column header */}
                <div
                  className={`h-8 flex flex-col items-center justify-center border-b border-gray-700/60 ${
                    isDayHardBlocked ? "opacity-40" : ""
                  }`}
                >
                  <span className="text-xs font-medium text-gray-300">{day}</span>
                  {hardBlockedDays.has(day) && (
                    <span className="text-[8px] text-red-400 leading-none">day off</span>
                  )}
                </div>

                {/* Cell + event layer */}
                <div
                  className="relative border-l border-gray-800/40"
                  style={{ height: totalHeight }}
                >
                  <DayCells
                    day={day}
                    hours={hours}
                    dayBlockout={blockout[day]}
                    isHardBlocked={isHardBlocked}
                    onMouseDown={handleMouseDown}
                    onMouseEnter={handleMouseEnter}
                  />

                  {/* Ghost (alternative) sections — possible options not chosen */}
                  {(dayGhosts.get(day) ?? []).map(({ course, meeting }, idx) => {
                    const startMin = timeToMinutes(meeting.startTime) - gridStartMinutes;
                    const endMin = timeToMinutes(meeting.endTime) - gridStartMinutes;
                    const top = (startMin / 60) * HOUR_HEIGHT;
                    const height = ((endMin - startMin) / 60) * HOUR_HEIGHT;
                    return (
                      <div
                        key={`ghost-${course.crn}-${day}-${meeting.startTime}-${idx}`}
                        className="absolute left-0.5 right-0.5 bg-gray-700/25 border border-dashed border-gray-500/50 rounded-r-md overflow-hidden flex flex-col justify-center px-1.5"
                        style={{ top, height, zIndex: 1, pointerEvents: "none" }}
                        title={`Alternative: ${course.identifier} - ${course.title}\n${course.instructor}\n${meeting.building} ${meeting.room}\n${formatTime(meeting.startTime)} - ${formatTime(meeting.endTime)}`}
                      >
                        <span className="text-[10px] font-medium text-gray-400 truncate leading-tight italic">
                          {course.identifier}
                        </span>
                        {height > 35 && (
                          <div className="text-[9px] text-gray-500 truncate leading-tight">
                            {formatTime(meeting.startTime)}–{formatTime(meeting.endTime)}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Schedule events */}
                  {schedule &&
                    (dayEvents.get(day) ?? []).map(({ course, meeting }) => {
                      const startMin = timeToMinutes(meeting.startTime) - gridStartMinutes;
                      const endMin = timeToMinutes(meeting.endTime) - gridStartMinutes;
                      const top = (startMin / 60) * HOUR_HEIGHT;
                      const height = ((endMin - startMin) / 60) * HOUR_HEIGHT;
                      const color = colorMap.get(course.identifier) ?? COURSE_COLORS[0];

                      const blockKey = `${course.identifier}|${day}|${meeting.startTime}`;
                      const isWarned =
                        warningKeys.has(blockKey) || warnedCourseIds.has(course.identifier);

                      return (
                        <div
                          key={`${course.crn}-${day}-${meeting.startTime}`}
                          className={`absolute left-0.5 right-0.5 ${isWarned ? color.bgWarn : color.bg} ${isWarned ? color.borderWarn : color.border} border-l-[3px] rounded-r-md overflow-hidden flex flex-col justify-center px-1.5`}
                          style={{ top, height, zIndex: 2, pointerEvents: "none" }}
                          title={`${course.identifier} - ${course.title}\n${course.instructor}\n${meeting.building} ${meeting.room}\n${formatTime(meeting.startTime)} - ${formatTime(meeting.endTime)}`}
                        >
                          <div className="flex items-center gap-1">
                            {isWarned && (
                              <span className="text-[10px] text-red-400 shrink-0">&#x26A0;</span>
                            )}
                            <span
                              className={`text-xs font-semibold ${color.text} truncate leading-tight`}
                            >
                              {course.identifier}
                            </span>
                          </div>
                          {height > 35 && (
                            <div className="text-[10px] text-gray-400 truncate leading-tight">
                              {meeting.building} {meeting.room}
                            </div>
                          )}
                          {height > 50 && (
                            <div className="text-[10px] text-gray-500 truncate leading-tight">
                              {formatTime(meeting.startTime)}–{formatTime(meeting.endTime)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 border-t border-gray-800/60 text-[10px] text-gray-600">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-emerald-500/[.22] border border-emerald-600/40" />
          Preferred
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-red-500/[.22] border border-red-600/40" />
          Blocked
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-3 rounded-sm"
            style={{
              backgroundImage:
                "repeating-linear-gradient(135deg, transparent, transparent 3px, rgba(255,255,255,0.06) 3px, rgba(255,255,255,0.06) 6px)",
              backgroundColor: "rgba(0,0,0,0.32)",
            }}
          />
          Outside time window / day off
        </span>
        {ghosts.length > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-gray-700/40 border border-dashed border-gray-500/60" />
            Alternative section
          </span>
        )}
      </div>
    </div>
  );
}
