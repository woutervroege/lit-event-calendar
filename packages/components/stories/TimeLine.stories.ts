import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";
import "../src/EventCard/EventCard.js";
import "../src/TimeLine/TimeLine.js";
import type { TimeLine } from "../src/TimeLine/TimeLine.js";
import type { TimelineEvent } from "../src/types/TimeLine.js";

const verticalTimedEvents: TimelineEvent[] = [
  { start: 10, end: 130, label: "Event 1", color: "#ff6347" },
  { start: 35, end: 255, label: "Event 2", color: "#6495ed" },
  { start: 260, end: 385, label: "Event 3", color: "#3cb371" },
];

const masonryDemoEvents: TimelineEvent[] = [
  { start: 0, end: 1385, label: "Atlas (full grid)", color: "#ff6347" },
  { start: 12, end: 92, label: "Bravo", color: "#ff7f50" },
  { start: 24, end: 58, label: "Charlie", color: "#ffa500" },
  { start: 62, end: 96, label: "Delta", color: "#ff8c00" },
  { start: 180, end: 820, label: "Echo (crosses row)", color: "#ffd700" },
  { start: 560, end: 940, label: "Foxtrot (row break)", color: "#6495ed" },
  { start: 708, end: 718, label: "Golf", color: "#4169e1" },
  { start: 700, end: 920, label: "Hotel", color: "#1e90ff" },
  { start: 980, end: 1320, label: "India (week 2)", color: "#3cb371" },
  { start: 1020, end: 1125, label: "Juliet", color: "#2e8b57" },
  { start: 1188, end: 1205, label: "Kilo", color: "#dda0dd" },
  { start: 1280, end: 1395, label: "Lima (tail)", color: "#da70d6" },
];

const masonry100StepEvents: TimelineEvent[] = [
  { start: 0, end: 4200, label: "Atlas (full grid)", color: "#ff6347" },
  { start: 0, end: 200, label: "Bravo", color: "#ff7f50" },
  { start: 0, end: 100, label: "Charlie", color: "#ffa500" },
  { start: 300, end: 500, label: "Delta", color: "#ff8c00" },
  { start: 100, end: 900, label: "Echo (crosses row)", color: "#ffd700" },
  { start: 500, end: 1000, label: "Foxtrot (row break)", color: "#6495ed" },
  { start: 700, end: 800, label: "Golf", color: "#4169e1" },
  { start: 700, end: 1000, label: "Hotel", color: "#1e90ff" },
  { start: 900, end: 1400, label: "India (week 2)", color: "#3cb371" },
  { start: 1000, end: 1200, label: "Juliet", color: "#2e8b57" },
  { start: 1100, end: 1300, label: "Kilo", color: "#dda0dd" },
  { start: 1200, end: 1400, label: "Lima (tail)", color: "#da70d6" },
  { start: 1400, end: 1800, label: "Mike (week 3)", color: "#c77dff" },
  { start: 1600, end: 2000, label: "November", color: "#ff6b6b" },
  { start: 2100, end: 2600, label: "Oscar", color: "#4ecdc4" },
  { start: 2200, end: 2400, label: "Papa", color: "#ffe66d" },
  { start: 2800, end: 3300, label: "Quebec", color: "#95e1d3" },
  { start: 2900, end: 3500, label: "Romeo", color: "#f38181" },
  { start: 3500, end: 4000, label: "Sierra", color: "#aa96da" },
  { start: 3600, end: 3700, label: "Tango", color: "#fcbad3" },
  { start: 3800, end: 4200, label: "Uniform", color: "#a8d8ea" },
];

function eventCardEventTemplate(ev: TimelineEvent) {
  const summary = String(ev.label ?? "");
  const color = String(ev.color ?? "#64748b");
  const time = `${ev.start}–${ev.end}`;
  return html`<event-card
    layout="flow"
    .color=${color}
    .summary=${summary}
    .time=${time}
  ></event-card>`;
}

function createTimeLine(): TimeLine {
  const el = document.createElement("time-line") as TimeLine;
  el.eventTemplate = (ev) => eventCardEventTemplate(ev);
  return el;
}

