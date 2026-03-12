import { Temporal } from "@js-temporal/polyfill";
import { css, html } from "lit";
import { customElement } from "lit/decorators.js";
import { BaseElement } from "../BaseElement/BaseElement.js";
import "./CalendarWeekView.js";
import "./CalendarMonthView.js";
import "./CalendarYearView.js";
import { getLocaleWeekInfo } from "../utils/Locale.js";

type CalendarViewMode = "day" | "week" | "month" | "year";
type WeekdayNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;

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
type ViewTransitionMode = "zoom-in" | "zoom-out";
type ViewTransition = { finished: Promise<unknown> };
type ViewTransitionDocument = Document & {
  startViewTransition: (update: () => void | Promise<void>) => ViewTransition;
};

type WeekEventInput = Omit<EventInput, "start" | "end"> & {
  start: Temporal.PlainDate | Temporal.PlainDateTime | Temporal.ZonedDateTime;
  end: Temporal.PlainDate | Temporal.PlainDateTime | Temporal.ZonedDateTime;
};

function isWeekdayNumber(value: number | undefined): value is WeekdayNumber {
  return Boolean(value && Number.isInteger(value) && value >= 1 && value <= 7);
}

const VIEW_OPTIONS: ReadonlyArray<{ mode: CalendarViewMode; label: string }> = [
  { mode: "day", label: "Day" },
  { mode: "week", label: "Week" },
  { mode: "month", label: "Month" },
  { mode: "year", label: "Year" },
];
const VIEW_GRANULARITY: Record<CalendarViewMode, number> = {
  day: 0,
  week: 1,
  month: 2,
  year: 3,
};

@customElement("event-calendar")
export class EventCalendar extends BaseElement {
  view: CalendarViewMode = "month";
  weekNumber = Temporal.Now.plainDateISO().weekOfYear;
  month = Temporal.Now.plainDateISO().month;
  year = Temporal.Now.plainDateISO().year;
  dayDate?: string;
  weekStart?: WeekdayNumber;
  daysPerWeek = 7;
  declare events?: EventsMap;
  locale?: string;
  timezone?: string;
  currentTime?: string;
  snapInterval = 15;
  visibleHours = 12;
  rtl = false;
  #isSwitchingView = false;
  #queuedView: CalendarViewMode | null = null;
  #viewTransitionMode: ViewTransitionMode = "zoom-in";

  static get properties() {
    return {
      view: {
        type: String,
        reflect: true,
        converter: {
          fromAttribute: (value: string | null): CalendarViewMode =>
            value === "day" || value === "week" || value === "month" || value === "year"
              ? value
              : "month",
          toAttribute: (value: CalendarViewMode): string => value,
        },
      },
      weekNumber: { type: Number, attribute: "week-number" },
      month: { type: Number },
      year: { type: Number },
      dayDate: { type: String, attribute: "day-date" },
      weekStart: { type: Number, attribute: "week-start", reflect: true },
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
    } as const;
  }

