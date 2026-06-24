import { normalizeCategoryLabel } from './categorySlug.js';

/** @typedef {{ path: string, slug: string, keywords: string[], priority?: number }} MatchRule */

/** @type {Record<string, string>} old category name → new category path */
export const OLD_CATEGORY_MAPPING = {
  audio: 'Electronics > Audio & Headphones',
  automotive: 'Car & Automotive',
  'baby and kids': 'Baby, Kids & Maternity',
  'baby and maternity': 'Baby, Kids & Maternity',
  'baby, kids and maternity': 'Baby, Kids & Maternity',
  'beauty and personal care': 'Health, Beauty & Personal Care',
  'cables and connectivity': 'Electronics > Computers & Laptops > Cables & Connectivity',
  'cameras and accessories': 'Electronics > Cameras & Photography',
  'car accessories': 'Car & Automotive > Car Accessories & Electronics',
  coffee: 'Home & Living > Kitchen & Dining > Coffee & Tea',
  'computer and office accessories': 'Electronics > Computers & Laptops',
  'computers and accessories': 'Electronics > Computers & Laptops',
  electronics: 'Electronics',
  fashion: 'Clothing & Fashion',
  'furniture and home living': 'Home & Living > Furniture',
  gaming: 'Electronics > Gaming',
  'health and personal care': 'Health, Beauty & Personal Care',
  'home and bathroom': 'Home & Living > Bedding & Bath',
  'home and garden': 'Garden & Outdoor',
  'home and kitchen': 'Home & Living > Kitchen & Dining',
  'home and living': 'Home & Living',
  'home appliances': 'Home & Living > Home Appliances',
  'home improvement and tools': 'Tools, Hardware & Home Improvement',
  'kids and education': 'Baby, Kids & Maternity > Toys, Games & Education',
  'lingerie and loungewear': "Clothing & Fashion > Women's Clothing > Lingerie & Loungewear",
  "men's clothing": "Clothing & Fashion > Men's Clothing",
  'mobile accessories': 'Electronics > Mobile & Smartphones > Mobile Accessories',
  'office furniture': 'Office & Stationery > Office Furniture',
  'outdoor and garden': 'Garden & Outdoor',
  'pet supplies': 'Pets & Pet Supplies',
  pets: 'Pets & Pet Supplies',
  'power and energy': 'Electronics > Power & Energy',
  'security and safety': 'Electronics > Smart Home & Security',
  'shoes and footwear': 'Clothing & Fashion > Shoes & Footwear',
  'smart gadgets and electronics': 'Electronics',
  'special occasion and costumes': 'Clothing & Fashion > Costumes & Special Occasion',
  'sports and fitness': 'Sports, Fitness & Outdoors',
  'sports and outdoor': 'Sports, Fitness & Outdoors',
  'sports, outdoors and hobbies': 'Sports, Fitness & Outdoors',
  'tools and hardware': 'Tools, Hardware & Home Improvement',
  'toys and learning': 'Baby, Kids & Maternity > Toys, Games & Education',
  'toys, games and entertainment': 'Baby, Kids & Maternity > Toys, Games & Education',
  'travel and luggage': 'Travel & Luggage',
  'travel accessories': 'Travel & Luggage > Travel Accessories',
  "women's clothing": "Clothing & Fashion > Women's Clothing",
};

