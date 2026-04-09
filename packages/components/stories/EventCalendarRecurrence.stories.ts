import type { Meta, StoryObj } from "@storybook/web-components-vite";
import "../src/EventCalendar/EventCalendar.js";
import type { CalendarRecurrenceRule } from "../src/types/CalendarEvent.js";
import {
  AUTO_LOCALE_OPTION,
  AUTO_WEEK_START_OPTION,
  type CalendarEvent,
  toTemporalDateLike,
} from "./support/StoryData.js";
import { attachRequestEventHandlers } from "./support/StoryRequestHandlers.js";

type StoryEventCalendarElement = HTMLElement & { events: Map<string, CalendarEvent> };

type RecurrenceRuleInput = Omit<CalendarRecurrenceRule, "until"> & {
  until?: string;
};

type RecurrenceExceptionInput = {
  recurrenceId: string;
  start: string;
  end: string;
  summary?: string;
};

type RecurrenceStoryArgs = {
  startDate: string;
  weekStart: number | typeof AUTO_WEEK_START_OPTION;
  lang: string;
  timezone: string;
  currentTime: string;
  recurrenceRule: RecurrenceRuleInput;
  exclusionDates: string[];
  exceptions: RecurrenceExceptionInput[];
};

const SERIES_CALENDAR_ID = "/calendars/story/recurrence/";
const SERIES_EVENT_ID = "storybook-recurrence-series@example.test";
const SERIES_SUMMARY = "Recurring series";
const SERIES_COLOR = "#0ea5e9";
const SERIES_START = "2025-01-06T09:00:00";
const SERIES_END = "2025-01-06T10:00:00";

function toRecurrenceRule(rule: RecurrenceRuleInput): CalendarRecurrenceRule {
  const { until, ...baseRule } = rule;
  if (until !== undefined) {
    return {
      ...baseRule,
      until: toTemporalDateLike(until),
    };
  }
  return baseRule;
}

function buildSeriesEvents(args: RecurrenceStoryArgs): Array<[string, CalendarEvent]> {
  const recurrenceRule = toRecurrenceRule(args.recurrenceRule);

  const seriesEvent: CalendarEvent = {
    calendarId: SERIES_CALENDAR_ID,
    eventId: SERIES_EVENT_ID,
    start: toTemporalDateLike(SERIES_START),
    end: toTemporalDateLike(SERIES_END),
    summary: SERIES_SUMMARY,
    color: SERIES_COLOR,
    recurrenceRule,
    exclusionDates: args.exclusionDates.length > 0 ? new Set(args.exclusionDates) : undefined,
  };

  const entries: Array<[string, CalendarEvent]> = [["series-master", seriesEvent]];
  for (const exception of args.exceptions) {
    entries.push([
      `series-exception-${exception.recurrenceId}`,
      {
        calendarId: SERIES_CALENDAR_ID,
        eventId: SERIES_EVENT_ID,
        recurrenceId: exception.recurrenceId,
        isException: true,
        start: toTemporalDateLike(exception.start),
        end: toTemporalDateLike(exception.end),
        summary: exception.summary ?? `${SERIES_SUMMARY} (moved)`,
        color: SERIES_COLOR,
      },
    ]);
  }

  return entries;
}

function renderCalendar(args: RecurrenceStoryArgs) {
  const el = document.createElement("event-calendar") as StoryEventCalendarElement;
  el.style.display = "block";
  el.style.width = "100%";
  el.style.height = "100%";

  el.setAttribute("view", "month");
  el.setAttribute("presentation", "grid");
  el.setAttribute("days-per-week", "7");
  el.setAttribute("start-date", args.startDate);

  if (typeof args.weekStart === "number") {
    el.setAttribute("week-start", String(args.weekStart));
  } else {
    el.removeAttribute("week-start");
  }

  if (args.lang && args.lang !== AUTO_LOCALE_OPTION) {
    el.setAttribute("lang", args.lang);
  } else {
    el.removeAttribute("lang");
  }

  el.setAttribute("timezone", args.timezone);
  el.setAttribute("current-time", args.currentTime);
  el.events = new Map(buildSeriesEvents(args));
  attachRequestEventHandlers(el, { preserveDateOnlyShape: true });

  return el;
}

