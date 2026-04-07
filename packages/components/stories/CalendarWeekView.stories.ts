import type { Meta, StoryObj } from "@storybook/web-components-vite";
import "../src/CalendarWeekView/CalendarWeekView.js";
import { calendarCssProps } from "./support/CalendarCssProps.js";
import {
  AUTO_LOCALE_OPTION,
  AUTO_WEEK_START_OPTION,
  type CalendarTemporalEvent,
  langControlLabels,
  langControlOptions,
  timezoneOptions,
  weekSplitEvents,
  weekStartControlLabels,
  weekStartControlOptions,
} from "./support/StoryData.js";
import { attachRequestEventHandlers } from "./support/StoryRequestHandlers.js";

type StoryCalendarWeekViewElement = HTMLElement & { events: Map<string, CalendarTemporalEvent> };
const VISIBLE_HOUR_OPTIONS = ["auto", ...Array.from({ length: 24 }, (_, index) => index + 1)];

const meta: Meta = {
  title: "CalendarGridView/CalendarWeekView",
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
  },
  args: {
    weekNumber: 2,
    year: 2025,
    weekStart: AUTO_WEEK_START_OPTION,
    daysPerWeek: 7,
    lang: AUTO_LOCALE_OPTION,
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
    } else if (args.weekStart === AUTO_WEEK_START_OPTION) {
      el.removeAttribute("week-start");
    }
    el.setAttribute("days-per-week", String(args.daysPerWeek));
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
    const entries = Array.isArray(args.events) ? args.events : weekSplitEvents;
    el.events = new Map(entries);
    attachRequestEventHandlers(el, { preserveDateOnlyShape: true });
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
