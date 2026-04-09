import { Temporal } from "@js-temporal/polyfill";
import type { CalendarEventDateValue, CalendarEventViewMap } from "../../types/CalendarEvent.js";
import { collectDetachedExceptionKeys, isExcludedOccurrence, toPlainDateTime, toRecurrenceId } from "./recurrence.js";

type ExpandEventsRange = {
  start: CalendarEventDateValue;
  end: CalendarEventDateValue;
};

type ExpandEventsOptions = {
  timezone?: string;
};

function fromPlainDateTime(
  value: Temporal.PlainDateTime,
  template: CalendarEventDateValue
): CalendarEventDateValue {
  if (template instanceof Temporal.PlainDate) return value.toPlainDate();
  if (template instanceof Temporal.ZonedDateTime) return value.toZonedDateTime(template.timeZoneId);
  return value;
}

function addByFrequency(
  value: Temporal.PlainDateTime,
  frequency: "SECONDLY" | "MINUTELY" | "HOURLY" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY",
  interval: number
): Temporal.PlainDateTime {
  if (frequency === "SECONDLY") return value.add({ seconds: interval });
  if (frequency === "MINUTELY") return value.add({ minutes: interval });
  if (frequency === "HOURLY") return value.add({ hours: interval });
  if (frequency === "DAILY") return value.add({ days: interval });
  if (frequency === "WEEKLY") return value.add({ weeks: interval });
  if (frequency === "MONTHLY") return value.add({ months: interval });
  return value.add({ years: interval });
}

const WEEKDAY_INDEX: Record<string, number> = {
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
  SU: 7,
};

function toCycleCandidates(
  anchorStart: Temporal.PlainDateTime,
  baseStart: Temporal.PlainDateTime,
  recurrenceRule: NonNullable<ReturnType<typeof resolveRecurrenceRule>>
): Temporal.PlainDateTime[] {
  if (recurrenceRule.freq === "WEEKLY" && recurrenceRule.byDay?.length) {
    const weekStartDow = WEEKDAY_INDEX[recurrenceRule.wkst ?? "MO"];
    const anchorDate = anchorStart.toPlainDate();
    const offsetToWeekStart = (anchorDate.dayOfWeek - weekStartDow + 7) % 7;
    const cycleWeekStart = anchorDate.subtract({ days: offsetToWeekStart });
    const weekdays = Array.from(
      new Set(recurrenceRule.byDay.map((weekday) => WEEKDAY_INDEX[weekday.day]))
    ).sort((left, right) => left - right);

    return weekdays.map((weekday) => {
      const offset = (weekday - weekStartDow + 7) % 7;
      return cycleWeekStart
        .add({ days: offset })
        .toPlainDateTime({
          hour: baseStart.hour,
          minute: baseStart.minute,
          second: baseStart.second,
          millisecond: baseStart.millisecond,
          microsecond: baseStart.microsecond,
          nanosecond: baseStart.nanosecond,
        });
    });
  }

  if (recurrenceRule.freq === "MONTHLY") {
    const year = anchorStart.year;
    const month = anchorStart.month;
    const monthStart = Temporal.PlainDate.from({ year, month, day: 1 });
    const daysInMonth = monthStart.daysInMonth;
    const monthDates = new Set<string>();

    const addMonthDate = (day: number) => {
      if (day < 1 || day > daysInMonth) return;
      monthDates.add(Temporal.PlainDate.from({ year, month, day }).toString());
    };

    if (recurrenceRule.byMonthDay?.length) {
      for (const monthDay of recurrenceRule.byMonthDay) {
        const resolvedDay = monthDay > 0 ? monthDay : daysInMonth + monthDay + 1;
        addMonthDate(resolvedDay);
      }
    }

    if (recurrenceRule.byDay?.length) {
      for (const byDayRule of recurrenceRule.byDay) {
        const dayOfWeek = WEEKDAY_INDEX[byDayRule.day];
        const matchingDays: number[] = [];
        for (let day = 1; day <= daysInMonth; day += 1) {
          if (Temporal.PlainDate.from({ year, month, day }).dayOfWeek === dayOfWeek) {
            matchingDays.push(day);
          }
        }

        if (byDayRule.ordinal !== undefined) {
          const index =
            byDayRule.ordinal > 0
              ? byDayRule.ordinal - 1
              : matchingDays.length + byDayRule.ordinal;
          if (index >= 0 && index < matchingDays.length) addMonthDate(matchingDays[index]);
          continue;
        }

        for (const day of matchingDays) addMonthDate(day);
      }
    }

    if (!recurrenceRule.byMonthDay?.length && !recurrenceRule.byDay?.length) {
      addMonthDate(Math.min(baseStart.day, daysInMonth));
    }

    let selectedDates = Array.from(monthDates).map((value) => Temporal.PlainDate.from(value));
    selectedDates.sort(Temporal.PlainDate.compare);

    if (recurrenceRule.bySetPos?.length && selectedDates.length > 0) {
      const pickedDates: Temporal.PlainDate[] = [];
      const seenDates = new Set<string>();
      for (const setPosition of recurrenceRule.bySetPos) {
        const index = setPosition > 0 ? setPosition - 1 : selectedDates.length + setPosition;
        if (index < 0 || index >= selectedDates.length) continue;
        const date = selectedDates[index];
        const key = date.toString();
        if (seenDates.has(key)) continue;
        seenDates.add(key);
        pickedDates.push(date);
      }
      selectedDates = pickedDates.sort(Temporal.PlainDate.compare);
    }

    return selectedDates.map((date) =>
      date.toPlainDateTime({
        hour: baseStart.hour,
        minute: baseStart.minute,
        second: baseStart.second,
        millisecond: baseStart.millisecond,
        microsecond: baseStart.microsecond,
        nanosecond: baseStart.nanosecond,
      })
    );
  }

  return [anchorStart];
}

