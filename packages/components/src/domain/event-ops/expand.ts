import { Temporal } from "@js-temporal/polyfill";
import type { CalendarEventDateValue, CalendarEventViewMap } from "../../types/CalendarEvent.js";
import { collectDetachedExceptionKeys, isExcludedOccurrence, toPlainDateTime, toRecurrenceId } from "./recurrence.js";

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

function addByFrequency(
  value: Temporal.PlainDateTime,
  frequency: "SECONDLY" | "MINUTELY" | "HOURLY" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY",
  interval: number
): Temporal.PlainDateTime {
  if (frequency === "SECONDLY") return value.add({ seconds: interval });
  if (frequency === "MINUTELY") return value.add({ minutes: interval });
  if (frequency === "HOURLY") return value.add({ hours: interval });
  if (frequency === "DAILY") return value.add({ days: interval });
  if (frequency === "WEEKLY") return value.add({ weeks: interval });
  if (frequency === "MONTHLY") return value.add({ months: interval });
  return value.add({ years: interval });
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
      const recurrenceRule = event.recurrenceRule;
      const baseStart = toPlainDateTime(event.start, options.timezone);
      const baseEnd = toPlainDateTime(event.end, options.timezone);
      if (Temporal.PlainDateTime.compare(baseEnd, baseStart) <= 0) continue;

      const interval = Math.max(1, recurrenceRule.interval ?? 1);
      const until =
        "until" in recurrenceRule && recurrenceRule.until
          ? toPlainDateTime(recurrenceRule.until, options.timezone)
          : undefined;
      const count = "count" in recurrenceRule ? recurrenceRule.count : undefined;

      let generated = 0;
      let occurrenceStart = baseStart;
      let occurrenceEnd = baseEnd;

      while (true) {
        if (count !== undefined && generated >= count) break;
        if (until && Temporal.PlainDateTime.compare(occurrenceStart, until) > 0) break;
        if (Temporal.PlainDateTime.compare(occurrenceStart, rangeEnd) >= 0) break;

        const recurrenceId = toRecurrenceId(occurrenceStart, event.start);
        const hasDetachedException =
          Boolean(event.eventId) && detachedExceptionKeys.has(`${event.eventId}::${recurrenceId}`);
        if (
          !isExcludedOccurrence(event, recurrenceId) &&
          !hasDetachedException &&
          rangeOverlaps(occurrenceStart, occurrenceEnd, rangeStart, rangeEnd)
        ) {
          renderedEvents.set(`${id}::${recurrenceId}`, {
            ...event,
            recurrenceId,
            start: fromPlainDateTime(occurrenceStart, event.start),
            end: fromPlainDateTime(occurrenceEnd, event.end),
          });
        }

        generated += 1;
        const nextStart = addByFrequency(occurrenceStart, recurrenceRule.freq, interval);
        const nextEnd = addByFrequency(occurrenceEnd, recurrenceRule.freq, interval);
        if (Temporal.PlainDateTime.compare(nextStart, occurrenceStart) <= 0) break;
        occurrenceStart = nextStart;
        occurrenceEnd = nextEnd;
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

