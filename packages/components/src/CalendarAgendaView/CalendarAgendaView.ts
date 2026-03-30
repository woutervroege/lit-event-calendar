import { Temporal } from "@js-temporal/polyfill";
import { html, unsafeCSS } from "lit";
import { customElement } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";
import { BaseElement } from "../BaseElement/BaseElement.js";
import "../EventCard/EventCard.js";
import { renderCalendarIcon } from "../icons/calendarIcon.js";
import type { CalendarEventView as EventInput } from "../models/CalendarEvent.js";
import { getEventColorStyles } from "../utils/EventColor.js";
import { getLocaleDirection, resolveLocale } from "../utils/Locale.js";
import componentStyle from "./CalendarAgendaView.css?inline";

type EventEntry = [id: string, event: EventInput];
type EventsMap = Map<string, EventInput>;

type AgendaItem = {
  event: EventInput;
  start: Temporal.PlainDateTime;
  end: Temporal.PlainDateTime;
  continuesFromPreviousDay: boolean;
};

type AgendaDay = {
  date: Temporal.PlainDate;
  items: AgendaItem[];
};

@customElement("calendar-agenda-view")
export class CalendarAgendaView extends BaseElement {
  month = Temporal.Now.plainDateISO().month;
  year = Temporal.Now.plainDateISO().year;
  declare events?: EventsMap;
  locale?: string;
  timezone?: string;
  currentTime?: string;

  static get properties() {
    return {
      month: { type: Number },
      year: { type: Number },
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
    } as const;
  }

  static get styles() {
    return [...BaseElement.styles, unsafeCSS(componentStyle)];
  }

  render() {
    const direction = getLocaleDirection(this.#resolvedLocale);
    const days = this.#agendaDays;

    return html`
      <div class="agenda-shell" dir=${direction}>
        ${days.length
          ? html`
              ${days.map(
                ({ date, items }) => html`
                  <section class="agenda-day">
                    <button
                      type="button"
                      class="agenda-day-heading"
                      @click=${() => this.#requestDaySelection(date)}
                    >
                      <span class="agenda-day-weekday">${this.#formatWeekday(date)}</span>
                      <span class="agenda-day-date">${this.#formatDayLabel(date)}</span>
                    </button>
                    <ul class="agenda-event-list">
                      ${items.map((item) => this.#renderItem(item))}
                    </ul>
                  </section>
                `
              )}
            `
          : html`
              <div class="agenda-empty">
                ${renderCalendarIcon({ className: "agenda-empty-icon" })}
              </div>
            `}
      </div>
    `;
  }

  #renderItem(item: AgendaItem) {
    const { event } = item;
    const isPast = Temporal.PlainDateTime.compare(item.end, this.#now) <= 0;
    const colorStyles = getEventColorStyles(event.color);
    return html`
      <li class="agenda-event-item">
        <event-card
          layout="flow"
          .locale=${this.locale}
          summary=${event.summary}
          time=${this.#formatItemTime(item)}
          ?past=${isPast}
          first-segment
          last-segment
          segment-direction="horizontal"
          style=${styleMap(colorStyles)}
        ></event-card>
      </li>
    `;
  }

  get #agendaDays(): AgendaDay[] {
    const grouped = new Map<string, AgendaItem[]>();
    const rangeStart = this.#monthStart;
    const rangeEndExclusive = this.#monthEndExclusive;

    for (const [, event] of this.#eventsAsEntries) {
      if (event.isRemoved) continue;
      const start = this.#toPlainDateTime(event.start);
      const end = this.#toPlainDateTime(event.end);
      if (Temporal.PlainDateTime.compare(end, start) <= 0) continue;
      if (!this.#eventOverlapsRange(start, end, rangeStart, rangeEndExclusive)) continue;

      const eventStartDate = start.toPlainDate();
      const displayDate =
        Temporal.PlainDate.compare(eventStartDate, rangeStart) < 0 ? rangeStart : eventStartDate;
      const key = displayDate.toString();
      const dayItems = grouped.get(key) ?? [];
      dayItems.push({
        event,
        start,
        end,
        continuesFromPreviousDay: Temporal.PlainDate.compare(eventStartDate, displayDate) < 0,
      });
      grouped.set(key, dayItems);
    }

    return Array.from(grouped.entries())
      .sort(([a], [b]) => Temporal.PlainDate.compare(Temporal.PlainDate.from(a), Temporal.PlainDate.from(b)))
      .map(([date, items]) => ({
        date: Temporal.PlainDate.from(date),
        items: items.sort((a, b) => this.#compareAgendaItems(a, b)),
      }));
  }

  #eventOverlapsRange(
    start: Temporal.PlainDateTime,
    end: Temporal.PlainDateTime,
    rangeStart: Temporal.PlainDate,
    rangeEndExclusive: Temporal.PlainDate
  ): boolean {
    const rangeStartDateTime = rangeStart.toPlainDateTime({ hour: 0, minute: 0, second: 0 });
    const rangeEndDateTime = rangeEndExclusive.toPlainDateTime({ hour: 0, minute: 0, second: 0 });
    return (
      Temporal.PlainDateTime.compare(start, rangeEndDateTime) < 0 &&
      Temporal.PlainDateTime.compare(end, rangeStartDateTime) > 0
    );
  }

  #compareAgendaItems(a: AgendaItem, b: AgendaItem): number {
    const startDiff = Temporal.PlainDateTime.compare(a.start, b.start);
    if (startDiff !== 0) return startDiff;
    const endDiff = Temporal.PlainDateTime.compare(a.end, b.end);
    if (endDiff !== 0) return endDiff;
    return a.event.summary.localeCompare(b.event.summary);
  }

