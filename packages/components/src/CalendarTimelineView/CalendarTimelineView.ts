import { Temporal } from "@js-temporal/polyfill";
import { html, type TemplateResult, unsafeCSS } from "lit";
import { customElement } from "lit/decorators.js";
import { CalendarViewBase } from "../CalendarViewBase/CalendarViewBase.js";
import { resolvedDataEnd } from "../domain/events-api/eventMapBridge.js";
import "../EventCard/EventCard.js";
import type { TimelineEvent } from "../types/TimeLine.js";
import "../TimeLine/TimeLine.js";
import { formatShortTimeRange } from "../utils/TimeFormatting.js";
import { toTimelineAllDayRange, toTimelineRange } from "./CalendarTimelineScale.js";
import componentStyle from "./CalendarTimelineView.css?inline";

type CalendarTimelineEvent = TimelineEvent & {
  key: string;
  summary: string;
  color: string;
  location: string;
  originalStart: Temporal.PlainDateTime;
  originalEnd: Temporal.PlainDateTime;
};

@customElement("calendar-timeline-view")
export class CalendarTimelineView extends CalendarViewBase {
  variant: "timed" | "all-day" = "timed";
  startDate = Temporal.Now.plainDateISO().toString();
  numDays = 7;
  daysPerWeek?: number;
  columns?: number;
  timelineMax = 24 * 60;
  timelineStep = 5;
  timelineFlow: "vertical" | "horizontal" = "vertical";
  timelineLayout: "default" | "timeline" | "masonry" = "masonry";
  timelineHeight: "auto" | "" = "";

  static get properties() {
    return {
      ...CalendarViewBase.properties,
      variant: { type: String, reflect: true },
      startDate: { type: String, attribute: "start-date" },
      numDays: { type: Number, attribute: "num-days" },
      daysPerWeek: { type: Number, attribute: "days-per-week" },
      columns: { type: Number, attribute: "columns" },
      timelineMax: { type: Number, attribute: "timeline-max" },
      timelineStep: { type: Number, attribute: "timeline-step" },
      timelineFlow: { type: String, attribute: "timeline-flow" },
      timelineLayout: { type: String, attribute: "timeline-layout" },
      timelineHeight: { type: String, attribute: "timeline-height" },
    } as const;
  }

  static get styles() {
    return [...CalendarViewBase.styles, unsafeCSS(componentStyle)];
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

  get #scale() {
    return {
      startDate: this.#parsedStartDate,
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

  get #resolvedNumDays(): number {
    const fromNumDays = Number(this.numDays);
    if (Number.isFinite(fromNumDays) && fromNumDays > 0) return Math.floor(fromNumDays);
    const fromDaysPerWeek = Number(this.daysPerWeek);
    if (Number.isFinite(fromDaysPerWeek) && fromDaysPerWeek > 0) return Math.floor(fromDaysPerWeek);
    return 7;
  }

  get #resolvedColumns(): number {
    const value = Number(this.columns);
    if (Number.isFinite(value) && value > 0) return Math.floor(value);
    return this.#resolvedNumDays <= 7 ? this.#resolvedNumDays : 7;
  }

  get #resolvedTimelineMax(): number {
    const value = Number(this.timelineMax);
    if (!Number.isFinite(value) || value <= 0) return 24 * 60;
    return Math.floor(value);
  }

  get #resolvedTimelineStep(): number {
    const value = Number(this.timelineStep);
    if (!Number.isFinite(value) || value <= 0) return 5;
    return Math.floor(value);
  }

  get #resolvedVariant(): "timed" | "all-day" {
    return this.variant === "all-day" ? "all-day" : "timed";
  }

  get #timelineEvents(): CalendarTimelineEvent[] {
    const rangeStart = this.#parsedStartDate.toPlainDateTime(Temporal.PlainTime.from("00:00"));
    const rangeEnd = rangeStart.add({ days: this.#resolvedNumDays });
    const renderedEvents = this.getRenderedEvents({ start: rangeStart, end: rangeEnd });
    return Array.from(renderedEvents.entries()).map(([key, event]) => {
      const originalStart = event.data.start;
      const originalEnd = resolvedDataEnd(event.data);
      const range =
        this.#resolvedVariant === "all-day"
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
      };
    });
  }

  #renderTimelineEvent = (event: TimelineEvent): TemplateResult => {
    const timelineEvent = event as CalendarTimelineEvent;
    const originalRange = formatShortTimeRange(
      this.lang,
      timelineEvent.originalStart,
      timelineEvent.originalEnd
    );
    return html`
      <event-card
        layout="flow"
        .summary=${timelineEvent.summary}
        .location=${timelineEvent.location}
        .time=${originalRange}
        .color=${timelineEvent.color}
      ></event-card>
    `;
  };

  render() {
    const events = this.#timelineEvents;
    return html`
      <time-line
        .events=${events}
        .cells=${this.#resolvedNumDays}
        .columns=${this.#resolvedColumns}
        .max=${this.#resolvedTimelineMax}
        .step=${this.#resolvedTimelineStep}
        .flow=${this.timelineFlow}
        .layout=${this.timelineLayout}
        .height=${this.timelineHeight === "auto" ? "auto" : undefined}
        .eventTemplate=${this.#renderTimelineEvent}
      ></time-line>
    `;
  }
}
