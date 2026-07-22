import React, { useState, useEffect } from 'react';
import { 
  Plus, X, Trash2, Pencil, CheckCircle, Shield, Users, Mail, Key, User, 
  ChevronDown, ChevronRight, Search, Copy, Eye, FileText, Check, AlertCircle, 
  Minus, ArrowLeft, Building, Phone, Calendar, RefreshCw, Lock, LockOpen, Activity
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '../../stores/useAppStore';
import apiClient from '../../lib/apiClient';
import Badge from '../ui/Badge';

// MODULE CATEGORIES MATCHING SIDEBAR STRUCTURE AND ACCOUNTING ENTRIES STRICTLY
const MODULE_GROUPS = [
  {
    category: 'DASHBOARD & VOUCHER ENTRY',
    modules: [
      { id: 'dashboard', name: 'Dashboard', actions: ['view', 'create', 'edit', 'delete', 'approve'] },
      { id: 'manualVoucher', name: 'Manual Voucher Entry', actions: ['view', 'create', 'edit', 'delete', 'approve'] },
      { id: 'bulkUpload', name: 'Bulk Upload', actions: ['view', 'create', 'edit', 'delete', 'approve'] },
      { id: 'ocrUpload', name: 'OCR Upload', actions: ['view', 'create', 'edit', 'delete', 'approve'] },
      { id: 'textToEntry', name: 'Text to Entry', actions: ['view', 'create', 'edit', 'delete', 'approve'] },
      { id: 'approvalCenter', name: 'Approval Center', actions: ['view', 'create', 'edit', 'delete', 'approve'] },
    ]
  },
  {
    category: 'SALES',
    modules: [
      { id: 'salesInbox', name: 'Sales Inbox & Review', actions: ['view', 'create', 'edit', 'delete', 'approve'] },
      { id: 'salesOrder', name: 'Sales Order', actions: ['view', 'create', 'edit', 'delete', 'approve'] },
      { id: 'salesInvoice', name: 'Sales Invoice', actions: ['view', 'create', 'edit', 'delete', 'approve'] },
      { id: 'salesReturn', name: 'Credit Note (Sales Return)', actions: ['view', 'create', 'edit', 'delete', 'approve'] },
    ]
  },
  {
    category: 'PURCHASE',
    modules: [
      { id: 'purchaseInbox', name: 'Purchase Inbox & Review', actions: ['view', 'create', 'edit', 'delete', 'approve'] },
      { id: 'purchaseOrder', name: 'Purchase Order', actions: ['view', 'create', 'edit', 'delete', 'approve'] },
      { id: 'purchaseInvoice', name: 'Purchase Invoice', actions: ['view', 'create', 'edit', 'delete', 'approve'] },
      { id: 'debitNote', name: 'Debit Note (Purchase Return)', actions: ['view', 'create', 'edit', 'delete', 'approve'] },
    ]
  },
  {
    category: 'FUND FLOW & BANK',
    modules: [
      { id: 'payment', name: 'Payment Voucher', actions: ['view', 'create', 'edit', 'delete', 'approve'] },
      { id: 'receipt', name: 'Receipt Voucher', actions: ['view', 'create', 'edit', 'delete', 'approve'] },
      { id: 'contra', name: 'Contra Voucher', actions: ['view', 'create', 'edit', 'delete', 'approve'] },
      { id: 'manageBank', name: 'Manage Bank & Rules', actions: ['view', 'create', 'edit', 'delete', 'approve'] },
    ]
  },
  {
    category: 'MASTERS & INTEGRATIONS',
    modules: [
      { id: 'ledgerMaster', name: 'Ledger Master', actions: ['view', 'create', 'edit', 'delete', 'approve'] },
      { id: 'itemMaster', name: 'Item Master', actions: ['view', 'create', 'edit', 'delete', 'approve'] },
      { id: 'tallyConnector', name: 'Tally Connector', actions: ['view', 'create', 'edit', 'delete', 'approve'] },
      { id: 'documentArchive', name: 'Document Archive', actions: ['view', 'create', 'edit', 'delete', 'approve'] },
    ]
  },
  {
    category: 'ADMINISTRATION',
    modules: [
      { id: 'companies', name: 'Companies', actions: ['view', 'create', 'edit', 'delete', 'approve'] },
      { id: 'clients', name: 'Clients', actions: ['view', 'create', 'edit', 'delete', 'approve'] },
      { id: 'usersRoles', name: 'User & Role Management', actions: ['view', 'create', 'edit', 'delete', 'approve'] },
      { id: 'configuration', name: 'Configuration', actions: ['view', 'create', 'edit', 'delete', 'approve'] },
    ]
  }
];

const PERMISSION_ACTIONS = ['view', 'create', 'edit', 'delete', 'approve'];

export default function RolePanel({ mode: propMode }) {
  const [activeTab, setActiveTab] = useState('Users'); // 'Users' | 'Roles & Permissions'
  
  // Users State
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [selectedUserDrawer, setSelectedUserDrawer] = useState(null);

  // User Form (NO PERMISSIONS SELECTION AS REQUESTED)
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    phone: '',
    department: 'Accounting',
    role: '',
    status: 'Active',
    password: '',
    confirmPassword: ''
  });

  // Roles State
  const [roleSearch, setRoleSearch] = useState('');
  const [editingRole, setEditingRole] = useState(null); // null = overview, object = editing matrix
  const [matrixState, setMatrixState] = useState({});
  const [expandedGroups, setExpandedGroups] = useState({
    'DASHBOARD & VOUCHER ENTRY': true,
    'SALES': true,
    'PURCHASE': true,
    'FUND FLOW & BANK': true,
    'MASTERS & INTEGRATIONS': true,
    'ADMINISTRATION': true
  });
  const [matrixSearch, setMatrixSearch] = useState('');

  const currentUser = useAppStore((s) => s.user);
  const orgName = useAppStore((s) => s.orgName) || 'Organization';

  // 1. Fetch Roles from API
  const fetchRoles = async () => {
    setLoadingRoles(true);
    try {
      const res = await apiClient.get('/auth/roles');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setRoles(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch roles:', err);
    } finally {
      setLoadingRoles(false);
    }
  };

  // 2. Fetch Users from API
  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await apiClient.get('/auth/users');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setUsers(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchRoles();
    fetchUsers();
  }, []);

  // Sync userForm role default when roles load
  useEffect(() => {
    if (roles.length > 0 && !userForm.role) {
      setUserForm(prev => ({ ...prev, role: roles[0].id || roles[0].name }));
    }
  }, [roles]);

  // Handle User Create / Edit Submission (WITHOUT PERMISSION SELECTION)
  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (!userForm.name || !userForm.email) {
      toast.error('Name and Email are required.');
      return;
    }
    if (!editingUserId && !userForm.password) {
      toast.error('Password is required for new user.');
      return;
    }
    if (userForm.password && userForm.password !== userForm.confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    try {
      const payload = {
        name: userForm.name.trim(),
        email: userForm.email.trim(),
        phone: userForm.phone || "",
        department: userForm.department || "Accounting",
        role: userForm.role,
        isActive: userForm.status === 'Active',
        password: userForm.password || undefined
      };

      if (editingUserId) {
        await apiClient.put(`/auth/users/${editingUserId}`, payload);
        toast.success('User updated successfully!');
      } else {
        await apiClient.post('/auth/users', payload);
        toast.success('New user created successfully!');
      }

      await fetchUsers();
      await fetchRoles();
      handleCloseUserModal();
    } catch (err) {
      toast.error(err?.response?.data?.detail || err?.message || 'Failed to save user');
    }
  };

  const handleCloseUserModal = () => {
    setUserForm({
      name: '',
      email: '',
      phone: '',
      department: 'Accounting',
      role: roles[0]?.id || roles[0]?.name || '',
      status: 'Active',
      password: '',
      confirmPassword: ''
    });
    setEditingUserId(null);
    setShowCreateUserModal(false);
  };

  const handleEditUserClick = (u) => {
    setEditingUserId(u.id);
    setUserForm({
      name: u.name || '',
      email: u.email || '',
      phone: u.phone || '',
      department: u.department || 'Accounting',
      role: u.role || 'senior_accountant',
      status: u.status === 'active' || u.status === 'Active' ? 'Active' : 'Inactive',
      password: '',
      confirmPassword: ''
    });
    setShowCreateUserModal(true);
  };

  const handleToggleUserStatus = async (u) => {
    const newStatus = !(u.status === 'active' || u.status === 'Active');
    try {
      await apiClient.put(`/auth/users/${u.id}`, {
        name: u.name,
        email: u.email,
        role: u.role,
        isActive: newStatus
      });
      toast.success(`User ${newStatus ? 'activated' : 'deactivated'} successfully!`);
      fetchUsers();
    } catch (err) {
      toast.error('Failed to update user status');
    }
  };

  const handleDeleteUser = async (id) => {
    if (id === currentUser?.id) {
      toast.error('Cannot delete currently logged-in user profile.');
      return;
    }
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        await apiClient.delete(`/auth/users/${id}`);
        toast.success('User profile deleted successfully');
        fetchUsers();
        fetchRoles();
      } catch (err) {
        toast.error('Failed to delete user');
      }
    }
  };

  const handleResetPassword = async (u) => {
    const newPassword = prompt(`Enter new password for ${u.name} (${u.email}):`);
    if (!newPassword || !newPassword.trim()) return;
    try {
      await apiClient.put(`/auth/users/${u.id}`, {
        name: u.name,
        email: u.email,
        role: u.role,
        password: newPassword.trim()
      });
      toast.success(`Password reset successfully for ${u.name}!`);
    } catch (err) {
      toast.error('Failed to reset password');
    }
  };

  // -------------------------------------------------------------
  // ROLES & PERMISSIONS MATRIX HANDLERS
  // -------------------------------------------------------------
  const handleOpenRoleEditor = (roleObj = null) => {
    if (roleObj) {
      setEditingRole({
        id: roleObj.id || roleObj.name,
        name: roleObj.displayName || roleObj.name,
        description: roleObj.description || '',
        usersCount: roleObj.usersCount || 0,
        createdBy: roleObj.createdBy || 'Admin',
        createdAt: roleObj.createdAt || '2024-05-12',
        updatedAt: roleObj.updatedAt || '2024-05-20',
        isSystem: roleObj.isSystem || false
      });
      setMatrixState(roleObj.permissions || {});
    } else {
      setEditingRole({
        id: '',
        name: '',
        description: '',
        usersCount: 0,
        createdBy: currentUser?.name || 'Admin',
        createdAt: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString().split('T')[0],
        isSystem: false
      });
      setMatrixState({});
    }
  };

  const handleMatrixCheckboxChange = (moduleId, action) => {
    setMatrixState(prev => {
      const modObj = prev[moduleId] || {};
      const nextVal = !modObj[action];
      return {
        ...prev,
        [moduleId]: {
          ...modObj,
          [action]: nextVal
        }
      };
    });
  };

  const handleSelectAllMatrix = () => {
    const newMatrix = {};
    MODULE_GROUPS.forEach(grp => {
      grp.modules.forEach(m => {
        newMatrix[m.id] = {};
        m.actions.forEach(act => {
          newMatrix[m.id][act] = true;
        });
      });
    });
    setMatrixState(newMatrix);
    toast.success('Full access (Select All) applied across all modules!');
  };

  const handleRejectAllMatrix = () => {
    const newMatrix = {};
    MODULE_GROUPS.forEach(grp => {
      grp.modules.forEach(m => {
        newMatrix[m.id] = {};
        m.actions.forEach(act => {
          newMatrix[m.id][act] = false;
        });
      });
    });
    setMatrixState(newMatrix);
    toast.info('No access (Reject All) applied across all modules!');
  };

  const handleSelectCategory = (categoryGroup) => {
    setMatrixState(prev => {
      const next = { ...prev };
      categoryGroup.modules.forEach(m => {
        next[m.id] = { ...(next[m.id] || {}) };
        m.actions.forEach(act => {
          next[m.id][act] = true;
        });
      });
      return next;
    });
    toast.success(`Select All applied for ${categoryGroup.category}`);
  };

  const handleRejectCategory = (categoryGroup) => {
    setMatrixState(prev => {
      const next = { ...prev };
      categoryGroup.modules.forEach(m => {
        next[m.id] = { ...(next[m.id] || {}) };
        m.actions.forEach(act => {
          next[m.id][act] = false;
        });
      });
      return next;
    });
    toast.info(`Reject All applied for ${categoryGroup.category}`);
  };

  const handleSelectModule = (moduleObj) => {
    setMatrixState(prev => {
      const nextMod = { ...(prev[moduleObj.id] || {}) };
      moduleObj.actions.forEach(act => {
        nextMod[act] = true;
      });
      return { ...prev, [moduleObj.id]: nextMod };
    });
  };

  const handleRejectModule = (moduleObj) => {
    setMatrixState(prev => {
      const nextMod = { ...(prev[moduleObj.id] || {}) };
      moduleObj.actions.forEach(act => {
        nextMod[act] = false;
      });
      return { ...prev, [moduleObj.id]: nextMod };
    });
  };

  const handleExpandAllGroups = () => {
    const updated = {};
    MODULE_GROUPS.forEach(g => { updated[g.category] = true; });
    setExpandedGroups(updated);
  };

  const handleCollapseAllGroups = () => {
    const updated = {};
    MODULE_GROUPS.forEach(g => { updated[g.category] = false; });
    setExpandedGroups(updated);
  };

  const handleSaveRoleMatrix = async () => {
    if (!editingRole?.name || !editingRole.name.trim()) {
      toast.error('Role name is required.');
      return;
    }

    try {
      const payload = {
        name: editingRole.name.trim(),
        displayName: editingRole.name.trim(),
        description: editingRole.description || '',
        permissions: matrixState
      };

      if (editingRole.id) {
        await apiClient.put(`/auth/roles/${editingRole.id}`, payload);
        toast.success(`Role "${editingRole.name}" updated! Permissions automatically inherited by all assigned users.`);
      } else {
        await apiClient.post('/auth/roles', payload);
        toast.success(`Role "${editingRole.name}" created successfully!`);
      }

      await fetchRoles();
      await fetchUsers();
      setEditingRole(null);
    } catch (err) {
      toast.error(err?.response?.data?.detail || err?.message || 'Failed to save role permissions');
    }
  };

  const handleCloneRole = (r) => {
    setEditingRole({
      id: '',
      name: `${r.displayName || r.name} (Copy)`,
      description: `Copy of ${r.description || r.displayName || r.name}`,
      usersCount: 0,
      createdBy: currentUser?.name || 'Admin',
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
      isSystem: false
    });
    setMatrixState(r.permissions || {});
    toast.info(`Cloned role definition for ${r.displayName || r.name}`);
  };

  const handleDeleteRole = async (rId) => {
    if (window.confirm('Are you sure you want to delete this role definition?')) {
      try {
        await apiClient.delete(`/auth/roles/${rId}`);
        toast.success('Role deleted successfully!');
        fetchRoles();
      } catch (err) {
        toast.error('Failed to delete role');
      }
    }
  };

  // Helper for matrix metrics calculation
  const getMatrixMetrics = () => {
    let modulesAllowedCount = 0;
    let totalPermissionsCount = 0;

    MODULE_GROUPS.forEach(grp => {
      grp.modules.forEach(m => {
        let hasAny = false;
        m.actions.forEach(act => {
          if (matrixState[m.id]?.[act]) {
            totalPermissionsCount++;
            hasAny = true;
          }
        });
        if (hasAny) modulesAllowedCount++;
      });
    });

    return { modulesAllowedCount, totalPermissionsCount };
  };

  // User Filtering Logic
  const filteredUsers = users.filter(u => {
    const matchSearch = userSearch === '' || 
      (u.name && u.name.toLowerCase().includes(userSearch.toLowerCase())) ||
      (u.email && u.email.toLowerCase().includes(userSearch.toLowerCase())) ||
      (u.phone && u.phone.includes(userSearch));

    const matchRole = roleFilter === 'All' || u.role === roleFilter || (u.role && u.role.toLowerCase() === roleFilter.toLowerCase());
    
    const isAct = u.status === 'active' || u.status === 'Active';
    const matchStatus = statusFilter === 'All' || (statusFilter === 'Active' && isAct) || (statusFilter === 'Inactive' && !isAct);

    return matchSearch && matchRole && matchStatus;
  });

  const totalUsersCount = users.length;
  const activeUsersCount = users.filter(u => u.status === 'active' || u.status === 'Active').length;
  const inactiveUsersCount = totalUsersCount - activeUsersCount;

  // Filtered roles overview
  const filteredRoles = roles.filter(r => 
    roleSearch === '' || 
    (r.displayName && r.displayName.toLowerCase().includes(roleSearch.toLowerCase())) ||
    (r.name && r.name.toLowerCase().includes(roleSearch.toLowerCase()))
  );
  return (
    <div className="flex flex-col h-full overflow-hidden p-2 text-[13px] text-[var(--app-text)] select-none bg-[var(--app-bg)]">
      
      {/* ───────────────────────────────────────────────────────────── */}
      {/* MATRIX EDITOR MODE (2 CLEAN CARDS: ROLE INFO + MATRIX TABLE)   */}
      {/* ───────────────────────────────────────────────────────────── */}
      {editingRole ? (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden space-y-2">
          
          {/* Card 1: Role Name & Actions Header */}
          <div className="rounded-xl border px-4 py-3 flex items-center justify-between gap-3 shrink-0 bg-[var(--app-panel-bg)] border-[var(--app-border)] shadow-xs">
            <div className="flex items-center gap-3 flex-1">
              <button
                type="button"
                onClick={() => setEditingRole(null)}
                title="Back to Roles list"
                className="h-8 w-8 rounded-lg border border-[var(--app-border)] hover:bg-[var(--app-control-hover)] flex items-center justify-center text-[var(--app-heading)] transition-all shrink-0"
              >
                <ArrowLeft size={16} />
              </button>
              
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-wider text-[var(--app-muted)] block mb-0.5">Role Name *</label>
                  <input
                    type="text"
                    required
                    value={editingRole.name}
                    onChange={(e) => setEditingRole(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Senior Accountant"
                    className="w-full h-8 px-2.5 rounded-lg border text-xs font-bold bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)] outline-none"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-wider text-[var(--app-muted)] block mb-0.5">Description</label>
                  <input
                    type="text"
                    value={editingRole.description || ''}
                    onChange={(e) => setEditingRole(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="e.g. Can manage all accounting transactions and reports"
                    className="w-full h-8 px-2.5 rounded-lg border text-xs bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)] outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setEditingRole(null)}
                className="h-8 px-3 border border-[var(--app-border)] hover:bg-[var(--app-control-hover)] text-[var(--app-text)] font-bold text-xs rounded-lg transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveRoleMatrix}
                className="h-8 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition-all shadow-xs flex items-center gap-1.5"
              >
                <Check size={14} />
                Save Role
              </button>
            </div>
          </div>

          {/* Card 2: Full Width Permission Matrix Table Container */}
          <div className="flex-1 rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] flex flex-col min-h-0 overflow-hidden shadow-xs">
            
            {/* Matrix Card Header */}
            <div className="p-3 border-b border-[var(--app-border)] flex flex-wrap items-center justify-between gap-3 bg-[var(--app-panel-bg)] shrink-0">
              <div>
                <h3 className="text-sm font-extrabold text-[var(--app-heading)]">Permission Matrix</h3>
                <p className="text-[10px] text-[var(--app-muted)]">Define module access rights: View, Create, Edit, Delete, Approve, and Full Access</p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--app-muted)] pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search module..."
                    value={matrixSearch}
                    onChange={(e) => setMatrixSearch(e.target.value)}
                    className="h-7 pl-7 pr-2 text-xs rounded-md border bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)] outline-none w-36"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleExpandAllGroups}
                  className="h-7 px-2.5 text-[11px] font-bold border rounded-md border-[var(--app-border)] text-[var(--app-text)] hover:bg-[var(--app-control-hover)] flex items-center gap-1"
                >
                  <RefreshCw size={11} /> Expand All
                </button>
                <button
                  type="button"
                  onClick={handleCollapseAllGroups}
                  className="h-7 px-2.5 text-[11px] font-bold border rounded-md border-[var(--app-border)] text-[var(--app-text)] hover:bg-[var(--app-control-hover)] flex items-center gap-1"
                >
                  <Minus size={11} /> Collapse All
                </button>

                <button
                  type="button"
                  onClick={handleSelectAllMatrix}
                  className="h-7 px-3 text-[11px] font-bold rounded-md bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 shadow-xs"
                  title="Select All Permissions Across All Modules"
                >
                  <CheckCircle size={11} /> Select All
                </button>
                <button
                  type="button"
                  onClick={handleRejectAllMatrix}
                  className="h-7 px-3 text-[11px] font-bold rounded-md bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1 shadow-xs"
                  title="Reject All Permissions Across All Modules"
                >
                  <X size={11} /> Reject All
                </button>
              </div>
            </div>

            {/* Matrix Table Body */}
            <div className="flex-1 overflow-y-auto themed-scrollbar">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 z-20 bg-[var(--app-content-bg)] border-b border-[var(--app-border)] text-[11px] font-extrabold text-[var(--app-muted)]">
                  <tr>
                    <th className="py-2.5 px-3 border-r border-[var(--app-border)] min-w-[220px]">Module</th>
                    {PERMISSION_ACTIONS.map(action => (
                      <th key={action} className="py-2.5 px-2 text-center border-r border-[var(--app-border)] capitalize w-20">
                        {action}
                      </th>
                    ))}
                    <th className="py-2.5 px-2 text-center border-r border-[var(--app-border)] w-28 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300">
                      <div className="flex items-center justify-center gap-1 cursor-pointer" onClick={handleSelectAllMatrix} title="Click to Select All across Matrix">
                        <CheckCircle size={12} /> Full Access
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                    {MODULE_GROUPS.map(grp => {
                      const isExpanded = expandedGroups[grp.category] ?? true;
                      const filteredMods = grp.modules.filter(m => 
                        matrixSearch === '' || m.name.toLowerCase().includes(matrixSearch.toLowerCase())
                      );

                      if (filteredMods.length === 0) return null;

                      return (
                        <React.Fragment key={grp.category}>
                          {/* Category Header Row */}
                          <tr 
                            onClick={() => setExpandedGroups(prev => ({ ...prev, [grp.category]: !isExpanded }))}
                            className="bg-indigo-50/60 dark:bg-indigo-950/30 border-y border-[var(--app-border)] cursor-pointer hover:bg-indigo-100/60 dark:hover:bg-indigo-900/40 transition-colors"
                          >
                            <td colSpan={PERMISSION_ACTIONS.length + 2} className="py-2 px-3 font-extrabold text-[11px] text-indigo-700 dark:text-indigo-400 tracking-wider">
                              <div className="flex items-center gap-1.5">
                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                <span>v {grp.category}</span>
                              </div>
                            </td>
                          </tr>

                          {/* Module Sub-Rows */}
                          {isExpanded && filteredMods.map(m => {
                            const allSupportedChecked = m.actions.every(act => matrixState[m.id]?.[act]);

                            return (
                              <tr key={m.id} className="border-b border-[var(--app-border)] hover:bg-[var(--app-row-hover)] transition-colors">
                                <td className="py-2 px-3 border-r border-[var(--app-border)] font-semibold text-[var(--app-heading)]">
                                  <span className="truncate">{m.name}</span>
                                </td>

                                {PERMISSION_ACTIONS.map(act => {
                                  const isSupported = m.actions.includes(act);
                                  const isChecked = matrixState[m.id]?.[act] || false;

                                  return (
                                    <td key={act} className="py-2 px-2 text-center border-r border-[var(--app-border)]">
                                      {isSupported ? (
                                        <button
                                          type="button"
                                          onClick={() => handleMatrixCheckboxChange(m.id, act)}
                                          className={`h-5 w-5 rounded flex items-center justify-center transition-all mx-auto ${
                                            isChecked 
                                              ? 'bg-emerald-500 text-white font-bold shadow-xs' 
                                              : 'bg-rose-500/10 text-rose-600 border border-rose-500/30 hover:bg-rose-500/20'
                                          }`}
                                        >
                                          {isChecked ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={2.5} />}
                                        </button>
                                      ) : (
                                        <span className="text-[var(--app-muted)] opacity-30 select-none text-xs">—</span>
                                      )}
                                    </td>
                                  );
                                })}

                                {/* Full Access Column (Single click toggles all permissions for the row!) */}
                                <td className="py-2 px-2 text-center border-r border-[var(--app-border)] bg-indigo-50/20 dark:bg-indigo-950/10">
                                  <button
                                    type="button"
                                    onClick={() => allSupportedChecked ? handleRejectModule(m) : handleSelectModule(m)}
                                    title={allSupportedChecked ? "Reject All for this module" : "Full Access (Select All for this module)"}
                                    className={`h-5 w-5 rounded flex items-center justify-center transition-all mx-auto ${
                                      allSupportedChecked 
                                        ? 'bg-indigo-600 text-white font-bold shadow-xs' 
                                        : 'bg-indigo-500/10 text-indigo-600 border border-indigo-500/30 hover:bg-indigo-500/20'
                                    }`}
                                  >
                                    {allSupportedChecked ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={2.5} />}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Matrix Legend & Disclaimer Footer */}
              <div className="p-2.5 border-t border-[var(--app-border)] bg-[var(--app-content-bg)] flex flex-wrap items-center justify-between gap-3 text-[11px] shrink-0">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1 font-bold text-emerald-600"><span className="h-4 w-4 rounded bg-emerald-500 text-white flex items-center justify-center text-[10px]"><Check size={10} strokeWidth={3} /></span> Allowed</span>
                  <span className="flex items-center gap-1 font-bold text-rose-600"><span className="h-4 w-4 rounded bg-rose-500/10 text-rose-600 border border-rose-500/30 flex items-center justify-center text-[10px]"><X size={10} strokeWidth={3} /></span> Not Allowed</span>
                  <span className="flex items-center gap-1 font-bold text-indigo-600"><span className="h-4 w-4 rounded bg-indigo-600 text-white flex items-center justify-center text-[10px]"><Check size={10} strokeWidth={3} /></span> Full Access Toggle</span>
                </div>
                <p className="text-[10px] text-[var(--app-muted)] italic">
                  Changes in role permissions will be automatically applied to all users assigned to this role.
                </p>
              </div>

            </div>
          </div>
      ) : (
        <>
          {/* ── TOP ERP HEADER (OVERVIEW MODE) ── */}
          <div className="rounded-xl border px-4 py-2.5 flex items-center justify-between gap-3 shrink-0 bg-[var(--app-panel-bg)] border-[var(--app-border)] shadow-xs">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: 'var(--app-accent-gradient)', boxShadow: 'var(--app-shadow)' }}>
                <Shield size={16} strokeWidth={2.2} />
              </div>
              <div>
                <h1 className="text-base font-extrabold tracking-tight text-[var(--app-heading)] leading-none">User &amp; Role Management</h1>
                <p className="text-[10.5px] text-[var(--app-muted)] mt-0.5">Manage users, roles and permissions for enterprise multi-tenancy</p>
              </div>
            </div>

            {/* Tab Switcher */}
            <div className="flex items-center bg-[var(--app-content-bg)] border border-[var(--app-border)] p-1 rounded-lg">
              <button
                onClick={() => setActiveTab('Users')}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-md transition-all ${
                  activeTab === 'Users' 
                    ? 'bg-[var(--app-accent)] text-white shadow-xs' 
                    : 'text-[var(--app-muted)] hover:text-[var(--app-heading)]'
                }`}
              >
                <Users size={13} />
                Users ({totalUsersCount})
              </button>
              <button
                onClick={() => setActiveTab('Roles & Permissions')}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-md transition-all ${
                  activeTab === 'Roles & Permissions' 
                    ? 'bg-[var(--app-accent)] text-white shadow-xs' 
                    : 'text-[var(--app-muted)] hover:text-[var(--app-heading)]'
                }`}
              >
                <Shield size={13} />
                Roles &amp; Permissions ({roles.length})
              </button>
            </div>
          </div>

          {/* ───────────────────────────────────────────────────────────── */}
          {/* TAB 1: USERS                                                 */}
          {/* ───────────────────────────────────────────────────────────── */}
          {activeTab === 'Users' && (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden space-y-2 mt-2">
              
              {/* Top Filter & Actions Bar */}
              <div className="rounded-xl border p-2.5 flex items-center justify-between gap-3 shrink-0 bg-[var(--app-panel-bg)] border-[var(--app-border)]">
                <div className="flex items-center gap-2 flex-1 max-w-3xl">
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--app-muted)] pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search user by name, email, phone..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="w-full h-8 pl-8 pr-2.5 rounded-lg border text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                    />
                  </div>

                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="h-8 rounded-lg border px-2.5 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)]"
                  >
                    <option value="All">All Roles</option>
                    {roles.map(r => (
                      <option key={r.id} value={r.name}>{r.displayName || r.name}</option>
                    ))}
                  </select>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="h-8 rounded-lg border px-2.5 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)]"
                  >
                    <option value="All">All Status</option>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                <button
                  onClick={() => { setEditingUserId(null); setShowCreateUserModal(true); }}
                  className="h-8 px-3.5 bg-[var(--app-accent)] hover:opacity-90 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition-all shrink-0 shadow-xs"
                >
                  <Plus size={14} />
                  Create User
                </button>
              </div>

              {/* Smooth Stats Strip */}
              <div className="flex items-center gap-4 px-3 py-2 border rounded-xl bg-[var(--app-panel-bg)] border-[var(--app-border)] text-xs font-semibold shrink-0">
                <span className="flex items-center gap-1.5"><Users size={14} className="text-blue-500" /> Total Users: <b className="text-[var(--app-heading)]">{totalUsersCount}</b></span>
                <span className="text-[var(--app-border)]">|</span>
                <span className="flex items-center gap-1.5"><CheckCircle size={14} className="text-emerald-500" /> Active Users: <b className="text-[var(--app-heading)]">{activeUsersCount}</b></span>
                <span className="text-[var(--app-border)]">|</span>
                <span className="flex items-center gap-1.5"><Minus size={14} className="text-amber-500" /> Inactive Users: <b className="text-[var(--app-heading)]">{inactiveUsersCount}</b></span>
                <span className="text-[var(--app-border)]">|</span>
                <span className="flex items-center gap-1.5"><Mail size={14} className="text-purple-500" /> Pending Invites: <b className="text-[var(--app-heading)]">0</b></span>
              </div>

              {/* User Table */}
              <div className="flex-1 rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] overflow-hidden flex flex-col min-h-0 shadow-xs">
                <div className="flex-1 overflow-y-auto themed-scrollbar">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="sticky top-0 z-10 bg-[var(--app-content-bg)] border-b border-[var(--app-border)] uppercase tracking-wider text-[10px] font-extrabold text-[var(--app-muted)]">
                      <tr>
                        <th className="py-2.5 px-3 border-r border-[var(--app-border)] w-10 text-center">Sr</th>
                        <th className="py-2.5 px-3 border-r border-[var(--app-border)]">User Details</th>
                        <th className="py-2.5 px-3 border-r border-[var(--app-border)]">Mobile</th>
                        <th className="py-2.5 px-3 border-r border-[var(--app-border)]">Assigned Role</th>
                        <th className="py-2.5 px-3 border-r border-[var(--app-border)]">Company / Dept</th>
                        <th className="py-2.5 px-3 border-r border-[var(--app-border)] text-center">Status</th>
                        <th className="py-2.5 px-3 border-r border-[var(--app-border)]">Last Login</th>
                        <th className="py-2.5 px-3 text-center w-28">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--app-border)]">
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan="8" className="py-12 text-center text-[var(--app-muted)]">
                            No organization users found matching filter.
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((u, index) => {
                          const isAct = u.status === 'active' || u.status === 'Active';
                          const isAdmin = (u.role || '').toLowerCase() === 'admin' || (u.role || '').toLowerCase() === 'administrator';
                          const initials = (u.name || u.email || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                          const roleDisplay = roles.find(r => r.id === u.role || r.name === u.role)?.displayName || u.role;

                          return (
                            <tr key={u.id} className="hover:bg-[var(--app-row-hover)] transition-colors">
                              <td className="py-2 px-3 text-center font-mono text-[var(--app-muted)] border-r border-[var(--app-border)]">{index + 1}</td>
                              
                              <td className="py-2 px-3 border-r border-[var(--app-border)]">
                                <div className="flex items-center gap-2.5">
                                  <div className="h-7 w-7 rounded-full bg-[var(--app-accent-soft)] text-[var(--app-accent)] font-bold text-[10px] flex items-center justify-center shrink-0 border border-[var(--app-accent)]">
                                    {initials}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-bold text-[var(--app-heading)] truncate">{u.name || 'User'}</p>
                                    <p className="text-[10px] text-[var(--app-muted)] truncate">{u.email}</p>
                                  </div>
                                </div>
                              </td>

                              <td className="py-2 px-3 border-r border-[var(--app-border)] text-[var(--app-text)] font-mono">{u.phone || 'N/A'}</td>

                              <td className="py-2 px-3 border-r border-[var(--app-border)]">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-[var(--app-accent-soft)] text-[var(--app-accent)] border border-[var(--app-border)]">
                                  <Shield size={11} />
                                  {roleDisplay}
                                </span>
                              </td>

                              <td className="py-2 px-3 border-r border-[var(--app-border)] text-[var(--app-text)]">
                                <p className="font-semibold text-[var(--app-heading)]">{u.company || orgName}</p>
                                <p className="text-[10px] text-[var(--app-muted)]">{u.department || 'Accounting'}</p>
                              </td>

                              <td className="py-2 px-3 border-r border-[var(--app-border)] text-center">
                                <Badge tone={isAct ? 'success' : 'neutral'}>{isAct ? 'Active' : 'Inactive'}</Badge>
                              </td>

                              <td className="py-2 px-3 border-r border-[var(--app-border)] font-mono text-[10px] text-[var(--app-muted)]">
                                {u.lastLogin || 'Never logged in'}
                              </td>

                              <td className="py-2 px-3 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button onClick={() => setSelectedUserDrawer(u)} title="View Details" className="p-1 hover:bg-[var(--app-control-hover)] rounded text-[var(--app-muted)] hover:text-[var(--app-accent)]"><Eye size={13} /></button>
                                  <button onClick={() => handleEditUserClick(u)} title="Edit User" className="p-1 hover:bg-[var(--app-control-hover)] rounded text-[var(--app-muted)] hover:text-[var(--app-accent)]"><Pencil size={13} /></button>
                                  <button onClick={() => handleResetPassword(u)} title="Reset Password" className="p-1 hover:bg-[var(--app-control-hover)] rounded text-[var(--app-muted)] hover:text-amber-500"><Key size={13} /></button>
                                  
                                  {isAdmin ? (
                                    <button disabled title="Organization Admin cannot be deactivated" className="p-1 opacity-30 cursor-not-allowed text-[var(--app-muted)]">
                                      <LockOpen size={13} />
                                    </button>
                                  ) : (
                                    <button onClick={() => handleToggleUserStatus(u)} title={isAct ? "Deactivate" : "Activate"} className="p-1 hover:bg-[var(--app-control-hover)] rounded text-[var(--app-muted)] hover:text-emerald-500">
                                      {isAct ? <LockOpen size={13} /> : <Lock size={13} />}
                                    </button>
                                  )}

                                  {isAdmin ? (
                                    <button disabled title="Organization Admin account cannot be deleted" className="p-1 opacity-30 cursor-not-allowed text-[var(--app-muted)]">
                                      <Trash2 size={13} />
                                    </button>
                                  ) : (
                                    <button onClick={() => handleDeleteUser(u.id)} title="Delete User" className="p-1 hover:bg-[var(--app-control-hover)] rounded text-[var(--app-muted)] hover:text-rose-500"><Trash2 size={13} /></button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* TAB 2: ROLES & PERMISSIONS OVERVIEW                          */}
          {/* ───────────────────────────────────────────────────────────── */}
          {activeTab === 'Roles & Permissions' && (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden space-y-2 mt-2">
              
              {/* Top Bar for Roles */}
              <div className="rounded-xl border p-2.5 flex items-center justify-between gap-3 shrink-0 bg-[var(--app-panel-bg)] border-[var(--app-border)]">
                <div className="relative flex-1 max-w-md">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--app-muted)] pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search role by name or description..."
                    value={roleSearch}
                    onChange={(e) => setRoleSearch(e.target.value)}
                    className="w-full h-8 pl-8 pr-2.5 rounded-lg border text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                  />
                </div>

                <button
                  onClick={() => handleOpenRoleEditor(null)}
                  className="h-8 px-3.5 bg-[var(--app-accent)] hover:opacity-90 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition-all shrink-0 shadow-xs"
                >
                  <Plus size={14} />
                  Create Custom Role
                </button>
              </div>

              {/* Roles Table Overview */}
              <div className="flex-1 rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] overflow-hidden flex flex-col min-h-0 shadow-xs">
                <div className="flex-1 overflow-y-auto themed-scrollbar">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="sticky top-0 z-10 bg-[var(--app-content-bg)] border-b border-[var(--app-border)] uppercase tracking-wider text-[10px] font-extrabold text-[var(--app-muted)]">
                      <tr>
                        <th className="py-2.5 px-3 border-r border-[var(--app-border)] w-12 text-center">Sr</th>
                        <th className="py-2.5 px-3 border-r border-[var(--app-border)] w-56">Role Name</th>
                        <th className="py-2.5 px-3 border-r border-[var(--app-border)]">Description</th>
                        <th className="py-2.5 px-3 border-r border-[var(--app-border)] text-center w-32">Assigned Users</th>
                        <th className="py-2.5 px-3 border-r border-[var(--app-border)] w-36">Created Date</th>
                        <th className="py-2.5 px-3 text-center w-48">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--app-border)]">
                      {filteredRoles.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="py-12 text-center text-[var(--app-muted)]">
                            No organization roles found. Click "+ Create Custom Role" to define one.
                          </td>
                        </tr>
                      ) : (
                        filteredRoles.map((r, index) => (
                          <tr key={r.id || r.name} className="hover:bg-[var(--app-row-hover)] transition-colors">
                            <td className="py-2.5 px-3 text-center font-mono text-[var(--app-muted)] border-r border-[var(--app-border)]">{index + 1}</td>
                            
                            <td className="py-2.5 px-3 border-r border-[var(--app-border)] font-bold text-[var(--app-heading)]">
                              <div className="flex items-center gap-2">
                                <span className="h-6 w-6 rounded bg-[var(--app-accent-soft)] text-[var(--app-accent)] flex items-center justify-center shrink-0 border border-[var(--app-accent)]">
                                  <Shield size={13} />
                                </span>
                                <span className="truncate">{r.displayName || r.name}</span>
                                {r.isSystem && <span className="text-[8px] font-black uppercase px-1 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20">System</span>}
                              </div>
                            </td>

                            <td className="py-2.5 px-3 border-r border-[var(--app-border)] text-[var(--app-muted)]">
                              <p className="truncate max-w-md">{r.description || 'Custom role permission definition'}</p>
                            </td>

                            <td className="py-2.5 px-3 border-r border-[var(--app-border)] text-center">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20">
                                <Users size={12} />
                                {r.usersCount || 0} Users
                              </span>
                            </td>

                            <td className="py-2.5 px-3 border-r border-[var(--app-border)] font-mono text-[11px] text-[var(--app-muted)]">
                              {r.createdAt ? String(r.createdAt).split('T')[0] : '2024-05-12'}
                            </td>

                            <td className="py-2.5 px-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => handleOpenRoleEditor(r)}
                                  className="px-2.5 py-1 bg-[var(--app-accent)] hover:opacity-90 text-white font-bold text-xs rounded-md flex items-center gap-1 transition-all shadow-xs"
                                >
                                  <Pencil size={11} />
                                  Edit Permissions
                                </button>
                                <button
                                  onClick={() => handleCloneRole(r)}
                                  title="Clone Role"
                                  className="p-1.5 border border-[var(--app-border)] hover:bg-[var(--app-control-hover)] text-[var(--app-text)] rounded-md transition-all"
                                >
                                  <Copy size={12} />
                                </button>
                                {!r.isSystem && (
                                  <button
                                    onClick={() => handleDeleteRole(r.id)}
                                    title="Delete Role"
                                    className="p-1.5 border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 rounded-md transition-all"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}
        </>
      )}

      {showCreateUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4 overflow-y-auto select-none">
          <div className="bg-[var(--app-panel-bg)] border border-[var(--app-border)] rounded-2xl shadow-2xl max-w-lg w-full flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="px-5 py-3 border-b border-[var(--app-border)] flex justify-between items-center bg-[var(--app-panel-bg)]">
              <div>
                <h2 className="text-base font-bold text-[var(--app-heading)]">
                  {editingUserId ? 'Edit System User' : 'Create New System User'}
                </h2>
                <p className="text-[11px] text-[var(--app-muted)] mt-0.5">
                  Register user credentials and assign their organization role
                </p>
              </div>
              <button onClick={handleCloseUserModal} className="text-[var(--app-muted)] hover:text-[var(--app-heading)] p-1 hover:bg-[var(--app-control-hover)] rounded-lg">
                <X size={16} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveUser} className="p-5 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-[var(--app-muted)] mb-1 block uppercase tracking-wide">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={userForm.name}
                    onChange={(e) => setUserForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full h-8.5 rounded-lg border px-3 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-[var(--app-muted)] mb-1 block uppercase tracking-wide">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={userForm.email}
                    onChange={(e) => setUserForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="e.g. rahul@company.com"
                    className="w-full h-8.5 rounded-lg border px-3 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-[var(--app-muted)] mb-1 block uppercase tracking-wide">Mobile Number</label>
                  <input
                    type="text"
                    value={userForm.phone}
                    onChange={(e) => setUserForm(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="+91 98765 43210"
                    className="w-full h-8.5 rounded-lg border px-3 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-[var(--app-muted)] mb-1 block uppercase tracking-wide">Department</label>
                  <input
                    type="text"
                    value={userForm.department}
                    onChange={(e) => setUserForm(prev => ({ ...prev, department: e.target.value }))}
                    placeholder="e.g. Accounting"
                    className="w-full h-8.5 rounded-lg border px-3 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-[var(--app-muted)] mb-1 block uppercase tracking-wide">Designation</label>
                  <input
                    type="text"
                    value={userForm.designation || 'Staff'}
                    onChange={(e) => setUserForm(prev => ({ ...prev, designation: e.target.value }))}
                    placeholder="e.g. Accountant"
                    className="w-full h-8.5 rounded-lg border px-3 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-[var(--app-muted)] mb-1 block uppercase tracking-wide">Assign Role *</label>
                  <select
                    value={userForm.role}
                    onChange={(e) => setUserForm(prev => ({ ...prev, role: e.target.value }))}
                    className="w-full h-8.5 rounded-lg border px-3 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)] font-bold text-[var(--app-accent)]"
                  >
                    {roles.map(r => (
                      <option key={r.id} value={r.name}>{r.displayName || r.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-[var(--app-muted)] mb-1 block uppercase tracking-wide">Status</label>
                  <select
                    value={userForm.status}
                    onChange={(e) => setUserForm(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full h-8.5 rounded-lg border px-3 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-[var(--app-muted)] mb-1 block uppercase tracking-wide">
                    Password {editingUserId ? '(Optional)' : '*'}
                  </label>
                  <input
                    type="password"
                    required={!editingUserId}
                    value={userForm.password}
                    onChange={(e) => setUserForm(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="••••••••"
                    className="w-full h-8.5 rounded-lg border px-3 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-[var(--app-muted)] mb-1 block uppercase tracking-wide">
                    Confirm Password {editingUserId ? '(Optional)' : '*'}
                  </label>
                  <input
                    type="password"
                    required={!editingUserId && userForm.password}
                    value={userForm.confirmPassword}
                    onChange={(e) => setUserForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    placeholder="••••••••"
                    className="w-full h-8.5 rounded-lg border px-3 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--app-border)] mt-4">
                <button
                  type="button"
                  onClick={handleCloseUserModal}
                  className="px-4 py-1.5 border rounded-lg border-[var(--app-border)] hover:bg-[var(--app-control-hover)] text-[var(--app-text)] font-bold text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-1.5 bg-[var(--app-accent)] hover:opacity-90 text-white font-bold text-xs rounded-lg transition-all shadow-xs"
                >
                  {editingUserId ? 'Update User' : 'Create User'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* RIGHT-SIDE USER DETAIL DRAWER                                 */}
      {/* ───────────────────────────────────────────────────────────── */}
      {selectedUserDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-[2px] select-none">
          <div className="bg-[var(--app-panel-bg)] border-l border-[var(--app-border)] w-full max-w-md h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
            
            {/* Drawer Header */}
            <div className="p-4 border-b border-[var(--app-border)] flex items-center justify-between bg-[var(--app-panel-bg)]">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-[var(--app-accent-soft)] text-[var(--app-accent)] font-black text-sm flex items-center justify-center border border-[var(--app-accent)]">
                  {(selectedUserDrawer.name || selectedUserDrawer.email || 'U').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-[var(--app-heading)]">{selectedUserDrawer.name || 'User Profile'}</h3>
                  <p className="text-[11px] text-[var(--app-muted)]">{selectedUserDrawer.email}</p>
                </div>
              </div>
              <button onClick={() => setSelectedUserDrawer(null)} className="p-1 hover:bg-[var(--app-control-hover)] rounded-lg text-[var(--app-muted)] hover:text-[var(--app-heading)]">
                <X size={18} />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 themed-scrollbar">
              
              {/* Profile Details */}
              <div className="space-y-2 rounded-xl border p-3 bg-[var(--app-content-bg)] border-[var(--app-border)]">
                <h4 className="text-xs font-extrabold text-[var(--app-heading)] uppercase tracking-wider flex items-center gap-1.5 border-b border-[var(--app-border)] pb-1.5">
                  <User size={13} className="text-[var(--app-accent)]" /> Profile Details
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div>
                    <span className="text-[10px] font-bold text-[var(--app-muted)] block uppercase">Full Name</span>
                    <span className="font-semibold text-[var(--app-heading)]">{selectedUserDrawer.name || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-[var(--app-muted)] block uppercase">Email</span>
                    <span className="font-semibold text-[var(--app-heading)] truncate block">{selectedUserDrawer.email}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-[var(--app-muted)] block uppercase">Mobile</span>
                    <span className="font-mono text-[var(--app-heading)]">{selectedUserDrawer.phone || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-[var(--app-muted)] block uppercase">Department</span>
                    <span className="font-semibold text-[var(--app-heading)]">{selectedUserDrawer.department || 'Accounting'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-[var(--app-muted)] block uppercase">Organization</span>
                    <span className="font-semibold text-[var(--app-heading)]">{selectedUserDrawer.company || orgName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-[var(--app-muted)] block uppercase">Status</span>
                    <Badge tone={selectedUserDrawer.status === 'active' || selectedUserDrawer.status === 'Active' ? 'success' : 'neutral'}>
                      {selectedUserDrawer.status === 'active' || selectedUserDrawer.status === 'Active' ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Assigned Role */}
              <div className="space-y-2 rounded-xl border p-3 bg-[var(--app-content-bg)] border-[var(--app-border)]">
                <h4 className="text-xs font-extrabold text-[var(--app-heading)] uppercase tracking-wider flex items-center justify-between border-b border-[var(--app-border)] pb-1.5">
                  <span className="flex items-center gap-1.5"><Shield size={13} className="text-[var(--app-accent)]" /> Assigned Role</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-[var(--app-accent-soft)] text-[var(--app-accent)] border border-[var(--app-border)]">
                    {roles.find(r => r.id === selectedUserDrawer.role || r.name === selectedUserDrawer.role)?.displayName || selectedUserDrawer.role}
                  </span>
                </h4>
                <p className="text-[11px] text-[var(--app-muted)]">
                  {roles.find(r => r.id === selectedUserDrawer.role || r.name === selectedUserDrawer.role)?.description || 'Role permissions matrix inherited.'}
                </p>
              </div>

              {/* Activity & Login History */}
              <div className="space-y-2 rounded-xl border p-3 bg-[var(--app-content-bg)] border-[var(--app-border)]">
                <h4 className="text-xs font-extrabold text-[var(--app-heading)] uppercase tracking-wider flex items-center gap-1.5 border-b border-[var(--app-border)] pb-1.5">
                  <Activity size={13} className="text-[var(--app-accent)]" /> Activity Timeline
                </h4>
                <div className="space-y-2 text-xs pt-1">
                  <div className="flex items-start gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    <div>
                      <p className="font-bold text-[var(--app-heading)]">Last Login Session</p>
                      <p className="text-[10px] text-[var(--app-muted)] font-mono">{selectedUserDrawer.lastLogin || 'Never logged in'}</p>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Drawer Footer Actions */}
            <div className="p-3 border-t border-[var(--app-border)] bg-[var(--app-panel-bg)] flex justify-end gap-2">
              <button
                onClick={() => { handleEditUserClick(selectedUserDrawer); setSelectedUserDrawer(null); }}
                className="px-3.5 py-1.5 bg-[var(--app-accent)] text-white font-bold text-xs rounded-lg flex items-center gap-1 shadow-xs"
              >
                <Pencil size={13} /> Edit User Profile
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
