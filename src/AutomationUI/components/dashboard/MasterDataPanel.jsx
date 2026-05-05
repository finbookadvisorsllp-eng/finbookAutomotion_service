import React, { useState, useEffect } from 'react';
import { Search, HelpCircle, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';

const MasterDataPanel = ({ mode: propMode, isDark }) => {
  const [activeTab, setActiveTab] = useState(propMode || 'Party Ledger');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    if (propMode) {
      setActiveTab(propMode);
    }
  }, [propMode]);

  const IconButton = ({ icon: Icon, color, onClick, shadow, border }) => {
    const getColor = () => {
      switch (color) {
        case 'purple': return '#8b5cf6';
        default: return '#64748b';
      }
    };
    const activeColor = getColor();

    return (
      <button
        onClick={onClick}
        className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all hover:scale-110 active:scale-95 ${shadow ? 'shadow-md' : 'shadow-sm'}`}
        style={{
          borderColor: border ? activeColor + '40' : activeColor + '20',
          color: activeColor,
          backgroundColor: isDark ? 'var(--app-control-bg)' : '#fff',
        }}
      >
        <Icon size={14} strokeWidth={2.5} />
      </button>
    );
  };

  const TableHead = ({ label, center, width, borderRight }) => (
    <th className={`p-3 border-b text-[10px] font-black tracking-tight ${center ? 'text-center' : ''} ${borderRight ? 'border-r' : ''}`} style={{ borderColor: '#e2e8f0', color: '#475569', width: width, minWidth: width }}>
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
    { sr: 7, ledger: 'Accounting Charge Payable', parentGroup: 'Provisions', subGroup: 'Provisions', gst: '-', name: '-', pos: '-', type: '-', add1: '-', add2: '-', city: '-', action: '-' },
    { sr: 8, ledger: 'Add. Cess Adjustable Agnst Advance', parentGroup: 'Current Assets', subGroup: 'Current Assets', gst: '-', name: '-', pos: '-', type: '-', add1: '-', add2: '-', city: '-', action: '-' },
    { sr: 9, ledger: 'Add. Cess on GST Input', parentGroup: 'Duties & Taxes', subGroup: 'Duties & Taxes', gst: '-', name: '-', pos: '-', type: '-', add1: '-', add2: '-', city: '-', action: '-' },
    { sr: 10, ledger: 'Add. Cess on GST Output', parentGroup: 'Duties & Taxes', subGroup: 'Duties & Taxes', gst: '-', name: '-', pos: '-', type: '-', add1: '-', add2: '-', city: '-', action: '-' },
  ];

  const stockData = [
    { sr: 1, item: '2 Fly Sheet 12%', unit: 'PCS', open: '4,228.00 PCS', close: '(-)12,852.00 PCS', rate: '2.00/PCS', val: '(-)26,096.00' },
    { sr: 2, item: '2 Fly Sheets', unit: 'PCS', open: '422.00 PCS', close: '422.00 PCS', rate: '5.18/PCS', val: '2,185.76' },
    { sr: 3, item: '21" Craft Paper 100gsm 14BF', unit: 'Kgs.', open: '-', close: '-', rate: '-', val: '-' },
    { sr: 4, item: '22" Craft Paper 100gsm 16BF', unit: 'Kgs.', open: '-', close: '-', rate: '-', val: '-' },
    { sr: 5, item: '22" Craft Paper 120gsm 16BF', unit: 'Kgs.', open: '-', close: '-', rate: '-', val: '-' },
    { sr: 6, item: '23" Craft Paper 100gsm 14BF', unit: 'Kgs.', open: '-', close: '-', rate: '-', val: '-' },
    { sr: 7, item: '23" Craft Paper 100gsm 16BF', unit: 'Kgs.', open: '-', close: '-', rate: '-', val: '-' },
    { sr: 8, item: '24" Craft Paper 120 Gsm 16 BF', unit: 'Kgs.', open: '-', close: '-', rate: '-', val: '-' },
    { sr: 9, item: '24" Craft Paper 100 Gsm 16 BF', unit: 'Kgs.', open: '-', close: '-', rate: '-', val: '-' },
    { sr: 10, item: '26" Craft Paper 100 Gsm 16 BF', unit: 'Kgs.', open: '-', close: '-', rate: '-', val: '-' },
  ];

  const renderPartyLedgerTable = () => (
    <div className="flex-1 overflow-auto custom-scrollbar">
      <table className="w-full text-left border-collapse min-w-[1500px]">
        <thead>
          <tr style={{ backgroundColor: '#fcfdfe' }}>
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
            <tr key={row.sr} className="border-b transition-colors hover:bg-blue-50/40" style={{ backgroundColor: index % 2 === 0 ? 'transparent' : 'rgba(239, 246, 255, 0.3)', borderColor: '#e2e8f0' }}>
              <td className="p-3 border-r text-[10px] font-bold text-slate-500" style={{ borderColor: '#e2e8f0' }}>{row.sr}</td>
              <td className="p-3 border-r text-[10px] font-bold text-slate-600" style={{ borderColor: '#e2e8f0' }}>{row.ledger}</td>
              <td className="p-3 border-r text-[10px] font-bold text-slate-500" style={{ borderColor: '#e2e8f0' }}>{row.parentGroup}</td>
              <td className="p-3 border-r text-[10px] font-bold text-slate-500" style={{ borderColor: '#e2e8f0' }}>{row.subGroup}</td>
              <td className="p-3 border-r text-[10px] font-bold text-slate-600" style={{ borderColor: '#e2e8f0' }}>{row.gst}</td>
              <td className="p-3 border-r text-[10px] font-bold text-slate-600" style={{ borderColor: '#e2e8f0' }}>{row.name}</td>
              <td className="p-3 border-r text-[10px] font-bold text-slate-500" style={{ borderColor: '#e2e8f0' }}>{row.pos}</td>
              <td className="p-3 border-r text-[10px] font-bold text-slate-500" style={{ borderColor: '#e2e8f0' }}>{row.type}</td>
              <td className="p-3 border-r text-[10px] font-bold text-slate-500" style={{ borderColor: '#e2e8f0' }}>{row.add1}</td>
              <td className="p-3 border-r text-[10px] font-bold text-slate-500" style={{ borderColor: '#e2e8f0' }}>{row.add2}</td>
              <td className="p-3 border-r text-[10px] font-bold text-slate-500" style={{ borderColor: '#e2e8f0' }}>{row.city}</td>
              <td className="p-3 text-[10px] font-bold text-slate-500">{row.action}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderStockLedgerTable = () => (
    <div className="flex-1 overflow-auto custom-scrollbar">
      <table className="w-full text-left border-collapse min-w-[1000px]">
        <thead>
          <tr style={{ backgroundColor: '#fcfdfe' }}>
            <TableHead label="Sr No" borderRight width="50px" />
            <TableHead label="Stock Item" borderRight />
            <TableHead label="Stock Unit" borderRight />
            <TableHead label="Opening Balance" borderRight />
            <TableHead label="Closing Balance" borderRight />
            <TableHead label="Closing Rate" borderRight />
            <TableHead label="Closing Value" borderRight />
            <TableHead label="Action" width="80px" />
          </tr>
        </thead>
        <tbody>
          {stockData.map((row, index) => (
            <tr key={row.sr} className="border-b transition-colors hover:bg-blue-50/40" style={{ backgroundColor: index % 2 === 0 ? 'transparent' : 'rgba(239, 246, 255, 0.3)', borderColor: '#e2e8f0' }}>
              <td className="p-3 border-r text-[10px] font-bold text-blue-600" style={{ borderColor: '#e2e8f0' }}>{row.sr}</td>
              <td className="p-3 border-r text-[10px] font-bold text-slate-600" style={{ borderColor: '#e2e8f0' }}>{row.item}</td>
              <td className="p-3 border-r text-[10px] font-bold text-slate-500" style={{ borderColor: '#e2e8f0' }}>{row.unit}</td>
              <td className="p-3 border-r text-[10px] font-bold text-slate-600" style={{ borderColor: '#e2e8f0' }}>{row.open}</td>
              <td className="p-3 border-r text-[10px] font-bold text-slate-600" style={{ borderColor: '#e2e8f0' }}>{row.close}</td>
              <td className="p-3 border-r text-[10px] font-bold text-slate-500" style={{ borderColor: '#e2e8f0' }}>{row.rate}</td>
              <td className="p-3 border-r text-[10px] font-bold text-slate-600" style={{ borderColor: '#e2e8f0' }}>{row.val}</td>
              <td className="p-3 text-[10px] font-bold text-slate-500">-</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="flex flex-col gap-2 h-full animate-in fade-in duration-500 overflow-hidden relative">
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 shrink-0 border-b bg-white backdrop-blur-sm shadow-sm rounded-t-xl" style={{ borderColor: 'rgba(226, 232, 240, 0.5)' }}>
        <h1 className="text-[15px] font-black tracking-tight" style={{ color: '#4f46e5' }}>
          {activeTab}
        </h1>

        <div className="flex items-center gap-6 absolute left-1/2 -translate-x-1/2">
          <div className="relative w-[280px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={13} strokeWidth={3} />
            <input
              type="text"
              placeholder="Search Here"
              className="w-full h-8 rounded-lg border px-9 text-[11px] font-bold outline-none transition-all focus:border-blue-400 shadow-sm"
              style={{ backgroundColor: isDark ? 'var(--app-control-bg)' : '#fff', borderColor: '#e2e8f0', color: isDark ? '#f1f5f9' : '#475569' }}
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer group">
            <input type="checkbox" className="w-4 h-4 rounded border-gray-300 accent-blue-600 shadow-sm" />
            <span className="text-[12px] font-bold text-slate-500 group-hover:text-slate-700 transition-colors">Unsynced Ledger Only</span>
          </label>
        </div>

        <div>
          <IconButton icon={HelpCircle} color="purple" border />
        </div>
      </div>

      {/* Main Panel Content */}
      <div className="flex-1 overflow-hidden rounded-xl border shadow-sm flex flex-col bg-white" style={{ borderColor: '#e2e8f0', backgroundColor: isDark ? 'var(--app-panel-bg)' : '#fff' }}>
        
        {activeTab === 'Party Ledger' && renderPartyLedgerTable()}
        {activeTab === 'Stock Ledger' && renderStockLedgerTable()}

        {/* Pagination Footer */}
        <div className="flex items-center justify-center gap-4 py-2 border-t shrink-0 relative" style={{ borderColor: '#e2e8f0', backgroundColor: '#fcfdfe' }}>
          <span className="text-[11px] font-bold" style={{ color: '#0ea5e9' }}>
            1 - 10 of {activeTab === 'Party Ledger' ? '462' : '157'}
          </span>
          
          <div className="flex items-center gap-1">
            <button className="text-slate-300 hover:text-slate-500 transition-colors p-1"><ChevronLeft size={14} /></button>
            <button className="text-slate-400 hover:text-slate-600 transition-colors p-1"><ChevronRight size={14} /></button>
          </div>
          
          <div className="relative">
            <button 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className={`border rounded px-2 py-1 flex items-center gap-2 bg-white transition-all ${isDropdownOpen ? 'border-blue-500 shadow-[0_0_0_2px_rgba(59,130,246,0.1)]' : 'border-slate-200'}`}
            >
              <span className="text-[11px] font-bold text-blue-600 w-4 text-left">{pageSize}</span>
              <ChevronDown size={12} className={`text-blue-600 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Pagination Dropdown (Drops UP) */}
            {isDropdownOpen && (
              <div className="absolute bottom-full left-0 mb-1 w-full bg-white border rounded-lg shadow-lg overflow-hidden py-1 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200" style={{ borderColor: '#e2e8f0' }}>
                {[10, 50, 100, 200].map((size) => (
                  <button
                    key={size}
                    onClick={() => {
                      setPageSize(size);
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-[11px] font-bold transition-colors ${size === pageSize ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
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
