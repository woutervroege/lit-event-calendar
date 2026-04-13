import { Temporal } from "@js-temporal/polyfill";
import type {
  CalendarEvent as ApiCalendarEvent,
  CalendarEventsMap,
  CalendarsMap,
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

export function storyEventsFromArg(
  value: StoryEventsArg | undefined,
  fallback: CalendarEventsMap
): CalendarEventsMap {
  if (value === undefined) return new Map(fallback);
  if (Array.isArray(value)) return new Map(value);
  return new Map(value);
}

/** Calendar URLs used by {@link sampleEventEntries} and {@link sampleCalendarsMap}. */
export const storyCalendarIds = {
  work: "/calendars/wouter/work/",
  personal: "/calendars/wouter/personal/",
  travel: "/calendars/wouter/travel/",
} as const;

const EUROPE_AMSTERDAM = "Europe/Amsterdam" as IANATimeZone;

/** Display metadata for {@link storyCalendarIds}; matches event `calendarId` values in story data. */
export const sampleCalendarsMap: CalendarsMap = new Map([
  [storyCalendarIds.work, { displayName: "Work", color: "#63e657" }],
  [storyCalendarIds.personal, { displayName: "Personal", color: "#9f3cfa" }],
  [storyCalendarIds.travel, { displayName: "Travel", color: "#4564B5" }],
]);

/** Most events omit `data.color` so the UI resolves from {@link sampleCalendarsMap}; a few set `color` as override examples. */
export const sampleEventEntries: CalendarEventsMap = new Map<string, ApiCalendarEvent>([
  [
    "event-flight-london-20250104",
    {
      calendarId: storyCalendarIds.travel,
      eventId: "flight-london@example.test",
      data: {
        start: Temporal.PlainDateTime.from("2025-01-04T08:30:00"),
        end: Temporal.PlainDateTime.from("2025-01-05T09:45:00"),
        summary: "Flight to London",
        location: "Schiphol Airport",
      },
    },
  ],
  [
    "event-hello-world-20250103",
    {
      calendarId: storyCalendarIds.work,
      eventId: "hello-world@example.test",
      data: {
        start: Temporal.PlainDateTime.from("2025-01-03T12:00:00"),
        end: Temporal.PlainDateTime.from("2025-01-07T18:00:00"),
        summary: "Hello World",
      },
    },
  ],
  [
    "event-team-meeting-20250106",
    {
      calendarId: storyCalendarIds.work,
      eventId: "team-meeting@example.test",
      data: {
        start: Temporal.PlainDateTime.from("2025-01-06T10:00:00"),
        end: Temporal.PlainDateTime.from("2025-01-07T11:15:00"),
        summary: "Team Meeting",
        color: "#ff0000", // explicit override (work calendar is green)
        location: "Room Atlas",
      },
    },
  ],
  [
    "event-amsterdam-zoned-20250104",
    {
      calendarId: storyCalendarIds.travel,
      eventId: "amsterdam-zoned@example.test",
      data: {
        timeZone: EUROPE_AMSTERDAM,
        start: Temporal.PlainDateTime.from("2025-01-04T12:00:00"),
        end: Temporal.PlainDateTime.from("2025-01-06T13:30:00"),
        summary: "Amsterdam Zoned Event",
        color: "#f59e0b", // explicit override (travel calendar is blue)
      },
    },
  ],
  [
    "event-fiesta-20250106",
    {
      calendarId: storyCalendarIds.personal,
      eventId: "fiesta@example.test",
      data: {
        start: Temporal.PlainDateTime.from("2025-01-06T14:00:00"),
        end: Temporal.PlainDateTime.from("2025-01-06T15:00:00"),
        summary: "Fiesta",
        location: "Cafe Mercado",
      },
    },
  ],
  [
    "event-drinks-20250108-1630",
    {
      calendarId: storyCalendarIds.personal,
      eventId: "drinks-weekly@example.test",
      data: {
        start: Temporal.PlainDateTime.from("2025-01-08T16:30:00"),
        end: Temporal.PlainDateTime.from("2025-01-08T17:30:00"),
        summary: "Drinks",
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
      calendarId: storyCalendarIds.work,
      eventId: "daily-standup@example.test",
      data: {
        start: Temporal.PlainDateTime.from("2025-01-13T09:00:00"),
        end: Temporal.PlainDateTime.from("2025-01-13T09:15:00"),
        summary: "Daily Standup",
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
      calendarId: storyCalendarIds.work,
      eventId: "daily-standup@example.test",
      recurrenceId: "20250118T090000",
      data: {
        start: Temporal.PlainDateTime.from("2025-01-18T11:00:00"),
        end: Temporal.PlainDateTime.from("2025-01-18T11:15:00"),
        summary: "Daily Standup (moved)",
      },
    },
  ],
  [
    "event-all-day-ops-rotation-20250106",
    {
      calendarId: storyCalendarIds.work,
      eventId: "all-day-ops-rotation@example.test",
      data: {
        start: Temporal.PlainDateTime.from("2025-01-06T00:00:00"),
        end: Temporal.PlainDateTime.from("2025-01-07T00:00:00"),
        allDay: true,
        summary: "Ops Rotation (All day)",
        recurrenceRule: {
          freq: "WEEKLY",
          interval: 1,
          byDay: [{ day: "MO" }],
          until: Temporal.PlainDateTime.from("2025-02-28T00:00:00"),
        },
        exclusionDates: new Set(["20250120"]),
      },
    },
  ],
  [
    "event-all-day-ops-rotation-exception-20250120",
    {
      calendarId: storyCalendarIds.work,
      eventId: "all-day-ops-rotation@example.test",
      recurrenceId: "20250120",
      data: {
        start: Temporal.PlainDateTime.from("2025-01-21T00:00:00"),
        end: Temporal.PlainDateTime.from("2025-01-22T00:00:00"),
        allDay: true,
        summary: "Ops Rotation (moved to Tuesday)",
      },
    },
  ],
  [
    "event-meeting-john-20250110",
    {
      calendarId: storyCalendarIds.personal,
      eventId: "meeting-with-john@example.test",
      data: {
        start: Temporal.PlainDateTime.from("2025-01-08T00:00:00"),
        end: Temporal.PlainDateTime.from("2025-01-09T00:00:00"),
        allDay: true,
        summary: "Meeting with John",
        color: "#E05ADD", // explicit override (personal calendar is purple)
      },
    },
  ],
  [
    "event-company-holiday-20250101",
    {
      calendarId: storyCalendarIds.work,
      eventId: "company-holiday@example.test",
      data: {
        start: Temporal.PlainDateTime.from("2025-01-01T00:00:00"),
        end: Temporal.PlainDateTime.from("2025-01-02T00:00:00"),
        allDay: true,
        summary: "Company Holiday",
      },
    },
  ],
  [
    "event-product-planning-20250106",
    {
      calendarId: storyCalendarIds.work,
      eventId: "product-planning@example.test",
      data: {
        start: Temporal.PlainDateTime.from("2025-01-06T00:00:00"),
        end: Temporal.PlainDateTime.from("2025-01-08T00:00:00"),
        allDay: true,
        summary: "Product Planning Sprint",
      },
    },
  ],
  [
    "event-design-qa-20250112",
    {
      calendarId: storyCalendarIds.work,
      eventId: "design-qa@example.test",
      data: {
        start: Temporal.PlainDateTime.from("2025-01-12T00:00:00"),
        end: Temporal.PlainDateTime.from("2025-01-14T00:00:00"),
        allDay: true,
        summary: "Design QA Window",
      },
    },
  ],
  [
    "event-team-offsite-20250115",
    {
      calendarId: storyCalendarIds.work,
      eventId: "team-offsite@example.test",
      data: {
        start: Temporal.PlainDateTime.from("2025-01-15T00:00:00"),
        end: Temporal.PlainDateTime.from("2025-01-18T00:00:00"),
        allDay: true,
        summary: "Team Offsite",
      },
    },
  ],
  [
    "event-release-freeze-20250119",
    {
      calendarId: storyCalendarIds.work,
      eventId: "release-freeze@example.test",
      data: {
        start: Temporal.PlainDateTime.from("2025-01-19T00:00:00"),
        end: Temporal.PlainDateTime.from("2025-01-21T00:00:00"),
        allDay: true,
        summary: "Release Freeze",
      },
    },
  ],
  [
    "event-feb5-design-review-20250205",
    {
      calendarId: storyCalendarIds.work,
      eventId: "feb5-design-review@example.test",
      data: {
        start: Temporal.PlainDateTime.from("2025-02-05T00:00:00"),
        end: Temporal.PlainDateTime.from("2025-02-06T00:00:00"),
        allDay: true,
        summary: "Design Review",
      },
    },
  ],
  [
    "event-feb5-eng-sync-20250205",
    {
      calendarId: storyCalendarIds.work,
      eventId: "feb5-eng-sync@example.test",
      data: {
        start: Temporal.PlainDateTime.from("2025-02-05T00:00:00"),
        end: Temporal.PlainDateTime.from("2025-02-06T00:00:00"),
        allDay: true,
        summary: "Engineering Sync",
      },
    },
  ],
]);

export const timezoneShiftEvents: CalendarEventsMap = new Map<string, ApiCalendarEvent>([
  [
    "event-amsterdam-noon-zoned",
    {
      calendarId: storyCalendarIds.travel,
      eventId: "amsterdam-noon-zoned@example.test",
      data: {
        timeZone: EUROPE_AMSTERDAM,
        start: Temporal.PlainDateTime.from("2025-01-06T12:00:00"),
        end: Temporal.PlainDateTime.from("2025-01-06T13:30:00"),
        summary: "Amsterdam Noon (zoned)",
      },
    },
  ],
  [
    "event-local-baseline-0900",
    {
      calendarId: storyCalendarIds.work,
      eventId: "local-baseline@example.test",
      data: {
        start: Temporal.PlainDateTime.from("2025-01-06T09:00:00"),
        end: Temporal.PlainDateTime.from("2025-01-06T10:00:00"),
        summary: "Local baseline (plain)",
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
        exclusionDates: event.data.exclusionDates ? new Set(event.data.exclusionDates) : undefined,
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