const meta: Meta = {
  title: "Calendar/TimeLine",
  component: "time-line",
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

type Story = StoryObj;

export const VerticalTimed: Story = {
  name: "Vertical (week view)",
  render: () => {
    const wrap = document.createElement("div");
    wrap.style.cssText =
      "box-sizing:border-box;padding:16px;height:100%;min-height:360px;display:flex;flex-direction:column;gap:8px;";
    const title = document.createElement("h2");
    title.style.cssText = "margin:0;font:600 1rem system-ui,sans-serif;";
    title.textContent = "Vertical (timed)";
    const el = createTimeLine();
    el.flow = "vertical";
    el.layout = "masonry";
    el.step = 5;
    el.max = 100;
    el.cells = 7;
    el.columns = 7;
    el.events = verticalTimedEvents;
    el.style.flex = "1";
    el.style.minHeight = "280px";
    wrap.append(title, el);
    return wrap;
  },
};

export const HorizontalMasonrySevenCells100Step: Story = {
  name: "Horizontal (all day view)",
  render: () => {
    const wrap = document.createElement("div");
    wrap.style.cssText =
      "box-sizing:border-box;padding:16px;height:100%;overflow:auto;display:flex;flex-direction:column;gap:8px;";
    const title = document.createElement("h2");
    title.style.cssText = "margin:0;font:600 1rem system-ui,sans-serif;";
    title.textContent = "Horizontal · masonry · 7 cells · max/step 100";
    const el = createTimeLine();
    el.flow = "horizontal";
    el.layout = "masonry";
    el.step = 100;
    el.max = 100;
    el.cells = 7;
    el.columns = 7;
    el.events = masonry100StepEvents;
    el.style.width = "100%";
    wrap.append(title, el);
    return wrap;
  },
};

export const HorizontalMasonryFortyTwoCells: Story = {
  name: "Horizontal (month view)",
  render: () => {
    const wrap = document.createElement("div");
    wrap.style.cssText =
      "box-sizing:border-box;padding:16px;height:100%;overflow:auto;display:flex;flex-direction:column;gap:8px;";
    const title = document.createElement("h2");
    title.style.cssText = "margin:0;font:600 1rem system-ui,sans-serif;";
    title.textContent = "Horizontal · masonry · 6 rows × 7 cols";
    const el = createTimeLine();
    el.flow = "horizontal";
    el.layout = "masonry";
    el.step = 100;
    el.max = 100;
    el.cells = 42;
    el.columns = 7;
    el.events = masonry100StepEvents;
    el.style.width = "100%";
    wrap.append(title, el);
    return wrap;
  },
};

export const HorizontalMasonrySingleRow: Story = {
  name: "Horizontal (month view, timed)",
  render: () => {
    const wrap = document.createElement("div");
    wrap.style.cssText =
      "box-sizing:border-box;padding:16px;height:100%;overflow:auto;display:flex;flex-direction:column;gap:8px;";
    const title = document.createElement("h2");
    title.style.cssText = "margin:0;font:600 1rem system-ui,sans-serif;";
    title.textContent = "Horizontal · masonry · single week row";
    const el = createTimeLine();
    el.flow = "horizontal";
    el.layout = "masonry";
    el.step = 5;
    el.max = 100;
    el.cells = 7;
    el.columns = 7;
    el.events = masonryDemoEvents;
    el.style.width = "100%";
    wrap.append(title, el);
    return wrap;
  },
};

export const HorizontalTimeline: Story = {
  name: "Horizontal (timeline week view)",
  render: () => {
    const wrap = document.createElement("div");
    wrap.style.cssText =
      "box-sizing:border-box;padding:16px;height:100%;overflow:auto;display:flex;flex-direction:column;gap:8px;";
    const title = document.createElement("h2");
    title.style.cssText = "margin:0;font:600 1rem system-ui,sans-serif;";
    title.textContent = "Horizontal · timeline (swimlane per event order)";
    const el = createTimeLine();
    el.flow = "horizontal";
    el.layout = "timeline";
    el.step = 5;
    el.max = 100;
    el.cells = 7;
    el.columns = 7;
    el.events = masonryDemoEvents;
    el.style.width = "100%";
    wrap.append(title, el);
    return wrap;
  },
};
