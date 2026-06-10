import { formatTimeCompact } from "@/domain/time";
import type { CourseSection, DayOfWeek, MeetingBlock } from "@/domain/types";

/**
 * Shared course/section label formatting — the one implementation of the
 * meeting/seat strings CourseSearch, CourseSelector, CurrentScheduleEditor
 * and ScheduleDetail used to hand-roll independently.
 */

/** `["Mon","Wed"]` → `"MonWed"` — the compact day run used in meeting labels. */
export function daysLabel(days: DayOfWeek[]): string {
  return days.join("");
}

/** `1400–1550` → `"2:00PM–3:50PM"`. */
export function timeRangeLabel(m: Pick<MeetingBlock, "startTime" | "endTime">): string {
  return `${formatTimeCompact(m.startTime)}–${formatTimeCompact(m.endTime)}`;
}

/** One meeting block → `"MonWed 2:00PM–3:50PM"` (or `"Online"` for online-only blocks). */
export function meetingSummary(m: MeetingBlock): string {
  if (m.days.length === 0) return m.isOnline ? "Online" : "—";
  return `${daysLabel(m.days)} ${timeRangeLabel(m)}`;
}

/** All meetings of a section → `"MonWed 2:00PM–3:50PM, Fri 9:00AM–9:50AM"` (or `"—"`). */
export function meetingsSummary(section: Pick<CourseSection, "meetings">): string {
  if (section.meetings.length === 0) return "—";
  return section.meetings.map(meetingSummary).join(", ");
}

/** Sum of open seats across a course's sections. */
export function totalSeats(sections: readonly Pick<CourseSection, "seatsAvailable">[]): number {
  return sections.reduce((sum, s) => sum + s.seatsAvailable, 0);
}

/** `1` → `"1 seat"`, otherwise `"<n> seats"`. */
export function seatsLabel(count: number): string {
  return `${count} ${count === 1 ? "seat" : "seats"}`;
}

/** `1` → `"1 section"`, otherwise `"<n> sections"`. */
export function sectionsLabel(count: number): string {
  return `${count} ${count === 1 ? "section" : "sections"}`;
}
