import {
  Baby,
  Bike,
  Car,
  Headphones,
  Home,
  Laptop,
  LayoutGrid,
  PawPrint,
  Shirt,
  Smartphone,
  Sparkles,
  Sprout,
  ToyBrick,
  Tv,
  Watch,
} from 'lucide-react';

export function extractCategorySlugFromHref(href = '') {
  const raw = String(href || '').trim();
  if (!raw) return '';

  try {
    const url = new URL(raw, 'http://localhost');
    const fromQuery = url.searchParams.get('category');
    if (fromQuery) return decodeURIComponent(fromQuery).trim();
  } catch {
    // fall through
  }

  const match = raw.match(/[?&]category=([^&]+)/i);
  return match ? decodeURIComponent(match[1]).trim() : '';
}

export function getCategoryIcon({ slug = '', name = '', href = '' } = {}) {
  const slugKey = String(slug || extractCategorySlugFromHref(href)).toLowerCase();
  const nameKey = String(name || '').toLowerCase();
  const key = `${slugKey} ${nameKey}`;

  if (/mobile|phone|smartphone|tablet|wearable|watch|jewelry/.test(key)) {
    if (/watch|jewelry|ساع|مجهر/.test(key)) return Watch;
    return Smartphone;
  }
  if (/electronic|tv|entertainment|audio|speaker|headphone|camera|gaming|computer|laptop|desktop/.test(key)) {
    if (/laptop|computer|desktop|حاسوب|كمبيوتر/.test(key)) return Laptop;
    if (/headphone|audio|speaker|صوت|سماع/.test(key)) return Headphones;
    return Tv;
  }
  if (/cloth|fashion|apparel|shoe|footwear|bag|dress|abaya|kandura|wear/.test(key)) {
    return Shirt;
  }
  if (/home|living|kitchen|furniture|bed|mattress|decor|appliance/.test(key)) {
    return Home;
  }
  if (/beauty|health|personal-care|skincare|cosmetic|fragrance|perfume/.test(key)) {
    return Sparkles;
  }
  if (/sport|fitness|outdoor|bike|cycle/.test(key)) {
    if (/bike|cycle|دراج/.test(key)) return Bike;
    return Bike;
  }
  if (/baby|kid|maternity|toy|school-uniform/.test(key)) {
    if (/toy|لعب/.test(key)) return ToyBrick;
    return Baby;
  }
  if (/car|auto|automotive|vehicle/.test(key)) {
    return Car;
  }
  if (/garden|outdoor|plant|patio/.test(key)) {
    return Sprout;
  }
  if (/pet|animal/.test(key)) {
    return PawPrint;
  }
  if (/office|stationery|supply/.test(key)) {
    return LayoutGrid;
  }

  // Arabic name hints when slug is missing
  if (/إلكترون|هاتف|جوال|موبايل|ذكي/.test(nameKey)) return Smartphone;
  if (/ملابس|أزياء|عبا|كندور|أحذ/.test(nameKey)) return Shirt;
  if (/منزل|معيش|مطبخ|أثاث/.test(nameKey)) return Home;
  if (/صحة|جمال|عناية/.test(nameKey)) return Sparkles;
  if (/رياض|لياقة|رياضة/.test(nameKey)) return Bike;
  if (/أطفال|رضع|مواليد|أطفال/.test(nameKey)) return Baby;
  if (/سيار|مركب|سيارات/.test(nameKey)) return Car;
  if (/حديقة|خارج|نبات/.test(nameKey)) return Sprout;
  if (/حيوان|أليف|حيوانات/.test(nameKey)) return PawPrint;

  return LayoutGrid;
}
