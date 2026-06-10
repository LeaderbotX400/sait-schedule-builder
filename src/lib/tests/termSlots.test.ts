import { describe, expect, it } from "vitest";
import { ref } from "vue";
import { createTermSlots } from "../termSlots";

function setup() {
  const term = ref("202540");
  const slots = createTermSlots<Set<string>>({
    term: () => term.value,
    empty: () => new Set(),
  });
  return { term, slots };
}

describe("createTermSlots", () => {
  it("exposes a reference-stable empty value for missing slots", () => {
    const { slots } = setup();
    const a = slots.active.value;
    const b = slots.get("999999");
    expect(a.size).toBe(0);
    expect(b).toBe(a);
  });

  it("write targets one term and replaces the map immutably", () => {
    const { slots } = setup();
    const before = slots.slots.value;
    slots.write("202540", new Set(["CPRG306"]));
    expect(slots.slots.value).not.toBe(before);
    expect(slots.active.value.has("CPRG306")).toBe(true);
    expect(slots.get("202610").size).toBe(0);
  });

  it("active follows the term source", () => {
    const { term, slots } = setup();
    slots.write("202540", new Set(["CPRG306"]));
    slots.write("202610", new Set(["MATH238"]));
    expect([...slots.active.value]).toEqual(["CPRG306"]);
    term.value = "202610";
    expect([...slots.active.value]).toEqual(["MATH238"]);
  });

  it("update defaults to the active term and passes the previous slot", () => {
    const { slots } = setup();
    slots.update((prev) => new Set(prev).add("CPRG306"));
    slots.update((prev) => new Set(prev).add("MATH238"));
    expect([...slots.active.value].sort()).toEqual(["CPRG306", "MATH238"]);
  });

  it("update can target another term explicitly", () => {
    const { slots } = setup();
    slots.update((prev) => new Set(prev).add("PHIL241"), "202610");
    expect(slots.active.value.size).toBe(0);
    expect([...slots.get("202610")]).toEqual(["PHIL241"]);
  });

  it("clear removes only the targeted slot", () => {
    const { slots } = setup();
    slots.write("202540", new Set(["CPRG306"]));
    slots.write("202610", new Set(["MATH238"]));
    slots.clear();
    expect(slots.active.value.size).toBe(0);
    expect(slots.get("202610").size).toBe(1);
  });

  it("clear of a missing slot does not touch the map reference", () => {
    const { slots } = setup();
    const before = slots.slots.value;
    slots.clear("999999");
    expect(slots.slots.value).toBe(before);
  });

  it("setAll replaces everything (hydration)", () => {
    const { slots } = setup();
    slots.write("202540", new Set(["OLD"]));
    slots.setAll(new Map([["202610", new Set(["NEW"])]]));
    expect(slots.get("202540").size).toBe(0);
    expect([...slots.get("202610")]).toEqual(["NEW"]);
  });
});
