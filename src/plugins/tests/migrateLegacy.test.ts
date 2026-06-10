import { beforeEach, describe, expect, it } from "vitest";
import { migrateLegacy } from "../migrateLegacy";

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  };
}

function readV2(storage: Storage, key: string): unknown {
  const raw = storage.getItem(`sait-sb-v2:${key}`);
  if (raw === null) return null;
  const envelope = JSON.parse(raw);
  expect(envelope.v).toBe(1);
  return envelope.data;
}

// Fixtures mirror the exact shapes the pre-rewrite app persisted.
const LEGACY_RULES = {
  earliestStart: "0800",
  latestEnd: "2100",
  freeDays: ["Fri"],
  requireOpenSeats: true,
  sectionPrefixes: "A,B",
};

const LEGACY_SAVED = {
  "202540": [
    {
      id: "abc123",
      termCode: "202540",
      savedAt: 1748000000000,
      name: "Plan A",
      picks: [{ subjectCourse: "CPRG306", identifier: "CPRG306-A" }],
    },
  ],
};

describe("migrateLegacy", () => {
  let storage: Storage;
  beforeEach(() => {
    storage = memoryStorage();
  });

  it("translates every v1 key into a v2 envelope and removes the originals", () => {
    storage.setItem("sait-sb-v1:term", JSON.stringify("202540"));
    storage.setItem("sait-sb-v1:rules", JSON.stringify(LEGACY_RULES));
    storage.setItem(
      "sait-sb-v1:selectionSlots",
      JSON.stringify({ "202540": ["CPRG306", "MATH238"], "202610": ["PHIL241"] }),
    );
    storage.setItem(
      "sait-sb-v1:pinnedSections",
      JSON.stringify({ "202540": { CPRG306: "12345" } }),
    );
    storage.setItem(
      "sait-sb-v1:currentRegSlots",
      JSON.stringify({
        "202540": { sectionOverrides: [["CPRG306", "CPRG306-B"]], includedCourses: ["CPRG306"] },
      }),
    );
    storage.setItem("sait-sb-v1:savedSchedules", JSON.stringify(LEGACY_SAVED));
    storage.setItem("sait-sb-theme", "plum-dark");

    migrateLegacy(storage);

    expect(readV2(storage, "term")).toBe("202540");
    expect(readV2(storage, "rules")).toEqual(LEGACY_RULES);
    expect(readV2(storage, "selection")).toEqual({
      "202540": { courses: ["CPRG306", "MATH238"], pinned: { CPRG306: "12345" } },
      "202610": { courses: ["PHIL241"], pinned: {} },
    });
    expect(readV2(storage, "current")).toEqual({
      "202540": { overrides: { CPRG306: "CPRG306-B" }, included: ["CPRG306"] },
    });
    expect(readV2(storage, "saved")).toEqual(LEGACY_SAVED);
    expect(readV2(storage, "theme")).toBe("plum-dark");

    for (const key of [
      "sait-sb-v1:term",
      "sait-sb-v1:rules",
      "sait-sb-v1:selectionSlots",
      "sait-sb-v1:pinnedSections",
      "sait-sb-v1:currentRegSlots",
      "sait-sb-v1:savedSchedules",
      "sait-sb-theme",
    ]) {
      expect(storage.getItem(key)).toBeNull();
    }
  });

  it("attributes pre-slot (v0) selection and current keys to the persisted term", () => {
    storage.setItem("sait-sb-v1:term", JSON.stringify("202610"));
    storage.setItem("sait-sb-v1:selectedCourses", JSON.stringify(["CPRG306"]));
    storage.setItem(
      "sait-sb-v1:currentReg",
      JSON.stringify({ sectionOverrides: [["MATH238", "MATH238-C"]], includedCourses: [] }),
    );

    migrateLegacy(storage);

    expect(readV2(storage, "selection")).toEqual({
      "202610": { courses: ["CPRG306"], pinned: {} },
    });
    expect(readV2(storage, "current")).toEqual({
      "202610": { overrides: { MATH238: "MATH238-C" }, included: [] },
    });
    expect(storage.getItem("sait-sb-v1:selectedCourses")).toBeNull();
    expect(storage.getItem("sait-sb-v1:currentReg")).toBeNull();
  });

  it("is idempotent and never overwrites existing v2 data", () => {
    storage.setItem("sait-sb-v2:term", JSON.stringify({ v: 1, data: "202620" }));
    storage.setItem("sait-sb-v1:term", JSON.stringify("202540"));

    migrateLegacy(storage);
    migrateLegacy(storage);

    expect(readV2(storage, "term")).toBe("202620");
    expect(storage.getItem("sait-sb-v1:term")).toBeNull();
  });

  it("skips corrupt legacy payloads without writing v2 keys", () => {
    storage.setItem("sait-sb-v1:rules", "{not json");
    storage.setItem("sait-sb-v1:selectionSlots", JSON.stringify(["wrong", "shape"]));

    migrateLegacy(storage);

    expect(storage.getItem("sait-sb-v2:rules")).toBeNull();
    expect(storage.getItem("sait-sb-v2:selection")).toBeNull();
    expect(storage.getItem("sait-sb-v1:rules")).toBeNull();
  });

  it("writes nothing when storage is empty", () => {
    migrateLegacy(storage);
    expect(storage.length).toBe(0);
  });
});
