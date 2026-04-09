import { Temporal } from "@js-temporal/polyfill";
import { action } from "storybook/actions";
import {
  EventsAPI,
  fromCreateRequest,
  fromDeleteRequest,
  fromUpdateRequest,
  moveFromUpdateRequest,
  parseRecurrenceId,
  resizeEndFromUpdateRequest,
  resizeStartFromUpdateRequest,
  shiftDateValue,
} from "../../src/domain/event-ops/index.js";
import {
  isCalendarEventException,
  isCalendarEventRecurring,
} from "../../src/types/CalendarEvent.js";
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

const logCreateRequested = action("event-create");
const logCreateCancelled = action("event-create (cancelled)");
const logUpdateRequested = action("event-update");
const logUpdateCommittedInstance = action("event-update-committed-instance");
const logUpdateCommittedSeries = action("event-update-committed-series");
const logDeleteRequested = action("event-delete");
const logDeleteCommittedInstance = action("event-delete-committed-instance");
const logDeleteCommittedSeries = action("event-delete-committed-series");
const logDeleteCancelled = action("event-delete (cancelled)");
const logSelectionRequested = action("event-selection");
const logExceptionRequested = action("event-exception");

function cloneEventMap(events: Map<string, CalendarEvent>): Map<string, CalendarEvent> {
  return new Map(
    Array.from(events.entries()).map(([key, value]) => [
      key,
      {
        ...value,
        exclusionDates: value.exclusionDates ? new Set(value.exclusionDates) : undefined,
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
  nextValue: CalendarEvent["start"] | null | undefined,
  currentValue: CalendarEvent["start"]
): CalendarEvent["start"] {
  if (!nextValue) return currentValue;
  if (currentValue instanceof Temporal.PlainDate) {
    if ("toPlainDate" in nextValue) {
      return nextValue.toPlainDate();
    }
    return nextValue;
  }
  return nextValue;
}

function toNextEventValue(
  nextValue: CalendarEvent["start"] | undefined,
  currentValue: CalendarEvent["start"],
  preserveDateOnly: boolean
): CalendarEvent["start"] {
  if (!nextValue) return currentValue;
  return preserveDateOnly ? preserveDateOnlyShape(nextValue, currentValue) : nextValue;
}

function toPlainDateTime(value: CalendarEvent["start"]): Temporal.PlainDateTime {
  if (value instanceof Temporal.PlainDate) {
    return value.toPlainDateTime({ hour: 0, minute: 0, second: 0 });
  }
  if (value instanceof Temporal.PlainDateTime) return value;
  return value.toPlainDateTime();
}

function getUpdateKind(
  currentStart: CalendarEvent["start"],
  currentEnd: CalendarEvent["start"],
  nextStart: CalendarEvent["start"],
  nextEnd: CalendarEvent["start"]
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
  currentStart: CalendarEvent["start"],
  nextStart: CalendarEvent["start"]
): boolean {
  return (
    Temporal.PlainDate.compare(
      toPlainDateTime(currentStart).toPlainDate(),
      toPlainDateTime(nextStart).toPlainDate()
    ) !== 0
  );
}

function applyApiResult(el: StoryCalendarElement, api: EventsAPI, onPendingChanged?: () => void) {
  el.events = api.getState();
  onPendingChanged?.();
}

function buildApi(el: StoryCalendarElement): EventsAPI {
  return new EventsAPI(el.events);
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
    if (!detail?.envelope.eventId) return;
    logSelectionRequested(detail);
  });

  el.addEventListener("event-create", (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const detail = event.detail as EventCreateRequestDetail | null;
    if (!detail?.content.start || !detail.content.end) return;
    logCreateRequested(detail);
    const api = buildApi(el);
    const createInput = fromCreateRequest(detail);
    const created = api.create({
      ...createInput,
      event: {
        ...createInput.event,
        eventId: `event-created-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      },
    });
    applyApiResult(el, api, options.onPendingChanged);

    if (mode === "unsynced") return;

    const createdKey = created.changes.find((change) => change.type === "created");
    if (!createdKey || createdKey.type !== "created") return;

    const committedSummary = window.prompt("Event title", detail.content.summary ?? "New event");
    if (committedSummary === null) {
      event.preventDefault();
      logCreateCancelled(detail);
      const rollbackApi = buildApi(el);
      rollbackApi.remove({ target: { key: createdKey.key }, scope: "single" });
      applyApiResult(el, rollbackApi, options.onPendingChanged);
      return;
    }

    window.setTimeout(() => {
      const commitApi = buildApi(el);
      commitApi.update({
        target: { key: createdKey.key },
        scope: "single",
        patch: { summary: committedSummary },
      });
      applyApiResult(el, commitApi, options.onPendingChanged);
    }, 300);
  });

  el.addEventListener("event-update", (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const detail = event.detail as EventUpdateRequestDetail | null;
    if (!detail?.envelope.eventId) return;
    logUpdateRequested(detail);

    const eventKey = resolveEventMapKey(el.events, detail.envelope);
    if (!eventKey) return;
    const current = el.events.get(eventKey);
    if (!current) return;

    const api = buildApi(el);
    const isRecurring = detail.envelope.isRecurring ?? isCalendarEventRecurring(current);
    const shouldPromptForSeries = isRecurring && !isCalendarEventException(current);
    const nextStart = toNextEventValue(detail.content.start, current.start, preserveDateOnly);
    const nextEnd = toNextEventValue(detail.content.end, current.end, preserveDateOnly);
    const recurrenceId = detail.envelope.recurrenceId;
    const occurrenceStart =
      current.recurrenceRule && !current.recurrenceId && recurrenceId
        ? (parseRecurrenceId(recurrenceId, current.start) ?? current.start)
        : current.start;
    const baseDuration = toPlainDateTime(current.start).until(toPlainDateTime(current.end));
    const occurrenceEnd = shiftDateValue(occurrenceStart, baseDuration);
    const updateKind = getUpdateKind(occurrenceStart, occurrenceEnd, nextStart, nextEnd);
    const baseUpdateInput = fromUpdateRequest(detail);
    const isRecurringInstanceMove =
      updateKind === "move" &&
      Boolean(
        recurrenceId &&
          current.recurrenceRule &&
          !current.recurrenceId &&
          movedToDifferentDay(occurrenceStart, nextStart)
      );

    if (isRecurringInstanceMove && recurrenceId) {
      const previousEvents = cloneEventMap(el.events);
      api.addException({
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
      applyApiResult(el, api, options.onPendingChanged);

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
      if (isRecurring && recurrenceId && current.recurrenceRule && !current.recurrenceId) {
        api.addException({
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
        applyApiResult(el, api, options.onPendingChanged);
        return;
      }

      if (updateKind === "move") {
        const delta = toPlainDateTime(occurrenceStart).until(toPlainDateTime(nextStart));
        api.move({
          target: { key: eventKey },
          scope: "single",
          delta,
        });
      } else if (updateKind === "resize-start") {
        api.resizeStart({
          target: { key: eventKey },
          scope: "single",
          toStart: nextStart,
        });
      } else if (updateKind === "resize-end") {
        api.resizeEnd({
          target: { key: eventKey },
          scope: "single",
          toEnd: nextEnd,
        });
      } else {
        api.update({
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
      applyApiResult(el, api, options.onPendingChanged);
      return;
    }

    const commitSeries = window.confirm(
      "Apply changes to the whole series?\n\nOK = series\nCancel = only this instance"
    );
    if (!commitSeries) {
      if (recurrenceId && current.recurrenceRule && !current.recurrenceId) {
        api.addException({
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
        api.update({
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
      applyApiResult(el, api, options.onPendingChanged);
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

    if (updateKind === "move") {
      const delta = toPlainDateTime(occurrenceStart).until(toPlainDateTime(nextStart));
      const moveInput = moveFromUpdateRequest(detail, delta);
      api.move({ ...moveInput, target: { key: eventKey }, scope: "series" });
    } else if (updateKind === "resize-start") {
      const resizeInput = resizeStartFromUpdateRequest(detail);
      const startDelta = toPlainDateTime(occurrenceStart).until(toPlainDateTime(nextStart));
      api.resizeStart({
        ...(resizeInput ?? { target: { key: eventKey }, scope: "series", toStart: nextStart }),
        target: { key: eventKey },
        scope: "series",
        toStart: shiftDateValue(current.start, startDelta),
      });
    } else if (updateKind === "resize-end") {
      const resizeInput = resizeEndFromUpdateRequest(detail);
      const endDelta = toPlainDateTime(occurrenceEnd).until(toPlainDateTime(nextEnd));
      api.resizeEnd({
        ...(resizeInput ?? { target: { key: eventKey }, scope: "series", toEnd: nextEnd }),
        target: { key: eventKey },
        scope: "series",
        toEnd: shiftDateValue(current.end, endDelta),
      });
    } else {
      api.update({
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
    applyApiResult(el, api, options.onPendingChanged);
  });

  el.addEventListener("event-delete", (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const detail = event.detail as EventDeleteRequestDetail | null;
    if (!detail) return;
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
      if (isCalendarEventException(current)) {
        api.removeException({
          target: { key: eventKey },
          recurrenceId,
          options: { asExclusion: true },
        });
      } else if (isRecurring && recurrenceId && current.recurrenceRule && !current.recurrenceId) {
        api.addExclusion({ target: { key: eventKey }, recurrenceId });
      } else {
        api.remove({ ...baseDeleteInput, target: { key: eventKey }, scope: "single" });
      }
      applyApiResult(el, api, options.onPendingChanged);
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
      api.remove({ ...baseDeleteInput, target: { key: eventKey }, scope: "series" });
      applyApiResult(el, api, options.onPendingChanged);
      return;
    }

    logDeleteCommittedInstance({
      envelope: {
        ...detail.envelope,
        recurrenceId,
      },
    });
    if (recurrenceId && current.recurrenceRule && !current.recurrenceId) {
      api.addExclusion({ target: { key: eventKey }, recurrenceId });
      api.removeException({
        target: { key: `${eventKey}::${recurrenceId}` },
        options: { asExclusion: true },
      });
    } else if (isCalendarEventException(current)) {
      api.removeException({
        target: { key: eventKey },
        recurrenceId,
        options: { asExclusion: true },
      });
    } else {
      api.remove({ ...baseDeleteInput, target: { key: eventKey }, scope: "single" });
    }
    applyApiResult(el, api, options.onPendingChanged);
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
