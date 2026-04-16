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
   * Horizontal only: `timeline` gives each event its own track (swimlane).
   * `masonry` packs overlapping events into the fewest rows: each event uses the
   * lowest lane where no still-active event (started, not yet ended) occupies that lane at its start.
   */
  @property({ type: String, reflect: true })
  accessor layout: "default" | "timeline" | "masonry" = "default";

  /** With horizontal `timeline` / `masonry`, omit event lanes that do not fit the cell (ResizeObserver). */
  @property({ type: String, reflect: true })
  accessor height: "auto" | undefined = undefined;

  @property({ type: Array })
  accessor events: TimelineEvent[] = [];

  /** Optional hook; the same data is also dispatched as `timeline-event-resize`. */
  @property({ attribute: false })
  accessor onTimelineEventResize: ((detail: TimelineEventResizeCommitDetail) => void) | undefined;

  @state()
  private accessor resizePreviewByIndex: ReadonlyMap<number, { start: number; end: number }> | null =
    null;

  @state()
  private accessor cellVisibleLanes: number[] = [];

  private cellsResizeObserver: ResizeObserver | null = null;

  #resizeSession: TimelineResizeSession | null = null;

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
    this.#detachResizeWindowListeners();
    this.#resizeSession = null;
    this.resizePreviewByIndex = null;
    this.cellsResizeObserver?.disconnect();
    this.cellsResizeObserver = null;
    super.disconnectedCallback();
  }

  #detachResizeWindowListeners() {
    window.removeEventListener("pointermove", this.#onResizeWindowPointerMove, true);
    window.removeEventListener("pointerup", this.#onResizeWindowPointerEnd, true);
    window.removeEventListener("pointercancel", this.#onResizeWindowPointerEnd, true);
  }

  #snapTime(t: number): number {
    const step = this.step > 0 ? this.step : 1;
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

  /**
   * Maps a screen point to absolute time on the grid [0, gridMax], using each cell’s `.cell-main`
   * as that cell’s span so resizing stays correct when the pointer moves across cells.
   *
   * Vertical time axis: pick the cell column that contains `clientX`, then map `clientY` along that
   * cell’s height. Using plain 2D distance lets a neighbouring column “win” with a clamped point at
   * ~50% width → ~50% of the day (wrong). Horizontal axis: same idea with X/Y swapped.
   */
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

    const edgeEps = 1e-3;
    const cells: { cellIndex: number; r: DOMRect }[] = [];
    for (const cellEl of root.querySelectorAll(".cell")) {
      if (!(cellEl instanceof HTMLElement)) continue;
      const cellIndex = Number(cellEl.dataset.cell);
      if (!Number.isFinite(cellIndex) || cellIndex < 0 || cellIndex >= cellCount) continue;
      const main = cellEl.querySelector(".cell-main");
      if (!(main instanceof HTMLElement)) continue;
      const r = main.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      cells.push({ cellIndex, r });
    }

    for (const { cellIndex, r } of cells) {
      if (
        clientX >= r.left - edgeEps &&
        clientX <= r.right + edgeEps &&
        clientY >= r.top - edgeEps &&
        clientY <= r.bottom + edgeEps
      ) {
        const along = horiz ? (clientX - r.left) / r.width : (clientY - r.top) / r.height;
        const frac = Math.min(1, Math.max(0, Number.isFinite(along) ? along : 0));
        return Math.max(0, Math.min(gridMax, cellIndex * span + frac * span));
      }
    }

    let bestT = 0;
    let bestDist = Infinity;

    if (!horiz) {
      for (const { cellIndex, r } of cells) {
        if (clientX < r.left || clientX > r.right) continue;
        const cy = Math.min(Math.max(clientY, r.top), r.bottom);
        const distY = Math.abs(clientY - cy);
        const frac = Math.min(1, Math.max(0, (cy - r.top) / r.height));
        const t = cellIndex * span + frac * span;
        if (distY < bestDist) {
          bestDist = distY;
          bestT = t;
        }
      }
    } else {
      for (const { cellIndex, r } of cells) {
        if (clientY < r.top || clientY > r.bottom) continue;
        const cx = Math.min(Math.max(clientX, r.left), r.right);
        const distX = Math.abs(clientX - cx);
        const frac = Math.min(1, Math.max(0, (cx - r.left) / r.width));
        const t = cellIndex * span + frac * span;
        if (distX < bestDist) {
          bestDist = distX;
          bestT = t;
        }
      }
    }

    if (bestDist !== Infinity) {
      return Math.max(0, Math.min(gridMax, bestT));
    }

    for (const { cellIndex, r } of cells) {
      const cx = Math.min(Math.max(clientX, r.left), r.right);
      const cy = Math.min(Math.max(clientY, r.top), r.bottom);
      const dx = clientX - cx;
      const dy = clientY - cy;
      const dist = dx * dx + dy * dy;
      const along = horiz ? (cx - r.left) / r.width : (cy - r.top) / r.height;
      const frac = Math.min(1, Math.max(0, Number.isFinite(along) ? along : 0));
      const t = cellIndex * span + frac * span;
      if (dist < bestDist) {
        bestDist = dist;
        bestT = t;
      }
    }

    if (bestDist === Infinity) return 0;
    return Math.max(0, Math.min(gridMax, bestT));
  }

  #applyResizePointer(clientX: number, clientY: number, session: TimelineResizeSession) {
    const ev = this.events[session.eventIndex];
    if (!ev) return;

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
    const deltaT = pointerT - session.originPointerGridT;

    let nextStart = session.initialStart;
    let nextEnd = session.initialEnd;
    if (session.edge === "start") {
      nextStart = this.#snapTime(session.initialStart + deltaT);
    } else {
      nextEnd = this.#snapTime(session.initialEnd + deltaT);
    }

    const minStep = this.step > 0 ? this.step : 1;
    nextStart = Math.max(0, Math.min(nextStart, session.gridMax));
    nextEnd = Math.max(0, Math.min(nextEnd, session.gridMax));

    if (nextEnd - nextStart < minStep) {
      if (session.edge === "start") {
        nextStart = Math.max(0, nextEnd - minStep);
      } else {
        nextEnd = Math.min(session.gridMax, nextStart + minStep);
      }
    }

    if (nextStart >= nextEnd) {
      if (session.edge === "start") {
        nextStart = Math.max(0, nextEnd - minStep);
      } else {
        nextEnd = Math.min(session.gridMax, nextStart + minStep);
      }
    }

    const next = new Map(this.resizePreviewByIndex ?? []);
    next.set(session.eventIndex, { start: nextStart, end: nextEnd });
    this.resizePreviewByIndex = next;
  }

  #finishResizeGesture(
    session: TimelineResizeSession,
    clientX: number,
    clientY: number,
    cancelled: boolean
  ) {
    this.#detachResizeWindowListeners();
    this.#resizeSession = null;

    try {
      session.handle.releasePointerCapture(session.pointerId);
    } catch {
      // Ignore if capture was already released or unsupported.
    }

    if (!cancelled) {
      this.#applyResizePointer(clientX, clientY, session);
    }

    const preview = cancelled ? undefined : this.resizePreviewByIndex?.get(session.eventIndex);
    const previousStart = session.initialStart;
    const previousEnd = session.initialEnd;

    this.resizePreviewByIndex = null;

    if (cancelled || !preview) return;

    if (preview.start === previousStart && preview.end === previousEnd) return;

    const detail: TimelineEventResizeCommitDetail = {
      index: session.eventIndex,
      edge: session.edge,
      start: preview.start,
      end: preview.end,
      previousStart,
      previousEnd,
    };

    this.dispatchEvent(
      new CustomEvent<TimelineEventResizeCommitDetail>("timeline-event-resize", {
        bubbles: true,
        composed: true,
        detail,
      })
    );
    this.onTimelineEventResize?.(detail);
  }

  #onResizeHandlePointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const path = e.composedPath();
    const handle = path.find((n) => n instanceof HTMLElement && n.localName === "resize-handle");
    if (!(handle instanceof HTMLElement)) return;

    const eventEl = handle.closest(".event");
    if (!(eventEl instanceof HTMLElement)) return;

    const index = Number(eventEl.dataset.index);
    if (!Number.isFinite(index) || index < 0 || index >= this.events.length) return;

    const axisAttr = handle.getAttribute("axis");
    const horiz =
      axisAttr === "horizontal"
        ? true
        : axisAttr === "vertical"
          ? false
          : this.flow === "horizontal";
    const span = this.max > 0 ? this.max : 1;
    const cellCount = Math.max(1, this.cells);
    const gridMax = span * cellCount;
    const originPointerGridT = this.#gridTimeFromClient(
      e.clientX,
      e.clientY,
      span,
      cellCount,
      horiz,
      gridMax
    );

    const position = handle.getAttribute("position");
    const edge: TimelineResizeEdge | null =
      position === "start" || position === "end" ? position : null;
    if (!edge) return;

    const ev = this.events[index];
    if (!ev) return;

    e.stopPropagation();
    if (e.cancelable) e.preventDefault();

    try {
      handle.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic pointers may not support capture.
    }

    this.#resizeSession = {
      pointerId: e.pointerId,
      handle,
      eventIndex: index,
      edge,
      originPointerGridT,
      initialStart: ev.start,
      initialEnd: ev.end,
      horiz,
      gridMax,
    };

    const m = new Map<number, { start: number; end: number }>();
    m.set(index, { start: ev.start, end: ev.end });
    this.resizePreviewByIndex = m;

    this.#attachResizeWindowListeners();
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

  private tToPct(t: number) {
    return this.max > 0 ? (t / this.max) * 100 : 0;
  }

  /** Resize UI belongs only on the event’s first and last grid segments (not row/cell continuations). */
  private segmentResizeHandleFlags(
    segmentAbsStart: number,
    segmentAbsEnd: number,
    evStart: number,
    evEndClamped: number
  ): { showResizeStart: boolean; showResizeEnd: boolean } {
    const eps = 1e-6;
    return {
      showResizeStart: Math.abs(segmentAbsStart - evStart) < eps,
      showResizeEnd: Math.abs(segmentAbsEnd - evEndClamped) < eps,
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
      while (L < ends.length && ends[L]! > ev.start) L++;
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
  ) {
    const C = Math.max(1, cols);
    const rows: { laneCount: number; laneByEventIndex: number[] }[] = [];
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
        inRow.forEach(({ i }, L) => (laneByEventIndex[i] = L));
        laneCount = inRow.length;
      } else {
        const subLanes = this.masonryLanes(inRow.map((x) => x.ev));
        inRow.forEach(({ i }, j) => (laneByEventIndex[i] = subLanes[j]!));
        laneCount = Math.max(...subLanes, 0) + 1;
      }
      rows.push({ laneCount: Math.max(1, laneCount), laneByEventIndex });
    }
    return rows;
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
    const laneMode =
      horiz && layoutEvents.length
        ? this.layout === "timeline" || this.layout === "masonry"
          ? this.layout
          : null
        : null;
    const rowLayouts = laneMode
      ? this.rowLaneLayouts(layoutEvents, laneMode, cellCount, cols, span, gridMax)
      : [];

    return html`
      <div
        class="viewport"
        style="--time-line-grid-rows: repeat(${this.columns}, 1fr)"
      >
        <div class="cells">
          ${cellIndexes.map((cell) => {
            const rl = laneMode ? rowLayouts[Math.floor(cell / cols)] : null;
            const clip = this.laneClip();
            const row = Math.floor(cell / cols);
            const cellEvents = layoutEvents.flatMap((ev, i) => {
              const out: Array<{
                ev: TimelineEvent;
                index: number;
                segIndex: number;
                segStart: number;
                segEnd: number;
                rowSpan: number;
                showResizeStart: boolean;
                showResizeEnd: boolean;
              }> = [];
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
                    evEnd
                  );
                  out.push({
                    ev,
                    index: i,
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
              return out;
            });

            const laneCount = rl?.laneCount ?? 1;
            const visibleCellEvents = cellEvents.filter(({ index, rowSpan }) => {
              if (!clip) return true;
              const lane = rl?.laneByEventIndex[index] ?? 0;
              const effCap = horiz
                ? this.minLaneCapAcrossSpan(cell, rowSpan, cols, cellCount)
                : (this.cellVisibleLanes[cell] ?? Infinity);
              return lane < effCap;
            });
            const allCellEvents = layoutEvents.filter((ev) =>
              this.eventOverlapsCell(ev, cell, span, gridMax)
            );
            const visibleEvents = layoutEvents.filter((ev, index) => {
              if (!this.eventOverlapsCell(ev, cell, span, gridMax)) return false;
              if (!clip) return true;
              const lane = rl?.laneByEventIndex[index] ?? 0;
              const effCap = horiz
                ? this.minLaneCapForEventInRow(ev, row, cols, span, gridMax, cellCount)
                : (this.cellVisibleLanes[cell] ?? Infinity);
              return lane < effCap;
            });
            return html`
              <div
                class="cell"
                data-cell=${cell}
                style="${
                  laneMode
                    ? `--__lane-count: ${laneCount}; --__lane-stack: calc(${laneCount} * var(--__event-height))`
                    : `--__lane-count: ${laneCount}`
                }"
              >
                ${this.headerTemplate ? html`<div class="cell-header">${this.renderHeaderTemplate(cell)}</div>` : nothing}
                <div class="cell-main">
                  ${visibleCellEvents.map(
                    ({
                      ev,
                      index,
                      segIndex,
                      segStart,
                      segEnd,
                      rowSpan,
                      showResizeStart,
                      showResizeEnd,
                    }) => html`
                      <div
                        class="event"
                        data-index=${index}
                        data-segment=${segIndex}
                        style="
                        --__lane:${laneMode ? (rl?.laneByEventIndex[index] ?? 0) : 0};
                        --__start:${this.tToPct(segStart)}%;
                        --__end:${
                          rowSpan > 0
                            ? `calc(-${rowSpan * 100}% + ${100 - this.tToPct(segEnd)}%)`
                            : `${100 - this.tToPct(segEnd)}%`
                        };
                      "
                      >
                        ${
                          showResizeStart
                            ? html`<resize-handle
                                .axis=${this.flow}
                                position="start"
                                title="Resize start"
                                @pointerdown=${this.#onResizeHandlePointerDown}
                              ></resize-handle>`
                            : nothing
                        }
                        ${this.renderEventTemplate(ev)}
                        ${
                          showResizeEnd
                            ? html`<resize-handle
                                .axis=${this.flow}
                                position="end"
                                title="Resize end"
                                @pointerdown=${this.#onResizeHandlePointerDown}
                              ></resize-handle>`
                            : nothing
                        }
                      </div>
                    `
                  )}
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
          })}
        </div>
      </div>
    `;
  }
}
