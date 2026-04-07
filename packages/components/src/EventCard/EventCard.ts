import { ContextConsumer } from "@lit/context";
import { html, unsafeCSS } from "lit";
import { customElement, property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { BaseElement } from "../BaseElement/BaseElement";
import { type CalendarViewContextValue, calendarViewContext } from "../context/CalendarViewContext";
import { renderRecurringIcon } from "../icons/RecurringIcon";
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

  @property({ type: Boolean, reflect: true })
  recurring = false;

  @property({ type: Boolean, reflect: true })
  exception = false;

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
          <div
            class=${classMap(this.#cardClasses)}
            dir="${this.dir}"
            data-segment-direction=${this.segmentDirection}
            ?data-first-segment=${this.firstSegment}
            ?data-last-segment=${this.lastSegment}
          >
              ${this.past ? html`<span class="sr-only">Past event.</span>` : ""}
              ${this.#recurrenceStatusSrLabel ? html`<span class="sr-only">${this.#recurrenceStatusSrLabel}</span>` : ""}
              <h6 class=${classMap(this.#summaryClasses)}>
                <span class="event-card-content">
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
                </span>
                ${
                  this.recurring && !this.exception
                    ? html`
                        <span class="event-card-recurring-icon-wrap" aria-hidden="true">
                          ${renderRecurringIcon({ className: "event-card-recurring-icon" })}
                        </span>
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
    };
  }

  get #summaryClasses() {
    return {
      "event-card-heading": true,
      "is-past": this.past,
    };
  }

  get #summaryMainClasses() {
    return {
      "event-card-summary-main": true,
    };
  }

  get #summaryTimeClasses() {
    return {
      "event-card-time": true,
    };
  }

  get #summaryTimeMainClasses() {
    return {
      "event-card-time-main": true,
    };
  }

  get #summaryTimeDetailClasses() {
    return {
      "event-card-time-detail": true,
    };
  }

  get #summaryLocationClasses() {
    return {
      "event-card-location": true,
    };
  }

  get #cardClasses() {
    const isOverlapping = this.#isOverlappingIndentedCard;

    return {
      "event-card-overlap": isOverlapping,
      "event-card-shell": true,
    };
  }

  get #recurrenceStatusSrLabel(): string {
    if (this.exception) return "Exception to recurring series.";
    if (this.recurring) return "Recurring event.";
    return "";
  }

  get #isOverlappingIndentedCard(): boolean {
    const indentationRaw = this.style.getPropertyValue("--_lc-indentation").trim();
    if (indentationRaw.length === 0) return false;
    const indentation = Number.parseFloat(indentationRaw);
    return Number.isFinite(indentation) && indentation > 0;
  }
}
