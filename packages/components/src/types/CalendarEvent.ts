import type { Temporal } from "@js-temporal/polyfill";

export type CalendarEventDateValue =
  | Temporal.PlainDate
  | Temporal.PlainDateTime
  | Temporal.ZonedDateTime;

export type CalendarEventPendingOperation = "created" | "updated" | "deleted";
export type CalendarEventPendingGroupKey = "created" | "updated" | "deleted";
export type CalendarEventPendingGroupBy = "pendingOp" | "calendarId";
export type CalendarEventPendingOptions = {
  groupBy?: CalendarEventPendingGroupBy;
};

export type CalendarEventEnvelope = {
  calendarId?: string;
  eventId?: string;
  recurrenceId?: string;
  isRecurring?: boolean;
  isException?: boolean;
  pendingOp?: CalendarEventPendingOperation;
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
export type CalendarEventPendingGroups = Map<CalendarEventPendingGroupKey, CalendarEventViewMap>;
export type CalendarEventPendingByOperation = Map<CalendarEventPendingOperation, CalendarEventViewMap>;
export type CalendarEventPendingByEventId = Map<string, CalendarEventPendingByOperation>;
export type CalendarEventPendingByCalendarId = Map<string, CalendarEventPendingByEventId>;
export type CalendarEventPendingResult = CalendarEventPendingGroups | CalendarEventPendingByCalendarId;
