import type { Meta, StoryObj } from "@storybook/web-components-vite";
import "../src/CalendarView/CalendarView.js";
import { calendarCssProps } from "./support/CalendarCssProps.js";
import {
  AUTO_LOCALE_OPTION,
  type CalendarEvent,
  langControlLabels,
  langControlOptions,
  sampleEvents,
  timezoneOptions,
  timezoneShiftEvents,
} from "./support/StoryData.js";
import { attachRequestEventHandlers } from "./support/StoryRequestHandlers.js";

type StoryCalendarViewElement = HTMLElement & { events: Map<string, CalendarEvent> };
const VISIBLE_HOUR_OPTIONS = ["auto", ...Array.from({ length: 24 }, (_, index) => index + 1)];

const meta: Meta = {
  title: "CalendarView/CalendarView",
  component: "calendar-view",
  tags: ["autodocs"],
  parameters: {
    cssprops: calendarCssProps,
  },
  argTypes: {
    startDate: { control: "text", description: "Start date (YYYY-MM-DD)" },
    daysPerWeek: {
      control: { type: "number", min: 1, max: 42 },
      description: "Visible day columns",
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
    variant: { control: "select", options: ["timed", "all-day"] },
    labelsHidden: { control: "boolean", description: "Hide day number labels" },
    snapInterval: { control: { type: "number", min: 5, max: 60, step: 5 } },
    visibleHours: {
      control: { type: "select" },
      options: VISIBLE_HOUR_OPTIONS,
    },
    defaultEventSummary: { control: "text", description: "Default created event summary" },
    defaultEventColor: { control: "color", description: "Default created event color" },
    defaultCalendarId: { control: "text", description: "Default created event source id" },
  },
  args: {
    startDate: "2025-01-05",
    daysPerWeek: 7,
    lang: AUTO_LOCALE_OPTION,
    variant: "timed",
    timezone: "Europe/Amsterdam",
    labelsHidden: false,
    snapInterval: 30,
    visibleHours: 24,
    defaultEventSummary: "New event",
    defaultEventColor: "#0ea5e9",
    defaultCalendarId: "",
    events: sampleEvents,
  },
  render: (args) => {
    const el = document.createElement("calendar-view") as StoryCalendarViewElement;
    el.setAttribute("start-date", args.startDate);
    el.setAttribute("days-per-week", String(args.daysPerWeek));
    el.setAttribute("variant", args.variant);
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
    if (args.currentTime) {
      el.setAttribute("current-time", args.currentTime);
    }
    el.toggleAttribute("labels-hidden", Boolean(args.labelsHidden));
    if (args.lang && args.lang !== AUTO_LOCALE_OPTION) {
      el.setAttribute("lang", args.lang);
    } else {
      el.removeAttribute("lang");
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
    if (args.defaultCalendarId) {
      el.setAttribute("default-source-id", String(args.defaultCalendarId));
    } else {
      el.removeAttribute("default-source-id");
    }
    const entries = Array.isArray(args.events) ? args.events : sampleEvents;
    el.events = new Map(entries);
    attachRequestEventHandlers(el);
    return el;
  },
};

export default meta;

type Story = StoryObj;

export const Month: Story = {
  args: {
    startDate: "2025-01-05",
    daysPerWeek: 42,
    snapInterval: 5,
    variant: "all-day",
    events: sampleEvents,
    currentTime: "2025-01-09T14:30:00",
  },
};

export const AllDay: Story = {
  args: { ...Month.args, ...{ variant: "all-day", daysPerWeek: 5 } },
};

export const Day: Story = {
  args: {
    ...Month.args,
    ...{ variant: "timed", daysPerWeek: 1, startDate: "2025-01-06" },
  },
};

export const Week: Story = {
  args: { ...Day.args, ...{ daysPerWeek: 7 } },
};

export const TimezoneShiftAmsterdam: Story = {
  args: {
    ...Day.args,
    daysPerWeek: 1,
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
