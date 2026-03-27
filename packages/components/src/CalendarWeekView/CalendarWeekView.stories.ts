import type { Meta, StoryObj } from "@storybook/web-components-vite";
import "./CalendarWeekView.js";
import { calendarCssProps } from "../calendarCssProps.js";
import {
  type CalendarTemporalEvent,
  localeOptions,
  timezoneOptions,
  weekSplitEvents,
} from "../storyData.js";

type StoryCalendarWeekViewElement = HTMLElement & { events: Map<string, CalendarTemporalEvent> };

const meta: Meta = {
  title: "CalendarView/CalendarWeekView",
  component: "calendar-week-view",
  tags: ["autodocs"],
  parameters: {
    cssprops: calendarCssProps,
  },
  argTypes: {
    weekNumber: { control: { type: "number", min: 1, max: 53 } },
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
  },
  args: {
    weekNumber: 2,
    year: 2025,
    daysPerWeek: 7,
    timezone: "Europe/Amsterdam",
    currentTime: "2025-01-07T13:00:00",
    snapInterval: 15,
    visibleHours: 12,
    events: weekSplitEvents,
  },
  render: (args) => {
    const el = document.createElement("calendar-week-view") as StoryCalendarWeekViewElement;
    el.style.display = "block";
    el.style.width = "100%";
    el.style.height = "100%";
    el.setAttribute("week-number", String(args.weekNumber));
    el.setAttribute("year", String(args.year));
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
    const entries = Array.isArray(args.events) ? args.events : weekSplitEvents;
    el.events = new Map(entries);
    return el;
  },
};

export default meta;

type Story = StoryObj;

export const FullWeek: Story = {};

export const WorkWeek: Story = {
  args: {
    daysPerWeek: 5,
  },
};
