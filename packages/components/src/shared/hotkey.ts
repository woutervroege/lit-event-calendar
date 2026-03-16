export const sharedHotkeyBadgeClasses =
  "mt-[2px] inline-flex h-[1.05rem] min-w-[1.05rem] items-center justify-center rounded border-[1px] border-solid border-current px-1 text-[0.68rem] leading-none text-[light-dark(rgb(15_23_42_/_58%),rgb(255_255_255_/_64%))]";

export function normalizeHotkey(value: string | undefined | null): string | undefined {
  const trimmed = value?.trim().toLowerCase();
  return trimmed ? trimmed : undefined;
}

export function isEditableEventTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

export function getPlainCharacterHotkey(event: KeyboardEvent): string | undefined {
  if (event.metaKey || event.ctrlKey || event.altKey) return undefined;
  if (event.key.length !== 1) return undefined;
  return event.key.toLowerCase();
}
