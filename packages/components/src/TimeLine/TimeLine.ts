import {
  html,
  LitElement,
  nothing,
  type PropertyValues,
  type TemplateResult,
  unsafeCSS,
} from "lit";
import { customElement, property, state } from "lit/decorators.js";
import componentStyle from "./TimeLine.css?inline";
import "../ResizeHandle/ResizeHandle";
import type {
  TimelineEvent,
  TimelineEventCreateDetail,
  TimelineEventMoveCommitDetail,
  TimelineEventResizeCommitDetail,
  TimelineResizeEdge,
} from "../types/TimeLine";

type TimelineResizeSession = {
  pointerId: number;
  handle: HTMLElement;
  eventIndex: number;
  edge: TimelineResizeEdge;
  /** Absolute grid time under the pointer at pointerdown (same basis as `ev.start` / `ev.end`). */
  originPointerGridT: number;
  initialStart: number;
  initialEnd: number;
  horiz: boolean;
  gridMax: number;
};

type TimelineMoveSession = {
  pointerId: number;
  /** Host element so capture survives re-renders while the preview geometry updates. */
  captureTarget: HTMLElement;
  eventIndex: number;
  originPointerGridT: number;
  initialStart: number;
  initialEnd: number;
  horiz: boolean;
  gridMax: number;
};

type TimelineCreateSession = {
  pointerId: number;
  /** Host element so capture survives re-renders while the preview updates. */
  captureTarget: HTMLElement;
  originClientX: number;
  originClientY: number;
  /** Absolute grid time under the pointer at pointerdown (unsnapped). */
  originT: number;
  horiz: boolean;
  gridMax: number;
  /** Becomes true once the pointer travels past the drag threshold; plain clicks never commit. */
  dragging: boolean;
};

/** Pointer travel (px) required before a create gesture starts producing a preview. */
const CREATE_DRAG_THRESHOLD_PX = 4;

type TimelineCellEventSegment = {
  ev: TimelineEvent;
  index: number;
  segIndex: number;
  segStart: number;
  segEnd: number;
  rowSpan: number;
  showResizeStart: boolean;
  showResizeEnd: boolean;
};

type LaneLayout = { laneCount: number; laneByEventIndex: number[] };

type TimeLineGridLayout = {
  horiz: boolean;
  span: number;
  cellCount: number;
  gridMax: number;
};

@customElement("time-line")
export class TimeLine extends LitElement {
  @property({ type: Number }) accessor max = 100;
  @property({ type: Number }) accessor step = 10;

  // number of cells
  @property({ type: Number }) accessor cells = 3;

  @property({ type: Number }) accessor columns = 7;

  @property({ attribute: false })
  accessor headerTemplate: ((i: number) => TemplateResult) | undefined;

  @property({ attribute: false })
  accessor eventTemplate: (ev: TimelineEvent) => TemplateResult;

  @property({ attribute: false })
  accessor footerTemplate:
    | ((
        cellIndex: number,
        visibleEvents: TimelineEvent[],
        allCellEvents: TimelineEvent[]
      ) => TemplateResult)
    | undefined;

  @property({ type: String, reflect: true })
  accessor flow: "vertical" | "horizontal" = "vertical";

  /**
   * `timeline`: each overlapping event gets its own track (swimlane).
   * Horizontal: vertical lanes by time; vertical: horizontal columns by time.
   * `masonry`: pack overlaps into the fewest tracks — each event takes the lowest free lane at its
   * start (still-active intervals `end > start` share space evenly across that lane count).
   */
  @property({ type: String, reflect: true })
  accessor layout: "default" | "timeline" | "masonry" = "default";

  /** With horizontal `timeline` / `masonry`, omit event lanes that do not fit the cell (ResizeObserver). */
  @property({ type: String, reflect: true })
  accessor height: "auto" | undefined = undefined;

  @property({ type: Array })
  accessor events: TimelineEvent[] = [];

  /**
   * Marker values on the absolute axis (same coordinate space as event `start`/`end`; cell `i`
   * spans `[i * max, (i + 1) * max)`). Each renders a thin line inside its cell, themeable via
   * `--time-line-marker-color`. Values outside `[0, cells * max)` are ignored.
   */
  @property({ type: Array })
  accessor markers: number[] = [];

  /**
   * Start of the visible sub-range of each cell's `[0, max]` axis. Defaults to 0.
   * Only applied in vertical flow (v1); horizontal flow always shows the full range.
   */
  @property({ type: Number, attribute: "window-start" })
  accessor windowStart = 0;

  /**
   * End of the visible sub-range of each cell's `[0, max]` axis. `null` means `max`.
   * Only applied in vertical flow (v1); horizontal flow always shows the full range.
   */
  @property({ type: Number, attribute: "window-end" })
  accessor windowEnd: number | null = null;

  /** Optional hook; the same data is also dispatched as `timeline-event-resize`. */
  @property({ attribute: false })
  accessor onTimelineEventResize: ((detail: TimelineEventResizeCommitDetail) => void) | undefined;

  /** Optional hook; the same data is also dispatched as `timeline-event-move`. */
  @property({ attribute: false })
  accessor onTimelineEventMove: ((detail: TimelineEventMoveCommitDetail) => void) | undefined;

  /** Optional hook; the same data is also dispatched as `timeline-event-create`. */
  @property({ attribute: false })
  accessor onTimelineEventCreate: ((detail: TimelineEventCreateDetail) => void) | undefined;

  @state()
  private accessor resizePreviewByIndex: ReadonlyMap<
    number,
    { start: number; end: number }
  > | null = null;

  /** While moving an event, all its segments share the dragging affordance. */
  @state()
  private accessor draggingEventIndex: number | null = null;

  /** Snapped range shown while a drag-to-create gesture is in progress. */
  @state()
  private accessor createPreview: { start: number; end: number } | null = null;

  @state()
  private accessor cellVisibleLanes: number[] = [];

  private cellsResizeObserver: ResizeObserver | null = null;

  #resizeSession: TimelineResizeSession | null = null;

  #moveSession: TimelineMoveSession | null = null;

  #createSession: TimelineCreateSession | null = null;

  static styles = unsafeCSS(componentStyle);

