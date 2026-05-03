import { useState } from "react";
import { formatTimeCompact } from "../domain/time";
import type { CourseSection, MeetingBlock } from "../lib/types";

interface Props {
  courseGroups: Map<string, CourseSection[]>;
  selectedCourses: Set<string>;
  onToggle: (subjectCourse: string) => void;
}

function meetingSummary(m: MeetingBlock): string {
  const days = m.days.join("");
  const time = `${formatTimeCompact(m.startTime)}–${formatTimeCompact(m.endTime)}`;
  return `${days} ${time}`;
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-3 h-3 text-gray-500 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export default function CourseSelector({ courseGroups, selectedCourses, onToggle }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpanded = (name: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  if (courseGroups.size === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
        Courses ({courseGroups.size})
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
        {[...courseGroups.entries()].map(([name, sections]) => {
          const selected = selectedCourses.has(name);
          const isOpen = expanded.has(name);
          const title = sections[0]?.title ?? name;
          const sectionCount = sections.length;
          const totalSeats = sections.reduce((sum, s) => sum + s.seatsAvailable, 0);

          return (
            <div
              key={name}
              className={`rounded-md border text-xs transition-colors ${
                selected
                  ? "bg-blue-900/40 border-blue-700"
                  : "bg-gray-800/50 border-gray-700/50 opacity-60 hover:opacity-100"
              }`}
            >
              <div className="flex items-center gap-2 px-2 py-1.5">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => onToggle(name)}
                  className="rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 shrink-0"
                />
                <button
                  type="button"
                  onClick={() => onToggle(name)}
                  className="flex-1 min-w-0 text-left"
                >
                  <div className="flex items-baseline gap-1.5 min-w-0">
                    <span className="font-mono font-semibold text-white shrink-0">{name}</span>
                    <span className="text-gray-400 truncate flex-1 min-w-0">{title}</span>
                  </div>
                  <div className="text-[11px] text-gray-500 truncate">
                    {sectionCount} sec · {totalSeats} seats
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => toggleExpanded(name)}
                  className="shrink-0 rounded p-1 hover:bg-gray-700/60 transition-colors"
                  aria-label={isOpen ? "Collapse sections" : "Expand sections"}
                  aria-expanded={isOpen}
                >
                  <ChevronIcon open={isOpen} />
                </button>
              </div>
              {isOpen && (
                <div className="px-2 pb-2 pt-1 border-t border-gray-700/40 space-y-1">
                  {sections.map((s) => (
                    <div key={s.identifier} className="text-[11px] leading-snug">
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className="font-mono text-gray-300">{s.identifier}</span>
                        <span className="text-gray-500 tabular-nums">CRN {s.crn}</span>
                        {s.instructor && <span className="text-gray-500">· {s.instructor}</span>}
                      </div>
                      <div className="text-gray-400">
                        {s.meetings.length === 0 ? "—" : s.meetings.map(meetingSummary).join(", ")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
