import React, { useState, useEffect, useMemo } from 'react';
import { 
  Layers, Plus, Trash2, X, Search, ChevronDown, Check, ArrowLeft, Save, 
  CheckCircle2, FolderTree, AlertCircle, Sparkles, Building2, Settings, Package, Info
} from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '../../lib/apiClient';

export default function BomMasterForm({
  initialData = null,
  isEdit = false,
  stockItemsList = [],
  unitsList = [],
  godownsList = [],
  bomsList = [],
  onSave,
  onClose
}) {
  // Form State
  const [formData, setFormData] = useState({
    bomName: '',
    bomCode: '',
    version: 'v1',
    finishedItemId: '',
    finishedItemName: '',
    baseQuantity: 1,
    baseUnitId: '',
    baseUnit: 'Pcs',
    defaultProductionGodownId: '',
    defaultProductionGodownName: '',
    effectiveFrom: '',
    effectiveTo: '',
    status: 'ACTIVE',
    isActive: true,
    description: '',
    components: [
      {
        itemId: '',
        itemName: '',
        quantity: 1,
        unitId: '',
        unitName: 'Pcs',
        scrapPercentage: 0,
        sourceGodownId: '',
        sourceGodownName: '',
        notes: ''
      }
    ]
  });

  // Searchable Dropdown States
  const [showFinishedDropdown, setShowFinishedDropdown] = useState(false);
  const [finishedSearchQuery, setFinishedSearchQuery] = useState('');

  const [activeCompDropdownIndex, setActiveCompDropdownIndex] = useState(null);
  const [compSearchQuery, setCompSearchQuery] = useState('');

  // Errors & Saving State
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Pre-fill on Edit / Auto-generate code on Create
  useEffect(() => {
    if (initialData) {
      const activeState = initialData.isActive !== undefined 
        ? !!initialData.isActive 
        : (initialData.status || 'ACTIVE').toUpperCase() === 'ACTIVE';

      const rawItems = initialData.components || initialData.items || [];
      const parsedComponents = rawItems.length > 0 ? rawItems.map(c => ({
        itemId: c.itemId || c.id || '',
        itemName: c.itemName || c.stockItemName || '',
        quantity: c.quantity ?? c.actualQty ?? c.qty ?? 1,
        unitId: c.unitId || '',
        unitName: c.unitName || c.unit || 'Pcs',
        scrapPercentage: c.scrapPercentage ?? c.scrap ?? 0,
        sourceGodownId: c.sourceGodownId || '',
        sourceGodownName: c.sourceGodownName || c.sourceGodown || '',
        notes: c.notes || ''
      })) : [
        {
          itemId: '',
          itemName: '',
          quantity: 1,
          unitId: '',
          unitName: 'Pcs',
          scrapPercentage: 0,
          sourceGodownId: '',
          sourceGodownName: '',
          notes: ''
        }
      ];

      setFormData({
        bomName: initialData.bomName || initialData.name || '',
        bomCode: initialData.bomCode || initialData.code || '',
        version: initialData.version || 'v1',
        finishedItemId: initialData.finishedItemId || '',
        finishedItemName: initialData.finishedItemName || initialData.stockItemName || '',
        baseQuantity: initialData.baseQuantity ?? initialData.basicQty ?? 1,
        baseUnitId: initialData.baseUnitId || '',
        baseUnit: initialData.baseUnit || initialData.unit || 'Pcs',
        defaultProductionGodownId: initialData.defaultProductionGodownId || '',
        defaultProductionGodownName: initialData.defaultProductionGodownName || initialData.defaultProductionGodown || '',
        effectiveFrom: initialData.effectiveFrom || '',
        effectiveTo: initialData.effectiveTo || '',
        status: (initialData.status || 'ACTIVE').toUpperCase(),
        isActive: activeState,
        description: initialData.description || initialData.notes || '',
        components: parsedComponents
      });
    } else {
      const nextNum = (bomsList.length + 1).toString().padStart(4, '0');
      setFormData(prev => ({
        ...prev,
        bomCode: `BOM-${nextNum}`
      }));
    }
  }, [initialData, bomsList.length]);

  // Selected Finished Item Details (Read-only metadata)
  const selectedFinishedItemDoc = useMemo(() => {
    if (!formData.finishedItemName) return null;
    return stockItemsList.find(s => {
      const sName = s.itemName || s.name || '';
      return sName.toLowerCase() === formData.finishedItemName.toLowerCase();
    });
  }, [stockItemsList, formData.finishedItemName]);

  // Field Update Helper
  const updateField = (key, val) => {
    setFormData(prev => ({ ...prev, [key]: val }));
    if (errors[key]) {
      setErrors(prev => ({ ...prev, [key]: null }));
    }
  };

  // Finished Item Selection Handler
  const handleSelectFinishedItem = (itemDoc) => {
    const name = itemDoc.itemName || itemDoc.name || '';
    const unit = itemDoc.uom || itemDoc.unit || itemDoc.unitName || 'Pcs';
    const itemId = itemDoc._id || itemDoc.id || '';

    setFormData(prev => ({
      ...prev,
      finishedItemId: itemId,
      finishedItemName: name,
      baseUnit: unit,
      bomName: prev.bomName ? prev.bomName : `${name} Standard Recipe`
    }));

    setShowFinishedDropdown(false);
    setFinishedSearchQuery('');
    if (errors.finishedItemName) {
      setErrors(prev => ({ ...prev, finishedItemName: null }));
    }
  };

  // Component Item Handlers
  const addComponentRow = () => {
    setFormData(prev => ({
      ...prev,
      components: [
        ...prev.components,
        {
          itemId: '',
          itemName: '',
          quantity: 1,
          unitId: '',
          unitName: 'Pcs',
          scrapPercentage: 0,
          sourceGodownId: '',
          sourceGodownName: '',
          notes: ''
        }
      ]
    }));
  };

  const removeComponentRow = (index) => {
    if (formData.components.length <= 1) {
      toast.error('BOM must contain at least 1 component item.');
      return;
    }
    setFormData(prev => ({
      ...prev,
      components: prev.components.filter((_, i) => i !== index)
    }));
  };

  const updateComponentRow = (index, field, val) => {
    setFormData(prev => {
      const updated = [...prev.components];
      updated[index] = { ...updated[index], [field]: val };
      return { ...prev, components: updated };
    });
  };

  const handleSelectComponentItem = (index, itemDoc) => {
    const cName = itemDoc.itemName || itemDoc.name || '';
    const cUnit = itemDoc.uom || itemDoc.unit || itemDoc.unitName || 'Pcs';
    const cId = itemDoc._id || itemDoc.id || '';

    if (formData.finishedItemName && cName.toLowerCase() === formData.finishedItemName.toLowerCase()) {
      toast.error(`Finished Item "${cName}" cannot be added as its own component!`);
      return;
    }

    const isDuplicate = formData.components.some((c, i) => i !== index && c.itemName.toLowerCase() === cName.toLowerCase());
    if (isDuplicate) {
      toast.error(`Component "${cName}" is already added to this BOM.`);
      return;
    }

    setFormData(prev => {
      const updated = [...prev.components];
      updated[index] = {
        ...updated[index],
        itemId: cId,
        itemName: cName,
        unitName: cUnit
      };
      return { ...prev, components: updated };
    });

    setActiveCompDropdownIndex(null);
    setCompSearchQuery('');
  };

  // Filtered Lists
  const filteredFinishedItems = useMemo(() => {
    const q = finishedSearchQuery.toLowerCase().trim();
    if (!q) return stockItemsList;
    return stockItemsList.filter(s => {
      const name = (s.itemName || s.name || '').toLowerCase();
      const code = (s.itemCode || s.code || '').toLowerCase();
      return name.includes(q) || code.includes(q);
    });
  }, [stockItemsList, finishedSearchQuery]);

  const filteredComponentItems = useMemo(() => {
    const q = compSearchQuery.toLowerCase().trim();
    const available = stockItemsList.filter(s => {
      const name = s.itemName || s.name || '';
      return name.toLowerCase() !== formData.finishedItemName.toLowerCase();
    });
    if (!q) return available;
    return available.filter(s => {
      const name = (s.itemName || s.name || '').toLowerCase();
      const code = (s.itemCode || s.code || '').toLowerCase();
      return name.includes(q) || code.includes(q);
    });
  }, [stockItemsList, compSearchQuery, formData.finishedItemName]);

  // Validation
  const validate = () => {
    const newErrors = {};
    const trimmedBomName = formData.bomName.trim();
    const trimmedFinishedName = formData.finishedItemName.trim();

    if (!trimmedBomName) {
      newErrors.bomName = 'BOM Name is required';
    }

    if (!trimmedFinishedName) {
      newErrors.finishedItemName = 'Finished Item is required';
    }

    if (!formData.baseQuantity || formData.baseQuantity <= 0) {
      newErrors.baseQuantity = 'Base Quantity must be greater than 0';
    }

    if (!formData.components || formData.components.length === 0) {
      newErrors.components = 'At least 1 component item is required';
    } else {
      const invalidComp = formData.components.find(c => !c.itemName.trim() || c.quantity <= 0);
      if (invalidComp) {
        newErrors.components = 'All component rows must have a selected Item and Quantity > 0';
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
        sourceCollection: initialData?.sourceCollection || 'boms_entry',
        bomCode: formData.bomCode.trim(),
        bomName: formData.bomName.trim(),
        name: formData.bomName.trim(),
        version: formData.version.trim() || 'v1',
        finishedItemId: formData.finishedItemId,
        finishedItemName: formData.finishedItemName.trim(),
        stockItemName: formData.finishedItemName.trim(),
        baseQuantity: parseFloat(formData.baseQuantity) || 1,
        basicQty: parseFloat(formData.baseQuantity) || 1,
        baseUnitId: formData.baseUnitId,
        baseUnit: formData.baseUnit,
        unit: formData.baseUnit,
        defaultProductionGodownId: formData.defaultProductionGodownId,
        defaultProductionGodownName: formData.defaultProductionGodownName,
        effectiveFrom: formData.effectiveFrom || null,
        effectiveTo: formData.effectiveTo || null,
        status: formData.isActive ? 'ACTIVE' : 'INACTIVE',
        isActive: formData.isActive,
        description: formData.description.trim(),
        items: formData.components,
        components: formData.components,
        isWebEntry: true
      };

      if (onSave) {
        onSave(payload);
      } else {
        if (isEdit && (initialData?._id || initialData?.id)) {
          const id = initialData._id || initialData.id;
          await apiClient.put(`/masters/boms/${id}`, payload, { headers });
          toast.success(`BOM "${formData.bomName}" updated successfully`);
        } else {
          await apiClient.post('/masters/boms', payload, { headers });
          toast.success(`BOM "${formData.bomName}" created successfully`);
        }
      }

      if (onClose) onClose();
    } catch (err) {
      console.error('Error saving BOM master:', err);
      toast.error(err.response?.data?.detail || 'Failed to save BOM Master');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-[var(--app-content-bg)] text-[var(--app-text)] font-sans overflow-hidden animate-in fade-in duration-300">
      
      {/* 1. Header Navigation Bar (Full Width) */}
      <div className="shrink-0 px-6 py-3.5 border-b border-[var(--app-border)] bg-[var(--app-panel-bg)] flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg border border-[var(--app-border)] hover:bg-[var(--app-control-hover)] text-[var(--app-text)] transition-colors"
            title="Back to BOM List"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--app-muted)]">
              <span>Masters</span>
              <span>/</span>
              <span>BOM</span>
              <span>/</span>
              <span className="text-[var(--app-accent)] font-bold">{isEdit ? 'Edit' : 'Create'}</span>
            </div>
            <h1 className="text-base md:text-xl font-extrabold text-[var(--app-heading)] tracking-tight">
              {isEdit ? 'Edit Bill of Materials (BOM)' : 'Create Bill of Materials (BOM)'}
            </h1>
          </div>
        </div>

        {/* Header Action Controls */}
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
            <span>{saving ? 'Saving...' : (isEdit ? 'Update BOM' : 'Save BOM')}</span>
          </button>
        </div>
      </div>

      {/* 2. Form Body */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-6 w-full space-y-5">
        
        {/* SECTION 1: BASIC INFORMATION */}
        <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2.5">
            <div className="flex items-center gap-2 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
              <Package size={15} />
              <span>Basic Information &amp; Finished Item</span>
            </div>
            <span className="text-[10px] font-semibold text-[var(--app-muted)]">* Required fields</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            
            {/* BOM Name * */}
            <div className="md:col-span-2 space-y-1">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                BOM Name <span className="text-red-500">*</span>
              </label>
              <input
                autoFocus
                type="text"
                value={formData.bomName}
                onChange={(e) => updateField('bomName', e.target.value)}
                placeholder="e.g. Standard Dosa Recipe, 100ml Syrup Formula"
                className={`w-full h-9.5 rounded-lg border bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] outline-none transition-all ${
                  errors.bomName 
                    ? 'border-red-500 focus:border-red-500 ring-1 ring-red-500/20' 
                    : 'border-[var(--app-border)] focus:border-[var(--app-accent)]'
                }`}
              />
              {errors.bomName && (
                <p className="text-[10px] font-bold text-red-500 flex items-center gap-1 mt-0.5">
                  <AlertCircle size={11} />
                  <span>{errors.bomName}</span>
                </p>
              )}
            </div>

            {/* BOM Code */}
            <div className="space-y-1">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                BOM Code
              </label>
              <input
                type="text"
                value={formData.bomCode}
                onChange={(e) => updateField('bomCode', e.target.value.toUpperCase())}
                placeholder="e.g. BOM-0001"
                className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-mono font-bold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] transition-all"
              />
            </div>

            {/* Version */}
            <div className="space-y-1">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                Version
              </label>
              <input
                type="text"
                value={formData.version}
                onChange={(e) => updateField('version', e.target.value)}
                placeholder="e.g. v1, v2"
                className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] transition-all"
              />
            </div>

            {/* Target Finished Item * (Searchable Dropdown) */}
            <div className="md:col-span-2 space-y-1 relative">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                Target Finished Item <span className="text-red-500">*</span>
              </label>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowFinishedDropdown(p => !p)}
                  className={`w-full h-9.5 rounded-lg border bg-[var(--app-control-bg)] px-3 text-xs font-bold text-[var(--app-heading)] flex items-center justify-between outline-none hover:border-[var(--app-accent)] transition-all ${
                    errors.finishedItemName ? 'border-red-500' : 'border-[var(--app-border)]'
                  }`}
                >
                  <span className="truncate">
                    {formData.finishedItemName || 'Select Finished Stock Item...'}
                  </span>
                  <ChevronDown size={14} className="text-[var(--app-muted)] shrink-0" />
                </button>

                {errors.finishedItemName && (
                  <p className="text-[10px] font-bold text-red-500 flex items-center gap-1 mt-0.5">
                    <AlertCircle size={11} />
                    <span>{errors.finishedItemName}</span>
                  </p>
                )}

                {showFinishedDropdown && (
                  <div className="absolute left-0 right-0 top-10 z-30 rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] shadow-2xl p-2 space-y-2">
                    <div className="relative">
                      <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--app-muted)]" />
                      <input
                        type="text"
                        autoFocus
                        value={finishedSearchQuery}
                        onChange={(e) => setFinishedSearchQuery(e.target.value)}
                        placeholder="Search stock item..."
                        className="w-full h-7.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] pl-7 pr-2 text-xs text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                      />
                    </div>

                    <div className="max-h-48 overflow-y-auto no-scrollbar space-y-0.5">
                      {filteredFinishedItems.map(item => {
                        const name = item.itemName || item.name || '';
                        const code = item.itemCode || item.code || '';
                        return (
                          <button
                            key={item._id || name}
                            type="button"
                            onClick={() => handleSelectFinishedItem(item)}
                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                              formData.finishedItemName === name 
                                ? 'bg-[var(--app-accent-soft)] text-[var(--app-accent)] font-bold' 
                                : 'hover:bg-[var(--app-control-hover)] text-[var(--app-text)]'
                            }`}
                          >
                            <div>
                              <span>{name}</span>
                              {code && <span className="ml-2 text-[10px] font-mono text-[var(--app-muted)]">({code})</span>}
                            </div>
                            {formData.finishedItemName === name && <Check size={12} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
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

          </div>

          {/* Read-Only Reference Metadata of Selected Finished Item */}
          {selectedFinishedItemDoc && (
            <div className="mt-3 p-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-control-bg)] grid grid-cols-2 md:grid-cols-5 gap-3 text-[11px] font-medium text-[var(--app-muted)]">
              <div><span className="font-extrabold uppercase text-[9px] block">Group</span> <span className="text-[var(--app-heading)] font-bold">{selectedFinishedItemDoc.stockGroupName || selectedFinishedItemDoc.group || 'General'}</span></div>
              <div><span className="font-extrabold uppercase text-[9px] block">Category</span> <span className="text-[var(--app-heading)] font-bold">{selectedFinishedItemDoc.stockCategoryName || selectedFinishedItemDoc.category || 'Not Applicable'}</span></div>
              <div><span className="font-extrabold uppercase text-[9px] block">Primary Unit</span> <span className="text-[var(--app-heading)] font-bold">{selectedFinishedItemDoc.uom || selectedFinishedItemDoc.unit || 'Pcs'}</span></div>
              <div><span className="font-extrabold uppercase text-[9px] block">HSN/SAC</span> <span className="text-[var(--app-heading)] font-bold">{selectedFinishedItemDoc.hsn || selectedFinishedItemDoc.hsnCode || 'N/A'}</span></div>
              <div><span className="font-extrabold uppercase text-[9px] block">GST Rate</span> <span className="text-[var(--app-heading)] font-bold">{selectedFinishedItemDoc.gstRate || '0%'}</span></div>
            </div>
          )}
        </div>

        {/* SECTION 2: PRODUCTION / BASE QUANTITY */}
        <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider border-b border-[var(--app-border)] pb-2.5">
            <Layers size={15} />
            <span>Production Batch &amp; Base Quantity</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {/* Base Quantity * */}
            <div className="space-y-1">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                Base Quantity <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0.0001"
                step="any"
                value={formData.baseQuantity}
                onChange={(e) => updateField('baseQuantity', parseFloat(e.target.value) || 0)}
                className={`w-full h-9.5 rounded-lg border bg-[var(--app-control-bg)] px-3 text-xs font-bold text-[var(--app-heading)] outline-none transition-all ${
                  errors.baseQuantity ? 'border-red-500' : 'border-[var(--app-border)] focus:border-[var(--app-accent)]'
                }`}
              />
              {errors.baseQuantity && (
                <p className="text-[10px] font-bold text-red-500 flex items-center gap-1 mt-0.5">
                  <AlertCircle size={11} />
                  <span>{errors.baseQuantity}</span>
                </p>
              )}
            </div>

            {/* Base Unit */}
            <div className="space-y-1">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                Unit <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.baseUnit}
                onChange={(e) => updateField('baseUnit', e.target.value)}
                className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-bold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] transition-all"
              >
                {unitsList.length > 0 ? (
                  unitsList.map(u => {
                    const uName = u.symbol || u.unitName || u.name || u;
                    return <option key={uName} value={uName}>{uName}</option>;
                  })
                ) : (
                  <>
                    <option value="Pcs">Pcs</option>
                    <option value="Kg">Kg</option>
                    <option value="g">g</option>
                    <option value="Ltr">Ltr</option>
                    <option value="Nos">Nos</option>
                    <option value="Box">Box</option>
                  </>
                )}
              </select>
            </div>

            {/* Default Production Godown */}
            <div className="space-y-1">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                Default Production Godown
              </label>
              <select
                value={formData.defaultProductionGodownName}
                onChange={(e) => {
                  const gName = e.target.value;
                  const gDoc = godownsList.find(g => (g.godownName || g.name || '') === gName);
                  setFormData(prev => ({
                    ...prev,
                    defaultProductionGodownName: gName,
                    defaultProductionGodownId: gDoc?._id || gDoc?.id || ''
                  }));
                }}
                className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] transition-all"
              >
                <option value="">-- Main Finished Goods Warehouse --</option>
                {godownsList.map(g => {
                  const name = g.godownName || g.name || '';
                  return <option key={g._id || name} value={name}>{name}</option>;
                })}
              </select>
            </div>
          </div>
        </div>

        {/* SECTION 3: BOM COMPONENTS DYNAMIC TABLE */}
        <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2.5">
            <div className="flex items-center gap-2 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
              <FolderTree size={15} />
              <span>Component Items (Raw Materials &amp; Ingredients)</span>
            </div>
            <button
              type="button"
              onClick={addComponentRow}
              className="px-3 py-1.5 rounded-lg bg-[var(--app-accent-soft)] text-[var(--app-accent)] hover:opacity-90 transition-all text-xs font-bold flex items-center gap-1 shadow-2xs"
            >
              <Plus size={13} />
              <span>Add Component</span>
            </button>
          </div>

          {errors.components && (
            <p className="text-[10px] font-bold text-red-500 flex items-center gap-1">
              <AlertCircle size={11} />
              <span>{errors.components}</span>
            </p>
          )}

          {/* Component Items Table */}
          <div className="overflow-x-auto border border-[var(--app-border)] rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[var(--app-control-bg)] border-b border-[var(--app-border)] text-[10px] font-extrabold uppercase text-[var(--app-muted)] tracking-wider">
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3 w-1/3">Component Item *</th>
                  <th className="py-2.5 px-3">Quantity *</th>
                  <th className="py-2.5 px-3">Unit</th>
                  <th className="py-2.5 px-3">Scrap %</th>
                  <th className="py-2.5 px-3">Source Godown</th>
                  <th className="py-2.5 px-3">Notes</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--app-border)]">
                {formData.components.map((comp, index) => (
                  <tr key={index} className="hover:bg-[var(--app-control-hover)]/50 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-[var(--app-muted)] text-[11px]">
                      {index + 1}
                    </td>

                    {/* Searchable Component Dropdown */}
                    <td className="py-2.5 px-3 relative">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveCompDropdownIndex(activeCompDropdownIndex === index ? null : index);
                          setCompSearchQuery('');
                        }}
                        className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2.5 text-xs font-bold text-[var(--app-heading)] flex items-center justify-between outline-none hover:border-[var(--app-accent)]"
                      >
                        <span className="truncate">{comp.itemName || 'Select Component...'}</span>
                        <ChevronDown size={13} className="text-[var(--app-muted)] shrink-0" />
                      </button>

                      {activeCompDropdownIndex === index && (
                        <div className="absolute left-0 right-0 top-11 z-40 rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] shadow-2xl p-2 space-y-2 w-72">
                          <div className="relative">
                            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--app-muted)]" />
                            <input
                              type="text"
                              autoFocus
                              value={compSearchQuery}
                              onChange={(e) => setCompSearchQuery(e.target.value)}
                              placeholder="Search raw material..."
                              className="w-full h-7.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] pl-7 pr-2 text-xs text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                            />
                          </div>

                          <div className="max-h-40 overflow-y-auto no-scrollbar space-y-0.5">
                            {filteredComponentItems.map(item => {
                              const name = item.itemName || item.name || '';
                              return (
                                <button
                                  key={item._id || name}
                                  type="button"
                                  onClick={() => handleSelectComponentItem(index, item)}
                                  className={`w-full text-left px-2.5 py-1 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                                    comp.itemName === name ? 'bg-[var(--app-accent-soft)] text-[var(--app-accent)] font-bold' : 'hover:bg-[var(--app-control-hover)] text-[var(--app-text)]'
                                  }`}
                                >
                                  <span>{name}</span>
                                  {comp.itemName === name && <Check size={12} />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Quantity */}
                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        min="0.0001"
                        step="any"
                        value={comp.quantity}
                        onChange={(e) => updateComponentRow(index, 'quantity', parseFloat(e.target.value) || 0)}
                        className="w-24 h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2 text-xs font-bold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                      />
                    </td>

                    {/* Unit */}
                    <td className="py-2.5 px-3">
                      <select
                        value={comp.unitName}
                        onChange={(e) => updateComponentRow(index, 'unitName', e.target.value)}
                        className="h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                      >
                        {unitsList.length > 0 ? (
                          unitsList.map(u => {
                            const uName = u.symbol || u.unitName || u.name || u;
                            return <option key={uName} value={uName}>{uName}</option>;
                          })
                        ) : (
                          <>
                            <option value="Pcs">Pcs</option>
                            <option value="Kg">Kg</option>
                            <option value="g">g</option>
                            <option value="Ltr">Ltr</option>
                            <option value="Nos">Nos</option>
                          </>
                        )}
                      </select>
                    </td>

                    {/* Scrap % */}
                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="any"
                        value={comp.scrapPercentage}
                        onChange={(e) => updateComponentRow(index, 'scrapPercentage', parseFloat(e.target.value) || 0)}
                        className="w-20 h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2 text-xs font-medium text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                      />
                    </td>

                    {/* Source Godown */}
                    <td className="py-2.5 px-3">
                      <select
                        value={comp.sourceGodownName}
                        onChange={(e) => {
                          const gName = e.target.value;
                          const gDoc = godownsList.find(g => (g.godownName || g.name || '') === gName);
                          updateComponentRow(index, 'sourceGodownName', gName);
                          updateComponentRow(index, 'sourceGodownId', gDoc?._id || gDoc?.id || '');
                        }}
                        className="h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                      >
                        <option value="">-- Default RM Godown --</option>
                        {godownsList.map(g => {
                          const name = g.godownName || g.name || '';
                          return <option key={g._id || name} value={name}>{name}</option>;
                        })}
                      </select>
                    </td>

                    {/* Notes */}
                    <td className="py-2.5 px-3">
                      <input
                        type="text"
                        value={comp.notes}
                        onChange={(e) => updateComponentRow(index, 'notes', e.target.value)}
                        placeholder="Optional note"
                        className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2 text-xs font-medium text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                      />
                    </td>

                    {/* Remove Action */}
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => removeComponentRow(index)}
                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
                        title="Remove Component"
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

        {/* SECTION 4: ADVANCED NOTES / DESCRIPTION */}
        <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-5 shadow-xs space-y-3">
          <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
            Description / Manufacturing Notes
          </label>
          <textarea
            rows={2}
            value={formData.description}
            onChange={(e) => updateField('description', e.target.value)}
            placeholder="Special preparation instructions or quality standards..."
            className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] p-3 text-xs font-medium text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] transition-all resize-none"
          />
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
          disabled={saving}
          onClick={handleSubmit}
          className="px-5 py-2 rounded-lg bg-[var(--app-accent)] text-white text-xs font-bold shadow-sm hover:opacity-90 transition-all flex items-center gap-1.5 disabled:opacity-50"
        >
          <CheckCircle2 size={14} />
          <span>{saving ? 'Saving...' : (isEdit ? 'Update BOM' : 'Save BOM')}</span>
        </button>
      </div>

    </div>
  );
}
