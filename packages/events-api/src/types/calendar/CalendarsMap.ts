import type { Calendar } from "./Calendar.js";
import type { CalendarId } from "./CalendarId.js";

/**
 * All calendars keyed by id (URL).
 */
export type CalendarsMap = Map<CalendarId, Calendar>;