  readonly #onResizeWindowPointerMove = (e: PointerEvent) => {
    const session = this.#resizeSession;
    if (!session || e.pointerId !== session.pointerId) return;
    if (e.cancelable) e.preventDefault();
    this.#applyResizePointer(e.clientX, e.clientY, session);
  };

  readonly #onResizeWindowPointerEnd = (e: PointerEvent) => {
    const session = this.#resizeSession;
    if (!session || e.pointerId !== session.pointerId) return;
    this.#finishResizeGesture(session, e.clientX, e.clientY, e.type === "pointercancel");
  };

  readonly #onMoveWindowPointerMove = (e: PointerEvent) => {
    const session = this.#moveSession;
    if (!session || e.pointerId !== session.pointerId) return;
    if (e.cancelable) e.preventDefault();
    this.#applyMovePointer(e.clientX, e.clientY, session);
  };

  readonly #onMoveWindowPointerEnd = (e: PointerEvent) => {
    const session = this.#moveSession;
    if (!session || e.pointerId !== session.pointerId) return;
    this.#finishMoveGesture(session, e.clientX, e.clientY, e.type === "pointercancel");
  };

  readonly #onCreateWindowPointerMove = (e: PointerEvent) => {
    const session = this.#createSession;
    if (!session || e.pointerId !== session.pointerId) return;
    if (e.cancelable) e.preventDefault();
    this.#applyCreatePointer(e.clientX, e.clientY, session);
  };

  readonly #onCreateWindowPointerEnd = (e: PointerEvent) => {
    const session = this.#createSession;
    if (!session || e.pointerId !== session.pointerId) return;
    this.#finishCreateGesture(session, e.clientX, e.clientY, e.type === "pointercancel");
  };

  readonly #onCreateWindowKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    const session = this.#createSession;
    if (!session) return;
    e.preventDefault();
    e.stopPropagation();
    this.#cancelCreateGesture(session);
  };

  private laneClip() {
    return (
      this.height === "auto" &&
      this.flow === "horizontal" &&
      (this.layout === "timeline" || this.layout === "masonry")
    );
  }

  private measureLaneCaps() {
    if (!this.laneClip()) return;
    const n = Math.max(1, this.cells);
    const br = this.renderRoot?.querySelector(".event")?.getBoundingClientRect();
    let lh =
      br && br.height > 0
        ? br.height
        : parseFloat(getComputedStyle(this).getPropertyValue("--__event-height")) || 32;
    lh = Math.max(lh, 1);
    const next = new Array<number>(n).fill(Infinity);
    for (const node of (this.renderRoot as ShadowRoot).querySelectorAll(".cell")) {
      const i = Number((node as HTMLElement).dataset.cell);
      if (!Number.isFinite(i) || i < 0 || i >= n) continue;
      const main = (node as HTMLElement).querySelector(".cell-main") as HTMLElement | null;
      const ch = (main?.clientHeight ?? (node as HTMLElement).clientHeight) || 0;
      next[i] = ch <= 0 ? Infinity : Math.floor(ch / lh);
    }
    if (
      next.length === this.cellVisibleLanes.length &&
      next.every((v, j) => v === this.cellVisibleLanes[j])
    )
      return;
    this.cellVisibleLanes = next;
  }

  disconnectedCallback() {
    const move = this.#moveSession;
    if (move) {
      this.#releasePointerCaptureSafe(move.captureTarget, move.pointerId);
    }
    const create = this.#createSession;
    if (create) {
      this.#releasePointerCaptureSafe(create.captureTarget, create.pointerId);
    }
    this.#detachResizeWindowListeners();
    this.#detachMoveWindowListeners();
    this.#detachCreateWindowListeners();
    this.#resizeSession = null;
    this.#moveSession = null;
    this.#createSession = null;
    this.resizePreviewByIndex = null;
    this.draggingEventIndex = null;
    this.createPreview = null;
    this.cellsResizeObserver?.disconnect();
    this.cellsResizeObserver = null;
    super.disconnectedCallback();
  }

  #detachResizeWindowListeners() {
    window.removeEventListener("pointermove", this.#onResizeWindowPointerMove, true);
    window.removeEventListener("pointerup", this.#onResizeWindowPointerEnd, true);
    window.removeEventListener("pointercancel", this.#onResizeWindowPointerEnd, true);
  }

  #detachMoveWindowListeners() {
    window.removeEventListener("pointermove", this.#onMoveWindowPointerMove, true);
    window.removeEventListener("pointerup", this.#onMoveWindowPointerEnd, true);
    window.removeEventListener("pointercancel", this.#onMoveWindowPointerEnd, true);
  }

  #detachCreateWindowListeners() {
    window.removeEventListener("pointermove", this.#onCreateWindowPointerMove, true);
    window.removeEventListener("pointerup", this.#onCreateWindowPointerEnd, true);
    window.removeEventListener("pointercancel", this.#onCreateWindowPointerEnd, true);
    window.removeEventListener("keydown", this.#onCreateWindowKeyDown, true);
  }

  #minGridStep(): number {
    return this.step > 0 ? this.step : 1;
  }

  #snapTime(t: number): number {
    const step = this.#minGridStep();
    return Math.round(t / step) * step;
  }

  #eventsForLayout(): TimelineEvent[] {
    const preview = this.resizePreviewByIndex;
    if (!preview?.size) return this.events;
    return this.events.map((ev, i) => {
      const p = preview.get(i);
      return p ? { ...ev, start: p.start, end: p.end } : ev;
    });
  }

  #attachResizeWindowListeners() {
    window.addEventListener("pointermove", this.#onResizeWindowPointerMove, true);
    window.addEventListener("pointerup", this.#onResizeWindowPointerEnd, true);
    window.addEventListener("pointercancel", this.#onResizeWindowPointerEnd, true);
  }

  #attachMoveWindowListeners() {
    window.addEventListener("pointermove", this.#onMoveWindowPointerMove, true);
    window.addEventListener("pointerup", this.#onMoveWindowPointerEnd, true);
    window.addEventListener("pointercancel", this.#onMoveWindowPointerEnd, true);
  }

  #attachCreateWindowListeners() {
    window.addEventListener("pointermove", this.#onCreateWindowPointerMove, true);
    window.addEventListener("pointerup", this.#onCreateWindowPointerEnd, true);
    window.addEventListener("pointercancel", this.#onCreateWindowPointerEnd, true);
    window.addEventListener("keydown", this.#onCreateWindowKeyDown, true);
  }

  #readGridLayout(): TimeLineGridLayout {
    const horiz = this.flow === "horizontal";
    const span = this.max > 0 ? this.max : 1;
    const cellCount = Math.max(1, this.cells);
    return { horiz, span, cellCount, gridMax: span * cellCount };
  }

  #pointerGridTime(
    clientX: number,
    clientY: number,
    layout: TimeLineGridLayout = this.#readGridLayout()
  ): number {
    return this.#gridTimeFromClient(
      clientX,
      clientY,
      layout.span,
      layout.cellCount,
      layout.horiz,
      layout.gridMax
    );
  }

  #releasePointerCaptureSafe(target: Element, pointerId: number) {
    try {
      target.releasePointerCapture(pointerId);
    } catch {
      // Ignore if capture was already released or unsupported.
    }
  }

  #beginSingleEventResizePreview(index: number, start: number, end: number) {
    const preview = new Map<number, { start: number; end: number }>();
    preview.set(index, { start, end });
    this.resizePreviewByIndex = preview;
  }

  #mergeResizePreviewRange(index: number, range: { start: number; end: number }) {
    const next = new Map(this.resizePreviewByIndex ?? []);
    next.set(index, range);
    this.resizePreviewByIndex = next;
  }

  /**
   * Effective visible sub-range of each cell's `[0, span]` axis. Returns the full range when no
   * (valid) window is set or in horizontal flow, where the window is not supported yet (v1).
   */
  #effectiveWindow(span: number): { w0: number; w1: number } {
    if (this.flow === "horizontal") return { w0: 0, w1: span };
    const w0 = Math.max(0, Math.min(this.windowStart, span));
    const w1 = Math.max(0, Math.min(this.windowEnd ?? span, span));
    if (!(Number.isFinite(w0) && Number.isFinite(w1)) || w1 <= w0) return { w0: 0, w1: span };
    return { w0, w1 };
  }

  /** Percent position of a cell-local time within the visible window (may fall outside 0–100). */
  #axisPct(tLocal: number, w0: number, w1: number): number {
    const range = w1 - w0;
    return range > 0 ? ((tLocal - w0) / range) * 100 : 0;
  }

  /**
   * Maps a screen point to absolute time on the grid [0, gridMax], using each cell’s `.cell-main`
   * as that cell’s span so resizing stays correct when the pointer moves across cells. When an
   * axis window is active, the cell geometry represents `[w0, w1]` instead of `[0, span]`.
   * In horizontal flow with RTL direction, time increases towards the left (logical insets).
   */
  #gridSampleFromCellMain(
    clientX: number,
    clientY: number,
    main: HTMLElement,
    cellIndex: number,
    span: number,
    horiz: boolean,
    rtl: boolean
  ): { distSq: number; t: number } | null {
    const r = main.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return null;
    const cx = Math.min(Math.max(clientX, r.left), r.right);
    const cy = Math.min(Math.max(clientY, r.top), r.bottom);
    const dx = clientX - cx;
    const dy = clientY - cy;
    const distSq = dx * dx + dy * dy;
    const along = horiz
      ? (rtl ? r.right - cx : cx - r.left) / r.width
      : (cy - r.top) / r.height;
    const frac = Math.min(1, Math.max(0, Number.isFinite(along) ? along : 0));
    const { w0, w1 } = this.#effectiveWindow(span);
    const t = cellIndex * span + w0 + frac * (w1 - w0);
    return { distSq, t };
  }

  #gridTimeFromClient(
    clientX: number,
    clientY: number,
    span: number,
    cellCount: number,
    horiz: boolean,
    gridMax: number
  ): number {
    const root = this.renderRoot as ShadowRoot | undefined;
    if (!root) return 0;

    const rtl = horiz && getComputedStyle(this).direction === "rtl";
    let bestT = 0;
    let bestDistSq = Infinity;

    for (const cellEl of root.querySelectorAll(".cell")) {
      if (!(cellEl instanceof HTMLElement)) continue;
      const cellIndex = Number(cellEl.dataset.cell);
      if (!Number.isFinite(cellIndex) || cellIndex < 0 || cellIndex >= cellCount) continue;
      const main = cellEl.querySelector(".cell-main");
      if (!(main instanceof HTMLElement)) continue;
      const sample = this.#gridSampleFromCellMain(
        clientX,
        clientY,
        main,
        cellIndex,
        span,
        horiz,
        rtl
      );
      if (!sample) continue;
      if (sample.distSq < bestDistSq) {
        bestDistSq = sample.distSq;
        bestT = sample.t;
      }
    }

    if (bestDistSq === Infinity) return 0;
    return Math.max(0, Math.min(gridMax, bestT));
  }

  #clampResizeRangeToMinDuration(
    nextStart: number,
    nextEnd: number,
    minStep: number,
    edge: TimelineResizeEdge,
    gridMax: number
  ): { start: number; end: number } {
    let start = nextStart;
    let end = nextEnd;
    if (end - start < minStep) {
      if (edge === "start") {
        start = Math.max(0, end - minStep);
      } else {
        end = Math.min(gridMax, start + minStep);
      }
    }
    if (start >= end) {
      if (edge === "start") {
        start = Math.max(0, end - minStep);
      } else {
        end = Math.min(gridMax, start + minStep);
      }
    }
    return { start, end };
  }

  #resizedRangeForPointer(
    session: TimelineResizeSession,
    pointerT: number
  ): {
    start: number;
    end: number;
  } | null {
    const ev = this.events[session.eventIndex];
    if (!ev) return null;

    const deltaT = pointerT - session.originPointerGridT;
    let nextStart = session.initialStart;
    let nextEnd = session.initialEnd;
    if (session.edge === "start") {
      nextStart = this.#snapTime(session.initialStart + deltaT);
    } else {
      nextEnd = this.#snapTime(session.initialEnd + deltaT);
    }

    const minStep = this.#minGridStep();
    nextStart = Math.max(0, Math.min(nextStart, session.gridMax));
    nextEnd = Math.max(0, Math.min(nextEnd, session.gridMax));

    return this.#clampResizeRangeToMinDuration(
      nextStart,
      nextEnd,
      minStep,
      session.edge,
      session.gridMax
    );
  }

  #applyResizePointer(clientX: number, clientY: number, session: TimelineResizeSession) {
    const span = this.max > 0 ? this.max : 1;
    const cellCount = Math.max(1, this.cells);
    const pointerT = this.#gridTimeFromClient(
      clientX,
      clientY,
      span,
      cellCount,
      session.horiz,
      session.gridMax
    );
    const range = this.#resizedRangeForPointer(session, pointerT);
    if (!range) return;
    this.#mergeResizePreviewRange(session.eventIndex, range);
  }

  #emitTimelineResizeCommit(detail: TimelineEventResizeCommitDetail) {
    this.dispatchEvent(
      new CustomEvent<TimelineEventResizeCommitDetail>("timeline-event-resize", {
        bubbles: true,
        composed: true,
        detail,
      })
    );
    this.onTimelineEventResize?.(detail);
  }

  #finishResizeGesture(
    session: TimelineResizeSession,
    clientX: number,
    clientY: number,
    cancelled: boolean
  ) {
    this.#detachResizeWindowListeners();
    this.#resizeSession = null;
    this.#releasePointerCaptureSafe(session.handle, session.pointerId);

    if (!cancelled) {
      this.#applyResizePointer(clientX, clientY, session);
    }

    const preview = cancelled ? undefined : this.resizePreviewByIndex?.get(session.eventIndex);
    const previousStart = session.initialStart;
    const previousEnd = session.initialEnd;
    this.resizePreviewByIndex = null;

    if (cancelled || !preview) return;
    if (preview.start === previousStart && preview.end === previousEnd) return;

    this.#emitTimelineResizeCommit({
      index: session.eventIndex,
      edge: session.edge,
      start: preview.start,
      end: preview.end,
      previousStart,
      previousEnd,
    });
  }

  #movedStartBounds(session: TimelineMoveSession, duration: number, minStep: number) {
    if (duration > minStep) {
      return { minStart: -duration + minStep, maxStart: session.gridMax - minStep };
    }
    return {
      minStart: Math.min(0, session.initialStart),
      maxStart: Math.max(session.gridMax, session.initialEnd) - duration,
    };
  }

  #movedRangeForPointer(
    session: TimelineMoveSession,
    pointerT: number
  ): {
    start: number;
    end: number;
  } | null {
    const ev = this.events[session.eventIndex];
    if (!ev) return null;

    const deltaT = pointerT - session.originPointerGridT;
    const duration = session.initialEnd - session.initialStart;
    const minStep = this.#minGridStep();
    let nextStart = this.#snapTime(session.initialStart + deltaT);
    const { minStart, maxStart } = this.#movedStartBounds(session, duration, minStep);
    nextStart = Math.max(minStart, Math.min(nextStart, maxStart));
    return { start: nextStart, end: nextStart + duration };
  }

  #applyMovePointer(clientX: number, clientY: number, session: TimelineMoveSession) {
    const span = this.max > 0 ? this.max : 1;
    const cellCount = Math.max(1, this.cells);
    const pointerT = this.#gridTimeFromClient(
      clientX,
      clientY,
      span,
      cellCount,
      session.horiz,
      session.gridMax
    );
    const range = this.#movedRangeForPointer(session, pointerT);
    if (!range) return;
    this.#mergeResizePreviewRange(session.eventIndex, range);
  }

  #emitTimelineMoveCommit(detail: TimelineEventMoveCommitDetail) {
    this.dispatchEvent(
      new CustomEvent<TimelineEventMoveCommitDetail>("timeline-event-move", {
        bubbles: true,
        composed: true,
        detail,
      })
    );
    this.onTimelineEventMove?.(detail);
  }

  #finishMoveGesture(
    session: TimelineMoveSession,
    clientX: number,
    clientY: number,
    cancelled: boolean
  ) {
    this.#detachMoveWindowListeners();
    this.#moveSession = null;
    this.#releasePointerCaptureSafe(session.captureTarget, session.pointerId);
    this.draggingEventIndex = null;

    if (!cancelled) {
      this.#applyMovePointer(clientX, clientY, session);
    }

    const preview = cancelled ? undefined : this.resizePreviewByIndex?.get(session.eventIndex);
    const previousStart = session.initialStart;
    const previousEnd = session.initialEnd;
    this.resizePreviewByIndex = null;

    if (cancelled || !preview) return;
    if (preview.start === previousStart && preview.end === previousEnd) return;

    this.#emitTimelineMoveCommit({
      index: session.eventIndex,
      start: preview.start,
      end: preview.end,
      previousStart,
      previousEnd,
    });
  }

  /**
   * Range between the gesture origin and the pointer, snapped outward to `step` with a minimum
   * duration of one `step`, clamped to the grid.
   */
  #createRangeForPointer(
    session: TimelineCreateSession,
    pointerT: number
  ): { start: number; end: number } {
    const step = this.#minGridStep();
    const lo = Math.min(session.originT, pointerT);
    const hi = Math.max(session.originT, pointerT);
    let start = Math.floor(lo / step) * step;
    let end = Math.ceil(hi / step) * step;
    if (end - start < step) end = start + step;
    start = Math.max(0, start);
    end = Math.min(session.gridMax, end);
    if (end - start < step) start = Math.max(0, end - step);
    return { start, end };
  }

  #applyCreatePointer(clientX: number, clientY: number, session: TimelineCreateSession) {
    if (!session.dragging) {
      const dx = clientX - session.originClientX;
      const dy = clientY - session.originClientY;
      if (dx * dx + dy * dy < CREATE_DRAG_THRESHOLD_PX * CREATE_DRAG_THRESHOLD_PX) return;
      session.dragging = true;
    }
    const span = this.max > 0 ? this.max : 1;
    const cellCount = Math.max(1, this.cells);
    const pointerT = this.#gridTimeFromClient(
      clientX,
      clientY,
      span,
      cellCount,
      session.horiz,
      session.gridMax
    );
    this.createPreview = this.#createRangeForPointer(session, pointerT);
  }

  #emitTimelineCreateCommit(detail: TimelineEventCreateDetail) {
    this.dispatchEvent(
      new CustomEvent<TimelineEventCreateDetail>("timeline-event-create", {
        bubbles: true,
        composed: true,
        detail,
      })
    );
    this.onTimelineEventCreate?.(detail);
  }

  #finishCreateGesture(
    session: TimelineCreateSession,
    clientX: number,
    clientY: number,
    cancelled: boolean
  ) {
    this.#detachCreateWindowListeners();
    this.#createSession = null;
    this.#releasePointerCaptureSafe(session.captureTarget, session.pointerId);

    if (!cancelled) {
      this.#applyCreatePointer(clientX, clientY, session);
    }

    const range = cancelled || !session.dragging ? null : this.createPreview;
    this.createPreview = null;
    if (!range) return;

    this.#emitTimelineCreateCommit({ start: range.start, end: range.end });
  }

  #cancelCreateGesture(session: TimelineCreateSession) {
    this.#detachCreateWindowListeners();
    this.#createSession = null;
    this.#releasePointerCaptureSafe(session.captureTarget, session.pointerId);
    this.createPreview = null;
  }

  #interactiveControlUnderPointer(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false;
    return Boolean(
      target.closest(
        'a[href], button:not([disabled]), input, textarea, select, [contenteditable="true"]'
      )
    );
  }

  #composedPathContainsResizeHandle(path: EventTarget[]): boolean {
    return path.some((n) => n instanceof Element && n.localName === "resize-handle");
  }

  #trySetPointerCapture(target: Element, pointerId: number) {
    try {
      target.setPointerCapture(pointerId);
    } catch {
      // Synthetic pointers may not support capture.
    }
  }

  #resizeHandleFromComposedPath(path: EventTarget[]): HTMLElement | null {
    const handle = path.find((n) => n instanceof HTMLElement && n.localName === "resize-handle");
    return handle instanceof HTMLElement ? handle : null;
  }

  #resizeEdgeFromHandle(handle: HTMLElement): TimelineResizeEdge | null {
    const position = handle.getAttribute("position");
    return position === "start" || position === "end" ? position : null;
  }

  #onEventBodyPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    if (this.#resizeSession || this.#moveSession) return;
    if (this.#interactiveControlUnderPointer(e.target)) return;
    if (this.#composedPathContainsResizeHandle(e.composedPath())) return;

    const eventEl = e.currentTarget;
    if (!(eventEl instanceof HTMLElement)) return;

    const index = Number(eventEl.dataset.index);
    if (!Number.isFinite(index) || index < 0 || index >= this.events.length) return;

    const ev = this.events[index];
    if (!ev) return;

    e.stopPropagation();
    if (e.cancelable) e.preventDefault();

    this.#trySetPointerCapture(this, e.pointerId);

    const layout = this.#readGridLayout();
    const originPointerGridT = this.#pointerGridTime(e.clientX, e.clientY, layout);

    this.#moveSession = {
      pointerId: e.pointerId,
      captureTarget: this,
      eventIndex: index,
      originPointerGridT,
      initialStart: ev.start,
      initialEnd: ev.end,
      horiz: layout.horiz,
      gridMax: layout.gridMax,
    };

    this.draggingEventIndex = index;
    this.#beginSingleEventResizePreview(index, ev.start, ev.end);
    this.#attachMoveWindowListeners();
  };

  #onResizeHandlePointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;

    const handle = this.#resizeHandleFromComposedPath(e.composedPath());
    if (!handle) return;

    const eventEl = handle.closest(".event");
    if (!(eventEl instanceof HTMLElement)) return;

    const index = Number(eventEl.dataset.index);
    if (!Number.isFinite(index) || index < 0 || index >= this.events.length) return;

    const edge = this.#resizeEdgeFromHandle(handle);
    if (!edge) return;

    const ev = this.events[index];
    if (!ev) return;

    e.stopPropagation();
    if (e.cancelable) e.preventDefault();

    this.#trySetPointerCapture(handle, e.pointerId);

    const layout = this.#readGridLayout();
    const originPointerGridT = this.#pointerGridTime(e.clientX, e.clientY, layout);

    this.#resizeSession = {
      pointerId: e.pointerId,
      handle,
      eventIndex: index,
      edge,
      originPointerGridT,
      initialStart: ev.start,
      initialEnd: ev.end,
      horiz: layout.horiz,
      gridMax: layout.gridMax,
    };

    this.#beginSingleEventResizePreview(index, ev.start, ev.end);
    this.#attachResizeWindowListeners();
  };

  /**
   * Drag on empty cell background creates a snapped range preview and commits it as
   * `timeline-event-create` on pointerup. Events and resize handles stop propagation of their own
   * pointerdown, so this only fires for the cell background; the composed-path checks are a
   * safety net.
   */
  #onCellMainPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    if (this.#resizeSession || this.#moveSession || this.#createSession) return;
    if (this.#interactiveControlUnderPointer(e.target)) return;
    const path = e.composedPath();
    if (this.#composedPathContainsResizeHandle(path)) return;
    if (path.some((n) => n instanceof Element && n.classList.contains("event"))) return;

    if (e.cancelable) e.preventDefault();
    this.#trySetPointerCapture(this, e.pointerId);

    const layout = this.#readGridLayout();
    const originT = this.#pointerGridTime(e.clientX, e.clientY, layout);

    this.#createSession = {
      pointerId: e.pointerId,
      captureTarget: this,
      originClientX: e.clientX,
      originClientY: e.clientY,
      originT,
      horiz: layout.horiz,
      gridMax: layout.gridMax,
      dragging: false,
    };

    this.#attachCreateWindowListeners();
  };

  protected updated(changed: PropertyValues) {
    super.updated(changed);
    if (!this.laneClip()) {
      this.cellsResizeObserver?.disconnect();
      this.cellsResizeObserver = null;
      if (this.cellVisibleLanes.length) this.cellVisibleLanes = [];
      return;
    }
    const cellsEl = this.renderRoot?.querySelector(".cells");
    const rebind =
      !this.cellsResizeObserver ||
      changed.has("height") ||
      changed.has("flow") ||
      changed.has("layout") ||
      changed.has("cells") ||
      changed.has("columns");
    if (rebind && cellsEl) {
      this.cellsResizeObserver?.disconnect();
      this.cellsResizeObserver = new ResizeObserver(() => this.measureLaneCaps());
      this.cellsResizeObserver.observe(cellsEl);
    }
    queueMicrotask(() => this.measureLaneCaps());
  }

  /** Resize UI belongs only on the event’s first and last grid segments (not row/cell continuations). */
  private segmentResizeHandleFlags(
    segmentAbsStart: number,
    segmentAbsEnd: number,
    evStart: number,
    evEndClamped: number,
    evEndRaw: number,
    gridMax: number
  ): { showResizeStart: boolean; showResizeEnd: boolean } {
    const eps = 1e-6;
    const atLogicalStart = Math.abs(segmentAbsStart - evStart) < eps;
    const atClampedEnd = Math.abs(segmentAbsEnd - evEndClamped) < eps;
    return {
      showResizeStart: atLogicalStart && evStart >= 0,
      showResizeEnd: atClampedEnd && evEndRaw <= gridMax + eps,
    };
  }

  /** Whether `ev` overlaps this cell’s absolute time range (includes continuations from earlier cells). */
  private eventOverlapsCell(
    ev: TimelineEvent,
    cell: number,
    span: number,
    gridMax: number
  ): boolean {
    const t0 = cell * span;
    const t1 = Math.min((cell + 1) * span, gridMax);
    const evEnd = Math.min(ev.end, gridMax);
    return ev.start < t1 && evEnd > t0;
  }

  /**
   * Smallest per-cell lane cap along a horizontal segment (cells `cellStart` … `cellStart + rowSpan`),
   * clamped to the row. Hides the bar if any spanned cell cannot fit the lane.
   */
  private minLaneCapAcrossSpan(
    cellStart: number,
    rowSpan: number,
    cols: number,
    cellCount: number
  ): number {
    const C = Math.max(1, cols);
    const row = Math.floor(cellStart / C);
    const rowFirst = row * C;
    const rowLast = Math.min((row + 1) * C, cellCount) - 1;
    if (rowLast < rowFirst) return Infinity;
    const cellEnd = Math.min(cellStart + rowSpan, rowLast);
    let minCap = Infinity;
    for (let k = Math.max(cellStart, rowFirst); k <= cellEnd; k++) {
      minCap = Math.min(minCap, this.cellVisibleLanes[k] ?? Infinity);
    }
    return minCap;
  }

  /** Smallest lane cap among all cells in `row` that `ev` overlaps (that row’s time band only). */
  private minLaneCapForEventInRow(
    ev: TimelineEvent,
    row: number,
    cols: number,
    span: number,
    gridMax: number,
    cellCount: number
  ): number {
    const C = Math.max(1, cols);
    const rowFirst = row * C;
    const rowLast = Math.min((row + 1) * C, cellCount) - 1;
    if (rowLast < rowFirst) return Infinity;

    const tRow0 = rowFirst * span;
    const tRow1 = Math.min((row + 1) * C * span, gridMax);
    const evEnd = Math.min(ev.end, gridMax);
    const t0 = Math.max(ev.start, tRow0);
    const t1 = Math.min(evEnd, tRow1);
    if (t0 >= t1) return Infinity;

    const cStart = Math.floor(t0 / span);
    const cEnd = Math.min(Math.floor((t1 - Number.EPSILON) / span), rowLast);

    let minCap = Infinity;
    for (let k = Math.max(cStart, rowFirst); k <= Math.min(cEnd, rowLast); k++) {
      minCap = Math.min(minCap, this.cellVisibleLanes[k] ?? Infinity);
    }
    return minCap;
  }

  /** Greedy lowest-lane packing; intervals are [start, end). */
  private masonryLanes(events: TimelineEvent[]): number[] {
    const order = events
      .map((ev, i) => ({ ev, i }))
      .sort((a, b) => a.ev.start - b.ev.start || a.i - b.i);
    const ends: number[] = [];
    const lanes = new Array<number>(events.length);
    for (const { ev, i } of order) {
      let L = 0;
      while (L < ends.length && (ends[L] ?? 0) > ev.start) L++;
      if (L === ends.length) ends.push(ev.end);
      else ends[L] = ev.end;
      lanes[i] = L;
    }
    return lanes;
  }

  /** Per grid row: dense lanes and count, using only events that overlap that row’s time span. */
  private rowLaneLayouts(
    events: TimelineEvent[],
    mode: "timeline" | "masonry",
    cellCount: number,
    cols: number,
    span: number,
    gridMax: number
  ): LaneLayout[] {
    const C = Math.max(1, cols);
    const rows: LaneLayout[] = [];
    for (let r = 0, n = Math.ceil(cellCount / C); r < n; r++) {
      const t0 = r * C * span;
      const t1 = Math.min((r + 1) * C, cellCount) * span;
      const inRow = events
        .map((ev, i) => ({ ev, i }))
        .filter(({ ev }) => ev.start < t1 && Math.min(ev.end, gridMax) > t0);
      if (!inRow.length) {
        rows.push({ laneCount: 1, laneByEventIndex: [] });
        continue;
      }
      const laneByEventIndex = new Array<number>(events.length);
      let laneCount: number;
      if (mode === "timeline") {
        inRow.sort((a, b) => a.i - b.i);
        for (let L = 0; L < inRow.length; L++) {
          const item = inRow[L];
          if (item) laneByEventIndex[item.i] = L;
        }
        laneCount = inRow.length;
      } else {
        const subLanes = this.masonryLanes(inRow.map((x) => x.ev));
        for (let j = 0; j < inRow.length; j++) {
          const item = inRow[j];
          if (item) laneByEventIndex[item.i] = subLanes[j] ?? 0;
        }
        laneCount = Math.max(...subLanes, 0) + 1;
      }
      rows.push({ laneCount: Math.max(1, laneCount), laneByEventIndex });
    }
    return rows;
  }

  /** Per cell (vertical flow): lane index and count for splitting width between overlapping events. */
  private verticalCellLaneLayouts(
    events: TimelineEvent[],
    mode: "timeline" | "masonry",
    cellCount: number,
    span: number,
    gridMax: number
  ): LaneLayout[] {
    const layouts: LaneLayout[] = [];
    for (let cell = 0; cell < cellCount; cell++) {
      const inCell = events
        .map((ev, i) => ({ ev, i }))
        .filter(({ ev }) => this.eventOverlapsCell(ev, cell, span, gridMax));
      const laneByEventIndex = new Array<number>(events.length);
      if (!inCell.length) {
        layouts.push({ laneCount: 1, laneByEventIndex });
        continue;
      }
      let laneCount: number;
      if (mode === "timeline") {
        inCell.sort((a, b) => a.i - b.i);
        for (let L = 0; L < inCell.length; L++) {
          const item = inCell[L];
          if (item) laneByEventIndex[item.i] = L;
        }
        laneCount = inCell.length;
      } else {
        const subLanes = this.masonryLanes(inCell.map((x) => x.ev));
        for (let j = 0; j < inCell.length; j++) {
          const item = inCell[j];
          if (item) laneByEventIndex[item.i] = subLanes[j] ?? 0;
        }
        laneCount = Math.max(...subLanes, 0) + 1;
      }
      layouts.push({ laneCount: Math.max(1, laneCount), laneByEventIndex });
    }
    return layouts;
  }

  #laneIndexForEvent(
    horiz: boolean,
    rl: LaneLayout | null | undefined,
    vl: LaneLayout | null | undefined,
    eventIndex: number
  ): number {
    return (horiz ? rl?.laneByEventIndex[eventIndex] : vl?.laneByEventIndex[eventIndex]) ?? 0;
  }

  #collectSegmentsForEventInCell(
    ev: TimelineEvent,
    eventIndex: number,
    cell: number,
    horiz: boolean,
    cols: number,
    span: number,
    gridMax: number
  ): TimelineCellEventSegment[] {
    const segments: TimelineCellEventSegment[] = [];
    const evEnd = Math.min(ev.end, gridMax);
    let t = ev.start;
    let segIndex = 0;
    while (t < evEnd) {
      const c0 = Math.floor(t / span);
      const row = Math.floor(c0 / cols);
      const segEndAbs = horiz
        ? Math.min(evEnd, (row + 1) * cols * span)
        : Math.min(evEnd, (c0 + 1) * span);
      const c1 = horiz
        ? Math.min(Math.floor((segEndAbs - Number.EPSILON) / span), (row + 1) * cols - 1)
        : c0;
      if (c0 === cell) {
        const { showResizeStart, showResizeEnd } = this.segmentResizeHandleFlags(
          t,
          segEndAbs,
          ev.start,
          evEnd,
          ev.end,
          gridMax
        );
        segments.push({
          ev,
          index: eventIndex,
          segIndex,
          segStart: t - c0 * span,
          segEnd: segEndAbs - c1 * span,
          rowSpan: horiz ? c1 - c0 : 0,
          showResizeStart,
          showResizeEnd,
        });
      }
      t = segEndAbs;
      segIndex++;
    }
    return segments;
  }

  #segmentsInCell(
    layoutEvents: TimelineEvent[],
    cell: number,
    horiz: boolean,
    cols: number,
    span: number,
    gridMax: number
  ): TimelineCellEventSegment[] {
    return layoutEvents.flatMap((ev, i) =>
      this.#collectSegmentsForEventInCell(ev, i, cell, horiz, cols, span, gridMax)
    );
  }

  #segmentVisibleUnderLaneClip(
    clip: boolean,
    horiz: boolean,
    eventIndex: number,
    rowSpan: number,
    cell: number,
    cols: number,
    cellCount: number,
    rl: LaneLayout | null | undefined,
    vl: LaneLayout | null | undefined
  ): boolean {
    if (!clip) return true;
    const lane = this.#laneIndexForEvent(horiz, rl, vl, eventIndex);
    const effectiveCap = horiz
      ? this.minLaneCapAcrossSpan(cell, rowSpan, cols, cellCount)
      : (this.cellVisibleLanes[cell] ?? Infinity);
    return lane < effectiveCap;
  }

  #eventVisibleUnderLaneClipForFooter(
    ev: TimelineEvent,
    eventIndex: number,
    cell: number,
    row: number,
    clip: boolean,
    horiz: boolean,
    cols: number,
    cellCount: number,
    span: number,
    gridMax: number,
    rl: LaneLayout | null | undefined,
    vl: LaneLayout | null | undefined
  ): boolean {
    if (!this.eventOverlapsCell(ev, cell, span, gridMax)) return false;
    if (!clip) return true;
    const lane = this.#laneIndexForEvent(horiz, rl, vl, eventIndex);
    const effectiveCap = horiz
      ? this.minLaneCapForEventInRow(ev, row, cols, span, gridMax, cellCount)
      : (this.cellVisibleLanes[cell] ?? Infinity);
    return lane < effectiveCap;
  }

  #cellLaneStackStyle(
    horiz: boolean,
    laneMode: "timeline" | "masonry" | null,
    laneCount: number
  ): string {
    return horiz && laneMode ? ` --__lane-stack: calc(${laneCount} * var(--__event-height))` : "";
  }

  #resizeHandleFragment(position: "start" | "end", title: string) {
    return html`<resize-handle
      .axis=${this.flow}
      position=${position}
      title=${title}
      @pointerdown=${this.#onResizeHandlePointerDown}
    ></resize-handle>`;
  }

  #eventSegmentFragment(
    seg: TimelineCellEventSegment,
    laneMode: "timeline" | "masonry" | null,
    horiz: boolean,
    rl: LaneLayout | null | undefined,
    vl: LaneLayout | null | undefined
  ) {
    const { ev, index, segIndex, segStart, segEnd, rowSpan, showResizeStart, showResizeEnd } = seg;
    const draggingClass = this.draggingEventIndex === index ? " event--dragging" : "";
    const lane = laneMode ? this.#laneIndexForEvent(horiz, rl, vl, index) : 0;
    const span = this.max > 0 ? this.max : 1;
    const { w0, w1 } = this.#effectiveWindow(span);
    const endPct = this.#axisPct(segEnd, w0, w1);
    const endInset =
      rowSpan > 0 ? `calc(-${rowSpan * 100}% + ${100 - endPct}%)` : `${100 - endPct}%`;

    return html`
      <div
        class="event${draggingClass}"
        data-index=${index}
        data-segment=${segIndex}
        @pointerdown=${this.#onEventBodyPointerDown}
        style="
        --__lane:${lane};
        --__start:${this.#axisPct(segStart, w0, w1)}%;
        --__end:${endInset};
      "
      >
        ${showResizeStart ? this.#resizeHandleFragment("start", "Resize start") : nothing}
        ${this.renderEventTemplate(ev)}
        ${showResizeEnd ? this.#resizeHandleFragment("end", "Resize end") : nothing}
      </div>
    `;
  }

  /** Marker lines for values falling inside this cell's absolute range. */
  #markerFragments(cell: number, span: number, gridMax: number, w0: number, w1: number) {
    const markers = this.markers;
    if (!markers?.length) return nothing;
    const frags: TemplateResult[] = [];
    for (const m of markers) {
      if (!Number.isFinite(m) || m < 0 || m >= gridMax) continue;
      if (Math.floor(m / span) !== cell) continue;
      const pct = this.#axisPct(m - cell * span, w0, w1);
      if (pct < 0 || pct > 100) continue;
      frags.push(html`<div class="marker" style="--__marker-pos:${pct}%"></div>`);
    }
    return frags;
  }

  /** Drag-to-create preview segments for this cell (same segment math as events). */
  #createPreviewFragments(
    cell: number,
    horiz: boolean,
    cols: number,
    span: number,
    gridMax: number,
    w0: number,
    w1: number
  ) {
    const preview = this.createPreview;
    if (!preview) return nothing;
    const segs = this.#collectSegmentsForEventInCell(
      { start: preview.start, end: preview.end },
      -1,
      cell,
      horiz,
      cols,
      span,
      gridMax
    );
    return segs.map((seg) => {
      const endPct = this.#axisPct(seg.segEnd, w0, w1);
      const endInset =
        seg.rowSpan > 0 ? `calc(-${seg.rowSpan * 100}% + ${100 - endPct}%)` : `${100 - endPct}%`;
      return html`<div
        class="create-preview"
        style="--__start:${this.#axisPct(seg.segStart, w0, w1)}%;--__end:${endInset};"
      ></div>`;
    });
  }

  #renderCell(
    cell: number,
    layoutEvents: TimelineEvent[],
    cellCount: number,
    span: number,
    gridMax: number,
    cols: number,
    horiz: boolean,
    clip: boolean,
    laneMode: "timeline" | "masonry" | null,
    rl: LaneLayout | null,
    vl: LaneLayout | null
  ) {
    const row = Math.floor(cell / cols);
    const cellEvents = this.#segmentsInCell(layoutEvents, cell, horiz, cols, span, gridMax);
    const laneCount = horiz ? (rl?.laneCount ?? 1) : (vl?.laneCount ?? 1);
    const laneStack = this.#cellLaneStackStyle(horiz, laneMode, laneCount);

    const visibleCellEvents = cellEvents.filter(({ index, rowSpan }) =>
      this.#segmentVisibleUnderLaneClip(clip, horiz, index, rowSpan, cell, cols, cellCount, rl, vl)
    );

    const allCellEvents = layoutEvents.filter((ev) =>
      this.eventOverlapsCell(ev, cell, span, gridMax)
    );

    const visibleEvents = layoutEvents.filter((ev, index) =>
      this.#eventVisibleUnderLaneClipForFooter(
        ev,
        index,
        cell,
        row,
        clip,
        horiz,
        cols,
        cellCount,
        span,
        gridMax,
        rl,
        vl
      )
    );

    const laneVars = laneMode
      ? `--__lane-count: ${laneCount};${laneStack}`
      : `--__lane-count: ${laneCount}`;

    const { w0, w1 } = this.#effectiveWindow(span);
    const windowed = w0 > 0 || w1 < span;

    return html`
      <div class="cell" data-cell=${cell} style="${laneVars}">
        ${
          this.headerTemplate
            ? html`<div class="cell-header">${this.renderHeaderTemplate(cell)}</div>`
            : nothing
        }
        <div
          class="cell-main${windowed ? " cell-main--windowed" : ""}"
          @pointerdown=${this.#onCellMainPointerDown}
        >
          ${visibleCellEvents.map((seg) =>
            this.#eventSegmentFragment(seg, laneMode, horiz, rl, vl)
          )}
          ${this.#markerFragments(cell, span, gridMax, w0, w1)}
          ${this.#createPreviewFragments(cell, horiz, cols, span, gridMax, w0, w1)}
        </div>
        ${
          this.footerTemplate
            ? html`<div class="cell-footer">
              ${this.renderFooterTemplate(cell, visibleEvents, allCellEvents)}
            </div>`
            : nothing
        }
      </div>
    `;
  }

  renderHeaderTemplate(i: number) {
    return this.headerTemplate?.(i);
  }

  renderEventTemplate(ev: TimelineEvent) {
    return this.eventTemplate?.(ev);
  }

  renderFooterTemplate(
    cellIndex: number,
    visibleEvents: TimelineEvent[],
    allCellEvents: TimelineEvent[]
  ) {
    return this.footerTemplate
      ? this.footerTemplate?.(cellIndex, visibleEvents, allCellEvents)
      : html``;
  }

  render() {
    const cellCount = Math.max(1, this.cells);
    const cellIndexes = Array.from({ length: cellCount }, (_, i) => i);
    const span = this.max > 0 ? this.max : 1;
    const gridMax = span * cellCount;
    const cols = Math.max(1, this.columns);
    const horiz = this.flow === "horizontal";
    const layoutEvents = this.#eventsForLayout();
    const laneMode: "timeline" | "masonry" | null =
      layoutEvents.length > 0 && (this.layout === "timeline" || this.layout === "masonry")
        ? this.layout
        : null;
    const rowLayouts =
      horiz && laneMode
        ? this.rowLaneLayouts(layoutEvents, laneMode, cellCount, cols, span, gridMax)
        : [];
    const verticalCellLayouts =
      !horiz && laneMode
        ? this.verticalCellLaneLayouts(layoutEvents, laneMode, cellCount, span, gridMax)
        : [];
    const clip = this.laneClip();

    return html`
      <div
        class="viewport"
        style="--time-line-grid-rows: repeat(${this.columns}, 1fr)"
      >
        <div class="cells">
          ${cellIndexes.map((cell) => {
            const rl = horiz && laneMode ? rowLayouts[Math.floor(cell / cols)] : null;
            const vl = !horiz && laneMode ? verticalCellLayouts[cell] : null;
            return this.#renderCell(
              cell,
              layoutEvents,
              cellCount,
              span,
              gridMax,
              cols,
              horiz,
              clip,
              laneMode,
              rl,
              vl
            );
          })}
        </div>
      </div>
    `;
  }
}
