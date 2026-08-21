import React, { useState, useEffect, useMemo } from 'react';
import { 
  FolderTree, ArrowLeft, CheckCircle2, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

// Helper to check circular parent relationships in Stock Categories
const isCircularParentCategory = (selectedParentName, currentCategoryName, stockCategoriesList) => {
  if (!selectedParentName || !currentCategoryName || selectedParentName === 'Primary' || selectedParentName === 'Primary / Root Category') {
    return false;
  }
  
  if (selectedParentName.toLowerCase().trim() === currentCategoryName.toLowerCase().trim()) {
    return true; // Self-parent
  }

  let curr = selectedParentName;
  const visited = new Set();

  while (curr && curr !== 'Primary' && curr !== 'Primary / Root Category') {
    if (curr.toLowerCase().trim() === currentCategoryName.toLowerCase().trim()) {
      return true; // Circular dependency detected!
    }
    if (visited.has(curr.toLowerCase().trim())) {
      break;
    }
    visited.add(curr.toLowerCase().trim());

    const parentObj = (stockCategoriesList || []).find(c => 
      (c.stockCategoryName || c.categoryName || c.name || '').toLowerCase().trim() === curr.toLowerCase().trim()
    );
    if (!parentObj) break;

    curr = parentObj.parentCategory || parentObj.parentCategoryName || parentObj.parentName || 'Primary';
  }

  return false;
};

/**
 * StockCategoryMasterForm
 * Universal, Tally Prime-style Stock Category Master form.
 */
export default function StockCategoryMasterForm({
  initialData = null,
  isEdit = false,
  stockCategoriesList = [],
  onSave,
  onClose
}) {
  // Form State
  const [formData, setFormData] = useState(() => {
    if (initialData) {
      const pName = initialData.parentCategory || initialData.parentCategoryName || initialData.parentName || 'Primary';
      return {
        stockCategoryName: initialData.stockCategoryName || initialData.categoryName || initialData.name || '',
        alias: initialData.alias || (Array.isArray(initialData.nameAliases) ? initialData.nameAliases[0] : '') || '',
        parentCategory: pName === 'Primary / Root Category' ? 'Primary' : pName,
        status: (initialData.status || 'Active').toLowerCase() === 'inactive' ? 'Inactive' : 'Active'
      };
    }

    return {
      stockCategoryName: '',
      alias: '',
      parentCategory: 'Primary',
      status: 'Active'
    };
  });

  const [errors, setErrors] = useState({});

  // Parent Category Options
  const parentCategoryOptions = useMemo(() => {
    const set = new Set(['Primary']);
    (stockCategoriesList || []).forEach(c => {
      const name = c.stockCategoryName || c.categoryName || c.name;
      if (name && typeof name === 'string' && name.trim() && name !== 'Primary') {
        set.add(name.trim());
      }
    });
    return Array.from(set).sort();
  }, [stockCategoriesList]);

  // Update Field Helper
  const updateField = (key, val) => {
    setFormData(prev => ({ ...prev, [key]: val }));
    if (errors[key]) {
      setErrors(prev => ({ ...prev, [key]: null }));
    }
  };

  // Validation
  const validate = () => {
    const newErrors = {};
    const cleanName = formData.stockCategoryName.trim();
    const currentId = initialData?._id || initialData?.id;

    if (!cleanName) {
      newErrors.stockCategoryName = 'Stock Category Name is required';
    } else {
      // Case-insensitive duplicate check within company
      const duplicate = (stockCategoriesList || []).find(c => {
        if (!c) return false;
        const cId = c._id || c.id;
        if (currentId && cId && String(cId) === String(currentId)) return false;

        const existingName = (c.stockCategoryName || c.categoryName || c.name || '').trim().toLowerCase();
        return existingName === cleanName.toLowerCase();
      });

      if (duplicate) {
        newErrors.stockCategoryName = `Stock Category "${cleanName}" already exists`;
      }
    }

    // Check Self & Circular Parent
    if (formData.parentCategory && formData.parentCategory !== 'Primary') {
      if (isEdit && formData.parentCategory.toLowerCase().trim() === cleanName.toLowerCase()) {
        newErrors.parentCategory = 'A Stock Category cannot be its own parent';
      } else if (isEdit && isCircularParentCategory(formData.parentCategory, cleanName, stockCategoriesList)) {
        newErrors.parentCategory = `Selecting "${formData.parentCategory}" creates a circular parent relationship`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit Handler
  const handleSubmit = (e) => {
    if (e) e.preventDefault();

    if (!validate()) {
      toast.error('Please fix validation errors before saving.');
      return;
    }

    const parentName = formData.parentCategory === 'Primary / Root Category' || !formData.parentCategory ? 'Primary' : formData.parentCategory;
    const parentObj = (stockCategoriesList || []).find(c => (c.stockCategoryName || c.categoryName || c.name) === parentName);

    const level = parentName === 'Primary' ? 1 : (parentObj?.level ? parentObj.level + 1 : 2);
    const categoryPath = parentName === 'Primary'
      ? `Primary > ${formData.stockCategoryName.trim()}`
      : `${parentObj?.categoryPath || ('Primary > ' + parentName)} > ${formData.stockCategoryName.trim()}`;

    const payload = {
      _id: initialData?._id || initialData?.id,
      id: initialData?._id || initialData?.id,
      sourceCollection: initialData?.sourceCollection || 'stockcategories_entry',

      stockCategoryName: formData.stockCategoryName.trim(),
      categoryName: formData.stockCategoryName.trim(),
      name: formData.stockCategoryName.trim(),
      alias: formData.alias.trim(),
      parentCategory: parentName,
      parentCategoryName: parentName,
      parentName: parentName,
      categoryPath: categoryPath,
      level: level,
      status: formData.status
    };

    if (onSave) {
      onSave(payload);
      toast.success(isEdit ? `Stock Category "${formData.stockCategoryName}" updated!` : `Stock Category "${formData.stockCategoryName}" created!`);
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-[var(--app-panel-bg)] text-[var(--app-text)] font-sans overflow-hidden animate-in fade-in duration-200">
      
      {/* Top Header Bar */}
      <div className="shrink-0 px-5 py-3 border-b border-[var(--app-border)] bg-[var(--app-panel-bg)] flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg border border-[var(--app-border)] hover:bg-[var(--app-control-hover)] text-[var(--app-text)] transition-colors shrink-0"
            title="Back to Stock Categories List"
          >
            <ArrowLeft size={15} />
          </button>
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--app-muted)]">
              <span>Stock Categories</span>
              <span>/</span>
              <span className="text-[var(--app-accent)]">{isEdit ? 'Edit Category' : 'New Category'}</span>
            </div>
            <h1 className="text-base font-extrabold text-[var(--app-heading)] tracking-tight">
              {isEdit ? `Edit: ${formData.stockCategoryName || 'Category'}` : 'Create Stock Category'}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg border border-[var(--app-border)] text-xs font-semibold text-[var(--app-text)] hover:bg-[var(--app-control-hover)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-4 py-1.5 rounded-lg bg-[var(--app-accent)] text-white text-xs font-bold shadow-xs hover:opacity-90 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <CheckCircle2 size={14} />
            <span>{isEdit ? 'Update Category' : 'Save Category'}</span>
          </button>
        </div>
      </div>

      {/* Main Form Body */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 flex justify-center">
        <form onSubmit={handleSubmit} className="w-full max-w-xl space-y-4">
          
          {/* Card: Basic Information */}
          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-4 md:p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-[var(--app-border)] pb-2.5 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
              <FolderTree size={15} />
              <span>Category Details</span>
            </div>

            {/* Row 1: Category Name & Alias */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                  Category Name <span className="text-rose-500">*</span>
                </label>
                <input
                  autoFocus
                  type="text"
                  value={formData.stockCategoryName}
                  onChange={(e) => updateField('stockCategoryName', e.target.value)}
                  placeholder="e.g. Premium, 5G, Budget, Imported, High End"
                  className={`w-full h-9 rounded-lg border bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] outline-none transition-all ${
                    errors.stockCategoryName 
                      ? 'border-rose-500 focus:border-rose-500 ring-1 ring-rose-500/20' 
                      : 'border-[var(--app-border)] focus:border-[var(--app-accent)]'
                  }`}
                />
                {errors.stockCategoryName && (
                  <p className="text-[10px] font-bold text-rose-500 mt-0.5 flex items-center gap-1">
                    <AlertCircle size={11} />
                    <span>{errors.stockCategoryName}</span>
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] flex items-center justify-between">
                  <span>Alias</span>
                  <span className="text-[9px] text-[var(--app-muted)]">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.alias}
                  onChange={(e) => updateField('alias', e.target.value)}
                  placeholder="e.g. PREM"
                  className="w-full h-9 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                />
              </div>
            </div>

            {/* Row 2: Under Category & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                  Parent Category <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.parentCategory}
                  onChange={(e) => updateField('parentCategory', e.target.value)}
                  className={`w-full h-9 rounded-lg border bg-[var(--app-control-bg)] px-2.5 text-xs font-bold text-[var(--app-heading)] outline-none transition-all cursor-pointer ${
                    errors.parentCategory ? 'border-rose-500' : 'border-[var(--app-border)] focus:border-[var(--app-accent)]'
                  }`}
                >
                  <option value="Primary">Primary (Root Level Category)</option>
                  {parentCategoryOptions
                    .filter(c => c !== 'Primary' && (!isEdit || c.toLowerCase().trim() !== formData.stockCategoryName.toLowerCase().trim()))
                    .map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                </select>
                {errors.parentCategory && (
                  <p className="text-[10px] font-bold text-rose-500 mt-0.5">{errors.parentCategory}</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => updateField('status', e.target.value)}
                  className="w-full h-9 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2.5 text-xs font-bold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] cursor-pointer"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>
          </div>

        </form>
      </div>

      {/* Sticky Bottom Action Bar */}
      <div className="shrink-0 px-5 py-3 border-t border-[var(--app-border)] bg-[var(--app-panel-bg)] flex items-center justify-between shadow-lg">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-lg border border-[var(--app-border)] text-xs font-semibold text-[var(--app-text)] hover:bg-[var(--app-control-hover)] transition-colors"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={handleSubmit}
          className="px-5 py-2 rounded-lg bg-[var(--app-accent)] text-white text-xs font-bold shadow-sm hover:opacity-90 transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <CheckCircle2 size={14} />
          <span>{isEdit ? 'Update Stock Category' : 'Save Stock Category'}</span>
        </button>
      </div>

    </div>
  );
}
