import { describe, expect, it } from "vitest";
import {
  formatHour,
  formatTime,
  formatTimeCompact,
  formatTimeFromString,
  timeToMinutes,
} from "../time";

describe("timeToMinutes", () => {
  it("converts midnight", () => {
    expect(timeToMinutes(0)).toBe(0);
  });
  it("converts an hour", () => {
    expect(timeToMinutes(100)).toBe(60);
    expect(timeToMinutes(1430)).toBe(870);
    expect(timeToMinutes(2359)).toBe(23 * 60 + 59);
  });
});

describe("formatTime", () => {
  it("formats midnight as 12 AM", () => {
    expect(formatTime(0)).toBe("12:00 AM");
  });
  it("formats noon as 12 PM", () => {
    expect(formatTime(1200)).toBe("12:00 PM");
  });
  it("formats afternoon", () => {
    expect(formatTime(1430)).toBe("2:30 PM");
  });
  it("formats early morning", () => {
    expect(formatTime(800)).toBe("8:00 AM");
  });
  it("zero-pads minutes", () => {
    expect(formatTime(905)).toBe("9:05 AM");
  });
});

describe("formatTimeCompact", () => {
  it("strips the space", () => {
    expect(formatTimeCompact(1430)).toBe("2:30PM");
  });
});

describe("formatTimeFromString", () => {
  it("parses HHMM strings", () => {
    expect(formatTimeFromString("0830")).toBe("8:30 AM");
  });
});

describe("formatHour", () => {
  it("formats midnight", () => {
    expect(formatHour(0)).toBe("12AM");
  });
  it("formats noon", () => {
    expect(formatHour(12)).toBe("12PM");
  });
  it("formats 14 as 2PM", () => {
    expect(formatHour(14)).toBe("2PM");
  });
});
