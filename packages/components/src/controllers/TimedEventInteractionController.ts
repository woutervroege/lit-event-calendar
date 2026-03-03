import { Temporal } from "@js-temporal/polyfill";

const SECONDS_IN_DAY = 24 * 60 * 60;
const MAX_FRACTION = 0.999999;

type TimedEventHost = HTMLElement & {
  start: Temporal.PlainDateTime | string | null;
  end: Temporal.PlainDateTime | string | null;
  renderedDays?: unknown;
  daysPerRow?: number;
  gridRows?: number;
};

type InteractionOperation = "move" | "resize-start" | "resize-end";
type InteractionMode = "timed" | "all-day";

type TimedEventInteractionControllerOptions = {
  mode?: InteractionMode;
};

export class TimedEventInteractionController {
  #host: TimedEventHost;
  #isDragging = false;
  #operation: InteractionOperation = "move";
  #activePointerId?: number;
  #pointerCaptureTarget?: HTMLElement;
  #bounds: DOMRect | null = null;
  #savedY = 0;
  #savedHeight = 0;
  #savedDayIndex = 0;
  #savedStart: Temporal.PlainDateTime | null = null;
  #savedEnd: Temporal.PlainDateTime | null = null;
  #savedClientX = 0;
  #savedClientY = 0;
  #grabOffsetX = 0;
  #grabOffsetY = 0;
  #mode: InteractionMode = "timed";
  #dragOffsetX = 0;
  #dragOffsetY = 0;
  #highlightedDayIndex: number | null = null;
  #highlightedTime: Temporal.PlainTime | null = null;
  static snapInterval: number = 5;
  static renderedDayCount: number = 7;

  constructor(host: TimedEventHost, options: TimedEventInteractionControllerOptions = {}) {
    this.#host = host;
    this.#mode = options.mode ?? "timed";
  }

  get isDragging(): boolean {
    return this.#isDragging;
  }

  readonly pointerDownHandler = (e: PointerEvent) => {
    const operation = this.#deriveOperation(e);
    if (!operation) return;

    this.#beginInteraction(e, operation);
  };

  readonly pointerMoveHandler = (e: PointerEvent) => {
    if (!this.#isActivePointerEvent(e) || !this.#bounds || !this.#savedStart || !this.#savedEnd) {
      return;
    }

    if (this.#operation !== "move") {
      this.#handleResizePointerMove(e);
      return;
    }

    this.#handleMovePointerMove(e);
  };

  readonly pointerUpHandler = (e: PointerEvent) => {
    if (this.#activePointerId === undefined || e.pointerId !== this.#activePointerId) {
      return;
    }

    window.removeEventListener("pointermove", this.pointerMoveHandler, true);

    if (this.#operation === "move" && this.#bounds && this.#savedStart && this.#savedEnd) {
      this.#finalizeMove();
      return;
    }

    this.#finalizeNonMove();
  };

  #deriveOperation(event: PointerEvent): InteractionOperation | null {
    const target = event.target as EventTarget | null;
    const allowedElement = this.#getAllowedTarget(target, event.composedPath());

    if (!allowedElement) {
      return null;
    }

    if (allowedElement.tagName === "RESIZE-HANDLE") {
      const position = allowedElement.getAttribute("position");
      if (position === "start") return "resize-start";
      if (position === "end") return "resize-end";
    }

