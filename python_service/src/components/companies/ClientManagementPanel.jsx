import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, User, Trash2, Pencil, CheckCircle, X, Shield, Mail, MapPin, Layers, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '../../lib/apiClient';
import DataTable from '../ui/DataTable';
import StatCard from '../ui/StatCard';
import Badge from '../ui/Badge';

export default function ClientManagementPanel() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [clientsList, setClientsList] = useState([]);

  // 1. Fetch persistent clients from MongoDB
  const fetchClients = async () => {
    if (clientsList.length === 0) setLoading(true);
    try {
      const res = await apiClient.get('/clients');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setClientsList(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch clients:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const stats = [
    { label: 'Total Profiles', value: clientsList.length, icon: Users },
    { label: 'Active Clients', value: clientsList.filter(c => c.status === 'Active').length, icon: CheckCircle },
    { label: 'Assigned Entities', value: new Set(clientsList.map(c => c.company)).size, icon: Layers },
    { label: 'Pending Invites', value: 0, icon: Mail },
  ];

  const columns = [
    { key: 'sr', header: 'Sr', width: '52px', align: 'center', render: (_r, i) => <span style={{ color: 'var(--app-muted)' }}>{i + 1}</span> },
    { key: 'name', header: 'Client Name', sortable: true, render: (c) => <span className="font-bold text-[var(--app-heading)]">{c.name}</span> },
    { key: 'company', header: 'Company', sortable: true, render: (c) => <span className="font-semibold text-[var(--app-text)]">{c.company}</span> },
    { key: 'gstin', header: 'GSTIN', render: (c) => <span className="font-mono text-[11px] font-bold text-[var(--app-accent)]">{c.gstin || 'N/A'}</span> },
    { key: 'mobile', header: 'Mobile', render: (c) => <span className="font-mono text-[11px]">{c.mobile || c.phone}</span> },
    { key: 'email', header: 'Email', sortable: true, render: (c) => <span style={{ color: 'var(--app-text)' }}>{c.email}</span> },
    { key: 'assignedUsers', header: 'Assigned Employees', render: (c) => <span className="italic text-[12px] font-semibold text-[var(--app-muted)]">{c.assignedUsers || 'Unassigned'}</span> },
    { key: 'status', header: 'Status', align: 'center', sortable: true, sortValue: (c) => c.status, render: (c) => <Badge tone={c.status === 'Active' ? 'success' : 'neutral'}>{c.status}</Badge> },
    { key: 'act', header: '', align: 'center', width: '64px', render: (c) => (
      <div className="flex items-center justify-center gap-1">
        <button onClick={() => handleDeleteClient(c.id)} title="Delete" aria-label="Delete" className="p-1.5 rounded-md hover:bg-[var(--app-control-hover)] hover:text-rose-500 transition-colors" style={{ color: 'var(--app-muted)' }}><Trash2 size={13} /></button>
      </div>
    ) },
  ];

  const handleDeleteClient = async (id) => {
    if (window.confirm('Are you sure you want to delete this client profile?')) {
      try {
        await apiClient.delete(`/clients/${id}`);
        toast.success('Client profile deleted successfully');
        fetchClients();
      } catch (err) {
        toast.error('Failed to delete client profile');
      }
    }
  };

  const filteredClients = clientsList.filter(c => 
    (c.name && c.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (c.company && c.company.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (c.gstin && c.gstin.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex flex-col gap-2.5 h-full overflow-hidden p-1 text-[13px] text-[var(--app-text)]">

      {/* Header */}
      <div className="rounded-xl border px-3.5 py-2.5 flex items-center justify-between gap-3 shrink-0 bg-[var(--app-panel-bg)] border-[var(--app-border)] shadow-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: 'var(--app-accent-gradient)', boxShadow: 'var(--app-shadow)' }}>
            <Users size={17} strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <h1 className="text-[17px] font-extrabold tracking-tight text-[var(--app-heading)] leading-none">Client &amp; Company Management</h1>
            <p className="text-[10px] text-[var(--app-muted)] mt-1 truncate">Configure client portfolios, tax profiles, company entities, and assigned operation roles.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/admin/clients/new')}
          className="h-8 px-3.5 m3-interactive bg-[var(--app-accent)] hover:opacity-90 text-white font-bold text-[11px] rounded-lg flex items-center gap-1.5 transition-all shrink-0 shadow-xs cursor-pointer"
        >
          <Plus size={14} />
          New Client &amp; Company
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 shrink-0">
        {stats.map((s, i) => <StatCard key={s.label} index={i} label={s.label} value={s.value} icon={s.icon} />)}
      </div>

      {/* Client table */}
      <div className="flex-1 min-h-0">
        <DataTable
          minWidth="950px"
          data={filteredClients}
          rowKey={(c) => c.id}
          emptyText="No client profiles found. Click 'New Client & Company' to add one."
          columns={columns}
          search={{ value: searchQuery, onChange: setSearchQuery, placeholder: 'Search clients or GSTIN…' }}
        />
      </div>
    </div>
  );
}
