import type { Schedule, DayOfWeek } from "./types";

const ICAL_DAYS: Record<DayOfWeek, string> = {
  Mon: "MO",
  Tue: "TU",
  Wed: "WE",
  Thu: "TH",
  Fri: "FR",
  Sat: "SA",
  Sun: "SU",
};

const DAY_OFFSETS: Record<DayOfWeek, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

function pad(n: number): string {
  return n.toString().padStart(2, "0");
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

export function generateICal(
  schedule: Schedule,
  semesterStart: Date,
  semesterEnd: Date,
  timezone = "America/Edmonton",
): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SAIT Schedule Builder//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-TIMEZONE:${timezone}`,
  ];

  const endDateStr = `${semesterEnd.getFullYear()}${pad(semesterEnd.getMonth() + 1)}${pad(semesterEnd.getDate())}T235959`;

  for (const course of schedule.courses) {
    for (const meeting of course.meetings) {
      for (const day of meeting.days) {
        const offset = DAY_OFFSETS[day];
        const eventStart = new Date(semesterStart);
        // Find the first occurrence of this day from semester start (assumed Monday)
        eventStart.setDate(eventStart.getDate() + offset);

        const startTimeStr = meeting.startTime.toString().padStart(4, "0");
        const endTimeStr = meeting.endTime.toString().padStart(4, "0");

        const uid = `${course.crn}-${day}-${startTimeStr}@sait-schedule-builder`;

        lines.push("BEGIN:VEVENT");
        lines.push(`UID:${uid}`);
        lines.push(`DTSTART;TZID=${timezone}:${formatICalDate(eventStart, startTimeStr)}`);
        lines.push(`DTEND;TZID=${timezone}:${formatICalDate(eventStart, endTimeStr)}`);
        lines.push(`RRULE:FREQ=WEEKLY;BYDAY=${ICAL_DAYS[day]};UNTIL=${endDateStr}`);
        lines.push(`SUMMARY:${escapeICalText(`${course.identifier} - ${course.title}`)}`);
        lines.push(
          `LOCATION:${escapeICalText(`${meeting.building} ${meeting.room}`)}`,
        );
        lines.push(
          `DESCRIPTION:${escapeICalText(
            `Instructor: ${course.instructor}\\nCRN: ${course.crn}\\nType: ${meeting.type}`,
          )}`,
        );
        lines.push("END:VEVENT");
      }
    }
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadICal(
  schedule: Schedule,
  semesterStart: Date,
  semesterEnd: Date,
): void {
  const content = generateICal(schedule, semesterStart, semesterEnd);
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `schedule-${schedule.id}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}
