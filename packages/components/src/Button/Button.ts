import { css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ifDefined } from "lit/directives/if-defined.js";
import { BaseElement } from "../BaseElement/BaseElement.js";
import {
  sharedButtonActiveBackgroundClasses,
  sharedButtonActiveTextClasses,
  sharedButtonCompactVisualClasses,
  sharedButtonDisabledClasses,
  sharedButtonFocusRingClasses,
  sharedButtonHoverTintClasses,
  sharedButtonVisualClasses,
  sharedFocusRingColorClasses,
} from "../shared/buttonStyles.js";
import {
  eventMatchesHotkey,
  getHotkeyDisplay,
  isEditableEventTarget,
  normalizeHotkey,
  sharedHotkeyBadgeClasses,
  toAriaHotkey,
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

  @property({ type: Boolean, reflect: true })
  raised = false;

  /** Raw attribute/property value; `get type()` exposes the safe subset for `<button type>`. */
  #typeAttribute = "button";

  @property({ type: String })
  get type(): ButtonType {
    const t = this.#typeAttribute;
    return t === "submit" || t === "reset" || t === "button" ? t : "button";
  }

  set type(value: string | null | undefined) {
    const next = value ?? "button";
    if (next === this.#typeAttribute) return;
    const previous = this.#typeAttribute;
    this.#typeAttribute = next;
    this.requestUpdate("type", previous);
  }

  static get styles() {
    return [
      ...BaseElement.styles,
      css`
        @media (max-width: 54rem) {
          :host([raised]) button {
            backdrop-filter: blur(10px) saturate(140%);
            -webkit-backdrop-filter: blur(10px) saturate(140%);
            box-shadow:
              0 10px 28px rgb(15 23 42 / 20%),
              0 1px 0 rgb(255 255 255 / 58%) inset;
            --_lc-button-bg: var(
              --lc-button-raised-bg,
              light-dark(rgb(255 255 255 / 78%), rgb(15 23 42 / 52%))
            );
            --_lc-button-hover-bg: var(
              --lc-button-raised-hover-bg,
              light-dark(rgb(255 255 255 / 88%), rgb(15 23 42 / 62%))
            );
            --_lc-button-border-color: var(
              --lc-button-raised-border-color,
              light-dark(rgb(15 23 42 / 18%), rgb(255 255 255 / 24%))
            );
          }

          @media (prefers-color-scheme: dark) {
            :host([raised]) button {
              box-shadow:
                0 12px 30px rgb(0 0 0 / 58%),
                0 1px 0 rgb(255 255 255 / 10%) inset;
            }
          }

          :host([raised][disabled]) button {
            box-shadow: none;
          }
        }
      `,
    ];
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
    const visualClasses = this.compact
      ? sharedButtonCompactVisualClasses
      : sharedButtonVisualClasses;
    const buttonClasses = `${visualClasses} ${sharedButtonActiveBackgroundClasses} ${sharedButtonActiveTextClasses} ${sharedButtonHoverTintClasses} ${sharedFocusRingColorClasses} ${sharedButtonFocusRingClasses} ${sharedButtonDisabledClasses}`;
    const hotkey = normalizeHotkey(this.hotkey);
    const hotkeyDisplay = getHotkeyDisplay(hotkey);
    const ariaHotkey = toAriaHotkey(hotkey);
    const hasVisibleTextContent = Boolean(this.textContent?.trim());
    const showHotkeyBadge = Boolean(hotkeyDisplay && hasVisibleTextContent);
    return html`
      <button
        type=${this.type}
        class=${buttonClasses}
        ?disabled=${this.disabled}
        aria-label=${ifDefined(this.label || undefined)}
        aria-keyshortcuts=${ariaHotkey || nothing}
        title=${ifDefined(hotkeyDisplay && this.label ? `${this.label} (${hotkeyDisplay})` : undefined)}
      >
        <span class="inline-flex items-center gap-2">
          <slot></slot>
          ${
            showHotkeyBadge
              ? html`<span
                class=${sharedHotkeyBadgeClasses}
                >${hotkeyDisplay}</span
              >`
              : nothing
          }
        </span>
      </button>
    `;
  }

  #handleGlobalKeydown = (event: KeyboardEvent) => {
    if (event.defaultPrevented) return;
    if (this.disabled || isEditableEventTarget(event.target)) return;
    if (!eventMatchesHotkey(event, this.hotkey)) return;

    const button = this.renderRoot.querySelector("button");
    if (!button) return;
    button.click();
    event.preventDefault();
  };
}
