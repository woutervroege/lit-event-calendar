import { html, unsafeCSS } from "lit";
import { customElement } from "lit/decorators.js";
import { BaseElement } from "../BaseElement/BaseElement.js";
import { getLocaleDirection } from "../utils/Locale.js";
import { getHourlyTimeLabels } from "../utils/TimeFormatting.js";
import componentStyle from "./CalendarTimeSidebar.css?inline";

@customElement("calendar-time-sidebar")
export class CalendarTimeSidebar extends BaseElement {
  locale?: string;
  hours = 24;

  static get properties() {
    return {
      locale: { type: String },
      hours: {
        type: Number,
        converter: {
          fromAttribute: (value: string | null): number => {
            const parsed = Number(value);
            if (!Number.isFinite(parsed)) return 24;
            return Math.max(1, Math.min(24, Math.floor(parsed)));
          },
        },
      },
    } as const;
  }

  static get styles() {
    return [...BaseElement.styles, unsafeCSS(componentStyle)];
  }

  render() {
    const direction = getLocaleDirection(this.locale);
    const hourlyLabels = getHourlyTimeLabels(this.locale, this.hours);
    const endLabel = getHourlyTimeLabels(this.locale, 1)[0] ?? "00:00";
    const labels = [...hourlyLabels, endLabel];
    const hourSlots = Math.max(1, this.hours);

    return html`
      <div class="time-sidebar" dir=${direction}>
        <div class="weekday-header-slot" aria-hidden="true"></div>
        <div class="all-day-slot" aria-hidden="true"></div>
        <div class="timed-slot">
          <div class="hour-labels" style=${`--_lc-time-sidebar-hours: ${hourSlots};`}>
            ${labels.map(
              (label) => html`
                <div class="hour-label-row">
                  <span class="hour-label">${label}</span>
                </div>
              `
            )}
          </div>
        </div>
      </div>
    `;
  }
}
