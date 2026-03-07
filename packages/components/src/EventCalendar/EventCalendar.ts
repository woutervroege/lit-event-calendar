import { Temporal } from "@js-temporal/polyfill";
import { html, type PropertyValues, unsafeCSS } from "lit";
import { customElement } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";
import { ContextProvider } from "@lit/context";
import "../TimedEvent/TimedEvent.js";
import { BaseElement } from "../BaseElement/BaseElement.js";
import componentStyle from "./EventCalendar.css?inline";
import "../TimedEvent/AllDayEvent.js";
import { TimedEventInteractionController } from "../controllers/TimedEventInteractionController.js";
import { calendarViewContext, type CalendarViewContextValue } from "../context/CalendarViewContext.js";

type EventInput = {
  /**
   * iCalendar UID. Repeated occurrences should share this value.
   */
  uid?: string;
  /**
   * iCalendar RECURRENCE-ID for one occurrence in a recurring series.
   */
  recurrenceId?: string;
  start: string | Temporal.PlainDate | Temporal.PlainDateTime | Temporal.ZonedDateTime;
  end: string | Temporal.PlainDate | Temporal.PlainDateTime | Temporal.ZonedDateTime;
  summary: string;
  color: string;
};

type EventEntry = [id: string, event: EventInput];
type EventsMap = Map<string, EventInput>;

@customElement("event-calendar")
export class EventCalendar extends BaseElement {
  #startDate?: string;
  #currentTime?: string;
  #timezone?: string;
  #locale?: string;
  #days!: number;
  #hours: number = 24;
  #snapInterval: number = TimedEventInteractionController.snapInterval;
  declare events?: EventsMap;
  variant: "timed" | "all-day" = "timed";
  dayNumbersHidden = false;
  #dragHoverDayIndex: number | null = null;
  #dragHoverTime: Temporal.PlainTime | null = null;
  #calendarViewProvider = new ContextProvider(this, { context: calendarViewContext });
  #styleObserver?: MutationObserver;
  #lastDaysPerRowToken = "";

  get #sortedEvents(): EventEntry[] {
    const events = this.#eventsForVariant;
    return events.sort((a, b) => this.#compareEventsForRenderOrder(a, b));
  }

  get #eventsForVariant(): EventEntry[] {
    const events = this.#eventsAsEntries;
    if (this.variant === "all-day") {
      return events;
    }

    return events.filter(([, event]) => !this.#isAllDayEvent(event));
  }

  static get properties() {
    return {
      startDate: { type: String, attribute: "start-date" },
      days: { type: Number },
      events: {
        type: Object,
        converter: {
          fromAttribute: (value: string | null): EventsMap =>
            new Map(JSON.parse(value || "[]") as EventEntry[]),
        },
      },
      variant: {
        type: String,
        attribute: "variant",
        reflect: true,
        converter: {
          fromAttribute: (v: string | null): "timed" | "all-day" =>
            v === "all-day" ? "all-day" : "timed",
          toAttribute: (v: string): string => v,
        },
      },
      dayNumbersHidden: { type: Boolean, attribute: "day-numbers-hidden", reflect: true },
      locale: { type: String },
      timezone: { type: String },
      snapInterval: { type: Number, attribute: "snap-interval" },
      currentTime: {
        attribute: "current-time",
        converter: {
          fromAttribute: (v: string | null): string | undefined => v ?? undefined,
          toAttribute: (
            v:
              | Temporal.PlainDateTime
              | Temporal.ZonedDateTime
              | string
              | null
              | undefined
          ): string | null =>
            v ? v.toString() : null,
        },
      },
    } as const;
  }

  static get observers() {
    const observers = new Map();
    observers.set("_handleEventsChange", ["events"]);
    return observers;
  }

  _handleEventsChange() {
    console.info("events changed");
  }

  static get styles() {
    return [...BaseElement.styles, unsafeCSS(componentStyle)];
  }

