'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import axios from 'axios'
import { useAuth } from '@/lib/useAuth'

const DIRECT_SQL_UPLOAD_LIMIT_BYTES = 8 * 1024 * 1024
const SCHEMA_SCAN_CHUNK_BYTES = 2 * 1024 * 1024
const MAX_SCHEMA_SCAN_BYTES = 48 * 1024 * 1024
const MAX_SCHEMA_UPLOAD_BYTES = 8 * 1024 * 1024

const entityLabels = [
  ['products', 'Products'],
  ['categories', 'Categories'],
  ['customers', 'Customers'],
  ['orders', 'Orders'],
  ['reviews', 'Reviews'],
  ['coupons', 'Coupons'],
  ['users', 'Users'],
  ['pages', 'Pages'],
  ['media', 'Media'],
]

const initialSettings = {
  enabled: false,
  legacyPlatform: 'woocommerce-wordpress',
  importMode: 'schema-preview',
  tablePrefix: 'wp_',
  legacyDatabaseName: '',
  notes: '',
  sourceFilePath: '',
  csvEntityType: 'products',
  entitySelection: {
    products: true,
    categories: true,
    customers: true,
    orders: true,
    reviews: true,
    coupons: true,
    users: false,
    pages: false,
    media: false,
  },
  uploadSummary: null,
  importSummary: null,
  status: 'idle',
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  const digits = value >= 100 || unitIndex === 0 ? 0 : value >= 10 ? 1 : 2
  return `${value.toFixed(digits)} ${units[unitIndex]}`
}

function getTextByteSize(value = '') {
  return new TextEncoder().encode(value).length
}

function dedupeStatements(statements = []) {
  return [...new Set(statements.map((statement) => statement.trim()).filter(Boolean))]
}

function collectSchemaStatements(sourceText = '') {
  const matches = sourceText.match(/(?:CREATE\s+TABLE|ALTER\s+TABLE|CREATE\s+(?:UNIQUE\s+)?INDEX)[\s\S]*?;/gi) || []
  return dedupeStatements(matches)
}

async function buildSchemaPreviewFromLargeFile(file, onProgress) {
  const collectedStatements = []
  const maxScanBytes = Math.min(file.size, MAX_SCHEMA_SCAN_BYTES)
  let carry = ''
  let bytesScanned = 0
  const totalChunks = Math.max(1, Math.ceil(maxScanBytes / SCHEMA_SCAN_CHUNK_BYTES))
  let processedChunks = 0

  for (let offset = 0; offset < maxScanBytes; offset += SCHEMA_SCAN_CHUNK_BYTES) {
    const end = Math.min(offset + SCHEMA_SCAN_CHUNK_BYTES, maxScanBytes)
    const chunkText = await file.slice(offset, end).text()
    const combined = `${carry}${chunkText}`

    collectedStatements.push(...collectSchemaStatements(combined))
    carry = combined.slice(-20000)
    bytesScanned = end
    processedChunks += 1

    onProgress?.({
      phase: 'extracting',
      percent: Math.min(78, Math.round((processedChunks / totalChunks) * 78)),
      detail: `Scanning ${formatBytes(bytesScanned)} of ${formatBytes(maxScanBytes)}`,
    })
  }

  if (file.size > maxScanBytes) {
    const tailStart = Math.max(maxScanBytes, file.size - SCHEMA_SCAN_CHUNK_BYTES)
    if (tailStart < file.size) {
      const tailText = await file.slice(tailStart, file.size).text()
      collectedStatements.push(...collectSchemaStatements(`${carry}${tailText}`))
      bytesScanned += file.size - tailStart
      onProgress?.({
        phase: 'extracting',
        percent: 82,
        detail: `Sampling file tail and finalizing schema preview`,
      })
    }
  }

  let schemaText = dedupeStatements(collectedStatements).join('\n\n')

  if (!schemaText.trim()) {
    const firstChunkText = await file.slice(0, Math.min(file.size, SCHEMA_SCAN_CHUNK_BYTES)).text()
    schemaText = firstChunkText.slice(0, MAX_SCHEMA_UPLOAD_BYTES)
    bytesScanned = Math.max(bytesScanned, Math.min(file.size, SCHEMA_SCAN_CHUNK_BYTES))
  }

  if (schemaText.length > MAX_SCHEMA_UPLOAD_BYTES) {
    schemaText = schemaText.slice(0, MAX_SCHEMA_UPLOAD_BYTES)
  }

  onProgress?.({
    phase: 'extracting',
    percent: 85,
    detail: `Prepared ${formatBytes(getTextByteSize(schemaText))} schema preview for upload`,
  })

  return {
    schemaText,
    bytesScanned: Math.min(bytesScanned, file.size),
  }
}

