import { Temporal } from "@js-temporal/polyfill";
import { ContextProvider } from "@lit/context";
import { html, type PropertyValues, type TemplateResult, unsafeCSS } from "lit";
import { customElement } from "lit/decorators.js";
import { ifDefined } from "lit/directives/if-defined.js";
import { keyed } from "lit/directives/keyed.js";
import { styleMap } from "lit/directives/style-map.js";
import "../TimedEvent/TimedEvent.js";
import { CalendarViewBase } from "../CalendarViewBase/CalendarViewBase.js";
import componentStyle from "./CalendarGridView.css?inline";
import "../AllDayEvent/AllDayEvent.js";
import "../DayOverflowPopover/DayOverflowPopover.js";
import {
  type CalendarEvent,
  type CalendarEventsMap,
  parseRecurrenceId,
} from "@lit-calendar/events-api";
import {
  type CalendarViewContextValue,
  calendarViewContext,
} from "../context/CalendarViewContext.js";
import { TimedEventInteractionController } from "../controllers/TimedEventInteractionController.js";
import { resolvedDataEnd } from "../domain/events-api/eventMapBridge.js";
import type { EventBase } from "../EventBase/EventBase.js";
import {
  isCalendarEventException,
  isCalendarEventRecurring,
} from "../types/calendarEventSemantics.js";
import { buildAllDayLayout } from "../utils/AllDayLayout.js";
import { clampGridDaysPerWeek, daysPerWeekFromInput } from "../utils/DaysPerWeek.js";
import { getEventColorStyles } from "../utils/EventColor.js";
import { getLocaleDirection, getLocaleWeekInfo, resolveLocale } from "../utils/Locale.js";
import { formatShortTimeRange } from "../utils/TimeFormatting.js";
import "../EventCard/EventCard.js";
import type {
  AllDayLayoutItem,
  DayOverflowPopoverEvent,
  EventCreateRequestDetail,
  EventDeleteRequestDetail,
  EventSelectionRequestDetail,
  EventUpdateRequestDetail,
} from "../types/index.js";

type EventInput = CalendarEvent;
type EventEntry = [string, CalendarEvent];
type EventsMap = CalendarEventsMap;

type AllDayOverflowLayout = {
  maxVisibleRows: number;
  maxVisibleRowsByDay: Map<number, number>;
  hiddenCountsByDay: Map<number, number>;
  hiddenColorsByDay: Map<number, string[]>;
  hiddenEventIdsByDay: Map<number, string[]>;
  forceIndicatorsByDay: Set<number>;
};
// Keep touch-create activation aligned with timed event move/resize activation.
const CREATE_TOUCH_LONG_PRESS_MS = 160;
const CREATE_TOUCH_CANCEL_DISTANCE_PX = 10;
const CREATE_DRAG_ACTIVATION_DISTANCE_PX = 6;
const SECONDS_IN_DAY = 24 * 60 * 60;
const DEFAULT_TIMED_CREATE_DURATION_MINUTES = 15;

type EventCreateRequestEmitInput = {
  start: Temporal.PlainDateTime;
  end: Temporal.PlainDateTime;
  allDay?: boolean;
  summary: string;
  color: string;
  calendarId?: string;
};

type CreateHit = {
  dayIndex: number;
  dateTime: Temporal.PlainDateTime;
};

