import { html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ifDefined } from "lit/directives/if-defined.js";
import { BaseElement } from "../BaseElement/BaseElement.js";
import {
  sharedButtonActiveBackgroundClasses,
  sharedButtonCompactVisualClasses,
  sharedButtonActiveTextClasses,
  sharedButtonDisabledClasses,
  sharedButtonFocusRingClasses,
  sharedButtonHoverTintClasses,
  sharedButtonVisualClasses,
  sharedFocusRingColorClasses,
} from "../shared/buttonStyles.js";
import {
  getPlainCharacterHotkey,
  isEditableEventTarget,
  normalizeHotkey,
  sharedHotkeyBadgeClasses,
} from "../shared/hotkey.js";

type ButtonType = "button" | "submit" | "reset";

@customElement("lc-button")
export class Button extends BaseElement {
  @property({ type: Boolean, reflect: true })
  disabled = false;

  @property({ type: Boolean, reflect: true })
  compact = false;

  @property({ type: String })
  label = "";

  @property({ type: String })
  hotkey = "";

  @property({ type: String, attribute: "short-key" })
  shortKey = "";

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

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("keydown", this.#handleGlobalKeydown);
  }

  disconnectedCallback() {
    window.removeEventListener("keydown", this.#handleGlobalKeydown);
    super.disconnectedCallback();
  }

  render() {
    const visualClasses = this.compact ? sharedButtonCompactVisualClasses : sharedButtonVisualClasses;
    const buttonClasses = `${visualClasses} ${sharedButtonActiveBackgroundClasses} ${sharedButtonActiveTextClasses} ${sharedButtonHoverTintClasses} ${sharedFocusRingColorClasses} ${sharedButtonFocusRingClasses} ${sharedButtonDisabledClasses}`;
    const hotkey = normalizeHotkey(this.hotkey || this.shortKey);
    const hotkeyDisplay = hotkey?.toUpperCase();
    return html`
      <button
        type=${this.type}
        class=${buttonClasses}
        ?disabled=${this.disabled}
        aria-label=${ifDefined(this.label || undefined)}
        aria-keyshortcuts=${hotkey || nothing}
        title=${ifDefined(hotkeyDisplay && this.label ? `${this.label} (${hotkeyDisplay})` : undefined)}
      >
        <span class="inline-flex items-center gap-2">
          <slot></slot>
          ${hotkeyDisplay
            ? html`<span
                class=${sharedHotkeyBadgeClasses}
                >${hotkeyDisplay}</span
              >`
            : nothing}
        </span>
      </button>
    `;
  }

  #handleGlobalKeydown = (event: KeyboardEvent) => {
    if (event.defaultPrevented) return;
    if (this.disabled || isEditableEventTarget(event.target)) return;
    const pressedHotkey = getPlainCharacterHotkey(event);
    const ownHotkey = normalizeHotkey(this.hotkey || this.shortKey);
    if (!pressedHotkey || !ownHotkey || pressedHotkey !== ownHotkey) return;

    const button = this.renderRoot.querySelector("button");
    if (!button) return;
    button.click();
    event.preventDefault();
  };
}
