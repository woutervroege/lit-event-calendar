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

  @property({ type: Boolean, attribute: "first-segment" })
  firstSegment = false;

  @property({ type: Boolean, attribute: "last-segment" })
  lastSegment = false;

  static get styles() {
    return [...BaseElement.styles, unsafeCSS(componentStyle)];
  }

  render() {
    return html`
          <div class=${classMap(this.#cardClasses)}>
              <h6 class="${this.#itemClasses}">${this.summary}</h6>
              <time class="${this.#itemClasses} font-light block text-start">${this.time}</time>
              <slot></slot>
          </div>
        `;
  }

  get #itemClasses() {
    return "m-0 text-xs text-start font-bold p-0 truncate";
  }

  get #cardClasses() {
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
      "before:top-[1px]": true,
      "before:bottom-[1px]": true,
      "before:left-[1px]": this.firstSegment,
      "before:left-0": !this.firstSegment,
      "before:right-[1px]": this.lastSegment,
      "before:right-0": !this.lastSegment,
      "before:rounded-l-sm": this.firstSegment,
      "before:rounded-r-sm": this.lastSegment,
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
