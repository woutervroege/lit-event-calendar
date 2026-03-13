export const calendarCssProps = {
  "lc-higlight-color": {
    value: "#ff0000",
    category: "Theme",
    description: "Accent for current-day label and current-time indicator.",
  },
  "lc-event-height": {
    value: "32px",
    category: "Layout",
    description: "Height for all-day event rows.",
  },
  "lc-days-per-row": {
    value: "7",
    control: "text",
    category: "Layout",
    description: "Column count for all-day/month grid layout.",
  },
  "lc-grid-base-color": {
    value: "light-dark(#111, #fff)",
    category: "Theme",
    description: "Base grid color; line/day-number/dropzone colors are derived internally with tints.",
  },
} as const;
