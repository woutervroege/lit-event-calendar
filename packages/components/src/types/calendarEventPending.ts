import type {
  CalendarEventPendingOperation,
  CalendarEventsMap,
} from "@lit-calendar/events-api";

export type CalendarEventPendingGroupKey = CalendarEventPendingOperation;

export type CalendarEventPendingGroupBy = "pendingOp" | "calendarId";

export type CalendarEventPendingOptions = {
  groupBy?: CalendarEventPendingGroupBy;
};

export type CalendarEventPendingGroups = Map<
  CalendarEventPendingGroupKey,
  CalendarEventsMap
>;
export type CalendarEventPendingByOperation = Map<
  CalendarEventPendingOperation,
  CalendarEventsMap
>;
export type CalendarEventPendingByEventId = Map<string, CalendarEventPendingByOperation>;
export type CalendarEventPendingByCalendarId = Map<string, CalendarEventPendingByEventId>;
export type CalendarEventPendingResult = CalendarEventPendingGroups | CalendarEventPendingByCalendarId;
