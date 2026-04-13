import type { CalendarEvent, CalendarEventData } from "../../../types/event.js";
import type { ApplyResult, CreateInput, DomainEffect, EventChange } from "../../../types/operations.js";
import type { ReduceContext } from "../reduceContext.js";
import { cloneState, normalizeTimeRange } from "../helpers.js";

export function applyCreate(input: CreateInput, context: ReduceContext): ApplyResult {
  const state = cloneState(context.state);
  const changes: EventChange[] = [];
  const effects: DomainEffect[] = [];
  const { data: rawData, ...envelope } = input.event;
  const normalized =
    "end" in rawData ?
      normalizeTimeRange({ start: rawData.start, end: rawData.end })
    : normalizeTimeRange({ start: rawData.start, duration: rawData.duration });
  const { summary, color, location, recurrenceRule, exclusionDates, allDay, timeZone } = rawData;
  const colorFields =
    color !== undefined && color !== "" ? ({ color } satisfies Pick<CalendarEventData, "color">) : {};
  const optionalAllDay = allDay !== undefined ? ({ allDay } satisfies Pick<CalendarEventData, "allDay">) : {};
  const optionalTimeZone =
    timeZone !== undefined ? ({ timeZone } satisfies Pick<CalendarEventData, "timeZone">) : {};
  const data: CalendarEventData =
    "end" in rawData ?
      {
        summary,
        ...colorFields,
        location,
        recurrenceRule,
        exclusionDates,
        start: normalized.start,
        end: normalized.end,
        ...optionalAllDay,
        ...optionalTimeZone,
      }
    : {
        summary,
        ...colorFields,
        location,
        recurrenceRule,
        exclusionDates,
        start: normalized.start,
        duration: rawData.duration,
        ...optionalAllDay,
        ...optionalTimeZone,
      };
  const key =
    input.key ??
    envelope.eventId ??
    `event-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const event: CalendarEvent = { ...envelope, data };
  state.set(key, event);
  changes.push({ type: "created", key, event });
  return { nextState: state, changes, effects };
}
