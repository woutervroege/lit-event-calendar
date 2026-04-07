import type { Meta, StoryObj } from "@storybook/web-components-vite";
import "../src/CalendarAgendaView/CalendarAgendaView.js";
import { calendarCssProps } from "./support/CalendarCssProps.js";
import {
  localeOptions,
  type CalendarEvent,
  sampleEvents,
  timezoneOptions,
} from "./support/StoryData.js";

type StoryCalendarAgendaViewElement = HTMLElement & { events: Map<string, CalendarEvent> };

const meta: Meta = {
  title: "CalendarView/CalendarAgendaView",
  component: "calendar-agenda-view",
  tags: ["autodocs"],
  parameters: {
    cssprops: calendarCssProps,
  },
  argTypes: {
    startDate: { control: "text", description: "Range start date (YYYY-MM-DD)" },
    daysPerWeek: { control: { type: "number", min: 1, max: 366, step: 1 } },
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
    startDate: "2025-01-01",
    daysPerWeek: 31,
    timezone: "Europe/Amsterdam",
    currentTime: "2025-01-15T14:30:00",
    events: sampleEvents,
  },
  render: (args) => {
    const el = document.createElement("calendar-agenda-view") as StoryCalendarAgendaViewElement;
    el.style.display = "block";
    el.style.width = "100%";
    el.style.height = "100%";
    el.setAttribute("start-date", String(args.startDate));
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
    const entries = Array.isArray(args.events) ? args.events : sampleEvents;
    el.events = new Map(entries);
    return el;
  },
};

export default meta;

type Story = StoryObj;

export const Default: Story = {};
