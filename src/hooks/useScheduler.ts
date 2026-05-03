import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchRegistrations, getTerms } from "../lib/api";
import { parseActiveRegistrations, parseBannerData } from "../lib/parser";
import { generateSchedules } from "../lib/scheduler";
import { DEFAULT_TERM } from "../lib/terms";
import type {
  BannerResponse,
  CourseSection,
  CurrentRegistration,
  Schedule,
  ScheduleRules,
} from "../lib/types";
import { DEFAULT_RULES, resolveCurrentSection, sectionsHaveConflict } from "../lib/types";
import { usePersistedState, usePersistedStringSet } from "../lib/usePersistedState";
import { useCredentials } from "./useCredentials";

export type GenerationStatus =
  | { kind: "idle" }
  | { kind: "generating" }
  | { kind: "success"; count: number }
  | { kind: "empty"; reason: string }
  | { kind: "error"; message: string };

export function useScheduler() {
  const {
    credentials,
    studentId,
    sessionExpired,
    gpa,
    registrationNotices,
    setCredentials,
    clearSessionExpired,
    refreshProfile,
  } = useCredentials();

  const [courseGroups, setCourseGroups] = useState<Map<string, CourseSection[]>>(new Map());
  const [selectedCourses, setSelectedCourses] = usePersistedStringSet("selected-courses");
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [rules, setRules] = useState<ScheduleRules>(DEFAULT_RULES);
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus>({
    kind: "idle",
  });
  const [activeScheduleIndex, setActiveScheduleIndex] = useState(0);
  const [term, setTerm] = usePersistedState<string>("term", DEFAULT_TERM);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [registrationsLoading, setRegistrationsLoading] = useState(false);

  // Current registrations tracking
  const [currentRegistrations, setCurrentRegistrations] = useState<
    Map<string, CurrentRegistration>
  >(new Map());
  // Track section swaps: subjectCourse -> sectionIdentifier being used
  const [sectionOverrides, setSectionOverrides] = useState<Map<string, string>>(new Map());
  // Track which courses are toggled on/off in current schedule
  const [includedCourses, setIncludedCourses] = useState<Set<string>>(new Set());

  // Auto-fetch registered courses when credentials are first set.
  // Fetch the term list first so we always use the student's current active term.
  // Retries once after 1.5 s to handle the case where the Banner session on ssag6
  // hasn't fully settled by the time credentials are returned from the extension.
  useEffect(() => {
    if (!credentials) return;
    let cancelled = false;

    const SKIP = ["(View Only)", "Non-Credit", "Apprentice", "(View only)"];

    const doFetch = async (isRetry: boolean) => {
      if (cancelled) return;
      setRegistrationsLoading(true);
      if (!isRetry) setLoadError(null);

      try {
        const terms = await getTerms(credentials);
        if (cancelled) return;
        if (!Array.isArray(terms) || terms.length === 0) {
          throw new Error("Banner returned no terms — session may be invalid");
        }
        const activeTerm = terms.find((t) => !SKIP.some((s) => t.description.includes(s)));
        const termCode = activeTerm?.code;
        if (!termCode) return;
        setTerm(termCode);

        const registrations = await fetchRegistrations(credentials, termCode);
        if (cancelled) return;

        if (registrations.length > 0) {
          const groups = parseActiveRegistrations(registrations);
          setCourseGroups(groups);
          setSelectedCourses((prev) => {
            const restored = new Set([...prev].filter((name) => groups.has(name)));
            return restored.size > 0 ? restored : new Set(groups.keys());
          });
          initializeCurrentRegistrations(groups);
        } else if (!isRetry) {
          // Session may not be fully ready — retry once after a short delay.
          setTimeout(() => doFetch(true), 1500);
          return;
        }
      } catch (err) {
        if (cancelled) return;
        if (!isRetry) {
          // On first failure retry; only surface the error after the second attempt.
          setTimeout(() => doFetch(true), 1500);
          return;
        }
        const msg = err instanceof Error ? err.message : String(err);
        setLoadError(`Could not load your registrations: ${msg}. Try reconnecting to Banner.`);
      } finally {
        if (!cancelled) setRegistrationsLoading(false);
      }
    };

    doFetch(false);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credentials]);

  /** Initialize current registrations from loaded courses (simulates Banner enrollment data) */
  const initializeCurrentRegistrations = useCallback(
    (fromCourseGroups: Map<string, CourseSection[]>) => {
      const regs = new Map<string, CurrentRegistration>();
      const included = new Set<string>();

      for (const [subjectCourse, sections] of fromCourseGroups) {
        const currentSection = sections[0];
        if (currentSection) {
          regs.set(subjectCourse, {
            subjectCourse,
            currentSection,
            isIncluded: true,
          });
          included.add(subjectCourse);
        }
      }

      setCurrentRegistrations(regs);
      setIncludedCourses(included);
      setSectionOverrides(new Map());
    },
    [],
  );

  /** Load from Banner API response — merges into existing data. Returns count of new sections. */
  const loadBannerResponse = useCallback((response: BannerResponse): number => {
    setLoadError(null);
    if (!response.data || response.data.length === 0) {
      setLoadError(
        "Banner returned no course sections. Double-check that the course codes exist for the selected term.",
      );
      return 0;
    }

    const newGroups = parseBannerData(response);
    if (newGroups.size === 0) {
      setLoadError("Received data but no valid course sections could be parsed.");
      return 0;
    }

    setCourseGroups((prev) => {
      const merged = new Map(prev);
      for (const [name, sections] of newGroups) {
        merged.set(name, sections);
      }
      return merged;
    });
    setSelectedCourses((prev) => {
      const next = new Set(prev);
      for (const name of newGroups.keys()) {
        next.add(name);
      }
      return next;
    });
    setSchedules([]);
    setActiveScheduleIndex(0);
    setGenerationStatus({ kind: "idle" });

    return response.data.length;
  }, []);

  const clearCourses = useCallback(() => {
    setCourseGroups(new Map());
    setSelectedCourses(new Set());
    setSchedules([]);
    setActiveScheduleIndex(0);
    setGenerationStatus({ kind: "idle" });
    setLoadError(null);
    setCurrentRegistrations(new Map());
    setIncludedCourses(new Set());
    setSectionOverrides(new Map());
  }, []);

  const toggleCourse = useCallback((subjectCourse: string) => {
    setSelectedCourses((prev) => {
      const next = new Set(prev);
      if (next.has(subjectCourse)) {
        next.delete(subjectCourse);
      } else {
        next.add(subjectCourse);
      }
      return next;
    });
  }, []);

  const generate = useCallback(() => {
    setGenerationStatus({ kind: "generating" });
    setLoadError(null);
    setTimeout(() => {
      try {
        const filtered = new Map<string, CourseSection[]>();
        for (const [name, sections] of courseGroups) {
          if (selectedCourses.has(name)) {
            filtered.set(name, sections);
          }
        }

        if (filtered.size === 0) {
          setGenerationStatus({
            kind: "empty",
            reason: "No courses selected. Select at least one course in the sidebar.",
          });
          return;
        }

        if (filtered.size === 1) {
          // With only one course group, every section is a valid "schedule"
          // This is fine, but worth noting
        }

        const result = generateSchedules(filtered, { rules });
        setSchedules(result);
        setActiveScheduleIndex(0);

        if (result.length === 0) {
          // Build a helpful message about why
          const reasons: string[] = [];

          // Check if rules filtered out all sections
          const earliest = parseInt(rules.earliestStart, 10);
          const latest = parseInt(rules.latestEnd, 10);
          let allFilteredByTime = true;
          let allFilteredBySeats = true;
          let allFilteredByDays = true;
          for (const sections of filtered.values()) {
            for (const section of sections) {
              let timeOk = true;
              let dayOk = true;
              for (const m of section.meetings) {
                if (m.startTime < earliest || m.endTime > latest) timeOk = false;
                for (const d of m.days) {
                  if (rules.freeDays.includes(d)) dayOk = false;
                }
              }
              if (timeOk) allFilteredByTime = false;
              if (dayOk) allFilteredByDays = false;
              if (section.seatsAvailable > 0) allFilteredBySeats = false;
            }
          }

          if (rules.requireOpenSeats && allFilteredBySeats) {
            reasons.push(
              'All sections are full. Try unchecking "Only show sections with open seats".',
            );
          }
          if (allFilteredByTime) {
            reasons.push(
              `All sections fall outside your ${rules.earliestStart.replace(/(\d{2})(\d{2})/, "$1:$2")}-${rules.latestEnd.replace(/(\d{2})(\d{2})/, "$1:$2")} time window. Try widening the time range.`,
            );
          }
          if (allFilteredByDays) {
            reasons.push(
              `All sections have classes on your designated free days (${rules.freeDays.join(", ")}). Try removing some free days.`,
            );
          }
          if (reasons.length === 0) {
            reasons.push(
              "Every combination of sections has a time conflict. Try selecting fewer courses, allowing partial schedules, or relaxing your rules.",
            );
          }

          setGenerationStatus({ kind: "empty", reason: reasons.join(" ") });
        } else {
          setGenerationStatus({ kind: "success", count: result.length });
        }
      } catch (e) {
        setGenerationStatus({
          kind: "error",
          message:
            e instanceof Error
              ? e.message
              : "An unexpected error occurred during schedule generation.",
        });
      }
    }, 10);
  }, [courseGroups, selectedCourses, rules]);

  // Debounced auto-regeneration when courses, selection, or rules change so
  // the shape calendar reflects edits without clicking Generate. The 200ms
  // delay coalesces rapid changes (e.g. dragging the time-window slider).
  useEffect(() => {
    if (courseGroups.size === 0 || selectedCourses.size === 0) return;
    const timer = setTimeout(generate, 200);
    return () => clearTimeout(timer);
  }, [courseGroups, selectedCourses, rules]);

  const activeSchedule = useMemo(
    () => schedules[activeScheduleIndex] ?? null,
    [schedules, activeScheduleIndex],
  );

  /** Swap a course to a different section and check for conflicts */
  const swapSection = useCallback(
    (subjectCourse: string, newSectionIdentifier: string) => {
      // Find the section in courseGroups
      const sections = courseGroups.get(subjectCourse);
      if (!sections) return { success: false, conflicts: [] as CourseSection[] };

      const newSection = sections.find((s) => s.identifier === newSectionIdentifier);
      if (!newSection) return { success: false, conflicts: [] as CourseSection[] };

      // Check for conflicts with other courses in current schedule
      const conflicts: CourseSection[] = [];
      for (const course of currentRegistrations.keys()) {
        if (course === subjectCourse) continue;
        if (!includedCourses.has(course)) continue;
        const otherSection = resolveCurrentSection(
          course,
          currentRegistrations,
          sectionOverrides,
          courseGroups,
        );
        if (otherSection && sectionsHaveConflict(newSection, otherSection)) {
          conflicts.push(otherSection);
        }
      }

      // Apply the swap
      setSectionOverrides((prev) => {
        const next = new Map(prev);
        next.set(subjectCourse, newSectionIdentifier);
        return next;
      });

      return { success: true, conflicts };
    },
    [courseGroups, currentRegistrations, includedCourses, sectionOverrides],
  );

  const SKIP_TERMS = ["(View Only)", "Non-Credit", "Apprentice", "(View only)"];

  /** Re-fetch all Banner data (GPA, notices, registrations) with the current session. */
  const refresh = useCallback(async () => {
    if (!credentials || !studentId) return;
    setRegistrationsLoading(true);
    setLoadError(null);

    await refreshProfile();

    try {
      const terms = await getTerms(credentials);
      if (!Array.isArray(terms) || terms.length === 0) {
        throw new Error("Banner returned no terms — session may be invalid");
      }
      const activeTerm = terms.find((t) => !SKIP_TERMS.some((s) => t.description.includes(s)));
      const termCode = activeTerm?.code;
      if (termCode) {
        setTerm(termCode);
        const registrations = await fetchRegistrations(credentials, termCode);
        if (registrations.length > 0) {
          const groups = parseActiveRegistrations(registrations);
          setCourseGroups(groups);
          setSelectedCourses((prev) => {
            const restored = new Set([...prev].filter((name) => groups.has(name)));
            return restored.size > 0 ? restored : new Set(groups.keys());
          });
          initializeCurrentRegistrations(groups);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setLoadError(`Could not refresh your registrations: ${msg}. Try reconnecting to Banner.`);
    } finally {
      setRegistrationsLoading(false);
    }
  }, [credentials, studentId, initializeCurrentRegistrations, refreshProfile]);

  /** Toggle a course on/off in the current schedule */
  const toggleCurrentCourse = useCallback((subjectCourse: string) => {
    setIncludedCourses((prev) => {
      const next = new Set(prev);
      if (next.has(subjectCourse)) {
        next.delete(subjectCourse);
      } else {
        next.add(subjectCourse);
      }
      return next;
    });
  }, []);

  /** Build a Schedule object from current registrations + modifications */
  const getCurrentSchedule = useCallback((): Schedule | null => {
    if (currentRegistrations.size === 0) return null;

    const courses: CourseSection[] = [];
    for (const subjectCourse of currentRegistrations.keys()) {
      if (!includedCourses.has(subjectCourse)) continue;
      const section = resolveCurrentSection(
        subjectCourse,
        currentRegistrations,
        sectionOverrides,
        courseGroups,
      );
      if (section) courses.push(section);
    }

    if (courses.length === 0) return null;

    // TODO: Calculate warnings and quality score
    // For now, return a basic Schedule object
    return {
      id: 0,
      qualityScore: 0,
      warnings: [],
      courses,
      daysUsed: [],
      daysCount: 0,
      onCampusDays: [],
      onCampusDaysCount: 0,
      onCampusPerDay: {},
      earlyMorningPenalty: 0,
      travelTimePenalty: 0,
      isPartial: false,
      omittedCourses: [],
      blockoutFitScore: 0,
    };
  }, [currentRegistrations, includedCourses, sectionOverrides, courseGroups]);

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
    // New: current registration support
    currentRegistrations,
    registrationsLoading,
    includedCourses,
    sectionOverrides,
    swapSection,
    toggleCurrentCourse,
    initializeCurrentRegistrations,
    getCurrentSchedule,
    refresh,
  };
}
