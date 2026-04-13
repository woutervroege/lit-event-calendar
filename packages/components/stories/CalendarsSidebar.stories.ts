import type { CalendarsMap } from "@lit-calendar/events-api";
import type { Meta, StoryObj } from "@storybook/web-components-vite";
import "../src/CalendarsSidebar/CalendarsSidebar.js";
import {
  sampleCalendarsMap,
  storyAccountIds,
  storyCalendarIds,
  storyCalendarUrls,
} from "./support/StoryData.js";

type CalendarsSidebarElement = HTMLElement & {
  calendars?: CalendarsMap;
  visibleCalendarIds?: string[];
  defaultCalendarId?: string;
};

const meta: Meta = {
  title: "UI/CalendarsSidebar",
  component: "calendars-sidebar",
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
  render: () => {
    const el = document.createElement("calendars-sidebar") as CalendarsSidebarElement;
    el.style.display = "block";
    el.style.width = "max-content";
    el.style.minWidth = "220px";
    el.style.maxWidth = "320px";
    el.style.minHeight = "280px";
    el.calendars = sampleCalendarsMap;
    el.defaultCalendarId = storyCalendarIds.work;
    return el;
  },
};

export default meta;

type Story = StoryObj;

export const Default: Story = {};

export const Empty: Story = {
  render: () => {
    const el = document.createElement("calendars-sidebar") as CalendarsSidebarElement;
    el.style.display = "block";
    el.style.width = "max-content";
    el.style.minWidth = "220px";
    el.style.minHeight = "200px";
    el.calendars = new Map();
    return el;
  },
};

export const SingleCalendar: Story = {
  render: () => {
    const el = document.createElement("calendars-sidebar") as CalendarsSidebarElement;
    el.style.display = "block";
    el.style.width = "max-content";
    el.style.minWidth = "220px";
    el.style.minHeight = "200px";
    el.calendars = new Map([
      [
        storyCalendarIds.work,
        {
          accountId: storyAccountIds.john,
          url: storyCalendarUrls.work,
          displayName: "Work",
          color: "#63e657",
        },
      ],
    ]);
    return el;
  },
};
