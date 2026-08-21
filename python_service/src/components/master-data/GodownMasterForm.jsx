import React, { useState, useMemo } from 'react';
import { 
  Building2, ArrowLeft, CheckCircle2, AlertCircle, MapPin
} from 'lucide-react';
import { toast } from 'sonner';

// Standard Indian States List
export const INDIAN_STATES = [
  'Andaman & Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar',
  'Chandigarh', 'Chhattisgarh', 'Dadra & Nagar Haveli', 'Daman & Diu', 'Delhi',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu & Kashmir', 'Jharkhand',
  'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra',
  'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry',
  'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal'
];

export const LOCATION_TYPES = [
  'Warehouse', 'Store', 'Shop', 'Branch', 'Factory', 'Site', 'Cold Storage', 'Other'
];

// Helper to check circular parent relationships in Godowns
const isCircularParentGodown = (selectedParentName, currentGodownName, godownsList) => {
  if (!selectedParentName || !currentGodownName || selectedParentName === 'Primary' || selectedParentName === 'Primary / Root Godown') {
    return false;
  }
  
  if (selectedParentName.toLowerCase().trim() === currentGodownName.toLowerCase().trim()) {
    return true; // Self-parent
  }

  let curr = selectedParentName;
  const visited = new Set();

  while (curr && curr !== 'Primary' && curr !== 'Primary / Root Godown') {
    if (curr.toLowerCase().trim() === currentGodownName.toLowerCase().trim()) {
      return true; // Circular dependency detected!
    }
    if (visited.has(curr.toLowerCase().trim())) {
      break;
    }
    visited.add(curr.toLowerCase().trim());

    const parentObj = (godownsList || []).find(g => 
      (g.godownName || g.name || '').toLowerCase().trim() === curr.toLowerCase().trim()
    );
    if (!parentObj) break;

    curr = parentObj.parentName || parentObj.parentGodown || parentObj.parentCategory || 'Primary';
  }

  return false;
};

/**
 * GodownMasterForm
 * Standalone, universal Tally Prime-style Godown Master form.
 * Saves exclusively to the `godownEntries` MongoDB collection.
 */
