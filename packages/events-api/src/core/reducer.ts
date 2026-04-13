import { Temporal } from "@js-temporal/polyfill";
import type { CalendarEventDateValue } from "../types/calendar.js";
import type {
  CalendarEvent,
  CalendarEventData,
  CalendarEventsMap,
} from "../types/event.js";
import { isDetachedException } from "../utils/recurrence.js";
import { expandEvents } from "./expandEvents.js";
import {
  resolveEventEnd,
  shiftDateValue,
  shiftExclusionDates,
  shiftRecurrenceId,
  toPlainDateTime,
} from "../utils/recurrence.js";
import type {
  AddExceptionInput,
  AddExclusionInput,
  ApplyResult,
  CreateInput,
  DomainEffect,
  EventChange,
  EventOperation,
  EventTarget,
  EventsState,
  MoveInput,
  RemoveExceptionInput,
  RemoveExclusionInput,
  RemoveInput,
  ResizeEndInput,
  ResizeStartInput,
  Scope,
  TimeRangeInput,
  UpdateInput,
} from "../types/operations.js";

type ReduceContext = {
  state: EventsState;
  timezone?: string;
  trackPending?: boolean;
};

function cloneEvent(event: CalendarEvent): CalendarEvent {
  return {
    ...event,
    data: {
      ...event.data,
      exclusionDates: event.data.exclusionDates ? new Set(event.data.exclusionDates) : undefined,
    },
  };
}

function cloneState(state: EventsState): EventsState {
  return new Map(Array.from(state.entries()).map(([key, event]) => [key, cloneEvent(event)]));
}

function normalizeTimeRange(input: TimeRangeInput): { start: CalendarEventDateValue; end: CalendarEventDateValue } {
  if ("end" in input) return { start: input.start, end: input.end };
  return {
    start: input.start,
    end: shiftDateValue(input.start, input.duration),
  };
}

function withEndTimeSpan(event: CalendarEvent, end: CalendarEventDateValue): CalendarEvent {
  const { end: _e, duration: _d, ...dataRest } = event.data;
  return { ...event, data: { ...dataRest, end } };
}

function withDurationTimeSpan(event: CalendarEvent, duration: Temporal.Duration): CalendarEvent {
  const { end: _e, duration: _d, ...dataRest } = event.data;
  return { ...event, data: { ...dataRest, duration } };
}

function resolveKey(state: EventsState, target: EventTarget): string | undefined {
  if ("key" in target) return state.has(target.key) ? target.key : undefined;
  for (const [key, event] of state.entries()) {
    if (event.eventId !== target.eventId) continue;
    if (target.calendarId !== undefined && event.calendarId !== target.calendarId) continue;
    if (target.recurrenceId === undefined || event.recurrenceId === target.recurrenceId) return key;
  }
  if (target.recurrenceId !== undefined) return undefined;
  for (const [key, event] of state.entries()) {
    if (event.eventId !== target.eventId) continue;
    if (target.calendarId !== undefined && event.calendarId !== target.calendarId) continue;
    if (!event.recurrenceId) return key;
  }
  return undefined;
}

function resolveScopeKeys(state: EventsState, key: string, scope: Scope): string[] {
  if (scope === "single") return [key];
  const source = state.get(key);
  if (!source?.eventId) return [key];
  const keys: string[] = [];
  for (const [candidateKey, event] of state.entries()) {
    if (event.eventId !== source.eventId) continue;
    if (source.calendarId !== undefined && event.calendarId !== source.calendarId) continue;
    keys.push(candidateKey);
  }
  return keys;
}

function changeUpdated(changes: EventChange[], key: string, before: CalendarEvent, after: CalendarEvent) {
  changes.push({ type: "updated", key, before, after });
}

function setUpdated(state: EventsState, changes: EventChange[], key: string, update: CalendarEvent) {
  const before = state.get(key);
  if (!before) return;
  state.set(key, update);
  changeUpdated(changes, key, before, update);
}

function asPendingUpdated(event: CalendarEvent, trackPending: boolean): CalendarEvent {
  if (!trackPending) return event;
  return {
    ...event,
    pendingOp: event.pendingOp === "created" ? "created" : "updated",
  };
}

