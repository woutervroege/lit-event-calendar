import { html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { BaseElement } from "../BaseElement/BaseElement.js";
import {
  sharedButtonHoverTintClasses,
  sharedButtonPeerDisabledClasses,
  sharedButtonPeerFocusRingClasses,
  sharedButtonVisualClasses,
} from "../shared/buttonStyles.js";
import {
  getPlainCharacterHotkey,
  isEditableEventTarget,
  normalizeHotkey,
  sharedHotkeyBadgeClasses,
} from "../shared/hotkey.js";

let tabSwitchInstanceId = 0;

export type TabSwitchOption = {
  label: string;
  value: string;
  hotkey?: string;
};

@customElement("tab-switch")
export class TabSwitch extends BaseElement {
  #groupName = `tab-switch-${++tabSwitchInstanceId}`;
  #value = "";

  @property({ type: Array })
  options: Array<TabSwitchOption | string> = [];

  get value(): string {
    return this.#value;
  }

  set value(value: string) {
    const nextValue = value ?? "";
    if (this.#value === nextValue) return;
    const oldValue = this.#value;
    this.#value = nextValue;
    this.requestUpdate("value", oldValue);
  }

  @property({ type: String })
  name = "";

  @property({ type: String, attribute: "group-label" })
  ariaLabel = "Options";

  static get properties() {
    return {
      value: { type: String, dispatchChangeEvent: { composed: true } },
    } as const;
  }

  static get styles() {
    return [...BaseElement.styles];
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("keydown", this.#handleGlobalKeydown);
    const deprecatedAriaLabel = this.getAttribute("aria-label");
    if (deprecatedAriaLabel && !this.hasAttribute("group-label")) {
      this.ariaLabel = deprecatedAriaLabel;
    }

    // Keep host free of aria-label to avoid invalid ARIA on custom elements without host role.
    if (this.hasAttribute("aria-label")) {
      this.removeAttribute("aria-label");
    }
  }

  disconnectedCallback() {
    window.removeEventListener("keydown", this.#handleGlobalKeydown);
    super.disconnectedCallback();
  }

  render() {
    const groupName = this.name || this.#groupName;
    const normalizedOptions = this.options.map((option) => this.#normalizeOption(option));
    const optionClasses = "flex items-center";
    const inputClasses = "sr-only peer";
    const labelClasses = `${sharedButtonVisualClasses} border-0 border-transparent ${sharedButtonHoverTintClasses} ${sharedButtonPeerFocusRingClasses} ${sharedButtonPeerDisabledClasses}`;
    return html`
      <div
        class="inline-flex space-x-2 bg-[light-dark(rgb(15_23_42_/_10%),rgb(255_255_255_/_10%))] p-1 [--_lc-switch-border-color:light-dark(var(--_lc-grid-line-color,rgb(15_23_42_/_14%)),var(--_lc-grid-line-color,rgb(255_255_255_/_16%)))] border border-solid border-[var(--_lc-switch-border-color)] rounded-lg"
        role="radiogroup"
        aria-label=${this.ariaLabel}
      >
        ${normalizedOptions.map((option, index) => {
          const inputId = `${groupName}-${option.value}-${index}`;
          const isChecked = option.value === this.value;
          const checkedClasses = isChecked
            ? "bg-[var(--_lc-button-checked-bg,var(--lc-button-checked-bg,var(--_lc-button-checked-bg-default)))] hover:bg-[var(--_lc-button-checked-hover-bg,var(--lc-button-checked-hover-bg,var(--_lc-button-checked-hover-bg-default)))] text-[light-dark(rgb(15_23_42_/_92%),rgb(255_255_255_/_95%))] shadow-[0_1px_2px_light-dark(rgb(15_23_42_/_16%),rgb(0_0_0_/_32%))]"
            : "";
          const hotkey = option.hotkey?.trim();
          return html`
            <div class=${optionClasses}>
              <input
                id=${inputId}
                type="radio"
                name=${groupName}
                class=${inputClasses}
                value=${option.value}
                .checked=${isChecked}
                aria-keyshortcuts=${hotkey || nothing}
                @change=${(e: Event) => this.#handleChange(e)}
              />
              <label
                for=${inputId}
                class="${labelClasses} ${checkedClasses}"
                title=${hotkey ? `${option.label} (${hotkey.toUpperCase()})` : option.label}
              >
                <span class="inline-flex items-center gap-2">
                  <span>${option.label}</span>
                  ${hotkey
                    ? html`<span
                        class=${sharedHotkeyBadgeClasses}
                        >${hotkey.toUpperCase()}</span
                      >`
                    : nothing}
                </span>
              </label>
            </div>
          `;
        })}
      </div>
    `;
  }

  #handleChange(e: Event) {
    const value = (e.target as HTMLInputElement).value as string;
    this.value = value;
  }

  #handleGlobalKeydown = (event: KeyboardEvent) => {
    if (event.defaultPrevented) return;
    if (isEditableEventTarget(event.target)) return;
    const hotkey = getPlainCharacterHotkey(event);
    if (!hotkey) return;
    const normalizedOptions = this.options.map((option) => this.#normalizeOption(option));
    const matchedIndex = normalizedOptions.findIndex(
      (option) => normalizeHotkey(option.hotkey) === hotkey
    );
    if (matchedIndex < 0) return;
    const matchedOption = normalizedOptions[matchedIndex];
    if (matchedOption.value === this.value) return;

    // Trigger the same path as a user click so checked state and events stay in sync.
    const inputs = this.renderRoot.querySelectorAll<HTMLInputElement>("input[type='radio']");
    const matchedInput = inputs.item(matchedIndex);
    if (!matchedInput) return;
    matchedInput.click();
    event.preventDefault();
  };

  #normalizeOption(option: TabSwitchOption | string): TabSwitchOption {
    if (typeof option === "string") {
      return { label: option, value: option };
    }
    return option;
  }
}
