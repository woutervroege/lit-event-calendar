import { Temporal } from "@js-temporal/polyfill";
import { html } from "lit";
import { customElement } from "lit/decorators.js";
import { ifDefined } from "lit/directives/if-defined.js";
import { BaseElement } from "../BaseElement/BaseElement.js";
import "../Button/Button.js";
import "../CalendarViewGroup/CalendarViewGroup.js";
import "../Dropdown/Dropdown.js";
import type {
  CalendarViewGroup,
  CalendarPresentationMode,
  CalendarViewMode,
} from "../CalendarViewGroup/CalendarViewGroup.js";
import type { CalendarEventView as EventInput } from "../models/CalendarEvent.js";
import "../TabSwitch/TabSwitch.js";
import type { TabSwitchOption } from "../TabSwitch/TabSwitch.js";
import { renderCalendarIcon } from "../icons/calendarIcon.js";
import { renderGridIcon } from "../icons/gridIcon.js";
import { renderListIcon } from "../icons/listIcon.js";

type WeekdayNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;
type EventsMap = Map<string, EventInput>;

type ViewUnit = Extract<CalendarViewMode, "day" | "week" | "month" | "year">;
type PresentationUnit = CalendarPresentationMode;

const VIEW_OPTIONS_BASE: Array<{ value: ViewUnit; hotkey: string }> = [
  { value: "day", hotkey: "d" },
  { value: "week", hotkey: "w" },
  { value: "month", hotkey: "m" },
  { value: "year", hotkey: "y" },
];

const PRESENTATION_OPTIONS_BASE: Array<{ value: PresentationUnit; hotkey: string }> = [
  { value: "grid", hotkey: "g" },
  { value: "list", hotkey: "l" },
];

function capitalizeLabel(value: string, locale = globalThis.navigator?.language ?? "en"): string {
  return value.replace(/^\p{L}/u, (character) => character.toLocaleUpperCase(locale));
}

function getUnitLabel(unit: ViewUnit, locale = globalThis.navigator?.language ?? "en"): string {
  try {
    const displayNames = new Intl.DisplayNames(locale, { type: "dateTimeField" });
    const label = displayNames.of(unit) ?? unit;
    return capitalizeLabel(label, locale);
  } catch {
    return capitalizeLabel(unit, locale);
  }
}

function getViewOptions(locale?: string): TabSwitchOption[] {
  return VIEW_OPTIONS_BASE.map(({ value, hotkey }) => ({
    label: getUnitLabel(value, locale),
    value,
    hotkey,
  }));
}

function getPresentationOptions(): TabSwitchOption[] {
  return PRESENTATION_OPTIONS_BASE.map(({ value }) => ({
    label:
      value === "list"
        ? renderListIcon({ className: "h-4 w-4" })
        : renderGridIcon({ className: "h-4 w-4" }),
    ariaLabel: value === "list" ? "List" : "Grid",
    value,
  }));
}

function getTodayLabel(locale = globalThis.navigator?.language ?? "en"): string {
  try {
    const relativeTimeFormat = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    return capitalizeLabel(relativeTimeFormat.format(0, "day"), locale);
  } catch {
    return "Today";
  }
}

@customElement("event-calendar")
export class EventCalendar extends BaseElement {
  #view: CalendarViewMode = "month";
  #presentation: CalendarPresentationMode = "grid";
  #startDate?: string;
  #daysPerWeek = 7;
  #visibleDays?: number;
  #rangeLabelText = "";
  #rangeLabelParts: Array<{ text: string; isYear: boolean }> = [];
  weekStart?: WeekdayNumber;
  declare events?: EventsMap;
  locale?: string;
  timezone?: string;
  currentTime?: string;
  snapInterval = 15;
  visibleHours = 12;
  rtl = false;
  defaultEventSummary = "New event";
  defaultEventColor = "#0ea5e9";
  defaultCalendarId?: string;

