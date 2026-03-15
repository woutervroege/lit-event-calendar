import { html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { BaseElement } from "../BaseElement/BaseElement.js";

let tabSwitchInstanceId = 0;

@customElement("tab-switch")
export class TabSwitch extends BaseElement {
  #groupName = `tab-switch-${++tabSwitchInstanceId}`;

  @property({ type: Array })
  options: string[] = [];

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
    const deprecatedAriaLabel = this.getAttribute("aria-label");
    if (deprecatedAriaLabel && !this.hasAttribute("group-label")) {
      this.ariaLabel = deprecatedAriaLabel;
    }

    // Keep host free of aria-label to avoid invalid ARIA on custom elements without host role.
    if (this.hasAttribute("aria-label")) {
      this.removeAttribute("aria-label");
    }
  }

  render() {
    const groupName = this.name || this.#groupName;
    return html`
      <div
        class="inline-flex space-x-2 bg-[light-dark(rgb(15_23_42_/_10%),rgb(255_255_255_/_10%))] p-1 border border-[light-dark(rgb(15_23_42_/_14%),rgb(255_255_255_/_16%))] rounded-md text-sm"
        role="radiogroup"
        aria-label=${this.ariaLabel}
      >
        ${this.options.map((value, index) => {
          const inputId = `${groupName}-${value}-${index}`;
          const isChecked = value === this.value;
          return html`
            <div class="flex items-center">
              <input
                id=${inputId}
                type="radio"
                name=${groupName}
                class="sr-only peer"
                value=${value}
                ?checked=${isChecked}
                @change=${(e: Event) => this.#handleChange(e)}
              />
              <label
                for=${inputId}
                class="cursor-pointer rounded py-2 px-8 text-[light-dark(rgb(15_23_42_/_72%),rgb(255_255_255_/_72%))] transition-colors duration-200 peer-checked:bg-[light-dark(rgb(15_23_42_/_18%),rgb(255_255_255_/_16%))] peer-checked:text-[light-dark(rgb(15_23_42_/_92%),rgb(255_255_255_/_95%))] peer-focus-visible:outline-2 peer-focus-visible:-outline-offset-2 peer-focus-visible:outline-[light-dark(rgb(15_23_42_/_45%),rgb(255_255_255_/_55%))] peer-disabled:opacity-55 peer-disabled:cursor-not-allowed"
              >
                ${value}
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
}
