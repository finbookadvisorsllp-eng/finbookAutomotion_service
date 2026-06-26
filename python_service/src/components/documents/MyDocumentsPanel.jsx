import React, { useState } from 'react';
import { HelpCircle, Folder, ArrowLeft, Download, Filter, ChevronLeft, ChevronRight, ChevronDown, X, Check, Calendar } from 'lucide-react';

const MyDocumentsPanel = ({ isDark }) => {
  const [viewMode, setViewMode] = useState('Party-wise');
  const [activeTab, setActiveTab] = useState('Purchase/Expense');
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const tabs = ['Purchase/Expense', 'Sales', 'Bank', 'Petty Cash'];

  const IconButton = ({ icon: Icon, color, onClick, shadow, border }) => {
    const getColor = () => {
      switch (color) {
        case 'purple': return '#8b5cf6';
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
          borderColor: border ? activeColor + '40' : activeColor + '20',
          color: activeColor,
          backgroundColor: 'var(--app-control-bg)',
        }}
      >
        <Icon size={14} strokeWidth={2.5} />
      </button>
    );
  };

  const TableHead = ({ label, center, width, borderRight }) => (
    <th className={`p-3 border-b text-[10px] font-black tracking-tight ${center ? 'text-center' : ''} ${borderRight ? 'border-r' : ''}`} style={{ borderColor: 'var(--app-row-border)', color: 'var(--app-muted)', width: width }}>
      {label}
    </th>
  );

  return (
    <div className="flex flex-col gap-2 h-full animate-in fade-in duration-500 overflow-hidden relative">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 shrink-0 border-b bg-[var(--app-panel-bg)] backdrop-blur-sm shadow-sm rounded-t-xl" style={{ borderColor: 'var(--app-border)' }}>
        <h1 className="text-[15px] font-black tracking-tight text-[var(--app-accent)] dark:text-[var(--app-accent)]">
          My Documents
        </h1>

        <div className="flex items-center gap-6 absolute left-1/2 -translate-x-1/2">
          <label className="flex items-center gap-2 cursor-pointer group">
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${viewMode === 'Month-wise' ? 'border-[var(--app-accent)]' : 'border-[var(--app-border)] group-hover:border-[var(--app-accent)]'}`}>
              {viewMode === 'Month-wise' && <div className="w-2 h-2 rounded-full bg-[var(--app-accent)]" />}
            </div>
            <input type="radio" className="hidden" checked={viewMode === 'Month-wise'} onChange={() => setViewMode('Month-wise')} />
            <span className="text-[12px] font-bold text-[var(--app-muted)] group-hover:text-[var(--app-text)] dark:group-hover:text-slate-200 transition-colors">Month-wise</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer group">
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${viewMode === 'Party-wise' ? 'border-[var(--app-accent)]' : 'border-[var(--app-border)] group-hover:border-[var(--app-accent)]'}`}>
              {viewMode === 'Party-wise' && <div className="w-2 h-2 rounded-full bg-[var(--app-accent)]" />}
            </div>
            <input type="radio" className="hidden" checked={viewMode === 'Party-wise'} onChange={() => setViewMode('Party-wise')} />
            <span className="text-[12px] font-bold text-[var(--app-muted)] group-hover:text-[var(--app-text)] dark:group-hover:text-slate-200 transition-colors">Party-wise</span>
          </label>
        </div>

        <div>
          <IconButton icon={HelpCircle} color="purple" border />
        </div>
      </div>

      {/* Main Panel Content */}
      <div className="flex-1 overflow-hidden rounded-xl border shadow-sm flex flex-col mt-1 bg-[var(--app-panel-bg)]" style={{ borderColor: 'var(--app-border)' }}>
        
        {/* Tabs */}
        <div className="flex px-4 pt-4 border-b shrink-0" style={{ borderColor: 'var(--app-border)' }}>
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setSelectedFolder(null); }}
              className={`flex-1 pb-3 text-[13px] font-black transition-all relative ${activeTab === tab ? 'text-[var(--app-accent)] dark:text-[var(--app-accent)]' : 'text-[var(--app-muted)] hover:text-[var(--app-text)] dark:hover:text-slate-200'}`}
            >
              {tab}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-[var(--app-accent)] dark:bg-[var(--app-accent)] rounded-t-full" />
              )}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[var(--app-content-bg)]">
          {!selectedFolder ? (
            /* Folders Grid */
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="flex gap-6 flex-wrap">
                {/* Folder Card */}
                <div onClick={() => setSelectedFolder('January 2026')} className="w-[200px] bg-[var(--app-panel-bg)] border rounded-xl p-4 flex flex-col items-center gap-3 relative cursor-pointer hover:shadow-md transition-all group" style={{ borderColor: 'var(--app-border)' }}>
                  <div className="absolute top-2 right-2 bg-slate-50 dark:bg-slate-800 text-[var(--app-muted)] text-[10px] font-black px-1.5 py-0.5 rounded shadow-sm border border-[var(--app-border)]">
                    1
                  </div>
                  <Folder size={40} className="text-[var(--app-accent)] fill-purple-500/20 group-hover:scale-110 transition-transform duration-300" strokeWidth={1.5} />
                  <span className="text-[13px] font-bold text-[var(--app-text)]">January 2026</span>
                </div>
              </div>
            </div>
          ) : (
            /* Detailed Table View */
            <div className="flex-1 flex flex-col animate-in fade-in duration-300 p-4 pb-2 overflow-hidden gap-3">
              {/* Toolbar */}
              <div className="flex items-center justify-between border rounded-xl p-2 bg-[var(--app-panel-bg)]" style={{ borderColor: 'var(--app-border)' }}>
                <div className="flex items-center gap-2">
                  <IconButton icon={ArrowLeft} onClick={() => setSelectedFolder(null)} border />
                  <IconButton icon={Download} color="purple" border />
                </div>
                
                <div className="text-[11px] font-bold text-[var(--app-text)]">
                  Total: 1 Documents
                </div>
                
                <div>
                  <IconButton icon={Filter} color="light-blue" onClick={() => setIsFilterOpen(true)} border />
                </div>
              </div>

              {/* Table Container */}
              <div className="flex-1 overflow-auto border rounded-xl" style={{ borderColor: 'var(--app-border)' }}>
                <table className="w-full text-left border-collapse min-w-[1000px]">
                  <thead>
                    <tr style={{ backgroundColor: 'var(--app-table-head-bg)' }}>
                      <th className="p-3 border-b border-r w-10 text-center" style={{ borderColor: 'var(--app-row-border)' }}><input type="checkbox" className="w-3.5 h-3.5 rounded border-gray-300 accent-[var(--app-accent)] shadow-sm" /></th>
                      <TableHead label="Sr No." borderRight width="70px" center />
                      <TableHead label="Filename" borderRight />
                      <TableHead label="Invoice No" borderRight />
                      <TableHead label="Invoice Date" borderRight />
                      <TableHead label="Base Total" borderRight center />
                      <TableHead label="Subtotal" borderRight center />
                      <TableHead label="Grand Total" borderRight center />
                      <TableHead label="GST" borderRight center />
                      <TableHead label="Uploaded Date" />
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="hover:bg-[var(--app-accent-soft)] dark:hover:bg-[var(--app-accent-soft)] transition-colors border-b bg-[var(--app-accent-soft)] dark:bg-[var(--app-accent-soft)]" style={{ borderColor: 'var(--app-row-border)' }}>
                      <td className="p-3 border-r text-center" style={{ borderColor: 'var(--app-row-border)' }}><input type="checkbox" className="w-3.5 h-3.5 rounded border-gray-300 accent-[var(--app-accent)]" /></td>
                      <td className="p-3 border-r text-[11px] font-bold text-[var(--app-text)] text-center" style={{ borderColor: 'var(--app-row-border)' }}>1</td>
                      <td className="p-3 border-r text-[11px] font-bold text-[var(--app-accent)] dark:text-[var(--app-accent)] cursor-pointer hover:underline" style={{ borderColor: 'var(--app-row-border)' }}>Sales_AT_25-26_3.pdf</td>
                      <td className="p-3 border-r text-[11px] font-bold text-[var(--app-text)]" style={{ borderColor: 'var(--app-row-border)' }}>AT/25-26/3</td>
                      <td className="p-3 border-r text-[11px] font-bold text-[var(--app-text)]" style={{ borderColor: 'var(--app-row-border)' }}>30-01-2026</td>
                      <td className="p-3 border-r text-[11px] font-bold text-[var(--app-text)] text-center" style={{ borderColor: 'var(--app-row-border)' }}>1,12,700.00</td>
                      <td className="p-3 border-r text-[11px] font-bold text-[var(--app-text)] text-center" style={{ borderColor: 'var(--app-row-border)' }}>1,12,700.00</td>
                      <td className="p-3 border-r text-[11px] font-bold text-[var(--app-text)] text-center" style={{ borderColor: 'var(--app-row-border)' }}>1,26,224.00</td>
                      <td className="p-3 border-r text-[11px] font-bold text-[var(--app-text)] text-center" style={{ borderColor: 'var(--app-row-border)' }}>13,524.00</td>
                      <td className="p-3 text-[11px] font-bold text-[var(--app-text)]">29-04-2026</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-center gap-4 py-1 shrink-0">
                <span className="text-[11px] font-bold text-[var(--app-muted)]">1 - 1 of 1</span>
                <div className="flex items-center gap-1">
                  <button className="text-slate-300 hover:text-slate-500 transition-colors p-1"><ChevronLeft size={14} /></button>
                  <button className="text-slate-300 hover:text-slate-500 transition-colors p-1"><ChevronRight size={14} /></button>
                </div>
                <div className="relative border rounded-md px-2 py-1 flex items-center gap-2 bg-[var(--app-panel-bg)]" style={{ borderColor: 'var(--app-border)' }}>
                  <span className="text-[11px] font-bold text-[var(--app-text)]">10</span>
                  <ChevronDown size={12} className="text-slate-400" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {isFilterOpen && <FilterModal onClose={() => setIsFilterOpen(false)} />}
    </div>
  );
};

