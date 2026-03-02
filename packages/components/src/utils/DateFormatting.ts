export function formatDateRangeShort(
  locale: string | undefined,
  startDate: { toLocaleString(locale: string | undefined, options: Intl.DateTimeFormatOptions): string },
  endDate: { toLocaleString(locale: string | undefined, options: Intl.DateTimeFormatOptions): string }
): string {
  const dateFormatOptions = { month: "short", day: "numeric" } as const;
  const formattedStart = startDate.toLocaleString(locale, dateFormatOptions);
  const formattedEnd = endDate.toLocaleString(locale, dateFormatOptions);
  return `${formattedStart} - ${formattedEnd}`;
}

