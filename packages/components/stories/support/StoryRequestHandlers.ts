import { Temporal } from "@js-temporal/polyfill";
import { EventsAPI, parseRecurrenceId, shiftDateValue, type ApplyResult } from "@lit-calendar/events-api";
import { action } from "storybook/actions";
import {
  fromCreateRequest,
  fromDeleteRequest,
  fromUpdateRequest,
  moveFromUpdateRequest,
  resizeEndFromUpdateRequest,
  resizeStartFromUpdateRequest,
} from "../../src/domain/events-api/adapters.js";
import { resolvedDataEnd } from "../../src/domain/events-api/eventMapBridge.js";
import {
  isCalendarEventException,
  isCalendarEventRecurring,
} from "../../src/types/calendarEventSemantics.js";
import type {
  EventCreateRequestDetail,
  EventDeleteRequestDetail,
  EventExceptionRequestDetail,
  EventSelectionRequestDetail,
  EventUpdateRequestDetail,
} from "../../src/types/CalendarEventRequests.js";
import type { CalendarEvent } from "./StoryData.js";

type StoryCalendarElement = HTMLElement & { events: Map<string, CalendarEvent> };

type AttachRequestHandlersOptions = {
  preserveDateOnlyShape?: boolean;
  mode?: "sync" | "unsynced";
  onPendingChanged?: () => void;
};

const logCreateRequested = action("event-created");
const logCreateCancelled = action("event-created (cancelled)");
const logUpdateRequested = action("event-updated");
const logUpdateCommittedInstance = action("event-updated-committed-instance");
const logUpdateCommittedSeries = action("event-updated-committed-series");
const logDeleteRequested = action("event-deleted");
const logDeleteCommittedInstance = action("event-deleted-committed-instance");
const logDeleteCommittedSeries = action("event-deleted-committed-series");
const logDeleteCancelled = action("event-deleted (cancelled)");
const logSelectionRequested = action("event-selection");
const logExceptionRequested = action("event-exception");

function cloneEventMap(events: Map<string, CalendarEvent>): Map<string, CalendarEvent> {
  return new Map(
    Array.from(events.entries()).map(([key, value]) => [
      key,
      {
        ...value,
        data: {
          ...value.data,
          exclusionDates: value.data.exclusionDates
            ? new Set(value.data.exclusionDates)
            : undefined,
        },
      },
    ])
  );
}

function resolveEventMapKey(
  events: Map<string, CalendarEvent>,
  envelope: { eventId?: string; calendarId?: string; recurrenceId?: string }
): string | undefined {
  const eventId = envelope.eventId;
  if (!eventId) return undefined;
  if (events.has(eventId)) return eventId;
  let fallbackSeriesKey: string | undefined;
  for (const [key, event] of events.entries()) {
    if (event.eventId !== eventId) continue;
    if (envelope.calendarId !== undefined && event.calendarId !== envelope.calendarId) continue;
    if (envelope.recurrenceId === undefined || event.recurrenceId === envelope.recurrenceId)
      return key;
    if (event.recurrenceId === undefined && fallbackSeriesKey === undefined) {
      fallbackSeriesKey = key;
    }
  }
  return fallbackSeriesKey;
}

function preserveDateOnlyShape(
  nextValue: Temporal.PlainDateTime,
  currentAllDay: boolean
): Temporal.PlainDateTime {
  if (!currentAllDay) return nextValue;
  return nextValue.toPlainDate().toPlainDateTime({ hour: 0, minute: 0, second: 0 });
}

function toNextEventValue(
  nextValue: Temporal.PlainDateTime | undefined,
  currentValue: Temporal.PlainDateTime,
  currentAllDay: boolean,
  preserveDateOnly: boolean
): Temporal.PlainDateTime {
  if (!nextValue) return currentValue;
  return preserveDateOnly ? preserveDateOnlyShape(nextValue, currentAllDay) : nextValue;
}

function toPlainDateTime(value: Temporal.PlainDateTime): Temporal.PlainDateTime {
  return value;
}

