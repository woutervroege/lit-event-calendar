import type { Temporal } from "@js-temporal/polyfill";
import type { CalendarEventDateValue } from "./event-date-value.js";

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
