import { Temporal } from "@js-temporal/polyfill";
import { html, nothing, type TemplateResult, unsafeCSS } from "lit";
import { customElement } from "lit/decorators.js";
import { ifDefined } from "lit/directives/if-defined.js";
import { styleMap } from "lit/directives/style-map.js";
import { CalendarViewBase } from "../CalendarViewBase/CalendarViewBase.js";
import { resolvedDataEnd } from "../domain/events-api/eventMapBridge.js";
import "../EventCard/EventCard.js";
import "../CalendarTimeSidebar/CalendarTimeSidebar.js";
import "../DayOverflowPopover/DayOverflowPopover.js";
import type { CalendarEvent as ApiCalendarEvent } from "@lit-calendar/events-api";
import type {
  EventCreateRequestDetail,
  EventDeleteRequestDetail,
  EventSelectionRequestDetail,
  EventUpdateRequestDetail,
} from "../types/CalendarEventRequests.js";
import {
  isCalendarEventException,
  isCalendarEventRecurring,
} from "../types/calendarEventSemantics.js";
import type { DayOverflowPopoverEvent } from "../types/DayOverflowPopover.js";
import type {
  TimeLineLayout,
  TimelineEvent,
  TimelineEventCreateDetail,
  TimelineEventMoveCommitDetail,
  TimelineEventPreviewRange,
  TimelineEventResizeCommitDetail,
} from "../types/TimeLine.js";
import "../TimeLine/TimeLine.js";
import { getLocaleWeekInfo } from "../utils/Locale.js";
import { formatShortTimeRange } from "../utils/TimeFormatting.js";
import {
  alignedMonthGridStart,
  fromTimelineRange,
  fromTimelineValue,
  resolveTimelineEventFilter,
  timelineRangeOverlapsCell,
  toTimelineAllDayRange,
  toTimelineRange,
  toTimelineValue,
  visibleHoursWindow,
  yearMonthStarts,
} from "./CalendarTimelineScale.js";
import componentStyle from "./CalendarTimelineView.css?inline";

const MINUTES_PER_DAY = 24 * 60;
const SECONDS_PER_DAY = MINUTES_PER_DAY * 60;

export type CalendarTimelineViewMode = "day" | "week" | "month" | "gantt" | "year";

type TimelineVariant = "timed" | "all-day";

type TimelineFlow = "vertical" | "horizontal";
type TimelineLayout = TimeLineLayout;

type ModePreset = {
  numDays: number;
  /** `"days"` resolves to the resolved day count (one continuous row for gantt). */
  columns?: number | "days";
  flow: TimelineFlow;
  layout: TimelineLayout;
  height?: "auto";
  variant: TimelineVariant;
};

/* Year mode has no preset: it composes twelve month-mode instances instead of configuring
 * a single <time-line> (see #renderYearGrid). */
const MODE_PRESETS: Record<Exclude<CalendarTimelineViewMode, "year">, ModePreset> = {
  day: { numDays: 1, flow: "vertical", layout: "stagger", variant: "timed" },
  week: { numDays: 7, flow: "vertical", layout: "stagger", variant: "timed" },
  month: {
    numDays: 42,
    columns: 7,
    flow: "horizontal",
    layout: "masonry",
    height: "auto",
    variant: "all-day",
  },
  gantt: { numDays: 7, columns: "days", flow: "horizontal", layout: "timeline", variant: "timed" },
};

type CalendarTimelineEvent = TimelineEvent & {
  key: string;
  summary: string;
  color: string;
  location: string;
  originalStart: Temporal.PlainDateTime;
  originalEnd: Temporal.PlainDateTime;
  allDay: boolean;
  past: boolean;
  recurring: boolean;
  exception: boolean;
};

/* Header/footer templates render inside <time-line>'s shadow root, out of reach of this
 * component's stylesheet, so their chrome is styled inline (same trade-off as the selection
 * ring on event cards). */
const DAY_HEADER_STYLE = [
  "display:flex",
  "align-items:center",
  "gap:6px",
  "min-height:24px",
  "padding:3px 6px",
  "font-size:12px",
  "font-weight:500",
  "line-height:1.2",
  "white-space:nowrap",
  "overflow:hidden",
  "user-select:none",
  "color:var(--_lc-grid-line-day-color, light-dark(rgb(15 23 42 / 72%), rgb(255 255 255 / 72%)))",
].join(";");

const DAY_NUMBER_STYLE = [
  "display:inline-flex",
  "align-items:center",
  "justify-content:center",
  "min-width:20px",
  "height:20px",
  "padding:0 5px",
  "border-radius:999px",
  "font-variant-numeric:tabular-nums",
].join(";");

const DAY_NUMBER_TODAY_STYLE = [
  DAY_NUMBER_STYLE,
  "background:var(--lc-higlight-color, #ff0000)",
  "color:#fff",
  "font-weight:600",
].join(";");

/* Ported from the grid month view's overflow affordance (CalendarGridView.css:
 * `.day-overflow-button` / `.day-overflow-dots` / `.day-overflow-dot`): colored per-event
 * dots next to the "+N more" count, ghost hover background and a focus ring. */
const OVERFLOW_BUTTON_STYLE = [
  "pointer-events:auto",
  "appearance:none",
  "border:0",
  "cursor:pointer",
  "display:flex",
  "align-items:center",
  "justify-content:flex-start",
  "gap:5px",
  "width:100%",
  "min-height:24px",
  "margin:0",
  "padding:2px 8px",
  "border-radius:4px",
  "font-size:12px",
  "font-weight:500",
  "line-height:1",
  "white-space:nowrap",
  "overflow:hidden",
  "text-overflow:ellipsis",
  "text-align:start",
  "user-select:none",
  "color:var(--_lc-grid-line-day-color, light-dark(rgb(15 23 42 / 72%), rgb(255 255 255 / 72%)))",
].join(";");

const OVERFLOW_DOTS_STYLE = ["display:inline-flex", "align-items:center", "gap:3px", "flex:none"].join(
  ";"
);

const OVERFLOW_DOT_STYLE = [
  "width:7px",
  "height:7px",
  "border-radius:var(--lc-event-card-radius, 4px)",
  "opacity:0.85",
  "flex:none",
].join(";");

/* Hover/focus states cannot be expressed inline; this small sheet renders with the footer
 * inside <time-line>'s shadow root (same ghost hover + focus ring as the grid's button).
 * The background lives here too — an inline `background` would outrank the state rules. */
const OVERFLOW_BUTTON_STATE_CSS = `
  .day-overflow-button {
    background: transparent;
  }
  .day-overflow-button:hover:not(:focus-visible) {
    background-color: var(--_lc-grid-ghost-color, light-dark(rgb(15 23 42 / 10%), rgb(255 255 255 / 12%)));
  }
  .day-overflow-button:focus-visible {
    background-color: var(--_lc-grid-ghost-color, light-dark(rgb(15 23 42 / 10%), rgb(255 255 255 / 12%)));
    outline: 2px solid light-dark(rgb(15 23 42 / 92%), rgb(255 255 255 / 96%));
    outline-offset: -2px;
  }
`;

/** Month cells narrower than this degrade to the compact (year-style) treatment. */
const COMPACT_MONTH_CELL_MIN_WIDTH = 72;

/**
 * Compact query threshold on the month layout wrapper: 7 columns × the per-cell minimum.
 * Must stay in sync with the `@container lc-timeline-month` query in CalendarTimelineView.css.
 */
const COMPACT_MONTH_MAX_INLINE_SIZE = 7 * COMPACT_MONTH_CELL_MIN_WIDTH;

/* Month-mode day headers render inside <time-line>'s shadow root (like the overflow footer), so
 * their chrome ships as an injected <style> with the cell-0 header. The base rules replicate the
 * inline-styled day/week header look; MONTH_DAY_HEADER_COMPACT_CSS below is the compact
 * treatment for tiny cells, applied either behind the `lc-timeline-month` container query
 * (standalone month views that shrink) or unconditionally when the instance is composed with
 * `forceCompact` (year mode) — see #monthDayHeaderStyles. The query container is the month
 * layout wrapper in this component's own shadow root — container lookup follows the flat tree,
 * so it resolves from inside <time-line>'s shadow root too. Compound selectors are used where
 * TimeLine's own rules (adopted stylesheets sort after this tree <style>) must lose the tie. */