    return "move";
  }

  #beginInteraction(e: PointerEvent, operation: InteractionOperation) {
    this.#isDragging = true;
    this.#operation = operation;
    this.#activePointerId = e.pointerId;
    this.#pointerCaptureTarget = (e.currentTarget as HTMLElement | null) ?? undefined;
    this.#pointerCaptureTarget?.setPointerCapture(e.pointerId);
    window.addEventListener("pointerup", this.pointerUpHandler, true);

    this.#savedY = e.clientY;
    this.#savedHeight = this.#host.clientHeight;
    this.#savedStart = this.#toPlainDateTimeOrNull(this.#host.start);
    this.#savedEnd = this.#toPlainDateTimeOrNull(this.#host.end);

    this.#initializeBoundsAndDayIndex(e);
    this.#initializeGrabOffsets(e);

    window.addEventListener("pointermove", this.pointerMoveHandler, true);
    this.#dispatchDragStateChange(true);
  }

  #initializeBoundsAndDayIndex(e: PointerEvent) {
    this.#bounds = this.#host.getBoundingClientRect();
    const bounds = this.#bounds;
    if (!bounds) return;

    const clientX = e.clientX - bounds.left;
    const clientY = e.clientY - bounds.top;
    const fractionX = bounds.width === 0 ? 0 : clientX / bounds.width;
    const fractionY = bounds.height === 0 ? 0 : clientY / bounds.height;
    this.#savedDayIndex = this.#computeDayIndex(fractionX, fractionY);
    this.#savedClientX = e.clientX;
    this.#savedClientY = e.clientY;
    this.#dragOffsetX = 0;
    this.#dragOffsetY = 0;
  }

  #initializeGrabOffsets(e: PointerEvent) {
    if (this.#operation !== "move") return;

    const sectionEl = this.#host.parentElement;
    if (!sectionEl) return;

    const sectionBounds = sectionEl.getBoundingClientRect();
    const { left: startLeft, top: startTop } = this.#getEventStartPosition(sectionBounds);
    this.#grabOffsetX = e.clientX - startLeft;
    this.#grabOffsetY = e.clientY - startTop;
  }

  #toPlainDateTimeOrNull(
    value: Temporal.PlainDateTime | string | null | undefined
  ): Temporal.PlainDateTime | null {
    if (value == null) return null;
    if (typeof value === "string") return Temporal.PlainDateTime.from(value);
    return value;
  }

  #isActivePointerEvent(e: PointerEvent): boolean {
    return this.#isDragging && this.#activePointerId !== undefined && e.pointerId === this.#activePointerId;
  }

  #handleResizePointerMove(e: PointerEvent) {
    const resizeContext = this.#getResizeContext(e);
    if (!resizeContext) return;

    const { savedStart, savedEnd, adjustedSeconds } = resizeContext;
    const { newStart, newEnd } = this.#getResizedRange(savedStart, savedEnd, adjustedSeconds);

    this.#applyResizeResult(newStart, newEnd);
  }

  #getResizeContext(e: PointerEvent):
    | { savedStart: Temporal.PlainDateTime; savedEnd: Temporal.PlainDateTime; adjustedSeconds: number }
    | null {
    const bounds = this.#bounds;
    const savedStart = this.#savedStart;
    const savedEnd = this.#savedEnd;

    if (!bounds || !savedStart || !savedEnd) return null;

    const deltaY = e.clientY - this.#savedY;
    const deltaYFraction = this.#savedHeight === 0 ? 0 : deltaY / this.#savedHeight;

    const clientX = e.clientX - bounds.left;
    const clientY = e.clientY - bounds.top;
    const fractionX = bounds.width === 0 ? 0 : clientX / bounds.width;
    const fractionY = bounds.height === 0 ? 0 : clientY / bounds.height;
    const dayIndex = this.#computeDayIndex(fractionX, fractionY);

    const changedSecondsWithinDay =
      this.#mode === "all-day" ? 0 : Math.round(deltaYFraction * SECONDS_IN_DAY);
    const changedDays = dayIndex - this.#savedDayIndex;
    const changedSeconds = changedSecondsWithinDay + changedDays * SECONDS_IN_DAY;

    const adjustedSeconds = this.#snapSeconds(changedSeconds);

    return { savedStart, savedEnd, adjustedSeconds };
  }

  #getResizedRange(
    savedStart: Temporal.PlainDateTime,
    savedEnd: Temporal.PlainDateTime,
    adjustedSeconds: number
  ): { newStart: Temporal.PlainDateTime; newEnd: Temporal.PlainDateTime } {
    const changedDuration = Temporal.Duration.from({ seconds: adjustedSeconds });
    let newStart = savedStart.add(changedDuration);
    let newEnd = savedEnd.add(changedDuration);

    const ctor = this.constructor as typeof TimedEventInteractionController;
    const minDurationSeconds = ctor.snapInterval * 60;

    if (this.#operation === "resize-start") {
      const maxStart = savedEnd.subtract({ seconds: minDurationSeconds });
      if (Temporal.PlainDateTime.compare(newStart, maxStart) > 0) {
        newStart = maxStart;
      }
    }

    if (this.#operation === "resize-end") {
      const minEnd = savedStart.add({ seconds: minDurationSeconds });
      if (Temporal.PlainDateTime.compare(newEnd, minEnd) < 0) {
        newEnd = minEnd;
      }
    }

    return { newStart, newEnd };
  }

  #applyResizeResult(newStart: Temporal.PlainDateTime, newEnd: Temporal.PlainDateTime) {
    if (this.#operation !== "resize-end") {
      this.#host.start = newStart.toString();
    }

    if (this.#operation !== "resize-start") {
      this.#host.end = newEnd.toString();
    }
  }

  #handleMovePointerMove(e: PointerEvent) {
    const sectionElement = this.#host.parentElement;
    if (!sectionElement) return;

    const sectionBounds = sectionElement.getBoundingClientRect();
    const { fractionX, fractionY, eventStartVisualLeft, eventStartVisualTop } =
      this.#getMovePointerFractions(e, sectionBounds);

    const hoveredDayIndex = this.#computeDayIndex(fractionX, fractionY);
    const hoveredTime = this.#getHoveredTimeFromFraction(fractionY);

    this.#updateHoverState(hoveredDayIndex, hoveredTime);
    this.#dispatchDragHover({
      dayIndex: hoveredDayIndex,
      time: hoveredTime,
      clientX: eventStartVisualLeft,
      clientY: eventStartVisualTop,
    });

    this.#updateDragOffset(e, sectionBounds);
  }

  #getMovePointerFractions(
    e: PointerEvent,
    sectionBounds: DOMRect
  ): { fractionX: number; fractionY: number; eventStartVisualLeft: number; eventStartVisualTop: number } {
    const eventStartVisualLeft = e.clientX - this.#grabOffsetX;
    const eventStartVisualTop = e.clientY - this.#grabOffsetY;
    const relativeX = eventStartVisualLeft - sectionBounds.left;
    const relativeY = eventStartVisualTop - sectionBounds.top;
    const fractionX = sectionBounds.width === 0 ? 0 : relativeX / sectionBounds.width;
    const fractionY = sectionBounds.height === 0 ? 0 : relativeY / sectionBounds.height;

    return { fractionX, fractionY, eventStartVisualLeft, eventStartVisualTop };
  }

  #getHoveredTimeFromFraction(fractionY: number): Temporal.PlainTime | null {
    if (this.#mode !== "timed") return null;
    return this.#getSnappedTimeFromFraction(fractionY);
  }

  #updateHoverState(dayIndex: number, time: Temporal.PlainTime | null) {
    this.#highlightedDayIndex = dayIndex;
    this.#highlightedTime = time;
  }

  #updateDragOffset(e: PointerEvent, sectionBounds: DOMRect) {
    const { left: currentStartLeft, top: currentStartTop } =
      this.#getEventStartPosition(sectionBounds);
    this.#dragOffsetX = e.clientX - this.#grabOffsetX - currentStartLeft;
    this.#dragOffsetY = e.clientY - this.#grabOffsetY - currentStartTop;

    this.#dispatchDragOffset({
      offsetX: this.#dragOffsetX,
      offsetY: this.#dragOffsetY,
    });
  }

  #finalizeMove() {
    const context = this.#getFinalizeMoveContext();
    if (!context) return;

    const { dayIndex, time, savedStart, savedEnd, renderedDays } = context;
    const { targetStart, targetEnd } = this.#getFinalTargetRange(
      dayIndex,
      time,
      savedStart,
      savedEnd,
      renderedDays
    );

    this.#applyFinalMove(targetStart, targetEnd);
    this.#cleanupAfterFinalMove();
  }

  #getFinalizeMoveContext():
    | {
        dayIndex: number;
        time: Temporal.PlainTime | null;
        savedStart: Temporal.PlainDateTime;
        savedEnd: Temporal.PlainDateTime;
        renderedDays: Temporal.PlainDate[];
      }
    | null {
    const bounds = this.#bounds;
    const savedStart = this.#savedStart;
    const savedEnd = this.#savedEnd;
    const renderedDays = (this.#host as { renderedDays?: Temporal.PlainDate[] }).renderedDays;

    if (!bounds || !savedStart || !savedEnd || !renderedDays || !renderedDays.length) {
      return null;
    }

    const dayIndex = this.#getFinalDayIndex(bounds);
    const time = this.#getFinalTime(bounds);

    if (dayIndex === null || dayIndex < 0 || dayIndex >= renderedDays.length) {
      return null;
    }

    return { dayIndex, time, savedStart, savedEnd, renderedDays };
  }

  #getFinalDayIndex(bounds: DOMRect): number | null {
    if (this.#highlightedDayIndex !== null) return this.#highlightedDayIndex;

    const sectionElement = this.#host.parentElement;
    if (!sectionElement) return null;
    const sectionBounds = sectionElement.getBoundingClientRect();
    const { left: eventStartLeft, top: eventStartTop } =
      this.#getEventStartPosition(sectionBounds);
    const eventStartVisualLeft = eventStartLeft + this.#dragOffsetX;
    const eventStartVisualTop = eventStartTop + this.#dragOffsetY;
    const relativeX = eventStartVisualLeft - sectionBounds.left;
    const relativeY = eventStartVisualTop - sectionBounds.top;
    const fractionX = sectionBounds.width === 0 ? 0 : relativeX / sectionBounds.width;
    const fractionY = sectionBounds.height === 0 ? 0 : relativeY / sectionBounds.height;
    return this.#computeDayIndex(fractionX, fractionY);
  }

  #getFinalTime(bounds: DOMRect): Temporal.PlainTime | null {
    if (this.#highlightedTime) return this.#highlightedTime;

    if (this.#mode !== "timed") return null;

    const sectionElement = this.#host.parentElement;
    if (!sectionElement) return null;
    const sectionBounds = sectionElement.getBoundingClientRect();
    const { left: eventStartLeft, top: eventStartTop } =
      this.#getEventStartPosition(sectionBounds);
    const eventStartVisualLeft = eventStartLeft + this.#dragOffsetX;
    const eventStartVisualTop = eventStartTop + this.#dragOffsetY;
    const relativeX = eventStartVisualLeft - sectionBounds.left;
    const relativeY = eventStartVisualTop - sectionBounds.top;
    const fractionY =
      sectionBounds.height === 0 ? 0 : relativeY / sectionBounds.height;

    return this.#getSnappedTimeFromFraction(fractionY);
  }

  #getFinalTargetRange(
    dayIndex: number,
    time: Temporal.PlainTime | null,
    savedStart: Temporal.PlainDateTime,
    savedEnd: Temporal.PlainDateTime,
    renderedDays: Temporal.PlainDate[]
  ): { targetStart: Temporal.PlainDateTime; targetEnd: Temporal.PlainDateTime } {
    const targetDay = renderedDays[dayIndex];

    if (this.#mode === "all-day") {
      const targetStart = targetDay.toPlainDateTime({ hour: 0, minute: 0, second: 0 });

      const startDate = savedStart.toPlainDate();
      const inclusiveEndDate = savedEnd.subtract({ nanoseconds: 1 }).toPlainDate();

      const daysDiff = startDate.until(inclusiveEndDate, { largestUnit: "day" });
      const daysCount = daysDiff.days + 1;

      const targetEndDate = targetDay.add({ days: daysCount });
      const targetEnd = targetEndDate.toPlainDateTime({ hour: 0, minute: 0, second: 0 });

      return { targetStart, targetEnd };
    }

    if (!time) {
      throw new Error("Timed move requires a time value.");
    }

    const targetStart = targetDay.toPlainDateTime({
      hour: time.hour,
      minute: time.minute,
      second: 0,
    });

    const duration = savedStart.until(savedEnd);
    const targetEnd = targetStart.add(duration);

    return { targetStart, targetEnd };
  }

  #applyFinalMove(targetStart: Temporal.PlainDateTime, targetEnd: Temporal.PlainDateTime) {
    this.#host.start = targetStart.toString();
    this.#host.end = targetEnd.toString();
    this.#host.dispatchEvent(new CustomEvent("update"));
  }

  #cleanupAfterFinalMove() {
    this.#highlightedDayIndex = null;
    this.#highlightedTime = null;
    this.#dispatchDragHover(null);

    const oldPointerId = this.#activePointerId;
    this.#activePointerId = undefined;
    this.#bounds = null;
    this.#savedStart = null;
    this.#savedEnd = null;

    if (oldPointerId !== undefined) {
      this.#pointerCaptureTarget?.releasePointerCapture(oldPointerId);
    }
    this.#pointerCaptureTarget = undefined;

    requestAnimationFrame(() => {
      this.#dragOffsetX = 0;
      this.#dragOffsetY = 0;
      this.#dispatchDragOffset({ offsetX: 0, offsetY: 0 });
      this.#isDragging = false;
      this.#dispatchDragStateChange(false);
    });
  }

  #finalizeNonMove() {
    window.removeEventListener("pointerup", this.pointerUpHandler, true);
    window.removeEventListener("pointermove", this.pointerMoveHandler, true);
    if (this.#activePointerId !== undefined) {
      this.#pointerCaptureTarget?.releasePointerCapture(this.#activePointerId);
    }
    this.#pointerCaptureTarget = undefined;
    this.#activePointerId = undefined;
    this.#isDragging = false;
    this.#highlightedDayIndex = null;
    this.#highlightedTime = null;

    this.#dispatchDragHover(null);

    if (this.#operation !== "move") {
      this.#dragOffsetX = 0;
      this.#dragOffsetY = 0;
      this.#dispatchDragOffset({ offsetX: 0, offsetY: 0 });
    }

    this.#host.dispatchEvent(new CustomEvent("update"));
    this.#dispatchDragStateChange(false);
  }

  #getAllowedTarget(target: EventTarget | null, composedPath: EventTarget[]): HTMLElement | null {
    const candidates = [target, ...composedPath];

    for (const candidate of candidates) {
      if (!(candidate instanceof HTMLElement)) continue;

      if (candidate.tagName === "RESIZE-HANDLE") {
        return candidate;
      }

      if (this.#isEventCardDiv(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  #isEventCardDiv(element: HTMLElement): boolean {
    if (element.tagName !== "DIV") {
      return false;
    }

    const rootNode = element.getRootNode();
    if (!(rootNode instanceof ShadowRoot)) {
      return false;
    }

    const host = rootNode.host;
    return host instanceof HTMLElement && host.tagName === "EVENT-CARD";
  }

  #computeDayIndex(fractionX: number, fractionY?: number): number {
    const dayCount = this.#getRenderedDayCount();
    if (dayCount <= 1) return 0;
    const daysPerRow = this.#getDaysPerRow();
    if (daysPerRow > 0 && daysPerRow < dayCount && fractionY !== undefined) {
      const totalRows = Math.ceil(dayCount / daysPerRow);
      const clampedX = Math.max(0, Math.min(MAX_FRACTION, fractionX));
      const clampedY = Math.max(0, Math.min(MAX_FRACTION, fractionY));
      const row = Math.floor(clampedY * totalRows);
      const col = Math.floor(clampedX * daysPerRow);
      const index = row * daysPerRow + col;
      return Math.min(index, dayCount - 1);
    }
    const clampedFraction = Math.max(0, Math.min(MAX_FRACTION, fractionX));
    return Math.floor(clampedFraction * dayCount);
  }

  #getDaysPerRow(): number {
    const host = this.#host as { daysPerRow?: number };
    return host.daysPerRow ?? 0;
  }

  #getRenderedDayCount(): number {
    const renderedDays = this.#host.renderedDays;
    if (Array.isArray(renderedDays)) return renderedDays.length;
    const ctor = this.constructor as typeof TimedEventInteractionController;
    return ctor.renderedDayCount;
  }

  /** Get the pixel position (left, top) of the event's start within the section. */
  #getEventStartPosition(sectionBounds: DOMRect): { left: number; top: number } {
    const renderedDays = (this.#host as { renderedDays?: Temporal.PlainDate[] }).renderedDays;
    if (!this.#savedStart || !renderedDays?.length) {
      return { left: sectionBounds.left, top: sectionBounds.top };
    }

    const startDayIndex = this.#getStartDayIndex(renderedDays, this.#savedStart);
    if (startDayIndex < 0) {
      return { left: sectionBounds.left, top: sectionBounds.top };
    }

    if (this.#mode === "all-day") {
      return this.#getAllDayStartPosition(sectionBounds, startDayIndex, renderedDays.length);
    }

    return this.#getTimedStartPosition(sectionBounds, startDayIndex, renderedDays.length);
  }

  #getStartDayIndex(
    renderedDays: Temporal.PlainDate[],
    savedStart: Temporal.PlainDateTime
  ): number {
    const startDate = savedStart.toPlainDate();
    return renderedDays.findIndex(
      (d) => (typeof d === "string" ? d : d.toString()) === startDate.toString()
    );
  }

  #getAllDayStartPosition(
    sectionBounds: DOMRect,
    startDayIndex: number,
    dayCount: number
  ): { left: number; top: number } {
    const daysPerRow = this.#getDaysPerRow();

    if (daysPerRow > 0 && daysPerRow < dayCount) {
      const gridRows = (this.#host as { gridRows?: number }).gridRows ?? 1;
      const colIndex = startDayIndex % daysPerRow;
      const rowIndex = Math.floor(startDayIndex / daysPerRow);
      const left = sectionBounds.left + (colIndex / daysPerRow) * sectionBounds.width;
      const top = sectionBounds.top + (rowIndex / gridRows) * sectionBounds.height;
      return { left, top };
    }

    const left = sectionBounds.left + (startDayIndex / dayCount) * sectionBounds.width;
    return { left, top: sectionBounds.top };
  }

  #getTimedStartPosition(
    sectionBounds: DOMRect,
    startDayIndex: number,
    dayCount: number
  ): { left: number; top: number } {
    const left = sectionBounds.left + (startDayIndex / dayCount) * sectionBounds.width;
    const startTime = this.#savedStart!.toPlainTime();
    const seconds = startTime.hour * 3600 + startTime.minute * 60 + startTime.second;
    const fractionY = seconds / SECONDS_IN_DAY;
    const top = sectionBounds.top + fractionY * sectionBounds.height;
    return { left, top };
  }

  #snapSeconds(seconds: number): number {
    const ctor = this.constructor as typeof TimedEventInteractionController;
    const increment = ctor.snapInterval * 60;
    return Math.round(seconds / increment) * increment;
  }

  #getSnappedTimeFromFraction(fractionY: number): Temporal.PlainTime {
    const targetTimeFraction = Math.max(0, Math.min(1, fractionY));
    const targetSecondsWithinDay = Math.round(targetTimeFraction * SECONDS_IN_DAY);
    const adjustedSeconds = this.#snapSeconds(targetSecondsWithinDay);
    const hours = Math.floor(adjustedSeconds / 3600);
    const minutes = Math.floor((adjustedSeconds % 3600) / 60);
    return Temporal.PlainTime.from({ hour: hours, minute: minutes, second: 0 });
  }

  #dispatchDragStateChange(isDragging: boolean) {
    this.#host.dispatchEvent(
      new CustomEvent("interaction-drag-state", {
        detail: { isDragging },
        bubbles: false,
        composed: false,
      })
    );
  }

  #dispatchDragHover(
    hover: {
      dayIndex: number;
      time: Temporal.PlainTime | null;
      clientX: number;
      clientY: number;
    } | null
  ) {
    this.#host.dispatchEvent(
      new CustomEvent("interaction-drag-hover", {
        detail: hover,
        bubbles: true,
        composed: true,
      })
    );
  }

  #dispatchDragOffset(offset: { offsetX: number; offsetY: number }) {
    this.#host.dispatchEvent(
      new CustomEvent("interaction-drag-offset", {
        detail: offset,
        bubbles: false,
        composed: false,
      })
    );
  }

  get dragOffset(): { x: number; y: number } {
    return { x: this.#dragOffsetX, y: this.#dragOffsetY };
  }
}
