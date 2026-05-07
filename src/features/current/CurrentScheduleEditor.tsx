import { useMemo, useState } from "react";
import { formatTime } from "../../domain/time";
import type { CourseSection, CurrentRegistration } from "../../lib/types";
import { resolveCurrentSection } from "../../lib/types";
import CalendarGrid from "../schedule/CalendarGrid";

interface Props {
  currentRegistrations: Map<string, CurrentRegistration>;
  courseGroups: Map<string, CourseSection[]>;
  includedCourses: Set<string>;
  sectionOverrides: Map<string, string>;
  onSwapSection: (
    subjectCourse: string,
    newSectionId: string,
  ) => { success: boolean; conflicts: CourseSection[] };
  onToggleCourse: (subjectCourse: string) => void;
}

function formatMeetingTime(course: CourseSection): string {
  const meeting = course.meetings[0];
  if (!meeting) return "No scheduled meetings";

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
    for (const subjectCourse of currentRegistrations.keys()) {
      if (!includedCourses.has(subjectCourse)) continue;
      const section = resolveCurrentSection(
        subjectCourse,
        currentRegistrations,
        sectionOverrides,
        courseGroups,
      );
      if (section) courses.push(section);
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
    <div className="space-y-3">
      <p className="text-xs text-fg-faint">
        {includedCourses.size} course{includedCourses.size !== 1 ? "s" : ""} selected
      </p>

      {/* Conflicts warning */}
      {conflicts.size > 0 && (
        <div className="rounded-lg bg-tint-danger border border-tint-danger-bd px-3 py-2">
          <p className="text-xs text-tint-danger-fg">
            &#x26A0;&#xFE0F; {conflicts.size} course{conflicts.size !== 1 ? "s" : ""} has scheduling
            conflict{conflicts.size !== 1 ? "s" : ""}
          </p>
        </div>
      )}

      {/* Calendar */}
      <div className="rounded-lg bg-input/50 border border-edge p-3">
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
        <div className="text-xs text-fg-faint py-4 text-center">No courses loaded yet</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-3 xl:grid-cols-3">
          {Array.from(currentRegistrations.keys()).map((subjectCourse) => {
            const currentSection = resolveCurrentSection(
              subjectCourse,
              currentRegistrations,
              sectionOverrides,
              courseGroups,
            );

            const isIncluded = includedCourses.has(subjectCourse);
            const courseConflicts = conflicts.get(subjectCourse);
            const hasConflict = !!courseConflicts && courseConflicts.length > 0;

            if (!currentSection) return null;

            return (
              <div
                key={subjectCourse}
                className={`rounded-lg border p-3 transition-colors ${
                  hasConflict
                    ? "bg-tint-danger border-tint-danger-bd"
                    : isIncluded
                      ? "bg-input border-edge hover:border-edge-hover"
                      : "bg-surface/50 border-edge opacity-60"
                }`}
              >
                {/* Course header */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="text-sm font-semibold text-fg">{subjectCourse}</h4>
                      <span className="text-xs bg-tint-primary text-tint-primary-fg px-1.5 py-0.5 rounded">
                        {currentSection.sequenceNumber}
                      </span>
                    </div>
                    <p className="text-xs text-fg-muted mt-0.5 truncate">{currentSection.title}</p>
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
                <div className="text-xs text-fg-muted mb-2">
                  {formatMeetingTime(currentSection)}
                </div>

                {/* Conflict warning */}
                {hasConflict && (
                  <div className="mb-2 text-xs text-tint-danger-fg bg-tint-danger rounded px-2 py-1">
                    &#x274C; Conflicts with:{" "}
                    {courseConflicts.map((c) => c.subjectCourse).join(", ")}
                  </div>
                )}

                {/* Section selector */}
                <select
                  value={sectionOverrides.get(subjectCourse) || currentSection.identifier}
                  onChange={(e) => handleSwapSection(subjectCourse, e.target.value)}
                  className="w-full bg-surface border border-edge rounded px-2 py-1 text-xs text-fg-muted hover:border-edge-hover focus:border-ring focus:outline-none"
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
