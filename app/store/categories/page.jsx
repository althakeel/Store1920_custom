'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/useAuth';
import axios from 'axios';
import toast from 'react-hot-toast';
import { FiTrash2, FiPlus, FiEdit2, FiX, FiSearch, FiCheckCircle, FiUpload } from 'react-icons/fi';
import { MdEdit, MdCategory, MdOutlineCheckCircleOutline } from 'react-icons/md';
import Loading from '@/components/Loading';

const MAX_CATEGORIES = 10;

function slugify(text = '') {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function buildCategoryUrl(name = '') {
  const slug = slugify(name);
  return slug ? `/${slug}` : '/';
}

export default function StoreCategoryMenu() {
  const { user, getToken } = useAuth();
  const [categories, setCategories] = useState([]);
  const [existingCategories, setExistingCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingIdx, setEditingIdx] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [importingCategories, setImportingCategories] = useState(false);
  const [activeTab, setActiveTab] = useState('my-categories');
  const [searchQuery, setSearchQuery] = useState('');
  const categoryImportInputRef = useRef(null);

  const [formData, setFormData] = useState({
    name: '',
    image: '',
    url: '',
  });

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');

  // Fetch categories from store
  const fetchCategories = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      
      // Fetch custom store menu categories
      const { data } = await axios.get('/api/store/category-menu', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCategories(data.categories || []);

      // Fetch existing system categories
      try {
        const existingRes = await axios.get('/api/store/categories');
        setExistingCategories(existingRes.data.categories || []);
      } catch (error) {
        console.log('No existing categories');
        setExistingCategories([]);
      }
    } catch (error) {
      console.log('First load or no categories yet');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchCategories();
    }
  }, [user]);

  // Handle image selection
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImportCategories = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setImportingCategories(true);
      const token = await getToken();
      const formData = new FormData();
      formData.append('file', file);

      const { data } = await axios.post('/api/store/categories/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`,
        },
      });

      await fetchCategories();

      const summary = data?.counts
        ? `Created ${data.counts.created}, updated ${data.counts.updated}, mirrored ${data.counts.mirroredImages} image${data.counts.mirroredImages === 1 ? '' : 's'}`
        : 'Categories imported';

      toast.success(summary);

      if (Array.isArray(data?.warnings) && data.warnings.length) {
        toast((t) => (
          <div className="max-w-sm text-sm">
            <p className="font-semibold text-slate-900 mb-1">Import completed with notes</p>
            <p className="text-slate-600 line-clamp-4">{data.warnings.join(' ')}</p>
            <button
              type="button"
              onClick={() => toast.dismiss(t.id)}
              className="mt-2 text-blue-600 font-medium"
            >
              Close
            </button>
          </div>
        ), { duration: 7000 });
      }
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Failed to import categories');
    } finally {
      setImportingCategories(false);
      event.target.value = '';
    }
  };

  // Save category
  const handleSave = async (e) => {
    e.preventDefault();
    
    if (!formData.name?.trim()) {
      toast.error('Category name is required');
      return;
    }

    if (!imageFile && !formData.image) {
      toast.error('Image is required');
      return;
    }

    try {
      setUploading(true);
      const token = await getToken();
      let imageUrl = formData.image;

      // Upload image if new file selected
      if (imageFile) {
        const uploadFormData = new FormData();
        uploadFormData.append('files', imageFile);
        const uploadRes = await axios.post('/api/upload', uploadFormData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${token}`,
          },
        });
        imageUrl = uploadRes.data?.urls?.[0] || uploadRes.data?.url || '';
      }

      if (!imageUrl) {
        toast.error('Failed to upload image');
        return;
      }

      const generatedUrl = buildCategoryUrl(formData.name);

      let updatedCategories;
      if (editingIdx !== null) {
        // Update existing category
        updatedCategories = [...categories];
        updatedCategories[editingIdx] = {
          name: formData.name.trim(),
          image: imageUrl,
          url: generatedUrl,
        };
        toast.success('Category updated!');
      } else {
        // Add new category
        updatedCategories = [
          ...categories,
          {
            name: formData.name.trim(),
            image: imageUrl,
            url: generatedUrl,
          },
        ];
        toast.success('Category added!');
      }

      // Save to backend
      await axios.post('/api/store/category-menu', { categories: updatedCategories }, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Ensure category also exists in product taxonomy (used by Add Product page)
      try {
        await axios.post('/api/store/categories', {
          name: formData.name.trim(),
        }, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (syncError) {
        const message = syncError?.response?.data?.error || '';
        if (!message.toLowerCase().includes('already exists')) {
          console.warn('Category taxonomy sync failed:', syncError);
        }
      }

      setCategories(updatedCategories);
      handleCancel();
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Failed to save category');
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  // Delete category
  const handleDelete = async (idx) => {
    if (!confirm('Are you sure you want to remove this category?')) return;

    try {
      const token = await getToken();
      const updatedCategories = categories.filter((_, i) => i !== idx);
      
      await axios.post('/api/store/category-menu', { categories: updatedCategories }, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setCategories(updatedCategories);
      toast.success('Category removed');
    } catch (error) {
      toast.error('Failed to remove category');
    }
  };

  // Edit category
  const handleEdit = (idx) => {
    const cat = categories[idx];
    setFormData({
      name: cat.name,
      image: cat.image,
      url: cat.url,
    });
    setImagePreview(cat.image);
    setEditingIdx(idx);
    setShowForm(true);
  };;

  // Cancel form
  const handleCancel = () => {
    setShowForm(false);
    setEditingIdx(null);
    setFormData({ name: '', image: '', url: '' });
    setImageFile(null);
    setImagePreview('');
  };

  // Organize categories by parent-child relationships
  const organizeCategoriesByParent = (categories) => {
    const parentCategories = categories.filter(cat => !cat.parentId);
    return parentCategories.map(parent => ({
      ...parent,
      children: categories.filter(cat => cat.parentId === parent._id)
    }));
  };

  const filteredExistingCategories = existingCategories.filter(cat =>
    cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cat.slug?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const hierarchicalCategories = organizeCategoriesByParent(filteredExistingCategories);

  if (loading) return <Loading />;
  if (!user) return <div className="p-6 text-red-500">Please login</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header Section */}
        <div className="mb-12">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
              <MdCategory className="text-3xl text-white" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-slate-900">Store Categories</h1>
              <p className="text-slate-600 mt-2 text-lg">Organize and customize your store's product categories</p>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl shadow-md p-8 border border-slate-100 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Active Categories</p>
                  <p className="text-4xl font-bold text-blue-600 mt-3">{categories.length}</p>
                  <p className="text-xs text-slate-500 mt-2">out of {MAX_CATEGORIES} maximum</p>
                </div>
                <div className="p-4 bg-blue-100 rounded-xl">
                  <MdCategory className="text-3xl text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-md p-8 border border-slate-100 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-600 uppercase tracking-wide">System Categories</p>
                  <p className="text-4xl font-bold text-emerald-600 mt-3">{existingCategories.length}</p>
                  <p className="text-xs text-slate-500 mt-2">available to use</p>
                </div>
                <div className="p-4 bg-emerald-100 rounded-xl">
                  <FiCheckCircle className="text-3xl text-emerald-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-md p-8 border border-slate-100 hover:shadow-lg transition-shadow">
              <div className="flex flex-col justify-between h-full">
                <div>
                  <p className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Completion</p>
                  <p className="text-4xl font-bold text-purple-600 mt-3">{Math.round((categories.length / MAX_CATEGORIES) * 100)}%</p>
                </div>
                <div className="mt-4 w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 via-purple-600 to-purple-700 rounded-full transition-all duration-500"
                    style={{ width: `${(categories.length / MAX_CATEGORIES) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-8 bg-white rounded-xl shadow-sm border border-slate-200 p-2">
          <button
            onClick={() => {
              setActiveTab('my-categories');
              setShowForm(false);
            }}
            className={`flex-1 py-3 px-6 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
              activeTab === 'my-categories'
                ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <MdEdit className="text-xl" />
            My Categories ({categories.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('browse');
              setShowForm(false);
            }}
            className={`flex-1 py-3 px-6 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
              activeTab === 'browse'
                ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <FiSearch className="text-xl" />
            Browse System ({existingCategories.length})
          </button>
        </div>

        {/* Main Content */}
        {activeTab === 'my-categories' ? (
          <>
            <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                {!showForm && categories.length < MAX_CATEGORIES && (
                  <button
                    onClick={() => setShowForm(true)}
                    className="w-full md:w-auto flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:shadow-xl transition-all duration-200 font-semibold text-lg"
                  >
                    <FiPlus size={24} />
                    Add New Category
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => categoryImportInputRef.current?.click()}
                  disabled={importingCategories}
                  className="w-full md:w-auto flex items-center justify-center gap-3 px-8 py-4 bg-white text-slate-800 rounded-xl border border-slate-200 hover:shadow-lg transition-all duration-200 font-semibold text-lg disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <FiUpload size={22} />
                  {importingCategories ? 'Importing...' : 'Import Categories'}
                </button>

                <input
                  ref={categoryImportInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleImportCategories}
                  className="hidden"
                />
              </div>

              <div className="max-w-xl rounded-2xl border border-blue-100 bg-white/80 px-5 py-4 text-sm text-slate-600 shadow-sm">
                <p className="font-semibold text-slate-900">Spreadsheet import</p>
                <p className="mt-1">Supported columns: Name, Slug, Description, Image or Image URL, URL, Parent, Parent Slug, Parent ID, Include In Menu, Legacy Source ID.</p>
              </div>
            </div>

            {/* Form Modal */}
            {showForm && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                  <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 p-6 flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-white">
                      {editingIdx !== null ? '✏️ Edit Category' : '➕ Add New Category'}
                    </h2>
                    <button
                      onClick={handleCancel}
                      className="p-2 hover:bg-blue-500 rounded-lg transition text-white"
                    >
                      <FiX size={24} />
                    </button>
                  </div>

                  <form onSubmit={handleSave} className="p-8 space-y-8">
                    {/* Name Field */}
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">
                        Category Name *
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g., Women's Fashion, Electronics, Home & Garden"
                        className="w-full px-5 py-3 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition text-slate-900 placeholder-slate-400"
                      />
                    </div>

                    {/* URL Field */}
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">
                        Category URL (auto-generated)
                      </label>
                      <div className="w-full px-5 py-3 border-2 border-slate-200 rounded-xl bg-slate-50 text-slate-600">
                        {buildCategoryUrl(formData.name)}
                      </div>
                    </div>

                    {/* Image Upload */}
                    <div className="border-t-2 border-slate-100 pt-6">
                      <label className="block text-sm font-bold text-slate-700 mb-4 uppercase tracking-wide">
                        Category Image *
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="col-span-1">
                          <div className="relative border-2 border-dashed border-slate-300 rounded-xl p-6 hover:border-blue-500 transition cursor-pointer bg-slate-50">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleImageChange}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            <div className="flex flex-col items-center justify-center text-center">
                              <FiPlus className="text-3xl text-slate-400 mb-3" />
                              <p className="text-sm font-semibold text-slate-700">Click to upload</p>
                              <p className="text-xs text-slate-500 mt-1">or drag and drop</p>
                              <p className="text-xs text-slate-400 mt-2">PNG, JPG up to 5MB</p>
                              <p className="text-xs text-slate-400 mt-1">Recommended: 150x150px</p>
                            </div>
                          </div>
                        </div>

                        {/* Image Preview */}
                        {imagePreview && (
                          <div className="col-span-1 flex items-center justify-center">
                            <div className="relative">
                              <img
                                src={imagePreview}
                                alt="Preview"
                                className="w-40 h-40 object-cover rounded-xl border-2 border-blue-200 shadow-lg"
                              />
                              <div className="absolute -top-2 -right-2 bg-emerald-500 rounded-full p-1">
                                <MdOutlineCheckCircleOutline className="text-white text-xl" />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Form Actions */}
                    <div className="flex gap-4 pt-6 border-t-2 border-slate-100">
                      <button
                        type="submit"
                        disabled={uploading}
                        className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition font-semibold"
                      >
                        {uploading ? '⏳ Saving...' : editingIdx !== null ? '💾 Update Category' : '✨ Add Category'}
                      </button>
                      <button
                        type="button"
                        onClick={handleCancel}
                        className="flex-1 py-3 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 transition font-semibold"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Categories Grid */}
            {categories.length === 0 ? (
              <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-12 text-center">
                <div className="flex justify-center mb-4">
                  <div className="p-4 bg-slate-100 rounded-full">
                    <MdCategory className="text-4xl text-slate-400" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-slate-700 mb-2">No Custom Categories Yet</p>
                <p className="text-slate-600 mb-6">Create your first category to display on your store navigation</p>
                <button
                  onClick={() => setShowForm(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-semibold"
                >
                  <FiPlus /> Create First Category
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {categories.map((cat, idx) => (
                  <div key={idx} className="group bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border border-slate-100">
                    {/* Image */}
                    <div className="relative h-48 overflow-hidden bg-slate-100">
                      <img
                        src={cat.image}
                        alt={cat.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition duration-300" />
                    </div>

                    {/* Content */}
                    <div className="p-6">
                      <h3 className="font-bold text-lg text-slate-900 mb-2 line-clamp-1">{cat.name}</h3>
                      <p className="text-xs text-blue-600 mb-4 line-clamp-1 font-mono bg-blue-50 p-2 rounded-lg">{cat.url}</p>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(idx)}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 text-blue-600 font-semibold hover:bg-blue-50 rounded-lg transition text-sm"
                        >
                          <FiEdit2 size={16} /> Edit
                        </button>
                        <button
                          onClick={() => handleDelete(idx)}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 text-red-600 font-semibold hover:bg-red-50 rounded-lg transition text-sm"
                        >
                          <FiTrash2 size={16} /> Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Search Bar */}
            <div className="mb-8">
              <div className="relative">
                <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 text-xl" />
                <input
                  type="text"
                  placeholder="Search categories by name or slug..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-6 py-4 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-slate-900 placeholder-slate-400"
                />
              </div>
            </div>

            {/* System Categories Grid - Hierarchical */}
            {hierarchicalCategories.length === 0 ? (
              <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-12 text-center">
                <p className="text-xl font-bold text-slate-700">No Categories Found</p>
                <p className="text-slate-600 mt-2">Try adjusting your search terms</p>
              </div>
            ) : (
              <div className="space-y-8">
                {hierarchicalCategories.map((parent, parentIdx) => (
                  <div key={parentIdx} className="bg-white rounded-2xl shadow-lg border border-emerald-100 overflow-hidden">
                    {/* Parent Category */}
                    <div className="bg-gradient-to-r from-emerald-50 to-emerald-100 border-b border-emerald-200">
                      <div className="p-6">
                        <div className="flex items-start gap-6">
                          {/* Parent Image */}
                          <div className="relative w-24 h-24 flex-shrink-0 overflow-hidden rounded-xl border-2 border-emerald-300 shadow-md">
                            {parent.image && (
                              <img
                                src={parent.image}
                                alt={parent.name}
                                className="w-full h-full object-cover"
                              />
                            )}
                            <div className="absolute top-1 right-1 bg-emerald-600 text-white px-2 py-0.5 rounded-full text-xs font-bold">
                              Parent
                            </div>
                          </div>

                          {/* Parent Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <h3 className="text-2xl font-bold text-slate-900 mb-2">{parent.name}</h3>
                                {parent.slug && (
                                  <p className="text-sm text-slate-700 font-mono bg-white px-3 py-1 rounded-lg inline-block mb-2">
                                    Slug: {parent.slug}
                                  </p>
                                )}
                                {parent.description && (
                                  <p className="text-sm text-slate-700 mt-2">{parent.description}</p>
                                )}
                                {parent.children && parent.children.length > 0 && (
                                  <p className="text-xs text-emerald-700 font-semibold mt-3 flex items-center gap-2">
                                    <span className="bg-emerald-200 px-2 py-1 rounded-full">{parent.children.length} subcategories</span>
                                  </p>
                                )}
                              </div>

                              {/* Use Parent Button */}
                              <button
                                onClick={() => {
                                  setFormData({
                                    name: parent.name,
                                    image: parent.image || '',
                                    url: `/shop?category=${parent.slug}`,
                                  });
                                  setImagePreview(parent.image || '');
                                  setShowForm(true);
                                  setActiveTab('my-categories');
                                }}
                                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-semibold text-sm whitespace-nowrap flex items-center gap-2"
                              >
                                <FiCheckCircle /> Use
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Child Categories */}
                    {parent.children && parent.children.length > 0 && (
                      <div className="p-6 bg-white">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Subcategories:</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {parent.children.map((child, childIdx) => (
                            <div key={childIdx} className="group bg-slate-50 rounded-xl border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all duration-300 overflow-hidden">
                              {/* Child Image */}
                              <div className="relative h-32 overflow-hidden bg-slate-100">
                                {child.image && (
                                  <img
                                    src={child.image}
                                    alt={child.name}
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                  />
                                )}
                                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition duration-300" />
                                <div className="absolute top-2 right-2 bg-blue-500 text-white px-2 py-0.5 rounded-full text-xs font-bold">
                                  Child
                                </div>
                              </div>

                              {/* Child Content */}
                              <div className="p-4">
                                <h4 className="font-bold text-slate-900 mb-2 line-clamp-1 text-sm">{child.name}</h4>
                                {child.slug && (
                                  <p className="text-xs text-slate-600 mb-3 font-mono bg-white p-1.5 rounded">
                                    {child.slug}
                                  </p>
                                )}
                                {child.description && (
                                  <p className="text-xs text-slate-600 mb-3 line-clamp-2">{child.description}</p>
                                )}

                                {/* Use Child Button */}
                                <button
                                  onClick={() => {
                                    setFormData({
                                      name: child.name,
                                      image: child.image || '',
                                      url: `/shop?category=${child.slug}`,
                                    });
                                    setImagePreview(child.image || '');
                                    setShowForm(true);
                                    setActiveTab('my-categories');
                                  }}
                                  className="w-full py-2 text-blue-600 font-semibold hover:bg-blue-50 rounded-lg transition text-xs flex items-center justify-center gap-1"
                                >
                                  <FiCheckCircle size={14} /> Use This
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* No Children Message */}
                    {(!parent.children || parent.children.length === 0) && (
                      <div className="p-6 bg-slate-50 border-t border-slate-200">
                        <p className="text-sm text-slate-500 italic text-center">No subcategories</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
