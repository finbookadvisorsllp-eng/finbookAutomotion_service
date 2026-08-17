import React, { useState, useEffect, useMemo } from 'react';
import { 
  FolderTree, Search, ChevronDown, Check, ArrowLeft, Save, 
  CheckCircle2, AlertCircle, Settings, X
} from 'lucide-react';
import { toast } from 'sonner';

/**
 * StockCategoryMasterForm
 * Component for creating and editing Stock Categories in the Masters module.
 * Takes full screen width and includes a [ Configure Form ] modal for toggling form sections.
 */
export default function StockCategoryMasterForm({
  initialData = null,
  isEdit = false,
  stockCategoriesList = [],
  onSave,
  onClose
}) {
  // Configure Form Modal Preferences (Persisted in localStorage)
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [config, setConfig] = useState(() => {
    const saved = localStorage.getItem('stock_category_form_config');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      cfgCategoryCode: true,
      cfgParentCategory: true
    };
  });

  useEffect(() => {
    localStorage.setItem('stock_category_form_config', JSON.stringify(config));
  }, [config]);

  // Form State
  const [formData, setFormData] = useState({
    stockCategoryName: '',
    stockCategoryCode: '',
    parentCategory: 'Primary / Root Category',
    status: 'ACTIVE'
  });

  // Parent Category Search State
  const [parentSearchQuery, setParentSearchQuery] = useState('');
  const [showParentDropdown, setShowParentDropdown] = useState(false);

  // Errors
  const [errors, setErrors] = useState({});

  // Pre-fill on Edit / Auto-generate code on Create
  useEffect(() => {
    if (isEdit && initialData) {
      setFormData({
        stockCategoryName: initialData.stockCategoryName || initialData.name || '',
        stockCategoryCode: initialData.stockCategoryCode || initialData.code || '',
        parentCategory: initialData.parentCategory || initialData.parentName || 'Primary / Root Category',
        status: (initialData.status || 'ACTIVE').toUpperCase()
      });
    } else {
      const nextNum = (stockCategoriesList.length + 1).toString().padStart(4, '0');
      setFormData(prev => ({
        ...prev,
        stockCategoryCode: `SCAT-${nextNum}`
      }));
    }
  }, [isEdit, initialData, stockCategoriesList.length]);

  // Field Update Helper
  const updateField = (key, val) => {
    setFormData(prev => ({ ...prev, [key]: val }));
    if (errors[key]) {
      setErrors(prev => ({ ...prev, [key]: null }));
    }
  };

  // Validation
  const validate = () => {
    const newErrors = {};
    const trimmedName = formData.stockCategoryName.trim();

    if (!trimmedName) {
      newErrors.stockCategoryName = 'Stock Category Name is required';
    } else {
      const duplicate = stockCategoriesList.find(c => {
        const cName = (c.stockCategoryName || c.name || '').trim().toLowerCase();
        const currentId = initialData?.id || initialData?.sr;
        const itemObjId = c.id || c.sr;
        return cName === trimmedName.toLowerCase() && currentId !== itemObjId;
      });

      if (duplicate) {
        newErrors.stockCategoryName = 'A Stock Category with this name already exists';
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

    const parentName = formData.parentCategory === 'Primary / Root Category' || formData.parentCategory === 'Primary' ? 'Primary' : formData.parentCategory;
    const parentObj = stockCategoriesList.find(c => (c.stockCategoryName || c.name) === parentName);

    const level = parentName === 'Primary' ? 1 : (parentObj?.level ? parentObj.level + 1 : 2);
    const categoryPath = parentName === 'Primary' 
      ? `Primary > ${formData.stockCategoryName.trim()}`
      : `${parentObj?.categoryPath || ('Primary > ' + parentName)} > ${formData.stockCategoryName.trim()}`;

    const payload = {
      _id: initialData?._id || initialData?.id,
      id: initialData?._id || initialData?.id,
      sourceCollection: initialData?.sourceCollection || 'stockcategories_entry',
      stockCategoryName: formData.stockCategoryName.trim(),
      stockCategoryCode: formData.stockCategoryCode.trim(),
      parentCategory: parentName,
      parentName: parentName,
      categoryPath: categoryPath,
      level: level,
      status: formData.status
    };

    onSave(payload);
    toast.success(isEdit ? 'Stock Category updated successfully!' : 'Stock Category created successfully!');
  };

  // Filter Parent Category Options
  const filteredParents = useMemo(() => {
    const available = stockCategoriesList.filter(c => {
      const cName = c.stockCategoryName || c.name || '';
      return !isEdit || cName.toLowerCase() !== formData.stockCategoryName.toLowerCase();
    });

    const q = parentSearchQuery.toLowerCase().trim();
    if (!q) return ['Primary / Root Category', ...available.map(c => c.stockCategoryName || c.name)];
    
    const matches = available
      .map(c => c.stockCategoryName || c.name)
      .filter(n => n.toLowerCase().includes(q));
    
    return ['Primary / Root Category', ...matches];
  }, [stockCategoriesList, parentSearchQuery, isEdit, formData.stockCategoryName]);

  return (
    <div className="h-full w-full flex flex-col bg-[var(--app-content-bg)] text-[var(--app-text)] font-sans overflow-hidden animate-in fade-in duration-300">
      
      {/* 1. Header Navigation Bar (Full Width) */}
      <div className="shrink-0 px-6 py-3.5 border-b border-[var(--app-border)] bg-[var(--app-panel-bg)] flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg border border-[var(--app-border)] hover:bg-[var(--app-control-hover)] text-[var(--app-text)] transition-colors"
            title="Back to Stock Categories List"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--app-muted)]">
              <span>Masters</span>
              <span>/</span>
              <span>Stock Category</span>
              <span>/</span>
              <span className="text-[var(--app-accent)] font-bold">{isEdit ? 'Edit' : 'Create'}</span>
            </div>
            <h1 className="text-base md:text-xl font-extrabold text-[var(--app-heading)] tracking-tight">
              {isEdit ? 'Edit Stock Category Master' : 'Create Stock Category Master'}
            </h1>
          </div>
        </div>

        {/* Header Action Controls */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowConfigModal(true)}
            className="px-3.5 py-1.5 rounded-lg border border-[var(--app-accent-soft)] bg-[var(--app-accent-soft)] text-[var(--app-accent)] hover:opacity-90 transition-all text-xs font-bold flex items-center gap-1.5 shadow-2xs"
            title="Configure visible form sections and settings"
          >
            <Settings size={14} />
            <span>Configure Form</span>
          </button>
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
            className="px-4 py-1.5 rounded-lg bg-[var(--app-accent)] text-white text-xs font-bold shadow-xs hover:opacity-90 transition-all flex items-center gap-1.5"
          >
            <CheckCircle2 size={14} />
            <span>{isEdit ? 'Update Category' : 'Save Category'}</span>
          </button>
        </div>
      </div>

      {/* 2. Full Width Form Body */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-6 w-full space-y-5">
        
        {/* BASIC INFORMATION */}
        <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2.5">
            <div className="flex items-center gap-2 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
              <FolderTree size={15} />
              <span>BASIC CATEGORY DETAILS</span>
            </div>
            <span className="text-[10px] font-semibold text-[var(--app-muted)]">* Required fields</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            
            {/* Stock Category Name * */}
            <div className="md:col-span-2 space-y-1">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                Stock Category Name <span className="text-red-500">*</span>
              </label>
              <input
                autoFocus
                type="text"
                value={formData.stockCategoryName}
                onChange={(e) => updateField('stockCategoryName', e.target.value)}
                placeholder="e.g. Dell, HP, Small, Medium, Red, Blue, Electronics"
                className={`w-full h-9.5 rounded-lg border bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] outline-none transition-all ${
                  errors.stockCategoryName 
                    ? 'border-red-500 focus:border-red-500 ring-1 ring-red-500/20' 
                    : 'border-[var(--app-border)] focus:border-[var(--app-accent)]'
                }`}
              />
              {errors.stockCategoryName && (
                <p className="text-[10px] font-bold text-red-500 flex items-center gap-1 mt-0.5">
                  <AlertCircle size={11} />
                  <span>{errors.stockCategoryName}</span>
                </p>
              )}
            </div>

            {/* Stock Category Code (Rendered if active in Configure Form) */}
            {config.cfgCategoryCode && (
              <div className="space-y-1 animate-in fade-in duration-200">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                  Stock Category Code
                </label>
                <input
                  type="text"
                  value={formData.stockCategoryCode}
                  onChange={(e) => updateField('stockCategoryCode', e.target.value.toUpperCase())}
                  placeholder="e.g. SCAT-0001"
                  className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-mono font-bold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] transition-all"
                />
              </div>
            )}

            {/* Status */}
            <div className="space-y-1">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => updateField('status', e.target.value)}
                className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2.5 text-xs font-bold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] transition-all"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>

            {/* Under / Parent Stock Category (Rendered if active in Configure Form) */}
            {config.cfgParentCategory && (
              <div className="md:col-span-4 space-y-1 relative animate-in fade-in duration-200">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                  Under / Parent Stock Category
                </label>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowParentDropdown(p => !p)}
                    className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] flex items-center justify-between outline-none hover:border-[var(--app-accent)] transition-all"
                  >
                    <span className="truncate">{formData.parentCategory}</span>
                    <ChevronDown size={14} className="text-[var(--app-muted)] shrink-0" />
                  </button>

                  {showParentDropdown && (
                    <div className="absolute left-0 right-0 top-10 z-30 rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] shadow-xl p-2 space-y-2">
                      <div className="relative">
                        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--app-muted)]" />
                        <input
                          type="text"
                          value={parentSearchQuery}
                          onChange={(e) => setParentSearchQuery(e.target.value)}
                          placeholder="Search parent stock category..."
                          className="w-full h-7.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] pl-7 pr-2 text-xs text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                        />
                      </div>

                      <div className="max-h-40 overflow-y-auto no-scrollbar space-y-0.5">
                        {filteredParents.map(parentName => (
                          <button
                            key={parentName}
                            type="button"
                            onClick={() => {
                              updateField('parentCategory', parentName);
                              setShowParentDropdown(false);
                              setParentSearchQuery('');
                            }}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                              formData.parentCategory === parentName 
                                ? 'bg-[var(--app-accent-soft)] text-[var(--app-accent)] font-bold' 
                                : 'hover:bg-[var(--app-control-hover)] text-[var(--app-text)]'
                            }`}
                          >
                            <span>{parentName}</span>
                            {formData.parentCategory === parentName && <Check size={12} />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>

      </div>

      {/* 3. Sticky Bottom Action Bar */}
      <div className="shrink-0 px-6 py-3.5 border-t border-[var(--app-border)] bg-[var(--app-panel-bg)] flex items-center justify-between shadow-lg">
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
          className="px-5 py-2 rounded-lg bg-[var(--app-accent)] text-white text-xs font-bold shadow-sm hover:opacity-90 transition-all flex items-center gap-1.5"
        >
          <CheckCircle2 size={14} />
          <span>{isEdit ? 'Update Category' : 'Save Category'}</span>
        </button>
      </div>

      {/* 4. CONFIGURE FORM MODAL DIALOG */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-3">
              <div className="flex items-center gap-2 text-[var(--app-heading)] font-extrabold text-sm">
                <Settings size={16} className="text-[var(--app-accent)]" />
                <span>Configure Stock Category Form</span>
              </div>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="p-1 rounded-lg border border-[var(--app-border)] hover:bg-[var(--app-control-hover)] text-[var(--app-muted)] hover:text-[var(--app-heading)]"
              >
                <X size={15} />
              </button>
            </div>

            <p className="text-xs text-[var(--app-muted)]">
              Enable or disable optional form fields. Active items will render directly on the form UI.
            </p>

            <div className="space-y-2 text-xs">
              <label className="flex items-center justify-between p-2.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-control-bg)] hover:bg-[var(--app-control-hover)] cursor-pointer">
                <span className="font-semibold text-[var(--app-heading)]">Category Code Field</span>
                <input
                  type="checkbox"
                  checked={config.cfgCategoryCode}
                  onChange={(e) => setConfig(prev => ({ ...prev, cfgCategoryCode: e.target.checked }))}
                  className="w-4 h-4 rounded accent-[var(--app-accent)]"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-control-bg)] hover:bg-[var(--app-control-hover)] cursor-pointer">
                <span className="font-semibold text-[var(--app-heading)]">Parent Stock Category Field</span>
                <input
                  type="checkbox"
                  checked={config.cfgParentCategory}
                  onChange={(e) => setConfig(prev => ({ ...prev, cfgParentCategory: e.target.checked }))}
                  className="w-4 h-4 rounded accent-[var(--app-accent)]"
                />
              </label>
            </div>

            <div className="pt-3 border-t border-[var(--app-border)] flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowConfigModal(false);
                  toast.success('Form settings updated successfully!');
                }}
                className="px-4 py-2 rounded-xl bg-[var(--app-accent)] text-white text-xs font-bold shadow-xs hover:opacity-90 transition-all"
              >
                Apply Settings
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
