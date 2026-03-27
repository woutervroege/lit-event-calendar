import { Temporal } from "@js-temporal/polyfill";
import type {
  CalendarEvent as CalendarEventRecord,
  CalendarEventDateValue,
  CalendarEventEntry,
  CalendarEventView,
  CalendarEventViewEntry,
} from "./models/CalendarEvent.js";
export type { CalendarEvent as CalendarEventRecord } from "./models/CalendarEvent.js";

export type CalendarEvent = CalendarEventView;
export type CalendarEventSampleEntry = CalendarEventViewEntry;
export type CalendarTemporalEvent = Omit<CalendarEventView, "start" | "end"> & {
  start: CalendarEventDateValue;
  end: CalendarEventDateValue;
};
export type CalendarTemporalEventEntry = [id: string, event: CalendarTemporalEvent];

// Backward-compatible aliases for existing stories.
export type StoryEvent = CalendarEvent;
export type StoryEventEntry = CalendarEventSampleEntry;
export type WeekStoryEvent = CalendarTemporalEvent;
export type WeekStoryEventEntry = CalendarTemporalEventEntry;

type CalendarEventSeedInput = {
  envelope: CalendarEventRecord["envelope"];
  content: {
    start: string;
    end: string;
    summary: string;
    color: string;
  };
};

export const sampleCalendarEvents: CalendarEventEntry[] = ([
  [
    "event-flight-london-20250104",
    {
      envelope: { eventId: "flight-london@example.test" },
      content: {
        start: "2025-01-04T08:30:00",
        end: "2025-01-05T09:45:00",
        summary: "Flight to London",
        color: "#4564B5",
      },
    },
  ],
  [
    "event-hello-world-20250103",
    {
      envelope: { eventId: "hello-world@example.test" },
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
      envelope: { eventId: "team-meeting@example.test" },
      content: {
        start: "2025-01-06T10:00:00",
        end: "2025-01-07T11:15:00",
        summary: "Team Meeting",
        color: "#ff0000",
      },
    },
  ],
  [
    "event-amsterdam-zoned-20250104",
    {
      envelope: { eventId: "amsterdam-zoned@example.test" },
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
      envelope: { eventId: "fiesta@example.test" },
      content: {
        start: "2025-01-06T14:00:00",
        end: "2025-01-06T15:00:00",
        summary: "Fiesta",
        color: "#084cb8",
      },
    },
  ],
  [
    "event-drinks-20250108-1630",
    {
      envelope: {
        eventId: "drinks-weekly@example.test",
        recurrenceId: "20250108T163000",
      },
      content: {
        start: "2025-01-08T16:30:00",
        end: "2025-01-08T17:30:00",
        summary: "Drinks",
        color: "#9f3cfa",
      },
    },
  ],
  [
    "event-drinks-20250115-1630",
    {
      envelope: {
        eventId: "drinks-weekly@example.test",
        recurrenceId: "20250115T163000",
      },
      content: {
        start: "2025-01-15T16:30:00",
        end: "2025-01-15T17:30:00",
        summary: "Drinks",
        color: "#9f3cfa",
      },
    },
  ],
  [
    "event-meeting-john-20250110",
    {
      envelope: { eventId: "meeting-with-john@example.test" },
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
      envelope: { eventId: "company-holiday@example.test" },
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
      envelope: { eventId: "product-planning@example.test" },
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
      envelope: { eventId: "design-qa@example.test" },
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
      envelope: { eventId: "team-offsite@example.test" },
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
      envelope: { eventId: "release-freeze@example.test" },
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
      envelope: { eventId: "feb5-design-review@example.test" },
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
      envelope: { eventId: "feb5-eng-sync@example.test" },
      content: {
        start: "2025-02-05",
        end: "2025-02-06",
        summary: "Engineering Sync",
        color: "#0EA5E9",
      },
    },
  ],
  ] as Array<[id: string, event: CalendarEventSeedInput]>).map(([id, event]) => [
  id,
  toCalendarEvent(event),
]);

export const timezoneShiftCalendarEvents: CalendarEventEntry[] = ([
  [
    "event-amsterdam-noon-zoned",
    {
      envelope: { eventId: "amsterdam-noon-zoned@example.test" },
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
      envelope: { eventId: "local-baseline@example.test" },
      content: {
        start: "2025-01-06T09:00:00",
        end: "2025-01-06T10:00:00",
        summary: "Local baseline (plain)",
        color: "#4564B5",
      },
    },
  ],
  ] as Array<[id: string, event: CalendarEventSeedInput]>).map(([id, event]) => [
  id,
  toCalendarEvent(event),
]);

export function toTemporalDateLike(
  value: string
): Temporal.PlainDate | Temporal.PlainDateTime | Temporal.ZonedDateTime {
  if (!value.includes("T")) {
    return Temporal.PlainDate.from(value);
  }
  if (value.includes("[") && value.includes("]")) {
    return Temporal.ZonedDateTime.from(value);
  }
  return Temporal.PlainDateTime.from(value);
}

function toCalendarEvent(event: CalendarEventSeedInput): CalendarEventRecord {
  return {
    envelope: { ...event.envelope },
    content: {
      start: toTemporalDateLike(event.content.start),
      end: toTemporalDateLike(event.content.end),
      summary: event.content.summary,
      color: event.content.color,
    },
  };
}

function toCalendarEventView(event: CalendarEventRecord): CalendarEvent {
  return {
    ...event.envelope,
    ...event.content,
  };
}

export const sampleEvents: StoryEventEntry[] = sampleCalendarEvents.map(([id, event]) => [
  id,
  toCalendarEventView(event),
]);

export const timezoneShiftEvents: StoryEventEntry[] = timezoneShiftCalendarEvents.map(([id, event]) => [
  id,
  toCalendarEventView(event),
]);

export const weekSplitEvents: WeekStoryEventEntry[] = sampleEvents.map(([id, event]) => [
  id,
  { ...event },
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
