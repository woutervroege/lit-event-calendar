import { Temporal } from "@js-temporal/polyfill";
import { ContextConsumer } from "@lit/context";
import { expandEvents, parseRecurrenceId, shiftDateValue, type EventOperation } from "@lit-calendar/events-api";
import { BaseElement } from "../BaseElement/BaseElement.js";
import { type EventsAPIContextValue, eventsAPIContext } from "../context/EventsAPIContext.js";
import {
  fromCreateRequest,
  fromDeleteRequest,
  fromUpdateRequest,
  moveFromUpdateRequest,
} from "../domain/events-api/adapters.js";
import type {
  CalendarEventDateValue,
  CalendarEventPendingByCalendarId,
  CalendarEventPendingByOperation,
  CalendarEventPendingGroups,
  CalendarEventPendingOperation,
  CalendarEventPendingOptions,
  CalendarEventPendingResult,
  CalendarEventView,
  CalendarEventViewEntry as EventEntry,
  CalendarEventViewMap as EventsMap,
} from "../types/CalendarEvent.js";
import { isCalendarEventException, isCalendarEventRecurring } from "../types/CalendarEvent.js";
import type {
  EventCreateRequestDetail,
  EventDeleteRequestDetail,
  EventExceptionRequestDetail,
  EventUpdateRequestDetail,
} from "../types/CalendarEventRequests.js";
import type { WeekdayNumber } from "../types/Weekday.js";
import { getLocaleDirection, getLocaleWeekInfo, resolveLocale } from "../utils/Locale.js";

export function isWeekdayNumber(value: number | undefined): value is WeekdayNumber {
  return Boolean(value && Number.isInteger(value) && value >= 1 && value <= 7);
}

