import mongoose from 'mongoose'

const EntitySelectionSchema = new mongoose.Schema(
  {
    products: { type: Boolean, default: true },
    categories: { type: Boolean, default: true },
    customers: { type: Boolean, default: true },
    orders: { type: Boolean, default: true },
    reviews: { type: Boolean, default: true },
    coupons: { type: Boolean, default: true },
    users: { type: Boolean, default: false },
    pages: { type: Boolean, default: false },
    media: { type: Boolean, default: false },
  },
  { _id: false }
)

const UploadSummarySchema = new mongoose.Schema(
  {
    fileName: { type: String, trim: true, default: '' },
    fileSizeBytes: { type: Number, default: 0 },
    uploadedAt: { type: Date, default: null },
    detectedPrefix: { type: String, trim: true, default: 'wp_' },
    tableCount: { type: Number, default: 0 },
    createTableCount: { type: Number, default: 0 },
    createIndexCount: { type: Number, default: 0 },
    foreignKeyCount: { type: Number, default: 0 },
    tables: { type: [String], default: [] },
    sampleTables: { type: [String], default: [] },
    requiredTables: { type: [String], default: [] },
    missingTables: { type: [String], default: [] },
    recognizedModules: { type: [String], default: [] },
    schemaExcerpt: { type: String, default: '' },
  },
  { _id: false }
)

const ImportCountsSchema = new mongoose.Schema(
  {
    categories: { type: Number, default: 0 },
    products: { type: Number, default: 0 },
    customers: { type: Number, default: 0 },
    orders: { type: Number, default: 0 },
    reviews: { type: Number, default: 0 },
    coupons: { type: Number, default: 0 },
    users: { type: Number, default: 0 },
    pages: { type: Number, default: 0 },
    media: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
  },
  { _id: false }
)

const ImportSummarySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['idle', 'running', 'completed', 'failed'],
      default: 'idle',
    },
    message: { type: String, trim: true, default: '' },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    counts: { type: ImportCountsSchema, default: () => ({}) },
    warnings: { type: [String], default: [] },
  },
  { _id: false }
)

const StoreDatabaseImportSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true, unique: true },
    enabled: { type: Boolean, default: false },
    legacyPlatform: {
      type: String,
      enum: ['woocommerce-wordpress', 'wordpress', 'custom-sql'],
      default: 'woocommerce-wordpress',
    },
    importMode: {
      type: String,
      enum: ['schema-preview', 'full-dump', 'csv-file'],
      default: 'schema-preview',
    },
    tablePrefix: { type: String, trim: true, default: 'wp_' },
    legacyDatabaseName: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
    sourceFilePath: { type: String, trim: true, default: '' },
    csvEntityType: {
      type: String,
      enum: ['products', 'categories', 'customers', 'orders', 'reviews', 'coupons', 'users', 'pages', 'media'],
      default: 'products',
    },
    entitySelection: { type: EntitySelectionSchema, default: () => ({}) },
    uploadSummary: { type: UploadSummarySchema, default: null },
    sourceSqlText: { type: String, default: '' },
    sourceHasInsertStatements: { type: Boolean, default: false },
    sourceCapturedAt: { type: Date, default: null },
    importSummary: { type: ImportSummarySchema, default: null },
    status: {
      type: String,
      enum: ['idle', 'configured', 'uploaded', 'running', 'completed', 'failed'],
      default: 'idle',
    },
    lastValidatedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

if (process.env.NODE_ENV === 'development' && mongoose.models.StoreDatabaseImport) {
  delete mongoose.models.StoreDatabaseImport
}

export default mongoose.models.StoreDatabaseImport || mongoose.model('StoreDatabaseImport', StoreDatabaseImportSchema)