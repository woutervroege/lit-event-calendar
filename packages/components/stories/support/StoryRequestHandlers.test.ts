import { Temporal } from "@js-temporal/polyfill";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EventUpdateRequestDetail } from "../../src/types/CalendarEventRequests.js";
import type { CalendarEvent } from "./StoryData.js";
import { attachRequestEventHandlers } from "./StoryRequestHandlers.js";

class MockCalendarElement extends EventTarget {
  events: Map<string, CalendarEvent> = new Map();
}

function createSeriesEventMap(): Map<string, CalendarEvent> {
  return new Map([
    [
      "daily",
      {
        eventId: "daily@example.test",
        calendarId: "/calendars/wouter/work/",
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
    ],
  ]);
}

describe("StoryRequestHandlers recurring updates", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { window?: typeof globalThis }).window = globalThis;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("applies series occurrence move delta relative to occurrence start", () => {
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true)
    );
    const el = new MockCalendarElement();
    el.events = createSeriesEventMap();
    attachRequestEventHandlers(
      el as unknown as HTMLElement & { events: Map<string, CalendarEvent> }
    );

    const detail: EventUpdateRequestDetail = {
      envelope: {
        eventId: "daily@example.test",
        calendarId: "/calendars/wouter/work/",
        recurrenceId: "20250118T090000",
        isRecurring: true,
        isException: false,
      },
      content: {
        start: Temporal.PlainDateTime.from("2025-01-18T10:00:00"),
        end: Temporal.PlainDateTime.from("2025-01-18T10:15:00"),
        summary: "Daily Standup",
        color: "#10B981",
      },
    };

    el.dispatchEvent(
      new CustomEvent("event-update", {
        detail,
        cancelable: true,
      })
    );

    const master = el.events.get("daily");
    expect(master).toBeDefined();
    const exception = el.events.get("daily::20250118T090000");
    expect(master?.start.toString()).toBe("2025-01-13T10:00:00");
    expect(master?.end.toString()).toBe("2025-01-13T10:15:00");
    expect(master?.exclusionDates?.size ?? 0).toBe(0);
    expect(exception).toBeUndefined();
  });

  it("applies series occurrence resize-start relative to occurrence start", () => {
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true)
    );
    const el = new MockCalendarElement();
    el.events = createSeriesEventMap();
    attachRequestEventHandlers(
      el as unknown as HTMLElement & { events: Map<string, CalendarEvent> }
    );

    const detail: EventUpdateRequestDetail = {
      envelope: {
        eventId: "daily@example.test",
        calendarId: "/calendars/wouter/work/",
        recurrenceId: "20250118T090000",
        isRecurring: true,
        isException: false,
      },
      content: {
        start: Temporal.PlainDateTime.from("2025-01-18T08:30:00"),
        end: Temporal.PlainDateTime.from("2025-01-18T09:15:00"),
        summary: "Daily Standup",
        color: "#10B981",
      },
    };

    el.dispatchEvent(
      new CustomEvent("event-update", {
        detail,
        cancelable: true,
      })
    );

    const master = el.events.get("daily");
    expect(master).toBeDefined();
    // Critical regression assertion: series should shift boundary by -30m, not jump to Jan 18.
    expect(master?.start.toString()).toBe("2025-01-13T08:30:00");
    expect(master?.end.toString()).toBe("2025-01-13T09:15:00");
  });

  it("creates detached exception when moving occurrence to another day", () => {
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true)
    );
    const el = new MockCalendarElement();
    el.events = createSeriesEventMap();
    attachRequestEventHandlers(
      el as unknown as HTMLElement & { events: Map<string, CalendarEvent> }
    );

    const detail: EventUpdateRequestDetail = {
      envelope: {
        eventId: "daily@example.test",
        calendarId: "/calendars/wouter/work/",
        recurrenceId: "20250118T090000",
        isRecurring: true,
        isException: false,
      },
      content: {
        start: Temporal.PlainDateTime.from("2025-01-19T10:00:00"),
        end: Temporal.PlainDateTime.from("2025-01-19T10:15:00"),
        summary: "Daily Standup",
        color: "#10B981",
      },
    };

    el.dispatchEvent(
      new CustomEvent("event-update", {
        detail,
        cancelable: true,
      })
    );

    const master = el.events.get("daily");
    const exception = el.events.get("daily::20250118T090000");
    expect(master?.start.toString()).toBe("2025-01-13T09:00:00");
    expect(master?.exclusionDates?.has("20250118T090000")).toBe(true);
    expect(exception?.start.toString()).toBe("2025-01-19T10:00:00");
    expect(exception?.isException).toBe(true);
  });

  it("rolls back optimistic exception when event-exception is cancelled", () => {
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true)
    );
    const el = new MockCalendarElement();
    el.events = createSeriesEventMap();
    el.addEventListener("event-exception", (event) => {
      event.preventDefault();
    });
    attachRequestEventHandlers(
      el as unknown as HTMLElement & { events: Map<string, CalendarEvent> }
    );

    const detail: EventUpdateRequestDetail = {
      envelope: {
        eventId: "daily@example.test",
        calendarId: "/calendars/wouter/work/",
        recurrenceId: "20250118T090000",
        isRecurring: true,
        isException: false,
      },
      content: {
        start: Temporal.PlainDateTime.from("2025-01-19T10:00:00"),
        end: Temporal.PlainDateTime.from("2025-01-19T10:15:00"),
        summary: "Daily Standup",
        color: "#10B981",
      },
    };

    const updateEvent = new CustomEvent("event-update", {
      detail,
      cancelable: true,
    });
    el.dispatchEvent(updateEvent);

    const master = el.events.get("daily");
    const exception = el.events.get("daily::20250118T090000");
    expect(master?.start.toString()).toBe("2025-01-13T09:00:00");
    expect(master?.exclusionDates?.size ?? 0).toBe(0);
    expect(exception).toBeUndefined();
    expect(updateEvent.defaultPrevented).toBe(true);
  });
});
