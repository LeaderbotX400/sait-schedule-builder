import { useState, useCallback, useRef } from "react";
import type { BlockoutGrid as BlockoutGridType, BlockoutCell, DayOfWeek } from "../lib/types";
import { WEEKDAYS, GRID_HOURS, createEmptyBlockout } from "../lib/types";

interface Props {
  blockout: BlockoutGridType;
  onChange: (blockout: BlockoutGridType) => void;
}

const CELL_STYLES: Record<BlockoutCell, string> = {
  neutral: "bg-gray-800/50",
  preferred: "bg-emerald-700/50",
  blocked: "bg-red-700/50",
};

const PAINT_MODES: { value: BlockoutCell; label: string; color: string }[] = [
  { value: "preferred", label: "Classes here", color: "bg-emerald-600" },
  { value: "blocked", label: "No classes", color: "bg-red-600" },
  { value: "neutral", label: "Erase", color: "bg-gray-600" },
];

function formatHour(h: number): string {
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}${period}`;
}

export default function BlockoutGrid({ blockout, onChange }: Props) {
  const [paintMode, setPaintMode] = useState<BlockoutCell>("preferred");
  const [isPainting, setIsPainting] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  const paint = useCallback(
    (day: DayOfWeek, hour: number) => {
      const newBlockout = { ...blockout };
      newBlockout[day] = { ...newBlockout[day], [hour]: paintMode };
      onChange(newBlockout);
    },
    [blockout, onChange, paintMode],
  );

  const handleMouseDown = useCallback(
    (day: DayOfWeek, hour: number) => {
      setIsPainting(true);
      paint(day, hour);
    },
    [paint],
  );

  const handleMouseEnter = useCallback(
    (day: DayOfWeek, hour: number) => {
      if (isPainting) paint(day, hour);
    },
    [isPainting, paint],
  );

  const handleMouseUp = useCallback(() => {
    setIsPainting(false);
  }, []);

  const handleClear = useCallback(() => {
    onChange(createEmptyBlockout());
  }, [onChange]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-300">
          Ideal Schedule Shape
        </h3>
        <button
          onClick={handleClear}
          className="text-xs text-gray-500 hover:text-gray-300"
        >
          Clear
        </button>
      </div>

      <p className="text-xs text-gray-500">
        Paint your ideal week. Green = want classes, Red = keep free. Schedules matching your layout score higher.
      </p>

      {/* Paint mode selector */}
      <div className="flex gap-1">
        {PAINT_MODES.map((mode) => (
          <button
            key={mode.value}
            onClick={() => setPaintMode(mode.value)}
            className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              paintMode === mode.value
                ? `${mode.color} text-white`
                : "bg-gray-800 text-gray-400 border border-gray-700"
            }`}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div
        ref={gridRef}
        className="select-none"
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Header row */}
        <div className="flex">
          <div className="w-10 shrink-0" />
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="flex-1 text-center text-[10px] font-medium text-gray-400 pb-0.5"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Hour rows */}
        {GRID_HOURS.map((hour) => (
          <div key={hour} className="flex">
            <div className="w-10 shrink-0 text-right pr-1.5 text-[10px] text-gray-600 leading-[18px]">
              {formatHour(hour)}
            </div>
            {WEEKDAYS.map((day) => {
              const cell = blockout[day]?.[hour] ?? "neutral";
              return (
                <div
                  key={`${day}-${hour}`}
                  className={`flex-1 h-[18px] border border-gray-800/50 cursor-crosshair transition-colors ${CELL_STYLES[cell]}`}
                  onMouseDown={() => handleMouseDown(day, hour)}
                  onMouseEnter={() => handleMouseEnter(day, hour)}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 text-[10px] text-gray-500">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-700/50" />
          Preferred
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-700/50" />
          Blocked
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-gray-800/50" />
          No preference
        </span>
      </div>
    </div>
  );
}