function getUpdateKind(
  currentStart: Temporal.PlainDateTime,
  currentEnd: Temporal.PlainDateTime,
  nextStart: Temporal.PlainDateTime,
  nextEnd: Temporal.PlainDateTime
): "move" | "resize-start" | "resize-end" | "update" {
  const sameStart =
    Temporal.PlainDateTime.compare(toPlainDateTime(currentStart), toPlainDateTime(nextStart)) === 0;
  const sameEnd =
    Temporal.PlainDateTime.compare(toPlainDateTime(currentEnd), toPlainDateTime(nextEnd)) === 0;
  if (sameStart && sameEnd) return "update";
  if (!sameStart && sameEnd) return "resize-start";
  if (sameStart && !sameEnd) return "resize-end";

  const oldDuration = toPlainDateTime(currentStart).until(toPlainDateTime(currentEnd));
  const newDuration = toPlainDateTime(nextStart).until(toPlainDateTime(nextEnd));
  const unchangedDuration =
    oldDuration.total({ unit: "seconds" }) === newDuration.total({ unit: "seconds" });
  return unchangedDuration ? "move" : "update";
}

function movedToDifferentDay(
  currentStart: Temporal.PlainDateTime,
  nextStart: Temporal.PlainDateTime
): boolean {
  return (
    Temporal.PlainDate.compare(
      toPlainDateTime(currentStart).toPlainDate(),
      toPlainDateTime(nextStart).toPlainDate()
    ) !== 0
  );
}

function toUnsyncedState(result: ApplyResult): Map<string, CalendarEvent> {
  const nextState = new Map(result.nextState);

  for (const change of result.changes) {
    if (change.type === "created") {
      const created = nextState.get(change.key);
      if (!created) continue;
      nextState.set(change.key, {
        ...created,
        pendingOp: "created",
      });
      continue;
    }

    if (change.type === "updated") {
      const updated = nextState.get(change.key);
      if (!updated) continue;
      nextState.set(change.key, {
        ...updated,
        pendingOp: updated.pendingOp === "created" ? "created" : "updated",
      });
      continue;
    }

    // Keep deleted entries visible for `getPendingEvents()` in unsynced stories.
    if (change.before.pendingOp === "created") {
      nextState.delete(change.key);
      continue;
    }
    nextState.set(change.key, {
      ...change.before,
      pendingOp: "deleted",
    });
  }

  return nextState;
}

function applyApiResult(
  el: StoryCalendarElement,
  api: EventsAPI,
  onPendingChanged: (() => void) | undefined,
  mode: "sync" | "unsynced",
  result?: ApplyResult
) {
  const applied =
    result ??
    ({
      nextState: api.events,
      changes: [],
      effects: [],
    } as ApplyResult);
  el.events = mode === "unsynced" ? toUnsyncedState(applied) : new Map(applied.nextState);
  onPendingChanged?.();
}

function buildApi(el: StoryCalendarElement): EventsAPI {
  return new EventsAPI(new Map(el.events));
}

