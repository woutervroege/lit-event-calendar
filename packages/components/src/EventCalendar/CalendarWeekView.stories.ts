import { Temporal } from "@js-temporal/polyfill";
import type { Meta, StoryObj } from "@storybook/web-components-vite";
import "./CalendarWeekView.js";

type StoryEvent = {
  uid: string;
  recurrenceId?: string;
  start: string | Temporal.PlainDate | Temporal.PlainDateTime | Temporal.ZonedDateTime;
  end: string | Temporal.PlainDate | Temporal.PlainDateTime | Temporal.ZonedDateTime;
  summary: string;
  color: string;
};

type StoryEventEntry = [id: string, event: StoryEvent];
type StoryCalendarWeekViewElement = HTMLElement & { events: Map<string, StoryEvent> };

const sampleEvents: StoryEventEntry[] = [
  [
    "event-all-day-offsite",
    {
      uid: "offsite@example.test",
      start: Temporal.PlainDate.from("2025-01-06"),
      end: Temporal.PlainDate.from("2025-01-08"),
      summary: "Offsite",
      color: "#4564B5",
    },
  ],
  [
    "event-all-day-workshop",
    {
      uid: "workshop@example.test",
      start: Temporal.PlainDate.from("2025-01-09"),
      end: Temporal.PlainDate.from("2025-01-10"),
      summary: "Workshop",
      color: "#63e657",
    },
  ],
  [
    "event-timed-plain",
    {
      uid: "timed-plain@example.test",
      start: Temporal.PlainDateTime.from("2025-01-07T10:00:00"),
      end: Temporal.PlainDateTime.from("2025-01-07T11:30:00"),
      summary: "Design Review",
      color: "#ff0000",
    },
  ],
  [
    "event-timed-zoned",
    {
      uid: "timed-zoned@example.test",
      start: Temporal.ZonedDateTime.from("2025-01-08T14:00:00+01:00[Europe/Amsterdam]"),
      end: Temporal.ZonedDateTime.from("2025-01-08T15:00:00+01:00[Europe/Amsterdam]"),
      summary: "Amsterdam Call",
      color: "#9f3cfa",
    },
  ],
];

const timezoneOptions =
  typeof Intl.supportedValuesOf === "function"
    ? Intl.supportedValuesOf("timeZone")
    : ["UTC", "Europe/Amsterdam", "America/New_York", "Asia/Tokyo"];

const localeOptions = [
  "en-US",
  "en-GB",
  "nl-NL",
  "de-DE",
  "fr-FR",
  "es-ES",
  "it-IT",
  "pt-BR",
  "ja-JP",
  "zh-CN",
  "ar",
  "he",
];

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
  },
  args: {
    weekNumber: 2,
    year: 2025,
    weekStart: "monday",
    daysPerWeek: 7,
    locale: "en-US",
    timezone: "Europe/Amsterdam",
    currentTime: "2025-01-07T13:00:00",
    events: sampleEvents,
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
    const entries = Array.isArray(args.events) ? args.events : sampleEvents;
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
