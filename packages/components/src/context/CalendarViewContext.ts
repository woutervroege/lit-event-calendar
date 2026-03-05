import { createContext } from "@lit/context";

export type CalendarViewContextValue = {
  locale: string;
  timezone: string;
  currentTime: string;
};

export const calendarViewContext = createContext<CalendarViewContextValue>(
  Symbol("calendar-view-context")
);
