import React, { useState, useEffect } from 'react';
import { 
  FolderTree, X, ArrowLeft, CheckCircle2, AlertCircle, Building2
} from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '../../lib/apiClient';

export default function CostCategoryMasterForm({
  initialData = null,
  isEdit = false,
  costCategoriesList = [],
  onSave,
  onClose
}) {
  const [formData, setFormData] = useState({
    categoryName: '',
    alias: '',
    allocateRevenueItems: true,
    allocateNonRevenueItems: true,
    isActive: true,
    description: ''
  });

  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEdit && initialData) {
      const activeState = initialData.isActive !== undefined 
        ? !!initialData.isActive 
        : (initialData.status || 'ACTIVE').toUpperCase() === 'ACTIVE';

      setFormData({
        categoryName: initialData.categoryName || initialData.costCategoryName || initialData.name || '',
        alias: initialData.alias || '',
        allocateRevenueItems: initialData.allocateRevenueItems !== undefined ? !!initialData.allocateRevenueItems : true,
        allocateNonRevenueItems: initialData.allocateNonRevenueItems !== undefined ? !!initialData.allocateNonRevenueItems : true,
        isActive: activeState,
        description: initialData.description || ''
      });
    }
  }, [isEdit, initialData]);

  const updateField = (key, val) => {
    setFormData(prev => ({ ...prev, [key]: val }));
    if (errors[key]) {
      setErrors(prev => ({ ...prev, [key]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};
    const trimmedName = formData.categoryName.trim();

    if (!trimmedName) {
      newErrors.categoryName = 'Cost Category Name is required';
    } else {
      const duplicate = costCategoriesList.find(c => {
        const cName = (c.categoryName || c.costCategoryName || c.name || '').trim().toLowerCase();
        const currentId = initialData?._id || initialData?.id || initialData?.sr;
        const itemObjId = c._id || c.id || c.sr;
        return cName === trimmedName.toLowerCase() && currentId !== itemObjId;
      });

      if (duplicate) {
        newErrors.categoryName = 'A Cost Category with this name already exists';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

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
        sourceCollection: initialData?.sourceCollection || 'costcategories_entry',
        categoryName: formData.categoryName.trim(),
        costCategoryName: formData.categoryName.trim(),
        name: formData.categoryName.trim(),
        alias: formData.alias.trim(),
        allocateRevenueItems: formData.allocateRevenueItems,
        allocateNonRevenueItems: formData.allocateNonRevenueItems,
        isActive: formData.isActive,
        status: formData.isActive ? 'ACTIVE' : 'INACTIVE',
        description: formData.description.trim(),
        isWebEntry: true
      };

      if (onSave) {
        onSave(payload);
      } else {
        if (isEdit && (initialData?._id || initialData?.id)) {
          const id = initialData._id || initialData.id;
          await apiClient.put(`/masters/cost-categories/${id}`, payload, { headers });
          toast.success(`Cost Category "${formData.categoryName}" updated successfully`);
        } else {
          await apiClient.post('/masters/cost-categories', payload, { headers });
          toast.success(`Cost Category "${formData.categoryName}" created successfully`);
        }
      }

      if (onClose) onClose();
    } catch (err) {
      console.error('Error saving Cost Category master:', err);
      toast.error(err.response?.data?.detail || 'Failed to save Cost Category');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-[var(--app-content-bg)] text-[var(--app-text)] font-sans overflow-hidden animate-in fade-in duration-300">
      
      {/* 1. Header Navigation Bar */}
      <div className="shrink-0 px-6 py-3.5 border-b border-[var(--app-border)] bg-[var(--app-panel-bg)] flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg border border-[var(--app-border)] hover:bg-[var(--app-control-hover)] text-[var(--app-text)] transition-colors"
            title="Back to Cost Categories"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--app-muted)]">
              <span>Masters</span>
              <span>/</span>
              <span>Cost Centres</span>
              <span>/</span>
              <span className="text-[var(--app-accent)] font-bold">{isEdit ? 'Edit Category' : 'New Category'}</span>
            </div>
            <h1 className="text-base md:text-xl font-extrabold text-[var(--app-heading)] tracking-tight">
              {isEdit ? 'Edit Cost Category' : 'Create Cost Category'}
            </h1>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2.5">
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
            <span>{saving ? 'Saving...' : (isEdit ? 'Update Category' : 'Save Category')}</span>
          </button>
        </div>
      </div>

      {/* 2. Form Body */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-6 w-full space-y-5">
        
        {/* BASIC DETAILS */}
        <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2.5">
            <div className="flex items-center gap-2 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
              <FolderTree size={15} />
              <span>Category Details</span>
            </div>
            <span className="text-[10px] font-semibold text-[var(--app-muted)]">* Required fields</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            
            {/* Category Name * */}
            <div className="md:col-span-2 space-y-1">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                Category Name <span className="text-red-500">*</span>
              </label>
              <input
                autoFocus
                type="text"
                value={formData.categoryName}
                onChange={(e) => updateField('categoryName', e.target.value)}
                placeholder="e.g. Department, Projects, Brand, Branch"
                className={`w-full h-9.5 rounded-lg border bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] outline-none transition-all ${
                  errors.categoryName 
                    ? 'border-red-500 focus:border-red-500 ring-1 ring-red-500/20' 
                    : 'border-[var(--app-border)] focus:border-[var(--app-accent)]'
                }`}
              />
              {errors.categoryName && (
                <p className="text-[10px] font-bold text-red-500 flex items-center gap-1 mt-0.5">
                  <AlertCircle size={11} />
                  <span>{errors.categoryName}</span>
                </p>
              )}
            </div>

            {/* Alias */}
            <div className="space-y-1">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                Alias
              </label>
              <input
                type="text"
                value={formData.alias}
                onChange={(e) => updateField('alias', e.target.value)}
                placeholder="e.g. DEPT"
                className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] transition-all"
              />
            </div>

            {/* Active Status Toggle */}
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

          </div>
        </div>

        {/* ALLOCATION SETTINGS CARD */}
        <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider border-b border-[var(--app-border)] pb-2.5">
            <Building2 size={15} />
            <span>Allocation Settings</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            
            {/* Allocate Revenue Items */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-control-bg)]">
              <div>
                <span className="font-extrabold text-[var(--app-heading)] block">Allocate Revenue Items</span>
                <span className="text-[10px] text-[var(--app-muted)]">Enable cost centre allocations for Income & Expense ledgers</span>
              </div>
              <button
                type="button"
                onClick={() => updateField('allocateRevenueItems', !formData.allocateRevenueItems)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  formData.allocateRevenueItems ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    formData.allocateRevenueItems ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Allocate Non-Revenue Items */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-control-bg)]">
              <div>
                <span className="font-extrabold text-[var(--app-heading)] block">Allocate Non-Revenue Items</span>
                <span className="text-[10px] text-[var(--app-muted)]">Enable cost centre allocations for Asset & Liability ledgers</span>
              </div>
              <button
                type="button"
                onClick={() => updateField('allocateNonRevenueItems', !formData.allocateNonRevenueItems)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  formData.allocateNonRevenueItems ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    formData.allocateNonRevenueItems ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

          </div>
        </div>

        {/* DESCRIPTION */}
        <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-5 shadow-xs space-y-3">
          <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
            Description
          </label>
          <textarea
            rows={2}
            value={formData.description}
            onChange={(e) => updateField('description', e.target.value)}
            placeholder="e.g. Cost Category for internal departmental allocations..."
            className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] p-3 text-xs font-medium text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] transition-all resize-none"
          />
        </div>

      </div>

      {/* 3. Bottom Action Bar */}
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
          <span>{saving ? 'Saving...' : (isEdit ? 'Update Category' : 'Save Category')}</span>
        </button>
      </div>

    </div>
  );
}
