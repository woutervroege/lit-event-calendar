import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";
import "../src/EventCard/EventCard.js";
import "../src/TimeLine/TimeLine.js";
import type { TimeLine } from "../src/TimeLine/TimeLine.js";
import type {
  TimelineEvent,
  TimelineEventCreateDetail,
  TimelineEventMoveCommitDetail,
  TimelineEventResizeCommitDetail,
} from "../src/types/TimeLine.js";

const verticalTimedEvents: TimelineEvent[] = [
  { start: -40, end: 40, label: "Event 0", color: "#3acf7a" },
  { start: 10, end: 130, label: "Event 1", color: "#ff6347" },
  { start: 35, end: 255, label: "Event 2", color: "#6495ed" },
  { start: 260, end: 385, label: "Event 3", color: "#3cb371" },
  { start: 500, end: 870, label: "Event 4", color: "#fcf123" },
];

const staggerDemoEvents: TimelineEvent[] = [
  // Day 1: same-start pair (splits width) + a later overlap indented above both.
  { start: 20, end: 70, label: "Standup A", color: "#3acf7a" },
  { start: 20, end: 60, label: "Standup B", color: "#6495ed" },
  { start: 40, end: 90, label: "Review (indent 2)", color: "#ff6347" },
  // Day 2: cascade of later-and-later starts, each indenting one level deeper.
  { start: 110, end: 195, label: "Focus block", color: "#3cb371" },
  { start: 125, end: 180, label: "Call (indent 1)", color: "#ffa500" },
  { start: 140, end: 170, label: "Sync (indent 2)", color: "#9b5de5" },
  // Day 3/4: continuation — the cell-clamped start behaves like a start at the day boundary.
  { start: 260, end: 340, label: "Crosses midnight", color: "#1e90ff" },
  { start: 310, end: 360, label: "Morning overlap", color: "#e05add" },
  // Day 5: no overlap, full width.
  { start: 430, end: 480, label: "Solo", color: "#64748b" },
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

/**
 * Keeps `el.events` in sync when the user finishes a resize, move, or drag-to-create. `TimeLine`
 * dispatches `timeline-event-resize` / `timeline-event-move` / `timeline-event-create` on commit;
 * without updating `events`, the UI would snap back (or the created range would vanish) after the
 * gesture.
 */
function syncTimeLineEventsFromGestures(el: TimeLine, seed: TimelineEvent[]): void {
  const events = seed.map((e) => ({ ...e }));
  el.events = events;

  const applyCommit = (index: number, start: number, end: number) => {
    const cur = events[index];
    if (!cur) return;
    events[index] = { ...cur, start, end };
    el.events = [...events];
  };

  el.addEventListener("timeline-event-resize", (e) => {
    const { index, start, end } = (e as CustomEvent<TimelineEventResizeCommitDetail>).detail;
    applyCommit(index, start, end);
  });
  el.addEventListener("timeline-event-move", (e) => {
    const { index, start, end } = (e as CustomEvent<TimelineEventMoveCommitDetail>).detail;
    applyCommit(index, start, end);
  });

  let created = 0;
  el.addEventListener("timeline-event-create", (e) => {
    const { start, end } = (e as CustomEvent<TimelineEventCreateDetail>).detail;
    created++;
    events.push({ start, end, label: `New event ${created}`, color: "#9b5de5" });
    el.events = [...events];
  });
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
    syncTimeLineEventsFromGestures(el, verticalTimedEvents);
    el.style.flex = "1";
    el.style.minHeight = "280px";
    wrap.append(title, el);
    return wrap;
  },
};

export const VerticalStagger: Story = {
  name: "Vertical (stagger, calendar-style overlaps)",
  render: () => {
    const wrap = document.createElement("div");
    wrap.style.cssText =
      "box-sizing:border-box;padding:16px;height:100%;min-height:360px;display:flex;flex-direction:column;gap:8px;";
    const title = document.createElement("h2");
    title.style.cssText = "margin:0;font:600 1rem system-ui,sans-serif;";
    title.textContent =
      "Vertical · stagger — same-start events split the width; later-starting overlaps indent " +
      "(--time-line-stagger-indent, 12px per level) and stack on top";
    const el = createTimeLine();
    el.flow = "vertical";
    el.layout = "stagger";
    el.step = 5;
    el.max = 100;
    el.cells = 7;
    el.columns = 7;
    syncTimeLineEventsFromGestures(el, staggerDemoEvents);
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
    syncTimeLineEventsFromGestures(el, masonry100StepEvents);
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
    syncTimeLineEventsFromGestures(el, masonry100StepEvents);
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
    syncTimeLineEventsFromGestures(el, masonryDemoEvents);
    el.style.width = "100%";
    wrap.append(title, el);
    return wrap;
  },
};