export default function DatabaseImportSettingsPage() {
  const { user, loading: authLoading, getToken } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [runningImport, setRunningImport] = useState(false)
  const [csvFile, setCsvFile] = useState(null)
  const [importProgress, setImportProgress] = useState({
    active: false,
    phase: 'idle',
    percent: 0,
    title: '',
    detail: '',
  })
  const [message, setMessage] = useState('')
  const [schemaText, setSchemaText] = useState('')
  const [selectedFileName, setSelectedFileName] = useState('')
  const [form, setForm] = useState(initialSettings)

  useEffect(() => {
    const loadSettings = async () => {
      if (authLoading) {
        return
      }

      try {
        const token = await getToken()
        if (!token) {
          setMessage('Sign in with a store account to manage database import settings.')
          return
        }

        const response = await axios.get('/api/store/settings/database-import', {
          headers: { Authorization: `Bearer ${token}` },
        })

        setForm((prev) => ({
          ...prev,
          ...(response.data?.settings || {}),
        }))
      } catch (error) {
        const status = error?.response?.status
        if (status === 401) {
          setMessage('This page requires seller access to a store. Sign in with the store owner account or an approved store team account.')
        } else {
          setMessage(error?.response?.data?.error || 'Failed to load import settings')
        }
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [authLoading, getToken])

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const updateEntitySelection = (key, value) => {
    setForm((prev) => ({
      ...prev,
      entitySelection: {
        ...prev.entitySelection,
        [key]: value,
      },
    }))
  }

  const updateImportProgress = (phase, percent, detail = '') => {
    const titles = {
      preparing: 'Preparing import',
      extracting: 'Extracting schema',
      uploading: 'Uploading preview',
      analyzing: 'Analyzing schema',
      completed: 'Import preview ready',
    }

    setImportProgress({
      active: phase !== 'idle',
      phase,
      percent: Math.max(0, Math.min(100, Math.round(percent))),
      title: titles[phase] || 'Import progress',
      detail,
    })
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setMessage('')

      const token = await getToken()
      if (!token) {
        setMessage('Sign in with a store account to save database import settings.')
        return
      }

      const response = await axios.put('/api/store/settings/database-import', form, {
        headers: { Authorization: `Bearer ${token}` },
      })

      setForm((prev) => ({
        ...prev,
        ...(response.data?.settings || {}),
      }))
      setMessage('Database import settings saved successfully.')
    } catch (error) {
      const status = error?.response?.status
      if (status === 401) {
        setMessage('This page requires seller access to a store. Sign in with the store owner account or an approved store team account.')
      } else {
        setMessage(error?.response?.data?.error || 'Failed to save import settings')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleSchemaUpload = async (file) => {
    if (!file && !schemaText.trim()) {
      setMessage('Select a .sql file or paste schema text to analyze.')
      return
    }

    try {
      setUploading(true)
      setMessage('')
      updateImportProgress('preparing', 5, file ? `Preparing ${file.name}` : 'Preparing pasted schema text')

      const token = await getToken()
      if (!token) {
        setMessage('Sign in with a store account to analyze a legacy SQL schema.')
        return
      }

      const uploadData = new FormData()
      uploadData.append('legacyPlatform', form.legacyPlatform)

      if (file) {
        setSelectedFileName(file.name || '')

        if (file.size <= DIRECT_SQL_UPLOAD_LIMIT_BYTES) {
          uploadData.append('file', file)
          uploadData.append('analysisMode', 'direct-upload')
          updateImportProgress('uploading', 20, `Uploading ${file.name} (${formatBytes(file.size)})`)
        } else {
          updateImportProgress('extracting', 10, `Scanning ${file.name} in your browser`)
          const preview = await buildSchemaPreviewFromLargeFile(file, ({ phase, percent, detail }) => {
            updateImportProgress(phase, percent, detail)
          })

          if (!preview.schemaText.trim()) {
            throw new Error('Could not extract schema preview from the selected SQL file.')
          }

          uploadData.append('schemaText', preview.schemaText)
          uploadData.append('analysisMode', 'browser-schema-extract')
          uploadData.append('originalFileName', file.name || 'legacy-database.sql')
          uploadData.append('originalFileSizeBytes', String(file.size || 0))
          uploadData.append('analyzedBytes', String(preview.bytesScanned || 0))
          updateImportProgress('uploading', 88, `Uploading extracted schema preview for ${file.name}`)
        }
      }

      if (schemaText.trim()) {
        uploadData.append('schemaText', schemaText)
        uploadData.append('analysisMode', file ? 'browser-schema-extract-with-paste' : 'pasted-schema')
        if (!file) {
          updateImportProgress('uploading', 20, `Uploading ${formatBytes(getTextByteSize(schemaText))} of pasted schema text`)
        }
      }

      const response = await axios.post('/api/store/settings/database-import/upload', uploadData, {
        headers: { Authorization: `Bearer ${token}` },
        onUploadProgress: (progressEvent) => {
          const total = Number(progressEvent?.total || 0)
          const loaded = Number(progressEvent?.loaded || 0)

          if (total > 0) {
            const uploadPercent = 20 + Math.round((loaded / total) * 70)
            updateImportProgress('uploading', uploadPercent, `Uploaded ${formatBytes(loaded)} of ${formatBytes(total)}`)
          } else {
            updateImportProgress('uploading', 70, 'Uploading schema preview to the server')
          }
        },
      })

      updateImportProgress('analyzing', 96, 'Server is parsing the schema and updating import settings')

      setForm((prev) => ({
        ...prev,
        ...(response.data?.settings || {}),
        uploadSummary: response.data?.uploadSummary || prev.uploadSummary,
        tablePrefix: response.data?.uploadSummary?.detectedPrefix || prev.tablePrefix,
      }))
      updateImportProgress('completed', 100, 'Schema preview is ready in the import summary')
      setMessage(response.data?.message || 'Schema analyzed successfully.')
    } catch (error) {
      const status = error?.response?.status
      if (status === 401) {
        setMessage('This page requires seller access to a store. Sign in with the store owner account or an approved store team account.')
      } else {
        setMessage(error?.response?.data?.error || error?.message || 'Failed to upload and analyze schema')
      }
      setImportProgress((prev) => ({
        ...prev,
        active: false,
      }))
    } finally {
      setUploading(false)
    }
  }

  const handleStartImport = async () => {
    try {
      setRunningImport(true)
      setMessage('')

      const token = await getToken()
      if (!token) {
        setMessage('Sign in with a store account to start importing data.')
        return
      }

      const payload = new FormData()

      if (form.importMode === 'csv-file') {
        if (!csvFile) {
          setMessage('Choose a CSV or spreadsheet file before starting CSV import.')
          return
        }

        payload.append('file', csvFile)
        updateImportProgress('uploading', 15, `Uploading ${csvFile.name} for CSV import`)
      } else {
        updateImportProgress('preparing', 10, 'Starting legacy SQL import')
      }

      const response = await axios.post('/api/store/settings/database-import/run', payload, {
        headers: { Authorization: `Bearer ${token}` },
        onUploadProgress: (progressEvent) => {
          if (form.importMode !== 'csv-file') {
            return
          }

          const total = Number(progressEvent?.total || 0)
          const loaded = Number(progressEvent?.loaded || 0)

          if (total > 0) {
            const uploadPercent = 15 + Math.round((loaded / total) * 65)
            updateImportProgress('uploading', uploadPercent, `Uploaded ${formatBytes(loaded)} of ${formatBytes(total)}`)
          }
        },
      })

      updateImportProgress('completed', 100, 'Import summary updated successfully')
      setForm((prev) => ({
        ...prev,
        ...(response.data?.settings || {}),
        importSummary: response.data?.importSummary || response.data?.settings?.importSummary || prev.importSummary,
      }))
      setMessage(response.data?.message || 'Import completed successfully.')
    } catch (error) {
      const status = error?.response?.status
      if (status === 401) {
        setMessage('This page requires seller access to a store. Sign in with the store owner account or an approved store team account.')
      } else {
        setMessage(error?.response?.data?.error || 'Failed to start import')
      }
      setImportProgress((prev) => ({
        ...prev,
        active: false,
      }))
    } finally {
      setRunningImport(false)
    }
  }

  const uploadSummary = form.uploadSummary
  const importSummary = form.importSummary

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <div className="flex flex-col gap-4 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 px-6 py-8 text-white shadow-lg lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-300">Store Settings</p>
          <h1 className="mt-3 text-3xl font-bold">Legacy Database Import</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-200">
            Upload a WordPress or WooCommerce SQL dump, preview the schema, and save the migration settings you want to use when moving old store data into this new system.
          </p>
        </div>
        <Link
          href="/store/settings"
          className="inline-flex items-center justify-center rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20"
        >
          Back to Settings
        </Link>
      </div>

      {loading || authLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading import settings...</div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Migration Configuration</h2>
                  <p className="mt-1 text-sm text-slate-500">Define how the legacy database should be interpreted and what data you want to migrate.</p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={form.enabled}
                    onChange={(event) => updateField('enabled', event.target.checked)}
                    className="peer sr-only"
                  />
                  <div className="h-6 w-11 rounded-full bg-slate-300 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-full" />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="block text-sm font-medium text-slate-700">Legacy platform</span>
                  <select
                    value={form.legacyPlatform}
                    onChange={(event) => updateField('legacyPlatform', event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="woocommerce-wordpress">WooCommerce + WordPress</option>
                    <option value="wordpress">WordPress only</option>
                    <option value="custom-sql">Custom SQL export</option>
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="block text-sm font-medium text-slate-700">Import mode</span>
                  <select
                    value={form.importMode}
                    onChange={(event) => updateField('importMode', event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="schema-preview">Schema preview only</option>
                    <option value="full-dump">Full dump preparation</option>
                    <option value="csv-file">CSV or spreadsheet import</option>
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="block text-sm font-medium text-slate-700">Legacy database name</span>
                  <input
                    type="text"
                    value={form.legacyDatabaseName}
                    onChange={(event) => updateField('legacyDatabaseName', event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-emerald-500 focus:outline-none"
                    placeholder="old_store_db"
                  />
                </label>

                <label className="space-y-2">
                  <span className="block text-sm font-medium text-slate-700">Table prefix</span>
                  <input
                    type="text"
                    value={form.tablePrefix}
                    onChange={(event) => updateField('tablePrefix', event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 font-mono focus:border-emerald-500 focus:outline-none"
                    placeholder="wp_"
                  />
                </label>
              </div>

              <label className="space-y-2 block">
                <span className="block text-sm font-medium text-slate-700">Migration notes</span>
                <textarea
                  rows={4}
                  value={form.notes}
                  onChange={(event) => updateField('notes', event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-emerald-500 focus:outline-none"
                  placeholder="Record anything important about the old database, plugin mix, custom tables, or migration order."
                />
              </label>

              {form.importMode === 'full-dump' ? (
                <label className="space-y-2 block">
                  <span className="block text-sm font-medium text-slate-700">Server-local SQL file path</span>
                  <input
                    type="text"
                    value={form.sourceFilePath || ''}
                    onChange={(event) => updateField('sourceFilePath', event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 font-mono text-sm focus:border-emerald-500 focus:outline-none"
                    placeholder="C:\\imports\\store1920.sql"
                  />
                  <p className="text-xs text-slate-500">Use this for very large dumps such as 1 GB SQL files. The file must be readable by the Next.js server process.</p>
                </label>
              ) : null}

              {form.importMode === 'csv-file' ? (
                <label className="space-y-2 block">
                  <span className="block text-sm font-medium text-slate-700">CSV entity type</span>
                  <select
                    value={form.csvEntityType || 'products'}
                    onChange={(event) => updateField('csvEntityType', event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="products">Products</option>
                    <option value="categories">Categories</option>
                    <option value="customers">Customers</option>
                    <option value="coupons">Coupons</option>
                    <option value="orders">Orders</option>
                    <option value="reviews">Reviews</option>
                  </select>
                  <p className="text-xs text-slate-500">CSV import currently supports products, categories, customers, and coupons. Use one file per entity type.</p>
                </label>
              ) : null}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Select Data To Import</h2>
                <p className="mt-1 text-sm text-slate-500">Choose which legacy data domains should be prepared for migration.</p>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {entityLabels.map(([key, label]) => (
                  <label key={key} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                    <span>{label}</span>
                    <input
                      type="checkbox"
                      checked={Boolean(form.entitySelection?.[key])}
                      onChange={(event) => updateEntitySelection(key, event.target.checked)}
                      className="h-4 w-4"
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Import Source</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {form.importMode === 'csv-file'
                    ? 'Upload a CSV or spreadsheet file and then start the import for the selected entity type.'
                    : 'Upload a `.sql` export or paste the schema text to analyze the old database structure.'}
                </p>
              </div>

              {form.importMode === 'csv-file' ? (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-slate-700">CSV or spreadsheet file</label>
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null
                      setCsvFile(file)
                      setSelectedFileName(file?.name || '')
                    }}
                    className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:font-medium file:text-slate-700 hover:file:bg-slate-200"
                  />
                  {selectedFileName ? <p className="text-xs text-slate-500">Selected file: {selectedFileName}</p> : null}
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-slate-700">SQL file</label>
                    <input
                      type="file"
                      accept=".sql,.txt"
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        if (file) {
                          handleSchemaUpload(file)
                        }
                      }}
                      className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:font-medium file:text-slate-700 hover:file:bg-slate-200"
                    />
                    {selectedFileName ? <p className="text-xs text-slate-500">Last selected file: {selectedFileName}</p> : null}
                    <p className="text-xs text-slate-500">
                      Large dumps are analyzed locally in your browser first. Only extracted schema statements are sent to the server for preview.
                    </p>
                  </div>

                  <label className="space-y-2 block">
                    <span className="block text-sm font-medium text-slate-700">Or paste schema text</span>
                    <textarea
                      rows={10}
                      value={schemaText}
                      onChange={(event) => setSchemaText(event.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 font-mono text-xs focus:border-emerald-500 focus:outline-none"
                      placeholder="Paste CREATE TABLE statements or a SQL schema export here."
                    />
                  </label>
                </>
              )}

              {importProgress.active ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-emerald-900">{importProgress.title}</p>
                      <p className="mt-1 text-xs text-emerald-700">{importProgress.detail || 'Working on your import preview...'}</p>
                    </div>
                    <p className="text-sm font-semibold text-emerald-900">{importProgress.percent}%</p>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-emerald-100">
                    <div
                      className="h-full rounded-full bg-emerald-600 transition-[width] duration-300 ease-out"
                      style={{ width: `${importProgress.percent}%` }}
                    />
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                {form.importMode !== 'csv-file' ? (
                  <button
                    type="button"
                    onClick={() => handleSchemaUpload(null)}
                    disabled={uploading}
                    className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {uploading ? 'Analyzing schema...' : 'Analyze SQL Schema'}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Save Import Settings'}
                </button>
                <button
                  type="button"
                  onClick={handleStartImport}
                  disabled={runningImport || uploading || saving}
                  className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {runningImport ? 'Importing...' : form.importMode === 'csv-file' ? 'Start CSV Import' : 'Start Import'}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 sticky top-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Import Summary</h2>
                <p className="mt-1 text-sm text-slate-500">Current migration state and SQL analysis results.</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{form.status || 'idle'}</p>
                </div>
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Platform</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{form.legacyPlatform}</p>
                </div>
              </div>

              {importSummary ? (
                <div className="space-y-4 rounded-xl border border-slate-200 p-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Last import run</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{importSummary.status || 'idle'}</p>
                    {importSummary.message ? <p className="mt-1 text-sm text-slate-600">{importSummary.message}</p> : null}
                    {importSummary.startedAt ? <p className="mt-1 text-xs text-slate-500">Started: {new Date(importSummary.startedAt).toLocaleString()}</p> : null}
                    {importSummary.completedAt ? <p className="mt-1 text-xs text-slate-500">Completed: {new Date(importSummary.completedAt).toLocaleString()}</p> : null}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
                    {Object.entries(importSummary.counts || {}).map(([key, value]) => (
                      <div key={key} className="rounded-xl bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{key}</p>
                        <p className="mt-2 text-xl font-bold text-slate-900">{value}</p>
                      </div>
                    ))}
                  </div>

                  {importSummary.warnings?.length ? (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Warnings</p>
                      <div className="mt-3 space-y-2">
                        {importSummary.warnings.map((warning) => (
                          <div key={warning} className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                            {warning}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {uploadSummary ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Last upload</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{uploadSummary.fileName}</p>
                    <p className="mt-1 text-xs text-slate-500">Original size: {formatBytes(Number(uploadSummary.fileSizeBytes || 0))}</p>
                    {uploadSummary.analyzedBytes ? (
                      <p className="mt-1 text-xs text-slate-500">Analyzed bytes: {formatBytes(Number(uploadSummary.analyzedBytes || 0))}</p>
                    ) : null}
                    {uploadSummary.analysisMode ? (
                      <p className="mt-1 text-xs text-slate-500">Mode: {uploadSummary.analysisMode}</p>
                    ) : null}
                    {uploadSummary.uploadedAt ? (
                      <p className="mt-1 text-xs text-slate-500">{new Date(uploadSummary.uploadedAt).toLocaleString()}</p>
                    ) : null}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tables</p>
                      <p className="mt-2 text-2xl font-bold text-slate-900">{uploadSummary.tableCount}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Indexes</p>
                      <p className="mt-2 text-2xl font-bold text-slate-900">{uploadSummary.createIndexCount}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Foreign keys</p>
                      <p className="mt-2 text-2xl font-bold text-slate-900">{uploadSummary.foreignKeyCount}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Detected prefix</p>
                      <p className="mt-2 text-lg font-bold text-slate-900">{uploadSummary.detectedPrefix || form.tablePrefix}</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recognized modules</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(uploadSummary.recognizedModules || []).map((moduleName) => (
                        <span key={moduleName} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                          {moduleName}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Missing required tables</p>
                    {uploadSummary.missingTables?.length ? (
                      <div className="mt-3 space-y-2">
                        {uploadSummary.missingTables.map((tableName) => (
                          <div key={tableName} className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                            {tableName}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-emerald-700">No required tables are missing for the selected platform.</p>
                    )}
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sample detected tables</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(uploadSummary.sampleTables || []).map((tableName) => (
                        <span key={tableName} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                          {tableName}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
                  No SQL schema has been analyzed yet. Upload a `.sql` file or paste the schema text to generate a preview.
                </div>
              )}

              {message ? (
                <div className={`rounded-lg px-4 py-3 text-sm ${message.toLowerCase().includes('success') || message.toLowerCase().includes('saved') || message.toLowerCase().includes('uploaded') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                  {message}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}