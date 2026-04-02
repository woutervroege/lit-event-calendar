import { css, html, LitElement, type PropertyValues } from "lit";

type SwipeIntent = "x" | "y" | null;
type SnapStopMode = "always" | "normal";

export class SwipeSnapElement extends LitElement {
  static properties = {
    currentIndex: { type: Number, attribute: "current-index" },
    scrollSnapStop: { type: String, attribute: "scroll-snap-stop" },
    dir: { type: String, reflect: true },
  };

  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      overflow-x: hidden;
      overflow-y: auto;
      position: relative;
      touch-action: pan-y;
      user-select: none;
      -webkit-overflow-scrolling: touch;
    }

    .container {
      display: flex;
      width: 100%;
      height: 100%;
      min-height: 100%;
      align-items: flex-start;
      will-change: transform;
      transform: translate3d(0, 0, 0);
    }

    ::slotted(*) {
      flex: 0 0 var(--column-width, 100%);
      width: var(--column-width, 100%);
      height: 100%;
      min-height: 100%;
      touch-action: pan-y;
    }
  `;

  declare currentIndex: number;
  declare scrollSnapStop: SnapStopMode;
  declare dir: string;

  #container: HTMLDivElement | null = null;
  #dragX = 0;
  #pointerId: number | null = null;
  #intent: SwipeIntent = null;
  #startX = 0;
  #startY = 0;
  #lastX = 0;
  #lastT = 0;
  #velocityX = 0;
  #pageOffsets: number[] = [0];
  #pageWidths: number[] = [1];
  #maxOffsetX = 0;
  #pages: HTMLElement[] = [];
  #hasVirtualPages = false;
  #maxIndex = 0;
  #snapStopMode: SnapStopMode = "normal";
  #pendingAnimate = false;
  #swipeCommitDistance = 0.5;
  #swipeCommitVelocity = 0.75;
  #edgeResistance = 0.5;

  constructor() {
    super();
    this.currentIndex = 0;
    this.scrollSnapStop = "normal";
    this.dir = "";
  }

  #onSlotChange = (): void => {
    this.#updatePages();
    this.#onResize();
  };

  #onResize = (): void => {
    this.#measurePages();
    this.#applyCurrentIndex(false);
  };

  #onPointerDown = (e: PointerEvent): void => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    this.#snapStopMode = this.#normalizeSnapStop(this.scrollSnapStop);
    this.#pointerId = e.pointerId;
    this.#intent = null;
    this.#startX = e.clientX;
    this.#startY = e.clientY;
    this.#lastX = e.clientX;
    this.#lastT = performance.now();
    this.#velocityX = 0;
    this.#dragX = 0;
    this.#measurePages();
    if (this.#container) this.#container.style.transition = "none";
  };

  #onPointerMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.#pointerId) return;
    const dx = e.clientX - this.#startX;
    const dy = e.clientY - this.#startY;
    const directionSign = this.#isRtl() ? -1 : 1;

    if (!this.#intent) {
      const distance = Math.hypot(dx, dy);
      if (distance < 6) return;
      this.#intent = Math.abs(dx) > Math.abs(dy) * 1.1 ? "x" : "y";
    }

    if (this.#intent === "y") return;

    e.preventDefault();

    const now = performance.now();
    const dt = Math.max(1, now - this.#lastT);
    const instantVelocityX = (e.clientX - this.#lastX) / dt;
    this.#velocityX = this.#velocityX * 0.78 + instantVelocityX * 0.22;
    this.#lastX = e.clientX;
    this.#lastT = now;

    let nextDrag = dx;
    const activeIndex = this.#getCurrentIndex();
    const logicalDrag = nextDrag * directionSign;
    const currentLogicalOffset = this.#getLogicalOffsetForIndex(activeIndex);
    const atStartPushingOut = currentLogicalOffset <= 0.5 && logicalDrag > 0;
    const atEndPushingOut = currentLogicalOffset >= this.#maxOffsetX - 0.5 && logicalDrag < 0;
    if (atStartPushingOut || atEndPushingOut) {
      nextDrag = logicalDrag * this.#edgeResistance * directionSign;
    }
    this.#dragX = nextDrag;
    this.#transformContainer();
  };

  #onPointerUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.#pointerId) return;
    this.#pointerId = null;

    if (this.#intent !== "x") {
      this.#dragX = 0;
      return;
    }

    const directionSign = this.#isRtl() ? -1 : 1;
    const distance = this.#dragX * directionSign;
    const velocityX = this.#velocityX * directionSign;
    let direction = 0;
    if (distance < 0 || (distance === 0 && velocityX < 0)) direction = 1;
    if (distance > 0 || (distance === 0 && velocityX > 0)) direction = -1;
    const activeIndex = this.#getCurrentIndex();
    const activePageWidth = this.#pageWidths[activeIndex] || this.clientWidth || 1;
    const progress = Math.abs(distance) / activePageWidth;
    const fastSwipe = Math.abs(velocityX) > this.#swipeCommitVelocity;
    const farSwipe = progress > this.#swipeCommitDistance;
    const committedByFlick = Math.abs(velocityX) > 0.55 && progress > 0.12;
    const currentLogicalOffset = this.#getLogicalOffsetForIndex(activeIndex);
    const canMoveForward = currentLogicalOffset < this.#maxOffsetX - 0.5;
    const canMoveBackward = currentLogicalOffset > 0.5;
    let nextIndex = activeIndex;

    if (farSwipe || fastSwipe || committedByFlick) {
      const allowMultiStepVirtualSnap = this.#hasVirtualPages && this.#snapStopMode === "normal";
      if (allowMultiStepVirtualSnap) {
        const projectedOffset = currentLogicalOffset - distance - velocityX * 220;
        nextIndex = this.#getNearestIndexForLogicalOffset(projectedOffset, direction);
      }

      // Keep one-step snap for real children and for virtual pages in "always" mode.
      if (nextIndex === activeIndex) {
        if (direction > 0 && canMoveForward) {
          nextIndex = Math.min(this.#maxIndex, activeIndex + 1);
        } else if (direction < 0 && canMoveBackward) {
          nextIndex = Math.max(0, activeIndex - 1);
        }
      }
    }

    this.#dragX = 0;
    this.#requestSnap(nextIndex, true);
  };

  render() {
    return html`<div class="container"><slot @slotchange=${this.#onSlotChange}></slot></div>`;
  }

  firstUpdated(): void {
    this.#container = this.renderRoot.querySelector(".container");
    this.currentIndex = this.currentIndex;
    this.scrollSnapStop = this.scrollSnapStop;
    this.#snapStopMode = this.scrollSnapStop;

    this.addEventListener("pointerdown", this.#onPointerDown, { passive: true });
    this.addEventListener("pointermove", this.#onPointerMove, { passive: false });
    this.addEventListener("pointerup", this.#onPointerUp);
    this.addEventListener("pointercancel", this.#onPointerUp);
    window.addEventListener("resize", this.#onResize, { passive: true });

    this.#updatePages();
    this.#onResize();
  }

  updated(changedProperties: PropertyValues<this>): void {
    if (changedProperties.has("scrollSnapStop")) {
      const normalizedSnapStop = this.#normalizeSnapStop(this.scrollSnapStop);
      if (normalizedSnapStop !== this.scrollSnapStop) {
        this.scrollSnapStop = normalizedSnapStop;
        return;
      }
      this.#snapStopMode = normalizedSnapStop;
    }

    if (changedProperties.has("dir")) {
      this.#measurePages();
      this.#applyCurrentIndex(false);
    }

    if (!changedProperties.has("currentIndex")) return;
    const normalized = this.#normalizeIndex(this.currentIndex);
    if (normalized !== this.currentIndex) {
      this.currentIndex = normalized;
      return;
    }
    this.#applyCurrentIndex(this.#pendingAnimate);
    this.#pendingAnimate = false;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener("pointerdown", this.#onPointerDown);
    this.removeEventListener("pointermove", this.#onPointerMove);
    this.removeEventListener("pointerup", this.#onPointerUp);
    this.removeEventListener("pointercancel", this.#onPointerUp);
    window.removeEventListener("resize", this.#onResize);
  }

  #updatePages(): void {
    this.#pages = Array.from(this.children) as HTMLElement[];
    this.#maxIndex = Math.max(0, this.#pages.length - 1);
    this.currentIndex = this.currentIndex;
  }

  #measurePages(): void {
    const widths = this.#pages.map((page) => Math.max(1, page.getBoundingClientRect().width));
    const containerRect = this.#container?.getBoundingClientRect() ?? this.getBoundingClientRect();
    const isRtl = this.#isRtl();
    const offsets = this.#pages.map((page) => {
      const pageRect = page.getBoundingClientRect();
      const offset = isRtl
        ? containerRect.right - pageRect.right
        : pageRect.left - containerRect.left;
      return Math.max(0, offset);
    });
    const viewportWidth = this.clientWidth || 1;
    const measuredContentWidth = widths.reduce((sum, width) => sum + width, 0);
    const scrollContentWidth = this.#container?.scrollWidth ?? measuredContentWidth;
    const contentWidth = Math.max(measuredContentWidth, scrollContentWidth);
    const maxOffsetX = Math.max(0, contentWidth - viewportWidth);
    let nextPageWidths = widths.length ? widths : [1];
    let nextPageOffsets = offsets.length ? offsets : [0];

    // When there is a single wide slotted child, synthesize virtual pages so snapping
    // can still step by --column-width.
    this.#hasVirtualPages = this.#pages.length <= 1 && maxOffsetX > 0;
    if (this.#hasVirtualPages) {
      const snapStepWidth = this.#resolveColumnWidthPx(viewportWidth);
      nextPageOffsets = this.#buildVirtualOffsets(maxOffsetX, snapStepWidth);
      nextPageWidths = nextPageOffsets.map(() => snapStepWidth);
    }

    this.#pageWidths = nextPageWidths;
    this.#pageOffsets = nextPageOffsets;
    this.#maxOffsetX = maxOffsetX;
    this.#maxIndex = Math.max(0, this.#pageOffsets.length - 1);
  }

  #isRtl(): boolean {
    return getComputedStyle(this).direction === "rtl";
  }

  #normalizeSnapStop(value: unknown): SnapStopMode {
    return value === "always" ? "always" : "normal";
  }

  #resolveColumnWidthPx(viewportWidth: number): number {
    const raw = getComputedStyle(this).getPropertyValue("--column-width").trim();
    if (!raw) return Math.max(1, viewportWidth);

    const probe = document.createElement("div");
    probe.style.position = "absolute";
    probe.style.visibility = "hidden";
    probe.style.pointerEvents = "none";
    probe.style.width = raw;
    this.renderRoot.append(probe);
    const resolved = probe.getBoundingClientRect().width;
    probe.remove();

    if (!Number.isFinite(resolved) || resolved <= 0) {
      return Math.max(1, viewportWidth);
    }
    return Math.max(1, resolved);
  }

  #buildVirtualOffsets(maxOffsetX: number, stepWidth: number): number[] {
    const safeStep = Math.max(1, stepWidth);
    const offsets: number[] = [0];
    for (let offset = safeStep; offset < maxOffsetX - 0.5; offset += safeStep) {
      offsets.push(offset);
    }
    if (Math.abs(offsets[offsets.length - 1] - maxOffsetX) > 0.5) {
      offsets.push(maxOffsetX);
    }
    return offsets;
  }

  #getOffsetForIndex(index: number): number {
    const baseOffset = this.#pageOffsets[index] || 0;
    return Math.min(this.#maxOffsetX, Math.max(0, baseOffset));
  }

  #getLogicalOffsetForIndex(index: number): number {
    return this.#getOffsetForIndex(index);
  }

  #getNearestIndexForLogicalOffset(targetOffset: number, direction = 0): number {
    let nearestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    const clampedTarget = Math.min(this.#maxOffsetX, Math.max(0, targetOffset));

    this.#pageOffsets.forEach((_, idx) => {
      const offset = this.#getLogicalOffsetForIndex(idx);
      const diff = Math.abs(offset - clampedTarget);
      const isBetter = diff < bestDistance;
      const isDirectionalTie =
        diff === bestDistance &&
        ((direction > 0 && idx > nearestIndex) || (direction < 0 && idx < nearestIndex));

      if (isBetter || isDirectionalTie) {
        bestDistance = diff;
        nearestIndex = idx;
      }
    });

    return nearestIndex;
  }

  #normalizeIndex(index: number): number {
    const safeIndex = Number.isFinite(index) ? Math.trunc(index) : 0;
    return Math.max(0, Math.min(this.#maxIndex, safeIndex));
  }

  #getCurrentIndex(): number {
    return this.#normalizeIndex(this.currentIndex);
  }

  #requestSnap(index: number, animate: boolean): void {
    const normalized = this.#normalizeIndex(index);
    if (normalized === this.currentIndex) {
      this.#applyCurrentIndex(animate);
      return;
    }
    this.#pendingAnimate = animate;
    this.currentIndex = normalized;
  }

  #applyCurrentIndex(animate: boolean): void {
    const index = this.#getCurrentIndex();
    this.#measurePages();
    if (this.#container) {
      this.#container.style.transition = animate
        ? "transform 620ms cubic-bezier(0.22, 1, 0.36, 1)"
        : "none";
    }
    this.#transformContainer();
    this.dispatchEvent(new CustomEvent("pagechange", { detail: { index } }));
  }

  #transformContainer(): void {
    if (!this.#container) return;
    const clampedOffset = this.#getOffsetForIndex(this.#getCurrentIndex());
    const x = (this.#isRtl() ? clampedOffset : -clampedOffset) + this.#dragX;
    this.#container.style.transform = `translate3d(${x}px, 0, 0)`;
  }
}

if (!customElements.get("swipe-snap-element")) {
  const SwipeSnapElementConstructor = SwipeSnapElement as unknown as CustomElementConstructor;
  customElements.define("swipe-snap-element", SwipeSnapElementConstructor);
}
