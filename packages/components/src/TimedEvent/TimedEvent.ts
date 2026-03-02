import { Temporal } from "@js-temporal/polyfill";
import { html } from "lit";
import { customElement } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";
import { getEventColorStyles } from "../utils/EventColor";
import "../EventCard/EventCard";
import "../ResizeHandle/ResizeHandle";
import { BaseEvent } from "./BaseEvent";

@customElement("timed-event")
export class TimedEvent extends BaseEvent {
  #previewDisplayTime: string | null = null;

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
      sibling.days.some((siblingDay) => siblingDay.toString() === day.toString())
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
    const thisStartEff = this.#getEffectiveTimesForDay(day).start;
    const sameStartSiblings = overlappingSiblings.filter((sibling) => {
      const sibStartEff = sibling.#getEffectiveTimesForDay(day).start;
      return sibStartEff.toString() === thisStartEff.toString();
    });

    if (sameStartSiblings.length > 1) {
      const startTimeIndex = sameStartSiblings.indexOf(this);
      const width = 1 / sameStartSiblings.length;
      const marginLeft = startTimeIndex / sameStartSiblings.length;
      return { width, marginLeft };
    } else {
      const sortedSiblings = overlappingSiblings.sort((a, b) => {
        const aIsStartingToday = a.startDate?.toString() === day.toString();
        const bIsStartingToday = b.startDate?.toString() === day.toString();
        if (!aIsStartingToday && bIsStartingToday) return -1;
        if (aIsStartingToday && !bIsStartingToday) return 1;
        const aStartTime = a.startTime ? a.startTime.toString() : "00:00:00";
        const bStartTime = b.startTime ? b.startTime.toString() : "00:00:00";
        return aStartTime.localeCompare(bStartTime);
      });
      const overlappingIndex = sortedSiblings.indexOf(this);
      const indentation = overlappingIndex * 12;
      const width = 1 - indentation / 200;
      const marginLeft = 0;
      return { width, marginLeft, indentation };
    }
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

  #createDayInset(day: Temporal.PlainDate, renderedDays: string[]) {
    const left = (renderedDays.indexOf(day.toString()) / renderedDays.length) * 100;
    const overlappingSiblings = this.#getOverlappingSiblings(day);
    const { width, marginLeft, indentation } = this.#calculatePositioning(overlappingSiblings, day);
    const { top, bottom } = this.#calculateVerticalPositioning(day);

    return {
      top: `${top}%`,
      bottom: `${bottom}%`,
      "--left": `${left}%`,
      "--width": width,
      "--margin-left": marginLeft,
      "--indentation": `${indentation || 0}px`,
      "--z-index": (indentation || 0) / 12 + 1,
    } as Record<string, string | number>;
  }

  get dayInsets() {
    const insets: Array<Record<string, string | number>> = [];
    const renderedDays = this.renderedDays?.map((d) => d.toString()) ?? [];

    this.days.forEach((day) => {
      if (renderedDays.includes(day.toString())) {
        insets.push(this.#createDayInset(day, renderedDays));
      }
    });

    return insets;
  }

  #formatDisplayTime(start: Temporal.PlainTime | null, end: Temporal.PlainTime | null): string {
    const startLabel =
      start?.toLocaleString(this.locale, {
        hour: "2-digit",
        minute: "2-digit",
      }) ?? "";
    const endLabel =
      end?.toLocaleString(this.locale, {
        hour: "2-digit",
        minute: "2-digit",
      }) ?? "";
    return `${startLabel} - ${endLabel}`;
  }

  get displayTime(): string {
    if (this.#previewDisplayTime != null) {
      return this.#previewDisplayTime;
    }

    const startTime = this.startTime;
    const endTime = this.endTime;
    if (!startTime || !endTime) return "";

    const startDate = this.startDate;
    const endDate = this.endDate;
    const isMultiDay =
      startDate && endDate ? startDate.toString() !== endDate.toString() : false;

    if (!isMultiDay) {
      return this.#formatDisplayTime(startTime, endTime);
    }

    const startTimeLabel = startTime.toLocaleString(this.locale, {
      hour: "2-digit",
      minute: "2-digit",
    });

    const endTimeLabel = endTime.toLocaleString(this.locale, {
      hour: "2-digit",
      minute: "2-digit",
    });

    // Determine the first rendered (visible) day from the calendar.
    const renderedDays = this.renderedDays;
    const viewStartDate =
      renderedDays && renderedDays.length
        ? renderedDays.reduce<Temporal.PlainDate | null>((earliest, day) => {
            if (!earliest) return day;
            return Temporal.PlainDate.compare(day, earliest) < 0 ? day : earliest;
          }, null)
        : null;

    const showStartDate =
      startDate && viewStartDate
        ? Temporal.PlainDate.compare(startDate, viewStartDate) < 0
        : false;

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
    const hover = event.detail as
      | {
          dayIndex: number;
          time: Temporal.PlainTime | null;
          clientX: number;
          clientY: number;
        }
      | null;

    if (!hover || !hover.time) {
      this.#previewDisplayTime = null;
      this.requestUpdate();
      return;
    }

    const startTime = this.startTime;
    const endTime = this.endTime;

    if (!startTime || !endTime) {
      this.#previewDisplayTime = null;
      this.requestUpdate();
      return;
    }

    const duration = startTime.until(endTime);
    const previewStart = hover.time;
    const previewEnd = previewStart.add(duration);
    this.#previewDisplayTime = this.#formatDisplayTime(previewStart, previewEnd);
    this.requestUpdate();
  };

  render() {
    const colorStyles = getEventColorStyles(this.color);
    const dragTransform =
      this.interactionController.isDragging || this.dragOffsetX !== 0 || this.dragOffsetY !== 0
        ? `translate(${this.dragOffsetX}px, ${this.dragOffsetY}px)`
        : "none";
    return html`
            <button
                class="m-0 text-0 relative w-full h-full border-none bg-none outline-none p-0"
                style=${styleMap({
                  ...colorStyles,
                  transform: dragTransform,
                  // Disable transform animation entirely to avoid any snap/flash at drag end.
                  transition: "none",
                })}
                @pointerdown=${this.interactionController.pointerDownHandler}
                @pointermove=${this.interactionController.pointerMoveHandler}
                @pointerup=${this.interactionController.pointerUpHandler}
            >

                ${this.dayInsets.map(
                  (inset, i) => html`
                    <event-card
                        summary=${this.summary}
                        time=${i === 0 ? this.displayTime : ""}
                        style=${styleMap(inset as Record<string, string | number>)}
                        ?first-segment=${true}
                        ?last-segment=${true}
                    >
                        ${
                          i === 0
                            ? html`
                            <resize-handle 
                                position="start"
                                title="Resize start time"
                            ></resize-handle>
                        `
                            : ""
                        }
                        ${
                          i === this.dayInsets.length - 1
                            ? html`
                            <resize-handle 
                                position="end"
                                title="Resize end time"
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
}
