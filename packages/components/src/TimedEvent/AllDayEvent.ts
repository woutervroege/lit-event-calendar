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

    const occupiedRows = new Set<number>();

    for (const sibling of this.siblings) {
      if (sibling === this) break;
      const siblingDayKeys = sibling.days.map((day) => day.toString());
      if (!siblingDayKeys.includes(referenceDay)) continue;

      const siblingIndex = sibling.#getStackIndex(renderedDays);
      occupiedRows.add(siblingIndex);
    }

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

    let candidate = 0;
    while (occupied.has(candidate)) {
      candidate += 1;
    }
    return candidate;
  }

  // All-day events always occupy the full width of the day column they belong to.
  // When daysPerRow > 0 (month view), position by column = dayIndex % daysPerRow, row = floor(dayIndex / daysPerRow).
  #createDayInset(
    day: Temporal.PlainDate,
    renderedDays: string[]
  ): Record<string, string | number> | null {
    const dayIndex = renderedDays.indexOf(day.toString());
    if (dayIndex === -1 || renderedDays.length === 0) return null;

    const cols = this.daysPerRow > 0 ? this.daysPerRow : renderedDays.length;
    const rowIndex = this.daysPerRow > 0 ? Math.floor(dayIndex / this.daysPerRow) : 0;
    const colIndex = this.daysPerRow > 0 ? dayIndex % this.daysPerRow : dayIndex;
    const left = (colIndex / cols) * 100;
    const stackIndex =
      this.daysPerRow > 0 && this.gridRows > 0
        ? this.#getStackIndexForRow(renderedDays, rowIndex)
        : this.#getStackIndex(renderedDays);

    const isDragging = this.interactionController.isDragging;
    const top = isDragging
      ? this.daysPerRow > 0 && this.gridRows > 0
        ? `calc(var(--row-height, 100%) * ${rowIndex})`
        : "0"
      : this.daysPerRow > 0 && this.gridRows > 0
        ? `calc(var(--row-height, 100%) * ${rowIndex} + var(--event-height, 32px) * ${stackIndex})`
        : `calc(var(--event-height, 32px) * ${stackIndex})`;

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

    const renderedDays = [...this.renderedDays].sort((a, b) => Temporal.PlainDate.compare(a, b));
    if (!renderedDays.length) return "";

    const firstVisibleDay = renderedDays[0];
    const lastVisibleDay = renderedDays[renderedDays.length - 1];

    const extendsBefore = Temporal.PlainDate.compare(startDate, firstVisibleDay) < 0;
    const extendsAfter = Temporal.PlainDate.compare(endDate, lastVisibleDay) > 0;

    if ((extendsBefore || extendsAfter) && Temporal.PlainDate.compare(startDate, endDate) !== 0) {
      return formatDateRangeShort(this.locale, startDate, endDate);
    }

    return "";
  }

  #handleInteractionDragHover = (event: Event) => {
    if (!(event instanceof CustomEvent)) return;

    const hover = event.detail as
      | {
          dayIndex: number;
          time: Temporal.PlainTime | null;
          clientX: number;
          clientY: number;
        }
      | null;

    if (!hover) {
      this.#previewDisplayTime = null;
      this.requestUpdate();
      return;
    }

    const renderedDays = this.renderedDays;
    if (!renderedDays || !renderedDays.length) {
      this.#previewDisplayTime = null;
      this.requestUpdate();
      return;
    }

    const { dayIndex } = hover;
    if (dayIndex == null || dayIndex < 0 || dayIndex >= renderedDays.length) {
      this.#previewDisplayTime = null;
      this.requestUpdate();
      return;
    }

    const startDate = this.startDate;
    const endDate = this.endDate;
    if (!startDate || !endDate) {
      this.#previewDisplayTime = null;
      this.requestUpdate();
      return;
    }

    const targetStartDate = renderedDays[dayIndex];

    // Calculate inclusive number of days spanned by the event.
    const diff = startDate.until(endDate, { largestUnit: "day" });
    const daysCount = diff.days + 1;

    const targetEndDate = targetStartDate.add({ days: daysCount - 1 });

    this.#previewDisplayTime = formatDateRangeShort(this.locale, targetStartDate, targetEndDate);
    this.requestUpdate();
  };

  render() {
    const dayInsets = this.dayInsets;
    const canResizeStart = dayInsets.length > 1;
    const colorStyles = getEventColorStyles(this.color);
    const isDragging = this.interactionController.isDragging;
    const hasOffset = this.dragOffsetX !== 0 || this.dragOffsetY !== 0;
    const stackOffsetY =
      (isDragging || hasOffset) && this.#lockedStackIndex !== null
        ? this.#lockedStackIndex * this.#getEventHeightPx()
        : 0;
    const dragTransform =
      isDragging || hasOffset
        ? `translate(${this.dragOffsetX}px, ${this.dragOffsetY + stackOffsetY}px)`
        : "none";
    return html`
            <button
                class="m-0 text-0 relative w-full h-full border-none bg-none outline-none p-0"
                style=${styleMap({
                  ...colorStyles,
                  transform: dragTransform,
                  // Disable transform animation entirely to avoid snap/flash at drag end.
                  transition: "none",
                })}
                @pointerdown=${this.interactionController.pointerDownHandler}
                @pointermove=${this.interactionController.pointerMoveHandler}
                @pointerup=${this.interactionController.pointerUpHandler}
            >

                ${dayInsets.map(
                  (inset, i) => html`
                    <event-card
                        summary=${i === 0 ? this.summary : ""}
                        time=${i === 0 ? this.displayTime : ""}
                        style=${styleMap(inset)}
                        ?first-segment=${i === 0}
                        ?last-segment=${i === dayInsets.length - 1}
                    >
                        ${
                          i === 0 && canResizeStart
                            ? html`
                            <resize-handle 
                                axis="horizontal"
                                position="start"
                                title="Resize start date"
                            ></resize-handle>
                        `
                            : ""
                        }
                        ${
                          i === dayInsets.length - 1
                            ? html`
                            <resize-handle 
                                axis="horizontal"
                                position="end"
                                title="Resize end date"
                            ></resize-handle>
                        `
                            : ""
                        }
                    </event-card>
                `
                )}
            
            </button>
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
}
