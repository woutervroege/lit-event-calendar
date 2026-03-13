import type { Meta, StoryObj } from "@storybook/web-components-vite";
import "./EventCalendar.js";
import type { BaseEvent } from "../TimedEvent/BaseEvent.js";
import { calendarCssProps } from "./calendarCssProps.js";
import { localeOptions, type StoryEvent, sampleEvents, timezoneOptions } from "./storyData.js";

type StoryEventCalendarElement = HTMLElement & { events: Map<string, StoryEvent> };

function preserveDateOnlyShape(
  nextValue: { toString(): string; toPlainDate(): { toString(): string } } | null | undefined,
  currentValue: string
): string {
  if (!nextValue) return currentValue;
  if (!currentValue.includes("T")) {
    return nextValue.toPlainDate().toString();
  }
  return nextValue.toString();
}

const meta: Meta = {
  title: "CalendarView/EventCalendar",
  component: "event-calendar",
  tags: ["autodocs"],
  parameters: {
    cssprops: calendarCssProps,
  },
  argTypes: {
    view: {
      control: "inline-radio",
      options: ["day", "week", "month", "year"],
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
    visibleHours: { control: { type: "number", min: 1, max: 24, step: 1 } },
  },
  args: {
    view: "month",
    startDate: "2025-01-15",
    daysPerWeek: 7,
    timezone: "Europe/Amsterdam",
    currentTime: "2025-01-15T14:30:00",
    snapInterval: 15,
    visibleHours: 12,
    events: sampleEvents,
  },
  render: (args) => {
    const el = document.createElement("event-calendar") as StoryEventCalendarElement;
    el.style.display = "block";
    el.style.width = "100%";
    el.style.height = "100%";

    el.setAttribute("view", String(args.view ?? "month"));
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
    el.setAttribute("visible-hours", String(args.visibleHours));

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
        start: preserveDateOnlyShape(detail.start, current.start),
        end: preserveDateOnlyShape(detail.end, current.end),
        summary: detail.summary,
        color: detail.color,
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
    });

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
