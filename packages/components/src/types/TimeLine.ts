export interface TimelineEvent {
  start: number;
  end: number;
  [key: string]: unknown;
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
