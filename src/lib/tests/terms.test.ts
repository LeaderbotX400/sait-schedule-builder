import { describe, expect, it } from "vitest";
import { describeTerm, mergeTermOptions, TERM_OPTIONS } from "../terms";

describe("mergeTermOptions", () => {
  it("includes the static TERM_OPTIONS floor when Banner returns an empty list", () => {
    const merged = mergeTermOptions([]);
    expect(merged.map((t) => t.code).sort()).toEqual(TERM_OPTIONS.map((t) => t.code).sort());
  });

  it("adds live terms not in the static list", () => {
    const merged = mergeTermOptions([{ code: "202620", description: "Fall 2026" }]);
    expect(merged.find((t) => t.code === "202620")).toEqual({
      code: "202620",
      description: "Fall 2026",
    });
  });

  it("dedupes by code, preferring the live description when both exist", () => {
    const merged = mergeTermOptions([{ code: "202540", description: "Spring 2026 (live label)" }]);
    const codes = merged.filter((t) => t.code === "202540");
    expect(codes).toHaveLength(1);
    expect(codes[0]?.description).toBe("Spring 2026 (live label)");
  });

  it("sorts newest-first by code", () => {
    const merged = mergeTermOptions([
      { code: "202610", description: "Summer 2026" },
      { code: "202620", description: "Fall 2026" },
      { code: "202630", description: "Winter 2027" },
    ]);
    const codes = merged.map((t) => t.code);
    for (let i = 0; i < codes.length - 1; i++) {
      const a = codes[i];
      const b = codes[i + 1];
      if (a && b) expect(a.localeCompare(b)).toBeGreaterThan(0);
    }
  });
});

describe("describeTerm", () => {
  it("returns null for null/undefined", () => {
    expect(describeTerm(null)).toBeNull();
    expect(describeTerm(undefined)).toBeNull();
  });

  it("falls back to the code when not found in the list", () => {
    expect(describeTerm("999999", [])).toBe("999999");
  });

  it("reads from the supplied list when provided", () => {
    expect(describeTerm("202620", [{ code: "202620", description: "Fall 2026" }])).toBe(
      "Fall 2026",
    );
  });
});
