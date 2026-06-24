'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/lib/useAuth'
import toast from 'react-hot-toast'
import axios from 'axios'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  CloudUpload,
  Download,
  RotateCcw,
  Upload,
} from 'lucide-react'
import { ImportCancelledError, importProductSpreadsheetFile } from '@/lib/productImportClient'
import ProductImportProgressPanel from '@/components/store/ProductImportProgressPanel'

export default function ProductBulkImportPanel({
  onImportComplete,
  showImageMigration = true,
  embedded = true,
}) {
  const { user, getToken } = useAuth()
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [wasCancelled, setWasCancelled] = useState(false)
  const [result, setResult] = useState(null)
  const [failures, setFailures] = useState([])
  const [importProgress, setImportProgress] = useState(null)
  const [imageMirrorStats, setImageMirrorStats] = useState(null)
  const [backgroundJob, setBackgroundJob] = useState(null)
  const [autoTransferImages, setAutoTransferImages] = useState(true)
  const importControlRef = useRef({ cancelled: false, abortController: null })
  const pollIntervalRef = useRef(null)
  const completedJobNotifiedRef = useRef(null)

  const resetImportSession = () => {
    importControlRef.current = { cancelled: false, abortController: null }
    setStopping(false)
    setWasCancelled(false)
    setImportProgress(null)
    setResult(null)
    setFailures([])
  }

  const fetchImageMirrorStats = async () => {
    if (!showImageMigration) return
    try {
      const token = await getToken()
      if (!token) return
      const { data } = await axios.get('/api/store/product/remirror-images', {
        headers: { Authorization: `Bearer ${token}` },
      })
      setImageMirrorStats(data)
      return data
    } catch (error) {
      console.error('Failed to load image migration stats:', error)
    }
  }

  useEffect(() => {
    if (user) {
      fetchImageMirrorStats()
      refreshBackgroundJob()
    }
  }, [user, showImageMigration])

  const refreshBackgroundJob = async () => {
    if (!showImageMigration) return null
    try {
      const token = await getToken()
      if (!token) return null
      const { data } = await axios.get('/api/store/product/remirror-images/job', {
        headers: { Authorization: `Bearer ${token}` },
      })
      setBackgroundJob(data?.job || null)
      return data
    } catch (error) {
      console.error('Failed to load background image job:', error)
      return null
    }
  }

  const runBackgroundJobTick = async () => {
    const token = await getToken()
    if (!token) return null
    const { data } = await axios.post('/api/store/product/remirror-images/job/tick', {}, {
      headers: { Authorization: `Bearer ${token}` },
    })
    setBackgroundJob(data?.job || null)
    return data
  }

  const startBackgroundImageMigration = async ({ silent = false } = {}) => {
    const pendingCount = Number(imageMirrorStats?.productsPending || 0)
    if (!silent && !pendingCount) {
      toast.success('All product images are already on S3')
      return
    }

    if (!silent) {
      const confirmed = window.confirm(
        `Start background transfer to S3?\n\n${pendingCount.toLocaleString()} product(s) will be copied to your S3 bucket. You can keep working while it runs.`,
      )
      if (!confirmed) return
    }

    try {
      const token = await getToken()
      if (!token) {
        toast.error('Authentication failed. Please sign in again.')
        return
      }

      const { data } = await axios.post('/api/store/product/remirror-images/job', {}, {
        headers: { Authorization: `Bearer ${token}` },
      })

      setBackgroundJob(data?.job || null)

      if (data?.started) {
        if (!silent) {
          toast.success(data?.usesServerWorker
            ? 'Background S3 transfer started on the server'
            : 'Background S3 transfer started')
        }
        if (!data?.usesServerWorker) {
          await runBackgroundJobTick()
        }
      } else if (data?.reason === 'already_running') {
        if (!silent) toast('S3 transfer is already running in the background', { icon: 'ℹ️' })
      } else if (!silent) {
        toast.success('All product images are already on S3')
      }

      await fetchImageMirrorStats()
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Failed to start background image transfer')
    }
  }

  useEffect(() => {
    const isActive = backgroundJob && ['queued', 'running'].includes(backgroundJob.status)
    if (!isActive) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
      return undefined
    }

    const poll = async () => {
      const status = await refreshBackgroundJob()
      if (status?.active && !status?.job?.usesServerWorker) {
        await runBackgroundJobTick()
      }
      if (status?.job && ['completed', 'failed', 'cancelled'].includes(status.job.status)) {
        if (completedJobNotifiedRef.current !== status.job.id) {
          completedJobNotifiedRef.current = status.job.id
          await fetchImageMirrorStats()
          await onImportComplete?.()
          if (status.job.status === 'completed') {
            toast.success(status.job.message || 'Background S3 transfer completed')
          } else if (status.job.status === 'failed') {
            toast.error(status.job.error || status.job.message || 'Background S3 transfer failed')
          }
        }
      }
    }

    poll()
    pollIntervalRef.current = setInterval(poll, 2500)

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
  }, [backgroundJob?.id, backgroundJob?.status])

  const handleFileChange = (selectedFile) => {
    if (!selectedFile) return
    const name = selectedFile.name.toLowerCase()
    const allowed = ['.csv', '.xls', '.xlsx']
    const hasAllowedExtension = allowed.some((ext) => name.endsWith(ext))
    const allowedMime = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'text/plain',
      'application/csv',
    ]
    if (!hasAllowedExtension && !allowedMime.includes(selectedFile.type)) {
      toast.error('Please upload an Excel file (.xlsx, .xls) or CSV file')
      return
    }
    setFile(selectedFile)
    resetImportSession()
  }

  const handleDragOver = (event) => {
    event.preventDefault()
    event.stopPropagation()
  }

  const handleDrop = (event) => {
    event.preventDefault()
    event.stopPropagation()
    const droppedFile = event.dataTransfer.files?.[0]
    if (droppedFile) {
      handleFileChange(droppedFile)
    }
  }

  const handleStopImport = () => {
    setStopping(true)
    importControlRef.current.cancelled = true
    importControlRef.current.abortController?.abort()
    setImportProgress((current) => (current ? { ...current, phase: 'cancelled', message: 'Stopping import...' } : current))
  }

  const handleStartAgain = () => {
    resetImportSession()
    setFile(null)
    const input = document.getElementById('manage-product-import-input')
    if (input) input.value = ''
  }

  const downloadTemplate = () => {
    const link = document.createElement('a')
    link.href = '/sample-product-import.csv'
    link.download = 'sample-product-import.csv'
    document.body.appendChild(link)
    link.click()
    if (link.parentNode) {
      link.remove()
    }
    toast.success('Template downloaded')
  }

  const handleImport = async () => {
    if (!file || !user || loading) return

    importControlRef.current = { cancelled: false, abortController: null }
    setLoading(true)
    setStopping(false)
    setWasCancelled(false)
    setResult(null)
    setFailures([])
    setImportProgress(null)

    try {
      const response = await importProductSpreadsheetFile(file, {
        getToken,
        onProgress: setImportProgress,
        shouldCancel: () => importControlRef.current.cancelled,
        registerAbortController: (controller) => {
          importControlRef.current.abortController = controller
        },
      })

      const summary = response.summary
      setResult(summary)
      setFailures(response.failures || [])

      if (summary?.created > 0 || summary?.updated > 0) {
        toast.success(response?.message || 'Product import completed')
      } else if (summary?.skipped === summary?.totalRows) {
        toast((response?.message || 'Import finished, but all rows were skipped'), { icon: '⚠️' })
      } else {
        toast(response?.message || 'Import finished', { icon: 'ℹ️' })
      }

      await onImportComplete?.()
      const stats = await fetchImageMirrorStats()
      if (autoTransferImages && Number(stats?.productsPending || imageMirrorStats?.productsPending) > 0) {
        await startBackgroundImageMigration({ silent: true })
      }
    } catch (error) {
      if (error instanceof ImportCancelledError) {
        const partial = error.partialResult
        setWasCancelled(true)
        if (partial?.summary) {
          setResult(partial.summary)
          setFailures(partial.failures || [])
        }
        setImportProgress((current) => ({
          ...(current || {}),
          phase: 'cancelled',
          message: partial?.summary
            ? `Stopped after ${partial.summary.created || 0} created, ${partial.summary.updated || 0} updated`
            : 'Import stopped before any products were saved',
        }))
        toast('Import stopped', { icon: '⏹️' })
        if (partial?.summary) {
          await onImportComplete?.()
          await fetchImageMirrorStats()
        }
      } else {
        toast.error(error.response?.data?.error || error.message || 'Import failed')
      }
    } finally {
      setLoading(false)
      setStopping(false)
      importControlRef.current.abortController = null
    }
  }

  const cancelBackgroundImageMigration = async () => {
    try {
      const token = await getToken()
      if (!token) return
      await axios.delete('/api/store/product/remirror-images/job', {
        headers: { Authorization: `Bearer ${token}` },
      })
      setBackgroundJob(null)
      toast('Background S3 transfer cancelled', { icon: '⏹️' })
      await fetchImageMirrorStats()
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Failed to cancel background transfer')
    }
  }

  if (!user) return null

  const isJobActive = backgroundJob && ['queued', 'running'].includes(backgroundJob.status)

  const showProgress = loading || (importProgress && importProgress.phase === 'cancelled')
  const wrapperClass = embedded
    ? 'mb-6 rounded-lg border border-slate-200 bg-white p-5'
    : 'bg-white rounded-lg shadow-md p-8 mb-8'

  return (
    <div className={embedded ? '' : 'min-h-screen bg-slate-50 p-8'}>
      <div className={embedded ? '' : 'max-w-4xl mx-auto'}>
        {!embedded ? (
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Bulk Import Products</h1>
            <p className="text-slate-600">Import WooCommerce Excel/CSV exports directly into Store1920.</p>
          </div>
        ) : (
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Import products here</h2>
            <p className="mt-1 text-sm text-slate-600">
              Upload your WooCommerce export (Excel or CSV) from this page. Images are copied to S3 during import when possible.
            </p>
          </div>
        )}

        <div className={wrapperClass}>
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            <div className="flex gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div className="space-y-1">
                <p><strong>WooCommerce:</strong> Export from WordPress → Store1920 Product Export, then upload here.</p>
                <p><strong>Updates:</strong> Existing products are matched by WooCommerce ID and updated.</p>
              </div>
            </div>
          </div>

          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="rounded-lg border-2 border-dashed border-slate-300 p-8 text-center transition hover:border-blue-400"
          >
            <Upload className="mx-auto mb-3 h-10 w-10 text-slate-400" />
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(event) => handleFileChange(event.target.files?.[0] || null)}
              className="hidden"
              id="manage-product-import-input"
              disabled={loading}
            />
            <label htmlFor="manage-product-import-input" className={`cursor-pointer ${loading ? 'pointer-events-none opacity-60' : ''}`}>
              <p className="text-base font-medium text-slate-900">
                {file ? file.name : 'Click to upload or drag and drop'}
              </p>
              <p className="mt-1 text-sm text-slate-500">Excel (.xlsx, .xls) or CSV (.csv)</p>
            </label>
          </div>

          {showProgress ? (
            <div className="mt-4">
              <ProductImportProgressPanel
                progress={importProgress}
                onStop={loading ? handleStopImport : null}
                stopping={stopping}
                onDismiss={() => setImportProgress(null)}
              />
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-600">
              Large files import in batches with a live progress bar. Use <strong>Stop import</strong> to cancel anytime.
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleImport}
              disabled={!file || loading}
              className="inline-flex min-w-[180px] flex-1 items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CloudUpload className="h-4 w-4" />
              {loading ? 'Importing...' : 'Start Import'}
            </button>
            {(wasCancelled || (result && !loading)) ? (
              <button
                type="button"
                onClick={handleStartAgain}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                <RotateCcw className="h-4 w-4" />
                Start again
              </button>
            ) : null}
            <button
              type="button"
              onClick={downloadTemplate}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              Download template
            </button>
            {showImageMigration ? (
              <>
                <button
                  type="button"
                  onClick={() => startBackgroundImageMigration()}
                  disabled={isJobActive || !imageMirrorStats?.productsPending}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isJobActive ? 'Transferring to S3...' : 'Transfer images to S3'}
                </button>
                {isJobActive ? (
                  <button
                    type="button"
                    onClick={cancelBackgroundImageMigration}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-300 bg-white px-5 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50"
                  >
                    Cancel transfer
                  </button>
                ) : null}
              </>
            ) : null}
          </div>

          {showImageMigration ? (
            <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={autoTransferImages}
                onChange={(event) => setAutoTransferImages(event.target.checked)}
                disabled={loading || isJobActive}
                className="h-4 w-4 rounded border-slate-300"
              />
              Automatically transfer external images to S3 after import
            </label>
          ) : null}

          {showImageMigration && imageMirrorStats?.productsPending > 0 ? (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <strong>{imageMirrorStats.productsPending.toLocaleString()}</strong> product(s) still load images from WordPress/Kinsta.
              {imageMirrorStats.externalImages
                ? ` (${imageMirrorStats.externalImages.toLocaleString()} external image URL(s))`
                : ''}
              {' '}Use <strong>Transfer images to S3</strong> or enable auto-transfer after import.
            </div>
          ) : null}

          {isJobActive && backgroundJob ? (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                <span>{backgroundJob.message || 'Copying product images to S3 in the background...'}</span>
                <span>{backgroundJob.percent || 0}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-amber-500 transition-all duration-300"
                  style={{ width: `${backgroundJob.percent || 0}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {(backgroundJob.processedProducts || 0).toLocaleString()} / {(backgroundJob.totalProducts || 0).toLocaleString()} products
                {backgroundJob.usesServerWorker ? ' · runs on server (no browser needed)' : ' · keep this tab open to continue'}
              </p>
            </div>
          ) : null}
        </div>

        {result ? (
          <div className={`${wrapperClass} mt-4`}>
            <h3 className="mb-4 text-lg font-bold text-slate-900">
              {wasCancelled ? 'Partial import results' : 'Import results'}
            </h3>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-600">Total rows</p>
                <p className="text-xl font-bold text-slate-900">{result.totalRows}</p>
              </div>
              <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                <p className="flex items-center gap-1 text-xs text-green-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Created
                </p>
                <p className="text-xl font-bold text-green-600">{result.created}</p>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                <p className="text-xs text-blue-700">Updated</p>
                <p className="text-xl font-bold text-blue-600">{result.updated || 0}</p>
              </div>
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                <p className="text-xs text-yellow-700">Skipped</p>
                <p className="text-xl font-bold text-yellow-600">{result.skipped}</p>
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="flex items-center gap-1 text-xs text-red-700">
                  <AlertTriangle className="h-3.5 w-3.5" /> Failed
                </p>
                <p className="text-xl font-bold text-red-600">{result.failed}</p>
              </div>
            </div>

            {failures.length > 0 ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-100">
                      <th className="px-3 py-2 text-left">Row</th>
                      <th className="px-3 py-2 text-left">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {failures.slice(0, 20).map((failure, index) => (
                      <tr key={`${failure.row}-${index}`} className="border-b">
                        <td className="px-3 py-2 font-medium">{failure.row}</td>
                        <td className="px-3 py-2 text-red-600">{failure.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
