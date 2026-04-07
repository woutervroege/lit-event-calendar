import { Temporal } from "@js-temporal/polyfill";
import { html, unsafeCSS } from "lit";
import { customElement } from "lit/decorators.js";
import "../CalendarGridView/CalendarGridView.js";
import "../CalendarWeekdayHeader/CalendarWeekdayHeader.js";
import { CalendarViewBase } from "../CalendarViewBase/CalendarViewBase.js";
import type { WeekdayNumber } from "../types/Weekday.js";
import componentStyle from "./CalendarMonthView.css?inline";

@customElement("calendar-month-view")
export class CalendarMonthView extends CalendarViewBase {
  month = Temporal.Now.plainDateISO().month;
  year = Temporal.Now.plainDateISO().year;
  weekStart?: number;

  static get properties() {
    return {
      ...CalendarViewBase.properties,
      month: { type: Number },
      year: { type: Number },
      weekStart: { type: Number, attribute: "week-start", reflect: true },
    } as const;
  }

  static get styles() {
    return [...CalendarViewBase.styles, unsafeCSS(componentStyle)];
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
    return this.resolveWeekStart(this.weekStart, this.lang);
  }

  render() {
    return html`
      <div class="month-layout">
        <calendar-weekday-header
          .lang=${this.lang}
          .weekStart=${this.weekStart}
          .daysPerWeek=${7}
        ></calendar-weekday-header>
        <calendar-grid-view
          class="month-grid"
          .startDate=${this.startDate}
          .daysPerWeek=${42}
          variant="all-day"
          .events=${this.events}
          .lang=${this.lang}
          .timezone=${this.timezone}
          current-time=${this.currentTime}
          .labelsHidden=${false}
          .defaultEventSummary=${this.defaultEventSummary}
          .defaultEventColor=${this.defaultEventColor}
          .defaultCalendarId=${this.defaultCalendarId}
          @day-selection-requested=${this.forwardCalendarEvent}
          @event-create-requested=${this.forwardCalendarEvent}
          @event-selection-requested=${this.forwardCalendarEvent}
          @event-update-requested=${this.forwardCalendarEvent}
          @event-delete-requested=${this.forwardCalendarEvent}
        ></calendar-grid-view>
      </div>
    `;
  }
}