  connectedCallback() {
    super.connectedCallback();
    this.#updateCalendarViewContext();
    this.#startStyleObserver();
    this.addEventListener("interaction-drag-hover", this.#handleDragHover as EventListener);
  }

  disconnectedCallback() {
    this.#stopStyleObserver();
    this.removeEventListener("interaction-drag-hover", this.#handleDragHover as EventListener);
    super.disconnectedCallback();
  }

  updated(changedProperties: PropertyValues<this>) {
    super.updated(changedProperties);
    if (
      changedProperties.has("locale") ||
      changedProperties.has("timezone") ||
      changedProperties.has("currentTime")
    ) {
      this.#updateCalendarViewContext();
    }
  }

  get startDate(): Temporal.PlainDate {
    return this.#startDate ? Temporal.PlainDate.from(this.#startDate) : Temporal.Now.plainDateISO();
  }

  set startDate(startDate: string) {
    this.#startDate = startDate;
  }

  get currentTime(): Temporal.PlainDateTime {
    if (!this.#currentTime) {
      return Temporal.Now.zonedDateTimeISO(this.timezone).toPlainDateTime();
    }
    return this.#toPlainDateTime(this.#currentTime);
  }

  set currentTime(
    currentTime: Temporal.PlainDateTime | Temporal.ZonedDateTime | string | undefined
  ) {
    this.#currentTime = currentTime?.toString();
  }

  get timezone(): string {
    return this.#timezone ?? Temporal.Now.timeZoneId();
  }

  set timezone(timezone: string | undefined) {
    this.#timezone = timezone || undefined;
  }

  get locale(): string {
    return this.#locale || navigator.language;
  }

  set locale(locale: string | undefined) {
    this.#locale = locale || undefined;
  }

  get days(): Temporal.PlainDate[] {
    const values: Temporal.PlainDate[] = [];
    for (let i = 0; i < this.#days; i++) {
      values.push(this.startDate.add({ days: i }));
    }
    return values;
  }

  get hours(): number {
    if (this.variant === "all-day") return 0;
    return this.#hours;
  }

  set days(value: number) {
    this.#days = value;
  }

  get snapInterval(): number {
    return this.#snapInterval;
  }

  set snapInterval(value: number) {
    this.#snapInterval = value;
    TimedEventInteractionController.snapInterval = value;
  }

  /** Reads --lc-days-per-row from CSS (default 7). Multi-row grid when all-day and days > daysPerRow. */
  get daysPerRow(): number {
    const computedStyle =
      typeof getComputedStyle !== "undefined" ? getComputedStyle(this) : undefined;
    const v = computedStyle?.getPropertyValue("--lc-days-per-row").trim() || "";
    return v ? parseInt(v, 10) || 7 : 7;
  }

  #readDaysPerRowToken(): string {
    if (typeof getComputedStyle === "undefined") return "";
    return getComputedStyle(this).getPropertyValue("--lc-days-per-row").trim();
  }

  #startStyleObserver() {
    if (typeof MutationObserver === "undefined") return;
    this.#lastDaysPerRowToken = this.#readDaysPerRowToken();

    this.#styleObserver = new MutationObserver(() => {
      const nextToken = this.#readDaysPerRowToken();
      if (nextToken === this.#lastDaysPerRowToken) return;
      this.#lastDaysPerRowToken = nextToken;
      this.requestUpdate();
    });

