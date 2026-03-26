import { Temporal } from "@js-temporal/polyfill";

export type AllDayLayoutItem = {
  id: string;
  start: Temporal.PlainDate;
  endInclusive: Temporal.PlainDate;
};

type RowSegment = {
  rowIndex: number;
  startColIndex: number;
  endColIndex: number;
};

type PlacedRowSegment = RowSegment & {
  stackIndex: number;
};

type PlacedEvent = {
  id: string;
  segments: PlacedRowSegment[];
};

export type AllDayLayout = {
  placedEvents: PlacedEvent[];
  activeCountsByDay: Map<number, number>;
  maxEventsOnAnyDay: number;
  daysPerRow: number;
};

export function buildAllDayLayout({
  renderedDays,
  daysPerRow,
  items,
}: {
  renderedDays: Temporal.PlainDate[];
  daysPerRow: number;
  items: AllDayLayoutItem[];
}): AllDayLayout {
  const activeCountsByDay = new Map<number, number>();
  if (!renderedDays.length || daysPerRow <= 0 || !items.length) {
    return { placedEvents: [], activeCountsByDay, maxEventsOnAnyDay: 0, daysPerRow };
  }

  const placedEvents: PlacedEvent[] = [];
  const placedSegmentsByRow = new Map<number, PlacedRowSegment[]>();
  let maxEventsOnAnyDay = 0;

  for (const item of items) {
    const range = getVisibleIndexRange(renderedDays, item.start, item.endInclusive);
    if (!range) continue;

    for (let dayIndex = range.startIndex; dayIndex <= range.endIndex; dayIndex += 1) {
      const nextCount = (activeCountsByDay.get(dayIndex) ?? 0) + 1;
      activeCountsByDay.set(dayIndex, nextCount);
      maxEventsOnAnyDay = Math.max(maxEventsOnAnyDay, nextCount);
    }

    const segments = splitRangeIntoRowSegments(range.startIndex, range.endIndex, daysPerRow);
    const placedSegments: PlacedRowSegment[] = [];

    for (const segment of segments) {
      const rowSegments = placedSegmentsByRow.get(segment.rowIndex) ?? [];
      const occupied = new Set<number>();

      for (const placed of rowSegments) {
        const overlaps =
          placed.startColIndex <= segment.endColIndex &&
          placed.endColIndex >= segment.startColIndex;
        if (!overlaps) continue;
        occupied.add(placed.stackIndex);
      }

      let stackIndex = 0;
      while (occupied.has(stackIndex)) stackIndex += 1;

      const placedSegment: PlacedRowSegment = { ...segment, stackIndex };
      rowSegments.push(placedSegment);
      placedSegmentsByRow.set(segment.rowIndex, rowSegments);
      placedSegments.push(placedSegment);
    }

    placedEvents.push({
      id: item.id,
      segments: placedSegments,
    });
  }

  return { placedEvents, activeCountsByDay, maxEventsOnAnyDay, daysPerRow };
}

export function computeHiddenAllDayCountsByDay(
  layout: AllDayLayout,
  maxVisibleRows: number
): Map<number, number> {
  const hiddenCountsByDay = new Map<number, number>();
  if (!Number.isFinite(maxVisibleRows)) return hiddenCountsByDay;

  for (const eventLayout of layout.placedEvents) {
    const hiddenSegments = eventLayout.segments.filter(
      (segment) => segment.stackIndex >= maxVisibleRows
    );
    if (!hiddenSegments.length) continue;

    for (const segment of hiddenSegments) {
      for (let colIndex = segment.startColIndex; colIndex <= segment.endColIndex; colIndex += 1) {
        const dayIndex = segment.rowIndex * layout.daysPerRow + colIndex;
        hiddenCountsByDay.set(dayIndex, (hiddenCountsByDay.get(dayIndex) ?? 0) + 1);
      }
    }
  }

  return hiddenCountsByDay;
}

function getVisibleIndexRange(
  renderedDays: Temporal.PlainDate[],
  startInclusive: Temporal.PlainDate,
  endInclusive: Temporal.PlainDate
): { startIndex: number; endIndex: number } | null {
  if (Temporal.PlainDate.compare(endInclusive, startInclusive) < 0) return null;

  const firstVisibleDay = renderedDays[0];
  const lastVisibleDay = renderedDays[renderedDays.length - 1];
  if (Temporal.PlainDate.compare(endInclusive, firstVisibleDay) < 0) return null;
  if (Temporal.PlainDate.compare(startInclusive, lastVisibleDay) > 0) return null;

  let startIndex = 0;
  while (
    startIndex < renderedDays.length &&
    Temporal.PlainDate.compare(renderedDays[startIndex], startInclusive) < 0
  ) {
    startIndex += 1;
  }

  let endIndex = renderedDays.length - 1;
  while (endIndex >= 0 && Temporal.PlainDate.compare(renderedDays[endIndex], endInclusive) > 0) {
    endIndex -= 1;
  }

  if (startIndex > endIndex) return null;
  return { startIndex, endIndex };
}

function splitRangeIntoRowSegments(
  startIndex: number,
  endIndex: number,
  daysPerRow: number
): RowSegment[] {
  const rowStart = Math.floor(startIndex / daysPerRow);
  const rowEnd = Math.floor(endIndex / daysPerRow);
  const segments: RowSegment[] = [];

  for (let rowIndex = rowStart; rowIndex <= rowEnd; rowIndex += 1) {
    const rowStartIndex = rowIndex * daysPerRow;
    const rowEndIndex = rowStartIndex + daysPerRow - 1;
    const startColIndex = Math.max(startIndex, rowStartIndex) - rowStartIndex;
    const endColIndex = Math.min(endIndex, rowEndIndex) - rowStartIndex;
    segments.push({ rowIndex, startColIndex, endColIndex });
  }

  return segments;
}
