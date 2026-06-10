import { DEFAULT_TERM } from "@/lib/terms";

/**
 * One-shot translation of every pre-v2 localStorage key into the
 * versioned `sait-sb-v2:*` envelope schema, then removal of the
 * originals. All knowledge of historical shapes lives here so the live
 * persistence specs only ever see clean v2 data.
 *
 * Legacy inventory:
 *   sait-sb-v1:term             JSON string ("202540")
 *   sait-sb-v1:rules            ScheduleRules object
 *   sait-sb-v1:selectionSlots   Record<term, string[]>
 *   sait-sb-v1:selectedCourses  string[] (pre-slot; attributed to active term)
 *   sait-sb-v1:pinnedSections   Record<term, Record<subjectCourse, crn>>
 *   sait-sb-v1:currentRegSlots  Record<term, { sectionOverrides: [string, string][],
 *                                              includedCourses: string[] }>
 *   sait-sb-v1:currentReg       pre-slot single-slot variant of the above
 *   sait-sb-v1:savedSchedules   Record<term, SavedSchedule[]>
 *   sait-sb-theme               raw ThemeChoice string (not JSON)
 *
 * v2 schema (each value is `{ v: 1, data }`):
 *   sait-sb-v2:term       string
 *   sait-sb-v2:rules      ScheduleRules
 *   sait-sb-v2:selection  Record<term, { courses: string[], pinned: Record<string, string> }>
 *   sait-sb-v2:current    Record<term, { overrides: Record<string, string>, included: string[] }>
 *   sait-sb-v2:saved      Record<term, SavedSchedule[]>
 *   sait-sb-v2:theme      string
 */
export function migrateLegacy(storage: Storage): void {
  const term = readJson(storage, "sait-sb-v1:term");
  const activeTerm = typeof term === "string" && term.length > 0 ? term : DEFAULT_TERM;

  writeV2(storage, "term", typeof term === "string" && term.length > 0 ? term : undefined);
  writeV2(storage, "rules", asPlainObject(readJson(storage, "sait-sb-v1:rules")));
  writeV2(storage, "selection", migrateSelection(storage, activeTerm));
  writeV2(storage, "current", migrateCurrent(storage, activeTerm));
  writeV2(storage, "saved", asPlainObject(readJson(storage, "sait-sb-v1:savedSchedules")));
  writeV2(storage, "theme", readRawTheme(storage));

  for (const key of [
    "sait-sb-v1:term",
    "sait-sb-v1:rules",
    "sait-sb-v1:selectionSlots",
    "sait-sb-v1:selectedCourses",
    "sait-sb-v1:pinnedSections",
    "sait-sb-v1:currentRegSlots",
    "sait-sb-v1:currentReg",
    "sait-sb-v1:savedSchedules",
    "sait-sb-theme",
  ]) {
    safeRemove(storage, key);
  }
}

interface SelectionSlotV2 {
  courses: string[];
  pinned: Record<string, string>;
}

function migrateSelection(
  storage: Storage,
  activeTerm: string,
): Record<string, SelectionSlotV2> | undefined {
  const out: Record<string, SelectionSlotV2> = {};

  const slots = asPlainObject(readJson(storage, "sait-sb-v1:selectionSlots"));
  if (slots) {
    for (const [termCode, arr] of Object.entries(slots)) {
      if (!Array.isArray(arr)) continue;
      const courses = arr.filter((v): v is string => typeof v === "string");
      if (courses.length > 0) out[termCode] = { courses, pinned: {} };
    }
  } else {
    // Pre-slot key: attribute the flat selection to the active term.
    const flat = readJson(storage, "sait-sb-v1:selectedCourses");
    if (Array.isArray(flat)) {
      const courses = flat.filter((v): v is string => typeof v === "string");
      if (courses.length > 0) out[activeTerm] = { courses, pinned: {} };
    }
  }

  const pins = asPlainObject(readJson(storage, "sait-sb-v1:pinnedSections"));
  if (pins) {
    for (const [termCode, obj] of Object.entries(pins)) {
      const pinned = asStringRecord(obj);
      if (!pinned || Object.keys(pinned).length === 0) continue;
      const slot = (out[termCode] ??= { courses: [], pinned: {} });
      slot.pinned = pinned;
    }
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

interface CurrentSlotV2 {
  overrides: Record<string, string>;
  included: string[];
}

function migrateCurrent(
  storage: Storage,
  activeTerm: string,
): Record<string, CurrentSlotV2> | undefined {
  const out: Record<string, CurrentSlotV2> = {};

  const slots = asPlainObject(readJson(storage, "sait-sb-v1:currentRegSlots"));
  if (slots) {
    for (const [termCode, raw] of Object.entries(slots)) {
      const slot = legacyCurrentSlot(raw);
      if (slot) out[termCode] = slot;
    }
  } else {
    // Pre-slot key: attribute the single slot to the active term.
    const slot = legacyCurrentSlot(readJson(storage, "sait-sb-v1:currentReg"));
    if (slot) out[activeTerm] = slot;
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

function legacyCurrentSlot(raw: unknown): CurrentSlotV2 | undefined {
  const obj = asPlainObject(raw);
  if (!obj) return undefined;
  const overrides: Record<string, string> = {};
  if (Array.isArray(obj.sectionOverrides)) {
    for (const entry of obj.sectionOverrides) {
      if (
        Array.isArray(entry) &&
        typeof entry[0] === "string" &&
        typeof entry[1] === "string"
      ) {
        overrides[entry[0]] = entry[1];
      }
    }
  }
  const included = Array.isArray(obj.includedCourses)
    ? obj.includedCourses.filter((v): v is string => typeof v === "string")
    : [];
  if (Object.keys(overrides).length === 0 && included.length === 0) return undefined;
  return { overrides, included };
}

function readRawTheme(storage: Storage): string | undefined {
  try {
    const raw = storage.getItem("sait-sb-theme");
    return raw && raw.length > 0 ? raw : undefined;
  } catch {
    return undefined;
  }
}

function readJson(storage: Storage, key: string): unknown {
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

/** Write a v2 envelope unless the v2 key already exists (idempotent re-runs). */
function writeV2(storage: Storage, key: string, data: unknown): void {
  if (data === undefined) return;
  const fullKey = `sait-sb-v2:${key}`;
  try {
    if (storage.getItem(fullKey) !== null) return;
    storage.setItem(fullKey, JSON.stringify({ v: 1, data }));
  } catch {
    /* quota / private mode — silent */
  }
}

function safeRemove(storage: Storage, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function asPlainObject(v: unknown): Record<string, unknown> | undefined {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : undefined;
}

function asStringRecord(v: unknown): Record<string, string> | undefined {
  const obj = asPlainObject(v);
  if (!obj) return undefined;
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(obj)) {
    if (typeof val === "string") out[k] = val;
  }
  return out;
}
