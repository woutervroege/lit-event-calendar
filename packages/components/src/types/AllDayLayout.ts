import type { Temporal } from "@js-temporal/polyfill";

export type AllDayLayoutItem = {
  id: string;
  start: Temporal.PlainDate;
  endInclusive: Temporal.PlainDate;
};

export type AllDayLayout = {
  placedEvents: Array<{
    id: string;
    segments: Array<{
      rowIndex: number;
      startColIndex: number;
      endColIndex: number;
      stackIndex: number;
    }>;
  }>;
  activeCountsByDay: Map<number, number>;
  maxEventsOnAnyDay: number;
  daysPerRow: number;
};
