import { Temporal } from "@js-temporal/polyfill";
import { html, unsafeCSS } from "lit";
import { customElement } from "lit/decorators.js";
import { ifDefined } from "lit/directives/if-defined.js";
import { styleMap } from "lit/directives/style-map.js";
import "../CalendarView/CalendarView.js";
import "../CalendarWeekdayHeader/CalendarWeekdayHeader.js";
import { BaseElement } from "../BaseElement/BaseElement.js";
import type { CalendarEventView as EventInput } from "../models/CalendarEvent.js";
import { type AllDayLayoutItem, buildAllDayLayout } from "../utils/AllDayLayout.js";
import { getLocaleDirection, getLocaleWeekInfo } from "../utils/Locale.js";
import componentStyle from "./CalendarWeekView.css?inline";
import "../SwipSnapElement.js";

type EventEntry = [id: string, event: EventInput];
type EventsMap = Map<string, EventInput>;
type WeekdayNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;

function isWeekdayNumber(value: number | undefined): value is WeekdayNumber {
  return Boolean(value && Number.isInteger(value) && value >= 1 && value <= 7);
}

@customElement("calendar-week-view")
export class CalendarWeekView extends BaseElement {
  #startDate?: string;
  weekNumber = Temporal.Now.plainDateISO().weekOfYear;
  year = Temporal.Now.plainDateISO().year;
  weekStart?: WeekdayNumber;
  daysPerWeek = 7;
  declare events?: EventsMap;
  locale?: string;
  timezone?: string;
  currentTime?: string;
  snapInterval = 15;
  visibleHours = 12;
  rtl = false;
  defaultEventSummary = "New event";
  defaultEventColor = "#0ea5e9";
  defaultCalendarId?: string;
  #splitEventsSource?: EventsMap;
  #cachedAllDayEvents: EventsMap = new Map();
  #cachedTimedEvents: EventsMap = new Map();

  static get properties() {
    return {
      startDate: { type: String, attribute: "start-date" },
      weekNumber: { type: Number, attribute: "week-number" },
      year: { type: Number },
      weekStart: {
        type: Number,
        attribute: "week-start",
        reflect: true,
        converter: {
          fromAttribute: (v: string | null): WeekdayNumber | undefined => {
            if (v === null) return undefined;
            const day = Number(v);
            return isWeekdayNumber(day) ? day : undefined;
          },
          toAttribute: (v: number | undefined): string | null => (v ? String(v) : null),
        },
      },
      daysPerWeek: {
        type: Number,
        attribute: "days-per-week",
        reflect: true,
        converter: {
          fromAttribute: (v: string | null): number => {
            const n = Number(v);
            if (!Number.isFinite(n)) return 7;
            return Math.max(1, Math.min(7, Math.floor(n)));
          },
          toAttribute: (v: number): string => String(v),
        },
      },
      events: {
        type: Object,
        converter: {
          fromAttribute: (value: string | null): EventsMap =>
            new Map(JSON.parse(value || "[]") as EventEntry[]),
        },
      },
      locale: { type: String },
      timezone: { type: String },
      currentTime: { type: String, attribute: "current-time" },
      snapInterval: { type: Number, attribute: "snap-interval" },
      visibleHours: { type: Number, attribute: "visible-hours" },
      rtl: { type: Boolean, reflect: true },
      defaultEventSummary: { type: String, attribute: "default-event-summary" },
      defaultEventColor: { type: String, attribute: "default-event-color" },
      defaultCalendarId: { type: String, attribute: "default-source-id" },
    } as const;
  }

  static get styles() {
    return [...BaseElement.styles, unsafeCSS(componentStyle)];
  }

  get startDate(): Temporal.PlainDate {
    if (this.#startDate) {
      return Temporal.PlainDate.from(this.#startDate);
    }

    const firstOfYear = Temporal.PlainDate.from({
      year: this.year,
      month: 1,
      day: 1,
    });
    const weekStart = this.#resolvedWeekStart;
    const firstWeekStart = this.#startOfWeekFor(firstOfYear, weekStart);
    const normalizedWeek = Math.max(1, Number(this.weekNumber) || 1);
    return firstWeekStart.add({ days: (normalizedWeek - 1) * 7 });
  }

  set startDate(value: string | undefined) {
    this.#startDate = value || undefined;
  }

  get #resolvedWeekStart(): WeekdayNumber {
    if (isWeekdayNumber(this.weekStart)) return this.weekStart;
    return this.#weekStartFromLocale(this.locale);
  }

