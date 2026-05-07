import { useState } from "react";
import AppHeader from "./AppHeader";
import { useAuth, useAuthInit } from "./auth";
import CoursesPanel from "./CoursesPanel";
import { useHolds } from "./holds";
import { useDemoBootstrap } from "./hooks/useDemoBootstrap";
import { useScheduleSync } from "./hooks/useScheduleSync";
import { useIdentity } from "./identity";
import MainArea from "./MainArea";
import { useProfile } from "./profile";
import { useRegistrationStatus } from "./registration-status";
import SignInScreen from "./SignInScreen";

export default function App() {
  useDemoBootstrap();
  useAuthInit();
  useIdentity();
  useScheduleSync();
  useProfile();
  useRegistrationStatus();
  useHolds();

  const { status } = useAuth();
  const [panelOpen, setPanelOpen] = useState(true);

  if (status !== "authenticated") return <SignInScreen />;

  return (
    <div className="min-h-screen bg-page text-fg">
      <AppHeader panelOpen={panelOpen} onTogglePanel={() => setPanelOpen((v) => !v)} />
      <CoursesPanel open={panelOpen} />
      <MainArea />
    </div>
  );
}
