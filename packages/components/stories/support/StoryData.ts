import { Temporal } from "@js-temporal/polyfill";
import type {
  CalendarEvent as ApiCalendarEvent,
  CalendarEventsMap,
  IANATimeZone,
} from "@lit-calendar/events-api";
import { resolveLocale } from "../../src/utils/Locale.js";

export type CalendarEvent = ApiCalendarEvent;
export type CalendarEventSampleEntry = [string, ApiCalendarEvent];
export type CalendarTemporalEvent = ApiCalendarEvent;
export type CalendarTemporalEventEntry = [string, ApiCalendarEvent];

export type StoryEvent = CalendarEvent;
export type StoryEventEntry = CalendarEventSampleEntry;
export type WeekStoryEvent = CalendarTemporalEvent;
export type WeekStoryEventEntry = CalendarTemporalEventEntry;

/** Story `args.events`: default `CalendarEventsMap`, or an array of entries for controls. */
export type StoryEventsArg = CalendarEventsMap | Array<[string, CalendarEvent]>;

export function storyEventsFromArg(value: StoryEventsArg | undefined, fallback: CalendarEventsMap): CalendarEventsMap {
  if (value === undefined) return new Map(fallback);
  if (Array.isArray(value)) return new Map(value);
  return new Map(value);
}

const CALENDAR_IDS = {
  work: "/calendars/wouter/work/",
  personal: "/calendars/wouter/personal/",
  travel: "/calendars/wouter/travel/",
} as const;

const EUROPE_AMSTERDAM = "Europe/Amsterdam" as IANATimeZone;

function plainDayStart(isoDate: string): Temporal.PlainDateTime {
  return Temporal.PlainDate.from(isoDate).toPlainDateTime({ hour: 0, minute: 0, second: 0 });
}

