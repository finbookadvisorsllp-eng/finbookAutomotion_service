import React, { useState, useEffect, useMemo } from 'react';
import { 
  Layers, ArrowLeft, CheckCircle2, Scale
} from 'lucide-react';
import { toast } from 'sonner';

// Standard GST Unique Quantity Codes (UQC)
export const GST_UQC_OPTIONS = [
  { code: 'BAG-BAGS', label: 'BAG - BAGS' },
  { code: 'BAL-BALE', label: 'BAL - BALE' },
  { code: 'BDL-BUNDLES', label: 'BDL - BUNDLES' },
  { code: 'BKL-BUCKLES', label: 'BKL - BUCKLES' },
  { code: 'BOX-BOXES', label: 'BOX - BOXES' },
  { code: 'BTL-BOTTLES', label: 'BTL - BOTTLES' },
  { code: 'CAN-CANS', label: 'CAN - CANS' },
  { code: 'DOZ-DOZENS', label: 'DOZ - DOZENS' },
  { code: 'GMS-GRAMMES', label: 'GMS - GRAMMES' },
  { code: 'KGS-KILOGRAMS', label: 'KGS - KILOGRAMS' },
  { code: 'KLR-KILOLITRE', label: 'KLR - KILOLITRE' },
  { code: 'KME-KILOMETRE', label: 'KME - KILOMETRE' },
  { code: 'MLT-MILLILITRE', label: 'MLT - MILLILITRE' },
  { code: 'MTR-METERS', label: 'MTR - METERS' },
  { code: 'NOS-NUMBERS', label: 'NOS - NUMBERS' },
  { code: 'PCS-PIECES', label: 'PCS - PIECES' },
  { code: 'PRS-PAIRS', label: 'PRS - PAIRS' },
  { code: 'QTL-QUINTAL', label: 'QTL - QUINTAL' },
  { code: 'SET-SETS', label: 'SET - SETS' },
  { code: 'SQF-SQUARE FEET', label: 'SQF - SQUARE FEET' },
  { code: 'SQM-SQUARE METERS', label: 'SQM - SQUARE METERS' },
  { code: 'TON-TONNES', label: 'TON - TONNES' },
  { code: 'UNT-UNITS', label: 'UNT - UNITS' },
  { code: 'OTH-OTHERS', label: 'OTH - OTHERS' }
];

/**
 * UnitMasterForm
 * Universal, TallyPrime-style Unit Master form supporting Simple & Compound unit types.
 */
