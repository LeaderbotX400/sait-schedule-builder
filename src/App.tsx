import { useScheduler } from "./hooks/useScheduler";
import HeaderInput from "./components/HeaderInput";
import CourseSearch from "./components/CourseSearch";
import DataLoader from "./components/DataLoader";
import CourseSelector from "./components/CourseSelector";
import RulesPanel from "./components/RulesPanel";
import ScheduleBrowser from "./components/ScheduleBrowser";
import ScheduleDetail from "./components/ScheduleDetail";

export default function App() {
  const {
    courseGroups,
    selectedCourses,
    schedules,
    rules,
    generationStatus,
    activeScheduleIndex,
    activeSchedule,
    credentials,
    loadError,
    loadData,
    loadBannerResponse,
    clearCourses,
    toggleCourse,
    setCredentials,
    generate,
    setRules,
    setActiveScheduleIndex,
  } = useScheduler();

  const hasData = courseGroups.size > 0;
  const hasSchedules = schedules.length > 0;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Top bar */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">
              SAIT Schedule Builder
            </h1>
            <p className="text-xs text-gray-500">
              Search courses or import JSON, then generate optimal schedules
            </p>
          </div>
          <div className="flex items-center gap-3">
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
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {generationStatus.kind === "generating" ? "Generating..." : "Generate Schedules"}
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-screen-2xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Sidebar */}
          <aside className="w-80 shrink-0 space-y-4">
            {/* Banner connection */}
            <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
              <HeaderInput
                onCredentials={setCredentials}
                isConnected={!!credentials}
              />
            </div>

            {/* Course search (when connected) */}
            {credentials && (
              <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
                <CourseSearch
                  credentials={credentials}
                  onResults={loadBannerResponse}
                />
              </div>
            )}

            {/* JSON fallback */}
            {!credentials && (
              <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
                <h3 className="text-sm font-medium text-gray-300 mb-3">
                  Or import JSON directly
                </h3>
                <DataLoader onLoad={loadData} error={loadError} />
              </div>
            )}

            {/* Course selector */}
            {hasData && (
              <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
                <CourseSelector
                  courseGroups={courseGroups}
                  selectedCourses={selectedCourses}
                  onToggle={toggleCourse}
                />
              </div>
            )}

            {/* Rules */}
            {hasData && (
              <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
                <RulesPanel rules={rules} onChange={setRules} />
              </div>
            )}

            {/* Schedule browser */}
            {hasSchedules && (
              <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
                <ScheduleBrowser
                  schedules={schedules}
                  activeIndex={activeScheduleIndex}
                  onSelect={setActiveScheduleIndex}
                />
              </div>
            )}
          </aside>

          {/* Main content */}
          <main className="flex-1 min-w-0">
            {generationStatus.kind === "generating" ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-r-transparent" />
                  <p className="mt-3 text-sm text-gray-400">
                    Generating schedules...
                  </p>
                </div>
              </div>
            ) : activeSchedule ? (
              <ScheduleDetail schedule={activeSchedule} rules={rules} />
            ) : generationStatus.kind === "empty" ? (
              /* No valid schedules found */
              <div className="flex items-center justify-center h-64">
                <div className="max-w-md text-center space-y-3">
                  <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-yellow-900/30 border border-yellow-800">
                    <span className="text-xl">&#x26A0;</span>
                  </div>
                  <h2 className="text-lg font-semibold text-white">
                    No valid schedules found
                  </h2>
                  <p className="text-sm text-gray-400">
                    {generationStatus.reason}
                  </p>
                </div>
              </div>
            ) : generationStatus.kind === "error" ? (
              /* Generation error */
              <div className="flex items-center justify-center h-64">
                <div className="max-w-md text-center space-y-3">
                  <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-red-900/30 border border-red-800">
                    <span className="text-xl">&#x2715;</span>
                  </div>
                  <h2 className="text-lg font-semibold text-white">
                    Generation failed
                  </h2>
                  <p className="text-sm text-red-400">
                    {generationStatus.message}
                  </p>
                  <p className="text-xs text-gray-600">
                    Try adjusting your rules or course selection, then generate again.
                  </p>
                </div>
              </div>
            ) : hasData ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center space-y-2">
                  <p className="text-gray-400">
                    {selectedCourses.size} course{selectedCourses.size !== 1 ? "s" : ""} loaded.
                    Configure your rules, then hit{" "}
                    <span className="text-blue-400 font-medium">
                      Generate Schedules
                    </span>
                  </p>
                  {credentials && (
                    <p className="text-xs text-gray-600">
                      You can search for more courses in the sidebar
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64">
                <div className="text-center space-y-2">
                  <p className="text-lg text-gray-400">
                    Connect to Banner or import a data.json to get started
                  </p>
                  <p className="text-sm text-gray-600">
                    Enter your course codes (e.g. CPRG307) and the app will fetch
                    all sections automatically
                  </p>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
