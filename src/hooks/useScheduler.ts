// Compatibility shim. The state lives in the Zustand store now (see
// src/store/); this hook just selects every field the existing components
// expect and runs the cross-slice side effects via useScheduleSync.
//
// Step 5a–5e migrate components to read directly from the store and let
// us delete this file in step 11.

import type { GenerationStatus } from "../store";
import { useStore } from "../store";
import { useAuth } from "./useAuth";
import { refreshAllData, useScheduleSync } from "./useScheduleSync";

export type { GenerationStatus };

export function useScheduler() {
  // Mount the side-effect hooks (auth poll + auto-load + debounce-regenerate).
  useAuth();
  useScheduleSync();

  const credentials = useStore((s) => s.credentials);
  const studentId = useStore((s) => s.studentId);
  const sessionExpired = useStore((s) => s.sessionExpired);
  const gpa = useStore((s) => s.gpa);
  const registrationNotices = useStore((s) => s.registrationNotices);
  const clearSessionExpired = useStore((s) => s.clearSessionExpired);
  const setCredentials = useStore((s) => s.setCredentials);

  const courseGroups = useStore((s) => s.courseGroups);
  const selectedCourses = useStore((s) => s.selectedCourses);
  const setSelectedCourses = useStore((s) => s.setSelectedCourses);
  const toggleCourse = useStore((s) => s.toggleCourse);
  const loadBannerResponse = useStore((s) => s.loadBannerResponse);
  const clearCourses = useStore((s) => s.clearCourses);

  const term = useStore((s) => s.term);
  const setTerm = useStore((s) => s.setTerm);

  const rules = useStore((s) => s.rules);
  const setRules = useStore((s) => s.setRules);

  const schedules = useStore((s) => s.schedules);
  const activeScheduleIndex = useStore((s) => s.activeScheduleIndex);
  const setActiveScheduleIndex = useStore((s) => s.setActiveScheduleIndex);
  const generationStatus = useStore((s) => s.generationStatus);
  const generate = useStore((s) => s.generate);
  const activeSchedule = schedules[activeScheduleIndex] ?? null;

  const currentRegistrations = useStore((s) => s.currentRegistrations);
  const sectionOverrides = useStore((s) => s.sectionOverrides);
  const includedCourses = useStore((s) => s.includedCourses);
  const initializeCurrentRegistrations = useStore((s) => s.initializeCurrentRegistrations);
  const swapSection = useStore((s) => s.swapSection);
  const toggleCurrentCourse = useStore((s) => s.toggleCurrentCourse);
  const getCurrentSchedule = useStore((s) => s.getCurrentSchedule);

  const loadError = useStore((s) => s.loadError);
  const registrationsLoading = useStore((s) => s.registrationsLoading);

  return {
    courseGroups,
    selectedCourses,
    schedules,
    rules,
    generationStatus,
    activeScheduleIndex,
    activeSchedule,
    credentials,
    studentId,
    gpa,
    registrationNotices,
    sessionExpired,
    clearSessionExpired,
    term,
    setTerm,
    loadError,
    loadBannerResponse,
    clearCourses,
    toggleCourse,
    setSelectedCourses,
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
    initializeCurrentRegistrations,
    getCurrentSchedule,
    refresh: refreshAllData,
  };
}
