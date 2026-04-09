import { Temporal } from "@js-temporal/polyfill";
import { html, unsafeCSS } from "lit";
import { customElement } from "lit/decorators.js";
import "../CalendarMonthView/CalendarMonthView.js";
import { CalendarViewBase } from "../CalendarViewBase/CalendarViewBase.js";
import { resolveLocale } from "../utils/Locale.js";
import componentStyle from "./CalendarYearView.css?inline";

@customElement("calendar-year-view")
export class CalendarYearView extends CalendarViewBase {
  year = Temporal.Now.plainDateISO().year;
  weekStart?: number;

  static get properties() {
    return {
      ...CalendarViewBase.properties,
      year: { type: Number },
      weekStart: { type: Number, attribute: "week-start", reflect: true },
    } as const;
  }

  static get styles() {
    return [...CalendarViewBase.styles, unsafeCSS(componentStyle)];
  }

  get #resolvedLocale(): string {
    return resolveLocale(this.lang);
  }

  get #resolvedWeekStart(): number {
    return this.resolveWeekStart(this.weekStart, this.#resolvedLocale);
  }

  #formatMonth(month: number): string {
    return new Intl.DateTimeFormat(this.#resolvedLocale, { month: "long" }).format(
      new Date(Date.UTC(this.year, month - 1, 1))
    );
  }

  render() {
    const direction = this.resolveDirection();

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
                .month=${month}
                .year=${this.year}
                .weekStart=${this.#resolvedWeekStart}
                .events=${this.events}
                .lang=${this.lang}
                .timezone=${this.timezone}
                .currentTime=${this.currentTime}
                .defaultEventSummary=${this.defaultEventSummary}
                .defaultEventColor=${this.defaultEventColor}
                .defaultCalendarId=${this.defaultCalendarId}
                @day-selection=${this.forwardCalendarEvent}
                @event-created=${this.forwardCalendarEvent}
                @event-selection=${this.forwardCalendarEvent}
                @event-updated=${this.forwardCalendarEvent}
                @event-deleted=${this.forwardCalendarEvent}
              ></calendar-month-view>
            </section>
          `
        )}
      </div>
    `;
  }
}
