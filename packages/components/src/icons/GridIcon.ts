import { html } from "lit";
import { ifDefined } from "lit/directives/if-defined.js";

type GridIconOptions = {
  className?: string;
  slot?: string;
};

export function renderGridIcon(options: GridIconOptions = {}) {
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
      <rect x="4" y="4" width="6" height="6" rx="1.2"></rect>
      <rect x="14" y="4" width="6" height="6" rx="1.2"></rect>
      <rect x="4" y="14" width="6" height="6" rx="1.2"></rect>
      <rect x="14" y="14" width="6" height="6" rx="1.2"></rect>
    </svg>
  `;
}