export default function UnitMasterForm({
  initialData = null,
  isEdit = false,
  unitsList = [],
  onSave,
  onClose
}) {
  // Initial Form State
  const [formData, setFormData] = useState(() => {
    if (initialData) {
      const isComp = (initialData.unitType || initialData.type || '').toLowerCase() === 'compound' || !!initialData.firstUnitId || !!initialData.firstUnit;
      return {
        unitName: initialData.name || initialData.unitName || initialData.symbol || '',
        formalName: initialData.formalName || initialData.formal_name || '',
        unitType: isComp ? 'Compound Unit' : 'Simple Unit',
        decimalPlaces: initialData.decimalPlaces ?? 2,
        gstUqc: initialData.gstUqc || initialData.uqc || '',

        firstUnitId: initialData.firstUnitId || '',
        firstUnitName: initialData.firstUnitName || initialData.firstUnit || '',
        secondUnitId: initialData.secondUnitId || '',
        secondUnitName: initialData.secondUnitName || initialData.secondUnit || '',
        conversionFactor: initialData.conversionFactor || (initialData.compound?.conversionFactor) || '',

        status: (initialData.status || 'Active').toLowerCase() === 'inactive' ? 'Inactive' : 'Active'
      };
    }

    return {
      unitName: '',
      formalName: '',
      unitType: 'Simple Unit',
      decimalPlaces: 2,
      gstUqc: '',

      firstUnitId: '',
      firstUnitName: '',
      secondUnitId: '',
      secondUnitName: '',
      conversionFactor: '',

      status: 'Active'
    };
  });

  const [errors, setErrors] = useState({});

  // List of existing units for Compound Unit selections
  const availableUnitsForCompound = useMemo(() => {
    const list = [];
    const seen = new Set();

    (unitsList || []).forEach(u => {
      if (!u) return;
      const uId = String(u._id || u.id || u.unitGuid || u.name || '').trim();
      const uName = String(u.name || u.symbol || u.unitName || '').trim();
      if (uName && !seen.has(uName.toLowerCase())) {
        seen.add(uName.toLowerCase());
        list.push({ id: uId, name: uName });
      }
    });

    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [unitsList]);

  // Default selection for Compound Units if empty & auto-generate compound name
  useEffect(() => {
    if (formData.unitType === 'Compound Unit') {
      let fName = formData.firstUnitName;
      let fId = formData.firstUnitId;
      let sName = formData.secondUnitName;
      let sId = formData.secondUnitId;

      if (!fName && availableUnitsForCompound.length > 0) {
        const first = availableUnitsForCompound[0];
        fName = first.name;
        fId = first.id;
      }
      if (!sName && availableUnitsForCompound.length > 1) {
        const second = availableUnitsForCompound.find(u => u.name.toLowerCase() !== (fName || '').toLowerCase()) || availableUnitsForCompound[1];
        if (second) {
          sName = second.name;
          sId = second.id;
        }
      }

      const factor = formData.conversionFactor || '1000';
      const generatedName = fName && sName && factor ? `${fName} of ${factor} ${sName}` : formData.unitName;

      setFormData(prev => ({
        ...prev,
        firstUnitId: fId,
        firstUnitName: fName,
        secondUnitId: sId,
        secondUnitName: sName,
        unitName: prev.unitType === 'Compound Unit' && (!prev.unitName || prev.unitName === fName || prev.unitName.includes(' of ')) ? generatedName : prev.unitName
      }));
    }
  }, [formData.unitType, availableUnitsForCompound, formData.firstUnitName, formData.secondUnitName, formData.conversionFactor]);

  // Field updater
  const updateField = (key, val) => {
    setFormData(prev => ({ ...prev, [key]: val }));
    if (errors[key]) {
      setErrors(prev => ({ ...prev, [key]: null }));
    }
  };

  // Form Validation
  const validate = () => {
    const newErrors = {};
    const cleanName = formData.unitName.trim();
    const currentId = initialData?._id || initialData?.id;

    if (!cleanName) {
      newErrors.unitName = 'Unit Name / Symbol is required';
    } else {
      // Case-insensitive duplicate check
      const isDuplicate = (unitsList || []).some(u => {
        if (!u) return false;
        const uId = u._id || u.id;
        if (currentId && uId && String(uId) === String(currentId)) return false;

        const existingName = String(u.name || u.symbol || u.unitName || '').trim().toLowerCase();
        return existingName === cleanName.toLowerCase();
      });

      if (isDuplicate) {
        newErrors.unitName = `Unit Name / Symbol "${cleanName}" already exists (case-insensitive check)`;
      }
    }

    // Decimal places validation
    const decNum = parseInt(formData.decimalPlaces, 10);
    if (isNaN(decNum) || decNum < 0 || decNum > 4) {
      newErrors.decimalPlaces = 'Decimal Places must be between 0 and 4';
    }

    // Compound Unit Validation
    if (formData.unitType === 'Compound Unit') {
      if (!formData.firstUnitName && !formData.firstUnitId) {
        newErrors.firstUnitName = 'First Unit is required for compound unit';
      }
      if (!formData.secondUnitName && !formData.secondUnitId) {
        newErrors.secondUnitName = 'Second Unit is required for compound unit';
      }
      if (
        (formData.firstUnitName && formData.secondUnitName && formData.firstUnitName.trim().toLowerCase() === formData.secondUnitName.trim().toLowerCase()) ||
        (formData.firstUnitId && formData.secondUnitId && formData.firstUnitId === formData.secondUnitId)
      ) {
        newErrors.secondUnitName = 'First Unit and Second Unit cannot be the same';
      }
      const factorNum = parseFloat(formData.conversionFactor);
      if (!formData.conversionFactor || isNaN(factorNum) || factorNum <= 0) {
        newErrors.conversionFactor = 'Conversion factor must be greater than 0';
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

    const isCompound = formData.unitType === 'Compound Unit';

    const payload = {
      _id: initialData?._id || initialData?.id,
      id: initialData?._id || initialData?.id,
      sourceCollection: initialData?.sourceCollection || 'units_entry',
      
      name: formData.unitName.trim(),
      unitName: formData.unitName.trim(),
      symbol: formData.unitName.trim(),
      unitSymbol: formData.unitName.trim(),

      formalName: formData.formalName.trim(),
      unitType: isCompound ? 'compound' : 'simple',
      type: isCompound ? 'Compound' : 'Simple',

      decimalPlaces: parseInt(formData.decimalPlaces, 10) || 0,
      gstUqc: formData.gstUqc || '',

      // Normalized Compound Unit References
      firstUnitId: isCompound ? (formData.firstUnitId || null) : null,
      firstUnitName: isCompound ? formData.firstUnitName.trim() : null,
      firstUnit: isCompound ? formData.firstUnitName.trim() : null,

      secondUnitId: isCompound ? (formData.secondUnitId || null) : null,
      secondUnitName: isCompound ? formData.secondUnitName.trim() : null,
      secondUnit: isCompound ? formData.secondUnitName.trim() : null,

      conversionFactor: isCompound ? parseFloat(formData.conversionFactor) || 0 : null,

      compound: isCompound ? {
        firstUnit: formData.firstUnitName.trim(),
        firstUnitId: formData.firstUnitId,
        conversionFactor: parseFloat(formData.conversionFactor) || 0,
        secondUnit: formData.secondUnitName.trim(),
        secondUnitId: formData.secondUnitId
      } : null,

      conversion: {
        isBaseUnit: !isCompound,
        decimalPlaces: parseInt(formData.decimalPlaces, 10) || 0,
        conversionFactor: isCompound ? parseFloat(formData.conversionFactor) || 0 : 1.0
      },

      status: formData.status,
      flags: {
        isCompound: isCompound,
        isDeleted: false
      }
    };

    if (onSave) {
      onSave(payload);
      toast.success(isEdit ? `Unit "${formData.unitName}" updated!` : `Unit "${formData.unitName}" created!`);
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-[var(--app-panel-bg)] text-[var(--app-text)] font-sans overflow-hidden animate-in fade-in duration-200">
      
      {/* 1. Header Navigation Bar */}
      <div className="shrink-0 px-5 py-3 border-b border-[var(--app-border)] bg-[var(--app-panel-bg)] flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg border border-[var(--app-border)] hover:bg-[var(--app-control-hover)] text-[var(--app-text)] transition-colors shrink-0"
            title="Back to Units List"
          >
            <ArrowLeft size={15} />
          </button>
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--app-muted)]">
              <span>Units of Measure</span>
              <span>/</span>
              <span className="text-[var(--app-accent)]">{isEdit ? 'Edit Unit' : 'New Unit'}</span>
            </div>
            <h1 className="text-base font-extrabold text-[var(--app-heading)] tracking-tight">
              {isEdit ? `Edit: ${formData.unitName || 'Unit'}` : 'Create Unit'}
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
            <span>{isEdit ? 'Update Unit' : 'Save Unit'}</span>
          </button>
        </div>
      </div>

      {/* 2. Form Container */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 flex justify-center">
        <form onSubmit={handleSubmit} className="w-full max-w-xl space-y-4">
          
          {/* Card 1: Basic Information */}
          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-4 md:p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-[var(--app-border)] pb-2.5 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
              <Scale size={15} />
              <span>Unit Details</span>
            </div>

            {/* Field 1: Unit Name / Symbol * */}
            <div className="space-y-1">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                Unit Name / Symbol <span className="text-rose-500">*</span>
              </label>
              <input
                autoFocus
                type="text"
                value={formData.unitName}
                onChange={(e) => updateField('unitName', e.target.value)}
                placeholder="e.g. KG, PCS, MTR, LTR, KM"
                className={`w-full h-9 rounded-lg border bg-[var(--app-control-bg)] px-3 text-xs font-bold text-[var(--app-heading)] outline-none transition-all ${
                  errors.unitName 
                    ? 'border-rose-500 focus:border-rose-500 ring-1 ring-rose-500/20' 
                    : 'border-[var(--app-border)] focus:border-[var(--app-accent)]'
                }`}
              />
              {errors.unitName && (
                <p className="text-[10px] font-bold text-rose-500 mt-0.5">{errors.unitName}</p>
              )}
            </div>

            {/* Field 2: Formal Name (Optional) */}
            <div className="space-y-1">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] flex items-center justify-between">
                <span>Formal Name / Original Name</span>
                <span className="text-[9px] text-[var(--app-muted)] font-semibold">(Optional)</span>
              </label>
              <input
                type="text"
                value={formData.formalName}
                onChange={(e) => updateField('formalName', e.target.value)}
                placeholder="e.g. Kilogram, Kilometer, Pieces, Meters"
                className="w-full h-9 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
              />
            </div>

            {/* Field 3: Unit Type Dropdown */}
            <div className="space-y-1">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                Unit Type <span className="text-rose-500">*</span>
              </label>
              <div className="h-9 flex rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] p-0.5">
                <button
                  type="button"
                  onClick={() => updateField('unitType', 'Simple Unit')}
                  className={`flex-1 rounded-md text-xs font-bold transition-all ${
                    formData.unitType === 'Simple Unit'
                      ? 'bg-[var(--app-accent)] text-white shadow-xs'
                      : 'text-[var(--app-muted)] hover:text-[var(--app-heading)]'
                  }`}
                >
                  Simple Unit
                </button>
                <button
                  type="button"
                  onClick={() => updateField('unitType', 'Compound Unit')}
                  className={`flex-1 rounded-md text-xs font-bold transition-all ${
                    formData.unitType === 'Compound Unit'
                      ? 'bg-[var(--app-accent)] text-white shadow-xs'
                      : 'text-[var(--app-muted)] hover:text-[var(--app-heading)]'
                  }`}
                >
                  Compound Unit
                </button>
              </div>
            </div>

            {/* Field 4: Decimal Places & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                  Decimal Places <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.decimalPlaces}
                  onChange={(e) => updateField('decimalPlaces', parseInt(e.target.value, 10))}
                  className="w-full h-9 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2.5 text-xs font-bold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] cursor-pointer"
                >
                  <option value={0}>0 (Whole Numbers - e.g. 10 BOX)</option>
                  <option value={1}>1 (e.g. 10.5 KG)</option>
                  <option value={2}>2 (Standard Default - e.g. 10.25 MTR)</option>
                  <option value={3}>3 (Precision - e.g. 10.125 TON)</option>
                  <option value={4}>4 (High Precision)</option>
                </select>
                {errors.decimalPlaces && (
                  <p className="text-[10px] font-bold text-rose-500 mt-0.5">{errors.decimalPlaces}</p>
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

            {/* Field 5: GST UQC (Optional) */}
            <div className="space-y-1">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] flex items-center justify-between">
                <span>GST Unique Quantity Code (UQC)</span>
                <span className="text-[9px] text-[var(--app-muted)] font-semibold">(Optional)</span>
              </label>
              <select
                value={formData.gstUqc}
                onChange={(e) => updateField('gstUqc', e.target.value)}
                className="w-full h-9 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2.5 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] cursor-pointer"
              >
                <option value="">-- Select GST UQC (Optional) --</option>
                {GST_UQC_OPTIONS.map(uqc => (
                  <option key={uqc.code} value={uqc.code}>{uqc.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Conditional Compound Unit Section (Visible ONLY when Unit Type = Compound Unit) */}
          {formData.unitType === 'Compound Unit' && (
            <div className="rounded-xl border border-[var(--app-accent)]/30 bg-[var(--app-panel-bg)] p-4 md:p-5 shadow-xs space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 border-b border-[var(--app-border)] pb-2.5 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
                <Layers size={15} />
                <span>Compound Unit Setup</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* First Unit */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                    First Unit <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.firstUnitName}
                    onChange={(e) => {
                      const sel = availableUnitsForCompound.find(u => u.name === e.target.value);
                      updateField('firstUnitName', e.target.value);
                      if (sel) updateField('firstUnitId', sel.id);
                    }}
                    className={`w-full h-9 rounded-lg border bg-[var(--app-control-bg)] px-2.5 text-xs font-bold text-[var(--app-heading)] outline-none transition-all ${
                      errors.firstUnitName ? 'border-rose-500' : 'border-[var(--app-border)] focus:border-[var(--app-accent)]'
                    }`}
                  >
                    <option value="">-- Select First Unit --</option>
                    {availableUnitsForCompound.map(u => (
                      <option key={u.id} value={u.name}>{u.name}</option>
                    ))}
                  </select>
                  {errors.firstUnitName && (
                    <p className="text-[10px] font-bold text-rose-500 mt-0.5">{errors.firstUnitName}</p>
                  )}
                </div>

                {/* Conversion Factor */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                    Conversion Factor <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formData.conversionFactor}
                    onChange={(e) => updateField('conversionFactor', e.target.value)}
                    placeholder="e.g. 1000"
                    className={`w-full h-9 rounded-lg border bg-[var(--app-control-bg)] px-3 text-xs font-bold text-[var(--app-heading)] outline-none transition-all ${
                      errors.conversionFactor ? 'border-rose-500' : 'border-[var(--app-border)] focus:border-[var(--app-accent)]'
                    }`}
                  />
                  {errors.conversionFactor && (
                    <p className="text-[10px] font-bold text-rose-500 mt-0.5">{errors.conversionFactor}</p>
                  )}
                </div>

                {/* Second Unit */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                    Second Unit <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.secondUnitName}
                    onChange={(e) => {
                      const sel = availableUnitsForCompound.find(u => u.name === e.target.value);
                      updateField('secondUnitName', e.target.value);
                      if (sel) updateField('secondUnitId', sel.id);
                    }}
                    className={`w-full h-9 rounded-lg border bg-[var(--app-control-bg)] px-2.5 text-xs font-bold text-[var(--app-heading)] outline-none transition-all ${
                      errors.secondUnitName ? 'border-rose-500' : 'border-[var(--app-border)] focus:border-[var(--app-accent)]'
                    }`}
                  >
                    <option value="">-- Select Second Unit --</option>
                    {availableUnitsForCompound.map(u => (
                      <option key={u.id} value={u.name}>{u.name}</option>
                    ))}
                  </select>
                  {errors.secondUnitName && (
                    <p className="text-[10px] font-bold text-rose-500 mt-0.5">{errors.secondUnitName}</p>
                  )}
                </div>
              </div>

              {/* Conversion Rule Preview Sentence */}
              {formData.firstUnitName && formData.secondUnitName && formData.conversionFactor && (
                <div className="p-3 rounded-lg border border-[var(--app-accent)]/30 bg-[var(--app-accent-soft)]/40 flex items-center justify-between text-xs font-bold text-[var(--app-accent)]">
                  <span>Conversion Expression:</span>
                  <span className="font-mono text-sm bg-white dark:bg-black/30 px-3 py-1 rounded-md border border-[var(--app-accent)]/40">
                    1 {formData.firstUnitName} = {formData.conversionFactor} {formData.secondUnitName}
                  </span>
                </div>
              )}
            </div>
          )}

        </form>
      </div>

      {/* 3. Sticky Action Bar */}
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
          <span>{isEdit ? 'Update Unit' : 'Save Unit'}</span>
        </button>
      </div>

    </div>
  );
}