function asPendingDeleted(event: CalendarEvent, trackPending: boolean): CalendarEvent {
  if (!trackPending) return event;
  return {
    ...event,
    pendingOp: "deleted",
  };
}

function withExcludedRecurrence(event: CalendarEvent, recurrenceId: string): CalendarEvent {
  const exclusionDates = new Set(event.data.exclusionDates ?? []);
  exclusionDates.add(recurrenceId);
  return {
    ...event,
    data: { ...event.data, exclusionDates },
    pendingOp: event.pendingOp === "created" ? "created" : "updated",
  };
}

function ensureMinimumDuration(
  start: CalendarEventDateValue,
  end: CalendarEventDateValue,
  minDuration: Temporal.Duration | undefined
): { start: CalendarEventDateValue; end: CalendarEventDateValue } {
  if (!minDuration) return { start, end };
  const startDT = toPlainDateTime(start);
  const endDT = toPlainDateTime(end);
  const minEnd = startDT.add(minDuration);
  if (Temporal.PlainDateTime.compare(endDT, minEnd) >= 0) return { start, end };
  return { start, end: shiftDateValue(start, minDuration) };
}

function applyUpdateToEvent(event: CalendarEvent, patch: UpdateInput["patch"]): CalendarEvent {
  const { data: prevData, ...envelopeRest } = event;
  const envelope = { ...envelopeRest };
  const nextData = { ...prevData };
  if (patch.summary !== undefined) nextData.summary = patch.summary;
  if (patch.color !== undefined) nextData.color = patch.color;
  if (patch.location !== undefined) nextData.location = patch.location;
  if (patch.calendarId !== undefined) envelope.calendarId = patch.calendarId;
  if (patch.start !== undefined) nextData.start = patch.start;
  let next: CalendarEvent = { ...envelope, data: nextData };
  if ("end" in patch && patch.end !== undefined) {
    next = withEndTimeSpan(next, patch.end);
  }
  if ("duration" in patch && patch.duration !== undefined && patch.start !== undefined) {
    next = withDurationTimeSpan(next, patch.duration);
  } else if ("duration" in patch && patch.duration !== undefined) {
    next = withDurationTimeSpan(next, patch.duration);
  }
  return next;
}

