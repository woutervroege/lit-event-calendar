import { Temporal } from "@js-temporal/polyfill";
import type { CalendarEvent } from "./storyData.js";
import { toTemporalDateLike } from "./storyData.js";

type StoryCalendarElement = HTMLElement & { events: Map<string, CalendarEvent> };

type EventCreateRequestDetail = {
  start?: string;
  end?: string;
  summary?: string;
  color?: string;
  sourceId?: string;
  trigger?: string;
};

type EventUpdateRequestDetail = {
  eventId?: string;
  start?: string;
  end?: string;
  summary?: string;
  color?: string;
};

type EventDeleteRequestDetail = {
  eventId?: string;
};

type AttachRequestHandlersOptions = {
  preserveDateOnlyShape?: boolean;
};

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
  nextValue: string | undefined,
  currentValue: CalendarEvent["start"],
  preserveDateOnly: boolean
): CalendarEvent["start"] {
  if (!nextValue) return currentValue;
  const parsedValue = toTemporalDateLike(nextValue);
  return preserveDateOnly ? preserveDateOnlyShape(parsedValue, currentValue) : parsedValue;
}

export function attachRequestEventHandlers(
  el: StoryCalendarElement,
  options: AttachRequestHandlersOptions = {}
) {
  const preserveDateOnly = options.preserveDateOnlyShape ?? false;

  el.addEventListener("event-create-requested", (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const detail = event.detail as EventCreateRequestDetail | null;
    if (!detail?.start || !detail.end) return;

    const eventId = `event-created-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const optimisticEvents = new Map(el.events);
    optimisticEvents.set(eventId, {
      eventId,
      start: toTemporalDateLike(detail.start),
      end: toTemporalDateLike(detail.end),
      summary: detail.summary ?? "New event",
      color: detail.color ?? "#0ea5e9",
      sourceId: detail.sourceId,
      isOptimistic: true,
    });
    el.events = optimisticEvents;

    const committedSummary = window.prompt("Event title", detail.summary ?? "New event");
    if (committedSummary === null) {
      event.preventDefault();
      const rolledBackEvents = new Map(el.events);
      rolledBackEvents.delete(eventId);
      el.events = rolledBackEvents;
      console.info("event-create-requested (cancelled)", { eventId });
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

    console.info("event-create-requested", {
      eventId,
      start: detail.start,
      end: detail.end,
      trigger: detail.trigger ?? null,
    });
  });

  el.addEventListener("event-update-requested", (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const detail = event.detail as EventUpdateRequestDetail | null;
    if (!detail?.eventId) return;

    const current = el.events.get(detail.eventId);
    if (!current) return;

    el.events = new Map(el.events).set(detail.eventId, {
      ...current,
      start: toNextEventValue(detail.start, current.start, preserveDateOnly),
      end: toNextEventValue(detail.end, current.end, preserveDateOnly),
      summary: detail.summary ?? current.summary,
      color: detail.color ?? current.color,
    });

    console.info("event-update-requested", {
      eventId: detail.eventId,
      start: detail.start ?? null,
      end: detail.end ?? null,
    });
  });

  el.addEventListener("event-delete-requested", (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const detail = event.detail as EventDeleteRequestDetail | null;
    if (!detail?.eventId) return;
    if (!el.events.has(detail.eventId)) return;

    const nextEvents = new Map(el.events);
    const doDelete = confirm("Are you sure you want to delete this event?");
    if (!doDelete) {
      event.preventDefault();
      console.info("event-delete-requested (cancelled)", { eventId: detail.eventId });
      return;
    }
    nextEvents.delete(detail.eventId);
    el.events = nextEvents;
    console.info("event-delete-requested", { eventId: detail.eventId });
  });
}
