import { Temporal } from "@js-temporal/polyfill";
import { resolveLocale } from "./Locale.js";

export function getHourlyTimeLabels(lang: string | null | undefined, hours = 24): string[] {
  const clampedHours = Math.max(0, Math.floor(Number(hours) || 0));
  const resolvedLocale = resolveLocale(lang);

  return Array.from({ length: clampedHours }, (_, hour) =>
    Temporal.PlainTime.from({ hour, minute: 0 }).toLocaleString(resolvedLocale, {
      hour: "2-digit",
      minute: "2-digit",
    })
  );
}
