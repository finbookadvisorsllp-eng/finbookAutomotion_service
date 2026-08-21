import React, { useState, useEffect, useMemo } from 'react';
import { 
  Package, ChevronDown, ArrowLeft, CheckCircle2, AlertCircle, 
  Layers, Settings2, Percent, Check
} from 'lucide-react';
import { toast } from 'sonner';

const GST_RATES = ['0%', '0.1%', '0.25%', '1%', '1.5%', '3%', '5%', '12%', '18%', '28%'];
const TAXABILITY_OPTIONS = ['Taxable', 'Exempt', 'Nil Rated', 'Non-GST'];

// Helper to check circular parent relationships
const isCircularParent = (selectedParentName, currentGroupName, stockGroupsList) => {
  if (!selectedParentName || !currentGroupName || selectedParentName === 'Primary' || selectedParentName === 'Primary / Root Group') {
    return false;
  }
  
  if (selectedParentName.toLowerCase().trim() === currentGroupName.toLowerCase().trim()) {
    return true; // Self-parent
  }

  let curr = selectedParentName;
  const visited = new Set();

  while (curr && curr !== 'Primary' && curr !== 'Primary / Root Group') {
    if (curr.toLowerCase().trim() === currentGroupName.toLowerCase().trim()) {
      return true; // Circular relationship
    }
    if (visited.has(curr.toLowerCase().trim())) {
      break;
    }
    visited.add(curr.toLowerCase().trim());

    const parentObj = (stockGroupsList || []).find(g => 
      (g.groupName || g.name || '').toLowerCase().trim() === curr.toLowerCase().trim()
    );
    if (!parentObj) break;

    curr = parentObj.parentGroup || parentObj.parentGroupName || 'Primary';
  }

  return false;
};

/**
 * StockGroupMasterForm
 * Universal, Tally Prime-style Stock Group Master form.
 */
