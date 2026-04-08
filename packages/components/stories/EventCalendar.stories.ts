import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { action } from "storybook/actions";
import "../src/EventCalendar/EventCalendar.js";
import { calendarCssProps } from "./support/CalendarCssProps.js";
import {
  AUTO_LOCALE_OPTION,
  AUTO_WEEK_START_OPTION,
  type CalendarEvent,
  langControlLabels,
  langControlOptions,
  sampleEvents,
  timezoneOptions,
  weekStartControlLabels,
  weekStartControlOptions,
} from "./support/StoryData.js";
import { attachRequestEventHandlers } from "./support/StoryRequestHandlers.js";
import type {
  EventCreateRequestDetail,
  EventDeleteRequestDetail,
  EventUpdateRequestDetail,
} from "../src/types/CalendarEventRequests.js";
import type { CalendarEventPendingGroups } from "../src/types/CalendarEvent.js";

type StoryEventCalendarElement = HTMLElement & {
  events: Map<string, CalendarEvent>;
  getPendingEvents: (options?: { groupBy?: "pendingOp" | "calendarId" }) => unknown;
};

type RequestHandlingMode = "sync" | "unsynced";

const VISIBLE_HOUR_OPTIONS = ["auto", ...Array.from({ length: 24 }, (_, index) => index + 1)];
const logPendingEvents = action("pending-events");

function resolveEventMapKey(
  events: Map<string, CalendarEvent>,
  envelope: { eventId?: string; calendarId?: string; recurrenceId?: string }
): string | undefined {
  const eventId = envelope.eventId;
  if (!eventId) return undefined;
  if (events.has(eventId)) return eventId;
  for (const [key, event] of events.entries()) {
    if (event.eventId !== eventId) continue;
    if (envelope.calendarId !== undefined && event.calendarId !== envelope.calendarId) continue;
    if (envelope.recurrenceId !== undefined && event.recurrenceId !== envelope.recurrenceId) continue;
    return key;
  }
  return undefined;
}

function summarizePendingGroups(pendingEvents: CalendarEventPendingGroups) {
  const summarize = (entries: Map<string, CalendarEvent> | undefined) =>
    Array.from(entries?.entries() ?? []).map(([id, event]) => ({
      id,
      eventId: event.eventId,
      summary: event.summary,
      pendingOp: event.pendingOp,
    }));
  return {
    created: summarize(pendingEvents.get("created")),
    updated: summarize(pendingEvents.get("updated")),
    deleted: summarize(pendingEvents.get("deleted")),
  };
}

function reportPendingEvents(el: StoryEventCalendarElement, reason: string) {
  const pendingEvents = el.getPendingEvents({ groupBy: "pendingOp" }) as CalendarEventPendingGroups;
  logPendingEvents({
    reason,
    pendingEvents: summarizePendingGroups(pendingEvents),
  });
}

