import type { Meta, StoryObj } from "@storybook/web-components-vite";
import "./CalendarMonthView.js";
import { calendarCssProps } from "../calendarCssProps.js";
import {
  localeOptions,
  type CalendarEvent,
  sampleEvents,
  toTemporalDateLike,
  timezoneOptions,
} from "../storyData.js";

type StoryCalendarMonthViewElement = HTMLElement & { events: Map<string, CalendarEvent> };
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
  title: "CalendarView/CalendarMonthView",
  component: "calendar-month-view",
  tags: ["autodocs"],
  parameters: {
    cssprops: calendarCssProps,
  },
  argTypes: {
    month: { control: { type: "number", min: 1, max: 12 } },
    year: { control: { type: "number", min: 1900, max: 2100 } },
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
  },
  args: {
    month: 1,
    year: 2025,
    timezone: "Europe/Amsterdam",
    currentTime: "2025-01-15T14:30:00",
    events: sampleEvents,
  },
  render: (args) => {
    const el = document.createElement("calendar-month-view") as StoryCalendarMonthViewElement;
    el.style.display = "block";
    el.style.width = "100%";
    el.style.height = "100%";
    el.setAttribute("month", String(args.month));
    el.setAttribute("year", String(args.year));
    if (typeof args.weekStart === "number") {
      el.setAttribute("week-start", String(args.weekStart));
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
    const entries = Array.isArray(args.events) ? args.events : sampleEvents;
    el.events = new Map(entries);
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
    });
    return el;
  },
};

export default meta;

type Story = StoryObj;

export const MondayWeekStart: Story = {};

export const SundayWeekStart: Story = {
  args: {
    weekStart: 7,
  },
};
