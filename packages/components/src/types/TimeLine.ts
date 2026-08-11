export interface TimelineEvent {
  start: number;
  end: number;
  [key: string]: unknown;
}

/**
 * Live numeric range (absolute axis units) of an in-progress move/resize gesture, passed as the
 * second `eventTemplate` argument for the dragged event so templates can render live labels.
 */
export interface TimelineEventPreviewRange {
  start: number;
  end: number;
}

export type TimelineResizeEdge = "start" | "end";

export interface TimelineEventResizeCommitDetail {
  index: number;
  edge: TimelineResizeEdge;
  start: number;
  end: number;
  previousStart: number;
  previousEnd: number;
}

export interface TimelineEventMoveCommitDetail {
  index: number;
  start: number;
  end: number;
  previousStart: number;
  previousEnd: number;
}

/** Numeric range (absolute axis units) committed by the drag-to-create gesture. */
export interface TimelineEventCreateDetail {
  start: number;
  end: number;
}
