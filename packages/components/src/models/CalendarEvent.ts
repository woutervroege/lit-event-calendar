import type { Temporal } from "@js-temporal/polyfill";

export type CalendarEventDateValue =
  | Temporal.PlainDate
  | Temporal.PlainDateTime
  | Temporal.ZonedDateTime;

export type CalendarEventEnvelope = {
  sourceId?: string;
  eventId?: string;
  recurrenceId?: string;
  isException?: boolean;
  isOptimistic?: boolean;
  isRemoved?: boolean;
  removalScope?: "instance" | "series";
};

export type CalendarEventContent = {
  start: CalendarEventDateValue;
  end: CalendarEventDateValue;
  summary: string;
  color: string;
};

export type CalendarEvent = {
  envelope: CalendarEventEnvelope;
  content: CalendarEventContent;
};

export type CalendarEventView = CalendarEventEnvelope & CalendarEventContent;

export type CalendarEventEntry = [id: string, event: CalendarEvent];
export type CalendarEventViewEntry = [id: string, event: CalendarEventView];
