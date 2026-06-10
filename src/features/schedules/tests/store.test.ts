import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_RULES } from "@/domain/blockout";
import type { CourseSection } from "@/domain/types";
import type { GenerateInput } from "../executor";
import { useSchedulesStore } from "../store";

function makeSection(id: string, day: "Mon" | "Tue"): CourseSection {
  const subjectCourse = id.split("-")[0] ?? id;
  const sequenceNumber = id.split("-")[1] ?? "A";
  return {
    identifier: id,
    subjectCourse,
    title: id,
    crn: id,
    instructor: "TBA",
    sequenceNumber,
    seatsAvailable: 5,
    maximumEnrollment: 30,
    enrollment: 25,
    meetings: [
      {
        days: [day],
        startTime: 900,
        endTime: 1000,
        building: "B",
        room: "1",
        campus: "MAIN",
        campusDescription: "Main",
        type: "Lecture",
        isOnline: false,
      },
    ],
    creditHours: 3,
    instructionalMethod: "Lecture",
  };
}

function input(courses: Map<string, CourseSection[]>): GenerateInput {
  return { courses, rules: { ...DEFAULT_RULES }, pinnedCrns: new Map() };
}

describe("useSchedulesStore.generate", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("is awaitable and produces schedules for the selected sections", async () => {
    const schedules = useSchedulesStore();

    const result = await schedules.generate(
      input(
        new Map([
          ["A", [makeSection("A-1", "Mon"), makeSection("A-2", "Tue")]],
          ["B", [makeSection("B-1", "Tue"), makeSection("B-2", "Mon")]],
        ]),
      ),
    );

    expect(result.length).toBeGreaterThan(0);
    expect(schedules.schedules).toBe(result);
    expect(schedules.generationStatus).toEqual({ kind: "success", count: result.length });
    expect(schedules.activeScheduleIndex).toBe(0);
  });

  it("emits an 'empty' status with a hint when nothing is selected", async () => {
    const schedules = useSchedulesStore();
    await schedules.generate(input(new Map()));

    expect(schedules.generationStatus.kind).toBe("empty");
    if (schedules.generationStatus.kind === "empty") {
      expect(schedules.generationStatus.reason).toContain("No courses selected");
    }
  });

  it("explains why a non-empty selection produced zero schedules", async () => {
    const schedules = useSchedulesStore();
    const full = { ...makeSection("A-1", "Mon"), seatsAvailable: 0 };

    await schedules.generate({
      courses: new Map([["A", [full]]]),
      rules: { ...DEFAULT_RULES, requireOpenSeats: true },
      pinnedCrns: new Map(),
    });

    expect(schedules.generationStatus.kind).toBe("empty");
    if (schedules.generationStatus.kind === "empty") {
      expect(schedules.generationStatus.reason).toContain("full");
    }
  });

  it("latest-wins: a superseded generate does not overwrite the newer result", async () => {
    const schedules = useSchedulesStore();

    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    schedules._setExecutorForTesting(async () => {
      await gate;
      return [{ id: 99 } as never];
    });
    const stale = schedules.generate(input(new Map([["A", [makeSection("A-1", "Mon")]]])));

    schedules._setExecutorForTesting(null);
    await schedules.generate(input(new Map([["A", [makeSection("A-1", "Mon")]]])));
    const fresh = schedules.schedules;
    expect(schedules.generationStatus.kind).toBe("success");

    release();
    await stale;

    expect(schedules.schedules).toBe(fresh);
    expect(schedules.generationStatus.kind).toBe("success");
  });

  it("surfaces executor failures as an error status", async () => {
    const schedules = useSchedulesStore();
    schedules._setExecutorForTesting(async () => {
      throw new Error("boom");
    });

    await schedules.generate(input(new Map([["A", [makeSection("A-1", "Mon")]]])));

    expect(schedules.generationStatus).toEqual({ kind: "error", message: "boom" });
  });
});
