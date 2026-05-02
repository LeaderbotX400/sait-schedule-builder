import { useCallback, useState } from "react";
import ConnectionStatus from "./components/ConnectionStatus";
import CourseSearch from "./components/CourseSearch";
import CourseSelector from "./components/CourseSelector";
import CurrentScheduleEditor from "./components/CurrentScheduleEditor";
import HeaderInput from "./components/HeaderInput";
import Popover from "./components/Popover";
import RegistrationStatusInline from "./components/RegistrationStatusInline";
import RulesPanel from "./components/RulesPanel";
import ScheduleDetail from "./components/ScheduleDetail";
import ScheduleStrip from "./components/ScheduleStrip";
import ShapeCalendar from "./components/ShapeCalendar";
import { useScheduler, type GenerationStatus } from "./hooks/useScheduler";
import type { BannerCredentials } from "./lib/api";
import { downloadICal } from "./lib/ical";
import { describeTerm } from "./lib/terms";
import type {
  BlockoutGrid,
  CourseSection,
  CurrentRegistration,
  Schedule,
  ScheduleRules,
} from "./lib/types";

type PanelId = "courses";

interface ScheduleAreaProps {
  activeTab: "current" | "browse";
  currentRegistrations: Map<string, CurrentRegistration>;
  courseGroups: Map<string, CourseSection[]>;
  selectedCourses: Set<string>;
  includedCourses: Set<string>;
  sectionOverrides: Map<string, string>;
  generationStatus: GenerationStatus;
  activeSchedule: Schedule | null;
  rules: ScheduleRules;
  credentials: BannerCredentials | null;
  term: string;
  swapSection: (subjectCourse: string, newSectionId: string) => { success: boolean; conflicts: CourseSection[] };
  toggleCurrentCourse: (subjectCourse: string) => void;
  onBlockoutChange: (blockout: BlockoutGrid) => void;
  onBlockoutWeightChange: (weight: number) => void;
  onGenerate: () => void;
}

/**
 * Main scheduling area: switches between the "current schedule" editor and
 * the planner (shape calendar + active schedule details / empty / error).
 */
