import type { CalendarEventContent, CalendarEventEnvelope } from "./CalendarEvent.js";

export type CalendarEventRequestTrigger = "long-press" | "drag-select";

export type EventCreateRequestDetail = {
  envelope: Pick<CalendarEventEnvelope, "calendarId">;
  content: CalendarEventContent;
};

export type EventUpdateRequestDetail = {
  envelope: Pick<CalendarEventEnvelope, "eventId" | "calendarId" | "recurrenceId" | "isException">;
  content: CalendarEventContent;
};

export type EventDeleteRequestDetail = {
  envelope: Pick<CalendarEventEnvelope, "eventId" | "recurrenceId" | "removalScope">;
};
