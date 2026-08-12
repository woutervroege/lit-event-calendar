import type { Meta, StoryObj } from "@storybook/web-components-vite";
import "../src/CalendarTimelineView/CalendarTimelineView.js";
import { calendarCssProps } from "./support/CalendarCssProps.js";
import type { CalendarsMap } from "@lit-calendar/events-api";
import {
  AUTO_LOCALE_OPTION,
  type CalendarEvent,
  langControlLabels,
  langControlOptions,
  sampleCalendarsMap,
  sampleEvents,
  storyCalendarIds,
  storyEventsFromArg,
  timezoneOptions,
} from "./support/StoryData.js";
import "./support/StoryEventsAPIContextHost.js";
import { attachRequestEventHandlers } from "./support/StoryRequestHandlers.js";

type StoryElement = HTMLElement & { events: Map<string, CalendarEvent> };

type StoryHostElement = HTMLElement & {
  events: Map<string, CalendarEvent>;
  calendars?: CalendarsMap;
  timezone?: string;
  selectedCalendarId?: string;
};

const meta: Meta = {
  title: "Calendar/CalendarTimelineView",
  component: "calendar-timeline-view",
  tags: ["autodocs"],
  parameters: {
    cssprops: calendarCssProps,
    layout: "fullscreen",
  },
  argTypes: {
    mode: {
      control: "select",
      options: [undefined, "day", "week", "month", "gantt", "year"],
      description:
        "Preset configuring flow/layout/day count/variant; explicitly set props still win. " +
        "day/week/month show only timed events by default (gantt shows everything); " +
        "see allDayRow for the composed day/week + all-day layout. " +
        "year composes 12 compact month grids for startDate's year.",
    },
    variant: {
      control: "select",
      options: [undefined, "timed", "all-day"],
      description:
        'Event mapping onto the axis. "all-day" is the standalone all-day presentation: ' +
        "only all-day events, plotted as whole-day cells.",
    },
    allDayRow: {
      control: "boolean",
      description:
        "Day/week modes: opt into the composed all-day row above the timed timeline " +
        "(round-trip gestures + drag-create of whole-day events). Off by default: " +
        "all-day events are hidden and only the day headers remain.",
    },
    startDate: { control: "text", description: "First visible day (YYYY-MM-DD)" },
    currentTime: {
      control: "text",
      description: "Current time (ISO datetime); drives the current-time marker + today highlight.",
    },
    daysPerWeek: {
      control: { type: "number", min: 1, max: 42 },
      description:
        "Number of day cells. For >7 days, set columns to 7 for a week-column month grid.",
    },
    columns: {
      control: { type: "number", min: 1, max: 42 },
      description:
        "TimeLine grid columns (default: daysPerWeek if ≤7, else 7). Maps to <time-line columns>.",
    },
    weekStart: {
      control: { type: "number", min: 1, max: 7 },
      description: "Week start for month-mode grid alignment (1 = Monday … 7 = Sunday).",
    },
    lang: {
      control: { type: "select", labels: langControlLabels },
      options: langControlOptions,
    },
    timezone: { control: "select", options: timezoneOptions },
    snapInterval: {
      control: { type: "number", min: 1, max: 60 },
      description:
        "Drag/resize snap in minutes (same concept as the grid views); mapped to the time-line step unless timelineStep is set.",
    },
    timelineMax: {
      control: { type: "number", min: 1, max: 10_080 },
      description: "Units per day on the time-line axis (default 1440 = minutes per day)",
    },
    timelineStep: {
      control: { type: "number", min: 1, max: 60 },
      description: "Explicit time-line step in raw axis units; overrides snapInterval when set.",
    },
    timelineFlow: { control: "select", options: [undefined, "vertical", "horizontal"] },
    timelineLayout: {
      control: "select",
      options: [undefined, "default", "timeline", "masonry", "stagger"],
    },
    timelineHeight: { control: "select", options: [undefined, "auto"] },
    visibleHours: {
      control: { type: "number", min: 1, max: 24 },
      description:
        "visibleHours zoom for day/week: hour height = viewport height / visibleHours; " +
        "the full 24h render and the rest scrolls into view.",
    },
    visibleHoursStart: {
      control: { type: "number", min: 0, max: 23 },
      description: "First visible hour when visibleHours is active (initial scroll position).",
    },
    rtl: { control: "boolean" },
    events: { control: "object" },
  },
  args: {
    startDate: "2025-01-05",
    currentTime: "2025-01-07T10:30:00",
    lang: AUTO_LOCALE_OPTION,
    timezone: "Europe/Amsterdam",
    snapInterval: 15,
    timelineMax: 1440,
    allDayRow: false,
    rtl: false,
    events: sampleEvents,
  },
  render: (args) => {
    const host = document.createElement("story-events-api-host") as StoryHostElement;
    host.calendars = sampleCalendarsMap;
    host.timezone = String(args.timezone ?? "");
    host.selectedCalendarId = storyCalendarIds.personal;
    host.style.display = "block";
    host.style.height = "100%";

    const el = document.createElement("calendar-timeline-view") as StoryElement;
    const setAttr = (name: string, value: unknown) => {
      if (value === undefined || value === null || value === "") {
        el.removeAttribute(name);
        return;
      }
      el.setAttribute(name, String(value));
    };
    const setNumericAttr = (name: string, value: unknown) => {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        el.setAttribute(name, String(parsed));
      } else {
        el.removeAttribute(name);
      }
    };

    setAttr("mode", args.mode);
    setAttr("variant", args.variant);
    el.toggleAttribute("all-day-row", Boolean(args.allDayRow));
    setAttr("start-date", args.startDate);
    setAttr("current-time", args.currentTime);
    setNumericAttr("days-per-week", args.daysPerWeek);
    setNumericAttr("columns", args.columns);
    setNumericAttr("week-start", args.weekStart);
    setNumericAttr("snap-interval", args.snapInterval);
    setNumericAttr("timeline-max", args.timelineMax);
    setNumericAttr("timeline-step", args.timelineStep);
    setAttr("timeline-flow", args.timelineFlow);
    setAttr("timeline-layout", args.timelineLayout);
    setAttr("timeline-height", args.timelineHeight === "auto" ? "auto" : undefined);
    setNumericAttr("visible-hours", args.visibleHours);
    setNumericAttr("visible-hours-start", args.visibleHoursStart);
    el.toggleAttribute("rtl", Boolean(args.rtl));
    if (args.lang && args.lang !== AUTO_LOCALE_OPTION) {
      el.setAttribute("lang", args.lang);
    } else {
      el.removeAttribute("lang");
    }
    if (args.timezone) {
      el.setAttribute("timezone", args.timezone);
    }
    const events = storyEventsFromArg(args.events, sampleEvents);
    host.events = events;
    el.events = new Map(events);
    el.style.boxSizing = "border-box";
    el.style.padding = "16px";
    el.style.height = "100%";
    el.style.minHeight = "420px";
    attachRequestEventHandlers(el);
    host.appendChild(el);
    return host;
  },
};

