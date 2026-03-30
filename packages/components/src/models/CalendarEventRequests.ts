import type {
  CalendarEventContent,
  CalendarEventEnvelope,
} from "./CalendarEvent.js";

export type CalendarEventRequestTrigger = "long-press" | "drag-select";

export type EventCreateRequestDetail = {
  envelope: Pick<CalendarEventEnvelope, "sourceId">;
  content: CalendarEventContent;
};

export type EventUpdateRequestDetail = {
  envelope: Pick<
    CalendarEventEnvelope,
    "eventId" | "sourceId" | "recurrenceId" | "isException"
  >;
  content: CalendarEventContent;
};

export type EventDeleteRequestDetail = {
  envelope: Pick<CalendarEventEnvelope, "eventId" | "recurrenceId" | "removalScope">;
};
