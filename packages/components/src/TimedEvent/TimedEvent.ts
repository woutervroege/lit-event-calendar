import { Temporal } from "@js-temporal/polyfill";
import { html } from "lit";
import { customElement } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";
import { getEventColorStyles } from "../utils/EventColor";
import "../EventCard/EventCard";
import "../ResizeHandle/ResizeHandle";
import { EventBase } from "../EventBase/EventBase.js";

@customElement("timed-event")
export class TimedEvent extends EventBase {
  #previewRange: { start: Temporal.PlainDateTime; end: Temporal.PlainDateTime } | null = null;
  #keyboardHintId = `timed-event-kbd-${Math.random().toString(36).slice(2, 9)}`;

  get siblings(): TimedEvent[] {
    return super.siblings as TimedEvent[];
  }

  #getEffectiveTimesForDay(day: Temporal.PlainDate): {
    start: Temporal.PlainTime;
    end: Temporal.PlainTime;
  } {
    const isStartDay = day.toString() === this.startDate?.toString();
    const isEndDay = day.toString() === this.endDate?.toString();

    const start = isStartDay
      ? (this.startTime as Temporal.PlainTime)
      : Temporal.PlainTime.from("00:00");
    const end = isEndDay
      ? (this.endTime as Temporal.PlainTime)
      : Temporal.PlainTime.from("23:59:59");

    return { start, end };
  }

  #getSiblingsOnSameDay(day: Temporal.PlainDate): TimedEvent[] {
    return this.siblings.filter((sibling) =>
      sibling.renderedDays.some((siblingDay) => siblingDay.toString() === day.toString())
    );
  }

  #doEventsOverlapOnDay(sibling: TimedEvent, day: Temporal.PlainDate): boolean {
    const { start: thisStartEff, end: thisEndEff } = this.#getEffectiveTimesForDay(day);
    const { start: sibStartEff, end: sibEndEff } = sibling.#getEffectiveTimesForDay(day);

    return (
      thisStartEff.toString() < sibEndEff.toString() &&
      sibStartEff.toString() < thisEndEff.toString()
    );
  }

  #getOverlappingSiblings(day: Temporal.PlainDate): TimedEvent[] {
    const siblingsOnSameDay = this.#getSiblingsOnSameDay(day);
    return siblingsOnSameDay.filter((sibling) => this.#doEventsOverlapOnDay(sibling, day));
  }

  #calculatePositioning(
    overlappingSiblings: TimedEvent[],
    day: Temporal.PlainDate
  ): { width: number; marginLeft: number; indentation?: number } {
    const sameStartSiblings = this.#getSameStartSiblings(overlappingSiblings, day);

    if (sameStartSiblings.length > 1) {
      return this.#calculateSharedStartPosition(sameStartSiblings);
    }

    return this.#calculateStaggeredPosition(overlappingSiblings, day);
  }

  #getSameStartSiblings(overlappingSiblings: TimedEvent[], day: Temporal.PlainDate): TimedEvent[] {
    const thisStartEff = this.#getEffectiveTimesForDay(day).start;
    return overlappingSiblings.filter((sibling) => {
      const sibStartEff = sibling.#getEffectiveTimesForDay(day).start;
      return sibStartEff.toString() === thisStartEff.toString();
    });
  }

  #calculateSharedStartPosition(sameStartSiblings: TimedEvent[]): {
    width: number;
    marginLeft: number;
  } {
    const startTimeIndex = sameStartSiblings.indexOf(this);
    const width = 1 / sameStartSiblings.length;
    const marginLeft = startTimeIndex / sameStartSiblings.length;
    return { width, marginLeft };
  }

  #calculateStaggeredPosition(
    overlappingSiblings: TimedEvent[],
    day: Temporal.PlainDate
  ): { width: number; marginLeft: number; indentation: number } {
    const sortedSiblings = [...overlappingSiblings].sort((a, b) =>
      this.#compareSiblingStart(a, b, day)
    );
    const overlappingIndex = sortedSiblings.indexOf(this);
    const indentation = overlappingIndex * 12;
    const width = 1;
    const marginLeft = 0;
    return { width, marginLeft, indentation };
  }

  #compareSiblingStart(a: TimedEvent, b: TimedEvent, day: Temporal.PlainDate): number {
    const aIsStartingToday = a.startDate?.toString() === day.toString();
    const bIsStartingToday = b.startDate?.toString() === day.toString();
    if (!aIsStartingToday && bIsStartingToday) return -1;
    if (aIsStartingToday && !bIsStartingToday) return 1;
    const aStartTime = a.startTime ? a.startTime.toString() : "00:00:00";
    const bStartTime = b.startTime ? b.startTime.toString() : "00:00:00";
    return aStartTime.localeCompare(bStartTime);
  }

  #calculateVerticalPositioning(day: Temporal.PlainDate): { top: number; bottom: number } {
    const dayIsStartDay = day.toString() === this.startDate?.toString();
    const dayIsEndDay = day.toString() === this.endDate?.toString();
    const top =
      dayIsStartDay && this.startTime
        ? ((this.startTime.hour + this.startTime.minute / 60) / 24) * 100
        : 0;
    const bottom =
      dayIsEndDay && this.endTime
        ? 100 - ((this.endTime.hour + this.endTime.minute / 60) / 24) * 100
        : 0;
    return { top, bottom };
  }

  #createDayInset(day: Temporal.PlainDate, viewDayStrings: string[]) {
    const left = (viewDayStrings.indexOf(day.toString()) / viewDayStrings.length) * 100;
    const overlappingSiblings = this.#getOverlappingSiblings(day);
    const { width, marginLeft, indentation } = this.#calculatePositioning(overlappingSiblings, day);
    const { top, bottom } = this.#calculateVerticalPositioning(day);

    return {
      top: `${top}%`,
      bottom: `${bottom}%`,
      "--_lc-left": `${left}%`,
      "--_lc-width": width,
      "--_lc-margin-left": marginLeft,
      "--_lc-indentation": `${indentation || 0}px`,
      "--_lc-inline-inset-start": "1px",
      "--_lc-inline-inset-end": "2px",
      "--_lc-z-index": (indentation || 0) / 12 + 1,
    } as Record<string, string | number>;
  }

  get dayInsets() {
    const insets: Array<Record<string, string | number>> = [];
    const viewDayStrings = this.viewDays?.map((d) => d.toString()) ?? [];

    this.renderedDays.forEach((day) => {
      if (viewDayStrings.includes(day.toString())) {
        insets.push(this.#createDayInset(day, viewDayStrings));
      }
    });

    return insets;
  }

  #formatDisplayTime(start: Temporal.PlainTime | null, end: Temporal.PlainTime | null): string {
    const startLabel = this.#formatTimeLabel(start);
    const endLabel = this.#formatTimeLabel(end);
    return `${startLabel} - ${endLabel}`;
  }

  #formatTimeLabel(time: Temporal.PlainTime | null): string {
    return (
      time?.toLocaleString(this.locale, {
        hour: "2-digit",
        minute: "2-digit",
      }) ?? ""
    );
  }

  get displayTime(): string {
    const rangeStart = this.#previewRange?.start ?? this.start;
    const rangeEnd = this.#previewRange?.end ?? this.end;
    if (!rangeStart || !rangeEnd) return "";
    return this.#formatDisplayRange(rangeStart, rangeEnd);
  }

  get displayTimeDetail(): string {
    const originalStartSource = this.originalStartZonedDateTime;
    const originalEndSource = this.originalEndZonedDateTime;
    if (!originalStartSource || !originalEndSource) return "";

    const originalTimeZone = originalStartSource.timeZoneId;
    const rangeStart = this.#previewRange?.start ?? this.start;
    const rangeEnd = this.#previewRange?.end ?? this.end;
    if (!rangeStart || !rangeEnd) return "";

    const originalStart = rangeStart.toZonedDateTime(this.timezone).withTimeZone(originalTimeZone);
    const originalEnd = rangeEnd.toZonedDateTime(this.timezone).withTimeZone(originalTimeZone);

    if (!originalStart || !originalEnd) return "";
    if (!this.#hasOffsetDifferenceFromCurrentTimezone(originalStart, originalEnd)) return "";

    const originalStartLabel = this.#formatTimeLabel(originalStart.toPlainTime());
    return `${originalStartLabel} ${originalStart.offset}`;
  }

  #hasOffsetDifferenceFromCurrentTimezone(
    originalStart: Temporal.ZonedDateTime,
    originalEnd: Temporal.ZonedDateTime
  ): boolean {
    const currentTimezoneStart = originalStart.withTimeZone(this.timezone);
    const currentTimezoneEnd = originalEnd.withTimeZone(this.timezone);
    return (
      originalStart.offset !== currentTimezoneStart.offset ||
      originalEnd.offset !== currentTimezoneEnd.offset
    );
  }

  #formatDisplayRange(start: Temporal.PlainDateTime, end: Temporal.PlainDateTime): string {
    const startDate = start.toPlainDate();
    const endDate = end.toPlainDate();
    const startTime = start.toPlainTime();
    const endTime = end.toPlainTime();
    const isMultiDay = Temporal.PlainDate.compare(startDate, endDate) !== 0;

    if (!isMultiDay) {
      return this.#formatDisplayTime(startTime, endTime);
    }

    return this.#formatMultiDayDisplayTime(startDate, endDate, startTime, endTime);
  }

  #formatMultiDayDisplayTime(
    startDate: Temporal.PlainDate | null,
    endDate: Temporal.PlainDate | null,
    startTime: Temporal.PlainTime,
    endTime: Temporal.PlainTime
  ): string {
    const startTimeLabel = startTime.toLocaleString(this.locale, {
      hour: "2-digit",
      minute: "2-digit",
    });

    const endTimeLabel = endTime.toLocaleString(this.locale, {
      hour: "2-digit",
      minute: "2-digit",
    });

    const viewStartDate = this.#getViewStartDate();
    const showStartDate =
      startDate && viewStartDate ? Temporal.PlainDate.compare(startDate, viewStartDate) < 0 : false;

    const startDateLabel =
      showStartDate && startDate
        ? startDate.toLocaleString(this.locale, { month: "short", day: "numeric" })
        : "";

    const endDateLabel =
      endDate?.toLocaleString(this.locale, { month: "short", day: "numeric" }) ?? "";

    const startPart = startDateLabel ? `${startDateLabel} ${startTimeLabel}` : startTimeLabel;
    const endPart = `${endDateLabel} ${endTimeLabel}`.trim();

    return `${startPart} - ${endPart}`;
  }

  #getViewStartDate(): Temporal.PlainDate | null {
    const viewDays = this.viewDays;
    if (!viewDays || !viewDays.length) {
      return null;
    }

    return viewDays.reduce<Temporal.PlainDate | null>((earliest, day) => {
      if (!earliest) return day;
      return Temporal.PlainDate.compare(day, earliest) < 0 ? day : earliest;
    }, null);
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

  #handleInteractionDragHover = (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const hover = this.#getHoverDetail(event);

    if (!hover || !hover.time) {
      this.#clearPreviewDisplayTime();
      return;
    }

    const preview = this.#getPreviewTimeRange(hover.dayIndex, hover.time);
    if (!preview) {
      this.#clearPreviewDisplayTime();
      return;
    }

    const { previewStart, previewEnd } = preview;
    this.#previewRange = {
      start: previewStart,
      end: previewEnd,
    };
    this.requestUpdate();
  };

  #getHoverDetail(event: CustomEvent): {
    dayIndex: number;
    time: Temporal.PlainTime | null;
    clientX: number;
    clientY: number;
  } | null {
    return (
      (event.detail as {
        dayIndex: number;
        time: Temporal.PlainTime | null;
        clientX: number;
        clientY: number;
      } | null) ?? null
    );
  }

  #clearPreviewDisplayTime() {
    this.#previewRange = null;
    this.requestUpdate();
  }

  #getPreviewTimeRange(
    hoverDayIndex: number,
    hoverTime: Temporal.PlainTime | null
  ): { previewStart: Temporal.PlainDateTime; previewEnd: Temporal.PlainDateTime } | null {
    const startTime = this.startTime;
    const endTime = this.endTime;
    const startDate = this.startDate;
    const viewDays = this.viewDays;
    if (
      !hoverTime ||
      !startTime ||
      !endTime ||
      !startDate ||
      !viewDays?.length ||
      hoverDayIndex < 0 ||
      hoverDayIndex >= viewDays.length
    ) {
      return null;
    }

    const targetDay = viewDays[hoverDayIndex];
    const previewStart = targetDay.toPlainDateTime({
      hour: hoverTime.hour,
      minute: hoverTime.minute,
      second: 0,
    });
    const startDateTime = startDate.toPlainDateTime({
      hour: startTime.hour,
      minute: startTime.minute,
      second: startTime.second,
    });
    const endDate = this.endDate;
    if (!endDate) return null;
    const endDateTime = endDate.toPlainDateTime({
      hour: endTime.hour,
      minute: endTime.minute,
      second: endTime.second,
    });
    const duration = startDateTime.until(endDateTime);
    const previewEnd = previewStart.add(duration);
    return { previewStart, previewEnd };
  }

  render() {
    const colorStyles = getEventColorStyles(this.color);
    const dragTransform =
      this.interactionController.isDragging || this.dragOffsetX !== 0 || this.dragOffsetY !== 0
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
          // Disable transform animation entirely to avoid any snap/flash at drag end.
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
          arrow keys to resize the end time.
        </span>
        ${this.#renderEventCards()}
      </div>
    `;
  }

  get #interactionLabel(): string {
    const title = this.summary?.trim() || "Untitled event";
    const time = this.displayTime?.trim();
    const baseLabel = time ? `${title}. ${time}` : title;
    return this.isPast ? `Past event. ${baseLabel}` : baseLabel;
  }

  #renderEventCards() {
    const dayInsets = this.dayInsets;
    const startsBeforeVisibleRange = this.#startsBeforeVisibleRange();
    const endsAfterVisibleRange = this.#endsAfterVisibleRange();

    return dayInsets.map((inset, index) =>
      this.#renderEventCard(
        inset as Record<string, string | number>,
        index,
        dayInsets.length,
        startsBeforeVisibleRange,
        endsAfterVisibleRange
      )
    );
  }

  #renderEventCard(
    inset: Record<string, string | number>,
    index: number,
    total: number,
    startsBeforeVisibleRange: boolean,
    endsAfterVisibleRange: boolean
  ) {
    const isFirst = index === 0;
    const isLast = index === total - 1;
    const hasRoundedStart = isFirst && !startsBeforeVisibleRange;
    const hasRoundedEnd = isLast && !endsAfterVisibleRange;

    return html`
      <event-card
        summary=${this.summary}
        time=${isFirst ? this.displayTime : ""}
        time-detail=${isFirst ? this.displayTimeDetail : ""}
        segment-direction="vertical"
        ?past=${this.isPast}
        style=${styleMap(inset)}
        ?first-segment=${hasRoundedStart}
        ?last-segment=${hasRoundedEnd}
      >
        ${
          isFirst
            ? html`
              <resize-handle
                position="start"
                title="Resize start time"
              ></resize-handle>
            `
            : ""
        }
        ${
          isLast
            ? html`
              <resize-handle
                position="end"
                title="Resize end time"
              ></resize-handle>
            `
            : ""
        }
      </event-card>
    `;
  }

  #startsBeforeVisibleRange(): boolean {
    const eventStart = this.start;
    const dayBounds = this.renderedDayBounds;
    if (!eventStart || !dayBounds) return false;

    const visibleRangeStart = dayBounds.firstDay.toPlainDateTime({
      hour: 0,
      minute: 0,
      second: 0,
      millisecond: 0,
      microsecond: 0,
      nanosecond: 0,
    });

    return Temporal.PlainDateTime.compare(eventStart, visibleRangeStart) < 0;
  }

  #endsAfterVisibleRange(): boolean {
    const eventEnd = this.end;
    const dayBounds = this.renderedDayBounds;
    if (!eventEnd || !dayBounds) return false;

    const visibleRangeEndExclusive = dayBounds.lastDay.add({ days: 1 }).toPlainDateTime({
      hour: 0,
      minute: 0,
      second: 0,
      millisecond: 0,
      microsecond: 0,
      nanosecond: 0,
    });

    return Temporal.PlainDateTime.compare(eventEnd, visibleRangeEndExclusive) > 0;
  }
}
