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
