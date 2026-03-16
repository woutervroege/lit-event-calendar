import { html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { BaseElement } from "../BaseElement/BaseElement.js";
import {
  sharedButtonHoverTintClasses,
  sharedButtonPeerCheckedClasses,
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
  shortKey?: string;
};

@customElement("tab-switch")
export class TabSwitch extends BaseElement {
  #groupName = `tab-switch-${++tabSwitchInstanceId}`;

  @property({ type: Array })
  options: Array<TabSwitchOption | string> = [];

  @property({ type: String })
  value = "";

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
    const labelClasses = `${sharedButtonVisualClasses} ${sharedButtonHoverTintClasses} ${sharedButtonPeerFocusRingClasses} ${sharedButtonPeerCheckedClasses} ${sharedButtonPeerDisabledClasses}`;
    return html`
      <div
        class="inline-flex space-x-2 bg-[light-dark(rgb(15_23_42_/_10%),rgb(255_255_255_/_10%))] p-1 border border-[light-dark(rgb(15_23_42_/_14%),rgb(255_255_255_/_16%))] rounded-md"
        role="radiogroup"
        aria-label=${this.ariaLabel}
      >
        ${normalizedOptions.map((option, index) => {
          const inputId = `${groupName}-${option.value}-${index}`;
          const isChecked = option.value === this.value;
          const hotkey = option.hotkey?.trim();
          return html`
            <div class=${optionClasses}>
              <input
                id=${inputId}
                type="radio"
                name=${groupName}
                class=${inputClasses}
                value=${option.value}
                ?checked=${isChecked}
                aria-keyshortcuts=${hotkey || nothing}
                @change=${(e: Event) => this.#handleChange(e)}
              />
              <label
                for=${inputId}
                class=${labelClasses}
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
    const matchedOption = this.options
      .map((option) => this.#normalizeOption(option))
      .find((option) => normalizeHotkey(option.hotkey) === hotkey);
    if (!matchedOption || matchedOption.value === this.value) return;

    this.value = matchedOption.value;
    event.preventDefault();
  };

  #normalizeOption(option: TabSwitchOption | string): TabSwitchOption {
    if (typeof option === "string") {
      return { label: option, value: option };
    }

    const hotkey = option.hotkey ?? option.shortKey;
    return hotkey ? { ...option, hotkey } : option;
  }
}
