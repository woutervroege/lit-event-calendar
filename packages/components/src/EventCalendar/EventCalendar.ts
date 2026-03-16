import { Temporal } from "@js-temporal/polyfill";
import { html } from "lit";
import { customElement } from "lit/decorators.js";
import { ifDefined } from "lit/directives/if-defined.js";
import { BaseElement } from "../BaseElement/BaseElement.js";
import "../CalendarViewGroup/CalendarViewGroup.js";
import type {
  CalendarViewGroup,
  CalendarViewMode,
} from "../CalendarViewGroup/CalendarViewGroup.js";
import "../TabSwitch/TabSwitch.js";
import {
  sharedButtonActiveBackgroundClasses,
  sharedButtonActiveTextClasses,
  sharedButtonFocusRingClasses,
  sharedButtonHoverTintClasses,
  sharedButtonVisualClasses,
} from "../shared/buttonStyles.js";

type WeekdayNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;
type EventInput = {
  uid?: string;
  recurrenceId?: string;
  start: string | Temporal.PlainDate | Temporal.PlainDateTime | Temporal.ZonedDateTime;
  end: string | Temporal.PlainDate | Temporal.PlainDateTime | Temporal.ZonedDateTime;
  summary: string;
  color: string;
};
type EventsMap = Map<string, EventInput>;

const TAB_LABELS: Record<CalendarViewMode, string> = {
  day: "Day",
  week: "Week",
  month: "Month",
  year: "Year",
};
const TAB_TO_VIEW: Record<string, CalendarViewMode> = {
  Day: "day",
  Week: "week",
  Month: "month",
  Year: "year",
};

@customElement("event-calendar")
export class EventCalendar extends BaseElement {
  #view: CalendarViewMode = "month";
  #startDate?: string;
  #daysPerWeek = 7;
  #rangeLabelText = "";
  weekStart?: WeekdayNumber;
  declare events?: EventsMap;
  locale?: string;
  timezone?: string;
  currentTime?: string;
  snapInterval = 15;
  visibleHours = 12;
  rtl = false;

  static get properties() {
    return {
      view: {
        type: String,
        reflect: true,
        dispatchChangeEvent: { bubbles: true, composed: true },
      },
      startDate: {
        type: String,
        attribute: "start-date",
        dispatchChangeEvent: { bubbles: true, composed: true },
      },
      weekStart: { type: Number, attribute: "week-start", reflect: true },
      daysPerWeek: {
        type: Number,
        attribute: "days-per-week",
      },
      events: {
        type: Object,
      },
      locale: { type: String },
      timezone: { type: String },
      currentTime: { type: String, attribute: "current-time" },
      snapInterval: { type: Number, attribute: "snap-interval" },
      visibleHours: { type: Number, attribute: "visible-hours" },
      rtl: { type: Boolean, reflect: true },
    } as const;
  }

  get view(): CalendarViewMode {
    return this.#view;
  }

