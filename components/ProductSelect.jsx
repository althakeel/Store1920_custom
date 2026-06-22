"use client";
import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '@/lib/useAuth';

export default function ProductSelect({ value, onChange, selectedIds = [], products: propProducts }) {
  const { getToken } = useAuth();
  const [products, setProducts] = useState(propProducts || []);
  const [loading, setLoading] = useState(!propProducts);
  const [localValue, setLocalValue] = useState('');

  useEffect(() => {
    if (propProducts) return;

    let cancelled = false;

    (async () => {
      try {
        const token = await getToken();
        if (!token || cancelled) return;
        const res = await axios.get('/api/store/product', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!cancelled) setProducts(res.data.products || []);
      } catch {
        if (!cancelled) setProducts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [propProducts, getToken]);

  // Reset dropdown after selection
  useEffect(() => {
    if (localValue) setLocalValue('');
  }, [selectedIds]);

  return (
    <>
      <select
        className="w-full border rounded-lg px-3 py-2"
        value={localValue}
        onChange={e => {
          const val = e.target.value;
          if (val && !selectedIds.includes(val)) {
            onChange(val);
          }
          setLocalValue('');
        }}
        disabled={loading}
      >
        <option value="">{loading ? 'Loading products...' : (products.length === 0 ? 'No products found' : 'Select a product')}</option>
        {products.map(p => (
          <option key={p.id} value={p.id} disabled={selectedIds.includes(p.id)}>
            {p.name.length > 40 ? p.name.slice(0, 40) + '\u2026' : p.name}
          </option>
        ))}
      </select>
      {!loading && products.length === 0 && (
        <div className="text-xs text-red-500 mt-1">No products found. Please add products first.</div>
      )}
    </>
  );
}
