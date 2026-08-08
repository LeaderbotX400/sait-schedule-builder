import { describe, expect, it } from "vitest";
import { resolveCurrentSection, sectionsHaveConflict, timesOverlap } from "../conflicts";
import type { CourseSection, CurrentRegistration, MeetingBlock } from "../types";

function meeting(over: Partial<MeetingBlock> = {}): MeetingBlock {
  return {
    days: ["Mon"],
    startTime: 900,
    endTime: 1000,
    building: "B",
    room: "1",
    campus: "C",
    campusDescription: "Campus",
    type: "Lecture",
    isOnline: false,
    startDate: "2026-09-01",
    endDate: "2026-12-17",
    ...over,
  };
}

function section(id: string, meetings: MeetingBlock[] = [meeting()]): CourseSection {
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
    meetings,
    creditHours: 3,
    instructionalMethod: "Lecture",
  };
}

describe("timesOverlap", () => {
  it("non-overlapping", () => {
    expect(timesOverlap(900, 1000, 1000, 1100)).toBe(false);
    expect(timesOverlap(1000, 1100, 900, 1000)).toBe(false);
  });
  it("adjacent edges do not overlap", () => {
    expect(timesOverlap(900, 1000, 1000, 1100)).toBe(false);
  });
  it("partial overlap", () => {
    expect(timesOverlap(900, 1000, 930, 1100)).toBe(true);
  });
  it("full containment", () => {
    expect(timesOverlap(900, 1100, 930, 1000)).toBe(true);
  });
});

describe("sectionsHaveConflict", () => {
  it("conflicts when same day overlaps", () => {
    const a = section("A-1", [meeting({ days: ["Mon"], startTime: 900, endTime: 1000 })]);
    const b = section("B-1", [meeting({ days: ["Mon"], startTime: 930, endTime: 1100 })]);
    expect(sectionsHaveConflict(a, b)).toBe(true);
  });
  it("no conflict when different days", () => {
    const a = section("A-1", [meeting({ days: ["Mon"], startTime: 900, endTime: 1000 })]);
    const b = section("B-1", [meeting({ days: ["Tue"], startTime: 900, endTime: 1000 })]);
    expect(sectionsHaveConflict(a, b)).toBe(false);
  });
  it("no conflict when same day but no time overlap", () => {
    const a = section("A-1", [meeting({ days: ["Mon"], startTime: 900, endTime: 1000 })]);
    const b = section("B-1", [meeting({ days: ["Mon"], startTime: 1000, endTime: 1100 })]);
    expect(sectionsHaveConflict(a, b)).toBe(false);
  });
  it("checks every meeting pair", () => {
    const a = section("A-1", [
      meeting({ days: ["Mon"], startTime: 900, endTime: 1000 }),
      meeting({ days: ["Wed"], startTime: 1300, endTime: 1400 }),
    ]);
    const b = section("B-1", [meeting({ days: ["Wed"], startTime: 1330, endTime: 1430 })]);
    expect(sectionsHaveConflict(a, b)).toBe(true);
  });
});

describe("resolveCurrentSection", () => {
  const sectionA = section("CPRG306-A");
  const sectionB = section("CPRG306-B");
  const groups = new Map([["CPRG306", [sectionA, sectionB]]]);

  const reg: CurrentRegistration = {
    subjectCourse: "CPRG306",
    currentSection: sectionA,
    isIncluded: true,
  };
  const regs = new Map([["CPRG306", reg]]);

  it("returns currentSection when no override", () => {
    expect(resolveCurrentSection("CPRG306", regs, new Map(), groups)?.identifier).toBe("CPRG306-A");
  });
  it("returns override section when set", () => {
    const overrides = new Map([["CPRG306", "CPRG306-B"]]);
    expect(resolveCurrentSection("CPRG306", regs, overrides, groups)?.identifier).toBe("CPRG306-B");
  });
  it("returns undefined when course not registered", () => {
    expect(resolveCurrentSection("OTHER", regs, new Map(), groups)).toBeUndefined();
  });
  it("returns undefined when override identifier is unknown", () => {
    const overrides = new Map([["CPRG306", "CPRG306-Z"]]);
    expect(resolveCurrentSection("CPRG306", regs, overrides, groups)).toBeUndefined();
  });
});
