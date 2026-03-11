import { Temporal } from "@js-temporal/polyfill";
import { css, html } from "lit";
import { customElement } from "lit/decorators.js";
import "./CalendarMonthView.js";
import { BaseElement } from "../BaseElement/BaseElement.js";
import { getLocaleWeekInfo, resolveLocale } from "../utils/Locale.js";

type EventInput = {
  uid?: string;
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
    return [
      ...BaseElement.styles,
      css`
        :host {
          display: block;
          width: 100%;
          height: 100%;
          min-height: 0;
          container-type: inline-size;
        }

        .year-grid {
          display: grid;
          grid-template-columns: repeat(var(--_lc-year-grid-effective-columns, 4), minmax(0, 1fr));
          gap: var(--_lc-year-grid-gap, 40px);
          width: 100%;
          height: 100%;
          min-height: 0;
        }

        .month-card {
          min-width: 0;
          display: grid;
          grid-template-rows: auto 1fr;
        }

        .month-card calendar-month-view {
          /* Year grid month cards need compact all-day layout earlier than standalone month view. */
          --lc-compact-month-max-inline-size: 552px;
        }

        .month-title {
          margin: 0;
          padding: 0 2px 14px;
          font-size: 17px;
          font-weight: 600;
          line-height: 1.2;
          color: var(--_lc-current-day-color, #ff0000);
        }

        @container (max-width: 1520px) {
          .year-grid {
            --_lc-year-grid-effective-columns: 3;
          }
        }

        @container (max-width: 1040px) {
          .year-grid {
            --_lc-year-grid-effective-columns: 2;
          }

          .month-card calendar-month-view {
            aspect-ratio: 1 / 1;
            height: auto;
          }
        }

        @container (max-width: 520px) {
          .year-grid {
            --_lc-year-grid-effective-columns: 1;
          }

          .month-card calendar-month-view {
            aspect-ratio: 1 / 1;
            height: auto;
          }
        }
      `,
    ];
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
    return html`
      <div class="year-grid">
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
              ></calendar-month-view>
            </section>
          `
        )}
      </div>
    `;
  }
}
