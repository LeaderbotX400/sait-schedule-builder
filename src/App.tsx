import { useState } from "react";
import AppHeader from "./AppHeader";
import CoursesPanel from "./CoursesPanel";
import ProfileStatusRow from "./features/status/ProfileStatusRow";
import { useAuth } from "./hooks/useAuth";
import { useDemoBootstrap } from "./hooks/useDemoBootstrap";
import { useScheduleSync } from "./hooks/useScheduleSync";
import MainArea from "./MainArea";
import SignInScreen from "./SignInScreen";
import { useStore } from "./store";

/**
 * Top-level layout shell. Owns:
 *   - mounting the auth + schedule-sync side-effect hooks
 *   - the courses-panel open/closed flag (only useful here at the layout level)
 *   - dispatching to <SignInScreen /> when not connected
 *
 * Everything else lives in feature modules and pulls from the store.
 */
export default function App() {
  useDemoBootstrap();
  useAuth();
  useScheduleSync();

  const credentials = useStore((s) => s.credentials);
  const [panelOpen, setPanelOpen] = useState(true);

  if (!credentials) return <SignInScreen />;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <AppHeader panelOpen={panelOpen} onTogglePanel={() => setPanelOpen((v) => !v)} />
      <ProfileStatusRow />
      <CoursesPanel open={panelOpen} />
      <MainArea />
    </div>
  );
}
