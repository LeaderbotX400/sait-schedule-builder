import type { DayOfWeek, Schedule } from "./types";

const ICAL_DAYS: Record<DayOfWeek, string> = {
  Mon: "MO",
  Tue: "TU",
  Wed: "WE",
  Thu: "TH",
  Fri: "FR",
  Sat: "SA",
  Sun: "SU",
};

/** Index matching JS `Date#getDay()` (Sun=0 .. Sat=6). */
const JS_DAY_INDEX: Record<DayOfWeek, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

/** Parse an ISO "YYYY-MM-DD" string as a local-midnight Date (never UTC —
 * avoids the off-by-one-day shift `new Date(iso)` can introduce). */
function parseIsoDate(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const [, y, m, d] = match;
  return new Date(Number(y), Number(m) - 1, Number(d));
}

/** The first date on/after `from` that falls on `day` — no assumption about
 * what weekday `from` itself is. */
function firstOccurrenceOnOrAfter(from: Date, day: DayOfWeek): Date {
  const result = new Date(from);
  const diff = (JS_DAY_INDEX[day] - result.getDay() + 7) % 7;
  result.setDate(result.getDate() + diff);
  return result;
}

function formatICalDate(date: Date, time: string): string {
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  return `${y}${m}${d}T${time}00`;
}

function escapeICalText(text: string): string {
  return text.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
}

export function generateICal(schedule: Schedule, timezone = "America/Edmonton"): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SAIT Schedule Builder//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-TIMEZONE:${timezone}`,
  ];

  for (const course of schedule.courses) {
    for (const meeting of course.meetings) {
      const start = parseIsoDate(meeting.startDate);
      const end = parseIsoDate(meeting.endDate);
      if (!start || !end) continue;

      const endDateStr = `${end.getFullYear()}${pad(end.getMonth() + 1)}${pad(end.getDate())}T235959`;

      for (const day of meeting.days) {
        const eventStart = firstOccurrenceOnOrAfter(start, day);

        const startTimeStr = meeting.startTime.toString().padStart(4, "0");
        const endTimeStr = meeting.endTime.toString().padStart(4, "0");

        const uid = `${course.crn}-${day}-${startTimeStr}@sait-schedule-builder`;

        lines.push("BEGIN:VEVENT");
        lines.push(`UID:${uid}`);
        lines.push(`DTSTART;TZID=${timezone}:${formatICalDate(eventStart, startTimeStr)}`);
        lines.push(`DTEND;TZID=${timezone}:${formatICalDate(eventStart, endTimeStr)}`);
        lines.push(`RRULE:FREQ=WEEKLY;BYDAY=${ICAL_DAYS[day]};UNTIL=${endDateStr}`);
        lines.push(`SUMMARY:${escapeICalText(`${course.identifier} - ${course.title}`)}`);
        lines.push(`LOCATION:${escapeICalText(`${meeting.building} ${meeting.room}`)}`);
        lines.push(
          `DESCRIPTION:${escapeICalText(
            `Instructor: ${course.instructor}\nCRN: ${course.crn}\nType: ${meeting.type}`,
          )}`,
        );
        lines.push("END:VEVENT");
      }
    }
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadICal(schedule: Schedule): void {
  const content = generateICal(schedule);
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `schedule-${schedule.id}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}
