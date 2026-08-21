import React, { useState, useEffect, useMemo } from 'react';
import { 
  Layers, Plus, Trash2, X, Search, ChevronDown, Check, ArrowLeft, Save, 
  CheckCircle2, FolderTree, AlertCircle, Sparkles, Building2, Settings, Percent
} from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '../../lib/apiClient';

export default function CostCentreClassMasterForm({
  initialData = null,
  isEdit = false,
  costCategoriesList = [],
  costCentersList = [],
  costCentreClassesList = [],
  onSave,
  onClose
}) {
  const [formData, setFormData] = useState({
    className: '',
    alias: '',
    isActive: true,
    description: '',
    allocations: [
      {
        categoryId: '',
        categoryName: 'Primary Cost Category',
        costCentreId: '',
        costCentreName: '',
        percentage: 100
      }
    ]
  });

  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEdit && initialData) {
      const activeState = initialData.isActive !== undefined 
        ? !!initialData.isActive 
        : (initialData.status || 'ACTIVE').toUpperCase() === 'ACTIVE';

      const rawAllocs = initialData.allocations || [];
      const parsedAllocations = rawAllocs.length > 0 ? rawAllocs.map(a => ({
        categoryId: a.categoryId || '',
        categoryName: a.categoryName || a.costCategoryName || 'Primary Cost Category',
        costCentreId: a.costCentreId || a.costCenterId || '',
        costCentreName: a.costCentreName || a.costCenterName || '',
        percentage: a.percentage ?? a.pct ?? 0
      })) : [
        {
          categoryId: '',
          categoryName: 'Primary Cost Category',
          costCentreId: '',
          costCentreName: '',
          percentage: 100
        }
      ];

      setFormData({
        className: initialData.className || initialData.name || '',
        alias: initialData.alias || '',
        isActive: activeState,
        description: initialData.description || '',
        allocations: parsedAllocations
      });
    }
  }, [isEdit, initialData]);

  const updateField = (key, val) => {
    setFormData(prev => ({ ...prev, [key]: val }));
    if (errors[key]) {
      setErrors(prev => ({ ...prev, [key]: null }));
    }
  };

  const addAllocationRow = () => {
    setFormData(prev => ({
      ...prev,
      allocations: [
        ...prev.allocations,
        {
          categoryId: '',
          categoryName: 'Primary Cost Category',
          costCentreId: '',
          costCentreName: '',
          percentage: 0
        }
      ]
    }));
  };

  const removeAllocationRow = (index) => {
    if (formData.allocations.length <= 1) {
      toast.error('Cost Centre Class must contain at least 1 allocation rule.');
      return;
    }
    setFormData(prev => ({
      ...prev,
      allocations: prev.allocations.filter((_, i) => i !== index)
    }));
  };

  const updateAllocationRow = (index, field, val) => {
    setFormData(prev => {
      const updated = [...prev.allocations];
      updated[index] = { ...updated[index], [field]: val };
      return { ...prev, allocations: updated };
    });
  };

  // Calculate live total percentage sum
  const totalAllocationPct = useMemo(() => {
    return formData.allocations.reduce((sum, a) => sum + (parseFloat(a.percentage) || 0), 0);
  }, [formData.allocations]);

  const isTotalValid = Math.abs(totalAllocationPct - 100) < 0.01;

  const validate = () => {
    const newErrors = {};
    const trimmedName = formData.className.trim();

    if (!trimmedName) {
      newErrors.className = 'Cost Centre Class Name is required';
    } else {
      const duplicate = costCentreClassesList.find(c => {
        const cName = (c.className || c.name || '').trim().toLowerCase();
        const currentId = initialData?._id || initialData?.id || initialData?.sr;
        const itemObjId = c._id || c.id || c.sr;
        return cName === trimmedName.toLowerCase() && currentId !== itemObjId;
      });

      if (duplicate) {
        newErrors.className = 'A Cost Centre Class with this name already exists';
      }
    }

    if (!isTotalValid) {
      newErrors.allocations = `Total allocation must equal 100%. Current total: ${totalAllocationPct.toFixed(2)}%.`;
    }

    const emptyCcRow = formData.allocations.find(a => !a.costCentreName.trim());
    if (emptyCcRow) {
      newErrors.allocations = 'Please select a Cost Centre for all allocation rows.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    if (!validate()) {
      toast.error(errors.allocations || 'Please fix validation errors before saving.');
      return;
    }

    setSaving(true);
    try {
      const activeCompanyId = localStorage.getItem('selectedCompanyId') || localStorage.getItem('activeCompany') || '';
      const headers = activeCompanyId ? { 'x-company-id': activeCompanyId } : {};

      const payload = {
        _id: initialData?._id || initialData?.id,
        id: initialData?._id || initialData?.id,
        sourceCollection: initialData?.sourceCollection || 'costcentreclasses_entry',
        className: formData.className.trim(),
        name: formData.className.trim(),
        alias: formData.alias.trim(),
        allocations: formData.allocations,
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
          await apiClient.put(`/masters/cost-centre-classes/${id}`, payload, { headers });
          toast.success(`Cost Centre Class "${formData.className}" updated successfully`);
        } else {
          await apiClient.post('/masters/cost-centre-classes', payload, { headers });
          toast.success(`Cost Centre Class "${formData.className}" created successfully`);
        }
      }

      if (onClose) onClose();
    } catch (err) {
      console.error('Error saving Cost Centre Class:', err);
      toast.error(err.response?.data?.detail || 'Failed to save Cost Centre Class');
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
            title="Back to Cost Centre Classes"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--app-muted)]">
              <span>Masters</span>
              <span>/</span>
              <span>Cost Centre</span>
              <span>/</span>
              <span className="text-[var(--app-accent)] font-bold">{isEdit ? 'Edit Class' : 'Create Class'}</span>
            </div>
            <h1 className="text-base md:text-xl font-extrabold text-[var(--app-heading)] tracking-tight">
              {isEdit ? 'Edit Cost Centre Class' : 'Create Cost Centre Class'}
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
            <span>{saving ? 'Saving...' : (isEdit ? 'Update Class' : 'Save Class')}</span>
          </button>
        </div>
      </div>

      {/* 2. Form Body */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-6 w-full space-y-5">
        
        {/* BASIC DETAILS */}
        <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2.5">
            <div className="flex items-center gap-2 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
              <Layers size={15} />
              <span>Class Details</span>
            </div>
            <span className="text-[10px] font-semibold text-[var(--app-muted)]">* Required fields</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            
            {/* Class Name * */}
            <div className="md:col-span-2 space-y-1">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                Cost Centre Class Name <span className="text-red-500">*</span>
              </label>
              <input
                autoFocus
                type="text"
                value={formData.className}
                onChange={(e) => updateField('className', e.target.value)}
                placeholder="e.g. Common Expense Allocation, Sales vs Marketing 60/40"
                className={`w-full h-9.5 rounded-lg border bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] outline-none transition-all ${
                  errors.className 
                    ? 'border-red-500 focus:border-red-500 ring-1 ring-red-500/20' 
                    : 'border-[var(--app-border)] focus:border-[var(--app-accent)]'
                }`}
              />
              {errors.className && (
                <p className="text-[10px] font-bold text-red-500 flex items-center gap-1 mt-0.5">
                  <AlertCircle size={11} />
                  <span>{errors.className}</span>
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
                placeholder="e.g. CEA-6040"
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

        {/* Allocation Rules */}
        <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2.5">
            <div className="flex items-center gap-2 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
              <Percent size={15} />
              <span>Allocation Rules</span>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Total percentage live badge */}
              <div className={`px-3 py-1 rounded-lg border text-xs font-extrabold flex items-center gap-1.5 ${
                isTotalValid 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
                  : 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
              }`}>
                <span>Total: {totalAllocationPct.toFixed(2)}%</span>
                {isTotalValid ? <Check size={13} /> : <AlertCircle size={13} />}
              </div>

              <button
                type="button"
                onClick={addAllocationRow}
                className="px-3 py-1.5 rounded-lg bg-[var(--app-accent-soft)] text-[var(--app-accent)] hover:opacity-90 transition-all text-xs font-bold flex items-center gap-1 shadow-2xs"
              >
                <Plus size={13} />
                <span>Add Allocation</span>
              </button>
            </div>
          </div>

          {errors.allocations && (
            <p className="text-[10px] font-bold text-red-500 flex items-center gap-1">
              <AlertCircle size={11} />
              <span>{errors.allocations}</span>
            </p>
          )}

          <div className="overflow-x-auto border border-[var(--app-border)] rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[var(--app-control-bg)] border-b border-[var(--app-border)] text-[10px] font-extrabold uppercase text-[var(--app-muted)] tracking-wider">
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Cost Category</th>
                  <th className="py-2.5 px-3 w-1/3">Cost Centre *</th>
                  <th className="py-2.5 px-3">Percentage (%) *</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--app-border)]">
                {formData.allocations.map((alloc, index) => (
                  <tr key={index} className="hover:bg-[var(--app-control-hover)]/50 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-[var(--app-muted)] text-[11px]">
                      {index + 1}
                    </td>

                    {/* Cost Category */}
                    <td className="py-2.5 px-3">
                      <select
                        value={alloc.categoryName}
                        onChange={(e) => {
                          const catName = e.target.value;
                          const catDoc = costCategoriesList.find(c => (c.categoryName || c.costCategoryName || c.name || '') === catName);
                          updateAllocationRow(index, 'categoryName', catName);
                          updateAllocationRow(index, 'categoryId', catDoc?._id || catDoc?.id || '');
                        }}
                        className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2.5 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                      >
                        {costCategoriesList.length > 0 ? (
                          costCategoriesList.map(c => {
                            const cName = c.categoryName || c.costCategoryName || c.name || '';
                            return <option key={c._id || cName} value={cName}>{cName}</option>;
                          })
                        ) : (
                          <option value="Primary Cost Category">Primary Cost Category</option>
                        )}
                      </select>
                    </td>

                    {/* Cost Centre */}
                    <td className="py-2.5 px-3">
                      <select
                        value={alloc.costCentreName}
                        onChange={(e) => {
                          const ccName = e.target.value;
                          const ccDoc = costCentersList.find(cc => (cc.costCenterName || cc.name || '') === ccName);
                          updateAllocationRow(index, 'costCentreName', ccName);
                          updateAllocationRow(index, 'costCentreId', ccDoc?._id || ccDoc?.id || '');
                        }}
                        className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2.5 text-xs font-bold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                      >
                        <option value="">-- Select Cost Centre --</option>
                        {costCentersList.map(cc => {
                          const ccName = cc.costCenterName || cc.name || '';
                          return <option key={cc._id || ccName} value={ccName}>{ccName}</option>;
                        })}
                      </select>
                    </td>

                    {/* Percentage % */}
                    <td className="py-2.5 px-3">
                      <div className="relative w-32">
                        <input
                          type="number"
                          min="0.01"
                          max="100"
                          step="any"
                          value={alloc.percentage}
                          onChange={(e) => updateAllocationRow(index, 'percentage', parseFloat(e.target.value) || 0)}
                          className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2.5 pr-7 text-xs font-bold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--app-muted)]">%</span>
                      </div>
                    </td>

                    {/* Remove Action */}
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => removeAllocationRow(index)}
                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
                        title="Remove Allocation"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
            placeholder="e.g. Standard percentage allocation for shared operational expenses..."
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
          <span>{saving ? 'Saving...' : (isEdit ? 'Update Class' : 'Save Class')}</span>
        </button>
      </div>

    </div>
  );
}
