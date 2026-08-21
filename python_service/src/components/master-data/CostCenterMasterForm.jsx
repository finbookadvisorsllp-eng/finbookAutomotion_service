import React, { useState, useEffect, useMemo } from 'react';
import { 
  Layers, Plus, X, Search, ChevronDown, Check, ArrowLeft, Save, 
  CheckCircle2, FolderTree, AlertCircle, Sparkles, Building2, Settings, ToggleLeft, ToggleRight
} from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '../../lib/apiClient';

export default function CostCenterMasterForm({
  initialData = null,
  isEdit = false,
  costCategories = ['Primary Cost Category'],
  costCentersList = [],
  onSave,
  onClose,
  onAddCostCategory
}) {
  // Configure Form Preferences (Persisted in localStorage)
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [config, setConfig] = useState(() => {
    const saved = localStorage.getItem('cost_center_form_config');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      cfgAlias: false,
      cfgDescription: false,
      cfgParentCostCenter: true,
      cfgCostCategory: true
    };
  });

  useEffect(() => {
    localStorage.setItem('cost_center_form_config', JSON.stringify(config));
  }, [config]);

  // Form State
  const [formData, setFormData] = useState({
    costCenterName: '',
    costCenterCode: '',
    alias: '',
    description: '',
    costCategoryId: 'Primary Cost Category',
    parentId: 'Primary / None',
    isActive: true
  });

  // Inline Quick Add Category Modal State
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  // Parent Search State
  const [parentSearchQuery, setParentSearchQuery] = useState('');
  const [showParentDropdown, setShowParentDropdown] = useState(false);

  // Errors
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Check if multiple Cost Categories exist (Conditional Display Logic)
  const hasMultipleCostCategories = useMemo(() => {
    if (!costCategories || costCategories.length <= 1) return false;
    const nonDefault = costCategories.filter(c => c && c.trim().toLowerCase() !== 'primary cost category');
    return nonDefault.length > 0;
  }, [costCategories]);

  // Pre-fill on Edit / Auto-generate code on Create
  useEffect(() => {
    if (isEdit && initialData) {
      const activeState = initialData.isActive !== undefined 
        ? !!initialData.isActive 
        : (initialData.status || 'ACTIVE').toUpperCase() === 'ACTIVE';

      setFormData({
        costCenterName: initialData.costCenterName || initialData.name || '',
        costCenterCode: initialData.costCenterCode || initialData.code || '',
        alias: initialData.alias || '',
        description: initialData.description || '',
        costCategoryId: initialData.costCategoryId || initialData.costCategoryName || initialData.category || 'Primary Cost Category',
        parentId: initialData.parentId || initialData.parentName || 'Primary / None',
        isActive: activeState
      });
    } else {
      const nextNum = (costCentersList.length + 1).toString().padStart(4, '0');
      setFormData(prev => ({
        ...prev,
        costCenterCode: `CC-${nextNum}`
      }));
    }
  }, [isEdit, initialData, costCentersList.length]);

  // Field Update Helper
  const updateField = (key, val) => {
    setFormData(prev => ({ ...prev, [key]: val }));
    if (errors[key]) {
      setErrors(prev => ({ ...prev, [key]: null }));
    }
  };

  // Inline Category Add Handler
  const handleCreateCategory = (e) => {
    if (e) e.preventDefault();
    const name = newCategoryName.trim();
    if (!name) {
      toast.error('Category Name is required.');
      return;
    }
    if (costCategories.some(c => c.toLowerCase() === name.toLowerCase())) {
      toast.error('Cost Category already exists.');
      return;
    }

    if (onAddCostCategory) {
      onAddCostCategory(name);
    }
    updateField('costCategoryId', name);
    setNewCategoryName('');
    setShowAddCategoryModal(false);
    toast.success(`Cost Category "${name}" created & selected!`);
  };

  // Validation
  const validate = () => {
    const newErrors = {};
    const trimmedName = formData.costCenterName.trim();

    if (!trimmedName) {
      newErrors.costCenterName = 'Cost Center Name is required';
    } else {
      const duplicate = costCentersList.find(c => {
        const cName = (c.costCenterName || c.name || '').trim().toLowerCase();
        const currentId = initialData?._id || initialData?.id || initialData?.sr;
        const itemObjId = c._id || c.id || c.sr;
        return cName === trimmedName.toLowerCase() && currentId !== itemObjId;
      });

      if (duplicate) {
        newErrors.costCenterName = 'A Cost Center with this name already exists';
      }
    }

    if (formData.parentId && formData.parentId !== 'Primary / None') {
      if (formData.parentId.trim().toLowerCase() === trimmedName.toLowerCase()) {
        newErrors.parentId = 'A Cost Center cannot be its own parent';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit Handler
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    if (!validate()) {
      toast.error('Please fix validation errors before saving.');
      return;
    }

    setSaving(true);
    try {
      const activeCompanyId = localStorage.getItem('selectedCompanyId') || localStorage.getItem('activeCompany') || '';
      const headers = activeCompanyId ? { 'x-company-id': activeCompanyId } : {};

      const payload = {
        _id: initialData?._id || initialData?.id,
        id: initialData?._id || initialData?.id,
        sourceCollection: initialData?.sourceCollection || 'costcenters_entry',
        costCenterName: formData.costCenterName.trim(),
        name: formData.costCenterName.trim(),
        costCenterCode: formData.costCenterCode.trim(),
        code: formData.costCenterCode.trim(),
        alias: formData.alias.trim(),
        description: formData.description.trim(),
        costCategoryId: (hasMultipleCostCategories && config.cfgCostCategory) ? formData.costCategoryId : 'Primary Cost Category',
        costCategoryName: (hasMultipleCostCategories && config.cfgCostCategory) ? formData.costCategoryId : 'Primary Cost Category',
        parentId: formData.parentId,
        parentName: formData.parentId,
        isActive: formData.isActive,
        status: formData.isActive ? 'ACTIVE' : 'INACTIVE',
        isWebEntry: true
      };

      if (onSave) {
        onSave(payload);
      } else {
        if (isEdit && (initialData?._id || initialData?.id)) {
          const id = initialData._id || initialData.id;
          await apiClient.put(`/masters/cost-centers/${id}`, payload, { headers });
          toast.success(`Cost Center "${formData.costCenterName}" updated successfully`);
        } else {
          await apiClient.post('/masters/cost-centers', payload, { headers });
          toast.success(`Cost Center "${formData.costCenterName}" created successfully`);
        }
      }

      if (onClose) onClose();
    } catch (err) {
      console.error('Error saving Cost Center master:', err);
      toast.error(err.response?.data?.detail || 'Failed to save Cost Center');
    } finally {
      setSaving(false);
    }
  };

  // Filter Categories
  const filteredCategories = useMemo(() => {
    const q = categorySearchQuery.toLowerCase().trim();
    if (!q) return costCategories;
    return costCategories.filter(c => c.toLowerCase().includes(q));
  }, [costCategories, categorySearchQuery]);

  // Filter Parents
  const filteredParents = useMemo(() => {
    const available = costCentersList.filter(c => {
      const cName = c.costCenterName || c.name || '';
      return !isEdit || cName.toLowerCase() !== formData.costCenterName.trim().toLowerCase();
    });

    const q = parentSearchQuery.toLowerCase().trim();
    if (!q) return ['Primary / None', ...available.map(c => c.costCenterName || c.name)];

    const matches = available
      .map(c => c.costCenterName || c.name)
      .filter(n => n.toLowerCase().includes(q));

    return ['Primary / None', ...matches];
  }, [costCentersList, parentSearchQuery, isEdit, formData.costCenterName]);

  return (
    <div className="h-full w-full flex flex-col bg-[var(--app-content-bg)] text-[var(--app-text)] font-sans overflow-hidden animate-in fade-in duration-300">
      
      {/* 1. Header Navigation Bar (Full Width) */}
      <div className="shrink-0 px-6 py-3.5 border-b border-[var(--app-border)] bg-[var(--app-panel-bg)] flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg border border-[var(--app-border)] hover:bg-[var(--app-control-hover)] text-[var(--app-text)] transition-colors"
            title="Back to Cost Centers List"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--app-muted)]">
              <span>Masters</span>
              <span>/</span>
              <span>Cost Centres</span>
              <span>/</span>
              <span className="text-[var(--app-accent)] font-bold">{isEdit ? 'Edit' : 'New'}</span>
            </div>
            <h1 className="text-base md:text-xl font-extrabold text-[var(--app-heading)] tracking-tight">
              {isEdit ? 'Edit Cost Center' : 'Create Cost Center'}
            </h1>
          </div>
        </div>

        {/* Header Action Controls */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowConfigModal(true)}
            className="px-3.5 py-1.5 rounded-lg border border-[var(--app-accent-soft)] bg-[var(--app-accent-soft)] text-[var(--app-accent)] hover:opacity-90 transition-all text-xs font-bold flex items-center gap-1.5 shadow-2xs"
            title="Configure visible form fields"
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
            disabled={saving}
            onClick={handleSubmit}
            className="px-4 py-1.5 rounded-lg bg-[var(--app-accent)] text-white text-xs font-bold shadow-xs hover:opacity-90 transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            <CheckCircle2 size={14} />
            <span>{saving ? 'Saving...' : (isEdit ? 'Update Cost Center' : 'Save Cost Center')}</span>
          </button>
        </div>
      </div>

      {/* 2. Form Body */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-6 w-full space-y-5">
        
        {/* MAIN COST CENTER DETAILS CARD */}
        <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2.5">
            <div className="flex items-center gap-2 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
              <Building2 size={15} />
              <span>Cost Center Details</span>
            </div>
            <span className="text-[10px] font-semibold text-[var(--app-muted)]">* Required fields</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            
            {/* Cost Center Name * */}
            <div className="md:col-span-2 space-y-1">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                Cost Center Name <span className="text-red-500">*</span>
              </label>
              <input
                autoFocus
                type="text"
                value={formData.costCenterName}
                onChange={(e) => updateField('costCenterName', e.target.value)}
                placeholder="e.g. Production Department, Sales, Project Alpha"
                className={`w-full h-9.5 rounded-lg border bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] outline-none transition-all ${
                  errors.costCenterName 
                    ? 'border-red-500 focus:border-red-500 ring-1 ring-red-500/20' 
                    : 'border-[var(--app-border)] focus:border-[var(--app-accent)]'
                }`}
              />
              {errors.costCenterName && (
                <p className="text-[10px] font-bold text-red-500 flex items-center gap-1 mt-0.5">
                  <AlertCircle size={11} />
                  <span>{errors.costCenterName}</span>
                </p>
              )}
            </div>

            {/* Cost Center Code (Optional) */}
            <div className="space-y-1">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                Cost Center Code
              </label>
              <input
                type="text"
                value={formData.costCenterCode}
                onChange={(e) => updateField('costCenterCode', e.target.value.toUpperCase())}
                placeholder="e.g. CC-0001"
                className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-mono font-bold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] transition-all"
              />
            </div>

            {/* Active Toggle Switch */}
            <div className="space-y-1">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                Active Status
              </label>
              <div className="flex items-center gap-2 h-9.5">
                <button
                  type="button"
                  onClick={() => updateField('isActive', !formData.isActive)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    formData.isActive ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      formData.isActive ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
                <span className={`text-xs font-extrabold ${formData.isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>
                  {formData.isActive ? 'Active (ON)' : 'Inactive (OFF)'}
                </span>
              </div>
            </div>

            {/* Under / Parent Cost Center */}
            {config.cfgParentCostCenter && (
              <div className="md:col-span-2 space-y-1 relative animate-in fade-in duration-200">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                  Under / Parent Cost Center
                </label>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowParentDropdown(p => !p)}
                    className={`w-full h-9.5 rounded-lg border bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] flex items-center justify-between outline-none hover:border-[var(--app-accent)] transition-all ${errors.parentId ? 'border-red-500' : 'border-[var(--app-border)]'}`}
                  >
                    <span className="truncate">{formData.parentId}</span>
                    <ChevronDown size={14} className="text-[var(--app-muted)] shrink-0" />
                  </button>

                  {errors.parentId && (
                    <p className="text-[10px] font-bold text-red-500 flex items-center gap-1 mt-0.5">
                      <AlertCircle size={11} />
                      <span>{errors.parentId}</span>
                    </p>
                  )}

                  {showParentDropdown && (
                    <div className="absolute left-0 right-0 top-10 z-30 rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] shadow-xl p-2 space-y-2">
                      <div className="relative">
                        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--app-muted)]" />
                        <input
                          type="text"
                          value={parentSearchQuery}
                          onChange={(e) => setParentSearchQuery(e.target.value)}
                          placeholder="Search parent cost center..."
                          className="w-full h-7.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] pl-7 pr-2 text-xs text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                        />
                      </div>

                      <div className="max-h-40 overflow-y-auto no-scrollbar space-y-0.5">
                        {filteredParents.map(parentName => (
                          <button
                            key={parentName}
                            type="button"
                            onClick={() => {
                              updateField('parentId', parentName);
                              setShowParentDropdown(false);
                              setParentSearchQuery('');
                            }}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                              formData.parentId === parentName 
                                ? 'bg-[var(--app-accent-soft)] text-[var(--app-accent)] font-bold' 
                                : 'hover:bg-[var(--app-control-hover)] text-[var(--app-text)]'
                            }`}
                          >
                            <span>{parentName}</span>
                            {formData.parentId === parentName && <Check size={12} />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Cost Category (Rendered conditionally ONLY if multiple Cost Categories exist) */}
            {hasMultipleCostCategories && config.cfgCostCategory && (
              <div className="md:col-span-2 space-y-1 relative animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                    Cost Category
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAddCategoryModal(true)}
                    className="text-[10px] font-bold text-[var(--app-accent)] hover:underline flex items-center gap-0.5"
                  >
                    <Plus size={11} />
                    <span>Add New Category</span>
                  </button>
                </div>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowCategoryDropdown(p => !p)}
                    className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] flex items-center justify-between outline-none hover:border-[var(--app-accent)] transition-all"
                  >
                    <span className="truncate">{formData.costCategoryId}</span>
                    <ChevronDown size={14} className="text-[var(--app-muted)] shrink-0" />
                  </button>

                  {showCategoryDropdown && (
                    <div className="absolute left-0 right-0 top-10 z-30 rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] shadow-xl p-2 space-y-2">
                      <div className="relative">
                        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--app-muted)]" />
                        <input
                          type="text"
                          value={categorySearchQuery}
                          onChange={(e) => setCategorySearchQuery(e.target.value)}
                          placeholder="Search cost category..."
                          className="w-full h-7.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] pl-7 pr-2 text-xs text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                        />
                      </div>

                      <div className="max-h-40 overflow-y-auto no-scrollbar space-y-0.5">
                        {filteredCategories.map(cat => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => {
                              updateField('costCategoryId', cat);
                              setShowCategoryDropdown(false);
                              setCategorySearchQuery('');
                            }}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                              formData.costCategoryId === cat 
                                ? 'bg-[var(--app-accent-soft)] text-[var(--app-accent)] font-bold' 
                                : 'hover:bg-[var(--app-control-hover)] text-[var(--app-text)]'
                            }`}
                          >
                            <span>{cat}</span>
                            {formData.costCategoryId === cat && <Check size={12} />}
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

        {/* ADVANCED SETTINGS CARD (Alias & Description) */}
        {(config.cfgAlias || config.cfgDescription) && (
          <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-5 shadow-xs space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center gap-2 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider border-b border-[var(--app-border)] pb-2.5">
              <Settings size={15} />
              <span>Advanced Settings</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              
              {/* Alias (Optional) */}
              {config.cfgAlias && (
                <div className="space-y-1">
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                    Alias
                  </label>
                  <input
                    type="text"
                    value={formData.alias}
                    onChange={(e) => updateField('alias', e.target.value)}
                    placeholder="e.g. IMU"
                    className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] transition-all"
                  />
                </div>
              )}

              {/* Description (Optional) */}
              {config.cfgDescription && (
                <div className="md:col-span-2 space-y-1">
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => updateField('description', e.target.value)}
                    placeholder="Main production department responsible for product assembly."
                    className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] p-3 text-xs font-medium text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] transition-all resize-none"
                  />
                </div>
              )}

            </div>
          </div>
        )}

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
          disabled={saving}
          onClick={handleSubmit}
          className="px-5 py-2 rounded-lg bg-[var(--app-accent)] text-white text-xs font-bold shadow-sm hover:opacity-90 transition-all flex items-center gap-1.5 disabled:opacity-50"
        >
          <CheckCircle2 size={14} />
          <span>{saving ? 'Saving...' : (isEdit ? 'Update Cost Center' : 'Save Cost Center')}</span>
        </button>
      </div>

      {/* 4. CONFIGURE FORM MODAL DIALOG */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-3">
              <div className="flex items-center gap-2 text-[var(--app-heading)] font-extrabold text-sm">
                <Settings size={16} className="text-[var(--app-accent)]" />
                <span>Configure Cost Center Form</span>
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
              Enable or disable optional form fields. Active items will render on the form UI.
            </p>

            <div className="space-y-2 text-xs">
              <label className="flex items-center justify-between p-2.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-control-bg)] hover:bg-[var(--app-control-hover)] cursor-pointer">
                <span className="font-semibold text-[var(--app-heading)]">Parent Cost Center Selection</span>
                <input
                  type="checkbox"
                  checked={config.cfgParentCostCenter}
                  onChange={(e) => setConfig(prev => ({ ...prev, cfgParentCostCenter: e.target.checked }))}
                  className="w-4 h-4 rounded accent-[var(--app-accent)]"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-control-bg)] hover:bg-[var(--app-control-hover)] cursor-pointer">
                <span className="font-semibold text-[var(--app-heading)]">Cost Category Selection</span>
                <input
                  type="checkbox"
                  checked={config.cfgCostCategory}
                  onChange={(e) => setConfig(prev => ({ ...prev, cfgCostCategory: e.target.checked }))}
                  className="w-4 h-4 rounded accent-[var(--app-accent)]"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-control-bg)] hover:bg-[var(--app-control-hover)] cursor-pointer">
                <span className="font-semibold text-[var(--app-heading)]">Alias Field</span>
                <input
                  type="checkbox"
                  checked={config.cfgAlias}
                  onChange={(e) => setConfig(prev => ({ ...prev, cfgAlias: e.target.checked }))}
                  className="w-4 h-4 rounded accent-[var(--app-accent)]"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-control-bg)] hover:bg-[var(--app-control-hover)] cursor-pointer">
                <span className="font-semibold text-[var(--app-heading)]">Description Field</span>
                <input
                  type="checkbox"
                  checked={config.cfgDescription}
                  onChange={(e) => setConfig(prev => ({ ...prev, cfgDescription: e.target.checked }))}
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

      {/* QUICK ADD COST CATEGORY MODAL */}
      {showAddCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2.5">
              <div className="flex items-center gap-2 text-[var(--app-heading)] font-extrabold text-sm">
                <FolderTree size={16} className="text-[var(--app-accent)]" />
                <span>Create Cost Category</span>
              </div>
              <button
                type="button"
                onClick={() => setShowAddCategoryModal(false)}
                className="p-1 rounded-lg hover:bg-[var(--app-control-hover)] text-[var(--app-muted)]"
              >
                <X size={15} />
              </button>
            </div>

            <div className="space-y-1 text-xs">
              <label className="block text-[10px] font-extrabold uppercase text-[var(--app-muted)]">
                Category Name *
              </label>
              <input
                type="text"
                autoFocus
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="e.g. R&D, Marketing, Export Sales"
                className="w-full h-9 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddCategoryModal(false)}
                className="px-3.5 py-1.5 rounded-lg border border-[var(--app-border)] text-xs font-semibold text-[var(--app-text)] hover:bg-[var(--app-control-hover)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateCategory}
                className="px-4 py-1.5 rounded-lg bg-[var(--app-accent)] text-white text-xs font-bold shadow-xs hover:opacity-90"
              >
                Save Category
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
