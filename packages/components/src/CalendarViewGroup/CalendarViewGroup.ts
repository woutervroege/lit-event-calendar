import { Temporal } from "@js-temporal/polyfill";
import { html, unsafeCSS } from "lit";
import { customElement } from "lit/decorators.js";
import { cache } from "lit/directives/cache.js";
import { BaseElement } from "../BaseElement/BaseElement.js";
import "../CalendarWeekView/CalendarWeekView.js";
import "../CalendarMonthView/CalendarMonthView.js";
import "../CalendarYearView/CalendarYearView.js";
import { getLocaleWeekInfo } from "../utils/Locale.js";
import componentStyle from "./CalendarViewGroup.css?inline";

export type CalendarViewMode = "day" | "week" | "month" | "year";
type WeekdayNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type CalendarNavigationDirection = "previous" | "today" | "next";

type EventInput = {
  uid?: string;
  recurrenceId?: string;
  start: string | Temporal.PlainDate | Temporal.PlainDateTime | Temporal.ZonedDateTime;
  end: string | Temporal.PlainDate | Temporal.PlainDateTime | Temporal.ZonedDateTime;
  summary: string;
  color: string;
};

type EventsMap = Map<string, EventInput>;
type EventEntry = [id: string, event: EventInput];

function isWeekdayNumber(value: number | undefined): value is WeekdayNumber {
  return Boolean(value && Number.isInteger(value) && value >= 1 && value <= 7);
}

@customElement("calendar-view-group")
export class EventCalendar extends BaseElement {
  #view: CalendarViewMode = "month";
  #startDate?: string;
  weekStart?: WeekdayNumber;
  #daysPerWeek = 7;
  declare events?: EventsMap;
  locale?: string;
  timezone?: string;
  currentTime?: string;
  snapInterval = 15;
  visibleHours = 12;
  rtl = false;

  static get properties() {
    return {
      view: {
        type: String,
        reflect: true,
        dispatchChangeEvent: { bubbles: true, composed: true },
      },
      startDate: {
        type: String,
        attribute: "start-date",
        dispatchChangeEvent: { bubbles: true, composed: true },
      },
      weekStart: { type: Number, attribute: "week-start", reflect: true },
      daysPerWeek: {
        type: Number,
        attribute: "days-per-week",
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
    } as const;
  }

  static get styles() {
    return [...BaseElement.styles, unsafeCSS(componentStyle)];
  }

  render() {
    return html`
      <div class="calendar-view-group">
        <section class="content" role="tabpanel">
          ${cache(this.#renderViewFor(this.view))}
        </section>
      </div>
    `;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
  }

  get view(): CalendarViewMode {
    return this.#view;
  }

  set view(value: CalendarViewMode | string | null | undefined) {
    const nextValue =
      value === "day" || value === "week" || value === "month" || value === "year"
        ? value
        : "month";
    this.#view = nextValue;
  }

  get daysPerWeek(): number {
    return this.#daysPerWeek;
  }

  set daysPerWeek(value: number | string | null | undefined) {
    const rawValue = typeof value === "string" ? Number(value) : value;
    const numeric = Number(rawValue);
    const nextValue = Number.isFinite(numeric) ? Math.max(1, Math.min(7, Math.floor(numeric))) : 7;
    this.#daysPerWeek = nextValue;
  }

  get month(): number {
    return this.#resolvedStartDate.month;
  }

  get year(): number {
    return this.#resolvedStartDate.year;
  }

  get weekNumber(): number {
    return this.#weekNumberFromStartDate(this.#resolvedStartDate);
  }

  get today(): string {
    return this.#now.toPlainDate().toString();
  }

  get startDate(): Temporal.PlainDate | undefined {
    if (!this.#startDate) return undefined;
    return Temporal.PlainDate.from(this.#startDate);
  }

  set startDate(value: string | Temporal.PlainDate | undefined) {
    const nextValue =
      value === undefined
        ? undefined
        : value instanceof Temporal.PlainDate
          ? value.toString()
          : Temporal.PlainDate.from(value).toString();
    this.#startDate = nextValue;
  }

  get nextDay(): string {
    return this.#resolvedStartDate.add({ days: 1 }).toString();
  }

  get nextWeek(): string {
    const rangeLengthDays = Math.max(1, Math.min(7, Math.floor(Number(this.daysPerWeek) || 7)));
    return this.#weekStartDate.add({ days: rangeLengthDays }).toString();
  }

  get nextMonth(): string {
    return Temporal.PlainDate.from({
      year: this.#resolvedStartDate.year,
      month: this.#resolvedStartDate.month,
      day: 1,
    })
      .add({ months: 1 })
      .toString();
  }

  get nextYear(): string {
    return this.#resolvedStartDate.add({ years: 1 }).toString();
  }

  goBack() {
    this.startDate = this.#targetDateByView(-1);
  }

  goForward() {
    if (this.view === "day") {
      this.startDate = this.nextDay;
      return;
    }
    if (this.view === "week") {
      this.startDate = this.nextWeek;
      return;
    }
    if (this.view === "month") {
      this.startDate = this.nextMonth;
      return;
    }
    this.startDate = this.nextYear;
  }

  goToday() {
    this.#goToToday();
  }

  #renderViewFor(view: CalendarViewMode) {
    if (view === "day" || view === "week") {
      const startDate = view === "day" ? this.#resolvedStartDate : this.#weekStartDate;
      const daysPerWeek = view === "day" ? 1 : this.daysPerWeek;
      return html`
        <calendar-week-view
          .startDate=${startDate}
          .weekStart=${this.weekStart}
          .daysPerWeek=${daysPerWeek}
          .events=${this.#weekEvents}
          .locale=${this.locale}
          .timezone=${this.timezone}
          .currentTime=${this.#resolvedCurrentTime}
          .snapInterval=${this.snapInterval}
          .visibleHours=${this.visibleHours}
          .rtl=${this.rtl}
          @day-label-double-pointer=${this.#handleDayLabelDoublePointer}
          @event-modified=${this.#reemit}
          @event-deleted=${this.#reemit}
        ></calendar-week-view>
      `;
    }

    if (view === "year") {
      return html`
        <calendar-year-view
          .year=${this.year}
          .weekStart=${this.weekStart}
          .events=${this.events}
          .locale=${this.locale}
          .timezone=${this.timezone}
          .currentTime=${this.#resolvedCurrentTime}
          @day-label-double-pointer=${this.#handleDayLabelDoublePointer}
          @event-modified=${this.#reemit}
          @event-deleted=${this.#reemit}
        ></calendar-year-view>
      `;
    }

    return html`
      <calendar-month-view
        .month=${this.month}
        .year=${this.year}
        .weekStart=${this.weekStart}
        .events=${this.events}
        .locale=${this.locale}
        .timezone=${this.timezone}
        .currentTime=${this.#resolvedCurrentTime}
        @day-label-double-pointer=${this.#handleDayLabelDoublePointer}
        @event-modified=${this.#reemit}
        @event-deleted=${this.#reemit}
      ></calendar-month-view>
    `;
  }

  get #weekEvents(): EventsMap {
    const entries = Array.from(this.events?.entries() ?? []);
    return new Map(
      entries.map(([id, event]) => [
        id,
        {
          ...event,
          start: this.#toTemporalDateLike(event.start),
          end: this.#toTemporalDateLike(event.end),
        },
      ])
    );
  }

  #toTemporalDateLike(
    value: EventInput["start"]
  ): Temporal.PlainDate | Temporal.PlainDateTime | Temporal.ZonedDateTime {
    if (
      value instanceof Temporal.PlainDate ||
      value instanceof Temporal.PlainDateTime ||
      value instanceof Temporal.ZonedDateTime
    ) {
      return value;
    }
    if (!value.includes("T")) {
      return Temporal.PlainDate.from(value);
    }
    if (value.includes("[") && value.includes("]")) {
      return Temporal.ZonedDateTime.from(value);
    }
    return Temporal.PlainDateTime.from(value);
  }

