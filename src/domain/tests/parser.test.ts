import { describe, expect, it } from "vitest";
import type { ActiveRegistration, BannerMeetingTime } from "../../lib/types";
import { parseActiveRegistrations } from "../parser";

function meetingTime(over: Partial<BannerMeetingTime> = {}): BannerMeetingTime {
  return {
    beginTime: "0900",
    building: "B",
    buildingDescription: "Building",
    campus: "MC",
    campusDescription: "Main Campus",
    category: "01",
    class: "net.hedtech.banner.general.overall.MeetingTimeDecorator",
    courseReferenceNumber: "10000",
    creditHourSession: 3,
    endDate: "12/17/2026",
    endTime: "1000",
    friday: false,
    hoursWeek: 3,
    meetingScheduleType: "L",
    meetingType: "CLAS",
    meetingTypeDescription: "Class",
    monday: true,
    room: "101",
    saturday: false,
    startDate: "09/01/2026",
    sunday: false,
    term: "202620",
    thursday: false,
    tuesday: false,
    wednesday: false,
    ...over,
  };
}

function registration(over: Partial<ActiveRegistration> = {}): ActiveRegistration {
  return {
    subject: "CPRG",
    courseNumber: "306",
    courseTitle: "Programming",
    courseReferenceNumber: "10000",
    sequenceNumber: "A",
    campusDescription: "Main Campus",
    creditHour: 3,
    instructionalMethodDescription: "In Person",
    meetingTimes: [meetingTime()],
    faculty: [],
    instructorNames: [],
    courseRegistrationStatusDescription: "Web Registered",
    ...over,
  };
}

describe("parseActiveRegistrations", () => {
  it("drops Sponsored placements", () => {
    const result = parseActiveRegistrations([
      registration({ courseRegistrationStatusDescription: "Registered-Sponsored" }),
    ]);
    expect(result.size).toBe(0);
  });

  it("keeps Web Registered, Registered, and Web Add statuses", () => {
    const result = parseActiveRegistrations([
      registration({ subject: "A", courseRegistrationStatusDescription: "Web Registered" }),
      registration({ subject: "B", courseRegistrationStatusDescription: "Registered" }),
      registration({ subject: "C", courseRegistrationStatusDescription: "Web Add" }),
    ]);
    expect(result.size).toBe(3);
  });

  describe("term filter", () => {
    it("returns all active registrations when termCode is undefined", () => {
      const result = parseActiveRegistrations([
        registration({ subject: "A", meetingTimes: [meetingTime({ term: "202620" })] }),
        registration({ subject: "B", meetingTimes: [meetingTime({ term: "202540" })] }),
      ]);
      expect(result.size).toBe(2);
    });

    it("keeps only registrations whose meetingTimes include the term", () => {
      const result = parseActiveRegistrations(
        [
          registration({ subject: "A", meetingTimes: [meetingTime({ term: "202620" })] }),
          registration({ subject: "B", meetingTimes: [meetingTime({ term: "202540" })] }),
        ],
        "202620",
      );
      expect(result.size).toBe(1);
      expect(result.has("A306")).toBe(true);
    });

    it("keeps registrations with no meeting times (online/independent-study — term unknown, assume it belongs)", () => {
      const result = parseActiveRegistrations(
        [registration({ subject: "A", meetingTimes: [] })],
        "202620",
      );
      expect(result.size).toBe(1);
    });

    it("keeps registrations whose meetingTimes have no term field (Banner omitted it)", () => {
      const result = parseActiveRegistrations(
        [registration({ subject: "A", meetingTimes: [meetingTime({ term: "" })] })],
        "202620",
      );
      expect(result.size).toBe(1);
    });

    it("keeps a registration if any meetingTime matches the term", () => {
      const result = parseActiveRegistrations(
        [
          registration({
            subject: "A",
            meetingTimes: [
              meetingTime({ term: "202540" }),
              meetingTime({ term: "202620", tuesday: true, monday: false }),
            ],
          }),
        ],
        "202620",
      );
      expect(result.size).toBe(1);
    });
  });
});