export default function StockGroupMasterForm({
  initialData = null,
  isEdit = false,
  stockGroupsList = [],
  onSave,
  onClose
}) {
  // Form State
  const [formData, setFormData] = useState(() => {
    if (initialData) {
      const pName = initialData.parentGroup || initialData.parentGroupName || 'Primary';
      return {
        groupName: initialData.groupName || initialData.name || '',
        alias: initialData.alias || (Array.isArray(initialData.nameAliases) ? initialData.nameAliases[0] : '') || '',
        parentGroup: pName === 'Primary / Root Group' ? 'Primary' : pName,
        status: (initialData.status || 'Active').toLowerCase() === 'inactive' ? 'Inactive' : 'Active',

        // Inventory Configuration Options
        isAddable: initialData.behaviour?.isAddable ?? initialData.isAddable ?? true,
        isBatchWiseOn: initialData.behaviour?.isBatchWiseOn ?? initialData.isBatchWiseOn ?? false,
        maintainMrp: initialData.behaviour?.maintainMrp ?? initialData.maintainMrp ?? false,
        maintainExpiry: initialData.behaviour?.maintainExpiry ?? initialData.maintainExpiry ?? false,

        // GST / Tax Defaults
        gstApplicable: initialData.gstDetails?.gstApplicable ?? initialData.gstApplicable ?? true,
        hsnCode: initialData.hsnDetails?.hsnCode || initialData.hsnCode || '',
        gstRate: initialData.gstDetails?.gstRate || initialData.gstRate || '18%',
        taxability: initialData.gstDetails?.taxability || initialData.taxability || 'Taxable'
      };
    }

    return {
      groupName: '',
      alias: '',
      parentGroup: 'Primary',
      status: 'Active',

      // Inventory Configuration Options
      isAddable: true,
      isBatchWiseOn: false,
      maintainMrp: false,
      maintainExpiry: false,

      // GST / Tax Defaults
      gstApplicable: true,
      hsnCode: '',
      gstRate: '18%',
      taxability: 'Taxable'
    };
  });

  const [errors, setErrors] = useState({});

  // Populate list of available Parent Groups
  const parentGroupOptions = useMemo(() => {
    const set = new Set(['Primary']);
    (stockGroupsList || []).forEach(g => {
      const name = g.groupName || g.name;
      if (name && typeof name === 'string' && name.trim() && name !== 'Primary') {
        set.add(name.trim());
      }
    });
    return Array.from(set).sort();
  }, [stockGroupsList]);

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
    const cleanName = formData.groupName.trim();
    const currentId = initialData?._id || initialData?.id;

    if (!cleanName) {
      newErrors.groupName = 'Stock Group Name is required';
    } else {
      // Check duplicate name within company
      const duplicate = (stockGroupsList || []).find(g => {
        if (!g) return false;
        const gId = g._id || g.id;
        if (currentId && gId && String(gId) === String(currentId)) return false;

        const existingName = (g.groupName || g.name || '').trim().toLowerCase();
        return existingName === cleanName.toLowerCase();
      });

      if (duplicate) {
        newErrors.groupName = `Stock Group "${cleanName}" already exists`;
      }
    }

    // Check Self & Circular Parent
    if (formData.parentGroup && formData.parentGroup !== 'Primary') {
      if (isEdit && formData.parentGroup.toLowerCase().trim() === cleanName.toLowerCase()) {
        newErrors.parentGroup = 'A Stock Group cannot be its own parent';
      } else if (isEdit && isCircularParent(formData.parentGroup, cleanName, stockGroupsList)) {
        newErrors.parentGroup = `Selecting "${formData.parentGroup}" creates a circular parent relationship`;
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

    const parentName = formData.parentGroup === 'Primary / Root Group' || !formData.parentGroup ? 'Primary' : formData.parentGroup;
    const parentObj = (stockGroupsList || []).find(g => (g.groupName || g.name) === parentName);

    const level = parentName === 'Primary' ? 1 : (parentObj?.level ? parentObj.level + 1 : 2);
    const groupPath = parentName === 'Primary'
      ? `Primary > ${formData.groupName.trim()}`
      : `${parentObj?.groupPath || ('Primary > ' + parentName)} > ${formData.groupName.trim()}`;

    const payload = {
      _id: initialData?._id || initialData?.id,
      id: initialData?._id || initialData?.id,
      sourceCollection: initialData?.sourceCollection || 'stockgroups_entry',

      groupName: formData.groupName.trim(),
      name: formData.groupName.trim(),
      alias: formData.alias.trim(),
      parentGroup: parentName,
      parentGroupName: parentName,
      groupPath: groupPath,
      level: level,

      behaviour: {
        isAddable: formData.isAddable,
        isBatchWiseOn: formData.isBatchWiseOn,
        maintainMrp: formData.maintainMrp,
        maintainExpiry: formData.maintainExpiry,
        affectsStock: true
      },

      isAddable: formData.isAddable,
      isBatchWiseOn: formData.isBatchWiseOn,
      maintainMrp: formData.maintainMrp,
      maintainExpiry: formData.maintainExpiry,

      gstDetails: {
        gstApplicable: formData.gstApplicable,
        hsnCode: formData.hsnCode.trim(),
        gstRate: formData.gstRate,
        taxability: formData.taxability
      },
      gstApplicable: formData.gstApplicable,
      hsnCode: formData.hsnCode.trim(),
      gstRate: formData.gstRate,
      taxability: formData.taxability,

      status: formData.status
    };

    if (onSave) {
      onSave(payload);
      toast.success(isEdit ? `Stock Group "${formData.groupName}" updated!` : `Stock Group "${formData.groupName}" created!`);
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
            title="Back to Stock Groups List"
          >
            <ArrowLeft size={15} />
          </button>
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--app-muted)]">
              <span>Stock Groups</span>
              <span>/</span>
              <span className="text-[var(--app-accent)]">{isEdit ? 'Edit Group' : 'New Group'}</span>
            </div>
            <h1 className="text-base font-extrabold text-[var(--app-heading)] tracking-tight">
              {isEdit ? `Edit: ${formData.groupName || 'Stock Group'}` : 'Create Stock Group'}
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
            <span>{isEdit ? 'Update Group' : 'Save Group'}</span>
          </button>
        </div>
      </div>

      {/* Main Form Container */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 flex justify-center">
        <form onSubmit={handleSubmit} className="w-full max-w-xl space-y-4">
          
          {/* Card 1: Basic Information */}
          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-4 md:p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-[var(--app-border)] pb-2.5 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
              <Package size={15} />
              <span>Basic Information</span>
            </div>

            {/* Row 1: Group Name & Alias */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                  Group Name <span className="text-rose-500">*</span>
                </label>
                <input
                  autoFocus
                  type="text"
                  value={formData.groupName}
                  onChange={(e) => updateField('groupName', e.target.value)}
                  placeholder="e.g. Electronics, Mobile Phones, Raw Materials"
                  className={`w-full h-9 rounded-lg border bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] outline-none transition-all ${
                    errors.groupName 
                      ? 'border-rose-500 focus:border-rose-500 ring-1 ring-rose-500/20' 
                      : 'border-[var(--app-border)] focus:border-[var(--app-accent)]'
                  }`}
                />
                {errors.groupName && (
                  <p className="text-[10px] font-bold text-rose-500 mt-0.5">{errors.groupName}</p>
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
                  placeholder="e.g. MOB"
                  className="w-full h-9 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                />
              </div>
            </div>

            {/* Row 2: Under Group & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                  Parent Group <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.parentGroup}
                  onChange={(e) => updateField('parentGroup', e.target.value)}
                  className={`w-full h-9 rounded-lg border bg-[var(--app-control-bg)] px-2.5 text-xs font-bold text-[var(--app-heading)] outline-none transition-all cursor-pointer ${
                    errors.parentGroup ? 'border-rose-500' : 'border-[var(--app-border)] focus:border-[var(--app-accent)]'
                  }`}
                >
                  <option value="Primary">Primary (Root Level Group)</option>
                  {parentGroupOptions
                    .filter(p => p !== 'Primary' && (!isEdit || p.toLowerCase().trim() !== formData.groupName.toLowerCase().trim()))
                    .map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                </select>
                {errors.parentGroup && (
                  <p className="text-[10px] font-bold text-rose-500 mt-0.5">{errors.parentGroup}</p>
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

          {/* Card 2: Inventory Configuration */}
          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-4 md:p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-[var(--app-border)] pb-2.5 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
              <Settings2 size={15} />
              <span>Inventory Settings</span>
            </div>

            <div className="space-y-3">
              {/* Should Quantities of Items be Added? */}
              <div className="p-3 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] flex items-center justify-between gap-3">
                <div>
                  <span className="block text-xs font-bold text-[var(--app-heading)]">Should Quantities of Items be Added?</span>
                  <span className="block text-[10px] text-[var(--app-muted)]">Consolidates item quantities under this group in stock reports</span>
                </div>
                <div className="h-8 flex rounded-md border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => updateField('isAddable', true)}
                    className={`px-3 rounded text-[11px] font-bold transition-all ${
                      formData.isAddable ? 'bg-[var(--app-accent)] text-white' : 'text-[var(--app-muted)]'
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField('isAddable', false)}
                    className={`px-3 rounded text-[11px] font-bold transition-all ${
                      !formData.isAddable ? 'bg-gray-600 text-white' : 'text-[var(--app-muted)]'
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>

              {/* Toggles Grid: Batch-wise, MRP, Expiry */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Batch-wise Details */}
                <div className="p-3 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] space-y-2">
                  <span className="block text-xs font-bold text-[var(--app-heading)]">Maintain Batch-wise Details</span>
                  <div className="h-7 flex rounded-md border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-0.5">
                    <button
                      type="button"
                      onClick={() => updateField('isBatchWiseOn', true)}
                      className={`flex-1 rounded text-[10px] font-bold transition-all ${
                        formData.isBatchWiseOn ? 'bg-emerald-600 text-white' : 'text-[var(--app-muted)]'
                      }`}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => updateField('isBatchWiseOn', false)}
                      className={`flex-1 rounded text-[10px] font-bold transition-all ${
                        !formData.isBatchWiseOn ? 'bg-gray-500 text-white' : 'text-[var(--app-muted)]'
                      }`}
                    >
                      No
                    </button>
                  </div>
                </div>

                {/* Maintain MRP Details */}
                <div className="p-3 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] space-y-2">
                  <span className="block text-xs font-bold text-[var(--app-heading)]">Maintain MRP Details</span>
                  <div className="h-7 flex rounded-md border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-0.5">
                    <button
                      type="button"
                      onClick={() => updateField('maintainMrp', true)}
                      className={`flex-1 rounded text-[10px] font-bold transition-all ${
                        formData.maintainMrp ? 'bg-emerald-600 text-white' : 'text-[var(--app-muted)]'
                      }`}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => updateField('maintainMrp', false)}
                      className={`flex-1 rounded text-[10px] font-bold transition-all ${
                        !formData.maintainMrp ? 'bg-gray-500 text-white' : 'text-[var(--app-muted)]'
                      }`}
                    >
                      No
                    </button>
                  </div>
                </div>

                {/* Maintain Expiry Date */}
                <div className="p-3 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] space-y-2">
                  <span className="block text-xs font-bold text-[var(--app-heading)]">Maintain Expiry Date</span>
                  <div className="h-7 flex rounded-md border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-0.5">
                    <button
                      type="button"
                      onClick={() => updateField('maintainExpiry', true)}
                      className={`flex-1 rounded text-[10px] font-bold transition-all ${
                        formData.maintainExpiry ? 'bg-emerald-600 text-white' : 'text-[var(--app-muted)]'
                      }`}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => updateField('maintainExpiry', false)}
                      className={`flex-1 rounded text-[10px] font-bold transition-all ${
                        !formData.maintainExpiry ? 'bg-gray-500 text-white' : 'text-[var(--app-muted)]'
                      }`}
                    >
                      No
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: GST / Tax Defaults (Optional Group Defaults) */}
          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-4 md:p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2.5">
              <div className="flex items-center gap-2 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
                <Percent size={15} />
                <span>GST &amp; Tax Defaults</span>
              </div>
              <span className="text-[9px] text-[var(--app-muted)] font-semibold">Inherited by items in this group</span>
            </div>

            <div className="space-y-3">
              {/* GST Applicable */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)]">
                <div>
                  <span className="block text-xs font-bold text-[var(--app-heading)]">GST Applicable?</span>
                  <span className="block text-[10px] text-[var(--app-muted)]">Items under this group will inherit these tax defaults</span>
                </div>
                <div className="h-8 flex rounded-md border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => updateField('gstApplicable', true)}
                    className={`px-3 rounded text-[11px] font-bold transition-all ${
                      formData.gstApplicable ? 'bg-[var(--app-accent)] text-white' : 'text-[var(--app-muted)]'
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField('gstApplicable', false)}
                    className={`px-3 rounded text-[11px] font-bold transition-all ${
                      !formData.gstApplicable ? 'bg-gray-600 text-white' : 'text-[var(--app-muted)]'
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>

              {formData.gstApplicable && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in duration-150 pt-1">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                      HSN / SAC Code
                    </label>
                    <input
                      type="text"
                      value={formData.hsnCode}
                      onChange={(e) => updateField('hsnCode', e.target.value)}
                      placeholder="e.g. 8517"
                      className="w-full h-9 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-mono font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                      Default GST Rate
                    </label>
                    <select
                      value={formData.gstRate}
                      onChange={(e) => updateField('gstRate', e.target.value)}
                      className="w-full h-9 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2.5 text-xs font-bold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] cursor-pointer"
                    >
                      {GST_RATES.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                      Taxability
                    </label>
                    <select
                      value={formData.taxability}
                      onChange={(e) => updateField('taxability', e.target.value)}
                      className="w-full h-9 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2.5 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] cursor-pointer"
                    >
                      {TAXABILITY_OPTIONS.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

        </form>
      </div>

      {/* Sticky Action Bar */}
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
          <span>{isEdit ? 'Update Stock Group' : 'Save Stock Group'}</span>
        </button>
      </div>

    </div>
  );
}
