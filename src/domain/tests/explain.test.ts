import { describe, expect, it } from "vitest";
import { createEmptyBlockout, DEFAULT_RULES } from "../blockout";
import { explainEmpty } from "../explain";
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

describe("explainEmpty", () => {
  it("falls back to the generic conflict message with no pins", () => {
    const filtered = new Map([
      ["CPRG306", [section("CPRG306-A", [meeting({ startTime: 900, endTime: 1000 })])]],
      ["CPRG307", [section("CPRG307-A", [meeting({ startTime: 930, endTime: 1100 })])]],
    ]);
    expect(explainEmpty(filtered, rules)).toMatch(/time conflict/i);
  });

  it("names the locked section and the course it conflicts with", () => {
    const filtered = new Map([
      ["CPRG306", [section("CPRG306-A", [meeting({ startTime: 900, endTime: 1000 })])]],
      ["CPRG307", [section("CPRG307-A", [meeting({ startTime: 930, endTime: 1100 })])]],
    ]);
    const pinnedCrns = new Map([["CPRG306", "CPRG306-A"]]);
    const msg = explainEmpty(filtered, rules, pinnedCrns);
    expect(msg).toContain("CPRG306-A");
    expect(msg).toContain("CPRG307");
    expect(msg).toMatch(/partial schedules/i);
  });

  it("reports a conflict between two locked sections", () => {
    const filtered = new Map([
      ["CPRG306", [section("CPRG306-A", [meeting({ startTime: 900, endTime: 1000 })])]],
      ["CPRG307", [section("CPRG307-A", [meeting({ startTime: 930, endTime: 1100 })])]],
    ]);
    const pinnedCrns = new Map([
      ["CPRG306", "CPRG306-A"],
      ["CPRG307", "CPRG307-A"],
    ]);
    const msg = explainEmpty(filtered, rules, pinnedCrns);
    expect(msg).toContain("CPRG306-A");
    expect(msg).toContain("CPRG307-A");
    expect(msg).toMatch(/unlock/i);
  });

  it("prefers rule-based reasons over the lock message", () => {
    // Free-day rule filters everything — that explanation should win.
    const r: ScheduleRules = { ...rules, freeDays: ["Mon"] };
    const filtered = new Map([
      ["CPRG306", [section("CPRG306-A", [meeting({ days: ["Mon"], startTime: 900, endTime: 1000 })])]],
    ]);
    const pinnedCrns = new Map([["CPRG306", "CPRG306-A"]]);
    expect(explainEmpty(filtered, r, pinnedCrns)).toMatch(/free days/i);
  });
});
