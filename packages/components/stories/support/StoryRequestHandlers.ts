import { Temporal } from "@js-temporal/polyfill";
import { action } from "storybook/actions";
import { isCalendarEventException, isCalendarEventRecurring } from "../../src/types/CalendarEvent.js";
import type {
  EventCreateRequestDetail,
  EventDeleteRequestDetail,
  EventSelectionRequestDetail,
  EventUpdateRequestDetail,
} from "../../src/types/CalendarEventRequests.js";
import type { CalendarEvent } from "./StoryData.js";

type StoryCalendarElement = HTMLElement & { events: Map<string, CalendarEvent> };

type AttachRequestHandlersOptions = {
  preserveDateOnlyShape?: boolean;
};

const logCreateRequested = action("event-create-requested");
const logCreateCancelled = action("event-create-requested (cancelled)");
const logUpdateRequested = action("event-update-requested");
const logUpdateCommittedInstance = action("event-update-committed-instance");
const logUpdateCommittedSeries = action("event-update-committed-series");
const logDeleteRequested = action("event-delete-requested");
const logDeleteCommittedInstance = action("event-delete-committed-instance");
const logDeleteCommittedSeries = action("event-delete-committed-series");
const logDeleteCancelled = action("event-delete-requested (cancelled)");
const logSelectionRequested = action("event-selection-requested");

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

