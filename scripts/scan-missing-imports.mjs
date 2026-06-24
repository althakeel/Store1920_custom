import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', '.cursor']);
const SKIP_FILES = /_(backup|new|old)\./i;
const issues = [];

const HOOKS = [
  'useAuth', 'useRouter', 'useDispatch', 'useSelector', 'usePathname', 'useSearchParams',
  'useParams', 'useStorefrontI18n', 'useStorefrontMarket', 'useProductWishlist',
  'useLocationTracking', 'useStoreFetch', 'useHorizontalCarouselDrag',
];

const ASSET_RE = /\b(Creditimage\d+|Img\d+|Mainslider\d+|MainSlider\d+|SubBanner\d+|Banner\d+)\b/g;

function getImports(src) {
  const imports = new Set();
  for (const m of src.matchAll(/import\s+(\w+)\s+from/g)) imports.add(m[1]);
  for (const m of src.matchAll(/import\s+(\w+)\s*,\s*\{/g)) imports.add(m[1]);
  for (const m of src.matchAll(/import\s*\{([^}]+)\}/g)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop().trim();
      if (name) imports.add(name);
    }
  }
  return imports;
}

function isDefinedLocally(src, id) {
  return [
    `(?:const|let|var|function|class)\\s+${id}\\b`,
    `export\\s+(?:default\\s+)?(?:function|class|const|let|var)\\s+${id}\\b`,
  ].some((pattern) => new RegExp(pattern).test(src));
}

function checkFile(file) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  const src = fs.readFileSync(file, 'utf8');
  const imports = getImports(src);
  const suspects = new Set();

  for (const hook of HOOKS) {
    if (new RegExp(`\\b${hook}\\s*\\(`).test(src) && !imports.has(hook) && !isDefinedLocally(src, hook)) {
      suspects.add(hook);
    }
  }

  for (const m of src.matchAll(/(?:src|href)=\{([A-Z][A-Za-z0-9_]*)\}/g)) {
    suspects.add(m[1]);
  }

  for (const m of src.matchAll(ASSET_RE)) {
    suspects.add(m[0]);
  }

  for (const id of suspects) {
    if (imports.has(id) || isDefinedLocally(src, id)) continue;
    issues.push({ file: rel, id });
  }
}

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name)) continue;
      walk(p);
    } else if (/\.(jsx|js|tsx|ts)$/.test(ent.name) && !SKIP_FILES.test(ent.name)) {
      checkFile(p);
    }
  }
}

for (const root of ['app', 'components', 'lib']) walk(path.join(ROOT, root));

const seen = new Set();
const unique = issues.filter((issue) => {
  const key = `${issue.file}::${issue.id}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
}).sort((a, b) => a.file.localeCompare(b.file) || a.id.localeCompare(b.id));

console.log('Runtime reference issues (hooks, src={Var}, asset vars):');
for (const issue of unique) console.log(`  ${issue.file} -> ${issue.id}`);
console.log(`TOTAL: ${unique.length}`);
process.exit(unique.length ? 1 : 0);
