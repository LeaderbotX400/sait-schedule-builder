import { useState } from "react";
import AppHeader from "./AppHeader";
import CoursesPanel from "./CoursesPanel";
import { useAuth } from "./hooks/useAuth";
import { useDemoBootstrap } from "./hooks/useDemoBootstrap";
import { useScheduleSync } from "./hooks/useScheduleSync";
import MainArea from "./MainArea";
import SignInScreen from "./SignInScreen";
import { useStore } from "./store";

export default function App() {
  useDemoBootstrap();
  useAuth();
  useScheduleSync();

  const isLoggedIn = useStore((s) => s.isLoggedIn);
  const [panelOpen, setPanelOpen] = useState(true);

  if (!isLoggedIn) return <SignInScreen />;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <AppHeader panelOpen={panelOpen} onTogglePanel={() => setPanelOpen((v) => !v)} />
      <CoursesPanel open={panelOpen} />
      <MainArea />
    </div>
  );
}
