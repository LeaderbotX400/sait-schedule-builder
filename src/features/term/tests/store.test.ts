import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
import type { CourseSection } from "@/domain/types";
import { useCoursesStore } from "@/features/courses/store";
import { useCurrentRegStore } from "@/features/current/store";
import { useSchedulesStore } from "@/features/schedules/store";
import { useSelectionStore } from "@/features/selection/store";
import { useTermStore } from "../store";

function makeSection(id: string): CourseSection {
  return {
    identifier: id,
    subjectCourse: id.split("-")[0] ?? id,
    title: id,
    crn: id,
    instructor: "TBA",
    sequenceNumber: id.split("-")[1] ?? "A",
    seatsAvailable: 5,
    maximumEnrollment: 30,
    enrollment: 25,
    meetings: [],
    creditHours: 3,
    instructionalMethod: "Lecture",
  };
}

describe("useTermStore.setTerm", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("wipes every per-term store when the term changes", () => {
    const term = useTermStore();
    const courses = useCoursesStore();
    const selection = useSelectionStore();
    const schedules = useSchedulesStore();
    const currentReg = useCurrentRegStore();

    // Seed every per-term store as if a sync run just populated them.
    courses.setCourseGroups(new Map([["CPRG306", [makeSection("CPRG306-A")]]]));
    selection.setSelectedCourses(new Set(["CPRG306"]));
    schedules.setSchedules([
      {
        id: 1,
        qualityScore: 50,
        warnings: [],
        courses: [],
        daysUsed: [],
        daysCount: 0,
        onCampusDays: [],
        onCampusDaysCount: 0,
        onCampusPerDay: {},
        earlyMorningPenalty: 0,
        travelTimePenalty: 0,
        isPartial: false,
        omittedCourses: [],
        blockoutFitScore: 50,
      },
    ]);
    currentReg.initializeFromGroups(new Map([["CPRG306", [makeSection("CPRG306-A")]]]));

    expect(courses.courseGroups.size).toBe(1);
    expect(selection.selectedCourses.size).toBe(1);
    expect(schedules.schedules.length).toBe(1);
    expect(currentReg.currentRegistrations.size).toBe(1);

    term.setTerm("202610");

    expect(term.term).toBe("202610");
    expect(courses.courseGroups.size).toBe(0);
    expect(selection.selectedCourses.size).toBe(0);
    expect(schedules.schedules.length).toBe(0);
    expect(currentReg.currentRegistrations.size).toBe(0);
    expect(currentReg.sectionOverrides.size).toBe(0);
    expect(currentReg.includedCourses.size).toBe(0);
  });

  it("is a no-op when setting the same term twice", () => {
    const term = useTermStore();
    const courses = useCoursesStore();

    courses.setCourseGroups(new Map([["CPRG306", [makeSection("CPRG306-A")]]]));
    const originalTerm = term.term;
    term.setTerm(originalTerm);

    expect(courses.courseGroups.size).toBe(1);
  });
});