export const VerticalWithMarkers: Story = {
  name: "Markers (current-time indicator)",
  render: () => {
    const wrap = document.createElement("div");
    wrap.style.cssText =
      "box-sizing:border-box;padding:16px;height:100%;min-height:360px;display:flex;flex-direction:column;gap:8px;";
    const title = document.createElement("h2");
    title.style.cssText = "margin:0;font:600 1rem system-ui,sans-serif;";
    title.textContent = "Vertical · markers at 30, 145, 372.5 and one per horizontal cell";
    const el = createTimeLine();
    el.flow = "vertical";
    el.layout = "masonry";
    el.step = 5;
    el.max = 100;
    el.cells = 7;
    el.columns = 7;
    // Absolute axis values: cell i spans [i * max, (i + 1) * max).
    el.markers = [30, 145, 372.5, 610];
    syncTimeLineEventsFromGestures(el, verticalTimedEvents);
    el.style.flex = "1";
    el.style.minHeight = "280px";

    const horizTitle = document.createElement("h2");
    horizTitle.style.cssText = "margin:8px 0 0;font:600 1rem system-ui,sans-serif;";
    horizTitle.textContent = "Horizontal · same markers, themed via --time-line-marker-color";
    const horizEl = createTimeLine();
    horizEl.flow = "horizontal";
    horizEl.layout = "masonry";
    horizEl.step = 5;
    horizEl.max = 100;
    horizEl.cells = 7;
    horizEl.columns = 7;
    horizEl.markers = [30, 145, 372.5, 610];
    horizEl.style.setProperty("--time-line-marker-color", "#7c3aed");
    syncTimeLineEventsFromGestures(horizEl, masonryDemoEvents);
    horizEl.style.width = "100%";

    wrap.append(title, el, horizTitle, horizEl);
    return wrap;
  },
};

export const DragToCreate: Story = {
  name: "Drag to create",
  render: () => {
    const wrap = document.createElement("div");
    wrap.style.cssText =
      "box-sizing:border-box;padding:16px;height:100%;min-height:360px;display:flex;flex-direction:column;gap:8px;";
    const title = document.createElement("h2");
    title.style.cssText = "margin:0;font:600 1rem system-ui,sans-serif;";
    title.textContent = "Drag on empty cell area to create (snaps to step 5, Escape cancels)";
    const el = createTimeLine();
    el.flow = "vertical";
    el.layout = "masonry";
    el.step = 5;
    el.max = 100;
    el.cells = 7;
    el.columns = 7;
    // The sync helper also appends events committed via `timeline-event-create`.
    syncTimeLineEventsFromGestures(el, verticalTimedEvents.slice(0, 3));
    el.style.flex = "1";
    el.style.minHeight = "280px";
    wrap.append(title, el);
    return wrap;
  },
};

export const AxisWindow: Story = {
  name: "Axis window (zoomed sub-range)",
  render: () => {
    const dayEvents: TimelineEvent[] = [
      { start: 420, end: 540, label: "Crosses window start", color: "#ff6347" },
      { start: 600, end: 690, label: "Fully inside", color: "#6495ed" },
      { start: 1140, end: 1290, label: "Crosses window end", color: "#3cb371" },
      { start: 60, end: 300, label: "Outside (hidden)", color: "#999999" },
      { start: 1980, end: 2100, label: "Day 2, inside", color: "#9b5de5" },
    ];
    const wrap = document.createElement("div");
    wrap.style.cssText =
      "box-sizing:border-box;padding:16px;height:100%;min-height:360px;display:flex;flex-direction:column;gap:8px;";
    const title = document.createElement("h2");
    title.style.cssText = "margin:0;font:600 1rem system-ui,sans-serif;";
    title.textContent =
      "Vertical · max 1440/cell, window 480–1200 (\u2248 08:00–20:00); gestures stay window-accurate";
    const el = createTimeLine();
    el.flow = "vertical";
    el.step = 30;
    el.max = 1440;
    el.cells = 3;
    el.columns = 3;
    el.windowStart = 480;
    el.windowEnd = 1200;
    el.markers = [630, 1980 + 30];
    syncTimeLineEventsFromGestures(el, dayEvents);
    el.style.flex = "1";
    el.style.minHeight = "320px";
    wrap.append(title, el);
    return wrap;
  },
};

export const GridLines: Story = {
  name: "Grid lines (gridInterval)",
  render: () => {
    const wrap = document.createElement("div");
    wrap.style.cssText =
      "box-sizing:border-box;padding:16px;height:100%;min-height:360px;display:flex;flex-direction:column;gap:8px;";
    const title = document.createElement("h2");
    title.style.cssText = "margin:0;font:600 1rem system-ui,sans-serif;";
    title.textContent =
      "Vertical · gridInterval 25 on a [0, 100] axis → subdivision line every quarter cell";
    const el = createTimeLine();
    el.flow = "vertical";
    el.layout = "masonry";
    el.step = 5;
    el.max = 100;
    el.cells = 7;
    el.columns = 7;
    el.gridInterval = 25;
    syncTimeLineEventsFromGestures(el, verticalTimedEvents);
    el.style.flex = "1";
    el.style.minHeight = "280px";

    const windowTitle = document.createElement("h2");
    windowTitle.style.cssText = "margin:8px 0 0;font:600 1rem system-ui,sans-serif;";
    windowTitle.textContent =
      "Vertical · window 30–90, gridInterval 25 → lines stay on absolute multiples (50, 75), themed via --time-line-grid-color";
    const windowEl = createTimeLine();
    windowEl.flow = "vertical";
    windowEl.layout = "masonry";
    windowEl.step = 5;
    windowEl.max = 100;
    windowEl.cells = 7;
    windowEl.columns = 7;
    windowEl.gridInterval = 25;
    windowEl.windowStart = 30;
    windowEl.windowEnd = 90;
    windowEl.style.setProperty("--time-line-grid-color", "light-dark(#c7d2fe, #4338ca)");
    syncTimeLineEventsFromGestures(windowEl, verticalTimedEvents);
    windowEl.style.flex = "1";
    windowEl.style.minHeight = "280px";

    wrap.append(title, el, windowTitle, windowEl);
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
    el.step = 1;
    el.max = 100;
    el.cells = 7;
    el.columns = 7;
    syncTimeLineEventsFromGestures(el, masonryDemoEvents);
    el.style.width = "100%";
    wrap.append(title, el);
    return wrap;
  },
};
