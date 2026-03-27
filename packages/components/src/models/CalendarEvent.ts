import type { Temporal } from "@js-temporal/polyfill";

export type CalendarEventDateValue =
  | Temporal.PlainDate
  | Temporal.PlainDateTime
  | Temporal.ZonedDateTime;

export type CalendarEvent = {
  sourceId?: string;
  eventId?: string;
  recurrenceId?: string;
  isException?: boolean;
  isOptimistic?: boolean;
  isRemoved?: boolean;
  removalScope?: "instance" | "series";
  start: CalendarEventDateValue;
  end: CalendarEventDateValue;
  summary: string;
  color: string;
};

export type CalendarEventEntry = [id: string, event: CalendarEvent];
