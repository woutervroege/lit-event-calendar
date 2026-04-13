import type { CalendarsMap } from "@lit-calendar/events-api";
import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { action } from "storybook/actions";
import "../src/EventCalendar/EventCalendar.js";
import type { CalendarEventPendingGroups } from "../src/types/calendarEventPending.js";
import { calendarCssProps } from "./support/CalendarCssProps.js";
import {
  AUTO_LOCALE_OPTION,
  AUTO_WEEK_START_OPTION,
  type CalendarEvent,
  langControlLabels,
  langControlOptions,
  sampleCalendarsMap,
  sampleEvents,
  storyEventsFromArg,
  timezoneOptions,
  weekStartControlLabels,
  weekStartControlOptions,
} from "./support/StoryData.js";
import {
  attachRequestEventHandlers,
  attachUnsyncedRequestEventHandlers,
} from "./support/StoryRequestHandlers.js";

type StoryEventCalendarElement = HTMLElement & {
  events: Map<string, CalendarEvent>;
  calendars?: CalendarsMap;
  getPendingEvents: (options?: {
    groupBy?: "pendingOp" | "calendarId";
  }) => CalendarEventPendingGroups;
};

type RequestHandlingMode = "sync" | "unsynced";

const VISIBLE_HOUR_OPTIONS = ["auto", ...Array.from({ length: 24 }, (_, index) => index + 1)];
const logPendingEvents = action("pending-events");

function summarizePendingGroups(pendingGroups: CalendarEventPendingGroups) {
  const summarize = (entries: Map<string, CalendarEvent> | undefined) =>
    Array.from(entries?.entries() ?? []).map(([key, event]) => ({
      key,
      eventId: event.eventId,
      summary: event.data.summary,
      pendingOp: event.pendingOp,
    }));

  return {
    created: summarize(pendingGroups.get("created")),
    updated: summarize(pendingGroups.get("updated")),
    deleted: summarize(pendingGroups.get("deleted")),
  };
}

function reportPendingEvents(el: StoryEventCalendarElement, reason: string) {
  logPendingEvents({
    reason,
    pendingEvents: summarizePendingGroups(el.getPendingEvents({ groupBy: "pendingOp" })),
  });
}

function renderCalendar(
  args: Record<string, unknown> & { calendars?: CalendarsMap },
  mode: RequestHandlingMode = "sync"
) {
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
  if (
    args.visibleHours === "auto" ||
    args.visibleHours === undefined ||
    args.visibleHours === null
  ) {
    el.removeAttribute("visible-hours");
  } else {
    el.setAttribute("visible-hours", String(args.visibleHours));
  }
  if (args.defaultEventSummary) {
    el.setAttribute("default-event-summary", String(args.defaultEventSummary));
  }
  if (args.selectedCalendarId) {
    el.setAttribute("selected-calendar-id", String(args.selectedCalendarId));
  } else {
    el.removeAttribute("selected-calendar-id");
  }

  el.events = storyEventsFromArg(args.events, sampleEvents);

  el.calendars = args.calendars !== undefined ? args.calendars : sampleCalendarsMap;

  if (mode === "unsynced") {
    attachUnsyncedRequestEventHandlers(el, {
      onPendingChanged: () => reportPendingEvents(el, "changed"),
    });
    reportPendingEvents(el, "initial");
  } else {
    attachRequestEventHandlers(el);
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
    selectedCalendarId: { control: "text", description: "Selected calendar for new events" },
    calendars: {
      control: false,
      description:
        "Calendars sidebar data (`CalendarsMap`). Default: sampleCalendarsMap. Pass `new Map()` in a story render to hide it.",
    },
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
    selectedCalendarId: "",
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

export const Month: Story = {
  args: {
    presentation: "grid",
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
          "Does not auto-commit create/update/delete operations. Inspect pending changes in the console with `document.querySelector('event-calendar')?.getPendingEvents({ groupBy: 'pendingOp' })`.",
      },
    },
  },
  render: (args) => renderCalendar(args, "unsynced"),
};

export const WithoutCalendarsSidebar: Story = {
  name: "Without calendars sidebar",
  render: (args) => renderCalendar({ ...args, calendars: new Map() }),
};
