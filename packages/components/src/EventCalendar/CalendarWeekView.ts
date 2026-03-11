import { Temporal } from "@js-temporal/polyfill";
import { css, html } from "lit";
import { customElement } from "lit/decorators.js";
import "./CalendarView.js";
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
  snapInterval = 30;

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
          display: flex;
          flex-direction: column;
          width: 100%;
          height: 100%;
          min-height: 0;
          gap: 8px;
        }

        .all-day {
          flex: 0 0 120px;
          min-height: 120px;
        }

        .timed {
          flex: 1;
          min-height: 0;
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

  #startOfWeekFor(
    date: Temporal.PlainDate,
    weekStart: "monday" | "sunday"
  ): Temporal.PlainDate {
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
          .labelsHidden=${false}
          @event-modified=${this.#reemit}
          @event-deleted=${this.#reemit}
        ></calendar-view>
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