/* --- Filter Modal --- */
const FilterModal = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-[500] flex animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]" onClick={onClose} />
      
      {/* Drawer Container (right side) */}
      <div className="absolute right-4 top-16 bottom-16 w-[360px] bg-[var(--app-panel-bg)] border border-[var(--app-border)] rounded-2xl shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        <div className="px-5 py-4 flex items-center justify-between border-b" style={{ borderColor: 'var(--app-row-border)' }}>
          <h2 className="text-[15px] font-black text-[var(--app-accent)] tracking-tight">Filter</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-[var(--app-text)] hover:bg-slate-50 dark:hover:bg-[var(--app-control-hover)] rounded-lg transition-colors"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="space-y-4">
            
            <input
              type="text"
              placeholder="File Name"
              className="w-full h-9 border rounded-md px-3 text-[12px] font-bold outline-none focus:border-[var(--app-accent)] transition-colors shadow-sm bg-[var(--app-content-bg)] text-[var(--app-heading)]"
              style={{ borderColor: 'var(--app-border)' }}
            />
            
            <input
              type="text"
              placeholder="Invoice Number"
              className="w-full h-9 border rounded-md px-3 text-[12px] font-bold outline-none focus:border-[var(--app-accent)] transition-colors shadow-sm bg-[var(--app-content-bg)] text-[var(--app-heading)]"
              style={{ borderColor: 'var(--app-border)' }}
            />

            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Invoice Date (From)"
                  className="w-full h-9 border rounded-md pl-3 pr-8 text-[12px] font-bold outline-none focus:border-[var(--app-accent)] transition-colors shadow-sm bg-[var(--app-content-bg)] text-[var(--app-heading)]"
                  style={{ borderColor: 'var(--app-border)' }}
                />
                <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--app-muted)]" size={13} strokeWidth={2.5} />
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Invoice Date (To)"
                  className="w-full h-9 border rounded-md pl-3 pr-8 text-[12px] font-bold outline-none focus:border-[var(--app-accent)] transition-colors shadow-sm bg-[var(--app-content-bg)] text-[var(--app-heading)]"
                  style={{ borderColor: 'var(--app-border)' }}
                />
                <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--app-muted)]" size={13} strokeWidth={2.5} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Base Total (From)"
                className="w-full h-9 border rounded-md px-3 text-[12px] font-bold outline-none focus:border-[var(--app-accent)] transition-colors shadow-sm bg-[var(--app-content-bg)] text-[var(--app-heading)]"
                style={{ borderColor: 'var(--app-border)' }}
              />
              <input
                type="text"
                placeholder="Base Total (To)"
                className="w-full h-9 border rounded-md px-3 text-[12px] font-bold outline-none focus:border-[var(--app-accent)] transition-colors shadow-sm bg-[var(--app-content-bg)] text-[var(--app-heading)]"
                style={{ borderColor: 'var(--app-border)' }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Sub Total (From)"
                className="w-full h-9 border rounded-md px-3 text-[12px] font-bold outline-none focus:border-[var(--app-accent)] transition-colors shadow-sm bg-[var(--app-content-bg)] text-[var(--app-heading)]"
                style={{ borderColor: 'var(--app-border)' }}
              />
              <input
                type="text"
                placeholder="Sub Total (To)"
                className="w-full h-9 border rounded-md px-3 text-[12px] font-bold outline-none focus:border-[var(--app-accent)] transition-colors shadow-sm bg-[var(--app-content-bg)] text-[var(--app-heading)]"
                style={{ borderColor: 'var(--app-border)' }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Grand Total (From)"
                className="w-full h-9 border rounded-md px-3 text-[12px] font-bold outline-none focus:border-[var(--app-accent)] transition-colors shadow-sm bg-[var(--app-content-bg)] text-[var(--app-heading)]"
                style={{ borderColor: 'var(--app-border)' }}
              />
              <input
                type="text"
                placeholder="Grand Total (To)"
                className="w-full h-9 border rounded-md px-3 text-[12px] font-bold outline-none focus:border-[var(--app-accent)] transition-colors shadow-sm bg-[var(--app-content-bg)] text-[var(--app-heading)]"
                style={{ borderColor: 'var(--app-border)' }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="GST Total (From)"
                className="w-full h-9 border rounded-md px-3 text-[12px] font-bold outline-none focus:border-[var(--app-accent)] transition-colors shadow-sm bg-[var(--app-content-bg)] text-[var(--app-heading)]"
                style={{ borderColor: 'var(--app-border)' }}
              />
              <input
                type="text"
                placeholder="GST Total (To)"
                className="w-full h-9 border rounded-md px-3 text-[12px] font-bold outline-none focus:border-[var(--app-accent)] transition-colors shadow-sm bg-[var(--app-content-bg)] text-[var(--app-heading)]"
                style={{ borderColor: 'var(--app-border)' }}
              />
            </div>

          </div>
        </div>

        <div className="p-4 border-t flex items-center justify-between" style={{ borderColor: 'var(--app-row-border)' }}>
          <button onClick={onClose} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors">
            <X size={14} strokeWidth={3} />
            <span className="text-[12px] font-bold">Clear</span>
          </button>
          
          <button onClick={onClose} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[var(--app-accent)] hover:opacity-90 text-white transition-colors shadow-sm">
            <Check size={14} strokeWidth={3} />
            <span className="text-[12px] font-bold">Apply</span>
          </button>
        </div>

      </div>
    </div>
  );
};

export default MyDocumentsPanel;