function applyCreate(input: CreateInput, context: ReduceContext): ApplyResult {
  const state = cloneState(context.state);
  const changes: EventChange[] = [];
  const effects: DomainEffect[] = [];
  const { data: rawData, ...envelope } = input.event;
  const normalized =
    "end" in rawData ?
      normalizeTimeRange({ start: rawData.start, end: rawData.end })
    : normalizeTimeRange({ start: rawData.start, duration: rawData.duration });
  const { summary, color, location, recurrenceRule, exclusionDates } = rawData;
  const data: CalendarEventData =
    "end" in rawData ?
      {
        summary,
        color,
        location,
        recurrenceRule,
        exclusionDates,
        start: normalized.start,
        end: normalized.end,
      }
    : {
        summary,
        color,
        location,
        recurrenceRule,
        exclusionDates,
        start: normalized.start,
        duration: rawData.duration,
      };
  const key =
    input.key ??
    envelope.eventId ??
    `event-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const event: CalendarEvent = { ...envelope, data };
  state.set(key, event);
  changes.push({ type: "created", key, event });
  return { nextState: state, changes, effects };
}

function applyUpdate(input: UpdateInput, context: ReduceContext): ApplyResult {
  const state = cloneState(context.state);
  const changes: EventChange[] = [];
  const effects: DomainEffect[] = [];
  const key = resolveKey(state, input.target);
  if (!key) {
    effects.push({ type: "warning", code: "target-not-found", message: "Target event not found." });
    return { nextState: state, changes, effects };
  }
  const keys = resolveScopeKeys(state, key, input.scope);
  for (const updateKey of keys) {
    const event = state.get(updateKey);
    if (!event) continue;
    if (input.scope === "series" && isDetachedException(event)) continue;
    const updated = asPendingUpdated(applyUpdateToEvent(event, input.patch), context.trackPending ?? false);
    setUpdated(state, changes, updateKey, updated);
  }
  return { nextState: state, changes, effects };
}

function applyMove(input: MoveInput, context: ReduceContext): ApplyResult {
  const state = cloneState(context.state);
  const changes: EventChange[] = [];
  const effects: DomainEffect[] = [];
  const key = resolveKey(state, input.target);
  if (!key) {
    effects.push({ type: "warning", code: "target-not-found", message: "Target event not found." });
    return { nextState: state, changes, effects };
  }
  const keys = resolveScopeKeys(state, key, input.scope);
  const keepExceptionTiming = input.options?.keepExceptionTiming ?? true;
  const shiftExceptionRecurrenceId = input.options?.shiftExceptionRecurrenceId ?? true;
  const shiftExdates = input.options?.shiftExclusionDates ?? true;
  for (const updateKey of keys) {
    const event = state.get(updateKey);
    if (!event) continue;
    const isException = isDetachedException(event);
    if (input.scope === "series" && isException && keepExceptionTiming) {
      const nextRecurrenceId = shiftExceptionRecurrenceId
        ? shiftRecurrenceId(event.recurrenceId, event.data.start, input.delta)
        : event.recurrenceId;
      const updated: CalendarEvent = {
        ...event,
        recurrenceId: nextRecurrenceId,
      };
      setUpdated(state, changes, updateKey, updated);
      continue;
    }
    const updated = asPendingUpdated(
      (() => {
        const { data } = event;
        const shiftedStart = shiftDateValue(data.start, input.delta);
        const nextExclusionDates = shiftExdates ? shiftExclusionDates(event, input.delta) : data.exclusionDates;
        if ("end" in data && data.end !== undefined) {
          const partial: CalendarEvent = {
            ...event,
            data: {
              ...data,
              start: shiftedStart,
              exclusionDates: nextExclusionDates,
            },
          };
          return withEndTimeSpan(partial, shiftDateValue(data.end, input.delta));
        }
        const partial: CalendarEvent = {
          ...event,
          data: {
            ...data,
            start: shiftedStart,
            exclusionDates: nextExclusionDates,
          },
        };
        return withDurationTimeSpan(partial, data.duration as Temporal.Duration);
      })(),
      context.trackPending ?? false
    );
    setUpdated(state, changes, updateKey, updated);
  }
  return { nextState: state, changes, effects };
}

function applyResizeStart(input: ResizeStartInput, context: ReduceContext): ApplyResult {
  const state = cloneState(context.state);
  const changes: EventChange[] = [];
  const effects: DomainEffect[] = [];
  const key = resolveKey(state, input.target);
  if (!key) {
    effects.push({ type: "warning", code: "target-not-found", message: "Target event not found." });
    return { nextState: state, changes, effects };
  }
  const referenceEvent = state.get(key);
  if (!referenceEvent) return { nextState: state, changes, effects };
  const keys = resolveScopeKeys(state, key, input.scope);
  const seriesDelta =
    input.scope === "series"
      ? toPlainDateTime(referenceEvent.data.start).until(toPlainDateTime(input.toStart))
      : null;
  for (const updateKey of keys) {
    const event = state.get(updateKey);
    if (!event) continue;
    if (input.scope === "series" && isDetachedException(event)) {
      const updatedException: CalendarEvent = {
        ...event,
        recurrenceId: shiftRecurrenceId(event.recurrenceId, event.data.start, seriesDelta),
      };
      setUpdated(state, changes, updateKey, updatedException);
      continue;
    }
    const nextStart =
      input.scope === "series" ? shiftDateValue(event.data.start, seriesDelta) : input.toStart;
    const bounded = ensureMinimumDuration(
      nextStart,
      resolveEventEnd(event.data),
      input.options?.minDuration
    );
    const nextExclusionDates =
      input.scope === "series" && event.data.recurrenceRule && !event.recurrenceId
        ? shiftExclusionDates(event, seriesDelta)
        : event.data.exclusionDates;
    const updated = asPendingUpdated(
      withEndTimeSpan(
        {
          ...event,
          data: {
            ...event.data,
            start: bounded.start,
            exclusionDates: nextExclusionDates,
          },
        },
        bounded.end
      ),
      context.trackPending ?? false
    );
    setUpdated(state, changes, updateKey, updated);
  }
  return { nextState: state, changes, effects };
}

function applyResizeEnd(input: ResizeEndInput, context: ReduceContext): ApplyResult {
  const state = cloneState(context.state);
  const changes: EventChange[] = [];
  const effects: DomainEffect[] = [];
  const key = resolveKey(state, input.target);
  if (!key) {
    effects.push({ type: "warning", code: "target-not-found", message: "Target event not found." });
    return { nextState: state, changes, effects };
  }
  const referenceEvent = state.get(key);
  if (!referenceEvent) return { nextState: state, changes, effects };
  const keys = resolveScopeKeys(state, key, input.scope);
  const seriesDelta =
    input.scope === "series"
      ? toPlainDateTime(resolveEventEnd(referenceEvent.data)).until(toPlainDateTime(input.toEnd))
      : null;
  for (const updateKey of keys) {
    const event = state.get(updateKey);
    if (!event) continue;
    if (input.scope === "series" && isDetachedException(event)) continue;
    const nextEnd =
      input.scope === "series" ? shiftDateValue(resolveEventEnd(event.data), seriesDelta) : input.toEnd;
    const bounded = ensureMinimumDuration(event.data.start, nextEnd, input.options?.minDuration);
    const updated = asPendingUpdated(
      withEndTimeSpan(
        {
          ...event,
          data: { ...event.data, start: bounded.start },
        },
        bounded.end
      ),
      context.trackPending ?? false
    );
    setUpdated(state, changes, updateKey, updated);
  }
  return { nextState: state, changes, effects };
}

function applyRemove(input: RemoveInput, context: ReduceContext): ApplyResult {
  const state = cloneState(context.state);
  const changes: EventChange[] = [];
  const effects: DomainEffect[] = [];
  const key = resolveKey(state, input.target);
  if (!key) {
    effects.push({ type: "warning", code: "target-not-found", message: "Target event not found." });
    return { nextState: state, changes, effects };
  }
  const keys = resolveScopeKeys(state, key, input.scope);
  if (input.scope === "single") {
    const current = state.get(key);
    if (!current) return { nextState: state, changes, effects };
    if (
      isDetachedException(current) &&
      current.recurrenceId &&
      (input.options?.exceptionAsExclusion ?? true)
    ) {
      const masterKey = resolveScopeKeys(state, key, "series").find((candidate) => {
        const event = state.get(candidate);
        return Boolean(event?.data.recurrenceRule && !event?.recurrenceId);
      });
      if (masterKey) {
        const masterEvent = state.get(masterKey);
        if (masterEvent) {
          const updatedMaster = withExcludedRecurrence(masterEvent, current.recurrenceId);
          setUpdated(state, changes, masterKey, updatedMaster);
        }
      }
    }
    if (context.trackPending) {
      if (current.pendingOp === "created") {
        state.delete(key);
        changes.push({ type: "removed", key, before: current });
      } else {
        const updated = asPendingDeleted(current, true);
        setUpdated(state, changes, key, updated);
      }
      return { nextState: state, changes, effects };
    }

    state.delete(key);
    changes.push({ type: "removed", key, before: current });
    return { nextState: state, changes, effects };
  }
  for (const removeKey of keys) {
    const current = state.get(removeKey);
    if (!current) continue;
    if (context.trackPending) {
      if (current.pendingOp === "created") {
        state.delete(removeKey);
        changes.push({ type: "removed", key: removeKey, before: current });
      } else {
        const updated = asPendingDeleted(current, true);
        setUpdated(state, changes, removeKey, updated);
      }
      continue;
    }
    state.delete(removeKey);
    changes.push({ type: "removed", key: removeKey, before: current });
  }
  return { nextState: state, changes, effects };
}

function applyAddExclusion(input: AddExclusionInput, context: ReduceContext): ApplyResult {
  const state = cloneState(context.state);
  const changes: EventChange[] = [];
  const effects: DomainEffect[] = [];
  const key = resolveKey(state, input.target);
  if (!key) {
    effects.push({ type: "warning", code: "target-not-found", message: "Target event not found." });
    return { nextState: state, changes, effects };
  }
  const event = state.get(key);
  if (!event) return { nextState: state, changes, effects };
  const updated = asPendingUpdated(
    withExcludedRecurrence(event, input.recurrenceId),
    context.trackPending ?? false
  );
  setUpdated(state, changes, key, updated);
  return { nextState: state, changes, effects };
}

function applyRemoveExclusion(input: RemoveExclusionInput, context: ReduceContext): ApplyResult {
  const state = cloneState(context.state);
  const changes: EventChange[] = [];
  const effects: DomainEffect[] = [];
  const key = resolveKey(state, input.target);
  if (!key) {
    effects.push({ type: "warning", code: "target-not-found", message: "Target event not found." });
    return { nextState: state, changes, effects };
  }
  const event = state.get(key);
  if (!event) return { nextState: state, changes, effects };
  const exclusionDates = new Set(event.data.exclusionDates ?? []);
  exclusionDates.delete(input.recurrenceId);
  const updated = asPendingUpdated(
    { ...event, data: { ...event.data, exclusionDates } },
    context.trackPending ?? false
  );
  setUpdated(state, changes, key, updated);
  return { nextState: state, changes, effects };
}

function applyAddException(input: AddExceptionInput, context: ReduceContext): ApplyResult {
  const state = cloneState(context.state);
  const changes: EventChange[] = [];
  const effects: DomainEffect[] = [];
  const key = resolveKey(state, input.target);
  if (!key) {
    effects.push({ type: "warning", code: "target-not-found", message: "Target event not found." });
    return { nextState: state, changes, effects };
  }
  const master = state.get(key);
  if (!master) return { nextState: state, changes, effects };
  const updatedMaster = asPendingUpdated(
    withExcludedRecurrence(master, input.recurrenceId),
    context.trackPending ?? false
  );
  setUpdated(state, changes, key, updatedMaster);

  const raw = input.event;
  const timeInput: TimeRangeInput =
    "duration" in raw ?
      { start: raw.start, duration: raw.duration }
    : { start: raw.start, end: raw.end };
  const normalized = normalizeTimeRange(timeInput);
  const exceptionKey = `${key}::${input.recurrenceId}`;
  const existing = state.get(exceptionKey);
  let exceptionData: CalendarEventData;
  if ("duration" in raw) {
    const { end: _e, ...md } = master.data;
    exceptionData = {
      ...md,
      summary: raw.summary ?? master.data.summary,
      color: raw.color ?? master.data.color,
      location: raw.location ?? master.data.location,
      start: normalized.start,
      duration: raw.duration,
      recurrenceRule: undefined,
    };
  } else {
    const { duration: _d, ...md } = master.data;
    exceptionData = {
      ...md,
      summary: raw.summary ?? master.data.summary,
      color: raw.color ?? master.data.color,
      location: raw.location ?? master.data.location,
      start: normalized.start,
      end: normalized.end,
      recurrenceRule: undefined,
    };
  }
  const { data: _masterData, recurrenceId: _mr, isException: _me, ...masterEnvelope } = master;
  const exception: CalendarEvent = {
    ...masterEnvelope,
    calendarId: raw.calendarId ?? master.calendarId,
    recurrenceId: input.recurrenceId,
    isException: true,
    data: exceptionData,
  };
  if (existing) {
    setUpdated(state, changes, exceptionKey, asPendingUpdated(exception, context.trackPending ?? false));
  } else {
    const createdException =
      context.trackPending ?
        {
          ...exception,
          pendingOp: "created" as const,
        }
      : exception;
    state.set(exceptionKey, createdException);
    changes.push({ type: "created", key: exceptionKey, event: createdException });
  }
  return { nextState: state, changes, effects };
}

function applyRemoveException(input: RemoveExceptionInput, context: ReduceContext): ApplyResult {
  const state = cloneState(context.state);
  const changes: EventChange[] = [];
  const effects: DomainEffect[] = [];
  const key = resolveKey(state, input.target);
  if (!key) {
    effects.push({ type: "warning", code: "target-not-found", message: "Target event not found." });
    return { nextState: state, changes, effects };
  }
  const exception = state.get(key);
  if (!exception) return { nextState: state, changes, effects };
  const recurrenceId = input.recurrenceId ?? exception.recurrenceId;
  if (recurrenceId && (input.options?.asExclusion ?? true) && exception.eventId) {
    const masterKey = resolveScopeKeys(state, key, "series").find((candidate) => {
      const event = state.get(candidate);
      return Boolean(event?.data.recurrenceRule && !event?.recurrenceId);
    });
    if (masterKey) {
      const master = state.get(masterKey);
      if (master) {
        const updatedMaster = asPendingUpdated(
          withExcludedRecurrence(master, recurrenceId),
          context.trackPending ?? false
        );
        setUpdated(state, changes, masterKey, updatedMaster);
      }
    }
  }
  if (context.trackPending) {
    if (exception.pendingOp === "created") {
      state.delete(key);
      changes.push({ type: "removed", key, before: exception });
    } else {
      const updatedException = asPendingDeleted(exception, true);
      setUpdated(state, changes, key, updatedException);
    }
    return { nextState: state, changes, effects };
  }
  state.delete(key);
  changes.push({ type: "removed", key, before: exception });
  return { nextState: state, changes, effects };
}

export function applyOperation(operation: EventOperation, context: ReduceContext): ApplyResult {
  if (operation.type === "create") return applyCreate(operation.input, context);
  if (operation.type === "update") return applyUpdate(operation.input, context);
  if (operation.type === "move") return applyMove(operation.input, context);
  if (operation.type === "resize-start") return applyResizeStart(operation.input, context);
  if (operation.type === "resize-end") return applyResizeEnd(operation.input, context);
  if (operation.type === "remove") return applyRemove(operation.input, context);
  if (operation.type === "add-exclusion") return applyAddExclusion(operation.input, context);
  if (operation.type === "remove-exclusion") return applyRemoveExclusion(operation.input, context);
  if (operation.type === "add-exception") return applyAddException(operation.input, context);
  return applyRemoveException(operation.input, context);
}

export class EventsAPI {
  #state: EventsState;
  #timezone?: string;
  #trackPending = false;

  constructor(initialState: EventsState, options: { timezone?: string; trackPending?: boolean } = {}) {
    this.#state = cloneState(initialState);
    this.#timezone = options.timezone;
    this.#trackPending = options.trackPending ?? false;
  }

  getState(): EventsState {
    return cloneState(this.#state);
  }

  get(target: EventTarget): CalendarEvent | undefined {
    const key = resolveKey(this.#state, target);
    if (!key) return undefined;
    const event = this.#state.get(key);
    return event ? cloneEvent(event) : undefined;
  }

  expand(range: { start: CalendarEventDateValue; end: CalendarEventDateValue }): CalendarEventsMap {
    return expandEvents(this.#state, range, { timezone: this.#timezone });
  }

  create(input: CreateInput): ApplyResult {
    return this.apply({ type: "create", input });
  }

  update(input: UpdateInput): ApplyResult {
    return this.apply({ type: "update", input });
  }

  move(input: MoveInput): ApplyResult {
    return this.apply({ type: "move", input });
  }

  resizeStart(input: ResizeStartInput): ApplyResult {
    return this.apply({ type: "resize-start", input });
  }

  resizeEnd(input: ResizeEndInput): ApplyResult {
    return this.apply({ type: "resize-end", input });
  }

  remove(input: RemoveInput): ApplyResult {
    return this.apply({ type: "remove", input });
  }

  addExclusion(input: AddExclusionInput): ApplyResult {
    return this.apply({ type: "add-exclusion", input });
  }

  removeExclusion(input: RemoveExclusionInput): ApplyResult {
    return this.apply({ type: "remove-exclusion", input });
  }

  addException(input: AddExceptionInput): ApplyResult {
    return this.apply({ type: "add-exception", input });
  }

  removeException(input: RemoveExceptionInput): ApplyResult {
    return this.apply({ type: "remove-exception", input });
  }

  apply(operation: EventOperation): ApplyResult {
    const result = applyOperation(operation, {
      state: this.#state,
      timezone: this.#timezone,
      trackPending: this.#trackPending,
    });
    this.#state = cloneState(result.nextState);
    return {
      ...result,
      nextState: cloneState(result.nextState),
    };
  }
}