function resolveRecurrenceRule(event: { recurrenceRule?: unknown }) {
  return event.recurrenceRule as
    | {
        freq: "SECONDLY" | "MINUTELY" | "HOURLY" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
        interval?: number;
        wkst?: "MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU";
        byDay?: Array<{ day: "MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU"; ordinal?: number }>;
        byMonthDay?: number[];
        bySetPos?: number[];
        until?: CalendarEventDateValue;
        count?: number;
      }
    | undefined;
}

function rangeOverlaps(
  start: Temporal.PlainDateTime,
  end: Temporal.PlainDateTime,
  rangeStart: Temporal.PlainDateTime,
  rangeEnd: Temporal.PlainDateTime
): boolean {
  if (Temporal.PlainDateTime.compare(end, start) <= 0) return false;
  return (
    Temporal.PlainDateTime.compare(start, rangeEnd) < 0 &&
    Temporal.PlainDateTime.compare(end, rangeStart) > 0
  );
}

export function expandEvents(
  events: CalendarEventViewMap,
  range: ExpandEventsRange,
  options: ExpandEventsOptions = {}
): CalendarEventViewMap {
  const rangeStart = toPlainDateTime(range.start, options.timezone);
  const rangeEnd = toPlainDateTime(range.end, options.timezone);
  if (Temporal.PlainDateTime.compare(rangeEnd, rangeStart) <= 0) return new Map();

  const detachedExceptionKeys = collectDetachedExceptionKeys(events);
  const renderedEvents: CalendarEventViewMap = new Map();

  for (const [id, event] of events) {
    if (event.pendingOp === "deleted") continue;
    const recurrenceRule = resolveRecurrenceRule(event);
    if (recurrenceRule && !event.recurrenceId) {
      const baseStart = toPlainDateTime(event.start, options.timezone);
      const baseEnd = toPlainDateTime(event.end, options.timezone);
      if (Temporal.PlainDateTime.compare(baseEnd, baseStart) <= 0) continue;
      const baseDuration = baseStart.until(baseEnd);

      const interval = Math.max(1, recurrenceRule.interval ?? 1);
      const until =
        "until" in recurrenceRule && recurrenceRule.until
          ? toPlainDateTime(recurrenceRule.until, options.timezone)
          : undefined;
      const count = "count" in recurrenceRule ? recurrenceRule.count : undefined;

      let generated = 0;
      let anchorStart = baseStart;

      while (true) {
        if (count !== undefined && generated >= count) break;
        const cycleCandidates = toCycleCandidates(anchorStart, baseStart, recurrenceRule);
        let shouldStop = false;

        for (const occurrenceStart of cycleCandidates) {
          if (Temporal.PlainDateTime.compare(occurrenceStart, baseStart) < 0) continue;
          if (until && Temporal.PlainDateTime.compare(occurrenceStart, until) > 0) {
            shouldStop = true;
            break;
          }
          if (Temporal.PlainDateTime.compare(occurrenceStart, rangeEnd) >= 0) {
            shouldStop = true;
            break;
          }

          const occurrenceEnd = occurrenceStart.add(baseDuration);
          const recurrenceId = toRecurrenceId(occurrenceStart, event.start);
          const hasDetachedException =
            Boolean(event.eventId) && detachedExceptionKeys.has(`${event.eventId}::${recurrenceId}`);
          if (
            !isExcludedOccurrence(event, recurrenceId) &&
            !hasDetachedException &&
            rangeOverlaps(occurrenceStart, occurrenceEnd, rangeStart, rangeEnd)
          ) {
            renderedEvents.set(`${id}::${recurrenceId}`, {
              ...event,
              recurrenceId,
              start: fromPlainDateTime(occurrenceStart, event.start),
              end: fromPlainDateTime(occurrenceEnd, event.end),
            });
          }

          generated += 1;
          if (count !== undefined && generated >= count) {
            shouldStop = true;
            break;
          }
        }

        if (shouldStop) break;

        const nextAnchorStart = addByFrequency(anchorStart, recurrenceRule.freq, interval);
        if (Temporal.PlainDateTime.compare(nextAnchorStart, anchorStart) <= 0) break;
        if (until && Temporal.PlainDateTime.compare(nextAnchorStart, until) > 0) break;
        if (Temporal.PlainDateTime.compare(nextAnchorStart, rangeEnd) >= 0) break;
        anchorStart = nextAnchorStart;
      }
      continue;
    }

    const start = toPlainDateTime(event.start, options.timezone);
    const end = toPlainDateTime(event.end, options.timezone);
    if (!rangeOverlaps(start, end, rangeStart, rangeEnd)) continue;
    renderedEvents.set(id, event);
  }
  return renderedEvents;
}

