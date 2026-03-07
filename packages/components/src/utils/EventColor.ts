export function getEventColorStyles(color: string): Record<string, string> {
  if (!isHexColor(color)) return {};

  const rgb = hexToRgb(color);
  if (!rgb) return {};

  const backgroundColor = rgbToRgba(tintColor(rgb, 0.7), 0.8);
  const backgroundColorHover = rgbToRgba(tintColor(rgb, 0.7), 0.95);
  const backgroundColorFocus = rgbToRgba(tintColor(rgb, 0.55), 1);
  const borderColor = rgbToHex(shadeColor(rgb, 0.15));
  const shadowColor = rgbToHex(shadeColor(rgb, 0.35));
  const textColor = rgbToHex(shadeColor(rgb, 0.55));

  return {
    "--_lc-event-bg": backgroundColor,
    "--_lc-event-border-color": borderColor,
    "--_lc-event-bg-hover": backgroundColorHover,
    "--_lc-event-bg-focus": backgroundColorFocus,
    "--_lc-event-text-color": textColor,
    "--_lc-event-accent-color": color,
    "--_lc-event-shadow": `0 1px 3px 0 ${shadowColor}`,
  };
}

export function isHexColor(color: string | undefined): boolean {
  if (!color) return false;
  return /^#[0-9A-F]{6}$/i.test(color);
}

export function hexToRgb(hex: string | undefined): { r: number; g: number; b: number } | null {
  if (!hex) return null;
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

type Rgb = { r: number; g: number; b: number };

function rgbToHex({ r, g, b }: Rgb): string {
  const toHex = (value: number) => {
    const clamped = Math.max(0, Math.min(255, Math.round(value)));
    return clamped.toString(16).padStart(2, "0");
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function rgbToRgba({ r, g, b }: Rgb, alpha: number): string {
  const clampByte = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
  const clampAlpha = (value: number) => Math.max(0, Math.min(1, value));
  const a = clampAlpha(alpha);
  return `rgba(${clampByte(r)}, ${clampByte(g)}, ${clampByte(b)}, ${a})`;
}

function tintColor({ r, g, b }: Rgb, factor: number): Rgb {
  const clampedFactor = Math.max(0, Math.min(1, factor));
  return {
    r: r + (255 - r) * clampedFactor,
    g: g + (255 - g) * clampedFactor,
    b: b + (255 - b) * clampedFactor,
  };
}

function shadeColor({ r, g, b }: Rgb, factor: number): Rgb {
  const clampedFactor = Math.max(0, Math.min(1, factor));
  return {
    r: r * (1 - clampedFactor),
    g: g * (1 - clampedFactor),
    b: b * (1 - clampedFactor),
  };
}
