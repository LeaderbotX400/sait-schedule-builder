import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createBannerSdk } from "@/banner-sdk/facade";
import { MockTransport } from "@/banner-sdk/transport/mock";
import type { BannerResponse, BannerSection } from "@/lib/types";
import { useCatalogStore } from "@/features/catalog/store";
import { useCurrentRegStore } from "@/features/current/store";
import { useSchedulesStore } from "@/features/schedules/store";
import { useSelectionStore } from "@/features/selection/store";
import { useTermStore } from "@/features/term/store";
import { useUiStore } from "@/features/ui-state/store";
import { _setSdkForTesting } from "@/lib/sdk";
import {
  addSearchResults,
  loadSavedSchedule,
  removeCourse,
  switchTerm,
} from "../actions";

function makeBannerSection(over: Partial<BannerSection> = {}): BannerSection {
  return {
    id: 1,
    term: "202540",
    termDesc: "Spring 2026",
    courseReferenceNumber: "10000",
    partOfTerm: "1",
    courseNumber: "306",
    courseDisplay: "CPRG 306",
    subject: "CPRG",
    subjectDescription: "Programming",
    sequenceNumber: "A",
    campusDescription: "Main Campus",
    scheduleTypeDescription: "Lecture",
    courseTitle: "Programming Principles",
    creditHours: 3,
    maximumEnrollment: 30,
    enrollment: 25,
    seatsAvailable: 5,
    waitCapacity: 0,
    waitCount: 0,
    waitAvailable: 0,
    crossList: null,
    crossListCapacity: null,
    crossListCount: null,
    crossListAvailable: null,
    creditHourHigh: null,
    creditHourLow: null,
    creditHourIndicator: null,
    openSection: true,
    linkIdentifier: null,
    isSectionLinked: false,
    subjectCourse: "CPRG306",
    faculty: [],
    meetingsFaculty: [],
    reservedSeatSummary: null,
    sectionAttributes: [],
    instructionalMethod: "F",
    instructionalMethodDescription: "In Person",
    ...over,
  };
}

function response(...data: BannerSection[]): BannerResponse {
  return { success: true, totalCount: data.length, data };
}

