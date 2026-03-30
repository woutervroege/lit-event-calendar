import type { Meta, StoryObj } from "@storybook/web-components-vite";
import "./CalendarView.js";
import {
  type CalendarEvent,
  localeOptions,
  sampleEvents,
  toTemporalDateLike,
  timezoneOptions,
  timezoneShiftEvents,
} from "../storyData.js";
import { calendarCssProps } from "../calendarCssProps.js";

type StoryCalendarViewElement = HTMLElement & { events: Map<string, CalendarEvent> };
type EventCreateRequestDetail = {
  start?: string;
  end?: string;
  summary?: string;
  color?: string;
  sourceId?: string;
  trigger?: string;
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

const meta: Meta = {
  title: "CalendarView/CalendarView",
  component: "calendar-view",
  tags: ["autodocs"],
  parameters: {
    cssprops: calendarCssProps,
  },
  argTypes: {
    startDate: { control: "text", description: "Start date (YYYY-MM-DD)" },
    days: { control: { type: "number", min: 1, max: 42 }, description: "Number of days" },
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
    variant: { control: "select", options: ["timed", "all-day"] },
    labelsHidden: { control: "boolean", description: "Hide day number labels" },
    snapInterval: { control: { type: "number", min: 5, max: 60, step: 5 } },
    visibleHours: { control: { type: "number", min: 1, max: 24, step: 1 } },
    defaultEventSummary: { control: "text", description: "Default created event summary" },
    defaultEventColor: { control: "color", description: "Default created event color" },
    defaultSourceId: { control: "text", description: "Default created event source id" },
  },
  args: {
    startDate: "2025-01-05",
    days: 7,
    variant: "timed",
    timezone: "Europe/Amsterdam",
    labelsHidden: false,
    snapInterval: 30,
    visibleHours: 24,
    defaultEventSummary: "New event",
    defaultEventColor: "#0ea5e9",
    defaultSourceId: "",
    events: sampleEvents,
  },
  render: (args) => {
    const el = document.createElement("calendar-view") as StoryCalendarViewElement;
    el.setAttribute("start-date", args.startDate);
    el.setAttribute("days", String(args.days));
    el.setAttribute("variant", args.variant);
    el.setAttribute("snap-interval", String(args.snapInterval));
    el.setAttribute("visible-hours", String(args.visibleHours));
    if (args.currentTime) {
      el.setAttribute("current-time", args.currentTime);
    }
    el.toggleAttribute("labels-hidden", Boolean(args.labelsHidden));
    if (args.locale) {
      el.setAttribute("locale", args.locale);
    }
    if (args.timezone) {
      el.setAttribute("timezone", args.timezone);
    }
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
      const optimisticEvents = new Map(el.events);
      optimisticEvents.set(eventId, {
        eventId,
        start: toTemporalDateLike(detail.start),
        end: toTemporalDateLike(detail.end),
        summary: detail.summary ?? "New event",
        color: detail.color ?? "#0ea5e9",
        sourceId: detail.sourceId,
        isOptimistic: true,
      });
      el.events = optimisticEvents;

      const committedSummary = window.prompt("Event title", detail.summary ?? "New event");
      if (committedSummary === null) {
        event.preventDefault();
        const rolledBackEvents = new Map(el.events);
        rolledBackEvents.delete(eventId);
        el.events = rolledBackEvents;
        return;
      }

      window.setTimeout(() => {
        const committedEvents = new Map(el.events);
        const created = committedEvents.get(eventId);
        if (!created) return;
        committedEvents.set(eventId, {
          ...created,
          summary: committedSummary,
          isOptimistic: false,
        });
        el.events = committedEvents;
      }, 300);

      console.info("event-create-requested", {
        eventId,
        start: detail.start,
        end: detail.end,
        trigger: detail.trigger ?? null,
      });
    });
    el.addEventListener("event-update-requested", (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const detail = event.detail as EventUpdateRequestDetail | null;
      if (!detail?.eventId) return;

      const current = el.events.get(detail.eventId);
      if (!current) return;

      el.events = new Map(el.events).set(detail.eventId, {
        ...current,
        start: detail.start ? toTemporalDateLike(detail.start) : current.start,
        end: detail.end ? toTemporalDateLike(detail.end) : current.end,
        summary: detail.summary ?? current.summary,
        color: detail.color ?? current.color,
      });

      console.info("event-update-requested", {
        eventId: detail.eventId,
        start: detail.start ?? null,
        end: detail.end ?? null,
      });
    });
    el.addEventListener("event-delete-requested", (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const detail = event.detail as EventDeleteRequestDetail | null;
      if (!detail?.eventId) return;
      if (!el.events.has(detail.eventId)) return;

      const nextEvents = new Map(el.events);

      const doDelete = confirm("Are you sure you want to delete this event?");
      if (!doDelete) {
        event.preventDefault();
        return;
      }
      nextEvents.delete(detail.eventId);
      el.events = nextEvents;

      console.info("event-delete-requested", { eventId: detail.eventId });
    });
    return el;
  },
};

export default meta;

type Story = StoryObj;

export const Month: Story = {
  args: {
    startDate: "2025-01-05",
    days: 42,
    snapInterval: 5,
    variant: "all-day",
    events: sampleEvents,
    currentTime: "2025-01-09T14:30:00",
  },
};

export const AllDay: Story = {
  args: { ...Month.args, ...{ variant: "all-day", days: 5 } },
};

export const Day: Story = {
  args: {
    ...Month.args,
    ...{ variant: "timed", days: 1, startDate: "2025-01-06" },
  },
};

export const Week: Story = {
  args: { ...Day.args, ...{ days: 7 } },
};

export const TimezoneShiftAmsterdam: Story = {
  args: {
    ...Day.args,
    days: 1,
    startDate: "2025-01-06",
    variant: "timed",
    timezone: "Europe/Amsterdam",
    events: timezoneShiftEvents,
  },
};

export const TimezoneShiftNewYork: Story = {
  args: {
    ...TimezoneShiftAmsterdam.args,
    timezone: "America/New_York",
  },
};
