import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { action } from "storybook/actions";
import { Temporal } from "@js-temporal/polyfill";
import "../src/EventCalendar/EventCalendar.js";
import { isCalendarEventException, isCalendarEventRecurring } from "../src/types/CalendarEvent.js";
import { calendarCssProps } from "./support/CalendarCssProps.js";
import {
  AUTO_LOCALE_OPTION,
  AUTO_WEEK_START_OPTION,
  type CalendarEvent,
  langControlLabels,
  langControlOptions,
  sampleEvents,
  timezoneOptions,
  weekStartControlLabels,
  weekStartControlOptions,
} from "./support/StoryData.js";
import { attachRequestEventHandlers } from "./support/StoryRequestHandlers.js";
import type {
  EventCreateRequestDetail,
  EventDeleteRequestDetail,
  EventUpdateRequestDetail,
} from "../src/types/CalendarEventRequests.js";
import type { CalendarEventPendingGroups } from "../src/types/CalendarEvent.js";

type StoryEventCalendarElement = HTMLElement & {
  events: Map<string, CalendarEvent>;
  getPendingEvents: (options?: { groupBy?: "pendingOp" | "calendarId" }) => unknown;
};

type RequestHandlingMode = "sync" | "unsynced";

const VISIBLE_HOUR_OPTIONS = ["auto", ...Array.from({ length: 24 }, (_, index) => index + 1)];
const logPendingEvents = action("pending-events");

function resolveEventMapKey(
  events: Map<string, CalendarEvent>,
  envelope: { eventId?: string; calendarId?: string; recurrenceId?: string }
): string | undefined {
  const eventId = envelope.eventId;
  if (!eventId) return undefined;
  if (events.has(eventId)) return eventId;
  let fallbackSeriesKey: string | undefined;
  for (const [key, event] of events.entries()) {
    if (event.eventId !== eventId) continue;
    if (envelope.calendarId !== undefined && event.calendarId !== envelope.calendarId) continue;
    if (envelope.recurrenceId === undefined || event.recurrenceId === envelope.recurrenceId) return key;
    if (event.recurrenceId === undefined && fallbackSeriesKey === undefined) {
      fallbackSeriesKey = key;
    }
  }
  return fallbackSeriesKey;
}

function isSameSeries(event: CalendarEvent, envelope: { eventId?: string; calendarId?: string }): boolean {
  if (!envelope.eventId) return false;
  if (event.eventId !== envelope.eventId) return false;
  if (envelope.calendarId !== undefined && event.calendarId !== envelope.calendarId) return false;
  return true;
}

function resolveSeriesEventKeys(
  events: Map<string, CalendarEvent>,
  envelope: { eventId?: string; calendarId?: string }
): string[] {
  return Array.from(events.entries())
    .filter(([, event]) => isSameSeries(event, envelope))
    .map(([key]) => key);
}

function computeDateValueShift(
  from: CalendarEvent["start"],
  to: CalendarEvent["start"]
): Temporal.Duration | null {
  if (from instanceof Temporal.PlainDate && to instanceof Temporal.PlainDate) {
    return from.until(to, { largestUnit: "day" });
  }
  if (from instanceof Temporal.PlainDateTime && to instanceof Temporal.PlainDateTime) {
    return from.until(to, { largestUnit: "day" });
  }
  if (from instanceof Temporal.ZonedDateTime && to instanceof Temporal.ZonedDateTime) {
    return from.until(to, { largestUnit: "day" });
  }
  return null;
}

function applyDateValueShift(
  value: CalendarEvent["start"],
  shift: Temporal.Duration | null
): CalendarEvent["start"] {
  if (!shift) return value;
  if (value instanceof Temporal.PlainDate) return value.add(shift);
  if (value instanceof Temporal.PlainDateTime) return value.add(shift);
  if (value instanceof Temporal.ZonedDateTime) return value.add(shift);
  return value;
}

