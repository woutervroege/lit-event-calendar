import { Temporal } from "@js-temporal/polyfill";
import { css, html } from "lit";
import { customElement } from "lit/decorators.js";
import "./CalendarView.js";
import "./CalendarTimeSidebar.js";
import "./CalendarWeekdayHeader.js";
import { BaseElement } from "../BaseElement/BaseElement.js";
import { getLocaleDirection, getLocaleWeekInfo } from "../utils/Locale.js";

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

        .week-layout {
          display: grid;
          grid-template-columns: var(--_lc-time-sidebar-width, 56px) 1fr;
          grid-template-rows: var(--_lc-weekday-header-height, 26px) var(--_lc-all-day-row-height, 120px) 1fr;
          column-gap: var(--_lc-time-label-gap, 6px);
          row-gap: 0;
          position: relative;
          width: 100%;
          height: 100%;
          min-height: 0;
        }

        .week-layout::after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          top: calc(
            var(--_lc-weekday-header-height, 26px) + var(--_lc-all-day-row-height, 120px)
          );
          border-top: var(--_lc-week-section-divider-width, 3px) solid
            var(--_lc-week-section-divider-color, light-dark(rgb(15 23 42 / 22%), rgb(255 255 255 / 28%)));
          pointer-events: none;
          z-index: 1;
        }

        .weekday-sidebar-spacer {
          grid-column: 1;
          grid-row: 1;
        }

        .weekday-header {
          grid-column: 2;
          grid-row: 1;
        }

        .all-day-sidebar-label {
          grid-column: 1;
          grid-row: 2;
          display: flex;
          justify-content: flex-end;
          align-items: flex-start;
          padding-top: 8px;
          padding-right: 4px;
          font-size: 12px;
          line-height: 1;
          font-weight: 500;
          white-space: nowrap;
          color: var(--_lc-grid-line-day-color, light-dark(rgb(15 23 42 / 72%), rgb(255 255 255 / 72%)));
          pointer-events: none;
        }

        .all-day {
          grid-column: 2;
          grid-row: 2;
          height: 100%;
          min-height: 120px;
        }

        .timed-scroll {
          grid-column: 1 / 3;
          grid-row: 3;
          display: block;
          height: calc(100% - var(--_lc-week-timed-top-offset, 8px));
          min-height: 0;
          margin-top: var(--_lc-week-timed-top-offset, 8px);
          overflow-y: auto;
        }

        .timed-content {
          display: grid;
          grid-template-columns: var(--_lc-time-sidebar-width, 56px) 1fr;
          column-gap: var(--_lc-time-label-gap, 6px);
          min-height: 100%;
          height: calc(var(--_lc-week-timed-height-factor, 1) * 100%);
        }

        .timed-sidebar {
          min-height: 100%;
        }

        .timed {
          display: block;
          min-height: 100%;
        }
      `,
    ];
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
    return new Map(this.#eventEntries.filter(([, event]) => this.#isAllDayEvent(event)));
  }

  get #timedEvents(): EventsMap {
    return new Map(this.#eventEntries.filter(([, event]) => this.#isTimedEvent(event)));
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
    if (value instanceof Temporal.PlainDateTime || value instanceof Temporal.ZonedDateTime) {
      return false;
    }
    return !value.includes("T");
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

  render() {
    const clampedVisibleHours = Math.max(1, Math.min(24, Math.floor(Number(this.visibleHours) || 12)));
    const timedHeightFactor = 24 / clampedVisibleHours;
    const direction = this.rtl ? "rtl" : getLocaleDirection(this.locale);

    return html`
      <div class="week-layout" dir=${direction}>
        <div class="weekday-sidebar-spacer" aria-hidden="true"></div>
        <calendar-weekday-header
          class="weekday-header"
          .locale=${this.locale}
          .weekStart=${this.weekStart}
          .days=${this.daysPerWeek}
        ></calendar-weekday-header>
        <div class="all-day-sidebar-label" aria-hidden="true">All-day</div>
        <calendar-view
          class="all-day"
          start-date=${this.startDate.toString()}
          .days=${this.daysPerWeek}
          variant="all-day"
          .events=${this.#allDayEvents}
          .rtl=${this.rtl}
          .locale=${this.locale}
          .timezone=${this.timezone}
          .currentTime=${this.currentTime}
          .snapInterval=${this.snapInterval}
          .labelsHidden=${false}
          @event-modified=${this.#reemit}
          @event-deleted=${this.#reemit}
        ></calendar-view>
        <div class="timed-scroll">
          <div class="timed-content" style=${`--_lc-week-timed-height-factor: ${timedHeightFactor};`}>
            <calendar-time-sidebar
              class="timed-sidebar"
              .locale=${this.locale}
              .hours=${24}
            ></calendar-time-sidebar>
            <calendar-view
              class="timed"
              start-date=${this.startDate.toString()}
              .days=${this.daysPerWeek}
              variant="timed"
              .events=${this.#timedEvents}
              .rtl=${this.rtl}
              .locale=${this.locale}
              .timezone=${this.timezone}
              .currentTime=${this.currentTime}
              .snapInterval=${this.snapInterval}
              .labelsHidden=${true}
              @event-modified=${this.#reemit}
              @event-deleted=${this.#reemit}
            ></calendar-view>
          </div>
        </div>
      </div>
    `;
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