/** @type {MatchRule[]} */
export const TITLE_KEYWORD_RULES = [
  { path: 'Electronics > Mobile & Smartphones > Smartphones', slug: 'smartphones', keywords: ['iphone', 'samsung galaxy', 'smartphone', 'android phone', 'mobile phone'], priority: 10 },
  { path: 'Electronics > Mobile & Smartphones > Tablets', slug: 'tablets', keywords: ['ipad', 'tablet', 'galaxy tab'], priority: 10 },
  { path: 'Electronics > Mobile & Smartphones > Mobile Accessories', slug: 'mobile-accessories', keywords: ['phone case', 'iphone case', 'screen protector', 'mobile cover', 'phone holder'], priority: 9 },
  { path: 'Electronics > Mobile & Smartphones > Smartwatches & Wearables', slug: 'smartwatches-wearables', keywords: ['smart watch', 'smartwatch', 'fitness band', 'wearable'], priority: 9 },
  { path: 'Electronics > Computers & Laptops > Laptops & Notebooks', slug: 'laptops-notebooks', keywords: ['laptop', 'notebook', 'macbook', 'chromebook', 'ultrabook'], priority: 10 },
  { path: 'Electronics > Computers & Laptops > Desktops & Monitors', slug: 'desktops-monitors', keywords: ['desktop', 'monitor', 'pc tower', 'all-in-one pc'], priority: 9 },
  { path: 'Electronics > Computers & Laptops > Cables & Connectivity', slug: 'cables-connectivity', keywords: ['hdmi cable', 'usb cable', 'ethernet', 'adapter cable', 'type-c cable'], priority: 8 },
  { path: 'Electronics > Computers & Laptops > Computer Accessories', slug: 'computer-accessories', keywords: ['keyboard', 'mouse pad', 'webcam', 'laptop stand', 'usb hub'], priority: 8 },
  { path: 'Electronics > Audio & Headphones > Headphones & Earbuds', slug: 'headphones-earbuds', keywords: ['headphone', 'earbud', 'earphone', 'airpods', 'wireless earbuds', 'headset'], priority: 9 },
  { path: 'Electronics > Audio & Headphones > Speakers', slug: 'speakers', keywords: ['bluetooth speaker', 'soundbar', 'subwoofer', 'portable speaker'], priority: 8 },
  { path: 'Electronics > Cameras & Photography', slug: 'cameras-photography', keywords: ['camera', 'dslr', 'mirrorless', 'gopro', 'action cam'], priority: 8 },
  { path: 'Electronics > Gaming', slug: 'gaming', keywords: ['playstation', 'xbox', 'nintendo', 'gaming controller', 'gaming chair'], priority: 8 },
  { path: 'Electronics > Power & Energy > Power Banks & Chargers', slug: 'power-banks-chargers', keywords: ['power bank', 'charger', 'fast charger', 'wireless charger'], priority: 8 },
  { path: 'Electronics > Smart Home & Security', slug: 'smart-home-security', keywords: ['security camera', 'cctv', 'smart lock', 'doorbell camera', 'alarm'], priority: 8 },
  { path: 'Electronics > TVs & Home Entertainment > Televisions', slug: 'televisions', keywords: ['television', ' smart tv', 'oled tv', 'led tv'], priority: 9 },
  { path: 'Home & Living > Furniture > Sofas & Seating', slug: 'sofas-seating', keywords: ['sofa', 'couch', 'recliner', 'armchair'], priority: 9 },
  { path: 'Home & Living > Furniture > Beds & Mattresses', slug: 'beds-mattresses', keywords: ['bed frame', 'mattress', 'bedding set'], priority: 9 },
  { path: 'Home & Living > Furniture > Wardrobes & Storage', slug: 'wardrobes-storage', keywords: ['wardrobe', 'closet', 'cabinet', 'dresser'], priority: 8 },
  { path: 'Home & Living > Kitchen & Dining > Coffee & Tea', slug: 'coffee-tea', keywords: ['coffee machine', 'espresso', 'coffee maker', 'kettle', 'tea pot'], priority: 9 },
  { path: 'Home & Living > Kitchen & Dining', slug: 'kitchen-dining', keywords: ['cookware', 'dinnerware', 'kitchen set', 'cutlery'], priority: 7 },
  { path: 'Home & Living > Bedding & Bath', slug: 'bedding-bath', keywords: ['bath towel', 'shower curtain', 'bathroom', 'bed sheet', 'pillow'], priority: 8 },
  { path: 'Home & Living > Home Appliances', slug: 'home-appliances', keywords: ['washing machine', 'refrigerator', 'air conditioner', 'vacuum cleaner', 'microwave'], priority: 8 },
  { path: 'Health, Beauty & Personal Care > Makeup & Cosmetics', slug: 'makeup-cosmetics', keywords: ['lipstick', 'foundation', 'mascara', 'eyeliner', 'concealer'], priority: 9 },
  { path: 'Health, Beauty & Personal Care > Fragrance & Perfumes', slug: 'fragrance-perfumes', keywords: ['perfume', 'oud', 'cologne', 'eau de parfum', 'edp', 'fragrance'], priority: 9 },
  { path: 'Health, Beauty & Personal Care > Skincare', slug: 'skincare', keywords: ['moisturizer', 'serum', 'sunscreen', 'face cream', 'cleanser'], priority: 8 },
  { path: 'Health, Beauty & Personal Care > Hair Care', slug: 'hair-care', keywords: ['shampoo', 'conditioner', 'hair dryer', 'hair straightener'], priority: 8 },
  { path: 'Health, Beauty & Personal Care > Personal Care & Hygiene', slug: 'personal-care-hygiene', keywords: ['toothbrush', 'toothpaste', 'deodorant', 'body wash'], priority: 7 },
  { path: 'Baby, Kids & Maternity > Baby Essentials', slug: 'baby-essentials', keywords: ['nappy', 'diaper', 'baby wipe', 'baby formula', 'stroller', 'baby bottle'], priority: 9 },
  { path: 'Baby, Kids & Maternity > Toys, Games & Education', slug: 'toys-games-education', keywords: ['toy', 'puzzle', 'lego', 'board game', 'educational'], priority: 8 },
  { path: 'Sports, Fitness & Outdoors > Fitness Equipment', slug: 'fitness-equipment', keywords: ['dumbbell', 'treadmill', 'yoga mat', 'exercise bike', 'resistance band'], priority: 9 },
  { path: 'Travel & Luggage > Suitcases & Luggage', slug: 'suitcases-luggage', keywords: ['suitcase', 'luggage', 'trolley bag', 'hard case'], priority: 9 },
  { path: 'Travel & Luggage > Travel Accessories', slug: 'travel-accessories', keywords: ['travel pillow', 'luggage tag', 'travel adapter', 'neck pillow'], priority: 8 },
  { path: 'Tools, Hardware & Home Improvement > Hand Tools', slug: 'hand-tools', keywords: ['hammer', 'screwdriver', 'wrench', 'pliers', 'tool set'], priority: 8 },
  { path: 'Tools, Hardware & Home Improvement > Power Tools', slug: 'power-tools', keywords: ['drill', 'angle grinder', 'power saw', 'impact driver'], priority: 8 },
  { path: 'Pets & Pet Supplies > Dog Supplies', slug: 'dog-supplies', keywords: ['dog food', 'dog collar', 'dog leash', 'dog bed'], priority: 9 },
  { path: 'Pets & Pet Supplies > Cat Supplies', slug: 'cat-supplies', keywords: ['cat food', 'cat litter', 'cat tree'], priority: 9 },
  { path: 'Pets & Pet Supplies > Pet Accessories', slug: 'pet-accessories', keywords: ['pet collar', 'pet carrier', 'aquarium'], priority: 7 },
  { path: "Clothing & Fashion > Women's Clothing > Dresses & Abayas", slug: 'dresses-abayas', keywords: ['dress', 'abaya', 'blouse', "women's top", 'maxi dress'], priority: 9 },
  { path: "Clothing & Fashion > Men's Clothing", slug: 'mens-clothing', keywords: ["men's shirt", 'kandura', "men's suit", 'thobe'], priority: 9 },
  { path: 'Clothing & Fashion > Shoes & Footwear', slug: 'shoes-footwear', keywords: ['sneakers', 'running shoes', 'heels', 'sandals', 'boots', 'slippers'], priority: 9 },
  { path: 'Car & Automotive > Car Accessories & Electronics', slug: 'car-accessories-electronics', keywords: ['car charger', 'dash cam', 'car seat cover', 'car mount', 'car vacuum'], priority: 9 },
  { path: 'Office & Stationery > Office Furniture', slug: 'office-furniture', keywords: ['office chair', 'office desk', 'filing cabinet', 'ergonomic chair'], priority: 9 },
  { path: 'Garden & Outdoor', slug: 'garden-outdoor', keywords: ['garden', 'lawn', 'patio', 'bbq grill', 'outdoor furniture'], priority: 7 },
  { path: 'Clothing & Fashion > Bags & Accessories', slug: 'bags-accessories', keywords: ['handbag', 'backpack', 'wallet', 'belt', 'sunglasses'], priority: 7 },
  { path: 'Clothing & Fashion > Watches & Jewelry', slug: 'watches-jewelry', keywords: ['watch', 'necklace', 'bracelet', 'ring', 'earring'], priority: 8 },
  { path: 'Office & Stationery > Stationery & Supplies', slug: 'stationery-supplies', keywords: ['pen', 'notebook', 'marker', 'stapler', 'paper'], priority: 7 },
];

