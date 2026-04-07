import { Temporal } from "@js-temporal/polyfill";
import { html, unsafeCSS } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ifDefined } from "lit/directives/if-defined.js";
import { styleMap } from "lit/directives/style-map.js";
import "../CalendarView/CalendarView.js";
import "../CalendarWeekdayHeader/CalendarWeekdayHeader.js";
import "../CalendarTimeSidebar/CalendarTimeSidebar.js";
import { CalendarViewBase, isWeekdayNumber } from "../CalendarViewBase/CalendarViewBase.js";
import type { AllDayLayoutItem } from "../types/AllDayLayout.js";
import type { CalendarEventView as EventInput } from "../types/CalendarEvent.js";
import { buildAllDayLayout } from "../utils/AllDayLayout.js";
import { clampDaysPerWeek, daysPerWeekFromInput } from "../utils/DaysPerWeek.js";
import { getLocaleDirection } from "../utils/Locale.js";
import componentStyle from "./CalendarWeekView.css?inline";
import "../SwipeContainer/SwipeContainer.js";

type EventEntry = [id: string, event: EventInput];
type EventsMap = Map<string, EventInput>;
type WeekdayNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;

@customElement("calendar-week-view")
export class CalendarWeekView extends CalendarViewBase {
  #startDate?: string;
  weekNumber = Temporal.Now.plainDateISO().weekOfYear;
  year = Temporal.Now.plainDateISO().year;
  weekStart?: number;
  #daysPerWeekStored = 7;
  snapInterval = 15;
  visibleHours?: number;
  rtl = false;
  #splitEventsSource?: EventsMap;
  #cachedAllDayEvents: EventsMap = new Map();
  #cachedTimedEvents: EventsMap = new Map();
  #activeInteractionLocks = new Set<string>();
  #currentDayIndex = 0;
  #resizeObserver: ResizeObserver | null = null;

  static get properties() {
    return {
      ...CalendarViewBase.properties,
      startDate: { type: String, attribute: "start-date" },
      weekNumber: { type: Number, attribute: "week-number" },
      year: { type: Number },
      weekStart: { type: Number, attribute: "week-start", reflect: true },
      snapInterval: { type: Number, attribute: "snap-interval" },
      visibleHours: { type: Number, attribute: "visible-hours" },
      rtl: { type: Boolean, reflect: true },
    } as const;
  }

  @property({ type: Number, attribute: "days-per-week", reflect: true })
  get daysPerWeek(): number {
    return clampDaysPerWeek(this.#daysPerWeekStored);
  }

  set daysPerWeek(value: number | string | null | undefined) {
    const next = daysPerWeekFromInput(value);
    if (Object.is(next, this.#daysPerWeekStored)) return;
    const previous = this.#daysPerWeekStored;
    this.#daysPerWeekStored = next;
    this.requestUpdate("daysPerWeek", previous);
  }

  static get styles() {
    return [...CalendarViewBase.styles, unsafeCSS(componentStyle)];
  }

  get startDate(): Temporal.PlainDate {
    if (this.#startDate) {
      return Temporal.PlainDate.from(this.#startDate);
    }

    const firstOfYear = Temporal.PlainDate.from({
      year: this.year,
      month: 1,
      day: 1,
    });
    const weekStart = this.#resolvedWeekStart;
    const firstWeekStart = this.#startOfWeekFor(firstOfYear, weekStart);
    const normalizedWeek = Math.max(1, Number(this.weekNumber) || 1);
    return firstWeekStart.add({ days: (normalizedWeek - 1) * 7 });
  }

  set startDate(value: string | undefined) {
    this.#startDate = value || undefined;
  }

  get currentDayIndex(): number {
    if (this.daysPerWeek === 1) return 0;
    return this.#currentDayIndex;
  }

  set currentDayIndex(value: number) {
    const normalized = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
    if (this.#currentDayIndex === normalized) return;
    this.#currentDayIndex = normalized;
    this.requestUpdate();
  }

  get #resolvedWeekStart(): WeekdayNumber {
    return this.resolveWeekStart(this.weekStart, this.lang);
  }

  get #allDayEvents(): EventsMap {
    this.#syncSplitEventsCache();
    return this.#cachedAllDayEvents;
  }

  get #timedEvents(): EventsMap {
    this.#syncSplitEventsCache();
    return this.#cachedTimedEvents;
  }

  get #viewDays(): Temporal.PlainDate[] {
    return Array.from({ length: this.daysPerWeek }, (_, dayOffset) =>
      this.#gridStartDate.add({ days: dayOffset })
    );
  }

  get #gridStartDate(): Temporal.PlainDate {
    if (this.daysPerWeek === 7) {
      return this.#startOfWeekFor(this.startDate, this.#resolvedWeekStart);
    }
    return this.startDate;
  }

