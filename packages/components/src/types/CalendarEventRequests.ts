import type { Temporal } from "@js-temporal/polyfill";
import type { CalendarEventData, CalendarEventEnvelope } from "@lit-calendar/events-api";

/** UI-emitted payloads use an explicit `end` time (not duration-only). */
export type CalendarEventUIData = Omit<CalendarEventData, "duration" | "end"> & {
  end: Temporal.PlainDateTime;
};

export type CalendarEventRequestTrigger = "long-press" | "drag-select";

export type EventCreateRequestDetail = {
  envelope: Pick<CalendarEventEnvelope, "calendarId">;
  content: CalendarEventUIData;
};

export type EventUpdateRequestDetail = {
  envelope: Pick<
    CalendarEventEnvelope,
    "eventId" | "calendarId" | "recurrenceId" | "isException" | "isRecurring"
  >;
  content: CalendarEventUIData;
};

export type EventDeleteRequestDetail = {
  envelope: Pick<CalendarEventEnvelope, "calendarId" | "eventId" | "recurrenceId" | "isRecurring">;
};

export type EventExceptionRequestDetail = {
  envelope: Pick<
    CalendarEventEnvelope,
    "eventId" | "calendarId" | "recurrenceId" | "isException" | "isRecurring"
  >;
  content: CalendarEventUIData;
  source: "move";
};

export type EventSelectionRequestDetail = {
  envelope: Pick<
    CalendarEventEnvelope,
    "eventId" | "calendarId" | "recurrenceId" | "isException" | "isRecurring"
  >;
  content: CalendarEventUIData;
  trigger: "click" | "keyboard";
  pointerType: string;
  sourceEvent: Event;
};