export default meta;

type Story = StoryObj;

export const VerticalWeek: Story = {
  name: "Vertical week (masonry)",
  args: {
    daysPerWeek: 7,
    timelineFlow: "vertical",
    timelineLayout: "masonry",
  },
};

export const HorizontalWeek: Story = {
  name: "Horizontal week (masonry)",
  args: {
    daysPerWeek: 7,
    timelineFlow: "horizontal",
    timelineLayout: "masonry",
    timelineHeight: "auto",
  },
};

export const HorizontalMonthSixBySeven: Story = {
  name: "Horizontal month (6×7 masonry)",
  args: {
    daysPerWeek: 42,
    columns: 7,
    timelineFlow: "horizontal",
    timelineLayout: "masonry",
    timelineHeight: "auto",
    startDate: "2025-01-01",
  },
};

export const ModeDay: Story = {
  name: "Mode: day",
  parameters: {
    docs: {
      description: {
        story:
          "Single-day preset: time sidebar + vertical timed timeline. Only timed events are " +
          "shown; enable allDayRow to compose the all-day row on top.",
      },
    },
  },
  args: {
    mode: "day",
    startDate: "2025-01-07",
  },
};

export const ModeWeek: Story = {
  name: "Mode: week",
  parameters: {
    docs: {
      description: {
        story:
          "Seven-day preset: time sidebar + vertical timed timeline. Only timed events are " +
          "shown; enable allDayRow to compose the all-day row on top.",
      },
    },
  },
  args: {
    mode: "week",
    startDate: "2025-01-05",
  },
};

export const ModeMonth: Story = {
  name: "Mode: month",
  parameters: {
    docs: {
      description: {
        story:
          "42-cell month grid with day-chip mapping. Only timed events are shown " +
          "(all-day events are filtered out).",
      },
    },
  },
  args: {
    mode: "month",
    startDate: "2025-01-15",
  },
};

export const ModeYear: Story = {
  name: "Mode: year",
  parameters: {
    docs: {
      description: {
        story:
          "Twelve month-mode timelines (January–December of startDate's year) composed into " +
          "the grid year view's responsive layout. Small month cells degrade automatically via " +
          "container queries: no cell borders, centered day numbers, and event days marked with " +
          "colored bullets. Clicking an event day opens its events popover; clicking an empty " +
          "day emits day-selection.",
      },
    },
  },
  args: {
    mode: "year",
    startDate: "2025-01-15",
  },
};

export const ModeGantt: Story = {
  name: "Mode: gantt",
  parameters: {
    docs: {
      description: {
        story: "Continuous horizontal row; shows every event (timed and all-day) at real ranges.",
      },
    },
  },
  args: {
    mode: "gantt",
    startDate: "2025-01-03",
    daysPerWeek: 14,
  },
};

export const AllDayView: Story = {
  name: "All-day view",
  parameters: {
    docs: {
      description: {
        story:
          'Standalone all-day presentation (variant="all-day"): a horizontal masonry row of ' +
          "day cells showing only all-day events, snapped to whole days.",
      },
    },
  },
  args: {
    variant: "all-day",
    daysPerWeek: 7,
    timelineFlow: "horizontal",
    timelineLayout: "masonry",
    timelineHeight: "auto",
  },
};

export const CombinedWeekAllDay: Story = {
  name: "Combined week + all-day",
  parameters: {
    docs: {
      description: {
        story:
          "Week mode with allDayRow enabled: the all-day row (drag-create + round-trip " +
          "gestures for whole-day events) composes above the timed timeline.",
      },
    },
  },
  args: {
    mode: "week",
    startDate: "2025-01-05",
    allDayRow: true,
  },
};

export const CombinedDayAllDay: Story = {
  name: "Combined day + all-day",
  parameters: {
    docs: {
      description: {
        story: "Day mode with allDayRow enabled: single-day version of the combined layout.",
      },
    },
  },
  args: {
    mode: "day",
    startDate: "2025-01-06",
    allDayRow: true,
  },
};
