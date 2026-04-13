import type { CalendarEventPendingOperation } from "./pending-operation.js";

export type CalendarEventEnvelope = {
  calendarId?: string;
  eventId?: string;
  recurrenceId?: string;
  isRecurring?: boolean;
  isException?: boolean;
  pendingOp?: CalendarEventPendingOperation;
};
