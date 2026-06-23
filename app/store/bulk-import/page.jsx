'use client';
import { useRef, useState } from 'react';
import { useAuth } from '@/lib/useAuth';
import toast from 'react-hot-toast';
import { ImportCancelledError, importProductSpreadsheetFile } from '@/lib/productImportClient';
import ProductImportProgressPanel from '@/components/store/ProductImportProgressPanel';
import { Upload, Download, AlertCircle, CheckCircle2, AlertTriangle, RotateCcw } from 'lucide-react';

export default function BulkImportPage() {
  const { user, getToken } = useAuth();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [wasCancelled, setWasCancelled] = useState(false);
  const [result, setResult] = useState(null);
  const [failures, setFailures] = useState([]);
  const [importProgress, setImportProgress] = useState(null);
  const importControlRef = useRef({ cancelled: false, abortController: null });

  const resetImportSession = () => {
    importControlRef.current = { cancelled: false, abortController: null };
    setStopping(false);
    setWasCancelled(false);
    setImportProgress(null);
    setResult(null);
    setFailures([]);
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const name = selectedFile.name.toLowerCase();
      const allowed = ['.csv', '.xls', '.xlsx'];
      const hasAllowedExtension = allowed.some((ext) => name.endsWith(ext));
      const allowedMime = [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv',
        'text/plain',
        'application/csv',
      ];
      if (!hasAllowedExtension && !allowedMime.includes(selectedFile.type)) {
        toast.error('Please upload an Excel file (.xlsx, .xls) or CSV file');
        return;
      }
      setFile(selectedFile);
      resetImportSession();
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      handleFileChange({ target: { files: [droppedFile] } });
    }
  };

  const handleStopImport = () => {
    setStopping(true);
    importControlRef.current.cancelled = true;
    importControlRef.current.abortController?.abort();
    setImportProgress((current) => (current ? { ...current, phase: 'cancelled', message: 'Stopping import...' } : current));
  };

  const handleStartAgain = () => {
    resetImportSession();
    setFile(null);
    const input = document.getElementById('fileInput');
    if (input) input.value = '';
  };

  const handleImport = async () => {
    if (!file || !user || loading) return;

    importControlRef.current = { cancelled: false, abortController: null };
    setLoading(true);
    setStopping(false);
    setWasCancelled(false);
    setResult(null);
    setFailures([]);
    setImportProgress(null);

    try {
      const response = await importProductSpreadsheetFile(file, {
        getToken,
        onProgress: setImportProgress,
        shouldCancel: () => importControlRef.current.cancelled,
        registerAbortController: (controller) => {
          importControlRef.current.abortController = controller;
        },
      });

      const summary = response.summary;
      setResult(summary);
      setFailures(response.failures || []);

      if (summary?.created > 0 || summary?.updated > 0) {
        toast.success(response?.message || 'Bulk import completed');
      } else if (summary?.skipped === summary?.totalRows) {
        toast((response?.message || 'Import finished, but all rows were skipped'), {
          icon: '⚠️',
        });
      } else {
        toast(response?.message || 'Import finished', {
          icon: 'ℹ️',
        });
      }
    } catch (error) {
      if (error instanceof ImportCancelledError) {
        const partial = error.partialResult;
        setWasCancelled(true);
        if (partial?.summary) {
          setResult(partial.summary);
          setFailures(partial.failures || []);
        }
        setImportProgress((current) => ({
          ...(current || {}),
          phase: 'cancelled',
          message: partial?.summary
            ? `Stopped after ${partial.summary.created || 0} created, ${partial.summary.updated || 0} updated`
            : 'Import stopped before any products were saved',
        }));
        toast('Import stopped', { icon: '⏹️' });
      } else {
        const message = error.response?.data?.error || error.message || 'Import failed';
        toast.error(message);
        console.error('Import error:', error);
      }
    } finally {
      setLoading(false);
      setStopping(false);
      importControlRef.current.abortController = null;
    }
  };

  const downloadTemplate = () => {
    const link = document.createElement('a');
    link.href = '/sample-product-import.csv';
    link.download = 'sample-product-import.csv';
    document.body.appendChild(link);
    link.click();
    if (link.parentNode) {
      link.remove();
    }
    toast.success('Template downloaded');
  };

  if (!user) {
    return <div className="p-8 text-center text-slate-600">Please log in to access bulk import.</div>;
  }

  const showProgress = loading || (importProgress && importProgress.phase === 'cancelled');

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Bulk Import Products</h1>
          <p className="text-slate-600">Import multiple products at once using Excel or CSV format. Supports plain text and HTML-formatted descriptions.</p>
          <p className="mt-2 text-sm font-medium text-amber-700">
            Use the same Import Products button below for both new products and updates. Update mode is now the default for WordPress migration imports.
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8 flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900 space-y-2">
            <p><strong>HTML Support:</strong> Your product descriptions can include HTML formatting (paragraphs, lists, bold, italics, links, etc.). Plain text descriptions are also supported.</p>
            <p><strong>Variants (WooCommerce):</strong> Use <b>Type</b> = <code>variable</code> on the parent row, then add one row per variant with <b>Type</b> = <code>variation</code> and <b>Parent</b> = <code>id:PARENT_ID</code>.</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-8 mb-8">
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="border-2 border-dashed border-slate-300 rounded-lg p-12 text-center cursor-pointer hover:border-blue-400 transition"
          >
            <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
              id="fileInput"
              disabled={loading}
            />
            <label htmlFor="fileInput" className={`cursor-pointer ${loading ? 'pointer-events-none opacity-60' : ''}`}>
              <p className="text-lg font-medium text-slate-900 mb-1">
                {file ? file.name : 'Click to upload or drag and drop'}
              </p>
              <p className="text-sm text-slate-500">Excel (.xlsx), Excel (.xls), or CSV (.csv)</p>
            </label>
          </div>

          {showProgress ? (
            <div className="mt-6">
              <ProductImportProgressPanel
                progress={importProgress}
                onStop={loading ? handleStopImport : null}
                stopping={stopping}
                onDismiss={() => setImportProgress(null)}
              />
            </div>
          ) : (
            <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Large files import in batches of 15 products (~1 second pause between batches). You will see a live progress bar with created/updated counts. Use <strong>Stop import</strong> to cancel anytime.
            </div>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleImport}
              disabled={!file || loading}
              className="flex-1 min-w-[200px] bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-medium py-3 px-6 rounded-lg transition"
            >
              {loading ? 'Import running...' : 'Start Queued Import'}
            </button>
            {(wasCancelled || (result && !loading)) ? (
              <button
                type="button"
                onClick={handleStartAgain}
                className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 px-6 rounded-lg transition"
              >
                <RotateCcw className="w-4 h-4" />
                Start again
              </button>
            ) : null}
            <button
              type="button"
              onClick={downloadTemplate}
              disabled={loading}
              className="inline-flex items-center gap-2 bg-slate-200 hover:bg-slate-300 disabled:opacity-60 text-slate-900 font-medium py-3 px-6 rounded-lg transition"
            >
              <Download className="w-4 h-4" />
              Download Template
            </button>
          </div>
        </div>

        <div className="bg-slate-100 rounded-lg p-6 mb-8">
          <h3 className="font-semibold text-slate-900 mb-4">Column Requirements</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Required Columns:</p>
              <ul className="text-sm text-slate-600 space-y-1">
                <li><b>Name</b> - Product name</li>
                <li><b>Sale price</b> - Selling price</li>
                <li><b>Categories</b> - Product category names</li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Optional Columns:</p>
              <ul className="text-sm text-slate-600 space-y-1">
                <li><b>Short description</b> - One-line summary</li>
                <li><b>Description</b> - Full description (HTML supported)</li>
                <li><b>Regular price</b>, <b>Images</b>, <b>Brands</b>, <b>SKU</b>, <b>Stock</b></li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Variant columns (WooCommerce):</p>
              <ul className="text-sm text-slate-600 space-y-1">
                <li><b>Type</b> - <code>variable</code> or <code>variation</code></li>
                <li><b>Parent</b> - <code>id:2001</code> on variant rows</li>
                <li><b>Attribute 1 name</b> / <b>Attribute 1 value(s)</b></li>
              </ul>
            </div>
          </div>
        </div>

        {result && (
          <div className="bg-white rounded-lg shadow-md p-8 mb-8">
            <h3 className="text-xl font-bold text-slate-900 mb-2">
              {wasCancelled ? 'Partial import results (stopped)' : 'Import Results'}
            </h3>
            {wasCancelled ? (
              <p className="mb-6 text-sm text-amber-700">Import was stopped before all products were processed. Products already imported are saved.</p>
            ) : null}

            <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              Variants imported: <span className="font-semibold">{result.variantsImported || 0}</span>.
              Created: <span className="font-semibold">{result.created || 0}</span>.
              Updated: <span className="font-semibold">{result.updated || 0}</span>.
            </div>

            <div className="grid grid-cols-1 gap-4 mb-8 md:grid-cols-5">
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-slate-600 text-sm">Total Rows</p>
                <p className="text-2xl font-bold text-slate-900">{result.totalRows}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <p className="text-green-700 text-sm flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Created
                </p>
                <p className="text-2xl font-bold text-green-600">{result.created}</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <p className="text-blue-700 text-sm">Updated</p>
                <p className="text-2xl font-bold text-blue-600">{result.updated || 0}</p>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                <p className="text-yellow-700 text-sm">Skipped</p>
                <p className="text-2xl font-bold text-yellow-600">{result.skipped}</p>
              </div>
              <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                <p className="text-red-700 text-sm flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" /> Failed
                </p>
                <p className="text-2xl font-bold text-red-600">{result.failed}</p>
              </div>
            </div>

            {failures.length > 0 && (
              <div className="mt-8">
                <h4 className="font-semibold text-slate-900 mb-4">Failed Rows (First 100)</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-100 border-b">
                        <th className="px-4 py-2 text-left">Row</th>
                        <th className="px-4 py-2 text-left">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {failures.map((failure, idx) => (
                        <tr key={idx} className="border-b hover:bg-slate-50">
                          <td className="px-4 py-2 text-slate-900 font-medium">{failure.row}</td>
                          <td className="px-4 py-2 text-red-600">{failure.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
