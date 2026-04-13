import { Temporal } from "@js-temporal/polyfill";
import type {
  CalendarEvent as ApiCalendarEvent,
  CalendarEventData,
  CalendarEventEnvelope,
  CalendarRecurrenceRule,
} from "@lit-calendar/events-api";
import {
  eventViewToApiEvent,
  type CalendarEventView,
} from "../../src/domain/events-api/eventMapBridge.js";
import { resolveLocale } from "../../src/utils/Locale.js";

export type CalendarEvent = ApiCalendarEvent;
export type CalendarEventSampleEntry = [string, ApiCalendarEvent];
export type CalendarTemporalEvent = ApiCalendarEvent;
export type CalendarTemporalEventEntry = [string, ApiCalendarEvent];

// Backward-compatible aliases for existing stories.
export type StoryEvent = CalendarEvent;
export type StoryEventEntry = CalendarEventSampleEntry;
export type WeekStoryEvent = CalendarTemporalEvent;
export type WeekStoryEventEntry = CalendarTemporalEventEntry;

type CalendarEventSeedInput = {
  envelope: Pick<
    CalendarEventEnvelope,
    "calendarId" | "eventId" | "recurrenceId" | "isException" | "isRecurring"
  >;
  content: {
    start: string;
    end: string;
    summary: string;
    color: string;
    location?: string;
    recurrenceRule?: {
      freq: CalendarRecurrenceRule["freq"];
      interval?: number;
      wkst?: CalendarRecurrenceRule["wkst"];
      bySecond?: number[];
      byMinute?: number[];
      byHour?: number[];
      byDay?: CalendarRecurrenceRule["byDay"];
      byMonthDay?: number[];
      byYearDay?: number[];
      byWeekNo?: number[];
      byMonth?: number[];
      bySetPos?: number[];
      until?: string;
      count?: number;
    };
    exclusionDates?: string[];
  };
};

export type CalendarEventSeedEntry = [string, CalendarEventSeedInput];

/** Nested envelope + `CalendarEventData` after parsing story date strings. */
export type StoryNestedCalendarEvent = {
  envelope: Pick<
    CalendarEventEnvelope,
    "calendarId" | "eventId" | "recurrenceId" | "isException" | "isRecurring"
  >;
  content: CalendarEventData;
};

const CALENDAR_IDS = {
  work: "/calendars/wouter/work/",
  personal: "/calendars/wouter/personal/",
  travel: "/calendars/wouter/travel/",
} as const;

