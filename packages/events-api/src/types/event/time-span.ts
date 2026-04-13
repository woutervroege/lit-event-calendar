import type { Temporal } from "@js-temporal/polyfill";
import type { CalendarEventDateValue } from "../calendar/event-date-value.js";

export type CalendarEventTimeSpan =
  | {
      end: CalendarEventDateValue;
      duration?: never;
    }
  | {
      duration: Temporal.Duration;
      end?: never;
    };
