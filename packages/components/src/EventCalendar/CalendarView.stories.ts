import type { Meta, StoryObj } from "@storybook/web-components-vite";
import "./CalendarView.js";
import type { BaseEvent } from "../TimedEvent/BaseEvent.js";
import {
  localeOptions,
  sampleEvents,
  timezoneOptions,
  timezoneShiftEvents,
  type StoryEvent,
} from "./storyData.js";

type StoryCalendarViewElement = HTMLElement & { events: Map<string, StoryEvent> };

const calendarCssProps = {
  "lc-current-day-color": {
    value: "#ff0000",
    category: "Theme",
    description: "Accent for current-day label and current-time indicator.",
  },
  "lc-event-height": {
    value: "32px",
    category: "Layout",
    description: "Height for all-day event rows.",
  },
  "lc-days-per-row": {
    value: "7",
    control: "text",
    category: "Layout",
    description: "Column count for all-day/month grid layout.",
  },
  "lc-grid-base-color": {
    value: "light-dark(#111, #fff)",
    category: "Theme",
    description:
      "Base grid color; line/day-number/dropzone colors are derived internally with tints.",
  },
} as const;

const meta: Meta = {
  title: "CalendarView/CalendarView",
  component: "calendar-view",
  tags: ["autodocs"],
  parameters: {
    cssprops: calendarCssProps,
  },
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
    labelsHidden: { control: "boolean", description: "Hide day number labels" },
    snapInterval: { control: { type: "number", min: 5, max: 60, step: 5 } },
    visibleHours: { control: { type: "number", min: 1, max: 24, step: 1 } },
  },
  args: {
    startDate: "2025-01-05",
    days: 7,
    variant: "timed",
    timezone: "Europe/Amsterdam",
    labelsHidden: false,
    snapInterval: 30,
    visibleHours: 24,
    events: sampleEvents,
  },
  render: (args) => {
    const el = document.createElement("calendar-view") as StoryCalendarViewElement;
    el.setAttribute("start-date", args.startDate);
    el.setAttribute("days", String(args.days));
    el.setAttribute("variant", args.variant);
    el.setAttribute("snap-interval", String(args.snapInterval));
    el.setAttribute("visible-hours", String(args.visibleHours));
    if (args.currentTime) {
      el.setAttribute("current-time", args.currentTime);
    }
    el.toggleAttribute("labels-hidden", Boolean(args.labelsHidden));
    if (args.locale) {
      el.setAttribute("locale", args.locale);
    }
    if (args.timezone) {
      el.setAttribute("timezone", args.timezone);
    }
    const entries = Array.isArray(args.events) ? args.events : sampleEvents;
    el.events = new Map(entries);
    el.addEventListener("event-modified", (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const detail = event.detail as BaseEvent | null;
      if (!detail?.eventId) return;

      const current = el.events.get(detail.eventId);
      if (!current) return;

      el.events = new Map(el.events).set(detail.eventId, {
        ...current,
        start: detail.start?.toString() ?? current.start,
        end: detail.end?.toString() ?? current.end,
        summary: detail.summary,
        color: detail.color,
      });

      console.info("event-modified", {
        eventId: detail.eventId,
        start: detail.start?.toString() ?? null,
        end: detail.end?.toString() ?? null,
      });
    });
    el.addEventListener("event-deleted", (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const detail = event.detail as BaseEvent | null;
      if (!detail?.eventId) return;
      if (!el.events.has(detail.eventId)) return;

      const nextEvents = new Map(el.events);

      const doDelete = confirm("Are you sure you want to delete this event?");
      if (doDelete) {
        nextEvents.delete(detail.eventId);
      }
      el.events = nextEvents;

      console.info("event-deleted", { eventId: detail.eventId });
    });
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
    currentTime: "2025-01-09T14:30:00",
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