describe("planner actions", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    _setSdkForTesting(null);
  });

  describe("addSearchResults", () => {
    it("merges into the catalog, unions the selection, and resets schedules", () => {
      const catalog = useCatalogStore();
      const selection = useSelectionStore();

      expect(addSearchResults(response(makeBannerSection()))).toBe(1);
      expect(
        addSearchResults(
          response(
            makeBannerSection({
              subject: "MATH",
              courseNumber: "240",
              subjectCourse: "MATH240",
              courseReferenceNumber: "10001",
            }),
          ),
        ),
      ).toBe(1);

      expect(catalog.courseGroups.size).toBe(2);
      expect(selection.selectedCourses.has("CPRG306")).toBe(true);
      expect(selection.selectedCourses.has("MATH240")).toBe(true);
    });

    it("reports a friendly error when Banner returns no sections", () => {
      const ui = useUiStore();
      expect(addSearchResults(response())).toBe(0);
      expect(ui.loadError).toContain("no course sections");
    });
  });

  describe("removeCourse", () => {
    it("removes the course from every dependent store", () => {
      const catalog = useCatalogStore();
      const selection = useSelectionStore();
      const currentReg = useCurrentRegStore();

      addSearchResults(response(makeBannerSection()));
      selection.pin("CPRG306", "10000");
      currentReg.initializeFromGroups(catalog.courseGroups);
      expect(currentReg.currentRegistrations.has("CPRG306")).toBe(true);

      removeCourse("CPRG306");

      expect(catalog.courseGroups.has("CPRG306")).toBe(false);
      expect(selection.selectedCourses.has("CPRG306")).toBe(false);
      expect(selection.pinnedSections.has("CPRG306")).toBe(false);
      expect(currentReg.currentRegistrations.has("CPRG306")).toBe(false);
    });
  });

  describe("switchTerm", () => {
    function mockSdk(): MockTransport {
      const transport = new MockTransport()
        .on(/classSearch\/getTerms/, {
          ok: true,
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            { code: "202540", description: "Spring 2026" },
            { code: "202610", description: "Fall 2026" },
          ]),
        })
        .on(/renderActiveRegistrations/, {
          ok: true,
          status: 200,
          contentType: "application/json",
          body: "[]",
        })
        .on(/searchResults\/searchResults/, (call) => {
          const code = new URL(call.url).searchParams.get("txt_subjectcoursecombo") ?? "";
          const data =
            code === "MATH240"
              ? [
                  makeBannerSection({
                    subject: "MATH",
                    courseNumber: "240",
                    subjectCourse: "MATH240",
                    courseReferenceNumber: "10001",
                    term: "202610",
                  }),
                ]
              : [];
          return {
            ok: true,
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(response(...data)),
          };
        });
      _setSdkForTesting(createBannerSdk(transport));
      return transport;
    }

    it("swaps slots, wipes derived schedules, and revalidates the target term's selection", async () => {
      mockSdk();
      const term = useTermStore();
      const catalog = useCatalogStore();
      const selection = useSelectionStore();
      const schedules = useSchedulesStore();
      const ui = useUiStore();

      term.set("202540");
      catalog.setCourseGroups(new Map([["CPRG306", []]]));
      selection.setSelectedCourses(new Set(["CPRG306"]));
      schedules.setSchedules([{ id: 1 } as never]);
      ui.setLoadError("stale error");

      // Seed a persisted planning slot for the target term: MATH240 still
      // offered, GONE101 dropped by Banner.
      selection.setAll(
        new Map([
          ["202540", { courses: new Set(["CPRG306"]), pinned: new Map() }],
          ["202610", { courses: new Set(["MATH240", "GONE101"]), pinned: new Map() }],
        ]),
      );

      await switchTerm("202610");

      expect(term.term).toBe("202610");
      expect(schedules.schedules).toHaveLength(0);
      expect(ui.loadError).toBeNull();
      // Revalidation kept the offered course and dropped the missing one.
      expect(catalog.courseGroups.has("MATH240")).toBe(true);
      expect([...selection.selectedCourses]).toEqual(["MATH240"]);
      expect(ui.slotWarnings).toEqual([{ kind: "course-dropped", subjectCourse: "GONE101" }]);

      // The original term's slot is untouched.
      expect([...selection.slots.get("202540")!.courses]).toEqual(["CPRG306"]);
    });

    it("is a no-op for the already-active term", async () => {
      const term = useTermStore();
      term.set("202540");
      const schedules = useSchedulesStore();
      schedules.setSchedules([{ id: 1 } as never]);

      await switchTerm("202540"); // no SDK mock — must not hit the wire

      expect(schedules.schedules).toHaveLength(1);
    });
  });

  describe("loadSavedSchedule", () => {
    it("re-fetches, rehydrates, regenerates, and seeks the best-matching schedule", async () => {
      const transport = new MockTransport().on(/searchResults\/searchResults/, (call) => {
        const code = new URL(call.url).searchParams.get("txt_subjectcoursecombo") ?? "";
        const data =
          code === "CPRG306"
            ? [
                makeBannerSection(),
                makeBannerSection({ sequenceNumber: "B", courseReferenceNumber: "10002" }),
              ]
            : [];
        return {
          ok: true,
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(response(...data)),
        };
      });
      _setSdkForTesting(createBannerSdk(transport));

      useTermStore().set("202540");
      const schedules = useSchedulesStore();

      await loadSavedSchedule({
        id: "saved1",
        termCode: "202540",
        savedAt: 0,
        picks: [{ subjectCourse: "CPRG306", identifier: "CPRG306-B" }],
      });

      expect(useCatalogStore().courseGroups.has("CPRG306")).toBe(true);
      expect([...useSelectionStore().selectedCourses]).toEqual(["CPRG306"]);
      expect(schedules.schedules.length).toBeGreaterThan(0);
      // Best-match seek lands on the schedule containing the saved pick.
      const active = schedules.schedules[schedules.activeScheduleIndex]!;
      expect(active.courses.some((c) => c.identifier === "CPRG306-B")).toBe(true);
    });

    it("degrades to an empty result when every course fetch fails", async () => {
      _setSdkForTesting(
        createBannerSdk(
          new MockTransport().on(/searchResults/, {
            ok: false,
            status: 500,
            contentType: "application/json",
            body: "{}",
          }),
        ),
      );
      useTermStore().set("202540");

      await loadSavedSchedule({
        id: "saved1",
        termCode: "202540",
        savedAt: 0,
        picks: [{ subjectCourse: "CPRG306", identifier: "CPRG306-A" }],
      });

      // byCourses degrades per-code, so the failure surfaces as zero results
      // and the planner lands in an explicit empty state instead of crashing.
      expect(useSchedulesStore().generationStatus.kind).toBe("empty");
      expect(useSelectionStore().selectedCourses.size).toBe(0);
    });
  });
});
