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

