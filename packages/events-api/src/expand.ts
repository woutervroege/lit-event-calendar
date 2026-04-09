import { Temporal } from "@js-temporal/polyfill";
import type { CalendarEventDateValue, CalendarEventViewMap } from "./calendar-types.js";
import { collectDetachedExceptionKeys, toPlainDateTime, toRecurrenceId } from "./recurrence.js";
import { expandRecurringStarts } from "./rrule-adapter.js";

type ExpandEventsRange = {
  start: CalendarEventDateValue;
  end: CalendarEventDateValue;
};

type ExpandEventsOptions = {
  timezone?: string;
};

function fromPlainDateTime(
  value: Temporal.PlainDateTime,
  template: CalendarEventDateValue
): CalendarEventDateValue {
  if (template instanceof Temporal.PlainDate) return value.toPlainDate();
  if (template instanceof Temporal.ZonedDateTime) return value.toZonedDateTime(template.timeZoneId);
  return value;
}

function rangeOverlaps(
  start: Temporal.PlainDateTime,
  end: Temporal.PlainDateTime,
  rangeStart: Temporal.PlainDateTime,
  rangeEnd: Temporal.PlainDateTime
): boolean {
  if (Temporal.PlainDateTime.compare(end, start) <= 0) return false;
  return (
    Temporal.PlainDateTime.compare(start, rangeEnd) < 0 &&
    Temporal.PlainDateTime.compare(end, rangeStart) > 0
  );
}

export function expandEvents(
  events: CalendarEventViewMap,
  range: ExpandEventsRange,
  options: ExpandEventsOptions = {}
): CalendarEventViewMap {
  const rangeStart = toPlainDateTime(range.start, options.timezone);
  const rangeEnd = toPlainDateTime(range.end, options.timezone);
  if (Temporal.PlainDateTime.compare(rangeEnd, rangeStart) <= 0) return new Map();

  const detachedExceptionKeys = collectDetachedExceptionKeys(events);
  const renderedEvents: CalendarEventViewMap = new Map();

  for (const [id, event] of events) {
    if (event.pendingOp === "deleted") continue;
    if (event.recurrenceRule && !event.recurrenceId) {
      const baseStart = toPlainDateTime(event.start, options.timezone);
      const baseEnd = toPlainDateTime(event.end, options.timezone);
      if (Temporal.PlainDateTime.compare(baseEnd, baseStart) <= 0) continue;
      const baseDuration = baseStart.until(baseEnd);
      const occurrenceStarts = expandRecurringStarts(event, rangeStart, rangeEnd, {
        timezone: options.timezone,
      });

      for (const occurrenceStart of occurrenceStarts) {
        const recurrenceId = toRecurrenceId(occurrenceStart, event.start);
        const hasDetachedException =
          Boolean(event.eventId) && detachedExceptionKeys.has(`${event.eventId}::${recurrenceId}`);
        if (hasDetachedException) continue;
        const occurrenceEnd = occurrenceStart.add(baseDuration);
        if (!rangeOverlaps(occurrenceStart, occurrenceEnd, rangeStart, rangeEnd)) continue;
        renderedEvents.set(`${id}::${recurrenceId}`, {
          ...event,
          recurrenceId,
          start: fromPlainDateTime(occurrenceStart, event.start),
          end: fromPlainDateTime(occurrenceEnd, event.end),
        });
      }
      continue;
    }

    const start = toPlainDateTime(event.start, options.timezone);
    const end = toPlainDateTime(event.end, options.timezone);
    if (!rangeOverlaps(start, end, rangeStart, rangeEnd)) continue;
    renderedEvents.set(id, event);
  }
  return renderedEvents;
}