  get #allDayEvents(): EventsMap {
    this.#syncSplitEventsCache();
    return this.#cachedAllDayEvents;
  }

  get #timedEvents(): EventsMap {
    this.#syncSplitEventsCache();
    return this.#cachedTimedEvents;
  }

  get #renderedDays(): Temporal.PlainDate[] {
    return Array.from({ length: this.daysPerWeek }, (_, dayOffset) =>
      this.startDate.add({ days: dayOffset })
    );
  }

  get #allDayVisibleRowCount(): number {
    const renderedDays = this.#renderedDays;
    const layout = buildAllDayLayout({
      renderedDays,
      daysPerRow: renderedDays.length,
      items: this.#allDayLayoutItems,
    });
    return Math.max(1, layout.maxEventsOnAnyDay);
  }

  get #allDayLayoutItems(): AllDayLayoutItem[] {
    return this.#eventEntries
      .filter(([, event]) => this.#isAllDayEvent(event))
      .map(([id, event]) => ({
        id,
        start: this.#toPlainDateTime(event.start).toPlainDate(),
        endInclusive: this.#toPlainDateTime(event.end).subtract({ nanoseconds: 1 }).toPlainDate(),
      }));
  }

  get #eventEntries(): EventEntry[] {
    return Array.from(this.events?.entries() ?? []);
  }

  #isAllDayEvent(event: EventInput): boolean {
    return this.#isDateOnlyValue(event.start) || this.#isDateOnlyValue(event.end);
  }

  #isTimedEvent(event: EventInput): boolean {
    if (this.#isAllDayEvent(event)) return false;
    return (
      event.start instanceof Temporal.PlainDateTime ||
      event.start instanceof Temporal.ZonedDateTime ||
      event.end instanceof Temporal.PlainDateTime ||
      event.end instanceof Temporal.ZonedDateTime
    );
  }

  #isDateOnlyValue(value: EventInput["start"]): boolean {
    return value instanceof Temporal.PlainDate;
  }

  #toPlainDateTime(value: EventInput["start"]): Temporal.PlainDateTime {
    if (value instanceof Temporal.ZonedDateTime) {
      return this.timezone
        ? value.withTimeZone(this.timezone).toPlainDateTime()
        : value.toPlainDateTime();
    }
    if (value instanceof Temporal.PlainDateTime) {
      return value;
    }
    if (value instanceof Temporal.PlainDate) {
      return value.toPlainDateTime({ hour: 0, minute: 0, second: 0 });
    }
    const exhaustiveCheck: never = value;
    throw new TypeError(`Unsupported calendar event date value: ${String(exhaustiveCheck)}`);
  }

  #startOfWeekFor(date: Temporal.PlainDate, weekStart: WeekdayNumber): Temporal.PlainDate {
    const weekdayOffset = (date.dayOfWeek - weekStart + 7) % 7;
    return date.subtract({ days: weekdayOffset });
  }

  #weekStartFromLocale(locale: string | undefined): WeekdayNumber {
    const firstDay = getLocaleWeekInfo(locale).firstDay;
    if (isWeekdayNumber(firstDay)) return firstDay;
    return 1;
  }

  #syncSplitEventsCache() {
    if (this.events === this.#splitEventsSource) return;
    this.#splitEventsSource = this.events;
    const sourceEntries = Array.from(this.events?.entries() ?? []);
    this.#cachedAllDayEvents = new Map(
      sourceEntries.filter(([, event]) => this.#isAllDayEvent(event))
    );
    this.#cachedTimedEvents = new Map(
      sourceEntries.filter(([, event]) => this.#isTimedEvent(event))
    );
  }

  render() {
    const clampedVisibleHours = Math.max(
      1,
      Math.min(24, Math.floor(Number(this.visibleHours) || 12))
    );
    const allDayHeight = `calc(var(--_lc-all-day-day-number-space, 36px) + ${this.#allDayVisibleRowCount} * var(--_lc-event-height, 32px))`;
    const timedHeight = `calc(${clampedVisibleHours} * var(--_lc-min-hour-height, var(--lc-min-hour-height, 54px)))`;
    const direction = this.rtl ? "rtl" : getLocaleDirection(this.locale);

    return html`
      <swipe-snap-element
        class="week-swipe"
        current-index="0"
        scroll-snap-stop="normal"
        dir=${direction}
        style=${styleMap({
          "--_lc-combined-days": String(this.daysPerWeek),
        })}
      >
        <div class="week-stack">
        <calendar-view
          class="week-all-day-view"
          .startDate=${this.startDate}
          days=${String(this.daysPerWeek)}
          variant="all-day"
          .events=${this.#allDayEvents}
          .rtl=${this.rtl}
          locale=${ifDefined(this.locale)}
          timezone=${ifDefined(this.timezone)}
          current-time=${ifDefined(this.currentTime)}
          .snapInterval=${this.snapInterval}
          .labelsHidden=${false}
          style=${styleMap({
            "--_lc-week-all-day-height": allDayHeight,
          })}
          @event-create-requested=${this.#reemit}
          @event-update-requested=${this.#reemit}
          @event-delete-requested=${this.#reemit}
          @day-selection-requested=${this.#reemit}
        >
        </calendar-view>
        
        <calendar-view
          class="week-timed-view"
          .startDate=${this.startDate}
          days=${String(this.daysPerWeek)}
          variant="timed"
          .events=${this.#timedEvents}
          .rtl=${this.rtl}
          locale=${ifDefined(this.locale)}
          timezone=${ifDefined(this.timezone)}
          current-time=${ifDefined(this.currentTime)}
          .snapInterval=${this.snapInterval}
          .visibleHours=${clampedVisibleHours}
          style=${styleMap({
            "--_lc-week-timed-height": timedHeight,
          })}
          @event-create-requested=${this.#reemit}
          @event-update-requested=${this.#reemit}
          @event-delete-requested=${this.#reemit}
          @day-selection-requested=${this.#reemit}
      >
      </calendar-view>

      </div>

      </swipe-snap-element>
    `;
  }

  #reemit = (event: Event) => {
    event.stopPropagation();
    const forwardedEvent = new CustomEvent(event.type, {
      detail: (event as CustomEvent).detail,
      cancelable: event.cancelable,
    });
    const notCancelled = this.dispatchEvent(forwardedEvent);
    if (!notCancelled && event.cancelable) {
      event.preventDefault();
    }
  };
}
