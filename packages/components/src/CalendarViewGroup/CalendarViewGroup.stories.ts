import type { Meta, StoryObj } from "@storybook/web-components-vite";
import "./CalendarViewGroup.js";
import { calendarCssProps } from "../calendarCssProps.js";
import {
  localeOptions,
  type CalendarEvent,
  sampleEvents,
  timezoneOptions,
} from "../storyData.js";
import { attachRequestEventHandlers } from "../storyRequestHandlers.js";

type StoryCalendarViewGroupElement = HTMLElement & { events: Map<string, CalendarEvent> };
const VISIBLE_HOUR_OPTIONS = ["auto", ...Array.from({ length: 24 }, (_, index) => index + 1)];

const meta: Meta = {
  title: "CalendarView/CalendarViewGroup",
  component: "calendar-view-group",
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
    visibleHours: { control: { type: "select" }, options: VISIBLE_HOUR_OPTIONS },
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
    events: sampleEvents,
  },
  render: (args) => {
    const el = document.createElement("calendar-view-group") as StoryCalendarViewGroupElement;
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
    if (args.visibleHours === "auto" || args.visibleHours === undefined || args.visibleHours === null) {
      el.removeAttribute("visible-hours");
    } else {
      el.setAttribute("visible-hours", String(args.visibleHours));
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
