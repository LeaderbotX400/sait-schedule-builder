import { ALL_DAYS, type BlockoutGrid, GRID_HOURS, type ScheduleRules } from "./types";

export function createEmptyBlockout(): BlockoutGrid {
  const grid = {} as BlockoutGrid;
  for (const day of ALL_DAYS) {
    grid[day] = {};
    for (const hour of GRID_HOURS) {
      grid[day][hour] = "neutral";
    }
  }
  return grid;
}

export const DEFAULT_RULES: ScheduleRules = {
  earliestStart: "0800",
  latestEnd: "2100",
  freeDays: [],
  maxOnCampusDays: 5,
  minTravelGapMinutes: 60,
  preferClusteredCampusDays: true,
  allowPartialSchedules: false,
  maxGapBetweenClasses: 0,
  requireOpenSeats: false,
  sectionPrefixes: "",
  blockout: createEmptyBlockout(),
  blockoutWeight: 50,
};
