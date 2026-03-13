import { Temporal } from "@js-temporal/polyfill";
import { html, unsafeCSS } from "lit";
import { customElement } from "lit/decorators.js";
import { BaseElement } from "../BaseElement/BaseElement.js";
import "./EventCalendar.js";
import "./CalendarViewTabs.js";
import "./CalendarNavControls.js";
import componentStyle from "./EventCalendarWrapper.css?inline";
import type { CalendarNavigationDirection, CalendarViewMode, EventCalendar } from "./EventCalendar.js";

type WeekdayNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;

type EventInput = {
  uid?: string;
  recurrenceId?: string;
  start:
    | string
    | import("@js-temporal/polyfill").Temporal.PlainDate
    | import("@js-temporal/polyfill").Temporal.PlainDateTime
    | import("@js-temporal/polyfill").Temporal.ZonedDateTime;
  end:
    | string
    | import("@js-temporal/polyfill").Temporal.PlainDate
    | import("@js-temporal/polyfill").Temporal.PlainDateTime
    | import("@js-temporal/polyfill").Temporal.ZonedDateTime;
  summary: string;
  color: string;
};

type EventEntry = [id: string, event: EventInput];
type EventsMap = Map<string, EventInput>;

@customElement("event-calendar-wrapper")
export class EventCalendarWrapper extends BaseElement {
  view: CalendarViewMode = "month";
  startDate = Temporal.Now.plainDateISO().toString();
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
      view: { type: String, reflect: true },
      startDate: { type: String, attribute: "start-date" },
      weekStart: { type: Number, attribute: "week-start", reflect: true },
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
    return [...BaseElement.styles, unsafeCSS(componentStyle)];
  }

  render() {
    return html`
      <div class="event-calendar-wrapper">
        <header class="header">
          <calendar-view-tabs .view=${this.view} @view-selected=${this.#handleViewSelected}>
          </calendar-view-tabs>
          <calendar-nav-controls @navigate=${this.#handleNavigation}></calendar-nav-controls>
        </header>
        <event-calendar
          class="calendar"
          .view=${this.view}
          .startDate=${this.startDate}
          .weekStart=${this.weekStart}
          .daysPerWeek=${this.daysPerWeek}
          .events=${this.events}
          .locale=${this.locale}
          .timezone=${this.timezone}
          .currentTime=${this.currentTime}
          .snapInterval=${this.snapInterval}
          .visibleHours=${this.visibleHours}
          .rtl=${this.rtl}
          @view-changed=${this.#syncStateFromCalendar}
          @start-date-changed=${this.#syncStateFromCalendar}
          @event-modified=${this.#reemit}
          @event-deleted=${this.#reemit}
        ></event-calendar>
      </div>
    `;
  }

  get #calendarElement(): EventCalendar | null {
    return this.renderRoot.querySelector("event-calendar");
  }

  #handleViewSelected = (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const detail = event.detail as { view?: CalendarViewMode } | undefined;
    if (!detail?.view) return;
    if (this.#calendarElement) {
      this.#calendarElement.view = detail.view;
    }
  };

  #handleNavigation = (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const detail = event.detail as { direction?: CalendarNavigationDirection } | undefined;
    if (!detail?.direction) return;
    if (detail.direction === "previous") {
      this.#calendarElement?.goBack();
      return;
    }
    if (detail.direction === "today") {
      this.#calendarElement?.goToday();
      return;
    }
    this.#calendarElement?.goForward();
  };

  #syncStateFromCalendar = () => {
    const calendarElement = this.#calendarElement;
    if (!calendarElement) return;

    this.view = calendarElement.view;
    this.startDate = calendarElement.startDate?.toString() ?? this.startDate;
  };

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