  static get properties() {
    return {
      view: {
        type: String,
        reflect: true,
        dispatchChangeEvent: { composed: true },
      },
      presentation: {
        type: String,
        reflect: true,
        dispatchChangeEvent: { composed: true },
      },
      startDate: {
        type: String,
        attribute: "start-date",
        dispatchChangeEvent: { composed: true },
      },
      weekStart: { type: Number, attribute: "week-start", reflect: true },
      daysPerWeek: {
        type: Number,
        attribute: "days-per-week",
      },
      visibleDays: {
        type: Number,
        attribute: "visible-days",
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
      defaultEventSummary: { type: String, attribute: "default-event-summary" },
      defaultEventColor: { type: String, attribute: "default-event-color" },
      defaultCalendarId: { type: String, attribute: "default-source-id" },
    } as const;
  }

  get view(): CalendarViewMode {
    return this.#view;
  }

  set view(value: CalendarViewMode | string | null | undefined) {
    if (value === "agenda") {
      this.presentation = "list";
      this.requestUpdate();
      return;
    }
    const nextValue =
      value === "day" || value === "week" || value === "month" || value === "year" ? value : "month";
    if (this.#view === nextValue) return;
    this.#view = nextValue;
    this.requestUpdate();
  }

  get presentation(): CalendarPresentationMode {
    return this.#presentation;
  }

  set presentation(value: CalendarPresentationMode | string | null | undefined) {
    const nextValue: CalendarPresentationMode = value === "list" ? "list" : "grid";
    if (this.#presentation === nextValue) return;
    this.#presentation = nextValue;
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

  get visibleDays(): number | undefined {
    return this.#visibleDays;
  }

  set visibleDays(value: number | string | null | undefined) {
    const rawValue = typeof value === "string" ? Number(value) : value;
    if (value === null || value === undefined || value === "") {
      if (this.#visibleDays === undefined) return;
      this.#visibleDays = undefined;
      this.requestUpdate();
      return;
    }
    const numeric = Number(rawValue);
    const nextValue = Number.isFinite(numeric)
      ? Math.max(1, Math.min(7, Math.floor(numeric)))
      : undefined;
    if (this.#visibleDays === nextValue) return;
    this.#visibleDays = nextValue;
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
    return html`
      <div class="flex h-full min-h-0 flex-col gap-7 [container-type:inline-size] [@media(max-width:54rem)]:gap-4">
        <header
          class="flex items-center justify-between gap-x-3 rounded-md border border-[light-dark(rgb(15_23_42_/_14%),rgb(255_255_255_/_16%))]"
        >
          <div
            class="flex shrink-0 gap-2 [@container(max-width:54rem)]:fixed [@container(max-width:54rem)]:bottom-4 [@container(max-width:54rem)]:right-4 [@container(max-width:54rem)]:z-50 [@container(max-width:54rem)]:[--_lc-button-bg:light-dark(rgb(255_255_255),rgb(255_255_255_/_34%))] [@container(max-width:54rem)]:[--_lc-button-hover-bg:light-dark(rgb(241_245_249),rgb(255_255_255_/_26%))]"
          >
            <lc-button
              compact
              label="Previous range"
              hotkey="special+left"
              @click=${() => this.goBack()}
              raised
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                aria-hidden="true"
                class="block h-[1.1rem] w-[1.1rem]"
              >
                <path d="M15 6l-6 6 6 6" stroke-linecap="round" stroke-linejoin="round"></path>
              </svg>
            </lc-button>
            <lc-button hotkey="t" @click=${() => this.goToday()} raised>
              ${getTodayLabel(this.locale)}
            </lc-button>
            <lc-button
              compact
              label="Next range"
              hotkey="special+right"
              @click=${() => this.goForward()}
              raised
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                aria-hidden="true"
                class="block h-[1.1rem] w-[1.1rem]"
              >
                <path d="M9 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"></path>
              </svg>
            </lc-button>
          </div>
          <h2
            class="m-0 px-2 truncate text-center text-xl font-bold text-[light-dark(rgb(15_23_42_/_95%),rgb(255_255_255_/_98%))] [@container(max-width:54rem)]:text-left [@container(max-width:54rem)]:text-base"
            aria-live="polite"
          >
            ${this.#rangeLabelParts.length
              ? this.#rangeLabelParts.map((part) =>
                  part.isYear ? html`<span class="font-normal">${part.text}</span>` : part.text
                )
              : this.#rangeLabelText}
          </h2>
          <div class="flex flex-1 justify-end items-center gap-2">
            <tab-switch
              compact
              .showHotkeys=${false}
              .options=${getPresentationOptions()}
              .value=${this.presentation}
              name="event-calendar-presentation-tabs"
              group-label="Calendar layout"
              @value-changed=${this.#handlePresentationChanged}
            ></tab-switch>
            <div class="[@container(max-width:54rem)]:hidden">
              <tab-switch
                .options=${getViewOptions(this.locale)}
                .value=${this.view}
                name="event-calendar-view-tabs"
                group-label="Calendar view"
                @value-changed=${this.#handleViewTabChanged}
              ></tab-switch>
            </div>
            <div class="hidden [@container(max-width:54rem)]:block">

            <lc-dropdown
                .options=${getViewOptions(this.locale)}
                .value=${this.view}
                name="event-calendar-view-dropdown"
                aria-label="Calendar view"
                icon-only
                @value-changed=${this.#handleViewTabChanged}
              >
                ${renderCalendarIcon({ slot: "icon", className: "h-4 w-4" })}
              </lc-dropdown>
            </div>
          </div>
        </header>
        <calendar-view-group
          class="min-h-0 flex-[1_1_auto]"
          .view=${this.view}
          .presentation=${this.presentation}
          start-date=${ifDefined(this.#startDate)}
          .weekStart=${this.weekStart}
          .daysPerWeek=${this.daysPerWeek}
          .visibleDays=${this.visibleDays}
          .events=${this.events}
          .locale=${this.locale}
          .timezone=${this.timezone}
          .currentTime=${this.currentTime}
          .snapInterval=${this.snapInterval}
          .visibleHours=${this.visibleHours}
          .rtl=${this.rtl}
          .defaultEventSummary=${this.defaultEventSummary}
          .defaultEventColor=${this.defaultEventColor}
          .defaultCalendarId=${this.defaultCalendarId}
          @view-changed=${this.#syncFromViewGroup}
          @start-date-changed=${this.#syncFromViewGroup}
          @day-selection-requested=${this.#syncFromViewGroup}
          @event-create-requested=${this.#reemit}
          @event-update-requested=${this.#reemit}
          @event-delete-requested=${this.#reemit}
        ></calendar-view-group>
      </div>
    `;
  }

  #handleViewTabChanged = (event: Event) => {
    const target = event.currentTarget as { value?: string } | null;
    const nextView = target?.value as CalendarViewMode | undefined;
    if (!nextView || nextView === this.view) return;

    this.view = nextView;
    const viewGroup = this.#calendarViewGroup;
    if (!viewGroup) return;
    viewGroup.view = nextView;
    this.#syncFromViewGroupElement(viewGroup);
  };

  #handlePresentationChanged = (event: Event) => {
    const target = event.currentTarget as { value?: string } | null;
    const nextPresentation = target?.value as CalendarPresentationMode | undefined;
    if (!nextPresentation || nextPresentation === this.presentation) return;
    this.presentation = nextPresentation;
    const viewGroup = this.#calendarViewGroup;
    if (!viewGroup) return;
    viewGroup.presentation = nextPresentation;
    this.#syncFromViewGroupElement(viewGroup);
  };

  #syncFromViewGroup = (event: Event) => {
    const target = event.target as CalendarViewGroup | null;
    if (!target) return;
    this.#syncFromViewGroupElement(target);
  };

  #syncFromViewGroupElement(target: CalendarViewGroup) {
    this.view = target.view;
    this.presentation = target.presentation;
    this.startDate = target.startDate;
    this.currentTime = target.currentTime;
    this.daysPerWeek = target.daysPerWeek;
    this.#rangeLabelText = target.rangeLabel;
    this.#rangeLabelParts = target.rangeLabelParts;
  }

  #reemit = (event: Event) => {
    event.stopPropagation();
    const forwardedEvent = new CustomEvent(event.type, {
      detail: (event as CustomEvent).detail,
      composed: true,
      cancelable: event.cancelable,
    });
    const notCancelled = this.dispatchEvent(forwardedEvent);
    if (!notCancelled && event.cancelable) {
      event.preventDefault();
    }
  };

  override updated(changedProperties: Map<PropertyKey, unknown>): void {
    super.updated(changedProperties);
    const viewGroup = this.#calendarViewGroup;
    if (!viewGroup) return;
    const nextRangeLabel = viewGroup.rangeLabel;
    if (nextRangeLabel !== this.#rangeLabelText) {
      this.#rangeLabelText = nextRangeLabel;
      this.#rangeLabelParts = viewGroup.rangeLabelParts;
      this.requestUpdate();
    }
  }
}
