import { html, unsafeCSS } from "lit";
import { customElement } from "lit/decorators.js";
import { BaseElement } from "../BaseElement/BaseElement.js";
import type { Calendar, CalendarsMap } from "@lit-calendar/events-api";
import componentStyle from "./CalendarsSidebar.css?inline";

function sortedCalendarEntries(map: CalendarsMap): Array<[string, Calendar]> {
  return [...map.entries()].sort((a, b) =>
    a[1].displayName.localeCompare(b[1].displayName, undefined, { sensitivity: "base" })
  );
}

@customElement("calendars-sidebar")
export class CalendarsSidebar extends BaseElement {
  calendars?: CalendarsMap;

  static get properties() {
    return {
      calendars: { type: Object },
    } as const;
  }

  static get styles() {
    return [...BaseElement.styles, unsafeCSS(componentStyle)];
  }

  render() {
    const map = this.calendars ?? new Map();
    const entries = sortedCalendarEntries(map);

    return html`
      <aside class="calendars-sidebar" aria-label="Calendars">
        <h2 class="calendars-sidebar-heading">Calendars</h2>
        <ul class="calendar-list">
          ${entries.map(
            ([id, cal]) => html`
              <li class="calendar-row" title=${id}>
                <span
                  class="calendar-swatch"
                  style=${`background-color: ${cal.color}`}
                  aria-hidden="true"
                ></span>
                <span class="calendar-name">${cal.displayName}</span>
              </li>
            `
          )}
        </ul>
      </aside>
    `;
  }
}
