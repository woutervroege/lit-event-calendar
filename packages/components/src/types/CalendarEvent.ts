import type { Temporal } from "@js-temporal/polyfill";

export type CalendarEventDateValue =
  | Temporal.PlainDate
  | Temporal.PlainDateTime
  | Temporal.ZonedDateTime;

export type CalendarRecurrenceFrequency =
  | "SECONDLY"
  | "MINUTELY"
  | "HOURLY"
  | "DAILY"
  | "WEEKLY"
  | "MONTHLY"
  | "YEARLY";

export type CalendarRecurrenceWeekday = "MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU";

export type CalendarRecurrenceWeekdayRule = {
  day: CalendarRecurrenceWeekday;
  ordinal?: number;
};

export type CalendarRecurrenceTermination =
  | { until: CalendarEventDateValue; count?: never }
  | { count: number; until?: never }
  | { until?: never; count?: never };

export type CalendarExclusionDates = Set<string>;

export type CalendarRecurrenceRule = {
  freq: CalendarRecurrenceFrequency;
  interval?: number;
  wkst?: CalendarRecurrenceWeekday;
  bySecond?: number[];
  byMinute?: number[];
  byHour?: number[];
  byDay?: CalendarRecurrenceWeekdayRule[];
  byMonthDay?: number[];
  byYearDay?: number[];
  byWeekNo?: number[];
  byMonth?: number[];
  bySetPos?: number[];
} & CalendarRecurrenceTermination;

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
  recurrenceRule?: CalendarRecurrenceRule;
  exclusionDates?: CalendarExclusionDates;
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

type CalendarEventLike = CalendarEvent | CalendarEventView;

function resolveEventEnvelope(event: CalendarEventLike): CalendarEventEnvelope {
  return "envelope" in event ? event.envelope : event;
}

function resolveEventContent(event: CalendarEventLike): CalendarEventContent {
  return "content" in event ? event.content : event;
}

export function isCalendarEventException(event: CalendarEventLike): boolean {
  const envelope = resolveEventEnvelope(event);
  if (envelope.isException === true) return true;
  if (!envelope.recurrenceId) return false;
  if (isCalendarEventExcluded(event)) return false;
  const content = resolveEventContent(event);
  // Detached occurrence overrides usually have recurrenceId without carrying the series rule.
  return !Boolean(content.recurrenceRule);
}

export function isCalendarEventExcluded(event: CalendarEventLike): boolean {
  const envelope = resolveEventEnvelope(event);
  if (!envelope.recurrenceId) return false;
  const content = resolveEventContent(event);
  return Boolean(content.exclusionDates?.has(envelope.recurrenceId));
}

export function isCalendarEventRecurring(event: CalendarEventLike): boolean {
  if (isCalendarEventExcluded(event) || isCalendarEventException(event)) return false;
  const envelope = resolveEventEnvelope(event);
  const content = resolveEventContent(event);
  return Boolean(content.recurrenceRule || envelope.isRecurring || envelope.recurrenceId);
}