const REASSIGN_BY_TITLE_ONLY = new Set([
  'accessories',
  'lifestyle accessories',
  'outdoor and travel',
]);

function normalizeText(value = '') {
  return normalizeCategoryLabel(value);
}

function containsKeyword(text, keyword) {
  const haystack = normalizeText(text);
  const needle = normalizeText(keyword);
  if (!needle) return false;
  if (needle.includes(' ')) {
    return haystack.includes(needle);
  }
  const pattern = new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  return pattern.test(haystack);
}

export function matchCategoryByKeywords(text, source = 'title') {
  const normalized = normalizeText(text);
  if (!normalized) return null;

  let best = null;
  for (const rule of TITLE_KEYWORD_RULES) {
    for (const keyword of rule.keywords) {
      if (!containsKeyword(normalized, keyword)) continue;
      const priority = (rule.priority || 5) + (source === 'description' ? 0 : 1);
      if (!best || priority > best.priority) {
        best = { path: rule.path, slug: rule.slug, keyword, matchMethod: source, priority };
      }
    }
  }

  if (!best) return null;
  const { priority, ...result } = best;
  return result;
}

export function matchCategoryByOldMapping(oldCategoryName, pathIndex) {
  const normalized = normalizeText(oldCategoryName);
  if (!normalized) return null;

  if (REASSIGN_BY_TITLE_ONLY.has(normalized)) {
    return { path: null, slug: null, matchMethod: 'mapping-deferred' };
  }

  const mappedPath = OLD_CATEGORY_MAPPING[normalized];
  if (!mappedPath) return null;

  const indexed = pathIndex.get(mappedPath);
  if (!indexed) return null;

  return { path: mappedPath, slug: indexed.slug, matchMethod: 'mapping' };
}

