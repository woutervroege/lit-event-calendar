import { describe, expect, it } from "vitest";
import { Temporal } from "@js-temporal/polyfill";
import type { CalendarEventsMap } from "./state-types.js";
import { EventsAPI } from "./reducer.js";
import { createDailySeriesState, createWeeklySeriesWithExceptionState } from "./testing/mockEvents.js";

describe("EventsAPI", () => {
  it("moves a series and shifts exclusions while preserving exception timing", () => {
    const state: CalendarEventsMap = new Map([
      [
        "daily",
        {
          key: "daily",
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
          key: "daily::20250115T090000",
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
    const state: CalendarEventsMap = new Map([
      [
        "daily",
        {
          key: "daily",
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
          key: "daily::20250114T090000",
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

  it("resizing series start should shift exclusions with the new occurrence start", () => {
    const state = createDailySeriesState();
    state.set("daily", {
      ...state.get("daily")!,
      exclusionDates: new Set(["20250114T090000"]),
    });
    const api = new EventsAPI(state);

    api.resizeStart({
      target: { key: "daily" },
      scope: "series",
      toStart: Temporal.PlainDateTime.from("2025-01-13T08:30:00"),
    });

    const next = api.getState();
    expect(next.get("daily")?.exclusionDates?.has("20250114T083000")).toBe(true);
    expect(next.get("daily")?.exclusionDates?.has("20250114T090000")).toBe(false);
  });

  it("resizing series start should not resize detached exceptions", () => {
    const state: CalendarEventsMap = new Map([
      ...createDailySeriesState(),
      [
        "daily::20250115T090000",
        {
          key: "daily::20250115T090000",
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

    api.resizeStart({
      target: { key: "daily" },
      scope: "series",
      toStart: Temporal.PlainDateTime.from("2025-01-13T08:30:00"),
    });

    const next = api.getState();
    const exception = next.get("daily::20250115T090000");
    expect(exception?.start.toString()).toBe("2025-01-15T11:00:00");
    expect(exception?.end.toString()).toBe("2025-01-15T11:15:00");
  });

  it("resizing series start shifts detached exception recurrence anchor", () => {
    const state: CalendarEventsMap = new Map([
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
          exclusionDates: new Set(["20250115T090000"]),
        },
      ],
      [
        "daily::20250115T090000",
        {
          key: "daily::20250115T090000",
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

    api.resizeStart({
      target: { key: "daily" },
      scope: "series",
      toStart: Temporal.PlainDateTime.from("2025-01-13T08:30:00"),
    });

    const next = api.getState();
    const exception = next.get("daily::20250115T090000");
    expect(exception?.start.toString()).toBe("2025-01-15T11:00:00");
    expect(exception?.end.toString()).toBe("2025-01-15T11:15:00");
    expect(exception?.recurrenceId).toBe("20250115T083000");
    expect(next.get("daily")?.exclusionDates?.has("20250115T083000")).toBe(true);
    expect(next.get("daily")?.exclusionDates?.has("20250115T090000")).toBe(false);
  });

  it("moving a detached exception keeps original recurrence anchor and suppresses master occurrence", () => {
    const api = new EventsAPI(createWeeklySeriesWithExceptionState());

    api.move({
      target: { key: "weekly::20250120T090000" },
      scope: "single",
      delta: Temporal.Duration.from({ hours: 1 }),
    });

    const next = api.getState();
    const movedException = next.get("weekly::20250120T090000");
    expect(movedException?.start.toString()).toBe("2025-01-20T14:00:00");
    expect(movedException?.end.toString()).toBe("2025-01-20T15:00:00");
    expect(movedException?.recurrenceId).toBe("20250120T090000");

    const expanded = api.expand({
      start: Temporal.PlainDateTime.from("2025-01-20T00:00:00"),
      end: Temporal.PlainDateTime.from("2025-01-21T00:00:00"),
    });

    expect(expanded.has("weekly::20250120T090000")).toBe(true);
    expect(Array.from(expanded.keys())).toEqual(["weekly::20250120T090000"]);
  });

  it("tracks update and delete as pending when enabled", () => {
    const state: CalendarEventsMap = new Map([
      [
        "single",
        {
          key: "single",
          eventId: "single@example.test",
          start: Temporal.PlainDateTime.from("2025-01-13T09:00:00"),
          end: Temporal.PlainDateTime.from("2025-01-13T10:00:00"),
          summary: "Single",
          color: "#10B981",
        },
      ],
    ]);
    const api = new EventsAPI(state, { trackPending: true });

    api.update({
      target: { key: "single" },
      scope: "single",
      patch: { summary: "Single (edited)" },
    });
    expect(api.getState().get("single")?.pendingOp).toBe("updated");

    api.remove({
      target: { key: "single" },
      scope: "single",
    });
    const next = api.getState();
    expect(next.get("single")?.pendingOp).toBe("deleted");
  });

  it("drops locally created events when deleted in pending mode", () => {
    const state: CalendarEventsMap = new Map([
      [
        "draft",
        {
          key: "draft",
          eventId: "draft@example.test",
          start: Temporal.PlainDateTime.from("2025-01-13T09:00:00"),
          end: Temporal.PlainDateTime.from("2025-01-13T10:00:00"),
          summary: "Draft",
          color: "#10B981",
          pendingOp: "created",
        },
      ],
    ]);
    const api = new EventsAPI(state, { trackPending: true });

    api.remove({
      target: { key: "draft" },
      scope: "single",
    });
    expect(api.getState().has("draft")).toBe(false);
  });

  it("series update skips detached exceptions", () => {
    const state = createWeeklySeriesWithExceptionState();
    const api = new EventsAPI(state, { trackPending: true });

    api.update({
      target: { key: "weekly" },
      scope: "series",
      patch: { summary: "Weekly (series updated)" },
    });

    const next = api.getState();
    expect(next.get("weekly")?.summary).toBe("Weekly (series updated)");
    expect(next.get("weekly")?.pendingOp).toBe("updated");
    expect(next.get("weekly::20250120T090000")?.summary).toBe("Weekly (moved)");
    expect(next.get("weekly::20250120T090000")?.pendingOp).toBeUndefined();
  });

  it("series move updates exception recurrence anchors without pending updates", () => {
    const api = new EventsAPI(createWeeklySeriesWithExceptionState(), { trackPending: true });

    api.move({
      target: { key: "weekly" },
      scope: "series",
      delta: Temporal.Duration.from({ hours: 1 }),
    });

    const next = api.getState();
    expect(next.get("weekly")?.pendingOp).toBe("updated");
    expect(next.get("weekly::20250120T090000")?.recurrenceId).toBe("20250120T100000");
    expect(next.get("weekly::20250120T090000")?.pendingOp).toBeUndefined();
  });
});
