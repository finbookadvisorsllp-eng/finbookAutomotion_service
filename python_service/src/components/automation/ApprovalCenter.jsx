import React, { useState } from 'react';
import { 
  CheckCircle2, XCircle, Send, FileText, AlertTriangle, Plus, X, Layers, User, Search, Eye, HelpCircle, 
  Download, ArrowLeft, Sparkles, Pencil, ChevronDown, Trash2, ZoomIn, ZoomOut, Maximize2, Check, ChevronRight, 
  MessageSquare, ExternalLink, Calendar, MoreVertical, UploadCloud
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { useAppStore } from '../../stores/useAppStore';

export default function ApprovalCenter() {
  const approvalCenterView = useAppStore((s) => s.approvalCenterView);
  const setApprovalCenterView = useAppStore((s) => s.setApprovalCenterView);
  const currentView = approvalCenterView;
  const setCurrentView = setApprovalCenterView;

  const [selectedEntryId, setSelectedEntryId] = useState('ap-1');
  const [selectedIds, setSelectedIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('Total');
  const [page, setPage] = useState(1);

  const [entries, setEntries] = useState([
    { 
      id: 'ap-1', 
      voucherNumber: 'VOU-2026-001', 
      date: '19 Jun 2026', 
      company: 'Friends Grafix', 
      type: 'Sales Voucher', 
      amount: 15400.00, 
      status: 'Pending Approval', 
      confidence: 100, 
      statusText: 'Ready to Post',
      details: { 
        ledger: 'Sundry Debtors', 
        tax: 'IGST (18%)', 
        taxAmount: 2349.15,
        taxableValue: 13050.85,
        attachments: 'invoice_1092.pdf', 
        comments: 'Automated match passed. GSTIN verified.' 
      } 
    },
    { 
      id: 'ap-2', 
      voucherNumber: 'VOU-2026-002', 
      date: '19 Jun 2026', 
      company: 'Office Care Solutions', 
      type: 'Purchase Voucher', 
      amount: 8450.00, 
      status: 'Pending Approval', 
      confidence: 95, 
      statusText: 'Needs Review',
      details: { 
        ledger: 'Printing & Stationery', 
        tax: 'CGST/SGST (18%)', 
        taxAmount: 1288.98,
        taxableValue: 7161.02,
        attachments: 'bill_29202.png', 
        comments: 'Needs ledger confirmation.' 
      } 
    },
    { 
      id: 'ap-3', 
      voucherNumber: 'VOU-2026-003', 
      date: '19 Jun 2026', 
      company: 'HDFC Fuel Corp', 
      type: 'Payment Voucher', 
      amount: 2500.00, 
      status: 'Pending Approval', 
      confidence: 85, 
      statusText: 'Mapping Missing',
      details: { 
        ledger: 'Bank Charges', 
        tax: 'Exempt', 
        taxAmount: 0,
        taxableValue: 2500.00,
        attachments: 'receipt_hdfc.pdf', 
        comments: 'Fuel expenses.' 
      } 
    },
    { 
      id: 'ap-4', 
      voucherNumber: 'VOU-2026-004', 
      date: '18 Jun 2026', 
      company: 'Super Cleaners', 
      type: 'Contra Voucher', 
      amount: 4800.00, 
      status: 'Approved', 
      confidence: 100, 
      statusText: 'Ready to Post',
      details: { 
        ledger: 'Cash Account', 
        tax: '—', 
        taxAmount: 0,
        taxableValue: 4800.00,
        attachments: '—', 
        comments: 'Cash deposit.' 
      } 
    },
    { 
      id: 'ap-5', 
      voucherNumber: 'VOU-2026-005', 
      date: '18 Jun 2026', 
      company: 'Aman Deep & Co', 
      type: 'Debit Note', 
      amount: 18900.00, 
      status: 'Rejected', 
      confidence: 60, 
      statusText: 'High Risk',
      details: { 
        ledger: 'Purchase Returns', 
        tax: 'IGST (18%)', 
        taxAmount: 2883.05,
        taxableValue: 16016.95,
        attachments: 'debit_note_05.pdf', 
        comments: 'Incorrect tax rate allocation.' 
      } 
    },
    { 
      id: 'ap-6', 
      voucherNumber: 'VOU-2026-006', 
      date: '16 Jun 2026', 
      company: 'Anjalee Logistics', 
      type: 'Credit Note', 
      amount: 32000.00, 
      status: 'Posted To Tally', 
      confidence: 98, 
      statusText: 'Ready to Post',
      details: { 
        ledger: 'Sales Returns', 
        tax: 'CGST/SGST (18%)', 
        taxAmount: 4881.36,
        taxableValue: 27118.64,
        attachments: 'credit_note_06.pdf', 
        comments: 'Returned damaged stock.' 
      } 
    }
  ]);

  const handleToggleSelect = (id, e) => {
    e.stopPropagation();
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleApprove = (id) => {
    setEntries(prev => prev.map(entry => {
      if (entry.id === id) {
        toast.success(`Voucher ${entry.voucherNumber} approved successfully`);
        return { ...entry, status: 'Approved', statusText: 'Approved' };
      }
      return entry;
    }));
  };

  const handleReject = (id) => {
    const reason = prompt('Please enter rejection reason:');
    if (reason === null) return;
    setEntries(prev => prev.map(entry => {
      if (entry.id === id) {
        toast.warning(`Voucher ${entry.voucherNumber} Rejected`);
        return { ...entry, status: 'Rejected', statusText: 'Rejected', details: { ...entry.details, comments: reason || 'Audit check failed' } };
      }
      return entry;
    }));
  };

  const handleSendBack = (id) => {
    toast.info(`Sent back voucher ${id} for rework.`);
    setEntries(prev => prev.map(entry => {
      if (entry.id === id) {
        return { ...entry, status: 'Pending Approval', statusText: 'Needs Review' };
      }
      return entry;
    }));
  };

  const handleSyncTally = (id) => {
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 1000)),
      {
        loading: 'Posting XML payload to Tally Server...',
        success: () => {
          setEntries(prev => prev.map(entry => {
            if (entry.id === id) {
              return { ...entry, status: 'Posted To Tally', statusText: 'Synced' };
            }
            return entry;
          }));
          return 'Successfully synced with Tally!';
        },
        error: 'Sync failed'
      }
    );
  };

  const handleBulkApprove = () => {
    if (selectedIds.length === 0) return;
    setEntries(prev => prev.map(entry => {
      if (selectedIds.includes(entry.id) && entry.status !== 'Approved' && entry.status !== 'Posted To Tally') {
        return { ...entry, status: 'Approved', statusText: 'Approved' };
      }
      return entry;
    }));
    toast.success(`Approved ${selectedIds.length} vouchers successfully`);
    setSelectedIds([]);
  };

  const handleBulkSyncTally = () => {
    if (selectedIds.length === 0) return;
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 1000)),
      {
        loading: `Posting ${selectedIds.length} XML payloads to Tally Server...`,
        success: () => {
          setEntries(prev => prev.map(entry => {
            if (selectedIds.includes(entry.id)) {
              return { ...entry, status: 'Posted To Tally', statusText: 'Synced' };
            }
            return entry;
          }));
          setSelectedIds([]);
          return 'Successfully synced selected vouchers with Tally!';
        },
        error: 'Sync failed'
      }
    );
  };

  const selectedEntry = entries.find(e => e.id === selectedEntryId) || entries[0];

  const filteredEntries = entries.filter(e => {
    // Tab filter
    if (filterTab === 'Pending' && e.status !== 'Pending Approval') return false;
    if (filterTab === 'Approved' && e.status !== 'Approved' && e.status !== 'Posted To Tally') return false;
    if (filterTab === 'Rejected' && e.status !== 'Rejected') return false;

    // Search query filter
    const query = searchQuery.toLowerCase();
    return (
      e.voucherNumber.toLowerCase().includes(query) ||
      e.company.toLowerCase().includes(query) ||
      e.type.toLowerCase().includes(query) ||
      e.statusText.toLowerCase().includes(query)
    );
  });

  const isAllSelected = filteredEntries.length > 0 && filteredEntries.every(entry => selectedIds.includes(entry.id));

  const handleSelectAll = (checked) => {
    if (checked) {
      const allIds = filteredEntries.map(e => e.id);
      setSelectedIds(prev => Array.from(new Set([...prev, ...allIds])));
    } else {
      const filteredIds = filteredEntries.map(e => e.id);
      setSelectedIds(prev => prev.filter(id => !filteredIds.includes(id)));
    }
  };

  const renderDetailPage = () => {
    if (!selectedEntry) return null;
    const attachmentName = selectedEntry.details.attachments;

    const typeColors = {
      'Sales Voucher': 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-900/40',
      'Purchase Voucher': 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900/40',
      'Payment Voucher': 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/40',
      'Contra Voucher': 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40',
      'Debit Note': 'bg-amber-50 text-amber-705 border-amber-250 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/40',
      'Credit Note': 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-900/20 dark:text-pink-400 dark:border-pink-900/40'
    }[selectedEntry.type] || 'bg-slate-100 text-slate-700 border-slate-300';

    const statusTextColors = {
      'Ready to Post': 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40',
      'Needs Review': 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-emerald-950/20',
      'Mapping Missing': 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-900/40',
      'High Risk': 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/40',
      'Approved': 'bg-emerald-50 text-emerald-700 border-emerald-250 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40',
      'Rejected': 'bg-rose-50 text-rose-700 border-rose-255 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-900/40',
      'Synced': 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900/40'
    }[selectedEntry.statusText] || 'bg-slate-50 text-slate-700 border-slate-200';

    return (
      <div className="flex flex-col h-full overflow-hidden text-[12.5px] text-slate-700 dark:text-slate-200 bg-[#f8fafc] dark:bg-slate-950/40 p-2">
        
        {/* Title area & Top Metrics */}
        <div className="flex items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl px-3 py-1.5 mb-2 shrink-0 shadow-sm">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white leading-none tracking-tight">{selectedEntry.voucherNumber}</h2>
              <span className={`px-1.5 py-0.5 rounded border text-[9.5px] font-semibold ${typeColors}`}>{selectedEntry.type}</span>
              <span className={`px-1.5 py-0.5 rounded border text-[9.5px] font-semibold ${statusTextColors}`}>{selectedEntry.statusText}</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Created on: <span className="font-semibold text-slate-500 dark:text-slate-400">{selectedEntry.date}, 04:12 PM</span> | Created by: <span className="font-semibold text-slate-500 dark:text-slate-400">Admin User</span>
            </p>
          </div>

          <div className="flex items-center gap-3.5 text-[10.5px] font-bold">
            <div className="text-left min-w-[70px]">
              <span className="text-[8.5px] text-slate-400 block uppercase font-bold tracking-wider leading-none mb-0.5">AI Confidence</span>
              <span className="text-[13px] text-emerald-500 font-extrabold">{selectedEntry.confidence}%</span>
            </div>
            <div className="border-r border-slate-200 dark:border-slate-800 h-6"></div>
            
            <div className="text-left min-w-[110px]">
              <span className="text-[8.5px] text-slate-400 block uppercase font-bold tracking-wider leading-none mb-0.5">Document File</span>
              <span className="text-[11.5px] text-blue-600 hover:underline cursor-pointer flex items-center gap-1 font-bold" onClick={() => toast.success(`Downloading ${attachmentName}...`)}>
                {attachmentName}
              </span>
            </div>
            <div className="border-r border-slate-200 dark:border-slate-800 h-6"></div>

            <div className="text-left min-w-[115px]">
              <span className="text-[8.5px] text-slate-400 block uppercase font-bold tracking-wider leading-none mb-0.5">Created On</span>
              <span className="text-[11.5px] text-slate-700 dark:text-slate-300 font-bold block">{selectedEntry.date}, 04:12 PM</span>
            </div>
            <div className="border-r border-slate-200 dark:border-slate-800 h-6"></div>

            <div className="flex items-center gap-1">
              <button 
                onClick={() => toast.success(`Downloading ${attachmentName}...`)}
                className="p-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded border border-slate-150 dark:border-slate-800 text-slate-400 hover:text-slate-700 transition-colors"
                title="Download file"
              >
                <Download size={12.5} />
              </button>
              <button 
                onClick={() => toast.info('Maximize Preview')}
                className="p-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded border border-slate-150 dark:border-slate-800 text-slate-400 hover:text-slate-700 transition-colors"
                title="Fullscreen Preview"
              >
                <Maximize2 size={11.5} />
              </button>
              <button 
                onClick={() => toast.info('More Options')}
                className="p-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded border border-slate-150 dark:border-slate-800 text-slate-400 hover:text-slate-700 transition-colors"
                title="More Options"
              >
                <MoreVertical size={12.5} />
              </button>
            </div>
          </div>
        </div>

        {/* Core content: Left column and Right column */}
        <div className="flex-1 grid grid-cols-12 gap-2.5 min-h-0 overflow-hidden mb-2">
          
          {/* Left Column: Doc info + Tally voucher breakdown */}
          <div className="col-span-12 lg:col-span-7 flex flex-col gap-2 min-h-0">
            
            {/* DOCUMENT INFORMATION */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-2.5 shadow-sm shrink-0">
              <h3 className="text-slate-400 font-bold text-[9.5px] tracking-wider uppercase border-b border-slate-100 dark:border-slate-800 pb-0.5 mb-1.5 shrink-0">DOCUMENT INFORMATION</h3>
              
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11.5px]">
                <div className="space-y-0.5">
                  <div className="grid grid-cols-12 gap-1 items-baseline">
                    <span className="col-span-5 text-slate-400 font-medium">Invoice No.</span>
                    <span className="col-span-7 font-bold text-slate-800 dark:text-white font-mono">#VU-2026-001</span>
                  </div>
                  <div className="grid grid-cols-12 gap-1 items-baseline">
                    <span className="col-span-5 text-slate-400 font-medium">Invoice Date</span>
                    <span className="col-span-7 font-bold text-slate-800 dark:text-white">{selectedEntry.date}</span>
                  </div>
                  <div className="grid grid-cols-12 gap-1 items-baseline">
                    <span className="col-span-5 text-slate-400 font-medium">GSTIN</span>
                    <span className="col-span-7 font-bold text-slate-800 dark:text-white font-mono">23AAEFFG7311L1Z7</span>
                  </div>
                  <div className="grid grid-cols-12 gap-1 items-baseline">
                    <span className="col-span-5 text-slate-400 font-medium">Place of Supply</span>
                    <span className="col-span-7 font-bold text-slate-800 dark:text-white">Madhya Pradesh</span>
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-1 items-start">
                  <span className="col-span-3 text-slate-400 font-medium">Bill To</span>
                  <div className="col-span-9 space-y-0.5">
                    <span className="font-extrabold text-slate-900 dark:text-white block leading-tight text-[12px]">{selectedEntry.details.ledger}</span>
                    <span className="text-slate-400 text-[10px] font-semibold block mt-0.5">Indore, Madhya Pradesh</span>
                  </div>
                </div>
              </div>
            </div>

            {/* VOUCHER ENTRY PREVIEW (In Tally) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-2.5 shadow-sm flex flex-col min-h-0 flex-1 justify-between">
              <div>
                <h3 className="text-slate-400 font-bold text-[9.5px] tracking-wider uppercase border-b border-slate-100 dark:border-slate-800 pb-0.5 mb-1.5 shrink-0">VOUCHER ENTRY PREVIEW (In Tally)</h3>
                
                <div className="flex justify-between items-center text-[11px] shrink-0 mb-1.5 px-1">
                  <div>
                    <span className="text-slate-400 font-medium">Voucher Type</span>
                    <span className="font-bold text-slate-900 dark:text-white ml-2">{selectedEntry.type}</span>
                  </div>
                  <span className="text-slate-500 font-bold">{selectedEntry.date}</span>
                </div>

                <div className="space-y-1.5 px-1 py-1 border-t border-b border-slate-100 dark:border-slate-800 shrink-0 text-[12px] font-mono">
                  <div className="flex justify-between items-center text-emerald-600 font-bold">
                    <span>Dr {selectedEntry.details.ledger}</span>
                    <span className="font-bold">{selectedEntry.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-505 pl-4 font-semibold">
                    <span>To Sales Account</span>
                    <span>{selectedEntry.details.taxableValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-505 pl-4 font-semibold">
                    <span>To {selectedEntry.details.tax} Output</span>
                    <span>{selectedEntry.details.taxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              {/* Total and stats summary boxes */}
              <div className="mt-1.5 space-y-1.5 shrink-0">
                <div className="flex justify-between items-center font-bold px-1 text-[12px] text-slate-900 dark:text-white">
                  <span>Total</span>
                  <span className="text-emerald-600 font-extrabold">₹{selectedEntry.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>

                <div className="bg-slate-50 dark:bg-slate-950 p-2 rounded-xl flex justify-between text-center gap-2 border border-slate-100/50 dark:border-slate-850/50">
                  <div className="flex-1">
                    <span className="text-slate-400 font-bold block uppercase text-[8px] tracking-wide leading-none mb-0.5">Total Amount</span>
                    <span className="font-extrabold text-[11.5px] text-slate-800 dark:text-slate-200 font-mono">₹{selectedEntry.amount.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex-1 border-l border-slate-200 dark:border-slate-800">
                    <span className="text-slate-400 font-bold block uppercase text-[8px] tracking-wide leading-none mb-0.5">Tax Amount</span>
                    <span className="font-extrabold text-[11.5px] text-slate-800 dark:text-slate-200 font-mono">₹{selectedEntry.details.taxAmount.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex-1 border-l border-slate-200 dark:border-slate-800">
                    <span className="text-slate-400 font-bold block uppercase text-[8px] tracking-wide leading-none mb-0.5">Taxable Value</span>
                    <span className="font-extrabold text-[11.5px] text-slate-800 dark:text-slate-200 font-mono">₹{selectedEntry.details.taxableValue.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex-1 border-l border-slate-200 dark:border-slate-800">
                    <span className="text-slate-400 font-bold block uppercase text-[8px] tracking-wide leading-none mb-0.5">Tax Type</span>
                    <span className="font-extrabold text-[10.5px] text-slate-800 dark:text-slate-200 block">{selectedEntry.details.tax}</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column: OCR Document preview scan */}
          <div className="col-span-12 lg:col-span-5 flex flex-col min-h-0">
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-2.5 shadow-sm flex flex-col min-h-0 flex-1">
              <h3 className="text-slate-400 font-bold text-[9.5px] tracking-wider uppercase border-b border-slate-100 dark:border-slate-800 pb-0.5 mb-1.5 shrink-0">DOCUMENT PREVIEW</h3>
              
              {/* Scan viewport */}
              <div className="flex-1 relative bg-slate-50 dark:bg-slate-950 rounded-xl p-1.5 flex flex-col items-center justify-between border border-slate-100 dark:border-slate-850 min-h-0 overflow-hidden">
                
                {/* Receipt content container (styled exactly like the mockup) */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm w-full p-2.5 text-[8.5px] space-y-1.5 font-sans text-slate-700 dark:text-slate-300 min-h-0 overflow-hidden flex flex-col justify-between flex-1 mb-1">
                  <div className="flex justify-between items-start border-b border-slate-100 pb-1">
                    <div>
                      <p className="font-extrabold text-slate-900 dark:text-white text-[11px] leading-tight">{selectedEntry.company}</p>
                      <p className="text-slate-400 text-[7.5px] mt-0.5 font-semibold">GSTIN: 23AAEFFG7311L1Z7</p>
                      <p className="text-slate-400 text-[7.5px]">Place of Supply: Madhya Pradesh</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-[10px] text-purple-700 leading-none uppercase tracking-wider">SALES INVOICE</p>
                      <p className="text-slate-500 font-mono text-[7.5px] mt-0.5 font-bold">Ref: #VU-2026-001</p>
                      <p className="text-slate-550 font-mono text-[7.5px] font-bold">Date: 19-06-2026</p>
                    </div>
                  </div>
                  
                  <div className="text-[8.5px] py-0.25">
                    <p className="font-bold text-slate-400">Bill To:</p>
                    <p className="font-extrabold text-slate-800 dark:text-slate-200 mt-0.25">{selectedEntry.details.ledger}</p>
                    <p className="text-slate-500 font-medium">Indore, Madhya Pradesh, India</p>
                  </div>

                  <div className="border-t border-b border-slate-100 py-0.5">
                    <table className="w-full text-[8px]">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase text-left">
                          <th className="pb-0.5">DESCRIPTION</th>
                          <th className="pb-0.5 text-right w-8">QTY</th>
                          <th className="pb-0.5 text-right w-16">RATE (₹)</th>
                          <th className="pb-0.5 text-right w-16">AMOUNT (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="font-semibold text-slate-700 dark:text-slate-300">
                          <td className="py-0.5 leading-normal">AI Classified Voucher Processing services</td>
                          <td className="py-0.5 text-right">1.0</td>
                          <td className="py-0.5 text-right">13,050.85</td>
                          <td className="py-0.5 text-right">13,050.85</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="space-y-0.5 text-right text-[8px] font-semibold text-slate-600">
                    <div className="flex justify-between pl-20">
                      <span className="text-slate-400">Taxable Value</span>
                      <span>13,050.85</span>
                    </div>
                    <div className="flex justify-between pl-20">
                      <span className="text-slate-400">IGST (18%)</span>
                      <span>2,349.15</span>
                    </div>
                    <div className="flex justify-between pl-20 pt-0.5 border-t border-slate-150 text-[9.5px] font-extrabold text-slate-800">
                      <span>GRAND TOTAL</span>
                      <span className="text-purple-700 font-black text-[10px]">₹15,400.00</span>
                    </div>
                  </div>
                </div>

                {/* Floating zoom control toolbar */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-slate-900/95 border border-slate-800 px-2.5 py-0.5 rounded-lg flex items-center gap-3 text-white shadow-md z-10 text-[9px]">
                  <button onClick={() => toast.success('Zoom Out')} className="hover:text-indigo-400 transition-colors"><ZoomOut size={11} /></button>
                  <button onClick={() => toast.success('Zoom In')} className="hover:text-indigo-400 transition-colors"><ZoomIn size={11} /></button>
                  <button onClick={() => toast.success('Toggle Maximize')} className="hover:text-indigo-400 transition-colors"><Maximize2 size={10} /></button>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Lower Row (Grid of 3 columns) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 mb-1.5 shrink-0">
          
          {/* MAPPING SUMMARY */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-2.5 shadow-sm space-y-1">
            <div className="flex items-center justify-between border-b pb-0.5 border-slate-100 dark:border-slate-800">
              <h4 className="text-[9.5px] font-bold uppercase text-slate-400 tracking-wider">MAPPING SUMMARY</h4>
              <button 
                onClick={() => toast.info('Edit Mapping dialog')}
                className="text-[8.5px] border border-blue-200 hover:bg-blue-50 dark:border-blue-900/50 dark:hover:bg-blue-900/20 px-1 py-0.25 rounded text-blue-600 dark:text-blue-400 font-bold uppercase transition-all flex items-center gap-0.5"
              >
                <Pencil size={8} /> Edit
              </button>
            </div>

            <div className="space-y-0.5 text-[11.5px] font-semibold text-slate-700 dark:text-slate-300">
              <div className="flex justify-between py-0.25 border-b border-slate-50 dark:border-slate-800/40">
                <span className="text-slate-400 font-normal">Party / Client Ledger</span>
                <span className="font-extrabold text-blue-600 dark:text-blue-400 truncate max-w-[130px]">{selectedEntry.company} (Sundry Debtors)</span>
              </div>
              <div className="flex justify-between py-0.25 border-b border-slate-50 dark:border-slate-800/40">
                <span className="text-slate-400 font-normal">Sales Ledger</span>
                <span className="font-extrabold text-blue-600 dark:text-blue-400">Sales Account</span>
              </div>
              <div className="flex justify-between py-0.25 border-b border-slate-50 dark:border-slate-800/40">
                <span className="text-slate-400 font-normal">Tax Ledger</span>
                <span className="font-extrabold text-blue-600 dark:text-blue-400">{selectedEntry.details.tax} Output</span>
              </div>
              <div className="flex justify-between py-0.25 border-b border-slate-50 dark:border-slate-800/40">
                <span className="text-slate-400 font-normal">Place of Supply</span>
                <span className="font-bold text-slate-700 dark:text-slate-200">Madhya Pradesh</span>
              </div>
              <div className="flex justify-between py-0.25">
                <span className="text-slate-400 font-normal">Cost Center</span>
                <span className="text-slate-500 dark:text-slate-400 font-medium">Not Applicable</span>
              </div>
            </div>
          </div>

          {/* VALIDATION SUMMARY */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-2.5 shadow-sm space-y-1">
            <h4 className="text-[9.5px] font-bold uppercase text-slate-400 tracking-wider border-b pb-0.5 border-slate-100 dark:border-slate-800">VALIDATION SUMMARY</h4>
            
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-1"><CheckCircle2 size={11} className="text-emerald-505 shrink-0" /> GSTIN Verified</div>
              <div className="flex items-center gap-1"><CheckCircle2 size={11} className="text-emerald-505 shrink-0" /> Voucher Balanced</div>
              <div className="flex items-center gap-1"><CheckCircle2 size={11} className="text-emerald-505 shrink-0" /> Amount Matched</div>
              <div className="flex items-center gap-1"><CheckCircle2 size={11} className="text-emerald-505 shrink-0" /> Duplicate Check</div>
              <div className="flex items-center gap-1"><CheckCircle2 size={11} className="text-emerald-505 shrink-0" /> Tax Calculated</div>
              <div className="flex items-center gap-1"><CheckCircle2 size={11} className="text-emerald-505 shrink-0" /> All Passed</div>
            </div>
          </div>

          {/* COMMENTS & HISTORY */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-2.5 shadow-sm flex flex-col justify-between">
            <div className="space-y-1">
              <div className="flex items-center justify-between border-b pb-0.5 border-slate-100 dark:border-slate-800">
                <h4 className="text-[9.5px] font-bold uppercase text-slate-400 tracking-wider">COMMENTS & HISTORY</h4>
              </div>
              
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-2 flex items-center justify-between text-slate-550 bg-slate-50/50 hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900 cursor-pointer mt-1.5">
                <div className="flex items-center gap-1.5">
                  <MessageSquare size={12} className="text-slate-400" />
                  <span className="text-[11.5px] font-medium">No comments</span>
                </div>
                <ChevronDown size={12} className="text-slate-400" />
              </div>
            </div>
          </div>

        </div>

        {/* Bottom Workflow Action Bar */}
        <div className="bg-white dark:bg-[var(--app-panel-bg)] border border-slate-200 dark:border-slate-800 rounded-xl p-2 flex items-center justify-between gap-2.5 shrink-0 shadow-md">
          <div className="flex items-center gap-1.5">
            <button 
              onClick={() => {
                handleReject(selectedEntry.id);
                setCurrentView('list');
              }}
              className="px-3 py-1.5 border border-red-200 hover:bg-red-50 text-red-500 font-extrabold rounded-lg flex items-center gap-1 text-[11.5px] transition-all"
            >
              <Trash2 size={13} /> Reject
            </button>
            <button 
              onClick={() => {
                handleSendBack(selectedEntry.id);
                setCurrentView('list');
              }}
              className="px-3 py-1.5 border border-orange-200 hover:bg-orange-50 text-orange-500 font-extrabold rounded-lg flex items-center gap-1 text-[11.5px] transition-all"
            >
              <ArrowLeft size={13} /> Send Back
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button 
              onClick={() => toast.info('Edit Mapping opened')}
              className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-500 font-extrabold rounded-lg flex items-center gap-1 transition-all text-[11.5px]"
            >
              <Pencil size={13} /> Edit Mapping
            </button>
            <button 
              onClick={() => {
                handleApprove(selectedEntry.id);
                setCurrentView('list');
              }}
              className="px-3.5 py-1.5 border border-emerald-200 hover:bg-emerald-50 text-emerald-600 font-extrabold rounded-lg flex items-center gap-1 transition-all text-[11.5px]"
            >
              <Check size={13} /> Approve
            </button>

            <div className="flex items-stretch rounded-lg shadow-sm overflow-hidden">
              <button 
                onClick={() => {
                  handleSyncTally(selectedEntry.id);
                  setCurrentView('list');
                }}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold flex items-center gap-1 transition-all text-[11.5px]"
              >
                <UploadCloud size={13} /> Approve & Push to Tally
              </button>
              <button 
                onClick={() => toast.info('Post Options')}
                className="px-2 bg-blue-700 hover:bg-blue-800 text-white border-l border-blue-500 transition-all flex items-center justify-center"
              >
                <ChevronDown size={13} />
              </button>
            </div>
        </div>
      </div>

      </div>
    );
  };

  const renderListView = () => {
    return (
      <div className="flex flex-col h-full overflow-hidden text-[13px] text-slate-700 dark:text-slate-200 bg-[#f8fafc] dark:bg-slate-950/40 p-3">
        
        {/* Title Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 shrink-0 gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-[var(--app-heading)]">Approval Center</h1>
            <p className="text-[10px] text-slate-505 dark:text-slate-400 mt-0.5">
              Review and post AI-processed document vouchers to Tally
            </p>
          </div>
        </div>

        {/* Main Table Card */}
        <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm min-h-0">
          
          {/* Table Controls */}
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 shrink-0 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/50">
            
            {/* Left: Filter Tabs */}
            <div className="flex items-center gap-1">
              <button 
                onClick={() => { setFilterTab('Total'); setPage(1); }} 
                className={`px-3 py-1.5 rounded-lg text-center transition-all text-[11.5px] font-extrabold ${filterTab === 'Total' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'}`}
              >
                {entries.length} Total
              </button>
              <button 
                onClick={() => { setFilterTab('Pending'); setPage(1); }} 
                className={`px-3 py-1.5 rounded-lg text-center transition-all text-[11.5px] font-extrabold ${filterTab === 'Pending' ? 'bg-amber-500 text-white shadow-sm' : 'bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'}`}
              >
                {entries.filter(e => e.status === 'Pending Approval').length} Pending
              </button>
              <button 
                onClick={() => { setFilterTab('Approved'); setPage(1); }} 
                className={`px-3 py-1.5 rounded-lg text-center transition-all text-[11.5px] font-extrabold ${filterTab === 'Approved' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-605 dark:text-slate-400 border border-slate-200 dark:border-slate-700'}`}
              >
                {entries.filter(e => e.status === 'Approved' || e.status === 'Posted To Tally').length} Approved
              </button>
              <button 
                onClick={() => { setFilterTab('Rejected'); setPage(1); }} 
                className={`px-3 py-1.5 rounded-lg text-center transition-all text-[11.5px] font-extrabold ${filterTab === 'Rejected' ? 'bg-rose-600 text-white shadow-sm' : 'bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-605 dark:text-slate-400 border border-slate-200 dark:border-slate-700'}`}
              >
                {entries.filter(e => e.status === 'Rejected').length} Rejected
              </button>
            </div>

            {/* Right: Search & Bulk Actions */}
            <div className="flex items-center gap-2.5">
              {selectedIds.length > 0 && (
                <div className="flex items-center gap-1.5 bg-blue-50/80 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50 px-2.5 py-1 rounded-lg">
                  <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400">
                    {selectedIds.length} Selected
                  </span>
                  <span className="text-slate-300">|</span>
                  <button 
                    onClick={handleBulkApprove}
                    className="text-[11px] font-extrabold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 uppercase tracking-wider transition-all"
                  >
                    Approve
                  </button>
                  <span className="text-slate-300">•</span>
                  <button 
                    onClick={handleBulkSyncTally}
                    className="text-[11px] font-extrabold text-blue-600 hover:text-blue-700 dark:text-blue-400 uppercase tracking-wider transition-all"
                  >
                    Push Tally
                  </button>
                  <span className="text-slate-300">•</span>
                  <button 
                    onClick={() => {
                      setEntries(prev => prev.map(entry => {
                        if (selectedIds.includes(entry.id) && entry.status !== 'Rejected') {
                          return { ...entry, status: 'Rejected', statusText: 'Rejected' };
                        }
                        return entry;
                      }));
                      setSelectedIds([]);
                      toast.warning(`Rejected ${selectedIds.length} vouchers`);
                    }}
                    className="text-[11px] font-extrabold text-rose-600 hover:text-rose-700 dark:text-rose-400 uppercase tracking-wider transition-all"
                  >
                    Reject
                  </button>
                  <span className="text-slate-300">•</span>
                  <button 
                    onClick={() => setSelectedIds([])}
                    className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"
                  >
                    Clear
                  </button>
                </div>
              )}

              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                <input
                  type="text"
                  placeholder="Search voucher, party, type..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                  className="w-48 sm:w-60 h-8 pl-8 pr-3 rounded-lg border text-[11px] outline-none bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500 transition-all"
                />
              </div>
            </div>
          </div>

          {/* The Table */}
          <div className="flex-1 overflow-auto themed-scrollbar">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase text-[10.5px] bg-slate-50/30 dark:bg-slate-900/20 sticky top-0 backdrop-blur-sm z-10">
                  <th className="py-2.5 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="w-3.5 h-3.5 accent-blue-600 rounded cursor-pointer"
                    />
                  </th>
                  <th className="py-2.5 px-4">Voucher No</th>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Company / Party</th>
                  <th className="py-2.5 px-4">Voucher Type</th>
                  <th className="py-2.5 px-4 text-right">Amount</th>
                  <th className="py-2.5 px-4 text-center">Confidence</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Document File</th>
                  <th className="py-2.5 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry) => {
                  const isSelected = selectedIds.includes(entry.id);
                  
                  const typeColors = {
                    'Sales Voucher': 'bg-purple-50 text-purple-700 border-purple-205 dark:bg-purple-955/20 dark:text-purple-400 dark:border-purple-900/40',
                    'Purchase Voucher': 'bg-blue-50 text-blue-700 border-blue-205 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900/40',
                    'Payment Voucher': 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/40',
                    'Contra Voucher': 'bg-emerald-50 text-emerald-700 border-emerald-202 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40',
                    'Debit Note': 'bg-amber-50 text-amber-700 border-amber-250 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/40',
                    'Credit Note': 'bg-pink-50 text-pink-705 border-pink-200 dark:bg-pink-900/20 dark:text-pink-400 dark:border-pink-900/40'
                  }[entry.type] || 'bg-slate-100 text-slate-700 border-slate-300';

                  const statusTextColors = {
                    'Ready to Post': 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40',
                    'Needs Review': 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-emerald-950/20',
                    'Mapping Missing': 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-450 dark:border-rose-900/40',
                    'High Risk': 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-rose-900/40',
                    'Approved': 'bg-emerald-50 text-emerald-700 border-emerald-250 dark:bg-emerald-950/20 dark:text-emerald-455 dark:border-rose-900/40',
                    'Rejected': 'bg-rose-50 text-rose-705 border-rose-250 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-900/40',
                    'Synced': 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900/40'
                  }[entry.statusText] || 'bg-slate-50 text-slate-700 border-slate-200';

                  return (
                    <tr 
                      key={entry.id}
                      className={`border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-all font-semibold ${isSelected ? 'bg-blue-50/10 dark:bg-blue-900/10' : ''}`}
                    >
                      <td className="py-2.5 px-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleToggleSelect(entry.id, e)}
                          className="w-3.5 h-3.5 accent-blue-600 rounded cursor-pointer"
                        />
                      </td>
                      <td className="py-2.5 px-4 font-extrabold text-slate-900 dark:text-slate-100">{entry.voucherNumber}</td>
                      <td className="py-2.5 px-4 text-slate-505 font-semibold">{entry.date}</td>
                      <td className="py-2.5 px-4 text-slate-800 dark:text-slate-200 font-bold">{entry.company}</td>
                      <td className="py-2.5 px-4">
                        <span className={`px-2 py-0.5 rounded-lg border text-[9px] font-bold ${typeColors}`}>{entry.type}</span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-black text-slate-900 dark:text-white">₹{entry.amount.toLocaleString('en-IN')}</td>
                      <td className="py-2.5 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded font-black text-[10px] ${entry.confidence >= 95 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400' : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'}`}>
                          {entry.confidence}%
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className={`px-2 py-0.5 rounded-lg border text-[9px] font-extrabold ${statusTextColors}`}>{entry.statusText}</span>
                      </td>
                      <td className="py-2.5 px-4 text-blue-650 dark:text-blue-400 font-mono text-[11px] select-none hover:underline cursor-pointer" onClick={() => { setSelectedEntryId(entry.id); setCurrentView('detail'); }}>
                        <span className="flex items-center gap-1">
                          <FileText size={12} /> {entry.details.attachments}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button 
                            onClick={() => { setSelectedEntryId(entry.id); setCurrentView('detail'); }}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-550 hover:text-slate-800 dark:hover:text-white transition-colors"
                            title="Open Document Review"
                          >
                            <Eye size={14} />
                          </button>
                          {entry.status === 'Pending Approval' && (
                            <>
                              <button 
                                onClick={() => handleApprove(entry.id)}
                                className="p-1 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded text-emerald-600 transition-colors"
                                title="Approve"
                              >
                                <CheckCircle2 size={14} />
                              </button>
                              <button 
                                onClick={() => handleSyncTally(entry.id)}
                                className="p-1 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded text-blue-600 transition-colors"
                                title="Push to Tally"
                              >
                                <Send size={14} />
                              </button>
                              <button 
                                onClick={() => handleReject(entry.id)}
                                className="p-1 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded text-rose-600 transition-colors"
                                title="Reject"
                              >
                                <XCircle size={14} />
                              </button>
                            </>
                          )}
                          {entry.status === 'Approved' && (
                            <button 
                              onClick={() => handleSyncTally(entry.id)}
                              className="p-1 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded text-blue-600 transition-colors"
                              title="Push to Tally"
                            >
                              <Send size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Footer / Pagination */}
          <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] font-semibold text-slate-500 shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
            <span>Showing 1 to {filteredEntries.length} of {filteredEntries.length} entries</span>
            <div className="flex items-center gap-1.5">
              <button disabled className="px-2 py-1 rounded border bg-white dark:bg-slate-800 text-slate-300 flex items-center justify-center font-bold text-[10px]">PREVIOUS</button>
              <button className="w-6 h-6 rounded bg-blue-600 text-white flex items-center justify-center font-bold">1</button>
              <button disabled className="px-2 py-1 rounded border bg-white dark:bg-slate-800 text-slate-300 flex items-center justify-center font-bold text-[10px]">NEXT</button>
            </div>
          </div>

        </div>

      </div>
    );
  };

  return currentView === 'detail' ? renderDetailPage() : renderListView();
}
