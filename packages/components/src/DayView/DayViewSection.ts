import { Temporal } from "@js-temporal/polyfill";
import { html, unsafeCSS } from "lit";
import { customElement } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";
import { ifDefined } from "lit/directives/if-defined.js";
import "../TimedEvent/TimedEvent.js";
import { BaseElement } from "../BaseElement/BaseElement.js";
import componentStyle from "./DayView.css?inline";
import "../TimedEvent/AllDayEvent.js";
import { TimedEventInteractionController } from "../controllers/TimedEventInteractionController";

type EventInput = {
  start: string;
  end: string;
  summary: string;
  color: string;
};

@customElement("day-view-section")
export class DayViewSection extends BaseElement {
  #startDate?: string;
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

            ${this.#sortedEvents.map(
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
