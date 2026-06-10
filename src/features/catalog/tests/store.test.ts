import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
import type { CourseSection } from "@/domain/types";
import { useTermStore } from "@/features/term/store";
import { useCatalogStore } from "../store";

function section(id: string): CourseSection {
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

describe("useCatalogStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("merge adds new courses and replaces sections for existing ones", () => {
    const catalog = useCatalogStore();
    catalog.setCourseGroups(new Map([["CPRG306", [section("CPRG306-A")]]]));

    catalog.mergeCourseGroups(
      new Map([
        ["CPRG306", [section("CPRG306-B")]],
        ["MATH240", [section("MATH240-A")]],
      ]),
    );

    expect(catalog.courseGroups.size).toBe(2);
    expect(catalog.courseGroups.get("CPRG306")?.[0]?.identifier).toBe("CPRG306-B");
  });

  it("keeps each term's catalog in its own slot", () => {
    const term = useTermStore();
    const catalog = useCatalogStore();

    term.set("202540");
    catalog.setCourseGroups(new Map([["CPRG306", [section("CPRG306-A")]]]));
    term.set("202610");
    expect(catalog.courseGroups.size).toBe(0);
    catalog.setCourseGroups(new Map([["MATH240", [section("MATH240-A")]]]));

    term.set("202540");
    expect([...catalog.courseGroups.keys()]).toEqual(["CPRG306"]);
  });

  it("removeCourse and clearCourses only touch the active term", () => {
    const term = useTermStore();
    const catalog = useCatalogStore();

    term.set("202540");
    catalog.setCourseGroups(
      new Map([
        ["CPRG306", [section("CPRG306-A")]],
        ["MATH240", [section("MATH240-A")]],
      ]),
    );
    term.set("202610");
    catalog.setCourseGroups(new Map([["PHIL241", [section("PHIL241-A")]]]));

    term.set("202540");
    catalog.removeCourse("CPRG306");
    expect([...catalog.courseGroups.keys()]).toEqual(["MATH240"]);

    catalog.clearCourses();
    expect(catalog.courseGroups.size).toBe(0);
    expect(catalog.slots.get("202610")?.size).toBe(1);
  });
});
