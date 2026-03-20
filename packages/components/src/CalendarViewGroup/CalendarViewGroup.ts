import { Temporal } from "@js-temporal/polyfill";
import { html, unsafeCSS } from "lit";
import { customElement } from "lit/decorators.js";
import { cache } from "lit/directives/cache.js";
import { ifDefined } from "lit/directives/if-defined.js";
import { BaseElement } from "../BaseElement/BaseElement.js";
import "../CalendarView/CalendarView.js";
import "../CalendarWeekdayHeader/CalendarWeekdayHeader.js";
import "../CalendarMonthView/CalendarMonthView.js";
import "../CalendarYearView/CalendarYearView.js";
import { getLocaleDirection, getLocaleWeekInfo, resolveLocale } from "../utils/Locale.js";
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
export class CalendarViewGroup extends BaseElement {
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

  get rangeLabel(): string {
    const locale = resolveLocale(this.locale);
    const anchor = this.#resolvedStartDate;

    if (this.view === "year") {
      return new Intl.DateTimeFormat(locale, { year: "numeric" }).format(
        new Date(Date.UTC(anchor.year, anchor.month - 1, anchor.day))
      );
    }

    if (this.view === "month") {
      return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(
        new Date(Date.UTC(anchor.year, anchor.month - 1, 1))
      );
    }

    if (this.view === "day") {
      return new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(
        new Date(Date.UTC(anchor.year, anchor.month - 1, anchor.day))
      );
    }

    const start = this.#weekStartDate;
    const rangeLengthDays = Math.max(1, Math.min(7, Math.floor(Number(this.daysPerWeek) || 7)));
    const end = start.add({ days: rangeLengthDays - 1 });
    return this.#weekRangeLabel(start, end, locale);
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
      return this.#renderCombinedWeekView(startDate, daysPerWeek);
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
          @day-selection-requested=${this.#handleDaySelectionRequested}
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
        @day-selection-requested=${this.#handleDaySelectionRequested}
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

  #renderCombinedWeekView(startDate: Temporal.PlainDate, daysPerWeek: number) {
    const clampedVisibleHours = Math.max(1, Math.min(24, Math.floor(Number(this.visibleHours) || 12)));
    const timedHeightFactor = 24 / clampedVisibleHours;
    const direction = this.rtl ? "rtl" : getLocaleDirection(this.locale);
    const snapPoints = daysPerWeek + 1;
    const snapRows = 24;
    const eventEntries = Array.from(this.#weekEvents.entries());
    const allDayEvents = new Map(eventEntries.filter(([, event]) => this.#isAllDayEvent(event)));
    const timedEvents = new Map(eventEntries.filter(([, event]) => this.#isTimedEvent(event)));

    return html`
      <div
        class="combined-week-scroll-root"
        dir=${direction}
        style=${`--_lc-combined-days: ${daysPerWeek}; --_lc-combined-timed-height-factor: ${timedHeightFactor};`}
      >
        <div class="combined-week-grid-canvas">
          <header class="combined-week-header">
            <aside class="combined-week-header-sidebar" aria-hidden="true">All-day</aside>
            <section class="combined-week-header-main">
              <calendar-weekday-header
                .locale=${this.locale}
                .weekStart=${this.weekStart}
                .days=${daysPerWeek}
              ></calendar-weekday-header>
              <calendar-view
                class="combined-week-all-day-view"
                ?layout-passthrough=${true}
                start-date=${startDate.toString()}
                days=${String(daysPerWeek)}
                variant="all-day"
                .events=${allDayEvents}
                .rtl=${this.rtl}
                locale=${ifDefined(this.locale)}
                timezone=${ifDefined(this.timezone)}
                current-time=${ifDefined(this.currentTime)}
                .snapInterval=${this.snapInterval}
                .labelsHidden=${false}
                @day-selection-requested=${this.#handleDaySelectionRequested}
                @event-modified=${this.#reemit}
                @event-deleted=${this.#reemit}
              ></calendar-view>
            </section>
          </header>

          <main class="combined-week-main">
            <div class="combined-week-snap-overlay" aria-hidden="true">
              <div
                class="combined-week-snap-grid"
                style=${`--_lc-combined-snap-days: ${daysPerWeek}; --_lc-combined-snap-rows: ${snapRows};`}
              >
                ${Array.from({ length: snapPoints * snapRows }, () => html`<span class="combined-week-snap-cell"></span>`)}
              </div>
            </div>
            <calendar-view
              class="combined-week-timed-view"
              ?layout-passthrough=${true}
              start-date=${startDate.toString()}
              days=${String(daysPerWeek)}
              variant="timed"
              .events=${timedEvents}
              .rtl=${this.rtl}
              locale=${ifDefined(this.locale)}
              timezone=${ifDefined(this.timezone)}
              current-time=${ifDefined(this.currentTime)}
              .snapInterval=${this.snapInterval}
              .visibleHours=${this.visibleHours}
              .labelsHidden=${false}
              @event-modified=${this.#reemit}
              @event-deleted=${this.#reemit}
            ></calendar-view>
          </main>
        </div>
      </div>
    `;
  }

  #isAllDayEvent(event: EventInput): boolean {
    return this.#isDateOnlyValue(event.start) || this.#isDateOnlyValue(event.end);
  }

  #isTimedEvent(event: EventInput): boolean {
    if (this.#isAllDayEvent(event)) return false;
    return (
      (typeof event.start === "string" && event.start.includes("T")) ||
      (typeof event.end === "string" && event.end.includes("T")) ||
      event.start instanceof Temporal.PlainDateTime ||
      event.start instanceof Temporal.ZonedDateTime ||
      event.end instanceof Temporal.PlainDateTime ||
      event.end instanceof Temporal.ZonedDateTime
    );
  }

  #isDateOnlyValue(value: EventInput["start"]): boolean {
    if (value instanceof Temporal.PlainDate) return true;
    if (value instanceof Temporal.PlainDateTime || value instanceof Temporal.ZonedDateTime) return false;
    return !value.includes("T");
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

  #handleDaySelectionRequested = (event: Event) => {
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

  #weekRangeLabel(start: Temporal.PlainDate, end: Temporal.PlainDate, locale: string): string {
    const startDate = new Date(Date.UTC(start.year, start.month - 1, start.day));
    const endDate = new Date(Date.UTC(end.year, end.month - 1, end.day));

    if (start.year === end.year && start.month === end.month) {
      const month = new Intl.DateTimeFormat(locale, { month: "short" }).format(startDate);
      return `${month} ${start.day}-${end.day}, ${start.year}`;
    }

    if (start.year === end.year) {
      const startPart = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(
        startDate
      );
      const endPart = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(endDate);
      return `${startPart} - ${endPart}, ${start.year}`;
    }

    const startPart = new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(startDate);
    const endPart = new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(endDate);
    return `${startPart} - ${endPart}`;
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
