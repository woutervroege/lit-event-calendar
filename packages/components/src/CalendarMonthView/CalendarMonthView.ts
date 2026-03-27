import { Temporal } from "@js-temporal/polyfill";
import { html, unsafeCSS } from "lit";
import { customElement } from "lit/decorators.js";
import "../CalendarView/CalendarView.js";
import "../CalendarWeekdayHeader/CalendarWeekdayHeader.js";
import { BaseElement } from "../BaseElement/BaseElement.js";
import type { CalendarEvent as EventInput } from "../models/CalendarEvent.js";
import { getLocaleWeekInfo } from "../utils/Locale.js";
import componentStyle from "./CalendarMonthView.css?inline";

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

  static get styles() {
    return [...BaseElement.styles, unsafeCSS(componentStyle)];
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
    const firstDay = getLocaleWeekInfo(locale).firstDay;
    if (isWeekdayNumber(firstDay)) return firstDay;
    return 1;
  }

  render() {
    return html`
      <div class="month-layout">
        <calendar-weekday-header
          .locale=${this.locale}
          .weekStart=${this.weekStart}
          days="7"
        ></calendar-weekday-header>
        <calendar-view
          class="month-grid"
          start-date=${this.startDate.toString()}
          days="42"
          variant="all-day"
          .events=${this.events}
          .locale=${this.locale}
          .timezone=${this.timezone}
          .currentTime=${this.currentTime}
          .labelsHidden=${false}
          @day-selection-requested=${this.#reemit}
          @event-create-requested=${this.#reemit}
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
