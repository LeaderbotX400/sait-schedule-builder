import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
import type { CourseSection } from "@/domain/types";
import { useCatalogStore } from "@/features/catalog/store";
import { useCurrentRegStore } from "../store";

function makeSection(id: string, day: "Mon" | "Tue", start = 900, end = 1000): CourseSection {
  const subjectCourse = id.split("-")[0] ?? id;
  return {
    identifier: id,
    subjectCourse,
    title: id,
    crn: id,
    instructor: "TBA",
    sequenceNumber: id.split("-")[1] ?? "A",
    seatsAvailable: 5,
    maximumEnrollment: 30,
    enrollment: 25,
    meetings: [
      {
        days: [day],
        startTime: start,
        endTime: end,
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

describe("useCurrentRegStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("initializeFromGroups seeds the first section as the active registration", () => {
    const store = useCurrentRegStore();
    store.initializeFromGroups(
      new Map([
        ["CPRG306", [makeSection("CPRG306-A", "Mon"), makeSection("CPRG306-B", "Tue")]],
      ]),
    );
    expect(store.currentRegistrations.get("CPRG306")?.currentSection.identifier).toBe("CPRG306-A");
    expect(store.includedCourses.has("CPRG306")).toBe(true);
  });

  it("swapSection records the override and reports conflicts", () => {
    const courses = useCatalogStore();
    const store = useCurrentRegStore();

    const a1 = makeSection("CPRG306-A", "Mon", 900, 1000);
    const a2 = makeSection("CPRG306-B", "Mon", 930, 1030);
    const b1 = makeSection("MATH240-A", "Mon", 945, 1100);
    courses.setCourseGroups(
      new Map([
        ["CPRG306", [a1, a2]],
        ["MATH240", [b1]],
      ]),
    );
    store.initializeFromGroups(courses.courseGroups);

    const result = store.swapSection("CPRG306", "CPRG306-B", courses.courseGroups);

    expect(result.success).toBe(true);
    expect(result.conflicts.map((s) => s.identifier)).toContain("MATH240-A");
    expect(store.sectionOverrides.get("CPRG306")).toBe("CPRG306-B");
  });

  it("toggleCurrentCourse flips includedCourses membership", () => {
    const store = useCurrentRegStore();
    store.initializeFromGroups(new Map([["CPRG306", [makeSection("CPRG306-A", "Mon")]]]));

    expect(store.includedCourses.has("CPRG306")).toBe(true);
    store.toggleCurrentCourse("CPRG306");
    expect(store.includedCourses.has("CPRG306")).toBe(false);
    store.toggleCurrentCourse("CPRG306");
    expect(store.includedCourses.has("CPRG306")).toBe(true);
  });

  it("forgetCourse drops one course from every tracked structure", () => {
    const store = useCurrentRegStore();
    store.initializeFromGroups(
      new Map([
        ["CPRG306", [makeSection("CPRG306-A", "Mon")]],
        ["MATH240", [makeSection("MATH240-A", "Tue")]],
      ]),
    );
    store.forgetCourse("CPRG306");

    expect(store.currentRegistrations.has("CPRG306")).toBe(false);
    expect(store.includedCourses.has("CPRG306")).toBe(false);
    expect(store.currentRegistrations.has("MATH240")).toBe(true);
  });
});
