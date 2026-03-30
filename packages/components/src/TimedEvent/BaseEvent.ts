import { Temporal } from "@js-temporal/polyfill";
import type { PropertyValues } from "lit";
import { unsafeCSS } from "lit";
import { property } from "lit/decorators.js";
import { ContextConsumer } from "@lit/context";
import { BaseElement } from "../BaseElement/BaseElement";
import { TimedEventInteractionController } from "../controllers/TimedEventInteractionController";
import { calendarViewContext, type CalendarViewContextValue } from "../context/CalendarViewContext";
import componentStyle from "./TimedEvent.css?inline";
import { resolveLocale } from "../utils/Locale";

export abstract class BaseEvent extends BaseElement {
  #start?: string;
  #end?: string;
  #currentTime?: string;
  #timezone?: string;
  #locale?: string;
  #justDroppedTimeout: ReturnType<typeof setTimeout> | null = null;
  #calendarView?: CalendarViewContextValue;
  #calendarViewConsumer = new ContextConsumer(this, {
    context: calendarViewContext,
    subscribe: true,
    callback: (value: CalendarViewContextValue | undefined) => {
      this.#calendarView = value;
      this.requestUpdate();
    },
  });

  protected interactionController: TimedEventInteractionController;
  protected dragOffsetX = 0;
  protected dragOffsetY = 0;

  @property({ type: Array })
  renderedDays: Temporal.PlainDate[] = [];

  @property({ type: String })
  summary = "";

  @property({ type: String })
  color = "";

  @property({ type: String, attribute: "event-id" })
  eventId = "";

  static get properties() {
    return {
      start: { type: String },
      end: { type: String },
      locale: { type: String },
      timezone: { type: String },
      currentTime: { type: String, attribute: "current-time" },
      eventId: { type: String, attribute: "event-id" },
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
    void this.#calendarViewConsumer;
    this.addEventListener(
      "interaction-drag-state",
      this.#handleInteractionDragState as EventListener
    );
    this.addEventListener(
      "interaction-drag-offset",
      this.#handleInteractionDragOffset as EventListener
    );
    this.addEventListener(
      "interaction-touch-active",
      this.#handleInteractionTouchActive as EventListener
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
    this.removeEventListener(
      "interaction-touch-active",
      this.#handleInteractionTouchActive as EventListener
    );
    super.disconnectedCallback();
  }

  updated(changedProperties: PropertyValues) {
    super.updated(changedProperties);
  }

  get start(): Temporal.PlainDateTime | null {
    return this.#toPlainDateTimeOrNull(this.#start);
  }

  set start(start: Temporal.PlainDateTime | Temporal.ZonedDateTime | string | null) {
    const oldValue = this.#start;
    this.#start = start?.toString() ?? undefined;
    this.requestUpdate("start", oldValue);
  }

  get end(): Temporal.PlainDateTime | null {
    return this.#toPlainDateTimeOrNull(this.#end);
  }

  set end(end: Temporal.PlainDateTime | Temporal.ZonedDateTime | string | null) {
    const oldValue = this.#end;
    this.#end = end?.toString() ?? undefined;
    this.requestUpdate("end", oldValue);
  }

  setStartFromPlainDateTime(value: Temporal.PlainDateTime) {
    this.start = this.#serializeUpdatedDateTime(value, this.#start);
  }

  setEndFromPlainDateTime(value: Temporal.PlainDateTime) {
    this.end = this.#serializeUpdatedDateTime(value, this.#end);
  }

  get currentTime(): Temporal.PlainDateTime {
    if (this.#currentTime) return this.#toPlainDateTime(this.#currentTime);
    const contextCurrentTime = this.#calendarView?.currentTime;
    if (contextCurrentTime) return this.#toPlainDateTime(contextCurrentTime);
    return Temporal.Now.zonedDateTimeISO(this.timezone).toPlainDateTime();
  }

  set currentTime(
    currentTime: Temporal.PlainDateTime | Temporal.ZonedDateTime | string | null | undefined
  ) {
    this.#currentTime = currentTime?.toString() ?? undefined;
  }

  get timezone(): string {
    return this.#timezone ?? this.#calendarView?.timezone ?? Temporal.Now.timeZoneId();
  }

  set timezone(timezone: string | null | undefined) {
    this.#timezone = timezone ?? undefined;
  }

  get locale(): string {
    return resolveLocale(this.#locale ?? this.#calendarView?.locale);
  }

  set locale(locale: string | null | undefined) {
    this.#locale = locale ?? undefined;
  }

  get startDate(): Temporal.PlainDate | null {
    const start = this.start;
    return start ? start.toPlainDate() : null;
  }

  // NOTE: AllDayEvent overrides this to apply exclusive-end semantics.
  get endDate(): Temporal.PlainDate | null {
    const end = this.end;
    return end ? end.toPlainDate() : null;
  }

  get startTime(): Temporal.PlainTime | null {
    const start = this.start;
    return start ? start.toPlainTime() : null;
  }

  get endTime(): Temporal.PlainTime | null {
    const end = this.end;
    return end ? end.toPlainTime() : null;
  }

  get isPast(): boolean {
    const end = this.end;
    return end ? Temporal.PlainDateTime.compare(end, this.currentTime) <= 0 : false;
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

  protected get startInputValue(): string | null {
    return this.#start ?? null;
  }

  protected get endInputValue(): string | null {
    return this.#end ?? null;
  }

  protected get startHasTimeComponent(): boolean {
    return this.#hasTimeComponent(this.#start);
  }

  protected get endHasTimeComponent(): boolean {
    return this.#hasTimeComponent(this.#end);
  }

  protected get originalStartZonedDateTime(): Temporal.ZonedDateTime | null {
    if (!this.#start || !this.#isTimezonedString(this.#start)) return null;
    return Temporal.ZonedDateTime.from(this.#start);
  }

  protected get originalEndZonedDateTime(): Temporal.ZonedDateTime | null {
    if (!this.#end || !this.#isTimezonedString(this.#end)) return null;
    return Temporal.ZonedDateTime.from(this.#end);
  }

  protected get renderedDayBounds():
    | { firstDay: Temporal.PlainDate; lastDay: Temporal.PlainDate }
    | null {
    if (!this.renderedDays.length) return null;

    let firstDay = this.renderedDays[0];
    let lastDay = this.renderedDays[0];
    for (const day of this.renderedDays) {
      if (Temporal.PlainDate.compare(day, firstDay) < 0) firstDay = day;
      if (Temporal.PlainDate.compare(day, lastDay) > 0) lastDay = day;
    }

    return { firstDay, lastDay };
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
    const pointerType =
      typeof event.detail?.pointerType === "string" ? (event.detail.pointerType as string) : undefined;
    if (isDragging) {
      this.setAttribute("data-dragging", "");
      if (pointerType === "touch") {
        this.setAttribute("data-dragging-touch", "");
      } else {
        this.removeAttribute("data-dragging-touch");
      }
      this.onDragStart();
    } else {
      if (this.#justDroppedTimeout) clearTimeout(this.#justDroppedTimeout);
      this.setAttribute("data-just-dropped", "");
      this.#justDroppedTimeout = setTimeout(() => {
        this.removeAttribute("data-just-dropped");
        this.#justDroppedTimeout = null;
      }, 150);
      this.removeAttribute("data-dragging");
      this.removeAttribute("data-dragging-touch");
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

  #handleInteractionTouchActive = (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const active = Boolean(event.detail?.active);
    if (active) {
      this.setAttribute("data-touch-interacting", "");
    } else {
      this.removeAttribute("data-touch-interacting");
    }
    this.requestUpdate();
  };

  #toPlainDateTimeOrNull(value: string | undefined): Temporal.PlainDateTime | null {
    if (!value) return null;
    return this.#toPlainDateTime(value);
  }

  #toPlainDateTime(value: string): Temporal.PlainDateTime {
    if (this.#isTimezonedString(value)) {
      return Temporal.ZonedDateTime.from(value).withTimeZone(this.timezone).toPlainDateTime();
    }
    if (!value.includes("T")) {
      return Temporal.PlainDate.from(value).toPlainDateTime({
        hour: 0,
        minute: 0,
        second: 0,
      });
    }
    return Temporal.PlainDateTime.from(value);
  }

  #isTimezonedString(value: string): boolean {
    return value.includes("[") && value.includes("]");
  }

  #hasTimeComponent(value: string | undefined): boolean {
    if (!value) return false;
    return value.includes("T");
  }

  #serializeUpdatedDateTime(
    value: Temporal.PlainDateTime,
    originalValue: string | undefined
  ): string {
    if (originalValue && !this.#hasTimeComponent(originalValue)) {
      return value.toPlainDate().toString();
    }

    if (!originalValue || !this.#isTimezonedString(originalValue)) {
      return value.toString();
    }

    const originalTimeZone = Temporal.ZonedDateTime.from(originalValue).timeZoneId;
    const displayZonedDateTime = value.toZonedDateTime(this.timezone);
    return displayZonedDateTime.withTimeZone(originalTimeZone).toString();
  }
}
