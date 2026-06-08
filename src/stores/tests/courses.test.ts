import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
import type { BannerResponse, BannerSection } from "../../lib/types";
import { useCoursesStore } from "../courses";
import { useCurrentRegStore } from "../currentReg";
import { useSelectionStore } from "../selection";
import { useUiStore } from "../ui";

function makeBannerSection(over: Partial<BannerSection> = {}): BannerSection {
  return {
    id: 1,
    term: "202540",
    termDesc: "Spring 2026",
    courseReferenceNumber: "10000",
    partOfTerm: "1",
    courseNumber: "306",
    courseDisplay: "CPRG 306",
    subject: "CPRG",
    subjectDescription: "Programming",
    sequenceNumber: "A",
    campusDescription: "Main Campus",
    scheduleTypeDescription: "Lecture",
    courseTitle: "Programming Principles",
    creditHours: 3,
    maximumEnrollment: 30,
    enrollment: 25,
    seatsAvailable: 5,
    waitCapacity: 0,
    waitCount: 0,
    waitAvailable: 0,
    crossList: null,
    crossListCapacity: null,
    crossListCount: null,
    crossListAvailable: null,
    creditHourHigh: null,
    creditHourLow: null,
    creditHourIndicator: null,
    openSection: true,
    linkIdentifier: null,
    isSectionLinked: false,
    subjectCourse: "CPRG306",
    faculty: [],
    meetingsFaculty: [],
    reservedSeatSummary: null,
    sectionAttributes: [],
    instructionalMethod: "F",
    instructionalMethodDescription: "In Person",
    ...over,
  };
}

describe("useCoursesStore.loadBannerResponse", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("populates courseGroups and auto-selects the new courses", () => {
    const courses = useCoursesStore();
    const selection = useSelectionStore();

    const response: BannerResponse = {
      success: true,
      totalCount: 1,
      data: [makeBannerSection()],
    };

    const added = courses.loadBannerResponse(response);

    expect(added).toBe(1);
    expect(courses.courseGroups.has("CPRG306")).toBe(true);
    expect(selection.selectedCourses.has("CPRG306")).toBe(true);
  });

  it("reports a friendly error when Banner returns no sections", () => {
    const courses = useCoursesStore();
    const ui = useUiStore();

    const added = courses.loadBannerResponse({
      success: true,
      totalCount: 0,
      data: [],
    });

    expect(added).toBe(0);
    expect(ui.loadError).toContain("no course sections");
  });

  it("merges new sections without clobbering existing courses", () => {
    const courses = useCoursesStore();

    courses.loadBannerResponse({
      success: true,
      totalCount: 1,
      data: [makeBannerSection()],
    });
    courses.loadBannerResponse({
      success: true,
      totalCount: 1,
      data: [
        makeBannerSection({
          subject: "MATH",
          courseNumber: "240",
          subjectCourse: "MATH240",
          courseReferenceNumber: "10001",
        }),
      ],
    });

    expect(courses.courseGroups.size).toBe(2);
    expect(courses.courseGroups.has("CPRG306")).toBe(true);
    expect(courses.courseGroups.has("MATH240")).toBe(true);
  });
});

describe("useCoursesStore.removeCourse", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("removes the course from every dependent store", () => {
    const courses = useCoursesStore();
    const selection = useSelectionStore();
    const currentReg = useCurrentRegStore();

    courses.loadBannerResponse({
      success: true,
      totalCount: 1,
      data: [makeBannerSection()],
    });
    currentReg.initializeFromGroups(courses.courseGroups);

    expect(currentReg.currentRegistrations.has("CPRG306")).toBe(true);

    courses.removeCourse("CPRG306");

    expect(courses.courseGroups.has("CPRG306")).toBe(false);
    expect(selection.selectedCourses.has("CPRG306")).toBe(false);
    expect(currentReg.currentRegistrations.has("CPRG306")).toBe(false);
    expect(currentReg.includedCourses.has("CPRG306")).toBe(false);
  });
});