  #requestDaySelection(date: Temporal.PlainDate) {
    this.dispatchEvent(
      new CustomEvent("day-selection-requested", {
        detail: { date: date.toString() },
        bubbles: true,
        composed: true,
      })
    );
  }

  #formatDayLabel(date: Temporal.PlainDate): string {
    return new Intl.DateTimeFormat(this.#resolvedLocale, {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(this.#toDate(date));
  }

  #formatWeekday(date: Temporal.PlainDate): string {
    return new Intl.DateTimeFormat(this.#resolvedLocale, {
      weekday: "long",
      timeZone: "UTC",
    }).format(this.#toDate(date));
  }

  #formatItemTime(item: AgendaItem): string {
    if (this.#isAllDayEvent(item.event)) {
      const startDate = item.start.toPlainDate();
      const endDate = item.end.subtract({ nanoseconds: 1 }).toPlainDate();
      if (Temporal.PlainDate.compare(startDate, endDate) === 0) {
        return item.continuesFromPreviousDay ? "All day (continues)" : "All day";
      }
      return `${item.continuesFromPreviousDay ? "Continues" : "All day"} - ${this.#formatDate(
        startDate
      )} to ${this.#formatDate(endDate)}`;
    }

    const startsAndEndsSameDay = Temporal.PlainDate.compare(
      item.start.toPlainDate(),
      item.end.toPlainDate()
    );
    if (startsAndEndsSameDay === 0) {
      return `${this.#formatTime(item.start)} - ${this.#formatTime(item.end)}`;
    }
    return `${this.#formatDateTime(item.start)} - ${this.#formatDateTime(item.end)}`;
  }

  #formatDate(date: Temporal.PlainDate): string {
    return new Intl.DateTimeFormat(this.#resolvedLocale, {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(this.#toDate(date));
  }

  #formatDateTime(dateTime: Temporal.PlainDateTime): string {
    return new Intl.DateTimeFormat(this.#resolvedLocale, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }).format(this.#toDate(dateTime));
  }

  #formatTime(dateTime: Temporal.PlainDateTime): string {
    return new Intl.DateTimeFormat(this.#resolvedLocale, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }).format(this.#toDate(dateTime));
  }

  #toDate(value: Temporal.PlainDate | Temporal.PlainDateTime): Date {
    if (value instanceof Temporal.PlainDate) {
      return new Date(Date.UTC(value.year, value.month - 1, value.day));
    }
    return new Date(
      Date.UTC(
        value.year,
        value.month - 1,
        value.day,
        value.hour,
        value.minute,
        value.second,
        value.millisecond
      )
    );
  }

  #toPlainDateTime(value: EventInput["start"]): Temporal.PlainDateTime {
    if (value instanceof Temporal.ZonedDateTime) {
      return this.timezone
        ? value.withTimeZone(this.timezone).toPlainDateTime()
        : value.toPlainDateTime();
    }
    if (value instanceof Temporal.PlainDateTime) return value;
    return value.toPlainDateTime({ hour: 0, minute: 0, second: 0 });
  }

  #isAllDayEvent(event: EventInput): boolean {
    return event.start instanceof Temporal.PlainDate || event.end instanceof Temporal.PlainDate;
  }

  get #eventsAsEntries(): EventEntry[] {
    return Array.from(this.events?.entries() ?? []);
  }

  get #monthStart(): Temporal.PlainDate {
    return Temporal.PlainDate.from({ year: this.year, month: this.month, day: 1 });
  }

  get #monthEndExclusive(): Temporal.PlainDate {
    return this.#monthStart.add({ months: 1 });
  }

  get #resolvedLocale(): string {
    return resolveLocale(this.locale);
  }

  get #now(): Temporal.PlainDateTime {
    if (this.currentTime) {
      if (this.currentTime.includes("[") && this.currentTime.includes("]")) {
        const zoned = Temporal.ZonedDateTime.from(this.currentTime);
        return this.timezone ? zoned.withTimeZone(this.timezone).toPlainDateTime() : zoned.toPlainDateTime();
      }
      return Temporal.PlainDateTime.from(this.currentTime);
    }
    if (this.timezone) {
      return Temporal.Now.zonedDateTimeISO(this.timezone).toPlainDateTime();
    }
    return Temporal.Now.plainDateTimeISO();
  }
}
