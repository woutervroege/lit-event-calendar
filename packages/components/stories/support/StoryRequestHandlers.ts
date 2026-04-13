import { action } from "storybook/actions";
import type {
  EventKeyDetail,
  EventSelectionRequestDetail,
} from "../../src/types/CalendarEventRequests.js";
import type { CalendarEvent } from "./StoryData.js";

type StoryCalendarElement = HTMLElement & { events: Map<string, CalendarEvent> };

type AttachRequestHandlersOptions = {
  onPendingChanged?: () => void;
};

const logCreateRequested = action("event-created");
const logUpdateRequested = action("event-updated");
const logDeleteRequested = action("event-deleted");
const logSelectionRequested = action("event-selected");

function readKeyDetail(event: CustomEvent<unknown>): EventKeyDetail | null {
  const detail = event.detail;
  if (typeof detail !== "object" || detail === null) return null;
  if (!("key" in detail) || typeof (detail as { key: unknown }).key !== "string") return null;
  if ("envelope" in detail || "content" in detail) return null;
  return detail as EventKeyDetail;
}

export function attachRequestEventHandlers(
  el: StoryCalendarElement,
  options: AttachRequestHandlersOptions = {}
) {
  const notify = options.onPendingChanged;

  el.addEventListener("event-selected", (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const detail = event.detail as EventSelectionRequestDetail | null;
    if (!detail?.key) return;
    logSelectionRequested(detail);
  });

  el.addEventListener("event-created", (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const detail = readKeyDetail(event);
    if (!detail?.key) return;
    logCreateRequested(detail);
    notify?.();
  });

  el.addEventListener("event-updated", (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const detail = readKeyDetail(event);
    if (!detail?.key) return;
    logUpdateRequested(detail);
    notify?.();
  });

  el.addEventListener("event-deleted", (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const detail = readKeyDetail(event);
    if (!detail?.key) return;
    logDeleteRequested(detail);
    notify?.();
  });
}

export function attachUnsyncedRequestEventHandlers(
  el: StoryCalendarElement,
  options: AttachRequestHandlersOptions = {}
) {
  attachRequestEventHandlers(el, options);
}
