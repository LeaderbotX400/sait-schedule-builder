import { useState, useCallback, useMemo } from "react";
import type { CourseSection, Schedule, ScheduleRules, BannerResponse } from "../lib/types";
import { DEFAULT_RULES } from "../lib/types";
import { parseRawJson, parseBannerData } from "../lib/parser";
import { generateSchedules } from "../lib/scheduler";
import type { BannerCredentials } from "../lib/api";

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
  const [loadError, setLoadError] = useState<string | null>(null);

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
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to parse data");
    }
  }, []);

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

  return {
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
    setSelectedCourses,
    setCredentials,
    generate,
    setRules,
    setActiveScheduleIndex,
  };
}
