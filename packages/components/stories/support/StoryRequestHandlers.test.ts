import { Temporal } from "@js-temporal/polyfill";
import { type CalendarEvent, type CalendarEventsMap, EventsAPI } from "@lit-calendar/events-api";
import { describe, expect, it } from "vitest";
import { attachRequestEventHandlers } from "./StoryRequestHandlers.js";

class MockHostElement extends EventTarget {
  events = new Map<string, CalendarEvent>();
}

function createSeriesEventMap(): CalendarEventsMap {
  return new Map<string, CalendarEvent>([
    [
      "daily",
      {
        eventId: "daily@example.test",
        calendarId: "/calendars/wouter/work/",
        data: {
          start: Temporal.PlainDateTime.from("2025-01-13T09:00:00"),
          end: Temporal.PlainDateTime.from("2025-01-13T09:15:00"),
          summary: "Daily Standup",
          color: "#10B981",
          recurrenceRule: {
            freq: "DAILY",
            interval: 1,
            count: 14,
          },
        },
      },
    ],
  ]);
}

describe("attachRequestEventHandlers", () => {
  it("accepts key-only calendar events without throwing", () => {
    const el = new MockHostElement() as unknown as HTMLElement & {
      events: Map<string, CalendarEvent>;
    };
    attachRequestEventHandlers(el);
    el.dispatchEvent(new CustomEvent("event-created", { detail: { key: "new-1" } }));
    el.dispatchEvent(new CustomEvent("event-updated", { detail: { key: "daily" } }));
    el.dispatchEvent(new CustomEvent("event-deleted", { detail: { key: "daily" } }));
    el.dispatchEvent(new CustomEvent("event-selected", { detail: { key: "daily" } }));
  });
});

describe("EventsAPI recurring series (regression)", () => {
  it("applies series occurrence move delta relative to occurrence start", () => {
    const api = new EventsAPI(createSeriesEventMap());
    api.move({
      target: { key: "daily" },
      scope: "series",
      delta: Temporal.Duration.from({ hours: 1 }),
    });

    const master = api.events.get("daily");
    expect(master).toBeDefined();
    const exception = api.events.get("daily::20250118T090000");
    expect(master?.data.start.toString()).toBe("2025-01-13T10:00:00");
    expect(master?.data.end?.toString()).toBe("2025-01-13T10:15:00");
    expect(master?.data.exclusionDates?.size ?? 0).toBe(0);
    expect(exception).toBeUndefined();
  });

  it("applies series occurrence resize-start relative to occurrence start", () => {
    const api = new EventsAPI(createSeriesEventMap());
    api.resizeStart({
      target: { key: "daily" },
      scope: "series",
      toStart: Temporal.PlainDateTime.from("2025-01-13T08:30:00"),
    });

    const master = api.events.get("daily");
    expect(master).toBeDefined();
    expect(master?.data.start.toString()).toBe("2025-01-13T08:30:00");
    expect(master?.data.end?.toString()).toBe("2025-01-13T09:15:00");
  });

  it("creates detached exception when moving occurrence to another day", () => {
    const api = new EventsAPI(createSeriesEventMap());
    api.addException({
      target: { key: "daily" },
      recurrenceId: "20250118T090000",
      event: {
        start: Temporal.PlainDateTime.from("2025-01-19T10:00:00"),
        end: Temporal.PlainDateTime.from("2025-01-19T10:15:00"),
        summary: "Daily Standup",
        color: "#10B981",
        calendarId: "/calendars/wouter/work/",
      },
    });

    const master = api.events.get("daily");
    const exception = api.events.get("daily::20250118T090000");
    expect(master?.data.start.toString()).toBe("2025-01-13T09:00:00");
    expect(master?.data.exclusionDates?.has("20250118T090000")).toBe(true);
    expect(exception?.data.start.toString()).toBe("2025-01-19T10:00:00");
    expect(exception?.isException).toBe(true);
  });
});