function attachUnsyncedRequestEventHandlers(el: StoryEventCalendarElement) {
  el.addEventListener("event-create-requested", (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const detail = event.detail as EventCreateRequestDetail | null;
    if (!detail?.content.start || !detail.content.end) return;

    const id = `pending-created-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const nextEvents = new Map(el.events);
    nextEvents.set(id, {
      eventId: id,
      calendarId: detail.envelope.calendarId,
      start: detail.content.start,
      end: detail.content.end,
      summary: detail.content.summary ?? "New event",
      color: detail.content.color ?? "#0ea5e9",
      pendingOp: "created",
    });
    el.events = nextEvents;
    reportPendingEvents(el, "create");
  });

  el.addEventListener("event-update-requested", (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const detail = event.detail as EventUpdateRequestDetail | null;
    if (!detail?.envelope.eventId) return;

    const eventKey = resolveEventMapKey(el.events, detail.envelope);
    if (!eventKey) return;
    const current = el.events.get(eventKey);
    if (!current) return;

    const nextEvents = new Map(el.events);
    nextEvents.set(eventKey, {
      ...current,
      start: detail.content.start ?? current.start,
      end: detail.content.end ?? current.end,
      summary: detail.content.summary ?? current.summary,
      color: detail.content.color ?? current.color,
      // Keep creates as creates; persisted events become pending updates.
      pendingOp: current.pendingOp === "created" ? "created" : "updated",
    });
    el.events = nextEvents;
    reportPendingEvents(el, "update");
  });

  el.addEventListener("event-delete-requested", (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const detail = event.detail as EventDeleteRequestDetail | null;
    if (!detail) return;

    const eventKey = resolveEventMapKey(el.events, detail.envelope);
    if (!eventKey) return;
    const current = el.events.get(eventKey);
    if (!current) return;

    const nextEvents = new Map(el.events);
    nextEvents.set(eventKey, {
      ...current,
      pendingOp: "deleted",
    });
    el.events = nextEvents;
    reportPendingEvents(el, "delete");
  });
}

function renderCalendar(args: Record<string, unknown>, mode: RequestHandlingMode = "sync") {
  const el = document.createElement("event-calendar") as StoryEventCalendarElement;
  el.style.display = "block";
  el.style.width = "100%";
  el.style.height = "100%";

  el.setAttribute("view", String(args.view ?? "month"));
  el.setAttribute("presentation", String(args.presentation ?? "grid"));
  if (args.startDate) {
    el.setAttribute("start-date", String(args.startDate));
  }
  if (typeof args.weekStart === "number") {
    el.setAttribute("week-start", String(args.weekStart));
  } else if (args.weekStart === AUTO_WEEK_START_OPTION) {
    el.removeAttribute("week-start");
  }
  el.setAttribute("days-per-week", String(args.daysPerWeek));
  if (args.lang && args.lang !== AUTO_LOCALE_OPTION) {
    el.setAttribute("lang", String(args.lang));
  } else {
    el.removeAttribute("lang");
  }
  if (args.timezone) {
    el.setAttribute("timezone", String(args.timezone));
  }
  if (args.currentTime) {
    el.setAttribute("current-time", String(args.currentTime));
  }
  el.setAttribute("snap-interval", String(args.snapInterval));
  if (args.visibleHours === "auto" || args.visibleHours === undefined || args.visibleHours === null) {
    el.removeAttribute("visible-hours");
  } else {
    el.setAttribute("visible-hours", String(args.visibleHours));
  }
  if (args.defaultEventSummary) {
    el.setAttribute("default-event-summary", String(args.defaultEventSummary));
  }
  if (args.defaultEventColor) {
    el.setAttribute("default-event-color", String(args.defaultEventColor));
  }
  if (args.defaultCalendarId) {
    el.setAttribute("default-source-id", String(args.defaultCalendarId));
  } else {
    el.removeAttribute("default-source-id");
  }

  const entries = Array.isArray(args.events) ? args.events : sampleEvents;
  el.events = new Map(entries as Array<[string, CalendarEvent]>);

  if (mode === "unsynced") {
    attachUnsyncedRequestEventHandlers(el);
    reportPendingEvents(el, "initial");
  } else {
    attachRequestEventHandlers(el, { preserveDateOnlyShape: true });
  }

  return el;
}

const meta: Meta = {
  title: "Calendar/EventCalendar",
  component: "event-calendar",
  tags: ["autodocs"],
  parameters: {
    cssprops: calendarCssProps,
  },
  argTypes: {
    view: {
      control: "inline-radio",
      options: ["day", "week", "month", "year"],
    },
    presentation: {
      control: "inline-radio",
      options: ["grid", "list"],
    },
    startDate: { control: "text", description: "Anchor date (YYYY-MM-DD)" },
    weekStart: {
      control: {
        type: "select",
        labels: weekStartControlLabels,
      },
      options: weekStartControlOptions,
    },
    daysPerWeek: { control: { type: "number", min: 1, max: 7, step: 1 } },
    lang: {
      control: { type: "select", labels: langControlLabels },
      options: langControlOptions,
      description: "Locale",
    },
    timezone: {
      control: "select",
      options: timezoneOptions,
      description: "IANA timezone",
    },
    currentTime: { control: "text", description: "Current time (ISO string)" },
    snapInterval: { control: { type: "number", min: 5, max: 60, step: 5 } },
    visibleHours: {
      control: { type: "select" },
      options: VISIBLE_HOUR_OPTIONS,
    },
    defaultEventSummary: { control: "text", description: "Default created event summary" },
    defaultEventColor: { control: "color", description: "Default created event color" },
    defaultCalendarId: { control: "text", description: "Default created event source id" },
  },
  args: {
    view: "month",
    presentation: "grid",
    startDate: "2025-01-15",
    weekStart: AUTO_WEEK_START_OPTION,
    daysPerWeek: 7,
    lang: AUTO_LOCALE_OPTION,
    timezone: "Europe/Amsterdam",
    currentTime: "2025-01-15T14:30:00",
    snapInterval: 15,
    visibleHours: 12,
    defaultEventSummary: "New event",
    defaultEventColor: "#0ea5e9",
    defaultCalendarId: "",
    events: sampleEvents,
  },
  render: (args) => renderCalendar(args),
};

export default meta;

type Story = StoryObj;

export const Default: Story = {};

export const Week: Story = {
  args: {
    view: "week",
  },
};

export const ThreeDayWeek: Story = {
  args: {
    view: "week",
    daysPerWeek: 3,
  },
};

export const Day: Story = {
  args: {
    view: "day",
  },
};

export const Year: Story = {
  args: {
    view: "year",
  },
};

export const MonthList: Story = {
  args: {
    presentation: "list",
  },
};

export const WeekList: Story = {
  args: {
    view: "week",
    presentation: "list",
  },
};

export const PendingEventsUnsynced: Story = {
  name: "Pending Events (Unsynced)",
  parameters: {
    docs: {
      description: {
        story:
          "No backend sync. Create/update/delete requests are stored as optimistic local changes so `pendingEvents` remains inspectable.",
      },
    },
  },
  render: (args) => renderCalendar(args, "unsynced"),
};
