import { describe, expect, it } from "vitest";
import { Temporal } from "@js-temporal/polyfill";
import type { CalendarEventViewMap } from "../../types/CalendarEvent.js";
import { expandEvents } from "./expand.js";

describe("expandEvents", () => {
  it("expands a daily recurrence and applies exclusion dates", () => {
    const events: CalendarEventViewMap = new Map([
      [
        "daily",
        {
          eventId: "daily@example.test",
          start: Temporal.PlainDateTime.from("2025-01-13T09:00:00"),
          end: Temporal.PlainDateTime.from("2025-01-13T09:15:00"),
          summary: "Daily",
          color: "#10B981",
          recurrenceRule: { freq: "DAILY", interval: 1, count: 3 },
          exclusionDates: new Set(["20250114T090000"]),
        },
      ],
    ]);

    const rendered = expandEvents(events, {
      start: Temporal.PlainDateTime.from("2025-01-13T00:00:00"),
      end: Temporal.PlainDateTime.from("2025-01-20T00:00:00"),
    });

    expect(rendered.has("daily::20250113T090000")).toBe(true);
    expect(rendered.has("daily::20250114T090000")).toBe(false);
    expect(rendered.has("daily::20250115T090000")).toBe(true);
  });

  it("suppresses generated occurrence when detached exception exists", () => {
    const events: CalendarEventViewMap = new Map([
      [
        "daily",
        {
          eventId: "daily@example.test",
          start: Temporal.PlainDateTime.from("2025-01-13T09:00:00"),
          end: Temporal.PlainDateTime.from("2025-01-13T09:15:00"),
          summary: "Daily",
          color: "#10B981",
          recurrenceRule: { freq: "DAILY", interval: 1, count: 2 },
          exclusionDates: new Set(),
        },
      ],
      [
        "daily::20250114T090000",
        {
          eventId: "daily@example.test",
          recurrenceId: "20250114T090000",
          start: Temporal.PlainDateTime.from("2025-01-14T11:00:00"),
          end: Temporal.PlainDateTime.from("2025-01-14T11:15:00"),
          summary: "Daily (moved)",
          color: "#10B981",
        },
      ],
    ]);

    const rendered = expandEvents(events, {
      start: Temporal.PlainDateTime.from("2025-01-13T00:00:00"),
      end: Temporal.PlainDateTime.from("2025-01-20T00:00:00"),
    });

    expect(rendered.has("daily::20250113T090000")).toBe(true);
    expect(rendered.has("daily::20250114T090000")).toBe(true);
    const exception = rendered.get("daily::20250114T090000");
    expect(exception?.start.toString()).toBe("2025-01-14T11:00:00");
  });

  it("expands monthly last Friday recurrences using byDay + bySetPos", () => {
    const events: CalendarEventViewMap = new Map([
      [
        "monthly-last-friday",
        {
          eventId: "monthly-last-friday@example.test",
          start: Temporal.PlainDateTime.from("2025-01-06T09:00:00"),
          end: Temporal.PlainDateTime.from("2025-01-06T10:00:00"),
          summary: "Monthly Last Friday",
          color: "#0ea5e9",
          recurrenceRule: {
            freq: "MONTHLY",
            interval: 1,
            byDay: [{ day: "FR" }],
            bySetPos: [-1],
            count: 3,
          },
        },
      ],
    ]);

    const rendered = expandEvents(events, {
      start: Temporal.PlainDateTime.from("2025-01-01T00:00:00"),
      end: Temporal.PlainDateTime.from("2025-04-01T00:00:00"),
    });

    expect(Array.from(rendered.keys())).toEqual([
      "monthly-last-friday::20250131T090000",
      "monthly-last-friday::20250228T090000",
      "monthly-last-friday::20250328T090000",
    ]);
  });

  it("uses DTSTART weekday for weekly recurrence when byDay is omitted", () => {
    const events: CalendarEventViewMap = new Map([
      [
        "weekly-default-weekday",
        {
          eventId: "weekly-default-weekday@example.test",
          start: Temporal.PlainDateTime.from("2025-01-06T09:00:00"),
          end: Temporal.PlainDateTime.from("2025-01-06T10:00:00"),
          summary: "Weekly default weekday",
          color: "#0ea5e9",
          recurrenceRule: {
            freq: "WEEKLY",
            interval: 1,
            count: 3,
          },
        },
      ],
    ]);

    const rendered = expandEvents(events, {
      start: Temporal.PlainDateTime.from("2025-01-01T00:00:00"),
      end: Temporal.PlainDateTime.from("2025-02-01T00:00:00"),
    });

    expect(Array.from(rendered.keys())).toEqual([
      "weekly-default-weekday::20250106T090000",
      "weekly-default-weekday::20250113T090000",
      "weekly-default-weekday::20250120T090000",
    ]);
  });

  it("applies wkst for weekly interval buckets", () => {
    const events: CalendarEventViewMap = new Map([
      [
        "biweekly-wkst-sunday",
        {
          eventId: "biweekly-wkst-sunday@example.test",
          start: Temporal.PlainDateTime.from("2025-01-06T09:00:00"),
          end: Temporal.PlainDateTime.from("2025-01-06T10:00:00"),
          summary: "Biweekly with Sunday week start",
          color: "#0ea5e9",
          recurrenceRule: {
            freq: "WEEKLY",
            interval: 2,
            wkst: "SU",
            byDay: [{ day: "SU" }, { day: "MO" }],
            count: 6,
          },
        },
      ],
    ]);

    const rendered = expandEvents(events, {
      start: Temporal.PlainDateTime.from("2025-01-01T00:00:00"),
      end: Temporal.PlainDateTime.from("2025-03-01T00:00:00"),
    });

    expect(Array.from(rendered.keys())).toEqual([
      "biweekly-wkst-sunday::20250106T090000",
      "biweekly-wkst-sunday::20250119T090000",
      "biweekly-wkst-sunday::20250120T090000",
      "biweekly-wkst-sunday::20250202T090000",
      "biweekly-wkst-sunday::20250203T090000",
      "biweekly-wkst-sunday::20250216T090000",
    ]);
  });

  it("includes an occurrence exactly at UNTIL boundary", () => {
    const events: CalendarEventViewMap = new Map([
      [
        "daily-until-boundary",
        {
          eventId: "daily-until-boundary@example.test",
          start: Temporal.PlainDateTime.from("2025-01-13T09:00:00"),
          end: Temporal.PlainDateTime.from("2025-01-13T09:15:00"),
          summary: "Daily until boundary",
          color: "#0ea5e9",
          recurrenceRule: {
            freq: "DAILY",
            interval: 1,
            until: Temporal.PlainDateTime.from("2025-01-15T09:00:00"),
          },
        },
      ],
    ]);

    const rendered = expandEvents(events, {
      start: Temporal.PlainDateTime.from("2025-01-13T00:00:00"),
      end: Temporal.PlainDateTime.from("2025-01-20T00:00:00"),
    });

    expect(Array.from(rendered.keys())).toEqual([
      "daily-until-boundary::20250113T090000",
      "daily-until-boundary::20250114T090000",
      "daily-until-boundary::20250115T090000",
    ]);
  });
});

