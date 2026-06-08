import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CourseSection } from "../../domain/types";
import { useCoursesStore } from "../courses";
import { useSchedulesStore } from "../schedules";
import { useSelectionStore } from "../selection";

function makeSection(id: string, day: "Mon" | "Tue"): CourseSection {
  const subjectCourse = id.split("-")[0] ?? id;
  const sequenceNumber = id.split("-")[1] ?? "A";
  return {
    identifier: id,
    subjectCourse,
    title: id,
    crn: id,
    instructor: "TBA",
    sequenceNumber,
    seatsAvailable: 5,
    maximumEnrollment: 30,
    enrollment: 25,
    meetings: [
      {
        days: [day],
        startTime: 900,
        endTime: 1000,
        building: "B",
        room: "1",
        campus: "MAIN",
        campusDescription: "Main",
        type: "Lecture",
        isOnline: false,
      },
    ],
    creditHours: 3,
    instructionalMethod: "Lecture",
  };
}

describe("useSchedulesStore.generate", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
  });

  it("produces schedules for the cartesian product of selected sections", () => {
    const courses = useCoursesStore();
    const selection = useSelectionStore();
    const schedules = useSchedulesStore();

    courses.setCourseGroups(
      new Map([
        ["A", [makeSection("A-1", "Mon"), makeSection("A-2", "Tue")]],
        ["B", [makeSection("B-1", "Tue"), makeSection("B-2", "Mon")]],
      ]),
    );
    selection.setSelectedCourses(new Set(["A", "B"]));

    schedules.generate();
    expect(schedules.generationStatus.kind).toBe("generating");

    vi.runAllTimers();

    expect(schedules.generationStatus.kind).toBe("success");
    expect(schedules.schedules.length).toBeGreaterThan(0);
  });

  it("emits an 'empty' status with a hint when nothing is selected", () => {
    const schedules = useSchedulesStore();

    schedules.generate();
    vi.runAllTimers();

    expect(schedules.generationStatus.kind).toBe("empty");
    if (schedules.generationStatus.kind === "empty") {
      expect(schedules.generationStatus.reason).toContain("No courses selected");
    }
  });
});
