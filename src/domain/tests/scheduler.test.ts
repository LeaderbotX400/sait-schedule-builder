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

describe("locked sections (pinnedCrns)", () => {
  it("includes the locked section in every schedule (no conflict)", () => {
    const groups = new Map([
      [
        "CPRG306",
        [
          section("CPRG306-A", [meeting({ days: ["Mon"], startTime: 900, endTime: 1000 })]),
          section("CPRG306-B", [meeting({ days: ["Tue"], startTime: 900, endTime: 1000 })]),
        ],
      ],
      ["CPRG307", [section("CPRG307-A", [meeting({ days: ["Wed"], startTime: 900, endTime: 1000 })])]],
    ]);
    const pinnedCrns = new Map([["CPRG306", "CPRG306-A"]]);
    const result = generateSchedules(groups, { rules, pinnedCrns });
    expect(result.length).toBeGreaterThan(0);
    for (const s of result) {
      expect(s.courses.some((c) => c.crn === "CPRG306-A")).toBe(true);
    }
  });

  it("keeps the lock and drops the conflicting course when partials are allowed", () => {
    const r: ScheduleRules = { ...rules, allowPartialSchedules: true };
    const groups = new Map([
      [
        "CPRG306",
        [
          section("CPRG306-A", [meeting({ days: ["Mon"], startTime: 900, endTime: 1000 })]),
          section("CPRG306-B", [meeting({ days: ["Tue"], startTime: 900, endTime: 1000 })]),
        ],
      ],
      ["CPRG307", [section("CPRG307-A", [meeting({ days: ["Mon"], startTime: 930, endTime: 1100 })])]],
    ]);
    const pinnedCrns = new Map([["CPRG306", "CPRG306-A"]]);
    const result = generateSchedules(groups, { rules: r, pinnedCrns });

    expect(result.length).toBeGreaterThan(0);
    for (const s of result) {
      // The lock is always present and never omitted...
      expect(s.courses.some((c) => c.crn === "CPRG306-A")).toBe(true);
      expect(s.omittedCourses.some((o) => o.subjectCourse === "CPRG306")).toBe(false);
    }
    // ...and the conflicting course is the one dropped.
    expect(result.some((s) => s.omittedCourses.some((o) => o.subjectCourse === "CPRG307"))).toBe(
      true,
    );
  });

  it("returns nothing when a lock conflicts and partials are off", () => {
    const groups = new Map([
      ["CPRG306", [section("CPRG306-A", [meeting({ days: ["Mon"], startTime: 900, endTime: 1000 })])]],
      ["CPRG307", [section("CPRG307-A", [meeting({ days: ["Mon"], startTime: 930, endTime: 1100 })])]],
    ]);
    const pinnedCrns = new Map([["CPRG306", "CPRG306-A"]]);
    expect(generateSchedules(groups, { rules, pinnedCrns })).toEqual([]);
  });

  it("returns nothing when two locks conflict, even with partials on", () => {
    const r: ScheduleRules = { ...rules, allowPartialSchedules: true };
    const groups = new Map([
      ["CPRG306", [section("CPRG306-A", [meeting({ days: ["Mon"], startTime: 900, endTime: 1000 })])]],
      ["CPRG307", [section("CPRG307-A", [meeting({ days: ["Mon"], startTime: 930, endTime: 1100 })])]],
    ]);
    const pinnedCrns = new Map([
      ["CPRG306", "CPRG306-A"],
      ["CPRG307", "CPRG307-A"],
    ]);
    expect(generateSchedules(groups, { rules: r, pinnedCrns })).toEqual([]);
  });

  it("omits the course when the locked CRN is no longer offered", () => {
    const groups = new Map([
      ["CPRG306", [section("CPRG306-A", [meeting({ days: ["Mon"], startTime: 900, endTime: 1000 })])]],
      ["CPRG307", [section("CPRG307-A", [meeting({ days: ["Wed"], startTime: 900, endTime: 1000 })])]],
    ]);
    const pinnedCrns = new Map([["CPRG306", "CPRG306-GONE"]]);
    const result = generateSchedules(groups, { rules, pinnedCrns });
    expect(result.length).toBeGreaterThan(0);
    for (const s of result) {
      expect(
        s.omittedCourses.some(
          (o) => o.subjectCourse === "CPRG306" && /no longer available/i.test(o.reason),
        ),
      ).toBe(true);
    }
  });
});