  static get styles() {
    return [
      ...BaseElement.styles,
      css`
        :host {
          display: block;
          width: 100%;
          height: 100%;
          min-height: 0;
        }

        .event-calendar {
          display: grid;
          grid-template-rows: auto 1fr;
          width: 100%;
          height: 100%;
          min-height: 0;
        }

        .header {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          column-gap: 10px;
          padding: 8px 0 10px;
        }

        .range-label {
          justify-self: start;
          margin: 0;
          font-size: 24px;
          line-height: 1.2;
          font-weight: 700;
          color: var(--lc-higlight-color, currentColor);
        }

        .tabs {
          display: inline-flex;
          gap: 4px;
          padding: 4px;
          border-radius: 999px;
          background: var(--_lc-tabbar-background, light-dark(rgb(15 23 42 / 8%), rgb(255 255 255 / 12%)));
          justify-self: center;
        }

        .nav-button {
          border: 0;
          border-radius: 999px;
          background: var(--_lc-tabbar-background, light-dark(rgb(15 23 42 / 8%), rgb(255 255 255 / 12%)));
          color: inherit;
          font: inherit;
          font-size: 13px;
          line-height: 1;
          font-weight: 500;
          cursor: pointer;
          height: 34px;
          min-width: 34px;
          padding: 0 10px;
          transition: background-color 120ms ease;
        }

        .nav-button:hover {
          background: var(--_lc-tab-hover-background, light-dark(rgb(15 23 42 / 10%), rgb(255 255 255 / 18%)));
        }

        .nav-controls {
          display: inline-flex;
          align-items: center;
          justify-self: end;
          gap: 6px;
        }

        .tab {
          border: 0;
          border-radius: 999px;
          background: transparent;
          color: inherit;
          font: inherit;
          font-size: 13px;
          line-height: 1;
          font-weight: 500;
          cursor: pointer;
          padding: 8px 12px;
          transition: background-color 120ms ease, color 120ms ease;
        }

        .tab:hover {
          background: var(--_lc-tab-hover-background, light-dark(rgb(15 23 42 / 10%), rgb(255 255 255 / 18%)));
        }

        .tab[aria-selected="true"] {
          background: var(--_lc-tab-active-background, light-dark(rgb(15 23 42 / 16%), rgb(255 255 255 / 24%)));
          font-weight: 600;
        }

        .content {
          position: relative;
          view-transition-name: lc-event-calendar-content;
          min-height: 0;
          height: 100%;
        }

        .content > * {
          width: 100%;
          height: 100%;
        }

        :host::view-transition-group(lc-event-calendar-content) {
          animation-duration: var(--_lc-view-transition-duration, 180ms);
          animation-timing-function: var(
            --_lc-view-transition-easing,
            cubic-bezier(0.2, 0.65, 0.25, 1)
          );
        }

        :host([data-view-transition-mode="zoom-in"])::view-transition-old(lc-event-calendar-content) {
          animation-name: lc-view-transition-zoom-in-old;
          transform-origin: center;
        }

        :host([data-view-transition-mode="zoom-in"])::view-transition-new(lc-event-calendar-content) {
          animation-name: lc-view-transition-zoom-in-new;
          transform-origin: center;
        }

        :host([data-view-transition-mode="zoom-out"])::view-transition-old(lc-event-calendar-content) {
          animation-name: lc-view-transition-zoom-out-old;
          transform-origin: center;
        }

        :host([data-view-transition-mode="zoom-out"])::view-transition-new(lc-event-calendar-content) {
          animation-name: lc-view-transition-zoom-out-new;
          transform-origin: center;
        }

        @keyframes lc-view-transition-zoom-in-old {
          from {
            opacity: 1;
            transform: scale(1);
          }
          to {
            opacity: 0;
            transform: scale(0.985);
          }
        }

        @keyframes lc-view-transition-zoom-in-new {
          from {
            opacity: 0;
            transform: scale(1.03);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes lc-view-transition-zoom-out-old {
          from {
            opacity: 1;
            transform: scale(1);
          }
          to {
            opacity: 0;
            transform: scale(1.015);
          }
        }

        @keyframes lc-view-transition-zoom-out-new {
          from {
            opacity: 0;
            transform: scale(0.97);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

      `,
    ];
  }

