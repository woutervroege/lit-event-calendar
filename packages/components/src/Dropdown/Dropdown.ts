import { css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ifDefined } from "lit/directives/if-defined.js";
import { BaseElement } from "../BaseElement/BaseElement.js";
import {
  getPlainCharacterHotkey,
  isEditableEventTarget,
  normalizeHotkey,
} from "../shared/hotkey.js";
import {
  sharedButtonActiveBackgroundClasses,
  sharedButtonActiveTextClasses,
  sharedButtonDisabledClasses,
  sharedButtonFocusRingClasses,
  sharedButtonHoverTintClasses,
  sharedButtonVisualClasses,
  sharedFocusRingColorClasses,
} from "../shared/buttonStyles.js";
import type { DropdownOption } from "../types/Dropdown.js";

@customElement("lc-dropdown")
export class Dropdown extends BaseElement {
  #value = "";
  #fallbackSelectId = `lc-dropdown-${Math.random().toString(36).slice(2)}`;
  #pointerFocus = false;

  @property({ type: Array })
  options: Array<DropdownOption | string> = [];

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

  @property({ type: String, attribute: "aria-label" })
  ariaLabel = "Select option";

  @property({ type: String })
  placeholder = "Select an option";

  @property({ type: String })
  hotkey = "";

  @property({ type: Boolean, reflect: true })
  disabled = false;

  @property({ type: Boolean, attribute: "icon-only", reflect: true })
  iconOnly = false;

  static get properties() {
    return {
      value: { type: String, dispatchChangeEvent: { bubbles: true, composed: true } },
    } as const;
  }

