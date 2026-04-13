import type { Temporal } from "@js-temporal/polyfill";
import type { CalendarEventDateValue } from "../calendar/index.js";

export type TimeRangeInput =
  | {
      start: CalendarEventDateValue;
      end: CalendarEventDateValue;
    }
  | {
      start: CalendarEventDateValue;
      duration: Temporal.Duration;
    };
