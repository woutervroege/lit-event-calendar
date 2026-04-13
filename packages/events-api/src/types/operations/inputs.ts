import type { Temporal } from "@js-temporal/polyfill";
import type { CalendarEvent } from "../event/index.js";
import type { CalendarEventDateValue } from "../calendar/index.js";
import type { EventKey, EventTarget, Scope } from "./primitives.js";
import type { TimeRangeInput } from "./time-range-input.js";

export type CreateInput = {
  key?: EventKey;
  event: Omit<CalendarEvent, "start" | "end"> & TimeRangeInput;
};

export type UpdateInput = {
  target: EventTarget;
  scope: Scope;
  patch: Partial<Pick<CalendarEvent, "summary" | "color" | "location" | "calendarId">> &
    Partial<TimeRangeInput>;
};

export type MoveInput = {
  target: EventTarget;
  scope: Scope;
  delta: Temporal.Duration;
  options?: {
    keepExceptionTiming?: boolean;
    shiftExceptionRecurrenceId?: boolean;
    shiftExclusionDates?: boolean;
  };
};

export type ResizeStartInput = {
  target: EventTarget;
  scope: Scope;
  toStart: CalendarEventDateValue;
  options?: {
    minDuration?: Temporal.Duration;
    preserveDateOnly?: boolean;
  };
};

export type ResizeEndInput = {
  target: EventTarget;
  scope: Scope;
  toEnd: CalendarEventDateValue;
  options?: {
    minDuration?: Temporal.Duration;
    preserveDateOnly?: boolean;
  };
};

export type RemoveInput = {
  target: EventTarget;
  scope: Scope;
  options?: {
    exceptionAsExclusion?: boolean;
  };
};

export type AddExclusionInput = {
  target: EventTarget;
  recurrenceId: string;
};

export type RemoveExclusionInput = {
  target: EventTarget;
  recurrenceId: string;
};

export type AddExceptionInput = {
  target: EventTarget;
  recurrenceId: string;
  event: Partial<Pick<CalendarEvent, "summary" | "color" | "location" | "calendarId">> &
    TimeRangeInput & {
      key?: EventKey;
    };
  options?: {
    conflictPolicy?: "replace" | "merge" | "error";
  };
};

export type RemoveExceptionInput = {
  target: EventTarget;
  recurrenceId?: string;
  options?: {
    asExclusion?: boolean;
  };
};
