import { useState, useCallback, useRef } from "react";
import type { BlockoutGrid as BlockoutGridType, BlockoutCell, DayOfWeek } from "../lib/types";
import { WEEKDAYS, GRID_HOURS, createEmptyBlockout } from "../lib/types";

interface Props {
  blockout: BlockoutGridType;
  onChange: (blockout: BlockoutGridType) => void;
}

const CELL_STYLES: Record<BlockoutCell, string> = {
  neutral: "bg-gray-800 hover:bg-gray-700/60",
  preferred: "bg-emerald-600/50 hover:bg-emerald-600/65",
  blocked: "bg-red-600/50 hover:bg-red-600/65",
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
      <div className="flex justify-end">
        <button
          onClick={handleClear}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          Clear grid
        </button>
      </div>

      {/* Paint mode selector — segmented control */}
      <div className="flex rounded-lg overflow-hidden border border-gray-700 text-xs font-medium">
        {PAINT_MODES.map((mode, i) => (
          <button
            key={mode.value}
            onClick={() => setPaintMode(mode.value)}
            className={`flex-1 px-2 py-1.5 transition-colors ${i > 0 ? "border-l border-gray-700" : ""} ${
              paintMode === mode.value
                ? mode.value === "preferred" ? "bg-emerald-700 text-white"
                : mode.value === "blocked" ? "bg-red-700 text-white"
                : "bg-gray-600 text-white"
                : "bg-gray-800/80 text-gray-400 hover:text-gray-200 hover:bg-gray-700/60"
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
            <div className="w-10 shrink-0 text-right pr-1.5 text-[10px] text-gray-600 leading-[22px]">
              {formatHour(hour)}
            </div>
            {WEEKDAYS.map((day) => {
              const cell = blockout[day]?.[hour] ?? "neutral";
              return (
                <div
                  key={`${day}-${hour}`}
                  className={`flex-1 h-[22px] border border-gray-700/30 cursor-crosshair ${CELL_STYLES[cell]}`}
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
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-600/50" />
          Preferred
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-600/50" />
          Blocked
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-gray-800" />
          No preference
        </span>
      </div>
    </div>
  );
}
