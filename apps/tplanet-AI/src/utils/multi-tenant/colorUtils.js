/**
 * Color contrast utilities for tenant theme.
 * Uses WCAG 2.0 relative luminance to pick black or white text.
 */

/**
 * Parse a hex color string to RGB values.
 * Supports #RGB and #RRGGBB formats.
 * @param {string} hex - Hex color string
 * @returns {{ r: number, g: number, b: number } | null}
 */
function parseHex(hex) {
  if (!hex || typeof hex !== 'string') return null;
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16),
    };
  }
  if (clean.length === 6) {
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16),
    };
  }
  return null;
}

/**
 * Calculate WCAG 2.0 relative luminance.
 * @param {{ r: number, g: number, b: number }} rgb
 * @returns {number} Luminance value between 0 and 1
 */
function relativeLuminance({ r, g, b }) {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Return '#000000' or '#ffffff' for best contrast against the given background.
 * @param {string} hexColor - Background color in hex (#RGB or #RRGGBB)
 * @returns {string} '#000000' for light backgrounds, '#ffffff' for dark backgrounds
 */
export function getContrastColor(hexColor) {
  const rgb = parseHex(hexColor);
  if (!rgb) return '#ffffff';
  return relativeLuminance(rgb) > 0.179 ? '#000000' : '#ffffff';
}
