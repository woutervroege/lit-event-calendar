import { Temporal } from "@js-temporal/polyfill";
import { getLocaleWeekInfo, resolveLocale } from "../utils/Locale.js";
import { BaseElement } from "../BaseElement/BaseElement.js";
import type { CalendarEventView } from "../types/CalendarEvent.js";

type EventEntry = [id: string, event: CalendarEventView];
type EventsMap = Map<string, CalendarEventView>;
type WeekdayNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;

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

  protected resolveWeekStart(
    weekStart: number | undefined,
    lang: string
  ): WeekdayNumber {
    if (isWeekdayNumber(weekStart)) return weekStart as WeekdayNumber;
    const firstDay = getLocaleWeekInfo(lang).firstDay;
    if (isWeekdayNumber(firstDay)) return firstDay;
    return 1;
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
}
