import { useCallback, useState } from "react";
import CurrentScheduleEditor from "./features/current/CurrentScheduleEditor";
import BlockoutGrid from "./features/rules/BlockoutGrid";
import RulesPanel from "./features/rules/RulesPanel";
import ScheduleDetail from "./features/schedule/ScheduleDetail";
import ScheduleStrip from "./features/schedule/ScheduleStrip";
import { useStore } from "./store";
import Button from "./ui/Button";
import EmptyStatePrimitive from "./ui/EmptyState";
import Spinner from "./ui/Spinner";

type Tab = "current" | "browse";

export default function MainArea() {
  const [activeTab, setActiveTab] = useState<Tab>("current");

  const courseGroups = useStore((s) => s.courseGroups);
  const currentRegistrations = useStore((s) => s.currentRegistrations);
  const isLoggedIn = useStore((s) => s.isLoggedIn);
  const registrationsLoading = useStore((s) => s.registrationsLoading);
  const loadError = useStore((s) => s.loadError);
  const authRequired = useStore((s) => s.authRequired);
  const setLoggedIn = useStore((s) => s.setLoggedIn);

  const handleReauth = useCallback(() => {
    setLoggedIn(false);
  }, [setLoggedIn]);

  const hasData = courseGroups.size > 0;

  return (
    <div className="max-w-screen-2xl mx-auto px-3 sm:px-4 py-4">
      <ScheduleStripBound />
      {currentRegistrations.size > 0 && <Tabs activeTab={activeTab} onChange={setActiveTab} />}

      {hasData ? (
        <div className="flex gap-6 items-start">
          <RulesSidebar />
          <div className="flex-1 min-w-0">
            <ScheduleArea activeTab={activeTab} />
          </div>
        </div>
      ) : isLoggedIn ? (
        registrationsLoading ? (
          <CenteredSpinner label="Loading your registered courses..." />
        ) : authRequired ? (
          <CenteredError
            message={loadError || "Banner session expired. Please sign in again."}
            onReauth={handleReauth}
          />
        ) : loadError ? (
          <CenteredError message={loadError} />
        ) : (
          <CenteredHint message="No registered courses found — search above to add courses." />
        )
      ) : null}
    </div>
  );
}

function ScheduleStripBound() {
  const schedules = useStore((s) => s.schedules);
  const activeScheduleIndex = useStore((s) => s.activeScheduleIndex);
  const setActiveScheduleIndex = useStore((s) => s.setActiveScheduleIndex);
  return (
    <ScheduleStrip
      schedules={schedules}
      activeIndex={activeScheduleIndex}
      onSelect={setActiveScheduleIndex}
    />
  );
}

function Tabs({ activeTab, onChange }: { activeTab: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="flex gap-2 sm:gap-3 mb-4 border-b border-gray-800 overflow-x-auto">
      <TabButton active={activeTab === "current"} onClick={() => onChange("current")}>
        <span className="hidden sm:inline">Current Schedule</span>
        <span className="sm:hidden">Current</span>
      </TabButton>
      <TabButton active={activeTab === "browse"} onClick={() => onChange("browse")}>
        Planner
      </TabButton>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 sm:px-4 py-2 text-sm font-medium transition-colors shrink-0 ${
        active ? "text-white border-b-2 border-blue-500" : "text-gray-400 hover:text-gray-300"
      }`}
    >
      {children}
    </button>
  );
}

function RulesSidebar() {
  const rules = useStore((s) => s.rules);
  const setRules = useStore((s) => s.setRules);
  return (
    <div className="hidden lg:block w-52 shrink-0">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2">
        Rules
      </p>
      <RulesPanel rules={rules} onChange={setRules} />
    </div>
  );
}

function ScheduleArea({ activeTab }: { activeTab: Tab }) {
  const courseGroups = useStore((s) => s.courseGroups);
  const selectedCourses = useStore((s) => s.selectedCourses);
  const includedCourses = useStore((s) => s.includedCourses);
  const sectionOverrides = useStore((s) => s.sectionOverrides);
  const currentRegistrations = useStore((s) => s.currentRegistrations);
  const swapSection = useStore((s) => s.swapSection);
  const toggleCurrentCourse = useStore((s) => s.toggleCurrentCourse);
  const generationStatus = useStore((s) => s.generationStatus);
  const schedules = useStore((s) => s.schedules);
  const activeScheduleIndex = useStore((s) => s.activeScheduleIndex);
  const rules = useStore((s) => s.rules);
  const setRules = useStore((s) => s.setRules);
  const generate = useStore((s) => s.generate);
  const activeSchedule = schedules[activeScheduleIndex] ?? null;

  const handleBlockoutChange = useCallback(
    (blockout: import("./domain/types").BlockoutGrid) => setRules((r) => ({ ...r, blockout })),
    [setRules],
  );

  const handleBlockoutWeightChange = useCallback(
    (weight: number) => setRules((r) => ({ ...r, blockoutWeight: weight })),
    [setRules],
  );

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
    return <CenteredSpinner label="Generating schedules..." />;
  }

  return (
    <div className="space-y-4">
      <BlockoutGrid
        blockout={rules.blockout}
        onBlockoutChange={handleBlockoutChange}
        rules={rules}
        blockoutWeight={rules.blockoutWeight}
        onBlockoutWeightChange={handleBlockoutWeightChange}
        schedule={activeSchedule ?? null}
        courseGroups={courseGroups}
        selectedCourses={selectedCourses}
      />
      {activeSchedule ? (
        <ScheduleDetail schedule={activeSchedule} rules={rules} />
      ) : generationStatus.kind === "empty" ? (
        <EmptyState reason={generationStatus.reason} />
      ) : generationStatus.kind === "error" ? (
        <ErrorState message={generationStatus.message} />
      ) : (
        <GenerateInvite selectedCount={selectedCourses.size} onGenerate={generate} />
      )}
    </div>
  );
}

function EmptyState({ reason }: { reason: string }) {
  return (
    <EmptyStatePrimitive
      tone="warn"
      icon="⚠"
      title="No valid schedules found"
      description={reason}
    />
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <EmptyStatePrimitive
      tone="danger"
      icon="✕"
      title="Generation failed"
      description={
        <>
          <span className="block">{message}</span>
          <span className="block text-xs text-gray-600 mt-2">
            Try adjusting your rules or course selection, then generate again.
          </span>
        </>
      }
    />
  );
}

function GenerateInvite({
  selectedCount,
  onGenerate,
}: {
  selectedCount: number;
  onGenerate: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <p className="text-sm text-gray-400">
        {selectedCount === 0
          ? "Select at least one course to generate."
          : `${selectedCount} course${selectedCount !== 1 ? "s" : ""} ready.`}
      </p>
      <Button variant="primary" size="md" onClick={onGenerate} disabled={selectedCount === 0}>
        Generate Schedules
      </Button>
    </div>
  );
}

function CenteredSpinner({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <Spinner size="lg" color="text-blue-500" />
        <p className="mt-3 text-sm text-gray-400">{label}</p>
      </div>
    </div>
  );
}

function CenteredError({ message, onReauth }: { message: string; onReauth?: () => void }) {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="max-w-sm text-center space-y-3">
        <p className="text-sm text-red-400">{message}</p>
        {onReauth ? (
          <Button variant="primary" size="sm" onClick={onReauth}>
            Sign in again
          </Button>
        ) : (
          <p className="text-xs text-gray-500">Try disconnecting and signing in again.</p>
        )}
      </div>
    </div>
  );
}

function CenteredHint({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-64">
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  );
}
