import { ContextProvider } from "@lit/context";
import {
  JmapClient,
  JmapEventsAdapter,
  MockJmapServer,
  mockAllDayEvent,
  mockPersonalCalendar,
  mockRecurringEvent,
  mockTimedEvent,
  mockWorkCalendar,
} from "@lit-calendar/jmap-client";
import { css, html, LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import { eventsAPIContext } from "../../src/context/EventsAPIContext.js";

/**
 * Story-only host: runs an in-memory JMAP server, connects a {@link JmapEventsAdapter}
 * to it, and provides the adapter as the events-api context for descendant views.
 * Demonstrates the headless "bring your own store" path backed by a JMAP backend.
 */
@customElement("story-jmap-adapter-host")
export class StoryJmapAdapterHost extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: 100%;
      height: 100%;
    }
    .toolbar {
      display: flex;
      gap: 8px;
      align-items: center;
      flex: none;
      font: 13px system-ui, sans-serif;
    }
    .toolbar button {
      padding: 4px 10px;
    }
    .viewport {
      flex: 1;
      min-height: 0;
    }
  `;

  #provider = new ContextProvider(this, { context: eventsAPIContext });
  #server = new MockJmapServer();
  #adapter: JmapEventsAdapter;
  #remoteCounter = 0;

  @state()
  private status = "connecting…";

  constructor() {
    super();
    this.#server.seedCalendar(mockWorkCalendar);
    this.#server.seedCalendar(mockPersonalCalendar);
    this.#server.seedEvent(mockTimedEvent);
    this.#server.seedEvent(mockAllDayEvent);
    this.#server.seedEvent(mockRecurringEvent);

    const client = new JmapClient({
      sessionUrl: this.#server.sessionUrl,
      fetch: this.#server.fetch,
    });
    this.#adapter = new JmapEventsAdapter({
      client,
      onChange: () => this.#publish(),
      onSyncError: (error) => {
        this.status = `sync error: ${String(error)}`;
      },
    });
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#provider.setValue(this.#adapter, true);
    void this.#adapter
      .initialize({
        utcStart: new Date("2026-01-01T00:00:00Z"),
        utcEnd: new Date("2027-01-01T00:00:00Z"),
      })
      .then(() => {
        this.status = `connected — ${this.#adapter.getEvents().size} rows from mock JMAP server`;
      })
      .catch((error) => {
        this.status = `failed: ${String(error)}`;
      });
  }

  #publish(): void {
    this.#provider.setValue(this.#adapter, true);
    // Views render from their `events` property (the context only carries the mutation
    // API), so mirror the adapter state onto slotted views on every change.
    const events = new Map(this.#adapter.getEvents());
    for (const view of this.querySelectorAll("calendar-view-group")) {
      (view as HTMLElement & { events: unknown }).events = events;
    }
    this.requestUpdate();
  }

  async #simulateRemoteChange(): Promise<void> {
    this.#remoteCounter += 1;
    this.#server.remoteUpdateEvent(mockTimedEvent.id, {
      title: `Design review (remote edit #${this.#remoteCounter})`,
    });
    await this.#adapter.sync();
    this.status = `synced remote edit #${this.#remoteCounter}`;
  }

  override render() {
    return html`
      <div class="toolbar">
        <button type="button" @click=${() => void this.#simulateRemoteChange()}>
          Simulate remote change + sync
        </button>
        <span>${this.status}</span>
      </div>
      <div class="viewport"><slot @slotchange=${() => this.#publish()}></slot></div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "story-jmap-adapter-host": StoryJmapAdapterHost;
  }
}
