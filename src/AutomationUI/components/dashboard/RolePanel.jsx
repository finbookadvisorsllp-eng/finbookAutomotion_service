import React, { useState, useEffect } from 'react';
import { Search, HelpCircle, Plus, X, Check, ArrowUpDown } from 'lucide-react';

const RolePanel = ({ mode: propMode, isDark }) => {
  const [activeTab, setActiveTab] = useState(propMode || 'Manage Roles');
  const [isAddRoleOpen, setIsAddRoleOpen] = useState(false);

  useEffect(() => {
    if (propMode) {
      setActiveTab(propMode);
    }
  }, [propMode]);

  const IconButton = ({ icon: Icon, color, onClick, shadow, border }) => {
    const getColor = () => {
      switch (color) {
        case 'red': return '#ef4444';
        case 'purple': return '#8b5cf6';
        case 'blue': return '#3b82f6';
        case 'emerald': return '#10b981';
        case 'indigo': return '#4f46e5';
        case 'light-blue': return '#0ea5e9';
        default: return '#64748b';
      }
    };
    const activeColor = getColor();

    return (
      <button
        onClick={onClick}
        className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all hover:scale-110 active:scale-95 ${shadow ? 'shadow-md' : 'shadow-sm'}`}
        style={{
          borderColor: border ? activeColor + '40' : activeColor + '30',
          color: activeColor,
          backgroundColor: isDark ? 'var(--app-control-bg)' : '#fff',
        }}
      >
        <Icon size={14} strokeWidth={2.5} />
      </button>
    );
  };

  const TableHead = ({ label, sortable, center, width, borderRight }) => (
    <th className={`p-3 border-b text-[11px] font-black tracking-tight ${center ? 'text-center' : ''} ${borderRight ? 'border-r' : ''}`} style={{ borderColor: 'var(--app-row-border)', color: '#475569', width: width }}>
      <div className={`flex items-center gap-1.5 ${sortable ? 'cursor-pointer hover:opacity-80 transition' : ''}`}>
        {label} {sortable && <ArrowUpDown size={11} className="opacity-30" />}
      </div>
    </th>
  );

  const renderManageRoles = () => (
    <div className="flex-1 flex flex-col animate-in fade-in duration-300">
      <div className="overflow-x-auto h-full custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr style={{ backgroundColor: '#fcfdfe' }}>
              <TableHead label="Sr No." borderRight width="100px" />
              <TableHead label="Name" borderRight sortable />
              <TableHead label="Created At" borderRight />
              <TableHead label="Created By" borderRight />
              <TableHead label="Action" width="100px" />
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={5} className="p-3 text-[11px] font-bold text-blue-500 bg-blue-50/20 border-b" style={{ borderColor: '#e2e8f0' }}>
                No Account Data Found.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderManageUserPermission = () => (
    <div className="flex-1 flex flex-col animate-in fade-in duration-300">
      <div className="overflow-x-auto h-full custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr style={{ backgroundColor: '#fcfdfe' }}>
              <TableHead label="User Name" borderRight sortable />
              <TableHead label="Email ID" borderRight sortable />
              <TableHead label="Company Name" borderRight sortable />
              <TableHead label="Role" borderRight />
              <TableHead label="UserType" borderRight sortable />
              <TableHead label="Action" width="100px" />
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={6} className="p-3 text-[11px] font-bold text-blue-500 bg-blue-50/20 border-b" style={{ borderColor: '#e2e8f0' }}>
                No Data Found.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-2 h-full animate-in fade-in duration-500 overflow-hidden relative">
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between px-2 py-2 shrink-0 border-b bg-white backdrop-blur-sm" style={{ borderColor: 'rgba(226, 232, 240, 0.5)' }}>
        <div className="flex items-center gap-3">
          <h1 className="text-[15px] font-black tracking-tight" style={{ color: '#4f46e5' }}>
            {activeTab}
          </h1>
          {activeTab === 'Manage Roles' && (
            <IconButton icon={Plus} color="emerald" onClick={() => setIsAddRoleOpen(true)} border />
          )}
        </div>

        <div className="flex items-center gap-4 px-4">
          <div className="relative group w-[250px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 transition-colors group-focus-within:text-blue-500" size={13} strokeWidth={3} />
            <input
              type="text"
              placeholder="Search..."
              className="w-full h-8 rounded-lg border px-9 text-[11px] font-bold outline-none transition-all focus:border-blue-400 focus:ring-4 focus:ring-blue-500/5 shadow-sm"
              style={{ backgroundColor: isDark ? 'var(--app-control-bg)' : '#fff', borderColor: '#e2e8f0', color: isDark ? '#f1f5f9' : '#475569' }}
            />
          </div>
          <IconButton icon={HelpCircle} color="purple" border />
        </div>
      </div>

      {/* Main Panel Content */}
      <div className="flex-1 overflow-hidden rounded-xl border shadow-sm flex flex-col mt-1 bg-white" style={{ borderColor: '#e2e8f0', backgroundColor: isDark ? 'var(--app-panel-bg)' : '#fff' }}>
        {activeTab === 'Manage Roles' && renderManageRoles()}
        {activeTab === 'Manage User Permission' && renderManageUserPermission()}
      </div>

      {isAddRoleOpen && <AddRoleModal onClose={() => setIsAddRoleOpen(false)} />}
    </div>
  );
};

/* --- Add Role Modal --- */
const AddRoleModal = ({ onClose }) => {
  const permissions = [
    { id: 'upgrade', label: 'Upgrade Plan' },
    { id: 'download', label: 'Download Exe' },
    {
      id: 'dashboard', label: 'Dashboard', children: [
        { id: 'dash_bus', label: 'Business data', options: ['Enable'] },
        { id: 'dash_acc', label: 'Accountant related data', options: ['Enable'] },
        { id: 'dash_usr', label: 'User data/CA', options: ['Enable'] },
      ]
    },
    {
      id: 'business', label: 'Business', children: [
        { id: 'bus_mng_bus', label: 'Manage Business', options: ['Enable', 'Add', 'Edit', 'Delete'] },
        { id: 'bus_mng_cmp', label: 'Manage Company', options: ['Enable', 'Add', 'Edit', 'Delete', 'Assign Credits'] },
      ]
    },
    {
      id: 'allocations', label: 'Allocations', children: [
        { id: 'alloc_acc', label: 'Allocate Accountant', options: ['Enable', 'Add', 'Edit', 'Delete'] },
      ]
    }
  ];

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-[1px]" onClick={onClose} />
      <div className="relative w-[700px] h-[85vh] bg-white rounded-2xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-300">
        <div className="px-6 py-4 flex items-center justify-between border-b" style={{ borderColor: '#f1f5f9' }}>
          <h2 className="text-[16px] font-black text-blue-600 tracking-tight">Add Role</h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="space-y-6">
            <input
              type="text"
              placeholder="Role Name *"
              className="w-full h-10 border rounded-lg px-4 text-[13px] font-bold outline-none focus:border-blue-400 transition-colors shadow-sm"
              style={{ borderColor: '#e2e8f0', color: '#475569' }}
            />

            <div className="flex justify-center border-b pb-6" style={{ borderColor: '#f1f5f9' }}>
              <label className="flex items-center gap-2 cursor-pointer bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 hover:bg-blue-100 transition-colors">
                <input type="checkbox" className="w-3.5 h-3.5 rounded border-gray-300 accent-blue-600" />
                <span className="text-[12px] font-bold text-blue-600">Select All Permissions</span>
              </label>
            </div>

            <div className="space-y-4">
              {permissions.map((group) => (
                <div key={group.id} className="border-b pb-4 last:border-0" style={{ borderColor: '#f1f5f9' }}>
                  <label className="flex items-center gap-3 cursor-pointer group mb-3">
                    <input type="checkbox" className="w-4 h-4 rounded border-gray-300 accent-blue-600 shadow-sm" />
                    <span className="text-[13px] font-bold text-slate-600 group-hover:text-blue-600 transition-colors">{group.label}</span>
                  </label>

                  {group.children && (
                    <div className="ml-8 space-y-4">
                      {group.children.map(child => (
                        <div key={child.id} className="space-y-2">
                          <label className="flex items-center gap-3 cursor-pointer group">
                            <input type="checkbox" className="w-4 h-4 rounded border-gray-300 accent-blue-600 shadow-sm" />
                            <span className="text-[12px] font-bold text-slate-500 group-hover:text-blue-600 transition-colors">{child.label}</span>
                          </label>
                          <div className="ml-8 flex flex-wrap gap-6">
                            {child.options.map(opt => (
                              <label key={opt} className="flex items-center gap-2 cursor-pointer group">
                                <input type="checkbox" className="w-3.5 h-3.5 rounded border-gray-300 accent-blue-600 shadow-sm" />
                                <span className="text-[11px] font-bold text-slate-500 group-hover:text-blue-600 transition-colors">{opt}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RolePanel;
