import { describe, expect, it } from "vitest";
import { Temporal } from "@js-temporal/polyfill";
import type { CalendarEventViewMap } from "../../types/CalendarEvent.js";
import { EventsAPI } from "./reducer.js";

describe("EventsAPI", () => {
  it("moves a series and shifts exclusions while preserving exception timing", () => {
    const state: CalendarEventViewMap = new Map([
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
      [
        "daily::20250115T090000",
        {
          eventId: "daily@example.test",
          recurrenceId: "20250115T090000",
          start: Temporal.PlainDateTime.from("2025-01-15T11:00:00"),
          end: Temporal.PlainDateTime.from("2025-01-15T11:15:00"),
          summary: "Daily (moved)",
          color: "#10B981",
          isException: true,
        },
      ],
    ]);
    const api = new EventsAPI(state);

    api.move({
      target: { key: "daily" },
      scope: "series",
      delta: Temporal.Duration.from({ hours: 1 }),
    });

    const next = api.getState();
    expect(next.get("daily")?.start.toString()).toBe("2025-01-13T10:00:00");
    expect(next.get("daily")?.exclusionDates?.has("20250114T100000")).toBe(true);
    expect(next.get("daily::20250115T090000")?.start.toString()).toBe("2025-01-15T11:00:00");
    expect(next.get("daily::20250115T090000")?.recurrenceId).toBe("20250115T100000");
  });

  it("deleting exception keeps exclusion on master", () => {
    const state: CalendarEventViewMap = new Map([
      [
        "daily",
        {
          eventId: "daily@example.test",
          start: Temporal.PlainDateTime.from("2025-01-13T09:00:00"),
          end: Temporal.PlainDateTime.from("2025-01-13T09:15:00"),
          summary: "Daily",
          color: "#10B981",
          recurrenceRule: { freq: "DAILY", interval: 1, count: 3 },
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
          isException: true,
        },
      ],
    ]);
    const api = new EventsAPI(state);

    api.removeException({
      target: { key: "daily::20250114T090000" },
      options: { asExclusion: true },
    });

    const next = api.getState();
    expect(next.has("daily::20250114T090000")).toBe(false);
    expect(next.get("daily")?.exclusionDates?.has("20250114T090000")).toBe(true);
  });
});

