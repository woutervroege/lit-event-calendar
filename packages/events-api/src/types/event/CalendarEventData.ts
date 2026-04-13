import type { CalendarEventDateValue } from "../calendar/index.js";
import type { CalendarExclusionDates, CalendarRecurrenceRule } from "../recurrence/index.js";
import type { CalendarEventTimeSpan } from "./CalendarEventTimeSpan.js";

export type CalendarEventData = {
  start: CalendarEventDateValue;
  summary: string;
  color: string;
  location?: string;
  recurrenceRule?: CalendarRecurrenceRule;
  exclusionDates?: CalendarExclusionDates;
} & CalendarEventTimeSpan;