function parseRecurrenceStart(
  recurrenceId: string,
  template: CalendarEvent["start"]
): CalendarEvent["start"] | null {
  const dateMatch = /^(\d{4})(\d{2})(\d{2})$/.exec(recurrenceId);
  if (dateMatch) {
    const [, year, month, day] = dateMatch;
    const plainDate = Temporal.PlainDate.from({
      year: Number(year),
      month: Number(month),
      day: Number(day),
    });
    if (template instanceof Temporal.PlainDate) return plainDate;
    const plainDateTime = plainDate.toPlainDateTime({
      hour: template.hour,
      minute: template.minute,
      second: template.second,
    });
    if (template instanceof Temporal.PlainDateTime) return plainDateTime;
    return plainDateTime.toZonedDateTime(template.timeZoneId);
  }

  const dateTimeMatch = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/.exec(recurrenceId);
  if (!dateTimeMatch) return null;
  const [, year, month, day, hour, minute, second] = dateTimeMatch;
  const plainDateTime = Temporal.PlainDateTime.from({
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
  });
  if (template instanceof Temporal.PlainDate) return plainDateTime.toPlainDate();
  if (template instanceof Temporal.PlainDateTime) return plainDateTime;
  return plainDateTime.toZonedDateTime(template.timeZoneId);
}

function withExcludedRecurrence(
  event: CalendarEvent,
  recurrenceId: string,
  pendingOp: CalendarEvent["pendingOp"]
): CalendarEvent {
  const exclusionDates = new Set(event.exclusionDates ?? []);
  exclusionDates.add(recurrenceId);
  return {
    ...event,
    exclusionDates,
    pendingOp,
  };
}

function summarizePendingGroups(pendingEvents: CalendarEventPendingGroups) {
  const summarize = (entries: Map<string, CalendarEvent> | undefined) =>
    Array.from(entries?.entries() ?? []).map(([id, event]) => ({
      id,
      eventId: event.eventId,
      summary: event.summary,
      pendingOp: event.pendingOp,
    }));
  return {
    created: summarize(pendingEvents.get("created")),
    updated: summarize(pendingEvents.get("updated")),
    deleted: summarize(pendingEvents.get("deleted")),
  };
}

function reportPendingEvents(el: StoryEventCalendarElement, reason: string) {
  const pendingEvents = el.getPendingEvents({ groupBy: "pendingOp" }) as CalendarEventPendingGroups;
  logPendingEvents({
    reason,
    pendingEvents: summarizePendingGroups(pendingEvents),
  });
}

