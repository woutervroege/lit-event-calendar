import { Temporal } from "@js-temporal/polyfill";
import type {
  CalendarEventDateValue,
  CalendarEventView,
  CalendarEventViewMap,
} from "./calendar-types.js";

export type EventsState = CalendarEventViewMap;
export type EventKey = string;
export type Scope = "single" | "series";

export type EventRef = {
  eventId: string;
  calendarId?: string;
  recurrenceId?: string;
};

export type EventTarget = { key: EventKey } | EventRef;

export type TimeRangeInput =
  | {
      start: CalendarEventDateValue;
      end: CalendarEventDateValue;
    }
  | {
      start: CalendarEventDateValue;
      duration: Temporal.Duration;
    };

export type CreateInput = {
  key?: EventKey;
  event: Omit<CalendarEventView, "start" | "end"> & TimeRangeInput;
};

export type UpdateInput = {
  target: EventTarget;
  scope: Scope;
  patch: Partial<Pick<CalendarEventView, "summary" | "color" | "location" | "calendarId">> &
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
  event: Partial<Pick<CalendarEventView, "summary" | "color" | "location" | "calendarId">> &
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

export type EventChange =
  | { type: "created"; key: EventKey; event: CalendarEventView }
  | { type: "updated"; key: EventKey; before: CalendarEventView; after: CalendarEventView }
  | { type: "removed"; key: EventKey; before: CalendarEventView };

export type DomainEffect =
  | { type: "warning"; code: string; message: string }
  | { type: "decision-required"; decision: "single-or-series"; target: EventRef };

export type ApplyResult = {
  nextState: EventsState;
  changes: EventChange[];
  effects: DomainEffect[];
};

export type EventOperation =
  | { type: "create"; input: CreateInput }
  | { type: "update"; input: UpdateInput }
  | { type: "move"; input: MoveInput }
  | { type: "resize-start"; input: ResizeStartInput }
  | { type: "resize-end"; input: ResizeEndInput }
  | { type: "remove"; input: RemoveInput }
  | { type: "add-exclusion"; input: AddExclusionInput }
  | { type: "remove-exclusion"; input: RemoveExclusionInput }
  | { type: "add-exception"; input: AddExceptionInput }
  | { type: "remove-exception"; input: RemoveExceptionInput };

export type OperationDecisionPolicy = {
  onRecurringUpdate?:
    | "single"
    | "series"
    | ((target: EventRef) => "single" | "series" | "require-decision");
  onRecurringDelete?:
    | "single"
    | "series"
    | ((target: EventRef) => "single" | "series" | "require-decision");
};

export type EventOperationRequest =
  | { kind: "create"; input: CreateInput }
  | { kind: "update"; input: UpdateInput }
  | { kind: "move"; input: MoveInput }
  | { kind: "resizeStart"; input: ResizeStartInput }
  | { kind: "resizeEnd"; input: ResizeEndInput }
  | { kind: "remove"; input: RemoveInput }
  | { kind: "addExclusion"; input: AddExclusionInput }
  | { kind: "removeExclusion"; input: RemoveExclusionInput }
  | { kind: "addException"; input: AddExceptionInput }
  | { kind: "removeException"; input: RemoveExceptionInput };
