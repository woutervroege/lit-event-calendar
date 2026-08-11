import { Temporal } from "@js-temporal/polyfill";

const MINUTES_PER_DAY = 24 * 60;

export type CalendarTimelineScale = {
  startDate: Temporal.PlainDate;
  numDays: number;
  unitsPerDay: number;
};

function normalizeScale(scale: CalendarTimelineScale): {
  startDateTime: Temporal.PlainDateTime;
  unitsPerDay: number;
  numDays: number;
} {
  const startDateTime = scale.startDate.toPlainDateTime(Temporal.PlainTime.from("00:00"));
  const unitsPerDay = Math.max(1, Math.floor(Number(scale.unitsPerDay) || 1));
  const numDays = Math.max(1, Math.floor(Number(scale.numDays) || 1));
  return { startDateTime, unitsPerDay, numDays };
}

/** Converts a wall-clock datetime to absolute timeline units from `scale.startDate`. */
export function toTimelineValue(
  dateTime: Temporal.PlainDateTime,
  scale: CalendarTimelineScale
): number {
  const { startDateTime, unitsPerDay } = normalizeScale(scale);
  const minutesFromStart = startDateTime.until(dateTime).total({ unit: "minutes" });
  return (minutesFromStart * unitsPerDay) / MINUTES_PER_DAY;
}

/** Converts timeline units back to a wall-clock datetime from `scale.startDate`. */
export function fromTimelineValue(
  timelineValue: number,
  scale: CalendarTimelineScale
): Temporal.PlainDateTime {
  const { startDateTime, unitsPerDay } = normalizeScale(scale);
  const minutesFromStart = (timelineValue * MINUTES_PER_DAY) / unitsPerDay;
  const wholeMinutes = Math.trunc(minutesFromStart);
  const fractionalSeconds = Math.round((minutesFromStart - wholeMinutes) * 60);
  return startDateTime.add({ minutes: wholeMinutes, seconds: fractionalSeconds });
}

export function toTimelineRange(
  start: Temporal.PlainDateTime,
  end: Temporal.PlainDateTime,
  scale: CalendarTimelineScale
): { start: number; end: number } {
  return {
    start: toTimelineValue(start, scale),
    end: toTimelineValue(end, scale),
  };
}

function isMidnight(dateTime: Temporal.PlainDateTime): boolean {
  const time = dateTime.toPlainTime();
  return (
    time.hour === 0 &&
    time.minute === 0 &&
    time.second === 0 &&
    time.millisecond === 0 &&
    time.microsecond === 0 &&
    time.nanosecond === 0
  );
}

/**
 * Converts a time range into a day-snapped range:
 * - start snaps to start-of-day of the original start date
 * - end snaps to start-of-next-day when it has a time component
 * This is useful for "all-day plotting" without changing original times.
 */
export function toTimelineAllDayRange(
  start: Temporal.PlainDateTime,
  end: Temporal.PlainDateTime,
  scale: CalendarTimelineScale
): { start: number; end: number } {
  const dayStart = start.toPlainDate().toPlainDateTime(Temporal.PlainTime.from("00:00"));
  const endDate = isMidnight(end) ? end.toPlainDate() : end.toPlainDate().add({ days: 1 });
  let dayEndExclusive = endDate.toPlainDateTime(Temporal.PlainTime.from("00:00"));
  if (Temporal.PlainDateTime.compare(dayEndExclusive, dayStart) <= 0) {
    dayEndExclusive = dayStart.add({ days: 1 });
  }
  return toTimelineRange(dayStart, dayEndExclusive, scale);
}

export type TimelineEventFilter = "all" | "timed-only" | "all-day-only";

/**
 * Which events a single-timeline presentation should include:
 * - explicit `variant="all-day"` is the standalone all-day presentation → all-day events only
 * - a preset all-day mapping (month mode's day cells) → timed events only
 * - timed variants (gantt, horizontal timed) → everything, plotted with real ranges
 */
export function resolveTimelineEventFilter(
  explicitVariant: string | undefined,
  resolvedVariant: "timed" | "all-day"
): TimelineEventFilter {
  if (resolvedVariant !== "all-day") return "all";
  if (explicitVariant === "all-day") return "all-day-only";
  return "timed-only";
}

export function fromTimelineRange(
  start: number,
  end: number,
  scale: CalendarTimelineScale
): { start: Temporal.PlainDateTime; end: Temporal.PlainDateTime } {
  return {
    start: fromTimelineValue(start, scale),
    end: fromTimelineValue(end, scale),
  };
}

export function timelineGridMax(scale: CalendarTimelineScale): number {
  const { unitsPerDay, numDays } = normalizeScale(scale);
  return unitsPerDay * numDays;
}

/**
 * First cell of a month grid window: the week-start-aligned day on or before the 1st of
 * `monthAnchor`'s month (same alignment as `CalendarMonthView.startDate`).
 */
export function alignedMonthGridStart(
  monthAnchor: Temporal.PlainDate,
  weekStart: number
): Temporal.PlainDate {
  const firstOfMonth = monthAnchor.with({ day: 1 });
  const weekdayOffset = (firstOfMonth.dayOfWeek - weekStart + 7) % 7;
  return firstOfMonth.subtract({ days: weekdayOffset });
}

/**
 * Maps the grid views' `visibleHours` concept (+ optional start hour) onto TimeLine's per-cell
 * axis window. Returns the full range (`start: 0, end: null`) when `visibleHours` is unset or
 * covers the whole day. Note the semantic difference: the grid scrolls the remaining hours into
 * view, while the timeline axis window clips them (v1 limitation).
 */
export function visibleHoursWindow(
  unitsPerDay: number,
  visibleHours: number | undefined,
  visibleHoursStart?: number
): { windowStart: number; windowEnd: number | null } {
  const hours = Number(visibleHours);
  if (!Number.isFinite(hours) || hours <= 0) return { windowStart: 0, windowEnd: null };
  const clampedHours = Math.max(1, Math.min(24, Math.floor(hours)));
  const startRaw = Number(visibleHoursStart);
  const start = Number.isFinite(startRaw)
    ? Math.max(0, Math.min(24 - clampedHours, Math.floor(startRaw)))
    : 0;
  if (clampedHours >= 24) return { windowStart: 0, windowEnd: null };
  return {
    windowStart: (start / 24) * unitsPerDay,
    windowEnd: ((start + clampedHours) / 24) * unitsPerDay,
  };
}
