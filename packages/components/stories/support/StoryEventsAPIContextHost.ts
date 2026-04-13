import { ContextProvider } from "@lit/context";
import { LitElement, css, html, type PropertyValues } from "lit";
import { customElement, property } from "lit/decorators.js";
import {
  EventsAPI,
  type ApplyResult,
  type CalendarAccounts,
  type CalendarsMap,
  type CalendarEventsMap,
  type CreateInput,
  type EventOperation,
  type MoveInput,
  type RemoveInput,
  type ResizeEndInput,
  type ResizeStartInput,
  type UpdateInput,
} from "@lit-calendar/events-api";
import {
  type EventsAPIContextValue,
  eventsAPIContext,
} from "../../src/context/EventsAPIContext.js";

/**
 * Story-only host: provides {@link eventsAPIContext} to descendants (e.g. `calendar-grid-view-group`)
 * without rendering calendar chrome. Holds `events` and `calendars` like `event-calendar`.
 */
@customElement("story-events-api-host")
export class StoryEventsAPIContextHost extends LitElement {
  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
  `;

  #provider = new ContextProvider(this, { context: eventsAPIContext });

  @property({ type: Object, attribute: false })
  calendars: CalendarsMap = new Map();

  @property({ type: Object, attribute: false })
  events: CalendarEventsMap = new Map();

  @property({ type: String, attribute: false })
  timezone = "";

  @property({ type: Array, attribute: false })
  visibleCalendarIds?: string[];

  @property({ type: String, attribute: "selected-calendar-id" })
  selectedCalendarId?: string;

  override render() {
    return html`<slot></slot>`;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#provider.setValue(this.#buildValue(), true);
  }

  override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (
      changed.has("events") ||
      changed.has("calendars") ||
      changed.has("timezone") ||
      changed.has("visibleCalendarIds") ||
      changed.has("selectedCalendarId")
    ) {
      this.#provider.setValue(this.#buildValue(), true);
    }
  }

  #buildValue(): EventsAPIContextValue {
    const host = this;
    return {
      getEvents: () => host.events ?? new Map(),
      getCalendars: () => host.calendars ?? new Map(),
      getCalendarAccounts: (): CalendarAccounts => {
        const accounts = new Set() as CalendarAccounts;
        for (const cal of (host.calendars ?? new Map()).values()) {
          accounts.add(cal.accountId);
        }
        return accounts;
      },
      getVisibleCalendarIds: () => host.visibleCalendarIds,
      getSelectedCalendarId: () => {
        const raw = host.selectedCalendarId;
        if (raw === undefined || raw === null) return undefined;
        const trimmed = String(raw).trim();
        return trimmed === "" ? undefined : trimmed;
      },
      getApi: () =>
        new EventsAPI(host.events ?? new Map(), {
          timezone: host.timezone || undefined,
          trackPending: true,
        }),
      apply: (operation) => host.#apply(operation),
      create: (input: CreateInput) => host.#apply({ type: "create", input }),
      update: (input: UpdateInput) => host.#apply({ type: "update", input }),
      move: (input: MoveInput) => host.#apply({ type: "move", input }),
      resizeStart: (input: ResizeStartInput) => host.#apply({ type: "resize-start", input }),
      resizeEnd: (input: ResizeEndInput) => host.#apply({ type: "resize-end", input }),
      remove: (input: RemoveInput) => host.#apply({ type: "remove", input }),
      addExclusion: (input) => host.#apply({ type: "add-exclusion", input }),
      removeExclusion: (input) => host.#apply({ type: "remove-exclusion", input }),
      addException: (input) => host.#apply({ type: "add-exception", input }),
      removeException: (input) => host.#apply({ type: "remove-exception", input }),
    };
  }

  #apply(operation: EventOperation): ApplyResult {
    const api = new EventsAPI(this.events ?? new Map(), {
      timezone: this.timezone || undefined,
      trackPending: true,
    });
    const result = api.apply(operation);
    this.events = result.nextState;
    return result;
  }
}
