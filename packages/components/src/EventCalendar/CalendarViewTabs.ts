import { html, unsafeCSS } from "lit";
import { customElement } from "lit/decorators.js";
import { BaseElement } from "../BaseElement/BaseElement.js";
import componentStyle from "./CalendarViewTabs.css?inline";

type CalendarViewMode = "day" | "week" | "month" | "year";

const VIEW_OPTIONS: ReadonlyArray<{ mode: CalendarViewMode; label: string }> = [
  { mode: "day", label: "Day" },
  { mode: "week", label: "Week" },
  { mode: "month", label: "Month" },
  { mode: "year", label: "Year" },
];
let tabsInstanceId = 0;

@customElement("calendar-view-tabs")
export class CalendarViewTabs extends BaseElement {
  view: CalendarViewMode = "month";
  #groupName = `event-calendar-tabs-${++tabsInstanceId}`;

  static get properties() {
    return {
      view: {
        type: String,
        converter: {
          fromAttribute: (value: string | null): CalendarViewMode =>
            value === "day" || value === "week" || value === "month" || value === "year"
              ? value
              : "month",
        },
      },
    } as const;
  }

  static get styles() {
    return [...BaseElement.styles, unsafeCSS(componentStyle)];
  }

  render() {
    return html`
      <div class="tabs tabs-box" data-theme="light" role="tablist" aria-label="Calendar view">
        ${VIEW_OPTIONS.map(
          ({ mode, label }) => html`
            <input
              id=${this.#tabId(mode)}
              type="radio"
              name=${this.#groupName}
              class="tab"
              role="tab"
              aria-label=${label}
              aria-selected=${this.view === mode ? "true" : "false"}
              aria-controls=${this.#panelId(mode)}
              ?checked=${this.view === mode}
              @change=${() => this.#selectView(mode)}
            />
          `
        )}
      </div>
    `;
  }

  #selectView(view: CalendarViewMode) {
    this.dispatchEvent(
      new CustomEvent("view-selected", {
        detail: { view },
        bubbles: true,
        composed: true,
      })
    );
  }

  #tabId(view: CalendarViewMode): string {
    return `event-calendar-tab-${view}`;
  }

  #panelId(view: CalendarViewMode): string {
    return `event-calendar-panel-${view}`;
  }
}
