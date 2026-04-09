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

export type CalendarEventView = CalendarEventEnvelope & CalendarEventContent;
export type CalendarEventViewMap = Map<string, CalendarEventView>;

type CalendarEventLike = CalendarEventView;

function isCalendarEventExcluded(event: CalendarEventLike): boolean {
  if (!event.recurrenceId) return false;
  return Boolean(event.exclusionDates?.has(event.recurrenceId));
}

export function isCalendarEventException(event: CalendarEventLike): boolean {
  if (event.isException === true) return true;
  if (!event.recurrenceId) return false;
  if (isCalendarEventExcluded(event)) return false;
  return !Boolean(event.recurrenceRule);
}
