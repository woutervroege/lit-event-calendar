import { Temporal } from "@js-temporal/polyfill";
import { html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";
import { getEventColorStyles } from "../utils/EventColor";
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
  #createRowInset(
    rowIndex: number,
    startColIndex: number,
    widthInColumns: number,
    cols: number,
    renderedDays: string[]
  ): Record<string, string | number> {
    const left = (startColIndex / cols) * 100;
    const stackIndex = this.#getStackIndexForPosition(renderedDays, rowIndex);
    const top = this.#getTopPosition(rowIndex, stackIndex);

    return {
      top,
      height: `var(--_lc-event-height, 32px)`,
      "--_lc-left": `${left}%`,
      "--_lc-width": widthInColumns,
      "--_lc-margin-left": 0,
      "--_lc-indentation": "0px",
      "--_lc-z-index": 1,
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
    const dayNumberOffset = "var(--_lc-all-day-day-number-space)";

    if (hasGrid) {
      return `calc(var(--_lc-row-height, 100%) * ${rowIndex} + ${dayNumberOffset} + var(--_lc-event-height, 32px) * ${stackIndex})`;
    }

    return `calc(${dayNumberOffset} + var(--_lc-event-height, 32px) * ${stackIndex})`;
  }

  get dayInsets() {
    const insets: Array<Record<string, string | number>> = [];
    const renderedDays = this.renderedDays.map((day) => day.toString());
    if (!renderedDays.length) return insets;

    const visibleDayIndexes = this.days
      .map((day) => renderedDays.indexOf(day.toString()))
      .filter((dayIndex) => dayIndex >= 0)
      .sort((a, b) => a - b);
    if (!visibleDayIndexes.length) return insets;

    const totalCols = this.daysPerRow > 0 ? this.daysPerRow : renderedDays.length;
    const rowSegments = new Map<number, { startColIndex: number; endColIndex: number }>();

    visibleDayIndexes.forEach((dayIndex) => {
      const rowIndex = this.daysPerRow > 0 ? Math.floor(dayIndex / this.daysPerRow) : 0;
      const colIndex = this.daysPerRow > 0 ? dayIndex % this.daysPerRow : dayIndex;
      const existingSegment = rowSegments.get(rowIndex);

      if (!existingSegment) {
        rowSegments.set(rowIndex, { startColIndex: colIndex, endColIndex: colIndex });
        return;
      }

      existingSegment.startColIndex = Math.min(existingSegment.startColIndex, colIndex);
      existingSegment.endColIndex = Math.max(existingSegment.endColIndex, colIndex);
    });

    Array.from(rowSegments.entries())
      .sort((a, b) => a[0] - b[0])
      .forEach(([rowIndex, segment]) => {
        const widthInColumns = segment.endColIndex - segment.startColIndex + 1;
        insets.push(
          this.#createRowInset(
            rowIndex,
            segment.startColIndex,
            widthInColumns,
            totalCols,
            renderedDays
          )
        );
      });

    return insets;
  }

  get displayTime(): string {
    if (this.#previewDisplayTime != null) {
      return this.#previewDisplayTime;
    }

    if (!this.startHasTimeComponent) return "";

    const startDate = this.startDate;
    const startTime = this.startTime;
    if (!startDate || !startTime) return "";

    const isStartVisible = this.renderedDays.some(
      (day) => Temporal.PlainDate.compare(day, startDate) === 0
    );
    if (!isStartVisible) return "";

    return startTime.toLocaleString(this.locale, {
      hour: "2-digit",
      minute: "2-digit",
    });
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
    const startTime = this.startTime;
    if (!startDate || !startTime) {
      this.#clearPreviewDisplayTime();
      return;
    }

    this.#previewDisplayTime = startTime.toLocaleString(this.locale, {
      hour: "2-digit",
      minute: "2-digit",
    });
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

  render() {
    const dayInsets = this.dayInsets;
    const canResizeStart = this.days.length > 1;
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
    const startsBeforeVisibleRange = this.#startsBeforeVisibleRange();
    const endsAfterVisibleRange = this.#endsAfterVisibleRange();

    return dayInsets.map((inset, index) =>
      this.#renderEventCard(
        inset,
        index,
        dayInsets.length,
        canResizeStart,
        startsBeforeVisibleRange,
        endsAfterVisibleRange
      )
    );
  }

  #renderEventCard(
    inset: Record<string, string | number>,
    index: number,
    total: number,
    canResizeStart: boolean,
    startsBeforeVisibleRange: boolean,
    endsAfterVisibleRange: boolean
  ) {
    const isFirst = index === 0;
    const isLast = index === total - 1;
    const hasRoundedStart = isFirst && !startsBeforeVisibleRange;
    const hasRoundedEnd = isLast && !endsAfterVisibleRange;

    return html`
      <event-card
        summary=${isFirst ? this.summary : ""}
        time=${isFirst ? this.displayTime : ""}
        segment-direction="horizontal"
        ?past=${this.isPast}
        style=${styleMap(inset)}
        ?first-segment=${hasRoundedStart}
        ?last-segment=${hasRoundedEnd}
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

  #startsBeforeVisibleRange(): boolean {
    const startDate = this.startDate;
    const dayBounds = this.renderedDayBounds;
    if (!startDate || !dayBounds) return false;

    return Temporal.PlainDate.compare(startDate, dayBounds.firstDay) < 0;
  }

  #endsAfterVisibleRange(): boolean {
    const endDate = this.endDate;
    const dayBounds = this.renderedDayBounds;
    if (!endDate || !dayBounds) return false;

    return Temporal.PlainDate.compare(endDate, dayBounds.lastDay) > 0;
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
    const value = getComputedStyle(el).getPropertyValue("--_lc-event-height").trim();
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
    const baseLabel = time ? `${title}. ${time}` : title;
    return this.isPast ? `Past event. ${baseLabel}` : baseLabel;
  }
}
