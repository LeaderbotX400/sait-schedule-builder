import type { Schedule } from "../lib/types";
import Popover from "./Popover";

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

function scoreLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 55) return "OK";
  return "Poor";
}

function ScoreBreakdown({ s }: { s: Schedule }) {
  const rows: { label: string; value: string; dim?: boolean }[] = [];

  rows.push({ label: "Days on campus", value: `${s.onCampusDaysCount} of ${s.daysCount}` });

  if (s.earlyMorningPenalty > 0) {
    rows.push({
      label: "Early morning",
      value: `−${s.earlyMorningPenalty.toFixed(0)} pts`,
    });
  }
  if (s.travelTimePenalty > 0) {
    rows.push({
      label: "Travel gap violations",
      value: `−${s.travelTimePenalty.toFixed(0)} pts`,
    });
  }
  if (s.blockoutFitScore !== undefined && s.blockoutFitScore < 100) {
    rows.push({
      label: "Blockout fit",
      value: `${s.blockoutFitScore.toFixed(0)}%`,
    });
  }
  if (s.isPartial) {
    rows.push({
      label: "Partial schedule",
      value: `−${s.omittedCourses.length} omitted`,
      dim: true,
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-gray-400">Schedule #{s.id}</span>
        <div className="flex items-baseline gap-1">
          <span
            className={`text-2xl font-bold ${scoreBadgeColor(s.qualityScore)} bg-clip-text text-transparent`}
          >
            {s.qualityScore}
          </span>
          <span className="text-[11px] text-gray-500">/ 100</span>
        </div>
      </div>
      <p className="text-[11px] text-gray-500">{scoreLabel(s.qualityScore)}</p>

      <div className="border-t border-gray-800 pt-2 space-y-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between text-[11px]">
            <span className={r.dim ? "text-gray-500" : "text-gray-400"}>{r.label}</span>
            <span className={r.dim ? "text-gray-500" : "text-gray-200 tabular-nums"}>
              {r.value}
            </span>
          </div>
        ))}
      </div>

      {s.warnings.length > 0 && (
        <div className="border-t border-gray-800 pt-2 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
            {s.warnings.length} warning{s.warnings.length !== 1 ? "s" : ""}
          </p>
          {s.warnings.slice(0, 4).map((w, i) => (
            <p key={i} className="text-[11px] text-yellow-400/90 leading-snug">
              · {w.message}
            </p>
          ))}
          {s.warnings.length > 4 && (
            <p className="text-[10px] text-gray-500">
              + {s.warnings.length - 4} more in details below
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function ScheduleStrip({ schedules, activeIndex, onSelect }: Props) {
  if (schedules.length <= 1) return null;

  const prevDisabled = activeIndex === 0;
  const nextDisabled = activeIndex === schedules.length - 1;

  return (
    <div className="flex items-center gap-3 mb-5 bg-gray-900/60 rounded-xl border border-gray-800/80 px-4 py-2.5">
      <button
        onClick={() => onSelect(Math.max(0, activeIndex - 1))}
        disabled={prevDisabled}
        className="rounded-md bg-gray-800 border border-gray-700/60 px-2.5 py-1 text-xs text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-30 transition-colors shrink-0"
      >
        ← Prev
      </button>
      <div className="flex-1 overflow-x-auto flex gap-1.5 py-0.5">
        {schedules.map((s, i) => (
          <Popover
            key={s.id}
            align="left"
            widthClass="w-72"
            trigger={({ onClick }) => (
              <button
                onClick={(e) => {
                  onSelect(i);
                  onClick();
                  e.stopPropagation();
                }}
                title={`Schedule #${s.id} · Score ${s.qualityScore}`}
                className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-bold transition-all ${
                  i === activeIndex
                    ? `${scoreBadgeColor(s.qualityScore)} text-white ring-2 ring-white/20 scale-110`
                    : `${scoreBadgeColor(s.qualityScore)} text-white/50 hover:text-white hover:scale-105`
                }`}
              >
                {s.qualityScore}
              </button>
            )}
          >
            <ScoreBreakdown s={s} />
          </Popover>
        ))}
      </div>
      <span className="text-xs text-gray-500 shrink-0 tabular-nums">
        {activeIndex + 1} / {schedules.length}
      </span>
      <button
        onClick={() => onSelect(Math.min(schedules.length - 1, activeIndex + 1))}
        disabled={nextDisabled}
        className="rounded-md bg-gray-800 border border-gray-700/60 px-2.5 py-1 text-xs text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-30 transition-colors shrink-0"
      >
        Next →
      </button>
    </div>
  );
}
