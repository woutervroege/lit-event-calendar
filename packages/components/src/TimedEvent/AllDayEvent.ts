import { Temporal } from "@js-temporal/polyfill";
import { html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";
import { getEventColorStyles } from "../utils/EventColor";
import { formatDateRangeShort } from "../utils/DateFormatting";
import "../EventCard/EventCard";
import "../ResizeHandle/ResizeHandle";
import { BaseEvent } from "./BaseEvent";

@customElement("all-day-event")
export class AllDayEvent extends BaseEvent {
  #lockedStackIndex: number | null = null;
  #previewDisplayTime: string | null = null;
  #keyboardHintId = `all-day-event-kbd-${Math.random().toString(36).slice(2, 9)}`;

  @property({ type: Number })
  daysPerRow: number = 0;

  @property({ type: Number })
  gridRows: number = 1;

  constructor() {
    super({ mode: "all-day" });
  }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener(
      "interaction-drag-hover",
      this.#handleInteractionDragHover as EventListener
    );
  }

  disconnectedCallback() {
    this.removeEventListener(
      "interaction-drag-hover",
      this.#handleInteractionDragHover as EventListener
    );
    super.disconnectedCallback();
  }

  get endDate(): Temporal.PlainDate | null {
    if (!this.end) return null;
    const endDateTime = Temporal.PlainDateTime.from(this.end.toString());
    const exclusiveEnd = endDateTime.subtract({ nanoseconds: 1 });
    return exclusiveEnd.toPlainDate();
  }

  get siblings(): AllDayEvent[] {
    const siblings = super.siblings as AllDayEvent[];
    return siblings.sort((a, b) => {
      const aStart = a.startDate?.toString() ?? "";
      const bStart = b.startDate?.toString() ?? "";
      if (aStart !== bStart) {
        return aStart.localeCompare(bStart);
      }
      const aEnd = a.endDate?.toString() ?? "";
      const bEnd = b.endDate?.toString() ?? "";
      if (aEnd !== bEnd) {
        return aEnd.localeCompare(bEnd);
      }
      return a.summary.localeCompare(b.summary);
    });
  }

  #getVisibleDayKeys(renderedDays: string[]): string[] {
    return this.days.map((day) => day.toString()).filter((day) => renderedDays.includes(day));
  }

  #getReferenceDay(renderedDays: string[]): string | null {
    const visibleDays = this.#getVisibleDayKeys(renderedDays);
    return visibleDays.length ? visibleDays[0] : null;
  }

  #getStackIndex(renderedDays: string[], options?: { ignoreLock?: boolean }): number {
    if (!options?.ignoreLock && this.#lockedStackIndex !== null) {
      return this.#lockedStackIndex;
    }

    const referenceDay = this.#getReferenceDay(renderedDays);
    if (!referenceDay) return 0;

    const occupiedRows = this.#getOccupiedRowsForReferenceDay(referenceDay, renderedDays);
    return this.#findFirstFreeRow(occupiedRows);
  }

  #getOccupiedRowsForReferenceDay(referenceDay: string, renderedDays: string[]): Set<number> {
    const occupiedRows = new Set<number>();

    for (const sibling of this.siblings) {
      if (sibling === this) break;
      const siblingDayKeys = sibling.days.map((day) => day.toString());
      if (!siblingDayKeys.includes(referenceDay)) continue;

      const siblingIndex = sibling.#getStackIndex(renderedDays);
      occupiedRows.add(siblingIndex);
    }

    return occupiedRows;
  }

  #findFirstFreeRow(occupiedRows: Set<number>): number {
    let candidate = 0;
    while (occupiedRows.has(candidate)) {
      candidate += 1;
    }
    return candidate;
  }

  /** Stack index for this event on a specific grid row. Only conflicts with siblings that share a day on this row. */
  #getStackIndexForRow(renderedDays: string[], rowIndex: number): number {
    if (!this.daysPerRow || this.daysPerRow <= 0 || this.gridRows <= 0) {
      return this.#getStackIndex(renderedDays);
    }

    // Always compute per-row during drag so the event keeps correct margin on each row (no lock here).

    const startDayIndex = rowIndex * this.daysPerRow;
    const endDayIndex = Math.min(startDayIndex + this.daysPerRow, renderedDays.length);
    const rowDayKeys = renderedDays.slice(startDayIndex, endDayIndex);
    const ourDaysOnRow = new Set(
      this.days.map((d) => d.toString()).filter((key) => rowDayKeys.includes(key))
    );
    if (ourDaysOnRow.size === 0) return 0;

    const occupied = new Set<number>();
    for (const sibling of this.siblings) {
      if (sibling === this) break;
      const siblingDaysOnRow = sibling.days
        .map((d) => d.toString())
        .filter((key) => rowDayKeys.includes(key));
      const overlaps = siblingDaysOnRow.some((key) => ourDaysOnRow.has(key));
      if (!overlaps) continue;

      occupied.add(sibling.#getStackIndexForRow(renderedDays, rowIndex));
    }

    return this.#findFirstFreeRow(occupied);
  }

  // All-day events always occupy the full width of the day column they belong to.
  // When daysPerRow > 0 (month view), position by column = dayIndex % daysPerRow, row = floor(dayIndex / daysPerRow).
  #createDayInset(
    day: Temporal.PlainDate,
    renderedDays: string[]
  ): Record<string, string | number> | null {
    const dayIndex = renderedDays.indexOf(day.toString());
    if (dayIndex === -1 || renderedDays.length === 0) return null;

    const { cols, rowIndex, colIndex } = this.#getGridPosition(dayIndex, renderedDays.length);
    const left = (colIndex / cols) * 100;
    const stackIndex = this.#getStackIndexForPosition(renderedDays, rowIndex);
    const top = this.#getTopPosition(rowIndex, stackIndex);

    return {
      top,
      height: `var(--event-height, 32px)`,
      "--left": `${left}%`,
      "--width": 1,
      "--margin-left": 0,
      "--indentation": "0px",
      "--z-index": 1,
    };
  }

  #getGridPosition(dayIndex: number, totalRenderedDays: number): {
    cols: number;
    rowIndex: number;
    colIndex: number;
  } {
    const cols = this.daysPerRow > 0 ? this.daysPerRow : totalRenderedDays;
    const rowIndex = this.daysPerRow > 0 ? Math.floor(dayIndex / this.daysPerRow) : 0;
    const colIndex = this.daysPerRow > 0 ? dayIndex % this.daysPerRow : dayIndex;
    return { cols, rowIndex, colIndex };
  }

  #getStackIndexForPosition(renderedDays: string[], rowIndex: number): number {
    const hasGrid = this.daysPerRow > 0 && this.gridRows > 0;
    return hasGrid ? this.#getStackIndexForRow(renderedDays, rowIndex) : this.#getStackIndex(renderedDays);
  }

  #getTopPosition(rowIndex: number, stackIndex: number): string {
    const hasGrid = this.daysPerRow > 0 && this.gridRows > 0;

    if (hasGrid) {
      return `calc(var(--row-height, 100%) * ${rowIndex} + var(--event-height, 32px) * ${stackIndex})`;
    }

    return `calc(var(--event-height, 32px) * ${stackIndex})`;
  }

  get dayInsets() {
    const insets: Array<Record<string, string | number>> = [];
    const renderedDays = this.renderedDays.map((day) => day.toString());

    this.days.forEach((day) => {
      if (!renderedDays.includes(day.toString())) return;
      const inset = this.#createDayInset(day, renderedDays);
      if (inset) {
        insets.push(inset);
      }
    });

    return insets;
  }

  get displayTime(): string {
    if (this.#previewDisplayTime != null) {
      return this.#previewDisplayTime;
    }

    const startDate = this.startDate;
    const endDate = this.endDate;
    if (!startDate || !endDate) return "";

    const renderedDays = this.#getSortedRenderedDays();
    if (!renderedDays.length) return "";

    const { firstVisibleDay, lastVisibleDay } = this.#getVisibleRange(renderedDays);
    const { extendsBefore, extendsAfter } = this.#getExtensionFlags(
      startDate,
      endDate,
      firstVisibleDay,
      lastVisibleDay
    );

    if ((extendsBefore || extendsAfter) && Temporal.PlainDate.compare(startDate, endDate) !== 0) {
      return formatDateRangeShort(this.locale, startDate, endDate);
    }

    return "";
  }

  #getSortedRenderedDays(): Temporal.PlainDate[] {
    return [...this.renderedDays].sort((a, b) => Temporal.PlainDate.compare(a, b));
  }

  #getVisibleRange(renderedDays: Temporal.PlainDate[]): {
    firstVisibleDay: Temporal.PlainDate;
    lastVisibleDay: Temporal.PlainDate;
  } {
    const firstVisibleDay = renderedDays[0];
    const lastVisibleDay = renderedDays[renderedDays.length - 1];
    return { firstVisibleDay, lastVisibleDay };
  }

  #getExtensionFlags(
    startDate: Temporal.PlainDate,
    endDate: Temporal.PlainDate,
    firstVisibleDay: Temporal.PlainDate,
    lastVisibleDay: Temporal.PlainDate
  ): { extendsBefore: boolean; extendsAfter: boolean } {
    const extendsBefore = Temporal.PlainDate.compare(startDate, firstVisibleDay) < 0;
    const extendsAfter = Temporal.PlainDate.compare(endDate, lastVisibleDay) > 0;
    return { extendsBefore, extendsAfter };
  }

  #handleInteractionDragHover = (event: Event) => {
    if (!(event instanceof CustomEvent)) return;

    const hover = this.#getHoverDetail(event);
    if (!hover) {
      this.#clearPreviewDisplayTime();
      return;
    }

    const renderedDays = this.renderedDays;
    if (!renderedDays || !renderedDays.length || !this.#hasValidHoverDayIndex(hover, renderedDays)) {
      this.#clearPreviewDisplayTime();
      return;
    }

    const startDate = this.startDate;
    const endDate = this.endDate;
    if (!startDate || !endDate) {
      this.#clearPreviewDisplayTime();
      return;
    }

    const { dayIndex } = hover;
    const targetStartDate = renderedDays[dayIndex];
    const targetEndDate = this.#getTargetEndDate(startDate, endDate, targetStartDate);

    this.#previewDisplayTime = formatDateRangeShort(this.locale, targetStartDate, targetEndDate);
    this.requestUpdate();
  };

  #getHoverDetail(event: CustomEvent):
    | {
        dayIndex: number;
        time: Temporal.PlainTime | null;
        clientX: number;
        clientY: number;
      }
    | null {
    return (event.detail as
      | {
          dayIndex: number;
          time: Temporal.PlainTime | null;
          clientX: number;
          clientY: number;
        }
      | null) ?? null;
  }

  #clearPreviewDisplayTime() {
    this.#previewDisplayTime = null;
    this.requestUpdate();
  }

  #hasValidHoverDayIndex(
    hover: { dayIndex: number },
    renderedDays: Temporal.PlainDate[]
  ): boolean {
    const { dayIndex } = hover;
    return dayIndex != null && dayIndex >= 0 && dayIndex < renderedDays.length;
  }

  #getTargetEndDate(
    startDate: Temporal.PlainDate,
    endDate: Temporal.PlainDate,
    targetStartDate: Temporal.PlainDate
  ): Temporal.PlainDate {
    const diff = startDate.until(endDate, { largestUnit: "day" });
    const daysCount = diff.days + 1;
    return targetStartDate.add({ days: daysCount - 1 });
  }

  render() {
    const dayInsets = this.dayInsets;
    const canResizeStart = dayInsets.length > 1;
    const colorStyles = getEventColorStyles(this.color);
    const isDragging = this.interactionController.isDragging;
    const hasOffset = this.dragOffsetX !== 0 || this.dragOffsetY !== 0;
    const dragTransform =
      isDragging || hasOffset
        ? `translate(${this.dragOffsetX}px, ${this.dragOffsetY}px)`
        : "none";

    return html`
      <div
        class="interaction-surface m-0 text-0 relative w-full h-full border-none bg-none outline-none p-0"
        role="group"
        tabindex="0"
        aria-label=${this.#interactionLabel}
        aria-describedby=${this.#keyboardHintId}
        aria-keyshortcuts="Control+Meta+ArrowUp Control+Meta+ArrowDown Control+Meta+ArrowLeft Control+Meta+ArrowRight Control+Shift+ArrowUp Control+Shift+ArrowDown"
        style=${styleMap({
          ...colorStyles,
          transform: dragTransform,
          // Disable transform animation entirely to avoid snap/flash at drag end.
          transition: "none",
        })}
        @pointerdown=${this.interactionController.pointerDownHandler}
        @pointermove=${this.interactionController.pointerMoveHandler}
        @pointerup=${this.interactionController.pointerUpHandler}
        @keydown=${this.interactionController.keydownHandler}
      >
        <span
          id=${this.#keyboardHintId}
          class="sr-only"
        >
          Use Control Command and arrow keys to move this event. Use Control Shift and up or down
          arrow keys to resize the end date.
        </span>
        ${this.#renderEventCards(dayInsets, canResizeStart)}
      </div>
    `;
  }

  #renderEventCards(
    dayInsets: Array<Record<string, string | number>>,
    canResizeStart: boolean
  ) {
    return dayInsets.map((inset, index) =>
      this.#renderEventCard(inset, index, dayInsets.length, canResizeStart)
    );
  }

  #renderEventCard(
    inset: Record<string, string | number>,
    index: number,
    total: number,
    canResizeStart: boolean
  ) {
    const isFirst = index === 0;
    const isLast = index === total - 1;

    return html`
      <event-card
        summary=${isFirst ? this.summary : ""}
        time=${isFirst ? this.displayTime : ""}
        style=${styleMap(inset)}
        ?first-segment=${isFirst}
        ?last-segment=${isLast}
      >
        ${isFirst && canResizeStart
          ? html`
              <resize-handle
                axis="horizontal"
                position="start"
                title="Resize start date"
              ></resize-handle>
            `
          : ""}
        ${isLast
          ? html`
              <resize-handle
                axis="horizontal"
                position="end"
                title="Resize end date"
              ></resize-handle>
            `
          : ""}
      </event-card>
    `;
  }

  protected override onDragStart() {
    const renderedDays = this.renderedDays.map((day) => day.toString());
    this.#lockedStackIndex = this.#getStackIndex(renderedDays, { ignoreLock: true });
  }

  protected override onDragEnd() {
    // Clear any locked stack index so this event can be re-stacked normally.
    this.#lockedStackIndex = null;

    // Force a re-render of all all-day events in this section so stacking
    // is recalculated consistently after a drag ends. This avoids cases where
    // some events keep a stale vertical position until another drag occurs.
    const parent = this.parentElement;
    if (parent) {
      const siblings = parent.querySelectorAll<AllDayEvent>("all-day-event");
      siblings.forEach((event) => {
        event.requestUpdate();
      });
    }
  }

  #getEventHeightPx(): number {
    const el = this.parentElement ?? this;
    const value = getComputedStyle(el).getPropertyValue("--event-height").trim();
    const px = parseFloat(value);
    return Number.isFinite(px) ? px : 32;
  }

  getInteractionStackOffsetY(): number {
    const startDate = this.startDate;
    if (!startDate) return 0;

    const renderedDays = this.renderedDays.map((day) => day.toString());
    const dayIndex = renderedDays.indexOf(startDate.toString());
    if (dayIndex < 0) return 0;

    const rowIndex = this.daysPerRow > 0 ? Math.floor(dayIndex / this.daysPerRow) : 0;
    const stackIndex = this.#getStackIndexForPosition(renderedDays, rowIndex);
    return stackIndex * this.#getEventHeightPx();
  }

  get #interactionLabel(): string {
    const title = this.summary?.trim() || "Untitled all-day event";
    const time = this.displayTime?.trim();
    return time ? `${title}. ${time}` : title;
  }
}
