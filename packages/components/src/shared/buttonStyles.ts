const sharedButtonBaseClasses =
  "inline-flex h-9 items-center rounded-md text-sm leading-5 text-[light-dark(rgb(15_23_42_/_72%),rgb(255_255_255_/_72%))] transition-colors duration-200";

export const sharedButtonVisualClasses = `${sharedButtonBaseClasses} px-6`;

export const sharedButtonCompactVisualClasses =
  `${sharedButtonBaseClasses} min-w-9 justify-center px-[9.2px]`;

export const sharedButtonActiveBackgroundClasses =
  "bg-[light-dark(rgb(15_23_42_/_18%),rgb(255_255_255_/_16%))]";

export const sharedButtonActiveTextClasses =
  "text-[light-dark(rgb(15_23_42_/_92%),rgb(255_255_255_/_95%))]";

export const sharedButtonHoverTintClasses =
  "hover:bg-[light-dark(rgb(15_23_42_/_10%),rgb(255_255_255_/_12%))]";

export const sharedFocusRingColorClasses =
  "[--_lc-focus-outline-color:light-dark(rgb(15_23_42_/_92%),rgb(255_255_255_/_96%))] [--_lc-focus-ring-color:light-dark(rgb(15_23_42_/_85%),rgb(255_255_255_/_92%))] [--_lc-focus-ring-offset-color:light-dark(rgb(255_255_255),rgb(2_6_23))]";

export const sharedButtonFocusRingClasses =
  "focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-[var(--_lc-focus-outline-color)] focus-visible:outline-offset-2 focus-visible:ring-2 focus-visible:ring-[var(--_lc-focus-ring-color)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--_lc-focus-ring-offset-color)]";

export const sharedButtonDisabledClasses =
  "disabled:opacity-55 disabled:cursor-not-allowed disabled:hover:bg-[light-dark(rgb(15_23_42_/_18%),rgb(255_255_255_/_16%))] cursor-pointer";

export const sharedButtonPeerFocusRingClasses =
  "peer-focus-visible:outline-solid peer-focus-visible:outline-2 peer-focus-visible:outline-[light-dark(rgb(15_23_42_/_92%),rgb(255_255_255_/_96%))] peer-focus-visible:outline-offset-2 peer-focus-visible:ring-2 peer-focus-visible:ring-[light-dark(rgb(15_23_42_/_85%),rgb(255_255_255_/_92%))] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[light-dark(rgb(255_255_255),rgb(2_6_23))]";

export const sharedButtonPeerCheckedClasses =
  "peer-checked:bg-[light-dark(rgb(15_23_42_/_18%),rgb(255_255_255_/_16%))] peer-checked:text-[light-dark(rgb(15_23_42_/_92%),rgb(255_255_255_/_95%))] peer-checked:hover:bg-[light-dark(rgb(15_23_42_/_18%),rgb(255_255_255_/_16%))]";

export const sharedButtonPeerDisabledClasses =
  "peer-disabled:opacity-55 peer-disabled:cursor-not-allowed cursor-pointer";
