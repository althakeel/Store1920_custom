import axios from 'axios';
import { parseProductImportFile } from '@/lib/productImportSpreadsheet';

const BATCH_ROW_LIMIT = 15;
const BATCH_DELAY_MS = 900;

function parseRowType(value) {
  return String(value || 'simple').trim().toLowerCase();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

async function postImportRows(rows, variationRows, token) {
  const { data } = await axios.post(
    '/api/store/product/bulk-import',
    { rows, variationRows, importMode: 'update' },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 300000,
    },
  );
  return data;
}

export async function importProductSpreadsheetFile(file, token, { onProgress } = {}) {
  onProgress?.({ phase: 'parsing', current: 0, total: 0, message: 'Reading your file...' });

  const allRows = await parseProductImportFile(file);
  if (!allRows.length) {
    throw new Error('No product rows found in file');
  }

  const variationRows = allRows.filter((row) => parseRowType(row.Type || row.type) === 'variation');
  const productRows = allRows.filter((row) => parseRowType(row.Type || row.type) !== 'variation');

  const batches = [];
  for (let index = 0; index < productRows.length; index += BATCH_ROW_LIMIT) {
    batches.push(productRows.slice(index, index + BATCH_ROW_LIMIT));
  }

  onProgress?.({
    phase: 'queued',
    current: 0,
    total: batches.length,
    message: `Queued ${batches.length} batch${batches.length === 1 ? '' : 'es'} (${productRows.length} products)`,
  });

  let aggregate = { failures: [] };

  for (let index = 0; index < batches.length; index += 1) {
    if (index > 0) {
      onProgress?.({
        phase: 'waiting',
        current: index,
        total: batches.length,
        message: `Waiting before batch ${index + 1}...`,
      });
      await sleep(BATCH_DELAY_MS);
    }

    onProgress?.({
      phase: 'importing',
      current: index + 1,
      total: batches.length,
      message: `Importing batch ${index + 1} of ${batches.length}...`,
    });

    const result = await postImportRows(batches[index], variationRows, token);
    aggregate = mergeImportResults(aggregate, result);
  }

  onProgress?.({
    phase: 'done',
    current: batches.length,
    total: batches.length,
    message: 'Import queue finished',
  });

  aggregate.message = aggregate.summary?.created || aggregate.summary?.updated
    ? `Bulk import completed: created ${aggregate.summary.created || 0}, updated ${aggregate.summary.updated || 0}`
    : 'Import finished';

  return aggregate;
}
