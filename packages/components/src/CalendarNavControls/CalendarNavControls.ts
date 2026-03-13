import { html, unsafeCSS } from "lit";
import { customElement } from "lit/decorators.js";
import { BaseElement } from "../BaseElement/BaseElement.js";
import componentStyle from "./CalendarNavControls.css?inline";

type CalendarNavigationDirection = "previous" | "today" | "next";

@customElement("calendar-nav-controls")
export class CalendarNavControls extends BaseElement {
  static get styles() {
    return [...BaseElement.styles, unsafeCSS(componentStyle)];
  }

  render() {
    return html`
      <div class="nav-controls">
        <button
          type="button"
          class="btn nav-btn nav-icon-btn"
          aria-label="Previous range"
          @click=${() => this.#navigate("previous")}
        >
          <svg
            class="nav-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            aria-hidden="true"
          >
            <path d="M15 6l-6 6 6 6" stroke-linecap="round" stroke-linejoin="round"></path>
          </svg>
        </button>
        <button type="button" class="btn nav-btn" @click=${() => this.#navigate("today")}>
          Today
        </button>
        <button
          type="button"
          class="btn nav-btn nav-icon-btn"
          aria-label="Next range"
          @click=${() => this.#navigate("next")}
        >
          <svg
            class="nav-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            aria-hidden="true"
          >
            <path d="M9 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"></path>
          </svg>
        </button>
      </div>
    `;
  }

  #navigate(direction: CalendarNavigationDirection) {
    this.dispatchEvent(
      new CustomEvent("navigate", {
        detail: { direction },
        bubbles: true,
        composed: true,
      })
    );
  }
}
