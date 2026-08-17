import React, { useState, useEffect, useMemo } from 'react';
import { 
  Layers, Search, ChevronDown, Check, ArrowLeft, Save, 
  CheckCircle2, AlertCircle, Settings, Plus, Trash2, X, Sliders, Hash
} from 'lucide-react';
import { toast } from 'sonner';

/**
 * UnitMasterForm
 * Component for creating and editing Measurement Units in the Masters module.
 * Takes full screen width, supports Base Unit vs Derived Unit conditional logic,
 * GST flags, and a dynamic repeatable Alternate Units table.
 */
export default function UnitMasterForm({
  initialData = null,
  isEdit = false,
  unitsList = [],
  onSave,
  onClose
}) {
  // Configure Form Modal Preferences (Persisted in localStorage)
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [config, setConfig] = useState(() => {
    const saved = localStorage.getItem('unit_form_config');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      cfgConversion: true,
      cfgGstSettings: true,
      cfgAlternateUnits: true
    };
  });

  useEffect(() => {
    localStorage.setItem('unit_form_config', JSON.stringify(config));
  }, [config]);

  // Form State
  const [formData, setFormData] = useState({
    unitName: '',
    symbol: '',
    unitCode: '',
    unitType: 'Base Unit', // 'Base Unit' or 'Derived / Alternate Unit'
    baseUnit: '',
    conversionFactor: '',
    decimalPlaces: 2,
    isGstExcluded: false,
    status: 'ACTIVE'
  });

  // Base Unit Search State
  const [baseUnitSearchQuery, setBaseUnitSearchQuery] = useState('');
  const [showBaseUnitDropdown, setShowBaseUnitDropdown] = useState(false);

  // Dynamic Repeatable Alternate Units Table
  const [alternateUnits, setAlternateUnits] = useState([]);

  // Errors
  const [errors, setErrors] = useState({});

  // Pre-fill on Edit / Auto-generate code on Create
  useEffect(() => {
    if (isEdit && initialData) {
      const isBase = initialData.conversion?.isBaseUnit ?? (initialData.isBaseUnit !== false);
      setFormData({
        unitName: initialData.unitName || initialData.name || '',
        symbol: initialData.symbol || initialData.unitSymbol || '',
        unitCode: initialData.unitCode || initialData.code || '',
        unitType: isBase ? 'Base Unit' : 'Derived / Alternate Unit',
        baseUnit: initialData.conversion?.baseUnit || initialData.baseUnit || '',
        conversionFactor: initialData.conversion?.conversionFactor || initialData.conversionFactor || '',
        decimalPlaces: initialData.conversion?.decimalPlaces ?? initialData.decimalPlaces ?? 2,
        isGstExcluded: initialData.flags?.isGstExcluded ?? initialData.isGstExcluded ?? false,
        status: (initialData.status || 'ACTIVE').toUpperCase()
      });

      if (initialData.alternateUnits && Array.isArray(initialData.alternateUnits)) {
        setAlternateUnits(initialData.alternateUnits.map((a, i) => ({
          id: i + 1,
          unitName: typeof a === 'string' ? a : (a.unitName || a.name || ''),
          conversionFactor: typeof a === 'string' ? 1 : (a.conversionFactor || 1)
        })));
      }
    } else {
      const nextNum = Math.floor(1000 + Math.random() * 9000);
      setFormData(prev => ({
        ...prev,
        unitCode: `UNIT-${nextNum}`
      }));
    }
  }, [isEdit, initialData]);

  // Field Update Helper
  const updateField = (key, val) => {
    setFormData(prev => ({ ...prev, [key]: val }));
    if (errors[key]) {
      setErrors(prev => ({ ...prev, [key]: null }));
    }
  };

  // Alternate Units Handlers
  const addAlternateUnitRow = () => {
    setAlternateUnits(prev => [
      ...prev,
      { id: Date.now(), unitName: unitsList[0]?.unitName || unitsList[0] || 'Gram', conversionFactor: 1000 }
    ]);
  };

  const updateAlternateUnitRow = (id, field, val) => {
    setAlternateUnits(prev => prev.map(a => (a.id === id ? { ...a, [field]: val } : a)));
  };

  const deleteAlternateUnitRow = (id) => {
    setAlternateUnits(prev => prev.filter(a => a.id !== id));
  };

  // Validation
  const validate = () => {
    const newErrors = {};
    if (!formData.unitName.trim()) {
      newErrors.unitName = 'Unit Name is required';
    }
    if (!formData.symbol.trim()) {
      newErrors.symbol = 'Symbol is required';
    }
    if (formData.unitType === 'Derived / Alternate Unit') {
      if (!formData.baseUnit) {
        newErrors.baseUnit = 'Base Unit selection is required for derived unit';
      }
      if (!formData.conversionFactor || parseFloat(formData.conversionFactor) <= 0) {
        newErrors.conversionFactor = 'Valid conversion factor is required';
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

    const isBase = formData.unitType === 'Base Unit';

    const payload = {
      _id: initialData?._id || initialData?.id,
      id: initialData?._id || initialData?.id,
      sourceCollection: initialData?.sourceCollection || 'units_entry',
      unitName: formData.unitName.trim(),
      symbol: formData.symbol.trim(),
      unitCode: formData.unitCode.trim(),

      conversion: {
        isBaseUnit: isBase,
        baseUnit: isBase ? null : formData.baseUnit,
        conversionFactor: isBase ? 0 : parseFloat(formData.conversionFactor) || 0,
        decimalPlaces: parseInt(formData.decimalPlaces, 10) || 0
      },

      flags: {
        asOriginal: false,
        isDeleted: false,
        isGstExcluded: formData.isGstExcluded
      },

      alternateUnits: alternateUnits.map(a => ({
        unitName: a.unitName,
        conversionFactor: parseFloat(a.conversionFactor) || 1
      })),

      status: formData.status
    };

    onSave(payload);
    toast.success(isEdit ? 'Unit Master updated successfully!' : 'Unit Master created successfully!');
  };

  // Filter Available Base Units for Dropdown
  const filteredBaseUnits = useMemo(() => {
    const unitNames = unitsList.map(u => typeof u === 'string' ? u : (u.unitName || u.name || '')).filter(Boolean);
    const available = Array.from(new Set(unitNames.filter(u => u.toLowerCase() !== formData.unitName.toLowerCase())));
    
    const q = baseUnitSearchQuery.toLowerCase().trim();
    if (!q) return available;
    return available.filter(u => u.toLowerCase().includes(q));
  }, [unitsList, baseUnitSearchQuery, formData.unitName]);

  return (
    <div className="h-full w-full flex flex-col bg-[var(--app-content-bg)] text-[var(--app-text)] font-sans overflow-hidden animate-in fade-in duration-300">
      
      {/* 1. Header Navigation Bar (Full Width) */}
      <div className="shrink-0 px-6 py-3.5 border-b border-[var(--app-border)] bg-[var(--app-panel-bg)] flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg border border-[var(--app-border)] hover:bg-[var(--app-control-hover)] text-[var(--app-text)] transition-colors"
            title="Back to Units List"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--app-muted)]">
              <span>Masters</span>
              <span>/</span>
              <span>Unit</span>
              <span>/</span>
              <span className="text-[var(--app-accent)] font-bold">{isEdit ? 'Edit' : 'Create'}</span>
            </div>
            <h1 className="text-base md:text-xl font-extrabold text-[var(--app-heading)] tracking-tight">
              {isEdit ? 'Edit Unit Master' : 'Create Unit Master'}
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
            <span>{isEdit ? 'Update Unit' : 'Save Unit'}</span>
          </button>
        </div>
      </div>

      {/* 2. Full Width Form Body */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-6 w-full space-y-5">
        
        {/* SECTION 1: BASIC INFORMATION */}
        <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2.5">
            <div className="flex items-center gap-2 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
              <Layers size={15} />
              <span>1. BASIC INFORMATION</span>
            </div>
            <span className="text-[10px] font-semibold text-[var(--app-muted)]">* Required fields</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            {/* Unit Name * */}
            <div className="md:col-span-2 space-y-1">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                Unit Name <span className="text-red-500">*</span>
              </label>
              <input
                autoFocus
                type="text"
                value={formData.unitName}
                onChange={(e) => updateField('unitName', e.target.value)}
                placeholder="e.g. Kilogram, Gram, Ton, Numbers, Box, Packet, Pieces"
                className={`w-full h-9.5 rounded-lg border bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] outline-none transition-all ${
                  errors.unitName 
                    ? 'border-red-500 focus:border-red-500 ring-1 ring-red-500/20' 
                    : 'border-[var(--app-border)] focus:border-[var(--app-accent)]'
                }`}
              />
              {errors.unitName && (
                <p className="text-[10px] font-bold text-red-500 flex items-center gap-1 mt-0.5">
                  <AlertCircle size={11} />
                  <span>{errors.unitName}</span>
                </p>
              )}
            </div>

            {/* Symbol * */}
            <div className="space-y-1">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                Symbol <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.symbol}
                onChange={(e) => updateField('symbol', e.target.value)}
                placeholder="e.g. kg, g, Tonnes, Nos, Box, Pcs"
                className={`w-full h-9.5 rounded-lg border bg-[var(--app-control-bg)] px-3 text-xs font-bold text-[var(--app-heading)] outline-none transition-all ${
                  errors.symbol 
                    ? 'border-red-500 focus:border-red-500 ring-1 ring-red-500/20' 
                    : 'border-[var(--app-border)] focus:border-[var(--app-accent)]'
                }`}
              />
              {errors.symbol && (
                <p className="text-[10px] font-bold text-red-500 flex items-center gap-1 mt-0.5">
                  <AlertCircle size={11} />
                  <span>{errors.symbol}</span>
                </p>
              )}
            </div>

            {/* Unit Code */}
            <div className="space-y-1">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                Unit Code
              </label>
              <input
                type="text"
                value={formData.unitCode}
                onChange={(e) => updateField('unitCode', e.target.value.toUpperCase())}
                placeholder="e.g. UNIT-0001"
                className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-mono font-bold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
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
                className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2.5 text-xs font-bold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
          </div>
        </div>

        {/* SECTION 2: UNIT CONFIGURATION */}
        {config.cfgConversion && (
          <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-5 shadow-xs space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2.5">
              <div className="flex items-center gap-2 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
                <Sliders size={15} />
                <span>2. UNIT CONFIGURATION & CONVERSION</span>
              </div>
              <span className="text-[10px] font-medium text-[var(--app-muted)]">Base Unit vs Derived Unit</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {/* Unit Type Toggle */}
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                  Unit Type
                </label>
                <select
                  value={formData.unitType}
                  onChange={(e) => updateField('unitType', e.target.value)}
                  className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2.5 text-xs font-bold text-[var(--app-accent)] outline-none focus:border-[var(--app-accent)]"
                >
                  <option value="Base Unit">Base Unit</option>
                  <option value="Derived / Alternate Unit">Derived / Alternate Unit</option>
                </select>
              </div>

              {/* Decimal Places */}
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                  Decimal Places
                </label>
                <select
                  value={formData.decimalPlaces}
                  onChange={(e) => updateField('decimalPlaces', parseInt(e.target.value, 10))}
                  className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2.5 text-xs font-bold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                >
                  <option value={0}>0 (Whole Numbers - e.g. 10 Pcs)</option>
                  <option value={1}>1 (e.g. 10.5 Kg)</option>
                  <option value={2}>2 (Standard - e.g. 10.25 Gram)</option>
                  <option value={3}>3 (Precision - e.g. 10.125 Ton)</option>
                  <option value={4}>4 (High Precision)</option>
                </select>
              </div>

              {/* WHEN DERIVED / ALTERNATE UNIT IS SELECTED */}
              {formData.unitType === 'Derived / Alternate Unit' && (
                <>
                  {/* Base Unit Selection * */}
                  <div className="space-y-1 relative animate-in fade-in duration-200">
                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                      Base Unit <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowBaseUnitDropdown(p => !p)}
                        className={`w-full h-9.5 rounded-lg border bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] flex items-center justify-between outline-none hover:border-[var(--app-accent)] ${
                          errors.baseUnit ? 'border-red-500' : 'border-[var(--app-border)]'
                        }`}
                      >
                        <span className="truncate">{formData.baseUnit || 'Select Base Unit...'}</span>
                        <ChevronDown size={14} className="text-[var(--app-muted)] shrink-0" />
                      </button>

                      {showBaseUnitDropdown && (
                        <div className="absolute left-0 right-0 top-10 z-30 rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] shadow-xl p-2 space-y-2">
                          <div className="relative">
                            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--app-muted)]" />
                            <input
                              type="text"
                              value={baseUnitSearchQuery}
                              onChange={(e) => setBaseUnitSearchQuery(e.target.value)}
                              placeholder="Search base unit..."
                              className="w-full h-7.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] pl-7 pr-2 text-xs text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                            />
                          </div>

                          <div className="max-h-40 overflow-y-auto no-scrollbar space-y-0.5">
                            {filteredBaseUnits.map(bName => (
                              <button
                                key={bName}
                                type="button"
                                onClick={() => {
                                  updateField('baseUnit', bName);
                                  setShowBaseUnitDropdown(false);
                                  setBaseUnitSearchQuery('');
                                }}
                                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                                  formData.baseUnit === bName 
                                    ? 'bg-[var(--app-accent-soft)] text-[var(--app-accent)] font-bold' 
                                    : 'hover:bg-[var(--app-control-hover)] text-[var(--app-text)]'
                                }`}
                              >
                                <span>{bName}</span>
                                {formData.baseUnit === bName && <Check size={12} />}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    {errors.baseUnit && (
                      <p className="text-[10px] font-bold text-red-500 mt-0.5">{errors.baseUnit}</p>
                    )}
                  </div>

                  {/* Conversion Factor * */}
                  <div className="md:col-span-3 space-y-1 pt-2 border-t border-[var(--app-border)] animate-in fade-in duration-200">
                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                      Conversion Factor * (1 {formData.baseUnit || '[Base Unit]'} = ? {formData.unitName || '[Current Unit]'})
                    </label>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-[var(--app-muted)] whitespace-nowrap">
                        1 {formData.baseUnit || '[Base Unit]'} =
                      </span>
                      <input
                        type="number"
                        value={formData.conversionFactor}
                        onChange={(e) => updateField('conversionFactor', e.target.value)}
                        placeholder="e.g. 1000"
                        className={`w-48 h-9.5 rounded-lg border bg-[var(--app-control-bg)] px-3 text-xs font-bold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] ${
                          errors.conversionFactor ? 'border-red-500' : 'border-[var(--app-border)]'
                        }`}
                      />
                      <span className="text-xs font-extrabold text-[var(--app-heading)]">
                        {formData.unitName || '[Current Unit]'}
                      </span>
                    </div>
                    {errors.conversionFactor && (
                      <p className="text-[10px] font-bold text-red-500 mt-0.5">{errors.conversionFactor}</p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* SECTION 3: GST SETTING & DYNAMIC ALTERNATE UNITS */}
        <div className="space-y-4">
          {/* GST Setting */}
          {config.cfgGstSettings && (
            <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-5 shadow-xs space-y-4 animate-in fade-in duration-300">
              <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2.5">
                <div className="flex items-center gap-2 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
                  <Hash size={15} />
                  <span>3. GST TAX SETTING</span>
                </div>
                <span className="text-[10px] font-medium text-[var(--app-muted)]">GST Exclusion Flag</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <label className="flex items-center justify-between p-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-control-bg)] hover:bg-[var(--app-control-hover)] cursor-pointer select-none">
                  <div>
                    <span className="font-bold text-[var(--app-heading)] block">Exclude Unit from GST Calculations</span>
                    <span className="text-[10px] text-[var(--app-muted)]">When enabled, items with this unit will be exempted from GST valuation</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.isGstExcluded}
                    onChange={(e) => updateField('isGstExcluded', e.target.checked)}
                    className="w-4 h-4 rounded accent-[var(--app-accent)] cursor-pointer"
                  />
                </label>
              </div>
            </div>
          )}

          {/* Dynamic Alternate Units Table */}
          {config.cfgAlternateUnits && (
            <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-5 shadow-xs space-y-4 animate-in fade-in duration-300">
              <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2.5">
                <div className="flex items-center gap-2 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
                  <Plus size={15} />
                  <span>REPEATABLE ALTERNATE UNITS MAPPING</span>
                </div>
                <button
                  type="button"
                  onClick={addAlternateUnitRow}
                  className="px-3 py-1 rounded-lg bg-[var(--app-accent-soft)] text-[var(--app-accent)] font-bold text-xs hover:opacity-90 transition-all flex items-center gap-1"
                >
                  <Plus size={13} />
                  <span>Add Alternate Unit</span>
                </button>
              </div>

              {alternateUnits.length === 0 ? (
                <p className="text-xs text-[var(--app-muted)] italic py-2">No alternate units mapped yet. Click "+ Add Alternate Unit" to configure.</p>
              ) : (
                <div className="overflow-x-auto no-scrollbar">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--app-border)] text-[10px] font-extrabold uppercase text-[var(--app-muted)] bg-[var(--app-control-bg)]">
                        <th className="p-2.5 rounded-l-lg">Alternate Unit Name</th>
                        <th className="p-2.5">Conversion Factor</th>
                        <th className="p-2.5 text-center rounded-r-lg">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--app-border)]">
                      {alternateUnits.map((au) => (
                        <tr key={au.id} className="hover:bg-[var(--app-control-hover)] transition-colors">
                          <td className="p-2">
                            <input
                              type="text"
                              value={au.unitName}
                              onChange={(e) => updateAlternateUnitRow(au.id, 'unitName', e.target.value)}
                              placeholder="Unit Name"
                              className="w-full h-8 rounded border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2 text-xs font-semibold"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              value={au.conversionFactor}
                              onChange={(e) => updateAlternateUnitRow(au.id, 'conversionFactor', e.target.value)}
                              placeholder="1"
                              className="w-full h-8 rounded border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2 text-xs font-bold"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => deleteAlternateUnitRow(au.id)}
                              className="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                              title="Delete Alternate Unit"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
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
          <span>{isEdit ? 'Update Unit' : 'Save Unit'}</span>
        </button>
      </div>

      {/* 4. CONFIGURE FORM MODAL DIALOG */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-3">
              <div className="flex items-center gap-2 text-[var(--app-heading)] font-extrabold text-sm">
                <Settings size={16} className="text-[var(--app-accent)]" />
                <span>Configure Unit Master Form</span>
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
                <span className="font-semibold text-[var(--app-heading)]">Unit Configuration & Conversion</span>
                <input
                  type="checkbox"
                  checked={config.cfgConversion}
                  onChange={(e) => setConfig(prev => ({ ...prev, cfgConversion: e.target.checked }))}
                  className="w-4 h-4 rounded accent-[var(--app-accent)]"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-control-bg)] hover:bg-[var(--app-control-hover)] cursor-pointer">
                <span className="font-semibold text-[var(--app-heading)]">GST Tax Setting Section</span>
                <input
                  type="checkbox"
                  checked={config.cfgGstSettings}
                  onChange={(e) => setConfig(prev => ({ ...prev, cfgGstSettings: e.target.checked }))}
                  className="w-4 h-4 rounded accent-[var(--app-accent)]"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-control-bg)] hover:bg-[var(--app-control-hover)] cursor-pointer">
                <span className="font-semibold text-[var(--app-heading)]">Repeatable Alternate Units Section</span>
                <input
                  type="checkbox"
                  checked={config.cfgAlternateUnits}
                  onChange={(e) => setConfig(prev => ({ ...prev, cfgAlternateUnits: e.target.checked }))}
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