function isSameSeries(
  event: CalendarEvent,
  envelope: { eventId?: string; calendarId?: string }
): boolean {
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

function preserveDateOnlyShape(
  nextValue: CalendarEvent["start"] | null | undefined,
  currentValue: CalendarEvent["start"]
): CalendarEvent["start"] {
  if (!nextValue) return currentValue;
  if (currentValue instanceof Temporal.PlainDate) {
    if ("toPlainDate" in nextValue) {
      return nextValue.toPlainDate();
    }
    return nextValue;
  }
  return nextValue;
}

function toNextEventValue(
  nextValue: CalendarEvent["start"] | undefined,
  currentValue: CalendarEvent["start"],
  preserveDateOnly: boolean
): CalendarEvent["start"] {
  if (!nextValue) return currentValue;
  return preserveDateOnly ? preserveDateOnlyShape(nextValue, currentValue) : nextValue;
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
  pendingOp?: CalendarEvent["pendingOp"]
): CalendarEvent {
  const exclusionDates = new Set(event.exclusionDates ?? []);
  exclusionDates.add(recurrenceId);
  return {
    ...event,
    exclusionDates,
    pendingOp: pendingOp ?? event.pendingOp,
  };
}

export function attachRequestEventHandlers(
  el: StoryCalendarElement,
  options: AttachRequestHandlersOptions = {}
) {
  const preserveDateOnly = options.preserveDateOnlyShape ?? false;

  el.addEventListener("event-selection-requested", (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const detail = event.detail as EventSelectionRequestDetail | null;
    if (!detail?.envelope.eventId) return;
    logSelectionRequested(detail);
    console.info("event-selection-requested", detail);
  });

  el.addEventListener("event-create-requested", (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const detail = event.detail as EventCreateRequestDetail | null;
    if (!detail?.content.start || !detail.content.end) return;
    logCreateRequested(detail);

    const eventId = `event-created-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const optimisticEvents = new Map(el.events);
    optimisticEvents.set(eventId, {
      eventId,
      start: detail.content.start,
      end: detail.content.end,
      summary: detail.content.summary ?? "New event",
      color: detail.content.color ?? "#0ea5e9",
      calendarId: detail.envelope.calendarId,
      pendingOp: "created",
    });
    el.events = optimisticEvents;

    const committedSummary = window.prompt("Event title", detail.content.summary ?? "New event");
    if (committedSummary === null) {
      event.preventDefault();
      logCreateCancelled(detail);
      const rolledBackEvents = new Map(el.events);
      rolledBackEvents.delete(eventId);
      el.events = rolledBackEvents;
      return;
    }

    window.setTimeout(() => {
      const committedEvents = new Map(el.events);
      const created = committedEvents.get(eventId);
      if (!created) return;
      committedEvents.set(eventId, {
        ...created,
        summary: committedSummary,
        pendingOp: undefined,
      });
      el.events = committedEvents;
    }, 300);
  });

  el.addEventListener("event-update-requested", (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const detail = event.detail as EventUpdateRequestDetail | null;
    if (!detail?.envelope.eventId) return;
    logUpdateRequested(detail);

    const eventKey = resolveEventMapKey(el.events, detail.envelope);
    if (!eventKey) return;
    const current = el.events.get(eventKey);
    if (!current) return;
    const isRecurring = detail.envelope.isRecurring ?? isCalendarEventRecurring(current);
    const shouldPromptForSeries =
      isRecurring && !(detail.envelope.isException ?? isCalendarEventException(current));
    const nextStartForCurrent = toNextEventValue(detail.content.start, current.start, preserveDateOnly);
    const nextEndForCurrent = toNextEventValue(detail.content.end, current.end, preserveDateOnly);
    const occurrenceStart =
      current.recurrenceRule && !current.recurrenceId && detail.envelope.recurrenceId
        ? parseRecurrenceStart(detail.envelope.recurrenceId, current.start) ?? current.start
        : current.start;
    const baseDuration = computeDateValueShift(current.start, current.end);
    const occurrenceEnd = applyDateValueShift(occurrenceStart, baseDuration);
    const startShift = computeDateValueShift(occurrenceStart, nextStartForCurrent);
    const endShift = computeDateValueShift(occurrenceEnd, nextEndForCurrent);
    const applySharedUpdate = (targetEvent: CalendarEvent): CalendarEvent => ({
      ...targetEvent,
      summary: detail.content.summary ?? targetEvent.summary,
      color: detail.content.color ?? targetEvent.color,
      calendarId: detail.envelope.calendarId ?? targetEvent.calendarId,
      isException: detail.envelope.isException ?? targetEvent.isException,
    });
    if (!isRecurring || !shouldPromptForSeries) {
      const committedDetail: EventUpdateRequestDetail = {
        ...detail,
        envelope: {
          ...detail.envelope,
          recurrenceId: detail.envelope.recurrenceId ?? current.recurrenceId,
        },
      };
      logUpdateCommittedInstance(committedDetail);
      const recurrenceId = detail.envelope.recurrenceId;
      if (isRecurring && recurrenceId && current.recurrenceRule && !current.recurrenceId) {
        const nextEvents = new Map(el.events);
        nextEvents.set(eventKey, withExcludedRecurrence(current, recurrenceId));
        nextEvents.set(`${eventKey}::${recurrenceId}`, {
          ...applySharedUpdate(current),
          recurrenceId,
          start: nextStartForCurrent,
          end: nextEndForCurrent,
          isException: true,
        });
        el.events = nextEvents;
        return;
      }
      el.events = new Map(el.events).set(eventKey, {
        ...applySharedUpdate(current),
        start: nextStartForCurrent,
        end: nextEndForCurrent,
      });
      return;
    }

    const commitSeries = window.confirm(
      "Apply changes to the whole series?\n\nOK = series\nCancel = only this instance"
    );
    const nextEvents = new Map(el.events);
    if (commitSeries) {
      const committedDetail: EventUpdateRequestDetail = {
        ...detail,
        envelope: {
          ...detail.envelope,
          recurrenceId: undefined,
          isException: false,
        },
      };
      logUpdateCommittedSeries(committedDetail);
      const seriesKeys = resolveSeriesEventKeys(nextEvents, {
        calendarId: current.calendarId,
        eventId: current.eventId,
      });
      for (const key of seriesKeys) {
        const seriesEvent = nextEvents.get(key);
        if (!seriesEvent) continue;
        if (seriesEvent.isException) continue;
        nextEvents.set(key, {
          ...applySharedUpdate(seriesEvent),
          start: applyDateValueShift(seriesEvent.start, startShift),
          end: applyDateValueShift(seriesEvent.end, endShift),
          isException: false,
        });
      }
      el.events = nextEvents;
      return;
    }

    const committedDetail: EventUpdateRequestDetail = {
      ...detail,
      envelope: {
        ...detail.envelope,
        recurrenceId: detail.envelope.recurrenceId ?? current.recurrenceId,
        isException: true,
      },
    };
    logUpdateCommittedInstance(committedDetail);
    const recurrenceId = detail.envelope.recurrenceId;
    if (recurrenceId && current.recurrenceRule && !current.recurrenceId) {
      nextEvents.set(eventKey, withExcludedRecurrence(current, recurrenceId));
      nextEvents.set(`${eventKey}::${recurrenceId}`, {
        ...applySharedUpdate(current),
        recurrenceId,
        start: nextStartForCurrent,
        end: nextEndForCurrent,
        isException: true,
      });
      el.events = nextEvents;
      return;
    }
    nextEvents.set(eventKey, {
      ...applySharedUpdate(current),
      start: nextStartForCurrent,
      end: nextEndForCurrent,
      isException: true,
    });
    el.events = nextEvents;
  });

  el.addEventListener("event-delete-requested", (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const detail = event.detail as EventDeleteRequestDetail | null;
    if (!detail) return;
    const eventKey = detail ? resolveEventMapKey(el.events, detail.envelope) : undefined;
    if (!eventKey) return;
    const current = el.events.get(eventKey);
    if (!current) return;
    logDeleteRequested(detail);
    const isRecurring = detail?.envelope.isRecurring ?? isCalendarEventRecurring(current);
    const shouldPromptForSeries =
      isRecurring && !(detail.envelope.isException ?? isCalendarEventException(current));

    const nextEvents = new Map(el.events);
    if (isRecurring && shouldPromptForSeries) {
      const commitSeries = window.confirm(
        "Delete the whole series?\n\nOK = series\nCancel = only this instance"
      );
      if (commitSeries) {
        const committedDetail: EventDeleteRequestDetail = {
          envelope: {
            ...detail.envelope,
            recurrenceId: undefined,
          },
        };
        logDeleteCommittedSeries(committedDetail);
        const seriesKeys = resolveSeriesEventKeys(nextEvents, {
          calendarId: current.calendarId,
          eventId: current.eventId,
        });
        for (const key of seriesKeys) {
          nextEvents.delete(key);
        }
        el.events = nextEvents;
        return;
      }

      const committedDetail: EventDeleteRequestDetail = {
        envelope: {
          ...detail.envelope,
          recurrenceId: detail.envelope.recurrenceId ?? current.recurrenceId,
        },
      };
      logDeleteCommittedInstance(committedDetail);
      const recurrenceId = detail.envelope.recurrenceId;
      if (recurrenceId && current.recurrenceRule && !current.recurrenceId) {
        nextEvents.set(eventKey, withExcludedRecurrence(current, recurrenceId));
        nextEvents.delete(`${eventKey}::${recurrenceId}`);
        el.events = nextEvents;
        return;
      }
      nextEvents.set(eventKey, {
        ...current,
        pendingOp: "deleted",
        isException: true,
      });
      el.events = nextEvents;
      return;
    }

    const doDelete = confirm("Are you sure you want to delete this event?");
    if (!doDelete) {
      event.preventDefault();
      logDeleteCancelled(detail);
      return;
    }
    const committedDetail: EventDeleteRequestDetail = {
      envelope: {
        ...detail.envelope,
        recurrenceId: detail.envelope.recurrenceId ?? current.recurrenceId,
      },
    };
    logDeleteCommittedInstance(committedDetail);
    nextEvents.delete(eventKey);
    el.events = nextEvents;
  });
}
