import type {
  CalendarEventDateValue,
  CalendarExclusionDates,
  CalendarRecurrenceRule,
} from "./calendar-types.js";
import type { Temporal } from "@js-temporal/polyfill";

export type CalendarEventPendingOperation = "created" | "updated" | "deleted";

export type CalendarEventEnvelope = {
  calendarId?: string;
  eventId?: string;
  recurrenceId?: string;
  isRecurring?: boolean;
  isException?: boolean;
  pendingOp?: CalendarEventPendingOperation;
};

export type CalendarEventData = {
  start: CalendarEventDateValue;
  summary: string;
  color: string;
  location?: string;
  recurrenceRule?: CalendarRecurrenceRule;
  exclusionDates?: CalendarExclusionDates;
} & CalendarEventTimeSpan;

export type CalendarEventTimeSpan =
  | {
      end: CalendarEventDateValue;
      duration?: never;
    }
  | {
      duration: Temporal.Duration;
      end?: never;
    };

export type CalendarEvent = CalendarEventEnvelope & CalendarEventData;
export type CalendarEventRecord = CalendarEvent & {
  key: string;
};
export type CalendarEventsMap = Map<string, CalendarEventRecord>;

function isCalendarEventExcluded(event: CalendarEvent): boolean {
  if (!event.recurrenceId) return false;
  return Boolean(event.exclusionDates?.has(event.recurrenceId));
}

export function isCalendarEventException(event: CalendarEvent): boolean {
  if (event.isException === true) return true;
  if (!event.recurrenceId) return false;
  if (isCalendarEventExcluded(event)) return false;
  return !Boolean(event.recurrenceRule);
}
