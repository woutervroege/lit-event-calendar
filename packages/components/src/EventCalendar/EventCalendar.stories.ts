import { Temporal } from "@js-temporal/polyfill";
import type { Meta, StoryObj } from "@storybook/web-components-vite";
import "./EventCalendar.js";
import { calendarCssProps } from "../calendarCssProps.js";
import {
  localeOptions,
  type CalendarEvent,
  sampleEvents,
  toTemporalDateLike,
  timezoneOptions,
} from "../storyData.js";

type StoryEventCalendarElement = HTMLElement & { events: Map<string, CalendarEvent> };
type EventCreateRequestDetail = {
  start?: string;
  end?: string;
  summary?: string;
  color?: string;
  sourceId?: string;
};
type EventUpdateRequestDetail = {
  eventId?: string;
  start?: string;
  end?: string;
  summary?: string;
  color?: string;
};
type EventDeleteRequestDetail = {
  eventId?: string;
};

function preserveDateOnlyShape(
  nextValue: CalendarEvent["start"] | null | undefined,
  currentValue: CalendarEvent["start"]
): CalendarEvent["start"] {
  if (!nextValue) return currentValue;
  if (currentValue instanceof Temporal.PlainDate) {
    if ("toPlainDate" in nextValue) {
      return nextValue.toPlainDate();
    }
    return nextValue;
  }
  return nextValue;
}

const meta: Meta = {
  title: "CalendarView/EventCalendar",
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
    startDate: { control: "text", description: "Anchor date (YYYY-MM-DD)" },
    weekStart: {
      control: {
        type: "select",
        labels: {
          1: "Monday",
          2: "Tuesday",
          3: "Wednesday",
          4: "Thursday",
          5: "Friday",
          6: "Saturday",
          7: "Sunday",
        },
      },
      options: [1, 2, 3, 4, 5, 6, 7],
    },
    daysPerWeek: { control: { type: "number", min: 1, max: 7, step: 1 } },
    visibleDays: {
      control: {
        type: "select",
        labels: {
          auto: "auto (responsive)",
        },
      },
      options: ["auto", "1", "2", "3", "4", "5", "6", "7"],
      mapping: {
        auto: undefined,
        1: 1,
        2: 2,
        3: 3,
        4: 4,
        5: 5,
        6: 6,
        7: 7,
      },
    },
    locale: {
      control: "select",
      options: localeOptions,
      description: "Locale",
    },
    timezone: {
      control: "select",
      options: timezoneOptions,
      description: "IANA timezone",
    },
    currentTime: { control: "text", description: "Current time (ISO string)" },
    snapInterval: { control: { type: "number", min: 5, max: 60, step: 5 } },
    visibleHours: { control: { type: "number", min: 1, max: 24, step: 1 } },
    defaultEventSummary: { control: "text", description: "Default created event summary" },
    defaultEventColor: { control: "color", description: "Default created event color" },
    defaultSourceId: { control: "text", description: "Default created event source id" },
  },
  args: {
    view: "month",
    startDate: "2025-01-15",
    daysPerWeek: 7,
    timezone: "Europe/Amsterdam",
    currentTime: "2025-01-15T14:30:00",
    snapInterval: 15,
    visibleHours: 12,
    defaultEventSummary: "New event",
    defaultEventColor: "#0ea5e9",
    defaultSourceId: "",
    events: sampleEvents,
  },
  render: (args) => {
    const el = document.createElement("event-calendar") as StoryEventCalendarElement;
    el.style.display = "block";
    el.style.width = "100%";
    el.style.height = "100%";

    el.setAttribute("view", String(args.view ?? "month"));
    if (args.startDate) {
      el.setAttribute("start-date", String(args.startDate));
    }
    if (typeof args.weekStart === "number") {
      el.setAttribute("week-start", String(args.weekStart));
    }
    el.setAttribute("days-per-week", String(args.daysPerWeek));
    if (typeof args.visibleDays === "number") {
      el.setAttribute("visible-days", String(args.visibleDays));
    } else {
      el.removeAttribute("visible-days");
    }
    if (args.locale) {
      el.setAttribute("locale", args.locale);
    }
    if (args.timezone) {
      el.setAttribute("timezone", args.timezone);
    }
    if (args.currentTime) {
      el.setAttribute("current-time", args.currentTime);
    }
    el.setAttribute("snap-interval", String(args.snapInterval));
    el.setAttribute("visible-hours", String(args.visibleHours));
    if (args.defaultEventSummary) {
      el.setAttribute("default-event-summary", String(args.defaultEventSummary));
    }
    if (args.defaultEventColor) {
      el.setAttribute("default-event-color", String(args.defaultEventColor));
    }
    if (args.defaultSourceId) {
      el.setAttribute("default-source-id", String(args.defaultSourceId));
    } else {
      el.removeAttribute("default-source-id");
    }

    const entries = Array.isArray(args.events) ? args.events : sampleEvents;
    el.events = new Map(entries);

    el.addEventListener("event-create-requested", (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const detail = event.detail as EventCreateRequestDetail | null;
      if (!detail?.start || !detail.end) return;

      const eventId = `event-created-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const nextEvents = new Map(el.events);
      nextEvents.set(eventId, {
        eventId,
        start: toTemporalDateLike(detail.start),
        end: toTemporalDateLike(detail.end),
        summary: detail.summary ?? "New event",
        color: detail.color ?? "#0ea5e9",
        sourceId: detail.sourceId,
      });
      el.events = nextEvents;
    });

    el.addEventListener("event-update-requested", (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const detail = event.detail as EventUpdateRequestDetail | null;
      if (!detail?.eventId) return;

      const current = el.events.get(detail.eventId);
      if (!current) return;

      el.events = new Map(el.events).set(detail.eventId, {
        ...current,
        start: preserveDateOnlyShape(
          detail.start ? toTemporalDateLike(detail.start) : undefined,
          current.start
        ),
        end: preserveDateOnlyShape(detail.end ? toTemporalDateLike(detail.end) : undefined, current.end),
        summary: detail.summary ?? current.summary,
        color: detail.color ?? current.color,
      });
    });

    el.addEventListener("event-delete-requested", (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const detail = event.detail as EventDeleteRequestDetail | null;
      if (!detail?.eventId) return;
      if (!el.events.has(detail.eventId)) return;

      const nextEvents = new Map(el.events);
      const doDelete = confirm("Are you sure you want to delete this event?");
      if (doDelete) {
        nextEvents.delete(detail.eventId);
      }
      el.events = nextEvents;
    });

    return el;
  },
};

export default meta;

type Story = StoryObj;

export const Default: Story = {};

export const Week: Story = {
  args: {
    view: "week",
  },
};

export const WeekFixedVisibleDays: Story = {
  args: {
    view: "week",
    daysPerWeek: 7,
    visibleDays: 3,
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
