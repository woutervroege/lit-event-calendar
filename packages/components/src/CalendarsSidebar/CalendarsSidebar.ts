import { html, unsafeCSS } from "lit";
import { customElement } from "lit/decorators.js";
import { BaseElement } from "../BaseElement/BaseElement.js";
import type { Calendar, CalendarsMap } from "@lit-calendar/events-api";
import componentStyle from "./CalendarsSidebar.css?inline";

type AccountCalendarGroup = {
  accountId: string;
  entries: Array<[string, Calendar]>;
};

/** Groups by {@link Calendar.accountId}; accounts and calendars within each account are sorted by name/id. */
function calendarEntriesByAccount(map: CalendarsMap): AccountCalendarGroup[] {
  const byAccount = new Map<string, Array<[string, Calendar]>>();
  for (const entry of map.entries()) {
    const [calendarId, cal] = entry;
    const accountKey = cal.accountId;
    const bucket = byAccount.get(accountKey) ?? [];
    bucket.push([calendarId, cal]);
    byAccount.set(accountKey, bucket);
  }
  for (const list of byAccount.values()) {
    list.sort((a, b) =>
      a[1].displayName.localeCompare(b[1].displayName, undefined, { sensitivity: "base" })
    );
  }
  return [...byAccount.entries()]
    .sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: "base" }))
    .map(([accountId, entries]) => ({ accountId, entries }));
}

function flatCalendarIdsInGroupOrder(groups: AccountCalendarGroup[]): string[] {
  return groups.flatMap((g) => g.entries.map(([id]) => id));
}

@customElement("calendars-sidebar")
export class CalendarsSidebar extends BaseElement {
  calendars?: CalendarsMap;
  /**
   * Calendar ids whose events are shown. When unset, every calendar in `calendars` is visible.
   * Toggled via the color swatch checkboxes.
   */
  visibleCalendarIds?: string[];
  /** Calendar id used as the default target for creating new events. Toggled via the name row (radio). */
  defaultCalendarId?: string;

  static get properties() {
    return {
      calendars: { type: Object },
      visibleCalendarIds: { type: Array, attribute: false },
      defaultCalendarId: { type: String, attribute: false },
    } as const;
  }

  static get styles() {
    return [...BaseElement.styles, unsafeCSS(componentStyle)];
  }

  #effectiveVisibleSet(map: CalendarsMap): Set<string> {
    const explicit = this.visibleCalendarIds;
    if (explicit !== undefined) {
      return new Set(explicit);
    }
    return new Set(map.keys());
  }

  #onVisibilityChange(id: string, event: Event): void {
    event.stopPropagation();
    const input = event.target as HTMLInputElement;
    this.#setCalendarVisible(id, input.checked);
  }

  #setCalendarVisible(id: string, shouldShow: boolean): void {
    const map = this.calendars ?? new Map();
    const current = this.#effectiveVisibleSet(map);
    const nextSet = new Set(current);
    if (shouldShow) {
      nextSet.add(id);
    } else {
      nextSet.delete(id);
      if (this.defaultCalendarId === id) {
        this.defaultCalendarId = undefined;
        this.dispatchEvent(
          new CustomEvent("default-calendar-id-changed", {
            bubbles: true,
            composed: true,
            detail: { defaultCalendarId: undefined },
          })
        );
      }
    }
    const order = flatCalendarIdsInGroupOrder(calendarEntriesByAccount(map));
    const nextIds = order.filter((calendarId) => nextSet.has(calendarId));
    this.visibleCalendarIds = nextIds;
    this.dispatchEvent(
      new CustomEvent("visible-calendar-ids-changed", {
        bubbles: true,
        composed: true,
        detail: { visibleCalendarIds: nextIds },
      })
    );
  }

  #selectDefault(id: string): void {
    const map = this.calendars ?? new Map();
    if (!map.has(id)) return;

    const visible = this.#effectiveVisibleSet(map);
    if (!visible.has(id)) {
      const nextSet = new Set(visible);
      nextSet.add(id);
      const order = flatCalendarIdsInGroupOrder(calendarEntriesByAccount(map));
      const nextIds = order.filter((calendarId) => nextSet.has(calendarId));
      this.visibleCalendarIds = nextIds;
      this.dispatchEvent(
        new CustomEvent("visible-calendar-ids-changed", {
          bubbles: true,
          composed: true,
          detail: { visibleCalendarIds: nextIds },
        })
      );
    }

    if (this.defaultCalendarId === id) return;
    this.defaultCalendarId = id;
    this.dispatchEvent(
      new CustomEvent("default-calendar-id-changed", {
        bubbles: true,
        composed: true,
        detail: { defaultCalendarId: id },
      })
    );
  }

  render() {
    const map = this.calendars ?? new Map();
    const groups = calendarEntriesByAccount(map);
    const visible = this.#effectiveVisibleSet(map);
    const defaultId = this.defaultCalendarId;

    return html`
      <aside class="calendars-sidebar" aria-label="Calendars">
        <div
          class="calendar-list"
          role="radiogroup"
          aria-label="Default calendar for new events"
        >
          ${groups.map(
            (group, groupIndex) => html`
              <section
                class="calendar-account-group"
                aria-labelledby=${`calendars-sidebar-account-${groupIndex}`}
              >
                <h3
                  class="calendar-account-label"
                  id=${`calendars-sidebar-account-${groupIndex}`}
                >
                  ${group.accountId}
                </h3>
                <div
                  class="calendar-account-calendars"
                  role="presentation"
                >
                  ${group.entries.map(
                    ([id, cal]) => html`
                      <div
                        class="calendar-row ${visible.has(id) ? "" : "calendar-row--hidden"} ${defaultId === id ? "calendar-row--selected" : ""}"
                      >
                        <label
                          class="calendar-visibility"
                          title=${cal.url}
                          @click=${(e: Event) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            class="calendar-visibility-input"
                            .checked=${visible.has(id)}
                            aria-label=${`Show events for ${cal.displayName}`}
                            @change=${(e: Event) => this.#onVisibilityChange(id, e)}
                            @click=${(e: Event) => e.stopPropagation()}
                          />
                          <span
                            class="calendar-swatch"
                            style=${`background-color: ${cal.color}`}
                            aria-hidden="true"
                          ></span>
                        </label>
                        <button
                          type="button"
                          class="calendar-default"
                          role="radio"
                          aria-checked=${defaultId === id ? "true" : "false"}
                          aria-label=${cal.displayName}
                          @click=${() => this.#selectDefault(id)}
                        >
                          <span class="calendar-name">${cal.displayName}</span>
                        </button>
                      </div>
                    `
                  )}
                </div>
              </section>
            `
          )}
        </div>
      </aside>
    `;
  }
}
