import { Temporal } from "@js-temporal/polyfill";
import { getLocaleDirection, getLocaleWeekInfo, resolveLocale } from "../utils/Locale.js";
import { BaseElement } from "../BaseElement/BaseElement.js";
import type {
  CalendarEventPendingByCalendarId,
  CalendarEventPendingOptions,
  CalendarEventPendingByOperation,
  CalendarEventPendingGroups,
  CalendarEventPendingOperation,
  CalendarEventPendingResult,
  CalendarEventView,
  CalendarEventViewEntry as EventEntry,
  CalendarEventViewMap as EventsMap,
} from "../types/CalendarEvent.js";
import type { WeekdayNumber } from "../types/Weekday.js";

export function isWeekdayNumber(value: number | undefined): value is WeekdayNumber {
  return Boolean(value && Number.isInteger(value) && value >= 1 && value <= 7);
}

export abstract class CalendarViewBase extends BaseElement {
  #lang?: string;
  #timezone?: string;
  #currentTime?: string;

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

  set currentTime(
    currentTime: Temporal.PlainDateTime | Temporal.ZonedDateTime | string | null | undefined
  ) {
    this.#currentTime = currentTime?.toString() ?? undefined;
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

      const byEventId = grouped.get(event.calendarId) ?? new Map<string, CalendarEventPendingByOperation>();
      const byOperation = byEventId.get(event.eventId) ?? this.#createPendingOperationMap();
      const bucket = byOperation.get(pendingOp);
      if (!bucket) continue;
      bucket.set(id, event);
      byEventId.set(event.eventId, byOperation);
      grouped.set(event.calendarId, byEventId);
    }
    return grouped;
  }

  protected resolveWeekStart(
    weekStart: number | undefined,
    lang: string
  ): WeekdayNumber {
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
