import { useAuth } from "./auth";
import { downloadICal } from "./domain/ical";
import ConnectionStatus from "./features/auth/ConnectionStatus";
import RulesPanel from "./features/rules/RulesPanel";
import { refreshAllData } from "./hooks/useScheduleSync";
import { describeTerm } from "./lib/terms";
import { GpaChip } from "./profile";
import { useStore } from "./store";
import Button from "./ui/Button";
import Popover from "./ui/Popover";
import StatusDot from "./ui/StatusDot";

interface Props {
  panelOpen: boolean;
  onTogglePanel: () => void;
}

export default function AppHeader({ panelOpen, onTogglePanel }: Props) {
  const isLoggedIn = useAuth().status === "authenticated";
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
          <StatusDot tone={isLoggedIn ? "ok" : "neutral"} />
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
                  <Button onClick={onClick} aria-expanded={expanded}>
                    Rules
                  </Button>
                )}
              >
                <RulesPanel rules={rules} onChange={setRules} />
              </Popover>
            </div>
          )}
          {isLoggedIn && (
            <Button
              onClick={() => void refreshAllData()}
              disabled={registrationsLoading}
              title="Reload data from Banner"
              className="!px-2"
            >
              <span
                className={`inline-block text-sm leading-none ${registrationsLoading ? "animate-spin" : ""}`}
              >
                ↻
              </span>
            </Button>
          )}
          {isLoggedIn && <GpaChip />}
          {isLoggedIn && (
            <ConnectionStatus termLabel={describeTerm(term)} loading={registrationsLoading} />
          )}
          {hasData && <Button onClick={clearCourses}>Clear</Button>}
          {activeSchedule && (
            <Button
              onClick={() => downloadICal(activeSchedule)}
              title="Export this schedule as .ics"
            >
              <span className="hidden sm:inline">Export </span>.ics
            </Button>
          )}
          {hasData && (
            <Button
              variant="primary"
              size="md"
              onClick={generate}
              disabled={generationStatus.kind === "generating" || selectedCourses.size === 0}
            >
              {generationStatus.kind === "generating" ? "Generating…" : "Generate"}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