export const sampleCalendarEvents: [string, StoryNestedCalendarEvent][] = (
  [
    [
      "event-flight-london-20250104",
      {
        envelope: { calendarId: CALENDAR_IDS.travel, eventId: "flight-london@example.test" },
        content: {
          start: "2025-01-04T08:30:00",
          end: "2025-01-05T09:45:00",
          summary: "Flight to London",
          color: "#4564B5",
          location: "Schiphol Airport",
        },
      },
    ],
    [
      "event-hello-world-20250103",
      {
        envelope: { calendarId: CALENDAR_IDS.work, eventId: "hello-world@example.test" },
        content: {
          start: "2025-01-03T12:00:00",
          end: "2025-01-07T18:00:00",
          summary: "Hello World",
          color: "#63e657",
        },
      },
    ],
    [
      "event-team-meeting-20250106",
      {
        envelope: { calendarId: CALENDAR_IDS.work, eventId: "team-meeting@example.test" },
        content: {
          start: "2025-01-06T10:00:00",
          end: "2025-01-07T11:15:00",
          summary: "Team Meeting",
          color: "#ff0000",
          location: "Room Atlas",
        },
      },
    ],
    [
      "event-amsterdam-zoned-20250104",
      {
        envelope: { calendarId: CALENDAR_IDS.travel, eventId: "amsterdam-zoned@example.test" },
        content: {
          start: "2025-01-04T12:00:00+01:00[Europe/Amsterdam]",
          end: "2025-01-06T13:30:00+01:00[Europe/Amsterdam]",
          summary: "Amsterdam Zoned Event",
          color: "#f59e0b",
        },
      },
    ],
    [
      "event-fiesta-20250106",
      {
        envelope: { calendarId: CALENDAR_IDS.personal, eventId: "fiesta@example.test" },
        content: {
          start: "2025-01-06T14:00:00",
          end: "2025-01-06T15:00:00",
          summary: "Fiesta",
          color: "#084cb8",
          location: "Cafe Mercado",
        },
      },
    ],
    [
      "event-drinks-20250108-1630",
      {
        envelope: {
          calendarId: CALENDAR_IDS.personal,
          eventId: "drinks-weekly@example.test",
        },
        content: {
          start: "2025-01-08T16:30:00",
          end: "2025-01-08T17:30:00",
          summary: "Drinks",
          color: "#9f3cfa",
          location: "Bar Noord",
          recurrenceRule: {
            freq: "WEEKLY",
            interval: 1,
            byDay: [{ day: "WE" }],
            until: "2025-02-28T00:00:00",
          },
          exclusionDates: ["20250122T163000"],
        },
      },
    ],
    [
      "event-daily-standup-20250113-0900",
      {
        envelope: {
          calendarId: CALENDAR_IDS.work,
          eventId: "daily-standup@example.test",
        },
        content: {
          start: "2025-01-13T09:00:00",
          end: "2025-01-13T09:15:00",
          summary: "Daily Standup",
          color: "#10B981",
          recurrenceRule: {
            freq: "DAILY",
            interval: 1,
            until: "2025-01-31T00:00:00",
          },
          exclusionDates: ["20250120T090000"],
        },
      },
    ],
    [
      "event-daily-standup-exception-20250118-1100",
      {
        envelope: {
          calendarId: CALENDAR_IDS.work,
          eventId: "daily-standup@example.test",
          recurrenceId: "20250118T090000",
        },
        content: {
          start: "2025-01-18T11:00:00",
          end: "2025-01-18T11:15:00",
          summary: "Daily Standup (moved)",
          color: "#10B981",
        },
      },
    ],
    [
      "event-all-day-ops-rotation-20250106",
      {
        envelope: {
          calendarId: CALENDAR_IDS.work,
          eventId: "all-day-ops-rotation@example.test",
        },
        content: {
          start: "2025-01-06",
          end: "2025-01-07",
          summary: "Ops Rotation (All day)",
          color: "#0EA5E9",
          recurrenceRule: {
            freq: "WEEKLY",
            interval: 1,
            byDay: [{ day: "MO" }],
            until: "2025-02-28",
          },
          exclusionDates: ["20250120"],
        },
      },
    ],
    [
      "event-all-day-ops-rotation-exception-20250120",
      {
        envelope: {
          calendarId: CALENDAR_IDS.work,
          eventId: "all-day-ops-rotation@example.test",
          recurrenceId: "20250120",
        },
        content: {
          start: "2025-01-21",
          end: "2025-01-22",
          summary: "Ops Rotation (moved to Tuesday)",
          color: "#0EA5E9",
        },
      },
    ],
    [
      "event-meeting-john-20250110",
      {
        envelope: { calendarId: CALENDAR_IDS.personal, eventId: "meeting-with-john@example.test" },
        content: {
          start: "2025-01-08",
          end: "2025-01-09",
          summary: "Meeting with John",
          color: "#E05ADD",
        },
      },
    ],
    [
      "event-company-holiday-20250101",
      {
        envelope: { calendarId: CALENDAR_IDS.work, eventId: "company-holiday@example.test" },
        content: {
          start: "2025-01-01",
          end: "2025-01-02",
          summary: "Company Holiday",
          color: "#0EA5E9",
        },
      },
    ],
    [
      "event-product-planning-20250106",
      {
        envelope: { calendarId: CALENDAR_IDS.work, eventId: "product-planning@example.test" },
        content: {
          start: "2025-01-06",
          end: "2025-01-08",
          summary: "Product Planning Sprint",
          color: "#22C55E",
        },
      },
    ],
    [
      "event-design-qa-20250112",
      {
        envelope: { calendarId: CALENDAR_IDS.work, eventId: "design-qa@example.test" },
        content: {
          start: "2025-01-12",
          end: "2025-01-14",
          summary: "Design QA Window",
          color: "#F97316",
        },
      },
    ],
    [
      "event-team-offsite-20250115",
      {
        envelope: { calendarId: CALENDAR_IDS.work, eventId: "team-offsite@example.test" },
        content: {
          start: "2025-01-15",
          end: "2025-01-18",
          summary: "Team Offsite",
          color: "#14B8A6",
        },
      },
    ],
    [
      "event-release-freeze-20250119",
      {
        envelope: { calendarId: CALENDAR_IDS.work, eventId: "release-freeze@example.test" },
        content: {
          start: "2025-01-19",
          end: "2025-01-21",
          summary: "Release Freeze",
          color: "#A855F7",
        },
      },
    ],
    [
      "event-feb5-design-review-20250205",
      {
        envelope: { calendarId: CALENDAR_IDS.work, eventId: "feb5-design-review@example.test" },
        content: {
          start: "2025-02-05",
          end: "2025-02-06",
          summary: "Design Review",
          color: "#6366F1",
        },
      },
    ],
    [
      "event-feb5-eng-sync-20250205",
      {
        envelope: { calendarId: CALENDAR_IDS.work, eventId: "feb5-eng-sync@example.test" },
        content: {
          start: "2025-02-05",
          end: "2025-02-06",
          summary: "Engineering Sync",
          color: "#0EA5E9",
        },
      },
    ],
  ] as Array<[id: string, event: CalendarEventSeedInput]>
).map(([id, event]) => [id, toCalendarEvent(event)]);