  render() {
    return html`
      <div class="event-calendar">
        <header class="header">
          <p class="range-label">${this.#headerRangeLabel}</p>
          <div class="tabs" role="tablist" aria-label="Calendar view">
            ${VIEW_OPTIONS.map(
              ({ mode, label }) => html`
                <button
                  id=${this.#tabId(mode)}
                  type="button"
                  class="tab"
                  role="tab"
                  aria-selected=${this.view === mode ? "true" : "false"}
                  aria-controls=${this.#panelId(mode)}
                  @click=${() => this.#setView(mode)}
                >
                  ${label}
                </button>
              `
            )}
          </div>
          <div class="nav-controls">
            <button
              type="button"
              class="nav-button"
              aria-label="Previous range"
              @click=${() => this.#goPrevious()}
            >
              &lt;
            </button>
            <button type="button" class="nav-button" @click=${() => this.#goToToday()}>Today</button>
            <button
              type="button"
              class="nav-button"
              aria-label="Next range"
              @click=${() => this.#goNext()}
            >
              &gt;
            </button>
          </div>
        </header>
        <section
          id=${this.#panelId(this.view)}
          class="content"
          role="tabpanel"
          aria-labelledby=${this.#tabId(this.view)}
        >
          ${this.#renderViewFor(this.view)}
        </section>
      </div>
    `;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
  }

  #renderViewFor(view: CalendarViewMode) {
    if (view === "day") {
      return html`
        <calendar-week-view
          start-date=${this.#resolvedDayDate.toString()}
          year=${this.year}
          .weekStart=${this.weekStart}
          days-per-week="1"
          .events=${this.#weekEvents}
          .locale=${this.locale}
          .timezone=${this.timezone}
          .currentTime=${this.#resolvedCurrentTime}
          snap-interval=${this.snapInterval}
          visible-hours=${this.visibleHours}
          .rtl=${this.rtl}
          @day-label-double-pointer=${this.#handleDayLabelDoublePointer}
          @event-modified=${this.#reemit}
          @event-deleted=${this.#reemit}
        ></calendar-week-view>
      `;
    }

    if (view === "week") {
      return html`
        <calendar-week-view
          start-date=${this.#weekStartDate.toString()}
          week-number=${this.weekNumber}
          year=${this.year}
          .weekStart=${this.weekStart}
          days-per-week=${this.daysPerWeek}
          .events=${this.#weekEvents}
          .locale=${this.locale}
          .timezone=${this.timezone}
          .currentTime=${this.#resolvedCurrentTime}
          snap-interval=${this.snapInterval}
          visible-hours=${this.visibleHours}
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
          year=${this.year}
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
        month=${this.month}
        year=${this.year}
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

  get #weekEvents(): Map<string, WeekEventInput> {
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

  #setView(nextView: CalendarViewMode) {
    if (this.view === nextView && this.#queuedView === null) return;
    this.#queuedView = nextView;
    if (this.#isSwitchingView) return;
    void this.#flushQueuedViewSwitches();
  }

  async #flushQueuedViewSwitches() {
    this.#isSwitchingView = true;
    try {
      while (this.#queuedView !== null) {
        const targetView = this.#queuedView;
        this.#queuedView = null;
        if (targetView === this.view) continue;
        await this.#performViewSwitch(targetView);
      }
    } finally {
      this.#isSwitchingView = false;
    }
  }

  async #performViewSwitch(nextView: CalendarViewMode) {
    const previousView = this.view;
    this.#viewTransitionMode = this.#resolveViewTransitionMode(previousView, nextView);
    this.setAttribute("data-view-transition-mode", this.#viewTransitionMode);
    const viewTransitionDocument = document as ViewTransitionDocument;
    const transition = viewTransitionDocument.startViewTransition(async () => {
      this.view = nextView;
      this.dispatchEvent(
        new CustomEvent("view-changed", {
          detail: { view: nextView },
          bubbles: true,
          composed: true,
        })
      );
      await this.updateComplete;
    });
    try {
      await transition.finished;
    } finally {
      this.removeAttribute("data-view-transition-mode");
    }
  }

  #resolveViewTransitionMode(
    previousView: CalendarViewMode,
    nextView: CalendarViewMode
  ): ViewTransitionMode {
    const previousGranularity = VIEW_GRANULARITY[previousView];
    const nextGranularity = VIEW_GRANULARITY[nextView];
    if (nextGranularity < previousGranularity) return "zoom-in";
    return "zoom-out";
  }

  #handleDayLabelDoublePointer = (event: Event) => {
    if (!(event instanceof CustomEvent)) return;

    const detail = event.detail as { date?: string } | undefined;
    if (!detail?.date) return;

    const selectedDate = Temporal.PlainDate.from(detail.date);
    this.#setAnchorDate(selectedDate);
    this.#setView("day");
  };

  #goPrevious() {
    this.#navigateByView(-1);
  }

  #goNext() {
    this.#navigateByView(1);
  }

  #goToToday() {
    const now = this.#now;
    const today = now.toPlainDate();
    this.currentTime = now.toString();
    this.#setAnchorDate(today);
  }

  #navigateByView(step: number) {
    if (this.view === "day") {
      this.#setAnchorDate(this.#resolvedDayDate.add({ days: step }));
      return;
    }

    if (this.view === "year") {
      this.year += step;
      return;
    }

    if (this.view === "month") {
      const monthDate = Temporal.PlainDate.from({ year: this.year, month: this.month, day: 1 }).add({
        months: step,
      });
      this.year = monthDate.year;
      this.month = monthDate.month;
      return;
    }

    const start = this.#weekStartDate;
    const rangeLengthDays = Math.max(1, Math.min(7, Math.floor(Number(this.daysPerWeek) || 7)));
    const nextStart = start.add({ days: rangeLengthDays * step });
    this.#setAnchorDate(nextStart);
  }

  #setAnchorDate(date: Temporal.PlainDate) {
    this.year = date.year;
    this.month = date.month;
    this.dayDate = date.toString();
    this.weekNumber = this.#weekNumberFromStartDate(date);
  }

  get #weekStartDate(): Temporal.PlainDate {
    const firstOfYear = Temporal.PlainDate.from({ year: this.year, month: 1, day: 1 });
    const firstWeekStart = this.#startOfWeekFor(firstOfYear, this.#resolvedWeekStart);
    const normalizedWeek = Math.max(1, Number(this.weekNumber) || 1);
    return firstWeekStart.add({ days: (normalizedWeek - 1) * 7 });
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

  get #resolvedDayDate(): Temporal.PlainDate {
    if (this.dayDate) {
      return Temporal.PlainDate.from(this.dayDate);
    }
    return Temporal.PlainDate.from(this.#resolvedCurrentTime);
  }

  get #headerRangeLabel(): string {
    if (this.view === "year") {
      return String(this.year);
    }

    if (this.view === "day") {
      const dayDate = this.#resolvedDayDate;
      return new Intl.DateTimeFormat(this.locale, {
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(new Date(Date.UTC(dayDate.year, dayDate.month - 1, dayDate.day)));
    }

    const locale = this.locale;
    const date = this.view === "week" ? this.#weekStartDate : Temporal.PlainDate.from({
      year: this.year,
      month: this.month,
      day: 1,
    });
    return new Intl.DateTimeFormat(locale, {
      month: "long",
      year: "numeric",
    }).format(new Date(Date.UTC(date.year, date.month - 1, 1)));
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

  #tabId(view: CalendarViewMode): string {
    return `event-calendar-tab-${view}`;
  }

  #panelId(view: CalendarViewMode): string {
    return `event-calendar-panel-${view}`;
  }
}
