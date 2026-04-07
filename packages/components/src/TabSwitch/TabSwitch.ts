import { html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { BaseElement } from "../BaseElement/BaseElement.js";
import {
  sharedButtonPeerDisabledClasses,
  sharedButtonPeerFocusRingClasses,
} from "../shared/buttonStyles.js";
import {
  getPlainCharacterHotkey,
  isEditableEventTarget,
  normalizeHotkey,
} from "../shared/hotkey.js";
import type { TabSwitchOption } from "../types/TabSwitch.js";

let tabSwitchInstanceId = 0;

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

  @property({ type: Boolean, reflect: true })
  compact = false;

  @property({ type: Boolean, attribute: "show-hotkeys" })
  showHotkeys = true;

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
    const sizeClasses = this.compact ? "h-9 min-w-9 px-2" : "h-9 px-3";
    const labelClasses = `${sizeClasses} inline-flex items-center justify-center border-0 rounded-none bg-transparent text-[light-dark(rgb(15_23_42_/_56%),rgb(255_255_255_/_58%))] hover:text-[var(--_lc-switch-active-color)] transition-colors duration-150 ${sharedButtonPeerFocusRingClasses} ${sharedButtonPeerDisabledClasses}`;
    const wrapperClasses =
      "inline-flex items-stretch gap-0 [--_lc-switch-active-color:var(--lc-switch-active-color,light-dark(rgb(15_23_42_/_95%),rgb(255_255_255_/_98%)))] [--_lc-switch-border-color:light-dark(var(--_lc-grid-line-color,rgb(15_23_42_/_14%)),var(--_lc-grid-line-color,rgb(255_255_255_/_16%)))] border-0 border-b border-solid border-[var(--_lc-switch-border-color)]";
    return html`
      <div
        class=${wrapperClasses}
        role="radiogroup"
        aria-label=${this.ariaLabel}
      >
        ${normalizedOptions.map((option, index) => {
          const inputId = `${groupName}-${option.value}-${index}`;
          const isChecked = option.value === this.value;
          const checkedClasses = isChecked ? "text-[var(--_lc-switch-active-color)]" : "";
          const indicatorClasses = isChecked
            ? "inline-flex h-full box-border items-center border-b-2 [border-bottom-color:currentColor]"
            : "inline-flex h-full box-border items-center border-b-2 border-transparent";
          const hotkey = this.showHotkeys ? option.hotkey?.trim() : "";
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
                title=${this.#optionTitle(option)}
              >
                <span class=${indicatorClasses}>${option.label}</span>
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

  #optionTitle(option: TabSwitchOption): string {
    const labelText =
      option.ariaLabel ?? (typeof option.label === "string" ? option.label : option.value);
    const hotkey = option.hotkey?.trim();
    return hotkey ? `${labelText} (${hotkey.toUpperCase()})` : labelText;
  }
}
