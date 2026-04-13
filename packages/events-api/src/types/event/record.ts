import type { CalendarEvent } from "./event.js";

export type CalendarEventRecord = CalendarEvent & {
  key: string;
};
