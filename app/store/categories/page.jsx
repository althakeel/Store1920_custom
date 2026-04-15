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

function buildSystemCategoryMenuUrl(category = {}) {
  if (category?.slug) {
    return `/shop?category=${category.slug}`;
  }

  return category?.url || buildCategoryUrl(category?.name || '');
}

function getMenuCategoryIdentifier(category = {}) {
  return String(category?.id || category?._id || category?.url || slugify(category?.name || ''));
}

function buildCategoryTree(categories = [], parentId = null) {
  return categories
    .filter((category) => String(category.parentId || '') === String(parentId || ''))
    .map((category) => ({
      ...category,
      children: buildCategoryTree(categories, category._id),
    }));
}

function flattenCategoryIds(categories = []) {
  return categories.flatMap((category) => [
    String(category._id),
    ...flattenCategoryIds(category.children || []),
  ]);
}

function flattenCategoryOptions(categories = [], depth = 0) {
  return categories.flatMap((category) => [
    {
      id: String(category._id),
      name: category.name,
      depth,
    },
    ...flattenCategoryOptions(category.children || [], depth + 1),
  ]);
}

function getCategoryLevelMeta(depth = 0) {
  if (depth === 0) {
    return {
      label: 'Main Category',
      badgeClassName: 'bg-emerald-600 text-white',
      cardClassName: 'border-emerald-100 bg-gradient-to-r from-emerald-50 to-emerald-100',
      selectClassName: 'bg-emerald-700 text-white',
      useClassName: 'bg-emerald-600 text-white hover:bg-emerald-700',
    };
  }

  if (depth === 1) {
    return {
      label: 'Sub Category',
      badgeClassName: 'bg-blue-600 text-white',
      cardClassName: 'border-blue-100 bg-blue-50',
      selectClassName: 'bg-blue-600 text-white',
      useClassName: 'bg-blue-600 text-white hover:bg-blue-700',
    };
  }

  if (depth === 2) {
    return {
      label: 'Child Category',
      badgeClassName: 'bg-violet-600 text-white',
      cardClassName: 'border-violet-100 bg-violet-50',
      selectClassName: 'bg-violet-600 text-white',
      useClassName: 'bg-violet-600 text-white hover:bg-violet-700',
    };
  }

  if (depth === 3) {
    return {
      label: 'Grandchild Category',
      badgeClassName: 'bg-fuchsia-600 text-white',
      cardClassName: 'border-fuchsia-100 bg-fuchsia-50',
      selectClassName: 'bg-fuchsia-600 text-white',
      useClassName: 'bg-fuchsia-600 text-white hover:bg-fuchsia-700',
    };
  }

  return {
    label: `Nested Level ${depth + 1}`,
    badgeClassName: 'bg-slate-700 text-white',
    cardClassName: 'border-slate-200 bg-slate-50',
    selectClassName: 'bg-slate-700 text-white',
    useClassName: 'bg-slate-700 text-white hover:bg-slate-800',
  };
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
  const [addingSelected, setAddingSelected] = useState(false);
  const [deletingBrowseSelected, setDeletingBrowseSelected] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [activeTab, setActiveTab] = useState('my-categories');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
  const [selectedMenuCategoryIds, setSelectedMenuCategoryIds] = useState([]);
  const categoryImportInputRef = useRef(null);

  const [formData, setFormData] = useState({
    name: '',
    image: '',
    url: '',
    parentId: '',
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

      if (!token) {
        toast.error('Please login again and retry');
        return;
      }

      let imageUrl = formData.image;
      const selectedParentId = String(formData.parentId || '').trim();
      const existingCategoryById = new Map(existingCategories.map((category) => [String(category._id), category]));
      const selectedParent = selectedParentId ? existingCategoryById.get(selectedParentId) : null;

      // Upload image if new file selected
      if (imageFile) {
        const uploadFormData = new FormData();
        uploadFormData.append('files', imageFile);
        const uploadRes = await axios.post('/api/upload', uploadFormData, {
          headers: {
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
      const currentMenuCategory = editingIdx !== null ? categories[editingIdx] : null;
      const existingSystemCategoryId = String(currentMenuCategory?.systemCategoryId || currentMenuCategory?.id || '').trim();
      const matchingSystemCategory = existingCategories.find((category) => category.slug === slugify(formData.name));

      let syncedCategory = null;

      try {
        if (existingSystemCategoryId) {
          const updateResponse = await axios.put(`/api/store/categories/${existingSystemCategoryId}`, {
            name: formData.name.trim(),
            image: imageUrl,
            parentId: selectedParentId || null,
          }, {
            headers: { Authorization: `Bearer ${token}` },
          });
          syncedCategory = updateResponse.data?.category || null;
        } else if (matchingSystemCategory) {
          syncedCategory = matchingSystemCategory;
        } else {
          const createResponse = await axios.post('/api/store/categories', {
            name: formData.name.trim(),
            image: imageUrl,
            parentId: selectedParentId || null,
          }, {
            headers: { Authorization: `Bearer ${token}` },
          });
          syncedCategory = createResponse.data?.category || null;
        }
      } catch (syncError) {
        toast.error(syncError?.response?.data?.error || 'Failed to sync category taxonomy');
        return;
      }

      const menuCategory = {
        id: String(syncedCategory?._id || existingSystemCategoryId || matchingSystemCategory?._id || slugify(formData.name)),
        systemCategoryId: String(syncedCategory?._id || existingSystemCategoryId || matchingSystemCategory?._id || ''),
        parentId: selectedParentId || null,
        parentName: selectedParent?.name || syncedCategory?.parent?.name || '',
        name: formData.name.trim(),
        image: imageUrl,
        url: syncedCategory?.slug ? `/shop?category=${syncedCategory.slug}` : generatedUrl,
      };

      let updatedCategories;
      if (editingIdx !== null) {
        // Update existing category
        updatedCategories = [...categories];
        updatedCategories[editingIdx] = menuCategory;
        toast.success('Category updated!');
      } else {
        // Add new category
        updatedCategories = [
          ...categories,
          menuCategory,
        ];
        toast.success('Category added!');
      }

      // Save to backend
      await axios.post('/api/store/category-menu', { categories: updatedCategories }, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setCategories(updatedCategories);
      await fetchCategories();
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
      parentId: cat.parentId || '',
    });
    setImagePreview(cat.image);
    setEditingIdx(idx);
    setShowForm(true);
  };;

  // Cancel form
  const handleCancel = () => {
    setShowForm(false);
    setEditingIdx(null);
    setFormData({ name: '', image: '', url: '', parentId: '' });
    setImageFile(null);
    setImagePreview('');
  };

  const toggleMenuCategorySelection = (categoryId) => {
    setSelectedMenuCategoryIds((current) => (
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId]
    ));
  };

  const toggleCategorySelection = (categoryId) => {
    setSelectedCategoryIds((current) => (
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId]
    ));
  };

  const handleAddSelectedCategories = async () => {
    if (!selectedCategoryIds.length) {
      toast.error('Select at least one category');
      return;
    }

    try {
      setAddingSelected(true);
      const token = await getToken();
      const existingIdentifiers = new Set(
        categories.flatMap((category) => [
          String(category.id || ''),
          String(category.url || ''),
          slugify(category.name || ''),
        ]).filter(Boolean)
      );

      const selectedCategories = existingCategories.filter((category) =>
        selectedCategoryIds.includes(String(category._id))
      );

      const uniqueSelections = selectedCategories.filter((category) => {
        const menuUrl = buildSystemCategoryMenuUrl(category);
        return !existingIdentifiers.has(String(category._id))
          && !existingIdentifiers.has(menuUrl)
          && !existingIdentifiers.has(slugify(category.name || ''));
      });

      const categoriesWithImages = uniqueSelections.filter((category) => category.image);
      const skippedForImage = uniqueSelections.length - categoriesWithImages.length;
      const remainingSlots = Math.max(0, MAX_CATEGORIES - categories.length);

      if (!remainingSlots) {
        toast.error(`Maximum ${MAX_CATEGORIES} categories allowed`);
        return;
      }

      const categoriesToAdd = categoriesWithImages.slice(0, remainingSlots).map((category) => ({
        id: String(category._id),
        systemCategoryId: String(category._id),
        parentId: category.parentId || null,
        parentName: existingCategories.find((entry) => String(entry._id) === String(category.parentId || ''))?.name || '',
        name: category.name,
        image: category.image,
        url: buildSystemCategoryMenuUrl(category),
        children: [],
      }));

      if (!categoriesToAdd.length) {
        toast.error(skippedForImage ? 'Selected categories need images before they can be added' : 'Selected categories are already in your store');
        return;
      }

      const updatedCategories = [...categories, ...categoriesToAdd];

      await axios.post('/api/store/category-menu', { categories: updatedCategories }, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setCategories(updatedCategories);
      setSelectedCategoryIds([]);
      setActiveTab('my-categories');

      const skippedDuplicates = selectedCategories.length - uniqueSelections.length;
      const skippedForLimit = categoriesWithImages.length - categoriesToAdd.length;
      const notes = [
        skippedDuplicates ? `${skippedDuplicates} already existed` : '',
        skippedForImage ? `${skippedForImage} had no image` : '',
        skippedForLimit ? `${skippedForLimit} exceeded the ${MAX_CATEGORIES} category limit` : '',
      ].filter(Boolean);

      toast.success(
        notes.length
          ? `Added ${categoriesToAdd.length} categories. ${notes.join('. ')}.`
          : `Added ${categoriesToAdd.length} categories.`
      );
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Failed to add selected categories');
    } finally {
      setAddingSelected(false);
    }
  };

  const handleDeleteSelectedSystemCategories = async () => {
    if (!selectedCategoryIds.length) {
      toast.error('Select categories to delete');
      return;
    }

    if (!confirm(`Delete ${selectedCategoryIds.length} selected system categor${selectedCategoryIds.length === 1 ? 'y' : 'ies'}?`)) {
      return;
    }

    try {
      setDeletingBrowseSelected(true);
      const token = await getToken();
      const categoryById = new Map(existingCategories.map((category) => [String(category._id), category]));
      const getDepth = (categoryId) => {
        let depth = 0;
        let current = categoryById.get(String(categoryId));

        while (current?.parentId) {
          depth += 1;
          current = categoryById.get(String(current.parentId));
        }

        return depth;
      };

      const idsToDelete = [...selectedCategoryIds].sort((left, right) => getDepth(right) - getDepth(left));
      const deletedIds = [];
      const failedMessages = [];

      for (const categoryId of idsToDelete) {
        try {
          await axios.delete(`/api/store/categories/${categoryId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          deletedIds.push(categoryId);
        } catch (error) {
          const categoryName = categoryById.get(categoryId)?.name || 'Category';
          failedMessages.push(`${categoryName}: ${error?.response?.data?.error || 'delete failed'}`);
        }
      }

      if (deletedIds.length) {
        const updatedMenuCategories = categories.filter((category) => !deletedIds.includes(String(category.id || category._id)));

        if (updatedMenuCategories.length !== categories.length) {
          await axios.post('/api/store/category-menu', { categories: updatedMenuCategories }, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setCategories(updatedMenuCategories);
        }
      }

      await fetchCategories();
      setSelectedCategoryIds((current) => current.filter((id) => !deletedIds.includes(id)));

      if (deletedIds.length) {
        toast.success(`Deleted ${deletedIds.length} system categor${deletedIds.length === 1 ? 'y' : 'ies'}`);
      }

      if (failedMessages.length) {
        toast.error(failedMessages[0]);
      }
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Failed to delete selected system categories');
    } finally {
      setDeletingBrowseSelected(false);
    }
  };

  const handleSelectAllBrowseCategories = () => {
    setSelectedCategoryIds((current) => {
      const allSelected = browseVisibleCategoryIds.length > 0 && browseVisibleCategoryIds.every((id) => current.includes(id));
      if (allSelected) {
        return current.filter((id) => !browseVisibleCategoryIds.includes(id));
      }

      return Array.from(new Set([...current, ...browseVisibleCategoryIds]));
    });
  };

  const handleSelectAllMenuCategories = () => {
    setSelectedMenuCategoryIds((current) => {
      const allSelected = categories.length > 0 && categories.every((category) => current.includes(getMenuCategoryIdentifier(category)));
      if (allSelected) {
        return [];
      }

      return categories.map((category) => getMenuCategoryIdentifier(category));
    });
  };

  const handleDeleteSelectedCategories = async () => {
    if (!selectedMenuCategoryIds.length) {
      toast.error('Select categories to delete');
      return;
    }

    if (!confirm(`Delete ${selectedMenuCategoryIds.length} selected categor${selectedMenuCategoryIds.length === 1 ? 'y' : 'ies'}?`)) {
      return;
    }

    try {
      setDeletingSelected(true);
      const token = await getToken();
      const updatedCategories = categories.filter(
        (category) => !selectedMenuCategoryIds.includes(getMenuCategoryIdentifier(category))
      );

      await axios.post('/api/store/category-menu', { categories: updatedCategories }, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setCategories(updatedCategories);
      setSelectedMenuCategoryIds([]);
      toast.success('Selected categories deleted');
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Failed to delete selected categories');
    } finally {
      setDeletingSelected(false);
    }
  };

  const filteredExistingCategories = existingCategories.filter(cat =>
    cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cat.slug?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const hierarchicalCategories = buildCategoryTree(filteredExistingCategories);
  const categoryOptions = flattenCategoryOptions(buildCategoryTree(existingCategories));
  const editingMenuCategory = editingIdx !== null ? categories[editingIdx] : null;
  const selectableParentOptions = categoryOptions.filter((category) => category.id !== String(editingMenuCategory?.systemCategoryId || ''));
  const browseVisibleCategoryIds = flattenCategoryIds(hierarchicalCategories);
  const selectedCategorySet = new Set(selectedCategoryIds);
  const selectedMenuCategorySet = new Set(selectedMenuCategoryIds);
  const allBrowseVisibleSelected = browseVisibleCategoryIds.length > 0 && browseVisibleCategoryIds.every((id) => selectedCategorySet.has(id));
  const allMenuCategoriesSelected = categories.length > 0 && categories.every((category) => selectedMenuCategorySet.has(getMenuCategoryIdentifier(category)));

  const openSystemCategory = (category) => {
    setFormData({
      name: category.name,
      image: category.image || '',
      url: buildSystemCategoryMenuUrl(category),
      parentId: category.parentId || '',
    });
    setImagePreview(category.image || '');
    setShowForm(true);
    setActiveTab('my-categories');
  };

  const renderSystemCategoryNode = (category, depth = 0) => {
    const meta = getCategoryLevelMeta(depth);
    const isSelected = selectedCategorySet.has(String(category._id));
    const hasChildren = Array.isArray(category.children) && category.children.length > 0;

    return (
      <div key={String(category._id)} className={`rounded-2xl border shadow-sm ${meta.cardClassName} ${isSelected ? 'ring-2 ring-blue-100 border-blue-500' : ''}`}>
        <div className="p-5">
          <div className="flex items-start gap-4">
            <button
              type="button"
              onClick={() => toggleCategorySelection(String(category._id))}
              className={`mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border-2 transition ${
                isSelected
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-slate-300 bg-white text-transparent hover:border-blue-400'
              }`}
              aria-label={`Select ${category.name}`}
            >
              <FiCheckCircle size={14} />
            </button>

            <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl border border-white/70 bg-white shadow-sm">
              {category.image && (
                <img
                  src={category.image}
                  alt={category.name}
                  className="h-full w-full object-cover"
                />
              )}
              <div className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.badgeClassName}`}>
                {meta.label}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className={`font-bold text-slate-900 ${depth === 0 ? 'text-2xl' : depth === 1 ? 'text-xl' : 'text-lg'}`}>{category.name}</h3>
                  {category.slug && (
                    <p className="mt-2 inline-block rounded-lg bg-white px-3 py-1 text-xs font-mono text-slate-700">
                      Slug: {category.slug}
                    </p>
                  )}
                  {category.description && (
                    <p className="mt-2 text-sm text-slate-600">{category.description}</p>
                  )}
                  <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {hasChildren
                      ? `${meta.label} with ${category.children.length} nested ${category.children.length === 1 ? 'category' : 'categories'}`
                      : `${meta.label} with no nested categories`}
                  </p>
                </div>

                <div className="flex flex-col gap-2 lg:items-end">
                  <button
                    type="button"
                    onClick={() => toggleCategorySelection(String(category._id))}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                      isSelected
                        ? meta.selectClassName
                        : 'border border-white/80 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {isSelected ? 'Selected' : 'Select'}
                  </button>
                  <button
                    type="button"
                    onClick={() => openSystemCategory(category)}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${meta.useClassName}`}
                  >
                    <span className="flex items-center gap-2">
                      <FiCheckCircle />
                      Use
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {hasChildren ? (
          <div className="border-t border-white/70 bg-white/70 p-4">
            <div className="space-y-4 pl-2 md:pl-6">
              {category.children.map((child) => renderSystemCategoryNode(child, depth + 1))}
            </div>
          </div>
        ) : (
          <div className="border-t border-white/70 bg-white/70 px-4 py-5 text-center text-sm italic text-slate-500">
            No nested categories
          </div>
        )}
      </div>
    );
  };

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

                <button
                  type="button"
                  onClick={handleSelectAllMenuCategories}
                  disabled={!categories.length}
                  className="w-full md:w-auto flex items-center justify-center gap-3 px-8 py-4 bg-white text-slate-800 rounded-xl border border-slate-200 hover:shadow-lg transition-all duration-200 font-semibold text-lg disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {allMenuCategoriesSelected ? 'Unselect All' : 'Select All'}
                </button>

                <button
                  type="button"
                  onClick={handleDeleteSelectedCategories}
                  disabled={!selectedMenuCategoryIds.length || deletingSelected}
                  className="w-full md:w-auto flex items-center justify-center gap-3 px-8 py-4 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all duration-200 font-semibold text-lg disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {deletingSelected ? 'Deleting...' : `Delete Selected${selectedMenuCategoryIds.length ? ` (${selectedMenuCategoryIds.length})` : ''}`}
                </button>
              </div>

              <div className="max-w-xl rounded-2xl border border-blue-100 bg-white/80 px-5 py-4 text-sm text-slate-600 shadow-sm">
                <p className="font-semibold text-slate-900">Spreadsheet import</p>
                <p className="mt-1">Supported columns: Name, Slug, Description, Image or Image URL, URL, Parent, Parent Slug, Parent ID, Category Path, Main Category, Subcategory, Sub Subcategory, Level 1-6, Include In Menu, Legacy Source ID.</p>
                <p className="mt-2 text-xs text-slate-500">Use either a single Category Path like Home &gt; Decor &gt; Lamps, or separate hierarchy columns like Main Category, Subcategory, and Sub Subcategory.</p>
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

                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">
                        Parent Category
                      </label>
                      <select
                        value={formData.parentId}
                        onChange={(e) => setFormData((prev) => ({ ...prev, parentId: e.target.value }))}
                        className="w-full px-5 py-3 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition text-slate-900"
                      >
                        <option value="">None (top-level category)</option>
                        {selectableParentOptions.map((category) => (
                          <option key={category.id} value={category.id}>
                            {`${'-- '.repeat(category.depth)}${category.name}`}
                          </option>
                        ))}
                      </select>
                      <p className="mt-2 text-xs text-slate-500">
                        Choose a parent to make this a subcategory or grandchild category.
                      </p>
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
                  <div key={idx} className={`group bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border ${selectedMenuCategorySet.has(getMenuCategoryIdentifier(cat)) ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-100'}`}>
                    {/* Image */}
                    <div className="relative h-48 overflow-hidden bg-slate-100">
                      <button
                        type="button"
                        onClick={() => toggleMenuCategorySelection(getMenuCategoryIdentifier(cat))}
                        className={`absolute left-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-md border-2 shadow-sm transition ${
                          selectedMenuCategorySet.has(getMenuCategoryIdentifier(cat))
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : 'border-white/80 bg-white text-transparent hover:border-blue-300'
                        }`}
                        aria-label={`Select ${cat.name}`}
                      >
                        <FiCheckCircle size={16} />
                      </button>
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
                      <p className="text-xs text-slate-500 mb-2 line-clamp-1">
                        {cat.parentName ? `Subcategory of ${cat.parentName}` : 'Top-level category'}
                      </p>
                      <p className="text-xs text-blue-600 mb-4 line-clamp-1 font-mono bg-blue-50 p-2 rounded-lg">{cat.url}</p>

                      <button
                        type="button"
                        onClick={() => toggleMenuCategorySelection(getMenuCategoryIdentifier(cat))}
                        className={`mb-4 w-full rounded-lg py-2 text-sm font-semibold transition ${
                          selectedMenuCategorySet.has(getMenuCategoryIdentifier(cat))
                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                            : 'border border-blue-200 text-blue-600 hover:bg-blue-50'
                        }`}
                      >
                        {selectedMenuCategorySet.has(getMenuCategoryIdentifier(cat)) ? 'Selected' : 'Select'}
                      </button>

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
            <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">Select system categories</p>
                <p className="mt-1 text-xs text-slate-500">Choose categories here, then add all selected items to your store in one step.</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <span className="rounded-full bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                  {selectedCategoryIds.length} selected
                </span>
                <button
                  type="button"
                  onClick={handleSelectAllBrowseCategories}
                  disabled={!browseVisibleCategoryIds.length || addingSelected}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {allBrowseVisibleSelected ? 'Unselect All' : 'Select All'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategoryIds([])}
                  disabled={!selectedCategoryIds.length || addingSelected}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={handleAddSelectedCategories}
                  disabled={!selectedCategoryIds.length || addingSelected || deletingBrowseSelected}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {addingSelected ? 'Adding...' : 'Add Selected'}
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSelectedSystemCategories}
                  disabled={!selectedCategoryIds.length || deletingBrowseSelected || addingSelected}
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deletingBrowseSelected ? 'Deleting...' : 'Delete Selected'}
                </button>
              </div>
            </div>

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
                {hierarchicalCategories.map((category) => renderSystemCategoryNode(category))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
