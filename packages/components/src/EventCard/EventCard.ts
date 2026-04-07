import { ContextConsumer } from "@lit/context";
import { html, unsafeCSS } from "lit";
import { customElement, property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { BaseElement } from "../BaseElement/BaseElement";
import { type CalendarViewContextValue, calendarViewContext } from "../context/CalendarViewContext";
import { getLocaleDirection } from "../utils/Locale";
import componentStyle from "./EventCard.css?inline";

@customElement("event-card")
export class EventCard extends BaseElement {
  @property({ type: String })
  lang = "";

  #calendarView?: CalendarViewContextValue;
  #calendarViewConsumer = new ContextConsumer(this, {
    context: calendarViewContext,
    subscribe: true,
    callback: (value: CalendarViewContextValue | undefined) => {
      this.#calendarView = value;
      this.requestUpdate();
    },
  });

  @property({ type: String })
  summary = "";

  @property({ type: String })
  time = "";

  @property({ type: String, attribute: "time-detail" })
  timeDetail = "";

  @property({ type: String })
  location = "";

  @property({ type: Boolean, attribute: "first-segment" })
  firstSegment = false;

  @property({ type: Boolean, attribute: "last-segment" })
  lastSegment = false;

  @property({ type: String, attribute: "segment-direction" })
  segmentDirection: "horizontal" | "vertical" = "horizontal";

  @property({ type: String, reflect: true })
  layout: "absolute" | "flow" = "absolute";

  @property({ type: Boolean, reflect: true })
  past = false;

  static get styles() {
    return [...BaseElement.styles, unsafeCSS(componentStyle)];
  }

  connectedCallback() {
    super.connectedCallback();
    void this.#calendarViewConsumer;
  }

  get dir() {
    return getLocaleDirection(this.lang || this.#calendarView?.lang);
  }

  render() {
    const hasTimeLabel = Boolean(this.time?.trim() || this.timeDetail?.trim());
    const time = this.time?.trim();
    const timeDetail = this.timeDetail?.trim();
    const location = this.location?.trim();
    const hasLocation = Boolean(location);
    const hasMetaLabel = hasTimeLabel || hasLocation;
    const compactTime = time?.split(" - ")[0]?.trim() ?? "";
    const compactTimeLabel = [compactTime, timeDetail ? `(${timeDetail})` : ""]
      .filter(Boolean)
      .join(" ");
    return html`
          <div class=${classMap(this.#cardClasses)} dir="${this.dir}">
              ${this.past ? html`<span class="sr-only">Past event.</span>` : ""}
              <h6 class=${classMap(this.#summaryClasses)}>
                <span class=${classMap(this.#compactLabelClasses)}>
                  ${
                    hasTimeLabel
                      ? html`
                          <span class="event-card-compact-time">${compactTimeLabel}</span>
                          <span aria-hidden="true"> </span>
                        `
                      : ""
                  }
                  <span>${this.summary}</span>
                </span>
                <span class=${classMap(this.#summaryMainClasses)}>${this.summary}</span>
                ${
                  hasMetaLabel
                    ? html`
                      <time class=${classMap(this.#summaryTimeClasses)}>
                        ${
                          hasTimeLabel
                            ? html`
                              <span class=${classMap(this.#summaryTimeMainClasses)}>${this.time}</span>
                              ${
                                this.timeDetail
                                  ? html`<span class=${classMap(this.#summaryTimeDetailClasses)}
                                    >(${this.timeDetail})</span
                                  >`
                                  : ""
                              }
                        `
                            : ""
                        }
                      </time>
                      ${
                        hasLocation
                          ? html`<span class=${classMap(this.#summaryLocationClasses)}>${location}</span>`
                          : ""
                      }
                    `
                    : ""
                }
              </h6>
              <slot></slot>
          </div>
        `;
  }

  get #compactLabelClasses() {
    return {
      "event-card-compact-label": true,
      "min-w-0": true,
      "max-w-full": true,
      hidden: true,
      truncate: true,
    };
  }

  get #summaryClasses() {
    return {
      "event-card-heading": true,
      "m-0": true,
      "text-xs": true,
      "text-start": true,
      "font-bold": true,
      "px-2": true,
      "pt-2": true,
      "pb-2": true,
      "leading-tight": true,
      "max-w-full": true,
      "overflow-hidden": true,
      "line-through": this.past,
      "decoration-[1.5px]": this.past,
      "opacity-80": this.past,
      sticky: true,
    };
  }

  get #summaryMainClasses() {
    return {
      "event-card-summary-main": true,
      "min-w-0": true,
      "max-w-full": true,
      block: true,
      truncate: true,
    };
  }

  get #summaryTimeClasses() {
    return {
      "event-card-time": true,
      "text-xs": true,
      "text-start": true,
      "font-light": true,
      "tabular-nums": true,
      block: true,
      "min-w-0": true,
      "max-w-full": true,
      "overflow-hidden": true,
      "leading-tight": true,
    };
  }

  get #summaryTimeMainClasses() {
    return {
      "event-card-time-main": true,
      "min-w-0": true,
      "max-w-full": true,
      "inline-block": true,
      truncate: true,
    };
  }

  get #summaryTimeDetailClasses() {
    return {
      "event-card-time-detail": true,
      "min-w-0": true,
      "max-w-full": true,
      "inline-block": true,
      truncate: true,
    };
  }

  get #summaryLocationClasses() {
    return {
      "event-card-location": true,
      "text-xs": true,
      "font-light": true,
      "min-w-0": true,
      "max-w-full": true,
      block: true,
      "overflow-hidden": true,
      "leading-tight": true,
      truncate: true,
    };
  }

  get #cardClasses() {
    const isVertical = this.segmentDirection === "vertical";
    const isRtl = this.dir === "rtl";
    const isOverlapping = this.#isOverlappingIndentedCard;
    const horizontalStartEdge = this.firstSegment;
    const horizontalEndEdge = this.lastSegment;
    const horizontalLeftEdge = isRtl ? horizontalEndEdge : horizontalStartEdge;
    const horizontalRightEdge = isRtl ? horizontalStartEdge : horizontalEndEdge;

    return {
      "[@container(max-height:47px)]:flex": true,
      "[@container(max-height:47px)]:gap-1": true,
      "before:content-['']": true,
      "before:absolute": true,
      "before:bg-[var(--_lc-event-card-bg)]": true,
      "before:border-l-2": true,
      "before:border-l-[var(--_lc-event-card-accent-color)]": true,
      "before:text-[var(--_lc-event-card-accent-color)]": true,
      "before:transition-colors": true,
      "before:duration-100": true,
      "before:top-[1px]": isVertical ? this.firstSegment : true,
      "before:top-0": isVertical ? !this.firstSegment : false,
      "before:bottom-[1px]": isVertical ? this.lastSegment : true,
      "before:bottom-0": isVertical ? !this.lastSegment : false,
      "before:left-[1px]": true,
      "before:left-0": false,
      "before:right-[1px]": true,
      "before:right-0": false,
      "before:rounded-t-sm": isVertical ? this.firstSegment : false,
      "before:rounded-b-sm": isVertical ? this.lastSegment : false,
      "before:rounded-l-sm": isVertical ? false : horizontalLeftEdge,
      "before:rounded-r-sm": isVertical ? false : horizontalRightEdge,
      "before:-z-1": true,
      "transition-transform duration-100": true,
      "event-card-overlap": isOverlapping,
      relative: true,
      "h-full": true,
      "[@container(max-height:47px)]:whitespace-nowrap": true,
      "pointer-events-auto": true,
    };
  }

  get #isOverlappingIndentedCard(): boolean {
    const indentationRaw = this.style.getPropertyValue("--_lc-indentation").trim();
    if (indentationRaw.length === 0) return false;
    const indentation = Number.parseFloat(indentationRaw);
    return Number.isFinite(indentation) && indentation > 0;
  }
}
