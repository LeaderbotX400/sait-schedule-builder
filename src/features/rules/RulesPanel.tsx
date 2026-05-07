import { useState } from "react";
import { formatTimeFromString } from "../../domain/time";
import type { DayOfWeek, ScheduleRules } from "../../lib/types";

interface Props {
  rules: ScheduleRules;
  onChange: (rules: ScheduleRules) => void;
  layout?: "vertical" | "horizontal";
}

const DAYS: DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];

const TIME_OPTIONS = [
  "0700",
  "0800",
  "0900",
  "1000",
  "1100",
  "1200",
  "1300",
  "1400",
  "1500",
  "1600",
  "1700",
  "1800",
  "1900",
  "2000",
  "2100",
];

function SectionHeading({ label }: { label: string }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest text-fg-faint mb-3">
      {label}
    </p>
  );
}

function SliderRow({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-fg-muted">{label}</span>
        <span className="text-xs font-medium text-fg-muted tabular-nums">{value}</span>
      </div>
      {children}
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-4 h-4 text-fg-faint transition-transform duration-150 ${open ? "rotate-180" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export default function RulesPanel({ rules, onChange, layout = "vertical" }: Props) {
  const update = <K extends keyof ScheduleRules>(key: K, value: ScheduleRules[K]) =>
    onChange({ ...rules, [key]: value });

  const toggleFreeDay = (day: DayOfWeek) => {
    const next = rules.freeDays.includes(day)
      ? rules.freeDays.filter((d) => d !== day)
      : [...rules.freeDays, day];
    update("freeDays", next);
  };

  // ── Vertical accordion state ──
  const [openSections, setOpenSections] = useState({
    timeWindow: true,
    daysOff: true,
    campus: true,
    preferences: true,
  });
  const toggleSection = (key: keyof typeof openSections) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const prefSummary =
    [rules.allowPartialSchedules && "partial ok", rules.requireOpenSeats && "open seats only"]
      .filter(Boolean)
      .join(" · ") || "defaults";

  // ── Shared control renderers (used in both layouts) ──

  const timeWindowControls = (
    <div className="grid grid-cols-2 gap-2">
      <div>
        <label className="block text-[11px] text-fg-faint mb-0.5">Start</label>
        <select
          value={rules.earliestStart}
          onChange={(e) => update("earliestStart", e.target.value)}
          className="w-full rounded-md bg-input border border-edge px-1.5 py-1 text-xs text-fg focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {TIME_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {formatTimeFromString(t)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-[11px] text-fg-faint mb-0.5">End</label>
        <select
          value={rules.latestEnd}
          onChange={(e) => update("latestEnd", e.target.value)}
          className="w-full rounded-md bg-input border border-edge px-1.5 py-1 text-xs text-fg focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {TIME_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {formatTimeFromString(t)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  const daysOffControls = (
    <div className="flex gap-1">
      {DAYS.map((day) => (
        <button
          key={day}
          onClick={() => toggleFreeDay(day)}
          className={`flex-1 rounded-md px-1 py-1.5 text-xs font-medium transition-colors ${
            rules.freeDays.includes(day)
              ? "bg-destructive/90 text-destructive-fg border border-destructive shadow-sm"
              : "bg-input text-fg-muted border border-edge hover:border-edge-hover hover:text-fg"
          }`}
        >
          {day}
        </button>
      ))}
    </div>
  );

  const campusControls = (
    <div className="space-y-3">
      <SliderRow label="Max campus days/wk" value={String(rules.maxOnCampusDays)}>
        <input
          type="range"
          min={1}
          max={7}
          value={rules.maxOnCampusDays}
          onChange={(e) => update("maxOnCampusDays", parseInt(e.target.value, 10))}
          className="w-full accent-primary"
        />
      </SliderRow>
      <SliderRow
        label="Travel gap (campus ↔ online)"
        value={rules.minTravelGapMinutes === 0 ? "Off" : `${rules.minTravelGapMinutes}m`}
      >
        <input
          type="range"
          min={0}
          max={120}
          step={15}
          value={rules.minTravelGapMinutes}
          onChange={(e) => update("minTravelGapMinutes", parseInt(e.target.value, 10))}
          className="w-full accent-primary"
        />
      </SliderRow>
      <label className="flex items-center gap-2.5 text-sm text-fg-muted cursor-pointer rounded-md py-1 hover:text-fg transition-colors">
        <input
          type="checkbox"
          checked={rules.preferClusteredCampusDays}
          onChange={(e) => update("preferClusteredCampusDays", e.target.checked)}
          className="rounded border-edge-hover bg-surface-hover text-primary focus:ring-ring focus:ring-offset-0"
        />
        Cluster campus days
      </label>
    </div>
  );

  const preferencesControls = (
    <div className="space-y-3">
      <SliderRow
        label="Max gap between"
        value={rules.maxGapBetweenClasses === 0 ? "off" : `${rules.maxGapBetweenClasses}m`}
      >
        <input
          type="range"
          min={0}
          max={240}
          step={30}
          value={rules.maxGapBetweenClasses}
          onChange={(e) => update("maxGapBetweenClasses", parseInt(e.target.value, 10))}
          className="w-full accent-primary"
        />
      </SliderRow>
      <label className="flex items-center gap-2.5 text-sm text-fg-muted cursor-pointer rounded-md py-1 hover:text-fg transition-colors">
        <input
          type="checkbox"
          checked={rules.allowPartialSchedules}
          onChange={(e) => update("allowPartialSchedules", e.target.checked)}
          className="rounded border-edge-hover bg-surface-hover text-primary focus:ring-ring focus:ring-offset-0"
        />
        Allow partial
      </label>
      <label className="flex items-center gap-2.5 text-sm text-fg-muted cursor-pointer rounded-md py-1 hover:text-fg transition-colors">
        <input
          type="checkbox"
          checked={rules.requireOpenSeats}
          onChange={(e) => update("requireOpenSeats", e.target.checked)}
          className="rounded border-edge-hover bg-surface-hover text-primary focus:ring-ring focus:ring-offset-0"
        />
        Open seats only
      </label>
    </div>
  );

  // ── Horizontal layout (single column, no accordion) ──
  if (layout === "horizontal") {
    return (
      <div className="grid grid-cols-2 gap-8">
        <div className="space-y-6">
          <div>
            <SectionHeading label="Time Window" />
            {timeWindowControls}
          </div>
          <div>
            <SectionHeading label="Days Off" />
            {daysOffControls}
          </div>
        </div>
        <div className="space-y-6">
          <div>
            <SectionHeading label="Campus & Travel" />
            {campusControls}
          </div>
          <div>
            <SectionHeading label="Schedule Preferences" />
            {preferencesControls}
          </div>
        </div>
      </div>
    );
  }

  // ── Vertical layout (accordion, default) ──
  return (
    <div className="space-y-1">
      {/* Section 1 — Time Window */}
      <button
        type="button"
        onClick={() => toggleSection("timeWindow")}
        className="w-full flex items-center justify-between py-2 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-base leading-none">🕐</span>
          <span className="text-sm font-semibold text-fg">Time Window</span>
          {!openSections.timeWindow && (
            <span className="text-xs text-fg-faint font-normal ml-1">
              {formatTimeFromString(rules.earliestStart)} – {formatTimeFromString(rules.latestEnd)}
            </span>
          )}
        </div>
        <ChevronIcon open={openSections.timeWindow} />
      </button>
      {openSections.timeWindow && <div className="pb-3">{timeWindowControls}</div>}
      <div className="border-t border-edge" />

      {/* Section 2 — Days Off */}
      <button
        type="button"
        onClick={() => toggleSection("daysOff")}
        className="w-full flex items-center justify-between py-2 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-base leading-none">📅</span>
          <span className="text-sm font-semibold text-fg">Days Off</span>
          {!openSections.daysOff && (
            <span className="text-xs text-fg-faint font-normal ml-1">
              {rules.freeDays.length === 0 ? "No days off" : rules.freeDays.join(", ")}
            </span>
          )}
        </div>
        <ChevronIcon open={openSections.daysOff} />
      </button>
      {openSections.daysOff && <div className="pb-3">{daysOffControls}</div>}
      <div className="border-t border-edge" />

      {/* Section 3 — Campus & Travel */}
      <button
        type="button"
        onClick={() => toggleSection("campus")}
        className="w-full flex items-center justify-between py-2 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-base leading-none">🏫</span>
          <span className="text-sm font-semibold text-fg">Campus & Travel</span>
          {!openSections.campus && (
            <span className="text-xs text-fg-faint font-normal ml-1">
              Max {rules.maxOnCampusDays} day{rules.maxOnCampusDays !== 1 ? "s" : ""} on campus
            </span>
          )}
        </div>
        <ChevronIcon open={openSections.campus} />
      </button>
      {openSections.campus && <div className="pb-3">{campusControls}</div>}
      <div className="border-t border-edge" />

      {/* Section 4 — Preferences */}
      <button
        type="button"
        onClick={() => toggleSection("preferences")}
        className="w-full flex items-center justify-between py-2 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-base leading-none">⚙️</span>
          <span className="text-sm font-semibold text-fg">Preferences</span>
          {!openSections.preferences && (
            <span className="text-xs text-fg-faint font-normal ml-1">{prefSummary}</span>
          )}
        </div>
        <ChevronIcon open={openSections.preferences} />
      </button>
      {openSections.preferences && <div className="pb-3">{preferencesControls}</div>}
    </div>
  );
}
