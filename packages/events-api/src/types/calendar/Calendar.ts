import type { CalendarAccountId } from "./CalendarAccountId.js";
import type { CalendarUrl } from "./CalendarUrl.js";

/**
 * Display and sync metadata for one calendar. The {@link CalendarsMap} key is {@link CalendarId},
 * not duplicated here.
 */
export type Calendar = {
  accountId: CalendarAccountId;
  /** Resource URL; may match another calendar’s URL under a different account. */
  url: CalendarUrl;
  displayName: string;
  color: string;
};
