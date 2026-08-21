import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, FileText, Settings, Hash, Printer, Sliders, ToggleLeft, ToggleRight, Check, ChevronRight, ChevronLeft, ShieldCheck, Eye } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '../../lib/apiClient';

const PARENT_VOUCHER_TYPES = [
  'Sales',
  'Sales Order',
  'Purchase',
  'Purchase Order',
  'Receipt',
  'Payment',
  'Contra',
  'Journal',
  'Debit Note',
  'Credit Note',
  'Delivery Note',
  'Receipt Note',
  'Material In',
  'Material Out',
  'Rejection In',
  'Rejection Out',
  'Stock Journal',
  'Physical Stock',
  'Attendance',
  'Payroll',
  'Memorandum',
  'Reversing Journal'
];

const NUMBERING_METHODS = [
  'Automatic',
  'Manual',
  'Automatic + Manual Override'
];

const VOUCHER_CATEGORIES = [
  'SALES',
  'PURCHASE',
  'RECEIPT',
  'PAYMENT',
  'CONTRA',
  'JOURNAL',
  'DEBIT NOTE',
  'CREDIT NOTE',
  'DELIVERY NOTE',
  'RECEIPT NOTE',
  'STOCK JOURNAL',
  'PHYSICAL STOCK'
];

const TABS = [
  { id: 'basic', label: 'Basic Information', icon: FileText },
  { id: 'behavior', label: 'Voucher Behavior', icon: ToggleRight },
  { id: 'numbering', label: 'Numbering', icon: Hash },
  { id: 'advanced', label: 'Advanced Settings', icon: Settings }
];

