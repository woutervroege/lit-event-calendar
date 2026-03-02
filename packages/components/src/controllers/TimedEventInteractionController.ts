import { Temporal } from "@js-temporal/polyfill";

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
    if (!operation) {
      return;
    }

    this.#isDragging = true;
    this.#operation = operation;
    this.#activePointerId = e.pointerId;
    this.#pointerCaptureTarget = (e.currentTarget as HTMLElement | null) ?? undefined;
    this.#pointerCaptureTarget?.setPointerCapture(e.pointerId);
    window.addEventListener("pointerup", this.pointerUpHandler, true);

    this.#savedY = e.clientY;
    this.#savedHeight = this.#host.clientHeight;
    this.#savedStart =
      this.#host.start != null
        ? typeof this.#host.start === "string"
          ? Temporal.PlainDateTime.from(this.#host.start)
          : this.#host.start
        : null;
    this.#savedEnd =
      this.#host.end != null
        ? typeof this.#host.end === "string"
          ? Temporal.PlainDateTime.from(this.#host.end)
          : this.#host.end
        : null;

    this.#bounds = this.#host.getBoundingClientRect();

    if (!this.#bounds) return;
    const clientX = e.clientX - this.#bounds.left;
    const clientY = e.clientY - this.#bounds.top;
    const fractionX = this.#bounds.width === 0 ? 0 : clientX / this.#bounds.width;
    const fractionY = this.#bounds.height === 0 ? 0 : clientY / this.#bounds.height;
    this.#savedDayIndex = this.#computeDayIndex(fractionX, fractionY);
    this.#savedClientX = e.clientX;
    this.#savedClientY = e.clientY;
    this.#dragOffsetX = 0;
    this.#dragOffsetY = 0;
    if (this.#operation === "move") {
      const sectionEl = this.#host.parentElement;
      if (sectionEl) {
        const sectionBounds = sectionEl.getBoundingClientRect();
        const { left: startLeft, top: startTop } = this.#getEventStartPosition(sectionBounds);
        this.#grabOffsetX = e.clientX - startLeft;
        this.#grabOffsetY = e.clientY - startTop;
      }
    }
    window.addEventListener("pointermove", this.pointerMoveHandler, true);
    this.#dispatchDragStateChange(true);
  };

  readonly pointerMoveHandler = (e: PointerEvent) => {
    // Only handle moves for the active pointer
    if (
      !this.#isDragging ||
      this.#activePointerId === undefined ||
      e.pointerId !== this.#activePointerId ||
      !this.#bounds ||
      !this.#savedStart ||
      !this.#savedEnd
    )
      return;

    // For resize operations, update immediately (old behavior)
    if (this.#operation !== "move") {
      const deltaY = e.clientY - this.#savedY;
      const deltaYFraction = this.#savedHeight === 0 ? 0 : deltaY / this.#savedHeight;

      const clientX = e.clientX - this.#bounds.left;
      const clientY = e.clientY - this.#bounds.top;
      const fractionX = this.#bounds.width === 0 ? 0 : clientX / this.#bounds.width;
      const fractionY = this.#bounds.height === 0 ? 0 : clientY / this.#bounds.height;
      const dayIndex = this.#computeDayIndex(fractionX, fractionY);

      const secondsInDay = 24 * 60 * 60;
      const changedSecondsWithinDay =
        this.#mode === "all-day" ? 0 : Math.round(deltaYFraction * secondsInDay);
      const changedDays = dayIndex - this.#savedDayIndex;
      const changedSeconds = changedSecondsWithinDay + changedDays * secondsInDay;

      const adjustedSeconds = this.#snapSeconds(changedSeconds);

      const changedDuration = Temporal.Duration.from({ seconds: adjustedSeconds });
      let newStart = this.#savedStart.add(changedDuration);
      let newEnd = this.#savedEnd.add(changedDuration);

      const ctor = this.constructor as typeof TimedEventInteractionController;
      const minDurationSeconds = ctor.snapInterval * 60;

      if (this.#operation === "resize-start") {
        const maxStart = this.#savedEnd?.subtract({ seconds: minDurationSeconds });
        if (maxStart && Temporal.PlainDateTime.compare(newStart, maxStart) > 0) {
          newStart = maxStart;
        }
      }

      if (this.#operation === "resize-end") {
        const minEnd = this.#savedStart?.add({ seconds: minDurationSeconds });
        if (minEnd && Temporal.PlainDateTime.compare(newEnd, minEnd) < 0) {
          newEnd = minEnd;
        }
      }

      if (this.#operation !== "resize-end") {
        this.#host.start = newStart.toString();
      }

      if (this.#operation !== "resize-start") {
        this.#host.end = newEnd.toString();
      }
      return;
    }

    // For move operations: event start visual = pointer minus grab offset, so it follows the pointer 1:1
    const sectionElement = this.#host.parentElement;
    if (!sectionElement) return;

    const sectionBounds = sectionElement.getBoundingClientRect();
    const eventStartVisualLeft = e.clientX - this.#grabOffsetX;
    const eventStartVisualTop = e.clientY - this.#grabOffsetY;
    const relativeX = eventStartVisualLeft - sectionBounds.left;
    const relativeY = eventStartVisualTop - sectionBounds.top;
    const fractionX = sectionBounds.width === 0 ? 0 : relativeX / sectionBounds.width;
    const fractionY = sectionBounds.height === 0 ? 0 : relativeY / sectionBounds.height;

    const hoveredDayIndex = this.#computeDayIndex(fractionX, fractionY);

    // For timed mode, calculate which time slot the event start is over (with snapping)
    let hoveredTime: Temporal.PlainTime | null = null;
    if (this.#mode === "timed") {
      const secondsInDay = 24 * 60 * 60;
      const targetTimeFraction = Math.max(0, Math.min(1, fractionY));
      const targetSecondsWithinDay = Math.round(targetTimeFraction * secondsInDay);
      const adjustedSeconds = this.#snapSeconds(targetSecondsWithinDay);
      const hours = Math.floor(adjustedSeconds / 3600);
      const minutes = Math.floor((adjustedSeconds % 3600) / 60);
      hoveredTime = Temporal.PlainTime.from({ hour: hours, minute: minutes, second: 0 });
    }

    // Store highlighted area for use on dragend (cell under event start)
    this.#highlightedDayIndex = hoveredDayIndex;
    this.#highlightedTime = hoveredTime;

    // Dispatch hover event for highlighting (cell under event start)
    this.#dispatchDragHover({
      dayIndex: hoveredDayIndex,
      time: hoveredTime,
      clientX: eventStartVisualLeft,
      clientY: eventStartVisualTop,
    });

    // Do not update position during drag so indentation/stacking only recalculates on drag end

    // Offset = where we want the event start (pointer - grab) minus current event start position
    const { left: currentStartLeft, top: currentStartTop } =
      this.#getEventStartPosition(sectionBounds);
    this.#dragOffsetX = e.clientX - this.#grabOffsetX - currentStartLeft;
    this.#dragOffsetY = e.clientY - this.#grabOffsetY - currentStartTop;

    this.#dispatchDragOffset({
      offsetX: this.#dragOffsetX,
      offsetY: this.#dragOffsetY,
    });
  };

  readonly pointerUpHandler = (e: PointerEvent) => {
    if (this.#activePointerId === undefined || e.pointerId !== this.#activePointerId) return;

    window.removeEventListener("pointermove", this.pointerMoveHandler, true);

    // Calculate final position and update event (only for move operations)
    // Resize operations are already handled in pointerMoveHandler
    if (this.#operation === "move" && this.#bounds && this.#savedStart && this.#savedEnd) {
      // Use the highlighted area (cell under event start) tracked during drag, or calculate from event start position if not set
      let dayIndex = this.#highlightedDayIndex;
      let time = this.#highlightedTime;

      if (dayIndex === null) {
        // Fallback: calculate from event start visual position
        const sectionElement = this.#host.parentElement;
        if (!sectionElement) return;
        const sectionBounds = sectionElement.getBoundingClientRect();
        const { left: eventStartLeft, top: eventStartTop } =
          this.#getEventStartPosition(sectionBounds);
        const eventStartVisualLeft = eventStartLeft + this.#dragOffsetX;
        const eventStartVisualTop = eventStartTop + this.#dragOffsetY;
        const relativeX = eventStartVisualLeft - sectionBounds.left;
        const relativeY = eventStartVisualTop - sectionBounds.top;
        const fractionX = sectionBounds.width === 0 ? 0 : relativeX / sectionBounds.width;
        const fractionY = sectionBounds.height === 0 ? 0 : relativeY / sectionBounds.height;
        dayIndex = this.#computeDayIndex(fractionX, fractionY);

        if (this.#mode === "timed") {
          const secondsInDay = 24 * 60 * 60;
          const targetTimeFraction = Math.max(0, Math.min(1, fractionY));
          const targetSecondsWithinDay = Math.round(targetTimeFraction * secondsInDay);
          const adjustedSeconds = this.#snapSeconds(targetSecondsWithinDay);
          const hours = Math.floor(adjustedSeconds / 3600);
          const minutes = Math.floor((adjustedSeconds % 3600) / 60);
          time = Temporal.PlainTime.from({ hour: hours, minute: minutes, second: 0 });
        }
      }

      if (dayIndex === null) return;

      const renderedDays = (this.#host as { renderedDays?: Temporal.PlainDate[] }).renderedDays;
      if (!renderedDays || dayIndex < 0 || dayIndex >= renderedDays.length) return;

      const targetDay = renderedDays[dayIndex];

      // Set start to highlighted area
      let targetStart: Temporal.PlainDateTime;
      let targetEnd: Temporal.PlainDateTime;

      if (this.#mode === "all-day") {
        // For all-day: start at 00:00 of the highlighted day
        targetStart = targetDay.toPlainDateTime({ hour: 0, minute: 0, second: 0 });

        // Calculate the number of days the event spans (inclusive)
        // Get the inclusive end date (last day the event actually spans)
        const startDate = this.#savedStart.toPlainDate();
        // The end DateTime might have a time component, so get the date and subtract 1 nanosecond
        // to get the actual last day (matching AllDayEvent.endDate logic)
        const inclusiveEndDate = this.#savedEnd.subtract({ nanoseconds: 1 }).toPlainDate();

        // Count days inclusively: from startDate to inclusiveEndDate
        // If event spans Jan 8-9, startDate=Jan8, inclusiveEndDate=Jan9
        // until(Jan8, Jan9) = 1 day difference, but we need 2 days (Jan8 AND Jan9)
        const daysDiff = startDate.until(inclusiveEndDate, { largestUnit: "day" });
        const daysCount = daysDiff.days + 1; // Add 1 for inclusive count

        // End should be at 00:00 of the day after the last day (exclusive end format)
        // If event spans 2 days starting on targetDay, end is targetDay + 2 days
        const targetEndDate = targetDay.add({ days: daysCount });
        targetEnd = targetEndDate.toPlainDateTime({ hour: 0, minute: 0, second: 0 });
      } else {
        // For timed: use the highlighted time (already snapped during dragmove)
        if (!time) return;
        targetStart = targetDay.toPlainDateTime({
          hour: time.hour,
          minute: time.minute,
          second: 0,
        });

        // Calculate the exact duration from saved start/end
        const duration = this.#savedStart.until(this.#savedEnd);
        // Calculate end by adding the exact duration to the new start
        targetEnd = targetStart.add(duration);
      }

      // Update position; the drag transform will be cleared in the next frame
      // after the new position has rendered.
      this.#host.start = targetStart.toString();
      this.#host.end = targetEnd.toString();

      // Dispatch update event
      this.#host.dispatchEvent(new CustomEvent("update"));

      // Clear hover state immediately
      this.#highlightedDayIndex = null;
      this.#highlightedTime = null;
      this.#dispatchDragHover(null);

      // Reset pointerId and most state immediately to prevent interference with other drags,
      // but keep #isDragging true and the current drag offset until the new position has rendered.
      const oldPointerId = this.#activePointerId;
      this.#activePointerId = undefined;
      this.#bounds = null;
      this.#savedStart = null;
      this.#savedEnd = null;

      // Clean up pointer capture and listeners
      this.#pointerCaptureTarget?.releasePointerCapture(oldPointerId ?? 0);
      this.#pointerCaptureTarget = undefined;

      // Wait for the position update to render, then clear the transform and drag state.
      requestAnimationFrame(() => {
        this.#dragOffsetX = 0;
        this.#dragOffsetY = 0;
        this.#dispatchDragOffset({ offsetX: 0, offsetY: 0 });
        this.#isDragging = false;
        this.#dispatchDragStateChange(false);
      });
      return; // Early return to prevent clearing isDragging below
    }

    window.removeEventListener("pointerup", this.pointerUpHandler, true);
    window.removeEventListener("pointermove", this.pointerMoveHandler, true);
    this.#pointerCaptureTarget?.releasePointerCapture(this.#activePointerId);
    this.#pointerCaptureTarget = undefined;
    this.#activePointerId = undefined;
    this.#isDragging = false;
    this.#highlightedDayIndex = null;
    this.#highlightedTime = null;

    // Clear hover state
    this.#dispatchDragHover(null);

    // Only clear transform offset here if we didn't update position (non-move operations)
    if (this.#operation !== "move") {
      this.#dragOffsetX = 0;
      this.#dragOffsetY = 0;
      this.#dispatchDragOffset({ offsetX: 0, offsetY: 0 });
    }

    this.#host.dispatchEvent(new CustomEvent("update"));
    this.#dispatchDragStateChange(false);
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
      const clampedX = Math.max(0, Math.min(0.999999, fractionX));
      const clampedY = Math.max(0, Math.min(0.999999, fractionY));
      const row = Math.floor(clampedY * totalRows);
      const col = Math.floor(clampedX * daysPerRow);
      const index = row * daysPerRow + col;
      return Math.min(index, dayCount - 1);
    }
    const clampedFraction = Math.max(0, Math.min(0.999999, fractionX));
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
    const startDate = this.#savedStart.toPlainDate();
    const startDayIndex = renderedDays.findIndex(
      (d) => (typeof d === "string" ? d : d.toString()) === startDate.toString()
    );
    if (startDayIndex < 0) return { left: sectionBounds.left, top: sectionBounds.top };

    const daysPerRow = this.#getDaysPerRow();
    const dayCount = renderedDays.length;

    if (this.#mode === "all-day") {
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

    // Timed: start day column + start time row
    const left = sectionBounds.left + (startDayIndex / dayCount) * sectionBounds.width;
    const startTime = this.#savedStart.toPlainTime();
    const secondsInDay = 24 * 60 * 60;
    const seconds = startTime.hour * 3600 + startTime.minute * 60 + startTime.second;
    const fractionY = seconds / secondsInDay;
    const top = sectionBounds.top + fractionY * sectionBounds.height;
    return { left, top };
  }

  #snapSeconds(seconds: number): number {
    const ctor = this.constructor as typeof TimedEventInteractionController;
    const increment = ctor.snapInterval * 60;
    return Math.round(seconds / increment) * increment;
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