export const sampleEventEntries: CalendarEventsMap = new Map<string, ApiCalendarEvent>([
  [
    "event-flight-london-20250104",
    {
      calendarId: CALENDAR_IDS.travel,
      eventId: "flight-london@example.test",
      data: {
        start: Temporal.PlainDateTime.from("2025-01-04T08:30:00"),
        end: Temporal.PlainDateTime.from("2025-01-05T09:45:00"),
        summary: "Flight to London",
        color: "#4564B5",
        location: "Schiphol Airport",
      },
    },
  ],
  [
    "event-hello-world-20250103",
    {
      calendarId: CALENDAR_IDS.work,
      eventId: "hello-world@example.test",
      data: {
        start: Temporal.PlainDateTime.from("2025-01-03T12:00:00"),
        end: Temporal.PlainDateTime.from("2025-01-07T18:00:00"),
        summary: "Hello World",
        color: "#63e657",
      },
    },
  ],
  [
    "event-team-meeting-20250106",
    {
      calendarId: CALENDAR_IDS.work,
      eventId: "team-meeting@example.test",
      data: {
        start: Temporal.PlainDateTime.from("2025-01-06T10:00:00"),
        end: Temporal.PlainDateTime.from("2025-01-07T11:15:00"),
        summary: "Team Meeting",
        color: "#ff0000",
        location: "Room Atlas",
      },
    },
  ],
  [
    "event-amsterdam-zoned-20250104",
    {
      calendarId: CALENDAR_IDS.travel,
      eventId: "amsterdam-zoned@example.test",
      data: {
        timeZone: EUROPE_AMSTERDAM,
        start: Temporal.PlainDateTime.from("2025-01-04T12:00:00"),
        end: Temporal.PlainDateTime.from("2025-01-06T13:30:00"),
        summary: "Amsterdam Zoned Event",
        color: "#f59e0b",
      },
    },
  ],
  [
    "event-fiesta-20250106",
    {
      calendarId: CALENDAR_IDS.personal,
      eventId: "fiesta@example.test",
      data: {
        start: Temporal.PlainDateTime.from("2025-01-06T14:00:00"),
        end: Temporal.PlainDateTime.from("2025-01-06T15:00:00"),
        summary: "Fiesta",
        color: "#084cb8",
        location: "Cafe Mercado",
      },
    },
  ],
  [
    "event-drinks-20250108-1630",
    {
      calendarId: CALENDAR_IDS.personal,
      eventId: "drinks-weekly@example.test",
      data: {
        start: Temporal.PlainDateTime.from("2025-01-08T16:30:00"),
        end: Temporal.PlainDateTime.from("2025-01-08T17:30:00"),
        summary: "Drinks",
        color: "#9f3cfa",
        location: "Bar Noord",
        recurrenceRule: {
          freq: "WEEKLY",
          interval: 1,
          byDay: [{ day: "WE" }],
          until: Temporal.PlainDateTime.from("2025-02-28T00:00:00"),
        },
        exclusionDates: new Set(["20250122T163000"]),
      },
    },
  ],
  [
    "event-daily-standup-20250113-0900",
    {
      calendarId: CALENDAR_IDS.work,
      eventId: "daily-standup@example.test",
      data: {
        start: Temporal.PlainDateTime.from("2025-01-13T09:00:00"),
        end: Temporal.PlainDateTime.from("2025-01-13T09:15:00"),
        summary: "Daily Standup",
        color: "#10B981",
        recurrenceRule: {
          freq: "DAILY",
          interval: 1,
          until: Temporal.PlainDateTime.from("2025-01-31T00:00:00"),
        },
        exclusionDates: new Set(["20250120T090000"]),
      },
    },
  ],
  [
    "event-daily-standup-exception-20250118-1100",
    {
      calendarId: CALENDAR_IDS.work,
      eventId: "daily-standup@example.test",
      recurrenceId: "20250118T090000",
      data: {
        start: Temporal.PlainDateTime.from("2025-01-18T11:00:00"),
        end: Temporal.PlainDateTime.from("2025-01-18T11:15:00"),
        summary: "Daily Standup (moved)",
        color: "#10B981",
      },
    },
  ],
  [
    "event-all-day-ops-rotation-20250106",
    {
      calendarId: CALENDAR_IDS.work,
      eventId: "all-day-ops-rotation@example.test",
      data: {
        start: plainDayStart("2025-01-06"),
        end: plainDayStart("2025-01-07"),
        allDay: true,
        summary: "Ops Rotation (All day)",
        color: "#0EA5E9",
        recurrenceRule: {
          freq: "WEEKLY",
          interval: 1,
          byDay: [{ day: "MO" }],
          until: plainDayStart("2025-02-28"),
        },
        exclusionDates: new Set(["20250120"]),
      },
    },
  ],
  [
    "event-all-day-ops-rotation-exception-20250120",
    {
      calendarId: CALENDAR_IDS.work,
      eventId: "all-day-ops-rotation@example.test",
      recurrenceId: "20250120",
      data: {
        start: plainDayStart("2025-01-21"),
        end: plainDayStart("2025-01-22"),
        allDay: true,
        summary: "Ops Rotation (moved to Tuesday)",
        color: "#0EA5E9",
      },
    },
  ],
  [
    "event-meeting-john-20250110",
    {
      calendarId: CALENDAR_IDS.personal,
      eventId: "meeting-with-john@example.test",
      data: {
        start: plainDayStart("2025-01-08"),
        end: plainDayStart("2025-01-09"),
        allDay: true,
        summary: "Meeting with John",
        color: "#E05ADD",
      },
    },
  ],
  [
    "event-company-holiday-20250101",
    {
      calendarId: CALENDAR_IDS.work,
      eventId: "company-holiday@example.test",
      data: {
        start: plainDayStart("2025-01-01"),
        end: plainDayStart("2025-01-02"),
        allDay: true,
        summary: "Company Holiday",
        color: "#0EA5E9",
      },
    },
  ],
  [
    "event-product-planning-20250106",
    {
      calendarId: CALENDAR_IDS.work,
      eventId: "product-planning@example.test",
      data: {
        start: plainDayStart("2025-01-06"),
        end: plainDayStart("2025-01-08"),
        allDay: true,
        summary: "Product Planning Sprint",
        color: "#22C55E",
      },
    },
  ],
  [
    "event-design-qa-20250112",
    {
      calendarId: CALENDAR_IDS.work,
      eventId: "design-qa@example.test",
      data: {
        start: plainDayStart("2025-01-12"),
        end: plainDayStart("2025-01-14"),
        allDay: true,
        summary: "Design QA Window",
        color: "#F97316",
      },
    },
  ],
  [
    "event-team-offsite-20250115",
    {
      calendarId: CALENDAR_IDS.work,
      eventId: "team-offsite@example.test",
      data: {
        start: plainDayStart("2025-01-15"),
        end: plainDayStart("2025-01-18"),
        allDay: true,
        summary: "Team Offsite",
        color: "#14B8A6",
      },
    },
  ],
  [
    "event-release-freeze-20250119",
    {
      calendarId: CALENDAR_IDS.work,
      eventId: "release-freeze@example.test",
      data: {
        start: plainDayStart("2025-01-19"),
        end: plainDayStart("2025-01-21"),
        allDay: true,
        summary: "Release Freeze",
        color: "#A855F7",
      },
    },
  ],
  [
    "event-feb5-design-review-20250205",
    {
      calendarId: CALENDAR_IDS.work,
      eventId: "feb5-design-review@example.test",
      data: {
        start: plainDayStart("2025-02-05"),
        end: plainDayStart("2025-02-06"),
        allDay: true,
        summary: "Design Review",
        color: "#6366F1",
      },
    },
  ],
  [
    "event-feb5-eng-sync-20250205",
    {
      calendarId: CALENDAR_IDS.work,
      eventId: "feb5-eng-sync@example.test",
      data: {
        start: plainDayStart("2025-02-05"),
        end: plainDayStart("2025-02-06"),
        allDay: true,
        summary: "Engineering Sync",
        color: "#0EA5E9",
      },
    },
  ],
]);

export const timezoneShiftEvents: CalendarEventsMap = new Map<string, ApiCalendarEvent>([
  [
    "event-amsterdam-noon-zoned",
    {
      calendarId: CALENDAR_IDS.travel,
      eventId: "amsterdam-noon-zoned@example.test",
      data: {
        timeZone: EUROPE_AMSTERDAM,
        start: Temporal.PlainDateTime.from("2025-01-06T12:00:00"),
        end: Temporal.PlainDateTime.from("2025-01-06T13:30:00"),
        summary: "Amsterdam Noon (zoned)",
        color: "#f59e0b",
      },
    },
  ],
  [
    "event-local-baseline-0900",
    {
      calendarId: CALENDAR_IDS.work,
      eventId: "local-baseline@example.test",
      data: {
        start: Temporal.PlainDateTime.from("2025-01-06T09:00:00"),
        end: Temporal.PlainDateTime.from("2025-01-06T10:00:00"),
        summary: "Local baseline (plain)",
        color: "#4564B5",
      },
    },
  ],
]);

export const sampleEvents: CalendarEventsMap = sampleEventEntries;

/** Shallow-cloned map so week split caches do not alias `sampleEvents` rows. */
export const weekSplitEvents: CalendarEventsMap = new Map(
  Array.from(sampleEvents.entries(), ([id, event]) => [
    id,
    {
      ...event,
      data: {
        ...event.data,
        exclusionDates: event.data.exclusionDates
          ? new Set(event.data.exclusionDates)
          : undefined,
      },
    },
  ])
);

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
