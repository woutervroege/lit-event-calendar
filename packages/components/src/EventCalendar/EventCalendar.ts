import { Temporal } from "@js-temporal/polyfill";
import { html, unsafeCSS } from "lit";
import { customElement } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";
import { ifDefined } from "lit/directives/if-defined.js";
import { repeat } from "lit/directives/repeat.js";
import "../TimedEvent/TimedEvent.js";
import { BaseElement } from "../BaseElement/BaseElement.js";
import componentStyle from "./EventCalendar.css?inline";
import "../TimedEvent/AllDayEvent.js";
import { TimedEventInteractionController } from "../controllers/TimedEventInteractionController.js";

type EventInput = {
  start: string;
  end: string;
  summary: string;
  color: string;
};

@customElement("event-calendar")
export class EventCalendar extends BaseElement {
  #startDate?: string;
  #currentTime?: string;
  #days!: number;
  #hours: number = 24;
  #snapInterval: number = TimedEventInteractionController.snapInterval;
  declare events?: EventInput[];
  variant: "timed" | "all-day" = "timed";
  #dragHoverDayIndex: number | null = null;
  #dragHoverTime: Temporal.PlainTime | null = null;

  get #sortedEvents(): EventInput[] {
    const events = [...(this.events ?? [])];
    return events.sort((a, b) => this.#compareEventsForRenderOrder(a, b));
  }

  static get properties() {
    return {
      startDate: { type: String, attribute: "start-date" },
      days: { type: Number },
      events: { type: Array },
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
      snapInterval: { type: Number, attribute: "snap-interval" },
      currentTime: {
        attribute: "current-time",
        converter: {
          fromAttribute: (v: string | null): Temporal.PlainDateTime | undefined =>
            v ? Temporal.PlainDateTime.from(v) : undefined,
          toAttribute: (v: Temporal.PlainDateTime | null | undefined): string | null =>
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
    this.addEventListener("interaction-drag-hover", this.#handleDragHover as EventListener);
  }

  disconnectedCallback() {
    this.removeEventListener("interaction-drag-hover", this.#handleDragHover as EventListener);
    super.disconnectedCallback();
  }

  get startDate(): Temporal.PlainDate {
    return this.#startDate ? Temporal.PlainDate.from(this.#startDate) : Temporal.Now.plainDateISO();
  }

  set startDate(startDate: string) {
    this.#startDate = startDate;
  }

  get currentTime(): Temporal.PlainDateTime {
    return this.#currentTime
      ? Temporal.PlainDateTime.from(this.#currentTime)
      : Temporal.Now.plainDateTimeISO();
  }

  set currentTime(currentTime: Temporal.PlainDateTime | string | undefined) {
    this.#currentTime = currentTime ? Temporal.PlainDateTime.from(currentTime).toString() : undefined;
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

  /** Reads --days-per-row from CSS (default 7). Multi-row grid when all-day and days > daysPerRow. */
  get daysPerRow(): number {
    const v =
      typeof getComputedStyle !== "undefined"
        ? getComputedStyle(this).getPropertyValue("--days-per-row").trim()
        : "";
    return v ? parseInt(v, 10) || 7 : 7;
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
      "--hours": this.hours.toString(),
    };
    if (this.#isMonthView) {
      base["--days"] = this.daysPerRow.toString();
      base["--grid-rows"] = this.gridRows.toString();
      base["--row-height"] = `calc(100% / ${this.gridRows})`;
    } else {
      base["--days"] = this.#days.toString();
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
          hoverStyle["--hover-left"] = `${left}%`;
          hoverStyle["--hover-width"] = `${width}%`;
          hoverStyle["--hover-top"] = `${top}%`;
          hoverStyle["--hover-height"] = `${height}%`;
        } else {
          // For single-row view, highlight the entire column
          const left = (this.#dragHoverDayIndex / this.#days) * 100;
          const width = (1 / this.#days) * 100;
          hoverStyle["--hover-left"] = `${left}%`;
          hoverStyle["--hover-width"] = `${width}%`;
          hoverStyle["--hover-top"] = "0%";
          hoverStyle["--hover-height"] = "100%";
        }
      } else if (this.#dragHoverTime !== null) {
        // Highlight the time slot
        const dayCount = this.#days;
        const left = (this.#dragHoverDayIndex / dayCount) * 100;
        const width = (1 / dayCount) * 100;
        const hour = this.#dragHoverTime.hour + this.#dragHoverTime.minute / 60;
        const top = (hour / 24) * 100;
        const slotHeight = (1 / 24) * 100; // One hour slot
        hoverStyle["--hover-left"] = `${left}%`;
        hoverStyle["--hover-width"] = `${width}%`;
        hoverStyle["--hover-top"] = `${top}%`;
        hoverStyle["--hover-height"] = `${slotHeight}%`;
      }
    }

    return html`

        <section
            class="relative flex-1 flex-row h-full text-[0px] ${this.#isMonthView ? "month-view" : ""}"
            style=${styleMap({ ...this.sectionStyle, ...hoverStyle })}
            ?data-drag-hover=${this.#dragHoverDayIndex !== null}>
            ${this.variant === "all-day" ? this.#renderDayNumbers() : ""}
            ${this.variant === "timed" ? this.#renderCurrentTimeIndicator() : ""}

            ${repeat(
              this.#sortedEvents,
              (event) => event,
              (event) => html`
                ${
                  this.variant === "all-day"
                    ? html`
                <all-day-event
                    locale=${ifDefined(this.locale)}
                    start=${event.start}
                    end=${event.end}
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
                    locale=${ifDefined(this.locale)}
                    start=${event.start}
                    end=${event.end}
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
        class="current-time-indicator absolute z-[100] m-0 pointer-events-none before:content-[''] before:absolute before:left-0 before:top-0 before:rounded-full before:-translate-x-[2px] before:-translate-y-1/2 before:[width:var(--current-time-dot-size)] before:[height:var(--current-time-dot-size)] before:[background-color:var(--current-time-dot-color)]"
        style=${styleMap({
          top: `${top}%`,
          left: `${left}%`,
          width: `${width}%`,
          borderTop: "var(--current-time-line-width, 2px) solid var(--current-time-line-color, red)",
        })}
      ></div>
    `;
  }

  #handleDragHover = (event: Event) => {
    const previousDayIndex = this.#dragHoverDayIndex;
    const previousTime = this.#dragHoverTime;

    if (!(event instanceof CustomEvent)) {
      this.#dragHoverDayIndex = null;
      this.#dragHoverTime = null;
      if (previousDayIndex !== null || previousTime !== null) {
        this.requestUpdate();
      }
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

    const nextDayIndex = this.#dragHoverDayIndex;
    const nextTime = this.#dragHoverTime;
    const changed =
      previousDayIndex !== nextDayIndex ||
      (previousTime === null
        ? nextTime !== null
        : nextTime === null || previousTime.toString() !== nextTime.toString());

    if (changed) {
      this.requestUpdate();
    }
  };

  #compareEventsForRenderOrder(a: EventInput, b: EventInput): number {
    const startDiff = Temporal.PlainDateTime.compare(
      Temporal.PlainDateTime.from(a.start),
      Temporal.PlainDateTime.from(b.start)
    );
    if (startDiff !== 0) return startDiff;

    const endDiff = Temporal.PlainDateTime.compare(
      Temporal.PlainDateTime.from(a.end),
      Temporal.PlainDateTime.from(b.end)
    );
    if (endDiff !== 0) return endDiff;

    return a.summary.localeCompare(b.summary);
  }
}
