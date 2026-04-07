import type { CalendarEventContent, CalendarEventEnvelope } from "./CalendarEvent.js";

export type CalendarEventRequestTrigger = "long-press" | "drag-select";

export type EventCreateRequestDetail = {
  envelope: Pick<CalendarEventEnvelope, "calendarId">;
  content: CalendarEventContent;
};

export type EventUpdateRequestDetail = {
  envelope: Pick<
    CalendarEventEnvelope,
    "eventId" | "calendarId" | "recurrenceId" | "isException" | "isRecurring"
  >;
  content: CalendarEventContent;
};

export type EventDeleteRequestDetail = {
  envelope: Pick<CalendarEventEnvelope, "calendarId" | "eventId" | "recurrenceId" | "isRecurring">;
};

export type EventSelectionRequestDetail = {
  envelope: Pick<
    CalendarEventEnvelope,
    "eventId" | "calendarId" | "recurrenceId" | "isException" | "isRecurring"
  >;
  content: CalendarEventContent;
  trigger: "click" | "keyboard";
  pointerType: string;
  sourceEvent: Event;
};
