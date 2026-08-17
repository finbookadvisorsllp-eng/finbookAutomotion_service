import React, { useState, useEffect } from 'react';
import { Layers, ArrowLeft, Save, X, RotateCcw, Info, Check, ChevronDown, Settings, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * LedgerGroupMasterForm
 * Form component for creating and editing Ledger Groups in the Masters module.
 * Takes full screen width and includes a [ Configure Form ] modal for toggling form sections.
 */
export default function LedgerGroupMasterForm({
  initialData = null,
  isEdit = false,
  ledgerGroupsList = [],
  onSave,
  onClose
}) {
  // Configure Form Modal Preferences (Persisted in localStorage)
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [config, setConfig] = useState(() => {
    const saved = localStorage.getItem('ledger_group_form_config');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      cfgGroupNature: true,
      cfgSubTypes: true
    };
  });

  useEffect(() => {
    localStorage.setItem('ledger_group_form_config', JSON.stringify(config));
  }, [config]);

  const resolveParentGroup = (data) => {
    if (!data) return 'Primary / Root Group';
    const isObjectId = (str) => typeof str === 'string' && /^[0-9a-fA-F]{24}$/.test(str);
    if (data.parentGroup && typeof data.parentGroup === 'string' && !isObjectId(data.parentGroup)) {
      return data.parentGroup;
    }
    if (data.parentGroupName && typeof data.parentGroupName === 'string' && !isObjectId(data.parentGroupName)) {
      return data.parentGroupName;
    }
    if (typeof data.parentGroup === 'object' && data.parentGroup?.groupName) {
      return data.parentGroup.groupName;
    }
    return 'Primary / Root Group';
  };

  const [formData, setFormData] = useState(() => {
    if (initialData) {
      return {
        groupName: initialData.groupName || initialData.ledgerGroupName || initialData.name || '',
        groupCode: initialData.groupCode || `GRP-${String((ledgerGroupsList?.length || 0) + 1).padStart(4, '0')}`,
        parentGroup: resolveParentGroup(initialData),
        status: (initialData.status || 'ACTIVE').toUpperCase(),
        isDebitPositive: initialData.behaviour?.isDebitPositive ?? initialData.isDebitPositive ?? true,
        isRevenue: initialData.behaviour?.isRevenue ?? initialData.isRevenue ?? false,
        isStock: initialData.behaviour?.isStock ?? initialData.isStock ?? false,
        isBillWiseOn: initialData.behaviour?.isBillWiseOn ?? initialData.isBillWiseOn ?? false,
        classification: typeof initialData.nature === 'object' ? (initialData.nature?.classification || 'EXPENSES') : (initialData.nature || initialData.classification || 'EXPENSES'),
        subType: typeof initialData.nature === 'object' ? (initialData.nature?.subType || 'INDIRECT_EXPENSES') : (initialData.subType || 'INDIRECT_EXPENSES'),
        affectsGrossProfit: initialData.nature?.affectsGrossProfit ?? initialData.affectsGrossProfit ?? false,
        affectsNetProfit: initialData.nature?.affectsNetProfit ?? initialData.affectsNetProfit ?? true,
      };
    }
    return {
      groupName: '',
      groupCode: `GRP-${String((ledgerGroupsList?.length || 0) + 1).padStart(4, '0')}`,
      parentGroup: 'Primary / Root Group',
      status: 'ACTIVE',
      isDebitPositive: true,
      isRevenue: false,
      isStock: false,
      isBillWiseOn: false,
      classification: 'EXPENSES',
      subType: 'INDIRECT_EXPENSES',
      affectsGrossProfit: false,
      affectsNetProfit: true,
    };
  });

  const [errors, setErrors] = useState({});

  // Dynamic Custom Creation States
  const [customClassifications, setCustomClassifications] = useState(['ASSETS', 'LIABILITIES', 'EXPENSES', 'INCOME']);
  const [customSubTypes, setCustomSubTypes] = useState([
    'CURRENT_ASSETS', 'FIXED_ASSETS', 'CURRENT_LIABILITIES', 'SUNDRY_DEBTORS',
    'SUNDRY_CREDITORS', 'DIRECT_EXPENSES', 'INDIRECT_EXPENSES', 'DIRECT_INCOME', 'INDIRECT_INCOME'
  ]);

  const [showAddCustomClass, setShowAddCustomClass] = useState(false);
  const [newCustomClassInput, setNewCustomClassInput] = useState('');

  const [showAddCustomSubType, setShowAddCustomSubType] = useState(false);
  const [newCustomSubTypeInput, setNewCustomSubTypeInput] = useState('');

  const handleAddCustomClassification = () => {
    const val = newCustomClassInput.trim().toUpperCase().replace(/\s+/g, '_');
    if (!val) return;
    if (!customClassifications.includes(val)) {
      setCustomClassifications(prev => [...prev, val]);
    }
    setFormData(prev => ({ ...prev, classification: val }));
    setNewCustomClassInput('');
    setShowAddCustomClass(false);
    toast.success(`Custom classification "${val}" added!`);
  };

  const handleAddCustomSubType = () => {
    const val = newCustomSubTypeInput.trim().toUpperCase().replace(/\s+/g, '_');
    if (!val) return;
    if (!customSubTypes.includes(val)) {
      setCustomSubTypes(prev => [...prev, val]);
    }
    setFormData(prev => ({ ...prev, subType: val }));
    setNewCustomSubTypeInput('');
    setShowAddCustomSubType(false);
    toast.success(`Custom sub-type "${val}" added!`);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.groupName.trim()) {
      newErrors.groupName = 'Group Name is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) {
      toast.error('Please fix the errors in the form.');
      return;
    }

    const payload = {
      _id: initialData?._id || initialData?.id,
      id: initialData?._id || initialData?.id,
      sourceCollection: initialData?.sourceCollection || 'groups_entry',
      groupName: formData.groupName.trim(),
      groupCode: formData.groupCode.trim(),
      parentGroup: formData.parentGroup,
      status: formData.status,
      behaviour: {
        isDebitPositive: formData.isDebitPositive,
        isRevenue: formData.isRevenue,
        isStock: formData.isStock,
        isBillWiseOn: formData.isBillWiseOn,
      },
      nature: {
        classification: formData.classification,
        subType: formData.subType,
        affectsGrossProfit: formData.affectsGrossProfit,
        affectsNetProfit: formData.affectsNetProfit,
      }
    };

    if (onSave) {
      onSave(payload);
      toast.success(isEdit ? 'Ledger Group updated successfully!' : 'Ledger Group created successfully!');
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
            title="Back to Ledger Groups List"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--app-muted)]">
              <span>Masters</span>
              <span>/</span>
              <span>Ledger Group</span>
              <span>/</span>
              <span className="text-[var(--app-accent)] font-bold">{isEdit ? 'Edit' : 'Create'}</span>
            </div>
            <h1 className="text-base md:text-xl font-extrabold text-[var(--app-heading)] tracking-tight">
              {isEdit ? 'Edit Ledger Group Master' : 'Create Ledger Group Master'}
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
            <span>{isEdit ? 'Update Group' : 'Save Group'}</span>
          </button>
        </div>
      </div>

      {/* 2. Full Width Form Body */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-6 w-full space-y-5">
        
        {/* BASIC GROUP DETAILS */}
        <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2.5">
            <div className="flex items-center gap-2 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
              <Layers size={15} />
              <span>BASIC GROUP IDENTIFICATION</span>
            </div>
            <span className="text-[10px] font-semibold text-[var(--app-muted)]">* Required fields</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            {/* Group Name * */}
            <div className="md:col-span-2 space-y-1">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                Ledger Group Name <span className="text-red-500">*</span>
              </label>
              <input
                autoFocus
                type="text"
                name="groupName"
                value={formData.groupName}
                onChange={handleChange}
                placeholder="e.g. Sundry Debtors, Direct Expenses, Bank Accounts"
                className={`w-full h-9.5 rounded-lg border bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] outline-none transition-all ${
                  errors.groupName 
                    ? 'border-red-500 focus:border-red-500 ring-1 ring-red-500/20' 
                    : 'border-[var(--app-border)] focus:border-[var(--app-accent)]'
                }`}
              />
              {errors.groupName && (
                <p className="text-[10px] font-bold text-red-500 mt-0.5">{errors.groupName}</p>
              )}
            </div>

            {/* Group Code */}
            <div className="space-y-1">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                Group Code
              </label>
              <input
                type="text"
                name="groupCode"
                value={formData.groupCode}
                onChange={handleChange}
                placeholder="e.g. GRP-0001"
                className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-mono font-bold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
              />
            </div>

            {/* Status */}
            <div className="space-y-1">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                Status
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2.5 text-xs font-bold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>

            {/* Parent Group */}
            <div className="md:col-span-4 space-y-1">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                Under / Parent Group
              </label>
              <select
                name="parentGroup"
                value={formData.parentGroup}
                onChange={handleChange}
                className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2.5 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
              >
                <option value="Primary / Root Group">Primary / Root Group</option>
                {ledgerGroupsList.map(g => {
                  const gName = g.groupName || g.name || g;
                  return <option key={gName} value={gName}>{gName}</option>;
                })}
              </select>
            </div>
          </div>
        </div>

        {/* ACCOUNTING NATURE (Rendered if active in Configure Form) */}
        {config.cfgGroupNature && (
          <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-5 shadow-xs space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2.5">
              <div className="flex items-center gap-2 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
                <Layers size={15} />
                <span>ACCOUNTING NATURE & CLASSIFICATION</span>
              </div>
              <span className="text-[10px] font-medium text-[var(--app-muted)]">Financial Statement Mapping</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Classification */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                    Primary Classification
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAddCustomClass(p => !p)}
                    className="text-[10px] font-bold text-[var(--app-accent)] hover:underline"
                  >
                    + Add Custom
                  </button>
                </div>

                {showAddCustomClass ? (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={newCustomClassInput}
                      onChange={(e) => setNewCustomClassInput(e.target.value)}
                      placeholder="e.g. LIQUID_FUNDS"
                      className="w-full h-8 rounded border border-[var(--app-border)] px-2 text-xs font-bold text-[var(--app-heading)]"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomClassification}
                      className="px-2.5 py-1 rounded bg-[var(--app-accent)] text-white text-xs font-bold"
                    >
                      Add
                    </button>
                  </div>
                ) : (
                  <select
                    name="classification"
                    value={formData.classification}
                    onChange={handleChange}
                    className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2.5 text-xs font-bold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                  >
                    {customClassifications.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Sub Type */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                    Sub Type
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAddCustomSubType(p => !p)}
                    className="text-[10px] font-bold text-[var(--app-accent)] hover:underline"
                  >
                    + Add Custom
                  </button>
                </div>

                {showAddCustomSubType ? (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={newCustomSubTypeInput}
                      onChange={(e) => setNewCustomSubTypeInput(e.target.value)}
                      placeholder="e.g. OPERATING_EXPENSES"
                      className="w-full h-8 rounded border border-[var(--app-border)] px-2 text-xs font-bold text-[var(--app-heading)]"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomSubType}
                      className="px-2.5 py-1 rounded bg-[var(--app-accent)] text-white text-xs font-bold"
                    >
                      Add
                    </button>
                  </div>
                ) : (
                  <select
                    name="subType"
                    value={formData.subType}
                    onChange={handleChange}
                    className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2.5 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                  >
                    {customSubTypes.map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                )}
              </div>
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
          <span>{isEdit ? 'Update Group' : 'Save Group'}</span>
        </button>
      </div>

      {/* 4. CONFIGURE FORM MODAL DIALOG */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-3">
              <div className="flex items-center gap-2 text-[var(--app-heading)] font-extrabold text-sm">
                <Settings size={16} className="text-[var(--app-accent)]" />
                <span>Configure Ledger Group Form</span>
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
                <span className="font-semibold text-[var(--app-heading)]">Accounting Nature & Classification</span>
                <input
                  type="checkbox"
                  checked={config.cfgGroupNature}
                  onChange={(e) => setConfig(prev => ({ ...prev, cfgGroupNature: e.target.checked }))}
                  className="w-4 h-4 rounded accent-[var(--app-accent)]"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-control-bg)] hover:bg-[var(--app-control-hover)] cursor-pointer">
                <span className="font-semibold text-[var(--app-heading)]">Sub Type Selection</span>
                <input
                  type="checkbox"
                  checked={config.cfgSubTypes}
                  onChange={(e) => setConfig(prev => ({ ...prev, cfgSubTypes: e.target.checked }))}
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