describe("sectionPrefixes filter", () => {
  it("allows everything when sectionPrefixes is empty", () => {
    const groups = new Map([["CPRG306", [section("CPRG306-FVA"), section("CPRG306-SDA")]]]);
    const result = generateSchedules(groups, { rules: { ...rules, sectionPrefixes: "" } });
    expect(result).toHaveLength(2);
  });

  it("keeps only sections whose sequenceNumber starts with the prefix", () => {
    const groups = new Map([
      [
        "CPRG306",
        [
          section("CPRG306-FVA"),
          section("CPRG306-FVB"),
          section("CPRG306-SDA"),
          section("CPRG306-IDA"),
        ],
      ],
    ]);
    const result = generateSchedules(groups, { rules: { ...rules, sectionPrefixes: "FV" } });
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.courses[0]?.sequenceNumber).sort()).toEqual(["FVA", "FVB"]);
  });

  it("accepts multiple comma-separated prefixes", () => {
    const groups = new Map([
      ["CPRG306", [section("CPRG306-FVA"), section("CPRG306-SDA"), section("CPRG306-IDA")]],
    ]);
    const result = generateSchedules(groups, { rules: { ...rules, sectionPrefixes: "FV, SD" } });
    expect(result.map((s) => s.courses[0]?.sequenceNumber).sort()).toEqual(["FVA", "SDA"]);
  });

  it("matches case-insensitively", () => {
    const groups = new Map([["CPRG306", [section("CPRG306-FVA"), section("CPRG306-SDA")]]]);
    const result = generateSchedules(groups, { rules: { ...rules, sectionPrefixes: "fv" } });
    expect(result).toHaveLength(1);
    expect(result[0]?.courses[0]?.sequenceNumber).toBe("FVA");
  });

  it("drops a course entirely when no section matches the prefix", () => {
    const groups = new Map([
      ["CPRG306", [section("CPRG306-FVA")]],
      ["CPRG307", [section("CPRG307-SDA")]],
    ]);
    const result = generateSchedules(groups, { rules: { ...rules, sectionPrefixes: "FV" } });
    expect(result.every((s) => s.omittedCourses.some((o) => o.subjectCourse === "CPRG307"))).toBe(
      true,
    );
  });

  it("exempts single-character sequence numbers from the prefix filter", () => {
    // Real-world case: PROJ309 has sectioned variants (ITB, SDC) but
    // CPRG305 / CPSY300 / ITSC320 have plain "A" / "B" sequences. A user
    // filtering for "ITB" should still get the single-section courses.
    const groups = new Map([
      ["PROJ309", [
        section("PROJ309-ITB", [meeting({ startTime: 900, endTime: 1000 })]),
        section("PROJ309-SDC", [meeting({ startTime: 900, endTime: 1000 })]),
      ]],
      ["CPRG305", [section("CPRG305-A", [meeting({ startTime: 1100, endTime: 1200 })])]],
      ["CPSY300", [section("CPSY300-B", [meeting({ startTime: 1300, endTime: 1400 })])]],
    ]);
    const result = generateSchedules(groups, { rules: { ...rules, sectionPrefixes: "ITB" } });
    expect(result.length).toBeGreaterThan(0);
    for (const s of result) {
      expect(s.omittedCourses).toHaveLength(0);
      const seqs = s.courses.map((c) => c.sequenceNumber).sort();
      expect(seqs).toEqual(["A", "B", "ITB"]);
    }
  });
});
