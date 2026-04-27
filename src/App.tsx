import { useState } from "react";
import CourseSearch from "./components/CourseSearch";
import CourseSelector from "./components/CourseSelector";
import CurrentScheduleEditor from "./components/CurrentScheduleEditor";
import HeaderInput from "./components/HeaderInput";
import RulesPanel from "./components/RulesPanel";
import ScheduleDetail from "./components/ScheduleDetail";
import ShapeCalendar from "./components/ShapeCalendar";
import { useScheduler } from "./hooks/useScheduler";
import type { BlockoutGrid } from "./lib/types";

type PanelId = "courses";

function scoreBadgeColor(score: number): string {
  if (score >= 80) return "bg-emerald-600";
  if (score >= 60) return "bg-yellow-600";
  if (score >= 40) return "bg-orange-600";
  return "bg-red-600";
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
    term,
    loadBannerResponse,
    clearCourses,
    toggleCourse,
    setCredentials,
    generate,
    setRules,
    setActiveScheduleIndex,
    currentRegistrations,
    registrationsLoading,
    includedCourses,
    sectionOverrides,
    swapSection,
    toggleCurrentCourse,
  } = useScheduler();

  const hasData = courseGroups.size > 0;
  const hasSchedules = schedules.length > 0;

  const togglePanel = (panel: PanelId) =>
    setActivePanel((p) => (p === panel ? null : panel));

  const handleBlockoutChange = (blockout: BlockoutGrid) =>
    setRules((r) => ({ ...r, blockout }));
  const handleBlockoutWeightChange = (weight: number) =>
    setRules((r) => ({ ...r, blockoutWeight: weight }));

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">

      {/* ── Header ── */}
      <header className="border-b border-gray-800/80 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center gap-4">

          {/* Title */}
          <div className="shrink-0">
            <h1 className="text-lg font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              SAIT Schedule Builder
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">Build your ideal class schedule in minutes</p>
          </div>

          {/* Nav tabs */}
          <div className="flex-1 flex justify-center">
            <nav className="flex items-center gap-0.5 bg-gray-800/60 rounded-lg p-1 border border-gray-700/40">
              <button
                onClick={() => togglePanel("courses")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  activePanel === "courses"
                    ? "bg-gray-700 text-white shadow-sm"
                    : "text-gray-400 hover:text-gray-200 hover:bg-gray-700/50"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${credentials ? "bg-emerald-400" : "bg-gray-500"}`} />
                Courses
                {courseGroups.size > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    activePanel === "courses" ? "bg-blue-500 text-white" : "bg-gray-700 text-gray-300"
                  }`}>
                    {courseGroups.size}
                  </span>
                )}
              </button>
            </nav>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 shrink-0">
            {hasData && (
              <button
                onClick={clearCourses}
                className="rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
              >
                Clear All
              </button>
            )}
            {hasData && (
              <button
                onClick={generate}
                disabled={generationStatus.kind === "generating" || selectedCourses.size === 0}
                className={`rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all ${
                  selectedCourses.size > 0 && generationStatus.kind !== "generating"
                    ? "ring-1 ring-blue-400/40 shadow-lg shadow-blue-600/20"
                    : ""
                }`}
              >
                {generationStatus.kind === "generating" ? "Generating..." : "Generate Schedules"}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Expandable panel ── */}
      {activePanel && (
        <div className="border-b border-gray-800/80 bg-gray-900/50">
          <div className="max-w-screen-2xl mx-auto px-4 py-5">

            {/* Courses panel */}
            {activePanel === "courses" && (
              <div className="flex gap-8">
                {/* Banner connection — always visible */}
                <div className="w-64 shrink-0">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-3">
                    Banner Connection
                  </p>
                  <HeaderInput onCredentials={setCredentials} isConnected={!!credentials} />
                </div>

                {/* Course search — when connected */}
                {credentials && (
                  <div className="w-80 shrink-0 border-l border-gray-800/60 pl-8">
                    <CourseSearch credentials={credentials} onResults={loadBannerResponse} />
                  </div>
                )}

                {/* Course selector — right side */}
                <div className="flex-1 min-w-0 border-l border-gray-800/60 pl-8">
                  {hasData ? (
                    <CourseSelector
                      courseGroups={courseGroups}
                      selectedCourses={selectedCourses}
                      onToggle={toggleCourse}
                    />
                  ) : (
                    <p className="text-sm text-gray-600 mt-1">
                      {credentials ? "Search for courses using the form to get started." : "Connect to Banner to search for courses."}
                    </p>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <div className="max-w-screen-2xl mx-auto px-4 py-5">

        {/* Schedule navigation strip */}
        {hasSchedules && (
          <div className="flex items-center gap-3 mb-5 bg-gray-900/60 rounded-xl border border-gray-800/80 px-4 py-2.5">
            <button
              onClick={() => setActiveScheduleIndex(Math.max(0, activeScheduleIndex - 1))}
              disabled={activeScheduleIndex === 0}
              className="rounded-md bg-gray-800 border border-gray-700/60 px-2.5 py-1 text-xs text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-30 transition-colors shrink-0"
            >
              ← Prev
            </button>
            <div className="flex-1 overflow-x-auto flex gap-1.5 py-0.5">
              {schedules.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => setActiveScheduleIndex(i)}
                  title={`Schedule #${s.id} · Score ${s.qualityScore}${s.warnings.length > 0 ? ` · ${s.warnings.length} warning${s.warnings.length !== 1 ? "s" : ""}` : ""}`}
                  className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-bold transition-all ${
                    i === activeScheduleIndex
                      ? `${scoreBadgeColor(s.qualityScore)} text-white ring-2 ring-white/20 scale-110`
                      : `${scoreBadgeColor(s.qualityScore)} text-white/50 hover:text-white hover:scale-105`
                  }`}
                >
                  {s.qualityScore}
                </button>
              ))}
            </div>
            <span className="text-xs text-gray-500 shrink-0 tabular-nums">
              {activeScheduleIndex + 1} / {schedules.length}
            </span>
            <button
              onClick={() => setActiveScheduleIndex(Math.min(schedules.length - 1, activeScheduleIndex + 1))}
              disabled={activeScheduleIndex === schedules.length - 1}
              className="rounded-md bg-gray-800 border border-gray-700/60 px-2.5 py-1 text-xs text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-30 transition-colors shrink-0"
            >
              Next →
            </button>
          </div>
        )}

        {/* Current / Browse tabs */}
        {currentRegistrations.size > 0 && (
          <div className="flex gap-3 mb-4 border-b border-gray-800">
            <button
              onClick={() => setActiveTab("current")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === "current" ? "text-white border-b-2 border-blue-500" : "text-gray-400 hover:text-gray-300"
              }`}
            >
              Current Schedule
            </button>
            <button
              onClick={() => setActiveTab("browse")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === "browse" ? "text-white border-b-2 border-blue-500" : "text-gray-400 hover:text-gray-300"
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
            <div className="w-56 shrink-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-3">Rules</p>
              <RulesPanel rules={rules} onChange={setRules} />
            </div>

            {/* ── Main content ── */}
            <div className="flex-1 min-w-0">
              {activeTab === "current" && currentRegistrations.size > 0 ? (
                <CurrentScheduleEditor
                  currentRegistrations={currentRegistrations}
                  courseGroups={courseGroups}
                  includedCourses={includedCourses}
                  sectionOverrides={sectionOverrides}
                  onSwapSection={swapSection}
                  onToggleCourse={toggleCurrentCourse}
                />
              ) : generationStatus.kind === "generating" ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-r-transparent" />
                    <p className="mt-3 text-sm text-gray-400">Generating schedules...</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <ShapeCalendar
                    blockout={rules.blockout}
                    onBlockoutChange={handleBlockoutChange}
                    rules={rules}
                    blockoutWeight={rules.blockoutWeight}
                    onBlockoutWeightChange={handleBlockoutWeightChange}
                    schedule={activeSchedule ?? null}
                  />
                  {activeSchedule ? (
                    <ScheduleDetail
                      schedule={activeSchedule}
                      rules={rules}
                      credentials={credentials}
                      term={term}
                      registeredCrns={
                        currentRegistrations.size > 0
                          ? new Set([...currentRegistrations.values()].map((r) => r.currentSection.crn))
                          : undefined
                      }
                    />
                  ) : generationStatus.kind === "empty" ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="max-w-md text-center space-y-2">
                        <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-yellow-900/30 border border-yellow-800">
                          <span className="text-lg">⚠</span>
                        </div>
                        <h2 className="text-base font-semibold text-white">No valid schedules found</h2>
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
                        <p className="text-xs text-gray-600">Try adjusting your rules or course selection, then generate again.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-6">
                      <p className="text-sm text-gray-500">
                        {selectedCourses.size} course{selectedCourses.size !== 1 ? "s" : ""} selected — hit{" "}
                        <span className="text-blue-400 font-medium">Generate Schedules</span> when ready.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : credentials ? (
          registrationsLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-r-transparent" />
                <p className="mt-3 text-sm text-gray-400">Loading your registered courses...</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64">
              <p className="text-sm text-gray-500">No registered courses found — search above to add courses.</p>
            </div>
          )
        ) : (
          <div className="flex items-center justify-center h-64">
            <div className="text-center space-y-3">
              <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gray-800 border border-gray-700/80 mb-1">
                <span className="text-2xl">🎓</span>
              </div>
              <p className="text-base font-semibold text-gray-300">Get started</p>
              <p className="text-sm text-gray-500 max-w-xs">
                Open the{" "}
                <button
                  onClick={() => setActivePanel("courses")}
                  className="text-blue-400 hover:text-blue-300"
                >
                  Courses
                </button>{" "}
                tab above to connect to Banner and search for courses.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
