import type { CalendarEventDateValue } from "../calendar/CalendarEventDateValue.js";

export type CalendarRecurrenceTermination =
  | { until: CalendarEventDateValue; count?: never }
  | { count: number; until?: never }
  | { until?: never; count?: never };
