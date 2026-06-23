import axios from 'axios';
import { parseProductImportFile } from '@/lib/productImportSpreadsheet';

const BATCH_ROW_LIMIT = 40;
const DIRECT_JSON_BYTE_LIMIT = 3.5 * 1024 * 1024;

function mergeImportResults(aggregate, next) {
  const summary = next?.summary || {};
  if (!aggregate.summary) {
    aggregate.summary = { ...summary };
    aggregate.failures = [...(next?.failures || [])];
    aggregate.message = next?.message || '';
    return aggregate;
  }

  aggregate.summary.totalRows = (aggregate.summary.totalRows || 0) + (summary.totalRows || 0);
  aggregate.summary.created = (aggregate.summary.created || 0) + (summary.created || 0);
  aggregate.summary.updated = (aggregate.summary.updated || 0) + (summary.updated || 0);
  aggregate.summary.skipped = (aggregate.summary.skipped || 0) + (summary.skipped || 0);
  aggregate.summary.failed = (aggregate.summary.failed || 0) + (summary.failed || 0);
  aggregate.summary.skippedExisting = (aggregate.summary.skippedExisting || 0) + (summary.skippedExisting || 0);
  aggregate.summary.skippedMissingName = (aggregate.summary.skippedMissingName || 0) + (summary.skippedMissingName || 0);
  aggregate.summary.skippedUnsupportedType = (aggregate.summary.skippedUnsupportedType || 0) + (summary.skippedUnsupportedType || 0);
  aggregate.summary.skippedVariationRows = (aggregate.summary.skippedVariationRows || 0) + (summary.skippedVariationRows || 0);
  aggregate.summary.mirroredImages = (aggregate.summary.mirroredImages || 0) + (summary.mirroredImages || 0);
  aggregate.summary.failedImageMirrors = (aggregate.summary.failedImageMirrors || 0) + (summary.failedImageMirrors || 0);
  aggregate.failures = [...(aggregate.failures || []), ...(next?.failures || [])].slice(0, 100);
  aggregate.message = next?.message || aggregate.message;
  return aggregate;
}

async function postImportRows(rows, token) {
  const { data } = await axios.post(
    '/api/store/product/bulk-import',
    { rows, importMode: 'update' },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    },
  );
  return data;
}

export async function importProductSpreadsheetFile(file, token, { onProgress } = {}) {
  const rows = await parseProductImportFile(file);
  if (!rows.length) {
    throw new Error('No product rows found in file');
  }

  const payload = JSON.stringify({ rows });
  const useBatches = payload.length > DIRECT_JSON_BYTE_LIMIT || rows.length > 250;

  if (!useBatches) {
    onProgress?.({ current: 1, total: 1 });
    return postImportRows(rows, token);
  }

  const batches = [];
  for (let index = 0; index < rows.length; index += BATCH_ROW_LIMIT) {
    batches.push(rows.slice(index, index + BATCH_ROW_LIMIT));
  }

  let aggregate = { failures: [] };
  for (let index = 0; index < batches.length; index += 1) {
    onProgress?.({ current: index + 1, total: batches.length });
    const result = await postImportRows(batches[index], token);
    aggregate = mergeImportResults(aggregate, result);
  }

  aggregate.message = aggregate.summary?.created || aggregate.summary?.updated
    ? `Bulk import completed: created ${aggregate.summary.created || 0}, updated ${aggregate.summary.updated || 0}`
    : 'Import finished';

  return aggregate;
}
