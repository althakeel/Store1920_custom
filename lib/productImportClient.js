import axios from 'axios';
import { parseProductImportFile } from '@/lib/productImportSpreadsheet';
import { isSkippableVariationImportRow } from '@/lib/productImportTypes';

const BATCH_ROW_LIMIT = 15;
const BATCH_DELAY_MS = 900;

const VARIATION_TRANSPORT_KEY = /^(id|type|name|parent|sku|sale price|regular price|images?|stock|meta: _total_stock_quantity|attribute \d+)/i;

function slimVariationRowForTransport(row = {}) {
  const slim = {};
  Object.entries(row).forEach(([key, value]) => {
    if (VARIATION_TRANSPORT_KEY.test(String(key).trim())) {
      slim[key] = value;
    }
  });
  return slim;
}

function slimVariationRowsForTransport(rows = []) {
  return rows.map(slimVariationRowForTransport);
}

export class ImportCancelledError extends Error {
  constructor(partialResult = null) {
    super('Import stopped');
    this.name = 'ImportCancelledError';
    this.partialResult = partialResult;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function interruptibleSleep(ms, shouldCancel) {
  const step = 200;
  let elapsed = 0;
  while (elapsed < ms) {
    if (shouldCancel?.()) {
      throw new ImportCancelledError();
    }
    const wait = Math.min(step, ms - elapsed);
    await sleep(wait);
    elapsed += wait;
  }
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
  aggregate.summary.variantsImported = (aggregate.summary.variantsImported || 0) + (summary.variantsImported || 0);
  aggregate.summary.mirroredImages = (aggregate.summary.mirroredImages || 0) + (summary.mirroredImages || 0);
  aggregate.summary.failedImageMirrors = (aggregate.summary.failedImageMirrors || 0) + (summary.failedImageMirrors || 0);
  aggregate.failures = [...(aggregate.failures || []), ...(next?.failures || [])].slice(0, 100);
  aggregate.message = next?.message || aggregate.message;
  return aggregate;
}

function buildProgressPayload({
  phase,
  batchCurrent = 0,
  batchTotal = 0,
  productsProcessed = 0,
  productTotal = 0,
  summary = null,
  message = '',
}) {
  const percent = productTotal > 0
    ? Math.min(100, Math.round((productsProcessed / productTotal) * 100))
    : 0;

  return {
    phase,
    current: batchCurrent,
    total: batchTotal,
    batchCurrent,
    batchTotal,
    productsProcessed,
    productTotal,
    created: summary?.created || 0,
    updated: summary?.updated || 0,
    failed: summary?.failed || 0,
    skipped: summary?.skipped || 0,
    percent,
    message,
  };
}

async function postImportRows(rows, variationRows, fetchToken, signal) {
  const send = async (token) => {
    const { data } = await axios.post(
      '/api/store/product/bulk-import',
      {
        rows,
        variationRows: slimVariationRowsForTransport(variationRows),
        importMode: 'update',
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 300000,
        signal,
      },
    );
    return data;
  };

  let token = await fetchToken(true);
  try {
    return await send(token);
  } catch (error) {
    const status = error?.response?.status;
    const serverError = String(error?.response?.data?.error || '');
    const tokenExpired = status === 401
      || serverError.toLowerCase().includes('id-token-expired')
      || serverError.toLowerCase().includes('id token has expired');

    if (tokenExpired) {
      token = await fetchToken(true);
      if (token) {
        return await send(token);
      }
    }
    throw error;
  }
}

export async function importProductSpreadsheetFile(file, {
  getToken,
  onProgress,
  shouldCancel,
  registerAbortController,
} = {}) {
  if (typeof getToken !== 'function') {
    throw new Error('getToken is required for product import');
  }

  const fetchToken = async (forceRefresh = false) => {
    const token = await getToken(forceRefresh);
    if (!token) {
      throw new Error('Session expired. Please refresh the page and sign in again.');
    }
    return token;
  };
  const throwIfCancelled = (partial = null) => {
    if (shouldCancel?.()) {
      throw new ImportCancelledError(partial);
    }
  };

  onProgress?.(buildProgressPayload({
    phase: 'parsing',
    message: 'Reading your file...',
  }));

  throwIfCancelled();

  const allRows = await parseProductImportFile(file);
  if (!allRows.length) {
    throw new Error('No product rows found in file');
  }

  const variationRows = allRows.filter((row) => isSkippableVariationImportRow(row));
  const productRows = allRows.filter((row) => !isSkippableVariationImportRow(row));

  const batches = [];
  for (let index = 0; index < productRows.length; index += BATCH_ROW_LIMIT) {
    batches.push(productRows.slice(index, index + BATCH_ROW_LIMIT));
  }

  const productTotal = productRows.length;
  const batchTotal = batches.length;

  onProgress?.(buildProgressPayload({
    phase: 'queued',
    batchCurrent: 0,
    batchTotal,
    productsProcessed: 0,
    productTotal,
    message: `Ready: ${productTotal} product${productTotal === 1 ? '' : 's'} in ${batchTotal} batch${batchTotal === 1 ? '' : 'es'}`,
  }));

  let aggregate = { failures: [] };
  let productsProcessed = 0;

  for (let index = 0; index < batches.length; index += 1) {
    throwIfCancelled(aggregate);

    if (index > 0) {
      onProgress?.(buildProgressPayload({
        phase: 'waiting',
        batchCurrent: index,
        batchTotal,
        productsProcessed,
        productTotal,
        summary: aggregate.summary,
        message: `Pause before batch ${index + 1} of ${batchTotal} (~1 sec)...`,
      }));
      try {
        await interruptibleSleep(BATCH_DELAY_MS, shouldCancel);
      } catch (error) {
        if (error instanceof ImportCancelledError) {
          throw new ImportCancelledError(aggregate);
        }
        throw error;
      }
    }

    throwIfCancelled(aggregate);

    const batchSize = batches[index].length;
    onProgress?.(buildProgressPayload({
      phase: 'importing',
      batchCurrent: index + 1,
      batchTotal,
      productsProcessed,
      productTotal,
      summary: aggregate.summary,
      message: `Importing products ${productsProcessed + 1}–${productsProcessed + batchSize} of ${productTotal}...`,
    }));

    const abortController = new AbortController();
    registerAbortController?.(abortController);

    let result;
    try {
      result = await postImportRows(batches[index], variationRows, fetchToken, abortController.signal);
    } catch (error) {
      if (shouldCancel?.() || axios.isCancel?.(error) || error?.code === 'ERR_CANCELED') {
        throw new ImportCancelledError(aggregate);
      }
      const serverMessage = error?.response?.data?.error;
      if (serverMessage) {
        const wrapped = new Error(serverMessage);
        wrapped.response = error.response;
        throw wrapped;
      }
      throw error;
    }

    aggregate = mergeImportResults(aggregate, result);
    productsProcessed += batchSize;

    onProgress?.(buildProgressPayload({
      phase: 'importing',
      batchCurrent: index + 1,
      batchTotal,
      productsProcessed,
      productTotal,
      summary: aggregate.summary,
      message: `Imported ${productsProcessed} of ${productTotal} products (${aggregate.summary?.created || 0} created, ${aggregate.summary?.updated || 0} updated)`,
    }));
  }

  onProgress?.(buildProgressPayload({
    phase: 'done',
    batchCurrent: batchTotal,
    batchTotal,
    productsProcessed: productTotal,
    productTotal,
    summary: aggregate.summary,
    message: 'Import finished',
  }));

  aggregate.cancelled = false;
  aggregate.message = aggregate.summary?.created || aggregate.summary?.updated
    ? `Bulk import completed: created ${aggregate.summary.created || 0}, updated ${aggregate.summary.updated || 0}`
    : 'Import finished';

  return aggregate;
}
