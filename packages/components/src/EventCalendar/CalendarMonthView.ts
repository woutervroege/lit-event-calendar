import { Temporal } from "@js-temporal/polyfill";
import { html } from "lit";
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

type EventsMap = Map<string, EventInput>;
type WeekdayNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;

function isWeekdayNumber(value: number | undefined): value is WeekdayNumber {
  return Boolean(value && Number.isInteger(value) && value >= 1 && value <= 7);
}

@customElement("calendar-month-view")
export class CalendarMonthView extends BaseElement {
  month = Temporal.Now.plainDateISO().month;
  year = Temporal.Now.plainDateISO().year;
  weekStart?: WeekdayNumber;
  declare events?: EventsMap;
  locale?: string;
  timezone?: string;
  currentTime?: string;

  static get properties() {
    return {
      month: { type: Number },
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
      events: {
        type: Object,
        converter: {
          fromAttribute: (value: string | null): EventsMap =>
            new Map(JSON.parse(value || "[]") as Array<[id: string, event: EventInput]>),
        },
      },
      locale: { type: String },
      timezone: { type: String },
      currentTime: { type: String, attribute: "current-time" },
    } as const;
  }

  get startDate(): Temporal.PlainDate {
    const firstOfMonth = Temporal.PlainDate.from({
      year: this.year,
      month: this.month,
      day: 1,
    });

    const weekStart = this.#resolvedWeekStart;
    const weekdayOffset = (firstOfMonth.dayOfWeek - weekStart + 7) % 7;

    return firstOfMonth.subtract({ days: weekdayOffset });
  }

  get #resolvedWeekStart(): WeekdayNumber {
    if (isWeekdayNumber(this.weekStart)) return this.weekStart;
    return this.#weekStartFromLocale(this.locale);
  }

  #weekStartFromLocale(locale: string | undefined): WeekdayNumber {
    const resolvedLocale = locale || navigator.language || "en-US";

    try {
      const localeInfo = new Intl.Locale(resolvedLocale) as Intl.Locale & {
        getWeekInfo?: () => { firstDay?: number };
        weekInfo?: { firstDay?: number };
      };
      const firstDay = localeInfo.getWeekInfo?.().firstDay ?? localeInfo.weekInfo?.firstDay;
      if (isWeekdayNumber(firstDay)) return firstDay;
    } catch {
      // Conservative fallback: default to Monday when locale parsing is unavailable.
    }
    return 1;
  }

  render() {
    return html`
      <calendar-view
        start-date=${this.startDate.toString()}
        days="42"
        variant="all-day"
        .events=${this.events}
        .locale=${this.locale}
        .timezone=${this.timezone}
        .currentTime=${this.currentTime}
        .labelsHidden=${false}
        @event-modified=${this.#reemit}
        @event-deleted=${this.#reemit}
      ></calendar-view>
    `;
  }

  #reemit = (event: Event) => {
    this.dispatchEvent(
      new CustomEvent(event.type, {
        detail: (event as CustomEvent).detail,
        bubbles: true,
        composed: true,
      })
    );
  };
}
