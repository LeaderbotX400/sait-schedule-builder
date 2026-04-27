import { useState, useCallback, useMemo, useEffect } from "react";
import type { CourseSection, Schedule, ScheduleRules, BannerResponse, CurrentRegistration } from "../lib/types";
import { DEFAULT_RULES, sectionsHaveConflict } from "../lib/types";
import { parseRawJson, parseBannerData, parseActiveRegistrations } from "../lib/parser";
import { generateSchedules } from "../lib/scheduler";
import type { BannerCredentials } from "../lib/api";
import { fetchRegistrations, getTerms } from "../lib/api";

export type GenerationStatus =
  | { kind: "idle" }
  | { kind: "generating" }
  | { kind: "success"; count: number }
  | { kind: "empty"; reason: string }
  | { kind: "error"; message: string };

export function useScheduler() {
  const [courseGroups, setCourseGroups] = useState<Map<string, CourseSection[]>>(
    new Map(),
  );
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(
    new Set(),
  );
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [rules, setRules] = useState<ScheduleRules>(DEFAULT_RULES);
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus>({ kind: "idle" });
  const [activeScheduleIndex, setActiveScheduleIndex] = useState(0);
  const [credentials, setCredentials] = useState<BannerCredentials | null>(null);
  const [term, setTerm] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [registrationsLoading, setRegistrationsLoading] = useState(false);
  
  // Current registrations tracking
  const [currentRegistrations, setCurrentRegistrations] = useState<Map<string, CurrentRegistration>>(
    new Map(),
  );
  // Track section swaps: subjectCourse -> sectionIdentifier being used
  const [sectionOverrides, setSectionOverrides] = useState<Map<string, string>>(new Map());
  // Track which courses are toggled on/off in current schedule
  const [includedCourses, setIncludedCourses] = useState<Set<string>>(new Set());

  // Auto-fetch registered courses when credentials are first set.
  // Fetch the term list first so we always use the student's current active term.
  useEffect(() => {
    if (!credentials) return;
    setRegistrationsLoading(true);
    setLoadError(null);
    getTerms(credentials)
      .then((terms) => {
        if (!Array.isArray(terms) || terms.length === 0) {
          throw new Error("Banner returned no terms — session may be invalid");
        }
        // Skip non-enrollable terms: view-only, non-credit, apprentice, etc.
        const SKIP = ["(View Only)", "Non-Credit", "Apprentice", "(View only)"];
        const activeTerm = terms.find(
          (t) => !SKIP.some((s) => t.description.includes(s)),
        );
        const termCode = activeTerm?.code;
        if (!termCode) return [];
        setTerm(termCode);
        return fetchRegistrations(credentials, termCode);
      })
      .then((registrations) => {
        if (registrations.length > 0) {
          const groups = parseActiveRegistrations(registrations);
          setCourseGroups(groups);
          setSelectedCourses(new Set(groups.keys()));
          initializeCurrentRegistrations(groups);
        }
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        setLoadError(`Could not load your registrations: ${msg}. Try reconnecting to Banner.`);
      })
      .finally(() => setRegistrationsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credentials]);

  /** Initialize current registrations from loaded courses (simulates Banner enrollment data) */
  const initializeCurrentRegistrations = useCallback((fromCourseGroups: Map<string, CourseSection[]>) => {
    const regs = new Map<string, CurrentRegistration>();
    const included = new Set<string>();

    for (const [subjectCourse, sections] of fromCourseGroups) {
      if (sections.length > 0) {
        // Default to first section as "current registration"
        const currentSection = sections[0];
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
  }, []);

  /** Load from raw JSON (file upload / paste) */
  const loadData = useCallback((json: unknown) => {
    setLoadError(null);
    try {
      const groups = parseRawJson(json);
      if (groups.size === 0) {
        setLoadError("No course sections found in the provided data. Check that the JSON contains a \"data\" array with course entries.");
        return;
      }
      setCourseGroups(groups);
      setSelectedCourses(new Set(groups.keys()));
      setSchedules([]);
      setActiveScheduleIndex(0);
      setGenerationStatus({ kind: "idle" });
      // Initialize current registrations from loaded data
      initializeCurrentRegistrations(groups);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to parse data");
    }
  }, [initializeCurrentRegistrations]);

  /** Load from Banner API response — merges into existing data. Returns count of new sections. */
  const loadBannerResponse = useCallback((response: BannerResponse): number => {
    setLoadError(null);
    if (!response.data || response.data.length === 0) {
      setLoadError("Banner returned no course sections. Double-check that the course codes exist for the selected term.");
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
          setGenerationStatus({ kind: "empty", reason: "No courses selected. Select at least one course in the sidebar." });
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
            reasons.push("All sections are full. Try unchecking \"Only show sections with open seats\".");
          }
          if (allFilteredByTime) {
            reasons.push(`All sections fall outside your ${rules.earliestStart.replace(/(\d{2})(\d{2})/, "$1:$2")}-${rules.latestEnd.replace(/(\d{2})(\d{2})/, "$1:$2")} time window. Try widening the time range.`);
          }
          if (allFilteredByDays) {
            reasons.push(`All sections have classes on your designated free days (${rules.freeDays.join(", ")}). Try removing some free days.`);
          }
          if (reasons.length === 0) {
            reasons.push("Every combination of sections has a time conflict. Try selecting fewer courses, allowing partial schedules, or relaxing your rules.");
          }

          setGenerationStatus({ kind: "empty", reason: reasons.join(" ") });
        } else {
          setGenerationStatus({ kind: "success", count: result.length });
        }
      } catch (e) {
        setGenerationStatus({
          kind: "error",
          message: e instanceof Error ? e.message : "An unexpected error occurred during schedule generation.",
        });
      }
    }, 10);
  }, [courseGroups, selectedCourses, rules]);

  const activeSchedule = useMemo(
    () => schedules[activeScheduleIndex] ?? null,
    [schedules, activeScheduleIndex],
  );

  /** Swap a course to a different section and check for conflicts */
  const swapSection = useCallback((subjectCourse: string, newSectionIdentifier: string) => {
    // Find the section in courseGroups
    const sections = courseGroups.get(subjectCourse);
    if (!sections) return { success: false, conflicts: [] as CourseSection[] };

    const newSection = sections.find((s) => s.identifier === newSectionIdentifier);
    if (!newSection) return { success: false, conflicts: [] as CourseSection[] };

    // Check for conflicts with other courses in current schedule
    const conflicts: CourseSection[] = [];
    for (const [course, reg] of currentRegistrations) {
      if (course === subjectCourse) continue;
      if (!includedCourses.has(course)) continue;

      const otherSection = sectionOverrides.has(course)
        ? courseGroups.get(course)?.find((s) => s.identifier === sectionOverrides.get(course))
        : reg.currentSection;

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
  }, [courseGroups, currentRegistrations, includedCourses, sectionOverrides]);

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
    for (const [subjectCourse, reg] of currentRegistrations) {
      if (!includedCourses.has(subjectCourse)) continue;

      const section = sectionOverrides.has(subjectCourse)
        ? courseGroups.get(subjectCourse)?.find((s) => s.identifier === sectionOverrides.get(subjectCourse))
        : reg.currentSection;

      if (section) {
        courses.push(section);
      }
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
    term,
    loadError,
    loadData,
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
  };
}
