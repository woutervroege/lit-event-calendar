import type { Meta, StoryObj } from "@storybook/web-components-vite";
import "../src/CalendarListView/CalendarListView.js";
import { calendarCssProps } from "./support/CalendarCssProps.js";
import {
  AUTO_LOCALE_OPTION,
  type CalendarEvent,
  langControlLabels,
  langControlOptions,
  sampleEvents,
  storyEventsFromArg,
  timezoneOptions,
} from "./support/StoryData.js";

type StoryCalendarAgendaViewElement = HTMLElement & { events: Map<string, CalendarEvent> };

const meta: Meta = {
  title: "Calendar/CalendarListView",
  component: "calendar-list-view",
  tags: ["autodocs"],
  parameters: {
    cssprops: calendarCssProps,
  },
  argTypes: {
    startDate: { control: "text", description: "Range start date (YYYY-MM-DD)" },
    daysPerWeek: { control: { type: "number", min: 1, max: 366, step: 1 } },
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
    startDate: "2025-01-01",
    daysPerWeek: 31,
    lang: AUTO_LOCALE_OPTION,
    timezone: "Europe/Amsterdam",
    currentTime: "2025-01-15T14:30:00",
    events: sampleEvents,
  },
  render: (args) => {
    const el = document.createElement("calendar-list-view") as StoryCalendarAgendaViewElement;
    el.style.display = "block";
    el.style.width = "100%";
    el.style.height = "100%";
    el.setAttribute("start-date", String(args.startDate));
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
    el.events = storyEventsFromArg(args.events, sampleEvents);
    return el;
  },
};

export default meta;

type Story = StoryObj;

export const Default: Story = {};
