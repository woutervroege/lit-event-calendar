import { Temporal } from "@js-temporal/polyfill";
import type { CalendarEventDateValue, CalendarEventView, CalendarEventViewMap } from "../../types/CalendarEvent.js";
import { isCalendarEventException } from "../../types/CalendarEvent.js";
import { expandEvents } from "./expand.js";
import {
  shiftDateValue,
  shiftExclusionDates,
  shiftRecurrenceId,
  toPlainDateTime,
} from "./recurrence.js";
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
} from "./types.js";

type ReduceContext = {
  state: EventsState;
  timezone?: string;
};

function cloneEvent(event: CalendarEventView): CalendarEventView {
  return {
    ...event,
    exclusionDates: event.exclusionDates ? new Set(event.exclusionDates) : undefined,
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

function changeUpdated(changes: EventChange[], key: string, before: CalendarEventView, after: CalendarEventView) {
  changes.push({ type: "updated", key, before, after });
}

function setUpdated(state: EventsState, changes: EventChange[], key: string, update: CalendarEventView) {
  const before = state.get(key);
  if (!before) return;
  state.set(key, update);
  changeUpdated(changes, key, before, update);
}

function withExcludedRecurrence(event: CalendarEventView, recurrenceId: string): CalendarEventView {
  const exclusionDates = new Set(event.exclusionDates ?? []);
  exclusionDates.add(recurrenceId);
  return {
    ...event,
    exclusionDates,
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

function applyUpdateToEvent(event: CalendarEventView, patch: UpdateInput["patch"]): CalendarEventView {
  const next = cloneEvent(event);
  if (patch.summary !== undefined) next.summary = patch.summary;
  if (patch.color !== undefined) next.color = patch.color;
  if (patch.location !== undefined) next.location = patch.location;
  if (patch.calendarId !== undefined) next.calendarId = patch.calendarId;
  if (patch.start !== undefined) next.start = patch.start;
  if ("end" in patch && patch.end !== undefined) next.end = patch.end;
  if ("duration" in patch && patch.duration !== undefined && patch.start !== undefined) {
    next.end = shiftDateValue(patch.start, patch.duration);
  }
  return next;
}

function applyCreate(input: CreateInput, context: ReduceContext): ApplyResult {
  const state = cloneState(context.state);
  const changes: EventChange[] = [];
  const effects: DomainEffect[] = [];
  const normalized = normalizeTimeRange(input.event);
  const key =
    input.key ??
    input.event.eventId ??
    `event-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const event: CalendarEventView = {
    ...input.event,
    start: normalized.start,
    end: normalized.end,
  };
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
    const updated = applyUpdateToEvent(event, input.patch);
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
    const isException = isCalendarEventException(event);
    if (isException && keepExceptionTiming) {
      const nextRecurrenceId = shiftExceptionRecurrenceId
        ? shiftRecurrenceId(event.recurrenceId, event.start, input.delta)
        : event.recurrenceId;
      const updated: CalendarEventView = {
        ...event,
        recurrenceId: nextRecurrenceId,
      };
      setUpdated(state, changes, updateKey, updated);
      continue;
    }
    const updated: CalendarEventView = {
      ...event,
      start: shiftDateValue(event.start, input.delta),
      end: shiftDateValue(event.end, input.delta),
      exclusionDates: shiftExdates ? shiftExclusionDates(event, input.delta) : event.exclusionDates,
    };
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
      ? toPlainDateTime(referenceEvent.start).until(toPlainDateTime(input.toStart))
      : null;
  for (const updateKey of keys) {
    const event = state.get(updateKey);
    if (!event) continue;
    const nextStart = input.scope === "series" ? shiftDateValue(event.start, seriesDelta) : input.toStart;
    const bounded = ensureMinimumDuration(nextStart, event.end, input.options?.minDuration);
    const nextExclusionDates =
      input.scope === "series" && event.recurrenceRule && !event.recurrenceId
        ? shiftExclusionDates(event, seriesDelta)
        : event.exclusionDates;
    const updated: CalendarEventView = {
      ...event,
      start: bounded.start,
      end: bounded.end,
      exclusionDates: nextExclusionDates,
    };
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
      ? toPlainDateTime(referenceEvent.end).until(toPlainDateTime(input.toEnd))
      : null;
  for (const updateKey of keys) {
    const event = state.get(updateKey);
    if (!event) continue;
    const nextEnd = input.scope === "series" ? shiftDateValue(event.end, seriesDelta) : input.toEnd;
    const bounded = ensureMinimumDuration(event.start, nextEnd, input.options?.minDuration);
    const updated: CalendarEventView = {
      ...event,
      start: bounded.start,
      end: bounded.end,
    };
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
      isCalendarEventException(current) &&
      current.recurrenceId &&
      (input.options?.exceptionAsExclusion ?? true)
    ) {
      const masterKey = resolveScopeKeys(state, key, "series").find((candidate) => {
        const event = state.get(candidate);
        return Boolean(event?.recurrenceRule && !event?.recurrenceId);
      });
      if (masterKey) {
        const masterEvent = state.get(masterKey);
        if (masterEvent) {
          const updatedMaster = withExcludedRecurrence(masterEvent, current.recurrenceId);
          setUpdated(state, changes, masterKey, updatedMaster);
        }
      }
    }
    state.delete(key);
    changes.push({ type: "removed", key, before: current });
    return { nextState: state, changes, effects };
  }
  for (const removeKey of keys) {
    const current = state.get(removeKey);
    if (!current) continue;
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
  const updated = withExcludedRecurrence(event, input.recurrenceId);
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
  const exclusionDates = new Set(event.exclusionDates ?? []);
  exclusionDates.delete(input.recurrenceId);
  const updated: CalendarEventView = { ...event, exclusionDates };
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
  const updatedMaster = withExcludedRecurrence(master, input.recurrenceId);
  setUpdated(state, changes, key, updatedMaster);

  const normalized = normalizeTimeRange(input.event);
  const exceptionKey = input.event.key ?? `${key}::${input.recurrenceId}`;
  const existing = state.get(exceptionKey);
  const exception: CalendarEventView = {
    ...master,
    ...input.event,
    start: normalized.start,
    end: normalized.end,
    recurrenceId: input.recurrenceId,
    isException: true,
    recurrenceRule: undefined,
  };
  if (existing) {
    setUpdated(state, changes, exceptionKey, exception);
  } else {
    state.set(exceptionKey, exception);
    changes.push({ type: "created", key: exceptionKey, event: exception });
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
      return Boolean(event?.recurrenceRule && !event?.recurrenceId);
    });
    if (masterKey) {
      const master = state.get(masterKey);
      if (master) {
        const updatedMaster = withExcludedRecurrence(master, recurrenceId);
        setUpdated(state, changes, masterKey, updatedMaster);
      }
    }
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

  constructor(initialState: EventsState, options: { timezone?: string } = {}) {
    this.#state = cloneState(initialState);
    this.#timezone = options.timezone;
  }

  getState(): EventsState {
    return cloneState(this.#state);
  }

  get(target: EventTarget): CalendarEventView | undefined {
    const key = resolveKey(this.#state, target);
    if (!key) return undefined;
    const event = this.#state.get(key);
    return event ? cloneEvent(event) : undefined;
  }

  expand(range: { start: CalendarEventDateValue; end: CalendarEventDateValue }): CalendarEventViewMap {
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
    const result = applyOperation(operation, { state: this.#state, timezone: this.#timezone });
    this.#state = cloneState(result.nextState);
    return {
      ...result,
      nextState: cloneState(result.nextState),
    };
  }
}

