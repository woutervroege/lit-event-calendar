import type { Meta, StoryObj } from "@storybook/web-components-vite";
import "../src/CalendarTimelineView/CalendarTimelineView.js";
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
import { attachRequestEventHandlers } from "./support/StoryRequestHandlers.js";

type StoryElement = HTMLElement & { events: Map<string, CalendarEvent> };

const meta: Meta = {
  title: "Calendar/CalendarTimelineView",
  component: "calendar-timeline-view",
  tags: ["autodocs"],
  parameters: {
    cssprops: calendarCssProps,
    layout: "fullscreen",
  },
  argTypes: {
    startDate: { control: "text", description: "First visible day (YYYY-MM-DD)" },
    daysPerWeek: {
      control: { type: "number", min: 1, max: 42 },
      description:
        "Number of day cells (same as CalendarGridView). For >7 days, set columns to 7 for a week-column month grid.",
    },
    columns: {
      control: { type: "number", min: 1, max: 42 },
      description:
        "TimeLine grid columns (default: daysPerWeek if ≤7, else 7). Maps to <time-line columns>.",
    },
    lang: {
      control: { type: "select", labels: langControlLabels },
      options: langControlOptions,
    },
    timezone: { control: "select", options: timezoneOptions },
    snapInterval: { control: { type: "number", min: 1, max: 60 } },
    timelineMax: {
      control: { type: "number", min: 1, max: 10_080 },
      description: "Units per day on the time-line axis (default 1440 = minutes per day)",
    },
    timelineStep: { control: { type: "number", min: 1, max: 60 } },
    timelineFlow: { control: "select", options: ["vertical", "horizontal"] },
    timelineLayout: { control: "select", options: ["default", "timeline", "masonry"] },
    timelineHeight: { control: "select", options: ["", "auto"] },
    rtl: { control: "boolean" },
    events: { control: "object" },
  },
  args: {
    startDate: "2025-01-05",
    daysPerWeek: 7,
    lang: AUTO_LOCALE_OPTION,
    timezone: "Europe/Amsterdam",
    snapInterval: 15,
    timelineMax: 1440,
    timelineStep: 5,
    timelineFlow: "vertical",
    timelineLayout: "masonry",
    timelineHeight: "",
    rtl: false,
    events: sampleEvents,
  },
  render: (args) => {
    const el = document.createElement("calendar-timeline-view") as StoryElement;
    el.setAttribute("start-date", String(args.startDate));
    el.setAttribute("days-per-week", String(args.daysPerWeek));
    if (typeof args.columns === "number" && Number.isFinite(args.columns) && args.columns > 0) {
      el.setAttribute("columns", String(args.columns));
    } else {
      el.removeAttribute("columns");
    }
    el.setAttribute("snap-interval", String(args.snapInterval));
    el.setAttribute("timeline-max", String(args.timelineMax));
    el.setAttribute("timeline-step", String(args.timelineStep));
    el.setAttribute("timeline-flow", String(args.timelineFlow));
    el.setAttribute("timeline-layout", String(args.timelineLayout));
    if (args.timelineHeight === "auto") {
      el.setAttribute("timeline-height", "auto");
    } else {
      el.removeAttribute("timeline-height");
    }
    el.toggleAttribute("rtl", Boolean(args.rtl));
    if (args.lang && args.lang !== AUTO_LOCALE_OPTION) {
      el.setAttribute("lang", args.lang);
    } else {
      el.removeAttribute("lang");
    }
    if (args.timezone) {
      el.setAttribute("timezone", args.timezone);
    }
    el.events = storyEventsFromArg(args.events, sampleEvents);
    el.style.boxSizing = "border-box";
    el.style.padding = "16px";
    el.style.height = "100%";
    el.style.minHeight = "420px";
    attachRequestEventHandlers(el);
    return el;
  },
};

export default meta;

type Story = StoryObj;

export const VerticalWeek: Story = {
  name: "Vertical week (masonry)",
};

export const HorizontalWeek: Story = {
  name: "Horizontal week (masonry)",
  args: {
    timelineFlow: "horizontal",
    timelineLayout: "masonry",
    timelineHeight: "auto",
  },
};

export const HorizontalMonthSixBySeven: Story = {
  name: "Month View",
  args: {
    daysPerWeek: 42,
    columns: 7,
    timelineFlow: "horizontal",
    timelineLayout: "masonry",
    timelineHeight: "auto",
    startDate: "2025-01-01",
  },
};
