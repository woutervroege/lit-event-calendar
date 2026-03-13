import { Temporal } from "@js-temporal/polyfill";
import { html, unsafeCSS } from "lit";
import { customElement } from "lit/decorators.js";
import { BaseElement } from "../BaseElement/BaseElement.js";
import { resolveLocale } from "../utils/Locale.js";
import componentStyle from "./CalendarTimeSidebar.css?inline";

@customElement("calendar-time-sidebar")
export class CalendarTimeSidebar extends BaseElement {
  locale?: string;
  hours = 24;
  showAllDayLabel = false;
  allDayLabel = "All-day";

  static get properties() {
    return {
      locale: { type: String },
      hours: { type: Number },
      showAllDayLabel: { type: Boolean, attribute: "show-all-day-label", reflect: true },
      allDayLabel: { type: String, attribute: "all-day-label" },
    } as const;
  }

  static get styles() {
    return [...BaseElement.styles, unsafeCSS(componentStyle)];
  }

  get #resolvedLocale(): string {
    return resolveLocale(this.locale);
  }

  render() {
    const clampedHours = Math.max(0, Math.floor(this.hours));

    return html`
      <div class="container">
        ${this.showAllDayLabel ? html`<div class="all-day-label">${this.allDayLabel}</div>` : ""}
        <div class="hour-labels">
          ${Array.from({ length: clampedHours }, (_, hour) => {
            const label = Temporal.PlainTime.from({ hour, minute: 0 }).toLocaleString(
              this.#resolvedLocale,
              {
                hour: "2-digit",
                minute: "2-digit",
              }
            );
            return html`
              <div class="hour-label-row">
                <time class="hour-label" datetime=${`${hour.toString().padStart(2, "0")}:00`}>
                  ${label}
                </time>
              </div>
            `;
          })}
        </div>
      </div>
    `;
  }
}
