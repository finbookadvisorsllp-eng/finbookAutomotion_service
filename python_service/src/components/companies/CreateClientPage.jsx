import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Shield, Users, Check, Building2, CheckCircle2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '../../lib/apiClient';

const NATURE_OF_BUSINESS_OPTIONS = [
  "Retail Business",
  "Office / Sale Office",
  "Wholesale Business",
  "Factory / Manufacturing",
  "Service Provision",
  "Export / Import"
];

export default function CreateClientPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [availableUsers, setAvailableUsers] = useState([]);

  // Form State matching rich JSON document schema
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    gstin: '',
    legalName: '',
    tradeName: '',
    state: 'Madhya Pradesh',
    stateCode: '23',
    registrationDate: new Date().toISOString().split('T')[0],
    businessType: 'Partnership',
    taxpayerType: 'Regular',
    principalAddress: '',
    natureOfBusiness: [
      "Retail Business",
      "Office / Sale Office",
      "Wholesale Business",
      "Factory / Manufacturing"
    ],
    pan: '',
    city: 'Indore',
    notes: '',
    assignedUserIds: [],
    createWorkspace: true
  });

  // Fetch available team users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await apiClient.get('/auth/users');
        if (res.data?.success && Array.isArray(res.data.data)) {
          setAvailableUsers(res.data.data);
        }
      } catch (err) {
        console.error('Failed to fetch team users:', err);
      }
    };
    fetchUsers();
  }, []);

  const handleNatureToggle = (option) => {
    setForm(prev => {
      const exists = prev.natureOfBusiness.includes(option);
      return {
        ...prev,
        natureOfBusiness: exists
          ? prev.natureOfBusiness.filter(o => o !== option)
          : [...prev.natureOfBusiness, option]
      };
    });
  };

  const handleUserToggle = (userId) => {
    setForm(prev => {
      const exists = prev.assignedUserIds.includes(userId);
      return {
        ...prev,
        assignedUserIds: exists
          ? prev.assignedUserIds.filter(id => id !== userId)
          : [...prev.assignedUserIds, userId]
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email) {
      toast.error('Client Name and Email are required.');
      return;
    }

    setSubmitting(true);
    try {
      const selectedUserNames = availableUsers
        .filter(u => form.assignedUserIds.includes(u.id))
        .map(u => u.name || u.email);

      const assignedUsersStr = selectedUserNames.length > 0 ? selectedUserNames.join(', ') : 'Operator A';

      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        company: form.company.trim() || form.name.trim(),
        gstin: form.gstin.trim(),
        pan: form.pan.trim(),
        address: form.principalAddress.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        notes: form.notes.trim(),
        assignedUsers: assignedUsersStr,
        assignedUserIds: form.assignedUserIds,
        createWorkspace: form.createWorkspace,
        gstDetails: {
          gstin: form.gstin.trim(),
          legalName: form.legalName.trim() || form.company.trim() || form.name.trim(),
          tradeName: form.tradeName.trim() || form.company.trim() || form.name.trim(),
          state: form.state.trim(),
          stateCode: form.stateCode.trim(),
          registrationDate: form.registrationDate,
          businessType: form.businessType,
          taxpayerType: form.taxpayerType,
          status: 'Active',
          principalAddress: form.principalAddress.trim() || `${form.city}, ${form.state}`,
          natureOfBusiness: form.natureOfBusiness
        },
        tallyConfig: {
          host: 'localhost',
          port: 9000
        },
        currencySymbol: '₹',
        fyStartMonth: 4
      };

      await apiClient.post('/clients', payload);
      toast.success('Client & Company workspace created successfully!');
      navigate('/admin/clients');
    } catch (err) {
      toast.error(err?.response?.data?.detail || err?.message || 'Failed to create Client & Company');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden p-3 text-[13px] text-[var(--app-text)] select-none">
      
      {/* Top Header Card */}
      <div className="rounded-xl border px-4 py-3 flex items-center justify-between gap-3 shrink-0 bg-[var(--app-panel-bg)] border-[var(--app-border)] shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/admin/clients')}
            title="Back to Clients"
            className="h-8 w-8 rounded-lg border border-[var(--app-border)] hover:bg-[var(--app-control-hover)] flex items-center justify-center text-[var(--app-heading)] transition-all shrink-0 cursor-pointer"
          >
            <ArrowLeft size={16} />
          </button>

          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-[var(--app-heading)] leading-none">
              New Client &amp; Company Onboarding
            </h1>
            <p className="text-[11px] text-[var(--app-muted)] mt-1">
              Register client profiles, company GST entity details, and assigned employee operators
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/admin/clients')}
            className="h-8 px-3 border border-[var(--app-border)] hover:bg-[var(--app-control-hover)] text-[var(--app-text)] font-bold text-xs rounded-lg transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="h-8 px-4 bg-[var(--app-accent)] hover:opacity-90 text-white font-bold text-xs rounded-lg transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Check size={14} />
            {submitting ? 'Saving...' : 'Save Client & Company'}
          </button>
        </div>
      </div>

      {/* Main Full-Page Onboarding Form */}
      <div className="flex-1 overflow-y-auto mt-3 pr-1 space-y-4 themed-scrollbar">
        <form onSubmit={handleSubmit} className="space-y-4 max-w-6xl mx-auto pb-6">

          {/* Section 1: Profile & Primary Contact */}
          <div className="rounded-xl border p-4 bg-[var(--app-panel-bg)] border-[var(--app-border)] shadow-2xs space-y-3">
            <div className="flex items-center gap-2 border-b border-[var(--app-border)] pb-2 text-[var(--app-accent)] font-extrabold">
              <User size={15} />
              <span className="text-xs uppercase tracking-wider">1. Profile &amp; Contact Info</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              <div>
                <label className="text-[10px] font-bold text-[var(--app-muted)] mb-1 block uppercase tracking-wide">Client Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value, legalName: prev.legalName || e.target.value, tradeName: prev.tradeName || e.target.value }))}
                  placeholder="e.g. FRIENDS GRAFIX"
                  className="w-full h-8.5 rounded-lg border px-3 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-[var(--app-muted)] mb-1 block uppercase tracking-wide">Email Address *</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="contact@friendsgrafix.com"
                  className="w-full h-8.5 rounded-lg border px-3 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-[var(--app-muted)] mb-1 block uppercase tracking-wide">Phone Number</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+91 98765 43210"
                  className="w-full h-8.5 rounded-lg border px-3 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Entity & Rich GST Details */}
          <div className="rounded-xl border p-4 bg-[var(--app-panel-bg)] border-[var(--app-border)] shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2 text-[var(--app-accent)] font-extrabold">
              <div className="flex items-center gap-2">
                <Shield size={15} />
                <span className="text-xs uppercase tracking-wider">2. Entity &amp; Rich GST Details</span>
              </div>
              <label className="flex items-center gap-2 text-xs font-bold text-[var(--app-heading)] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.createWorkspace}
                  onChange={(e) => setForm(prev => ({ ...prev, createWorkspace: e.target.checked }))}
                  className="rounded text-[var(--app-accent)]"
                />
                <span>Provision Accounting Workspace Company</span>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              <div>
                <label className="text-[10px] font-bold text-[var(--app-muted)] mb-1 block uppercase tracking-wide">Company / Trade Name</label>
                <input
                  type="text"
                  value={form.company}
                  onChange={(e) => setForm(prev => ({ ...prev, company: e.target.value, tradeName: e.target.value }))}
                  placeholder="e.g. FRIENDS GRAFIX"
                  className="w-full h-8.5 rounded-lg border px-3 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)] font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-[var(--app-muted)] mb-1 block uppercase tracking-wide">GSTIN Number</label>
                <input
                  type="text"
                  value={form.gstin}
                  onChange={(e) => setForm(prev => ({ ...prev, gstin: e.target.value, pan: e.target.value.length >= 12 ? e.target.value.substring(2, 12) : prev.pan }))}
                  placeholder="e.g. 23AAFFF9731L1Z7"
                  className="w-full h-8.5 rounded-lg border px-3 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)] font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-[var(--app-muted)] mb-1 block uppercase tracking-wide">Legal Name</label>
                <input
                  type="text"
                  value={form.legalName}
                  onChange={(e) => setForm(prev => ({ ...prev, legalName: e.target.value }))}
                  placeholder="Legal Name as per GST"
                  className="w-full h-8.5 rounded-lg border px-3 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5 pt-1">
              <div>
                <label className="text-[10px] font-bold text-[var(--app-muted)] mb-1 block uppercase tracking-wide">State</label>
                <input
                  type="text"
                  value={form.state}
                  onChange={(e) => setForm(prev => ({ ...prev, state: e.target.value }))}
                  placeholder="Madhya Pradesh"
                  className="w-full h-8.5 rounded-lg border px-3 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-[var(--app-muted)] mb-1 block uppercase tracking-wide">State Code</label>
                <input
                  type="text"
                  value={form.stateCode}
                  onChange={(e) => setForm(prev => ({ ...prev, stateCode: e.target.value }))}
                  placeholder="23"
                  className="w-full h-8.5 rounded-lg border px-3 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)] font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-[var(--app-muted)] mb-1 block uppercase tracking-wide">Constitution / Business Type</label>
                <select
                  value={form.businessType}
                  onChange={(e) => setForm(prev => ({ ...prev, businessType: e.target.value }))}
                  className="w-full h-8.5 rounded-lg border px-3 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)] font-bold"
                >
                  <option value="Partnership">Partnership</option>
                  <option value="Proprietorship">Proprietorship</option>
                  <option value="Private Limited">Private Limited</option>
                  <option value="Limited Liability Partnership (LLP)">LLP</option>
                  <option value="Public Limited">Public Limited</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-[var(--app-muted)] mb-1 block uppercase tracking-wide">Taxpayer Type</label>
                <select
                  value={form.taxpayerType}
                  onChange={(e) => setForm(prev => ({ ...prev, taxpayerType: e.target.value }))}
                  className="w-full h-8.5 rounded-lg border px-3 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)] font-bold"
                >
                  <option value="Regular">Regular</option>
                  <option value="Composition">Composition</option>
                  <option value="SEZ Unit">SEZ Unit</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-[var(--app-muted)] mb-1 block uppercase tracking-wide">Principal Address</label>
              <textarea
                rows={2}
                value={form.principalAddress}
                onChange={(e) => setForm(prev => ({ ...prev, principalAddress: e.target.value }))}
                placeholder="Plot No. 2-3 A, Sector - F, Sanwer Road, Indore, 452015, Madhya Pradesh"
                className="w-full rounded-lg border p-2 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)] resize-none"
              />
            </div>

            {/* Nature of Business Checklist */}
            <div>
              <label className="text-[10px] font-bold text-[var(--app-muted)] mb-1.5 block uppercase tracking-wide">Nature of Business Activities</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-2.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-content-bg)]">
                {NATURE_OF_BUSINESS_OPTIONS.map(opt => {
                  const isChecked = form.natureOfBusiness.includes(opt);
                  return (
                    <label key={opt} className="flex items-center gap-2 text-xs font-medium cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleNatureToggle(opt)}
                        className="rounded text-[var(--app-accent)]"
                      />
                      <span>{opt}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section 3: Employee Operator Assignment */}
          <div className="rounded-xl border p-4 bg-[var(--app-panel-bg)] border-[var(--app-border)] shadow-2xs space-y-3">
            <div className="flex items-center gap-2 border-b border-[var(--app-border)] pb-2 text-[var(--app-accent)] font-extrabold">
              <Users size={15} />
              <span className="text-xs uppercase tracking-wider">3. Employee / Staff Operator Assignment</span>
            </div>

            <div>
              <p className="text-[11px] text-[var(--app-muted)] mb-2">
                Select team users and operators who will handle and manage this client workspace:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-36 overflow-y-auto p-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-content-bg)] themed-scrollbar">
                {availableUsers.length === 0 ? (
                  <span className="text-[11px] text-[var(--app-muted)] italic">No team users found in IAM</span>
                ) : (
                  availableUsers.map(u => {
                    const isChecked = form.assignedUserIds.includes(u.id);
                    return (
                      <label
                        key={u.id}
                        className={`flex items-center justify-between p-2 rounded-lg border transition-all cursor-pointer ${
                          isChecked 
                            ? 'border-[var(--app-accent)] bg-[var(--app-accent-soft)]' 
                            : 'border-[var(--app-border)] hover:bg-[var(--app-control-hover)]'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleUserToggle(u.id)}
                            className="rounded text-[var(--app-accent)]"
                          />
                          <div className="truncate">
                            <p className="font-bold text-xs text-[var(--app-heading)] truncate">{u.name || u.email}</p>
                            <p className="text-[10px] text-[var(--app-muted)] truncate">{u.email}</p>
                          </div>
                        </div>
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[var(--app-muted)] shrink-0">
                          {u.role}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Sticky Bottom Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('/admin/clients')}
              className="h-9 px-4 border border-[var(--app-border)] hover:bg-[var(--app-control-hover)] text-[var(--app-text)] font-bold text-xs rounded-xl transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-9 px-6 bg-[var(--app-accent)] hover:opacity-90 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 size={16} />
              {submitting ? 'Saving Workspace...' : 'Save Client & Company Workspace'}
            </button>
          </div>

        </form>
      </div>

    </div>
  );
}
