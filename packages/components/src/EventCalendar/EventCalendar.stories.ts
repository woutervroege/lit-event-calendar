import type { Meta, StoryObj } from "@storybook/web-components-vite";
import "./EventCalendar.js";
import { calendarCssProps } from "../calendarCssProps.js";
import { type CalendarEvent, localeOptions, sampleEvents, timezoneOptions } from "../storyData.js";
import { attachRequestEventHandlers } from "../storyRequestHandlers.js";

type StoryEventCalendarElement = HTMLElement & { events: Map<string, CalendarEvent> };

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
    presentation: {
      control: "inline-radio",
      options: ["grid", "list"],
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
    defaultCalendarId: { control: "text", description: "Default created event source id" },
  },
  args: {
    view: "month",
    presentation: "grid",
    startDate: "2025-01-15",
    daysPerWeek: 7,
    timezone: "Europe/Amsterdam",
    currentTime: "2025-01-15T14:30:00",
    snapInterval: 15,
    visibleHours: 12,
    defaultEventSummary: "New event",
    defaultEventColor: "#0ea5e9",
    defaultCalendarId: "",
    events: sampleEvents,
  },
  render: (args) => {
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
    if (args.defaultCalendarId) {
      el.setAttribute("default-source-id", String(args.defaultCalendarId));
    } else {
      el.removeAttribute("default-source-id");
    }

    const entries = Array.isArray(args.events) ? args.events : sampleEvents;
    el.events = new Map(entries);
    attachRequestEventHandlers(el, { preserveDateOnlyShape: true });

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