    // Watch host style changes and Storybook addon updates on document/body.
    this.#styleObserver.observe(this, { attributes: true, attributeFilter: ["style", "class"] });
    this.#styleObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style", "class"],
    });
    if (document.body) {
      this.#styleObserver.observe(document.body, { attributes: true, attributeFilter: ["style", "class"] });
    }
  }

  #stopStyleObserver() {
    this.#styleObserver?.disconnect();
    this.#styleObserver = undefined;
  }

  /** True when all-day and we have more days than columns (multi-row grid). */
  get #isMonthView(): boolean {
    return Boolean(this.variant === "all-day" && this.#days > this.daysPerRow);
  }

  get gridRows(): number {
    if (!this.#isMonthView) return 1;
    return Math.ceil(this.#days / this.daysPerRow) || 1;
  }

  get sectionStyle(): Record<string, string> {
    const base: Record<string, string> = {
      "--_lc-hours": this.hours.toString(),
    };
    if (this.#isMonthView) {
      base["--_lc-days"] = this.daysPerRow.toString();
      base["--_lc-grid-rows"] = this.gridRows.toString();
      base["--_lc-row-height"] = `calc(100% / ${this.gridRows})`;
    } else {
      base["--_lc-days"] = this.#days.toString();
    }
    return base;
  }

  render() {
    const hoverStyle: Record<string, string> = {};

    if (this.#dragHoverDayIndex !== null) {
      if (this.variant === "all-day") {
        // Highlight the day cell
        if (this.#isMonthView) {
          // For month view, calculate row and column
          const row = Math.floor(this.#dragHoverDayIndex / this.daysPerRow);
          const col = this.#dragHoverDayIndex % this.daysPerRow;
          const left = (col / this.daysPerRow) * 100;
          const width = (1 / this.daysPerRow) * 100;
          const top = (row / this.gridRows) * 100;
          const height = (1 / this.gridRows) * 100;
          hoverStyle["--_lc-hover-left"] = `${left}%`;
          hoverStyle["--_lc-hover-width"] = `${width}%`;
          hoverStyle["--_lc-hover-top"] = `${top}%`;
          hoverStyle["--_lc-hover-height"] = `${height}%`;
        } else {
          // For single-row view, highlight the entire column
          const left = (this.#dragHoverDayIndex / this.#days) * 100;
          const width = (1 / this.#days) * 100;
          hoverStyle["--_lc-hover-left"] = `${left}%`;
          hoverStyle["--_lc-hover-width"] = `${width}%`;
          hoverStyle["--_lc-hover-top"] = "0%";
          hoverStyle["--_lc-hover-height"] = "100%";
        }
      } else if (this.#dragHoverTime !== null) {
        // Highlight the time slot
        const dayCount = this.#days;
        const left = (this.#dragHoverDayIndex / dayCount) * 100;
        const width = (1 / dayCount) * 100;
        const hour = this.#dragHoverTime.hour + this.#dragHoverTime.minute / 60;
        const top = (hour / 24) * 100;
        const slotHeight = (1 / 24) * 100; // One hour slot
        hoverStyle["--_lc-hover-left"] = `${left}%`;
        hoverStyle["--_lc-hover-width"] = `${width}%`;
        hoverStyle["--_lc-hover-top"] = `${top}%`;
        hoverStyle["--_lc-hover-height"] = `${slotHeight}%`;
      }
    }

    return html`

        <section
            class="relative flex-1 flex-row h-full text-[0px] ${this.#isMonthView ? "month-view" : ""}"
            style=${styleMap({ ...this.sectionStyle, ...hoverStyle })}
            ?data-drag-hover=${this.#dragHoverDayIndex !== null}>
            ${this.variant === "all-day" && !this.dayNumbersHidden ? this.#renderDayNumbers() : ""}
            ${this.variant === "timed" ? this.#renderCurrentTimeIndicator() : ""}

            ${this.#sortedEvents.map(
              ([, event]) => html`
                ${
                  this.variant === "all-day"
                    ? html`
                <all-day-event
                    start=${this.#toEventDateTimeString(event.start)}
                    end=${this.#toEventDateTimeString(event.end)}
                    summary=${event.summary}
                    color=${event.color}
                    .renderedDays=${this.days}
                    .daysPerRow=${this.#isMonthView ? this.daysPerRow : 0}
                    .gridRows=${this.#isMonthView ? this.gridRows : 1}
                    @update=${() => this.requestUpdate("events")}
                ></all-day-event>
                `
                    : html`
                <timed-event
                    start=${this.#toEventDateTimeString(event.start)}
                    end=${this.#toEventDateTimeString(event.end)}
                    summary=${event.summary}
                    color=${event.color}
                    .renderedDays=${this.days as unknown as never[]}
                    @update=${() => this.requestUpdate("events")}
                ></timed-event>
                `
                }
                `
            )}

        </section>
    `;
  }

  #renderDayNumbers() {
    const cols = this.#isMonthView ? this.daysPerRow : this.#days;
    const days = this.days;
    const totalDays = days.length;
    const currentDay = this.currentTime.toPlainDate();
    const monthFormatter = new Intl.DateTimeFormat(this.locale, { month: "short" });
    const dayFormatter = new Intl.NumberFormat(this.locale);

    return days.map((day, dayIndex) => {
      if (cols <= 0 || totalDays <= 0) return "";

      const colIndex = this.#isMonthView ? dayIndex % cols : dayIndex;
      const rowIndex = this.#isMonthView ? Math.floor(dayIndex / cols) : 0;
      const right = ((cols - colIndex - 1) / cols) * 100;
      const top = this.#isMonthView ? (rowIndex / this.gridRows) * 100 : 0;
      const previousDay = dayIndex > 0 ? days[dayIndex - 1] : null;
      const startsNewMonth =
        previousDay === null || previousDay.month !== day.month || previousDay.year !== day.year;
      const monthPrefix = startsNewMonth
        ? `${monthFormatter.format(new Date(Date.UTC(day.year, day.month - 1, day.day)))} `
        : "";
      const label = `${monthPrefix}${dayFormatter.format(day.day)}`;
      const isCurrentDay = Temporal.PlainDate.compare(day, currentDay) === 0;

      return html`
        <time
          class="absolute p-1 text-sm mt-2 z-0 font-medium rounded-full flex justify-center items-center ${monthPrefix ? "min-w-6 px-2" : "w-6" } h-6 ${isCurrentDay
            ? "current-day"
            : ""}"
          datetime=${day.toString()}
          style=${styleMap({
            right: `calc(${right}% + 6px)`,
            top: `${top}%`,
          })}
        >
          ${label}
        </time>
      `;
    });
  }

  #renderCurrentTimeIndicator() {
    const days = this.days;
    if (!days.length || this.#days <= 0) return "";

    const currentDateTime = this.currentTime;
    const currentDay = currentDateTime.toPlainDate();
    const currentDayIndex = days.findIndex((day) => Temporal.PlainDate.compare(day, currentDay) === 0);
    if (currentDayIndex < 0) return "";

    const hourFloat =
      currentDateTime.hour +
      currentDateTime.minute / 60 +
      currentDateTime.second / 3600 +
      currentDateTime.millisecond / 3_600_000;
    if (hourFloat < 0 || hourFloat > this.hours) return "";

    const top = (hourFloat / this.hours) * 100;
    const left = (currentDayIndex / this.#days) * 100;
    const width = (1 / this.#days) * 100;

    return html`
      <div
        class="current-time-indicator absolute z-[100] m-0 pointer-events-none before:content-[''] before:absolute before:left-0 before:top-0 before:rounded-full before:-translate-x-[2px] before:-translate-y-1/2 before:[width:var(--_lc-current-time-dot-size)] before:[height:var(--_lc-current-time-dot-size)] before:[background-color:var(--_lc-current-day-color)]"
        style=${styleMap({
          top: `${top}%`,
          left: `${left}%`,
          width: `${width}%`,
          borderTop: "var(--_lc-current-time-line-width) solid var(--_lc-current-day-color)",
        })}
      ></div>
    `;
  }

  #handleDragHover = (event: Event) => {
    if (!(event instanceof CustomEvent)) {
      this.#dragHoverDayIndex = null;
      this.#dragHoverTime = null;
      this.requestUpdate();
      return;
    }

    const hover = event.detail;
    if (!hover) {
      this.#dragHoverDayIndex = null;
      this.#dragHoverTime = null;
    } else {
      this.#dragHoverDayIndex = hover.dayIndex ?? null;
      this.#dragHoverTime = hover.time ?? null;
    }
    this.requestUpdate();
  };

  #compareEventsForRenderOrder([, a]: EventEntry, [, b]: EventEntry): number {
    const aStart = this.#toPlainDateTime(a.start);
    const bStart = this.#toPlainDateTime(b.start);
    const startDiff = Temporal.PlainDateTime.compare(
      aStart,
      bStart
    );
    if (startDiff !== 0) return startDiff;

    const aEnd = this.#toPlainDateTime(a.end);
    const bEnd = this.#toPlainDateTime(b.end);
    const endDiff = Temporal.PlainDateTime.compare(
      aEnd,
      bEnd
    );
    if (endDiff !== 0) return endDiff;

    return a.summary.localeCompare(b.summary);
  }

  #toPlainDateTime(value: EventInput["start"]): Temporal.PlainDateTime {
    if (value instanceof Temporal.ZonedDateTime) {
      return value.withTimeZone(this.timezone).toPlainDateTime();
    }
    if (value instanceof Temporal.PlainDateTime) {
      return value;
    }
    if (value instanceof Temporal.PlainDate) {
      return value.toPlainDateTime({ hour: 0, minute: 0, second: 0 });
    }
    if (this.#isTimezonedString(value)) {
      return Temporal.ZonedDateTime.from(value).withTimeZone(this.timezone).toPlainDateTime();
    }
    return Temporal.PlainDateTime.from(value);
  }

  #toEventDateTimeString(value: EventInput["start"]): string {
    if (typeof value === "string") return value;
    return value.toString();
  }

  #isAllDayEvent(event: EventInput): boolean {
    return this.#isDateOnlyValue(event.start) || this.#isDateOnlyValue(event.end);
  }

  #isDateOnlyValue(value: EventInput["start"]): boolean {
    if (value instanceof Temporal.PlainDate) return true;
    if (value instanceof Temporal.PlainDateTime || value instanceof Temporal.ZonedDateTime) {
      return false;
    }
    return !value.includes("T");
  }

  #isTimezonedString(value: string): boolean {
    return value.includes("[") && value.includes("]");
  }

  get #eventsAsEntries(): EventEntry[] {
    return Array.from(this.events?.entries() ?? []);
  }

  #updateCalendarViewContext() {
    const value: CalendarViewContextValue = {
      locale: this.locale,
      timezone: this.timezone,
      currentTime: this.currentTime.toString(),
    };
    this.#calendarViewProvider.setValue(value);
  }
}
