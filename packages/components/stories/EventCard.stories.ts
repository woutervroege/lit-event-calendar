import type { Meta, StoryObj } from "@storybook/web-components-vite";
import "../src/EventCard/EventCard.js";

type StoryEventCardElement = HTMLElement & {
  lang: string;
  summary: string;
  time: string;
  timeDetail: string;
  location: string;
  recurring: boolean;
  exception: boolean;
  past: boolean;
  layout: "absolute" | "flow";
  segmentDirection: "horizontal" | "vertical";
  firstSegment: boolean;
  lastSegment: boolean;
};

const meta: Meta = {
  title: "Calendar/EventCard",
  component: "event-card",
  tags: ["autodocs"],
  argTypes: {
    summary: { control: "text" },
    time: { control: "text" },
    timeDetail: { control: "text" },
    location: { control: "text" },
    recurring: { control: "boolean" },
    exception: { control: "boolean" },
    past: { control: "boolean" },
    layout: { control: "select", options: ["flow", "absolute"] },
    segmentDirection: { control: "select", options: ["horizontal", "vertical"] },
    firstSegment: { control: "boolean" },
    lastSegment: { control: "boolean" },
    lang: { control: "text" },
  },
  args: {
    summary: "Weekly product sync",
    time: "09:30 - 10:30",
    timeDetail: "",
    location: "Room Atlas",
    recurring: false,
    exception: false,
    past: false,
    layout: "flow",
    segmentDirection: "horizontal",
    firstSegment: true,
    lastSegment: true,
    lang: "en",
  },
  render: (args) => {
    const frame = document.createElement("div");
    frame.style.width = "360px";
    frame.style.maxWidth = "100%";
    frame.style.padding = "12px";
    frame.style.background = "Canvas";
    frame.style.border = "1px solid color-mix(in srgb, CanvasText 16%, transparent)";
    frame.style.borderRadius = "10px";

    const card = document.createElement("event-card") as StoryEventCardElement;
    card.lang = args.lang ?? "en";
    card.summary = args.summary ?? "";
    card.time = args.time ?? "";
    card.timeDetail = args.timeDetail ?? "";
    card.location = args.location ?? "";
    card.recurring = Boolean(args.recurring);
    card.exception = Boolean(args.exception);
    card.past = Boolean(args.past);
    card.layout = (args.layout as "absolute" | "flow") ?? "flow";
    card.segmentDirection =
      (args.segmentDirection as "horizontal" | "vertical") ?? "horizontal";
    card.firstSegment = Boolean(args.firstSegment);
    card.lastSegment = Boolean(args.lastSegment);

    card.style.setProperty("--_lc-event-bg", "rgba(14, 165, 233, 0.15)");
    card.style.setProperty("--_lc-event-bg-hover", "rgba(14, 165, 233, 0.22)");
    card.style.setProperty("--_lc-event-accent-color", "#0ea5e9");
    card.style.setProperty("--_lc-event-text-color", "CanvasText");
    card.style.setProperty("--_lc-event-height", "42px");

    if (card.layout === "absolute") {
      frame.style.position = "relative";
      frame.style.height = "72px";
      card.style.setProperty("--_lc-days", "1");
      card.style.setProperty("--_lc-left", "0%");
      card.style.setProperty("--_lc-width", "1");
      card.style.setProperty("--_lc-margin-left", "0");
      card.style.setProperty("top", "10px");
      card.style.setProperty("bottom", "10px");
    } else {
      frame.style.height = "auto";
    }

    frame.append(card);
    return frame;
  },
};

export default meta;
type Story = StoryObj;

export const FlowDefault: Story = {};

export const FlowRecurring: Story = {
  args: {
    recurring: true,
  },
};

export const FlowRecurringPast: Story = {
  args: {
    recurring: true,
    past: true,
    summary: "Recurring event from last week",
    time: "08:00 - 08:30",
  },
};

export const FlowException: Story = {
  args: {
    recurring: true,
    exception: true,
    summary: "Standup (moved)",
    time: "10:00 - 10:15",
  },
};

export const AbsoluteRecurringSegment: Story = {
  args: {
    recurring: true,
    layout: "absolute",
    segmentDirection: "vertical",
    firstSegment: true,
    lastSegment: false,
  },
};
