import type { Meta, StoryObj } from "@storybook/web-components-vite";
import "../src/CalendarMonthView/CalendarMonthView.js";
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

type StoryCalendarMonthViewElement = HTMLElement & { events: Map<string, CalendarEvent> };

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
        labels: weekStartControlLabels,
      },
      options: weekStartControlOptions,
    },
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
  },
  args: {
    month: 1,
    year: 2025,
    weekStart: AUTO_WEEK_START_OPTION,
    lang: AUTO_LOCALE_OPTION,
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
    } else if (args.weekStart === AUTO_WEEK_START_OPTION) {
      el.removeAttribute("week-start");
    }
    if (args.lang && args.lang !== AUTO_LOCALE_OPTION) {
      el.setAttribute("lang", args.lang);
    } else {
      el.removeAttribute("lang");
    }
    if (args.timezone) {
      el.setAttribute("timezone", args.timezone);
    }
    if (args.currentTime) {
      el.setAttribute("current-time", args.currentTime);
    }
    const entries = Array.isArray(args.events) ? args.events : sampleEvents;
    el.events = new Map(entries);
    attachRequestEventHandlers(el);
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
