import type { Meta, StoryObj } from "@storybook/web-components-vite";
import "./CalendarAgendaView.js";
import { calendarCssProps } from "../calendarCssProps.js";
import {
  localeOptions,
  type CalendarEvent,
  sampleEvents,
  timezoneOptions,
} from "../storyData.js";

type StoryCalendarAgendaViewElement = HTMLElement & { events: Map<string, CalendarEvent> };

const meta: Meta = {
  title: "CalendarView/CalendarAgendaView",
  component: "calendar-agenda-view",
  tags: ["autodocs"],
  parameters: {
    cssprops: calendarCssProps,
  },
  argTypes: {
    month: { control: { type: "number", min: 1, max: 12 } },
    year: { control: { type: "number", min: 1900, max: 2100 } },
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
    const el = document.createElement("calendar-agenda-view") as StoryCalendarAgendaViewElement;
    el.style.display = "block";
    el.style.width = "100%";
    el.style.height = "100%";
    el.setAttribute("month", String(args.month));
    el.setAttribute("year", String(args.year));
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
