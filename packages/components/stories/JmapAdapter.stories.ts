import type { Meta, StoryObj } from "@storybook/web-components-vite";
import "../src/CalendarViewGroup/CalendarViewGroup.js";
import "./support/StoryJmapAdapterHost.js";
import { attachRequestEventHandlers } from "./support/StoryRequestHandlers.js";

/**
 * Wires `calendar-view-group` to a `JmapEventsAdapter` from `@lit-calendar/jmap-client`,
 * backed by an in-memory JMAP server (RFC 8620 + calendars draft). Mutations made in the
 * view apply optimistically and are pushed via `CalendarEvent/set`; the toolbar button
 * makes a change on the "server" and reconciles it through `CalendarEvent/changes`.
 */
function renderJmapView(args: Record<string, unknown>) {
  const host = document.createElement("story-jmap-adapter-host");
  host.style.display = "flex";
  host.style.width = "100%";
  host.style.height = "100%";

  const el = document.createElement("calendar-view-group");
  el.style.display = "block";
  el.style.width = "100%";
  el.style.height = "100%";
  el.setAttribute("view", String(args.view ?? "week"));
  el.setAttribute("presentation", "grid");
  el.setAttribute("start-date", String(args.startDate ?? "2026-03-10"));
  el.setAttribute("timezone", "Europe/Amsterdam");
  el.setAttribute("snap-interval", "15");

  host.appendChild(el);
  attachRequestEventHandlers(el as HTMLElement & { events: Map<string, never> });
  return host;
}

const meta: Meta = {
  title: "Integrations/JMAP adapter",
  component: "calendar-view-group",
  argTypes: {
    view: {
      control: "inline-radio",
      options: ["day", "week", "month", "year"],
    },
    startDate: { control: "text", description: "Anchor date (YYYY-MM-DD)" },
  },
  args: {
    view: "week",
    startDate: "2026-03-10",
  },
  render: (args) => renderJmapView(args as Record<string, unknown>),
};

export default meta;

type Story = StoryObj;

export const Week: Story = {};

export const Month: Story = {
  args: {
    view: "month",
    startDate: "2026-03-01",
  },
};
