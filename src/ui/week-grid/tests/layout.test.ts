import { describe, expect, it } from "vitest";
import { ref } from "vue";
import { useWeekGridLayout, type WeekGridEvent } from "../useWeekGridLayout";

function ev(day: WeekGridEvent["day"], startTime: number, endTime: number): WeekGridEvent {
  return { id: `${day}-${startTime}`, day, startTime, endTime, meta: undefined };
}

describe("useWeekGridLayout", () => {
  it("falls back to 8–21 with weekdays when there are no events", () => {
    const layout = useWeekGridLayout({ events: [] });
    expect(layout.hours.value[0]).toBe(8);
    expect(layout.hours.value.at(-1)).toBe(20); // last row covers 20:00–21:00
    expect(layout.days.value).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri"]);
  });

  it("fits the hour range to the events when no base range is given", () => {
    const layout = useWeekGridLayout({
      events: [ev("Mon", 930, 1050), ev("Wed", 1400, 1550)],
    });
    expect(layout.hours.value[0]).toBe(9);
    expect(layout.hours.value.at(-1)).toBe(15); // ceil(1550) = 16 → last row 15
  });

  it("expands a fixed base range to cover out-of-range events", () => {
    const layout = useWeekGridLayout({
      events: [ev("Mon", 600, 700), ev("Tue", 2100, 2250)],
      baseHours: { startHour: 7, endHour: 22 },
    });
    expect(layout.hours.value[0]).toBe(6);
    expect(layout.hours.value.at(-1)).toBe(22); // ceil(2250) = 23 → last row 22
  });

  it("adds weekend days only in auto mode and only when events fall on them", () => {
    const events = [ev("Mon", 900, 1000), ev("Sat", 1000, 1100)];
    expect(useWeekGridLayout({ events, weekendMode: "auto" }).days.value).toEqual([
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
    ]);
    expect(useWeekGridLayout({ events, weekendMode: "never" }).days.value).toEqual([
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
    ]);
  });

  it("positions blocks relative to the grid start", () => {
    const layout = useWeekGridLayout({
      events: [ev("Mon", 900, 1000)],
      baseHours: { startHour: 8, endHour: 18 },
      hourHeightRem: 4,
    });
    // 9:30–10:45 starts 1.5h after the 8:00 grid start.
    expect(layout.topRem(930)).toBe(6);
    expect(layout.heightRem(930, 1045)).toBe(5);
    expect(layout.blockStyle({ startTime: 930, endTime: 1045 })).toEqual({
      top: "6rem",
      height: "5rem",
    });
    expect(layout.totalHeightRem.value).toBe(40);
    expect(layout.hourTopRem(2)).toBe(8);
  });

  it("groups events by visible day and reacts to source changes", () => {
    const events = ref([ev("Mon", 900, 1000), ev("Sun", 900, 1000)]);
    const layout = useWeekGridLayout({ events, weekendMode: "never" });
    expect(layout.eventsByDay.value.get("Mon")).toHaveLength(1);
    expect(layout.eventsByDay.value.has("Sun")).toBe(false); // weekends hidden

    events.value = [...events.value, ev("Mon", 1100, 1200)];
    expect(layout.eventsByDay.value.get("Mon")).toHaveLength(2);
  });
});
