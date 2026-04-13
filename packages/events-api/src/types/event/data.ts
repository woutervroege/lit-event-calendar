import type {
  CalendarEventDateValue,
  CalendarExclusionDates,
  CalendarRecurrenceRule,
} from "../calendar/index.js";
import type { CalendarEventTimeSpan } from "./time-span.js";

export type CalendarEventData = {
  start: CalendarEventDateValue;
  summary: string;
  color: string;
  location?: string;
  recurrenceRule?: CalendarRecurrenceRule;
  exclusionDates?: CalendarExclusionDates;
} & CalendarEventTimeSpan;
