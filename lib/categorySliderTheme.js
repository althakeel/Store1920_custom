export const DEFAULT_CATEGORY_SLIDER_BACKGROUND = '#f3f0ff';

export const CATEGORY_SLIDER_BACKGROUND_PRESETS = [
  { label: 'Lavender', value: '#f3f0ff' },
  { label: 'Soft Blue', value: '#eef6ff' },
  { label: 'Mint', value: '#ecfdf5' },
  { label: 'Peach', value: '#fff7ed' },
  { label: 'Rose', value: '#fff1f2' },
  { label: 'Light Gray', value: '#f8fafc' },
  { label: 'White', value: '#ffffff' },
];

const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function normalizeCategorySliderBackground(value) {
  const raw = String(value || '').trim();
  if (!raw) return DEFAULT_CATEGORY_SLIDER_BACKGROUND;
  if (!HEX_COLOR_RE.test(raw)) return DEFAULT_CATEGORY_SLIDER_BACKGROUND;
  if (raw.length === 4) {
    const [, r, g, b] = raw;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return raw.toLowerCase();
}