  #handleDayLabelDoublePointer = (event: Event) => {
    if (!(event instanceof CustomEvent)) return;

    const detail = event.detail as { date?: string } | undefined;
    if (!detail?.date) return;

    const selectedDate = Temporal.PlainDate.from(detail.date);
    this.startDate = selectedDate;
    this.view = "day";
  };

  #goToToday() {
    const now = this.#now;
    const today = now.toPlainDate();
    this.currentTime = now.toString();
    this.startDate = today;
  }

  #targetDateByView(step: number): Temporal.PlainDate {
    const anchorDate = this.#resolvedStartDate;
    if (this.view === "day") {
      return anchorDate.add({ days: step });
    }

    if (this.view === "year") {
      return anchorDate.add({ years: step });
    }

    if (this.view === "month") {
      return Temporal.PlainDate.from({
        year: anchorDate.year,
        month: anchorDate.month,
        day: 1,
      }).add({
        months: step,
      });
    }

    const start = this.#weekStartDate;
    const rangeLengthDays = Math.max(1, Math.min(7, Math.floor(Number(this.daysPerWeek) || 7)));
    return start.add({ days: rangeLengthDays * step });
  }

  get #weekStartDate(): Temporal.PlainDate {
    return this.#startOfWeekFor(this.#resolvedStartDate, this.#resolvedWeekStart);
  }

  get #resolvedWeekStart(): WeekdayNumber {
    if (isWeekdayNumber(this.weekStart)) return this.weekStart;
    const localeFirstDay = getLocaleWeekInfo(this.locale).firstDay;
    if (isWeekdayNumber(localeFirstDay)) return localeFirstDay;
    return 1;
  }

  #startOfWeekFor(date: Temporal.PlainDate, weekStart: WeekdayNumber): Temporal.PlainDate {
    const weekdayOffset = (date.dayOfWeek - weekStart + 7) % 7;
    return date.subtract({ days: weekdayOffset });
  }

  #weekNumberFromStartDate(date: Temporal.PlainDate): number {
    const firstOfYear = Temporal.PlainDate.from({ year: date.year, month: 1, day: 1 });
    const firstWeekStart = this.#startOfWeekFor(firstOfYear, this.#resolvedWeekStart);
    const startOfSelectedWeek = this.#startOfWeekFor(date, this.#resolvedWeekStart);
    const diffDays = firstWeekStart.until(startOfSelectedWeek, { largestUnit: "day" }).days;
    return Math.max(1, Math.floor(diffDays / 7) + 1);
  }

  get #now(): Temporal.PlainDateTime {
    if (this.timezone) {
      return Temporal.Now.zonedDateTimeISO(this.timezone).toPlainDateTime();
    }
    return Temporal.Now.plainDateTimeISO();
  }

  get #resolvedCurrentTime(): string {
    return this.currentTime ?? this.#now.toString();
  }

  get #resolvedStartDate(): Temporal.PlainDate {
    if (this.#startDate) {
      return Temporal.PlainDate.from(this.#startDate);
    }
    return Temporal.PlainDate.from(this.#resolvedCurrentTime);
  }

  #reemit = (event: Event) => {
    event.stopPropagation();
    this.dispatchEvent(
      new CustomEvent(event.type, {
        detail: (event as CustomEvent).detail,
        bubbles: true,
        composed: true,
      })
    );
  };
}
