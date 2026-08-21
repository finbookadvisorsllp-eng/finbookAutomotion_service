import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, FileText, CheckCircle2, ShieldCheck, Tag, Percent, Calendar, IndianRupee } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '../../lib/apiClient';

const DEDUCTEE_TYPE_OPTIONS = [
  'Company Resident',
  'Non-Company Resident (Individual/HUF)',
  'Partnership Firm',
  'AOP / BOI',
  'Non-Resident',
  'Government Body',
  'Co-operative Society'
];

export default function TDSMasterForm({ initialData = null, isEdit = false, onSave, onClose }) {
  const [formData, setFormData] = useState({
    tdsName: '',
    sectionCode: '194J',
    deducteeTypes: ['Company Resident', 'Non-Company Resident (Individual/HUF)'],
    applicableRate: 10,
    thresholdLimit: 50000,
    effectiveFrom: new Date().toISOString().split('T')[0],
    effectiveTo: '',
    status: 'ACTIVE'
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        tdsName: initialData.tdsName || initialData.name || '',
        sectionCode: initialData.sectionCode || initialData.section || '194J',
        deducteeTypes: Array.isArray(initialData.deducteeTypes)
          ? initialData.deducteeTypes
          : (initialData.deducteeTypes ? [initialData.deducteeTypes] : ['Company Resident', 'Non-Company Resident (Individual/HUF)']),
        applicableRate: initialData.applicableRate ?? initialData.rate ?? 10,
        thresholdLimit: initialData.thresholdLimit ?? initialData.threshold ?? 50000,
        effectiveFrom: initialData.effectiveFrom || new Date().toISOString().split('T')[0],
        effectiveTo: initialData.effectiveTo || '',
        status: initialData.status || 'ACTIVE'
      });
    }
  }, [initialData]);

  const updateField = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const toggleDeducteeType = (type) => {
    setFormData(prev => {
      const exists = prev.deducteeTypes.includes(type);
      const next = exists ? prev.deducteeTypes.filter(t => t !== type) : [...prev.deducteeTypes, type];
      return { ...prev, deducteeTypes: next.length > 0 ? next : [type] };
    });
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!formData.tdsName.trim()) {
      toast.error('TDS Name / Nature is required');
      return;
    }
    if (!formData.sectionCode.trim()) {
      toast.error('Section Code is required');
      return;
    }

    setSaving(true);
    try {
      const activeCompanyId = localStorage.getItem('selectedCompanyId') || localStorage.getItem('activeCompany') || '';
      const headers = activeCompanyId ? { 'x-company-id': activeCompanyId } : {};

      const payload = {
        tdsName: formData.tdsName.trim(),
        name: formData.tdsName.trim(),
        sectionCode: formData.sectionCode.trim(),
        section: formData.sectionCode.trim(),
        deducteeTypes: formData.deducteeTypes,
        applicableRate: parseFloat(formData.applicableRate) || 0,
        rate: parseFloat(formData.applicableRate) || 0,
        thresholdLimit: parseFloat(formData.thresholdLimit) || 0,
        threshold: parseFloat(formData.thresholdLimit) || 0,
        effectiveFrom: formData.effectiveFrom,
        effectiveTo: formData.effectiveTo || null,
        status: formData.status,
        isWebEntry: true,
        companyId: activeCompanyId
      };

      if (isEdit && (initialData?._id || initialData?.id)) {
        const id = initialData._id || initialData.id;
        const collection = initialData.sourceCollection || 'tds_entry';
        await apiClient.put(`/masters/generic/${collection}/${id}`, payload, { headers });
        toast.success(`TDS Master "${formData.tdsName}" updated successfully`);
      } else {
        await apiClient.post('/masters/tds', payload, { headers });
        toast.success(`TDS Master "${formData.tdsName}" created successfully`);
      }

      if (onSave) onSave(payload);
      onClose();
    } catch (err) {
      console.error('Error saving TDS Master:', err);
      toast.error(err.response?.data?.detail || 'Failed to save TDS Master');
    } finally {
      setSaving(false);
    }
  };

  const fieldStyle = {
    backgroundColor: 'var(--app-control-bg)',
    borderColor: 'var(--app-border)',
    color: 'var(--app-heading)',
  };

  return (
    <div className="flex flex-col h-full bg-[var(--app-bg)] text-[var(--app-text)] overflow-hidden font-sans animate-in fade-in duration-300">
      
      {/* Header Bar */}
      <div className="shrink-0 px-6 py-4 border-b border-[var(--app-border)] bg-[var(--app-panel-bg)] flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl border border-[var(--app-border)] hover:bg-[var(--app-control-hover)] text-[var(--app-muted)] hover:text-[var(--app-heading)] transition-all cursor-pointer"
            title="Go Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div className="p-2 rounded-xl bg-[var(--app-accent-soft)] text-[var(--app-accent)]">
            <FileText className="w-5 h-5" />
          </div>

          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-[var(--app-heading)]">
              {isEdit ? `Edit TDS: ${formData.tdsName}` : 'Create TDS Master'}
            </h1>
            <p className="text-xs text-[var(--app-muted)]">
              Configure TDS section, rate, threshold limit, and deductee types
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl border border-[var(--app-border)] hover:bg-[var(--app-control-hover)] text-[var(--app-muted)] transition-colors cursor-pointer"
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
            <span>{saving ? 'Saving...' : isEdit ? 'Update TDS Master' : 'Save TDS Master'}</span>
          </button>
        </div>
      </div>

      {/* Form Content */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          
          {/* Card 1: TDS Nature & Section Code */}
          <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-6 space-y-5 shadow-xs">
            <div className="flex items-center gap-2 border-b border-[var(--app-border)] pb-3">
              <Tag className="w-4 h-4 text-[var(--app-accent)]" />
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-[var(--app-heading)]">
                TDS Details
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--app-muted)] mb-1.5">
                  TDS Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Professional Fees, Fees for Technical Services"
                  value={formData.tdsName}
                  onChange={(e) => updateField('tdsName', e.target.value)}
                  className="w-full h-10 rounded-xl border px-3.5 text-sm font-medium outline-none transition-all focus:ring-2 focus:ring-[var(--app-accent-soft)] focus:border-[var(--app-accent)]"
                  style={fieldStyle}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--app-muted)] mb-1.5">
                  Section Code <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 194J, 194C, 194I, 194H"
                  value={formData.sectionCode}
                  onChange={(e) => updateField('sectionCode', e.target.value)}
                  className="w-full h-10 rounded-xl border px-3.5 text-sm font-semibold outline-none transition-all focus:ring-2 focus:ring-[var(--app-accent-soft)] focus:border-[var(--app-accent)] font-mono"
                  style={fieldStyle}
                />
              </div>
            </div>
          </div>

          {/* Card 2: Rate, Threshold & Effective Dates */}
          <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-6 space-y-5 shadow-xs">
            <div className="flex items-center gap-2 border-b border-[var(--app-border)] pb-3">
              <Percent className="w-4 h-4 text-[var(--app-accent)]" />
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-[var(--app-heading)]">
                Rate & Validity
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--app-muted)] mb-1.5">
                  Applicable Rate (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.applicableRate}
                    onChange={(e) => updateField('applicableRate', e.target.value)}
                    className="w-full h-10 rounded-xl border px-3.5 text-sm font-bold outline-none transition-all focus:ring-2 focus:ring-[var(--app-accent-soft)] focus:border-[var(--app-accent)] font-mono"
                    style={fieldStyle}
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-bold text-[var(--app-muted)]">%</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--app-muted)] mb-1.5">
                  Threshold Limit (₹)
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={formData.thresholdLimit}
                  onChange={(e) => updateField('thresholdLimit', e.target.value)}
                  className="w-full h-10 rounded-xl border px-3.5 text-sm font-bold outline-none transition-all focus:ring-2 focus:ring-[var(--app-accent-soft)] focus:border-[var(--app-accent)] font-mono"
                  style={fieldStyle}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--app-muted)] mb-1.5">
                  Effective From
                </label>
                <input
                  type="date"
                  value={formData.effectiveFrom}
                  onChange={(e) => updateField('effectiveFrom', e.target.value)}
                  className="w-full h-10 rounded-xl border px-3.5 text-sm font-medium outline-none transition-all focus:ring-2 focus:ring-[var(--app-accent-soft)] focus:border-[var(--app-accent)]"
                  style={fieldStyle}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--app-muted)] mb-1.5">
                  Effective To (Optional)
                </label>
                <input
                  type="date"
                  value={formData.effectiveTo}
                  onChange={(e) => updateField('effectiveTo', e.target.value)}
                  className="w-full h-10 rounded-xl border px-3.5 text-sm font-medium outline-none transition-all focus:ring-2 focus:ring-[var(--app-accent-soft)] focus:border-[var(--app-accent)]"
                  style={fieldStyle}
                />
              </div>
            </div>
          </div>

          {/* Card 3: Deductee Types Selection */}
          <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-6 space-y-4 shadow-xs">
            <div className="flex items-center gap-2 border-b border-[var(--app-border)] pb-3">
              <ShieldCheck className="w-4 h-4 text-[var(--app-accent)]" />
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-[var(--app-heading)]">
                Deductee Types
              </h3>
            </div>

            <p className="text-xs text-[var(--app-muted)]">
              Select deductee categories eligible for this TDS Nature. These will auto-filter when creating or editing a Ledger.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
              {DEDUCTEE_TYPE_OPTIONS.map(type => {
                const isSelected = formData.deducteeTypes.includes(type);
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleDeducteeType(type)}
                    className={`flex items-center justify-between p-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer select-none ${
                      isSelected
                        ? 'border-[var(--app-accent)] bg-[var(--app-accent-soft)] text-[var(--app-accent)] font-bold shadow-2xs'
                        : 'border-[var(--app-border)] bg-[var(--app-control-bg)] hover:bg-[var(--app-control-hover)] text-[var(--app-heading)]'
                    }`}
                  >
                    <span>{type}</span>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-[var(--app-accent)] shrink-0 ml-2" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Card 4: Action & Status Footer */}
          <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-5 flex flex-wrap items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--app-muted)]">Status:</span>
              <button
                type="button"
                onClick={() => updateField('status', formData.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold tracking-wide border transition-all cursor-pointer ${
                  formData.status === 'ACTIVE'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
                }`}
              >
                {formData.status}
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 text-xs font-semibold rounded-xl border border-[var(--app-border)] hover:bg-[var(--app-control-hover)] text-[var(--app-muted)] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 text-xs font-bold rounded-xl text-white bg-[var(--app-accent)] hover:opacity-90 active:scale-95 shadow-md flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving...' : isEdit ? 'Update TDS Master' : 'Save TDS Master'}</span>
              </button>
            </div>
          </div>

        </div>
      </form>
    </div>
  );
}
