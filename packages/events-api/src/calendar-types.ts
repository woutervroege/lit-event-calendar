import type { Temporal } from "@js-temporal/polyfill";

export type CalendarDuration = {
  weeks?: number;
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
};
export type CalendarRecurrenceId = string;

declare const ianaTimeZoneBrand: unique symbol;
export type IANATimeZone = string & { readonly [ianaTimeZoneBrand]: true };

export const UTC_TIMEZONE = "Etc/UTC" as IANATimeZone;

const SUPPORTED_TIME_ZONES = new Set(
  typeof Intl.supportedValuesOf === "function"
    ? [...Intl.supportedValuesOf("timeZone"), UTC_TIMEZONE]
    : [UTC_TIMEZONE]
);

export function isIANATimeZone(value: string): value is IANATimeZone {
  return SUPPORTED_TIME_ZONES.has(value);
}

export function toIANATimeZone(value: string): IANATimeZone | null {
  return isIANATimeZone(value) ? value : null;
}

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

export type CalendarRecurrenceTerminationJson =
  | { until: Temporal.PlainDateTime; count?: never }
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

export type CalendarRecurrenceRuleJson = {
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
} & CalendarRecurrenceTerminationJson;

export type CalendarVirtualLocation = {
  uri: string;
  name?: string;
  kind?: "video" | "audio" | "chat" | "other";
  description?: string;
  xProps?: Record<string, unknown>;
};

export type CalendarEventStatus = "confirmed" | "tentative" | "cancelled";

export type CalendarEventTimeSpan =
  | {
      end: Temporal.PlainDateTime;
      duration?: never;
    }
  | {
      duration: CalendarDuration;
      end?: never;
    };

export type CalendarEventOverride = {
  sequence?: number;
  start?: Temporal.PlainDateTime;
  end?: Temporal.PlainDateTime;
  duration?: CalendarDuration;
  timeZone?: IANATimeZone | null;
  endTimeZone?: IANATimeZone | null;
  showWithoutTime?: boolean;
  title?: string;
  description?: string;
  location?: string;
  virtualLocations?: Record<string, CalendarVirtualLocation>;
  excludedRecurrenceIds?: CalendarRecurrenceId[];
};

export type CalendarInteroperabilityData = {
  ical?: {
    xProps?: Record<string, string>;
    rawProps?: Record<string, unknown>;
  };
  caldav?: {
    calendarObjectUrl?: string;
    etag?: string;
    scheduleTag?: string;
  };
  jmap?: Record<string, unknown>;
};

// Canonical JSON-first model for persistence and interop.
export type CalendarEventRecord = {
  id: string;
  uid: string;
  calendarId?: string;
  start: Temporal.PlainDateTime;
  timeZone?: IANATimeZone | null;
  endTimeZone?: IANATimeZone | null;
  showWithoutTime?: boolean;
  title?: string;
  description?: string;
  location?: string;
  virtualLocations?: Record<string, CalendarVirtualLocation>;
  recurrenceRules?: CalendarRecurrenceRuleJson[];
  excludedRecurrenceIds?: CalendarRecurrenceId[];
  recurrenceOverrides?: Record<string, CalendarEventOverride>;
  status?: CalendarEventStatus;
  sequence?: number;
  created?: Temporal.PlainDateTime;
  updated?: Temporal.PlainDateTime;
  interop?: CalendarInteroperabilityData;
} & CalendarEventTimeSpan;

export type CalendarEventRecordMap = Map<string, CalendarEventRecord>;

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
