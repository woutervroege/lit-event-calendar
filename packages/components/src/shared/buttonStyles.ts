const sharedButtonBaseClasses =
  "inline-flex h-9 [@media(pointer:coarse)]:h-11 items-center rounded-lg [--_lc-button-bg-default:light-dark(rgb(255_255_255_/_94%),rgb(255_255_255_/_24%))] [--_lc-button-hover-bg-default:light-dark(rgb(255_255_255_/_98%),rgb(255_255_255_/_30%))] [--_lc-button-checked-bg-default:var(--_lc-button-bg-default)] [--_lc-button-checked-hover-bg-default:var(--_lc-button-hover-bg-default)] [--_lc-button-border-color:light-dark(var(--_lc-grid-line-color,rgb(15_23_42_/_14%)),var(--_lc-grid-line-color,rgb(255_255_255_/_16%)))] border border-solid border-[var(--_lc-button-border-color)] text-sm leading-5 text-[light-dark(rgb(15_23_42_/_72%),rgb(255_255_255_/_72%))] transition-colors duration-200";

export const sharedButtonVisualClasses = `${sharedButtonBaseClasses} px-4`;

export const sharedButtonCompactVisualClasses =
  `${sharedButtonBaseClasses} min-w-9 [@media(pointer:coarse)]:min-w-11 justify-center px-[9.2px]`;

export const sharedButtonActiveBackgroundClasses =
  "bg-[var(--_lc-button-bg,var(--lc-button-bg,var(--_lc-button-bg-default)))]";

export const sharedButtonActiveTextClasses =
  "text-[light-dark(rgb(15_23_42_/_92%),rgb(255_255_255_/_95%))]";

export const sharedButtonHoverTintClasses =
  "hover:bg-[var(--_lc-button-hover-bg,var(--lc-button-hover-bg,var(--_lc-button-hover-bg-default)))]";

export const sharedFocusRingColorClasses =
  "[--_lc-focus-outline-color:light-dark(rgb(15_23_42_/_92%),rgb(255_255_255_/_96%))] [--_lc-focus-ring-color:light-dark(rgb(15_23_42_/_85%),rgb(255_255_255_/_92%))] [--_lc-focus-ring-offset-color:light-dark(rgb(255_255_255),rgb(2_6_23))]";

export const sharedButtonFocusRingClasses =
  "focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-[var(--_lc-focus-outline-color)] focus-visible:outline-offset-2 focus-visible:ring-2 focus-visible:ring-[var(--_lc-focus-ring-color)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--_lc-focus-ring-offset-color)]";

export const sharedButtonDisabledClasses =
  "disabled:opacity-55 disabled:cursor-not-allowed disabled:hover:bg-[var(--_lc-button-bg,var(--lc-button-bg,var(--_lc-button-bg-default)))] cursor-pointer";

export const sharedButtonPeerFocusRingClasses =
  "peer-focus-visible:outline-solid peer-focus-visible:outline-2 peer-focus-visible:outline-[light-dark(rgb(15_23_42_/_92%),rgb(255_255_255_/_96%))] peer-focus-visible:outline-offset-2 peer-focus-visible:ring-2 peer-focus-visible:ring-[light-dark(rgb(15_23_42_/_85%),rgb(255_255_255_/_92%))] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[light-dark(rgb(255_255_255),rgb(2_6_23))]";

export const sharedButtonPeerCheckedClasses =
  "peer-checked:bg-[var(--_lc-button-checked-bg,var(--lc-button-checked-bg,var(--_lc-button-checked-bg-default)))] peer-checked:text-[light-dark(rgb(15_23_42_/_92%),rgb(255_255_255_/_95%))] peer-checked:hover:bg-[var(--_lc-button-checked-hover-bg,var(--lc-button-checked-hover-bg,var(--_lc-button-checked-hover-bg-default)))]";

export const sharedButtonPeerDisabledClasses =
  "peer-disabled:opacity-55 peer-disabled:cursor-not-allowed cursor-pointer";
