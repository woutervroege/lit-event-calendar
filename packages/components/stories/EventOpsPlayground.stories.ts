import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { Temporal } from "@js-temporal/polyfill";
import { EventsAPI } from "@lit-calendar/events-api";
import "../src/EventCalendar/EventCalendar.js";
import type { CalendarEventViewMap } from "../src/types/CalendarEvent.js";

type StoryEventCalendarElement = HTMLElement & { events: CalendarEventViewMap };

type PlaygroundOperation = {
  id: string;
  label: string;
  run: (api: EventsAPI) => ReturnType<EventsAPI["apply"]>;
};

function createInitialState(): CalendarEventViewMap {
  return new Map([
    [
      "series-master",
      {
        calendarId: "/calendars/story/ops/",
        eventId: "ops-weekly-series@example.test",
        start: Temporal.PlainDateTime.from("2025-01-06T09:00:00"),
        end: Temporal.PlainDateTime.from("2025-01-06T10:00:00"),
        summary: "Ops Weekly",
        color: "#0ea5e9",
        recurrenceRule: {
          freq: "WEEKLY",
          interval: 1,
          byDay: [{ day: "MO" }],
          until: Temporal.PlainDateTime.from("2025-03-31T00:00:00"),
        },
      },
    ],
    [
      "series-master::20250120T090000",
      {
        calendarId: "/calendars/story/ops/",
        eventId: "ops-weekly-series@example.test",
        recurrenceId: "20250120T090000",
        isException: true,
        start: Temporal.PlainDateTime.from("2025-01-20T13:00:00"),
        end: Temporal.PlainDateTime.from("2025-01-20T14:00:00"),
        summary: "Ops Weekly (moved)",
        color: "#0ea5e9",
      },
    ],
  ]);
}

const OPERATIONS: PlaygroundOperation[] = [
  {
    id: "move-series-plus-1h",
    label: "move(series, +1h)",
    run: (api) =>
      api.move({
        target: { key: "series-master" },
        scope: "series",
        delta: Temporal.Duration.from({ hours: 1 }),
      }),
  },
  {
    id: "move-exception-plus-1h",
    label: "move(exception, +1h)",
    run: (api) =>
      api.move({
        target: { key: "series-master::20250120T090000" },
        scope: "single",
        delta: Temporal.Duration.from({ hours: 1 }),
      }),
  },
  {
    id: "add-exception",
    label: "addException(20250127T090000)",
    run: (api) =>
      api.addException({
        target: { key: "series-master" },
        recurrenceId: "20250127T090000",
        event: {
          start: Temporal.PlainDateTime.from("2025-01-27T12:00:00"),
          end: Temporal.PlainDateTime.from("2025-01-27T13:00:00"),
          summary: "Ops Weekly (new exception)",
          color: "#0ea5e9",
        },
      }),
  },
  {
    id: "remove-exception-as-exclusion",
    label: "removeException(asExclusion)",
    run: (api) =>
      api.removeException({
        target: { key: "series-master::20250120T090000" },
        options: { asExclusion: true },
      }),
  },
  {
    id: "add-exclusion",
    label: "addExclusion(20250203T090000)",
    run: (api) =>
      api.addExclusion({
        target: { key: "series-master" },
        recurrenceId: "20250203T090000",
      }),
  },
  {
    id: "remove-exclusion",
    label: "removeExclusion(20250203T090000)",
    run: (api) =>
      api.removeExclusion({
        target: { key: "series-master" },
        recurrenceId: "20250203T090000",
      }),
  },
  {
    id: "update-series-summary",
    label: "update(series summary)",
    run: (api) =>
      api.update({
        target: { key: "series-master" },
        scope: "series",
        patch: { summary: "Ops Weekly (updated)" },
      }),
  },
  {
    id: "create-one-off",
    label: "create(one-off event)",
    run: (api) =>
      api.create({
        key: "one-off-20250122",
        event: {
          calendarId: "/calendars/story/ops/",
          eventId: "ops-one-off@example.test",
          start: Temporal.PlainDateTime.from("2025-01-22T15:00:00"),
          end: Temporal.PlainDateTime.from("2025-01-22T16:00:00"),
          summary: "One-off",
          color: "#14b8a6",
        },
      }),
  },
];

function asText(value: unknown): string {
  return JSON.stringify(
    value,
    (_, current) => {
      if (
        current instanceof Temporal.PlainDate ||
        current instanceof Temporal.PlainDateTime ||
        current instanceof Temporal.ZonedDateTime ||
        current instanceof Temporal.PlainTime ||
        current instanceof Temporal.Duration
      ) {
        return current.toString();
      }
      if (current instanceof Set) return Array.from(current.values());
      if (current instanceof Map) return Array.from(current.entries());
      return current;
    },
    2
  );
}