const meta: Meta<RecurrenceStoryArgs> = {
  title: "Calendar/EventCalendar/Recurrence",
  component: "event-calendar",
  tags: ["autodocs"],
  argTypes: {
    recurrenceRule: {
      control: "object",
      description: "The RRULE payload for the recurring series.",
    },
    exclusionDates: {
      control: "object",
      description: "RECURRENCE-ID values excluded from the series (EXDATE shape).",
    },
    exceptions: {
      control: "object",
      description: "Detached occurrences keyed by recurrenceId.",
    },
    startDate: { table: { disable: true } },
    weekStart: { table: { disable: true } },
    lang: { table: { disable: true } },
    timezone: { table: { disable: true } },
    currentTime: { table: { disable: true } },
  },
  args: {
    startDate: "2025-01-01",
    weekStart: AUTO_WEEK_START_OPTION,
    lang: AUTO_LOCALE_OPTION,
    timezone: "Europe/Amsterdam",
    currentTime: "2025-01-15T14:30:00",
    recurrenceRule: {
      freq: "WEEKLY",
      interval: 1,
      byDay: [{ day: "MO" }],
      until: "2025-03-31T00:00:00",
    },
    exclusionDates: [],
    exceptions: [],
  },
  render: (args) => renderCalendar(args),
};

export default meta;

type Story = StoryObj<RecurrenceStoryArgs>;

export const ControlsPlayground: Story = {
  name: "Controls Playground",
};

export const DailyUntil: Story = {
  args: {
    recurrenceRule: {
      freq: "DAILY",
      interval: 1,
      until: "2025-01-31T00:00:00",
    },
  },
};

export const WeeklyWeekdays: Story = {
  args: {
    recurrenceRule: {
      freq: "WEEKLY",
      interval: 1,
      wkst: "MO",
      byDay: [{ day: "MO" }, { day: "TU" }, { day: "WE" }, { day: "TH" }, { day: "FR" }],
      until: "2025-02-28T00:00:00",
    },
  },
};

export const BiWeeklyTuesdayThursday: Story = {
  args: {
    recurrenceRule: {
      freq: "WEEKLY",
      interval: 2,
      byDay: [{ day: "TU" }, { day: "TH" }],
      until: "2025-03-31T00:00:00",
    },
  },
};

export const MonthlyNthWeekday: Story = {
  args: {
    recurrenceRule: {
      freq: "MONTHLY",
      interval: 1,
      byDay: [{ day: "MO", ordinal: 3 }],
      until: "2025-06-30T00:00:00",
    },
  },
};

export const MonthlyLastFriday: Story = {
  args: {
    recurrenceRule: {
      freq: "MONTHLY",
      interval: 1,
      byDay: [{ day: "FR" }],
      bySetPos: [-1],
      until: "2025-06-30T00:00:00",
    },
  },
};

export const YearlyCountLimited: Story = {
  args: {
    recurrenceRule: {
      freq: "YEARLY",
      interval: 1,
      byMonth: [1],
      byMonthDay: [6],
      count: 4,
    },
  },
};

export const WeeklyWithExclusionDates: Story = {
  args: {
    recurrenceRule: {
      freq: "WEEKLY",
      interval: 1,
      byDay: [{ day: "MO" }],
      until: "2025-03-31T00:00:00",
    },
    exclusionDates: ["20250120T090000", "20250203T090000"],
  },
};

export const WeeklyWithDetachedException: Story = {
  args: {
    recurrenceRule: {
      freq: "WEEKLY",
      interval: 1,
      byDay: [{ day: "MO" }],
      until: "2025-03-31T00:00:00",
    },
    exclusionDates: [],
    exceptions: [
      {
        recurrenceId: "20250120T090000",
        start: "2025-01-20T13:00:00",
        end: "2025-01-20T14:00:00",
        summary: "Recurring series (rescheduled)",
      },
    ],
  },
};
