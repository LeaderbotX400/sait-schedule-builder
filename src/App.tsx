import { useScheduler } from "./hooks/useScheduler";
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
    isGenerating,
    activeScheduleIndex,
    activeSchedule,
    loadData,
    toggleCourse,
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
              Generate optimal class schedules from Banner data
            </p>
          </div>
          {hasData && (
            <button
              onClick={generate}
              disabled={isGenerating || selectedCourses.size === 0}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isGenerating ? "Generating..." : "Generate Schedules"}
            </button>
          )}
        </div>
      </header>

      <div className="max-w-screen-2xl mx-auto px-4 py-6">
        {!hasData ? (
          /* Landing / data import */
          <div className="max-w-lg mx-auto mt-12">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">
                Get Started
              </h2>
              <p className="text-gray-400">
                Load your course data from Banner to generate optimized
                schedules.
              </p>
            </div>
            <div className="rounded-xl bg-gray-900 border border-gray-800 p-6">
              <DataLoader onLoad={loadData} />
            </div>
          </div>
        ) : (
          /* Main layout: sidebar + content */
          <div className="flex gap-6">
            {/* Sidebar */}
            <aside className="w-72 shrink-0 space-y-6">
              <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
                <CourseSelector
                  courseGroups={courseGroups}
                  selectedCourses={selectedCourses}
                  onToggle={toggleCourse}
                />
              </div>
              <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
                <RulesPanel rules={rules} onChange={setRules} />
              </div>
              {hasSchedules && (
                <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
                  <ScheduleBrowser
                    schedules={schedules}
                    activeIndex={activeScheduleIndex}
                    onSelect={setActiveScheduleIndex}
                  />
                </div>
              )}
              {/* Reload data */}
              <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
                <DataLoader onLoad={loadData} />
              </div>
            </aside>

            {/* Main content */}
            <main className="flex-1 min-w-0">
              {isGenerating ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-r-transparent" />
                    <p className="mt-3 text-sm text-gray-400">
                      Generating schedules...
                    </p>
                  </div>
                </div>
              ) : activeSchedule ? (
                <ScheduleDetail schedule={activeSchedule} />
              ) : hasData ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <p className="text-gray-400">
                      Select your courses, configure rules, then hit{" "}
                      <span className="text-blue-400 font-medium">
                        Generate Schedules
                      </span>
                    </p>
                  </div>
                </div>
              ) : null}
            </main>
          </div>
        )}
      </div>
    </div>
  );
}
