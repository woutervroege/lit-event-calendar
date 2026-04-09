import { describe, expect, it } from "vitest";
import { Temporal } from "@js-temporal/polyfill";
import { parseRecurrenceId, shiftRecurrenceId, toRecurrenceId } from "./recurrence.js";

describe("recurrence helpers", () => {
  it("formats and parses timed recurrence ids", () => {
    const template = Temporal.PlainDateTime.from("2025-01-13T09:00:00");
    const value = Temporal.PlainDateTime.from("2025-01-18T11:15:00");
    const recurrenceId = toRecurrenceId(value, template);
    expect(recurrenceId).toBe("20250118T111500");
    const parsed = parseRecurrenceId(recurrenceId, template);
    expect(parsed?.toString()).toBe("2025-01-18T11:15:00");
  });

  it("formats and parses date-only recurrence ids", () => {
    const template = Temporal.PlainDate.from("2025-01-13");
    const value = Temporal.PlainDate.from("2025-01-18");
    const recurrenceId = toRecurrenceId(value, template);
    expect(recurrenceId).toBe("20250118");
    const parsed = parseRecurrenceId(recurrenceId, template);
    expect(parsed?.toString()).toBe("2025-01-18");
  });

  it("shifts recurrence ids by duration", () => {
    const template = Temporal.PlainDateTime.from("2025-01-13T09:00:00");
    const shifted = shiftRecurrenceId(
      "20250118T090000",
      template,
      Temporal.Duration.from({ hours: 1 })
    );
    expect(shifted).toBe("20250118T100000");
  });
});
