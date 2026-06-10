import { describe, expect, it } from "vitest";
import type { MeetingBlock } from "@/domain/types";
import {
  daysLabel,
  meetingsSummary,
  meetingSummary,
  seatsLabel,
  sectionsLabel,
  timeRangeLabel,
  totalSeats,
} from "../format";

function meeting(partial: Partial<MeetingBlock> = {}): MeetingBlock {
  return {
    days: ["Mon", "Wed"],
    startTime: 1400,
    endTime: 1550,
    building: "NN",
    room: "701",
    campus: "MC",
    campusDescription: "Main Campus",
    type: "CLAS",
    isOnline: false,
    ...partial,
  };
}

describe("course format helpers", () => {
  it("daysLabel joins day runs compactly", () => {
    expect(daysLabel(["Mon", "Wed", "Fri"])).toBe("MonWedFri");
  });

  it("timeRangeLabel uses compact 12-hour times", () => {
    expect(timeRangeLabel({ startTime: 1400, endTime: 1550 })).toBe("2:00PM–3:50PM");
    expect(timeRangeLabel({ startTime: 800, endTime: 950 })).toBe("8:00AM–9:50AM");
  });

  it("meetingSummary combines days and times", () => {
    expect(meetingSummary(meeting())).toBe("MonWed 2:00PM–3:50PM");
  });

  it("meetingSummary labels day-less online blocks", () => {
    expect(meetingSummary(meeting({ days: [], isOnline: true }))).toBe("Online");
    expect(meetingSummary(meeting({ days: [], isOnline: false }))).toBe("—");
  });

  it("meetingsSummary joins all meetings or falls back to a dash", () => {
    expect(
      meetingsSummary({
        meetings: [meeting(), meeting({ days: ["Fri"], startTime: 900, endTime: 950 })],
      }),
    ).toBe("MonWed 2:00PM–3:50PM, Fri 9:00AM–9:50AM");
    expect(meetingsSummary({ meetings: [] })).toBe("—");
  });

  it("totalSeats sums and seat/section labels pluralize", () => {
    expect(totalSeats([{ seatsAvailable: 3 }, { seatsAvailable: 1 }])).toBe(4);
    expect(seatsLabel(1)).toBe("1 seat");
    expect(seatsLabel(0)).toBe("0 seats");
    expect(sectionsLabel(1)).toBe("1 section");
    expect(sectionsLabel(2)).toBe("2 sections");
  });
});
