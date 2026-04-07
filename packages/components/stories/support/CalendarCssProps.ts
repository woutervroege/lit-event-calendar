export const calendarCssProps = {
  "lc-higlight-color": {
    value: "#ff0000",
    category: "Theme",
    description: "Accent for current-day label and current-time indicator.",
  },
  "lc-current-day-text-color": {
    value: "#000000",
    category: "Theme",
    description: "Text color for the current-day label.",
  },
  "lc-event-height": {
    value: "32px",
    category: "Layout",
    description: "Height for all-day event rows.",
  },
  "lc-event-card-radius": {
    value: "var(--radius-md, 0.375rem)",
    category: "Theme",
    description:
      "Corner radius for event cards and overflow dots; set to 0 for square corners and square overflow dots.",
  },
  "lc-days-per-row": {
    value: "7",
    control: "text",
    category: "Layout",
    description: "Column count for all-day/month grid layout.",
  },
  "lc-grid-base-color": {
    value: "light-dark(#222, #fff)",
    category: "Theme",
    description:
      "Base grid color; line/day-number/dropzone colors are derived internally with tints.",
  },
  "lg-background-color": {
    value: "light-dark(#fff, #222)",
    category: "Theme",
    description: "Base background color used by sticky calendar surfaces.",
  },
} as const;
