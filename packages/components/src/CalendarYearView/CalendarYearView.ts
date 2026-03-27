import { Temporal } from "@js-temporal/polyfill";
import { html, unsafeCSS } from "lit";
import { customElement } from "lit/decorators.js";
import "../CalendarMonthView/CalendarMonthView.js";
import { BaseElement } from "../BaseElement/BaseElement.js";
import type { CalendarEvent as EventInput } from "../models/CalendarEvent.js";
import { getLocaleDirection, getLocaleWeekInfo, resolveLocale } from "../utils/Locale.js";
import componentStyle from "./CalendarYearView.css?inline";

type EventsMap = Map<string, EventInput>;
type WeekdayNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;

function isWeekdayNumber(value: number | undefined): value is WeekdayNumber {
  return Boolean(value && Number.isInteger(value) && value >= 1 && value <= 7);
}

@customElement("calendar-year-view")
export class CalendarYearView extends BaseElement {
  year = Temporal.Now.plainDateISO().year;
  weekStart?: WeekdayNumber;
  declare events?: EventsMap;
  locale?: string;
  timezone?: string;
  currentTime?: string;

  static get properties() {
    return {
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

  get #resolvedLocale(): string {
    return resolveLocale(this.locale);
  }

  get #resolvedWeekStart(): WeekdayNumber {
    if (isWeekdayNumber(this.weekStart)) return this.weekStart;
    const firstDay = getLocaleWeekInfo(this.#resolvedLocale).firstDay;
    if (isWeekdayNumber(firstDay)) return firstDay;
    return 1;
  }

  #formatMonth(month: number): string {
    return new Intl.DateTimeFormat(this.#resolvedLocale, { month: "long" }).format(
      new Date(Date.UTC(this.year, month - 1, 1))
    );
  }

  render() {
    const direction = getLocaleDirection(this.#resolvedLocale);

    return html`
      <div
        class="year-grid"
        dir=${direction}
      >
        ${Array.from({ length: 12 }, (_, index) => index + 1).map(
          (month) => html`
            <section class="month-card">
              <h3 class="month-title">${this.#formatMonth(month)}</h3>
              <calendar-month-view
                month=${month}
                year=${this.year}
                .weekStart=${this.#resolvedWeekStart}
                .events=${this.events}
                .locale=${this.locale}
                .timezone=${this.timezone}
                .currentTime=${this.currentTime}
                @day-selection-requested=${this.#reemit}
                @event-create-requested=${this.#reemit}
                @event-modified=${this.#reemit}
                @event-deleted=${this.#reemit}
              ></calendar-month-view>
            </section>
          `
        )}
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
