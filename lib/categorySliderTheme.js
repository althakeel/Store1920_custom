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

export function normalizeCategorySliderSideImagePosition(value) {
  return String(value || '').trim().toLowerCase() === 'right' ? 'right' : 'left';
}

export function normalizeCategorySliderAutoSlide(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

export const DEFAULT_CATEGORY_SLIDER_AUTO_SLIDE_INTERVAL_MS = 4000;

export const CATEGORY_SLIDER_AUTO_SLIDE_SPEED_PRESETS = [
  { label: 'Fast (2s)', value: 2000 },
  { label: 'Normal (4s)', value: 4000 },
  { label: 'Slow (6s)', value: 6000 },
  { label: 'Very slow (8s)', value: 8000 },
];

const AUTO_SLIDE_INTERVAL_MIN_MS = 2000;
const AUTO_SLIDE_INTERVAL_MAX_MS = 12000;

export function normalizeCategorySliderAutoSlideInterval(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_CATEGORY_SLIDER_AUTO_SLIDE_INTERVAL_MS;
  return Math.min(AUTO_SLIDE_INTERVAL_MAX_MS, Math.max(AUTO_SLIDE_INTERVAL_MIN_MS, Math.round(parsed)));
}
