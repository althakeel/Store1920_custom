import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/useAuth";
import Image from "next/image";
import axios from "axios";

// Admin-editable grid section for dashboard: title + manual product selection
export default function AdminGridSectionEditor({ sectionId, onSave }) {
    const { getToken } = useAuth();
  const [title, setTitle] = useState("");
  const [titleAr, setTitleAr] = useState("");
  const [allProducts, setAllProducts] = useState([]);
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Fetch all products for selection (with Firebase Auth token)
    getToken().then(token => {
      if (!token) return;
      axios.get("/api/store/product", {
        headers: { Authorization: `Bearer ${token}` }
      }).then(res => setAllProducts(res.data.products || []));
    });
    // If editing, fetch section data
    if (sectionId) {
      axios.get(`/api/admin/grid-products/${sectionId}`).then(res => {
        setTitle(res.data.title || "");
        setTitleAr(res.data.titleAr || "");
        setSelectedProductIds(res.data.productIds || []);
      });
    }
  }, [sectionId]);

  // Handle multi-select dropdown
  const handleProductSelect = (e) => {
    const options = Array.from(e.target.selectedOptions);
    const ids = options.map(opt => opt.value);
    setSelectedProductIds(ids.slice(0, 3)); // max 3
  };

  const handleSave = async () => {
    setSaving(true);
    await axios.post("/api/admin/grid-products", {
      sectionId,
      title,
      titleAr,
      productIds: selectedProductIds
    });
    setSaving(false);
    if (onSave) onSave();
  };

  return (
    <div className="p-6 bg-white rounded-xl shadow max-w-2xl mx-auto">
      <h2 className="text-xl font-bold mb-4">Edit Grid Section</h2>
      <label className="block mb-2 font-medium">Section Title</label>
      <input
        className="border rounded px-3 py-2 w-full mb-4"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="e.g. Winter Essentials for You"
      />
      <label className="block mb-2 font-medium">Section Title (Arabic)</label>
      <input
        className="border rounded px-3 py-2 w-full mb-4"
        value={titleAr}
        onChange={e => setTitleAr(e.target.value)}
        placeholder="عنوان القسم بالعربية"
        dir="rtl"
      />
      <label className="block mb-2 font-medium">Select Products (max 3)</label>
      <select
        multiple
        className="border rounded px-3 py-2 w-full mb-4 h-32"
        value={selectedProductIds}
        onChange={handleProductSelect}
      >
        {allProducts.map(product => (
          <option key={product._id} value={product._id}>
            {product.name}
          </option>
        ))}
      </select>
      <button
        className="bg-orange-600 text-white px-6 py-2 rounded font-semibold disabled:opacity-60"
        onClick={handleSave}
        disabled={saving || !title || selectedProductIds.length === 0 || selectedProductIds.length > 3}
      >
        {saving ? "Saving..." : "Save Section"}
      </button>
    </div>
  );
}
