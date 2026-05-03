import { describe, expect, it } from "vitest";
import { createEmptyBlockout, DEFAULT_RULES } from "../blockout";
import { generateSchedules } from "../scheduler";
import type { CourseSection, MeetingBlock, ScheduleRules } from "../types";

function meeting(over: Partial<MeetingBlock> = {}): MeetingBlock {
  return {
    days: ["Mon"],
    startTime: 900,
    endTime: 1000,
    building: "B",
    room: "1",
    campus: "MAIN",
    campusDescription: "Main",
    type: "Lecture",
    isOnline: false,
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

const rules: ScheduleRules = { ...DEFAULT_RULES, blockout: createEmptyBlockout() };

describe("generateSchedules", () => {
  it("returns no schedules for an empty input", () => {
    expect(generateSchedules(new Map(), { rules })).toEqual([]);
  });

  it("generates a Cartesian product of one course's sections", () => {
    const groups = new Map([
      [
        "CPRG306",
        [
          section("CPRG306-A", [meeting({ days: ["Mon"], startTime: 900, endTime: 1000 })]),
          section("CPRG306-B", [meeting({ days: ["Tue"], startTime: 900, endTime: 1000 })]),
        ],
      ],
    ]);
    const result = generateSchedules(groups, { rules });
    expect(result).toHaveLength(2);
  });

  it("rejects pairwise time conflicts", () => {
    const groups = new Map([
      [
        "CPRG306",
        [section("CPRG306-A", [meeting({ days: ["Mon"], startTime: 900, endTime: 1000 })])],
      ],
      [
        "CPRG307",
        [section("CPRG307-A", [meeting({ days: ["Mon"], startTime: 930, endTime: 1100 })])],
      ],
    ]);
    expect(generateSchedules(groups, { rules })).toEqual([]);
  });

  it("respects free-day rules (drops sections that meet on free days)", () => {
    const r: ScheduleRules = { ...rules, freeDays: ["Mon"] };
    const groups = new Map([
      [
        "CPRG306",
        [section("CPRG306-A", [meeting({ days: ["Mon"], startTime: 900, endTime: 1000 })])],
      ],
    ]);
    expect(generateSchedules(groups, { rules: r })).toEqual([]);
  });

  it("respects earliestStart and latestEnd", () => {
    const r: ScheduleRules = { ...rules, earliestStart: "1000", latestEnd: "1500" };
    const groups = new Map([
      [
        "CPRG306",
        [
          section("CPRG306-A", [meeting({ startTime: 800, endTime: 900 })]),
          section("CPRG306-B", [meeting({ startTime: 1000, endTime: 1100 })]),
        ],
      ],
    ]);
    const result = generateSchedules(groups, { rules: r });
    expect(result).toHaveLength(1);
    expect(result[0]?.courses[0]?.identifier).toBe("CPRG306-B");
  });

  it("returns valid combos sorted by score (highest first)", () => {
    const groups = new Map([
      [
        "A",
        [
          section("A-1", [meeting({ days: ["Mon"], startTime: 900, endTime: 1000 })]),
          section("A-2", [meeting({ days: ["Tue"], startTime: 900, endTime: 1000 })]),
        ],
      ],
      [
        "B",
        [
          section("B-1", [meeting({ days: ["Mon"], startTime: 1100, endTime: 1200 })]),
          section("B-2", [meeting({ days: ["Wed"], startTime: 900, endTime: 1000 })]),
        ],
      ],
    ]);
    const result = generateSchedules(groups, { rules });
    expect(result.length).toBeGreaterThan(0);
    for (let i = 0; i < result.length - 1; i++) {
      const a = result[i];
      const b = result[i + 1];
      if (a && b) expect(a.qualityScore).toBeGreaterThanOrEqual(b.qualityScore);
    }
  });

  it("limits result count when limit is set", () => {
    const groups = new Map([
      [
        "A",
        [
          section("A-1", [meeting({ days: ["Mon"] })]),
          section("A-2", [meeting({ days: ["Tue"] })]),
        ],
      ],
      [
        "B",
        [
          section("B-1", [meeting({ days: ["Wed"] })]),
          section("B-2", [meeting({ days: ["Thu"] })]),
        ],
      ],
    ]);
    expect(generateSchedules(groups, { rules, limit: 2 })).toHaveLength(2);
  });
});
