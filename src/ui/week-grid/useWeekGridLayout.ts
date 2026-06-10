import { computed, type ComputedRef, type MaybeRefOrGetter, toValue } from "vue";
import { timeToMinutes } from "@/domain/time";
import { type DayOfWeek, WEEKDAYS } from "@/domain/types";

/**
 * The one implementation of week-grid layout math: hour-range expansion,
 * weekend handling, and HHMM → rem positioning. Consumed by the schedule
 * calendar and the blockout editor through `WeekGrid.vue`.
 */

export interface WeekGridEvent<M = unknown> {
  id: string;
  day: DayOfWeek;
  /** HHMM 24-hour integers — 1400 = 2:00 PM. */
  startTime: number;
  endTime: number;
  meta: M;
}

export interface UseWeekGridLayoutOptions<M> {
  /** All events the grid must accommodate (drives range + weekend expansion). */
  events: MaybeRefOrGetter<WeekGridEvent<M>[]>;
  /**
   * Fixed base hour range the grid always shows (e.g. the blockout
   * editor's paintable 7–22). Events outside it expand the range.
   * Omit to fit the events exactly, with an 8–21 fallback when empty.
   */
  baseHours?: { startHour: number; endHour: number };
  /** "never": weekdays only. "auto": add Sat/Sun when events fall on them. */
  weekendMode?: "never" | "auto";
  /** Height of one hour row in rem. */
  hourHeightRem?: number;
}

export interface WeekGridLayout<M = unknown> {
  hours: ComputedRef<number[]>;
  days: ComputedRef<DayOfWeek[]>;
  totalHeightRem: ComputedRef<number>;
  hourHeightRem: number;
  eventsByDay: ComputedRef<Map<DayOfWeek, WeekGridEvent<M>[]>>;
  /** Top offset in rem for an HHMM start time. */
  topRem(startTime: number): number;
  /** Height in rem of an HHMM interval — also drives label-density cutoffs. */
  heightRem(startTime: number, endTime: number): number;
  /** Ready-to-bind absolute-position style for an event interval. */
  blockStyle(ev: { startTime: number; endTime: number }): { top: string; height: string };
  /** Top offset in rem of the i-th hour row. */
  hourTopRem(index: number): number;
}

export const DEFAULT_HOUR_HEIGHT_REM = 3.75;

export function useWeekGridLayout<M = unknown>(
  opts: UseWeekGridLayoutOptions<M>,
): WeekGridLayout<M> {
  const hourHeightRem = opts.hourHeightRem ?? DEFAULT_HOUR_HEIGHT_REM;
  const weekendMode = opts.weekendMode ?? "never";

  const events = computed(() => toValue(opts.events));

  const hours = computed<number[]>(() => {
    let minHour: number;
    let maxHour: number;
    if (opts.baseHours) {
      minHour = opts.baseHours.startHour;
      maxHour = opts.baseHours.endHour;
    } else if (events.value.length > 0) {
      minHour = 24;
      maxHour = 0;
    } else {
      minHour = 8;
      maxHour = 21;
    }
    for (const ev of events.value) {
      const sh = Math.floor(ev.startTime / 100);
      const eh = Math.ceil(ev.endTime / 100);
      if (sh < minHour) minHour = sh;
      if (eh > maxHour) maxHour = eh;
    }
    return Array.from({ length: maxHour - minHour }, (_, i) => minHour + i);
  });

  const days = computed<DayOfWeek[]>(() => {
    if (weekendMode === "never") return WEEKDAYS;
    const hasSat = events.value.some((e) => e.day === "Sat");
    const hasSun = events.value.some((e) => e.day === "Sun");
    return [
      ...WEEKDAYS,
      ...(hasSat ? (["Sat"] as DayOfWeek[]) : []),
      ...(hasSun ? (["Sun"] as DayOfWeek[]) : []),
    ];
  });

  const gridStartMinutes = computed(() => (hours.value[0] ?? 8) * 60);
  const totalHeightRem = computed(() => hours.value.length * hourHeightRem);

  const eventsByDay = computed(() => {
    const map = new Map<DayOfWeek, WeekGridEvent<M>[]>();
    const visible = new Set(days.value);
    for (const ev of events.value) {
      if (!visible.has(ev.day)) continue;
      const existing = map.get(ev.day) ?? [];
      existing.push(ev);
      map.set(ev.day, existing);
    }
    return map;
  });

  function topRem(startTime: number): number {
    return ((timeToMinutes(startTime) - gridStartMinutes.value) / 60) * hourHeightRem;
  }

  function heightRem(startTime: number, endTime: number): number {
    return ((timeToMinutes(endTime) - timeToMinutes(startTime)) / 60) * hourHeightRem;
  }

  function blockStyle(ev: { startTime: number; endTime: number }): {
    top: string;
    height: string;
  } {
    return {
      top: `${topRem(ev.startTime)}rem`,
      height: `${heightRem(ev.startTime, ev.endTime)}rem`,
    };
  }

  function hourTopRem(index: number): number {
    return index * hourHeightRem;
  }

  return {
    hours,
    days,
    totalHeightRem,
    hourHeightRem,
    eventsByDay,
    topRem,
    heightRem,
    blockStyle,
    hourTopRem,
  };
}
