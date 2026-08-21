import React, { useState, useMemo, useEffect } from 'react';
import { Layers, ArrowLeft, Save, CheckCircle2, Info } from 'lucide-react';
import { toast } from 'sonner';

/**
 * LedgerGroupMasterForm
 * Simple, compact, Tally-style form for creating and editing Ledger Groups.
 * Contains only essential fields: Group Name, Group Type, Under/Parent Group, Nature of Group, Status.
 */
export default function LedgerGroupMasterForm({
  initialData = null,
  isEdit = false,
  ledgerGroupsList = [],
  onSave,
  onClose
}) {
  // Helper to extract group name string
  const getGroupName = (g) => {
    if (!g) return '';
    if (typeof g === 'string') return g;
    return g.groupName || g.name || g.parentGroup || '';
  };

  // Helper to resolve initial parent group
  const resolveInitialParentGroup = (data) => {
    if (!data) return 'Primary';
    const parent = data.parentGroup || data.parentGroupName;
    if (!parent || parent === 'Primary' || parent === '0' || parent === 'Root') {
      return 'Primary';
    }
    return getGroupName(parent);
  };

  // Initial state setup
  const [formData, setFormData] = useState(() => {
    if (initialData) {
      const pGroup = resolveInitialParentGroup(initialData);
      const isPrimary = pGroup === 'Primary' || initialData.groupType === 'Primary';
      const rawNature = initialData.natureOfGroup || (typeof initialData.nature === 'object' ? initialData.nature?.classification : initialData.nature) || 'Assets';
      
      let normNature = 'Assets';
      const nUpper = String(rawNature).toUpperCase();
      if (nUpper.includes('ASSET')) normNature = 'Assets';
      else if (nUpper.includes('LIABIL')) normNature = 'Liabilities';
      else if (nUpper.includes('INCOME') || nUpper.includes('REVENUE')) normNature = 'Income';
      else if (nUpper.includes('EXPENSE') || nUpper.includes('COST')) normNature = 'Expenses';

      return {
        groupName: initialData.groupName || initialData.ledgerGroupName || initialData.name || '',
        groupType: isPrimary ? 'Primary' : 'Sub Group',
        parentGroup: isPrimary ? 'Primary' : pGroup,
        natureOfGroup: normNature,
        status: (initialData.status || 'Active').toLowerCase() === 'inactive' ? 'Inactive' : 'Active'
      };
    }

    return {
      groupName: '',
      groupType: 'Sub Group',
      parentGroup: '',
      natureOfGroup: 'Assets',
      status: 'Active'
    };
  });

  const [errors, setErrors] = useState({});

  // Dynamic dropdown list of available parent groups
  const parentGroupOptions = useMemo(() => {
    const set = new Set();

    (ledgerGroupsList || []).forEach(g => {
      const name = getGroupName(g);
      if (name && typeof name === 'string' && !name.match(/^[0-9a-fA-F]{24}$/)) {
        set.add(name);
      }
    });

    // Default Tally Primary Groups if list is empty
    if (set.size === 0) {
      [
        'Sundry Debtors', 'Sundry Creditors', 'Bank Accounts', 'Cash-in-hand',
        'Duties & Taxes', 'Direct Expenses', 'Indirect Expenses', 'Direct Incomes',
        'Indirect Incomes', 'Capital Account', 'Fixed Assets', 'Current Assets',
        'Current Liabilities', 'Loans & Advances (Asset)', 'Secured Loans',
        'Unsecured Loans', 'Investments', 'Provisions', 'Reserves & Surplus',
        'Purchase Accounts', 'Sales Accounts', 'Branch / Divisions'
      ].forEach(p => set.add(p));
    }

    return Array.from(set).sort();
  }, [ledgerGroupsList]);

  // Set default parent group when switching to Sub Group if not already selected
  useEffect(() => {
    if (formData.groupType === 'Sub Group' && (!formData.parentGroup || formData.parentGroup === 'Primary')) {
      if (parentGroupOptions.length > 0) {
        setFormData(prev => ({ ...prev, parentGroup: parentGroupOptions[0] }));
      }
    }
  }, [formData.groupType, parentGroupOptions]);

  // Handle Group Type Toggle Change
  const handleGroupTypeChange = (type) => {
    setFormData(prev => ({
      ...prev,
      groupType: type,
      parentGroup: type === 'Primary' ? 'Primary' : (prev.parentGroup && prev.parentGroup !== 'Primary' ? prev.parentGroup : (parentGroupOptions[0] || ''))
    }));
    setErrors(prev => ({ ...prev, groupName: null, parentGroup: null }));
  };

  // Field updater with validation reset
  const updateField = (key, val) => {
    setFormData(prev => {
      const updated = { ...prev, [key]: val };
      
      // Sync group type if parent selection changes
      if (key === 'parentGroup') {
        if (val === 'Primary') {
          updated.groupType = 'Primary';
        } else if (prev.groupType === 'Primary') {
          updated.groupType = 'Sub Group';
        }
      }
      return updated;
    });

    if (errors[key]) {
      setErrors(prev => ({ ...prev, [key]: null }));
    }
  };

  // Validate form & check duplicates under same parent
  const validate = () => {
    const newErrors = {};

    const cleanName = formData.groupName.trim();
    if (!cleanName) {
      newErrors.groupName = 'Group Name is required';
    }

    if (formData.groupType === 'Sub Group' && (!formData.parentGroup || formData.parentGroup === 'Primary')) {
      newErrors.parentGroup = 'Under / Parent Group is required for Sub Groups';
    }

    // Duplicate Check under same Parent Group
    const targetParent = formData.groupType === 'Primary' ? 'Primary' : formData.parentGroup;
    const currentId = initialData?._id || initialData?.id;

    const isDuplicate = (ledgerGroupsList || []).some(g => {
      if (!g) return false;
      const gId = g._id || g.id;
      if (currentId && gId && String(gId) === String(currentId)) return false;

      const existingName = getGroupName(g).trim().toLowerCase();
      const existingParent = resolveInitialParentGroup(g).trim().toLowerCase();

      return existingName === cleanName.toLowerCase() && existingParent === targetParent.trim().toLowerCase();
    });

    if (isDuplicate) {
      newErrors.groupName = `Group "${cleanName}" already exists under parent "${targetParent}"`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit Handler
  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (!validate()) {
      toast.error('Please fix the errors in the form.');
      return;
    }

    const payload = {
      _id: initialData?._id || initialData?.id,
      id: initialData?._id || initialData?.id,
      sourceCollection: initialData?.sourceCollection || 'groups_entry',
      groupName: formData.groupName.trim(),
      groupType: formData.groupType,
      parentGroup: formData.groupType === 'Primary' ? 'Primary' : formData.parentGroup,
      natureOfGroup: formData.natureOfGroup,
      status: formData.status,
      
      // Standard mapping for backend/export compatibility
      nature: {
        classification: formData.natureOfGroup.toUpperCase(),
        primaryGroup: formData.groupType === 'Primary' ? 'Primary' : formData.parentGroup,
        subType: formData.groupName.trim().toUpperCase().replace(/\s+/g, '_')
      },
      behaviour: {
        isDebitPositive: ['Assets', 'Expenses'].includes(formData.natureOfGroup),
        isRevenue: ['Income', 'Expenses'].includes(formData.natureOfGroup),
        isStock: false,
        isBillWiseOn: true
      }
    };

    if (onSave) {
      onSave(payload);
      toast.success(isEdit ? `Group "${formData.groupName}" updated!` : `Group "${formData.groupName}" created!`);
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-[var(--app-panel-bg)] text-[var(--app-text)] font-sans overflow-hidden animate-in fade-in duration-200">
      
      {/* 1. Compact Header Navigation Bar */}
      <div className="shrink-0 px-5 py-3 border-b border-[var(--app-border)] bg-[var(--app-panel-bg)] flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg border border-[var(--app-border)] hover:bg-[var(--app-control-hover)] text-[var(--app-text)] transition-colors shrink-0"
            title="Back to Ledger Groups"
          >
            <ArrowLeft size={15} />
          </button>
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--app-muted)]">
              <span>Ledger Groups</span>
              <span>/</span>
              <span className="text-[var(--app-accent)]">{isEdit ? 'Edit Group' : 'New Group'}</span>
            </div>
            <h1 className="text-base font-extrabold text-[var(--app-heading)] tracking-tight">
              {isEdit ? `Edit: ${formData.groupName || 'Group'}` : 'Create Ledger Group'}
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

      {/* 2. Simple Tally-Style Form Container */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 flex justify-center">
        <form onSubmit={handleSubmit} className="w-full max-w-xl space-y-4">
          
          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-4 md:p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-[var(--app-border)] pb-2.5 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
              <Layers size={15} />
              <span>Group Details</span>
            </div>

            {/* Field 1: Group Name * */}
            <div className="space-y-1">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                Group Name <span className="text-rose-500">*</span>
              </label>
              <input
                autoFocus
                type="text"
                value={formData.groupName}
                onChange={(e) => updateField('groupName', e.target.value)}
                placeholder="e.g. Trade Debtors, Office Expenses, Current Assets"
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

            {/* Field 2: Group Type */}
            <div className="space-y-1">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                Group Type <span className="text-rose-500">*</span>
              </label>
              <div className="h-9 flex rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] p-0.5">
                <button
                  type="button"
                  onClick={() => handleGroupTypeChange('Primary')}
                  className={`flex-1 rounded-md text-xs font-bold transition-all ${
                    formData.groupType === 'Primary'
                      ? 'bg-[var(--app-accent)] text-white shadow-xs'
                      : 'text-[var(--app-muted)] hover:text-[var(--app-heading)]'
                  }`}
                >
                  Primary Group
                </button>
                <button
                  type="button"
                  onClick={() => handleGroupTypeChange('Sub Group')}
                  className={`flex-1 rounded-md text-xs font-bold transition-all ${
                    formData.groupType === 'Sub Group'
                      ? 'bg-[var(--app-accent)] text-white shadow-xs'
                      : 'text-[var(--app-muted)] hover:text-[var(--app-heading)]'
                  }`}
                >
                  Sub Group
                </button>
              </div>
            </div>

            {/* Field 3: Under / Parent Group * */}
            <div className="space-y-1">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] flex items-center justify-between">
                <span>Parent Group {formData.groupType === 'Sub Group' && <span className="text-rose-500">*</span>}</span>
                {formData.groupType === 'Primary' && (
                  <span className="text-[9px] text-[var(--app-muted)] font-semibold">(Primary Root Group)</span>
                )}
              </label>
              
              {formData.groupType === 'Primary' ? (
                <input
                  type="text"
                  disabled
                  value="Primary (Root Category)"
                  className="w-full h-9 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)]/50 px-3 text-xs font-bold text-[var(--app-muted)] cursor-not-allowed"
                />
              ) : (
                <select
                  value={formData.parentGroup}
                  onChange={(e) => updateField('parentGroup', e.target.value)}
                  className={`w-full h-9 rounded-lg border bg-[var(--app-control-bg)] px-2.5 text-xs font-bold text-[var(--app-heading)] outline-none cursor-pointer transition-all ${
                    errors.parentGroup
                      ? 'border-rose-500 focus:border-rose-500 ring-1 ring-rose-500/20'
                      : 'border-[var(--app-border)] focus:border-[var(--app-accent)]'
                  }`}
                >
                  <option value="">-- Select Parent Group --</option>
                  {parentGroupOptions.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              )}
              {errors.parentGroup && (
                <p className="text-[10px] font-bold text-rose-500 mt-0.5">{errors.parentGroup}</p>
              )}
            </div>

            {/* Field 4: Nature of Group * */}
            <div className="space-y-1">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                Group Classification <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.natureOfGroup}
                onChange={(e) => updateField('natureOfGroup', e.target.value)}
                className="w-full h-9 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2.5 text-xs font-bold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] cursor-pointer"
              >
                <option value="Assets">Assets</option>
                <option value="Liabilities">Liabilities</option>
                <option value="Income">Income</option>
                <option value="Expenses">Expenses</option>
              </select>
            </div>

            {/* Field 5: Status */}
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
          <span>{isEdit ? 'Update Group' : 'Save Group'}</span>
        </button>
      </div>

    </div>
  );
}
