import type { DayOfWeek, ScheduleRules } from "../lib/types";

interface Props {
  rules: ScheduleRules;
  onChange: (rules: ScheduleRules) => void;
}

const DAYS: DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const TIME_OPTIONS = [
  "0700", "0800", "0900", "1000", "1100", "1200",
  "1300", "1400", "1500", "1600", "1700", "1800",
  "1900", "2000", "2100",
];

function formatTime(t: string): string {
  const h = parseInt(t.slice(0, 2), 10);
  const m = t.slice(2);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m} ${period}`;
}

export default function RulesPanel({ rules, onChange }: Props) {
  const update = <K extends keyof ScheduleRules>(
    key: K,
    value: ScheduleRules[K],
  ) => {
    onChange({ ...rules, [key]: value });
  };

  const toggleFreeDay = (day: DayOfWeek) => {
    const next = rules.freeDays.includes(day)
      ? rules.freeDays.filter((d) => d !== day)
      : [...rules.freeDays, day];
    update("freeDays", next);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-gray-300">Schedule Rules</h3>

      {/* Time bounds */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">
            Earliest start
          </label>
          <select
            value={rules.earliestStart}
            onChange={(e) => update("earliestStart", e.target.value)}
            className="w-full rounded-lg bg-gray-800 border border-gray-700 px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {TIME_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {formatTime(t)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">
            Latest end
          </label>
          <select
            value={rules.latestEnd}
            onChange={(e) => update("latestEnd", e.target.value)}
            className="w-full rounded-lg bg-gray-800 border border-gray-700 px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {TIME_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {formatTime(t)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Free days */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">
          Days off (no classes)
        </label>
        <div className="flex gap-1">
          {DAYS.map((day) => (
            <button
              key={day}
              onClick={() => toggleFreeDay(day)}
              className={`flex-1 rounded-md px-1 py-1.5 text-xs font-medium transition-colors ${
                rules.freeDays.includes(day)
                  ? "bg-red-600 text-white"
                  : "bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-500"
              }`}
            >
              {day}
            </button>
          ))}
        </div>
      </div>

      {/* Max on-campus days */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">
          Max on-campus days: {rules.maxOnCampusDays}
        </label>
        <input
          type="range"
          min={1}
          max={7}
          value={rules.maxOnCampusDays}
          onChange={(e) => update("maxOnCampusDays", parseInt(e.target.value, 10))}
          className="w-full accent-blue-500"
        />
      </div>

      {/* Travel gap */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">
          Min travel gap (online → campus): {rules.minTravelGapMinutes}min
        </label>
        <input
          type="range"
          min={0}
          max={120}
          step={15}
          value={rules.minTravelGapMinutes}
          onChange={(e) =>
            update("minTravelGapMinutes", parseInt(e.target.value, 10))
          }
          className="w-full accent-blue-500"
        />
      </div>

      {/* Max gap between classes */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">
          Max gap between classes:{" "}
          {rules.maxGapBetweenClasses === 0
            ? "No limit"
            : `${rules.maxGapBetweenClasses}min`}
        </label>
        <input
          type="range"
          min={0}
          max={240}
          step={30}
          value={rules.maxGapBetweenClasses}
          onChange={(e) =>
            update("maxGapBetweenClasses", parseInt(e.target.value, 10))
          }
          className="w-full accent-blue-500"
        />
      </div>

      {/* Toggles */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={rules.preferClusteredCampusDays}
            onChange={(e) => update("preferClusteredCampusDays", e.target.checked)}
            className="rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
          />
          Prefer clustered on-campus days
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={rules.allowPartialSchedules}
            onChange={(e) => update("allowPartialSchedules", e.target.checked)}
            className="rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
          />
          Allow partial schedules
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={rules.requireOpenSeats}
            onChange={(e) => update("requireOpenSeats", e.target.checked)}
            className="rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
          />
          Only show sections with open seats
        </label>
      </div>
    </div>
  );
}