export const timezoneShiftCalendarEvents: [string, StoryNestedCalendarEvent][] = (
  [
    [
      "event-amsterdam-noon-zoned",
      {
        envelope: { calendarId: CALENDAR_IDS.travel, eventId: "amsterdam-noon-zoned@example.test" },
        content: {
          start: "2025-01-06T12:00:00+01:00[Europe/Amsterdam]",
          end: "2025-01-06T13:30:00+01:00[Europe/Amsterdam]",
          summary: "Amsterdam Noon (zoned)",
          color: "#f59e0b",
        },
      },
    ],
    [
      "event-local-baseline-0900",
      {
        envelope: { calendarId: CALENDAR_IDS.work, eventId: "local-baseline@example.test" },
        content: {
          start: "2025-01-06T09:00:00",
          end: "2025-01-06T10:00:00",
          summary: "Local baseline (plain)",
          color: "#4564B5",
        },
      },
    ],
  ] as Array<[id: string, event: CalendarEventSeedInput]>
).map(([id, event]) => [id, toCalendarEvent(event)]);

export function toTemporalDateLike(value: string): Temporal.PlainDateTime {
  if (!value.includes("T")) {
    return Temporal.PlainDate.from(value).toPlainDateTime({ hour: 0, minute: 0, second: 0 });
  }
  if (value.includes("[") && value.includes("]")) {
    return Temporal.ZonedDateTime.from(value).toPlainDateTime();
  }
  return Temporal.PlainDateTime.from(value);
}

function toCalendarEvent(event: CalendarEventSeedInput): StoryNestedCalendarEvent {
  let recurrenceRule: CalendarRecurrenceRule | undefined;
  if (event.content.recurrenceRule) {
    const { until, count, ...baseRule } = event.content.recurrenceRule;
    if (until !== undefined) {
      recurrenceRule = {
        ...baseRule,
        until: toTemporalDateLike(until),
      };
    } else if (count !== undefined) {
      recurrenceRule = {
        ...baseRule,
        count,
      };
    } else {
      recurrenceRule = baseRule;
    }
  }
  const dateOnlySeed =
    !event.content.start.includes("T") && !event.content.end.includes("T");
  return {
    envelope: { ...event.envelope },
    content: {
      start: toTemporalDateLike(event.content.start),
      end: toTemporalDateLike(event.content.end),
      allDay: dateOnlySeed ? true : undefined,
      summary: event.content.summary,
      color: event.content.color,
      location: event.content.location,
      recurrenceRule,
      exclusionDates: event.content.exclusionDates
        ? new Set(event.content.exclusionDates)
        : undefined,
    },
  };
}

function toCalendarEventView(event: StoryNestedCalendarEvent): CalendarEventView {
  return {
    ...event.envelope,
    ...event.content,
  };
}

export const sampleEvents: StoryEventEntry[] = sampleCalendarEvents.map(([id, event]) => [
  id,
  eventViewToApiEvent(toCalendarEventView(event)),
]);

export const timezoneShiftEvents: StoryEventEntry[] = timezoneShiftCalendarEvents.map(
  ([id, event]) => [id, eventViewToApiEvent(toCalendarEventView(event))]
);

export const weekSplitEvents: WeekStoryEventEntry[] = sampleEvents.map(([id, event]) => [
  id,
  {
    ...event,
    data: { ...event.data },
  },
]);

export const timezoneOptions =
  typeof Intl.supportedValuesOf === "function"
    ? Intl.supportedValuesOf("timeZone")
    : ["UTC", "Europe/Amsterdam", "America/New_York", "Asia/Tokyo"];

export const localeOptions = [
  "en-US",
  "en-GB",
  "nl-NL",
  "de-DE",
  "fr-FR",
  "es-ES",
  "it-IT",
  "pt-BR",
  "ja-JP",
  "zh-CN",
  "ar",
  "he",
];

export const AUTO_LOCALE_OPTION = "__auto-locale__";
export const AUTO_WEEK_START_OPTION = "auto";
export const resolvedStoryLocale = resolveLocale(undefined);
const weekDayLabels = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday",
} as const;
export const langControlOptions = [AUTO_LOCALE_OPTION, ...localeOptions];
export const langControlLabels = {
  [AUTO_LOCALE_OPTION]: `auto (${resolvedStoryLocale})`,
} as const;
export const weekStartControlOptions = [AUTO_WEEK_START_OPTION, 1, 2, 3, 4, 5, 6, 7] as const;
export const weekStartControlLabels = {
  [AUTO_WEEK_START_OPTION]: `auto`,
  ...weekDayLabels,
} as const;