const MONTH_DAY_HEADER_BASE_CSS = `
  .timeline-day-header {
    /* TimeLine's .viewport disables pointer events; re-enable for the interactive header
       (same as the overflow footer button). */
    pointer-events: auto;
    appearance: none;
    border: 0;
    margin: 0;
    background: transparent;
    cursor: pointer;
    font: inherit;
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    min-height: 24px;
    padding: 3px 6px;
    font-size: 12px;
    font-weight: 500;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    user-select: none;
    text-align: start;
    color: var(--_lc-grid-line-day-color, light-dark(rgb(15 23 42 / 72%), rgb(255 255 255 / 72%)));
  }
  .timeline-day-header:focus-visible {
    outline: 2px solid light-dark(rgb(15 23 42 / 92%), rgb(255 255 255 / 96%));
    outline-offset: -2px;
    border-radius: 4px;
  }
  .timeline-day-header.is-outside-month {
    opacity: 0.45;
  }
  .timeline-day-header.is-weekend:not(.is-outside-month) {
    color: var(--lc-weekend-day-label-color, light-dark(rgb(15 23 42 / 64%), rgb(255 255 255 / 66%)));
  }
  .timeline-day-number {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    padding: 0 5px;
    border-radius: 999px;
    font-variant-numeric: tabular-nums;
  }
  .timeline-day-number.is-today {
    background: var(--lc-higlight-color, #ff0000);
    color: #fff;
    font-weight: 600;
  }
  /* Keep the locale's spacing around the day number ("Jan 1"): flex items trim edge spaces. */
  .timeline-day-month-prefix {
    white-space: pre;
  }
  /* Event-day bullets: hidden at regular size, shown by the compact treatment below. Absolute
     under the day number so it stays perfectly centered in the compact cell. */
  .timeline-day-dots {
    display: none;
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    align-items: center;
    gap: 3px;
    margin-top: 1px;
    pointer-events: none;
  }
  .timeline-day-dot {
    width: 4px;
    height: 4px;
    border-radius: 999px;
    opacity: 0.9;
    flex: none;
  }
`;

const MONTH_DAY_HEADER_COMPACT_CSS = `
  /* Chrome off: no outer border, no per-cell borders. */
  div.viewport {
    border: none;
  }
  .cells > .cell {
    outline: none;
  }
  /* No chips, markers or drag-create surface in tiny cells; the "+N more" footer goes too. */
  .cell > .cell-main,
  .cell > .cell-footer {
    display: none;
  }
  /* The header becomes the whole cell so the day number centers in it. */
  .cell > .cell-header {
    display: flex;
    flex: 1 1 auto;
    min-height: 0;
  }
  .timeline-day-header {
    flex: 1 1 auto;
    justify-content: center;
    gap: 0;
    min-height: 0;
    padding: 0;
  }
  .timeline-day-month-prefix {
    display: none;
  }
  .timeline-day-dots {
    display: inline-flex;
  }
`;

@customElement("calendar-timeline-view")
export class CalendarTimelineView extends CalendarViewBase {
  /**
   * Convenience preset configuring flow/layout/day count/variant for the four calendar modes.
   * Explicitly set individual properties always win over the preset.
   */
  mode?: CalendarTimelineViewMode;
  variant?: TimelineVariant;
  /**
   * Opt-in for the composed all-day row above the timed timeline in day/week (vertical timed)
   * modes, with round-trip gestures and drag-create of whole-day events. Off by default:
   * day/week then show only timed events (a header-only strip keeps the day labels).
   */
  allDayRow = false;
  /**
   * Keeps a month-mode instance in the compact (year-style) treatment regardless of measured
   * width. Year mode sets this on the twelve months it composes: relying only on the size-based
   * container query would leave gaps — the year grid's 1-column breakpoint (512px) exceeds the
   * 504px compact threshold, and 4-column cards outgrow it again on very wide screens
   * ((w − 3·gap) / 4 > 504px once the grid passes ~2208px) — so composed months force it
   * instead. The container query remains for standalone month views that shrink.
   */
  forceCompact = false;
  startDate = Temporal.Now.plainDateISO().toString();
  numDays?: number;
  daysPerWeek?: number;
  columns?: number;
  /** Week start override for the month-mode grid alignment (1 = Monday … 7 = Sunday). */
  weekStart?: number;
  timelineMax = 24 * 60;
  /**
   * Explicit snapping step in raw time-line axis units. When unset, `snapInterval`
   * (minutes, same concept as the grid views) is converted to axis units instead.
   */
  timelineStep?: number;
  /** Snap interval in minutes, mirroring the grid views' `snap-interval` attribute. */
  snapInterval?: number;
  timelineFlow?: TimelineFlow;
  timelineLayout?: TimelineLayout;
  timelineHeight?: "auto" | "";
  /**
   * Grid-parity `visibleHours`: shows only this many hours per day in vertical modes, mapped
   * through the time-line axis window. Unlike the grid (which scrolls the remaining hours into
   * view), hours outside the window are clipped (v1 axis-window limitation).
   */
  visibleHours?: number;
  /** First visible hour when `visibleHours` is active (default 0). */
  visibleHoursStart?: number;
  rtl = false;

  /** Events passed to the timed `<time-line>` in the latest render; commit indexes point here. */
  #renderedTimedEvents: CalendarTimelineEvent[] = [];
  /** Events passed to the all-day `<time-line>` in the latest render. */
  #renderedAllDayEvents: CalendarTimelineEvent[] = [];
  #selectedEventKey: string | null = null;
  /** Set right after a gesture commit so the trailing click does not also select the event. */
  #suppressNextCardSelect = false;
  #suppressNextCardSelectTimeout: ReturnType<typeof setTimeout> | null = null;
  /** Cell whose overflow popover is (being) opened; its popover renders the full event list. */
  #activeOverflowCellIndex: number | null = null;
  /** Cell whose compact-month day-header popover is (being) opened (month/year compact mode). */
  #activeHeaderPopoverCellIndex: number | null = null;

  static get properties() {
    return {
      ...CalendarViewBase.properties,
      mode: { type: String, reflect: true },
      variant: { type: String, reflect: true },
      allDayRow: { type: Boolean, attribute: "all-day-row", reflect: true },
      forceCompact: { type: Boolean, attribute: "force-compact", reflect: true },
      startDate: { type: String, attribute: "start-date" },
      numDays: { type: Number, attribute: "num-days" },
      daysPerWeek: { type: Number, attribute: "days-per-week" },
      columns: { type: Number, attribute: "columns" },
      weekStart: { type: Number, attribute: "week-start" },
      timelineMax: { type: Number, attribute: "timeline-max" },
      timelineStep: { type: Number, attribute: "timeline-step" },
      snapInterval: { type: Number, attribute: "snap-interval" },
      timelineFlow: { type: String, attribute: "timeline-flow" },
      timelineLayout: { type: String, attribute: "timeline-layout" },
      timelineHeight: { type: String, attribute: "timeline-height" },
      visibleHours: { type: Number, attribute: "visible-hours" },
      visibleHoursStart: { type: Number, attribute: "visible-hours-start" },
      rtl: { type: Boolean, reflect: true },
    } as const;
  }

  static get styles() {
    return [...CalendarViewBase.styles, unsafeCSS(componentStyle)];
  }

