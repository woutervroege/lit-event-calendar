import type { Temporal } from "@js-temporal/polyfill";

export type CalendarEventDateValue =
  | Temporal.PlainDate
  | Temporal.PlainDateTime
  | Temporal.ZonedDateTime;

export type CalendarEventEnvelope = {
  calendarId?: string;
  eventId?: string;
  recurrenceId?: string;
  isRecurring?: boolean;
  isException?: boolean;
  isOptimistic?: boolean;
  isRemoved?: boolean;
};

export type CalendarEventContent = {
  start: CalendarEventDateValue;
  end: CalendarEventDateValue;
  summary: string;
  color: string;
  location?: string;
};

export type CalendarEvent = {
  envelope: CalendarEventEnvelope;
  content: CalendarEventContent;
};

export type CalendarEventView = CalendarEventEnvelope & CalendarEventContent;

export type CalendarEventEntry = [id: string, event: CalendarEvent];
export type CalendarEventViewEntry = [id: string, event: CalendarEventView];
export type CalendarEventMap = Map<string, CalendarEvent>;
export type CalendarEventViewMap = Map<string, CalendarEventView>;