export function attachRequestEventHandlers(
  el: StoryCalendarElement,
  options: AttachRequestHandlersOptions = {}
) {
  const preserveDateOnly = options.preserveDateOnlyShape ?? false;
  const mode = options.mode ?? "sync";

  el.addEventListener("event-selection", (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const detail = event.detail as EventSelectionRequestDetail | null;
    if (!detail?.key) return;
    logSelectionRequested(detail);
  });

  el.addEventListener("event-created", (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const detail = event.detail as EventCreateRequestDetail | null;
    if (!detail?.content.start || !detail.content.end) return;
    logCreateRequested(detail);
    if (!event.cancelable) {
      return;
    }
    const api = buildApi(el);
    const createInput = fromCreateRequest(detail);
    const created = api.create({
      ...createInput,
      event: {
        ...createInput.event,
        eventId: `event-created-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      },
    });
    applyApiResult(el, api, options.onPendingChanged, mode, created);

    if (mode === "unsynced") return;

    const createdKey = created.changes.find((change) => change.type === "created");
    if (!createdKey || createdKey.type !== "created") return;

    const committedSummary = window.prompt("Event title", detail.content.summary ?? "New event");
    if (committedSummary === null) {
      event.preventDefault();
      logCreateCancelled(detail);
      const rollbackApi = buildApi(el);
      const rollbackResult = rollbackApi.remove({ target: { key: createdKey.key }, scope: "single" });
      applyApiResult(el, rollbackApi, options.onPendingChanged, mode, rollbackResult);
      return;
    }

    window.setTimeout(() => {
      const commitApi = buildApi(el);
      const commitResult = commitApi.update({
        target: { key: createdKey.key },
        scope: "single",
        patch: { summary: committedSummary },
      });
      applyApiResult(el, commitApi, options.onPendingChanged, mode, commitResult);
    }, 300);
  });

  el.addEventListener("event-updated", (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const detail = event.detail as EventUpdateRequestDetail | null;
    if (!detail?.envelope.eventId) return;
    logUpdateRequested(detail);
    if (!event.cancelable) {
      return;
    }

    const eventKey = resolveEventMapKey(el.events, detail.envelope);
    if (!eventKey) return;
    const current = el.events.get(eventKey);
    if (!current) return;

    const api = buildApi(el);
    const data = current.data;
    const currentEnd = resolvedDataEnd(data);
    const isRecurring = detail.envelope.isRecurring ?? isCalendarEventRecurring(current);
    const shouldPromptForSeries = isRecurring && !isCalendarEventException(current);
    const currentAllDay = data.allDay ?? false;
    const nextStart = toNextEventValue(
      detail.content.start,
      data.start,
      currentAllDay,
      preserveDateOnly
    );
    const nextEnd = toNextEventValue(detail.content.end, currentEnd, currentAllDay, preserveDateOnly);
    const recurrenceId = detail.envelope.recurrenceId;
    const occurrenceStart =
      data.recurrenceRule && !current.recurrenceId && recurrenceId
        ? (parseRecurrenceId(recurrenceId, data.allDay ?? false, data.start) ?? data.start)
        : data.start;
    const baseDuration = toPlainDateTime(data.start).until(toPlainDateTime(currentEnd));
    const occurrenceEnd = shiftDateValue(occurrenceStart, baseDuration);
    const updateKind = getUpdateKind(occurrenceStart, occurrenceEnd, nextStart, nextEnd);
    const baseUpdateInput = fromUpdateRequest(detail);
    const isRecurringInstanceMove =
      updateKind === "move" &&
      Boolean(
        recurrenceId &&
          data.recurrenceRule &&
          !current.recurrenceId &&
          movedToDifferentDay(occurrenceStart, nextStart)
      );

    if (isRecurringInstanceMove && recurrenceId) {
      const previousEvents = cloneEventMap(el.events);
      const addExceptionResult = api.addException({
        target: { key: eventKey },
        recurrenceId,
        event: {
          start: nextStart,
          end: nextEnd,
          summary: detail.content.summary,
          color: detail.content.color,
          location: detail.content.location,
          calendarId: detail.envelope.calendarId,
        },
      });
      applyApiResult(el, api, options.onPendingChanged, mode, addExceptionResult);

      const exceptionRequestDetail: EventExceptionRequestDetail = {
        envelope: {
          eventId: detail.envelope.eventId,
          calendarId: detail.envelope.calendarId,
          recurrenceId,
          isException: true,
          isRecurring: true,
        },
        content: {
          start: nextStart,
          end: nextEnd,
          summary: detail.content.summary,
          color: detail.content.color,
          location: detail.content.location,
        },
        source: "move",
      };
      logExceptionRequested(exceptionRequestDetail);
      const notCancelled = el.dispatchEvent(
        new CustomEvent("event-exception", {
          detail: exceptionRequestDetail,
          cancelable: true,
          composed: true,
        })
      );
      const keepException =
        mode === "sync"
          ? window.confirm("Save this as an exception?\n\nOK = keep\nCancel = revert")
          : true;
      if (!notCancelled || !keepException) {
        if (event.cancelable) event.preventDefault();
        el.events = previousEvents;
        options.onPendingChanged?.();
      }
      return;
    }

    if (!isRecurring || !shouldPromptForSeries) {
      logUpdateCommittedInstance({
        ...detail,
        envelope: {
          ...detail.envelope,
          recurrenceId: recurrenceId ?? current.recurrenceId,
        },
      });
      if (isRecurring && recurrenceId && data.recurrenceRule && !current.recurrenceId) {
        const addExceptionResult = api.addException({
          target: { key: eventKey },
          recurrenceId,
          event: {
            start: nextStart,
            end: nextEnd,
            summary: detail.content.summary,
            color: detail.content.color,
            location: detail.content.location,
            calendarId: detail.envelope.calendarId,
          },
        });
        applyApiResult(el, api, options.onPendingChanged, mode, addExceptionResult);
        return;
      }

      let operationResult: ApplyResult | undefined;
      if (updateKind === "move") {
        const delta = toPlainDateTime(occurrenceStart).until(toPlainDateTime(nextStart));
        operationResult = api.move({
          target: { key: eventKey },
          scope: "single",
          delta,
        });
      } else if (updateKind === "resize-start") {
        operationResult = api.resizeStart({
          target: { key: eventKey },
          scope: "single",
          toStart: nextStart,
        });
      } else if (updateKind === "resize-end") {
        operationResult = api.resizeEnd({
          target: { key: eventKey },
          scope: "single",
          toEnd: nextEnd,
        });
      } else {
        operationResult = api.update({
          ...baseUpdateInput,
          target: { key: eventKey },
          scope: "single",
          patch: {
            start: nextStart,
            end: nextEnd,
            summary: baseUpdateInput.patch.summary,
            color: baseUpdateInput.patch.color,
            location: baseUpdateInput.patch.location,
            calendarId: baseUpdateInput.patch.calendarId,
          },
        });
      }
      applyApiResult(el, api, options.onPendingChanged, mode, operationResult);
      return;
    }

    const commitSeries = window.confirm(
      "Apply changes to the whole series?\n\nOK = series\nCancel = only this instance"
    );
    if (!commitSeries) {
      let operationResult: ApplyResult | undefined;
      if (recurrenceId && data.recurrenceRule && !current.recurrenceId) {
        operationResult = api.addException({
          target: { key: eventKey },
          recurrenceId,
          event: {
            start: nextStart,
            end: nextEnd,
            summary: detail.content.summary,
            color: detail.content.color,
            location: detail.content.location,
            calendarId: detail.envelope.calendarId,
          },
        });
      } else {
        operationResult = api.update({
          target: { key: eventKey },
          scope: "single",
          patch: {
            start: nextStart,
            end: nextEnd,
            summary: detail.content.summary,
            color: detail.content.color,
            location: detail.content.location,
            calendarId: detail.envelope.calendarId,
          },
        });
      }
      logUpdateCommittedInstance(detail);
      applyApiResult(el, api, options.onPendingChanged, mode, operationResult);
      return;
    }

    logUpdateCommittedSeries({
      ...detail,
      envelope: {
        ...detail.envelope,
        recurrenceId: undefined,
        isException: false,
      },
    });

    let operationResult: ApplyResult | undefined;
    if (updateKind === "move") {
      const delta = toPlainDateTime(occurrenceStart).until(toPlainDateTime(nextStart));
      const moveInput = moveFromUpdateRequest(detail, delta);
      operationResult = api.move({ ...moveInput, target: { key: eventKey }, scope: "series" });
    } else if (updateKind === "resize-start") {
      const resizeInput = resizeStartFromUpdateRequest(detail);
      const startDelta = toPlainDateTime(occurrenceStart).until(toPlainDateTime(nextStart));
      operationResult = api.resizeStart({
        ...(resizeInput ?? { target: { key: eventKey }, scope: "series", toStart: nextStart }),
        target: { key: eventKey },
        scope: "series",
        toStart: shiftDateValue(data.start, startDelta),
      });
    } else if (updateKind === "resize-end") {
      const resizeInput = resizeEndFromUpdateRequest(detail);
      const endDelta = toPlainDateTime(occurrenceEnd).until(toPlainDateTime(nextEnd));
      operationResult = api.resizeEnd({
        ...(resizeInput ?? { target: { key: eventKey }, scope: "series", toEnd: nextEnd }),
        target: { key: eventKey },
        scope: "series",
        toEnd: shiftDateValue(currentEnd, endDelta),
      });
    } else {
      operationResult = api.update({
        ...baseUpdateInput,
        target: { key: eventKey },
        scope: "series",
        patch: {
          start: nextStart,
          end: nextEnd,
          summary: baseUpdateInput.patch.summary,
          color: baseUpdateInput.patch.color,
          location: baseUpdateInput.patch.location,
          calendarId: baseUpdateInput.patch.calendarId,
        },
      });
    }
    applyApiResult(el, api, options.onPendingChanged, mode, operationResult);
  });

  el.addEventListener("event-deleted", (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const detail = event.detail as EventDeleteRequestDetail | null;
    if (!detail) return;
    if (!event.cancelable) {
      logDeleteRequested(detail);
      return;
    }
    const eventKey = resolveEventMapKey(el.events, detail.envelope);
    if (!eventKey) return;
    const current = el.events.get(eventKey);
    if (!current) return;
    logDeleteRequested(detail);

    const api = buildApi(el);
    const isRecurring = detail.envelope.isRecurring ?? isCalendarEventRecurring(current);
    const shouldPromptForSeries = isRecurring && !isCalendarEventException(current);
    const recurrenceId = detail.envelope.recurrenceId ?? current.recurrenceId;
    const baseDeleteInput = fromDeleteRequest(detail);

    if (!shouldPromptForSeries) {
      const doDelete = confirm("Are you sure you want to delete this event?");
      if (!doDelete) {
        event.preventDefault();
        logDeleteCancelled(detail);
        return;
      }
      logDeleteCommittedInstance(detail);
      let operationResult: ApplyResult | undefined;
      if (isCalendarEventException(current)) {
        operationResult = api.removeException({
          target: { key: eventKey },
          recurrenceId,
          options: { asExclusion: true },
        });
      } else if (isRecurring && recurrenceId && current.data.recurrenceRule && !current.recurrenceId) {
        operationResult = api.addExclusion({ target: { key: eventKey }, recurrenceId });
      } else {
        operationResult = api.remove({ ...baseDeleteInput, target: { key: eventKey }, scope: "single" });
      }
      applyApiResult(el, api, options.onPendingChanged, mode, operationResult);
      return;
    }

    const commitSeries = window.confirm(
      "Delete the whole series?\n\nOK = series\nCancel = only this instance"
    );
    if (commitSeries) {
      logDeleteCommittedSeries({
        envelope: {
          ...detail.envelope,
          recurrenceId: undefined,
        },
      });
      const removeResult = api.remove({ ...baseDeleteInput, target: { key: eventKey }, scope: "series" });
      applyApiResult(el, api, options.onPendingChanged, mode, removeResult);
      return;
    }

    logDeleteCommittedInstance({
      envelope: {
        ...detail.envelope,
        recurrenceId,
      },
    });
    let operationResult: ApplyResult | undefined;
    if (recurrenceId && current.data.recurrenceRule && !current.recurrenceId) {
      api.addExclusion({ target: { key: eventKey }, recurrenceId });
      operationResult = api.removeException({
        target: { key: `${eventKey}::${recurrenceId}` },
        options: { asExclusion: true },
      });
    } else if (isCalendarEventException(current)) {
      operationResult = api.removeException({
        target: { key: eventKey },
        recurrenceId,
        options: { asExclusion: true },
      });
    } else {
      operationResult = api.remove({ ...baseDeleteInput, target: { key: eventKey }, scope: "single" });
    }
    applyApiResult(el, api, options.onPendingChanged, mode, operationResult);
  });
}

export function attachUnsyncedRequestEventHandlers(
  el: StoryCalendarElement,
  options: Omit<AttachRequestHandlersOptions, "mode"> = {}
) {
  attachRequestEventHandlers(el, {
    ...options,
    mode: "unsynced",
  });
}
