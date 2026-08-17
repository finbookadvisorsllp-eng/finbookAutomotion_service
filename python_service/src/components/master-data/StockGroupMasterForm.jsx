import React, { useState, useEffect, useMemo } from 'react';
import { 
  Layers, Search, ChevronDown, Check, ArrowLeft, Save, 
  CheckCircle2, AlertCircle, Package, Settings, Sliders, X
} from 'lucide-react';
import { toast } from 'sonner';

/**
 * StockGroupMasterForm
 * Component for creating and editing Stock Groups in the Masters module.
 * Takes full screen width and includes a [ Configure Form ] modal for toggling form sections.
 */
export default function StockGroupMasterForm({
  initialData = null,
  isEdit = false,
  stockGroupsList = [],
  unitsList = ['Nos', 'Kg', 'Gram', 'Litre', 'Meter', 'Box', 'Packet', 'Pcs', 'Set'],
  onSave,
  onClose
}) {
  // Configure Form Modal Preferences (Persisted in localStorage)
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [config, setConfig] = useState(() => {
    const saved = localStorage.getItem('stock_group_form_config');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      cfgInventoryConfig: true,
      cfgStockBehaviour: true
    };
  });

  useEffect(() => {
    localStorage.setItem('stock_group_form_config', JSON.stringify(config));
  }, [config]);

  // Form State
  const [formData, setFormData] = useState({
    groupName: '',
    groupCode: '',
    parentGroup: 'Primary / Root Group',
    status: 'ACTIVE',
    baseUnits: 'Nos',
    additionalUnits: 'Not Applicable',
    costingMethod: 'FIFO',
    valuationMethod: 'Last Sale Price',
    trackBatches: false,
    trackGodown: false,
    isBatchWiseOn: false,
    allowNegativeStock: false,
    isPersishableOn: false,
    isAddable: true
  });

  // Parent Search State
  const [parentSearchQuery, setParentSearchQuery] = useState('');
  const [showParentDropdown, setShowParentDropdown] = useState(false);

  // Errors
  const [errors, setErrors] = useState({});

  const COSTING_METHODS = [
    { value: 'FIFO', label: 'FIFO (First In First Out)' },
    { value: 'LIFO', label: 'LIFO (Last In First Out)' },
    { value: 'Average Cost', label: 'Average Cost' },
    { value: 'Monthly Avg Cost', label: 'Monthly Avg Cost' },
    { value: 'At Zero Cost', label: 'At Zero Cost' },
    { value: 'Last Price', label: 'Last Price' },
  ];

  const VALUATION_METHODS = [
    { value: 'Last Sale Price', label: 'Last Sale Price' },
    { value: 'At Cost', label: 'At Cost' },
    { value: 'Default Price', label: 'Default Price' },
    { value: 'Basic Price', label: 'Basic Price' },
  ];

  // Pre-fill on Edit / Auto-generate code on Create
  useEffect(() => {
    if (isEdit && initialData) {
      setFormData({
        groupName: initialData.groupName || initialData.name || '',
        groupCode: initialData.groupCode || initialData.code || '',
        parentGroup: initialData.parentGroup || initialData.parentGroupName || 'Primary / Root Group',
        status: (initialData.status || 'ACTIVE').toUpperCase(),
        baseUnits: initialData.baseUnits || initialData.unit || 'Nos',
        additionalUnits: initialData.additionalUnits || 'Not Applicable',
        costingMethod: initialData.costingMethod || 'FIFO',
        valuationMethod: initialData.valuationMethod || 'Last Sale Price',
        trackBatches: initialData.behaviour?.trackBatches ?? initialData.trackBatches ?? false,
        trackGodown: initialData.behaviour?.trackGodown ?? initialData.trackGodown ?? false,
        isBatchWiseOn: initialData.behaviour?.isBatchWiseOn ?? initialData.isBatchWiseOn ?? false,
        allowNegativeStock: initialData.behaviour?.allowNegativeStock ?? initialData.allowNegativeStock ?? false,
        isPersishableOn: initialData.behaviour?.isPersishableOn ?? initialData.isPersishableOn ?? false,
        isAddable: initialData.behaviour?.isAddable ?? initialData.isAddable ?? true
      });
    } else {
      const nextNum = (stockGroupsList.length + 1).toString().padStart(4, '0');
      setFormData(prev => ({
        ...prev,
        groupCode: `GRP-${nextNum}`
      }));
    }
  }, [isEdit, initialData, stockGroupsList.length]);

  // Update Field Helper
  const updateField = (key, val) => {
    setFormData(prev => {
      const next = { ...prev, [key]: val };

      if (key === 'parentGroup' && val !== 'Primary / Root Group' && val !== 'Primary') {
        const parentObj = stockGroupsList.find(g => (g.groupName || g.name) === val);
        if (parentObj) {
          if (parentObj.baseUnits) next.baseUnits = parentObj.baseUnits;
          if (parentObj.costingMethod) next.costingMethod = parentObj.costingMethod;
          if (parentObj.valuationMethod) next.valuationMethod = parentObj.valuationMethod;
          if (parentObj.behaviour) {
            next.trackBatches = parentObj.behaviour.trackBatches ?? next.trackBatches;
            next.trackGodown = parentObj.behaviour.trackGodown ?? next.trackGodown;
            next.isBatchWiseOn = parentObj.behaviour.isBatchWiseOn ?? next.isBatchWiseOn;
            next.allowNegativeStock = parentObj.behaviour.allowNegativeStock ?? next.allowNegativeStock;
            next.isPersishableOn = parentObj.behaviour.isPersishableOn ?? next.isPersishableOn;
            next.isAddable = parentObj.behaviour.isAddable ?? next.isAddable;
          }
        }
      }
      return next;
    });

    if (errors[key]) {
      setErrors(prev => ({ ...prev, [key]: null }));
    }
  };

  // Validation
  const validate = () => {
    const newErrors = {};
    const trimmedName = formData.groupName.trim();

    if (!trimmedName) {
      newErrors.groupName = 'Stock Group Name is required';
    } else {
      const duplicate = stockGroupsList.find(g => {
        const gName = (g.groupName || g.name || '').trim().toLowerCase();
        const currentId = initialData?.id || initialData?.sr;
        const itemObjId = g.id || g.sr;
        return gName === trimmedName.toLowerCase() && currentId !== itemObjId;
      });

      if (duplicate) {
        newErrors.groupName = 'A Stock Group with this name already exists';
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

    const parentName = formData.parentGroup === 'Primary / Root Group' || formData.parentGroup === 'Primary' ? 'Primary' : formData.parentGroup;
    const parentObj = stockGroupsList.find(g => (g.groupName || g.name) === parentName);

    const level = parentName === 'Primary' ? 1 : (parentObj?.level ? parentObj.level + 1 : 2);
    const groupPath = parentName === 'Primary'
      ? `Primary > ${formData.groupName.trim()}`
      : `${parentObj?.groupPath || ('Primary > ' + parentName)} > ${formData.groupName.trim()}`;

    const payload = {
      _id: initialData?._id || initialData?.id,
      id: initialData?._id || initialData?.id,
      sourceCollection: initialData?.sourceCollection || 'stockgroups_entry',
      groupName: formData.groupName.trim(),
      groupCode: formData.groupCode.trim(),
      parentGroup: parentName,
      parentGroupName: parentName,
      groupPath: groupPath,
      level: level,
      baseUnits: formData.baseUnits,
      additionalUnits: formData.additionalUnits,
      costingMethod: formData.costingMethod,
      valuationMethod: formData.valuationMethod,
      behaviour: {
        trackBatches: formData.trackBatches,
        trackGodown: formData.trackGodown,
        isBatchWiseOn: formData.isBatchWiseOn,
        allowNegativeStock: formData.allowNegativeStock,
        isPersishableOn: formData.isPersishableOn,
        isAddable: formData.isAddable
      },
      status: formData.status
    };

    onSave(payload);
    toast.success(isEdit ? 'Stock Group updated successfully!' : 'Stock Group created successfully!');
  };

  // Filter Parent Options
  const filteredParents = useMemo(() => {
    const available = stockGroupsList.filter(g => {
      const gName = g.groupName || g.name || '';
      return !isEdit || gName.toLowerCase() !== formData.groupName.toLowerCase();
    });

    const q = parentSearchQuery.toLowerCase().trim();
    if (!q) return ['Primary / Root Group', ...available.map(g => g.groupName || g.name)];
    
    const matches = available
      .map(g => g.groupName || g.name)
      .filter(n => n.toLowerCase().includes(q));
    
    return ['Primary / Root Group', ...matches];
  }, [stockGroupsList, parentSearchQuery, isEdit, formData.groupName]);

  return (
    <div className="h-full w-full flex flex-col bg-[var(--app-content-bg)] text-[var(--app-text)] font-sans overflow-hidden animate-in fade-in duration-300">
      
      {/* 1. Header Navigation Bar (Full Width) */}
      <div className="shrink-0 px-6 py-3.5 border-b border-[var(--app-border)] bg-[var(--app-panel-bg)] flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg border border-[var(--app-border)] hover:bg-[var(--app-control-hover)] text-[var(--app-text)] transition-colors"
            title="Back to Stock Groups List"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--app-muted)]">
              <span>Masters</span>
              <span>/</span>
              <span>Stock Group</span>
              <span>/</span>
              <span className="text-[var(--app-accent)] font-bold">{isEdit ? 'Edit' : 'Create'}</span>
            </div>
            <h1 className="text-base md:text-xl font-extrabold text-[var(--app-heading)] tracking-tight">
              {isEdit ? 'Edit Stock Group Master' : 'Create Stock Group Master'}
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
            <span>{isEdit ? 'Update Stock Group' : 'Save Stock Group'}</span>
          </button>
        </div>
      </div>

      {/* 2. Full Width Form Body */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-6 w-full space-y-5">
        
        {/* SECTION 1: BASIC INFORMATION */}
        <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2.5">
            <div className="flex items-center gap-2 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
              <Package size={15} />
              <span>1. BASIC INFORMATION</span>
            </div>
            <span className="text-[10px] font-semibold text-[var(--app-muted)]">* Required fields</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            {/* Stock Group Name * */}
            <div className="md:col-span-2 space-y-1">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                Stock Group Name <span className="text-red-500">*</span>
              </label>
              <input
                autoFocus
                type="text"
                value={formData.groupName}
                onChange={(e) => updateField('groupName', e.target.value)}
                placeholder="e.g. Raw Material, Electrical Material, MCCB, Packaging"
                className={`w-full h-9.5 rounded-lg border bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] outline-none transition-all ${
                  errors.groupName 
                    ? 'border-red-500 focus:border-red-500 ring-1 ring-red-500/20' 
                    : 'border-[var(--app-border)] focus:border-[var(--app-accent)]'
                }`}
              />
              {errors.groupName && (
                <p className="text-[10px] font-bold text-red-500 flex items-center gap-1 mt-0.5">
                  <AlertCircle size={11} />
                  <span>{errors.groupName}</span>
                </p>
              )}
            </div>

            {/* Stock Group Code */}
            <div className="space-y-1">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                Stock Group Code
              </label>
              <input
                type="text"
                value={formData.groupCode}
                onChange={(e) => updateField('groupCode', e.target.value.toUpperCase())}
                placeholder="e.g. GRP001"
                className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-mono font-bold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] transition-all"
              />
            </div>

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

            {/* Under / Parent Stock Group */}
            <div className="md:col-span-4 space-y-1 relative">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                Under / Parent Stock Group
              </label>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowParentDropdown(p => !p)}
                  className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] flex items-center justify-between outline-none hover:border-[var(--app-accent)] transition-all"
                >
                  <span className="truncate">{formData.parentGroup}</span>
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
                        placeholder="Search parent stock group..."
                        className="w-full h-7.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] pl-7 pr-2 text-xs text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                      />
                    </div>

                    <div className="max-h-40 overflow-y-auto no-scrollbar space-y-0.5">
                      {filteredParents.map(parentName => (
                        <button
                          key={parentName}
                          type="button"
                          onClick={() => {
                            updateField('parentGroup', parentName);
                            setShowParentDropdown(false);
                            setParentSearchQuery('');
                          }}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                            formData.parentGroup === parentName 
                              ? 'bg-[var(--app-accent-soft)] text-[var(--app-accent)] font-bold' 
                              : 'hover:bg-[var(--app-control-hover)] text-[var(--app-text)]'
                          }`}
                        >
                          <span>{parentName}</span>
                          {formData.parentGroup === parentName && <Check size={12} />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* SECTION 2: INVENTORY CONFIGURATION (Rendered if active in Configure Form) */}
        {config.cfgInventoryConfig && (
          <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-5 shadow-xs space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2.5">
              <div className="flex items-center gap-2 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
                <Settings size={15} />
                <span>2. INVENTORY CONFIGURATION</span>
              </div>
              <span className="text-[10px] font-medium text-[var(--app-muted)]">Units & Valuation Rules</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                  Base Unit
                </label>
                <select
                  value={formData.baseUnits}
                  onChange={(e) => updateField('baseUnits', e.target.value)}
                  className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2.5 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] transition-all"
                >
                  {unitsList.map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                  Additional Unit
                </label>
                <select
                  value={formData.additionalUnits}
                  onChange={(e) => updateField('additionalUnits', e.target.value)}
                  className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2.5 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] transition-all"
                >
                  <option value="Not Applicable">Not Applicable</option>
                  {unitsList.map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                  Costing Method
                </label>
                <select
                  value={formData.costingMethod}
                  onChange={(e) => updateField('costingMethod', e.target.value)}
                  className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2.5 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] transition-all"
                >
                  {COSTING_METHODS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                  Valuation Method
                </label>
                <select
                  value={formData.valuationMethod}
                  onChange={(e) => updateField('valuationMethod', e.target.value)}
                  className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2.5 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] transition-all"
                >
                  {VALUATION_METHODS.map(v => (
                    <option key={v.value} value={v.value}>{v.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 3: STOCK BEHAVIOUR (Rendered if active in Configure Form) */}
        {config.cfgStockBehaviour && (
          <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-5 shadow-xs space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2.5">
              <div className="flex items-center gap-2 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
                <Sliders size={15} />
                <span>3. STOCK BEHAVIOUR</span>
              </div>
              <span className="text-[10px] font-medium text-[var(--app-muted)]">Inventory Control Switches</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              <label className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] hover:bg-[var(--app-control-hover)] cursor-pointer select-none transition-colors">
                <span className="font-semibold text-[var(--app-heading)] text-[11px]">Track Batches</span>
                <input
                  type="checkbox"
                  checked={formData.trackBatches}
                  onChange={(e) => updateField('trackBatches', e.target.checked)}
                  className="w-4 h-4 rounded accent-[var(--app-accent)] cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] hover:bg-[var(--app-control-hover)] cursor-pointer select-none transition-colors">
                <span className="font-semibold text-[var(--app-heading)] text-[11px]">Track Godown</span>
                <input
                  type="checkbox"
                  checked={formData.trackGodown}
                  onChange={(e) => updateField('trackGodown', e.target.checked)}
                  className="w-4 h-4 rounded accent-[var(--app-accent)] cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] hover:bg-[var(--app-control-hover)] cursor-pointer select-none transition-colors">
                <span className="font-semibold text-[var(--app-heading)] text-[11px]">Batch-wise Details</span>
                <input
                  type="checkbox"
                  checked={formData.isBatchWiseOn}
                  onChange={(e) => updateField('isBatchWiseOn', e.target.checked)}
                  className="w-4 h-4 rounded accent-[var(--app-accent)] cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] hover:bg-[var(--app-control-hover)] cursor-pointer select-none transition-colors">
                <span className="font-semibold text-[var(--app-heading)] text-[11px]">Allow Negative Stock</span>
                <input
                  type="checkbox"
                  checked={formData.allowNegativeStock}
                  onChange={(e) => updateField('allowNegativeStock', e.target.checked)}
                  className="w-4 h-4 rounded accent-[var(--app-accent)] cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] hover:bg-[var(--app-control-hover)] cursor-pointer select-none transition-colors">
                <span className="font-semibold text-[var(--app-heading)] text-[11px]">Perishable Stock</span>
                <input
                  type="checkbox"
                  checked={formData.isPersishableOn}
                  onChange={(e) => updateField('isPersishableOn', e.target.checked)}
                  className="w-4 h-4 rounded accent-[var(--app-accent)] cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] hover:bg-[var(--app-control-hover)] cursor-pointer select-none transition-colors">
                <span className="font-semibold text-[var(--app-heading)] text-[11px]">Allow Direct Item Creation (Addable)</span>
                <input
                  type="checkbox"
                  checked={formData.isAddable}
                  onChange={(e) => updateField('isAddable', e.target.checked)}
                  className="w-4 h-4 rounded accent-[var(--app-accent)] cursor-pointer"
                />
              </label>
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
          onClick={handleSubmit}
          className="px-5 py-2 rounded-lg bg-[var(--app-accent)] text-white text-xs font-bold shadow-sm hover:opacity-90 transition-all flex items-center gap-1.5"
        >
          <CheckCircle2 size={14} />
          <span>{isEdit ? 'Update Stock Group' : 'Save Stock Group'}</span>
        </button>
      </div>

      {/* 4. CONFIGURE FORM MODAL DIALOG */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-3">
              <div className="flex items-center gap-2 text-[var(--app-heading)] font-extrabold text-sm">
                <Settings size={16} className="text-[var(--app-accent)]" />
                <span>Configure Stock Group Form</span>
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
              Enable or disable optional form sections. Active items will render directly on the form UI.
            </p>

            <div className="space-y-2 text-xs">
              <label className="flex items-center justify-between p-2.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-control-bg)] hover:bg-[var(--app-control-hover)] cursor-pointer">
                <span className="font-semibold text-[var(--app-heading)]">Inventory Configuration (Units & Costing)</span>
                <input
                  type="checkbox"
                  checked={config.cfgInventoryConfig}
                  onChange={(e) => setConfig(prev => ({ ...prev, cfgInventoryConfig: e.target.checked }))}
                  className="w-4 h-4 rounded accent-[var(--app-accent)]"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-control-bg)] hover:bg-[var(--app-control-hover)] cursor-pointer">
                <span className="font-semibold text-[var(--app-heading)]">Stock Behaviour (Batches & Negative Stock)</span>
                <input
                  type="checkbox"
                  checked={config.cfgStockBehaviour}
                  onChange={(e) => setConfig(prev => ({ ...prev, cfgStockBehaviour: e.target.checked }))}
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
