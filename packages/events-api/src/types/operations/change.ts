import type { CalendarEventRecord } from "../event/index.js";
import type { EventKey } from "./primitives.js";

export type EventChange =
  | { type: "created"; key: EventKey; event: CalendarEventRecord }
  | { type: "updated"; key: EventKey; before: CalendarEventRecord; after: CalendarEventRecord }
  | { type: "removed"; key: EventKey; before: CalendarEventRecord };
