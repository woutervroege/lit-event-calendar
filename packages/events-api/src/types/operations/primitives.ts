import type { CalendarEventsMap } from "../event/index.js";

export type EventsState = CalendarEventsMap;
export type EventKey = string;
export type Scope = "single" | "series";

export type EventRef = {
  eventId: string;
  calendarId?: string;
  recurrenceId?: string;
};

export type EventTarget = { key: EventKey } | EventRef;
