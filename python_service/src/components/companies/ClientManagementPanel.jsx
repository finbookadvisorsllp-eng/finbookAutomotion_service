import React, { useState } from 'react';
import { Search, Plus, RefreshCw, Layers, User, Trash2, Eye, Pencil, CheckCircle, X, Shield, Phone, Mail, MapPin, Globe } from 'lucide-react';
import { toast } from 'sonner';

export default function ClientManagementPanel() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Client Form state
  const [form, setForm] = useState({
    name: '',
    company: 'Finbook Advisors LLP',
    gstin: '',
    pan: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    country: 'India',
    notes: ''
  });

  const [clientsList, setClientsList] = useState([
    { id: 'client-1', name: 'Rahul Sharma', company: 'Greenline Ventures', mobile: '+91 98765 43210', email: 'rahul@greeline.com', assignedUsers: 'Operator A, Operator B', status: 'Active' },
    { id: 'client-2', name: 'Anjali Gupta', company: 'Apex Holdings', mobile: '+91 98123 45678', email: 'anjali@apex.com', assignedUsers: 'Operator A', status: 'Active' },
    { id: 'client-3', name: 'Vikram Singh', company: 'Finolax Advisors', mobile: '+91 95555 12345', email: 'vikram@finolax.com', assignedUsers: 'System AI', status: 'Inactive' }
  ]);

  const stats = [
    { label: 'Total Client Profiles', count: clientsList.length, color: 'text-[var(--app-accent)] dark:text-[var(--app-accent)]', countColor: 'text-[var(--app-accent)] dark:text-[var(--app-accent)]', cardBg: 'bg-[var(--app-accent-soft)] border-[var(--app-border)] dark:bg-[var(--app-accent-soft)] dark:border-[var(--app-border)]' },
    { label: 'Active Clients', count: clientsList.filter(c => c.status === 'Active').length, color: 'text-emerald-800 dark:text-emerald-300', countColor: 'text-emerald-950 dark:text-emerald-50', cardBg: 'bg-emerald-50/80 border-emerald-200/80 dark:bg-emerald-950/20 dark:border-emerald-900/30' },
    { label: 'Assigned Entities', count: new Set(clientsList.map(c => c.company)).size, color: 'text-[var(--app-accent)] dark:text-[var(--app-accent)]', countColor: 'text-[var(--app-accent)] dark:text-[var(--app-accent)]', cardBg: 'bg-[var(--app-accent-soft)] border-[var(--app-border)] dark:bg-[var(--app-accent-soft)] dark:border-[var(--app-border)]' },
    { label: 'Pending Invitations', count: '1', color: 'text-amber-800 dark:text-amber-300', countColor: 'text-amber-950 dark:text-amber-50', cardBg: 'bg-amber-50/80 border-amber-200/80 dark:bg-amber-950/20 dark:border-amber-900/30' }
  ];

  const handleCreateClient = (e) => {
    e.preventDefault();
    if (!form.name || !form.email) {
      toast.error('Name and Email are required.');
      return;
    }
    const newClient = {
      id: 'client-' + Date.now(),
      name: form.name,
      company: form.company,
      mobile: form.phone || 'N/A',
      email: form.email,
      assignedUsers: 'Operator A',
      status: 'Active'
    };
    setClientsList(prev => [...prev, newClient]);
    setForm({ name: '', company: 'Finbook Advisors LLP', gstin: '', pan: '', email: '', phone: '', address: '', city: '', state: '', country: 'India', notes: '' });
    setShowCreateForm(false);
    toast.success('Client profile created successfully!');
  };

  const handleDeleteClient = (id) => {
    setClientsList(prev => prev.filter(c => c.id !== id));
    toast.success('Client profile deleted');
  };

  const filteredClients = clientsList.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.company.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-2.5 h-full overflow-y-auto pr-1 text-[13px] text-slate-700 dark:text-slate-200">
      
      {/* Title Header */}
      <div className="rounded-xl border px-3 py-2 flex items-center justify-between shrink-0 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-[18px] md:text-[20px] font-extrabold tracking-tight text-slate-900 dark:text-[var(--app-heading)]">Client Management</h1>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Configure client portfolios, tax profiles, and assigned operation roles.
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(p => !p)}
          className="px-3.5 py-1.5 bg-[var(--app-accent)] hover:opacity-90 text-white font-bold text-[10.5px] rounded-lg flex items-center gap-1 transition-all uppercase shrink-0 shadow-sm"
        >
          {showCreateForm ? <X size={12} /> : <Plus size={12} />}
          {showCreateForm ? 'Close Form' : 'New Client'}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 shrink-0">
        {stats.map((s, idx) => (
          <div key={idx} className={`p-2 border rounded-xl flex flex-col justify-between transition-all ${s.cardBg}`}>
            <span className={`text-[10px] uppercase font-bold tracking-wider leading-none block ${s.color}`}>{s.label}</span>
            <span className={`text-[15px] font-extrabold mt-1 block leading-none ${s.countColor}`}>{s.count}</span>
          </div>
        ))}
      </div>

      {/* Client Pop-up Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center bg-black/50 backdrop-blur-[2px] p-0 md:p-4 overflow-y-auto select-none">
          <div className="bg-white dark:bg-slate-900 border-0 md:border border-slate-200 dark:border-slate-800 rounded-none md:rounded-xl shadow-2xl max-w-5xl w-full h-full md:h-auto md:max-h-[95vh] flex flex-col my-0 md:my-4 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0 bg-white dark:bg-slate-900 rounded-t-none md:rounded-t-xl">
              <div>
                <h2 className="text-base md:text-lg font-bold text-slate-900 dark:text-white">Create New Client</h2>
                <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 mt-0.5">Add a new client profile in one view</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="text-slate-400 hover:text-[var(--app-text)] dark:hover:text-[var(--app-muted)] transition-colors p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleCreateClient} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* Fields - grouped into 3 columns, no scrolling needed on typical displays */}
              <div className="flex-1 p-3 md:p-4 space-y-3 overflow-y-auto md:overflow-visible">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  {/* Column 1: Profile Info */}
                  <div className="space-y-3">
                    <div className="space-y-2 border rounded-xl p-3 bg-slate-50/40 dark:bg-slate-950/20 border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-1.5 text-[var(--app-accent)] dark:text-[var(--app-accent)] font-bold border-b border-slate-200 dark:border-slate-800 pb-1 mb-2">
                        <User size={13} />
                        <span className="text-[11px] uppercase tracking-wider font-black">1. Profile Info</span>
                      </div>

                      <div>
                        <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">Client Name *</label>
                        <input
                          type="text"
                          required
                          value={form.name}
                          onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="e.g. Rahul Sharma"
                          className="w-full h-8 rounded-lg border px-2.5 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-[var(--app-accent)]"
                        />
                      </div>

                      <div>
                        <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">Email Address *</label>
                        <input
                          type="email"
                          required
                          value={form.email}
                          onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                          placeholder="e.g. rahul@greeline.com"
                          className="w-full h-8 rounded-lg border px-2.5 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-[var(--app-accent)]"
                        />
                      </div>

                      <div>
                        <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">Phone Number</label>
                        <input
                          type="text"
                          value={form.phone}
                          onChange={(e) => setForm(prev => ({ ...prev, phone: e.target.value }))}
                          placeholder="e.g. +91 98765 43210"
                          className="w-full h-8 rounded-lg border px-2.5 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-[var(--app-accent)]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Column 2: Tax & Company Details */}
                  <div className="space-y-3">
                    <div className="space-y-2 border rounded-xl p-3 bg-slate-50/40 dark:bg-slate-950/20 border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-1.5 text-[var(--app-accent)] dark:text-[var(--app-accent)] font-bold border-b border-slate-200 dark:border-slate-800 pb-1 mb-2">
                        <Shield size={13} />
                        <span className="text-[11px] uppercase tracking-wider font-black">2. Entity Details</span>
                      </div>

                      <div>
                        <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">Company Name *</label>
                        <input
                          type="text"
                          required
                          value={form.company}
                          onChange={(e) => setForm(prev => ({ ...prev, company: e.target.value }))}
                          placeholder="e.g. Greenline Ventures"
                          className="w-full h-8 rounded-lg border px-2.5 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-[var(--app-accent)]"
                        />
                      </div>

                      <div>
                        <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">GSTIN Number</label>
                        <input
                          type="text"
                          value={form.gstin}
                          onChange={(e) => setForm(prev => ({ ...prev, gstin: e.target.value }))}
                          placeholder="e.g. 23AAFFF6731J1L7"
                          className="w-full h-8 rounded-lg border px-2.5 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-[var(--app-accent)]"
                        />
                      </div>

                      <div>
                        <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">PAN Number</label>
                        <input
                          type="text"
                          value={form.pan}
                          onChange={(e) => setForm(prev => ({ ...prev, pan: e.target.value }))}
                          placeholder="e.g. AAFFF6731J"
                          className="w-full h-8 rounded-lg border px-2.5 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-[var(--app-accent)]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Column 3: Address & Notes */}
                  <div className="space-y-3">
                    <div className="space-y-2 border rounded-xl p-3 bg-slate-50/40 dark:bg-slate-950/20 border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-1.5 text-[var(--app-accent)] dark:text-[var(--app-accent)] font-bold border-b border-slate-200 dark:border-slate-800 pb-1 mb-2">
                        <MapPin size={13} />
                        <span className="text-[11px] uppercase tracking-wider font-black">3. Location & Notes</span>
                      </div>

                      <div>
                        <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">Address</label>
                        <input
                          type="text"
                          value={form.address}
                          onChange={(e) => setForm(prev => ({ ...prev, address: e.target.value }))}
                          placeholder="e.g. 102 Metro Plaza"
                          className="w-full h-8 rounded-lg border px-2.5 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-[var(--app-accent)]"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">City</label>
                          <input
                            type="text"
                            value={form.city}
                            onChange={(e) => setForm(prev => ({ ...prev, city: e.target.value }))}
                            placeholder="e.g. Indore"
                            className="w-full h-8 rounded-lg border px-2 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-[var(--app-accent)]"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">State</label>
                          <input
                            type="text"
                            value={form.state}
                            onChange={(e) => setForm(prev => ({ ...prev, state: e.target.value }))}
                            placeholder="e.g. MP"
                            className="w-full h-8 rounded-lg border px-2 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-[var(--app-accent)]"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">Notes</label>
                        <textarea
                          rows={1.5}
                          value={form.notes}
                          onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                          placeholder="e.g. Premium subscriber client"
                          className="w-full rounded-lg border px-2 py-1 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-[var(--app-accent)] resize-none"
                        />
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* Modal Footer Buttons */}
              <div className="flex justify-end gap-2 p-3 md:p-4 border-t border-slate-100 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider shrink-0 bg-white dark:bg-slate-900 rounded-b-none md:rounded-b-xl">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-1.5 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
                  style={{ borderColor: 'var(--app-border)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-1.5 bg-[var(--app-accent)] hover:opacity-90 text-white rounded-lg shadow-sm transition-all font-bold"
                >
                  Save Client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filter toolbar */}
      <div className="border rounded px-2.5 py-2 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 bg-white dark:bg-slate-950/20 border-slate-200 dark:border-slate-800 shrink-0" style={{ borderColor: 'var(--app-border)' }}>
        
        {/* Search */}
        <div className="relative max-w-xs flex-1 group">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
          <input
            type="text"
            placeholder="Search clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-7 pl-8 pr-2.5 rounded border text-[11px] outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-[var(--app-accent)]"
          />
        </div>
      </div>

      {/* Client Table Grid */}
      <div className="border rounded-xl flex-1 overflow-hidden flex flex-col bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="overflow-auto themed-scrollbar flex-1">
          <table className="w-full text-left border-collapse min-w-[900px] text-[13px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/60 border-b text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800" style={{ backgroundColor: 'var(--app-table-head-bg)' }}>
                <th className="p-2 w-12 text-center" style={{ color: 'var(--app-muted)' }}>Sr.</th>
                <th className="p-2 border-r border-slate-200 dark:border-slate-800" style={{ color: 'var(--app-muted)' }}>Client Name</th>
                <th className="p-2 border-r border-slate-200 dark:border-slate-800" style={{ color: 'var(--app-muted)' }}>Company</th>
                <th className="p-2 border-r border-slate-200 dark:border-slate-800" style={{ color: 'var(--app-muted)' }}>Mobile</th>
                <th className="p-2 border-r border-slate-200 dark:border-slate-800" style={{ color: 'var(--app-muted)' }}>Email</th>
                <th className="p-2 border-r border-slate-200 dark:border-slate-800" style={{ color: 'var(--app-muted)' }}>Assigned Users</th>
                <th className="p-2 border-r border-slate-200 dark:border-slate-800 text-center" style={{ color: 'var(--app-muted)' }}>Status</th>
                <th className="p-2 text-center w-24" style={{ color: 'var(--app-muted)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.length > 0 ? (
                filteredClients.map((client, index) => (
                  <tr key={client.id} className="border-b hover:bg-slate-50/50 dark:hover:bg-slate-900/10 font-medium text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800">
                    <td className="p-2 text-center text-slate-500">{index + 1}</td>
                    <td className="p-2 border-r font-bold text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800">{client.name}</td>
                    <td className="p-2 border-r text-slate-550 dark:text-slate-400">{client.company}</td>
                    <td className="p-2 border-r text-slate-550 dark:text-slate-400 font-mono">{client.mobile}</td>
                    <td className="p-2 border-r text-slate-550 dark:text-slate-400">{client.email}</td>
                    <td className="p-2 border-r text-slate-500 dark:text-slate-400 italic text-[12px]">{client.assignedUsers}</td>
                    
                    <td className="p-2 border-r text-center">
                      <span className={`px-1.5 py-0.5 rounded border text-[10.5px] font-bold ${
                        client.status === 'Active' 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-250 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30' 
                          : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-700/50'
                      }`}>
                        {client.status}
                      </span>
                    </td>

                    <td className="p-2 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-[var(--app-accent)] rounded transition-colors"><Pencil size={11} /></button>
                        <button className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-rose-500 rounded transition-colors" onClick={() => handleDeleteClient(client.id)}><Trash2 size={12} /></button>
                      </div>
                    </td>

                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 font-medium">
                    No client profiles found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
