import { Temporal } from "@js-temporal/polyfill";
import { BaseElement } from "../BaseElement/BaseElement.js";
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
import type { WeekdayNumber } from "../types/Weekday.js";
import { getLocaleDirection, getLocaleWeekInfo, resolveLocale } from "../utils/Locale.js";

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

  set currentTime(currentTime:
    | Temporal.PlainDateTime
    | Temporal.ZonedDateTime
    | string
    | null
    | undefined) {
    this.#currentTime = currentTime?.toString() ?? undefined;
  }

  getRenderedEvents(range: {
    start: CalendarEventDateValue;
    end: CalendarEventDateValue;
  }): EventsMap {
    const toPlainDateTime = (value: CalendarEventDateValue): Temporal.PlainDateTime => {
      if (value instanceof Temporal.ZonedDateTime) {
        return value.withTimeZone(this.timezone).toPlainDateTime();
      }
      if (value instanceof Temporal.PlainDateTime) return value;
      return value.toPlainDateTime({ hour: 0, minute: 0, second: 0 });
    };

    const fromPlainDateTime = (
      value: Temporal.PlainDateTime,
      template: CalendarEventDateValue
    ): CalendarEventDateValue => {
      if (template instanceof Temporal.PlainDate) return value.toPlainDate();
      if (template instanceof Temporal.ZonedDateTime) {
        return value.toZonedDateTime(template.timeZoneId);
      }
      return value;
    };

    const toRecurrenceId = (
      value: Temporal.PlainDateTime,
      template: CalendarEventDateValue
    ): string => {
      const pad = (segment: number) => String(segment).padStart(2, "0");
      const date = `${value.year}${pad(value.month)}${pad(value.day)}`;
      if (template instanceof Temporal.PlainDate) return date;
      return `${date}T${pad(value.hour)}${pad(value.minute)}${pad(value.second)}`;
    };

    const addByFrequency = (
      value: Temporal.PlainDateTime,
      frequency: "SECONDLY" | "MINUTELY" | "HOURLY" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY",
      interval: number
    ): Temporal.PlainDateTime => {
      if (frequency === "SECONDLY") return value.add({ seconds: interval });
      if (frequency === "MINUTELY") return value.add({ minutes: interval });
      if (frequency === "HOURLY") return value.add({ hours: interval });
      if (frequency === "DAILY") return value.add({ days: interval });
      if (frequency === "WEEKLY") return value.add({ weeks: interval });
      if (frequency === "MONTHLY") return value.add({ months: interval });
      return value.add({ years: interval });
    };

    const rangeOverlaps = (
      start: Temporal.PlainDateTime,
      end: Temporal.PlainDateTime,
      rangeStart: Temporal.PlainDateTime,
      rangeEnd: Temporal.PlainDateTime
    ): boolean => {
      if (Temporal.PlainDateTime.compare(end, start) <= 0) return false;
      return (
        Temporal.PlainDateTime.compare(start, rangeEnd) < 0 &&
        Temporal.PlainDateTime.compare(end, rangeStart) > 0
      );
    };

    const rangeStart = toPlainDateTime(range.start);
    const rangeEnd = toPlainDateTime(range.end);
    if (Temporal.PlainDateTime.compare(rangeEnd, rangeStart) <= 0) return new Map();

    const detachedExceptionKeys = new Set<string>();
    for (const [, event] of this.events ?? []) {
      if (event.pendingOp === "deleted") continue;
      if (!event.eventId || !event.recurrenceId) continue;
      detachedExceptionKeys.add(`${event.eventId}::${event.recurrenceId}`);
    }

    const renderedEvents: EventsMap = new Map();
    for (const [id, event] of this.events ?? []) {
      if (event.pendingOp === "deleted") continue;
      if (event.recurrenceRule && !event.recurrenceId) {
        const recurrenceRule = event.recurrenceRule;
        const baseStart = toPlainDateTime(event.start);
        const baseEnd = toPlainDateTime(event.end);
        if (Temporal.PlainDateTime.compare(baseEnd, baseStart) <= 0) continue;

        const interval = Math.max(1, recurrenceRule.interval ?? 1);
        const until =
          "until" in recurrenceRule && recurrenceRule.until
            ? toPlainDateTime(recurrenceRule.until)
            : undefined;
        const count = "count" in recurrenceRule ? recurrenceRule.count : undefined;

        let generated = 0;
        let occurrenceStart = baseStart;
        let occurrenceEnd = baseEnd;

        while (true) {
          if (count !== undefined && generated >= count) break;
          if (until && Temporal.PlainDateTime.compare(occurrenceStart, until) > 0) break;
          if (Temporal.PlainDateTime.compare(occurrenceStart, rangeEnd) >= 0) break;

          const recurrenceId = toRecurrenceId(occurrenceStart, event.start);
          const isExcluded = event.exclusionDates?.has(recurrenceId) ?? false;
          const hasDetachedException =
            Boolean(event.eventId) &&
            detachedExceptionKeys.has(`${event.eventId}::${recurrenceId}`);
          if (
            !isExcluded &&
            !hasDetachedException &&
            rangeOverlaps(occurrenceStart, occurrenceEnd, rangeStart, rangeEnd)
          ) {
            renderedEvents.set(`${id}::${recurrenceId}`, {
              ...event,
              recurrenceId,
              start: fromPlainDateTime(occurrenceStart, event.start),
              end: fromPlainDateTime(occurrenceEnd, event.end),
            });
          }

          generated += 1;
          const nextStart = addByFrequency(occurrenceStart, recurrenceRule.freq, interval);
          const nextEnd = addByFrequency(occurrenceEnd, recurrenceRule.freq, interval);
          if (Temporal.PlainDateTime.compare(nextStart, occurrenceStart) <= 0) break;
          occurrenceStart = nextStart;
          occurrenceEnd = nextEnd;
        }
        continue;
      }

      const start = toPlainDateTime(event.start);
      const end = toPlainDateTime(event.end);
      if (!rangeOverlaps(start, end, rangeStart, rangeEnd)) continue;
      renderedEvents.set(id, event);
    }
    return renderedEvents;
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
