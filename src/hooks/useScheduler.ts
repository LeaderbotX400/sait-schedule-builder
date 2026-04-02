import { useState, useCallback, useMemo } from "react";
import type { CourseSection, Schedule, ScheduleRules } from "../lib/types";
import { DEFAULT_RULES } from "../lib/types";
import { parseRawJson } from "../lib/parser";
import { generateSchedules } from "../lib/scheduler";

export interface SchedulerState {
  courseGroups: Map<string, CourseSection[]>;
  selectedCourses: Set<string>; // subjectCourse keys the user wants to include
  schedules: Schedule[];
  rules: ScheduleRules;
  isGenerating: boolean;
  activeScheduleIndex: number;
}

export function useScheduler() {
  const [courseGroups, setCourseGroups] = useState<Map<string, CourseSection[]>>(
    new Map(),
  );
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(
    new Set(),
  );
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [rules, setRules] = useState<ScheduleRules>(DEFAULT_RULES);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeScheduleIndex, setActiveScheduleIndex] = useState(0);

  const loadData = useCallback((json: unknown) => {
    const groups = parseRawJson(json);
    setCourseGroups(groups);
    setSelectedCourses(new Set(groups.keys()));
    setSchedules([]);
    setActiveScheduleIndex(0);
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
    setIsGenerating(true);
    // Use setTimeout to let the UI update before heavy computation
    setTimeout(() => {
      const filtered = new Map<string, CourseSection[]>();
      for (const [name, sections] of courseGroups) {
        if (selectedCourses.has(name)) {
          filtered.set(name, sections);
        }
      }
      const result = generateSchedules(filtered, { rules });
      setSchedules(result);
      setActiveScheduleIndex(0);
      setIsGenerating(false);
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
    isGenerating,
    activeScheduleIndex,
    activeSchedule,
    loadData,
    toggleCourse,
    setSelectedCourses,
    generate,
    setRules,
    setActiveScheduleIndex,
  };
}
