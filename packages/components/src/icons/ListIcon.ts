import { html } from "lit";
import { ifDefined } from "lit/directives/if-defined.js";

type ListIconOptions = {
  className?: string;
  slot?: string;
};

export function renderListIcon(options: ListIconOptions = {}) {
  const { className, slot } = options;
  return html`
    <svg
      slot=${ifDefined(slot)}
      class=${ifDefined(className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      aria-hidden="true"
    >
      <path d="M8 6h12M8 12h12M8 18h12" stroke-linecap="round"></path>
      <circle cx="4.5" cy="6" r="1"></circle>
      <circle cx="4.5" cy="12" r="1"></circle>
      <circle cx="4.5" cy="18" r="1"></circle>
    </svg>
  `;
}
