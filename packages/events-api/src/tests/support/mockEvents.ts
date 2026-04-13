import { Temporal } from "@js-temporal/polyfill";
import type { CalendarEventsMap } from "../../types/event.js";

export function createDailySeriesState(): CalendarEventsMap {
  return new Map([
    [
      "daily",
      {
        key: "daily",
        eventId: "daily@example.test",
        start: Temporal.PlainDateTime.from("2025-01-13T09:00:00"),
        end: Temporal.PlainDateTime.from("2025-01-13T09:15:00"),
        summary: "Daily",
        color: "#10B981",
        recurrenceRule: { freq: "DAILY", interval: 1, count: 4 },
      },
    ],
  ]);
}

export function createWeeklySeriesWithExceptionState(): CalendarEventsMap {
  return new Map([
    [
      "weekly",
      {
        key: "weekly",
        eventId: "weekly@example.test",
        start: Temporal.PlainDateTime.from("2025-01-20T09:00:00"),
        end: Temporal.PlainDateTime.from("2025-01-20T10:00:00"),
        summary: "Weekly",
        color: "#0ea5e9",
        recurrenceRule: {
          freq: "WEEKLY",
          interval: 1,
          byDay: [{ day: "MO" }],
          count: 4,
        },
        exclusionDates: new Set(),
      },
    ],
    [
      "weekly::20250120T090000",
      {
        key: "weekly::20250120T090000",
        eventId: "weekly@example.test",
        recurrenceId: "20250120T090000",
        start: Temporal.PlainDateTime.from("2025-01-20T13:00:00"),
        end: Temporal.PlainDateTime.from("2025-01-20T14:00:00"),
        summary: "Weekly (moved)",
        color: "#0ea5e9",
        isException: true,
      },
    ],
  ]);
}
