import type { CalendarEventData } from "./data.js";
import type { CalendarEventEnvelope } from "./envelope.js";

export type CalendarEvent = CalendarEventEnvelope & CalendarEventData;
