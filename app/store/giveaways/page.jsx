'use client';

import { useEffect, useMemo, useState } from 'react';
import { GiftIcon, PlusIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import { useAuth } from '@/lib/useAuth';

const initialForm = {
  title: '',
  description: '',
  isActive: true,
  giftProductId: '',
  minOrderAmount: '',
  triggerMode: 'any_product',
  triggerProductIds: [],
  startsAt: '',
  endsAt: '',
};

export default function StoreGiveawaysPage() {
  const { getToken } = useAuth();
  const [campaigns, setCampaigns] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState(initialForm);

  const currency = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || 'AED';

  const productOptions = useMemo(
    () => (products || []).map((product) => ({ id: String(product._id), name: product.name || 'Untitled product' })),
    [products]
  );

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const token = await getToken();
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const [campaignRes, productRes] = await Promise.all([
          fetch('/api/store/giveaways', { headers }),
          fetch('/api/store/product', { headers }),
        ]);

        const campaignData = await campaignRes.json();
        const productData = await productRes.json();

        setCampaigns(campaignData.campaigns || []);
        setProducts(productData.products || []);
      } catch (error) {
        console.error('Failed to load giveaways page:', error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [getToken]);

  const resetForm = () => {
    setFormData(initialForm);
    setEditingId(null);
  };

  const startCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const startEdit = (campaign) => {
    setEditingId(campaign._id);
    setFormData({
      title: campaign.title || '',
      description: campaign.description || '',
      isActive: campaign.isActive !== false,
      giftProductId: campaign.giftProductId || '',
      minOrderAmount: String(campaign.minOrderAmount || ''),
      triggerMode: campaign.triggerMode || 'any_product',
      triggerProductIds: campaign.triggerProductIds || [],
      startsAt: campaign.startsAt ? new Date(campaign.startsAt).toISOString().slice(0, 16) : '',
      endsAt: campaign.endsAt ? new Date(campaign.endsAt).toISOString().slice(0, 16) : '',
    });
    setShowForm(true);
  };

  const reloadCampaigns = async () => {
    const token = await getToken();
    const res = await fetch('/api/store/giveaways', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const data = await res.json();
    setCampaigns(data.campaigns || []);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const token = await getToken();
      const method = editingId ? 'PUT' : 'POST';
      const url = editingId ? `/api/store/giveaways/${editingId}` : '/api/store/giveaways';
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          ...formData,
          minOrderAmount: Number(formData.minOrderAmount || 0),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to save giveaway');
        return;
      }

      await reloadCampaigns();
      setShowForm(false);
      resetForm();
    } catch (error) {
      console.error('Failed to save giveaway:', error);
      alert('Failed to save giveaway');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (campaignId) => {
    if (!window.confirm('Delete this giveaway campaign?')) return;
    try {
      const token = await getToken();
      const res = await fetch(`/api/store/giveaways/${campaignId}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to delete giveaway');
        return;
      }
      await reloadCampaigns();
    } catch (error) {
      console.error('Failed to delete giveaway:', error);
      alert('Failed to delete giveaway');
    }
  };

  const giftLabel = (campaign) => {
    return productOptions.find((product) => product.id === String(campaign.giftProductId))?.name || 'Unknown product';
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-orange-500" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Giveaways</h1>
          <p className="text-sm text-gray-600">
            Auto-add a free gift when the cart crosses a minimum amount, with optional product-specific triggers.
          </p>
        </div>
        <button
          type="button"
          onClick={startCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-white hover:bg-orange-600"
        >
          <PlusIcon size={18} />
          Create Giveaway
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-gray-700">
              Title
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                placeholder="Free Gift on Orders Over 300"
                required
              />
            </label>

            <label className="text-sm font-medium text-gray-700">
              Minimum order amount ({currency})
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.minOrderAmount}
                onChange={(e) => setFormData((prev) => ({ ...prev, minOrderAmount: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                placeholder="300"
                required
              />
            </label>

            <label className="text-sm font-medium text-gray-700 md:col-span-2">
              Free gift product
              <select
                value={formData.giftProductId}
                onChange={(e) => setFormData((prev) => ({ ...prev, giftProductId: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                required
              >
                <option value="">Select a gift product</option>
                {productOptions.map((product) => (
                  <option key={product.id} value={product.id}>{product.name}</option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-gray-700 md:col-span-2">
              Description
              <textarea
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                className="mt-1 min-h-[90px] w-full rounded-lg border border-gray-300 px-3 py-2"
                placeholder="Shown internally so your team knows when this giveaway should apply."
              />
            </label>

            <label className="text-sm font-medium text-gray-700">
              Rule type
              <select
                value={formData.triggerMode}
                onChange={(e) => setFormData((prev) => ({ ...prev, triggerMode: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                <option value="any_product">Any cart qualifies once minimum amount is reached</option>
                <option value="specific_products">Advanced: only when selected products are in the cart</option>
              </select>
            </label>

            <label className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 md:self-end">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData((prev) => ({ ...prev, isActive: e.target.checked }))}
              />
              Giveaway is active
            </label>

            {formData.triggerMode === 'specific_products' && (
              <label className="text-sm font-medium text-gray-700 md:col-span-2">
                Trigger products
                <select
                  multiple
                  value={formData.triggerProductIds}
                  onChange={(e) => {
                    const values = Array.from(e.target.selectedOptions).map((option) => option.value);
                    setFormData((prev) => ({ ...prev, triggerProductIds: values }));
                  }}
                  className="mt-1 min-h-[160px] w-full rounded-lg border border-gray-300 px-3 py-2"
                >
                  {productOptions.map((product) => (
                    <option key={product.id} value={product.id}>{product.name}</option>
                  ))}
                </select>
                <span className="mt-1 block text-xs text-gray-500">
                  Advanced rule: the free gift applies only when at least one selected trigger product is in the cart.
                </span>
              </label>
            )}

            <label className="text-sm font-medium text-gray-700">
              Start date
              <input
                type="datetime-local"
                value={formData.startsAt}
                onChange={(e) => setFormData((prev) => ({ ...prev, startsAt: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </label>

            <label className="text-sm font-medium text-gray-700">
              End date
              <input
                type="datetime-local"
                value={formData.endsAt}
                onChange={(e) => setFormData((prev) => ({ ...prev, endsAt: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </label>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-gray-900 px-4 py-2 text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Saving...' : editingId ? 'Update Giveaway' : 'Create Giveaway'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {campaigns.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 py-16 text-center">
          <GiftIcon className="mx-auto mb-4 text-gray-300" size={52} />
          <p className="text-lg font-semibold text-gray-700">No giveaways yet</p>
          <p className="mt-1 text-sm text-gray-500">Create a free gift campaign to reward customers automatically.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {campaigns.map((campaign) => (
            <div key={campaign._id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-gray-900">{campaign.title}</h2>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${campaign.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {campaign.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">Gift: {giftLabel(campaign)}</p>
                  <p className="mt-1 text-sm text-gray-500">Min order: {currency}{Number(campaign.minOrderAmount || 0).toLocaleString()}</p>
                  <p className="mt-1 text-sm text-gray-500">
                    Rule: {campaign.triggerMode === 'specific_products' ? 'Only for selected trigger products' : 'Any product can unlock the gift'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => startEdit(campaign)} className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50">
                    <PencilIcon size={16} />
                  </button>
                  <button type="button" onClick={() => handleDelete(campaign._id)} className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50">
                    <Trash2Icon size={16} />
                  </button>
                </div>
              </div>

              {campaign.description ? (
                <p className="mt-3 text-sm text-gray-600">{campaign.description}</p>
              ) : null}

              {campaign.triggerMode === 'specific_products' && Array.isArray(campaign.triggerProductIds) && campaign.triggerProductIds.length > 0 ? (
                <div className="mt-4 rounded-xl bg-violet-50 p-3 text-sm text-violet-900">
                  <div className="font-medium">Advanced trigger products</div>
                  <div className="mt-1 text-violet-800">
                    {campaign.triggerProductIds
                      .map((id) => productOptions.find((product) => product.id === String(id))?.name || id)
                      .join(', ')}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}