@customElement("calendar-grid-view")
export class CalendarGridView extends CalendarViewBase {
  #startDate?: string;
  #timezone?: string;
  #lang?: string;
  #daysPerWeekStored = 7;
  #hours: number = 24;
  #visibleHours = 24;
  #snapInterval: number = TimedEventInteractionController.snapInterval;
  declare events?: EventsMap;
  /** Raw attribute/property value; `get variant()` exposes `"timed" | "all-day"`. */
  #variantAttribute = "timed";
  labelsHidden = false;
  rtl = false;
  defaultEventSummary = "New event";
  defaultEventColor = "#0ea5e9";
  #dragHoverDayIndex: number | null = null;
  #dragHoverTime: Temporal.PlainTime | null = null;
  #dragHoverMaxHeightPx: number | null = null;
  #pendingCreatePointer: {
    pointerId: number;
    pointerType: string;
    startClientX: number;
    startClientY: number;
    currentClientY: number;
    startDateTime: Temporal.PlainDateTime;
    startDayIndex: number;
    currentDayIndex: number;
    currentDateTime: Temporal.PlainDateTime;
    dragActivated: boolean;
    longPressActivated: boolean;
    longPressTimerId: number | null;
    captureTarget: HTMLElement | null;
  } | null = null;
  #calendarViewProvider = new ContextProvider(this, { context: calendarViewContext });
  #styleObserver?: MutationObserver;
  #lastAllDayLayoutToken = "";
  #sectionHeightPx = 0;
  #resizeObserver?: ResizeObserver;
  #resizeSyncRafId: number | null = null;
  #resizeDebounceTimerId: number | null = null;
  #resizeDebounceDelayMs = 17;
  #lastObservedHostHeightPx = 0;
  #isCompactMonth = false;
  #cachedViewDaysKey = "";
  #cachedViewDays: Temporal.PlainDate[] = [];
  #instanceToken = Math.random().toString(36).slice(2, 10);
  #activeOverflowPopoverId: string | null = null;
  #pendingKeyboardRefocusEventId: string | null = null;
  #keyboardRefocusRafId: number | null = null;
  #keyboardRefocusAttemptsRemaining = 0;
  #createInteractionLockActive = false;
  #createTouchMoveBlocker = (event: TouchEvent) => {
    const pending = this.#pendingCreatePointer;
    if (!pending || pending.pointerType !== "touch" || !pending.longPressActivated) return;
    if (event.cancelable) {
      event.preventDefault();
    }
  };

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
    return Array.from(
      this.getRenderedEvents({
        start: viewport.start,
        end: viewport.endExclusive,
      }).entries()
    );
  }

  get #renderedViewportRange(): {
    start: Temporal.PlainDateTime;
    endExclusive: Temporal.PlainDateTime;
  } | null {
    const viewDays = this.viewDays;
    if (!viewDays.length) return null;

    const start = viewDays[0].toPlainDateTime({
      hour: 0,
      minute: 0,
      second: 0,
      millisecond: 0,
      microsecond: 0,
      nanosecond: 0,
    });
    const lastRenderedDay = viewDays[viewDays.length - 1];
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

  #isRecurringEvent(event: EventInput): boolean {
    return isCalendarEventRecurring(event);
  }

  #isExceptionEvent(event: EventInput): boolean {
    return isCalendarEventException(event);
  }

  static get properties() {
    return {
      ...CalendarViewBase.properties,
      startDate: { type: String, attribute: "start-date" },
      daysPerWeek: { type: Number, attribute: "days-per-week" },
      variant: { type: String, attribute: "variant", reflect: true },
      labelsHidden: { type: Boolean, attribute: "labels-hidden", reflect: true },
      rtl: { type: Boolean, reflect: true },
      snapInterval: { type: Number, attribute: "snap-interval" },
      visibleHours: { type: Number, attribute: "visible-hours" },
    } as const;
  }

  static get styles() {
    return [...CalendarViewBase.styles, unsafeCSS(componentStyle)];
  }

  get variant(): "timed" | "all-day" {
    return this.#variantAttribute === "all-day" ? "all-day" : "timed";
  }

  set variant(value: string | null | undefined) {
    const next = value ?? "timed";
    if (next === this.#variantAttribute) return;
    const previous = this.#variantAttribute;
    this.#variantAttribute = next;
    this.requestUpdate("variant", previous);
  }

  connectedCallback() {
    super.connectedCallback();
    this.#updateCalendarViewContext();
    this.#startStyleObserver();
    this.#startResizeObserver();
    this.addEventListener("interaction-drag-hover", this.#handleDragHover as EventListener);
  }

  disconnectedCallback() {
    this.#cancelPendingCreatePointer();
    this.#stopGlobalCreatePointerTracking();
    this.#stopStyleObserver();
    this.#stopResizeObserver();
    this.#cancelScheduledResizeSync();
    this.#cancelKeyboardRefocusLoop();
    this.removeEventListener("interaction-drag-hover", this.#handleDragHover as EventListener);
    super.disconnectedCallback();
  }

  updated(changedProperties: PropertyValues<this>) {
    super.updated(changedProperties);
    if (
      changedProperties.has("lang") ||
      changedProperties.has("timezone") ||
      changedProperties.has("currentTime")
    ) {
      this.#updateCalendarViewContext();
    }
    this.#scheduleSectionHeightSync();
    this.#restorePendingKeyboardEventFocus();
  }

  get startDate(): Temporal.PlainDate {
    return this.#startDate ? Temporal.PlainDate.from(this.#startDate) : Temporal.Now.plainDateISO();
  }

  set startDate(startDate: string) {
    this.#startDate = startDate;
  }

  get timezone(): string {
    return this.#timezone ?? Temporal.Now.timeZoneId();
  }

  set timezone(timezone: string | undefined) {
    this.#timezone = timezone || undefined;
  }

  get lang(): string {
    return resolveLocale(this.#lang);
  }

  set lang(lang: string | undefined) {
    this.#lang = lang || undefined;
  }

  get #resolvedCurrentDateTime(): Temporal.PlainDateTime {
    return this.#toPlainDateTimeFromString(this.currentTime);
  }

  get daysPerWeek(): number {
    return clampGridDaysPerWeek(this.#daysPerWeekStored);
  }

  set daysPerWeek(value: number | string | null | undefined) {
    const next = daysPerWeekFromInput(value);
    if (Object.is(next, this.#daysPerWeekStored)) return;
    const previous = this.#daysPerWeekStored;
    this.#daysPerWeekStored = next;
    this.requestUpdate("daysPerWeek", previous);
  }

  /** Plain dates shown in this view (length === `daysPerWeek`); same values passed to events as `viewDays`. */
  get viewDays(): Temporal.PlainDate[] {
    const startDate = this.startDate;
    const count = this.daysPerWeek;
    const cacheKey = `${startDate.toString()}|${this.#daysPerWeekStored}`;
    if (cacheKey === this.#cachedViewDaysKey) {
      return this.#cachedViewDays;
    }

    const values: Temporal.PlainDate[] = [];
    for (let i = 0; i < count; i++) {
      values.push(startDate.add({ days: i }));
    }
    this.#cachedViewDaysKey = cacheKey;
    this.#cachedViewDays = values;
    return values;
  }

  get hours(): number {
    if (this.variant === "all-day") return 0;
    return this.#hours;
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

  #readAllDayLayoutToken(): string {
    if (typeof getComputedStyle === "undefined") return "";
    const style = getComputedStyle(this);
    const daysPerRow = style.getPropertyValue("--lc-days-per-row").trim();
    const eventHeight = style.getPropertyValue("--_lc-event-height").trim();
    const dayNumberSpace = style.getPropertyValue("--_lc-all-day-day-number-space").trim();
    return `${daysPerRow}|${eventHeight}|${dayNumberSpace}`;
  }

  #startStyleObserver() {
    if (typeof MutationObserver === "undefined") return;
    this.#lastAllDayLayoutToken = this.#readAllDayLayoutToken();

    this.#styleObserver = new MutationObserver(() => {
      const nextToken = this.#readAllDayLayoutToken();
      if (nextToken === this.#lastAllDayLayoutToken) return;
      this.#lastAllDayLayoutToken = nextToken;
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
    this.#isCompactMonth = false;
  }

  #scheduleDebouncedResizeSync() {
    if (typeof window === "undefined") return;
    if (this.#resizeDebounceTimerId !== null) {
      window.clearTimeout(this.#resizeDebounceTimerId);
    }
    this.#resizeDebounceTimerId = window.setTimeout(() => {
      this.#resizeDebounceTimerId = null;
      this.#syncCompactMonthState();
      if (this.variant === "all-day") {
        this.#scheduleSectionHeightSync();
        return;
      }
      this.#syncTimedHostHeightFactor();
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
    return Boolean(this.variant === "all-day" && this.daysPerWeek > this.daysPerRow);
  }

  get #isCompactMonthView(): boolean {
    return this.#isMonthView && this.#isCompactMonth;
  }

  #readCompactMonthCssState(): boolean {
    if (typeof getComputedStyle === "undefined") return false;
    const section = this.renderRoot.querySelector<HTMLElement>("section.month-view");
    const styleTarget = section ?? this;
    const rawValue = getComputedStyle(styleTarget).getPropertyValue("--_lc-compact-month-view");
    const compactState = Number.parseFloat(rawValue.trim());
    return Number.isFinite(compactState) && compactState >= 0.5;
  }

  #syncCompactMonthState() {
    if (!this.#isMonthView) {
      if (!this.#isCompactMonth) return;
      this.#isCompactMonth = false;
      this.requestUpdate();
      return;
    }

    const shouldBeCompact = this.#readCompactMonthCssState();
    if (shouldBeCompact === this.#isCompactMonth) return;
    this.#isCompactMonth = shouldBeCompact;
    this.requestUpdate();
  }

  get gridRows(): number {
    if (!this.#isMonthView) return 1;
    return Math.ceil(this.daysPerWeek / this.daysPerRow) || 1;
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
      base["--_lc-days"] = this.daysPerWeek.toString();
    }
    return base;
  }

  get #weekendDays(): Set<number> {
    return new Set(getLocaleWeekInfo(this.lang).weekend);
  }

  get #isRtl(): boolean {
    return this.rtl || getLocaleDirection(this.lang) === "rtl";
  }

  #toVisualColumnIndex(columnIndex: number, columnCount: number): number {
    if (!this.#isRtl) return columnIndex;
    return columnCount - columnIndex - 1;
  }

  render() {
    const hoverStyle: Record<string, string> = {};
    const createPreviewSegments = this.#getCreatePreviewCardModels();
    const touchCreateActive = Boolean(
      this.#pendingCreatePointer?.pointerType === "touch" &&
        this.#pendingCreatePointer?.longPressActivated &&
        createPreviewSegments.length
    );
    const compactMonthView = this.#isCompactMonthView;
    const disableAllDayInteraction = this.#shouldDisableAllDayInteractionInCompactMonth();

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
          const visualDayIndex = this.#toVisualColumnIndex(
            this.#dragHoverDayIndex,
            this.daysPerWeek
          );
          const left = (visualDayIndex / this.daysPerWeek) * 100;
          const width = (1 / this.daysPerWeek) * 100;
          hoverStyle["--_lc-hover-left"] = `${left}%`;
          hoverStyle["--_lc-hover-width"] = `${width}%`;
          hoverStyle["--_lc-hover-top"] = "0%";
          hoverStyle["--_lc-hover-height"] = "100%";
        }
      } else if (this.#dragHoverTime !== null) {
        // Highlight the time slot
        const dayCount = this.daysPerWeek;
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
        hoverStyle["--_lc-hover-max-height"] =
          this.#dragHoverMaxHeightPx && this.#dragHoverMaxHeightPx > 0
            ? `${this.#dragHoverMaxHeightPx}px`
            : "100%";
      }
    }

    const allDayOverflow = this.#getAllDayOverflowLayout();

    return html`
      <div class="calendar-layout">
        <section
          class="calendar-grid-section ${this.#isMonthView ? "month-view" : ""} ${compactMonthView ? "compact-month-view" : ""}"
          dir=${this.#isRtl ? "rtl" : "ltr"}
          style=${styleMap({ ...this.sectionStyle, ...hoverStyle })}
          ?data-drag-hover=${this.#dragHoverDayIndex !== null}
          ?data-touch-creating=${touchCreateActive}
          @pointerdown=${disableAllDayInteraction ? null : this.#handleCreatePointerDown}
          @pointermove=${disableAllDayInteraction ? null : this.#handleCreatePointerMove}
          @pointerup=${disableAllDayInteraction ? null : this.#handleCreatePointerUp}
          @pointercancel=${disableAllDayInteraction ? null : this.#handleCreatePointerCancel}
        >
          ${this.#renderWeekendHighlights()}
          ${this.variant === "timed" ? this.#renderCurrentTimeIndicator() : ""}
          ${createPreviewSegments.map(
            (segment) => html`
              <event-card
                class="create-preview-card"
                .summary=${this.defaultEventSummary}
                .time=${segment.timeLabel}
                .segmentDirection=${segment.segmentDirection}
                ?first-segment=${segment.firstSegment}
                ?last-segment=${segment.lastSegment}
                style=${styleMap(segment.style)}
              ></event-card>
            `
          )}
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

  #renderEventEntries(allDayOverflow: AllDayOverflowLayout): TemplateResult[] {
    return this.#sortedEvents.map(([id, event]) =>
      this.#renderEventEntry(id, event, allDayOverflow)
    );
  }

  #renderEventEntry(
    id: string,
    event: EventInput,
    allDayOverflow: AllDayOverflowLayout
  ): TemplateResult {
    return html`
      ${keyed(
        id,
        this.variant === "all-day"
          ? html`
              <all-day-event
                .eventId=${id}
                start=${this.#toEventDateTimeString(event.data.start, this.#isAllDayEvent(event))}
                end=${this.#toEventDateTimeString(resolvedDataEnd(event.data), this.#isAllDayEvent(event))}
                .summary=${event.data.summary}
                .color=${event.data.color}
                .isRecurring=${this.#isRecurringEvent(event)}
                .isException=${this.#isExceptionEvent(event)}
                ?inert=${this.#shouldDisableAllDayInteractionInCompactMonth()}
                .viewDays=${this.viewDays}
                .daysPerRow=${this.#isMonthView ? this.daysPerRow : 0}
                .gridRows=${this.#isMonthView ? this.gridRows : 1}
                .maxVisibleRows=${allDayOverflow.maxVisibleRows}
                .maxVisibleRowsByDay=${allDayOverflow.maxVisibleRowsByDay}
                @interaction-drag-state=${this.#handleEventInteractionDragState}
                @select=${this.#handleEventSelect}
                @update=${this.#handleEventUpdate}
                @delete=${this.#handleEventDelete}
              ></all-day-event>
            `
          : html`
              <timed-event
                .eventId=${id}
                start=${this.#toEventDateTimeString(event.data.start, false)}
                end=${this.#toEventDateTimeString(resolvedDataEnd(event.data), false)}
                .summary=${event.data.summary}
                .color=${event.data.color}
                .isRecurring=${this.#isRecurringEvent(event)}
                .isException=${this.#isExceptionEvent(event)}
                .viewDays=${this.viewDays}
                @interaction-drag-state=${this.#handleEventInteractionDragState}
                @select=${this.#handleEventSelect}
                @update=${this.#handleEventUpdate}
                @delete=${this.#handleEventDelete}
              ></timed-event>
            `
      )}
    `;
  }

  #renderAllDayInterleavedByDate(allDayOverflow: AllDayOverflowLayout): TemplateResult[] {
    const days = this.viewDays;
    if (!days.length) return this.#renderEventEntries(allDayOverflow);
    const cols = this.#isMonthView ? this.daysPerRow : this.daysPerWeek;
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
      if (this.#shouldRenderAllDayOverflowIndicator(dayIndex, hiddenCount, allDayOverflow)) {
        const hiddenColors = allDayOverflow.hiddenColorsByDay.get(dayIndex) ?? [];
        const overflowIndicator = this.#renderAllDayOverflowIndicator(
          dayIndex,
          hiddenCount,
          hiddenColors,
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
    const viewDays = this.viewDays;
    if (!viewDays.length) return null;
    const eventStart = this.#toPlainDateTime(event.data.start).toPlainDate();
    const eventEnd = this.#toPlainDateTime(resolvedDataEnd(event.data))
      .subtract({ nanoseconds: 1 })
      .toPlainDate();

    if (Temporal.PlainDate.compare(eventEnd, viewDays[0]) < 0) return null;
    if (Temporal.PlainDate.compare(eventStart, viewDays[viewDays.length - 1]) > 0) return null;

    for (const day of viewDays) {
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
    const days = this.viewDays;
    if (!days.length) return "";
    const cols = this.#isMonthView ? this.daysPerRow : this.daysPerWeek;
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
    const days = this.viewDays;
    if (!days.length) return false;
    const anchorDay = days[Math.floor(days.length / 2)];
    if (!anchorDay) return false;
    return day.month !== anchorDay.month || day.year !== anchorDay.year;
  }

  #renderAllDayOverflowIndicators(layout: AllDayOverflowLayout) {
    if (this.#isCompactMonthView) return "";
    const dayCount = this.viewDays.length;
    if (!dayCount || this.daysPerWeek <= 0) return "";
    if (layout.maxVisibleRows < 0) return "";
    const cols = this.#isMonthView ? this.daysPerRow : this.daysPerWeek;
    if (cols <= 0) return "";

    const sortedOverflowEntries = Array.from(layout.hiddenCountsByDay.entries())
      .filter(([dayIndex, hiddenCount]) =>
        this.#shouldRenderAllDayOverflowIndicator(dayIndex, hiddenCount, layout)
      )
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
      .map(([dayIndex, hiddenCount]) => {
        const hiddenColors = layout.hiddenColorsByDay.get(dayIndex) ?? [];
        return this.#renderAllDayOverflowIndicator(
          dayIndex,
          hiddenCount,
          hiddenColors,
          cols,
          rowHeightPx,
          layout.maxVisibleRows
        );
      })
      .filter((indicator): indicator is TemplateResult => Boolean(indicator));
  }

  #shouldRenderAllDayOverflowIndicator(
    dayIndex: number,
    hiddenCount: number,
    layout: AllDayOverflowLayout
  ): boolean {
    if (hiddenCount <= 0) return false;
    if (layout.forceIndicatorsByDay.has(dayIndex)) return true;
    if (hiddenCount !== 1) return true;

    const hiddenIds = layout.hiddenEventIdsByDay.get(dayIndex) ?? [];
    if (hiddenIds.length !== 1) return true;
    const hiddenEventId = hiddenIds[0];
    const hiddenEvent = this.events?.get(hiddenEventId);
    if (!hiddenEvent) return true;
    if (!this.#isMultiDayEvent(hiddenEvent)) return false;

    return !this.#isVisibleOnAnyOtherRenderedDay(hiddenEventId, hiddenEvent, dayIndex, layout);
  }

  #isMultiDayEvent(event: EventInput): boolean {
    const start = this.#toPlainDateTime(event.data.start).toPlainDate();
    const endInclusive = this.#toPlainDateTime(resolvedDataEnd(event.data))
      .subtract({ nanoseconds: 1 })
      .toPlainDate();
    return Temporal.PlainDate.compare(endInclusive, start) > 0;
  }

  #isVisibleOnAnyOtherRenderedDay(
    eventId: string,
    event: EventInput,
    currentDayIndex: number,
    layout: AllDayOverflowLayout
  ): boolean {
    for (let dayIndex = 0; dayIndex < this.viewDays.length; dayIndex += 1) {
      if (dayIndex === currentDayIndex) continue;
      const day = this.viewDays[dayIndex];
      if (!day || !this.#eventOverlapsDay(event, day)) continue;
      const hiddenIds = layout.hiddenEventIdsByDay.get(dayIndex) ?? [];
      if (!hiddenIds.includes(eventId)) return true;
    }
    return false;
  }

  #renderAllDayOverflowIndicator(
    dayIndex: number,
    hiddenCount: number,
    hiddenColors: string[],
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
    const dayNumberOffsetPx = this.#getAllDayDayNumberOffsetPx();
    const eventHeightPx = this.#getAllDayEventHeightPx();
    const indicatorBottomInsetPx = 2;
    const hiddenStartTopPx = Math.max(
      0,
      dayNumberOffsetPx + Math.max(0, maxVisibleRows) * eventHeightPx
    );
    const maxTopWithinRowPx = Math.max(0, rowHeightPx - indicatorHeightPx - indicatorBottomInsetPx);
    const indicatorOffsetWithinRowPx = Math.min(hiddenStartTopPx, maxTopWithinRowPx);
    const colIndex = this.#isMonthView ? dayIndex % cols : dayIndex;
    const visualColIndex = this.#toVisualColumnIndex(colIndex, cols);
    const rowIndex = this.#isMonthView ? Math.floor(dayIndex / cols) : 0;
    const cellLeft = (visualColIndex / cols) * 100;
    const top = rowIndex * rowHeightPx + indicatorOffsetWithinRowPx;
    const cellWidth = 100 / cols;
    const inlineInsetPx = this.#isMonthView ? 3 : 2;
    const inlineEndInsetPx = 2;
    const day = this.viewDays[dayIndex];
    if (!day) return null;
    const formattedHiddenCount = new Intl.NumberFormat(this.lang).format(hiddenCount);
    const fullDateLabel = new Intl.DateTimeFormat(this.lang, { dateStyle: "full" }).format(
      new Date(Date.UTC(day.year, day.month - 1, day.day))
    );
    const accessibilityLabel = `${formattedHiddenCount} more ${
      hiddenCount === 1 ? "event" : "events"
    } on ${fullDateLabel}`;
    const anchorLeft = !this.#isRtl;
    const left = anchorLeft
      ? `calc(${cellLeft}% + ${inlineInsetPx}px)`
      : `calc(${cellLeft + cellWidth}% - ${inlineInsetPx}px)`;
    const buttonStyle: Record<string, string> = {
      left,
      top: `${top}px`,
      height: `${indicatorHeightPx}px`,
      "min-width": `${indicatorHeightPx}px`,
      "max-width": `calc(${cellWidth}% - ${inlineInsetPx + inlineEndInsetPx}px)`,
    };
    if (!anchorLeft) {
      buttonStyle.transform = "translateX(-100%)";
    }
    const popoverId = `day-overflow-popover-${this.#instanceToken}-${dayIndex}`;
    const anchorName = `--day-overflow-anchor-${this.#instanceToken}-${dayIndex}`;
    buttonStyle["anchor-name"] = anchorName;

    if (!this.#isMonthView) {
      return html`
        <button
          type="button"
          class="day-label day-overflow-button"
          style=${styleMap(buttonStyle)}
          .ariaLabel=${accessibilityLabel}
          tabindex="0"
          @click=${(event: MouseEvent) => this.#handleDayLabelClick(day, dayIndex, event)}
          @keydown=${(event: KeyboardEvent) => this.#handleDayLabelKeyDown(day, dayIndex, event)}
        >
          ${this.#renderOverflowDots(hiddenColors, hiddenCount)}
        </button>
      `;
    }

    return html`
      <div class="day-overflow-indicator-anchor">
        <button
          type="button"
          class="day-label day-overflow-button day-overflow-toggle"
          style=${styleMap(buttonStyle)}
          .ariaLabel=${accessibilityLabel}
          aria-haspopup="dialog"
          popovertarget=${popoverId}
          popovertargetaction="toggle"
          tabindex="0"
          @click=${() => this.#prepareOverflowPopover(popoverId)}
        >
          ${this.#renderOverflowDots(hiddenColors, hiddenCount)}
        </button>
        ${this.#renderDayOverflowPopover(popoverId, day, dayIndex, anchorName)}
      </div>
    `;
  }

  #renderOverflowDots(colors: string[], hiddenCount: number): TemplateResult {
    const shownColors = colors.slice(0, hiddenCount);
    const hasColors = shownColors.length > 0;
    const fallbackDots = hiddenCount;
    return html`
      <span class="day-overflow-dots" aria-hidden="true">
        ${
          hasColors
            ? shownColors.map(
                (color) =>
                  html`<span class="day-overflow-dot" style=${styleMap({ "background-color": color })}></span>`
              )
            : Array.from(
                { length: fallbackDots },
                () => html`<span class="day-overflow-dot"></span>`
              )
        }
      </span>
    `;
  }

  #renderDayOverflowPopover(
    popoverId: string,
    day: Temporal.PlainDate,
    dayIndex: number,
    anchorName: string
  ): TemplateResult {
    const shouldRenderContent = this.#activeOverflowPopoverId === popoverId;
    const dayEvents = shouldRenderContent ? this.#eventsForDay(day) : [];
    const fullDateLabel = new Intl.DateTimeFormat(this.lang, { dateStyle: "full" }).format(
      new Date(Date.UTC(day.year, day.month - 1, day.day))
    );
    const popoverEvents: DayOverflowPopoverEvent[] = dayEvents.map(([id, event]) => ({
      id,
      start: this.#toEventDateTimeString(event.data.start, this.#isAllDayEvent(event)),
      end: this.#toEventDateTimeString(resolvedDataEnd(event.data), this.#isAllDayEvent(event)),
      summary: event.data.summary,
      color: event.data.color,
      hidden: false,
    }));
    const dayLabel = this.#getPopoverDayLabel(day, dayIndex);
    const isCurrentDay =
      Temporal.PlainDate.compare(day, this.#resolvedCurrentDateTime.toPlainDate()) === 0;
    const outsideVisibleMonth = this.#isOutsideVisibleMonth(day);

    return html`
      <day-overflow-popover
        id=${popoverId}
        popover="auto"
        role="dialog"
        .ariaLabel=${`Events on ${fullDateLabel}`}
        style=${styleMap({
          "position-anchor": anchorName,
        })}
        .dayIso=${day.toString()}
        .dayLabel=${dayLabel}
        ?is-current-day=${isCurrentDay}
        ?outside-visible-month=${outsideVisibleMonth}
        ?is-weekend=${this.#weekendDays.has(day.dayOfWeek)}
        .events=${popoverEvents}
        @day-label-selection=${(event: Event) =>
          this.#handlePopoverDaySelection(day, dayIndex, event)}
        @toggle=${this.#handleOverflowPopoverToggle}
        @select=${this.#handleEventSelect}
        @update=${this.#handleEventUpdate}
        @delete=${this.#handleEventDelete}
      ></day-overflow-popover>
    `;
  }

  #handleEventSelect = (event: Event) => {
    const detailTarget =
      event instanceof CustomEvent &&
      event.detail &&
      typeof event.detail === "object" &&
      "eventId" in event.detail
        ? (event.detail as EventBase)
        : null;
    const target = detailTarget ?? (event.currentTarget as EventBase | null);
    const key = target?.eventId;
    if (!key) return;
    this.dispatchEvent(
      new CustomEvent("event-selected", {
        detail: { key } satisfies EventSelectionRequestDetail,
      })
    );
  };

  #handleEventUpdate = (event: Event) => {
    const updateSource =
      event instanceof CustomEvent &&
      event.detail &&
      typeof event.detail === "object" &&
      "source" in event.detail
        ? (event.detail as { source?: string }).source
        : undefined;
    if (updateSource !== "interaction") return;
    const updateInputMethod =
      event instanceof CustomEvent &&
      event.detail &&
      typeof event.detail === "object" &&
      "inputMethod" in event.detail
        ? (event.detail as { inputMethod?: string }).inputMethod
        : undefined;

    const detailTarget =
      event instanceof CustomEvent &&
      event.detail &&
      typeof event.detail === "object" &&
      "eventId" in event.detail
        ? (event.detail as EventBase)
        : null;
    const target = detailTarget ?? (event.target as EventBase | null);
    if (!target?.eventId || !target.start || !target.end) return;
    const { event: current, recurrenceId } = this.#resolveSourceEvent(target.eventId);
    const templateAllDay = current?.data.allDay ?? false;
    const nextStart = this.#coerceUpdatedEventDateValue(target.start, templateAllDay);
    const nextEnd = this.#coerceUpdatedEventDateValue(target.end, templateAllDay);
    const detail: EventUpdateRequestDetail = {
      envelope: {
        eventId: current?.eventId ?? target.eventId,
        calendarId: current?.calendarId,
        recurrenceId,
        isException: current ? isCalendarEventException(current) : undefined,
        isRecurring: current ? isCalendarEventRecurring(current) : undefined,
      },
      content: {
        start: nextStart,
        end: nextEnd,
        allDay: current?.data.allDay,
        summary: target.summary,
        color: target.color,
      },
    };
    const eventsAPIUpdate = this.applyUpdateRequestToEventsAPI(detail);
    if (eventsAPIUpdate.handled) {
      if (!eventsAPIUpdate.accepted) {
        this.#restoreRenderedEventRange(target, current, recurrenceId);
        return;
      }
      if (updateInputMethod === "keyboard") {
        this.#pendingKeyboardRefocusEventId = target.eventId;
        this.#startKeyboardRefocusLoop();
      }
      return;
    }
    this.#restoreRenderedEventRange(target, current, recurrenceId);
  };

  #restoreRenderedEventRange(
    target: EventBase,
    current: EventInput | undefined,
    recurrenceId?: string
  ) {
    if (!current) return;

    const data = current.data;
    const dataEnd = resolvedDataEnd(data);

    if (recurrenceId && data.recurrenceRule && !current.recurrenceId) {
      const parsedRecurrence = parseRecurrenceId(recurrenceId, data.allDay ?? false, data.start);
      if (parsedRecurrence) {
        const masterStart = this.#toPlainDateTime(data.start);
        const masterEnd = this.#toPlainDateTime(dataEnd);
        const duration = masterStart.until(masterEnd);
        const occurrenceStart = this.#toPlainDateTime(parsedRecurrence);
        const occurrenceEnd = occurrenceStart.add(duration);
        const restoredStart = this.#coerceUpdatedEventDateValue(
          occurrenceStart,
          data.allDay ?? false
        );
        const restoredEnd = this.#coerceUpdatedEventDateValue(occurrenceEnd, data.allDay ?? false);
        target.start = restoredStart.toString();
        target.end = restoredEnd.toString();
        return;
      }
    }

    target.start = data.start.toString();
    target.end = dataEnd.toString();
  }

  #restorePendingKeyboardEventFocus() {
    const eventId = this.#pendingKeyboardRefocusEventId;
    if (!eventId) return;

    const renderedEvents = this.renderRoot.querySelectorAll<EventBase>(
      "timed-event, all-day-event"
    );
    const target = Array.from(renderedEvents).find(
      (renderedEvent) => renderedEvent.eventId === eventId
    );
    if (!target) return;

    const interactionSurface =
      target.shadowRoot?.querySelector<HTMLElement>(".interaction-surface");
    if (!interactionSurface) return;

    interactionSurface.focus({ preventScroll: true });
  }

  #startKeyboardRefocusLoop() {
    this.#cancelKeyboardRefocusLoop();
    this.#keyboardRefocusAttemptsRemaining = 10;
    this.#runKeyboardRefocusAttempt();
  }

  #runKeyboardRefocusAttempt() {
    this.#restorePendingKeyboardEventFocus();
    if (this.#keyboardRefocusAttemptsRemaining <= 0) {
      this.#pendingKeyboardRefocusEventId = null;
      this.#keyboardRefocusRafId = null;
      return;
    }
    this.#keyboardRefocusAttemptsRemaining -= 1;
    this.#keyboardRefocusRafId = requestAnimationFrame(() => {
      this.#runKeyboardRefocusAttempt();
    });
  }

  #cancelKeyboardRefocusLoop() {
    if (this.#keyboardRefocusRafId !== null) {
      cancelAnimationFrame(this.#keyboardRefocusRafId);
      this.#keyboardRefocusRafId = null;
    }
    this.#keyboardRefocusAttemptsRemaining = 0;
  }

  #handleEventDelete = (event: Event) => {
    const detailTarget =
      event instanceof CustomEvent ? ((event.detail as EventBase | null) ?? null) : null;
    const target = detailTarget ?? (event.target as EventBase | null);
    if (!target?.eventId) return;
    const { event: current, recurrenceId } = this.#resolveSourceEvent(target.eventId);
    const calendarId = current?.calendarId;
    const eventId = current?.eventId ?? target.eventId;
    const detail: EventDeleteRequestDetail = {
      envelope: {
        calendarId,
        eventId,
        recurrenceId,
        isRecurring: current ? isCalendarEventRecurring(current) : undefined,
      },
    };
    this.applyDeleteRequestToEventsAPI(detail);
  };

  #renderDayNumber(day: Temporal.PlainDate, dayIndex: number): TemplateResult {
    const cols = this.#isMonthView ? this.daysPerRow : this.daysPerWeek;
    const totalDays = this.viewDays.length;
    if (cols <= 0 || totalDays <= 0) return html``;

    const days = this.viewDays;
    const currentDay = this.#resolvedCurrentDateTime.toPlainDate();
    const monthFormatter = new Intl.DateTimeFormat(this.lang, { month: "short" });
    const dayFormatter = new Intl.NumberFormat(this.lang);
    const fullDateFormatter = new Intl.DateTimeFormat(this.lang, { dateStyle: "full" });
    const colIndex = this.#isMonthView ? dayIndex % cols : dayIndex;
    const visualColIndex = this.#toVisualColumnIndex(colIndex, cols);
    const rowIndex = this.#isMonthView ? Math.floor(dayIndex / cols) : 0;
    const top = this.#isMonthView ? (rowIndex / this.gridRows) * 100 : 0;
    const compactMonthView = this.#isCompactMonthView;
    const opensCompactOverflowPopover =
      compactMonthView && this.variant === "all-day" && this.#isMonthView;
    const previousDay = dayIndex > 0 ? days[dayIndex - 1] : null;
    const startsNewMonth =
      previousDay === null || previousDay.month !== day.month || previousDay.year !== day.year;
    const monthPrefix =
      startsNewMonth && !compactMonthView
        ? monthFormatter.format(new Date(Date.UTC(day.year, day.month - 1, day.day)))
        : "";
    const dayLabel = dayFormatter.format(day.day);
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
    const compactPopoverId = `day-overflow-popover-${this.#instanceToken}-${dayIndex}`;
    const compactPopoverAnchorName = `--day-overflow-anchor-${this.#instanceToken}-${dayIndex}`;
    const dayLabelStyle = opensCompactOverflowPopover
      ? { ...startOffsetStyle, "anchor-name": compactPopoverAnchorName }
      : startOffsetStyle;

    return html`
      <button
        type="button"
        class="day-label day-grid-label ${compactMonthView ? "is-compact" : "is-standard"} ${monthPrefix ? "has-month-prefix" : "no-month-prefix"} ${isCurrentDay ? "current-day" : ""} ${outsideVisibleMonth ? "outside-month-day-label" : ""}"
        .ariaLabel=${fullDateLabel}
        .ariaCurrent=${isCurrentDay ? "date" : null}
        .ariaHasPopup=${opensCompactOverflowPopover ? "dialog" : null}
        popovertarget=${ifDefined(opensCompactOverflowPopover ? compactPopoverId : undefined)}
        popovertargetaction=${ifDefined(opensCompactOverflowPopover ? "toggle" : undefined)}
        style=${styleMap(dayLabelStyle)}
        @click=${(event: MouseEvent) => this.#handleDayLabelClick(day, dayIndex, event)}
        @keydown=${(event: KeyboardEvent) => this.#handleDayLabelKeyDown(day, dayIndex, event)}
      >
        <time datetime=${day.toString()}>
          ${monthPrefix ? html`<span class="day-label-month-prefix">${monthPrefix}</span>` : ""}
          <span class="day-label-day-number">${dayLabel}</span>
        </time>
      </button>
      ${
        opensCompactOverflowPopover
          ? this.#renderDayOverflowPopover(
              compactPopoverId,
              day,
              dayIndex,
              compactPopoverAnchorName
            )
          : ""
      }
    `;
  }

  #handleDayLabelClick(day: Temporal.PlainDate, dayIndex: number, event: MouseEvent) {
    if (this.#shouldOpenCompactMonthOverflowPopover()) {
      this.#prepareOverflowPopover(`day-overflow-popover-${this.#instanceToken}-${dayIndex}`);
      return;
    }
    this.#emitDaySelectionRequestedEvent(day, dayIndex, "click", "mouse", event);
  }

  #handleDayLabelKeyDown(day: Temporal.PlainDate, dayIndex: number, event: KeyboardEvent) {
    if (this.#shouldOpenCompactMonthOverflowPopover()) {
      return;
    }
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    this.#emitDaySelectionRequestedEvent(day, dayIndex, "keyboard", "keyboard", event);
  }

  #shouldOpenCompactMonthOverflowPopover(): boolean {
    return this.variant === "all-day" && this.#isCompactMonthView && this.#isMonthView;
  }

  #shouldDisableAllDayInteractionInCompactMonth(): boolean {
    return this.variant === "all-day" && this.#isCompactMonthView && this.#isMonthView;
  }

  #emitDaySelectionRequestedEvent(
    day: Temporal.PlainDate,
    dayIndex: number,
    trigger: "click" | "keyboard",
    pointerType: string,
    sourceEvent: Event
  ) {
    this.dispatchEvent(
      new CustomEvent("day-selection", {
        detail: {
          date: day.toString(),
          dayIndex,
          trigger,
          pointerType,
          sourceEvent,
        },
      })
    );
  }

  #handleCreatePointerDown = (event: PointerEvent) => {
    if (this.#pendingCreatePointer) return;
    if (!this.#isCreateEligibleTarget(event.target)) return;
    if (event.pointerType !== "touch" && event.button !== 0) return;

    const startHit = this.#resolveCreateHitFromPoint(event.clientX, event.clientY);
    if (!startHit) return;

    const section = event.currentTarget as HTMLElement | null;
    if (section) {
      try {
        section.setPointerCapture(event.pointerId);
      } catch {
        // Ignore pointer capture failures from synthetic/unsupported pointers.
      }
    }

    let longPressTimerId: number | null = null;
    if (event.pointerType === "touch") {
      longPressTimerId = window.setTimeout(() => {
        const pending = this.#pendingCreatePointer;
        if (!pending || pending.pointerId !== event.pointerId || pending.pointerType !== "touch")
          return;
        pending.longPressActivated = true;
        pending.dragActivated = true;
        this.#setCreateInteractionLockActive(true);
        pending.currentDateTime =
          this.variant === "timed"
            ? this.#defaultCreateEndDateTime(pending.startDateTime)
            : pending.startDateTime.toPlainDate().toPlainDateTime({
                hour: 0,
                minute: 0,
                second: 0,
                millisecond: 0,
                microsecond: 0,
                nanosecond: 0,
              });
        pending.longPressTimerId = null;
        this.requestUpdate();
      }, CREATE_TOUCH_LONG_PRESS_MS);
    }

    this.#startGlobalCreatePointerTracking();

    this.#pendingCreatePointer = {
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      startClientX: event.clientX,
      startClientY: event.clientY,
      currentClientY: event.clientY,
      startDateTime: startHit.dateTime,
      startDayIndex: startHit.dayIndex,
      currentDayIndex: startHit.dayIndex,
      currentDateTime: startHit.dateTime,
      dragActivated: false,
      longPressActivated: false,
      longPressTimerId,
      captureTarget: section,
    };
  };

  #handleCreatePointerMove = (event: PointerEvent) => {
    const pending = this.#pendingCreatePointer;
    if (!pending || pending.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - pending.startClientX;
    const deltaY = event.clientY - pending.startClientY;
    const pointerDistance = Math.hypot(deltaX, deltaY);
    if (pending.pointerType === "touch") {
      if (!pending.longPressActivated && pointerDistance >= CREATE_TOUCH_CANCEL_DISTANCE_PX) {
        this.#cancelPendingCreatePointer(event, event.currentTarget as HTMLElement | null);
        return;
      }
      if (!pending.longPressActivated) return;
      if (event.cancelable) {
        event.preventDefault();
      }
      const hoverHit = this.#resolveCreateHitFromPoint(event.clientX, event.clientY);
      if (!hoverHit) return;
      pending.currentClientY = event.clientY;
      pending.currentDayIndex = hoverHit.dayIndex;
      pending.currentDateTime = hoverHit.dateTime;
      this.#dragHoverDayIndex = null;
      this.#dragHoverTime = null;
      this.requestUpdate();
      return;
    }

    if (!pending.dragActivated && pointerDistance >= CREATE_DRAG_ACTIVATION_DISTANCE_PX) {
      pending.dragActivated = true;
      this.#setCreateInteractionLockActive(true);
    }
    if (!pending.dragActivated) return;

    const hoverHit = this.#resolveCreateHitFromPoint(event.clientX, event.clientY);
    if (!hoverHit) return;
    pending.currentClientY = event.clientY;
    pending.currentDayIndex = hoverHit.dayIndex;
    pending.currentDateTime = hoverHit.dateTime;
    // Keep the create interaction visual focused on the growing preview block.
    this.#dragHoverDayIndex = null;
    this.#dragHoverTime = null;
    this.requestUpdate();
  };

  #handleCreatePointerUp = (event: PointerEvent) => {
    const pending = this.#pendingCreatePointer;
    if (!pending || pending.pointerId !== event.pointerId) return;
    const section = event.currentTarget as HTMLElement | null;

    if (pending.pointerType === "touch") {
      if (!pending.longPressActivated) {
        this.#cancelPendingCreatePointer(event, section);
        return;
      }
      let startDateTime = pending.startDateTime;
      let endDateTime = pending.currentDateTime;
      if (Temporal.PlainDateTime.compare(endDateTime, startDateTime) < 0) {
        [startDateTime, endDateTime] = [endDateTime, startDateTime];
      }
      if (
        this.variant === "timed" &&
        Temporal.PlainDateTime.compare(startDateTime, endDateTime) === 0
      ) {
        endDateTime = this.#defaultCreateEndDateTime(startDateTime);
      }
      if (this.variant === "all-day") {
        const startDate = startDateTime.toPlainDate();
        const endDateInclusive = endDateTime.toPlainDate();
        const endExclusive = endDateInclusive.add({ days: 1 });
        this.#emitEventCreateRequested({
          start: startDate.toPlainDateTime({ hour: 0, minute: 0, second: 0 }),
          end: endExclusive.toPlainDateTime({ hour: 0, minute: 0, second: 0 }),
          allDay: true,
          summary: this.defaultEventSummary,
          color: this.defaultEventColor,
          calendarId: this.defaultCalendarId,
        });
        this.#cancelPendingCreatePointer(event, section);
        return;
      }
      this.#emitEventCreateRequested({
        start: startDateTime,
        end: endDateTime,
        summary: this.defaultEventSummary,
        color: this.defaultEventColor,
        calendarId: this.defaultCalendarId,
      });
      this.#cancelPendingCreatePointer(event, section);
      return;
    }

    if (!pending.dragActivated) {
      this.#cancelPendingCreatePointer(event, section);
      return;
    }

    const endHit = this.#resolveCreateHitFromPoint(event.clientX, event.clientY);
    if (!endHit) {
      this.#cancelPendingCreatePointer(event, section);
      return;
    }

    let startDateTime = pending.startDateTime;
    let endDateTime = endHit.dateTime;
    if (Temporal.PlainDateTime.compare(endDateTime, startDateTime) < 0) {
      [startDateTime, endDateTime] = [endDateTime, startDateTime];
    }
    if (
      this.variant === "timed" &&
      Temporal.PlainDateTime.compare(startDateTime, endDateTime) === 0
    ) {
      this.#cancelPendingCreatePointer(event, section);
      return;
    }
    if (this.variant === "all-day") {
      const startDate = startDateTime.toPlainDate();
      const endDateInclusive = endDateTime.toPlainDate();
      const endExclusive = endDateInclusive.add({ days: 1 });
      this.#emitEventCreateRequested({
        start: startDate.toPlainDateTime({ hour: 0, minute: 0, second: 0 }),
        end: endExclusive.toPlainDateTime({ hour: 0, minute: 0, second: 0 }),
        allDay: true,
        summary: this.defaultEventSummary,
        color: this.defaultEventColor,
        calendarId: this.defaultCalendarId,
      });
      this.#cancelPendingCreatePointer(event, section);
      return;
    }

    this.#emitEventCreateRequested({
      start: startDateTime,
      end: endDateTime,
      summary: this.defaultEventSummary,
      color: this.defaultEventColor,
      calendarId: this.defaultCalendarId,
    });
    this.#cancelPendingCreatePointer(event, section);
  };

  #handleCreatePointerCancel = (event: PointerEvent) => {
    const pending = this.#pendingCreatePointer;
    if (!pending || pending.pointerId !== event.pointerId) return;
    this.#cancelPendingCreatePointer(event, event.currentTarget as HTMLElement | null);
  };

  #cancelPendingCreatePointer(event?: PointerEvent, section?: HTMLElement | null) {
    const pending = this.#pendingCreatePointer;
    if (pending?.longPressTimerId != null) {
      clearTimeout(pending.longPressTimerId);
    }
    this.#stopGlobalCreatePointerTracking();
    if (event && section) {
      try {
        if (section.hasPointerCapture(event.pointerId)) {
          section.releasePointerCapture(event.pointerId);
        }
      } catch {
        // No-op if pointer capture is unavailable/released already.
      }
    } else if (event && pending?.captureTarget) {
      try {
        if (pending.captureTarget.hasPointerCapture(event.pointerId)) {
          pending.captureTarget.releasePointerCapture(event.pointerId);
        }
      } catch {
        // No-op if pointer capture is unavailable/released already.
      }
    }
    this.#pendingCreatePointer = null;
    this.#setCreateInteractionLockActive(false);
    if (this.#dragHoverDayIndex !== null || this.#dragHoverTime !== null) {
      this.#dragHoverDayIndex = null;
      this.#dragHoverTime = null;
      this.requestUpdate();
    }
  }

  #setCreateInteractionLockActive(active: boolean) {
    if (this.#createInteractionLockActive === active) return;
    this.#createInteractionLockActive = active;
    this.#emitInteractionLockChange({
      active,
      kind: "create",
      interactionId: `create:${this.variant}`,
    });
  }

  #handleEventInteractionDragState = (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const target = event.currentTarget as EventBase | null;
    const interactionId = target?.eventId || "unknown";
    this.#emitInteractionLockChange({
      active: Boolean(event.detail?.isDragging),
      kind: "drag",
      interactionId: `drag:${interactionId}`,
    });
  };

  #emitInteractionLockChange(input: {
    active: boolean;
    kind: "create" | "drag";
    interactionId: string;
  }) {
    this.dispatchEvent(
      new CustomEvent("interaction-lock-change", {
        detail: input,
        bubbles: true,
        composed: true,
      })
    );
  }

  #isCreateEligibleTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false;
    return !target.closest(
      "timed-event, all-day-event, .day-label, .day-overflow-button, day-overflow-popover, button, a, input, select, textarea"
    );
  }

  #resolveTimedHitFromPoint(
    clientX: number,
    clientY: number
  ): { dayIndex: number; time: Temporal.PlainTime; dateTime: Temporal.PlainDateTime } | null {
    const section = this.renderRoot.querySelector("section");
    if (!section || this.daysPerWeek <= 0) return null;
    const bounds = section.getBoundingClientRect();
    if (!Number.isFinite(bounds.width) || !Number.isFinite(bounds.height)) return null;
    if (bounds.width <= 0 || bounds.height <= 0) return null;
    const days = this.viewDays;
    if (!days.length) return null;

    const boundedX = Math.max(0, Math.min(bounds.width - Number.EPSILON, clientX - bounds.left));
    const boundedY = Math.max(0, Math.min(bounds.height - Number.EPSILON, clientY - bounds.top));
    const visualDayIndex = Math.floor((boundedX / bounds.width) * this.daysPerWeek);
    const dayIndex = this.#isRtl ? this.daysPerWeek - visualDayIndex - 1 : visualDayIndex;
    const day = days[dayIndex];
    if (!day) return null;

    const fractionY = boundedY / bounds.height;
    const time = this.#snappedTimeFromFraction(fractionY);
    return {
      dayIndex,
      time,
      dateTime: day.toPlainDateTime(time),
    };
  }

  #resolveAllDayHitFromPoint(clientX: number, clientY: number): CreateHit | null {
    const section = this.renderRoot.querySelector("section");
    if (!section || this.daysPerWeek <= 0) return null;
    const bounds = section.getBoundingClientRect();
    if (!Number.isFinite(bounds.width) || !Number.isFinite(bounds.height)) return null;
    if (bounds.width <= 0 || bounds.height <= 0) return null;
    const days = this.viewDays;
    if (!days.length) return null;

    const cols = this.#isMonthView ? this.daysPerRow : this.daysPerWeek;
    const rows = this.#isMonthView ? this.gridRows : 1;
    if (cols <= 0 || rows <= 0) return null;

    const boundedX = Math.max(0, Math.min(bounds.width - Number.EPSILON, clientX - bounds.left));
    const boundedY = Math.max(0, Math.min(bounds.height - Number.EPSILON, clientY - bounds.top));
    const visualColIndex = Math.floor((boundedX / bounds.width) * cols);
    const colIndex = this.#isRtl ? cols - visualColIndex - 1 : visualColIndex;
    const rowIndex = Math.floor((boundedY / bounds.height) * rows);
    const dayIndex = rowIndex * cols + colIndex;
    const day = days[dayIndex];
    if (!day) return null;

    return {
      dayIndex,
      dateTime: day.toPlainDateTime({
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
        microsecond: 0,
        nanosecond: 0,
      }),
    };
  }

  #resolveCreateHitFromPoint(clientX: number, clientY: number): CreateHit | null {
    if (this.variant === "timed") {
      return this.#resolveTimedHitFromPoint(clientX, clientY);
    }
    return this.#resolveAllDayHitFromPoint(clientX, clientY);
  }

  #snappedTimeFromFraction(fractionY: number): Temporal.PlainTime {
    const clampedFraction = Math.max(0, Math.min(0.999999, fractionY));
    const incrementSeconds = Math.max(60, Math.round(this.#snapInterval * 60));
    const targetSeconds = Math.round(clampedFraction * SECONDS_IN_DAY);
    const snappedSeconds = Math.round(targetSeconds / incrementSeconds) * incrementSeconds;
    const maxSeconds = Math.max(0, SECONDS_IN_DAY - incrementSeconds);
    const normalizedSeconds = Math.max(0, Math.min(maxSeconds, snappedSeconds));
    const hour = Math.floor(normalizedSeconds / 3600);
    const minute = Math.floor((normalizedSeconds % 3600) / 60);
    return Temporal.PlainTime.from({ hour, minute, second: 0 });
  }

  #defaultCreateEndDateTime(startDateTime: Temporal.PlainDateTime): Temporal.PlainDateTime {
    const tentativeEnd = startDateTime.add({ minutes: DEFAULT_TIMED_CREATE_DURATION_MINUTES });
    const dayEnd = startDateTime.toPlainDate().add({ days: 1 }).toPlainDateTime({
      hour: 0,
      minute: 0,
      second: 0,
      millisecond: 0,
      microsecond: 0,
      nanosecond: 0,
    });
    if (Temporal.PlainDateTime.compare(tentativeEnd, dayEnd) > 0) {
      return dayEnd;
    }
    return tentativeEnd;
  }

  #getCreatePreviewCardModels(): Array<{
    firstSegment: boolean;
    lastSegment: boolean;
    timeLabel: string;
    segmentDirection: "horizontal" | "vertical";
    style: Record<string, string>;
  }> {
    if (this.daysPerWeek <= 0) return [];
    const pending = this.#pendingCreatePointer;
    if (!pending || !pending.dragActivated) return [];

    let startDateTime = pending.startDateTime;
    let endDateTime = pending.currentDateTime;
    if (Temporal.PlainDateTime.compare(endDateTime, startDateTime) < 0) {
      [startDateTime, endDateTime] = [endDateTime, startDateTime];
    }
    if (this.variant === "timed") {
      if (Temporal.PlainDateTime.compare(startDateTime, endDateTime) === 0) {
        endDateTime = startDateTime.add({ minutes: Math.max(this.#snapInterval, 5) });
      }
      const minDurationHours = Math.max(this.#snapInterval, 5) / 60;
      if (
        Temporal.PlainDate.compare(startDateTime.toPlainDate(), endDateTime.toPlainDate()) === 0 &&
        Temporal.PlainDateTime.compare(endDateTime, startDateTime) > 0
      ) {
        const startHour =
          startDateTime.hour +
          startDateTime.minute / 60 +
          startDateTime.second / 3600 +
          startDateTime.millisecond / 3_600_000;
        const endHour =
          endDateTime.hour +
          endDateTime.minute / 60 +
          endDateTime.second / 3600 +
          endDateTime.millisecond / 3_600_000;
        if (endHour - startHour < minDurationHours) {
          endDateTime = startDateTime.add({ minutes: Math.max(this.#snapInterval, 5) });
        }
      }
    }

    const startDate = startDateTime.toPlainDate();
    const endDate = endDateTime.toPlainDate();
    const visibleDays = this.viewDays;
    const segmentDayIndices = visibleDays
      .map((day, index) => ({ day, index }))
      .filter(({ day }) => {
        return (
          Temporal.PlainDate.compare(day, startDate) >= 0 &&
          Temporal.PlainDate.compare(day, endDate) <= 0
        );
      });
    if (!segmentDayIndices.length) return [];

    const colorStyles = getEventColorStyles(this.defaultEventColor);
    if (this.variant === "timed") {
      const timeLabel = this.#formatCreatePreviewTimeRange(startDateTime, endDateTime);

      return segmentDayIndices.map(({ day, index: dayIndex }, segmentIndex) => {
        const isStartDay = Temporal.PlainDate.compare(day, startDate) === 0;
        const isEndDay = Temporal.PlainDate.compare(day, endDate) === 0;
        const startHour =
          startDateTime.hour +
          startDateTime.minute / 60 +
          startDateTime.second / 3600 +
          startDateTime.millisecond / 3_600_000;
        const endHour =
          endDateTime.hour +
          endDateTime.minute / 60 +
          endDateTime.second / 3600 +
          endDateTime.millisecond / 3_600_000;
        const top = isStartDay ? (startHour / 24) * 100 : 0;
        const bottom = isEndDay ? Math.max(0, 100 - (endHour / 24) * 100) : 0;
        const left = (dayIndex / this.daysPerWeek) * 100;

        return {
          firstSegment: segmentIndex === 0,
          lastSegment: segmentIndex === segmentDayIndices.length - 1,
          timeLabel: segmentIndex === 0 ? timeLabel : "",
          segmentDirection: "vertical",
          style: {
            ...colorStyles,
            top: `${top}%`,
            bottom: `${bottom}%`,
            "z-index": "12",
            "--_lc-left": `${left}%`,
            "--_lc-width": "1",
            "--_lc-margin-left": "0",
            "--_lc-indentation": "0px",
            "--_lc-inline-inset-start": "1px",
            "--_lc-inline-inset-end": "2px",
            "--_lc-z-index": "12",
          },
        };
      });
    }

    const cols = this.#isMonthView ? this.daysPerRow : this.daysPerWeek;
    if (cols <= 0) return [];
    const laneIndex = this.#getAllDayCreateLaneIndex();
    const rowSegments = new Map<number, { startCol: number; endCol: number }>();
    for (const { index: dayIndex } of segmentDayIndices) {
      const rowIndex = this.#isMonthView ? Math.floor(dayIndex / cols) : 0;
      const colIndex = this.#isMonthView ? dayIndex % cols : dayIndex;
      const existing = rowSegments.get(rowIndex);
      if (!existing) {
        rowSegments.set(rowIndex, { startCol: colIndex, endCol: colIndex });
      } else {
        existing.startCol = Math.min(existing.startCol, colIndex);
        existing.endCol = Math.max(existing.endCol, colIndex);
      }
    }

    const orderedRows = Array.from(rowSegments.entries()).sort(([a], [b]) => a - b);
    return orderedRows.map(([rowIndex, segment], segmentIndex) => {
      const widthInColumns = segment.endCol - segment.startCol + 1;
      const left = (segment.startCol / cols) * 100;
      const inlineInsetStart = this.#isMonthView ? "2px" : "1px";
      const inlineInsetEnd = this.#isMonthView ? "1px" : "2px";
      const top = this.#isMonthView
        ? `calc(var(--_lc-row-height, 100%) * ${rowIndex} + var(--_lc-all-day-day-number-space) + var(--_lc-event-height, 32px) * ${laneIndex})`
        : `calc(var(--_lc-all-day-day-number-space) + var(--_lc-event-height, 32px) * ${laneIndex})`;

      return {
        firstSegment: segmentIndex === 0,
        lastSegment: segmentIndex === orderedRows.length - 1,
        timeLabel: "",
        segmentDirection: "horizontal",
        style: {
          ...colorStyles,
          top,
          height: "var(--_lc-event-height, 32px)",
          "z-index": "12",
          "--_lc-left": `${left}%`,
          "--_lc-width": `${widthInColumns}`,
          "--_lc-margin-left": "0",
          "--_lc-indentation": "0px",
          "--_lc-inline-inset-start": inlineInsetStart,
          "--_lc-inline-inset-end": inlineInsetEnd,
          "--_lc-z-index": "12",
        },
      };
    });
  }

  #getAllDayCreateLaneIndex(): number {
    const pending = this.#pendingCreatePointer;
    if (!pending) return 0;
    const section = this.renderRoot.querySelector("section");
    if (!section) return 0;
    const bounds = section.getBoundingClientRect();
    if (!Number.isFinite(bounds.height) || bounds.height <= 0) return 0;

    const cols = this.#isMonthView ? this.daysPerRow : this.daysPerWeek;
    const rows = this.#isMonthView ? this.gridRows : 1;
    if (cols <= 0 || rows <= 0) return 0;
    const activeRowIndex = this.#isMonthView ? Math.floor(pending.currentDayIndex / cols) : 0;
    const rowHeightPx = bounds.height / rows;
    if (!Number.isFinite(rowHeightPx) || rowHeightPx <= 0) return 0;

    const style = getComputedStyle(this);
    const dayNumberSpacePx = this.#readPxVar(style, "--_lc-all-day-day-number-space", 36);
    const eventHeightPx = this.#readPxVar(style, "--_lc-event-height", 32);
    const laneAreaPx = Math.max(0, rowHeightPx - dayNumberSpacePx);
    const maxLaneIndex = Math.max(0, Math.floor((laneAreaPx - 1) / Math.max(1, eventHeightPx)));
    const rowTopPx = bounds.top + activeRowIndex * rowHeightPx;
    const localY = pending.currentClientY - rowTopPx - dayNumberSpacePx;
    const laneIndex = Math.floor(localY / Math.max(1, eventHeightPx));
    return Math.max(0, Math.min(maxLaneIndex, laneIndex));
  }

  #readPxVar(style: CSSStyleDeclaration, name: string, fallback: number): number {
    const raw = style.getPropertyValue(name).trim();
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  #formatCreatePreviewTimeRange(
    startDateTime: Temporal.PlainDateTime,
    endDateTime: Temporal.PlainDateTime
  ): string {
    return formatShortTimeRange(this.lang, startDateTime, endDateTime);
  }

  #startGlobalCreatePointerTracking() {
    window.addEventListener("pointermove", this.#handleCreatePointerMove, true);
    window.addEventListener("pointerup", this.#handleCreatePointerUp, true);
    window.addEventListener("pointercancel", this.#handleCreatePointerCancel, true);
    window.addEventListener("touchmove", this.#createTouchMoveBlocker, {
      capture: true,
      passive: false,
    });
  }

  #stopGlobalCreatePointerTracking() {
    window.removeEventListener("pointermove", this.#handleCreatePointerMove, true);
    window.removeEventListener("pointerup", this.#handleCreatePointerUp, true);
    window.removeEventListener("pointercancel", this.#handleCreatePointerCancel, true);
    window.removeEventListener("touchmove", this.#createTouchMoveBlocker, true);
  }

  #emitEventCreateRequested(input: EventCreateRequestEmitInput) {
    const detail: EventCreateRequestDetail = {
      envelope: {
        calendarId: input.calendarId,
      },
      content: {
        start: input.start,
        end: input.end,
        allDay: input.allDay,
        summary: input.summary,
        color: input.color,
      },
    };
    this.applyCreateRequestToEventsAPI(detail);
  }

  #eventsForDay(day: Temporal.PlainDate): EventEntry[] {
    return this.#sortedEvents.filter(([, event]) => this.#eventOverlapsDay(event, day));
  }

  #eventOverlapsDay(event: EventInput, day: Temporal.PlainDate): boolean {
    const start = this.#toPlainDateTime(event.data.start);
    const end = this.#toPlainDateTime(resolvedDataEnd(event.data));
    if (Temporal.PlainDateTime.compare(end, start) <= 0) return false;

    const dayStart = day.toPlainDateTime({
      hour: 0,
      minute: 0,
      second: 0,
      millisecond: 0,
      microsecond: 0,
      nanosecond: 0,
    });
    const dayEnd = day.add({ days: 1 }).toPlainDateTime({
      hour: 0,
      minute: 0,
      second: 0,
      millisecond: 0,
      microsecond: 0,
      nanosecond: 0,
    });

    return (
      Temporal.PlainDateTime.compare(start, dayEnd) < 0 &&
      Temporal.PlainDateTime.compare(end, dayStart) > 0
    );
  }

  #getPopoverDayLabel(day: Temporal.PlainDate, dayIndex: number): string {
    const weekdayFormatter = new Intl.DateTimeFormat(this.lang, { weekday: "short" });
    const dayFormatter = new Intl.NumberFormat(this.lang);
    const monthFormatter = new Intl.DateTimeFormat(this.lang, { month: "short" });
    const compactMonthView = this.#isCompactMonthView;
    const days = this.viewDays;
    const previousDay = dayIndex > 0 ? days[dayIndex - 1] : null;
    const startsNewMonth =
      previousDay === null || previousDay.month !== day.month || previousDay.year !== day.year;
    const monthPrefix =
      startsNewMonth && !compactMonthView
        ? `${monthFormatter.format(new Date(Date.UTC(day.year, day.month - 1, day.day)))} `
        : "";
    const weekday = weekdayFormatter.format(new Date(Date.UTC(day.year, day.month - 1, day.day)));
    return `${weekday} ${monthPrefix}${dayFormatter.format(day.day)}`;
  }

  #prepareOverflowPopover(popoverId: string) {
    const popover = this.renderRoot.querySelector<HTMLElement>(`#${popoverId}`);
    if (popover) {
      this.#setOverflowPopoverInlineAlign(popover);
    }
    if (this.#activeOverflowPopoverId === popoverId) return;
    this.#activeOverflowPopoverId = popoverId;
    this.requestUpdate();
  }

  #measureOverflowPopoverWidth(popover: HTMLElement): number {
    if (popover.matches(":popover-open")) {
      return popover.getBoundingClientRect().width;
    }
    popover.setAttribute("data-measuring", "");
    const width = popover.getBoundingClientRect().width;
    popover.removeAttribute("data-measuring");
    return width;
  }

  #setOverflowPopoverInlineAlign(popover: HTMLElement) {
    const anchorToggle = this.renderRoot.querySelector<HTMLElement>(
      `[popovertarget="${popover.id}"]`
    );
    if (!anchorToggle) return;
    const anchorRect = anchorToggle.getBoundingClientRect();
    const anchorCenterX = (anchorRect.left + anchorRect.right) / 2;
    const popoverWidth = this.#measureOverflowPopoverWidth(popover);
    const viewportMarginPx = 12;
    const availableLeft = anchorCenterX - viewportMarginPx;
    const availableRight = window.innerWidth - viewportMarginPx - anchorCenterX;
    const needsHalfWidth = popoverWidth / 2;

    if (availableLeft >= needsHalfWidth && availableRight >= needsHalfWidth) {
      popover.removeAttribute("data-inline-align");
      return;
    }

    const inlineAlign = anchorCenterX < window.innerWidth / 2 ? "start" : "end";
    popover.setAttribute("data-inline-align", inlineAlign);
  }

  #handleOverflowPopoverToggle = (event: Event) => {
    const target = event.currentTarget as HTMLElement | null;
    if (!target?.id) return;
    const toggleEvent = event as Event & { newState?: "open" | "closed" };
    if (toggleEvent.newState === "open") {
      if (this.#activeOverflowPopoverId !== target.id) {
        this.#activeOverflowPopoverId = target.id;
        this.requestUpdate();
      }
      return;
    }
    if (toggleEvent.newState === "closed" && this.#activeOverflowPopoverId === target.id) {
      this.#activeOverflowPopoverId = null;
      target.removeAttribute("data-inline-align");
      this.requestUpdate();
    }
  };

  #handlePopoverDaySelection(day: Temporal.PlainDate, dayIndex: number, event: Event) {
    if (!(event instanceof CustomEvent)) return;
    const detail =
      (event.detail as
        | {
            trigger?: "click" | "keyboard";
            pointerType?: string;
            sourceEvent?: Event;
          }
        | undefined) ?? {};
    this.#emitDaySelectionRequestedEvent(
      day,
      dayIndex,
      detail.trigger ?? "click",
      detail.pointerType ?? "mouse",
      detail.sourceEvent ?? event
    );
  }

  #renderCurrentTimeIndicator() {
    const days = this.viewDays;
    if (!days.length || this.daysPerWeek <= 0) return "";

    const currentDateTime = this.#resolvedCurrentDateTime;
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
    const visualDayIndex = this.#toVisualColumnIndex(currentDayIndex, this.daysPerWeek);
    const left = (visualDayIndex / this.daysPerWeek) * 100;
    const width = (1 / this.daysPerWeek) * 100;

    return html`
      <div
        class="current-time-indicator"
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
      if (this.#dragHoverDayIndex === null && this.#dragHoverTime === null) return;
      this.#dragHoverDayIndex = null;
      this.#dragHoverTime = null;
      this.requestUpdate();
      return;
    }

    const hover = event.detail;
    if (!hover) {
      if (
        this.#dragHoverDayIndex === null &&
        this.#dragHoverTime === null &&
        this.#dragHoverMaxHeightPx === null
      ) {
        return;
      }
      this.#dragHoverDayIndex = null;
      this.#dragHoverTime = null;
      this.#dragHoverMaxHeightPx = null;
    } else {
      const nextDayIndex = hover.dayIndex ?? null;
      const nextTime = hover.time ?? null;
      const nextGhostMaxHeightPx =
        typeof hover.ghostMaxHeightPx === "number" && Number.isFinite(hover.ghostMaxHeightPx)
          ? Math.max(0, hover.ghostMaxHeightPx)
          : null;
      const unchanged =
        this.#dragHoverDayIndex === nextDayIndex &&
        (this.#dragHoverTime?.toString() ?? null) === (nextTime?.toString() ?? null) &&
        this.#dragHoverMaxHeightPx === nextGhostMaxHeightPx;
      if (unchanged) return;
      this.#dragHoverDayIndex = nextDayIndex;
      this.#dragHoverTime = nextTime;
      this.#dragHoverMaxHeightPx = nextGhostMaxHeightPx;
    }
    this.requestUpdate();
  };

  #compareEventsForRenderOrder([, a]: EventEntry, [, b]: EventEntry): number {
    if (this.variant === "all-day") {
      const aStartDate = this.#toPlainDateTime(a.data.start).toPlainDate();
      const bStartDate = this.#toPlainDateTime(b.data.start).toPlainDate();
      const startDateDiff = Temporal.PlainDate.compare(aStartDate, bStartDate);
      if (startDateDiff !== 0) return startDateDiff;

      // Match AllDayEvent.siblings ordering: longer spans should win lower stack rows.
      const aEndDate = this.#toPlainDateTime(resolvedDataEnd(a.data))
        .subtract({ nanoseconds: 1 })
        .toPlainDate();
      const bEndDate = this.#toPlainDateTime(resolvedDataEnd(b.data))
        .subtract({ nanoseconds: 1 })
        .toPlainDate();
      const endDateDiff = Temporal.PlainDate.compare(aEndDate, bEndDate);
      if (endDateDiff !== 0) return -endDateDiff;

      return a.data.summary.localeCompare(b.data.summary);
    }

    const aStart = this.#toPlainDateTime(a.data.start);
    const bStart = this.#toPlainDateTime(b.data.start);
    const startDiff = Temporal.PlainDateTime.compare(aStart, bStart);
    if (startDiff !== 0) return startDiff;

    const aEnd = this.#toPlainDateTime(resolvedDataEnd(a.data));
    const bEnd = this.#toPlainDateTime(resolvedDataEnd(b.data));
    const endDiff = Temporal.PlainDateTime.compare(aEnd, bEnd);
    if (endDiff !== 0) return endDiff;

    return a.data.summary.localeCompare(b.data.summary);
  }

  #toPlainDateTime(value: Temporal.PlainDateTime): Temporal.PlainDateTime {
    return value;
  }

  #toPlainDateTimeFromString(value: string): Temporal.PlainDateTime {
    if (value.includes("[") && value.includes("]")) {
      return Temporal.ZonedDateTime.from(value).withTimeZone(this.timezone).toPlainDateTime();
    }
    return Temporal.PlainDateTime.from(value);
  }

  #coerceUpdatedEventDateValue(
    updatedValue: Temporal.PlainDateTime,
    templateAllDay: boolean
  ): Temporal.PlainDateTime {
    if (templateAllDay) {
      return updatedValue.toPlainDate().toPlainDateTime({ hour: 0, minute: 0, second: 0 });
    }
    return updatedValue;
  }

  /** Date-only strings for all-day rows so `EventBase` does not treat midnight as a clock time. */
  #toEventDateTimeString(value: Temporal.PlainDateTime, allDay: boolean): string {
    if (allDay) {
      return value.toPlainDate().toString();
    }
    return value.toString();
  }

  #resolveSourceEvent(renderedEventId: string): {
    event: EventInput | undefined;
    recurrenceId?: string;
  } {
    const separatorIndex = renderedEventId.indexOf("::");
    const sourceKey =
      separatorIndex === -1 ? renderedEventId : renderedEventId.slice(0, separatorIndex);
    const recurrenceId =
      separatorIndex === -1 ? undefined : renderedEventId.slice(separatorIndex + 2);
    const event = this.events?.get(renderedEventId) ?? this.events?.get(sourceKey);
    return {
      event,
      recurrenceId: recurrenceId ?? event?.recurrenceId,
    };
  }

  #isAllDayEvent(event: EventInput): boolean {
    return event.data.allDay === true;
  }

  #getAllDayOverflowLayout(): AllDayOverflowLayout {
    if (this.variant !== "all-day") {
      return {
        maxVisibleRows: Number.POSITIVE_INFINITY,
        maxVisibleRowsByDay: new Map(),
        hiddenCountsByDay: new Map(),
        hiddenColorsByDay: new Map(),
        hiddenEventIdsByDay: new Map(),
        forceIndicatorsByDay: new Set(),
      };
    }

    const dayCount = this.viewDays.length;
    const cols = this.#isMonthView ? this.daysPerRow : dayCount;
    if (!dayCount || cols <= 0) {
      return {
        maxVisibleRows: Number.POSITIVE_INFINITY,
        maxVisibleRowsByDay: new Map(),
        hiddenCountsByDay: new Map(),
        hiddenColorsByDay: new Map(),
        hiddenEventIdsByDay: new Map(),
        forceIndicatorsByDay: new Set(),
      };
    }

    const visibleEvents = this.#sortedEvents;
    const eventColorsById = new Map(visibleEvents.map(([id, event]) => [id, event.data.color]));
    const layout = buildAllDayLayout({
      viewDays: this.viewDays,
      daysPerRow: cols,
      items: visibleEvents.map(([id, event]) => this.#toAllDayLayoutItem(id, event)),
    });

    const maxRowsByHeight = this.#getMaxRowsPerCellByHeight();
    if (!Number.isFinite(maxRowsByHeight)) {
      return {
        maxVisibleRows: Number.POSITIVE_INFINITY,
        maxVisibleRowsByDay: new Map(),
        hiddenCountsByDay: new Map(),
        hiddenColorsByDay: new Map(),
        hiddenEventIdsByDay: new Map(),
        forceIndicatorsByDay: new Set(),
      };
    }
    const maxVisibleRows = Math.max(0, maxRowsByHeight);
    const baseDayCaps = new Map<number, number>();
    for (let dayIndex = 0; dayIndex < dayCount; dayIndex += 1) {
      baseDayCaps.set(dayIndex, maxVisibleRows);
    }

    const hiddenCountsByDay = this.#computeHiddenAllDayCountsByDayForDayCaps(layout, baseDayCaps);
    const hiddenEventIdsByDay = this.#computeHiddenAllDayEventIdsByDayForDayCaps(
      layout,
      baseDayCaps
    );
    const hiddenColorsByDay = this.#computeHiddenAllDayColorsByDay(
      hiddenEventIdsByDay,
      eventColorsById
    );
    const initialOverflowLayout: AllDayOverflowLayout = {
      maxVisibleRows,
      maxVisibleRowsByDay: baseDayCaps,
      hiddenCountsByDay,
      hiddenColorsByDay,
      hiddenEventIdsByDay,
      forceIndicatorsByDay: new Set(),
    };

    const daysNeedingButton = new Set<number>();
    for (const [dayIndex, hiddenCount] of hiddenCountsByDay.entries()) {
      if (!this.#shouldRenderAllDayOverflowIndicator(dayIndex, hiddenCount, initialOverflowLayout))
        continue;
      daysNeedingButton.add(dayIndex);
    }
    if (!daysNeedingButton.size) return initialOverflowLayout;

    const rowHeight = this.#getAllDayRowHeightPx();
    const eventHeight = this.#getAllDayEventHeightPx();
    const dayLabelOffset = this.#getAllDayDayNumberOffsetPx();
    const indicatorHeight = this.#getAllDayOverflowIndicatorHeightPx();
    const indicatorBottomInset = 2;
    if (!Number.isFinite(rowHeight) || eventHeight <= 0) {
      return initialOverflowLayout;
    }

    const rowsWithOverflowButton = Math.max(
      0,
      Math.floor(
        (rowHeight - dayLabelOffset - indicatorHeight - indicatorBottomInset) / eventHeight
      )
    );
    const dayCapsWithButton = new Map(baseDayCaps);
    let didReduceAnyDay = false;
    for (const dayIndex of daysNeedingButton) {
      const currentCap = dayCapsWithButton.get(dayIndex) ?? maxVisibleRows;
      const nextCap = Math.min(currentCap, rowsWithOverflowButton);
      if (nextCap < currentCap) {
        dayCapsWithButton.set(dayIndex, nextCap);
        didReduceAnyDay = true;
      }
    }
    if (!didReduceAnyDay) return initialOverflowLayout;

    const hiddenCountsWithButton = this.#computeHiddenAllDayCountsByDayForDayCaps(
      layout,
      dayCapsWithButton
    );
    const hiddenEventIdsWithButton = this.#computeHiddenAllDayEventIdsByDayForDayCaps(
      layout,
      dayCapsWithButton
    );
    const hiddenColorsWithButton = this.#computeHiddenAllDayColorsByDay(
      hiddenEventIdsWithButton,
      eventColorsById
    );
    return {
      maxVisibleRows,
      maxVisibleRowsByDay: dayCapsWithButton,
      hiddenCountsByDay: hiddenCountsWithButton,
      hiddenColorsByDay: hiddenColorsWithButton,
      hiddenEventIdsByDay: hiddenEventIdsWithButton,
      forceIndicatorsByDay: daysNeedingButton,
    };
  }

  #computeHiddenAllDayCountsByDayForDayCaps(
    layout: ReturnType<typeof buildAllDayLayout>,
    dayCaps: Map<number, number>
  ): Map<number, number> {
    const hiddenCountsByDay = new Map<number, number>();

    for (const eventLayout of layout.placedEvents) {
      for (const segment of eventLayout.segments) {
        for (let colIndex = segment.startColIndex; colIndex <= segment.endColIndex; colIndex += 1) {
          const dayIndex = segment.rowIndex * layout.daysPerRow + colIndex;
          const dayCap = dayCaps.get(dayIndex) ?? Number.POSITIVE_INFINITY;
          if (Number.isFinite(dayCap) && segment.stackIndex < dayCap) continue;
          hiddenCountsByDay.set(dayIndex, (hiddenCountsByDay.get(dayIndex) ?? 0) + 1);
        }
      }
    }

    return hiddenCountsByDay;
  }

  #computeHiddenAllDayEventIdsByDayForDayCaps(
    layout: ReturnType<typeof buildAllDayLayout>,
    dayCaps: Map<number, number>
  ): Map<number, string[]> {
    const hiddenEventIdsByDay = new Map<number, string[]>();

    for (const eventLayout of layout.placedEvents) {
      for (const segment of eventLayout.segments) {
        for (let colIndex = segment.startColIndex; colIndex <= segment.endColIndex; colIndex += 1) {
          const dayIndex = segment.rowIndex * layout.daysPerRow + colIndex;
          const dayCap = dayCaps.get(dayIndex) ?? Number.POSITIVE_INFINITY;
          if (Number.isFinite(dayCap) && segment.stackIndex < dayCap) continue;
          const dayIds = hiddenEventIdsByDay.get(dayIndex) ?? [];
          dayIds.push(eventLayout.id);
          hiddenEventIdsByDay.set(dayIndex, dayIds);
        }
      }
    }

    return hiddenEventIdsByDay;
  }

  #computeHiddenAllDayColorsByDay(
    hiddenIdsByDay: Map<number, string[]>,
    eventColorsById: Map<string, string>
  ): Map<number, string[]> {
    const hiddenColorsByDay = new Map<number, string[]>();

    for (const [dayIndex, ids] of hiddenIdsByDay.entries()) {
      const colors: string[] = [];
      const seenColors = new Set<string>();
      for (const id of ids) {
        const color = eventColorsById.get(id);
        if (!color || seenColors.has(color)) continue;
        seenColors.add(color);
        colors.push(color);
      }
      if (colors.length) {
        hiddenColorsByDay.set(dayIndex, colors);
      }
    }

    return hiddenColorsByDay;
  }

  #toAllDayLayoutItem(id: string, event: EventInput): AllDayLayoutItem {
    return {
      id,
      start: this.#toPlainDateTime(event.data.start).toPlainDate(),
      endInclusive: this.#toPlainDateTime(resolvedDataEnd(event.data))
        .subtract({ nanoseconds: 1 })
        .toPlainDate(),
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
    return this.#readSectionCssNumber("--_lc-event-height", 32);
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
      lang: this.lang,
      timezone: this.timezone,
      currentTime: this.currentTime,
    };
    this.#calendarViewProvider.setValue(value);
  }

  protected firstUpdated(changedProperties: PropertyValues<this>) {
    super.firstUpdated(changedProperties);
    this.#syncCompactMonthState();
    this.#syncTimedHostHeightFactor();
  }

  protected willUpdate(changedProperties: PropertyValues<this>) {
    super.willUpdate(changedProperties);
    if (changedProperties.has("daysPerWeek") || changedProperties.has("variant")) {
      this.#syncCompactMonthState();
    }
    if (changedProperties.has("variant") || changedProperties.has("visibleHours")) {
      this.#syncTimedHostHeightFactor();
    }
  }

  #syncTimedHostHeightFactor() {
    const factor = this.#getTimedHostHeightFactor();
    this.style.setProperty("--_lc-host-height-factor", factor.toString());
  }

  #getTimedHostHeightFactor(): number {
    if (this.variant !== "timed") return 1;

    const requestedFactor = 24 / this.visibleHours;
    const minHourHeightPx = this.#readHostCssNumber("--_lc-min-hour-height", 0);
    if (!Number.isFinite(minHourHeightPx) || minHourHeightPx <= 0) {
      return requestedFactor;
    }

    const hostHeight = this.getBoundingClientRect().height;
    if (!Number.isFinite(hostHeight) || hostHeight <= 0) {
      return requestedFactor;
    }

    const timedTopOffset = this.#readHostCssNumber("--_lc-timed-section-top-offset", 0);
    const availableHeight = Math.max(0, hostHeight - Math.max(0, timedTopOffset));
    if (availableHeight <= 0) {
      return requestedFactor;
    }

    const minFactor = (24 * minHourHeightPx) / availableHeight;
    return Math.max(requestedFactor, minFactor);
  }

  #readHostCssNumber(propertyName: string, fallback: number): number {
    const rawValue = getComputedStyle(this).getPropertyValue(propertyName).trim();
    const parsedValue = parseFloat(rawValue);
    return Number.isFinite(parsedValue) ? parsedValue : fallback;
  }
}
