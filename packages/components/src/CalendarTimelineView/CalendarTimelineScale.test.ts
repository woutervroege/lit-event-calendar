import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";
import {
  type CalendarTimelineScale,
  alignedMonthGridStart,
  fromTimelineRange,
  fromTimelineValue,
  resolveTimelineEventFilter,
  timelineGridMax,
  toTimelineAllDayRange,
  toTimelineRange,
  toTimelineValue,
  visibleHoursWindow,
} from "./CalendarTimelineScale.js";

const MINUTES_PER_DAY = 24 * 60;

function minuteScale(): CalendarTimelineScale {
  return {
    startDate: Temporal.PlainDate.from("2025-01-05"),
    numDays: 7,
    unitsPerDay: MINUTES_PER_DAY,
  };
}

function coarseScale(): CalendarTimelineScale {
  return {
    startDate: Temporal.PlainDate.from("2025-01-05"),
    numDays: 7,
    unitsPerDay: 24,
  };
}

describe("toTimelineValue / fromTimelineValue round trip", () => {
  it("round-trips a datetime exactly with minute-granularity units", () => {
    const scale = minuteScale();
    const dateTime = Temporal.PlainDateTime.from("2025-01-07T09:30:00");
    const value = toTimelineValue(dateTime, scale);
    expect(value).toBe(2 * MINUTES_PER_DAY + 9 * 60 + 30);
    expect(fromTimelineValue(value, scale).toString()).toBe(dateTime.toString());
  });

  it("round-trips with fractional axis values (24 units per day)", () => {
    const scale = coarseScale();
    const dateTime = Temporal.PlainDateTime.from("2025-01-06T18:15:00");
    const value = toTimelineValue(dateTime, scale);
    expect(value).toBeCloseTo(24 + 18.25, 10);
    expect(fromTimelineValue(value, scale).toString()).toBe(dateTime.toString());
  });

  it("maps day boundaries onto whole multiples of unitsPerDay", () => {
    const scale = minuteScale();
    for (let day = 0; day <= scale.numDays; day++) {
      const boundary = scale.startDate.add({ days: day }).toPlainDateTime("00:00");
      expect(toTimelineValue(boundary, scale)).toBe(day * MINUTES_PER_DAY);
      expect(fromTimelineValue(day * MINUTES_PER_DAY, scale).toString()).toBe(
        boundary.toString()
      );
    }
  });
});

describe("gesture commit conversions (numeric commit -> datetimes)", () => {
  it("converts a moved numeric range back to shifted datetimes", () => {
    const scale = minuteScale();
    const start = Temporal.PlainDateTime.from("2025-01-06T10:00:00");
    const end = Temporal.PlainDateTime.from("2025-01-06T11:00:00");
    const original = toTimelineRange(start, end, scale);

    // Simulate a move commit: +90 minutes on the axis, duration preserved.
    const moved = fromTimelineRange(original.start + 90, original.end + 90, scale);
    expect(moved.start.toString()).toBe("2025-01-06T11:30:00");
    expect(moved.end.toString()).toBe("2025-01-06T12:30:00");
  });

  it("converts a resize-end commit while the start edge round-trips exactly", () => {
    const scale = minuteScale();
    const start = Temporal.PlainDateTime.from("2025-01-08T14:00:00");
    const end = Temporal.PlainDateTime.from("2025-01-08T15:00:00");
    const original = toTimelineRange(start, end, scale);

    const resized = fromTimelineRange(original.start, original.end + 45, scale);
    expect(resized.start.toString()).toBe(start.toString());
    expect(resized.end.toString()).toBe("2025-01-08T15:45:00");
  });

  it("moves across a day boundary land on the expected calendar day", () => {
    const scale = minuteScale();
    const start = Temporal.PlainDateTime.from("2025-01-05T23:00:00");
    const end = Temporal.PlainDateTime.from("2025-01-06T00:30:00");
    const original = toTimelineRange(start, end, scale);

    const moved = fromTimelineRange(
      original.start + MINUTES_PER_DAY,
      original.end + MINUTES_PER_DAY,
      scale
    );
    expect(moved.start.toString()).toBe("2025-01-06T23:00:00");
    expect(moved.end.toString()).toBe("2025-01-07T00:30:00");
  });

  it("whole-day rounding of an axis value matches the intended day boundary", () => {
    // Mirrors the all-day commit path: Math.round(value / unitsPerDay) days from startDate.
    const scale = minuteScale();
    const draggedTo = 3 * MINUTES_PER_DAY + 200; // partway into day 3
    const dayIndex = Math.round(draggedTo / scale.unitsPerDay);
    expect(dayIndex).toBe(3);
    const rounded = scale.startDate.add({ days: dayIndex }).toPlainDateTime("00:00");
    expect(rounded.toString()).toBe("2025-01-08T00:00:00");
    expect(toTimelineValue(rounded, scale)).toBe(3 * MINUTES_PER_DAY);
  });
});