function attachUnsyncedRequestEventHandlers(el: StoryEventCalendarElement) {
  el.addEventListener("event-create-requested", (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const detail = event.detail as EventCreateRequestDetail | null;
    if (!detail?.content.start || !detail.content.end) return;

    const id = `pending-created-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const nextEvents = new Map(el.events);
    nextEvents.set(id, {
      eventId: id,
      calendarId: detail.envelope.calendarId,
      start: detail.content.start,
      end: detail.content.end,
      summary: detail.content.summary ?? "New event",
      color: detail.content.color ?? "#0ea5e9",
      pendingOp: "created",
    });
    el.events = nextEvents;
    reportPendingEvents(el, "create");
  });

  el.addEventListener("event-update-requested", (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const detail = event.detail as EventUpdateRequestDetail | null;
    if (!detail?.envelope.eventId) return;

    const eventKey = resolveEventMapKey(el.events, detail.envelope);
    if (!eventKey) return;
    const current = el.events.get(eventKey);
    if (!current) return;
    const isRecurring = detail.envelope.isRecurring ?? isCalendarEventRecurring(current);
    const shouldPromptForSeries =
      isRecurring && !(detail.envelope.isException ?? isCalendarEventException(current));
    const nextStartForCurrent = detail.content.start ?? current.start;
    const nextEndForCurrent = detail.content.end ?? current.end;
    const occurrenceStart =
      current.recurrenceRule && !current.recurrenceId && detail.envelope.recurrenceId
        ? parseRecurrenceStart(detail.envelope.recurrenceId, current.start) ?? current.start
        : current.start;
    const baseDuration = computeDateValueShift(current.start, current.end);
    const occurrenceEnd = applyDateValueShift(occurrenceStart, baseDuration);
    const startShift = computeDateValueShift(occurrenceStart, nextStartForCurrent);
    const endShift = computeDateValueShift(occurrenceEnd, nextEndForCurrent);

    const nextEvents = new Map(el.events);
    if (isRecurring && shouldPromptForSeries) {
      const commitSeries = window.confirm(
        "Apply changes to the whole series?\n\nOK = series\nCancel = only this instance"
      );
      if (commitSeries) {
        const seriesKeys = resolveSeriesEventKeys(nextEvents, {
          calendarId: current.calendarId,
          eventId: current.eventId,
        });
        for (const key of seriesKeys) {
          const seriesEvent = nextEvents.get(key);
          if (!seriesEvent || isCalendarEventException(seriesEvent)) continue;
          nextEvents.set(key, {
            ...seriesEvent,
            start: applyDateValueShift(seriesEvent.start, startShift),
            end: applyDateValueShift(seriesEvent.end, endShift),
            summary: detail.content.summary ?? seriesEvent.summary,
            color: detail.content.color ?? seriesEvent.color,
            pendingOp: seriesEvent.pendingOp === "created" ? "created" : "updated",
          });
        }
        el.events = nextEvents;
        reportPendingEvents(el, "update-series");
        return;
      }
    }

    const nextPendingOp = current.pendingOp === "created" ? "created" : "updated";
    const recurrenceId = detail.envelope.recurrenceId;
    if (isRecurring && recurrenceId && current.recurrenceRule && !current.recurrenceId) {
      nextEvents.set(eventKey, withExcludedRecurrence(current, recurrenceId, nextPendingOp));
      nextEvents.set(`${eventKey}::${recurrenceId}`, {
        ...current,
        recurrenceId,
        start: nextStartForCurrent,
        end: nextEndForCurrent,
        summary: detail.content.summary ?? current.summary,
        color: detail.content.color ?? current.color,
        pendingOp: nextPendingOp,
        isException: true,
      });
      el.events = nextEvents;
      reportPendingEvents(el, "update-instance");
      return;
    }

    nextEvents.set(eventKey, {
      ...current,
      start: nextStartForCurrent,
      end: nextEndForCurrent,
      summary: detail.content.summary ?? current.summary,
      color: detail.content.color ?? current.color,
      // Keep creates as creates; persisted events become pending updates.
      pendingOp: nextPendingOp,
      isException: isRecurring ? true : current.isException,
    });
    el.events = nextEvents;
    reportPendingEvents(el, "update");
  });

  el.addEventListener("event-delete-requested", (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const detail = event.detail as EventDeleteRequestDetail | null;
    if (!detail) return;

    const eventKey = resolveEventMapKey(el.events, detail.envelope);
    if (!eventKey) return;
    const current = el.events.get(eventKey);
    if (!current) return;
    const isRecurring = detail.envelope.isRecurring ?? isCalendarEventRecurring(current);
    const shouldPromptForSeries =
      isRecurring && !(detail.envelope.isException ?? isCalendarEventException(current));

    const nextEvents = new Map(el.events);
    if (isRecurring && shouldPromptForSeries) {
      const commitSeries = window.confirm(
        "Delete the whole series?\n\nOK = series\nCancel = only this instance"
      );
      if (commitSeries) {
        const seriesKeys = resolveSeriesEventKeys(nextEvents, {
          calendarId: current.calendarId,
          eventId: current.eventId,
        });
        for (const key of seriesKeys) {
          const seriesEvent = nextEvents.get(key);
          if (!seriesEvent) continue;
          nextEvents.set(key, {
            ...seriesEvent,
            pendingOp: "deleted",
          });
        }
        el.events = nextEvents;
        reportPendingEvents(el, "delete-series");
        return;
      }
    } else {
      const doDelete = confirm("Are you sure you want to delete this event?");
      if (!doDelete) {
        event.preventDefault();
        return;
      }
    }

    const recurrenceId = detail.envelope.recurrenceId;
    if (isRecurring && recurrenceId && current.recurrenceRule && !current.recurrenceId) {
      const nextPendingOp = current.pendingOp === "created" ? "created" : "updated";
      nextEvents.set(eventKey, withExcludedRecurrence(current, recurrenceId, nextPendingOp));
      nextEvents.delete(`${eventKey}::${recurrenceId}`);
      el.events = nextEvents;
      reportPendingEvents(el, "delete-instance");
      return;
    }

    nextEvents.set(eventKey, {
      ...current,
      pendingOp: "deleted",
      isException: isRecurring ? true : current.isException,
    });
    el.events = nextEvents;
    reportPendingEvents(el, "delete");
  });
}

function renderCalendar(args: Record<string, unknown>, mode: RequestHandlingMode = "sync") {
  const el = document.createElement("event-calendar") as StoryEventCalendarElement;
  el.style.display = "block";
  el.style.width = "100%";
  el.style.height = "100%";

  el.setAttribute("view", String(args.view ?? "month"));
  el.setAttribute("presentation", String(args.presentation ?? "grid"));
  if (args.startDate) {
    el.setAttribute("start-date", String(args.startDate));
  }
  if (typeof args.weekStart === "number") {
    el.setAttribute("week-start", String(args.weekStart));
  } else if (args.weekStart === AUTO_WEEK_START_OPTION) {
    el.removeAttribute("week-start");
  }
  el.setAttribute("days-per-week", String(args.daysPerWeek));
  if (args.lang && args.lang !== AUTO_LOCALE_OPTION) {
    el.setAttribute("lang", String(args.lang));
  } else {
    el.removeAttribute("lang");
  }
  if (args.timezone) {
    el.setAttribute("timezone", String(args.timezone));
  }
  if (args.currentTime) {
    el.setAttribute("current-time", String(args.currentTime));
  }
  el.setAttribute("snap-interval", String(args.snapInterval));
  if (args.visibleHours === "auto" || args.visibleHours === undefined || args.visibleHours === null) {
    el.removeAttribute("visible-hours");
  } else {
    el.setAttribute("visible-hours", String(args.visibleHours));
  }
  if (args.defaultEventSummary) {
    el.setAttribute("default-event-summary", String(args.defaultEventSummary));
  }
  if (args.defaultEventColor) {
    el.setAttribute("default-event-color", String(args.defaultEventColor));
  }
  if (args.defaultCalendarId) {
    el.setAttribute("default-source-id", String(args.defaultCalendarId));
  } else {
    el.removeAttribute("default-source-id");
  }

  const entries = Array.isArray(args.events) ? args.events : sampleEvents;
  el.events = new Map(entries as Array<[string, CalendarEvent]>);

  if (mode === "unsynced") {
    attachUnsyncedRequestEventHandlers(el);
    reportPendingEvents(el, "initial");
  } else {
    attachRequestEventHandlers(el, { preserveDateOnlyShape: true });
  }

  return el;
}

const meta: Meta = {
  title: "Calendar/EventCalendar",
  component: "event-calendar",
  tags: ["autodocs"],
  parameters: {
    cssprops: calendarCssProps,
  },
  argTypes: {
    view: {
      control: "inline-radio",
      options: ["day", "week", "month", "year"],
    },
    presentation: {
      control: "inline-radio",
      options: ["grid", "list"],
    },
    startDate: { control: "text", description: "Anchor date (YYYY-MM-DD)" },
    weekStart: {
      control: {
        type: "select",
        labels: weekStartControlLabels,
      },
      options: weekStartControlOptions,
    },
    daysPerWeek: { control: { type: "number", min: 1, max: 7, step: 1 } },
    lang: {
      control: { type: "select", labels: langControlLabels },
      options: langControlOptions,
      description: "Locale",
    },
    timezone: {
      control: "select",
      options: timezoneOptions,
      description: "IANA timezone",
    },
    currentTime: { control: "text", description: "Current time (ISO string)" },
    snapInterval: { control: { type: "number", min: 5, max: 60, step: 5 } },
    visibleHours: {
      control: { type: "select" },
      options: VISIBLE_HOUR_OPTIONS,
    },
    defaultEventSummary: { control: "text", description: "Default created event summary" },
    defaultEventColor: { control: "color", description: "Default created event color" },
    defaultCalendarId: { control: "text", description: "Default created event source id" },
  },
  args: {
    view: "month",
    presentation: "grid",
    startDate: "2025-01-15",
    weekStart: AUTO_WEEK_START_OPTION,
    daysPerWeek: 7,
    lang: AUTO_LOCALE_OPTION,
    timezone: "Europe/Amsterdam",
    currentTime: "2025-01-15T14:30:00",
    snapInterval: 15,
    visibleHours: 12,
    defaultEventSummary: "New event",
    defaultEventColor: "#0ea5e9",
    defaultCalendarId: "",
    events: sampleEvents,
  },
  render: (args) => renderCalendar(args),
};

export default meta;

type Story = StoryObj;

export const Default: Story = {};

export const Week: Story = {
  args: {
    view: "week",
  },
};

export const ThreeDayWeek: Story = {
  args: {
    view: "week",
    daysPerWeek: 3,
  },
};

export const Day: Story = {
  args: {
    view: "day",
  },
};

export const Year: Story = {
  args: {
    view: "year",
  },
};

export const MonthList: Story = {
  args: {
    presentation: "list",
  },
};

export const WeekList: Story = {
  args: {
    view: "week",
    presentation: "list",
  },
};

export const PendingEventsUnsynced: Story = {
  name: "Pending Events (Unsynced)",
  parameters: {
    docs: {
      description: {
        story:
          "No backend sync. Create/update/delete requests are stored as optimistic local changes so `pendingEvents` remains inspectable.",
      },
    },
  },
  render: (args) => renderCalendar(args, "unsynced"),
};