function summarizeState(state: CalendarEventViewMap): string {
  return Array.from(state.entries())
    .map(([key, event]) =>
      [
        key,
        `  eventId=${event.eventId ?? "-"}`,
        `  recurrenceId=${event.recurrenceId ?? "-"}`,
        `  start=${event.start.toString()}`,
        `  end=${event.end.toString()}`,
        `  summary=${event.summary}`,
        `  exdates=${event.exclusionDates ? Array.from(event.exclusionDates).join(",") : "-"}`,
      ].join("\n")
    )
    .join("\n\n");
}

function renderPlayground() {
  const root = document.createElement("div");
  root.style.display = "grid";
  root.style.gridTemplateColumns = "minmax(340px, 1fr) minmax(420px, 2fr)";
  root.style.gap = "12px";
  root.style.height = "88vh";

  const controls = document.createElement("div");
  controls.style.display = "grid";
  controls.style.gap = "8px";
  controls.style.alignContent = "start";

  const operationLabel = document.createElement("label");
  operationLabel.textContent = "Operation";
  operationLabel.style.fontWeight = "600";

  const operationSelect = document.createElement("select");
  for (const operation of OPERATIONS) {
    const option = document.createElement("option");
    option.value = operation.id;
    option.textContent = operation.label;
    operationSelect.append(option);
  }

  const buttonRow = document.createElement("div");
  buttonRow.style.display = "flex";
  buttonRow.style.gap = "8px";

  const applyButton = document.createElement("button");
  applyButton.type = "button";
  applyButton.textContent = "Apply";
  applyButton.style.padding = "6px 10px";

  const resetButton = document.createElement("button");
  resetButton.type = "button";
  resetButton.textContent = "Reset";
  resetButton.style.padding = "6px 10px";

  const stateLabel = document.createElement("label");
  stateLabel.textContent = "State snapshot";
  stateLabel.style.fontWeight = "600";

  const stateOutput = document.createElement("textarea");
  stateOutput.readOnly = true;
  stateOutput.style.width = "100%";
  stateOutput.style.minHeight = "210px";
  stateOutput.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, monospace";

  const resultLabel = document.createElement("label");
  resultLabel.textContent = "Last API result (changes/effects)";
  resultLabel.style.fontWeight = "600";

  const resultOutput = document.createElement("textarea");
  resultOutput.readOnly = true;
  resultOutput.style.width = "100%";
  resultOutput.style.minHeight = "170px";
  resultOutput.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, monospace";

  const expandedLabel = document.createElement("label");
  expandedLabel.textContent = "Expanded keys (month range)";
  expandedLabel.style.fontWeight = "600";

  const expandedOutput = document.createElement("textarea");
  expandedOutput.readOnly = true;
  expandedOutput.style.width = "100%";
  expandedOutput.style.minHeight = "120px";
  expandedOutput.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, monospace";

  controls.append(operationLabel, operationSelect, buttonRow, stateLabel, stateOutput);
  buttonRow.append(applyButton, resetButton);
  controls.append(resultLabel, resultOutput, expandedLabel, expandedOutput);

  const calendar = document.createElement("event-calendar") as StoryEventCalendarElement;
  calendar.style.display = "block";
  calendar.style.width = "100%";
  calendar.style.height = "100%";
  calendar.setAttribute("view", "month");
  calendar.setAttribute("presentation", "grid");
  calendar.setAttribute("start-date", "2025-01-15");
  calendar.setAttribute("timezone", "Europe/Amsterdam");
  calendar.setAttribute("current-time", "2025-01-15T14:30:00");

  let api = new EventsAPI(createInitialState(), { timezone: "Europe/Amsterdam" });

  const sync = (lastResult?: unknown) => {
    const state = api.getState();
    calendar.events = state;
    stateOutput.value = summarizeState(state);
    resultOutput.value = lastResult ? asText(lastResult) : "(no operations yet)";
    const expanded = api.expand({
      start: Temporal.PlainDateTime.from("2025-01-01T00:00:00"),
      end: Temporal.PlainDateTime.from("2025-02-01T00:00:00"),
    });
    expandedOutput.value = Array.from(expanded.keys()).join("\n");
  };

  applyButton.addEventListener("click", () => {
    const selected = OPERATIONS.find((operation) => operation.id === operationSelect.value);
    if (!selected) return;
    const result = selected.run(api);
    sync(result);
  });

  resetButton.addEventListener("click", () => {
    api = new EventsAPI(createInitialState(), { timezone: "Europe/Amsterdam" });
    sync();
  });

  sync();
  root.append(controls, calendar);
  return root;
}

const meta: Meta = {
  title: "Calendar/EventOps/Playground",
  tags: ["autodocs"],
  render: () => renderPlayground(),
};

export default meta;

type Story = StoryObj;

export const ApiMethods: Story = {};
