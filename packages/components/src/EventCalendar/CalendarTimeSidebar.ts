import { Temporal } from "@js-temporal/polyfill";
import { css, html } from "lit";
import { customElement } from "lit/decorators.js";
import { BaseElement } from "../BaseElement/BaseElement.js";

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
    return [
      ...BaseElement.styles,
      css`
        :host {
          display: block;
          width: var(--_lc-time-sidebar-width, auto);
          min-height: 0;
          color: var(--_lc-grid-line-day-color, light-dark(rgb(15 23 42 / 72%), rgb(255 255 255 / 72%)));
        }

        .container {
          display: flex;
          flex-direction: column;
          width: 100%;
          height: 100%;
          min-height: 0;
        }

        .all-day-label {
          display: flex;
          flex: 0 0 var(--_lc-all-day-row-height, 120px);
          justify-content: flex-end;
          align-items: flex-start;
          padding-top: 8px;
          padding-right: 4px;
          font-size: 12px;
          line-height: 1;
          font-weight: 500;
          white-space: nowrap;
          pointer-events: none;
        }

        .hour-labels {
          flex: 1;
          display: flex;
          flex-direction: column;
          pointer-events: none;
        }

        :host(:not([show-all-day-label])) .hour-labels {
          margin-top: -8px;
        }

        :host([show-all-day-label]) .hour-labels {
          margin-top: var(--_lc-week-timed-top-offset, 8px);
        }

        .hour-label-row {
          flex: 1;
          display: flex;
          justify-content: flex-end;
          align-items: flex-start;
        }

        .hour-label {
          display: block;
          font-size: 12px;
          line-height: 1;
          font-weight: 500;
          white-space: nowrap;
          text-align: end;
        }
      `,
    ];
  }

  get #resolvedLocale(): string {
    return this.locale || navigator.language;
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
