'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import axios from 'axios';
import PageTitle from '@/components/PageTitle';
import Loading from '@/components/Loading';
import FastDeliveryPageHeader from '@/components/FastDeliveryPageHeader';
import { getLocalizedProductName } from '@/lib/displayText';
import { PLACEHOLDER_IMAGE as PLACEHOLDER } from '@/lib/mediaUrls';
import { getProductThumbnailUrl } from '@/lib/productMedia';
import { getProductPath } from '@/lib/productUrl';
import { STORE_CURRENCY } from '@/lib/storeCurrency';
import { DEFAULT_FAST_DELIVERY_PAGE, normalizeFastDeliveryPage } from '@/lib/fastDeliveryPageSettings';
import { useStorefrontI18n } from '@/lib/useStorefrontI18n';
import { Truck, Zap, ArrowUpRight } from 'lucide-react';

function shuffleProducts(list = []) {
  const items = [...list];
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function mergeUniqueProducts(...lists) {
  const seen = new Set();
  const merged = [];
  lists.flat().forEach((product) => {
    const id = String(product?._id || product?.id || product?.sku || product?.slug || '').trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    merged.push(product);
  });
  return merged;
}

function formatPrice(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return `${STORE_CURRENCY} 0.00`;
  return `${STORE_CURRENCY} ${amount.toFixed(2)}`;
}

function FastSellerCard({ product, language }) {
  const name = getLocalizedProductName(product, language) || product?.name || 'Product';
  const href = getProductPath(product) || '/shop';
  const image = getProductThumbnailUrl(product) || PLACEHOLDER;
  const price = product?.price ?? product?.AED ?? 0;
  const compareAt = Number(product?.mrp || product?.AED || 0);
  const sale = Number(price || 0);
  const showCompare = compareAt > sale && sale > 0;
  const isExpress = Boolean(product?.fastDelivery);

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_0_rgba(15,23,42,0.04)] transition duration-300 hover:-translate-y-1 hover:border-teal-300/70 hover:shadow-lg hover:shadow-teal-900/5">
      <Link href={href} className="relative block aspect-[4/5] overflow-hidden bg-slate-100">
        <Image
          src={image}
          alt={name}
          fill
          className="object-cover transition duration-500 group-hover:scale-[1.04]"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
        />
        {isExpress ? (
          <span className="absolute start-3 top-3 inline-flex items-center gap-1 rounded-full bg-teal-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
            <Zap size={11} />
            Express
          </span>
        ) : (
          <span className="absolute start-3 top-3 inline-flex items-center rounded-full bg-slate-900/85 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
            Top seller
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-3.5 sm:p-4">
        <Link href={href} className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900 transition group-hover:text-teal-800 sm:text-[15px]">
          {name}
        </Link>
        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <div>
            <p className="text-base font-bold tabular-nums text-slate-900">{formatPrice(sale || compareAt)}</p>
            {showCompare ? (
              <p className="text-xs tabular-nums text-slate-400 line-through">{formatPrice(compareAt)}</p>
            ) : null}
          </div>
          <Link
            href={href}
            className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 underline-offset-2 transition hover:text-teal-900 hover:underline"
          >
            Shop now
            <ArrowUpRight size={13} />
          </Link>
        </div>
      </div>
    </article>
  );
}

export default function FastDeliveryPage() {
  const { language } = useStorefrontI18n();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageSettings, setPageSettings] = useState(DEFAULT_FAST_DELIVERY_PAGE);
  const [shuffleSeed, setShuffleSeed] = useState(0);

  const shuffledProducts = useMemo(
    () => shuffleProducts(products),
    [products, shuffleSeed],
  );

  useEffect(() => {
    fetchFastDeliveryData();
  }, []);

  const fetchFastDeliveryData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [fastRes, topRes] = await Promise.all([
        axios.get('/api/products', {
          params: { fastDelivery: true, all: true, slim: true, inStockOnly: true },
        }),
        axios.get('/api/products', {
          params: { bestSeller: true, all: true, slim: true, inStockOnly: true },
        }).catch(() => ({ data: { products: [] } })),
      ]);

      const merged = mergeUniqueProducts(
        fastRes.data?.products || [],
        topRes.data?.products || [],
      );
      setProducts(merged);
      setShuffleSeed((value) => value + 1);

      try {
        const settingsRes = await axios.get('/api/store/appearance/sections/public', {
          headers: { 'Cache-Control': 'no-cache' },
        });
        setPageSettings(normalizeFastDeliveryPage({
          ...DEFAULT_FAST_DELIVERY_PAGE,
          ...(settingsRes.data?.fastDeliveryPage || {}),
        }));
      } catch (_) {
        setPageSettings(DEFAULT_FAST_DELIVERY_PAGE);
      }
    } catch (fetchError) {
      console.error('Error fetching fast delivery products:', fetchError);
      setError('Failed to load fast delivery products');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Loading />;
  }

  return (
    <>
      <PageTitle title={pageSettings.headerTitle || 'Fast Delivery & Top Sellers'} />
      <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef7f5_42%,#ffffff_100%)] -mt-12">
        <FastDeliveryPageHeader
          settings={{
            ...pageSettings,
            headerTitle: pageSettings.headerTitle || 'Fast Delivery',
            headerSubtitle: pageSettings.headerSubtitle
              || 'Express shipping picks and top sellers — shuffled fresh each visit.',
          }}
        />

        <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 sm:py-12">
          {error ? (
            <div className="rounded-2xl border border-red-200 bg-white px-6 py-16 text-center shadow-sm">
              <div className="mb-4 text-lg text-red-500">{error}</div>
              <button
                type="button"
                onClick={fetchFastDeliveryData}
                className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Try Again
              </button>
            </div>
          ) : shuffledProducts.length === 0 ? (
            <div
              className="rounded-2xl px-6 py-16 text-center"
              style={{ backgroundColor: pageSettings.emptyStateBgColor }}
            >
              <Truck size={72} className="mx-auto mb-6 text-slate-300" />
              <h2 className="mb-3 text-2xl font-bold text-slate-800">
                {pageSettings.emptyStateTitle}
              </h2>
              <p className="mb-6 text-slate-600">{pageSettings.emptyStateMessage}</p>
              <Link
                href="/shop"
                className="inline-block rounded-xl bg-teal-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-teal-800"
              >
                Browse All Products
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-8 flex flex-col gap-4 rounded-2xl border border-teal-200/70 bg-white/80 p-5 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white">
                    <Zap size={22} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
                      Fast selling & express delivery
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      All top sellers and fast-delivery products in one place —
                      {' '}
                      <span className="font-semibold text-teal-800">{shuffledProducts.length}</span>
                      {' '}
                      picks, freshly shuffled.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShuffleSeed((value) => value + 1)}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:border-teal-300 hover:bg-teal-50"
                >
                  Shuffle again
                </button>
              </div>

              <div className="grid grid-cols-2 items-stretch gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {shuffledProducts.map((product) => (
                  <FastSellerCard
                    key={product._id || product.id || product.slug}
                    product={product}
                    language={language}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
