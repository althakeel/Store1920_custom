import { assertGoogleMerchantConfigured } from './config';
import { getGoogleMerchantAccessToken } from './auth';

const MERCHANT_PRODUCTS_BASE = 'https://merchantapi.googleapis.com/products/v1';

function formatMerchantError(data, status) {
  const message = data?.error?.message || data?.message || JSON.stringify(data);
  return `Google Merchant API error (${status}): ${message}`;
}

export async function insertGoogleMerchantProductInput(productInput) {
  const config = assertGoogleMerchantConfigured();
  const token = await getGoogleMerchantAccessToken();
  const parent = `accounts/${config.accountId}`;
  const url = `${MERCHANT_PRODUCTS_BASE}/${parent}/productInputs:insert?dataSource=${encodeURIComponent(config.dataSource)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(productInput),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(formatMerchantError(data, response.status));
  }

  return data;
}

export async function listGoogleMerchantDataSources() {
  const config = assertGoogleMerchantConfigured();
  const token = await getGoogleMerchantAccessToken();
  const url = `https://merchantapi.googleapis.com/datasources/v1/accounts/${config.accountId}/dataSources`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(formatMerchantError(data, response.status));
  }

  return data?.dataSources || [];
}
