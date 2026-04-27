import type { CourseSection } from "../lib/types";

interface Props {
  courseGroups: Map<string, CourseSection[]>;
  selectedCourses: Set<string>;
  onToggle: (subjectCourse: string) => void;
}

export default function CourseSelector({
  courseGroups,
  selectedCourses,
  onToggle,
}: Props) {
  if (courseGroups.size === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-200">
        Courses ({courseGroups.size})
      </h3>
      <div className="space-y-1">
        {[...courseGroups.entries()].map(([name, sections]) => {
          const selected = selectedCourses.has(name);
          const title = sections[0].title;
          const sectionCount = sections.length;
          const totalSeats = sections.reduce(
            (sum, s) => sum + s.seatsAvailable,
            0,
          );

          return (
            <label
              key={name}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer transition-colors ${
                selected
                  ? "bg-blue-900/40 border border-blue-700"
                  : "bg-gray-800/50 border border-gray-700/50 opacity-60"
              }`}
            >
              <input
                type="checkbox"
                checked={selected}
                onChange={() => onToggle(name)}
                className="rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-white">
                    {name}
                  </span>
                  <span className="text-xs text-gray-400 truncate">
                    {title}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  {sectionCount} section{sectionCount !== 1 ? "s" : ""} &middot;{" "}
                  {totalSeats} seats available
                </div>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
