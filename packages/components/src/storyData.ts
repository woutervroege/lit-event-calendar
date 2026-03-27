import { Temporal } from "@js-temporal/polyfill";
import type {
  CalendarEvent,
  CalendarEventDateValue,
} from "./models/CalendarEvent.js";
export type { CalendarEvent } from "./models/CalendarEvent.js";

export type CalendarEventSampleEntry = [id: string, event: CalendarEvent];
export type CalendarTemporalEvent = Omit<CalendarEvent, "start" | "end"> & {
  start: CalendarEventDateValue;
  end: CalendarEventDateValue;
};
export type CalendarTemporalEventEntry = [id: string, event: CalendarTemporalEvent];

// Backward-compatible aliases for existing stories.
export type StoryEvent = CalendarEvent;
export type StoryEventEntry = CalendarEventSampleEntry;
export type WeekStoryEvent = CalendarTemporalEvent;
export type WeekStoryEventEntry = CalendarTemporalEventEntry;

type RawStoryEvent = Omit<CalendarEvent, "start" | "end"> & {
  start: string;
  end: string;
};

const sampleEventSeeds: Array<[id: string, event: RawStoryEvent]> = [
  [
    "event-flight-london-20250104",
    {
      eventId: "flight-london@example.test",
      start: "2025-01-04T08:30:00",
      end: "2025-01-05T09:45:00",
      summary: "Flight to London",
      color: "#4564B5",
    },
  ],
  [
    "event-hello-world-20250103",
    {
      eventId: "hello-world@example.test",
      start: "2025-01-03T12:00:00",
      end: "2025-01-07T18:00:00",
      summary: "Hello World",
      color: "#63e657",
    },
  ],
  [
    "event-team-meeting-20250106",
    {
      eventId: "team-meeting@example.test",
      start: "2025-01-06T10:00:00",
      end: "2025-01-07T11:15:00",
      summary: "Team Meeting",
      color: "#ff0000",
    },
  ],
  [
    "event-amsterdam-zoned-20250104",
    {
      eventId: "amsterdam-zoned@example.test",
      start: "2025-01-04T12:00:00+01:00[Europe/Amsterdam]",
      end: "2025-01-06T13:30:00+01:00[Europe/Amsterdam]",
      summary: "Amsterdam Zoned Event",
      color: "#f59e0b",
    },
  ],
  [
    "event-fiesta-20250106",
    {
      eventId: "fiesta@example.test",
      start: "2025-01-06T14:00:00",
      end: "2025-01-06T15:00:00",
      summary: "Fiesta",
      color: "#084cb8",
    },
  ],
  [
    "event-drinks-20250108-1630",
    {
      eventId: "drinks-weekly@example.test",
      recurrenceId: "20250108T163000",
      start: "2025-01-08T16:30:00",
      end: "2025-01-08T17:30:00",
      summary: "Drinks",
      color: "#9f3cfa",
    },
  ],
  [
    "event-drinks-20250115-1630",
    {
      eventId: "drinks-weekly@example.test",
      recurrenceId: "20250115T163000",
      start: "2025-01-15T16:30:00",
      end: "2025-01-15T17:30:00",
      summary: "Drinks",
      color: "#9f3cfa",
    },
  ],
  [
    "event-more-drinks-20250108",
    {
      eventId: "more-drinks@example.test",
      start: "2025-01-08T19:00:00",
      end: "2025-01-09T00:30:00",
      summary: "More Drinks",
      color: "#084cb8",
    },
  ],
  [
    "event-even-more-drinks-20250108",
    {
      eventId: "even-more-drinks@example.test",
      start: "2025-01-08T20:00:00",
      end: "2025-01-09T01:00:00",
      summary: "Even More Drinks",
      color: "#ff0000",
    },
  ],
  [
    "event-meeting-john-20250110",
    {
      eventId: "meeting-with-john@example.test",
      start: "2025-01-08",
      end: "2025-01-09",
      summary: "Meeting with John",
      color: "#E05ADD",
    },
  ],
  [
    "event-company-holiday-20250101",
    {
      eventId: "company-holiday@example.test",
      start: "2025-01-01",
      end: "2025-01-02",
      summary: "Company Holiday",
      color: "#0EA5E9",
    },
  ],
  [
    "event-product-planning-20250106",
    {
      eventId: "product-planning@example.test",
      start: "2025-01-06",
      end: "2025-01-08",
      summary: "Product Planning Sprint",
      color: "#22C55E",
    },
  ],
  [
    "event-design-qa-20250112",
    {
      eventId: "design-qa@example.test",
      start: "2025-01-12",
      end: "2025-01-14",
      summary: "Design QA Window",
      color: "#F97316",
    },
  ],
  [
    "event-team-offsite-20250115",
    {
      eventId: "team-offsite@example.test",
      start: "2025-01-15",
      end: "2025-01-18",
      summary: "Team Offsite",
      color: "#14B8A6",
    },
  ],
  [
    "event-customer-summit-20250115",
    {
      eventId: "customer-summit@example.test",
      start: "2025-01-15",
      end: "2025-01-17",
      summary: "Customer Summit",
      color: "#EC4899",
    },
  ],
  [
    "event-hiring-panel-20250116",
    {
      eventId: "hiring-panel@example.test",
      start: "2025-01-16",
      end: "2025-01-18",
      summary: "Hiring Panel",
      color: "#F59E0B",
    },
  ],
  [
    "event-infra-migration-20250116",
    {
      eventId: "infra-migration@example.test",
      start: "2025-01-16",
      end: "2025-01-17",
      summary: "Infra Migration",
      color: "#06B6D4",
    },
  ],
  [
    "event-release-freeze-20250119",
    {
      eventId: "release-freeze@example.test",
      start: "2025-01-19",
      end: "2025-01-21",
      summary: "Release Freeze",
      color: "#A855F7",
    },
  ],
  [
    "event-feb5-design-review-20250205",
    {
      eventId: "feb5-design-review@example.test",
      start: "2025-02-05",
      end: "2025-02-06",
      summary: "Design Review",
      color: "#6366F1",
    },
  ],
  [
    "event-feb5-eng-sync-20250205",
    {
      eventId: "feb5-eng-sync@example.test",
      start: "2025-02-05",
      end: "2025-02-06",
      summary: "Engineering Sync",
      color: "#0EA5E9",
    },
  ],
  [
    "event-feb5-customer-call-20250205",
    {
      eventId: "feb5-customer-call@example.test",
      start: "2025-02-05",
      end: "2025-02-06",
      summary: "Customer Call",
      color: "#14B8A6",
    },
  ],
  [
    "event-feb5-roadmap-20250205",
    {
      eventId: "feb5-roadmap@example.test",
      start: "2025-02-05",
      end: "2025-02-06",
      summary: "Roadmap Session",
      color: "#22C55E",
    },
  ],
  [
    "event-feb5-budget-check-20250205",
    {
      eventId: "feb5-budget-check@example.test",
      start: "2025-02-05",
      end: "2025-02-06",
      summary: "Budget Check",
      color: "#F59E0B",
    },
  ],
  [
    "event-feb5-team-retro-20250205",
    {
      eventId: "feb5-team-retro@example.test",
      start: "2025-02-05",
      end: "2025-02-06",
      summary: "Team Retro",
      color: "#EF4444",
    },
  ],
  [
    "event-feb5-design-review-20250205",
    {
      eventId: "feb5-design-review@example.test",
      start: "2025-02-05",
      end: "2025-02-06",
      summary: "Design Review",
      color: "#6366F1",
    },
  ],
  [
    "event-feb5-eng-sync-20250205",
    {
      eventId: "feb5-eng-sync@example.test",
      start: "2025-02-05",
      end: "2025-02-06",
      summary: "Engineering Sync",
      color: "#0EA5E9",
    },
  ],
  [
    "event-feb5-customer-call-20250205",
    {
      eventId: "feb5-customer-call@example.test",
      start: "2025-02-05",
      end: "2025-02-06",
      summary: "Customer Call",
      color: "#14B8A6",
    },
  ],
  [
    "event-feb5-roadmap-20250205",
    {
      eventId: "feb5-roadmap@example.test",
      start: "2025-02-05",
      end: "2025-02-06",
      summary: "Roadmap Session",
      color: "#22C55E",
    },
  ],
  [
    "event-feb5-budget-check-20250205",
    {
      eventId: "feb5-budget-check@example.test",
      start: "2025-02-05",
      end: "2025-02-06",
      summary: "Budget Check",
      color: "#F59E0B",
    },
  ],
  [
    "event-feb5-team-retro-20250205",
    {
      eventId: "feb5-team-retro@example.test",
      start: "2025-02-05",
      end: "2025-02-06",
      summary: "Team Retro",
      color: "#EF4444",
    },
  ],
  [
    "event-feb5-design-review-20250205",
    {
      eventId: "feb5-design-review@example.test",
      start: "2025-02-05",
      end: "2025-02-06",
      summary: "Design Review",
      color: "#6366F1",
    },
  ],
  [
    "event-feb5-eng-sync-20250205",
    {
      eventId: "feb5-eng-sync@example.test",
      start: "2025-02-05",
      end: "2025-02-06",
      summary: "Engineering Sync",
      color: "#0EA5E9",
    },
  ],
  [
    "event-feb5-customer-call-20250205",
    {
      eventId: "feb5-customer-call@example.test",
      start: "2025-02-05",
      end: "2025-02-06",
      summary: "Customer Call",
      color: "#14B8A6",
    },
  ],
  [
    "event-feb5-roadmap-20250205",
    {
      eventId: "feb5-roadmap@example.test",
      start: "2025-02-05",
      end: "2025-02-06",
      summary: "Roadmap Session",
      color: "#22C55E",
    },
  ],
  [
    "event-feb5-budget-check-20250205",
    {
      eventId: "feb5-budget-check@example.test",
      start: "2025-02-05",
      end: "2025-02-06",
      summary: "Budget Check",
      color: "#F59E0B",
    },
  ],
  [
    "event-feb5-team-retro-20250205",
    {
      eventId: "feb5-team-retro@example.test",
      start: "2025-02-05",
      end: "2025-02-06",
      summary: "Team Retro",
      color: "#EF4444",
    },
  ],
];

const timezoneShiftEventSeeds: Array<[id: string, event: RawStoryEvent]> = [
  [
    "event-amsterdam-noon-zoned",
    {
      eventId: "amsterdam-noon-zoned@example.test",
      start: "2025-01-06T12:00:00+01:00[Europe/Amsterdam]",
      end: "2025-01-06T13:30:00+01:00[Europe/Amsterdam]",
      summary: "Amsterdam Noon (zoned)",
      color: "#f59e0b",
    },
  ],
  [
    "event-local-baseline-0900",
    {
      eventId: "local-baseline@example.test",
      start: "2025-01-06T09:00:00",
      end: "2025-01-06T10:00:00",
      summary: "Local baseline (plain)",
      color: "#4564B5",
    },
  ],
];

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

export const sampleEvents: StoryEventEntry[] = sampleEventSeeds.map(([id, event]) => [
  id,
  {
    ...event,
    start: toTemporalDateLike(event.start),
    end: toTemporalDateLike(event.end),
  },
]);

export const timezoneShiftEvents: StoryEventEntry[] = timezoneShiftEventSeeds.map(([id, event]) => [
  id,
  {
    ...event,
    start: toTemporalDateLike(event.start),
    end: toTemporalDateLike(event.end),
  },
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
