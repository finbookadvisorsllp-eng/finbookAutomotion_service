import React, { useState, useEffect } from 'react';
import { Search, HelpCircle, Plus, X, Check, ArrowUpDown, RefreshCw, Settings, ChevronLeft } from 'lucide-react';

const RolePanel = ({ mode: propMode, isDark }) => {
  const [activeTab, setActiveTab] = useState(propMode || 'Manage Roles');
  const [isAddRoleOpen, setIsAddRoleOpen] = useState(false);

  useEffect(() => {
    if (propMode) {
      setActiveTab(propMode);
    }
  }, [propMode]);

  const IconButton = ({ icon: Icon, color, onClick, label, isPrimary, border }) => {
    const toneMap = {
      red:     '#EF4444',
      purple:  '#8B5CF6',
      blue:    '#38bdf8',
      emerald: '#10B981',
      indigo:  '#6366F1',
      slate:   'var(--app-text)',
    };
    const tone = toneMap[color] || 'var(--app-text)';

    if (label) {
      return (
        <button
          onClick={onClick}
          className="h-9 px-3.5 rounded-lg flex items-center gap-1.5 font-semibold text-[12px] transition-all shadow-sm active:scale-95"
          style={
            isPrimary
              ? {
                  color: '#fff',
                  background: isDark ? 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)' : 'var(--app-accent-gradient)',
                }
              : {
                  border: '1px solid var(--app-border)',
                  color: tone,
                  backgroundColor: 'var(--app-control-bg)',
                }
          }
        >
          <Icon size={14} strokeWidth={2.5} />
          {label}
        </button>
      );
    }

    return (
      <button
        onClick={onClick}
        className="h-9 w-9 rounded-lg border flex items-center justify-center transition-all active:scale-90 hover:bg-[var(--app-control-hover)] shadow-sm"
        style={{
          borderColor: border ? tone + '40' : 'var(--app-border)',
          color: tone,
          backgroundColor: 'var(--app-control-bg)',
        }}
      >
        <Icon size={14} strokeWidth={2.5} />
      </button>
    );
  };

  const TableHead = ({ label, sortable, center, width, borderRight }) => (
    <th 
      className={`p-3 border-b text-[11px] font-black tracking-tight ${center ? 'text-center' : ''} ${borderRight ? 'border-r' : ''}`} 
      style={{ borderColor: 'var(--app-row-border)', color: 'var(--app-muted)', width: width }}
    >
      <div className={`flex items-center gap-1.5 ${sortable ? 'cursor-pointer hover:opacity-80 transition' : ''}`}>
        {label} {sortable && <ArrowUpDown size={11} className="opacity-30" />}
      </div>
    </th>
  );

  return (
    <div className="flex flex-col gap-4 h-full animate-in fade-in duration-500 overflow-hidden relative">
      {/* Header */}
      <div 
        className="rounded-xl border p-3.5 shrink-0" 
        style={{ 
          borderColor: 'var(--app-border)', 
          backgroundColor: 'var(--app-panel-bg)' 
        }}
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div 
              className="h-10 w-10 rounded-xl flex items-center justify-center text-white shadow-sm"
              style={{ background: isDark ? 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)' : 'var(--app-accent-gradient)' }}
            >
              <Check size={18} strokeWidth={2.5} />
            </div>
            <div>
              <h1 
                className="text-[17px] font-semibold tracking-tight leading-tight" 
                style={{ color: isDark ? '#f97316' : 'var(--app-accent)' }}
              >
                {activeTab}
              </h1>
              <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--app-muted)' }}>
                {activeTab === 'Manage Roles' ? 'Configure and manage system-wide access roles.' : 'Manage specific user permissions and company assignments.'}
              </p>
            </div>
          </div>

          <div className="flex gap-2 items-center flex-wrap">
            {activeTab === 'Manage Roles' && (
              <IconButton 
                icon={Plus} 
                color="blue" 
                label="Add Role" 
                isPrimary 
                onClick={() => setIsAddRoleOpen(true)} 
              />
            )}
            <IconButton icon={RefreshCw} color="emerald" onClick={() => {}} />
            <IconButton icon={Settings} color="slate" onClick={() => {}} />
            <IconButton icon={HelpCircle} color="purple" border />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
          <div className="flex-1 min-w-[240px] max-w-[420px]">
            <div className="relative group">
              <Search 
                className="absolute left-3 top-1/2 -translate-y-1/2 transition-colors" 
                style={{ color: 'var(--app-muted)' }} 
                size={14} 
              />
              <input
                type="text"
                placeholder="Search..."
                className="w-full h-9 rounded-lg border pl-9 pr-3 text-[12.5px] outline-none transition-all focus-ring"
                style={{ 
                  backgroundColor: 'var(--app-control-bg)', 
                  borderColor: 'var(--app-border)', 
                  color: 'var(--app-text)' 
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Panel Content */}
      <div 
        className="flex-1 overflow-hidden rounded-xl border shadow-sm flex flex-col" 
        style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-panel-bg)' }}
      >
        <div className="overflow-x-auto h-full themed-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10">
              <tr style={{ backgroundColor: 'var(--app-table-head-bg)' }}>
                {activeTab === 'Manage Roles' ? (
                  <>
                    <TableHead label="Sr No." borderRight width="100px" />
                    <TableHead label="Name" borderRight sortable />
                    <TableHead label="Created At" borderRight />
                    <TableHead label="Created By" borderRight />
                    <TableHead label="Action" width="100px" />
                  </>
                ) : (
                  <>
                    <TableHead label="User Name" borderRight sortable />
                    <TableHead label="Email ID" borderRight sortable />
                    <TableHead label="Company Name" borderRight sortable />
                    <TableHead label="Role" borderRight />
                    <TableHead label="UserType" borderRight sortable />
                    <TableHead label="Action" width="100px" />
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={10} className="p-12">
                  <div className="flex flex-col items-center justify-center gap-3 text-center">
                    <div 
                      className="h-12 w-12 rounded-full flex items-center justify-center shadow-sm" 
                      style={{ backgroundColor: 'var(--app-accent-soft)', color: 'var(--app-accent)' }}
                    >
                      <HelpCircle size={22} />
                    </div>
                    <div>
                      <p className="text-[14px] font-bold uppercase tracking-tight" style={{ color: isDark ? '#f97316' : 'var(--app-text)' }}>
                        No {activeTab} Data found
                      </p>
                      <p className="text-[12px] mt-1" style={{ color: 'var(--app-muted)' }}>
                        Create or assign permissions to get started.
                      </p>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {isAddRoleOpen && <AddRoleModal onClose={() => setIsAddRoleOpen(false)} isDark={isDark} />}
    </div>
  );
};

/* --- Add Role Modal --- */
const AddRoleModal = ({ onClose, isDark }) => {
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
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div 
        className="relative w-[700px] h-[85vh] rounded-2xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-300 border overflow-hidden"
        style={{ backgroundColor: 'var(--app-panel-bg)', borderColor: 'var(--app-border)' }}
      >
        <div className="px-6 py-4 flex items-center justify-between border-b" style={{ borderColor: 'var(--app-border)' }}>
          <h2 className="text-[16px] font-black tracking-tight" style={{ color: isDark ? '#f97316' : 'var(--app-accent)' }}>Add Role</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5" style={{ color: 'var(--app-muted)' }}><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 themed-scrollbar">
          <div className="space-y-6">
            <input
              type="text"
              placeholder="Role Name *"
              className="w-full h-10 border rounded-lg px-4 text-[13px] font-bold outline-none focus:border-blue-400 transition-colors shadow-sm"
              style={{ backgroundColor: 'var(--app-control-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
            />

            <div className="flex justify-center border-b pb-6" style={{ borderColor: 'var(--app-border)' }}>
              <label className="flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-lg border transition-colors" style={{ backgroundColor: 'var(--app-accent-soft)', borderColor: 'var(--app-accent)', color: 'var(--app-accent)' }}>
                <input type="checkbox" className="w-3.5 h-3.5 rounded border-gray-300 accent-blue-600 shadow-sm" />
                <span className="text-[12px] font-bold">Select All Permissions</span>
              </label>
            </div>

            <div className="space-y-4">
              {permissions.map((group) => (
                <div key={group.id} className="border-b pb-4 last:border-0" style={{ borderColor: 'var(--app-border)' }}>
                  <label className="flex items-center gap-3 cursor-pointer group mb-3">
                    <input type="checkbox" className="w-4 h-4 rounded border-gray-300 accent-blue-600 shadow-sm" />
                    <span className="text-[13px] font-bold transition-colors group-hover:text-blue-600" style={{ color: 'var(--app-text)' }}>{group.label}</span>
                  </label>

                  {group.children && (
                    <div className="ml-8 space-y-4">
                      {group.children.map(child => (
                        <div key={child.id} className="space-y-2">
                          <label className="flex items-center gap-3 cursor-pointer group">
                            <input type="checkbox" className="w-4 h-4 rounded border-gray-300 accent-blue-600 shadow-sm" />
                            <span className="text-[12px] font-bold transition-colors group-hover:text-blue-600" style={{ color: 'var(--app-muted)' }}>{child.label}</span>
                          </label>
                          <div className="ml-8 flex flex-wrap gap-6">
                            {child.options.map(opt => (
                              <label key={opt} className="flex items-center gap-2 cursor-pointer group">
                                <input type="checkbox" className="w-3.5 h-3.5 rounded border-gray-300 accent-blue-600 shadow-sm" />
                                <span className="text-[11px] font-bold transition-colors group-hover:text-blue-600" style={{ color: 'var(--app-muted)' }}>{opt}</span>
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

        {/* Footer */}
        <div className="p-4 border-t flex items-center justify-end gap-3" style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-panel-bg)' }}>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-[12px] font-bold transition-colors hover:bg-black/5 dark:hover:bg-white/5" style={{ color: 'var(--app-muted)' }}>Cancel</button>
          <button className="px-6 py-2 rounded-lg text-[12px] font-bold text-white shadow-lg transition-transform active:scale-95" style={{ background: isDark ? 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)' : 'var(--app-accent-gradient)' }}>
            Create Role
          </button>
        </div>
      </div>
    </div>
  );
};

export default RolePanel;