export default function GodownMasterForm({
  initialData = null,
  isEdit = false,
  godownsList = [],
  onSave,
  onClose
}) {
  // Form State
  const [formData, setFormData] = useState(() => {
    if (initialData) {
      const pName = initialData.parentName || initialData.parentGodown || initialData.parentCategory || 'Primary';
      return {
        godownName: initialData.godownName || initialData.name || '',
        alias: initialData.alias || '',
        parentGodown: pName === 'Primary / Root Godown' ? 'Primary' : pName,
        locationType: initialData.locationType || 'Warehouse',
        address: initialData.address || '',
        stateName: initialData.stateName || initialData.state || '',
        pincode: initialData.pincode || '',
        status: (initialData.status || 'ACTIVE').toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE'
      };
    }

    return {
      godownName: '',
      alias: '',
      parentGodown: 'Primary',
      locationType: 'Warehouse',
      address: '',
      stateName: '',
      pincode: '',
      status: 'ACTIVE'
    };
  });

  const [errors, setErrors] = useState({});

  // Active Parent Godown Options
  const parentGodownOptions = useMemo(() => {
    const set = new Set(['Primary']);
    (godownsList || []).forEach(g => {
      if (!g) return;
      const gStatus = (g.status || 'ACTIVE').toUpperCase();
      const gName = g.godownName || g.name;
      if (gStatus === 'ACTIVE' && gName && typeof gName === 'string' && gName.trim() && gName !== 'Primary') {
        set.add(gName.trim());
      }
    });
    return Array.from(set).sort();
  }, [godownsList]);

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
    const cleanName = formData.godownName.trim();
    const currentId = initialData?._id || initialData?.id;

    if (!cleanName) {
      newErrors.godownName = 'Godown / Warehouse Name is required';
    } else {
      // Case-insensitive duplicate check within company in godownEntries
      const duplicate = (godownsList || []).find(g => {
        if (!g) return false;
        const gId = g._id || g.id;
        if (currentId && gId && String(gId) === String(currentId)) return false;

        const existingName = (g.godownName || g.name || '').trim().toLowerCase();
        return existingName === cleanName.toLowerCase();
      });

      if (duplicate) {
        newErrors.godownName = `Godown "${cleanName}" already exists in godownEntries`;
      }
    }

    // Check Self & Circular Parent
    if (formData.parentGodown && formData.parentGodown !== 'Primary') {
      if (isEdit && formData.parentGodown.toLowerCase().trim() === cleanName.toLowerCase()) {
        newErrors.parentGodown = 'A Godown cannot be its own parent';
      } else if (isEdit && isCircularParentGodown(formData.parentGodown, cleanName, godownsList)) {
        newErrors.parentGodown = `Selecting "${formData.parentGodown}" creates a circular parent relationship`;
      }
    }

    // Pincode validation if provided
    if (formData.pincode && formData.pincode.trim()) {
      const pinClean = formData.pincode.trim();
      if (!/^\d{6}$/.test(pinClean)) {
        newErrors.pincode = 'Pincode must be a 6-digit number';
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

    const parentName = formData.parentGodown === 'Primary / Root Godown' || !formData.parentGodown ? 'Primary' : formData.parentGodown;
    const parentObj = (godownsList || []).find(g => (g.godownName || g.name) === parentName);

    const level = parentName === 'Primary' ? 0 : (parentObj?.level !== undefined ? parentObj.level + 1 : 1);
    const godownPath = parentName === 'Primary'
      ? formData.godownName.trim()
      : `${parentObj?.godownPath || parentName} / ${formData.godownName.trim()}`;

    const payload = {
      _id: initialData?._id || initialData?.id,
      id: initialData?._id || initialData?.id,
      sourceCollection: 'godownEntries',

      godownName: formData.godownName.trim(),
      name: formData.godownName.trim(),
      alias: formData.alias.trim() || null,

      parentId: parentName === 'Primary' ? null : (parentObj?._id || parentObj?.id || null),
      parentName: parentName === 'Primary' ? null : parentName,
      parentGodown: parentName,

      godownPath: godownPath,
      level: level,

      locationType: formData.locationType || 'Warehouse',
      address: formData.address.trim() || null,
      stateName: formData.stateName || null,
      pincode: formData.pincode.trim() || null,

      status: formData.status,
      source: 'MANUAL'
    };

    if (onSave) {
      onSave(payload);
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
            title="Back to Godowns List"
          >
            <ArrowLeft size={15} />
          </button>
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--app-muted)]">
              <span>Inventory</span>
              <span>/</span>
              <span>Godowns</span>
              <span>/</span>
              <span className="text-[var(--app-accent)]">{isEdit ? 'Edit' : 'New'}</span>
            </div>
            <h1 className="text-base font-extrabold text-[var(--app-heading)] tracking-tight">
              {isEdit ? `Edit: ${formData.godownName || 'Godown'}` : 'Create Godown / Warehouse'}
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
            <span>{isEdit ? 'Update Godown' : 'Save Godown'}</span>
          </button>
        </div>
      </div>

      {/* 2. Main Form Body */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 flex justify-center">
        <form onSubmit={handleSubmit} className="w-full max-w-xl space-y-4">
          
          {/* Card 1: Basic Information */}
          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-4 md:p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-[var(--app-border)] pb-2.5 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
              <Building2 size={15} />
              <span>Basic Information</span>
            </div>

            {/* Row 1: Godown Name & Alias */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                  Godown / Warehouse Name <span className="text-rose-500">*</span>
                </label>
                <input
                  autoFocus
                  type="text"
                  value={formData.godownName}
                  onChange={(e) => updateField('godownName', e.target.value)}
                  placeholder="e.g. Main Warehouse, Raw Material Store, Cold Storage"
                  className={`w-full h-9 rounded-lg border bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] outline-none transition-all ${
                    errors.godownName 
                      ? 'border-rose-500 focus:border-rose-500 ring-1 ring-rose-500/20' 
                      : 'border-[var(--app-border)] focus:border-[var(--app-accent)]'
                  }`}
                />
                {errors.godownName && (
                  <p className="text-[10px] font-bold text-rose-500 mt-0.5 flex items-center gap-1">
                    <AlertCircle size={11} />
                    <span>{errors.godownName}</span>
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
                  placeholder="e.g. Main WH, RM Store"
                  className="w-full h-9 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                />
              </div>
            </div>

            {/* Row 2: Under Godown */}
            <div className="space-y-1">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                Parent Godown
              </label>
              <select
                value={formData.parentGodown}
                onChange={(e) => updateField('parentGodown', e.target.value)}
                className={`w-full h-9 rounded-lg border bg-[var(--app-control-bg)] px-2.5 text-xs font-bold text-[var(--app-heading)] outline-none transition-all cursor-pointer ${
                  errors.parentGodown ? 'border-rose-500' : 'border-[var(--app-border)] focus:border-[var(--app-accent)]'
                }`}
              >
                <option value="Primary">Primary (Root Level Godown)</option>
                {parentGodownOptions
                  .filter(g => g !== 'Primary' && (!isEdit || g.toLowerCase().trim() !== formData.godownName.toLowerCase().trim()))
                  .map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
              </select>
              {errors.parentGodown && (
                <p className="text-[10px] font-bold text-rose-500 mt-0.5">{errors.parentGodown}</p>
              )}
            </div>
          </div>

          {/* Card 2: Location Details (Optional) */}
          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-4 md:p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-[var(--app-border)] pb-2.5 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
              <MapPin size={15} />
              <span>Location Details (Optional)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Location Type */}
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                  Location Type
                </label>
                <select
                  value={formData.locationType}
                  onChange={(e) => updateField('locationType', e.target.value)}
                  className="w-full h-9 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2.5 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] cursor-pointer"
                >
                  {LOCATION_TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* State */}
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                  State
                </label>
                <select
                  value={formData.stateName}
                  onChange={(e) => updateField('stateName', e.target.value)}
                  className="w-full h-9 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2.5 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] cursor-pointer"
                >
                  <option value="">-- Select State --</option>
                  {INDIAN_STATES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Pincode */}
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                  Pincode
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={formData.pincode}
                  onChange={(e) => updateField('pincode', e.target.value)}
                  placeholder="e.g. 400001"
                  className={`w-full h-9 rounded-lg border bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] outline-none transition-all ${
                    errors.pincode ? 'border-rose-500' : 'border-[var(--app-border)] focus:border-[var(--app-accent)]'
                  }`}
                />
                {errors.pincode && (
                  <p className="text-[10px] font-bold text-rose-500 mt-0.5">{errors.pincode}</p>
                )}
              </div>
            </div>

            {/* Address */}
            <div className="space-y-1">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                Address
              </label>
              <textarea
                rows={2}
                value={formData.address}
                onChange={(e) => updateField('address', e.target.value)}
                placeholder="e.g. Plot No. 12, Industrial Area, Phase II"
                className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] p-2.5 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] resize-none"
              />
            </div>
          </div>

          {/* Card 3: Status */}
          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-4 md:p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-extrabold text-[var(--app-heading)] uppercase tracking-wider">Status</h3>
                <p className="text-[10px] font-semibold text-[var(--app-muted)]">Inactive Godowns are hidden from new voucher selections</p>
              </div>
              <select
                value={formData.status}
                onChange={(e) => updateField('status', e.target.value)}
                className="h-9 px-3 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] text-xs font-bold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] cursor-pointer"
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>

        </form>
      </div>

      {/* 3. Sticky Bottom Action Bar */}
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
          <span>{isEdit ? 'Update Godown' : 'Save Godown'}</span>
        </button>
      </div>

    </div>
  );
}