  get #allDayVisibleRowCount(): number {
    const viewDays = this.#viewDays;
    const layout = buildAllDayLayout({
      viewDays,
      daysPerRow: viewDays.length,
      items: this.#allDayLayoutItems,
    });
    return Math.max(1, layout.maxEventsOnAnyDay);
  }

  get #allDayLayoutItems(): AllDayLayoutItem[] {
    return this.#eventEntries
      .filter(([, event]) => this.#isAllDayEvent(event))
      .map(([id, event]) => ({
        id,
        start: this.#toPlainDateTime(event.start).toPlainDate(),
        endInclusive: this.#toPlainDateTime(event.end).subtract({ nanoseconds: 1 }).toPlainDate(),
      }));
  }

  get #eventEntries(): EventEntry[] {
    return Array.from(this.events?.entries() ?? []);
  }

  #isAllDayEvent(event: EventInput): boolean {
    return this.#isDateOnlyValue(event.start) || this.#isDateOnlyValue(event.end);
  }

  #isTimedEvent(event: EventInput): boolean {
    if (this.#isAllDayEvent(event)) return false;
    return (
      event.start instanceof Temporal.PlainDateTime ||
      event.start instanceof Temporal.ZonedDateTime ||
      event.end instanceof Temporal.PlainDateTime ||
      event.end instanceof Temporal.ZonedDateTime
    );
  }

  #isDateOnlyValue(value: EventInput["start"]): boolean {
    return value instanceof Temporal.PlainDate;
  }

  #toPlainDateTime(value: EventInput["start"]): Temporal.PlainDateTime {
    if (value instanceof Temporal.ZonedDateTime) {
      return this.timezone
        ? value.withTimeZone(this.timezone).toPlainDateTime()
        : value.toPlainDateTime();
    }
    if (value instanceof Temporal.PlainDateTime) {
      return value;
    }
    if (value instanceof Temporal.PlainDate) {
      return value.toPlainDateTime({ hour: 0, minute: 0, second: 0 });
    }
    const exhaustiveCheck: never = value;
    throw new TypeError(`Unsupported calendar event date value: ${String(exhaustiveCheck)}`);
  }

  #startOfWeekFor(date: Temporal.PlainDate, weekStart: WeekdayNumber): Temporal.PlainDate {
    const weekdayOffset = (date.dayOfWeek - weekStart + 7) % 7;
    return date.subtract({ days: weekdayOffset });
  }

  #syncSplitEventsCache() {
    if (this.events === this.#splitEventsSource) return;
    this.#splitEventsSource = this.events;
    const sourceEntries = Array.from(this.events?.entries() ?? []);
    this.#cachedAllDayEvents = new Map(
      sourceEntries.filter(([, event]) => this.#isAllDayEvent(event))
    );
    this.#cachedTimedEvents = new Map(
      sourceEntries.filter(([, event]) => this.#isTimedEvent(event))
    );
  }

  connectedCallback() {
    super.connectedCallback();
    this.#startResizeObserver();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = null;
    // Drag/resize interactions can leave transient locks active if the view unmounts mid-gesture.
    // Reset so swipe is always re-enabled when returning to this view.
    this.#activeInteractionLocks.clear();
  }

  override willUpdate(changedProperties: Map<PropertyKey, unknown>) {
    super.willUpdate(changedProperties);
    if (
      this.daysPerWeek > 1 &&
      (changedProperties.has("startDate") ||
        changedProperties.has("weekStart") ||
        changedProperties.has("daysPerWeek"))
    ) {
      const dayOffset = this.#gridStartDate.until(this.startDate, { largestUnit: "day" }).days;
      const maxIndex = Math.max(0, this.daysPerWeek - 1);
      this.#currentDayIndex = Math.max(0, Math.min(maxIndex, Math.floor(dayOffset)));
    }
  }

  render() {
    const hasVisibleHours = Number.isFinite(this.visibleHours);
    const clampedVisibleHours = hasVisibleHours
      ? Math.max(1, Math.min(24, Math.floor(Number(this.visibleHours))))
      : undefined;
    const weekdayHeaderHeight = "calc(var(--_lc-weekday-header-height, 26px) + 4px)";
    const eventHeight = "var(--lc-event-height, var(--_lc-default-event-height, 32px))";
    const allDayHeight = `calc(var(--_lc-all-day-day-number-space, 36px) + ${this.#allDayVisibleRowCount} * ${eventHeight})`;
    const timedHeight = "var(--_lc-week-effective-timed-height)";
    const hourCellHeight = clampedVisibleHours
      ? `calc(var(--_lc-week-effective-timed-height) / ${clampedVisibleHours})`
      : "max(var(--_lc-week-min-hour-cell-height, 72px), calc(var(--_lc-week-effective-timed-height) / 24))";
    const timedContentHeight = clampedVisibleHours
      ? "var(--_lc-week-effective-timed-height)"
      : `calc(24 * ${hourCellHeight})`;
    const timedRenderedContentHeight = clampedVisibleHours
      ? `calc(var(--_lc-week-effective-timed-height) * ${24 / clampedVisibleHours})`
      : timedContentHeight;
    const direction = this.rtl ? "rtl" : getLocaleDirection(this.lang);
    const dayModeWeekStart = isWeekdayNumber(this.startDate.dayOfWeek)
      ? this.startDate.dayOfWeek
      : this.weekStart;
    const headerWeekStart = this.daysPerWeek === 1 ? dayModeWeekStart : this.weekStart;

    return html`
      <div
        class="week-layout"
        ?data-rtl=${direction === "rtl"}
        style=${styleMap({
          "--_lc-combined-days": String(this.daysPerWeek),
          "--_lc-week-weekday-header-height": weekdayHeaderHeight,
          "--_lc-week-all-day-height": allDayHeight,
          "--_lc-week-all-day-shell-height": `calc(${weekdayHeaderHeight} + ${allDayHeight})`,
          "--_lc-week-effective-timed-height":
            "max(0px, calc(var(--_lc-week-view-height, 100%) - var(--_lc-week-all-day-shell-height)))",
          "--_lc-week-timed-height": timedHeight,
          "--_lc-week-timed-content-height": timedContentHeight,
          "--_lc-week-timed-rendered-height": timedRenderedContentHeight,
          "--_lc-week-hour-cell-height": hourCellHeight,
          "--_lc-week-total-height":
            "calc(var(--_lc-week-all-day-shell-height) + var(--_lc-week-sections-gap, 8px) + var(--_lc-week-timed-rendered-height))",
        })}
      >
        <calendar-time-sidebar
          class="week-time-sidebar"
          .lang=${this.lang}
          .hours=${24}
        ></calendar-time-sidebar>

        <swipe-container
          class="week-swipe"
          .currentIndex=${this.currentDayIndex}
          scroll-snap-stop="normal"
          .disabled=${this.#activeInteractionLocks.size > 0 || this.daysPerWeek === 1}
          @change=${this.#handleSwipeIndexChange}
          dir=${direction}
        >
          <div class="week-stack">
          <div class="week-all-day-shell">
            <calendar-weekday-header
              class="week-weekday-header"
              .lang=${this.lang}
              .weekStart=${headerWeekStart}
              .daysPerWeek=${this.daysPerWeek}
            ></calendar-weekday-header>
            <calendar-view
              class="week-all-day-view"
              .startDate=${this.#gridStartDate}
              days-per-week=${String(this.daysPerWeek)}
              variant="all-day"
              .events=${this.#allDayEvents}
              .rtl=${this.rtl}
              lang=${ifDefined(this.lang)}
              timezone=${ifDefined(this.timezone)}
              current-time=${ifDefined(this.currentTime)}
              .snapInterval=${this.snapInterval}
              .labelsHidden=${false}
              style=${styleMap({
                "--_lc-section-bg":
                  "var(--lg-background-color, var(--_lc-surface-bg, light-dark(#fff, #222)))",
              })}
              @event-create-requested=${this.forwardCalendarEvent}
              @event-selection-requested=${this.forwardCalendarEvent}
              @event-update-requested=${this.forwardCalendarEvent}
              @event-delete-requested=${this.forwardCalendarEvent}
              @day-selection-requested=${this.forwardCalendarEvent}
              @interaction-lock-change=${this.#handleInteractionLockChange}
            >
            </calendar-view>
          </div>

          <calendar-view
            class="week-timed-view"
            .startDate=${this.#gridStartDate}
            days-per-week=${String(this.daysPerWeek)}
            variant="timed"
            .events=${this.#timedEvents}
            .visibleHours=${clampedVisibleHours ?? 24}
            .rtl=${this.rtl}
            lang=${ifDefined(this.lang)}
            timezone=${ifDefined(this.timezone)}
            current-time=${ifDefined(this.currentTime)}
            .snapInterval=${this.snapInterval}
            @event-create-requested=${this.forwardCalendarEvent}
            @event-selection-requested=${this.forwardCalendarEvent}
            @event-update-requested=${this.forwardCalendarEvent}
            @event-delete-requested=${this.forwardCalendarEvent}
            @day-selection-requested=${this.forwardCalendarEvent}
            @interaction-lock-change=${this.#handleInteractionLockChange}
          >
          </calendar-view>
        </div>
        </swipe-container>
      </div>
    `;
  }

  #handleInteractionLockChange = (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const detail = event.detail as
      | { active?: boolean; kind?: string; interactionId?: string }
      | undefined;
    if (!detail?.kind || !detail.interactionId) return;

    const source = event.currentTarget as Element | null;
    const sourceLabel = source?.classList.contains("week-all-day-view")
      ? "all-day"
      : source?.classList.contains("week-timed-view")
        ? "timed"
        : "unknown";
    const lockKey = `${sourceLabel}:${detail.kind}:${detail.interactionId}`;

    if (detail.active) {
      this.#activeInteractionLocks.add(lockKey);
    } else {
      this.#activeInteractionLocks.delete(lockKey);
    }
    this.requestUpdate();
  };

  #handleSwipeIndexChange = (event: Event) => {
    if (this.daysPerWeek === 1) return;
    const target = event.currentTarget as { currentIndex?: number } | null;
    this.currentDayIndex = target?.currentIndex ?? 0;
    const activeDate = this.#gridStartDate.add({ days: this.currentDayIndex }).toString();
    this.dispatchEvent(
      new CustomEvent("active-date-changed", {
        detail: { date: activeDate, dayIndex: this.currentDayIndex },
      })
    );
  };

  override updated(changedProperties: Map<PropertyKey, unknown>) {
    super.updated(changedProperties);
    this.#syncWeekViewHeight();
  }

  #startResizeObserver() {
    if (typeof ResizeObserver === "undefined" || this.#resizeObserver) return;
    this.#resizeObserver = new ResizeObserver(() => this.#syncWeekViewHeight());
    this.#resizeObserver.observe(this);
  }

  #syncWeekViewHeight() {
    const weekLayout = this.renderRoot.querySelector(".week-layout") as HTMLElement | null;
    if (!weekLayout) return;
    const hostHeightPx = this.getBoundingClientRect().height;
    if (Number.isFinite(hostHeightPx) && hostHeightPx > 0) {
      weekLayout.style.setProperty("--_lc-week-view-height", `${hostHeightPx}px`);
    }
  }
}
