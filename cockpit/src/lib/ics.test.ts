import { describe, expect, it } from "vitest";

import { buildTaskIcs } from "./ics";

const base = { id: "task_123", title: "Ship the report", notes: null as string | null };

describe("buildTaskIcs", () => {
  it("emits a valid VCALENDAR/VEVENT skeleton", () => {
    const ics = buildTaskIcs({ ...base, dueDate: "2026-07-03T12:00:00.000Z" });
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("PRODID:-//Haven Desk//EN");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("UID:task_123@havendesk");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("END:VCALENDAR");
    // CRLF line endings between properties.
    expect(ics).toContain("VERSION:2.0\r\n");
  });

  it("puts DTSTART on the due calendar day for a UTC-noon date", () => {
    const ics = buildTaskIcs({ ...base, dueDate: new Date("2026-07-03T12:00:00.000Z") });
    expect(ics).toContain("DTSTART;VALUE=DATE:20260703");
    expect(ics).toContain("DTEND;VALUE=DATE:20260704");
  });

  it("puts DTSTART on the right day for a legacy UTC-midnight row", () => {
    const ics = buildTaskIcs({ ...base, dueDate: new Date("2026-07-03T00:00:00Z") });
    // Must NOT drift to the previous day — reads the ISO date part.
    expect(ics).toContain("DTSTART;VALUE=DATE:20260703");
    expect(ics).toContain("DTEND;VALUE=DATE:20260704");
  });

  it("rolls DTEND across a month/year boundary", () => {
    const ics = buildTaskIcs({ ...base, dueDate: "2026-12-31T12:00:00.000Z" });
    expect(ics).toContain("DTSTART;VALUE=DATE:20261231");
    expect(ics).toContain("DTEND;VALUE=DATE:20270101");
  });

  it("derives a stable DTSTAMP from the due day, not the clock", () => {
    const ics = buildTaskIcs({ ...base, dueDate: "2026-07-03T12:00:00.000Z" });
    expect(ics).toContain("DTSTAMP:20260703T000000Z");
  });

  it("escapes commas, semicolons, and newlines in SUMMARY and DESCRIPTION", () => {
    const ics = buildTaskIcs({
      id: "t1",
      title: "Buy milk, eggs; bread",
      notes: "Line one\nLine two; with, punctuation\\here",
      dueDate: "2026-07-03T12:00:00.000Z",
    });
    expect(ics).toContain("SUMMARY:Buy milk\\, eggs\\; bread");
    expect(ics).toContain("DESCRIPTION:Line one\\nLine two\\; with\\, punctuation\\\\here");
  });

  it("omits DESCRIPTION when notes are empty or whitespace", () => {
    expect(buildTaskIcs({ ...base, notes: null, dueDate: "2026-07-03T12:00:00.000Z" })).not.toContain(
      "DESCRIPTION:",
    );
    expect(buildTaskIcs({ ...base, notes: "   ", dueDate: "2026-07-03T12:00:00.000Z" })).not.toContain(
      "DESCRIPTION:",
    );
  });

  it("includes DESCRIPTION when notes are present", () => {
    const ics = buildTaskIcs({ ...base, notes: "Bring the deck", dueDate: "2026-07-03T12:00:00.000Z" });
    expect(ics).toContain("DESCRIPTION:Bring the deck");
  });

  it("is deterministic: same input → identical string", () => {
    const input = { id: "t9", title: "Recurring", notes: "x", dueDate: "2026-07-03T12:00:00.000Z" };
    expect(buildTaskIcs(input)).toBe(buildTaskIcs(input));
  });
});
