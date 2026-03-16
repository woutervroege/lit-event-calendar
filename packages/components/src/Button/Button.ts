import { html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ifDefined } from "lit/directives/if-defined.js";
import { BaseElement } from "../BaseElement/BaseElement.js";
import {
  sharedButtonActiveBackgroundClasses,
  sharedButtonActiveTextClasses,
  sharedButtonFocusRingClasses,
  sharedButtonHoverTintClasses,
  sharedButtonVisualClasses,
} from "../shared/buttonStyles.js";

type ButtonType = "button" | "submit" | "reset";

@customElement("lc-button")
export class Button extends BaseElement {
  @property({ type: Boolean, reflect: true })
  disabled = false;

  @property({ type: String })
  label = "";

  @property({
    type: String,
    converter: {
      fromAttribute: (value: string | null): ButtonType =>
        value === "submit" || value === "reset" || value === "button" ? value : "button",
    },
  })
  type: ButtonType = "button";

  static get styles() {
    return [...BaseElement.styles];
  }

  render() {
    const buttonClasses =
      `${sharedButtonVisualClasses} ${sharedButtonActiveBackgroundClasses} ${sharedButtonActiveTextClasses} ${sharedButtonHoverTintClasses} ${sharedButtonFocusRingClasses}` +
      " disabled:opacity-55 disabled:cursor-not-allowed disabled:hover:bg-[light-dark(rgb(15_23_42_/_18%),rgb(255_255_255_/_16%))] cursor-pointer";
    return html`
      <button
        type=${this.type}
        class=${buttonClasses}
        ?disabled=${this.disabled}
        aria-label=${ifDefined(this.label || undefined)}
      >
        <slot></slot>
      </button>
    `;
  }
}
