import React, { useState, useEffect } from 'react';
import { Search, HelpCircle, ChevronLeft, ChevronRight, ChevronDown, RefreshCw, Settings } from 'lucide-react';

const MasterDataPanel = ({ mode: propMode, isDark }) => {
  const [activeTab, setActiveTab] = useState(propMode || 'Party Ledger');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    if (propMode) {
      setActiveTab(propMode);
    }
  }, [propMode]);

  const IconButton = ({ icon: Icon, color, onClick, label, isPrimary, border }) => {
    const toneMap = {
      purple:  '#8B5CF6',
      blue:    '#38bdf8',
      emerald: '#10B981',
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

  const TableHead = ({ label, center, width, borderRight }) => (
    <th 
      className={`p-3 border-b text-[10px] font-black tracking-tight ${center ? 'text-center' : ''} ${borderRight ? 'border-r' : ''}`} 
      style={{ 
        borderColor: 'var(--app-row-border)', 
        color: 'var(--app-muted)', 
        width: width, 
        minWidth: width,
        backgroundColor: 'var(--app-table-head-bg)'
      }}
    >
      {label}
    </th>
  );

  const partyData = [
    { sr: 1, ledger: 'A K TRADING', parentGroup: 'Sundry Debtors', subGroup: 'Sundry Debtors', gst: '07DDTPAD879K1Z7', name: 'A K TRADING', pos: 'Delhi', type: 'Regular', add1: 'RIGHT PORTION 1st Floor, KH N.589, Extended Lal Dora Road', add2: 'Village Alipur, West Delhi, Delhi', city: 'Delhi', action: '-' },
    { sr: 2, ledger: 'A R V Foods', parentGroup: 'Sundry Debtors', subGroup: 'sundry Debtors', gst: '07AOCPK6867N1Z4', name: 'A R V Foods', pos: 'Delhi', type: 'Regular', add1: 'GROUND FLOOR, KH NO 1247, VILLAGE BHALAWA', add2: 'NEAR K BLOCK, JAHANGIRPURI, North Delhi', city: '-', action: '-' },
    { sr: 3, ledger: 'A-one Product', parentGroup: 'Sundry Debtors', subGroup: 'sundry Debtors', gst: '23AAUFA5062G1Z0', name: 'A-one Product', pos: 'Madhya Pradesh', type: 'Regular', add1: '104 A, SECTOR F INDUSTRIAL AREA, SANWER ROAD', add2: 'Indore', city: '-', action: '-' },
    { sr: 4, ledger: 'A.M. Industries', parentGroup: 'Sundry debtors', subGroup: 'Sundry debtors', gst: '23ABPFA7400G1ZR', name: 'A.M. Industries', pos: 'Madhya Pradesh', type: 'Regular', add1: '17, Khandewal Compound,', add2: 'Palda Industrial Area, Indore-452001', city: 'M.P. - 05154-24512', action: '-' },
    { sr: 5, ledger: 'ABEL Health Care', parentGroup: 'Sundry Debtors', subGroup: 'Sundry Debtors', gst: '23ABDFN3351G1Z5', name: 'ABEL Health Care', pos: 'Madhya Pradesh', type: 'Regular', add1: '-', add2: '-', city: '-', action: '-' },
    { sr: 6, ledger: 'Accent Graphics', parentGroup: 'Sundry Debtors', subGroup: 'Sundry Debtors', gst: '23ADIPN4243G1Z6', name: 'Accent Graphics', pos: 'Madhya Pradesh', type: 'Regular', add1: 'PLOT NO. 9, CHOUDHARY COMPOUND', add2: 'KHATIPURA , NEAR BRIDGE, SUKHALIYA', city: 'Indore, Madhya Pradesh, 452001', action: '-' },
  ];

  const renderPartyLedgerTable = () => (
    <div className="flex-1 overflow-auto themed-scrollbar">
      <table className="w-full text-left border-collapse min-w-[1500px]">
        <thead className="sticky top-0 z-10">
          <tr style={{ backgroundColor: 'var(--app-table-head-bg)' }}>
            <TableHead label="Sr No" borderRight width="40px" />
            <TableHead label="Ledger" borderRight width="200px" />
            <TableHead label="Parent Group" borderRight width="100px" />
            <TableHead label="Sub Group" borderRight width="100px" />
            <TableHead label="GST Number" borderRight width="130px" />
            <TableHead label="Name" borderRight width="150px" />
            <TableHead label="Place of Supply" borderRight width="120px" />
            <TableHead label="GST Registration Type" borderRight width="120px" />
            <TableHead label="Address 1" borderRight width="250px" />
            <TableHead label="Address 2" borderRight width="250px" />
            <TableHead label="City" borderRight width="120px" />
            <TableHead label="Action" width="60px" />
          </tr>
        </thead>
        <tbody>
          {partyData.map((row, index) => (
            <tr 
              key={row.sr} 
              className="border-b transition-colors hover:bg-white/5" 
              style={{ 
                backgroundColor: index % 2 === 0 ? 'transparent' : 'var(--app-table-head-bg)', 
                borderColor: 'var(--app-row-border)' 
              }}
            >
              <td className="p-3 border-r text-[10px] font-bold" style={{ borderColor: 'var(--app-row-border)', color: 'var(--app-muted)' }}>{row.sr}</td>
              <td className="p-3 border-r text-[10px] font-bold" style={{ borderColor: 'var(--app-row-border)', color: 'var(--app-text)' }}>{row.ledger}</td>
              <td className="p-3 border-r text-[10px] font-bold" style={{ borderColor: 'var(--app-row-border)', color: 'var(--app-muted)' }}>{row.parentGroup}</td>
              <td className="p-3 border-r text-[10px] font-bold" style={{ borderColor: 'var(--app-row-border)', color: 'var(--app-muted)' }}>{row.subGroup}</td>
              <td className="p-3 border-r text-[10px] font-bold" style={{ borderColor: 'var(--app-row-border)', color: 'var(--app-text)' }}>{row.gst}</td>
              <td className="p-3 border-r text-[10px] font-bold" style={{ borderColor: 'var(--app-row-border)', color: 'var(--app-text)' }}>{row.name}</td>
              <td className="p-3 border-r text-[10px] font-bold" style={{ borderColor: 'var(--app-row-border)', color: 'var(--app-muted)' }}>{row.pos}</td>
              <td className="p-3 border-r text-[10px] font-bold" style={{ borderColor: 'var(--app-row-border)', color: 'var(--app-muted)' }}>{row.type}</td>
              <td className="p-3 border-r text-[10px] font-bold" style={{ borderColor: 'var(--app-row-border)', color: 'var(--app-muted)' }}>{row.add1}</td>
              <td className="p-3 border-r text-[10px] font-bold" style={{ borderColor: 'var(--app-row-border)', color: 'var(--app-muted)' }}>{row.add2}</td>
              <td className="p-3 border-r text-[10px] font-bold" style={{ borderColor: 'var(--app-row-border)', color: 'var(--app-muted)' }}>{row.city}</td>
              <td className="p-3 text-[10px] font-bold" style={{ color: 'var(--app-muted)' }}>{row.action}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
              <Settings size={18} strokeWidth={2.5} />
            </div>
            <div>
              <h1 
                className="text-[17px] font-semibold tracking-tight leading-tight" 
                style={{ color: isDark ? '#f97316' : 'var(--app-accent)' }}
              >
                {activeTab}
              </h1>
              <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--app-muted)' }}>
                {activeTab === 'Party Ledger' ? 'Manage your party accounts and contact details.' : 'View and track your inventory and stock levels.'}
              </p>
            </div>
          </div>

          <div className="flex gap-2 items-center flex-wrap">
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
                placeholder="Search ledgers, groups..."
                className="w-full h-9 rounded-lg border pl-9 pr-3 text-[12.5px] outline-none transition-all focus-ring"
                style={{ 
                  backgroundColor: 'var(--app-control-bg)', 
                  borderColor: 'var(--app-border)', 
                  color: 'var(--app-text)' 
                }}
              />
            </div>
          </div>
          
          <label className="flex items-center gap-2 cursor-pointer group">
            <input type="checkbox" className="w-4 h-4 rounded border-gray-300 accent-blue-600 shadow-sm" />
            <span className="text-[12px] font-bold transition-colors group-hover:text-slate-700" style={{ color: 'var(--app-muted)' }}>Unsynced Ledger Only</span>
          </label>
        </div>
      </div>

      {/* Main Panel Content */}
      <div 
        className="flex-1 overflow-hidden rounded-xl border shadow-sm flex flex-col" 
        style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-panel-bg)' }}
      >
        {renderPartyLedgerTable()}

        {/* Pagination Footer */}
        <div 
          className="flex items-center justify-center gap-4 py-2 border-t shrink-0 relative" 
          style={{ borderColor: 'var(--app-row-border)', backgroundColor: 'var(--app-table-head-bg)' }}
        >
          <span className="text-[11px] font-bold" style={{ color: isDark ? '#38bdf8' : 'var(--app-accent)' }}>
            1 - 10 of 462
          </span>
          
          <div className="flex items-center gap-1">
            <button className="text-slate-300 hover:text-slate-500 transition-colors p-1"><ChevronLeft size={14} /></button>
            <button className="text-slate-400 hover:text-slate-600 transition-colors p-1"><ChevronRight size={14} /></button>
          </div>
          
          <div className="relative">
            <button 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="border rounded px-2 py-1 flex items-center gap-2 transition-all shadow-sm"
              style={{ 
                backgroundColor: 'var(--app-control-bg)', 
                borderColor: isDropdownOpen ? 'var(--app-accent)' : 'var(--app-border)' 
              }}
            >
              <span className="text-[11px] font-bold w-4 text-left" style={{ color: 'var(--app-text)' }}>{pageSize}</span>
              <ChevronDown size={12} className="transition-transform" style={{ color: 'var(--app-muted)', transform: isDropdownOpen ? 'rotate(180deg)' : 'none' }} />
            </button>

            {isDropdownOpen && (
              <div 
                className="absolute bottom-full left-0 mb-1 w-full border rounded-lg shadow-lg overflow-hidden py-1 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200" 
                style={{ backgroundColor: 'var(--app-panel-bg)', borderColor: 'var(--app-border)' }}
              >
                {[10, 50, 100, 200].map((size) => (
                  <button
                    key={size}
                    onClick={() => {
                      setPageSize(size);
                      setIsDropdownOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-[11px] font-bold transition-colors"
                    style={{ 
                      backgroundColor: size === pageSize ? 'var(--app-accent-soft)' : 'transparent',
                      color: size === pageSize ? (isDark ? '#38bdf8' : 'var(--app-accent)') : 'var(--app-text)'
                    }}
                  >
                    {size}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MasterDataPanel;
