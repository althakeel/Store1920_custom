import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useAuth } from '@/lib/useAuth';
import { readPageCache, writePageCache } from '@/lib/storePageCache';

async function withTokenRetry(getToken, requestFn) {
  try {
    return await requestFn(false);
  } catch (error) {
    if (error?.response?.status === 401) {
      return requestFn(true);
    }
    throw error;
  }
}

/**
 * Cached store API fetch with stale-while-revalidate.
 * @param {string} cacheKey - unique cache key (include query params in key)
 * @param {(token: string) => Promise<any>} request - axios call returning response.data
 * @param {object} options
 */
export function useStoreFetch(cacheKey, request, options = {}) {
  const {
    ttlMs = 5 * 60 * 1000,
    enabled = true,
    deps = [],
  } = options;

  const { getToken } = useAuth();
  const hydratedRef = useRef(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const cached = readPageCache(cacheKey, ttlMs);
    if (cached) {
      setData(cached);
      setLoading(false);
    }
  }, [cacheKey, ttlMs]);

  const fetchData = useCallback(async ({ silent = false, forceRefresh = false } = {}) => {
    if (!enabled) {
      setLoading(false);
      return null;
    }

    const hasCache = Boolean(readPageCache(cacheKey, ttlMs));
    if (!silent && !hasCache) setLoading(true);
    if (silent || hasCache) setRefreshing(true);
    setError(null);

    try {
      const result = await withTokenRetry(getToken, async (forceTokenRefresh) => {
        const token = await getToken(forceTokenRefresh);
        if (!token) throw new Error('Not authenticated');
        return request(token);
      });

      setData(result);
      if (!forceRefresh) {
        writePageCache(cacheKey, result);
      }
      return result;
    } catch (err) {
      console.error(`[useStoreFetch] ${cacheKey}:`, err);
      setError(err);
      if (!hasCache) setData(null);
      return null;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, enabled, getToken, request, ttlMs, ...deps]);

  useEffect(() => {
    if (!enabled) return undefined;
    const cached = readPageCache(cacheKey, ttlMs);
    fetchData({ silent: Boolean(cached) });
  }, [fetchData, enabled, cacheKey, ttlMs]);

  return {
    data,
    loading,
    refreshing,
    error,
    refetch: (opts = {}) => fetchData({ silent: false, forceRefresh: true, ...opts }),
    mutate: setData,
  };
}

export async function storeGet(getToken, url, config = {}) {
  return withTokenRetry(getToken, async (forceRefresh) => {
    const token = await getToken(forceRefresh);
    const response = await axios.get(url, {
      ...config,
      headers: { ...config.headers, Authorization: `Bearer ${token}` },
    });
    return response.data;
  });
}
