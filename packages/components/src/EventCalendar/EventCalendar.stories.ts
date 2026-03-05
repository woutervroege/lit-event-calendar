import type { Meta, StoryObj } from "@storybook/web-components-vite";
import "./EventCalendar.js";

type StoryEvent = {
  /**
   * iCalendar UID. Repeating events share the same uid.
   */
  uid: string;
  /**
   * iCalendar RECURRENCE-ID for a specific occurrence in a recurring series.
   */
  recurrenceId?: string;
  start: string;
  end: string;
  summary: string;
  color: string;
};

type StoryEventEntry = [id: string, event: StoryEvent];

const sampleEvents: StoryEventEntry[] = [
  [
    "event-flight-london-20250104",
    {
      uid: "flight-london@example.test",
      start: "2025-01-04T08:30:00",
      end: "2025-01-05T09:45:00",
      summary: "Flight to London",
      color: "#4564B5",
    },
  ],
  [
    "event-hello-world-20250103",
    {
      uid: "hello-world@example.test",
      start: "2025-01-03T12:00:00",
      end: "2025-01-07T18:00:00",
      summary: "Hello World",
      color: "#63e657",
    },
  ],
  [
    "event-team-meeting-20250106",
    {
      uid: "team-meeting@example.test",
      start: "2025-01-06T10:00:00",
      end: "2025-01-07T11:15:00",
      summary: "Team Meeting",
      color: "#ff0000",
    },
  ],
  [
    "event-amsterdam-zoned-20250104",
    {
      uid: "amsterdam-zoned@example.test",
      start: "2025-01-04T12:00:00+01:00[Europe/Amsterdam]",
      end: "2025-01-06T13:30:00+01:00[Europe/Amsterdam]",
      summary: "Amsterdam Zoned Event",
      color: "#f59e0b",
    },
  ],
  [
    "event-fiesta-20250106",
    {
      uid: "fiesta@example.test",
      start: "2025-01-06T14:00:00",
      end: "2025-01-06T15:00:00",
      summary: "Fiesta",
      color: "#084cb8",
    },
  ],
  [
    "event-drinks-20250108-1630",
    {
      uid: "drinks-weekly@example.test",
      recurrenceId: "20250108T163000",
      start: "2025-01-08T16:30:00",
      end: "2025-01-08T17:30:00",
      summary: "Drinks",
      color: "#9f3cfa",
    },
  ],
  [
    "event-drinks-20250115-1630",
    {
      uid: "drinks-weekly@example.test",
      recurrenceId: "20250115T163000",
      start: "2025-01-15T16:30:00",
      end: "2025-01-15T17:30:00",
      summary: "Drinks",
      color: "#9f3cfa",
    },
  ],
  [
    "event-more-drinks-20250108",
    {
      uid: "more-drinks@example.test",
      start: "2025-01-08T19:00:00",
      end: "2025-01-09T00:30:00",
      summary: "More Drinks",
      color: "#084cb8",
    },
  ],
  [
    "event-even-more-drinks-20250108",
    {
      uid: "even-more-drinks@example.test",
      start: "2025-01-08T20:00:00",
      end: "2025-01-09T01:00:00",
      summary: "Even More Drinks",
      color: "#ff0000",
    },
  ],
  [
    "event-meeting-john-20250110",
    {
      uid: "meeting-with-john@example.test",
      start: "2025-01-10",
      end: "2025-01-11",
      summary: "Meeting with John",
      color: "#E05ADD",
    },
  ],
];

const timezoneShiftEvents: StoryEventEntry[] = [
  [
    "event-amsterdam-noon-zoned",
    {
      uid: "amsterdam-noon-zoned@example.test",
      start: "2025-01-06T12:00:00+01:00[Europe/Amsterdam]",
      end: "2025-01-06T13:30:00+01:00[Europe/Amsterdam]",
      summary: "Amsterdam Noon (zoned)",
      color: "#f59e0b",
    },
  ],
  [
    "event-local-baseline-0900",
    {
      uid: "local-baseline@example.test",
      start: "2025-01-06T09:00:00",
      end: "2025-01-06T10:00:00",
      summary: "Local baseline (plain)",
      color: "#4564B5",
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
  title: "EventCalendar/EventCalendar",
  component: "event-calendar",
  tags: ["autodocs"],
  argTypes: {
    startDate: { control: "text", description: "Start date (YYYY-MM-DD)" },
    days: { control: { type: "number", min: 1, max: 42 }, description: "Number of days" },
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
    variant: { control: "select", options: ["timed", "all-day"] },
    dayNumbersHidden: { control: "boolean", description: "Hide day number labels" },
    snapInterval: { control: { type: "number", min: 5, max: 60, step: 5 } },
  },
  args: {
    startDate: "2025-01-05",
    days: 7,
    variant: "timed",
    timezone: "Europe/Amsterdam",
    dayNumbersHidden: false,
    snapInterval: 30,
    events: sampleEvents,
  },
  render: (args) => {
    const el = document.createElement("event-calendar");
    el.setAttribute("start-date", args.startDate);
    el.setAttribute("days", String(args.days));
    el.setAttribute("variant", args.variant);
    el.setAttribute("snap-interval", String(args.snapInterval));
    if (args.currentTime) {
      el.setAttribute("current-time", args.currentTime);
    }
    el.toggleAttribute("day-numbers-hidden", Boolean(args.dayNumbersHidden));
    if (args.locale) {
      el.setAttribute("locale", args.locale);
    }
    if (args.timezone) {
      el.setAttribute("timezone", args.timezone);
    }
    el.setAttribute("style", "--event-height: 32px; --days-per-row: 7");
    const entries = Array.isArray(args.events) ? args.events : sampleEvents;
    (el as unknown as { events: Map<string, StoryEvent> }).events = new Map(entries);
    return el;
  },
};

export default meta;

type Story = StoryObj;

export const Month: Story = {
  args: {
    startDate: "2025-01-05",
    days: 42,
    locale: "en-US",
    snapInterval: 5,
    variant: "all-day",
    events: sampleEvents,
    currentTime: "2025-01-09T14:30:00"
  },
};

export const AllDay: Story = {
  args: { ...Month.args, ...{ variant: "all-day", days: 5 } },
};

export const Day: Story = {
  args: {
    ...Month.args,
    ...{ variant: "timed", days: 1, startDate: "2025-01-06" },
    locale: "nl-NL",
  },
};

export const Week: Story = {
  args: { ...Day.args, ...{ days: 7 } },
};

export const TimezoneShiftAmsterdam: Story = {
  args: {
    ...Day.args,
    days: 1,
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
