import { createPinia, defineStore, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp, nextTick, ref, shallowRef } from "vue";
import { codecs, createPersistencePlugin, type PersistSpec } from "../persistence";

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

interface StoreShape {
  value: string;
}

function makeStore(spec: PersistSpec, id = "test") {
  return defineStore(
    id,
    () => {
      const value = ref("default");
      function setValue(v: string): void {
        value.value = v;
      }
      return { value, setValue };
    },
    { persist: spec },
  );
}

const spec: PersistSpec = {
  key: "test",
  version: 1,
  pick: (store) => ({ value: store.value }),
  apply: (store, data) => {
    const d = data as Partial<StoreShape>;
    if (typeof d?.value === "string") store.setValue(d.value);
  },
};

describe("createPersistencePlugin", () => {
  let storage: Storage;
  beforeEach(() => {
    storage = memoryStorage();
    // Pinia only activates plugins once installed into an app.
    const pinia = createPinia().use(createPersistencePlugin(storage));
    createApp({}).use(pinia);
    setActivePinia(pinia);
  });

  it("hydrates synchronously at store creation from a matching envelope", () => {
    storage.setItem("sait-sb-v2:test", JSON.stringify({ v: 1, data: { value: "persisted" } }));
    const store = makeStore(spec)();
    expect(store.value).toBe("persisted");
  });

  it("skips hydration on version mismatch", () => {
    storage.setItem("sait-sb-v2:test", JSON.stringify({ v: 99, data: { value: "future" } }));
    const store = makeStore(spec)();
    expect(store.value).toBe("default");
  });

  it("skips hydration on corrupt JSON", () => {
    storage.setItem("sait-sb-v2:test", "{corrupt");
    const store = makeStore(spec)();
    expect(store.value).toBe("default");
  });

  it("writes an envelope on every mutation", async () => {
    const store = makeStore(spec)();
    store.setValue("changed");
    await nextTick();
    expect(JSON.parse(storage.getItem("sait-sb-v2:test")!)).toEqual({
      v: 1,
      data: { value: "changed" },
    });
  });

  it("leaves stores without a persist spec alone", async () => {
    const useBare = defineStore("bare", () => {
      const n = ref(0);
      function bump(): void {
        n.value++;
      }
      return { n, bump };
    });
    const store = useBare();
    store.bump();
    await nextTick();
    expect(storage.length).toBe(0);
  });

  it("round-trips Map/Set state through codecs", async () => {
    const slotCodec = codecs.termSlots(codecs.stringSet(), { skipEmpty: (s) => s.size === 0 });
    const slotSpec: PersistSpec = {
      key: "slots",
      version: 1,
      pick: (store) => slotCodec.serialize(store.slots as Map<string, Set<string>>),
      apply: (store, data) => {
        const m = slotCodec.deserialize(data);
        if (m) store.setSlots(m);
      },
    };
    const useSlots = defineStore(
      "slots",
      () => {
        const slots = shallowRef<Map<string, Set<string>>>(new Map());
        function setSlots(next: Map<string, Set<string>>): void {
          slots.value = next;
        }
        return { slots, setSlots };
      },
      { persist: slotSpec },
    );

    const store = useSlots();
    store.setSlots(
      new Map([
        ["202540", new Set(["CPRG306"])],
        ["202610", new Set<string>()],
      ]),
    );
    await nextTick();
    expect(JSON.parse(storage.getItem("sait-sb-v2:slots")!)).toEqual({
      v: 1,
      data: { "202540": ["CPRG306"] },
    });
  });
});

describe("codecs", () => {
  it("stringSet rejects foreign shapes and filters non-strings", () => {
    const c = codecs.stringSet();
    expect(c.deserialize({ not: "array" })).toBeUndefined();
    expect([...c.deserialize(["a", 1, "b"])!]).toEqual(["a", "b"]);
  });

  it("stringMap round-trips and rejects foreign shapes", () => {
    const c = codecs.stringMap();
    const m = new Map([["CPRG306", "12345"]]);
    expect(c.serialize(m)).toEqual({ CPRG306: "12345" });
    expect([...c.deserialize({ CPRG306: "12345", bad: 7 })!]).toEqual([["CPRG306", "12345"]]);
    expect(c.deserialize([1, 2])).toBeUndefined();
  });

  it("termSlots drops slots the inner codec rejects", () => {
    const c = codecs.termSlots(codecs.stringSet());
    const out = c.deserialize({ "202540": ["A"], "202610": "corrupt" })!;
    expect([...out.keys()]).toEqual(["202540"]);
  });

  it("json honors the guard", () => {
    const c = codecs.json<string>((v): v is string => typeof v === "string");
    expect(c.deserialize("ok")).toBe("ok");
    expect(c.deserialize(42)).toBeUndefined();
    expect(c.deserialize(null)).toBeUndefined();
  });
});