  disconnectedCallback() {
    if (this.#suppressNextCardSelectTimeout) {
      clearTimeout(this.#suppressNextCardSelectTimeout);
      this.#suppressNextCardSelectTimeout = null;
    }
    super.disconnectedCallback();
  }

  protected willUpdate(changedProperties: Map<string | number | symbol, unknown>): void {
    super.willUpdate(changedProperties);
    if (changedProperties.has("daysPerWeek")) {
      const next = Number(this.daysPerWeek);
      if (Number.isFinite(next) && next > 0) {
        this.numDays = Math.floor(next);
      }
    }
  }

  get #modePreset(): ModePreset | undefined {
    const mode = this.mode;
    if (mode === "day" || mode === "week" || mode === "month" || mode === "gantt") {
      return MODE_PRESETS[mode];
    }
    return undefined;
  }

  get #scale() {
    return {
      startDate: this.#gridStartDate,
      numDays: this.#resolvedNumDays,
      unitsPerDay: this.#resolvedTimelineMax,
    };
  }

  get #parsedStartDate(): Temporal.PlainDate {
    try {
      return Temporal.PlainDate.from(this.startDate);
    } catch {
      return Temporal.Now.plainDateISO();
    }
  }

  /** First rendered day; month mode aligns the 42-cell window to the locale week start. */
  get #gridStartDate(): Temporal.PlainDate {
    if (this.mode === "month") {
      return alignedMonthGridStart(
        this.#parsedStartDate,
        this.resolveWeekStart(this.weekStart, this.lang)
      );
    }
    return this.#parsedStartDate;
  }

  get #resolvedNumDays(): number {
    const fromNumDays = Number(this.numDays);
    if (Number.isFinite(fromNumDays) && fromNumDays > 0) return Math.floor(fromNumDays);
    const fromDaysPerWeek = Number(this.daysPerWeek);
    if (Number.isFinite(fromDaysPerWeek) && fromDaysPerWeek > 0) return Math.floor(fromDaysPerWeek);
    return this.#modePreset?.numDays ?? 7;
  }

  get #resolvedColumns(): number {
    const value = Number(this.columns);
    if (Number.isFinite(value) && value > 0) return Math.floor(value);
    const preset = this.#modePreset?.columns;
    if (preset === "days") return this.#resolvedNumDays;
    if (typeof preset === "number") return preset;
    return this.#resolvedNumDays <= 7 ? this.#resolvedNumDays : 7;
  }

  get #resolvedTimelineMax(): number {
    const value = Number(this.timelineMax);
    if (!Number.isFinite(value) || value <= 0) return 24 * 60;
    return Math.floor(value);
  }

  /**
   * Snapping step handed to the timed `<time-line>` (axis units).
   * Precedence: an explicitly set `timelineStep` (raw axis units) always wins; otherwise
   * `snapInterval` (minutes, the grid views' concept) is converted via unitsPerDay / 1440;
   * fallback is 5 axis units.
   */
  get #resolvedTimelineStep(): number {
    const explicit = Number(this.timelineStep);
    if (Number.isFinite(explicit) && explicit > 0) return explicit;
    const snapMinutes = Number(this.snapInterval);
    if (Number.isFinite(snapMinutes) && snapMinutes > 0) {
      const units = (snapMinutes * this.#resolvedTimelineMax) / MINUTES_PER_DAY;
      if (units > 0) return units;
    }
    return 5;
  }

  get #resolvedVariant(): TimelineVariant {
    if (this.variant === "all-day" || this.variant === "timed") return this.variant;
    return this.#modePreset?.variant ?? "timed";
  }

  get #resolvedFlow(): TimelineFlow {
    if (this.timelineFlow === "vertical" || this.timelineFlow === "horizontal") {
      return this.timelineFlow;
    }
    return this.#modePreset?.flow ?? "vertical";
  }

  get #resolvedLayout(): TimelineLayout {
    if (
      this.timelineLayout === "default" ||
      this.timelineLayout === "timeline" ||
      this.timelineLayout === "masonry" ||
      this.timelineLayout === "stagger"
    ) {
      return this.timelineLayout;
    }
    return this.#modePreset?.layout ?? "masonry";
  }

  get #resolvedHeight(): "auto" | undefined {
    if (this.timelineHeight === "auto") return "auto";
    if (this.timelineHeight === "") return undefined;
    return this.#modePreset?.height;
  }

  /** Vertical timed modes compose the full chrome: time sidebar + all-day row + timed timeline. */
  get #composedVertical(): boolean {
    return this.#resolvedFlow === "vertical" && this.#resolvedVariant === "timed";
  }

  /** Clamped `visibleHours` sub-range, or `null` when the full day is visible. */
  get #resolvedVisibleHours(): { hours: number; startHour: number } | null {
    const hours = Number(this.visibleHours);
    if (!Number.isFinite(hours) || hours <= 0) return null;
    const clampedHours = Math.max(1, Math.min(24, Math.floor(hours)));
    if (clampedHours >= 24) return null;
    const startRaw = Number(this.visibleHoursStart);
    const startHour = Number.isFinite(startRaw)
      ? Math.max(0, Math.min(24 - clampedHours, Math.floor(startRaw)))
      : 0;
    return { hours: clampedHours, startHour };
  }

  get #currentDateTime(): Temporal.PlainDateTime {
    const value = this.currentTime;
    try {
      if (value.includes("[")) {
        return Temporal.ZonedDateTime.from(value).withTimeZone(this.timezone).toPlainDateTime();
      }
      return Temporal.PlainDateTime.from(value);
    } catch {
      return Temporal.Now.plainDateTimeISO();
    }
  }

  /** Current-time marker on the absolute axis, only when it falls within the rendered range. */
  get #currentTimeMarkers(): number[] {
    const value = toTimelineValue(this.#currentDateTime, this.#scale);
    const gridMax = this.#resolvedTimelineMax * this.#resolvedNumDays;
    if (!Number.isFinite(value) || value < 0 || value >= gridMax) return [];
    return [value];
  }

  get #renderedEntries(): [string, ApiCalendarEvent][] {
    const rangeStart = this.#gridStartDate.toPlainDateTime(Temporal.PlainTime.from("00:00"));
    const rangeEnd = rangeStart.add({ days: this.#resolvedNumDays });
    return Array.from(this.getRenderedEvents({ start: rangeStart, end: rangeEnd }).entries());
  }

  #mapTimelineEvents(
    entries: [string, ApiCalendarEvent][],
    variant: TimelineVariant
  ): CalendarTimelineEvent[] {
    const now = this.#currentDateTime;
    return entries.map(([key, event]) => {
      const originalStart = event.data.start;
      const originalEnd = resolvedDataEnd(event.data);
      const range =
        variant === "all-day"
          ? toTimelineAllDayRange(originalStart, originalEnd, this.#scale)
          : toTimelineRange(originalStart, originalEnd, this.#scale);
      return {
        key,
        start: range.start,
        end: range.end,
        location: event.data.location ?? "",
        summary: event.data.summary,
        color: this.resolveEventDisplayColor(event),
        originalStart,
        originalEnd,
        allDay: event.data.allDay === true,
        past: Temporal.PlainDateTime.compare(originalEnd, now) <= 0,
        recurring: isCalendarEventRecurring(event),
        exception: isCalendarEventException(event),
      };
    });
  }

  #renderedEventsFor(variant: TimelineVariant): CalendarTimelineEvent[] {
    return variant === "all-day" ? this.#renderedAllDayEvents : this.#renderedTimedEvents;
  }

  #handleTimelineMoveCommit(event: Event, variant: TimelineVariant) {
    const detail = (event as CustomEvent<TimelineEventMoveCommitDetail>).detail;
    if (!detail) return;
    const timelineEvent = this.#renderedEventsFor(variant)[detail.index];
    if (!timelineEvent) return;
    const next = this.#nextRangeForMove(timelineEvent, detail, variant);
    if (!next) {
      // Nothing to commit (e.g. sub-day move in the all-day variant); re-render so the
      // timeline snaps back to the unchanged events map.
      this.requestUpdate();
      return;
    }
    this.#markGestureCommitted();
    this.#applyTimelineUpdate(timelineEvent, next);
  }

  #handleTimelineResizeCommit(event: Event, variant: TimelineVariant) {
    const detail = (event as CustomEvent<TimelineEventResizeCommitDetail>).detail;
    if (!detail) return;
    const timelineEvent = this.#renderedEventsFor(variant)[detail.index];
    if (!timelineEvent) return;
    const next = this.#nextRangeForResize(timelineEvent, detail, variant);
    if (!next) {
      this.requestUpdate();
      return;
    }
    this.#markGestureCommitted();
    this.#applyTimelineUpdate(timelineEvent, next);
  }

  /** Drag-to-create commit: numeric range → datetimes → create API (grid-view semantics). */
  #handleTimelineCreate(event: Event, variant: TimelineVariant) {
    const detail = (event as CustomEvent<TimelineEventCreateDetail>).detail;
    if (!detail) return;
    if (variant === "all-day") {
      const unitsPerDay = this.#resolvedTimelineMax;
      const startDay = Math.floor(detail.start / unitsPerDay + 1e-9);
      const endDay = Math.max(startDay + 1, Math.ceil(detail.end / unitsPerDay - 1e-9));
      const dayStart = this.#gridStartDate.add({ days: startDay });
      const dayEndExclusive = this.#gridStartDate.add({ days: endDay });
      this.#emitEventCreateRequested({
        start: dayStart.toPlainDateTime(Temporal.PlainTime.from("00:00")),
        end: dayEndExclusive.toPlainDateTime(Temporal.PlainTime.from("00:00")),
        allDay: true,
      });
      return;
    }
    const range = fromTimelineRange(detail.start, detail.end, this.#scale);
    this.#emitEventCreateRequested({ start: range.start, end: range.end });
  }

  #emitEventCreateRequested(input: {
    start: Temporal.PlainDateTime;
    end: Temporal.PlainDateTime;
    allDay?: boolean;
  }) {
    const calendarId = this.calendarIdForNewEvent();
    const detail: EventCreateRequestDetail = {
      envelope: {
        calendarId,
        accountId: this.accountIdForCalendar(calendarId),
      },
      content: {
        start: input.start,
        end: input.end,
        allDay: input.allDay,
        summary: this.defaultEventSummary,
        color: this.resolveNewEventColor(calendarId),
      },
    };
    this.applyCreateRequestToEventsAPI(detail);
  }

  /**
   * Moves preserve the exact original duration: the committed numeric delta is applied to the
   * original datetimes (all-day: rounded to whole days) instead of re-deriving both edges from
   * axis values, so the events API classifies the change as a "move".
   */
  #nextRangeForMove(
    timelineEvent: CalendarTimelineEvent,
    detail: TimelineEventMoveCommitDetail,
    variant: TimelineVariant
  ): { start: Temporal.PlainDateTime; end: Temporal.PlainDateTime } | null {
    const unitsPerDay = this.#resolvedTimelineMax;
    const deltaUnits = detail.start - detail.previousStart;
    if (deltaUnits === 0) return null;

    if (variant === "all-day") {
      const dayDelta = Math.round(deltaUnits / unitsPerDay);
      if (dayDelta === 0) return null;
      return {
        start: timelineEvent.originalStart.add({ days: dayDelta }),
        end: timelineEvent.originalEnd.add({ days: dayDelta }),
      };
    }

    const deltaSeconds = Math.round((deltaUnits * SECONDS_PER_DAY) / unitsPerDay);
    if (deltaSeconds === 0) return null;
    return {
      start: timelineEvent.originalStart.add({ seconds: deltaSeconds }),
      end: timelineEvent.originalEnd.add({ seconds: deltaSeconds }),
    };
  }

  /** Resizes convert only the dragged edge back through the scale; the other edge stays exact. */
  #nextRangeForResize(
    timelineEvent: CalendarTimelineEvent,
    detail: TimelineEventResizeCommitDetail,
    variant: TimelineVariant
  ): { start: Temporal.PlainDateTime; end: Temporal.PlainDateTime } | null {
    const allDay = variant === "all-day";
    const convertEdge = (value: number): Temporal.PlainDateTime =>
      allDay ? this.#dayRoundedDateTime(value) : fromTimelineValue(value, this.#scale);

    const next =
      detail.edge === "start"
        ? { start: convertEdge(detail.start), end: timelineEvent.originalEnd }
        : { start: timelineEvent.originalStart, end: convertEdge(detail.end) };

    if (Temporal.PlainDateTime.compare(next.end, next.start) <= 0) return null;
    if (
      Temporal.PlainDateTime.compare(next.start, timelineEvent.originalStart) === 0 &&
      Temporal.PlainDateTime.compare(next.end, timelineEvent.originalEnd) === 0
    ) {
      return null;
    }
    return next;
  }

  /** Nearest whole-day boundary for an axis value (all-day gestures commit in whole days). */
  #dayRoundedDateTime(value: number): Temporal.PlainDateTime {
    const dayIndex = Math.round(value / this.#resolvedTimelineMax);
    return this.#gridStartDate
      .add({ days: dayIndex })
      .toPlainDateTime(Temporal.PlainTime.from("00:00"));
  }

  #applyTimelineUpdate(
    timelineEvent: CalendarTimelineEvent,
    next: { start: Temporal.PlainDateTime; end: Temporal.PlainDateTime }
  ) {
    const { event: current, recurrenceId } = this.#resolveSourceEvent(timelineEvent.key);
    const detail: EventUpdateRequestDetail = {
      envelope: {
        eventId: current?.eventId ?? timelineEvent.key,
        accountId: current?.accountId,
        calendarId: current?.calendarId,
        recurrenceId,
        isException: current ? isCalendarEventException(current) : undefined,
        isRecurring: current ? isCalendarEventRecurring(current) : undefined,
      },
      content: {
        start: next.start,
        end: next.end,
        allDay: current?.data.allDay,
        summary: timelineEvent.summary,
        color: current?.data.color,
        location: current?.data.location,
      },
    };
    const result = this.applyUpdateRequestToEventsAPI(detail);
    if (!result.handled || !result.accepted) {
      // Rejected or unhandled: re-render from the unchanged events map so the
      // timeline snaps back to the pre-gesture range.
      this.requestUpdate();
    }
  }

  #requestDeleteForKey(key: string) {
    const { event: current, recurrenceId } = this.#resolveSourceEvent(key);
    const detail: EventDeleteRequestDetail = {
      envelope: {
        accountId: current?.accountId,
        calendarId: current?.calendarId,
        eventId: current?.eventId ?? key,
        recurrenceId,
        isRecurring: current ? isCalendarEventRecurring(current) : undefined,
      },
    };
    this.applyDeleteRequestToEventsAPI(detail);
    if (this.#selectedEventKey === key) {
      this.#selectedEventKey = null;
      this.requestUpdate();
    }
  }

  /** Rendered keys are `sourceKey::recurrenceId` for expanded occurrences (same as the grid views). */
  #resolveSourceEvent(renderedEventKey: string): {
    event: ApiCalendarEvent | undefined;
    recurrenceId?: string;
  } {
    const separatorIndex = renderedEventKey.indexOf("::");
    const sourceKey =
      separatorIndex === -1 ? renderedEventKey : renderedEventKey.slice(0, separatorIndex);
    const recurrenceId =
      separatorIndex === -1 ? undefined : renderedEventKey.slice(separatorIndex + 2);
    const event = this.events?.get(renderedEventKey) ?? this.events?.get(sourceKey);
    return {
      event,
      recurrenceId: recurrenceId ?? event?.recurrenceId,
    };
  }

  #markGestureCommitted() {
    this.#suppressNextCardSelect = true;
    if (this.#suppressNextCardSelectTimeout) {
      clearTimeout(this.#suppressNextCardSelectTimeout);
    }
    this.#suppressNextCardSelectTimeout = setTimeout(() => {
      this.#suppressNextCardSelect = false;
      this.#suppressNextCardSelectTimeout = null;
    }, 150);
  }

  #selectTimelineEvent(key: string) {
    if (this.#selectedEventKey !== key) {
      this.#selectedEventKey = key;
      this.requestUpdate();
    }
    this.dispatchEvent(
      new CustomEvent("event-selected", {
        detail: { key } satisfies EventSelectionRequestDetail,
      })
    );
  }

  #handleEventCardClick(key: string, event: MouseEvent) {
    if (this.#suppressNextCardSelect) {
      this.#suppressNextCardSelect = false;
      return;
    }
    // TimeLine cancels pointerdown (for the move gesture), which suppresses native focus;
    // restore it so keyboard Delete works right after a click-selection.
    const card = event.currentTarget;
    if (card instanceof HTMLElement) {
      card.focus({ preventScroll: true });
    }
    this.#selectTimelineEvent(key);
  }

  #handleEventCardKeydown(key: string, event: KeyboardEvent) {
    if (event.defaultPrevented) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const target = event.target;
    if (target instanceof HTMLElement) {
      if (target.isContentEditable) return;
      const tagName = target.tagName;
      if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      this.#selectTimelineEvent(key);
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      this.#requestDeleteForKey(key);
    }
  }

  /**
   * Card time label; while a gesture preview is active in timed presentations the numeric range
   * converts back through the timeline scale so the label tracks the drag live. Day-snapped
   * contexts keep their normal label during gestures: a day-snapped move never changes the time
   * of day on month chips, and true all-day events show no time — their changing day span is
   * already visible geometrically.
   */
  #timelineEventTimeLabel(
    variant: TimelineVariant,
    timelineEvent: CalendarTimelineEvent,
    preview?: TimelineEventPreviewRange
  ): string {
    const daySnapped = variant === "all-day" || timelineEvent.allDay;
    if (preview && !daySnapped) {
      const range = fromTimelineRange(preview.start, preview.end, this.#scale);
      return formatShortTimeRange(this.lang, range.start, range.end);
    }
    if (timelineEvent.allDay) return "";
    return formatShortTimeRange(this.lang, timelineEvent.originalStart, timelineEvent.originalEnd);
  }

  /** Stable per-variant template references so <time-line> props keep their identity. */
  #renderTimedTimelineEvent = (event: TimelineEvent, preview?: TimelineEventPreviewRange) =>
    this.#renderTimelineEvent("timed", event, preview);

  #renderAllDayTimelineEvent = (event: TimelineEvent, preview?: TimelineEventPreviewRange) =>
    this.#renderTimelineEvent("all-day", event, preview);

  #renderTimelineEvent(
    variant: TimelineVariant,
    event: TimelineEvent,
    preview?: TimelineEventPreviewRange
  ): TemplateResult {
    const timelineEvent = event as CalendarTimelineEvent;
    const selected = this.#selectedEventKey === timelineEvent.key;
    const timeLabel = this.#timelineEventTimeLabel(variant, timelineEvent, preview);
    // The card renders inside <time-line>'s shadow root, out of reach of this component's
    // stylesheet, so the selection ring is applied inline.
    const selectionStyle = selected
      ? {
          outline: "2px solid var(--_lc-event-accent-color, currentColor)",
          "outline-offset": "1px",
        }
      : {};
    return html`
      <event-card
        layout="flow"
        tabindex="0"
        role="button"
        aria-pressed=${selected ? "true" : "false"}
        ?data-selected=${selected}
        ?past=${timelineEvent.past}
        ?recurring=${timelineEvent.recurring}
        ?exception=${timelineEvent.exception}
        style=${styleMap(selectionStyle)}
        .summary=${timelineEvent.summary}
        .location=${timelineEvent.location}
        .time=${timeLabel}
        .color=${timelineEvent.color}
        @click=${(clickEvent: MouseEvent) =>
          this.#handleEventCardClick(timelineEvent.key, clickEvent)}
        @keydown=${(keyEvent: KeyboardEvent) =>
          this.#handleEventCardKeydown(timelineEvent.key, keyEvent)}
      ></event-card>
    `;
  }

  #isWeekendDay(day: Temporal.PlainDate): boolean {
    const weekend: readonly number[] = getLocaleWeekInfo(this.lang).weekend;
    return weekend.includes(day.dayOfWeek);
  }

  /**
   * Per-cell day header (today highlight, month-outside dimming). Day/week/gantt show a
   * locale-aware weekday name + day number; month mode shows only the day number, with the
   * short month name on each month's 1st.
   */
  #dayHeaderTemplate = (cellIndex: number): TemplateResult => {
    const day = this.#gridStartDate.add({ days: cellIndex });
    const isMonthMode = this.mode === "month";
    const anchor = this.#parsedStartDate;
    const outsideMonth = isMonthMode && (day.month !== anchor.month || day.year !== anchor.year);
    const isToday = Temporal.PlainDate.compare(day, this.#currentDateTime.toPlainDate()) === 0;
    const isWeekend = this.#isWeekendDay(day);
    // Month mode renders no weekday names (a weekday header row composes outside the view);
    // instead, the 1st of each month labels the month boundary ("Aug 1", locale-ordered).
    const weekdayLabel = isMonthMode
      ? ""
      : new Intl.DateTimeFormat(this.lang, { weekday: "short" }).format(
          new Date(Date.UTC(day.year, day.month - 1, day.day))
        );
    const dayNumber =
      isMonthMode && day.day === 1
        ? new Intl.DateTimeFormat(this.lang, { month: "short", day: "numeric" }).format(
            new Date(Date.UTC(day.year, day.month - 1, day.day))
          )
        : new Intl.NumberFormat(this.lang).format(day.day);
    const headerStyle = [
      DAY_HEADER_STYLE,
      outsideMonth ? "opacity:0.45" : "",
      isWeekend && !outsideMonth
        ? "color:var(--lc-weekend-day-label-color, light-dark(rgb(15 23 42 / 64%), rgb(255 255 255 / 66%)))"
        : "",
    ]
      .filter(Boolean)
      .join(";");
    return html`
      <div style=${headerStyle} aria-hidden="true">
        ${weekdayLabel ? html`<span>${weekdayLabel}</span>` : nothing}
        <span style=${isToday ? DAY_NUMBER_TODAY_STYLE : DAY_NUMBER_STYLE}>${dayNumber}</span>
      </div>
    `;
  };

  /** Month-mode events overlapping day cell `cellIndex` in the latest render. */
  #monthEventsForCell(cellIndex: number): CalendarTimelineEvent[] {
    return this.#renderedEventsFor(this.#resolvedVariant).filter((timelineEvent) =>
      timelineRangeOverlapsCell(timelineEvent, cellIndex, this.#resolvedTimelineMax)
    );
  }

  /**
   * Whether the month presentation is currently compact (tiny cells). The flag is a custom
   * property flipped by the `lc-timeline-month` container query in CalendarTimelineView.css and
   * inherits into <time-line>'s shadow content, so it can be read from the clicked element
   * (same computed-style pattern as the grid's `--_lc-compact-month-view`).
   */
  #isCompactMonthPresentation(element: Element): boolean {
    if (this.forceCompact) return true;
    if (typeof getComputedStyle === "undefined") return false;
    const raw = getComputedStyle(element).getPropertyValue("--_lc-timeline-compact-month");
    const state = Number.parseFloat(raw.trim());
    return Number.isFinite(state) && state >= 0.5;
  }

  /**
   * Injected month day-header sheet: base chrome plus the compact treatment — unconditional
   * when this instance is forced compact (year mode), otherwise behind the size container query
   * so standalone month views degrade only when genuinely small.
   */
  get #monthDayHeaderStyles(): string {
    if (this.forceCompact) {
      return `${MONTH_DAY_HEADER_BASE_CSS}${MONTH_DAY_HEADER_COMPACT_CSS}`;
    }
    return `${MONTH_DAY_HEADER_BASE_CSS}
      @container lc-timeline-month (max-width: ${COMPACT_MONTH_MAX_INLINE_SIZE}px) {
        ${MONTH_DAY_HEADER_COMPACT_CSS}
      }`;
  }

  /**
   * Month/year day-number click: in the compact treatment a day with events opens its events
   * popover; otherwise (empty compact day, or any regular-size day) it emits the grid views'
   * `day-selection` event so the host can e.g. navigate to that day.
   */
  #handleMonthDayHeaderClick(cellIndex: number, day: Temporal.PlainDate, event: MouseEvent) {
    const button = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    if (
      button &&
      this.#monthEventsForCell(cellIndex).length > 0 &&
      this.#isCompactMonthPresentation(button)
    ) {
      this.#openHeaderPopover(cellIndex, button);
      return;
    }
    // Buttons synthesize click for Enter/Space (event.detail === 0), covering keyboard too.
    const keyboard = event.detail === 0;
    this.dispatchEvent(
      new CustomEvent("day-selection", {
        detail: {
          date: day.toString(),
          dayIndex: cellIndex,
          trigger: keyboard ? "keyboard" : "click",
          pointerType: keyboard ? "keyboard" : "mouse",
          sourceEvent: event,
        },
      })
    );
  }

  #openHeaderPopover(cellIndex: number, button: HTMLElement) {
    if (this.#activeHeaderPopoverCellIndex !== cellIndex) {
      this.#activeHeaderPopoverCellIndex = cellIndex;
      this.requestUpdate();
    }
    // The popover renders as the button's next sibling (see #monthDayHeaderTemplate).
    const popover = button.nextElementSibling;
    if (
      popover instanceof HTMLElement &&
      typeof popover.showPopover === "function" &&
      !popover.matches(":popover-open")
    ) {
      this.#setHeaderPopoverInlineAlign(popover, button);
      popover.showPopover();
    }
  }

  /**
   * Viewport-aware inline alignment (grid parity: `#setOverflowPopoverInlineAlign` in
   * CalendarGridView). The footer's column heuristic assumes a full-width month; in the year
   * grid a month card can sit anywhere, so measure against the viewport at open time instead.
   */
  #setHeaderPopoverInlineAlign(popover: HTMLElement, button: HTMLElement) {
    const anchorRect = button.getBoundingClientRect();
    const anchorCenterX = (anchorRect.left + anchorRect.right) / 2;
    const popoverWidth = this.#measurePopoverWidth(popover);
    const viewportMarginPx = 12;
    const availableLeft = anchorCenterX - viewportMarginPx;
    const availableRight = window.innerWidth - viewportMarginPx - anchorCenterX;
    const needsHalfWidth = popoverWidth / 2;
    if (availableLeft >= needsHalfWidth && availableRight >= needsHalfWidth) {
      popover.removeAttribute("data-inline-align");
      return;
    }
    popover.setAttribute(
      "data-inline-align",
      anchorCenterX < window.innerWidth / 2 ? "start" : "end"
    );
  }

  #measurePopoverWidth(popover: HTMLElement): number {
    if (popover.matches(":popover-open")) {
      return popover.getBoundingClientRect().width;
    }
    popover.setAttribute("data-measuring", "");
    const width = popover.getBoundingClientRect().width;
    popover.removeAttribute("data-measuring");
    return width;
  }

  #handleHeaderPopoverToggle(cellIndex: number, event: Event) {
    const newState = (event as ToggleEvent).newState;
    if (newState === "open" && this.#activeHeaderPopoverCellIndex !== cellIndex) {
      this.#activeHeaderPopoverCellIndex = cellIndex;
      this.requestUpdate();
      return;
    }
    if (newState === "closed" && this.#activeHeaderPopoverCellIndex === cellIndex) {
      this.#activeHeaderPopoverCellIndex = null;
      (event.currentTarget as HTMLElement | null)?.removeAttribute("data-inline-align");
      this.requestUpdate();
    }
  }

  /** Popover payload for a day's events (shared by the overflow footer and compact header). */
  #popoverEventsFor(events: CalendarTimelineEvent[]): DayOverflowPopoverEvent[] {
    return events.map((ev) => ({
      id: ev.key,
      start: ev.allDay ? ev.originalStart.toPlainDate().toString() : ev.originalStart.toString(),
      end: ev.allDay ? ev.originalEnd.toPlainDate().toString() : ev.originalEnd.toString(),
      summary: ev.summary,
      color: ev.color,
      hidden: false,
    }));
  }

  /** Keep edge-column popovers on screen: anchor them towards the grid instead of centering. */
  #popoverInlineAlign(cellIndex: number): "start" | "end" | undefined {
    const columns = this.#resolvedColumns;
    const columnIndex = cellIndex % columns;
    const physicalColumnIndex =
      this.resolveDirection(this.rtl) === "rtl" ? columns - 1 - columnIndex : columnIndex;
    return physicalColumnIndex === 0
      ? "start"
      : physicalColumnIndex === columns - 1
        ? "end"
        : undefined;
  }

  /** Up to three unique event colors marking an event day in the compact treatment. */
  #dayDotColors(events: CalendarTimelineEvent[]): string[] {
    const colors: string[] = [];
    const seen = new Set<string>();
    for (const dayEvent of events) {
      const color = dayEvent.color || "currentColor";
      if (seen.has(color)) continue;
      seen.add(color);
      colors.push(color);
      if (colors.length === 3) break;
    }
    return colors;
  }

  /**
   * Month-mode day header: an interactive day-number button (grid-view parity: click/Enter/Space
   * emit `day-selection`; in the compact treatment event days open their events popover instead).
   * Styled by the injected #monthDayHeaderStyles sheet, which also carries the compact
   * treatment (container-query-driven, or unconditional under forceCompact); the sheet ships
   * once with cell 0.
   */
  #monthDayHeaderTemplate = (cellIndex: number): TemplateResult => {
    const day = this.#gridStartDate.add({ days: cellIndex });
    const anchor = this.#parsedStartDate;
    const outsideMonth = day.month !== anchor.month || day.year !== anchor.year;
    const isToday = Temporal.PlainDate.compare(day, this.#currentDateTime.toPlainDate()) === 0;
    const isWeekend = this.#isWeekendDay(day);
    const dayDate = new Date(Date.UTC(day.year, day.month - 1, day.day));
    // The 1st of each month labels the month boundary ("Aug 1", locale-ordered); the non-day
    // parts collapse into prefix/suffix spans (white-space: pre keeps their spacing inside the
    // inline-flex pill) so the compact treatment can hide them.
    const dayNumberContent = (() => {
      if (day.day !== 1) return html`${new Intl.NumberFormat(this.lang).format(day.day)}`;
      const parts = new Intl.DateTimeFormat(this.lang, {
        month: "short",
        day: "numeric",
      }).formatToParts(dayDate);
      const dayPartIndex = parts.findIndex((part) => part.type === "day");
      const before = parts
        .slice(0, dayPartIndex)
        .map((part) => part.value)
        .join("");
      const dayText = parts[dayPartIndex]?.value ?? String(day.day);
      const after = parts
        .slice(dayPartIndex + 1)
        .map((part) => part.value)
        .join("");
      return html`${
        before ? html`<span class="timeline-day-month-prefix">${before}</span>` : nothing
      }<span>${dayText}</span>${
        after ? html`<span class="timeline-day-month-prefix">${after}</span>` : nothing
      }`;
    })();
    const dayEvents = this.#monthEventsForCell(cellIndex);
    const dotColors = this.#dayDotColors(dayEvents);
    const fullDateLabel = new Intl.DateTimeFormat(this.lang, { dateStyle: "full" }).format(
      dayDate
    );
    const popoverId = `timeline-day-header-popover-${cellIndex}`;
    const anchorName = `--timeline-day-header-anchor-${cellIndex}`;
    const active = this.#activeHeaderPopoverCellIndex === cellIndex;
    const headerClasses = [
      "timeline-day-header",
      outsideMonth ? "is-outside-month" : "",
      isWeekend ? "is-weekend" : "",
    ]
      .filter(Boolean)
      .join(" ");
    return html`
      ${cellIndex === 0 ? html`<style>${this.#monthDayHeaderStyles}</style>` : nothing}
      <button
        type="button"
        class=${headerClasses}
        style=${`anchor-name:${anchorName}`}
        .ariaLabel=${fullDateLabel}
        .ariaCurrent=${isToday ? "date" : null}
        @click=${(clickEvent: MouseEvent) =>
          this.#handleMonthDayHeaderClick(cellIndex, day, clickEvent)}
      >
        <span class="timeline-day-number ${isToday ? "is-today" : ""}">
          ${dayNumberContent}
          ${
            dotColors.length
              ? html`
                  <span class="timeline-day-dots" aria-hidden="true">
                    ${dotColors.map(
                      (color) =>
                        html`<span
                          class="timeline-day-dot"
                          style=${`background-color:${color}`}
                        ></span>`
                    )}
                  </span>
                `
              : nothing
          }
        </span>
      </button>
      ${
        dayEvents.length
          ? html`
              <day-overflow-popover
                id=${popoverId}
                popover="auto"
                role="dialog"
                .ariaLabel=${`Events on ${fullDateLabel}`}
                style=${styleMap({
                  "position-anchor": anchorName,
                  "--_lc-all-day-day-number-space": "36px",
                })}
                .dayIso=${day.toString()}
                .dayLabel=${new Intl.NumberFormat(this.lang).format(day.day)}
                ?is-current-day=${isToday}
                ?outside-visible-month=${outsideMonth}
                ?is-weekend=${isWeekend}
                .events=${active ? this.#popoverEventsFor(dayEvents) : []}
                @toggle=${(event: Event) => this.#handleHeaderPopoverToggle(cellIndex, event)}
                @select=${this.#handleOverflowPopoverSelect}
                @delete=${this.#handleOverflowPopoverDelete}
              ></day-overflow-popover>
            `
          : nothing
      }
    `;
  };

  /** "+N more" affordance for clipped cells (height="auto" horizontal layouts, e.g. month mode). */
  #overflowFooterTemplate = (
    cellIndex: number,
    visibleEvents: TimelineEvent[],
    allCellEvents: TimelineEvent[]
  ): TemplateResult => {
    const hiddenCount = allCellEvents.length - visibleEvents.length;
    if (hiddenCount <= 0) return html``;
    const visibleKeys = new Set(
      (visibleEvents as CalendarTimelineEvent[]).map((visibleEvent) => visibleEvent.key)
    );
    const hiddenEvents = (allCellEvents as CalendarTimelineEvent[]).filter(
      (cellEvent) => !visibleKeys.has(cellEvent.key)
    );
    const day = this.#gridStartDate.add({ days: cellIndex });
    const popoverId = `timeline-day-overflow-${cellIndex}`;
    const anchorName = `--timeline-day-overflow-anchor-${cellIndex}`;
    const active = this.#activeOverflowCellIndex === cellIndex;
    const popoverEvents: DayOverflowPopoverEvent[] = active
      ? this.#popoverEventsFor(allCellEvents as CalendarTimelineEvent[])
      : [];
    const fullDateLabel = new Intl.DateTimeFormat(this.lang, { dateStyle: "full" }).format(
      new Date(Date.UTC(day.year, day.month - 1, day.day))
    );
    const isMonthMode = this.mode === "month";
    const anchor = this.#parsedStartDate;
    const inlineAlign = this.#popoverInlineAlign(cellIndex);
    return html`
      <style>${OVERFLOW_BUTTON_STATE_CSS}</style>
      <button
        type="button"
        class="day-overflow-button"
        style=${`${OVERFLOW_BUTTON_STYLE};anchor-name:${anchorName}`}
        aria-haspopup="dialog"
        .ariaLabel=${`Show all ${allCellEvents.length} events on ${fullDateLabel}`}
        popovertarget=${popoverId}
        popovertargetaction="toggle"
        @click=${() => this.#prepareOverflowPopover(cellIndex)}
      >
        ${this.#renderOverflowDots(hiddenEvents, hiddenCount)}
        <span>+${new Intl.NumberFormat(this.lang).format(hiddenCount)} more</span>
      </button>
      <day-overflow-popover
        id=${popoverId}
        popover="auto"
        role="dialog"
        data-inline-align=${ifDefined(inlineAlign)}
        .ariaLabel=${`Events on ${fullDateLabel}`}
        style=${styleMap({
          "position-anchor": anchorName,
          "--_lc-all-day-day-number-space": "36px",
        })}
        .dayIso=${day.toString()}
        .dayLabel=${new Intl.NumberFormat(this.lang).format(day.day)}
        ?is-current-day=${Temporal.PlainDate.compare(day, this.#currentDateTime.toPlainDate()) ===
        0}
        ?outside-visible-month=${isMonthMode &&
        (day.month !== anchor.month || day.year !== anchor.year)}
        ?is-weekend=${this.#isWeekendDay(day)}
        .events=${popoverEvents}
        @toggle=${(event: Event) => this.#handleOverflowPopoverToggle(cellIndex, event)}
        @select=${this.#handleOverflowPopoverSelect}
        @delete=${this.#handleOverflowPopoverDelete}
      ></day-overflow-popover>
    `;
  };

  /** Grid-parity dots: one per unique hidden-event color, falling back to currentColor. */
  #renderOverflowDots(hiddenEvents: CalendarTimelineEvent[], hiddenCount: number): TemplateResult {
    const colors: string[] = [];
    const seenColors = new Set<string>();
    for (const hiddenEvent of hiddenEvents) {
      const color = hiddenEvent.color;
      if (!color || seenColors.has(color)) continue;
      seenColors.add(color);
      colors.push(color);
    }
    const shownColors = colors.slice(0, hiddenCount);
    return html`
      <span style=${OVERFLOW_DOTS_STYLE} aria-hidden="true">
        ${
          shownColors.length
            ? shownColors.map(
                (color) => html`<span style=${`${OVERFLOW_DOT_STYLE};background-color:${color}`}></span>`
              )
            : Array.from(
                { length: hiddenCount },
                () => html`<span style=${`${OVERFLOW_DOT_STYLE};background-color:currentColor`}></span>`
              )
        }
      </span>
    `;
  }

  #prepareOverflowPopover(cellIndex: number) {
    if (this.#activeOverflowCellIndex === cellIndex) return;
    this.#activeOverflowCellIndex = cellIndex;
    this.requestUpdate();
  }

  #handleOverflowPopoverToggle(cellIndex: number, event: Event) {
    const newState = (event as ToggleEvent).newState;
    if (newState === "open" && this.#activeOverflowCellIndex !== cellIndex) {
      this.#activeOverflowCellIndex = cellIndex;
      this.requestUpdate();
      return;
    }
    if (newState === "closed" && this.#activeOverflowCellIndex === cellIndex) {
      this.#activeOverflowCellIndex = null;
      this.requestUpdate();
    }
  }

  /** DayOverflowPopover re-emits `select`/`delete` with the inner event element as detail. */
  #eventKeyFromPopoverDetail(event: Event): string | null {
    const detail = (event as CustomEvent<unknown>).detail;
    if (detail && typeof detail === "object" && "eventId" in detail) {
      const key = (detail as { eventId?: unknown }).eventId;
      if (typeof key === "string" && key) return key;
    }
    return null;
  }

  #handleOverflowPopoverSelect = (event: Event) => {
    const key = this.#eventKeyFromPopoverDetail(event);
    if (key) this.#selectTimelineEvent(key);
  };

  #handleOverflowPopoverDelete = (event: Event) => {
    const key = this.#eventKeyFromPopoverDetail(event);
    if (key) this.#requestDeleteForKey(key);
  };

  /** Overflow footer applies where TimeLine clips lanes: horizontal flow + height auto. */
  get #showOverflowFooter(): boolean {
    return (
      this.#resolvedFlow === "horizontal" &&
      this.#resolvedHeight === "auto" &&
      (this.#resolvedLayout === "timeline" ||
        this.#resolvedLayout === "masonry" ||
        this.#resolvedLayout === "stagger")
    );
  }

  /** All-day filtering for the single-timeline render paths (month, standalone all-day, gantt). */
  get #filteredEntries(): [string, ApiCalendarEvent][] {
    const entries = this.#renderedEntries;
    const filter = resolveTimelineEventFilter(this.variant, this.#resolvedVariant);
    if (filter === "all-day-only") {
      return entries.filter(([, event]) => event.data.allDay === true);
    }
    if (filter === "timed-only") {
      return entries.filter(([, event]) => event.data.allDay !== true);
    }
    return entries;
  }

  #renderSingleTimeline(variant: TimelineVariant): TemplateResult {
    const events = this.#mapTimelineEvents(this.#filteredEntries, variant);
    if (variant === "all-day") {
      this.#renderedAllDayEvents = events;
      this.#renderedTimedEvents = [];
    } else {
      this.#renderedTimedEvents = events;
      this.#renderedAllDayEvents = [];
    }
    const unitsPerDay = this.#resolvedTimelineMax;
    const step = variant === "all-day" ? unitsPerDay : this.#resolvedTimelineStep;
    return html`
      <time-line
        class="timeline-main"
        .events=${events}
        .cells=${this.#resolvedNumDays}
        .columns=${this.#resolvedColumns}
        .max=${unitsPerDay}
        .step=${step}
        .flow=${this.#resolvedFlow}
        .layout=${this.#resolvedLayout}
        .height=${this.#resolvedHeight}
        .markers=${variant === "timed" ? this.#currentTimeMarkers : []}
        .eventTemplate=${variant === "all-day"
          ? this.#renderAllDayTimelineEvent
          : this.#renderTimedTimelineEvent}
        .headerTemplate=${this.mode === "month"
          ? this.#monthDayHeaderTemplate
          : this.#dayHeaderTemplate}
        .footerTemplate=${this.#showOverflowFooter ? this.#overflowFooterTemplate : undefined}
        @timeline-event-move=${(event: Event) => this.#handleTimelineMoveCommit(event, variant)}
        @timeline-event-resize=${(event: Event) =>
          this.#handleTimelineResizeCommit(event, variant)}
        @timeline-event-create=${(event: Event) => this.#handleTimelineCreate(event, variant)}
      ></time-line>
    `;
  }

  /**
   * Day/week composition: time sidebar + timed timeline, with the all-day row above it when
   * `allDayRow` is opted in (grid-week parity). Without the row, all-day events are hidden and
   * a header-only strip keeps the day labels aligned with the timed columns.
   */
  #renderComposedVertical(): TemplateResult {
    const showAllDayRow = this.allDayRow === true;
    const entries = this.#renderedEntries;
    const timedEntries = entries.filter(([, event]) => event.data.allDay !== true);
    const allDayEntries = showAllDayRow
      ? entries.filter(([, event]) => event.data.allDay === true)
      : [];
    const allDayEvents = this.#mapTimelineEvents(allDayEntries, "all-day");
    const timedEvents = this.#mapTimelineEvents(timedEntries, "timed");
    this.#renderedAllDayEvents = allDayEvents;
    this.#renderedTimedEvents = timedEvents;

    const numDays = this.#resolvedNumDays;
    const unitsPerDay = this.#resolvedTimelineMax;
    const visible = this.#resolvedVisibleHours;
    const { windowStart, windowEnd } = visibleHoursWindow(
      unitsPerDay,
      visible?.hours,
      visible?.startHour
    );

    const allDayRowTemplate = showAllDayRow
      ? html`
          <time-line
            class="timeline-all-day"
            .events=${allDayEvents}
            .cells=${numDays}
            .columns=${numDays}
            .max=${unitsPerDay}
            .step=${unitsPerDay}
            flow="horizontal"
            layout="masonry"
            height="auto"
            .eventTemplate=${this.#renderAllDayTimelineEvent}
            .headerTemplate=${this.#dayHeaderTemplate}
            .footerTemplate=${this.#overflowFooterTemplate}
            @timeline-event-move=${(event: Event) =>
              this.#handleTimelineMoveCommit(event, "all-day")}
            @timeline-event-resize=${(event: Event) =>
              this.#handleTimelineResizeCommit(event, "all-day")}
            @timeline-event-create=${(event: Event) =>
              this.#handleTimelineCreate(event, "all-day")}
          ></time-line>
        `
      : html`
          <time-line
            class="timeline-all-day timeline-all-day--header-only"
            .events=${[]}
            .cells=${numDays}
            .columns=${numDays}
            .max=${unitsPerDay}
            .step=${unitsPerDay}
            flow="horizontal"
            layout="masonry"
            height="auto"
            .headerTemplate=${this.#dayHeaderTemplate}
          ></time-line>
        `;

    return html`
      <calendar-time-sidebar
        class="timeline-sidebar"
        .lang=${this.lang}
        .hours=${visible?.hours ?? 24}
        .startHour=${visible?.startHour ?? 0}
      ></calendar-time-sidebar>
      <div class="timeline-all-day-shell">${allDayRowTemplate}</div>
      <time-line
        class="timeline-timed"
        .events=${timedEvents}
        .cells=${numDays}
        .columns=${numDays}
        .max=${unitsPerDay}
        .step=${this.#resolvedTimelineStep}
        .flow=${"vertical" as const}
        .layout=${this.#resolvedLayout}
        .gridInterval=${unitsPerDay / 24}
        .windowStart=${windowStart}
        .windowEnd=${windowEnd}
        .markers=${this.#currentTimeMarkers}
        .eventTemplate=${this.#renderTimedTimelineEvent}
        @timeline-event-move=${(event: Event) => this.#handleTimelineMoveCommit(event, "timed")}
        @timeline-event-resize=${(event: Event) =>
          this.#handleTimelineResizeCommit(event, "timed")}
        @timeline-event-create=${(event: Event) => this.#handleTimelineCreate(event, "timed")}
      ></time-line>
    `;
  }

  /**
   * Year mode: twelve month-mode instances (January … December of `startDate`'s year) composed
   * into the grid year view's responsive layout. Each instance brings the full month machinery
   * (42-cell window, day chips, overflow popovers) and degrades to the compact treatment on its
   * own via the container query, so this stays chrome-free: no sidebar, no all-day row, and the
   * compact cells expose no drag surface.
   */
  #renderYearGrid(direction: "ltr" | "rtl"): TemplateResult {
    const monthFormatter = new Intl.DateTimeFormat(this.lang, { month: "long" });
    return html`
      <div class="year-grid" dir=${direction}>
        ${yearMonthStarts(this.#parsedStartDate).map(
          (firstOfMonth) => html`
            <section class="month-card">
              <h3 class="month-title">
                ${monthFormatter.format(
                  new Date(Date.UTC(firstOfMonth.year, firstOfMonth.month - 1, 1))
                )}
              </h3>
              <calendar-timeline-view
                mode="month"
                force-compact
                .startDate=${firstOfMonth.toString()}
                .events=${this.events}
                .lang=${this.lang}
                .timezone=${this.timezone}
                .currentTime=${this.currentTime}
                .weekStart=${this.weekStart}
                .defaultEventSummary=${this.defaultEventSummary}
                .selectedCalendarId=${this.selectedCalendarId}
                ?rtl=${this.rtl}
                @day-selection=${this.forwardCalendarEvent}
                @event-created=${this.forwardCalendarEvent}
                @event-selected=${this.forwardCalendarEvent}
                @event-updated=${this.forwardCalendarEvent}
                @event-deleted=${this.forwardCalendarEvent}
              ></calendar-timeline-view>
            </section>
          `
        )}
      </div>
    `;
  }

  render() {
    const direction = this.resolveDirection(this.rtl);
    if (this.mode === "year") {
      return this.#renderYearGrid(direction);
    }
    if (this.#composedVertical) {
      return html`
        <div class="timeline-layout timeline-layout--composed" dir=${direction}>
          ${this.#renderComposedVertical()}
        </div>
      `;
    }
    const monthClass = this.mode === "month" ? " timeline-layout--month" : "";
    return html`
      <div class="timeline-layout${monthClass}" dir=${direction}>
        ${this.#renderSingleTimeline(this.#resolvedVariant)}
      </div>
    `;
  }
}