  set view(value: CalendarViewMode | string | null | undefined) {
    const nextValue =
      value === "day" || value === "week" || value === "month" || value === "year"
        ? value
        : "month";
    if (this.#view === nextValue) return;
    this.#view = nextValue;
    this.requestUpdate();
  }

  get startDate(): Temporal.PlainDate | undefined {
    if (!this.#startDate) return undefined;
    return Temporal.PlainDate.from(this.#startDate);
  }

  set startDate(value: string | Temporal.PlainDate | undefined) {
    const nextValue =
      value === undefined
        ? undefined
        : value instanceof Temporal.PlainDate
          ? value.toString()
          : Temporal.PlainDate.from(value).toString();
    if (this.#startDate === nextValue) return;
    this.#startDate = nextValue;
    this.requestUpdate();
  }

  get daysPerWeek(): number {
    return this.#daysPerWeek;
  }

  set daysPerWeek(value: number | string | null | undefined) {
    const rawValue = typeof value === "string" ? Number(value) : value;
    const numeric = Number(rawValue);
    const nextValue = Number.isFinite(numeric) ? Math.max(1, Math.min(7, Math.floor(numeric))) : 7;
    if (this.#daysPerWeek === nextValue) return;
    this.#daysPerWeek = nextValue;
    this.requestUpdate();
  }

  get #calendarViewGroup(): CalendarViewGroup | null {
    return this.renderRoot.querySelector("calendar-view-group");
  }

  goBack() {
    const viewGroup = this.#calendarViewGroup;
    if (!viewGroup) return;
    viewGroup.goBack();
    this.#syncFromViewGroupElement(viewGroup);
  }

  goForward() {
    const viewGroup = this.#calendarViewGroup;
    if (!viewGroup) return;
    viewGroup.goForward();
    this.#syncFromViewGroupElement(viewGroup);
  }

  goToday() {
    const viewGroup = this.#calendarViewGroup;
    if (!viewGroup) return;
    viewGroup.goToday();
    this.#syncFromViewGroupElement(viewGroup);
  }

  render() {
    const buttonClasses = `${sharedButtonVisualClasses} ${sharedButtonActiveBackgroundClasses} ${sharedButtonActiveTextClasses} ${sharedButtonHoverTintClasses} ${sharedButtonFocusRingClasses} disabled:opacity-55 disabled:cursor-not-allowed disabled:hover:bg-[light-dark(rgb(15_23_42_/_18%),rgb(255_255_255_/_16%))] cursor-pointer`;
    const iconButtonClasses = `${buttonClasses} px-3 text-sm`;
    const todayButtonClasses = `${buttonClasses} text-sm`;
    return html`
      <div style="display:flex;flex-direction:column;gap:1.75rem;min-height:0;height:100%;">
        <header
          class="rounded-md border border-[light-dark(rgb(15_23_42_/_14%),rgb(255_255_255_/_16%))] py-2"
          style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;column-gap:0.75rem;"
        >
          <div style="display:flex;justify-self:start;gap:0.5rem;">
            <button
              type="button"
              class=${iconButtonClasses}
              aria-label="Previous range"
              @click=${() => this.goBack()}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                aria-hidden="true"
                style="width:1.1rem;height:1.1rem;display:block;"
              >
                <path d="M15 6l-6 6 6 6" stroke-linecap="round" stroke-linejoin="round"></path>
              </svg>
            </button>
            <button
              type="button"
              class=${todayButtonClasses}
              @click=${() => this.goToday()}
            >
              Today
            </button>
            <button
              type="button"
              class=${iconButtonClasses}
              aria-label="Next range"
              @click=${() => this.goForward()}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                aria-hidden="true"
                style="width:1.1rem;height:1.1rem;display:block;"
              >
                <path d="M9 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"></path>
              </svg>
            </button>
          </div>
          <p
            class="m-0 text-center text-xl font-bold text-[light-dark(rgb(15_23_42_/_95%),rgb(255_255_255_/_98%))]"
            aria-live="polite"
          >
            ${this.#rangeLabelText}
          </p>
          <div style="justify-self:end;">
            <tab-switch
              .options=${["Day", "Week", "Month", "Year"]}
              .value=${TAB_LABELS[this.view]}
              name="event-calendar-view-tabs"
              group-label="Calendar view"
              @value-changed=${this.#handleViewTabChanged}
            ></tab-switch>
          </div>
        </header>
        <calendar-view-group
          style="min-height:0;flex:1 1 auto;"
          .view=${this.view}
          start-date=${ifDefined(this.#startDate)}
          .weekStart=${this.weekStart}
          .daysPerWeek=${this.daysPerWeek}
          .events=${this.events}
          .locale=${this.locale}
          .timezone=${this.timezone}
          .currentTime=${this.currentTime}
          .snapInterval=${this.snapInterval}
          .visibleHours=${this.visibleHours}
          .rtl=${this.rtl}
          @view-changed=${this.#syncFromViewGroup}
          @start-date-changed=${this.#syncFromViewGroup}
          @day-selection-requested=${this.#syncFromViewGroup}
          @event-modified=${this.#reemit}
          @event-deleted=${this.#reemit}
        ></calendar-view-group>
      </div>
    `;
  }

  #handleViewTabChanged = (event: Event) => {
    const target = event.currentTarget as { value?: string } | null;
    const nextView = target?.value ? TAB_TO_VIEW[target.value] : undefined;
    if (!nextView || nextView === this.view) return;

    this.view = nextView;
    const viewGroup = this.#calendarViewGroup;
    if (!viewGroup) return;
    viewGroup.view = nextView;
    this.#syncFromViewGroupElement(viewGroup);
  };

  #syncFromViewGroup = (event: Event) => {
    const target = event.target as CalendarViewGroup | null;
    if (!target) return;
    this.#syncFromViewGroupElement(target);
  };

  #syncFromViewGroupElement(target: CalendarViewGroup) {
    this.view = target.view;
    this.startDate = target.startDate;
    this.currentTime = target.currentTime;
    this.daysPerWeek = target.daysPerWeek;
    this.#rangeLabelText = target.rangeLabel;
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

  override updated(changedProperties: Map<PropertyKey, unknown>): void {
    super.updated(changedProperties);
    const viewGroup = this.#calendarViewGroup;
    if (!viewGroup) return;
    const nextRangeLabel = viewGroup.rangeLabel;
    if (nextRangeLabel !== this.#rangeLabelText) {
      this.#rangeLabelText = nextRangeLabel;
      this.requestUpdate();
    }
  }
}
