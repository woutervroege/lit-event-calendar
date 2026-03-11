import { Temporal } from "@js-temporal/polyfill";
import { css, html } from "lit";
import { customElement } from "lit/decorators.js";
import "./CalendarView.js";
import "./CalendarTimeSidebar.js";
import { BaseElement } from "../BaseElement/BaseElement.js";

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

@customElement("calendar-week-view")
export class CalendarWeekView extends BaseElement {
  weekNumber = Temporal.Now.plainDateISO().weekOfYear;
  year = Temporal.Now.plainDateISO().year;
  weekStart: "monday" | "sunday" = "monday";
  daysPerWeek: 5 | 7 = 7;
  declare events?: EventsMap;
  locale?: string;
  timezone?: string;
  currentTime?: string;
  snapInterval = 15;
  visibleHours = 12;

  static get properties() {
    return {
      weekNumber: { type: Number, attribute: "week-number" },
      year: { type: Number },
      weekStart: {
        type: String,
        attribute: "week-start",
        reflect: true,
        converter: {
          fromAttribute: (v: string | null): "monday" | "sunday" =>
            v === "sunday" ? "sunday" : "monday",
          toAttribute: (v: string): string => v,
        },
      },
      daysPerWeek: {
        type: Number,
        attribute: "days-per-week",
        reflect: true,
        converter: {
          fromAttribute: (v: string | null): 5 | 7 => (v === "5" ? 5 : 7),
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
          grid-template-rows: var(--_lc-all-day-row-height, 120px) 1fr;
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
          top: var(--_lc-all-day-row-height, 120px);
          border-top: var(--_lc-week-section-divider-width, 3px) solid
            var(--_lc-week-section-divider-color, light-dark(rgb(15 23 42 / 22%), rgb(255 255 255 / 28%)));
          pointer-events: none;
          z-index: 1;
        }

        .sidebar {
          grid-column: 1;
          grid-row: 1 / 3;
        }

        .all-day {
          grid-column: 2;
          grid-row: 1;
          height: 100%;
          min-height: 120px;
        }

        .timed-scroll {
          grid-column: 2;
          grid-row: 2;
          display: block;
          height: calc(100% - var(--_lc-week-timed-top-offset, 8px));
          min-height: 0;
          margin-top: var(--_lc-week-timed-top-offset, 8px);
          overflow-y: auto;
        }

        .timed {
          display: block;
          min-height: 100%;
        }
      `,
    ];
  }

  get startDate(): Temporal.PlainDate {
    const firstOfYear = Temporal.PlainDate.from({
      year: this.year,
      month: 1,
      day: 1,
    });
    const weekStart = this.#resolvedWeekStart;
    const firstWeekStart = this.#startOfWeekFor(firstOfYear, weekStart);
    const normalizedWeek = Math.max(1, this.weekNumber);
    return firstWeekStart.add({ days: (normalizedWeek - 1) * 7 });
  }

  get #resolvedWeekStart(): "monday" | "sunday" {
    if (this.hasAttribute("week-start")) return this.weekStart;
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
    return event.start instanceof Temporal.PlainDate || event.end instanceof Temporal.PlainDate;
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

  #startOfWeekFor(date: Temporal.PlainDate, weekStart: "monday" | "sunday"): Temporal.PlainDate {
    const weekdayOffset = weekStart === "monday" ? date.dayOfWeek - 1 : date.dayOfWeek % 7;
    return date.subtract({ days: weekdayOffset });
  }

  #weekStartFromLocale(locale: string | undefined): "monday" | "sunday" {
    const resolvedLocale = locale || navigator.language || "en-US";
    try {
      const firstDay = new Intl.Locale(resolvedLocale).weekInfo?.firstDay;
      return firstDay === 7 ? "sunday" : "monday";
    } catch {
      return "monday";
    }
  }

  render() {
    return html`
      <div class="week-layout">
        <calendar-time-sidebar
          class="sidebar"
          .locale=${this.locale}
          .hours=${24}
          .visibleHours=${this.visibleHours}
          .showAllDayLabel=${true}
        ></calendar-time-sidebar>
        <calendar-view
          class="all-day"
          start-date=${this.startDate.toString()}
          .days=${this.daysPerWeek}
          variant="all-day"
          .events=${this.#allDayEvents}
          .locale=${this.locale}
          .timezone=${this.timezone}
          .currentTime=${this.currentTime}
          .snapInterval=${this.snapInterval}
          .labelsHidden=${false}
          @event-modified=${this.#reemit}
          @event-deleted=${this.#reemit}
        ></calendar-view>
        <div class="timed-scroll" @scroll=${this.#handleTimedScroll}>
          <calendar-view
            class="timed"
            start-date=${this.startDate.toString()}
            .days=${this.daysPerWeek}
            variant="timed"
            .events=${this.#timedEvents}
            .locale=${this.locale}
            .timezone=${this.timezone}
            .currentTime=${this.currentTime}
            .snapInterval=${this.snapInterval}
            .visibleHours=${this.visibleHours}
            .labelsHidden=${true}
            @event-modified=${this.#reemit}
            @event-deleted=${this.#reemit}
          ></calendar-view>
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

  #handleTimedScroll = (event: Event) => {
    const target = event.currentTarget;
    if (!(target instanceof HTMLElement)) return;
    const sidebar = this.renderRoot.querySelector("calendar-time-sidebar.sidebar");
    if (!(sidebar instanceof HTMLElement)) return;
    (
      sidebar as unknown as {
        setHourLabelsScrollTop?: (scrollTop: number) => void;
      }
    ).setHourLabelsScrollTop?.(target.scrollTop);
  };
}
