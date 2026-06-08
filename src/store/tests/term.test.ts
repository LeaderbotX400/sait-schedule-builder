import { beforeEach, describe, expect, it } from "vitest";
import { useStore } from "../index";

describe("setTerm", () => {
  beforeEach(() => {
    useStore.setState({
      term: "202540",
      courseGroups: new Map([["CPRG307", []]]),
      selectedCourses: new Set(["CPRG307", "INTP302"]),
      includedCourses: new Set(["CPRG307"]),
      sectionOverrides: new Map([["CPRG307", "A01"]]),
      currentRegistrations: new Map([["CPRG307", { sections: [] } as never]]),
      schedules: [{ courses: [] as never } as never],
    });
  });

  it("wipes per-term state — including selection — when the term changes", () => {
    useStore.getState().setTerm("202560");
    const s = useStore.getState();
    expect(s.term).toBe("202560");
    expect(s.courseGroups.size).toBe(0);
    expect(s.selectedCourses.size).toBe(0);
    expect(s.includedCourses.size).toBe(0);
    expect(s.sectionOverrides.size).toBe(0);
    expect(s.currentRegistrations.size).toBe(0);
    expect(s.schedules).toHaveLength(0);
  });

  it("is a no-op when called with the current term", () => {
    const before = useStore.getState();
    useStore.getState().setTerm("202540");
    const after = useStore.getState();
    expect(after.selectedCourses).toBe(before.selectedCourses);
    expect(after.courseGroups).toBe(before.courseGroups);
  });
});
