/**
 * Time helpers. All time integers are HHMM (e.g. 1430 = 2:30 PM, 800 = 8:00 AM).
 */

/** 1430 → 870 (minutes since midnight). */
export function timeToMinutes(t: number): number {
  return Math.floor(t / 100) * 60 + (t % 100);
}

/** 1430 → "2:30 PM" — canonical 12-hour with space before period. */
export function formatTime(t: number): string {
  const h = Math.floor(t / 100);
  const m = (t % 100).toString().padStart(2, "0");
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m} ${period}`;
}

/** 1430 → "2:30PM" — no space (used in tighter labels and warning text). */
export function formatTimeCompact(t: number): string {
  return formatTime(t).replace(" ", "");
}

/** "1430" → "2:30 PM" — for the string-typed times in ScheduleRules. */
export function formatTimeFromString(t: string): string {
  return formatTime(parseInt(t, 10));
}

/** 14 → "2PM" — hour-only label for blockout/grid axes. */
export function formatHour(h: number): string {
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}${period}`;
}
