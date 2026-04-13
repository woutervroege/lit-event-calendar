import { Temporal } from "@js-temporal/polyfill";
import type { CalendarEventDateValue } from "./calendar-types.js";
import type { CalendarEvent, CalendarEventsMap, CalendarEventTimeSpan } from "./state-types.js";

export function toPlainDateTime(value: CalendarEventDateValue, timezone?: string): Temporal.PlainDateTime {
  if (value instanceof Temporal.ZonedDateTime) {
    return timezone ? value.withTimeZone(timezone).toPlainDateTime() : value.toPlainDateTime();
  }
  if (value instanceof Temporal.PlainDateTime) return value;
  return value.toPlainDateTime({ hour: 0, minute: 0, second: 0 });
}

export function toRecurrenceId(
  value: CalendarEventDateValue | Temporal.PlainDateTime,
  template: CalendarEventDateValue
): string {
  const plainDateTime = value instanceof Temporal.PlainDateTime ? value : toPlainDateTime(value);
  const pad = (segment: number) => String(segment).padStart(2, "0");
  const date = `${plainDateTime.year}${pad(plainDateTime.month)}${pad(plainDateTime.day)}`;
  if (template instanceof Temporal.PlainDate) return date;
  return `${date}T${pad(plainDateTime.hour)}${pad(plainDateTime.minute)}${pad(plainDateTime.second)}`;
}

export function parseRecurrenceId(
  recurrenceId: string,
  template: CalendarEventDateValue
): CalendarEventDateValue | null {
  const dateMatch = /^(\d{4})(\d{2})(\d{2})$/.exec(recurrenceId);
  if (dateMatch) {
    const [, year, month, day] = dateMatch;
    const plainDate = Temporal.PlainDate.from({
      year: Number(year),
      month: Number(month),
      day: Number(day),
    });
    if (template instanceof Temporal.PlainDate) return plainDate;
    const baseTime =
      template instanceof Temporal.ZonedDateTime ? template.toPlainDateTime() : template;
    const plainDateTime = plainDate.toPlainDateTime({
      hour: baseTime.hour,
      minute: baseTime.minute,
      second: baseTime.second,
    });
    if (template instanceof Temporal.ZonedDateTime) {
      return plainDateTime.toZonedDateTime(template.timeZoneId);
    }
    return plainDateTime;
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
  if (template instanceof Temporal.ZonedDateTime) {
    return plainDateTime.toZonedDateTime(template.timeZoneId);
  }
  return plainDateTime;
}

export function isDetachedException(event: CalendarEvent): boolean {
  if (event.isException === true) return true;
  if (!event.recurrenceId) return false;
  if (isExcludedOccurrence(event, event.recurrenceId)) return false;
  return !Boolean(event.recurrenceRule);
}

export function isExcludedOccurrence(master: CalendarEvent, recurrenceId: string): boolean {
  return Boolean(master.exclusionDates?.has(recurrenceId));
}

export function collectDetachedExceptionKeys(events: CalendarEventsMap): Set<string> {
  const detachedExceptionKeys = new Set<string>();
  for (const [, event] of events) {
    if (event.pendingOp === "deleted") continue;
    if (!event.eventId || !event.recurrenceId) continue;
    detachedExceptionKeys.add(`${event.eventId}::${event.recurrenceId}`);
  }
  return detachedExceptionKeys;
}

export function shiftDateValue(
  value: CalendarEventDateValue,
  shift: Temporal.Duration | null
): CalendarEventDateValue {
  if (!shift) return value;
  if (value instanceof Temporal.PlainDate) return value.add(shift);
  if (value instanceof Temporal.PlainDateTime) return value.add(shift);
  return value.add(shift);
}

export function resolveEventEnd(
  event: Pick<CalendarEvent, "start"> & CalendarEventTimeSpan
): CalendarEventDateValue {
  if ("end" in event && event.end !== undefined) return event.end;
  return shiftDateValue(event.start, event.duration);
}

export function shiftExclusionDates(
  event: CalendarEvent,
  shift: Temporal.Duration | null
): Set<string> | undefined {
  if (!event.exclusionDates?.size) return event.exclusionDates;
  if (!shift) return event.exclusionDates;
  const shifted = new Set<string>();
  for (const recurrenceId of event.exclusionDates) {
    const parsed = parseRecurrenceId(recurrenceId, event.start);
    if (!parsed) {
      shifted.add(recurrenceId);
      continue;
    }
    shifted.add(toRecurrenceId(shiftDateValue(parsed, shift), event.start));
  }
  return shifted;
}

export function shiftRecurrenceId(
  recurrenceId: string | undefined,
  template: CalendarEventDateValue,
  shift: Temporal.Duration | null
): string | undefined {
  if (!recurrenceId || !shift) return recurrenceId;
  const parsed = parseRecurrenceId(recurrenceId, template);
  if (!parsed) return recurrenceId;
  return toRecurrenceId(shiftDateValue(parsed, shift), template);
}
