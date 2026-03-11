import { Temporal } from "@js-temporal/polyfill";

export type StoryEvent = {
  /**
   * iCalendar UID. Repeating events share the same uid.
   */
  uid: string;
  /**
   * iCalendar RECURRENCE-ID for a specific occurrence in a recurring series.
   */
  recurrenceId?: string;
  start: string;
  end: string;
  summary: string;
  color: string;
};

export type StoryEventEntry = [id: string, event: StoryEvent];

export type WeekStoryEvent = Omit<StoryEvent, "start" | "end"> & {
  start: Temporal.PlainDate | Temporal.PlainDateTime | Temporal.ZonedDateTime;
  end: Temporal.PlainDate | Temporal.PlainDateTime | Temporal.ZonedDateTime;
};

export type WeekStoryEventEntry = [id: string, event: WeekStoryEvent];

export const sampleEvents: StoryEventEntry[] = [
  [
    "event-flight-london-20250104",
    {
      uid: "flight-london@example.test",
      start: "2025-01-04T08:30:00",
      end: "2025-01-05T09:45:00",
      summary: "Flight to London",
      color: "#4564B5",
    },
  ],
  [
    "event-hello-world-20250103",
    {
      uid: "hello-world@example.test",
      start: "2025-01-03T12:00:00",
      end: "2025-01-07T18:00:00",
      summary: "Hello World",
      color: "#63e657",
    },
  ],
  [
    "event-team-meeting-20250106",
    {
      uid: "team-meeting@example.test",
      start: "2025-01-06T10:00:00",
      end: "2025-01-07T11:15:00",
      summary: "Team Meeting",
      color: "#ff0000",
    },
  ],
  [
    "event-amsterdam-zoned-20250104",
    {
      uid: "amsterdam-zoned@example.test",
      start: "2025-01-04T12:00:00+01:00[Europe/Amsterdam]",
      end: "2025-01-06T13:30:00+01:00[Europe/Amsterdam]",
      summary: "Amsterdam Zoned Event",
      color: "#f59e0b",
    },
  ],
  [
    "event-fiesta-20250106",
    {
      uid: "fiesta@example.test",
      start: "2025-01-06T14:00:00",
      end: "2025-01-06T15:00:00",
      summary: "Fiesta",
      color: "#084cb8",
    },
  ],
  [
    "event-drinks-20250108-1630",
    {
      uid: "drinks-weekly@example.test",
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
      uid: "drinks-weekly@example.test",
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
      uid: "more-drinks@example.test",
      start: "2025-01-08T19:00:00",
      end: "2025-01-09T00:30:00",
      summary: "More Drinks",
      color: "#084cb8",
    },
  ],
  [
    "event-even-more-drinks-20250108",
    {
      uid: "even-more-drinks@example.test",
      start: "2025-01-08T20:00:00",
      end: "2025-01-09T01:00:00",
      summary: "Even More Drinks",
      color: "#ff0000",
    },
  ],
  [
    "event-meeting-john-20250110",
    {
      uid: "meeting-with-john@example.test",
      start: "2025-01-08",
      end: "2025-01-09",
      summary: "Meeting with John",
      color: "#E05ADD",
    },
  ],
  [
    "event-company-holiday-20250101",
    {
      uid: "company-holiday@example.test",
      start: "2025-01-01",
      end: "2025-01-02",
      summary: "Company Holiday",
      color: "#0EA5E9",
    },
  ],
  [
    "event-product-planning-20250106",
    {
      uid: "product-planning@example.test",
      start: "2025-01-06",
      end: "2025-01-08",
      summary: "Product Planning Sprint",
      color: "#22C55E",
    },
  ],
  [
    "event-design-qa-20250112",
    {
      uid: "design-qa@example.test",
      start: "2025-01-12",
      end: "2025-01-14",
      summary: "Design QA Window",
      color: "#F97316",
    },
  ],
  [
    "event-team-offsite-20250115",
    {
      uid: "team-offsite@example.test",
      start: "2025-01-15",
      end: "2025-01-18",
      summary: "Team Offsite",
      color: "#14B8A6",
    },
  ],
  [
    "event-release-freeze-20250119",
    {
      uid: "release-freeze@example.test",
      start: "2025-01-19",
      end: "2025-01-21",
      summary: "Release Freeze",
      color: "#A855F7",
    },
  ],
];

export const timezoneShiftEvents: StoryEventEntry[] = [
  [
    "event-amsterdam-noon-zoned",
    {
      uid: "amsterdam-noon-zoned@example.test",
      start: "2025-01-06T12:00:00+01:00[Europe/Amsterdam]",
      end: "2025-01-06T13:30:00+01:00[Europe/Amsterdam]",
      summary: "Amsterdam Noon (zoned)",
      color: "#f59e0b",
    },
  ],
  [
    "event-local-baseline-0900",
    {
      uid: "local-baseline@example.test",
      start: "2025-01-06T09:00:00",
      end: "2025-01-06T10:00:00",
      summary: "Local baseline (plain)",
      color: "#4564B5",
    },
  ],
];

function toTemporalDateLike(value: string):
  | Temporal.PlainDate
  | Temporal.PlainDateTime
  | Temporal.ZonedDateTime {
  if (!value.includes("T")) {
    return Temporal.PlainDate.from(value);
  }
  if (value.includes("[") && value.includes("]")) {
    return Temporal.ZonedDateTime.from(value);
  }
  return Temporal.PlainDateTime.from(value);
}

export const weekSplitEvents: WeekStoryEventEntry[] = sampleEvents.map(([id, event]) => [
  id,
  {
    ...event,
    start: toTemporalDateLike(event.start),
    end: toTemporalDateLike(event.end),
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