describe("toTimelineAllDayRange", () => {
  it("snaps a timed event to its full day", () => {
    const scale = minuteScale();
    const range = toTimelineAllDayRange(
      Temporal.PlainDateTime.from("2025-01-06T09:00:00"),
      Temporal.PlainDateTime.from("2025-01-06T10:00:00"),
      scale
    );
    expect(range.start).toBe(1 * MINUTES_PER_DAY);
    expect(range.end).toBe(2 * MINUTES_PER_DAY);
  });

  it("keeps a midnight-exclusive end as-is", () => {
    const scale = minuteScale();
    const range = toTimelineAllDayRange(
      Temporal.PlainDateTime.from("2025-01-06T00:00:00"),
      Temporal.PlainDateTime.from("2025-01-08T00:00:00"),
      scale
    );
    expect(range.start).toBe(1 * MINUTES_PER_DAY);
    expect(range.end).toBe(3 * MINUTES_PER_DAY);
  });

  it("guarantees at least one day of span", () => {
    const scale = minuteScale();
    const start = Temporal.PlainDateTime.from("2025-01-06T00:00:00");
    const range = toTimelineAllDayRange(start, start, scale);
    expect(range.end - range.start).toBe(MINUTES_PER_DAY);
  });
});

describe("timelineGridMax", () => {
  it("is unitsPerDay * numDays", () => {
    expect(timelineGridMax(minuteScale())).toBe(7 * MINUTES_PER_DAY);
    expect(timelineGridMax(coarseScale())).toBe(7 * 24);
  });
});

describe("alignedMonthGridStart (month-mode 42-cell window)", () => {
  it("aligns the 1st of the month back to a Monday week start", () => {
    // 2025-01-01 is a Wednesday; Monday-aligned window starts 2024-12-30.
    const start = alignedMonthGridStart(Temporal.PlainDate.from("2025-01-15"), 1);
    expect(start.toString()).toBe("2024-12-30");
    expect(start.dayOfWeek).toBe(1);
  });

  it("aligns to a Sunday week start", () => {
    // Sunday on/before 2025-01-01 is 2024-12-29.
    const start = alignedMonthGridStart(Temporal.PlainDate.from("2025-01-15"), 7);
    expect(start.toString()).toBe("2024-12-29");
    expect(start.dayOfWeek).toBe(7);
  });

  it("keeps the 1st when it already falls on the week start", () => {
    // 2025-09-01 is a Monday.
    const start = alignedMonthGridStart(Temporal.PlainDate.from("2025-09-10"), 1);
    expect(start.toString()).toBe("2025-09-01");
  });

  it("covers the whole month within 42 cells", () => {
    for (const iso of ["2025-01-01", "2025-02-01", "2025-03-01", "2024-02-29"]) {
      const anchor = Temporal.PlainDate.from(iso);
      const start = alignedMonthGridStart(anchor, 1);
      const windowEnd = start.add({ days: 42 });
      const lastOfMonth = anchor.with({ day: anchor.daysInMonth });
      expect(Temporal.PlainDate.compare(start, anchor.with({ day: 1 }))).toBeLessThanOrEqual(0);
      expect(Temporal.PlainDate.compare(lastOfMonth, windowEnd)).toBeLessThan(0);
    }
  });
});

describe("resolveTimelineEventFilter (per-presentation all-day filtering)", () => {
  it("shows everything for timed presentations (gantt, horizontal timed)", () => {
    expect(resolveTimelineEventFilter(undefined, "timed")).toBe("all");
    expect(resolveTimelineEventFilter("timed", "timed")).toBe("all");
  });

  it("keeps only timed events for a preset all-day mapping (month day cells)", () => {
    expect(resolveTimelineEventFilter(undefined, "all-day")).toBe("timed-only");
  });

  it("keeps only all-day events for the explicit standalone all-day variant", () => {
    expect(resolveTimelineEventFilter("all-day", "all-day")).toBe("all-day-only");
  });
});

describe("visibleHoursWindow (grid visibleHours -> axis window)", () => {
  it("maps a sub-range of hours onto axis units", () => {
    // 8 visible hours starting at 08:00 with minute units: window 480–960.
    expect(visibleHoursWindow(MINUTES_PER_DAY, 8, 8)).toEqual({
      windowStart: 480,
      windowEnd: 960,
    });
  });

  it("defaults the start hour to 0", () => {
    expect(visibleHoursWindow(MINUTES_PER_DAY, 12)).toEqual({
      windowStart: 0,
      windowEnd: 720,
    });
  });

  it("clamps the start hour so the window stays within the day", () => {
    expect(visibleHoursWindow(MINUTES_PER_DAY, 8, 22)).toEqual({
      windowStart: 16 * 60,
      windowEnd: MINUTES_PER_DAY,
    });
  });

  it("returns the full range for unset or full-day values", () => {
    const full = { windowStart: 0, windowEnd: null };
    expect(visibleHoursWindow(MINUTES_PER_DAY, undefined)).toEqual(full);
    expect(visibleHoursWindow(MINUTES_PER_DAY, 24)).toEqual(full);
    expect(visibleHoursWindow(MINUTES_PER_DAY, 0)).toEqual(full);
    expect(visibleHoursWindow(MINUTES_PER_DAY, Number.NaN)).toEqual(full);
  });

  it("scales with non-minute axis units", () => {
    expect(visibleHoursWindow(24, 6, 9)).toEqual({ windowStart: 9, windowEnd: 15 });
  });
});