  static get styles() {
    return [
      ...BaseElement.styles,
      css`
        .lc-dropdown-root {
          position: relative;
          display: inline-flex;
        }

        .lc-dropdown-select {
          appearance: none !important;
          -webkit-appearance: none !important;
          -moz-appearance: none !important;
          background-image: none !important;
          text-align: start;
          padding-inline-start: 0.75rem;
          padding-inline-end: 3rem;
        }

        :host([icon-only]) .lc-dropdown-select {
          inline-size: calc(2.75rem + 2px);
          min-inline-size: calc(2.75rem + 2px);
          block-size: calc(2.75rem + 2px);
          min-block-size: calc(2.75rem + 2px);
          padding-inline-start: 0;
          padding-inline-end: 0;
          color: transparent;
          text-indent: 100%;
          white-space: nowrap;
          overflow: hidden;
        }

        :host([icon-only]) .lc-dropdown-icon,
        :host([icon-only]) .lc-dropdown-chevron {
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          transform: none;
        }

        .lc-dropdown-select:focus:not(:focus-visible) {
          outline: none;
          box-shadow: none;
        }

        .lc-dropdown-select[data-pointer-focus="true"]:focus-visible {
          outline: none !important;
          box-shadow: none !important;
        }

        .lc-dropdown-select::-ms-expand {
          display: none;
        }

        .lc-dropdown-chevron {
          position: absolute;
          inset-inline-end: 1rem;
          top: 50%;
          z-index: 10;
          display: block;
          transform: translateY(-50%);
          pointer-events: none;
          color: light-dark(rgb(15 23 42 / 78%), rgb(255 255 255 / 78%));
        }

        .lc-dropdown-icon {
          position: absolute;
          inset-inline-end: 1rem;
          top: 50%;
          z-index: 10;
          display: inline-flex;
          transform: translateY(-50%);
          pointer-events: none;
          color: light-dark(rgb(15 23 42 / 74%), rgb(255 255 255 / 78%));
        }

        .lc-dropdown-icon:empty {
          display: none;
        }

        :host([icon-only]) .lc-dropdown-icon ::slotted([slot="icon"]) {
          display: block;
          margin: 0;
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

  override firstUpdated(changedProperties: Map<PropertyKey, unknown>): void {
    super.firstUpdated(changedProperties);
    this.#syncSelectValue();
  }

  override updated(changedProperties: Map<PropertyKey, unknown>): void {
    super.updated(changedProperties);
    if (changedProperties.has("value") || changedProperties.has("options")) {
      this.#syncSelectValue();
    }
  }

  render() {
    const normalizedOptions = this.options.map((option) => this.#normalizeOption(option));
    const hasSelection = normalizedOptions.some((option) => option.value === this.value);
    const ownHotkey = normalizeHotkey(this.hotkey);
    const hasCustomIcon = this.#hasAssignedIcon();

    const selectClasses = `lc-dropdown-select ${sharedButtonVisualClasses} ${sharedButtonActiveBackgroundClasses} ${sharedButtonHoverTintClasses} ${sharedFocusRingColorClasses} ${sharedButtonFocusRingClasses} ${sharedButtonDisabledClasses} block w-full ${
      hasSelection
        ? sharedButtonActiveTextClasses
        : "text-[light-dark(rgb(15_23_42_/_56%),rgb(255_255_255_/_56%))]"
    }`;

    return html`
      <div class="lc-dropdown-root">
        <select
          id=${this.#fallbackSelectId}
          name=${ifDefined(this.name || undefined)}
          class=${selectClasses}
          aria-label=${this.ariaLabel}
          aria-keyshortcuts=${ownHotkey || nothing}
          ?disabled=${this.disabled}
          .value=${this.value}
          @pointerdown=${this.#handlePointerDown}
          @keydown=${this.#handleSelectKeydown}
          @focus=${this.#handleSelectFocus}
          @blur=${this.#handleSelectBlur}
          @change=${this.#handleChange}
        >
          ${!hasSelection ? html`<option value="" disabled selected>${this.placeholder}</option>` : nothing}
          ${normalizedOptions.map(
            (option) => html`
              <option value=${option.value} ?disabled=${option.disabled}>
                ${option.label}
              </option>
            `
          )}
        </select>
        ${hasCustomIcon
          ? html`
              <span class="lc-dropdown-icon" aria-hidden="true">
                <slot name="icon" @slotchange=${() => this.requestUpdate()}></slot>
              </span>
            `
          : html`
              <span class="lc-dropdown-chevron" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  style="width: 1rem; height: 1rem;"
                >
                  <path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round"></path>
                </svg>
              </span>
            `}
      </div>
    `;
  }

  #handleChange = (event: Event) => {
    const target = event.target as HTMLSelectElement | null;
    if (!target) return;
    this.value = target.value;
  };

  #handlePointerDown = () => {
    this.#pointerFocus = true;
  };

  #handleSelectKeydown = (event: KeyboardEvent) => {
    const key = event.key;
    if (key === "Tab" || key.startsWith("Arrow") || key === "Enter" || key === " ") {
      this.#pointerFocus = false;
      const target = event.currentTarget as HTMLSelectElement | null;
      if (target) {
        target.removeAttribute("data-pointer-focus");
      }
    }
  };

  #handleSelectFocus = (event: FocusEvent) => {
    const target = event.currentTarget as HTMLSelectElement | null;
    if (!target) return;
    if (this.#pointerFocus) {
      target.setAttribute("data-pointer-focus", "true");
      return;
    }
    target.removeAttribute("data-pointer-focus");
  };

  #handleSelectBlur = (event: FocusEvent) => {
    const target = event.currentTarget as HTMLSelectElement | null;
    if (!target) return;
    target.removeAttribute("data-pointer-focus");
  };

  #handleGlobalKeydown = (event: KeyboardEvent) => {
    if (event.defaultPrevented) return;
    if (this.disabled || isEditableEventTarget(event.target)) return;
    const pressedHotkey = getPlainCharacterHotkey(event);
    if (!pressedHotkey) return;

    const normalizedOptions = this.options.map((option) => this.#normalizeOption(option));
    const matchedOption = normalizedOptions.find(
      (option) => !option.disabled && normalizeHotkey(option.hotkey) === pressedHotkey
    );
    if (matchedOption) {
      if (matchedOption.value !== this.value) {
        this.value = matchedOption.value;
      }
      this.#focusSelect();
      event.preventDefault();
      return;
    }

    const ownHotkey = normalizeHotkey(this.hotkey);
    if (!ownHotkey || pressedHotkey !== ownHotkey) return;
    this.#focusSelect();
    event.preventDefault();
  };

  #focusSelect() {
    const select = this.renderRoot.querySelector<HTMLSelectElement>("select");
    if (!select) return;
    select.focus();
  }

  #syncSelectValue() {
    const select = this.renderRoot.querySelector<HTMLSelectElement>("select");
    if (!select) return;

    const normalizedOptions = this.options.map((option) => this.#normalizeOption(option));
    const hasSelection = normalizedOptions.some((option) => option.value === this.value);
    const nextValue = hasSelection ? this.value : "";
    if (select.value !== nextValue) {
      select.value = nextValue;
    }
  }

  #normalizeOption(option: DropdownOption | string): DropdownOption {
    if (typeof option === "string") {
      return { label: option, value: option };
    }

    return option;
  }

  #hasAssignedIcon(): boolean {
    const iconElement = this.querySelector("[slot='icon']");
    if (!iconElement) return false;
    return true;
  }
}