export function resolveProductCategory(product, pathIndex, oldCategoryIdToName = new Map()) {
  const title = String(product?.name || '');
  const description = [
    product?.description,
    product?.shortDescription,
    product?.shortDescription2,
  ].filter(Boolean).join(' ');

  const titleMatch = matchCategoryByKeywords(title, 'title');
  if (titleMatch?.slug) {
    const indexed = pathIndex.get(titleMatch.path);
    if (indexed) return { ...indexed, matchMethod: 'title', matchedKeyword: titleMatch.keyword };
  }

  const descriptionMatch = matchCategoryByKeywords(description, 'description');
  if (descriptionMatch?.slug) {
    const indexed = pathIndex.get(descriptionMatch.path);
    if (indexed) return { ...indexed, matchMethod: 'description', matchedKeyword: descriptionMatch.keyword };
  }

  const oldValues = [product?.category, ...(product?.categories || [])].filter(Boolean);
  for (const raw of oldValues) {
    const key = String(raw);
    const oldName = oldCategoryIdToName.get(key) || oldCategoryIdToName.get(normalizeText(key)) || key;
    const mapping = matchCategoryByOldMapping(oldName, pathIndex);
    if (mapping?.matchMethod === 'mapping-deferred') {
      const retryTitle = matchCategoryByKeywords(title, 'title') || matchCategoryByKeywords(description, 'description');
      if (retryTitle?.path) {
        const indexed = pathIndex.get(retryTitle.path);
        if (indexed) return { ...indexed, matchMethod: 'title' };
      }
      continue;
    }
    if (mapping?.slug) {
      const indexed = pathIndex.get(mapping.path);
      if (indexed) return { ...indexed, matchMethod: 'mapping' };
    }
  }

  return null;
}

export function buildCategoryPathIndex(flatCategories) {
  const index = new Map();
  for (const category of flatCategories) {
    index.set(category.path, { id: category.id, path: category.path, slug: category.slug });
    index.set(category.slug, { id: category.id, path: category.path, slug: category.slug });
  }
  return index;
}

export function flattenHierarchySeeds(seeds, parentPath = '', parentSegments = []) {
  const flat = [];
  let order = 0;

  const walk = (nodes, ancestors, pathPrefix) => {
    for (const node of nodes) {
      order += 1;
      const segments = [...ancestors, { name: node.name, slug: node.slug }];
      const path = pathPrefix ? `${pathPrefix} > ${node.name}` : node.name;
      const level = segments.length;
      flat.push({
        name: node.name,
        slug: node.slug,
        level,
        path,
        pathSegments: segments.map((item) => item.slug),
        sortOrder: order,
      });
      if (Array.isArray(node.children) && node.children.length) {
        walk(node.children, segments, path);
      }
    }
  };

  walk(seeds, parentSegments, parentPath);
  return flat;
}
