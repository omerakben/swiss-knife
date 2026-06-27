import { describe, expect, it } from "vitest";

import {
  dueDayString,
  formatDueDay,
  localDayString,
  parseDueDateInput,
  utcNoonOfLocalDay,
  utcStartOfLocalDay,
} from "./dates";

describe("parseDueDateInput", () => {
  it("stores a date-only string at UTC noon of that day", () => {
    expect(parseDueDateInput("2026-06-09")?.toISOString()).toBe("2026-06-09T12:00:00.000Z");
  });

  it("passes through full date-time strings", () => {
    expect(parseDueDateInput("2026-06-09T15:30:00.000Z")?.toISOString()).toBe("2026-06-09T15:30:00.000Z");
  });

  it("returns null for garbage", () => {
    expect(parseDueDateInput("not a date")).toBeNull();
  });
});

describe("dueDayString", () => {
  it("reads the intended day from a new-convention (UTC noon) value", () => {
    expect(dueDayString(new Date("2026-06-09T12:00:00.000Z"))).toBe("2026-06-09");
  });

  it("reads the intended day from a legacy UTC-midnight value", () => {
    // Legacy rows were stored via new Date("YYYY-MM-DD") = UTC midnight; a
    // local-timezone conversion west of UTC shows the previous day — the ISO
    // date part never does.
    expect(dueDayString(new Date("2026-06-09T00:00:00.000Z"))).toBe("2026-06-09");
  });

  it("accepts ISO strings directly", () => {
    expect(dueDayString("2026-06-09T00:00:00.000Z")).toBe("2026-06-09");
  });
});

describe("formatDueDay", () => {
  it("formats the stored calendar day regardless of viewer timezone", () => {
    // Whatever the locale format, the day-of-month must be the stored day (9),
    // not 8 — the off-by-one this lib exists to prevent.
    expect(formatDueDay("2026-06-09T00:00:00.000Z")).toContain("9");
  });
});

describe("utcNoonOfLocalDay", () => {
  it("returns UTC noon of the local day, with day offsets", () => {
    const now = new Date(2026, 5, 9, 22, 30); // local June 9, 22:30
    expect(utcNoonOfLocalDay(now, 0).toISOString()).toBe("2026-06-09T12:00:00.000Z");
    expect(utcNoonOfLocalDay(now, 1).toISOString()).toBe("2026-06-10T12:00:00.000Z");
  });

  it("rolls over month boundaries", () => {
    const now = new Date(2026, 5, 30, 8, 0);
    expect(utcNoonOfLocalDay(now, 1).toISOString()).toBe("2026-07-01T12:00:00.000Z");
  });
});

describe("utcStartOfLocalDay", () => {
  it("returns UTC midnight of the local day, with day offsets", () => {
    const now = new Date(2026, 5, 9, 22, 30); // local June 9
    expect(utcStartOfLocalDay(now, 0).toISOString()).toBe("2026-06-09T00:00:00.000Z");
    expect(utcStartOfLocalDay(now, 1).toISOString()).toBe("2026-06-10T00:00:00.000Z");
  });

  it("as a backlog lower bound, includes the WHOLE of tomorrow but excludes today", () => {
    // The DailyBrief "to do" partition: open todos due >= tomorrowStart are the
    // backlog; today/overdue have their own buckets. This pins the boundary that
    // used to drop a legacy UTC-midnight row due tomorrow into no bucket.
    const now = new Date(2026, 5, 9, 9, 0); // local June 9
    const tomorrowStart = utcStartOfLocalDay(now, 1).getTime();
    const tomorrowMidnight = new Date("2026-06-10T00:00:00.000Z").getTime(); // legacy
    const tomorrowNoon = new Date("2026-06-10T12:00:00.000Z").getTime(); // canonical
    const todayNoon = new Date("2026-06-09T12:00:00.000Z").getTime(); // due today
    expect(tomorrowMidnight >= tomorrowStart).toBe(true); // legacy tomorrow: included
    expect(tomorrowNoon >= tomorrowStart).toBe(true); // canonical tomorrow: included
    expect(todayNoon >= tomorrowStart).toBe(false); // due-today: excluded (no double-count)
  });
});

describe("localDayString", () => {
  it("formats the local calendar day", () => {
    expect(localDayString(new Date(2026, 5, 9, 23, 59))).toBe("2026-06-09");
    expect(localDayString(new Date(2026, 0, 1, 0, 0))).toBe("2026-01-01");
  });
});
