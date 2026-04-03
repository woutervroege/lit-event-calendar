import { css, html, LitElement, type PropertyValues } from "https://esm.sh/lit@3";

type SwipeIntent = "x" | "y" | null;
type SnapStopMode = "always" | "normal";

export class SwipeContainer extends LitElement {
  static properties = {
    currentIndex: { type: Number, attribute: "current-index" },
    scrollSnapStop: { type: String, attribute: "scroll-snap-stop" },
    disabled: { type: Boolean, attribute: "disabled", reflect: true },
    virtualSnap: { type: Boolean, attribute: false },
    virtualSnapOffsets: { type: Array, attribute: false },
    virtualContentWidth: { type: Number, attribute: false },
    dir: { type: String, reflect: true },
  };

  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: var(--_lc-swipe-height, 100%);
      min-height: var(--_lc-swipe-min-height, 0);
      overflow-x: var(--_lc-swipe-overflow-x, hidden);
      overflow-y: var(--_lc-swipe-overflow-y, auto);
      position: relative;
      touch-action: pan-y;
      user-select: none;
      -webkit-overflow-scrolling: touch;
    }

    .container {
      display: flex;
      width: 100%;
      align-items: flex-start;
      will-change: transform;
      transform: translate3d(0, 0, 0);
      position: relative;
    }

    .snap-points,
    .snap-point {
      display: none;
    }

    ::slotted(*) {
      flex: 0 0 var(--page-width, 100%);
      width: var(--page-width, 100%);
      touch-action: pan-y;
    }

    @media (pointer: fine) {
      :host {
        overflow-x: auto;
        scroll-snap-type: x mandatory;
        scroll-behavior: smooth;
        touch-action: auto;
        scrollbar-width: none;
        -ms-overflow-style: none;
      }

      :host([disabled]) {
        overflow-x: hidden;
      }

      :host::-webkit-scrollbar {
        width: 0;
        height: 0;
        display: none;
      }

      .container {
        width: max-content;
        min-width: 100%;
        will-change: auto;
        transform: none !important;
        transition: none !important;
      }

      ::slotted(*) {
        scroll-snap-align: start;
        scroll-snap-stop: var(--_lc-swipe-snap-stop, normal);
      }

      .snap-points {
        display: block;
        position: absolute;
        inset-block-start: 0;
        inset-inline-start: 0;
        width: var(--_lc-virtual-track-width, 0px);
        height: 1px;
        pointer-events: none;
      }

      .snap-point {
        display: block;
        position: absolute;
        inset-block-start: 0;
        inset-inline-start: var(--_lc-virtual-snap-offset, 0px);
        width: 1px;
        height: 1px;
        scroll-snap-align: start;
        scroll-snap-stop: var(--_lc-swipe-snap-stop, normal);
      }
    }
  `;

  #currentIndex = 0;
  declare scrollSnapStop: SnapStopMode;
  declare disabled: boolean;
  declare virtualSnap: boolean;
  declare virtualSnapOffsets: number[];
  declare virtualContentWidth: number;
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
  #maxIndex = 0;
  #pendingAnimate = false;
  #swipeCommitDistance = 0.5;
  #swipeCommitVelocity = 0.75;
  #edgeResistance = 0.5;
  #resizeObserver: ResizeObserver | null = null;
  #observedPages = new Set<Element>();

  constructor() {
    super();
    this.scrollSnapStop = "normal";
    this.disabled = false;
    this.virtualSnap = false;
    this.virtualSnapOffsets = [];
    this.virtualContentWidth = 0;
    this.dir = "";
  }

  get currentIndex(): number {
    return this.#currentIndex;
  }

  set currentIndex(value: number) {
    const safeIndex = Number.isFinite(value) ? Math.trunc(value) : 0;
    const oldValue = this.#currentIndex;
    if (safeIndex === oldValue) return;
    this.#currentIndex = safeIndex;
    this.requestUpdate("currentIndex", oldValue);
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
    if (this.disabled || e.pointerType !== "touch") return;
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
    if (this.disabled) {
      this.#cancelActiveSwipe();
      return;
    }
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
    if (this.disabled) {
      this.#cancelActiveSwipe();
      return;
    }
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
    let nextIndex = activeIndex;

    if (farSwipe || fastSwipe || committedByFlick) {
      // Native iOS pager feel: commit at most one page per gesture.
      if (direction > 0 && canMoveForward) {
        nextIndex = Math.min(this.#maxIndex, activeIndex + 1);
      } else if (direction < 0) {
        nextIndex = Math.max(0, activeIndex - 1);
      }
    }

    this.#dragX = 0;
    this.#requestSnap(nextIndex, true);
  };

  render() {
    return html`
      ${this.virtualSnap
        ? html`
            <div
              class="snap-points"
              style=${`--_lc-virtual-track-width:${this.virtualContentWidth}px`}
              aria-hidden="true"
            >
              ${this.virtualSnapOffsets.map(
                (offset) => html`<i class="snap-point" style=${`--_lc-virtual-snap-offset:${offset}px`}></i>`
              )}
            </div>
          `
        : null}
      <div class="container">
        <slot @slotchange=${this.#onSlotChange}></slot>
      </div>
    `;
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) {
      this.#container ??= this.renderRoot.querySelector(".container");
      this.#resizeObserver ??= new ResizeObserver(() => this.#onResize());
      this.addEventListener("pointerdown", this.#onPointerDown, { passive: true });
      this.addEventListener("pointermove", this.#onPointerMove, { passive: false });
      this.addEventListener("pointerup", this.#onPointerUp);
      this.addEventListener("pointercancel", this.#onPointerUp);
      window.addEventListener("resize", this.#onResize, { passive: true });
      this.#resizeObserver.observe(this);
      this.#updatePages();
      this.#onResize();
    }
  }

  firstUpdated(): void {
    this.#container = this.renderRoot.querySelector(".container");
    this.currentIndex = this.currentIndex;
    this.scrollSnapStop = this.scrollSnapStop;
    this.#resizeObserver = new ResizeObserver(() => this.#onResize());
    this.addEventListener("pointerdown", this.#onPointerDown, { passive: true });
    this.addEventListener("pointermove", this.#onPointerMove, { passive: false });
    this.addEventListener("pointerup", this.#onPointerUp);
    this.addEventListener("pointercancel", this.#onPointerUp);
    window.addEventListener("resize", this.#onResize, { passive: true });

    this.#updatePages();
    this.#resizeObserver.observe(this);
    this.#onResize();
  }

  updated(changedProperties: PropertyValues<this>): void {
    if (changedProperties.has("disabled") && this.disabled) {
      this.#cancelActiveSwipe();
    }

    if (changedProperties.has("scrollSnapStop")) {
      const normalizedSnapStop = this.#normalizeSnapStop(this.scrollSnapStop);
      if (normalizedSnapStop !== this.scrollSnapStop) {
        this.scrollSnapStop = normalizedSnapStop;
        return;
      }
      this.style.setProperty("--_lc-swipe-snap-stop", this.scrollSnapStop);
    }

    if (changedProperties.has("dir")) {
      this.#measurePages();
      this.#applyCurrentIndex(false);
    }

    if (changedProperties.has("currentIndex")) {
      this.#applyCurrentIndex(this.#pendingAnimate);
      this.#pendingAnimate = false;
      this.dispatchEvent(new CustomEvent("change"));
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener("pointerdown", this.#onPointerDown);
    this.removeEventListener("pointermove", this.#onPointerMove);
    this.removeEventListener("pointerup", this.#onPointerUp);
    this.removeEventListener("pointercancel", this.#onPointerUp);
    window.removeEventListener("resize", this.#onResize);
    this.#resizeObserver?.disconnect();
    this.#observedPages.clear();
  }

  #updatePages(): void {
    if (this.#resizeObserver) {
      this.#observedPages.forEach((page) => {
        this.#resizeObserver?.unobserve(page);
      });
      this.#observedPages.clear();
    }
    this.#pages = Array.from(this.children) as HTMLElement[];
    this.#maxIndex = Math.max(0, this.#pages.length - 1);
    if (this.#resizeObserver) {
      this.#pages.forEach((page) => {
        this.#resizeObserver?.observe(page);
        this.#observedPages.add(page);
      });
    }
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
    const contentWidth = widths.reduce((sum, width) => sum + width, 0);
    const viewportWidth = this.clientWidth || 1;
    const maxOffsetX = Math.max(0, contentWidth - viewportWidth);

    // Support "virtual pages" for a single very wide child.
    // Example: one timeline element can snap every --column-width pixels.
    const columnWidth = this.#resolveColumnWidth();
    if (this.#pages.length === 1 && columnWidth > 0.5) {
      const step = Math.max(1, columnWidth);
      const virtualOffsets: number[] = [0];
      const virtualWidths: number[] = [step];
      for (let nextOffset = step; nextOffset < maxOffsetX - 0.5; nextOffset += step) {
        virtualOffsets.push(nextOffset);
        virtualWidths.push(step);
      }
      if (maxOffsetX > 0.5) {
        const lastOffset = virtualOffsets[virtualOffsets.length - 1] ?? 0;
        if (Math.abs(lastOffset - maxOffsetX) > 0.5) {
          virtualOffsets.push(maxOffsetX);
          virtualWidths.push(step);
        }
      }
      this.#pageOffsets = virtualOffsets;
      this.#pageWidths = virtualWidths;
      this.virtualSnap = true;
      this.virtualSnapOffsets = virtualOffsets;
      this.virtualContentWidth = contentWidth;
    } else {
      this.#pageWidths = widths.length ? widths : [1];
      this.#pageOffsets = offsets.length ? offsets : [0];
      this.virtualSnap = false;
      this.virtualSnapOffsets = [];
      this.virtualContentWidth = 0;
    }
    this.#maxOffsetX = maxOffsetX;
    this.#maxIndex = Math.max(0, this.#pageOffsets.length - 1);
  }

  #resolveColumnWidth(): number {
    const value = getComputedStyle(this).getPropertyValue("--column-width").trim();
    if (!value) return 0;
    const probe = document.createElement("div");
    probe.style.position = "absolute";
    probe.style.visibility = "hidden";
    probe.style.pointerEvents = "none";
    probe.style.inlineSize = value;
    this.renderRoot.append(probe);
    const measuredWidth = probe.getBoundingClientRect().width;
    probe.remove();
    return Number.isFinite(measuredWidth) ? measuredWidth : 0;
  }

  #isRtl(): boolean {
    return getComputedStyle(this).direction === "rtl";
  }

  #normalizeSnapStop(value: unknown): SnapStopMode {
    return value === "always" ? "always" : "normal";
  }

  #cancelActiveSwipe(): void {
    if (this.#pointerId === null && this.#dragX === 0) return;
    this.#pointerId = null;
    this.#intent = null;
    this.#dragX = 0;
    this.#velocityX = 0;
    if (this.#container) {
      this.#container.style.transition = "none";
    }
    this.#transformContainer();
  }

  #getOffsetForIndex(index: number): number {
    const baseOffset = this.#pageOffsets[index] || 0;
    return Math.min(this.#maxOffsetX, Math.max(0, baseOffset));
  }

  #getLogicalOffsetForIndex(index: number): number {
    return this.#getOffsetForIndex(index);
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
    this.#measurePages();
    if (this.#container) {
      this.#container.style.transition = animate
        ? "transform 620ms cubic-bezier(0.22, 1, 0.36, 1)"
        : "none";
    }
    this.#transformContainer();
  }

  #transformContainer(): void {
    if (!this.#container) return;
    const clampedOffset = this.#getOffsetForIndex(this.#getCurrentIndex());
    const x = (this.#isRtl() ? clampedOffset : -clampedOffset) + this.#dragX;
    this.#container.style.transform = `translate3d(${x}px, 0, 0)`;
  }
}

if (!customElements.get("swipe-container")) {
  const SwipeContainerConstructor = SwipeContainer as unknown as CustomElementConstructor;
  customElements.define("swipe-container", SwipeContainerConstructor);
}
