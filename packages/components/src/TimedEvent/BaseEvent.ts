import { Temporal } from "@js-temporal/polyfill";
import type { PropertyValues } from "lit";
import { unsafeCSS } from "lit";
import { property } from "lit/decorators.js";
import { BaseElement } from "../BaseElement/BaseElement";
import { TimedEventInteractionController } from "../controllers/TimedEventInteractionController";
import componentStyle from "./TimedEvent.css?inline";

export abstract class BaseEvent extends BaseElement {
  #start?: string;
  #end?: string;
  #justDroppedTimeout: ReturnType<typeof setTimeout> | null = null;

  protected interactionController: TimedEventInteractionController;
  protected dragOffsetX = 0;
  protected dragOffsetY = 0;

  @property({ type: Array })
  renderedDays: Temporal.PlainDate[] = [];

  @property({ type: String })
  summary = "";

  @property({ type: String })
  color = "";

  static get properties() {
    return {
      start: { type: String },
      end: { type: String },
    } as const;
  }

  static get styles() {
    return [...BaseElement.styles, unsafeCSS(componentStyle)];
  }

  constructor(options?: ConstructorParameters<typeof TimedEventInteractionController>[1]) {
    super();
    this.interactionController = new TimedEventInteractionController(this, options);
  }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener(
      "interaction-drag-state",
      this.#handleInteractionDragState as EventListener
    );
    this.addEventListener(
      "interaction-drag-offset",
      this.#handleInteractionDragOffset as EventListener
    );
  }

  disconnectedCallback() {
    if (this.#justDroppedTimeout) clearTimeout(this.#justDroppedTimeout);
    this.removeEventListener(
      "interaction-drag-state",
      this.#handleInteractionDragState as EventListener
    );
    this.removeEventListener(
      "interaction-drag-offset",
      this.#handleInteractionDragOffset as EventListener
    );
    super.disconnectedCallback();
  }

  updated(changedProperties: PropertyValues) {
    super.updated(changedProperties);
    if (changedProperties.has("start") || changedProperties.has("end")) {
      if (this.interactionController.isDragging) return;
      this.dispatchEvent(new CustomEvent("update"));
    }
  }

  get start(): Temporal.PlainDateTime | null {
    return this.#start ? Temporal.PlainDateTime.from(this.#start) : null;
  }

  set start(start: string | null) {
    this.#start = start ?? undefined;
  }

  get end(): Temporal.PlainDateTime | null {
    return this.#end ? Temporal.PlainDateTime.from(this.#end) : null;
  }

  set end(end: string | null) {
    this.#end = end ?? undefined;
  }

  get startDate(): Temporal.PlainDate | null {
    return this.#start ? Temporal.PlainDate.from(this.#start) : null;
  }

  // NOTE: AllDayEvent overrides this to apply exclusive-end semantics.
  get endDate(): Temporal.PlainDate | null {
    return this.#end ? Temporal.PlainDate.from(this.#end) : null;
  }

  get startTime(): Temporal.PlainTime | null {
    return this.#start ? Temporal.PlainTime.from(this.#start) : null;
  }

  get endTime(): Temporal.PlainTime | null {
    return this.#end ? Temporal.PlainTime.from(this.#end) : null;
  }

  get days(): Temporal.PlainDate[] {
    const days: Temporal.PlainDate[] = [];
    const startDate = this.startDate;
    const endDate = this.endDate;
    if (!startDate || !endDate) return days;

    let current: Temporal.PlainDate = startDate;
    while (Temporal.PlainDate.compare(current, endDate) <= 0) {
      days.push(current);
      current = current.add({ days: 1 });
    }
    return days;
  }

  get siblings(): BaseEvent[] {
    return [...(this.parentElement?.querySelectorAll(this.localName) ?? [])] as BaseEvent[];
  }

  protected onDragStart() {
    // Hook for subclasses.
  }

  protected onDragEnd() {
    // Hook for subclasses.
  }

  #handleInteractionDragState = (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const isDragging = Boolean(event.detail?.isDragging);
    if (isDragging) {
      this.setAttribute("data-dragging", "");
      this.onDragStart();
    } else {
      if (this.#justDroppedTimeout) clearTimeout(this.#justDroppedTimeout);
      this.setAttribute("data-just-dropped", "");
      this.#justDroppedTimeout = setTimeout(() => {
        this.removeAttribute("data-just-dropped");
        this.#justDroppedTimeout = null;
      }, 150);
      this.removeAttribute("data-dragging");
      this.dragOffsetX = 0;
      this.dragOffsetY = 0;
      this.onDragEnd();
    }
    this.requestUpdate();
  };

  #handleInteractionDragOffset = (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const { offsetX, offsetY } = event.detail || {};
    this.dragOffsetX = offsetX ?? 0;
    this.dragOffsetY = offsetY ?? 0;
    this.requestUpdate();
  };
}
