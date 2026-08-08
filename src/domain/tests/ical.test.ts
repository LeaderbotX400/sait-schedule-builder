import { describe, expect, it } from "vitest";
import { generateICal } from "../ical";
import type { CourseSection, MeetingBlock, Schedule } from "../types";

function meeting(over: Partial<MeetingBlock> = {}): MeetingBlock {
  return {
    days: ["Tue"],
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

function section(over: Partial<CourseSection> = {}): CourseSection {
  return {
    identifier: "CPRG306-A",
    subjectCourse: "CPRG306",
    title: "Programming",
    crn: "12345",
    instructor: "Jane Doe",
    sequenceNumber: "A",
    seatsAvailable: 5,
    maximumEnrollment: 30,
    enrollment: 25,
    meetings: [meeting()],
    creditHours: 3,
    instructionalMethod: "Lecture",
    ...over,
  };
}

function schedule(courses: CourseSection[]): Schedule {
  return {
    id: 1,
    qualityScore: 100,
    warnings: [],
    courses,
    daysUsed: [],
    daysCount: 0,
    onCampusDays: [],
    onCampusDaysCount: 0,
    onCampusPerDay: {},
    earlyMorningPenalty: 0,
    travelTimePenalty: 0,
    isPartial: false,
    omittedCourses: [],
    blockoutFitScore: 100,
  };
}

/** Pull out a single named property line's value from a VEVENT block, e.g. "DTSTART". */
function veventField(ics: string, field: string): string | undefined {
  const line = ics.split("\r\n").find((l) => l.startsWith(`${field}`));
  return line?.split(":").slice(1).join(":");
}

describe("generateICal", () => {
  it("uses the meeting's own startDate as the recurrence anchor when it falls on the target weekday", () => {
    // 2026-09-01 is a Tuesday.
    const ics = generateICal(
      schedule([section({ meetings: [meeting({ days: ["Tue"], startDate: "2026-09-01" })] })]),
    );
    expect(veventField(ics, "DTSTART")).toContain("20260901T");
  });

  it("finds the first occurrence of the weekday on/after startDate regardless of what weekday startDate itself is", () => {
    // 2026-09-01 is a Tuesday; the first Monday on/after it is 2026-09-07.
    const ics = generateICal(
      schedule([section({ meetings: [meeting({ days: ["Mon"], startDate: "2026-09-01" })] })]),
    );
    expect(veventField(ics, "DTSTART")).toContain("20260907T");
  });

  it("uses each meeting's own endDate for RRULE UNTIL, not a shared window", () => {
    const ics = generateICal(
      schedule([section({ meetings: [meeting({ endDate: "2026-12-17" })] })]),
    );
    const rrule = veventField(ics, "RRULE");
    expect(rrule).toContain("UNTIL=20261217T235959");
  });

  it("gives independently correct date ranges when a course has multiple meetings on different schedules", () => {
    // Lecture runs the full term; lab only runs the second half.
    const lecture = meeting({ days: ["Tue"], startDate: "2026-09-01", endDate: "2026-12-17" });
    // 2026-11-02 is a Monday; first Wednesday on/after it is 2026-11-04.
    const lab = meeting({ days: ["Wed"], startDate: "2026-11-02", endDate: "2026-12-11" });
    const ics = generateICal(schedule([section({ meetings: [lecture, lab] })]));

    const events = ics.split("BEGIN:VEVENT").slice(1);
    expect(events).toHaveLength(2);

    const lectureEvent = events.find((e) => e.includes("BYDAY=TU"))!;
    expect(lectureEvent).toContain("DTSTART;TZID=America/Edmonton:20260901T");
    expect(lectureEvent).toContain("UNTIL=20261217T235959");

    const labEvent = events.find((e) => e.includes("BYDAY=WE"))!;
    expect(labEvent).toContain("DTSTART;TZID=America/Edmonton:20261104T");
    expect(labEvent).toContain("UNTIL=20261211T235959");
  });

  it("skips a meeting with a missing/unparseable date range instead of emitting invalid dates", () => {
    const ics = generateICal(
      schedule([section({ meetings: [meeting({ startDate: "", endDate: "" })] })]),
    );
    expect(ics).not.toContain("BEGIN:VEVENT");
  });

  it("escapes DESCRIPTION newlines as a single backslash-n, not double-escaped", () => {
    const ics = generateICal(schedule([section({ instructor: "Jane Doe" })]));
    const description = veventField(ics, "DESCRIPTION");
    expect(description).toContain("Instructor: Jane Doe\\nCRN:");
    expect(description).not.toContain("\\\\n");
  });

  it("escapes semicolons, commas, and backslashes exactly once", () => {
    const ics = generateICal(
      schedule([section({ title: "Intro; Systems, Design\\Build" })]),
    );
    const summary = veventField(ics, "SUMMARY");
    expect(summary).toContain("Intro\\; Systems\\, Design\\\\Build");
  });

  it("gives each meeting a unique UID keyed by CRN, day, and start time", () => {
    const ics = generateICal(
      schedule([
        section({
          crn: "12345",
          meetings: [
            meeting({ days: ["Tue"], startTime: 900, endTime: 1000 }),
            meeting({ days: ["Thu"], startTime: 900, endTime: 1000 }),
          ],
        }),
      ]),
    );
    const uids = ics
      .split("\r\n")
      .filter((l) => l.startsWith("UID:"))
      .map((l) => l.slice(4));
    expect(new Set(uids).size).toBe(uids.length);
    expect(uids).toEqual(["12345-Tue-0900@sait-schedule-builder", "12345-Thu-0900@sait-schedule-builder"]);
  });
});
