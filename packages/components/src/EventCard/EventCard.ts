import { html, unsafeCSS } from "lit";
import { customElement, property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { BaseElement } from "../BaseElement/BaseElement";
import componentStyle from "./EventCard.css?inline";

@customElement("event-card")
export class EventCard extends BaseElement {
  @property({ type: String })
  summary = "";

  @property({ type: String })
  time = "";

  @property({ type: String, attribute: "time-detail" })
  timeDetail = "";

  @property({ type: Boolean, attribute: "first-segment" })
  firstSegment = false;

  @property({ type: Boolean, attribute: "last-segment" })
  lastSegment = false;

  @property({ type: String, attribute: "segment-direction" })
  segmentDirection: "horizontal" | "vertical" = "horizontal";

  @property({ type: Boolean, reflect: true })
  past = false;

  static get styles() {
    return [...BaseElement.styles, unsafeCSS(componentStyle)];
  }

  render() {
    return html`
          <div class=${classMap(this.#cardClasses)}>
              ${this.past ? html`<span class="sr-only">Past event.</span>` : ""}
              <h6 class=${classMap(this.#summaryClasses)}>${this.summary}</h6>
              <time class=${classMap(this.#timeClasses)}>
                <span class=${classMap(this.#timeMainClasses)}>${this.time}</span>
                ${this.timeDetail
                  ? html`<span class=${classMap(this.#timeDetailClasses)}>(${this.timeDetail})</span>`
                  : ""}
              </time>
              <slot></slot>
          </div>
        `;
  }

  get #summaryClasses() {
    return {
      "m-0": true,
      "text-xs": true,
      "text-start": true,
      "font-bold": true,
      "p-0": true,
      "truncate": true,
      "line-through": this.past,
      "decoration-[1.5px]": this.past,
      "opacity-80": this.past,
    };
  }

  get #timeClasses() {
    return {
      "m-0": true,
      "text-xs": true,
      "text-start": true,
      "font-light": true,
      "tabular-nums": true,
      "p-0": true,
      "block": true,
      "max-w-full": true,
      "overflow-hidden": true,
      flex: true,
      "flex-wrap": true,
      "gap-x-1": true,
      "leading-tight": true,
      "line-through": this.past,
      "decoration-[1.5px]": this.past,
      "opacity-80": this.past,
    };
  }

  get #timeMainClasses() {
    return {
      "min-w-0": true,
      "max-w-full": true,
      "truncate": true,
    };
  }

  get #timeDetailClasses() {
    return {
      "min-w-0": true,
      "max-w-full": true,
      "truncate": true,
      "line-through": this.past,
      "decoration-[1.5px]": this.past,
      "opacity-80": this.past,
    };
  }

  get #cardClasses() {
    const isVertical = this.segmentDirection === "vertical";

    return {
      "[@container(max-height:47px)]:flex": true,
      "[@container(max-height:47px)]:gap-1": true,
      "p-2": true,
      "before:content-['']": true,
      "before:absolute": true,
      "before:bg-[var(--background-color)]": true,
      "before:border-l-2": true,
      "before:border-l-[var(--color)]": true,
      "before:text-[var(--color)]": true,
      "before:transition-colors": true,
      "before:duration-100": true,
      "before:top-[1px]": isVertical ? this.firstSegment : true,
      "before:top-0": isVertical ? !this.firstSegment : false,
      "before:bottom-[1px]": isVertical ? this.lastSegment : true,
      "before:bottom-0": isVertical ? !this.lastSegment : false,
      "before:left-[1px]": isVertical ? true : this.firstSegment,
      "before:left-0": isVertical ? false : !this.firstSegment,
      "before:right-[1px]": isVertical ? true : this.lastSegment,
      "before:right-0": isVertical ? false : !this.lastSegment,
      "before:rounded-t-sm": isVertical ? this.firstSegment : false,
      "before:rounded-b-sm": isVertical ? this.lastSegment : false,
      "before:rounded-l-sm": isVertical ? false : this.firstSegment,
      "before:rounded-r-sm": isVertical ? false : this.lastSegment,
      "before:-z-1": true,
      "transition-transform duration-100": true,
      relative: true,
      "h-full": true,
      "min-h-[32px]": true,
      "[@container(max-height:47px)]:whitespace-nowrap": true,
      "pointer-events-auto": true,
    };
  }
}
