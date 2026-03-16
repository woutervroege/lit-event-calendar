import { Temporal } from "@js-temporal/polyfill";
import { html } from "lit";
import { customElement } from "lit/decorators.js";
import { ifDefined } from "lit/directives/if-defined.js";
import { BaseElement } from "../BaseElement/BaseElement.js";
import "../CalendarViewGroup/CalendarViewGroup.js";
import type { CalendarViewGroup, CalendarViewMode } from "../CalendarViewGroup/CalendarViewGroup.js";
import "../TabSwitch/TabSwitch.js";
import {
  sharedButtonActiveBackgroundClasses,
  sharedButtonActiveTextClasses,
  sharedButtonFocusRingClasses,
  sharedButtonHoverTintClasses,
  sharedButtonVisualClasses,
} from "../shared/buttonStyles.js";
import { getLocaleWeekInfo, resolveLocale } from "../utils/Locale.js";

type WeekdayNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;
type CalendarNavigationDirection = "previous" | "today" | "next";
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

@customElement("calendar-ui")
export class CalendarUi extends BaseElement {
  #view: CalendarViewMode = "month";
  #startDate?: string;
  weekStart?: WeekdayNumber;
  #daysPerWeek = 7;
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
      value === "day" || value === "week" || value === "month" || value === "year" ? value : "month";
    if (nextValue === this.#view) return;
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
    if (nextValue === this.#startDate) return;
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
    if (nextValue === this.#daysPerWeek) return;
    this.#daysPerWeek = nextValue;
    this.requestUpdate();
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
              @click=${() => this.#navigate("previous")}
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
              @click=${() => this.#navigate("today")}
            >
              Today
            </button>
            <button
              type="button"
              class=${iconButtonClasses}
              aria-label="Next range"
              @click=${() => this.#navigate("next")}
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
            ${this.#rangeLabel}
          </p>
          <div style="justify-self:end;">
            <tab-switch
              .options=${["Day", "Week", "Month", "Year"]}
              .value=${TAB_LABELS[this.view]}
              name="calendar-ui-view-tabs"
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
          @day-selection-requested=${this.#handleDaySelectionRequested}
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
    this.requestUpdate();
  };

  #navigate(direction: CalendarNavigationDirection) {
    if (direction === "today") {
      const now = this.#now;
      this.currentTime = now.toString();
      this.startDate = now.toPlainDate();
      return;
    }
    this.startDate = this.#targetDateByView(direction === "next" ? 1 : -1);
  }

  #syncFromViewGroup = (event: Event) => {
    const target = event.target as CalendarViewGroup | null;
    if (!target) return;
    this.view = target.view;
    this.startDate = target.startDate;
  };

  #handleDaySelectionRequested = (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const detail = event.detail as { date?: string } | undefined;
    if (!detail?.date) return;
    this.startDate = detail.date;
    this.view = "day";
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

  get #rangeLabel(): string {
    const locale = resolveLocale(this.locale);
    const anchor = this.#resolvedStartDate;
    if (this.view === "year") {
      return new Intl.DateTimeFormat(locale, { year: "numeric" }).format(
        new Date(Date.UTC(anchor.year, anchor.month - 1, anchor.day))
      );
    }
    if (this.view === "month") {
      return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(
        new Date(Date.UTC(anchor.year, anchor.month - 1, 1))
      );
    }
    if (this.view === "day") {
      return new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(
        new Date(Date.UTC(anchor.year, anchor.month - 1, anchor.day))
      );
    }
    return this.#weekRangeLabel(anchor, locale);
  }

  #weekRangeLabel(anchorDate: Temporal.PlainDate, locale: string): string {
    const start = this.#startOfWeekFor(anchorDate, this.#resolvedWeekStart);
    const end = start.add({ days: Math.max(1, this.daysPerWeek) - 1 });
    const startDate = new Date(Date.UTC(start.year, start.month - 1, start.day));
    const endDate = new Date(Date.UTC(end.year, end.month - 1, end.day));
    if (start.year === end.year && start.month === end.month) {
      const month = new Intl.DateTimeFormat(locale, { month: "short" }).format(startDate);
      return `${month} ${start.day}-${end.day}, ${start.year}`;
    }
    if (start.year === end.year) {
      const startPart = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(
        startDate
      );
      const endPart = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(
        endDate
      );
      return `${startPart} - ${endPart}, ${start.year}`;
    }
    const startPart = new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(startDate);
    const endPart = new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(endDate);
    return `${startPart} - ${endPart}`;
  }

  #targetDateByView(step: number): Temporal.PlainDate {
    const anchorDate = this.#resolvedStartDate;
    if (this.view === "day") {
      return anchorDate.add({ days: step });
    }
    if (this.view === "year") {
      return anchorDate.add({ years: step });
    }
    if (this.view === "month") {
      return Temporal.PlainDate.from({
        year: anchorDate.year,
        month: anchorDate.month,
        day: 1,
      }).add({ months: step });
    }
    const weekStart = this.#startOfWeekFor(anchorDate, this.#resolvedWeekStart);
    return weekStart.add({ days: Math.max(1, this.daysPerWeek) * step });
  }

  #startOfWeekFor(date: Temporal.PlainDate, weekStart: WeekdayNumber): Temporal.PlainDate {
    const weekdayOffset = (date.dayOfWeek - weekStart + 7) % 7;
    return date.subtract({ days: weekdayOffset });
  }

  get #resolvedWeekStart(): WeekdayNumber {
    const localeFirstDay = getLocaleWeekInfo(this.locale).firstDay;
    const value = this.weekStart ?? localeFirstDay ?? 1;
    if (value >= 1 && value <= 7) return value as WeekdayNumber;
    return 1;
  }

  get #resolvedStartDate(): Temporal.PlainDate {
    if (this.#startDate) {
      return Temporal.PlainDate.from(this.#startDate);
    }
    return Temporal.PlainDate.from(this.#resolvedCurrentTime);
  }

  get #now(): Temporal.PlainDateTime {
    if (this.timezone) {
      return Temporal.Now.zonedDateTimeISO(this.timezone).toPlainDateTime();
    }
    return Temporal.Now.plainDateTimeISO();
  }

  get #resolvedCurrentTime(): string {
    return this.currentTime ?? this.#now.toString();
  }
}
