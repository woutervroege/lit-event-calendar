import { Temporal } from "@js-temporal/polyfill";
import { html, type TemplateResult, unsafeCSS } from "lit";
import { customElement } from "lit/decorators.js";
import { keyed } from "lit/directives/keyed.js";
import { styleMap } from "lit/directives/style-map.js";
import { BaseElement } from "../BaseElement/BaseElement.js";
import "../TimedEvent/AllDayEvent.js";
import componentStyle from "./DayOverflowPopover.css?inline";

export type DayOverflowPopoverEvent = {
  id: string;
  start: string;
  end: string;
  summary: string;
  color: string;
  hidden: boolean;
};

@customElement("day-overflow-popover")
export class DayOverflowPopover extends BaseElement {
  dayIso = "";
  dayLabel = "";
  isCurrentDay = false;
  outsideVisibleMonth = false;
  isWeekend = false;
  events: DayOverflowPopoverEvent[] = [];

  static get properties() {
    return {
      dayIso: { type: String, attribute: "day-iso" },
      dayLabel: { type: String, attribute: "day-label" },
      isCurrentDay: { type: Boolean, attribute: "is-current-day" },
      outsideVisibleMonth: { type: Boolean, attribute: "outside-visible-month" },
      isWeekend: { type: Boolean, attribute: "is-weekend" },
      events: { type: Array },
    } as const;
  }

  static get styles() {
    return [...BaseElement.styles, unsafeCSS(componentStyle)];
  }

  togglePopover() {
    if (this.matches(":popover-open")) {
      this.hidePopover();
      return;
    }
    this.showPopover();
  }

  render() {
    return html`
      <div
        class="day-overflow-popover-cell ${this.isWeekend ? "day-overflow-popover-cell-weekend" : ""}"
        style=${styleMap({
          "--_lc-days": "1",
          "--_lc-grid-rows": "1",
          "--_lc-row-height": "100%",
          "--_lc-popover-event-count": Math.max(1, this.events.length).toString(),
        })}
      >
        ${this.#renderDayNumber()}
        ${
          this.events.length
            ? html`
                <div class="day-overflow-popover-events">
                  ${this.events.map((event) => this.#renderEvent(event))}
                </div>
              `
            : ""
        }
      </div>
    `;
  }

  #renderDayNumber(): TemplateResult {
    return html`
      <span
        class="day-label day-overflow-popover-day-number absolute p-1 text-sm z-0 font-medium rounded-full flex justify-center items-center border-0 bg-transparent text-inherit leading-none min-w-6 px-2 h-6 ${
          this.isCurrentDay ? "current-day" : ""
        } ${this.outsideVisibleMonth ? "outside-month-day-label" : ""}"
        aria-hidden="true"
      >
        <time datetime=${this.dayIso}>${this.dayLabel}</time>
      </span>
    `;
  }

  #renderEvent(event: DayOverflowPopoverEvent): TemplateResult {
    const renderedDay = this.dayIso ? [Temporal.PlainDate.from(this.dayIso)] : [];
    return html`
      <div class="day-overflow-popover-event">
        ${keyed(
          `popover-${event.id}-${this.dayIso}`,
          html`
            <all-day-event
              event-id=${event.id}
              start=${event.start}
              end=${event.end}
              summary=${event.summary}
              color=${event.color}
              style=${styleMap({
                "--_lc-all-day-day-number-space": "0px",
              })}
              ?hidden=${event.hidden}
              .interactionDisabled=${true}
              .renderedDays=${renderedDay}
              .daysPerRow=${1}
              .gridRows=${1}
              .maxVisibleRows=${Number.POSITIVE_INFINITY}
              @update=${this.#reemit}
              @delete=${this.#reemit}
            ></all-day-event>
          `
        )}
      </div>
    `;
  }

  #reemit = (event: Event) => {
    event.stopPropagation();
    const forwardedEvent = new CustomEvent(event.type, {
      detail: (event.target as EventTarget | null) ?? null,
      cancelable: event.cancelable,
    });
    const notCancelled = this.dispatchEvent(forwardedEvent);
    if (!notCancelled && event.cancelable) {
      event.preventDefault();
    }
  };
}
