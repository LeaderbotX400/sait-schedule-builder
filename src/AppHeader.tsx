import { downloadICal } from "./domain/ical";
import ConnectionStatus from "./features/auth/ConnectionStatus";
import RulesPanel from "./features/rules/RulesPanel";
import { refreshAllData } from "./hooks/useScheduleSync";
import { describeTerm } from "./lib/terms";
import { useStore } from "./store";
import Popover from "./ui/Popover";

interface Props {
  panelOpen: boolean;
  onTogglePanel: () => void;
}

/**
 * Sticky header bar: app title, courses-panel toggle, rules popover (mobile),
 * refresh, connection status pill, clear/export/generate actions.
 */
export default function AppHeader({ panelOpen, onTogglePanel }: Props) {
  const credentials = useStore((s) => s.credentials);
  const term = useStore((s) => s.term);
  const courseGroups = useStore((s) => s.courseGroups);
  const selectedCourses = useStore((s) => s.selectedCourses);
  const rules = useStore((s) => s.rules);
  const setRules = useStore((s) => s.setRules);
  const generationStatus = useStore((s) => s.generationStatus);
  const generate = useStore((s) => s.generate);
  const clearCourses = useStore((s) => s.clearCourses);
  const schedules = useStore((s) => s.schedules);
  const activeScheduleIndex = useStore((s) => s.activeScheduleIndex);
  const registrationsLoading = useStore((s) => s.registrationsLoading);

  const hasData = courseGroups.size > 0;
  const activeSchedule = schedules[activeScheduleIndex] ?? null;

  return (
    <header className="border-b border-gray-800/80 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-20">
      <div className="max-w-screen-2xl mx-auto px-3 sm:px-4 min-h-12 flex flex-wrap items-center gap-x-3 gap-y-1.5 py-1.5">
        <h1 className="text-sm font-semibold text-gray-100 shrink-0 tracking-tight">
          SAIT <span className="hidden sm:inline">Schedule </span>Builder
        </h1>

        <button
          type="button"
          onClick={onTogglePanel}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
            panelOpen
              ? "bg-gray-800 text-white"
              : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/60"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full shrink-0 ${credentials ? "bg-emerald-400" : "bg-gray-500"}`}
          />
          Courses
          {courseGroups.size > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-700 text-gray-300">
              {courseGroups.size}
            </span>
          )}
        </button>

        <div className="flex-1 min-w-0" />

        <div className="flex flex-wrap items-center gap-2 ml-auto">
          {hasData && (
            <div className="lg:hidden">
              <Popover
                align="right"
                widthClass="w-72"
                trigger={({ onClick, "aria-expanded": expanded }) => (
                  <button
                    type="button"
                    onClick={onClick}
                    aria-expanded={expanded}
                    className="rounded-md border border-gray-700/80 px-2.5 py-1 text-xs text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
                  >
                    Rules
                  </button>
                )}
              >
                <RulesPanel rules={rules} onChange={setRules} />
              </Popover>
            </div>
          )}
          {credentials && (
            <button
              type="button"
              onClick={() => void refreshAllData()}
              disabled={registrationsLoading}
              title="Reload data from Banner"
              className="rounded-md border border-gray-700/80 px-2 py-1 text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <span
                className={`inline-block text-sm leading-none ${registrationsLoading ? "animate-spin" : ""}`}
              >
                ↻
              </span>
            </button>
          )}
          {credentials && (
            <ConnectionStatus termLabel={describeTerm(term)} loading={registrationsLoading} />
          )}
          {hasData && (
            <button
              type="button"
              onClick={clearCourses}
              className="rounded-md border border-gray-700/80 px-2.5 py-1 text-xs text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
            >
              Clear
            </button>
          )}
          {activeSchedule && (
            <button
              type="button"
              onClick={() => downloadICal(activeSchedule)}
              title="Export this schedule as .ics"
              className="rounded-md border border-gray-700/80 px-2.5 py-1 text-xs text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
            >
              <span className="hidden sm:inline">Export </span>.ics
            </button>
          )}
          {hasData && (
            <button
              type="button"
              onClick={generate}
              disabled={generationStatus.kind === "generating" || selectedCourses.size === 0}
              className="rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {generationStatus.kind === "generating" ? "Generating…" : "Generate"}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
