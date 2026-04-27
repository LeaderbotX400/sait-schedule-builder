import { useMemo, useState } from "react";
import type { CourseSection, CurrentRegistration } from "../lib/types";
import CalendarGrid from "./CalendarGrid";

interface Props {
  currentRegistrations: Map<string, CurrentRegistration>;
  courseGroups: Map<string, CourseSection[]>;
  includedCourses: Set<string>;
  sectionOverrides: Map<string, string>;
  onSwapSection: (subjectCourse: string, newSectionId: string) => { success: boolean; conflicts: CourseSection[] };
  onToggleCourse: (subjectCourse: string) => void;
}

function formatTime(t: number): string {
  const h = Math.floor(t / 100);
  const m = (t % 100).toString().padStart(2, "0");
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m} ${period}`;
}

function formatMeetingTime(course: CourseSection): string {
  if (course.meetings.length === 0) return "No scheduled meetings";
  
  const meeting = course.meetings[0];
  const days = meeting.days.join("");
  const time = `${formatTime(meeting.startTime)}-${formatTime(meeting.endTime)}`;
  return `${days} ${time}`;
}

export default function CurrentScheduleEditor({
  currentRegistrations,
  courseGroups,
  includedCourses,
  sectionOverrides,
  onSwapSection,
  onToggleCourse,
}: Props) {
  const [conflicts, setConflicts] = useState<Map<string, CourseSection[]>>(new Map());

  // Build current schedule from registrations + overrides
  const currentScheduleCourses = useMemo(() => {
    const courses: CourseSection[] = [];
    for (const [subjectCourse, reg] of currentRegistrations) {
      if (!includedCourses.has(subjectCourse)) continue;

      const section = sectionOverrides.has(subjectCourse)
        ? courseGroups.get(subjectCourse)?.find((s) => s.identifier === sectionOverrides.get(subjectCourse))
        : reg.currentSection;

      if (section) {
        courses.push(section);
      }
    }
    return courses;
  }, [currentRegistrations, includedCourses, sectionOverrides, courseGroups]);

  const handleSwapSection = (subjectCourse: string, newSectionId: string) => {
    const result = onSwapSection(subjectCourse, newSectionId);
    if (!result.success) return;

    if (result.conflicts.length > 0) {
      const conflictMap = new Map(conflicts);
      conflictMap.set(subjectCourse, result.conflicts);
      setConflicts(conflictMap);
    } else {
      const conflictMap = new Map(conflicts);
      conflictMap.delete(subjectCourse);
      setConflicts(conflictMap);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Current Schedule</h2>
          <p className="text-xs text-gray-400">
            {includedCourses.size} course{includedCourses.size !== 1 ? "s" : ""} selected
          </p>
        </div>
      </div>

      {/* Conflicts warning */}
      {conflicts.size > 0 && (
        <div className="rounded-lg bg-red-900/20 border border-red-800/50 px-3 py-2">
          <p className="text-xs text-red-400">
            &#x26A0;&#xFE0F; {conflicts.size} course{conflicts.size !== 1 ? "s" : ""} has scheduling conflict{conflicts.size !== 1 ? "s" : ""}
          </p>
        </div>
      )}

      {/* Calendar */}
      <div className="rounded-lg bg-gray-800/50 border border-gray-700 p-3">
        <CalendarGrid
          schedule={{
            id: 0,
            qualityScore: 0,
            warnings: [],
            courses: currentScheduleCourses,
            daysUsed: [],
            daysCount: 0,
            onCampusDays: [],
            onCampusDaysCount: 0,
            onCampusPerDay: {},
            earlyMorningPenalty: 0,
            travelTimePenalty: 0,
            isPartial: false,
            omittedCourses: [],
            blockoutFitScore: 0,
          }}
        />
      </div>

      {/* Course grid */}
      {currentRegistrations.size === 0 ? (
        <div className="text-xs text-gray-500 py-4 text-center">
          No courses loaded yet
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-3 xl:grid-cols-3">
          {Array.from(currentRegistrations.entries()).map(([subjectCourse, reg]) => {
            const currentSection = sectionOverrides.has(subjectCourse)
              ? courseGroups.get(subjectCourse)?.find((s) => s.identifier === sectionOverrides.get(subjectCourse))
              : reg.currentSection;

            const isIncluded = includedCourses.has(subjectCourse);
            const courseConflicts = conflicts.get(subjectCourse);
            const hasConflict = !!courseConflicts && courseConflicts.length > 0;

            if (!currentSection) return null;

            return (
              <div
                key={subjectCourse}
                className={`rounded-lg border p-3 transition-colors ${
                  hasConflict
                    ? "bg-red-900/20 border-red-800/50"
                    : isIncluded
                      ? "bg-gray-800 border-gray-700 hover:border-gray-600"
                      : "bg-gray-900/50 border-gray-700 opacity-60"
                }`}
              >
                {/* Course header */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="text-sm font-semibold text-white">
                        {subjectCourse}
                      </h4>
                      <span className="text-xs bg-blue-900/50 text-blue-300 px-1.5 py-0.5 rounded">
                        {currentSection.sequenceNumber}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{currentSection.title}</p>
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={isIncluded}
                      onChange={() => onToggleCourse(subjectCourse)}
                      className="w-4 h-4 cursor-pointer"
                    />
                  </label>
                </div>

                {/* Meeting info */}
                <div className="text-xs text-gray-400 mb-2">
                  {formatMeetingTime(currentSection)}
                </div>

                {/* Conflict warning */}
                {hasConflict && (
                  <div className="mb-2 text-xs text-red-400 bg-red-900/20 rounded px-2 py-1">
                    &#x274C; Conflicts with: {courseConflicts.map((c) => c.subjectCourse).join(", ")}
                  </div>
                )}

                {/* Section selector */}
                <select
                  value={sectionOverrides.get(subjectCourse) || currentSection.identifier}
                  onChange={(e) => handleSwapSection(subjectCourse, e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 hover:border-gray-600 focus:border-blue-500 focus:outline-none"
                >
                  {courseGroups.get(subjectCourse)?.map((section) => (
                    <option key={section.identifier} value={section.identifier}>
                      Section {section.sequenceNumber} - {formatMeetingTime(section)}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
