import { html, unsafeCSS } from "lit";
import { customElement } from "lit/decorators.js";
import { BaseElement } from "../BaseElement/BaseElement.js";
import { getLocaleDirection, getLocaleWeekInfo, resolveLocale } from "../utils/Locale.js";
import componentStyle from "./CalendarWeekdayHeader.css?inline";

type WeekdayNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;

function isWeekdayNumber(value: number | undefined): value is WeekdayNumber {
  return Boolean(value && Number.isInteger(value) && value >= 1 && value <= 7);
}

@customElement("calendar-weekday-header")
export class CalendarWeekdayHeader extends BaseElement {
  weekStart?: WeekdayNumber;
  locale?: string;
  days = 7;

  static get properties() {
    return {
      weekStart: {
        type: Number,
        attribute: "week-start",
        reflect: true,
        converter: {
          fromAttribute: (v: string | null): WeekdayNumber | undefined => {
            if (v === null) return undefined;
            const day = Number(v);
            return isWeekdayNumber(day) ? day : undefined;
          },
          toAttribute: (v: number | undefined): string | null => (v ? String(v) : null),
        },
      },
      locale: { type: String },
      days: {
        type: Number,
        converter: {
          fromAttribute: (v: string | null): number => {
            const n = Number(v);
            if (!Number.isFinite(n)) return 7;
            return Math.max(1, Math.min(7, Math.floor(n)));
          },
        },
      },
    } as const;
  }

  static get styles() {
    return [...BaseElement.styles, unsafeCSS(componentStyle)];
  }

  get #resolvedLocale(): string {
    return resolveLocale(this.locale);
  }

  get #resolvedWeekStart(): WeekdayNumber {
    if (isWeekdayNumber(this.weekStart)) return this.weekStart;
    const firstDay = getLocaleWeekInfo(this.#resolvedLocale).firstDay;
    return isWeekdayNumber(firstDay) ? firstDay : 1;
  }

  get #weekdayNumbers(): WeekdayNumber[] {
    const weekStart = this.#resolvedWeekStart;
    const ordered = Array.from(
      { length: 7 },
      (_, index) => (((weekStart - 1 + index) % 7) + 1) as WeekdayNumber
    );
    return ordered.slice(0, this.days);
  }

  get #weekendDays(): Set<number> {
    return new Set(getLocaleWeekInfo(this.#resolvedLocale).weekend);
  }

  #weekdayDate(weekday: WeekdayNumber): Date {
    // Monday reference week to generate locale weekday labels consistently.
    return new Date(Date.UTC(2024, 0, 1 + (weekday - 1)));
  }

  #formatWeekday(weekday: WeekdayNumber, width: "long" | "short" | "narrow"): string {
    return new Intl.DateTimeFormat(this.#resolvedLocale, { weekday: width }).format(
      this.#weekdayDate(weekday)
    );
  }

  render() {
    const weekendDays = this.#weekendDays;
    const direction = getLocaleDirection(this.#resolvedLocale);
    return html`
      <div
        class="weekday-header"
        dir=${direction}
        style=${`grid-template-columns: repeat(${this.days}, minmax(0, 1fr));`}
        aria-hidden="true"
      >
        ${this.#weekdayNumbers.map(
          (weekday) => html`
            <div class="weekday ${weekendDays.has(weekday) ? "weekend" : ""}">
              <span class="weekday-label">
                <span class="weekday-long">${this.#formatWeekday(weekday, "long")}</span>
                <span class="weekday-short">${this.#formatWeekday(weekday, "short")}</span>
                <span class="weekday-narrow">${this.#formatWeekday(weekday, "narrow")}</span>
              </span>
            </div>
          `
        )}
      </div>
    `;
  }
}
