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
      <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
        Courses ({courseGroups.size})
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
        {[...courseGroups.entries()].map(([name, sections]) => {
          const selected = selectedCourses.has(name);
          const title = sections[0].title;
          const sectionCount = sections.length;
          const totalSeats = sections.reduce((sum, s) => sum + s.seatsAvailable, 0);

          return (
            <label
              key={name}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer transition-colors text-xs ${
                selected
                  ? "bg-blue-900/40 border border-blue-700"
                  : "bg-gray-800/50 border border-gray-700/50 opacity-60 hover:opacity-100"
              }`}
            >
              <input
                type="checkbox"
                checked={selected}
                onChange={() => onToggle(name)}
                className="rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono font-semibold text-white">{name}</span>
                  <span className="text-gray-400 truncate">{title}</span>
                </div>
                <div className="text-[11px] text-gray-500">
                  {sectionCount} sec · {totalSeats} seats
                </div>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
