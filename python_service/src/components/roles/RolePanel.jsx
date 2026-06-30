import React, { useState } from 'react';
import { Plus, X, Trash2, Pencil, CheckCircle, Shield, Users, Mail, Key, User, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import DataTable from '../ui/DataTable';
import StatCard from '../ui/StatCard';
import Badge from '../ui/Badge';

export default function RolePanel({ mode: propMode, isDark }) {
  const [activeTab, setActiveTab] = useState(propMode || 'Manage Users');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Create User Form State
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'Accountant',
    company: 'Finbook Advisors LLP',
    password: '',
    confirmPassword: '',
    status: 'Active'
  });

  const [users, setUsers] = useState([
    { id: 'usr-1', name: 'Admin User', email: 'admin@finbook.com', company: 'Finbook Advisors LLP', role: 'Super Admin', status: 'Active', lastLogin: 'Today, 18:25' },
    { id: 'usr-2', name: 'Rahul Sharma', email: 'rahul@greeline.com', company: 'Greenline Ventures', role: 'Accountant', status: 'Active', lastLogin: 'Today, 14:10' },
    { id: 'usr-3', name: 'Vikram Singh', email: 'vikram@finolax.com', company: 'Finolax Advisors', role: 'Data Operator', status: 'Active', lastLogin: 'Yesterday, 10:15' },
    { id: 'usr-4', name: 'Anjali Gupta', email: 'anjali@apex.com', company: 'Apex Holdings', role: 'Accountant', status: 'Inactive', lastLogin: '12-Jun-2026 15:40' }
  ]);

  // Permission Matrix Modules & columns
  const modulesList = [
    'Dashboard', 'Manual Voucher Entry', 'Bulk Upload', 'Masters', 'Approval', 
    'OCR Upload', 'Tally Connector', 'Document Archive', 'Configuration'
  ];

  const permissionActions = ['Create', 'Edit', 'Delete', 'Approve', 'Post To Tally'];

  // Track checkboxes state
  const [matrixState, setMatrixState] = useState(
    modulesList.reduce((acc, mod) => {
      acc[mod] = permissionActions.reduce((actAcc, action) => {
        actAcc[action] = mod === 'Dashboard' ? true : false;
        return actAcc;
      }, {});
      return acc;
    }, {})
  );

  const handleCheckboxChange = (mod, action) => {
    setMatrixState(prev => ({
      ...prev,
      [mod]: {
        ...prev[mod],
        [action]: !prev[mod][action]
      }
    }));
  };

  const handleCreateUser = (e) => {
    e.preventDefault();
    if (!userForm.name || !userForm.email || !userForm.password) {
      toast.error('Name, Email and Password are required.');
      return;
    }
    if (userForm.password !== userForm.confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    const newUser = {
      id: 'usr-' + Date.now(),
      name: userForm.name,
      email: userForm.email,
      company: userForm.company,
      role: userForm.role,
      status: userForm.status,
      lastLogin: 'Never logged in'
    };
    setUsers(prev => [newUser, ...prev]);
    setUserForm({ name: '', email: '', phone: '', role: 'Accountant', company: 'Finbook Advisors LLP', password: '', confirmPassword: '', status: 'Active' });
    setShowCreateForm(false);
    toast.success('System User registered successfully!');
  };

  const handleDeleteUser = (id) => {
    setUsers(prev => prev.filter(u => u.id !== id));
    toast.success('User access profile removed');
  };

  const stats = [
    { label: 'Total Users', value: users.length, icon: Users },
    { label: 'Active Users', value: users.filter(u => u.status === 'Active').length, icon: CheckCircle },
    { label: 'Roles', value: 4, icon: Shield },
    { label: 'Pending Invites', value: 1, icon: Mail },
  ];

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.company.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const userColumns = [
    { key: 'sr', header: 'Sr', width: '46px', align: 'center', render: (_u, i) => <span style={{ color: 'var(--app-muted)' }}>{i + 1}</span> },
    { key: 'name', header: 'Name', sortable: true, render: (u) => <span className="font-semibold" style={{ color: 'var(--app-heading)' }}>{u.name}</span> },
    { key: 'email', header: 'Email', sortable: true, render: (u) => <span style={{ color: 'var(--app-muted)' }}>{u.email}</span> },
    { key: 'role', header: 'Role', sortable: true, render: (u) => <span className="font-semibold" style={{ color: 'var(--app-accent)' }}>{u.role}</span> },
    { key: 'company', header: 'Company', render: (u) => <span style={{ color: 'var(--app-text)' }}>{u.company}</span> },
    { key: 'status', header: 'Status', align: 'center', sortable: true, sortValue: (u) => u.status, render: (u) => <Badge tone={u.status === 'Active' ? 'success' : 'neutral'}>{u.status}</Badge> },
    { key: 'lastLogin', header: 'Last Login', align: 'center', render: (u) => <span className="font-mono text-[11px]" style={{ color: 'var(--app-muted)' }}>{u.lastLogin}</span> },
    { key: 'act', header: '', align: 'center', width: '70px', render: (u) => (
      <div className="flex items-center justify-center gap-1.5">
        <button title="Edit" aria-label="Edit" className="hover:text-[var(--app-accent)]" style={{ color: 'var(--app-muted)' }}><Pencil size={12} /></button>
        {u.name !== 'Admin User' && <button onClick={() => handleDeleteUser(u.id)} title="Delete" aria-label="Delete" className="hover:text-rose-500" style={{ color: 'var(--app-muted)' }}><Trash2 size={12} /></button>}
      </div>
    ) },
  ];

  return (
    <div className="flex flex-col gap-2.5 h-full overflow-hidden p-1 text-[13px] text-[var(--app-text)]">

      {/* Header */}
      <div className="rounded-xl border px-3 py-2.5 flex items-center justify-between gap-3 shrink-0 bg-[var(--app-panel-bg)] border-[var(--app-border)] shadow-sm">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: 'var(--app-accent-gradient)', boxShadow: 'var(--app-shadow)' }}>
            <Shield size={17} strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <h1 className="text-[17px] font-extrabold tracking-tight text-[var(--app-heading)] leading-none">User &amp; Role Management</h1>
            <p className="text-[10px] text-[var(--app-muted)] mt-1 truncate">Configure user credentials, security policies and the access permission matrix.</p>
          </div>
        </div>
        <button onClick={() => setShowCreateForm(p => !p)} className="h-8 px-3 bg-[var(--app-accent)] hover:opacity-90 text-white font-bold text-[11px] rounded-lg flex items-center gap-1.5 transition-all shrink-0 shadow-xs">
          {showCreateForm ? <X size={13} /> : <Plus size={13} />}
          {showCreateForm ? 'Close' : 'Create User'}
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 shrink-0">
        {stats.map((s, i) => <StatCard key={s.label} index={i} label={s.label} value={s.value} icon={s.icon} />)}
      </div>

      {/* Create User Pop-up Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center bg-black/50 backdrop-blur-[2px] p-0 md:p-4 overflow-y-auto select-none">
          <div className="bg-[var(--app-panel-bg)] border-0 md:border border-[var(--app-border)] rounded-none md:rounded-xl shadow-2xl max-w-5xl w-full h-full md:h-auto md:max-h-[95vh] flex flex-col my-0 md:my-4 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-2.5 border-b border-[var(--app-border)] flex justify-between items-center shrink-0 bg-[var(--app-panel-bg)] rounded-t-none md:rounded-t-xl">
              <div>
                <h2 className="text-base md:text-lg font-bold text-slate-900 dark:text-white">Create System User</h2>
                <p className="text-[10px] md:text-xs text-[var(--app-muted)] mt-0.5">Register a new system user profile in one view</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="text-[var(--app-muted)] hover:text-[var(--app-text)] dark:hover:text-[var(--app-muted)] transition-colors p-1 hover:bg-[var(--app-control-hover)] rounded-lg"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleCreateUser} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* Fields - grouped into 3 columns, no scrolling needed on typical displays */}
              <div className="flex-1 p-3 md:p-4 space-y-3 overflow-y-auto md:overflow-visible">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  {/* Column 1: Profile Info */}
                  <div className="space-y-3">
                    <div className="space-y-2 border rounded-xl p-3 bg-[var(--app-content-bg)] border-[var(--app-border)]">
                      <div className="flex items-center gap-1.5 text-[var(--app-accent)] dark:text-[var(--app-accent)] font-bold border-b border-[var(--app-border)] pb-1 mb-2">
                        <User size={13} />
                        <span className="text-[11px] uppercase tracking-wider font-black">1. User Info</span>
                      </div>

                      <div>
                        <label className="text-[9px] font-bold text-[var(--app-muted)] mb-0.5 block uppercase tracking-wide">User Name *</label>
                        <input
                          type="text"
                          required
                          value={userForm.name}
                          onChange={(e) => setUserForm(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="e.g. Rahul Sharma"
                          className="w-full h-8 rounded-lg border px-2.5 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                        />
                      </div>

                      <div>
                        <label className="text-[9px] font-bold text-[var(--app-muted)] mb-0.5 block uppercase tracking-wide">Email Address *</label>
                        <input
                          type="email"
                          required
                          value={userForm.email}
                          onChange={(e) => setUserForm(prev => ({ ...prev, email: e.target.value }))}
                          placeholder="e.g. rahul@company.com"
                          className="w-full h-8 rounded-lg border px-2.5 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                        />
                      </div>

                      <div>
                        <label className="text-[9px] font-bold text-[var(--app-muted)] mb-0.5 block uppercase tracking-wide">Phone Number</label>
                        <input
                          type="text"
                          value={userForm.phone}
                          onChange={(e) => setUserForm(prev => ({ ...prev, phone: e.target.value }))}
                          placeholder="e.g. +91 98765 43210"
                          className="w-full h-8 rounded-lg border px-2.5 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Column 2: Organization details */}
                  <div className="space-y-3">
                    <div className="space-y-2 border rounded-xl p-3 bg-[var(--app-content-bg)] border-[var(--app-border)]">
                      <div className="flex items-center gap-1.5 text-[var(--app-accent)] dark:text-[var(--app-accent)] font-bold border-b border-[var(--app-border)] pb-1 mb-2">
                        <Users size={13} />
                        <span className="text-[11px] uppercase tracking-wider font-black">2. Organization</span>
                      </div>

                      <div>
                        <label className="text-[9px] font-bold text-[var(--app-muted)] mb-0.5 block uppercase tracking-wide">Assigned Role</label>
                        <div className="relative">
                          <select
                            value={userForm.role}
                            onChange={(e) => setUserForm(prev => ({ ...prev, role: e.target.value }))}
                            className="w-full appearance-none h-8 rounded-lg border px-2.5 pr-8 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                          >
                            <option value="Super Admin">Super Admin</option>
                            <option value="Accountant">Accountant</option>
                            <option value="Data Operator">Data Operator</option>
                            <option value="Auditor">Auditor</option>
                          </select>
                          <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--app-muted)]" />
                        </div>
                      </div>

                      <div>
                        <label className="text-[9px] font-bold text-[var(--app-muted)] mb-0.5 block uppercase tracking-wide">Assigned Company</label>
                        <div className="relative">
                          <select
                            value={userForm.company}
                            onChange={(e) => setUserForm(prev => ({ ...prev, company: e.target.value }))}
                            className="w-full appearance-none h-8 rounded-lg border px-2.5 pr-8 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                          >
                            <option value="Finbook Advisors LLP">Finbook Advisors LLP</option>
                            <option value="Greenline Ventures">Greenline Ventures</option>
                            <option value="Apex Holdings">Apex Holdings</option>
                          </select>
                          <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--app-muted)]" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Column 3: Security */}
                  <div className="space-y-3">
                    <div className="space-y-2 border rounded-xl p-3 bg-[var(--app-content-bg)] border-[var(--app-border)]">
                      <div className="flex items-center gap-1.5 text-[var(--app-accent)] dark:text-[var(--app-accent)] font-bold border-b border-[var(--app-border)] pb-1 mb-2">
                        <Key size={13} />
                        <span className="text-[11px] uppercase tracking-wider font-black">3. Security Settings</span>
                      </div>

                      <div>
                        <label className="text-[9px] font-bold text-[var(--app-muted)] mb-0.5 block uppercase tracking-wide">Password *</label>
                        <input
                          type="password"
                          required
                          value={userForm.password}
                          onChange={(e) => setUserForm(prev => ({ ...prev, password: e.target.value }))}
                          placeholder="••••••••"
                          className="w-full h-8 rounded-lg border px-2.5 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                        />
                      </div>

                      <div>
                        <label className="text-[9px] font-bold text-[var(--app-muted)] mb-0.5 block uppercase tracking-wide">Confirm Password *</label>
                        <input
                          type="password"
                          required
                          value={userForm.confirmPassword}
                          onChange={(e) => setUserForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                          placeholder="••••••••"
                          className="w-full h-8 rounded-lg border px-2.5 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                        />
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* Modal Footer Buttons */}
              <div className="flex justify-end gap-2 p-3 md:p-4 border-t border-[var(--app-border)] text-[10px] font-bold uppercase tracking-wider shrink-0 bg-[var(--app-panel-bg)] rounded-b-none md:rounded-b-xl">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-1.5 border rounded-lg hover:bg-[var(--app-control-hover)] text-[var(--app-text)] transition-colors"
                  style={{ borderColor: 'var(--app-border)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-1.5 bg-[var(--app-cta)] hover:opacity-90 text-white rounded-full shadow-sm transition-all font-bold"
                >
                  Save User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Grid split: Top/Left User Table, Bottom/Right Checkbox Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 overflow-hidden">
        
        {/* Left/User Table */}
        <div className="lg:col-span-7 min-h-0 flex flex-col">
          <DataTable
            title="System Users"
            icon={Users}
            minWidth="560px"
            data={filteredUsers}
            rowKey={(u) => u.id}
            emptyText="No users found."
            columns={userColumns}
            search={{ value: searchQuery, onChange: setSearchQuery, placeholder: 'Search accounts…' }}
          />
        </div>

        {/* Right/Checkbox Permission Matrix */}
        <div className="lg:col-span-5 flex flex-col border rounded-xl overflow-hidden bg-[var(--app-panel-bg)] border-[var(--app-border)] shadow-sm">
          <h3 className="text-[14px] font-bold uppercase tracking-wider text-[var(--app-heading)] border-b p-2.5 border-[var(--app-border)] flex items-center gap-1.5 shrink-0" style={{ backgroundColor: 'var(--app-table-head-bg)' }}>
            <Shield size={13} className="text-[var(--app-accent)]" /> Role Permission Matrix Grid
          </h3>

          <div className="overflow-auto themed-scrollbar flex-1">
            <table className="w-full text-left border-collapse text-[12px]">
              <thead>
                <tr className="bg-[var(--app-content-bg)] border-b text-[var(--app-muted)] border-[var(--app-border)]" style={{ backgroundColor: 'var(--app-table-head-bg)' }}>
                  <th className="p-2 border-r border-[var(--app-border)] font-semibold w-24" style={{ color: 'var(--app-muted)' }}>Module</th>
                  {permissionActions.map(action => (
                    <th key={action} className="p-2 text-center border-r border-[var(--app-border)] w-16" style={{ color: 'var(--app-muted)' }}>{action}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {modulesList.map(mod => (
                  <tr key={mod} className="border-b hover:bg-[var(--app-row-hover)] border-[var(--app-border)]">
                    <td className="p-2 border-r font-semibold text-[var(--app-heading)] border-[var(--app-border)]">{mod}</td>
                    {permissionActions.map(action => (
                      <td key={action} className="p-2 text-center border-r border-[var(--app-border)]">
                        <input
                          type="checkbox"
                          checked={matrixState[mod]?.[action] || false}
                          onChange={() => handleCheckboxChange(mod, action)}
                          className="w-3.5 h-3.5 accent-[var(--app-accent)] rounded cursor-pointer"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-2.5 border-t border-[var(--app-border)] bg-[var(--app-content-bg)] flex justify-end shrink-0">
            <button
              onClick={() => toast.success('Role permissions matrix saved successfully!')}
              className="px-4 py-1 bg-[var(--app-accent)] hover:opacity-90 text-white font-bold text-[11px] uppercase shadow rounded transition-colors"
            >
              Save Permission Matrix
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
