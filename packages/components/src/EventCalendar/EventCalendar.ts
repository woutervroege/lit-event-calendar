import { Temporal } from "@js-temporal/polyfill";
import { html, unsafeCSS } from "lit";
import { customElement } from "lit/decorators.js";
import { BaseElement } from "../BaseElement/BaseElement.js";
import "./CalendarWeekView.js";
import "./CalendarMonthView.js";
import "./CalendarYearView.js";
import "./CalendarViewTabs.js";
import "./CalendarNavControls.js";
import { getLocaleWeekInfo } from "../utils/Locale.js";
import componentStyle from "./EventCalendar.css?inline";

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
    return [...BaseElement.styles, unsafeCSS(componentStyle)];
  }

  render() {
    return html`
      <div class="event-calendar">
        <header class="header">
          <p class="range-label">${this.#headerRangeLabel}</p>
          <calendar-view-tabs .view=${this.view} @view-selected=${this.#handleViewSelected}>
          </calendar-view-tabs>
          <calendar-nav-controls @navigate=${this.#handleNavigation}></calendar-nav-controls>
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

  #handleViewSelected = (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const detail = event.detail as { view?: CalendarViewMode } | undefined;
    if (!detail?.view) return;
    this.#setView(detail.view);
  };

  #handleNavigation = (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const detail = event.detail as { direction?: "previous" | "today" | "next" } | undefined;
    if (detail?.direction === "previous") {
      this.#goPrevious();
      return;
    }
    if (detail?.direction === "today") {
      this.#goToToday();
      return;
    }
    if (detail?.direction === "next") {
      this.#goNext();
    }
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