export default function VoucherTypeMasterForm({ onClose, initialData = null, voucherTypesList = [], onSaveSuccess }) {
  const isEdit = !!initialData;
  const [activeTab, setActiveTab] = useState('basic');

  const [formData, setFormData] = useState({
    // TAB 1: BASIC INFORMATION
    voucherTypeName: '',
    voucherTypeCode: '',
    abbreviation: '',
    parent: 'Sales',
    voucherCategory: 'SALES',
    status: 'ACTIVE',

    // TAB 2: VOUCHER BEHAVIOR
    accountingEffect: true,
    inventoryEffect: true,
    partyLedgerRequired: true,
    itemEntryAllowed: true,
    taxApplicable: true,

    // TAB 3: NUMBERING
    numberingMethod: 'Automatic', // 'Automatic' | 'Manual' | 'Automatic + Manual Override'
    startingNumber: 1,
    numberWidth: 4,
    prefix: 'INV-',
    suffix: '',

    // TAB 4: ADVANCED SETTINGS
    defaultPrintTitle: 'TAX INVOICE',
    enablePOS: false,
    posCashLedger: '',
    posCardLedger: '',
    posChequeLedger: '',
    enableCostCentre: false,
    enableBillWise: true,
    enableNarration: true
  });

  const [saving, setSaving] = useState(false);

  // Initialize data for Edit Mode
  useEffect(() => {
    if (initialData) {
      const numObj = initialData.numbering || {};
      const printObj = initialData.printing || {};
      const flagObj = initialData.flags || initialData.behavior || {};
      const vClassObj = initialData.voucherClass || {};
      const parentVal = initialData.parent || initialData.parentGroup || initialData.parentVoucherType || initialData.voucherCategory || 'Sales';

      setFormData({
        // TAB 1: BASIC INFORMATION
        voucherTypeName: initialData.voucherTypeName || initialData.name || '',
        voucherTypeCode: initialData.voucherTypeCode || initialData.code || '',
        abbreviation: initialData.abbreviation || initialData.mailingName || '',
        parent: parentVal,
        voucherCategory: (initialData.voucherCategory || getCategoryFromParent(parentVal)).toUpperCase(),
        status: (initialData.status || 'ACTIVE').toUpperCase(),

        // TAB 2: VOUCHER BEHAVIOR
        accountingEffect: !!(flagObj.accountingEffect ?? initialData.accountingEffect ?? true),
        inventoryEffect: !!(flagObj.inventoryEffect ?? initialData.inventoryEffect ?? true),
        partyLedgerRequired: !!(flagObj.partyLedgerRequired ?? initialData.partyLedgerRequired ?? true),
        itemEntryAllowed: !!(flagObj.itemEntryAllowed ?? initialData.itemEntryAllowed ?? true),
        taxApplicable: !!(flagObj.taxApplicable ?? initialData.taxApplicable ?? true),

        // TAB 3: NUMBERING
        numberingMethod: numObj.numberingMethod || initialData.numberingMethod || 'Automatic',
        startingNumber: numObj.beginningNumber ?? initialData.startingNumber ?? initialData.beginningNumber ?? 1,
        numberWidth: numObj.widthOfNumber ?? initialData.numberWidth ?? initialData.widthOfNumber ?? 4,
        prefix: numObj.prefix ?? initialData.prefix ?? 'INV-',
        suffix: numObj.suffix ?? initialData.suffix ?? '',

        // TAB 4: ADVANCED SETTINGS
        defaultPrintTitle: printObj.templateName || initialData.defaultPrintTitle || initialData.printTitle || 'TAX INVOICE',
        enablePOS: !!(initialData.enablePOS ?? (vClassObj.posCashLedger || vClassObj.posCardLedger || initialData.posCashLedger)),
        posCashLedger: vClassObj.posCashLedger || initialData.posCashLedger || '',
        posCardLedger: vClassObj.posCardLedger || initialData.posCardLedger || '',
        posChequeLedger: vClassObj.posChequeLedger || initialData.posChequeLedger || '',
        enableCostCentre: !!(initialData.enableCostCentre ?? flagObj.isCostCenter ?? false),
        enableBillWise: !!(initialData.enableBillWise ?? true),
        enableNarration: !!(initialData.enableNarration ?? flagObj.useLedgerNarrations ?? true)
      });
    }
  }, [initialData]);

  const getCategoryFromParent = (p) => {
    const parentUpper = String(p || 'Sales').toUpperCase();
    if (parentUpper.includes('SALES')) return 'SALES';
    if (parentUpper.includes('PURCHASE')) return 'PURCHASE';
    if (parentUpper.includes('RECEIPT NOTE')) return 'RECEIPT NOTE';
    if (parentUpper.includes('DELIVERY NOTE')) return 'DELIVERY NOTE';
    if (parentUpper.includes('RECEIPT')) return 'RECEIPT';
    if (parentUpper.includes('PAYMENT')) return 'PAYMENT';
    if (parentUpper.includes('CONTRA')) return 'CONTRA';
    if (parentUpper.includes('DEBIT NOTE')) return 'DEBIT NOTE';
    if (parentUpper.includes('CREDIT NOTE')) return 'CREDIT NOTE';
    if (parentUpper.includes('STOCK JOURNAL')) return 'STOCK JOURNAL';
    if (parentUpper.includes('PHYSICAL')) return 'PHYSICAL STOCK';
    return 'JOURNAL';
  };

  const handleParentChange = (newParent) => {
    const category = getCategoryFromParent(newParent);
    let defaultBehavior = {
      accountingEffect: true,
      inventoryEffect: true,
      partyLedgerRequired: true,
      itemEntryAllowed: true,
      taxApplicable: true
    };

    if (newParent === 'Receipt' || newParent === 'Payment') {
      defaultBehavior = {
        accountingEffect: true,
        inventoryEffect: false,
        partyLedgerRequired: true,
        itemEntryAllowed: false,
        taxApplicable: false
      };
    } else if (newParent === 'Contra' || newParent === 'Journal') {
      defaultBehavior = {
        accountingEffect: true,
        inventoryEffect: false,
        partyLedgerRequired: false,
        itemEntryAllowed: false,
        taxApplicable: false
      };
    } else if (newParent === 'Delivery Note' || newParent === 'Receipt Note' || newParent === 'Stock Journal' || newParent === 'Physical Stock') {
      defaultBehavior = {
        accountingEffect: false,
        inventoryEffect: true,
        partyLedgerRequired: newParent.includes('Note'),
        itemEntryAllowed: true,
        taxApplicable: false
      };
    }

    setFormData(prev => ({
      ...prev,
      parent: newParent,
      voucherCategory: category,
      ...defaultBehavior
    }));
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const generateNumberPreview = (offset = 0) => {
    const startNum = (parseInt(formData.startingNumber, 10) || 1) + offset;
    const width = parseInt(formData.numberWidth, 10) || 4;
    const padded = String(startNum).padStart(width, '0');
    const p = formData.prefix || '';
    const s = formData.suffix || '';
    return `${p}${padded}${s}`;
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!formData.voucherTypeName.trim()) {
      toast.error('Voucher Type Name is required');
      setActiveTab('basic');
      return;
    }

    setSaving(true);
    try {
      const activeCompanyId = localStorage.getItem('selectedCompanyId') || localStorage.getItem('activeCompany') || '';
      const headers = activeCompanyId ? { 'x-company-id': activeCompanyId } : {};

      const payload = {
        voucherTypeName: formData.voucherTypeName.trim(),
        name: formData.voucherTypeName.trim(),
        voucherTypeCode: formData.voucherTypeCode.trim() || `VCH-${Date.now().toString().slice(-4)}`,
        abbreviation: formData.abbreviation.trim() || formData.voucherTypeName.trim(),
        mailingName: formData.abbreviation.trim() || formData.voucherTypeName.trim(),
        parent: formData.parent,
        parentGroup: formData.parent,
        voucherCategory: formData.voucherCategory.toUpperCase(),
        status: formData.status,

        // TAB 2: Behavior
        behavior: {
          accountingEffect: formData.accountingEffect,
          inventoryEffect: formData.inventoryEffect,
          partyLedgerRequired: formData.partyLedgerRequired,
          itemEntryAllowed: formData.itemEntryAllowed,
          taxApplicable: formData.taxApplicable
        },
        flags: {
          accountingEffect: formData.accountingEffect,
          inventoryEffect: formData.inventoryEffect,
          partyLedgerRequired: formData.partyLedgerRequired,
          itemEntryAllowed: formData.itemEntryAllowed,
          taxApplicable: formData.taxApplicable,
          useLedgerNarrations: formData.enableNarration,
          isCostCenter: formData.enableCostCentre
        },

        // TAB 3: Numbering
        numberingMethod: formData.numberingMethod,
        startingNumber: parseInt(formData.startingNumber, 10) || 1,
        beginningNumber: parseInt(formData.startingNumber, 10) || 1,
        numberWidth: parseInt(formData.numberWidth, 10) || 4,
        widthOfNumber: parseInt(formData.numberWidth, 10) || 4,
        prefix: formData.prefix.trim(),
        suffix: formData.suffix.trim(),
        numbering: {
          name: "Default",
          voucherNumberSeriesID: `Default_${formData.voucherTypeName.trim()}`,
          numberingMethod: formData.numberingMethod,
          beginningNumber: parseInt(formData.startingNumber, 10) || 1,
          widthOfNumber: parseInt(formData.numberWidth, 10) || 4,
          prefix: formData.prefix.trim(),
          suffix: formData.suffix.trim(),
          isDefault: true
        },

        // TAB 4: Advanced
        defaultPrintTitle: formData.defaultPrintTitle.trim(),
        printing: {
          templateName: formData.defaultPrintTitle.trim() || null
        },
        enablePOS: formData.enablePOS,
        enableCostCentre: formData.enableCostCentre,
        enableBillWise: formData.enableBillWise,
        enableNarration: formData.enableNarration,
        voucherClass: {
          posCashLedger: formData.enablePOS ? formData.posCashLedger.trim() : null,
          posCardLedger: formData.enablePOS ? formData.posCardLedger.trim() : null,
          posChequeLedger: formData.enablePOS ? formData.posChequeLedger.trim() : null
        },

        isWebEntry: true,
        sourceCollection: 'vouchertypes_entry',
        companyId: activeCompanyId
      };

      if (isEdit && (initialData._id || initialData.id)) {
        const id = initialData._id || initialData.id;
        await apiClient.put(`/masters/voucher-types/${id}`, payload, { headers });
        toast.success(`Voucher Type "${formData.voucherTypeName}" updated successfully`);
      } else {
        await apiClient.post('/masters/voucher-types', payload, { headers });
        toast.success(`Voucher Type "${formData.voucherTypeName}" created successfully`);
      }

      if (onSaveSuccess) onSaveSuccess();
      onClose();
    } catch (err) {
      console.error('Error saving Voucher Type master:', err);
      toast.error(err.response?.data?.detail || 'Failed to save Voucher Type');
    } finally {
      setSaving(false);
    }
  };

  const fieldStyle = {
    backgroundColor: 'var(--app-control-bg)',
    borderColor: 'var(--app-border)',
    color: 'var(--app-heading)',
  };

  const activeTabIndex = TABS.findIndex(t => t.id === activeTab);

  const handlePrevTab = () => {
    if (activeTabIndex > 0) setActiveTab(TABS[activeTabIndex - 1].id);
  };

  const handleNextTab = () => {
    if (activeTabIndex < TABS.length - 1) setActiveTab(TABS[activeTabIndex + 1].id);
  };

  const customParentNames = (voucherTypesList || []).map(v => v.voucherTypeName || v.name).filter(Boolean);

  const parentOptions = Array.from(new Set([
    ...PARENT_VOUCHER_TYPES,
    ...customParentNames,
    formData.parent,
    initialData?.parent,
    initialData?.parentGroup,
    initialData?.parentVoucherType
  ].filter(p => p && typeof p === 'string' && p.trim() && p.toLowerCase() !== 'none' && p.toLowerCase() !== 'null' && p.toLowerCase() !== 'undefined')));

  return (
    <div className="w-full flex-1 flex flex-col bg-[var(--app-panel-bg)] border border-[var(--app-border)] rounded-2xl shadow-sm overflow-hidden transition-all min-h-[85vh] my-1">
      
      {/* Top Header Bar */}
      <div className="px-6 py-3.5 border-b border-[var(--app-border)] flex flex-wrap justify-between items-center bg-[var(--app-panel-bg)] shrink-0 gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl border border-[var(--app-border)] hover:bg-[var(--app-control-hover)] text-[var(--app-muted)] hover:text-[var(--app-heading)] transition-all shrink-0 cursor-pointer"
            title="Back to Master List"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="p-2 rounded-xl bg-[var(--app-accent-soft)] text-[var(--app-accent)] shrink-0">
            <FileText className="w-4 h-4" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold tracking-tight text-[var(--app-heading)]">
                {isEdit ? `Edit Voucher Type: ${formData.voucherTypeName || initialData?.voucherTypeName || ''}` : 'Create Voucher Type'}
              </h2>
            </div>
            <p className="text-xs text-[var(--app-muted)]">
              Configure accounting behavior, series numbering, and operational controls
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl border border-[var(--app-border)] hover:bg-[var(--app-control-hover)] text-[var(--app-muted)] hover:text-[var(--app-heading)] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="px-5 py-2 text-xs font-bold rounded-xl text-white bg-[var(--app-accent)] hover:opacity-90 active:scale-95 shadow-md flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : isEdit ? 'Update Voucher Type' : 'Save Voucher Type'}
          </button>
        </div>
      </div>

      {/* Top Horizontal Navigation Tabs */}
      <div className="px-6 border-b border-[var(--app-border)] bg-[var(--app-control-bg)] shrink-0 overflow-x-auto">
        <div className="flex items-center gap-2 py-2.5 min-w-max">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer ${
                  isActive
                    ? 'bg-[var(--app-panel-bg)] text-[var(--app-accent)] border border-[var(--app-border)] shadow-xs'
                    : 'text-[var(--app-muted)] hover:text-[var(--app-heading)] hover:bg-[var(--app-panel-bg)]/50'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[var(--app-accent)]' : 'text-[var(--app-muted)]'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Form Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        <form onSubmit={handleSubmit} className="w-full space-y-6">

          {/* TAB 1: BASIC INFORMATION */}
          {activeTab === 'basic' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-6 space-y-5 shadow-2xs">
                <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[var(--app-accent)]" />
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--app-heading)]">
                      Voucher Type Details
                    </h3>
                  </div>
                  <span className="text-[11px] text-[var(--app-muted)] font-medium">
                    Fields marked with <span className="text-rose-500">*</span> are mandatory
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {/* Voucher Type Name */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[var(--app-muted)] mb-1.5">
                      Voucher Type Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Sales Invoice / Cash Payment"
                      value={formData.voucherTypeName}
                      onChange={e => handleChange('voucherTypeName', e.target.value)}
                      className="w-full h-10 rounded-xl border px-3.5 text-sm font-medium outline-none transition-all focus:ring-2 focus:ring-[var(--app-accent-soft)] focus:border-[var(--app-accent)]"
                      style={fieldStyle}
                    />
                  </div>

                  {/* Voucher Type Code */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[var(--app-muted)] mb-1.5">
                      Voucher Type Code
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. SAL-INV / CSH-PAY"
                      value={formData.voucherTypeCode}
                      onChange={e => handleChange('voucherTypeCode', e.target.value)}
                      className="w-full h-10 rounded-xl border px-3.5 text-sm font-medium outline-none transition-all focus:ring-2 focus:ring-[var(--app-accent-soft)] focus:border-[var(--app-accent)] font-mono"
                      style={fieldStyle}
                    />
                  </div>

                  {/* Abbreviation */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[var(--app-muted)] mb-1.5">
                      Abbreviation / Short Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. SI / CP / JV"
                      value={formData.abbreviation}
                      onChange={e => handleChange('abbreviation', e.target.value)}
                      className="w-full h-10 rounded-xl border px-3.5 text-sm font-medium outline-none transition-all focus:ring-2 focus:ring-[var(--app-accent-soft)] focus:border-[var(--app-accent)]"
                      style={fieldStyle}
                    />
                  </div>

                  {/* Parent Voucher Type */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[var(--app-muted)] mb-1.5">
                      Parent Voucher Type <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.parent}
                      onChange={e => handleParentChange(e.target.value)}
                      className="w-full h-10 rounded-xl border px-3.5 text-sm font-medium outline-none transition-all focus:ring-2 focus:ring-[var(--app-accent-soft)] focus:border-[var(--app-accent)] cursor-pointer"
                      style={fieldStyle}
                    >
                      {parentOptions.map(parent => (
                        <option key={parent} value={parent}>
                          {parent}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Voucher Category */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[var(--app-muted)] mb-1.5">
                      Voucher Category
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={formData.voucherCategory}
                      className="w-full h-10 rounded-xl border px-3.5 text-sm font-bold outline-none font-mono text-[var(--app-accent)] opacity-80 cursor-not-allowed"
                      style={fieldStyle}
                    />
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[var(--app-muted)] mb-1.5">
                      Status
                    </label>
                    <button
                      type="button"
                      onClick={() => handleChange('status', formData.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')}
                      className={`w-full h-10 rounded-xl font-bold text-xs tracking-wider border transition-all cursor-pointer flex items-center justify-center ${
                        formData.status === 'ACTIVE'
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {formData.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: VOUCHER BEHAVIOR */}
          {activeTab === 'behavior' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-6 space-y-5 shadow-2xs">
                <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-3">
                  <div className="flex items-center gap-2">
                    <ToggleRight className="w-4 h-4 text-[var(--app-accent)]" />
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--app-heading)]">
                      Transaction Behavior
                    </h3>
                  </div>
                  <span className="text-xs font-semibold text-[var(--app-muted)]">
                    Parent: <strong className="text-[var(--app-accent)]">{formData.parent}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  
                  {/* Accounting Effect */}
                  <div 
                    onClick={() => handleChange('accountingEffect', !formData.accountingEffect)}
                    className="p-4 rounded-xl border border-[var(--app-border)] bg-[var(--app-control-bg)] hover:bg-[var(--app-control-hover)] cursor-pointer transition-all flex items-start justify-between gap-3 select-none"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-[var(--app-heading)] mb-1">Accounting Effect</h4>
                      <p className="text-[11px] text-[var(--app-muted)] leading-tight">
                        Posts debits & credits to financial ledgers and updates Trial Balance.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.accountingEffect}
                      onChange={() => {}}
                      className="w-4 h-4 rounded accent-[var(--app-accent)] mt-0.5 pointer-events-none"
                    />
                  </div>

                  {/* Inventory Effect */}
                  <div 
                    onClick={() => handleChange('inventoryEffect', !formData.inventoryEffect)}
                    className="p-4 rounded-xl border border-[var(--app-border)] bg-[var(--app-control-bg)] hover:bg-[var(--app-control-hover)] cursor-pointer transition-all flex items-start justify-between gap-3 select-none"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-[var(--app-heading)] mb-1">Inventory Effect</h4>
                      <p className="text-[11px] text-[var(--app-muted)] leading-tight">
                        Updates physical stock quantities, godowns, and stock reports.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.inventoryEffect}
                      onChange={() => {}}
                      className="w-4 h-4 rounded accent-[var(--app-accent)] mt-0.5 pointer-events-none"
                    />
                  </div>

                  {/* Party Ledger Required */}
                  <div 
                    onClick={() => handleChange('partyLedgerRequired', !formData.partyLedgerRequired)}
                    className="p-4 rounded-xl border border-[var(--app-border)] bg-[var(--app-control-bg)] hover:bg-[var(--app-control-hover)] cursor-pointer transition-all flex items-start justify-between gap-3 select-none"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-[var(--app-heading)] mb-1">Party Ledger Required</h4>
                      <p className="text-[11px] text-[var(--app-muted)] leading-tight">
                        Requires selection of Customer (Debtor) or Vendor (Creditor).
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.partyLedgerRequired}
                      onChange={() => {}}
                      className="w-4 h-4 rounded accent-[var(--app-accent)] mt-0.5 pointer-events-none"
                    />
                  </div>

                  {/* Item Entry Allowed */}
                  <div 
                    onClick={() => handleChange('itemEntryAllowed', !formData.itemEntryAllowed)}
                    className="p-4 rounded-xl border border-[var(--app-border)] bg-[var(--app-control-bg)] hover:bg-[var(--app-control-hover)] cursor-pointer transition-all flex items-start justify-between gap-3 select-none"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-[var(--app-heading)] mb-1">Item Entry Allowed</h4>
                      <p className="text-[11px] text-[var(--app-muted)] leading-tight">
                        Enables Stock Item selection table during voucher creation.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.itemEntryAllowed}
                      onChange={() => {}}
                      className="w-4 h-4 rounded accent-[var(--app-accent)] mt-0.5 pointer-events-none"
                    />
                  </div>

                  {/* Tax Applicable */}
                  <div 
                    onClick={() => handleChange('taxApplicable', !formData.taxApplicable)}
                    className="p-4 rounded-xl border border-[var(--app-border)] bg-[var(--app-control-bg)] hover:bg-[var(--app-control-hover)] cursor-pointer transition-all flex items-start justify-between gap-3 select-none"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-[var(--app-heading)] mb-1">Tax Applicable</h4>
                      <p className="text-[11px] text-[var(--app-muted)] leading-tight">
                        Calculates GST (CGST/SGST/IGST) and statutory tax ledgers.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.taxApplicable}
                      onChange={() => {}}
                      className="w-4 h-4 rounded accent-[var(--app-accent)] mt-0.5 pointer-events-none"
                    />
                  </div>

                </div>
              </div>
            </div>
          )}

          {/* TAB 3: NUMBERING */}
          {activeTab === 'numbering' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-6 space-y-5 shadow-2xs">
                <div className="flex items-center gap-2 border-b border-[var(--app-border)] pb-3">
                  <Hash className="w-4 h-4 text-[var(--app-accent)]" />
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--app-heading)]">
                    Numbering Series
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {/* Numbering Method */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[var(--app-muted)] mb-1.5">
                      Numbering Method <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.numberingMethod}
                      onChange={e => handleChange('numberingMethod', e.target.value)}
                      className="w-full h-10 rounded-xl border px-3.5 text-sm font-medium outline-none transition-all focus:ring-2 focus:ring-[var(--app-accent-soft)] focus:border-[var(--app-accent)] cursor-pointer"
                      style={fieldStyle}
                    >
                      {NUMBERING_METHODS.map(method => (
                        <option key={method} value={method}>
                          {method}
                        </option>
                      ))}
                    </select>
                  </div>

                  {formData.numberingMethod !== 'Manual' && (
                    <>
                      {/* Starting Number */}
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[var(--app-muted)] mb-1.5">
                          Starting Number
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={formData.startingNumber}
                          onChange={e => handleChange('startingNumber', e.target.value)}
                          className="w-full h-10 rounded-xl border px-3.5 text-sm font-medium outline-none transition-all focus:ring-2 focus:ring-[var(--app-accent-soft)] focus:border-[var(--app-accent)] font-mono"
                          style={fieldStyle}
                        />
                      </div>

                      {/* Number Width */}
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[var(--app-muted)] mb-1.5">
                          Number Width (Zero Padding)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={formData.numberWidth}
                          onChange={e => handleChange('numberWidth', e.target.value)}
                          className="w-full h-10 rounded-xl border px-3.5 text-sm font-medium outline-none transition-all focus:ring-2 focus:ring-[var(--app-accent-soft)] focus:border-[var(--app-accent)] font-mono"
                          style={fieldStyle}
                        />
                      </div>

                      {/* Prefix */}
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[var(--app-muted)] mb-1.5">
                          Prefix
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. INV-"
                          value={formData.prefix}
                          onChange={e => handleChange('prefix', e.target.value)}
                          className="w-full h-10 rounded-xl border px-3.5 text-sm font-medium outline-none transition-all focus:ring-2 focus:ring-[var(--app-accent-soft)] focus:border-[var(--app-accent)] font-mono"
                          style={fieldStyle}
                        />
                      </div>

                      {/* Suffix */}
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[var(--app-muted)] mb-1.5">
                          Suffix
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. /24-25"
                          value={formData.suffix}
                          onChange={e => handleChange('suffix', e.target.value)}
                          className="w-full h-10 rounded-xl border px-3.5 text-sm font-medium outline-none transition-all focus:ring-2 focus:ring-[var(--app-accent-soft)] focus:border-[var(--app-accent)] font-mono"
                          style={fieldStyle}
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* Dynamic Preview Card */}
                <div className="p-4 rounded-xl border border-[var(--app-border)] bg-[var(--app-control-bg)] flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--app-muted)] block mb-1">
                      Generated Series Preview ({formData.numberingMethod})
                    </span>
                    {formData.numberingMethod === 'Manual' ? (
                      <span className="text-xs font-semibold text-[var(--app-muted)]">
                        Manual Entry Mode (User enters voucher number directly)
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg bg-[var(--app-panel-bg)] border border-[var(--app-border)] font-mono text-xs font-extrabold text-[var(--app-accent)]">
                          {generateNumberPreview(0)}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-[var(--app-muted)]" />
                        <span className="px-2.5 py-1 rounded-lg bg-[var(--app-panel-bg)] border border-[var(--app-border)] font-mono text-xs font-extrabold text-[var(--app-accent)]">
                          {generateNumberPreview(1)}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-[var(--app-muted)]" />
                        <span className="px-2.5 py-1 rounded-lg bg-[var(--app-panel-bg)] border border-[var(--app-border)] font-mono text-xs font-extrabold text-[var(--app-accent)]">
                          {generateNumberPreview(2)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 4: ADVANCED SETTINGS */}
          {activeTab === 'advanced' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-6 space-y-5 shadow-2xs">
                <div className="flex items-center gap-2 border-b border-[var(--app-border)] pb-3">
                  <Settings className="w-4 h-4 text-[var(--app-accent)]" />
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--app-heading)]">
                    4. Printing, POS & Advanced Options
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Default Print Title */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[var(--app-muted)] mb-1.5">
                      Default Print Title
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. TAX INVOICE / PAYMENT ADVICE"
                      value={formData.defaultPrintTitle}
                      onChange={e => handleChange('defaultPrintTitle', e.target.value)}
                      className="w-full h-10 rounded-xl border px-3.5 text-sm font-medium outline-none transition-all focus:ring-2 focus:ring-[var(--app-accent-soft)] focus:border-[var(--app-accent)]"
                      style={fieldStyle}
                    />
                  </div>

                  {/* Enable POS Toggle */}
                  <div 
                    onClick={() => handleChange('enablePOS', !formData.enablePOS)}
                    className="p-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-control-bg)] hover:bg-[var(--app-control-hover)] cursor-pointer transition-all flex items-center justify-between gap-3 select-none h-10 self-end"
                  >
                    <span className="text-xs font-bold text-[var(--app-heading)]">Enable Point of Sale (POS)</span>
                    <input
                      type="checkbox"
                      checked={formData.enablePOS}
                      onChange={() => {}}
                      className="w-4 h-4 rounded accent-[var(--app-accent)] pointer-events-none"
                    />
                  </div>
                </div>

                {/* Conditional POS Ledgers */}
                {formData.enablePOS && (
                  <div className="p-4 rounded-xl border border-[var(--app-border)] bg-[var(--app-control-bg)] space-y-3 animate-in fade-in duration-150">
                    <span className="text-xs font-extrabold text-[var(--app-accent)] block">
                      POS Payment Ledgers Allocation
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                          POS Cash Ledger
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Cash in Hand"
                          value={formData.posCashLedger}
                          onChange={e => handleChange('posCashLedger', e.target.value)}
                          className="w-full h-9 rounded-lg border px-3 text-xs font-medium outline-none"
                          style={fieldStyle}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                          POS Card Ledger
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. HDFC Card Swipe"
                          value={formData.posCardLedger}
                          onChange={e => handleChange('posCardLedger', e.target.value)}
                          className="w-full h-9 rounded-lg border px-3 text-xs font-medium outline-none"
                          style={fieldStyle}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                          POS Cheque Ledger
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Cheque Clearance"
                          value={formData.posChequeLedger}
                          onChange={e => handleChange('posChequeLedger', e.target.value)}
                          className="w-full h-9 rounded-lg border px-3 text-xs font-medium outline-none"
                          style={fieldStyle}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Additional Toggles */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                  
                  {/* Enable Cost Centre */}
                  <div 
                    onClick={() => handleChange('enableCostCentre', !formData.enableCostCentre)}
                    className="p-3.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-control-bg)] hover:bg-[var(--app-control-hover)] cursor-pointer transition-all flex items-center justify-between gap-3 select-none"
                  >
                    <span className="text-xs font-bold text-[var(--app-heading)]">Enable Cost Centre</span>
                    <input
                      type="checkbox"
                      checked={formData.enableCostCentre}
                      onChange={() => {}}
                      className="w-4 h-4 rounded accent-[var(--app-accent)] pointer-events-none"
                    />
                  </div>

                  {/* Enable Bill-wise Details */}
                  <div 
                    onClick={() => handleChange('enableBillWise', !formData.enableBillWise)}
                    className="p-3.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-control-bg)] hover:bg-[var(--app-control-hover)] cursor-pointer transition-all flex items-center justify-between gap-3 select-none"
                  >
                    <span className="text-xs font-bold text-[var(--app-heading)]">Enable Bill-wise Details</span>
                    <input
                      type="checkbox"
                      checked={formData.enableBillWise}
                      onChange={() => {}}
                      className="w-4 h-4 rounded accent-[var(--app-accent)] pointer-events-none"
                    />
                  </div>

                  {/* Enable Narration */}
                  <div 
                    onClick={() => handleChange('enableNarration', !formData.enableNarration)}
                    className="p-3.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-control-bg)] hover:bg-[var(--app-control-hover)] cursor-pointer transition-all flex items-center justify-between gap-3 select-none"
                  >
                    <span className="text-xs font-bold text-[var(--app-heading)]">Enable Narration</span>
                    <input
                      type="checkbox"
                      checked={formData.enableNarration}
                      onChange={() => {}}
                      className="w-4 h-4 rounded accent-[var(--app-accent)] pointer-events-none"
                    />
                  </div>

                </div>
              </div>
            </div>
          )}

          {/* Form Navigation & Submit Footer Bar */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              {activeTabIndex > 0 && (
                <button
                  type="button"
                  onClick={handlePrevTab}
                  className="px-4 py-2 rounded-xl border border-[var(--app-border)] hover:bg-[var(--app-control-hover)] text-xs font-bold text-[var(--app-heading)] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>
              )}
              {activeTabIndex < TABS.length - 1 && (
                <button
                  type="button"
                  onClick={handleNextTab}
                  className="px-4 py-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-control-bg)] hover:bg-[var(--app-control-hover)] text-xs font-bold text-[var(--app-accent)] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>Next: {TABS[activeTabIndex + 1].label}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-[var(--app-border)] hover:bg-[var(--app-control-hover)] text-[var(--app-muted)] hover:text-[var(--app-heading)] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 text-xs font-bold rounded-xl text-white bg-[var(--app-accent)] hover:opacity-90 active:scale-95 shadow-md flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : isEdit ? 'Update Voucher Type' : 'Save Voucher Type'}
              </button>
            </div>
          </div>

        </form>
      </div>

    </div>
  );
}
