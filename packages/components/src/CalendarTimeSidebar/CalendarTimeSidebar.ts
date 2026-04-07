import { html, unsafeCSS } from "lit";
import { customElement } from "lit/decorators.js";
import { BaseElement } from "../BaseElement/BaseElement.js";
import { getLocaleDirection } from "../utils/Locale.js";
import { getHourlyTimeLabels } from "../utils/TimeFormatting.js";
import componentStyle from "./CalendarTimeSidebar.css?inline";

@customElement("calendar-time-sidebar")
export class CalendarTimeSidebar extends BaseElement {
  locale?: string;
  /** Raw property value; `get hours()` clamps to 1–24. */
  #hoursRaw = 24;

  static get properties() {
    return {
      locale: { type: String },
      hours: { type: Number },
    } as const;
  }

  static get styles() {
    return [...BaseElement.styles, unsafeCSS(componentStyle)];
  }

  get hours(): number {
    const parsed = Number(this.#hoursRaw);
    return !Number.isFinite(parsed) ? 24 : Math.max(1, Math.min(24, Math.floor(parsed)));
  }

  set hours(value: number | string | null | undefined) {
    const n = Number(value);
    const next = Number.isFinite(n) ? n : NaN;
    if (Object.is(next, this.#hoursRaw)) return;
    const previous = this.#hoursRaw;
    this.#hoursRaw = next;
    this.requestUpdate("hours", previous);
  }

  render() {
    const direction = getLocaleDirection(this.locale);
    const hours = this.hours;
    const hourlyLabels = getHourlyTimeLabels(this.locale, hours);
    const endLabel = getHourlyTimeLabels(this.locale, 1)[0] ?? "00:00";
    const labels = [...hourlyLabels, endLabel];
    const hourSlots = Math.max(1, hours);

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
