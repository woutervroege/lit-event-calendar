import type { Meta, StoryObj } from "@storybook/web-components-vite";
import "./CalendarWeekView.js";
import {
  localeOptions,
  timezoneOptions,
  weekSplitEvents,
  type WeekStoryEvent,
} from "./storyData.js";

type StoryCalendarWeekViewElement = HTMLElement & { events: Map<string, WeekStoryEvent> };

const meta: Meta = {
  title: "CalendarView/CalendarWeekView",
  component: "calendar-week-view",
  tags: ["autodocs"],
  argTypes: {
    weekNumber: { control: { type: "number", min: 1, max: 53 } },
    year: { control: { type: "number", min: 1900, max: 2100 } },
    weekStart: { control: "select", options: ["monday", "sunday"] },
    daysPerWeek: { control: "select", options: [5, 7] },
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
    weekStart: "monday",
    daysPerWeek: 7,
    locale: "en-US",
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
    el.setAttribute("week-start", args.weekStart);
    el.setAttribute("days-per-week", String(args.daysPerWeek));
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
    daysPerWeek: 7,
    locale: "ar"
  },
};
