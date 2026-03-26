import { Temporal } from "@js-temporal/polyfill";
import { ContextProvider } from "@lit/context";
import { html, type PropertyValues, type TemplateResult, unsafeCSS } from "lit";
import { customElement } from "lit/decorators.js";
import { ifDefined } from "lit/directives/if-defined.js";
import { keyed } from "lit/directives/keyed.js";
import { styleMap } from "lit/directives/style-map.js";
import "../TimedEvent/TimedEvent.js";
import { BaseElement } from "../BaseElement/BaseElement.js";
import componentStyle from "./CalendarView.css?inline";
import "../TimedEvent/AllDayEvent.js";
import {
  type CalendarViewContextValue,
  calendarViewContext,
} from "../context/CalendarViewContext.js";
import { TimedEventInteractionController } from "../controllers/TimedEventInteractionController.js";
import { sharedFocusRingColorClasses } from "../shared/buttonStyles.js";
import type { BaseEvent } from "../TimedEvent/BaseEvent.js";
import {
  type AllDayLayoutItem,
  buildAllDayLayout,
  computeHiddenAllDayCountsByDay,
} from "../utils/AllDayLayout.js";
import { getLocaleDirection, getLocaleWeekInfo, resolveLocale } from "../utils/Locale.js";
import { getHourlyTimeLabels } from "../utils/TimeFormatting.js";

type EventInput = {
  /**
   * iCalendar UID. Repeated occurrences should share this value.
   */
  uid?: string;
  /**
   * iCalendar RECURRENCE-ID for one occurrence in a recurring series.
   */
  recurrenceId?: string;
  start: string | Temporal.PlainDate | Temporal.PlainDateTime | Temporal.ZonedDateTime;
  end: string | Temporal.PlainDate | Temporal.PlainDateTime | Temporal.ZonedDateTime;
  summary: string;
  color: string;
};

type EventEntry = [id: string, event: EventInput];
type EventsMap = Map<string, EventInput>;
const COMPACT_MONTH_MAX_INLINE_SIZE_PX = 520;

@customElement("calendar-view")
export class CalendarView extends BaseElement {
  #startDate?: string;
  #currentTime?: string;
  #timezone?: string;
  #locale?: string;
  #days!: number;
  #hours: number = 24;
  #visibleHours = 24;
  #snapInterval: number = TimedEventInteractionController.snapInterval;
  declare events?: EventsMap;
  variant: "timed" | "all-day" = "timed";
  labelsHidden = false;
  rtl = false;
  #dragHoverDayIndex: number | null = null;
  #dragHoverTime: Temporal.PlainTime | null = null;
  #calendarViewProvider = new ContextProvider(this, { context: calendarViewContext });
  #styleObserver?: MutationObserver;
  #lastDaysPerRowToken = "";
  #optimisticallyDeletingEventIds = new Set<string>();
  #sectionHeightPx = 0;
  #resizeObserver?: ResizeObserver;
  #resizeSyncRafId: number | null = null;
  #resizeDebounceTimerId: number | null = null;
  #resizeDebounceDelayMs = 17;
  #lastObservedHostHeightPx = 0;
  #lastObservedHostWidthPx = 0;
  #isCompactMonth = false;
  #cachedDaysKey = "";
  #cachedDays: Temporal.PlainDate[] = [];
  #cachedEventEntriesSource?: EventsMap;
  #cachedEventEntries: EventEntry[] = [];

  get #sortedEvents(): EventEntry[] {
    const events = this.#eventsForVariant;
    return events.sort((a, b) => this.#compareEventsForRenderOrder(a, b));
  }

  get #eventsForVariant(): EventEntry[] {
    const events = this.#viewportEvents;
    if (this.variant === "all-day") {
      return events;
    }

    return events.filter(([, event]) => !this.#isAllDayEvent(event));
  }

