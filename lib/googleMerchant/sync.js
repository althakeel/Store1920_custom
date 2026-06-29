import { getGoogleMerchantConfig } from './config';
import { insertGoogleMerchantProductInput } from './client';
import { mapProductToMerchantInput } from './mapProduct';
import { fetchGoogleMerchantCatalogProducts } from './products';
import { getCustomerSiteUrl } from '@/lib/appUrl';

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function syncProductsToGoogleMerchant({
  storeId = '',
  limit = 200,
  inStockOnly = true,
  dryRun = false,
} = {}) {
  const config = getGoogleMerchantConfig();
  const products = await fetchGoogleMerchantCatalogProducts({ storeId, limit, inStockOnly });
  const baseUrl = getCustomerSiteUrl();

  const summary = {
    scanned: products.length,
    inserted: 0,
    skipped: 0,
    failed: 0,
    dryRun,
    feedLabels: config.feedLabels,
    failures: [],
  };

  for (const product of products) {
    for (const feedLabel of config.feedLabels) {
      const mapped = mapProductToMerchantInput(product, {
        contentLanguage: config.contentLanguage,
        feedLabel,
        defaultCategory: config.defaultCategory,
        baseUrl,
      });

      if (mapped.skipped) {
        summary.skipped += 1;
        continue;
      }

      if (dryRun) {
        summary.inserted += 1;
        continue;
      }

      try {
        await insertGoogleMerchantProductInput(mapped.productInput);
        summary.inserted += 1;
        await wait(120);
      } catch (error) {
        summary.failed += 1;
        if (summary.failures.length < 25) {
          summary.failures.push({
            offerId: mapped.offerId,
            feedLabel,
            error: error?.message || 'Insert failed',
          });
        }
      }
    }
  }

  return summary;
}
