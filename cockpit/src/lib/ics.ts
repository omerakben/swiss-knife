// Build a minimal RFC 5545 iCalendar (.ics) for a single task with a due date.
// Deterministic and local-first: no network, no wall clock. The event is an
// all-day VEVENT on the task's due CALENDAR day (read via dueDayString so a
// legacy UTC-midnight row still lands on the right day), with DTEND the next
// day per the all-day convention. Same input → byte-identical output.

import { dueDayString } from "./dates";

/** Escape a TEXT value per RFC 5545: backslash first (so we don't double-escape),
 * then semicolon, comma, and any newline (CR/LF) collapse to a literal `\n`. */
function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** "YYYY-MM-DD" → "YYYYMMDD" (the DATE value form). */
function compactDay(isoDay: string): string {
  return isoDay.replace(/-/g, "");
}

/** The calendar day after "YYYY-MM-DD", as "YYYY-MM-DD". Pure: derived from the
 * date parts via UTC arithmetic (handles month/year rollover), never the clock. */
function nextDay(isoDay: string): string {
  const [y, m, d] = isoDay.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

export function buildTaskIcs(task: {
  id: string;
  title: string;
  notes?: string | null;
  dueDate: Date | string;
}): string {
  const startDay = dueDayString(task.dueDate); // "YYYY-MM-DD"
  const start = compactDay(startDay); // "YYYYMMDD"
  const end = compactDay(nextDay(startDay)); // next-day "YYYYMMDD"
  // Stable DTSTAMP derived from the due day, NOT the wall clock — keeps output
  // deterministic so a re-export of the same task is byte-identical.
  const stamp = `${start}T000000Z`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Haven Desk//EN",
    "BEGIN:VEVENT",
    `UID:${task.id}@havendesk`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${escapeIcsText(task.title)}`,
  ];

  const notes = task.notes ?? "";
  if (notes.trim()) {
    lines.push(`DESCRIPTION:${escapeIcsText(notes)}`);
  }

  lines.push("END:VEVENT", "END:VCALENDAR");

  // CRLF between properties and a trailing CRLF, per RFC 5545.
  return lines.join("\r\n") + "\r\n";
}