function ScheduleArea({
  activeTab,
  currentRegistrations,
  courseGroups,
  selectedCourses,
  includedCourses,
  sectionOverrides,
  generationStatus,
  activeSchedule,
  rules,
  credentials,
  term,
  swapSection,
  toggleCurrentCourse,
  onBlockoutChange,
  onBlockoutWeightChange,
  onGenerate,
}: ScheduleAreaProps) {
  if (activeTab === "current" && currentRegistrations.size > 0) {
    return (
      <CurrentScheduleEditor
        currentRegistrations={currentRegistrations}
        courseGroups={courseGroups}
        includedCourses={includedCourses}
        sectionOverrides={sectionOverrides}
        onSwapSection={swapSection}
        onToggleCourse={toggleCurrentCourse}
      />
    );
  }

  if (generationStatus.kind === "generating") {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-r-transparent" />
          <p className="mt-3 text-sm text-gray-400">Generating schedules...</p>
        </div>
      </div>
    );
  }

  const registeredCrns =
    currentRegistrations.size > 0
      ? new Set([...currentRegistrations.values()].map((r) => r.currentSection.crn))
      : undefined;

  return (
    <div className="space-y-4">
      <ShapeCalendar
        blockout={rules.blockout}
        onBlockoutChange={onBlockoutChange}
        rules={rules}
        blockoutWeight={rules.blockoutWeight}
        onBlockoutWeightChange={onBlockoutWeightChange}
        schedule={activeSchedule ?? null}
        courseGroups={courseGroups}
        selectedCourses={selectedCourses}
      />
      {activeSchedule ? (
        <ScheduleDetail
          schedule={activeSchedule}
          rules={rules}
          credentials={credentials}
          term={term}
          registeredCrns={registeredCrns}
        />
      ) : generationStatus.kind === "empty" ? (
        <div className="flex items-center justify-center py-8">
          <div className="max-w-md text-center space-y-2">
            <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-yellow-900/30 border border-yellow-800">
              <span className="text-lg">⚠</span>
            </div>
            <h2 className="text-base font-semibold text-white">
              No valid schedules found
            </h2>
            <p className="text-sm text-gray-400">{generationStatus.reason}</p>
          </div>
        </div>
      ) : generationStatus.kind === "error" ? (
        <div className="flex items-center justify-center py-8">
          <div className="max-w-md text-center space-y-2">
            <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-red-900/30 border border-red-800">
              <span className="text-lg">✕</span>
            </div>
            <h2 className="text-base font-semibold text-white">Generation failed</h2>
            <p className="text-sm text-red-400">{generationStatus.message}</p>
            <p className="text-xs text-gray-600">
              Try adjusting your rules or course selection, then generate again.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
          <p className="text-sm text-gray-400">
            {selectedCourses.size === 0
              ? "Select at least one course to generate."
              : `${selectedCourses.size} course${selectedCourses.size !== 1 ? "s" : ""} ready.`}
          </p>
          <button
            onClick={onGenerate}
            disabled={selectedCourses.size === 0}
            className="rounded-md bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Generate Schedules
          </button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<"current" | "browse">("current");
  const [activePanel, setActivePanel] = useState<PanelId | null>("courses");

  const {
    courseGroups,
    selectedCourses,
    schedules,
    rules,
    generationStatus,
    activeScheduleIndex,
    activeSchedule,
    credentials,
    gpa,
    registrationNotices,
    term,
    setTerm,
    loadBannerResponse,
    clearCourses,
    toggleCourse,
    setCredentials,
    generate,
    setRules,
    setActiveScheduleIndex,
    currentRegistrations,
    registrationsLoading,
    loadError,
    includedCourses,
    sectionOverrides,
    swapSection,
    toggleCurrentCourse,
    refresh,
  } = useScheduler();

  const hasData = courseGroups.size > 0;

  const togglePanel = useCallback(
    (panel: PanelId) =>
      setActivePanel((p) => (p === panel ? null : panel)),
    [],
  );

  const handleBlockoutChange = useCallback(
    (blockout: BlockoutGrid) =>
      setRules((r) => ({ ...r, blockout })),
    [setRules],
  );

  const handleBlockoutWeightChange = useCallback(
    (weight: number) =>
      setRules((r) => ({ ...r, blockoutWeight: weight })),
    [setRules],
  );

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* ── Header ── */}
      <header className="border-b border-gray-800/80 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-screen-2xl mx-auto px-3 sm:px-4 min-h-12 flex flex-wrap items-center gap-x-3 gap-y-1.5 py-1.5">
          <h1 className="text-sm font-semibold text-gray-100 shrink-0 tracking-tight">
            SAIT <span className="hidden sm:inline">Schedule </span>Builder
          </h1>

          <button
            onClick={() => togglePanel("courses")}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              activePanel === "courses"
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
                onClick={() => void refresh()}
                disabled={registrationsLoading}
                title="Reload data from Banner"
                className="rounded-md border border-gray-700/80 px-2 py-1 text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span className={`inline-block text-sm leading-none ${registrationsLoading ? "animate-spin" : ""}`}>
                  ↻
                </span>
              </button>
            )}
            {credentials && (
              <ConnectionStatus
                onCredentials={setCredentials}
                termLabel={describeTerm(term)}
                loading={registrationsLoading}
              />
            )}
            {hasData && (
              <button
                onClick={clearCourses}
                className="rounded-md border border-gray-700/80 px-2.5 py-1 text-xs text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
              >
                Clear
              </button>
            )}
            {activeSchedule && (
              <button
                onClick={() => downloadICal(activeSchedule)}
                title="Export this schedule as .ics"
                className="rounded-md border border-gray-700/80 px-2.5 py-1 text-xs text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
              >
                <span className="hidden sm:inline">Export </span>.ics
              </button>
            )}
            {hasData && (
              <button
                onClick={generate}
                disabled={
                  generationStatus.kind === "generating" ||
                  selectedCourses.size === 0
                }
                className="rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {generationStatus.kind === "generating"
                  ? "Generating…"
                  : "Generate"}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Student status row (GPA + registration block warning) ── */}
      {credentials && (gpa || registrationNotices) && (
        <div className="border-b border-gray-800/60 bg-gray-900/40">
          <div className="max-w-screen-2xl mx-auto px-3 sm:px-4 py-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
            {gpa && (() => {
              const overallEntry = gpa.gpas?.find(
                (g) => g.typeDesc === "Overall" || g.gpaTypeIndicatorDesc?.toLowerCase().includes("overall"),
              );
              const displayGpa = gpa.overallGpa ?? overallEntry?.gpa;
              const displayHours = gpa.overallHours ?? overallEntry?.hours;
              if (!displayGpa) return null;
              return (
                <span className="text-gray-400">
                  GPA{" "}
                  <span className="font-semibold text-gray-200">{displayGpa}</span>
                  {displayHours != null && (
                    <span className="text-gray-600"> · {displayHours} cr</span>
                  )}
                </span>
              );
            })()}
            {registrationNotices && (
              <RegistrationStatusInline notices={registrationNotices} />
            )}
          </div>
        </div>
      )}

      {/* ── Expandable panel — only shown once connected ── */}
      {activePanel && credentials && (
        <div className="sticky top-12 z-10 border-b border-gray-800/80 bg-gray-900/95 backdrop-blur-sm">
          <div className="max-w-screen-2xl mx-auto px-3 sm:px-4 py-3">
            {activePanel === "courses" && (
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                <div className="sm:w-72 sm:shrink-0">
                  <CourseSearch
                    credentials={credentials}
                    onResults={loadBannerResponse}
                    term={term}
                    onTermChange={setTerm}
                  />
                </div>

                {hasData && (
                  <div className="flex-1 min-w-0 sm:border-l border-gray-800/60 sm:pl-6">
                    <CourseSelector
                      courseGroups={courseGroups}
                      selectedCourses={selectedCourses}
                      onToggle={toggleCourse}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <div className="max-w-screen-2xl mx-auto px-3 sm:px-4 py-4">
        {/* Schedule navigation strip */}
        <ScheduleStrip
          schedules={schedules}
          activeIndex={activeScheduleIndex}
          onSelect={setActiveScheduleIndex}
        />

        {/* Current / Browse tabs */}
        {currentRegistrations.size > 0 && (
          <div className="flex gap-2 sm:gap-3 mb-4 border-b border-gray-800 overflow-x-auto">
            <button
              onClick={() => setActiveTab("current")}
              className={`px-3 sm:px-4 py-2 text-sm font-medium transition-colors shrink-0 ${
                activeTab === "current"
                  ? "text-white border-b-2 border-blue-500"
                  : "text-gray-400 hover:text-gray-300"
              }`}
            >
              <span className="hidden sm:inline">Current Schedule</span>
              <span className="sm:hidden">Current</span>
            </button>
            <button
              onClick={() => setActiveTab("browse")}
              className={`px-3 sm:px-4 py-2 text-sm font-medium transition-colors shrink-0 ${
                activeTab === "browse"
                  ? "text-white border-b-2 border-blue-500"
                  : "text-gray-400 hover:text-gray-300"
              }`}
            >
              Planner
            </button>
          </div>
        )}

        {/* Two-column layout when data is loaded: rules sidebar + main content */}
        {hasData ? (
          <div className="flex gap-6 items-start">
            {/* ── Rules sidebar ── */}
            <div className="hidden lg:block w-52 shrink-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2">
                Rules
              </p>
              <RulesPanel rules={rules} onChange={setRules} />
            </div>

            {/* ── Main content ── */}
            <div className="flex-1 min-w-0">
              <ScheduleArea
                activeTab={activeTab}
                currentRegistrations={currentRegistrations}
                courseGroups={courseGroups}
                selectedCourses={selectedCourses}
                includedCourses={includedCourses}
                sectionOverrides={sectionOverrides}
                generationStatus={generationStatus}
                activeSchedule={activeSchedule}
                rules={rules}
                credentials={credentials}
                term={term}
                swapSection={swapSection}
                toggleCurrentCourse={toggleCurrentCourse}
                onBlockoutChange={handleBlockoutChange}
                onBlockoutWeightChange={handleBlockoutWeightChange}
                onGenerate={generate}
              />
            </div>
          </div>
        ) : credentials ? (
          registrationsLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-r-transparent" />
                <p className="mt-3 text-sm text-gray-400">
                  Loading your registered courses...
                </p>
              </div>
            </div>
          ) : loadError ? (
            <div className="flex items-center justify-center h-64">
              <div className="max-w-sm text-center space-y-2">
                <p className="text-sm text-red-400">{loadError}</p>
                <p className="text-xs text-gray-500">
                  Try disconnecting and signing in again.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64">
              <p className="text-sm text-gray-500">
                No registered courses found — search above to add courses.
              </p>
            </div>
          )
        ) : (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="w-full max-w-sm rounded-xl border border-gray-800 bg-gray-900/60 p-4 sm:p-6 shadow-lg">
              <HeaderInput
                onCredentials={setCredentials}
                isConnected={!!credentials}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
