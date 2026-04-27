import type { Schedule } from "../lib/types";

interface Props {
  schedules: Schedule[];
  activeIndex: number;
  onSelect: (index: number) => void;
}

function scoreBadgeColor(score: number): string {
  if (score >= 80) return "bg-emerald-600";
  if (score >= 60) return "bg-yellow-600";
  if (score >= 40) return "bg-orange-600";
  return "bg-red-600";
}

export default function ScheduleBrowser({
  schedules,
  activeIndex,
  onSelect,
}: Props) {
  if (schedules.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-200">
          Schedules ({schedules.length})
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onSelect(Math.max(0, activeIndex - 1))}
            disabled={activeIndex === 0}
            className="rounded-md bg-gray-800 border border-gray-700/60 px-2.5 py-1 text-xs text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-30 transition-colors"
          >
            Prev
          </button>
          <span className="text-xs text-gray-500 px-2">
            {activeIndex + 1} / {schedules.length}
          </span>
          <button
            onClick={() =>
              onSelect(Math.min(schedules.length - 1, activeIndex + 1))
            }
            disabled={activeIndex === schedules.length - 1}
            className="rounded-md bg-gray-800 border border-gray-700/60 px-2.5 py-1 text-xs text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-30 transition-colors"
          >
            Next
          </button>
        </div>
      </div>

      <div className="max-h-[300px] overflow-y-auto space-y-1 pr-1">
        {schedules.map((schedule, i) => (
          <button
            key={schedule.id}
            onClick={() => onSelect(i)}
            className={`w-full text-left rounded-lg px-3 py-2 transition-colors ${
              i === activeIndex
                ? "bg-blue-900/40 border border-blue-600"
                : "bg-gray-800/50 border border-transparent hover:border-gray-700"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-200">
                Schedule #{schedule.id}
                {schedule.isPartial && (
                  <span className="ml-1 text-xs text-yellow-500">(partial)</span>
                )}
              </span>
              <span
                className={`${scoreBadgeColor(schedule.qualityScore)} text-white text-xs font-bold px-2 py-0.5 rounded-full`}
              >
                {schedule.qualityScore}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-gray-500">
                {schedule.daysUsed.join(", ")}
              </span>
              {schedule.warnings.length > 0 && (
                <span className="text-xs text-yellow-600">
                  {schedule.warnings.length} warning
                  {schedule.warnings.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
