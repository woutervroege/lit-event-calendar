import { Temporal } from "@js-temporal/polyfill";
import { action } from "storybook/actions";
import type {
  EventCreateRequestDetail,
  EventDeleteRequestDetail,
  EventUpdateRequestDetail,
} from "./models/CalendarEventRequests.js";
import type { CalendarEvent } from "./storyData.js";

type StoryCalendarElement = HTMLElement & { events: Map<string, CalendarEvent> };

type AttachRequestHandlersOptions = {
  preserveDateOnlyShape?: boolean;
};

const logCreateRequested = action("event-create-requested");
const logCreateCancelled = action("event-create-requested (cancelled)");
const logUpdateRequested = action("event-update-requested");
const logDeleteRequested = action("event-delete-requested");
const logDeleteCancelled = action("event-delete-requested (cancelled)");

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

export function attachRequestEventHandlers(
  el: StoryCalendarElement,
  options: AttachRequestHandlersOptions = {}
) {
  const preserveDateOnly = options.preserveDateOnlyShape ?? false;

  el.addEventListener("event-create-requested", (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const detail = event.detail as EventCreateRequestDetail | null;
    if (!detail?.content.start || !detail.content.end) return;
    logCreateRequested(detail);

    const eventId = `event-created-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const optimisticEvents = new Map(el.events);
    optimisticEvents.set(eventId, {
      eventId,
      start: detail.content.start,
      end: detail.content.end,
      summary: detail.content.summary ?? "New event",
      color: detail.content.color ?? "#0ea5e9",
      calendarId: detail.envelope.calendarId,
      isOptimistic: true,
    });
    el.events = optimisticEvents;

    const committedSummary = window.prompt("Event title", detail.content.summary ?? "New event");
    if (committedSummary === null) {
      event.preventDefault();
      logCreateCancelled(detail);
      const rolledBackEvents = new Map(el.events);
      rolledBackEvents.delete(eventId);
      el.events = rolledBackEvents;
      return;
    }

    window.setTimeout(() => {
      const committedEvents = new Map(el.events);
      const created = committedEvents.get(eventId);
      if (!created) return;
      committedEvents.set(eventId, {
        ...created,
        summary: committedSummary,
        isOptimistic: false,
      });
      el.events = committedEvents;
    }, 300);
  });

  el.addEventListener("event-update-requested", (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const detail = event.detail as EventUpdateRequestDetail | null;
    if (!detail?.envelope.eventId) return;
    logUpdateRequested(detail);

    const current = el.events.get(detail.envelope.eventId);
    if (!current) return;

    el.events = new Map(el.events).set(detail.envelope.eventId, {
      ...current,
      start: toNextEventValue(detail.content.start, current.start, preserveDateOnly),
      end: toNextEventValue(detail.content.end, current.end, preserveDateOnly),
      summary: detail.content.summary ?? current.summary,
      color: detail.content.color ?? current.color,
      calendarId: detail.envelope.calendarId ?? current.calendarId,
      recurrenceId: detail.envelope.recurrenceId ?? current.recurrenceId,
      isException: detail.envelope.isException ?? current.isException,
    });
  });

  el.addEventListener("event-delete-requested", (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const detail = event.detail as EventDeleteRequestDetail | null;
    const eventId = detail?.envelope.eventId;
    if (!eventId) return;
    if (!el.events.has(eventId)) return;
    logDeleteRequested(detail);

    const nextEvents = new Map(el.events);
    const doDelete = confirm("Are you sure you want to delete this event?");
    if (!doDelete) {
      event.preventDefault();
      logDeleteCancelled(detail);
      return;
    }
    nextEvents.delete(eventId);
    el.events = nextEvents;
  });
}