  /**
   * Single source of truth for events that can appear in this rendered view range.
   * Includes events that started before the visible range but still overlap it.
   */
  get #viewportEvents(): EventEntry[] {
    const viewport = this.#renderedViewportRange;
    if (!viewport) return [];
    return this.#eventsAsEntries.filter(([, event]) =>
      this.#eventOverlapsViewport(event, viewport)
    );
  }

  get #renderedViewportRange(): {
    start: Temporal.PlainDateTime;
    endExclusive: Temporal.PlainDateTime;
  } | null {
    const renderedDays = this.days;
    if (!renderedDays.length) return null;

    const start = renderedDays[0].toPlainDateTime({
      hour: 0,
      minute: 0,
      second: 0,
      millisecond: 0,
      microsecond: 0,
      nanosecond: 0,
    });
    const lastRenderedDay = renderedDays[renderedDays.length - 1];
    const endExclusive = lastRenderedDay.add({ days: 1 }).toPlainDateTime({
      hour: 0,
      minute: 0,
      second: 0,
      millisecond: 0,
      microsecond: 0,
      nanosecond: 0,
    });
    return { start, endExclusive };
  }

  #eventOverlapsViewport(
    event: EventInput,
    viewport: { start: Temporal.PlainDateTime; endExclusive: Temporal.PlainDateTime }
  ): boolean {
    const eventStart = this.#toPlainDateTime(event.start);
    const eventEnd = this.#toPlainDateTime(event.end);

    if (Temporal.PlainDateTime.compare(eventEnd, eventStart) <= 0) return false;
    return (
      Temporal.PlainDateTime.compare(eventStart, viewport.endExclusive) < 0 &&
      Temporal.PlainDateTime.compare(eventEnd, viewport.start) > 0
    );
  }

  static get properties() {
    return {
      startDate: { type: String, attribute: "start-date" },
      days: { type: Number },
      events: {
        type: Object,
        converter: {
          fromAttribute: (value: string | null): EventsMap =>
            new Map(JSON.parse(value || "[]") as EventEntry[]),
        },
      },
      variant: {
        type: String,
        attribute: "variant",
        reflect: true,
        converter: {
          fromAttribute: (v: string | null): "timed" | "all-day" =>
            v === "all-day" ? "all-day" : "timed",
          toAttribute: (v: string): string => v,
        },
      },
      labelsHidden: { type: Boolean, attribute: "labels-hidden", reflect: true },
      rtl: { type: Boolean, reflect: true },
      locale: { type: String },
      timezone: { type: String },
      snapInterval: { type: Number, attribute: "snap-interval" },
      visibleHours: { type: Number, attribute: "visible-hours" },
      currentTime: {
        attribute: "current-time",
        converter: {
          fromAttribute: (v: string | null): string | undefined => v ?? undefined,
          toAttribute: (
            v: Temporal.PlainDateTime | Temporal.ZonedDateTime | string | null | undefined
          ): string | null => (v ? v.toString() : null),
        },
      },
    } as const;
  }

  static get observers() {
    const observers = new Map();
    observers.set("_handleEventsChange", ["events"]);
    return observers;
  }

  _handleEventsChange() {
    console.info("events changed");
  }

  static get styles() {
    return [...BaseElement.styles, unsafeCSS(componentStyle)];
  }

  connectedCallback() {
    super.connectedCallback();
    this.#updateCalendarViewContext();
    this.#startStyleObserver();
    this.#startResizeObserver();
    this.addEventListener("interaction-drag-hover", this.#handleDragHover as EventListener);
  }

  disconnectedCallback() {
    this.#stopStyleObserver();
    this.#stopResizeObserver();
    this.#cancelScheduledResizeSync();
    this.removeEventListener("interaction-drag-hover", this.#handleDragHover as EventListener);
    super.disconnectedCallback();
  }

  updated(changedProperties: PropertyValues<this>) {
    super.updated(changedProperties);
    if (
      changedProperties.has("locale") ||
      changedProperties.has("timezone") ||
      changedProperties.has("currentTime")
    ) {
      this.#updateCalendarViewContext();
    }
    this.#scheduleSectionHeightSync();
  }

  get startDate(): Temporal.PlainDate {
    return this.#startDate ? Temporal.PlainDate.from(this.#startDate) : Temporal.Now.plainDateISO();
  }

  set startDate(startDate: string) {
    this.#startDate = startDate;
  }

  get currentTime(): Temporal.PlainDateTime {
    if (!this.#currentTime) {
      return Temporal.Now.zonedDateTimeISO(this.timezone).toPlainDateTime();
    }
    return this.#toPlainDateTime(this.#currentTime);
  }

  set currentTime(currentTime:
    | Temporal.PlainDateTime
    | Temporal.ZonedDateTime
    | string
    | undefined) {
    this.#currentTime = currentTime?.toString();
  }

  get timezone(): string {
    return this.#timezone ?? Temporal.Now.timeZoneId();
  }

  set timezone(timezone: string | undefined) {
    this.#timezone = timezone || undefined;
  }

  get locale(): string {
    return resolveLocale(this.#locale);
  }

  set locale(locale: string | undefined) {
    this.#locale = locale || undefined;
  }

  get days(): Temporal.PlainDate[] {
    const startDate = this.startDate;
    const cacheKey = `${startDate.toString()}|${this.#days}`;
    if (cacheKey === this.#cachedDaysKey) {
      return this.#cachedDays;
    }

    const values: Temporal.PlainDate[] = [];
    for (let i = 0; i < this.#days; i++) {
      values.push(startDate.add({ days: i }));
    }
    this.#cachedDaysKey = cacheKey;
    this.#cachedDays = values;
    return values;
  }

  get hours(): number {
    if (this.variant === "all-day") return 0;
    return this.#hours;
  }

  set days(value: number) {
    this.#days = value;
  }

  get snapInterval(): number {
    return this.#snapInterval;
  }

  get visibleHours(): number {
    return this.#visibleHours;
  }

  set visibleHours(value: number) {
    const n = Number(value);
    if (!Number.isFinite(n)) {
      this.#visibleHours = 24;
      return;
    }
    this.#visibleHours = Math.max(1, Math.min(24, Math.floor(n)));
  }

  set snapInterval(value: number) {
    this.#snapInterval = value;
    TimedEventInteractionController.snapInterval = value;
  }

  /** Reads --lc-days-per-row from CSS (default 7). Multi-row grid when all-day and days > daysPerRow. */
  get daysPerRow(): number {
    const computedStyle =
      typeof getComputedStyle !== "undefined" ? getComputedStyle(this) : undefined;
    const v = computedStyle?.getPropertyValue("--lc-days-per-row").trim() || "";
    return v ? parseInt(v, 10) || 7 : 7;
  }

  #readDaysPerRowToken(): string {
    if (typeof getComputedStyle === "undefined") return "";
    return getComputedStyle(this).getPropertyValue("--lc-days-per-row").trim();
  }

  #startStyleObserver() {
    if (typeof MutationObserver === "undefined") return;
    this.#lastDaysPerRowToken = this.#readDaysPerRowToken();

    this.#styleObserver = new MutationObserver(() => {
      const nextToken = this.#readDaysPerRowToken();
      if (nextToken === this.#lastDaysPerRowToken) return;
      this.#lastDaysPerRowToken = nextToken;
      this.requestUpdate();
    });

    // Watch host style changes and Storybook addon updates on document/body.
    this.#styleObserver.observe(this, { attributes: true, attributeFilter: ["style", "class"] });
    this.#styleObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style", "class"],
    });
    if (document.body) {
      this.#styleObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ["style", "class"],
      });
    }
  }

  #stopStyleObserver() {
    this.#styleObserver?.disconnect();
    this.#styleObserver = undefined;
  }

  #startResizeObserver() {
    if (typeof ResizeObserver === "undefined") return;
    if (this.#resizeObserver) return;
    this.#resizeObserver = new ResizeObserver((entries) => {
      if (this.variant !== "all-day") return;
      const nextWidth = entries[0]?.contentRect.width;
      if (
        Number.isFinite(nextWidth) &&
        Math.abs(nextWidth - this.#lastObservedHostWidthPx) >= 0.5
      ) {
        this.#lastObservedHostWidthPx = nextWidth;
      }
      const nextHeight = entries[0]?.contentRect.height;
      if (
        Number.isFinite(nextHeight) &&
        Math.abs(nextHeight - this.#lastObservedHostHeightPx) >= 0.5
      ) {
        this.#lastObservedHostHeightPx = nextHeight;
      }
      this.#scheduleDebouncedResizeSync();
    });
    this.#resizeObserver.observe(this);
    this.#scheduleSectionHeightSync();
  }

  #stopResizeObserver() {
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = undefined;
    this.#lastObservedHostHeightPx = 0;
    this.#lastObservedHostWidthPx = 0;
    this.#isCompactMonth = false;
  }

  #scheduleDebouncedResizeSync() {
    if (typeof window === "undefined") return;
    if (this.#resizeDebounceTimerId !== null) {
      window.clearTimeout(this.#resizeDebounceTimerId);
    }
    this.#resizeDebounceTimerId = window.setTimeout(() => {
      this.#resizeDebounceTimerId = null;
      this.#syncCompactMonthState(this.#lastObservedHostWidthPx);
      this.#scheduleSectionHeightSync();
    }, this.#resizeDebounceDelayMs);
  }

  #cancelDebouncedResizeSync() {
    if (typeof window === "undefined") return;
    if (this.#resizeDebounceTimerId === null) return;
    window.clearTimeout(this.#resizeDebounceTimerId);
    this.#resizeDebounceTimerId = null;
  }

  #scheduleSectionHeightSync() {
    if (this.variant !== "all-day") return;
    if (this.#resizeSyncRafId !== null || typeof requestAnimationFrame === "undefined") return;
    this.#resizeSyncRafId = requestAnimationFrame(() => {
      this.#resizeSyncRafId = null;
      this.#syncSectionHeight();
    });
  }

  #cancelScheduledResizeSync() {
    this.#cancelDebouncedResizeSync();
    if (this.#resizeSyncRafId === null || typeof cancelAnimationFrame === "undefined") return;
    cancelAnimationFrame(this.#resizeSyncRafId);
    this.#resizeSyncRafId = null;
  }

  #syncSectionHeight() {
    if (this.variant !== "all-day") return;
    if (!this.isConnected) return;
    const section = this.renderRoot.querySelector("section");
    if (!section) return;
    const nextHeight = section.getBoundingClientRect().height;
    if (!Number.isFinite(nextHeight)) return;
    if (Math.abs(nextHeight - this.#sectionHeightPx) < 0.5) return;
    this.#sectionHeightPx = nextHeight;
    if (!this.isUpdatePending) this.requestUpdate();
  }

  /** True when all-day and we have more days than columns (multi-row grid). */
  get #isMonthView(): boolean {
    return Boolean(this.variant === "all-day" && this.#days > this.daysPerRow);
  }

  get #isCompactMonthView(): boolean {
    return this.#isMonthView && this.#isCompactMonth;
  }

  #syncCompactMonthState(observedWidth?: number) {
    if (!this.#isMonthView) {
      if (!this.#isCompactMonth) return;
      this.#isCompactMonth = false;
      this.requestUpdate();
      return;
    }

    const width =
      observedWidth ??
      (this.#lastObservedHostWidthPx ||
        this.getBoundingClientRect().width ||
        Number.POSITIVE_INFINITY);
    const shouldBeCompact = width <= COMPACT_MONTH_MAX_INLINE_SIZE_PX;
    if (shouldBeCompact === this.#isCompactMonth) return;
    this.#isCompactMonth = shouldBeCompact;
    this.requestUpdate();
  }

  get gridRows(): number {
    if (!this.#isMonthView) return 1;
    return Math.ceil(this.#days / this.daysPerRow) || 1;
  }

  get sectionStyle(): Record<string, string> {
    const base: Record<string, string> = {
      "--_lc-hours": this.hours.toString(),
    };
    if (this.#isMonthView) {
      base["--_lc-days"] = this.daysPerRow.toString();
      base["--_lc-grid-rows"] = this.gridRows.toString();
      base["--_lc-row-height"] = `calc(100% / ${this.gridRows})`;
    } else {
      base["--_lc-days"] = this.#days.toString();
    }
    return base;
  }

  get #weekendDays(): Set<number> {
    return new Set(getLocaleWeekInfo(this.locale).weekend);
  }

  get #isRtl(): boolean {
    return this.rtl || getLocaleDirection(this.locale) === "rtl";
  }

  #toVisualColumnIndex(columnIndex: number, columnCount: number): number {
    if (!this.#isRtl) return columnIndex;
    return columnCount - columnIndex - 1;
  }

  render() {
    const hoverStyle: Record<string, string> = {};
    const showTimedLabels = this.variant === "timed" && !this.labelsHidden;
    const timedSidebarLabels = getHourlyTimeLabels(this.locale, this.hours);
    const timedSidebarRows = timedSidebarLabels.map((label, hour) => {
      return html`
        <div class="hour-label-row">
          <time class="hour-label" datetime=${`${hour.toString().padStart(2, "0")}:00`}>${label}</time>
        </div>
      `;
    });
    const compactMonthView = this.#isCompactMonthView;

    if (this.#dragHoverDayIndex !== null) {
      if (this.variant === "all-day") {
        // Highlight the day cell
        if (this.#isMonthView) {
          // For month view, calculate row and column
          const row = Math.floor(this.#dragHoverDayIndex / this.daysPerRow);
          const col = this.#dragHoverDayIndex % this.daysPerRow;
          const visualCol = this.#toVisualColumnIndex(col, this.daysPerRow);
          const left = (visualCol / this.daysPerRow) * 100;
          const width = (1 / this.daysPerRow) * 100;
          const top = (row / this.gridRows) * 100;
          const height = (1 / this.gridRows) * 100;
          hoverStyle["--_lc-hover-left"] = `${left}%`;
          hoverStyle["--_lc-hover-width"] = `${width}%`;
          hoverStyle["--_lc-hover-top"] = `${top}%`;
          hoverStyle["--_lc-hover-height"] = `${height}%`;
        } else {
          // For single-row view, highlight the entire column
          const visualDayIndex = this.#toVisualColumnIndex(this.#dragHoverDayIndex, this.#days);
          const left = (visualDayIndex / this.#days) * 100;
          const width = (1 / this.#days) * 100;
          hoverStyle["--_lc-hover-left"] = `${left}%`;
          hoverStyle["--_lc-hover-width"] = `${width}%`;
          hoverStyle["--_lc-hover-top"] = "0%";
          hoverStyle["--_lc-hover-height"] = "100%";
        }
      } else if (this.#dragHoverTime !== null) {
        // Highlight the time slot
        const dayCount = this.#days;
        const visualDayIndex = this.#toVisualColumnIndex(this.#dragHoverDayIndex, dayCount);
        const left = (visualDayIndex / dayCount) * 100;
        const width = (1 / dayCount) * 100;
        const hour = this.#dragHoverTime.hour + this.#dragHoverTime.minute / 60;
        const top = (hour / 24) * 100;
        const slotHeight = (1 / 24) * 100; // One hour slot
        hoverStyle["--_lc-hover-left"] = `${left}%`;
        hoverStyle["--_lc-hover-width"] = `${width}%`;
        hoverStyle["--_lc-hover-top"] = `${top}%`;
        hoverStyle["--_lc-hover-height"] = `${slotHeight}%`;
      }
    }

    const allDayOverflow = this.#getAllDayOverflowLayout();

    return html`
      <div class="calendar-layout flex h-full min-h-0 ${showTimedLabels ? "with-time-labels" : ""}">
        ${
          showTimedLabels
            ? html`
              <div class="time-sidebar">
                <div class="hour-labels">${timedSidebarRows}</div>
              </div>
            `
            : ""
        }
        <section
          class="min-w-0 flex-1 relative flex-row h-full text-[0px] ${sharedFocusRingColorClasses} ${this.#isMonthView ? "month-view" : ""} ${compactMonthView ? "compact-month-view" : ""}"
          dir=${this.#isRtl ? "rtl" : "ltr"}
          style=${styleMap({ ...this.sectionStyle, ...hoverStyle })}
          ?data-drag-hover=${this.#dragHoverDayIndex !== null}
        >
          ${this.#renderWeekendHighlights()}
          ${this.variant === "timed" ? this.#renderCurrentTimeIndicator() : ""}
          ${
            this.variant === "all-day" && !this.labelsHidden
              ? this.#renderAllDayInterleavedByDate(allDayOverflow)
              : this.#renderEventEntries(allDayOverflow)
          }
          ${
            this.variant === "all-day" && this.labelsHidden
              ? this.#renderAllDayOverflowIndicators(allDayOverflow)
              : ""
          }
        </section>
      </div>
    `;
  }

  #renderEventEntries(allDayOverflow: { maxVisibleRows: number }): TemplateResult[] {
    return this.#sortedEvents.map(([id, event]) =>
      this.#renderEventEntry(id, event, allDayOverflow)
    );
  }

  #renderEventEntry(
    id: string,
    event: EventInput,
    allDayOverflow: { maxVisibleRows: number }
  ): TemplateResult {
    return html`
      ${keyed(
        id,
        this.variant === "all-day"
          ? html`
              <all-day-event
                event-id=${id}
                start=${this.#toEventDateTimeString(event.start)}
                end=${this.#toEventDateTimeString(event.end)}
                summary=${event.summary}
                color=${event.color}
                ?hidden=${this.#optimisticallyDeletingEventIds.has(id)}
                ?inert=${this.#optimisticallyDeletingEventIds.has(id) || this.#isCompactMonthView}
                .renderedDays=${this.days}
                .daysPerRow=${this.#isMonthView ? this.daysPerRow : 0}
                .gridRows=${this.#isMonthView ? this.gridRows : 1}
                .maxVisibleRows=${allDayOverflow.maxVisibleRows}
                @update=${this.#handleEventUpdate}
                @delete=${this.#handleEventDelete}
              ></all-day-event>
            `
          : html`
              <timed-event
                event-id=${id}
                start=${this.#toEventDateTimeString(event.start)}
                end=${this.#toEventDateTimeString(event.end)}
                summary=${event.summary}
                color=${event.color}
                ?hidden=${this.#optimisticallyDeletingEventIds.has(id)}
                ?inert=${this.#optimisticallyDeletingEventIds.has(id)}
                .renderedDays=${this.days as unknown as never[]}
                @update=${this.#handleEventUpdate}
                @delete=${this.#handleEventDelete}
              ></timed-event>
            `
      )}
    `;
  }

  #renderAllDayInterleavedByDate(allDayOverflow: {
    maxVisibleRows: number;
    hiddenCountsByDay: Map<number, number>;
  }): TemplateResult[] {
    const days = this.days;
    if (!days.length) return this.#renderEventEntries(allDayOverflow);
    const cols = this.#isMonthView ? this.daysPerRow : this.#days;
    const rowHeightPx = this.#getAllDayRowHeightPx();

    const dayKeyToIndex = new Map<string, number>();
    days.forEach((day, index) => {
      dayKeyToIndex.set(day.toString(), index);
    });

    const eventsByDay = new Map<number, TemplateResult[]>();
    const unanchoredEvents: TemplateResult[] = [];

    for (const [id, event] of this.#sortedEvents) {
      const eventTemplate = this.#renderEventEntry(id, event, allDayOverflow);
      const firstDayIndex = this.#firstVisibleDayIndexForEvent(event, dayKeyToIndex);
      if (firstDayIndex === null) {
        unanchoredEvents.push(eventTemplate);
        continue;
      }
      const dayBucket = eventsByDay.get(firstDayIndex) ?? [];
      dayBucket.push(eventTemplate);
      eventsByDay.set(firstDayIndex, dayBucket);
    }

    const content: TemplateResult[] = [];
    days.forEach((day, dayIndex) => {
      content.push(this.#renderDayNumber(day, dayIndex));
      const dayEvents = eventsByDay.get(dayIndex) ?? [];
      content.push(...dayEvents);

      const hiddenCount = allDayOverflow.hiddenCountsByDay.get(dayIndex) ?? 0;
      if (hiddenCount > 0) {
        const overflowIndicator = this.#renderAllDayOverflowIndicator(
          dayIndex,
          hiddenCount,
          cols,
          rowHeightPx,
          allDayOverflow.maxVisibleRows
        );
        if (overflowIndicator) {
          // Keep the overflow action directly after this day's events in tab order.
          content.push(overflowIndicator);
        }
      }
    });
    content.push(...unanchoredEvents);
    return content;
  }

  #firstVisibleDayIndexForEvent(
    event: EventInput,
    dayKeyToIndex: Map<string, number>
  ): number | null {
    const renderedDays = this.days;
    if (!renderedDays.length) return null;
    const eventStart = this.#toPlainDateTime(event.start).toPlainDate();
    const eventEnd = this.#toPlainDateTime(event.end).subtract({ nanoseconds: 1 }).toPlainDate();

    if (Temporal.PlainDate.compare(eventEnd, renderedDays[0]) < 0) return null;
    if (Temporal.PlainDate.compare(eventStart, renderedDays[renderedDays.length - 1]) > 0)
      return null;

    for (const day of renderedDays) {
      if (Temporal.PlainDate.compare(day, eventStart) < 0) continue;
      if (Temporal.PlainDate.compare(day, eventEnd) > 0) break;
      const dayIndex = dayKeyToIndex.get(day.toString());
      if (typeof dayIndex === "number") return dayIndex;
    }
    return null;
  }

  #renderWeekendHighlights() {
    const weekendDays = this.#weekendDays;
    if (!weekendDays.size) return "";
    const days = this.days;
    if (!days.length) return "";
    const cols = this.#isMonthView ? this.daysPerRow : this.#days;
    if (cols <= 0) return "";

    return days
      .map((day, dayIndex) => {
        if (!weekendDays.has(day.dayOfWeek)) return null;
        const colIndex = this.#isMonthView ? dayIndex % cols : dayIndex;
        const visualColIndex = this.#toVisualColumnIndex(colIndex, cols);
        const rowIndex = this.#isMonthView ? Math.floor(dayIndex / cols) : 0;
        const left = (visualColIndex / cols) * 100;
        const top = this.#isMonthView ? (rowIndex / this.gridRows) * 100 : 0;
        const width = 100 / cols;
        const height = this.#isMonthView ? 100 / this.gridRows : 100;

        return html`
          <div
            class="weekend-cell"
            style=${styleMap({
              left: `${left}%`,
              top: `${top}%`,
              width: `${width}%`,
              height: `${height}%`,
            })}
            aria-hidden="true"
          ></div>
        `;
      })
      .filter((cell) => cell !== null);
  }

  #isOutsideVisibleMonth(day: Temporal.PlainDate): boolean {
    if (!this.#isMonthView) return false;
    const days = this.days;
    if (!days.length) return false;
    const anchorDay = days[Math.floor(days.length / 2)];
    if (!anchorDay) return false;
    return day.month !== anchorDay.month || day.year !== anchorDay.year;
  }

  #renderAllDayOverflowIndicators(layout: {
    maxVisibleRows: number;
    hiddenCountsByDay: Map<number, number>;
  }) {
    if (this.#isCompactMonthView) return "";
    const dayCount = this.days.length;
    if (!dayCount || this.#days <= 0) return "";
    if (layout.maxVisibleRows < 0) return "";
    const cols = this.#isMonthView ? this.daysPerRow : this.#days;
    if (cols <= 0) return "";

    const sortedOverflowEntries = Array.from(layout.hiddenCountsByDay.entries())
      .filter(([, hiddenCount]) => hiddenCount > 0)
      .sort(([leftDayIndex], [rightDayIndex]) => {
        const leftRowIndex = this.#isMonthView ? Math.floor(leftDayIndex / cols) : 0;
        const rightRowIndex = this.#isMonthView ? Math.floor(rightDayIndex / cols) : 0;
        if (leftRowIndex !== rightRowIndex) return leftRowIndex - rightRowIndex;

        const leftColIndex = this.#isMonthView ? leftDayIndex % cols : leftDayIndex;
        const rightColIndex = this.#isMonthView ? rightDayIndex % cols : rightDayIndex;
        const leftVisualColIndex = this.#toVisualColumnIndex(leftColIndex, cols);
        const rightVisualColIndex = this.#toVisualColumnIndex(rightColIndex, cols);
        return leftVisualColIndex - rightVisualColIndex;
      });

    const rowHeightPx = this.#getAllDayRowHeightPx();
    if (!Number.isFinite(rowHeightPx)) return "";

    return sortedOverflowEntries
      .map(([dayIndex, hiddenCount]) =>
        this.#renderAllDayOverflowIndicator(
          dayIndex,
          hiddenCount,
          cols,
          rowHeightPx,
          layout.maxVisibleRows
        )
      )
      .filter((indicator): indicator is TemplateResult => Boolean(indicator));
  }

  #renderAllDayOverflowIndicator(
    dayIndex: number,
    hiddenCount: number,
    cols: number,
    rowHeightPx: number,
    maxVisibleRows: number
  ): TemplateResult | null {
    if (
      hiddenCount <= 0 ||
      cols <= 0 ||
      !Number.isFinite(rowHeightPx) ||
      !Number.isFinite(maxVisibleRows) ||
      maxVisibleRows < 0
    ) {
      return null;
    }
    const indicatorHeightPx = this.#getAllDayOverflowIndicatorHeightPx();
    const indicatorBottomInsetPx = 6;
    const indicatorOffsetWithinRowPx = Math.max(
      0,
      rowHeightPx - indicatorHeightPx - indicatorBottomInsetPx
    );
    const colIndex = this.#isMonthView ? dayIndex % cols : dayIndex;
    const visualColIndex = this.#toVisualColumnIndex(colIndex, cols);
    const rowIndex = this.#isMonthView ? Math.floor(dayIndex / cols) : 0;
    const cellLeft = (visualColIndex / cols) * 100;
    const top = rowIndex * rowHeightPx + indicatorOffsetWithinRowPx;
    const cellWidth = 100 / cols;
    const inlineInsetPx = 6;
    const formattedHiddenCount = new Intl.NumberFormat(this.locale).format(hiddenCount);
    const label = `+${formattedHiddenCount}`;
    const accessibilityLabel = label;
    const anchorLeft = !this.#isRtl;
    const left = anchorLeft
      ? `calc(${cellLeft}% + ${inlineInsetPx}px)`
      : `calc(${cellLeft + cellWidth}% - ${inlineInsetPx}px)`;
    const buttonStyle: Record<string, string> = {
      left,
      top: `${top}px`,
      height: `${indicatorHeightPx}px`,
      maxWidth: `calc(${cellWidth}% - ${inlineInsetPx * 2}px)`,
    };
    if (!anchorLeft) {
      buttonStyle.transform = "translateX(-100%)";
    }

    return html`
      <button
        type="button"
        class="day-label absolute z-[3] w-6 h-6 p-0 text-sm font-medium rounded-md flex justify-center items-center cursor-pointer border-0 bg-transparent text-inherit leading-none whitespace-nowrap overflow-hidden text-ellipsis ${sharedFocusRingColorClasses}"
        style=${styleMap(buttonStyle)}
        aria-label=${accessibilityLabel}
        tabindex="0"
      >
        ${label}
      </button>
    `;
  }

  #handleEventUpdate = (event: Event) => {
    this.dispatchEvent(
      new CustomEvent("event-modified", {
        detail: event.target as BaseEvent,
        bubbles: true,
        composed: true,
      })
    );
  };

  #handleEventDelete = (event: Event) => {
    const target = event.target as BaseEvent | null;
    if (!target) return;
    if (target.eventId) {
      this.#optimisticallyDeletingEventIds.add(target.eventId);
      this.requestUpdate();
    }

    // Emit deletion request; parent state confirms/cancels via next `events` update.

    this.dispatchEvent(
      new CustomEvent("event-deleted", {
        detail: target,
        bubbles: true,
        composed: true,
      })
    );
  };

  #renderDayNumber(day: Temporal.PlainDate, dayIndex: number): TemplateResult {
    const cols = this.#isMonthView ? this.daysPerRow : this.#days;
    const totalDays = this.days.length;
    if (cols <= 0 || totalDays <= 0) return html``;

    const days = this.days;
    const currentDay = this.currentTime.toPlainDate();
    const monthFormatter = new Intl.DateTimeFormat(this.locale, { month: "short" });
    const dayFormatter = new Intl.NumberFormat(this.locale);
    const fullDateFormatter = new Intl.DateTimeFormat(this.locale, { dateStyle: "full" });
    const colIndex = this.#isMonthView ? dayIndex % cols : dayIndex;
    const visualColIndex = this.#toVisualColumnIndex(colIndex, cols);
    const rowIndex = this.#isMonthView ? Math.floor(dayIndex / cols) : 0;
    const top = this.#isMonthView ? (rowIndex / this.gridRows) * 100 : 0;
    const compactMonthView = this.#isCompactMonthView;
    const previousDay = dayIndex > 0 ? days[dayIndex - 1] : null;
    const startsNewMonth =
      previousDay === null || previousDay.month !== day.month || previousDay.year !== day.year;
    const monthPrefix =
      startsNewMonth && !compactMonthView
        ? `${monthFormatter.format(new Date(Date.UTC(day.year, day.month - 1, day.day)))} `
        : "";
    const label = `${monthPrefix}${dayFormatter.format(day.day)}`;
    const isCurrentDay = Temporal.PlainDate.compare(day, currentDay) === 0;
    const fullDateLabel = fullDateFormatter.format(
      new Date(Date.UTC(day.year, day.month - 1, day.day))
    );
    const outsideVisibleMonth = this.#isOutsideVisibleMonth(day);
    const compactColCenter = ((visualColIndex + 0.5) / cols) * 100;
    const inlineStart = (colIndex / cols) * 100;
    const startOffsetStyle = compactMonthView
      ? {
          left: `${compactColCenter}%`,
          top: `calc(${top}% + 6px)`,
          transform: "translateX(-50%)",
        }
      : {
          "inset-inline-start": `calc(${inlineStart}% + 6px)`,
          top: `${top}%`,
        };

    return html`
      <button
        type="button"
        class="day-label absolute p-1 text-sm z-0 font-medium rounded-full flex justify-center items-center cursor-pointer border-0 bg-transparent text-inherit leading-none ${sharedFocusRingColorClasses} ${
          compactMonthView ? "" : "mt-2"
        } ${monthPrefix ? "min-w-6 px-2" : "w-6"} h-6 ${isCurrentDay ? "current-day" : ""} ${
          outsideVisibleMonth ? "outside-month-day-label" : ""
        }"
        aria-label=${fullDateLabel}
        aria-current=${ifDefined(isCurrentDay ? "date" : undefined)}
        style=${styleMap(startOffsetStyle)}
        @click=${(event: MouseEvent) => this.#handleDayLabelClick(day, dayIndex, event)}
        @keydown=${(event: KeyboardEvent) => this.#handleDayLabelKeyDown(day, dayIndex, event)}
      >
        <time datetime=${day.toString()}>${label}</time>
      </button>
    `;
  }

  #handleDayLabelClick(day: Temporal.PlainDate, dayIndex: number, event: MouseEvent) {
    this.#emitDaySelectionRequestedEvent(day, dayIndex, "click", "mouse", event);
  }

  #handleDayLabelKeyDown(day: Temporal.PlainDate, dayIndex: number, event: KeyboardEvent) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    this.#emitDaySelectionRequestedEvent(day, dayIndex, "keyboard", "keyboard", event);
  }

  #emitDaySelectionRequestedEvent(
    day: Temporal.PlainDate,
    dayIndex: number,
    trigger: "click" | "keyboard",
    pointerType: string,
    sourceEvent: Event
  ) {
    this.dispatchEvent(
      new CustomEvent("day-selection-requested", {
        detail: {
          date: day.toString(),
          dayIndex,
          trigger,
          pointerType,
          sourceEvent,
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  #renderCurrentTimeIndicator() {
    const days = this.days;
    if (!days.length || this.#days <= 0) return "";

    const currentDateTime = this.currentTime;
    const currentDay = currentDateTime.toPlainDate();
    const currentDayIndex = days.findIndex(
      (day) => Temporal.PlainDate.compare(day, currentDay) === 0
    );
    if (currentDayIndex < 0) return "";

    const hourFloat =
      currentDateTime.hour +
      currentDateTime.minute / 60 +
      currentDateTime.second / 3600 +
      currentDateTime.millisecond / 3_600_000;
    if (hourFloat < 0 || hourFloat > this.hours) return "";

    const top = (hourFloat / this.hours) * 100;
    const visualDayIndex = this.#toVisualColumnIndex(currentDayIndex, this.#days);
    const left = (visualDayIndex / this.#days) * 100;
    const width = (1 / this.#days) * 100;

    return html`
      <div
        class="current-time-indicator absolute z-[100] m-0 pointer-events-none before:content-[''] before:absolute before:left-0 before:top-0 before:rounded-full before:-translate-x-[2px] before:-translate-y-1/2 before:[width:var(--_lc-current-time-dot-size)] before:[height:var(--_lc-current-time-dot-size)] before:[background-color:var(--_lc-current-day-color)]"
        style=${styleMap({
          top: `${top}%`,
          left: `${left}%`,
          width: `${width}%`,
          borderTop: "var(--_lc-current-time-line-width) solid var(--_lc-current-day-color)",
        })}
      ></div>
    `;
  }

  #handleDragHover = (event: Event) => {
    if (!(event instanceof CustomEvent)) {
      this.#dragHoverDayIndex = null;
      this.#dragHoverTime = null;
      this.requestUpdate();
      return;
    }

    const hover = event.detail;
    if (!hover) {
      this.#dragHoverDayIndex = null;
      this.#dragHoverTime = null;
    } else {
      this.#dragHoverDayIndex = hover.dayIndex ?? null;
      this.#dragHoverTime = hover.time ?? null;
    }
    this.requestUpdate();
  };

  #compareEventsForRenderOrder([, a]: EventEntry, [, b]: EventEntry): number {
    if (this.variant === "all-day") {
      const aStartDate = this.#toPlainDateTime(a.start).toPlainDate();
      const bStartDate = this.#toPlainDateTime(b.start).toPlainDate();
      const startDateDiff = Temporal.PlainDate.compare(aStartDate, bStartDate);
      if (startDateDiff !== 0) return startDateDiff;

      // Match AllDayEvent.siblings ordering: longer spans should win lower stack rows.
      const aEndDate = this.#toPlainDateTime(a.end).subtract({ nanoseconds: 1 }).toPlainDate();
      const bEndDate = this.#toPlainDateTime(b.end).subtract({ nanoseconds: 1 }).toPlainDate();
      const endDateDiff = Temporal.PlainDate.compare(aEndDate, bEndDate);
      if (endDateDiff !== 0) return -endDateDiff;

      return a.summary.localeCompare(b.summary);
    }

    const aStart = this.#toPlainDateTime(a.start);
    const bStart = this.#toPlainDateTime(b.start);
    const startDiff = Temporal.PlainDateTime.compare(aStart, bStart);
    if (startDiff !== 0) return startDiff;

    const aEnd = this.#toPlainDateTime(a.end);
    const bEnd = this.#toPlainDateTime(b.end);
    const endDiff = Temporal.PlainDateTime.compare(aEnd, bEnd);
    if (endDiff !== 0) return endDiff;

    return a.summary.localeCompare(b.summary);
  }

  #toPlainDateTime(value: EventInput["start"]): Temporal.PlainDateTime {
    if (value instanceof Temporal.ZonedDateTime) {
      return value.withTimeZone(this.timezone).toPlainDateTime();
    }
    if (value instanceof Temporal.PlainDateTime) {
      return value;
    }
    if (value instanceof Temporal.PlainDate) {
      return value.toPlainDateTime({ hour: 0, minute: 0, second: 0 });
    }
    if (this.#isTimezonedString(value)) {
      return Temporal.ZonedDateTime.from(value).withTimeZone(this.timezone).toPlainDateTime();
    }
    return Temporal.PlainDateTime.from(value);
  }

  #toEventDateTimeString(value: EventInput["start"]): string {
    if (typeof value === "string") return value;
    return value.toString();
  }

  #isAllDayEvent(event: EventInput): boolean {
    return this.#isDateOnlyValue(event.start) || this.#isDateOnlyValue(event.end);
  }

  #isDateOnlyValue(value: EventInput["start"]): boolean {
    if (value instanceof Temporal.PlainDate) return true;
    if (value instanceof Temporal.PlainDateTime || value instanceof Temporal.ZonedDateTime) {
      return false;
    }
    return !value.includes("T");
  }

  #isTimezonedString(value: string): boolean {
    return value.includes("[") && value.includes("]");
  }

  get #eventsAsEntries(): EventEntry[] {
    if (this.events === this.#cachedEventEntriesSource) {
      return this.#cachedEventEntries;
    }
    this.#cachedEventEntriesSource = this.events;
    this.#cachedEventEntries = Array.from(this.events?.entries() ?? []);
    return this.#cachedEventEntries;
  }

  #getAllDayOverflowLayout(): { maxVisibleRows: number; hiddenCountsByDay: Map<number, number> } {
    if (this.variant !== "all-day") {
      return { maxVisibleRows: Number.POSITIVE_INFINITY, hiddenCountsByDay: new Map() };
    }

    const dayCount = this.days.length;
    const cols = this.#isMonthView ? this.daysPerRow : dayCount;
    if (!dayCount || cols <= 0) {
      return { maxVisibleRows: Number.POSITIVE_INFINITY, hiddenCountsByDay: new Map() };
    }

    const visibleEvents = this.#sortedEvents.filter(
      ([id]) => !this.#optimisticallyDeletingEventIds.has(id)
    );
    const layout = buildAllDayLayout({
      renderedDays: this.days,
      daysPerRow: cols,
      items: visibleEvents.map(([id, event]) => this.#toAllDayLayoutItem(id, event)),
    });

    const maxRowsByHeight = this.#getMaxRowsPerCellByHeight();
    if (!Number.isFinite(maxRowsByHeight)) {
      return { maxVisibleRows: Number.POSITIVE_INFINITY, hiddenCountsByDay: new Map() };
    }
    if (maxRowsByHeight <= 0) {
      return {
        maxVisibleRows: 0,
        hiddenCountsByDay: computeHiddenAllDayCountsByDay(layout, 0),
      };
    }

    const maxVisibleRows = maxRowsByHeight;
    const hiddenCountsByDay = computeHiddenAllDayCountsByDay(layout, maxVisibleRows);
    if (!hiddenCountsByDay.size) {
      return { maxVisibleRows, hiddenCountsByDay };
    }

    // Reserve one full row for the overflow indicator when any day overflows.
    const availableHeight = this.#getAllDayAvailableHeightPx();
    const eventHeight = this.#getAllDayEventHeightPx();
    const overflowIndicatorHeight = this.#getAllDayOverflowIndicatorHeightPx();
    if (!Number.isFinite(availableHeight) || eventHeight <= 0) {
      return { maxVisibleRows, hiddenCountsByDay };
    }

    const maxRowsWithIndicator = Math.max(
      0,
      Math.floor((availableHeight - overflowIndicatorHeight) / eventHeight)
    );
    if (maxRowsWithIndicator >= maxVisibleRows) {
      return { maxVisibleRows, hiddenCountsByDay };
    }

    const hiddenCountsWithIndicator = computeHiddenAllDayCountsByDay(layout, maxRowsWithIndicator);
    return { maxVisibleRows: maxRowsWithIndicator, hiddenCountsByDay: hiddenCountsWithIndicator };
  }

  #toAllDayLayoutItem(id: string, event: EventInput): AllDayLayoutItem {
    return {
      id,
      start: this.#toPlainDateTime(event.start).toPlainDate(),
      endInclusive: this.#toPlainDateTime(event.end).subtract({ nanoseconds: 1 }).toPlainDate(),
    };
  }

  #getMaxRowsPerCellByHeight(): number {
    const availableHeight = this.#getAllDayAvailableHeightPx();
    if (!Number.isFinite(availableHeight)) return Number.POSITIVE_INFINITY;
    const eventHeight = this.#getAllDayEventHeightPx();
    if (eventHeight <= 0) return Number.POSITIVE_INFINITY;
    return Math.max(0, Math.floor(availableHeight / eventHeight));
  }

  #getAllDayAvailableHeightPx(): number {
    const sectionHeight = this.#sectionHeightPx;
    if (sectionHeight <= 0) return Number.POSITIVE_INFINITY;
    const rowHeight = this.#isMonthView ? sectionHeight / this.gridRows : sectionHeight;
    if (rowHeight <= 0) return Number.POSITIVE_INFINITY;
    return rowHeight - this.#getAllDayDayNumberOffsetPx();
  }

  #getAllDayRowHeightPx(): number {
    const sectionHeight = this.#sectionHeightPx;
    if (sectionHeight <= 0) return Number.POSITIVE_INFINITY;
    return this.#isMonthView ? sectionHeight / this.gridRows : sectionHeight;
  }

  #getAllDayEventHeightPx(): number {
    return this.#readSectionCssNumber("--_lc-event-height", 32);
  }

  #getAllDayDayNumberOffsetPx(): number {
    if (this.labelsHidden) return 0;
    return this.#readSectionCssNumber("--_lc-all-day-day-number-space", 36);
  }

  #getAllDayOverflowIndicatorHeightPx(): number {
    return 24;
  }

  #readSectionCssNumber(propertyName: string, fallback: number): number {
    const section = this.renderRoot.querySelector("section");
    const styleTarget = section ?? this;
    const rawValue = getComputedStyle(styleTarget).getPropertyValue(propertyName).trim();
    const parsedValue = parseFloat(rawValue);
    return Number.isFinite(parsedValue) ? parsedValue : fallback;
  }

  #updateCalendarViewContext() {
    const value: CalendarViewContextValue = {
      locale: this.locale,
      timezone: this.timezone,
      currentTime: this.currentTime.toString(),
    };
    this.#calendarViewProvider.setValue(value);
  }

  protected firstUpdated(changedProperties: PropertyValues<this>) {
    super.firstUpdated(changedProperties);
    this.#syncTimedHostHeightFactor();
  }

  protected willUpdate(changedProperties: PropertyValues<this>) {
    super.willUpdate(changedProperties);
    if (changedProperties.has("days") || changedProperties.has("variant")) {
      this.#syncCompactMonthState();
    }
    if (!changedProperties.has("events")) {
      if (changedProperties.has("variant") || changedProperties.has("visibleHours")) {
        this.#syncTimedHostHeightFactor();
      }
      return;
    }
    // External state (confirm/cancel) has caught up; reset optimistic delete visuals.
    this.#optimisticallyDeletingEventIds.clear();
    if (changedProperties.has("variant") || changedProperties.has("visibleHours")) {
      this.#syncTimedHostHeightFactor();
    }
  }

  #syncTimedHostHeightFactor() {
    const factor = this.variant === "timed" ? 24 / this.visibleHours : 1;
    this.style.setProperty("--_lc-host-height-factor", factor.toString());
  }
}
