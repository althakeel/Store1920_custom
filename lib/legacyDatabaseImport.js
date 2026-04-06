const DEFAULT_ENTITY_SELECTION = {
  products: true,
  categories: true,
  customers: true,
  orders: true,
  reviews: true,
  coupons: true,
  users: false,
  pages: false,
  media: false,
}

const CORE_TABLE_SUFFIXES = [
  'posts',
  'postmeta',
  'terms',
  'term_taxonomy',
  'term_relationships',
  'users',
  'usermeta',
  'comments',
  'commentmeta',
  'options',
]

export const DEFAULT_IMPORT_SETTINGS = {
  enabled: false,
  legacyPlatform: 'woocommerce-wordpress',
  importMode: 'schema-preview',
  tablePrefix: 'wp_',
  legacyDatabaseName: '',
  notes: '',
  sourceFilePath: '',
  csvEntityType: 'products',
  entitySelection: DEFAULT_ENTITY_SELECTION,
  uploadSummary: null,
  sourceSqlText: '',
  sourceHasInsertStatements: false,
  sourceCapturedAt: null,
  importSummary: null,
  status: 'idle',
}

export function normalizeImportSummary(importSummary = null) {
  if (!importSummary || typeof importSummary !== 'object') {
    return null
  }

  const counts = importSummary.counts || {}

  return {
    status: (importSummary.status || 'idle').toString().trim(),
    message: (importSummary.message || '').toString().trim(),
    startedAt: importSummary.startedAt || null,
    completedAt: importSummary.completedAt || null,
    counts: {
      categories: Number(counts.categories || 0),
      products: Number(counts.products || 0),
      customers: Number(counts.customers || 0),
      orders: Number(counts.orders || 0),
      reviews: Number(counts.reviews || 0),
      coupons: Number(counts.coupons || 0),
      users: Number(counts.users || 0),
      pages: Number(counts.pages || 0),
      media: Number(counts.media || 0),
      skipped: Number(counts.skipped || 0),
    },
    warnings: Array.isArray(importSummary.warnings) ? importSummary.warnings.map((warning) => warning.toString().trim()).filter(Boolean) : [],
  }
}

export function normalizeEntitySelection(entitySelection = {}) {
  return {
    ...DEFAULT_ENTITY_SELECTION,
    ...Object.fromEntries(
      Object.entries(entitySelection || {}).map(([key, value]) => [key, Boolean(value)])
    ),
  }
}

export function normalizeImportSettings(data = {}) {
  return {
    enabled: Boolean(data.enabled),
    legacyPlatform: (data.legacyPlatform || DEFAULT_IMPORT_SETTINGS.legacyPlatform).toString().trim(),
    importMode: (data.importMode || DEFAULT_IMPORT_SETTINGS.importMode).toString().trim(),
    tablePrefix: (data.tablePrefix || DEFAULT_IMPORT_SETTINGS.tablePrefix).toString().trim(),
    legacyDatabaseName: (data.legacyDatabaseName || '').toString().trim(),
    notes: (data.notes || '').toString().trim(),
    sourceFilePath: (data.sourceFilePath || '').toString().trim(),
    csvEntityType: (data.csvEntityType || DEFAULT_IMPORT_SETTINGS.csvEntityType).toString().trim(),
    entitySelection: normalizeEntitySelection(data.entitySelection),
    uploadSummary: data.uploadSummary || null,
    sourceHasInsertStatements: Boolean(data.sourceHasInsertStatements),
    sourceCapturedAt: data.sourceCapturedAt || null,
    importSummary: normalizeImportSummary(data.importSummary),
    status: (data.status || DEFAULT_IMPORT_SETTINGS.status).toString().trim(),
  }
}

function unique(values) {
  return [...new Set(values)]
}

function inferTablePrefix(tableNames = []) {
  for (const tableName of tableNames) {
    for (const suffix of CORE_TABLE_SUFFIXES) {
      if (tableName.endsWith(suffix) && tableName.length > suffix.length) {
        return tableName.slice(0, tableName.length - suffix.length)
      }
    }
  }

  return 'wp_'
}

function detectModules(tableNames = [], prefix = 'wp_') {
  const modules = []

  if (tableNames.some((name) => name.startsWith(`${prefix}woocommerce_`) || name.startsWith(`${prefix}wc_`))) {
    modules.push('WooCommerce')
  }

  if (tableNames.some((name) => name.startsWith(`${prefix}dokan_`))) {
    modules.push('Dokan')
  }

  if (tableNames.some((name) => name.startsWith(`${prefix}wpforms_`) || name.startsWith(`${prefix}frmt_`) || name.startsWith(`${prefix}fluentform_`))) {
    modules.push('Forms')
  }

  if (tableNames.some((name) => name.startsWith(`${prefix}shopmagic_`))) {
    modules.push('ShopMagic')
  }

  if (tableNames.some((name) => name.startsWith(`${prefix}awp_`) || name.startsWith(`${prefix}wawp_`))) {
    modules.push('Messaging')
  }

  if (tableNames.some((name) => name.startsWith(`${prefix}ads_`) || name.startsWith(`${prefix}adsw_`))) {
    modules.push('AliExpress Importer')
  }

  if (tableNames.some((name) => !name.startsWith(prefix))) {
    modules.push('Custom Tables')
  }

  return modules.length ? modules : ['WordPress Core']
}

function getRequiredTables(prefix, platform) {
  const base = [
    `${prefix}posts`,
    `${prefix}postmeta`,
    `${prefix}terms`,
    `${prefix}term_taxonomy`,
    `${prefix}term_relationships`,
    `${prefix}users`,
    `${prefix}usermeta`,
    `${prefix}comments`,
    `${prefix}commentmeta`,
  ]

  if (platform === 'wordpress') {
    return base
  }

  return [
    ...base,
    `${prefix}woocommerce_order_items`,
    `${prefix}woocommerce_order_itemmeta`,
  ]
}

export function parseLegacySqlSchema(sqlText, platform = 'woocommerce-wordpress') {
  const createTableMatches = [...sqlText.matchAll(/CREATE\s+TABLE\s+`?([a-zA-Z0-9_]+)`?/gi)]
  const tableNames = unique(createTableMatches.map((match) => match[1]))
  const detectedPrefix = inferTablePrefix(tableNames)
  const requiredTables = getRequiredTables(detectedPrefix, platform)
  const missingTables = requiredTables.filter((tableName) => !tableNames.includes(tableName))
  const createIndexCount = [...sqlText.matchAll(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+/gi)].length
  const foreignKeyCount = [...sqlText.matchAll(/FOREIGN\s+KEY\s*\(/gi)].length

  return {
    detectedPrefix,
    tableCount: tableNames.length,
    createTableCount: createTableMatches.length,
    createIndexCount,
    foreignKeyCount,
    tables: tableNames,
    sampleTables: tableNames.slice(0, 20),
    requiredTables,
    missingTables,
    recognizedModules: detectModules(tableNames, detectedPrefix),
    schemaExcerpt: sqlText.slice(0, 2000),
  }
}