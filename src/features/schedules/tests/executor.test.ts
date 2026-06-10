import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
import { isProxy } from "vue";
import type { CourseSection } from "@/domain/types";
import { useCatalogStore } from "@/features/catalog/store";
import { currentGenerateInput } from "@/features/planner/actions";
import { useSelectionStore } from "@/features/selection/store";
import { toClonableInput } from "../executor";

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

describe("toClonableInput", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("strips Vue proxies from store-read planner inputs so they survive structured clone", () => {
    // Build the input exactly the way the app does: through Pinia store
    // reads, which hand back reactive proxies that Worker postMessage
    // rejects ("#<Object> could not be cloned").
    const catalog = useCatalogStore();
    const selection = useSelectionStore();
    catalog.setCourseGroups(new Map([["CPRG306", [section("CPRG306-A")]]]));
    selection.setSelectedCourses(new Set(["CPRG306"]));
    selection.pin("CPRG306", "CPRG306-A");

    const input = currentGenerateInput();
    const clonable = toClonableInput(input);

    expect(isProxy(clonable.courses)).toBe(false);
    expect(isProxy(clonable.rules)).toBe(false);
    expect(isProxy(clonable.pinnedCrns)).toBe(false);
    for (const sections of clonable.courses.values()) {
      expect(isProxy(sections)).toBe(false);
      for (const s of sections) expect(isProxy(s)).toBe(false);
    }

    // The actual gate: structured clone (what postMessage uses) round-trips.
    const cloned = structuredClone(clonable);
    expect([...cloned.courses.keys()]).toEqual(["CPRG306"]);
    expect(cloned.courses.get("CPRG306")?.[0]?.identifier).toBe("CPRG306-A");
    expect(cloned.pinnedCrns.get("CPRG306")).toBe("CPRG306-A");
    expect(cloned.rules.earliestStart).toBe(clonable.rules.earliestStart);
  });

  it("passes plain inputs through unchanged in shape", () => {
    const courses = new Map([["A", [section("A-1")]]]);
    const out = toClonableInput({
      courses,
      rules: { earliestStart: "0800" } as never,
      pinnedCrns: new Map([["A", "A-1"]]),
    });
    expect([...out.courses.keys()]).toEqual(["A"]);
    expect(out.courses.get("A")?.[0]).toEqual(section("A-1"));
    expect(out.pinnedCrns.get("A")).toBe("A-1");
  });
});
