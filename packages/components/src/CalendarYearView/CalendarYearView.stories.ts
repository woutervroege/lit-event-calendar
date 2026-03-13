import type { Meta, StoryObj } from "@storybook/web-components-vite";
import "./CalendarYearView.js";
import { localeOptions, type StoryEvent, sampleEvents, timezoneOptions } from "../storyData.js";
import { calendarCssProps } from "../calendarCssProps.js";

type StoryCalendarYearViewElement = HTMLElement & { events: Map<string, StoryEvent> };

const meta: Meta = {
  title: "CalendarView/CalendarYearView",
  component: "calendar-year-view",
  tags: ["autodocs"],
  parameters: {
    cssprops: calendarCssProps,
  },
  argTypes: {
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
    year: 2025,
    timezone: "Europe/Amsterdam",
    currentTime: "2025-01-15T14:30:00",
    events: sampleEvents,
  },
  render: (args) => {
    const el = document.createElement("calendar-year-view") as StoryCalendarYearViewElement;
    el.style.display = "block";
    el.style.width = "100%";
    el.style.height = "100%";
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
    return el;
  },
};

export default meta;

type Story = StoryObj;

export const Default: Story = {};