export abstract class CalendarViewBase extends BaseElement {
  #lang?: string;
  #timezone?: string;
  #currentTime?: string;
  #eventsAPI?: EventsAPIContextValue;
  #eventsAPIConsumer = new ContextConsumer(this, {
    context: eventsAPIContext,
    subscribe: true,
    callback: (value: EventsAPIContextValue | undefined) => {
      this.#eventsAPI = value;
      this.requestUpdate();
    },
  });

  declare events?: EventsMap;
  defaultEventSummary = "New event";
  defaultEventColor = "#0ea5e9";
  defaultCalendarId?: string;

  static get properties() {
    return {
      events: {
        type: Object,
        converter: {
          fromAttribute: (value: string | null): EventsMap =>
            new Map(JSON.parse(value || "[]") as EventEntry[]),
        },
      },
      lang: { type: String },
      dir: { type: String, reflect: true },
      timezone: { type: String },
      currentTime: { type: String, attribute: "current-time" },
      defaultEventSummary: { type: String, attribute: "default-event-summary" },
      defaultEventColor: { type: String, attribute: "default-event-color" },
      defaultCalendarId: { type: String, attribute: "default-source-id" },
    } as const;
  }

  get lang(): string {
    return resolveLocale(this.#lang);
  }

  set lang(lang: string | null | undefined) {
    this.#lang = lang?.trim() ? lang : undefined;
  }

  get timezone(): string {
    return this.#timezone ?? Temporal.Now.timeZoneId();
  }

  set timezone(timezone: string | null | undefined) {
    this.#timezone = timezone?.trim() ? timezone : undefined;
  }

  get currentTime(): string {
    return this.#currentTime ?? Temporal.Now.zonedDateTimeISO(this.timezone).toString();
  }

  set currentTime(currentTime:
    | Temporal.PlainDateTime
    | Temporal.ZonedDateTime
    | string
    | null
    | undefined) {
    this.#currentTime = currentTime?.toString() ?? undefined;
  }

  connectedCallback() {
    super.connectedCallback();
    void this.#eventsAPIConsumer;
  }

  protected applyCreateRequestToEventsAPI(detail: EventCreateRequestDetail): boolean {
    if (!this.#eventsAPI) return false;
    this.#applyEventsAPIOperation({ type: "create", input: fromCreateRequest(detail) });
    return true;
  }

  protected applyUpdateRequestToEventsAPI(detail: EventUpdateRequestDetail): {
    handled: boolean;
    accepted: boolean;
  } {
    if (!this.#eventsAPI || !detail.envelope.eventId) return { handled: false, accepted: true };
    const events = this.#eventsAPI.getState() ?? new Map();
    const eventKey = this.#resolveEventMapKey(events, detail.envelope);
    if (!eventKey) return { handled: false, accepted: true };
    const current = events.get(eventKey);
    if (!current) return { handled: false, accepted: true };

    const isRecurring = detail.envelope.isRecurring ?? isCalendarEventRecurring(current);
    const shouldPromptForSeries = isRecurring && !isCalendarEventException(current);
    const recurrenceId = detail.envelope.recurrenceId ?? current.recurrenceId;
    const occurrenceStart =
      current.recurrenceRule && !current.recurrenceId && recurrenceId
        ? (parseRecurrenceId(recurrenceId, current.start) ?? current.start)
        : current.start;
    const baseDuration = this.#toPlainDateTime(current.start).until(
      this.#toPlainDateTime(current.end)
    );
    const occurrenceEnd = shiftDateValue(occurrenceStart, baseDuration);
    const updateKind = this.#getUpdateKind(
      occurrenceStart,
      occurrenceEnd,
      detail.content.start,
      detail.content.end
    );

    const shouldCreateExceptionFromMove = Boolean(
      updateKind === "move" &&
        recurrenceId &&
        current.recurrenceRule &&
        !current.recurrenceId &&
        this.#movedToDifferentDay(occurrenceStart, detail.content.start)
    );

    if (shouldCreateExceptionFromMove && recurrenceId) {
      const exceptionRequestedDetail: EventExceptionRequestDetail = {
        envelope: {
          eventId: detail.envelope.eventId,
          calendarId: detail.envelope.calendarId,
          recurrenceId,
          isException: true,
          isRecurring: true,
        },
        content: { ...detail.content },
        source: "move",
      };
      const accepted = this.dispatchEvent(
        new CustomEvent("event-exception", {
          detail: exceptionRequestedDetail,
          composed: true,
          cancelable: true,
        })
      );
      const keepException = window.confirm(
        "Save this as an exception?\n\nOK = keep\nCancel = revert"
      );
      if (!accepted || !keepException) {
        return { handled: true, accepted: false };
      }
      this.#applyEventsAPIOperation({
        type: "add-exception",
        input: {
          target: { key: eventKey },
          recurrenceId,
          event: {
            start: detail.content.start,
            end: detail.content.end,
            summary: detail.content.summary,
            color: detail.content.color,
            location: detail.content.location,
            calendarId: detail.envelope.calendarId,
          },
        },
      });
      return { handled: true, accepted: true };
    }

    if (shouldPromptForSeries) {
      const commitSeries = window.confirm(
        "Apply changes to the whole series?\n\nOK = series\nCancel = only this instance"
      );
      if (!commitSeries) {
        if (recurrenceId && current.recurrenceRule && !current.recurrenceId) {
          this.#applyEventsAPIOperation({
            type: "add-exception",
            input: {
              target: { key: eventKey },
              recurrenceId,
              event: {
                start: detail.content.start,
                end: detail.content.end,
                summary: detail.content.summary,
                color: detail.content.color,
                location: detail.content.location,
                calendarId: detail.envelope.calendarId,
              },
            },
          });
          return { handled: true, accepted: true };
        }
        this.#applyEventsAPIOperation({
          type: "update",
          input: {
            target: { key: eventKey },
            scope: "single",
            patch: {
              start: detail.content.start,
              end: detail.content.end,
              summary: detail.content.summary,
              color: detail.content.color,
              location: detail.content.location,
              calendarId: detail.envelope.calendarId,
            },
          },
        });
        return { handled: true, accepted: true };
      }

      if (updateKind === "move") {
        const delta = this.#toPlainDateTime(occurrenceStart).until(
          this.#toPlainDateTime(detail.content.start)
        );
        const moveInput = moveFromUpdateRequest(detail, delta);
        this.#applyEventsAPIOperation({
          type: "move",
          input: {
            ...moveInput,
            target: { key: eventKey },
            scope: "series",
          },
        });
        return { handled: true, accepted: true };
      }

      if (updateKind === "resize-start") {
        const startDelta = this.#toPlainDateTime(occurrenceStart).until(
          this.#toPlainDateTime(detail.content.start)
        );
        this.#applyEventsAPIOperation({
          type: "resize-start",
          input: {
            target: { key: eventKey },
            scope: "series",
            toStart: shiftDateValue(current.start, startDelta),
          },
        });
        return { handled: true, accepted: true };
      }

      if (updateKind === "resize-end") {
        const endDelta = this.#toPlainDateTime(occurrenceEnd).until(
          this.#toPlainDateTime(detail.content.end)
        );
        this.#applyEventsAPIOperation({
          type: "resize-end",
          input: {
            target: { key: eventKey },
            scope: "series",
            toEnd: shiftDateValue(current.end, endDelta),
          },
        });
        return { handled: true, accepted: true };
      }

      this.#applyEventsAPIOperation({
        type: "update",
        input: {
          target: { key: eventKey },
          scope: "series",
          patch: {
            start: detail.content.start,
            end: detail.content.end,
            summary: detail.content.summary,
            color: detail.content.color,
            location: detail.content.location,
            calendarId: detail.envelope.calendarId,
          },
        },
      });
      return { handled: true, accepted: true };
    }

    if (updateKind === "move") {
      const delta = this.#toPlainDateTime(occurrenceStart).until(
        this.#toPlainDateTime(detail.content.start)
      );
      const moveInput = moveFromUpdateRequest(detail, delta);
      this.#applyEventsAPIOperation({
        type: "move",
        input: {
          ...moveInput,
          target: { key: eventKey },
        },
      });
      return { handled: true, accepted: true };
    }

    if (updateKind === "resize-start") {
      this.#applyEventsAPIOperation({
        type: "resize-start",
        input: {
          target: { key: eventKey },
          scope: detail.envelope.isRecurring && !detail.envelope.isException ? "series" : "single",
          toStart: detail.content.start,
        },
      });
      return { handled: true, accepted: true };
    }

    if (updateKind === "resize-end") {
      this.#applyEventsAPIOperation({
        type: "resize-end",
        input: {
          target: { key: eventKey },
          scope: detail.envelope.isRecurring && !detail.envelope.isException ? "series" : "single",
          toEnd: detail.content.end,
        },
      });
      return { handled: true, accepted: true };
    }

    const updateInput = fromUpdateRequest(detail);
    this.#applyEventsAPIOperation({
      type: "update",
      input: {
        ...updateInput,
        target: { key: eventKey },
      },
    });
    return { handled: true, accepted: true };
  }

  protected applyDeleteRequestToEventsAPI(detail: EventDeleteRequestDetail): boolean {
    if (!this.#eventsAPI || !detail.envelope.eventId) return false;
    const events = this.#eventsAPI.getState() ?? new Map();
    const eventKey = this.#resolveEventMapKey(events, detail.envelope);
    if (!eventKey) return false;
    const current = events.get(eventKey);
    if (!current) return false;

    const recurrenceId = detail.envelope.recurrenceId ?? current.recurrenceId;
    const isRecurring = detail.envelope.isRecurring ?? isCalendarEventRecurring(current);
    const shouldPromptForSeries = isRecurring && !isCalendarEventException(current);

    if (!shouldPromptForSeries) {
      const doDelete = window.confirm("Are you sure you want to delete this event?");
      if (!doDelete) return true;
    } else {
      const commitSeries = window.confirm(
        "Delete the whole series?\n\nOK = series\nCancel = only this instance"
      );
      if (commitSeries) {
        this.#applyEventsAPIOperation({
          type: "remove",
          input: {
            ...fromDeleteRequest(detail),
            target: { key: eventKey },
            scope: "series",
          },
        });
        return true;
      }
    }

    if (isCalendarEventException(current)) {
      this.#applyEventsAPIOperation({
        type: "remove-exception",
        input: {
          target: { key: eventKey },
          recurrenceId,
          options: { asExclusion: true },
        },
      });
      return true;
    }

    if (isRecurring && recurrenceId && current.recurrenceRule && !current.recurrenceId) {
      this.#applyEventsAPIOperation({
        type: "add-exclusion",
        input: {
          target: { key: eventKey },
          recurrenceId,
        },
      });
      return true;
    }

    const removeInput = fromDeleteRequest(detail);
    this.#applyEventsAPIOperation({
      type: "remove",
      input: {
        ...removeInput,
        target: { key: eventKey },
        scope: "single",
      },
    });
    return true;
  }

  getRenderedEvents(range: {
    start: CalendarEventDateValue;
    end: CalendarEventDateValue;
  }): EventsMap {
    return expandEvents(this.events ?? new Map(), range, { timezone: this.timezone });
  }

  get pendingByCalendarId(): CalendarEventPendingByCalendarId {
    return this.getPendingEvents({ groupBy: "calendarId" });
  }

  getPendingEvents(options: { groupBy: "pendingOp" }): CalendarEventPendingGroups;
  getPendingEvents(options: { groupBy: "calendarId" }): CalendarEventPendingByCalendarId;
  getPendingEvents(options: CalendarEventPendingOptions = {}): CalendarEventPendingResult {
    if (options.groupBy === "calendarId") return this.#collectPendingByCalendarId();
    return this.#collectPendingByOperation();
  }

  #collectPendingByOperation(): CalendarEventPendingGroups {
    const grouped: CalendarEventPendingGroups = this.#createPendingGroupsMap();
    for (const [id, event] of this.events ?? []) {
      const pendingOp = this.#resolvePendingOperation(event);
      if (!pendingOp) continue;
      const bucket = grouped.get(pendingOp);
      if (!bucket) continue;
      bucket.set(id, event);
    }
    return grouped;
  }

  #collectPendingByCalendarId(): CalendarEventPendingByCalendarId {
    const grouped: CalendarEventPendingByCalendarId = new Map();
    for (const [id, event] of this.events ?? []) {
      const pendingOp = this.#resolvePendingOperation(event);
      if (!pendingOp) continue;
      if (!event.calendarId || !event.eventId) continue;

      const byEventId =
        grouped.get(event.calendarId) ?? new Map<string, CalendarEventPendingByOperation>();
      const byOperation = byEventId.get(event.eventId) ?? this.#createPendingOperationMap();
      const bucket = byOperation.get(pendingOp);
      if (!bucket) continue;
      bucket.set(id, event);
      byEventId.set(event.eventId, byOperation);
      grouped.set(event.calendarId, byEventId);
    }
    return grouped;
  }

  protected resolveWeekStart(weekStart: number | undefined, lang: string): WeekdayNumber {
    if (isWeekdayNumber(weekStart)) return weekStart as WeekdayNumber;
    const firstDay = getLocaleWeekInfo(lang).firstDay;
    if (isWeekdayNumber(firstDay)) return firstDay;
    return 1;
  }

  protected resolveDirection(forceRtl = false): "ltr" | "rtl" {
    if (forceRtl) return "rtl";

    const explicitDirection = this.dir?.trim().toLowerCase();
    if (explicitDirection === "rtl" || explicitDirection === "ltr") {
      return explicitDirection;
    }

    return getLocaleDirection(this.lang);
  }

  protected forwardCalendarEvent = (event: Event) => {
    this.#forwardCalendarEvent(event, false);
  };

  protected forwardComposedCalendarEvent = (event: Event) => {
    this.#forwardCalendarEvent(event, true);
  };

  #forwardCalendarEvent(event: Event, composed: boolean) {
    event.stopPropagation();
    const forwardedEvent = new CustomEvent(event.type, {
      detail: event instanceof CustomEvent ? event.detail : undefined,
      composed,
      cancelable: event.cancelable,
    });
    const notCancelled = this.dispatchEvent(forwardedEvent);
    if (!notCancelled && event.cancelable) {
      event.preventDefault();
    }
  }

  #applyEventsAPIOperation(operation: EventOperation) {
    if (!this.#eventsAPI) return;
    const result = this.#eventsAPI.apply(operation);
    this.events = result.nextState;
  }

  #resolveEventMapKey(
    events: EventsMap,
    envelope: { eventId?: string; calendarId?: string; recurrenceId?: string }
  ): string | undefined {
    if (!envelope.eventId) return undefined;
    if (events.has(envelope.eventId)) return envelope.eventId;
    let fallbackSeriesKey: string | undefined;
    for (const [key, event] of events.entries()) {
      if (event.eventId !== envelope.eventId) continue;
      if (envelope.calendarId !== undefined && event.calendarId !== envelope.calendarId) continue;
      if (envelope.recurrenceId === undefined || event.recurrenceId === envelope.recurrenceId)
        return key;
      if (event.recurrenceId === undefined && fallbackSeriesKey === undefined)
        fallbackSeriesKey = key;
    }
    return fallbackSeriesKey;
  }

  #toPlainDateTime(value: CalendarEventView["start"]): Temporal.PlainDateTime {
    if (value instanceof Temporal.PlainDate) {
      return value.toPlainDateTime({ hour: 0, minute: 0, second: 0 });
    }
    if (value instanceof Temporal.PlainDateTime) return value;
    return value.toPlainDateTime();
  }

  #getUpdateKind(
    currentStart: CalendarEventView["start"],
    currentEnd: CalendarEventView["start"],
    nextStart: CalendarEventView["start"],
    nextEnd: CalendarEventView["start"]
  ): "move" | "resize-start" | "resize-end" | "update" {
    const sameStart =
      Temporal.PlainDateTime.compare(
        this.#toPlainDateTime(currentStart),
        this.#toPlainDateTime(nextStart)
      ) === 0;
    const sameEnd =
      Temporal.PlainDateTime.compare(
        this.#toPlainDateTime(currentEnd),
        this.#toPlainDateTime(nextEnd)
      ) === 0;
    if (sameStart && sameEnd) return "update";
    if (!sameStart && sameEnd) return "resize-start";
    if (sameStart && !sameEnd) return "resize-end";
    const oldDuration = this.#toPlainDateTime(currentStart).until(
      this.#toPlainDateTime(currentEnd)
    );
    const newDuration = this.#toPlainDateTime(nextStart).until(this.#toPlainDateTime(nextEnd));
    return oldDuration.total({ unit: "seconds" }) === newDuration.total({ unit: "seconds" })
      ? "move"
      : "update";
  }

  #movedToDifferentDay(
    currentStart: CalendarEventView["start"],
    nextStart: CalendarEventView["start"]
  ): boolean {
    return (
      Temporal.PlainDate.compare(
        this.#toPlainDateTime(currentStart).toPlainDate(),
        this.#toPlainDateTime(nextStart).toPlainDate()
      ) !== 0
    );
  }

  #resolvePendingOperation(event: CalendarEventView): CalendarEventPendingOperation | undefined {
    if (
      event.pendingOp === "created" ||
      event.pendingOp === "updated" ||
      event.pendingOp === "deleted"
    ) {
      return event.pendingOp;
    }
    return undefined;
  }

  #createPendingGroupsMap(): CalendarEventPendingGroups {
    return new Map([
      ["created", new Map()],
      ["updated", new Map()],
      ["deleted", new Map()],
    ]);
  }

  #createPendingOperationMap(): CalendarEventPendingByOperation {
    return new Map([
      ["created", new Map()],
      ["updated", new Map()],
      ["deleted", new Map()],
    ]);
  }
}
