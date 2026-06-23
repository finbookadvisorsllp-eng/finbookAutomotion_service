import React, { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  UploadCloud, FileText, CheckCircle2, AlertCircle, Trash2, Send,
  FileSpreadsheet, Image, ChevronRight, ChevronLeft, RefreshCw, Check,
  Search, Filter, Info, Eye, Edit2, MoreVertical, Plus, X, FolderOpen, Scan,
  SlidersHorizontal, Download, LayoutList, Grid, Database, Calendar, ArrowLeft,
  Settings, CheckCircle, ShieldAlert, Brain
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

export default function AiProcessingCenter() {
  const location = useLocation();
  const navigate = useNavigate();
  const passedDocId = location.state?.selectedDocId;

  // --- Mock Database (Synchronized with BulkUploadPanel) ---
  const defaultDocs = [
    {
      id: 'doc-1',
      filename: 'INV-001.pdf',
      fileType: 'pdf',
      category: 'Sales Invoice',
      uploadDate: '19-06-2026 10:30 AM',
      vendor: 'ABC Traders',
      docNo: 'INV-001',
      refNo: 'PO-12345',
      docDate: '19-06-2026',
      dueDate: '19-07-2026',
      partyLedger: 'ABC Traders (Sundry Debtors)',
      salesLedger: 'Sales (18%)',
      gstin: '22AAAAA1111A125',
      currency: 'INR',
      placeOfSupply: 'Madhya Pradesh (23)',
      narration: 'Sales Invoice Against PO-12345',
      items: [
        { id: 1, name: 'Product A', hsn: '8471', qty: 10, rate: 1000.00, taxRate: 18 },
        { id: 2, name: 'Product B', hsn: '8504', qty: 5, rate: 1400.00, taxRate: 18 }
      ],
      taxableAmount: 20060.00,
      taxAmount: 3060.00,
      roundOff: 0.00,
      amount: 23120.00,
      confidence: 98,
      status: 'Approved',
      createdBy: 'Admin User'
    },
    {
      id: 'doc-2',
      filename: 'INV-002.pdf',
      fileType: 'pdf',
      category: 'Sales Invoice',
      uploadDate: '19-06-2026 10:25 AM',
      vendor: 'XYZ Enterprises',
      docNo: 'INV-002',
      refNo: 'PO-56789',
      docDate: '19-06-2026',
      dueDate: '19-07-2026',
      partyLedger: 'XYZ Enterprises (Sundry Debtors)',
      salesLedger: 'Sales (18%)',
      gstin: '22BBBBB2222B2Z6',
      currency: 'INR',
      placeOfSupply: 'Maharashtra (27)',
      narration: 'Sales Invoice Against PO-56789',
      items: [
        { id: 1, name: 'Service Fee', hsn: '9983', qty: 1, rate: 13500.00, taxRate: 18 }
      ],
      taxableAmount: 13500.00,
      taxAmount: 2430.00,
      roundOff: 0.00,
      amount: 15930.00,
      confidence: 96,
      status: 'Under Review',
      createdBy: 'Operator 1'
    },
    {
      id: 'doc-3',
      filename: 'Purchase_001.xlsx',
      fileType: 'excel',
      category: 'Purchase Invoice',
      uploadDate: '19-06-2026 10:20 AM',
      vendor: 'PQR Solutions',
      docNo: 'PI-001',
      refNo: 'CH-9081',
      docDate: '18-06-2026',
      dueDate: '18-07-2026',
      partyLedger: 'PQR Solutions (Sundry Creditors)',
      purchaseLedger: 'Purchase (18%)',
      gstin: '22CCCCC3333C3Z7',
      currency: 'INR',
      placeOfSupply: 'Delhi (07)',
      narration: 'Purchase of hardware parts',
      items: [
        { id: 1, name: 'Memory Module 16GB', hsn: '8473', qty: 20, rate: 1900.00, taxRate: 18 },
        { id: 2, name: 'SSD Core 500GB', hsn: '8473', qty: 2, rate: 3800.00, taxRate: 18 }
      ],
      taxableAmount: 38000.00,
      taxAmount: 7680.00,
      roundOff: 0.00,
      amount: 45680.00,
      confidence: 97,
      status: 'Approved',
      createdBy: 'System AI'
    },
    {
      id: 'doc-4',
      filename: 'PAY-001.pdf',
      fileType: 'pdf',
      category: 'Payment',
      uploadDate: '19-06-2026 10:15 AM',
      vendor: 'ABC Traders',
      docNo: 'PAY-001',
      refNo: 'TXN-87612',
      docDate: '19-06-2026',
      partyLedger: 'ABC Traders (Sundry Creditors)',
      bankLedger: 'HDFC Bank A/c',
      amount: 10000.00,
      currency: 'INR',
      narration: 'Paid invoice amount balance',
      items: [],
      confidence: 95,
      status: 'Posted',
      createdBy: 'Admin User'
    },
    {
      id: 'doc-5',
      filename: 'REC-001.pdf',
      fileType: 'pdf',
      category: 'Receipt',
      uploadDate: '19-06-2026 10:10 AM',
      vendor: 'LMN Industries',
      docNo: 'REC-001',
      refNo: 'TXN-90817',
      docDate: '19-06-2026',
      partyLedger: 'LMN Industries (Sundry Debtors)',
      bankLedger: 'SBI Bank A/c',
      amount: 8500.00,
      currency: 'INR',
      narration: 'Received advance payment',
      items: [],
      confidence: 98,
      status: 'Approved',
      createdBy: 'Operator 1'
    },
    {
      id: 'doc-6',
      filename: 'CON-001.pdf',
      fileType: 'pdf',
      category: 'Contra',
      uploadDate: '19-06-2026 10:05 AM',
      vendor: 'Cash Account',
      docNo: 'CON-001',
      docDate: '19-06-2026',
      fromLedger: 'Cash A/c',
      toLedger: 'State Bank of India',
      amount: 12000.00,
      currency: 'INR',
      narration: 'Cash deposited in SBI Bank',
      items: [],
      confidence: 93,
      status: 'Draft',
      createdBy: 'Admin User'
    },
    {
      id: 'doc-8',
      filename: 'CN-001.pdf',
      fileType: 'pdf',
      category: 'Credit Note',
      uploadDate: '19-06-2026 09:55 AM',
      vendor: 'XYZ Enterprises',
      docNo: 'CN-001',
      refNo: 'INV-001',
      docDate: '19-06-2026',
      partyLedger: 'XYZ Enterprises (Sundry Debtors)',
      salesLedger: 'Sales Return',
      gstin: '22BBBBB2222B2Z6',
      amount: 2500.00,
      currency: 'INR',
      narration: 'Credit note for damaged goods refund',
      items: [
        { id: 1, name: 'Product Refund', qty: 1, rate: 2500.00, taxRate: 0 }
      ],
      confidence: 97,
      status: 'Approved',
      createdBy: 'Operator 1'
    },
    {
      id: 'doc-9',
      filename: 'DN-001.pdf',
      fileType: 'pdf',
      category: 'Debit Note',
      uploadDate: '19-06-2026 09:50 AM',
      vendor: 'ABC Traders',
      docNo: 'DN-001',
      refNo: 'PI-001',
      docDate: '18-06-2026',
      partyLedger: 'ABC Traders (Sundry Creditors)',
      purchaseLedger: 'Purchase Return',
      gstin: '22AAAAA1111A1Z5',
      amount: 1250.00,
      currency: 'INR',
      narration: 'Debit note for discount adjustments',
      items: [
        { id: 1, name: 'Price Adjustment', qty: 1, rate: 1250.00, taxRate: 0 }
      ],
      confidence: 80,
      status: 'Failed',
      createdBy: 'System AI'
    },
    {
      id: 'doc-10',
      filename: 'Bank_Stmt_01.xlsx',
      fileType: 'excel',
      category: 'Bank Statement',
      uploadDate: '19-06-2026 09:45 AM',
      vendor: 'State Bank of India',
      docNo: 'BS-001',
      docDate: '19-06-2026',
      amount: 0.00,
      currency: 'INR',
      narration: 'SBI Bank Statement reconciliation',
      items: [
        { id: 1, date: '19-06-2026', particulars: 'NEFT Outward XYZ', chqNo: '—', debit: 15000.00, credit: 0.00, balance: 85000.00 },
        { id: 2, date: '19-06-2026', particulars: 'Interest Credit', chqNo: '—', debit: 0.00, credit: 1250.00, balance: 86250.00 }
      ],
      confidence: 99,
      status: 'Posted',
      createdBy: 'Admin User'
    },
    {
      id: 'doc-11',
      filename: 'INV-003.pdf',
      fileType: 'pdf',
      category: 'Sales Invoice',
      uploadDate: '18-06-2026 04:30 PM',
      vendor: 'XYZ Enterprises',
      docNo: 'INV-003',
      refNo: 'PO-5011',
      docDate: '18-06-2026',
      dueDate: '18-07-2026',
      partyLedger: 'XYZ Enterprises (Sundry Debtors)',
      salesLedger: 'Sales (18%)',
      gstin: '22BBBBB2222B2Z6',
      currency: 'INR',
      placeOfSupply: 'Maharashtra (27)',
      narration: 'Invoice for IT Consultancy services',
      items: [
        { id: 1, name: 'Cloud Migration Consultancy', qty: 10, rate: 4210.00, taxRate: 0 }
      ],
      taxableAmount: 42100.00,
      taxAmount: 0.00,
      roundOff: 0.00,
      amount: 42100.00,
      confidence: 98,
      status: 'Approved',
      createdBy: 'Admin User'
    },
    {
      id: 'doc-12',
      filename: 'Purchase_002.xlsx',
      fileType: 'excel',
      category: 'Purchase Invoice',
      uploadDate: '18-06-2026 02:15 PM',
      vendor: 'PQR Solutions',
      docNo: 'PI-002',
      refNo: 'CH-9098',
      docDate: '17-06-2026',
      dueDate: '17-07-2026',
      partyLedger: 'PQR Solutions (Sundry Creditors)',
      purchaseLedger: 'Purchase (18%)',
      gstin: '22CCCCC3333C3Z7',
      currency: 'INR',
      placeOfSupply: 'Delhi (07)',
      narration: 'Hardware items acquisition',
      items: [
        { id: 1, name: 'LED Monitor 24in', qty: 10, rate: 3412.00, taxRate: 0 }
      ],
      taxableAmount: 34120.00,
      taxAmount: 0.00,
      roundOff: 0.00,
      amount: 34120.00,
      confidence: 95,
      status: 'Under Review',
      createdBy: 'Operator 1'
    },
    {
      id: 'doc-13',
      filename: 'PAY-002.pdf',
      fileType: 'pdf',
      category: 'Payment',
      uploadDate: '18-06-2026 01:00 PM',
      vendor: 'LMN Industries',
      docNo: 'PAY-002',
      refNo: 'TXN-0988',
      docDate: '18-06-2026',
      partyLedger: 'LMN Industries (Sundry Creditors)',
      bankLedger: 'SBI Bank A/c',
      amount: 7200.00,
      currency: 'INR',
      narration: 'Office maintenance payout',
      items: [],
      confidence: 96,
      status: 'Posted',
      createdBy: 'System AI'
    },
    {
      id: 'doc-14',
      filename: 'REC-002.pdf',
      fileType: 'pdf',
      category: 'Receipt',
      uploadDate: '18-06-2026 11:30 AM',
      vendor: 'ABC Traders',
      docNo: 'REC-002',
      refNo: 'TXN-9011',
      docDate: '18-06-2026',
      partyLedger: 'ABC Traders (Sundry Debtors)',
      bankLedger: 'HDFC Bank A/c',
      amount: 19500.00,
      currency: 'INR',
      narration: 'Partial payment received',
      items: [],
      confidence: 94,
      status: 'Draft',
      createdBy: 'Admin User'
    },
    {
      id: 'doc-15',
      filename: 'CON-002.pdf',
      fileType: 'pdf',
      category: 'Contra',
      uploadDate: '18-06-2026 10:45 AM',
      vendor: 'State Bank of India',
      docNo: 'CON-002',
      docDate: '18-06-2026',
      fromLedger: 'State Bank of India',
      toLedger: 'Cash A/c',
      amount: 50000.00,
      currency: 'INR',
      narration: 'Cash withdrawal from SBI Bank',
      items: [],
      confidence: 99,
      status: 'Approved',
      createdBy: 'Operator 1'
    }
  ];

  // Load and Sync LocalStorage State
  const [documents, setDocuments] = useState(() => {
    const saved = localStorage.getItem('fb_bulk_documents');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error loading documents from localStorage', e);
      }
    }
    return defaultDocs;
  });

  const syncDocuments = (updated) => {
    setDocuments(updated);
    localStorage.setItem('fb_bulk_documents', JSON.stringify(updated));
  };

  // --- Component States ---
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeWorkspaceDocId, setActiveWorkspaceDocId] = useState(null);
  const [checkedWorkspaceIds, setCheckedWorkspaceIds] = useState([]);
  const [activeRightTab, setActiveRightTab] = useState('ai-preview');

  // Categories horizontal navigation tab list
  const tabCategories = [
    'All',
    'Sales Invoice',
    'Purchase Invoice',
    'Payment',
    'Receipt',
    'Contra',
    'Credit Note',
    'Debit Note',
    'Bank Statement'
  ];

  // Read Router selection state on mount
  useEffect(() => {
    if (passedDocId) {
      const doc = documents.find(d => d.id === passedDocId);
      if (doc) {
        setActiveWorkspaceDocId(passedDocId);
        setActiveCategory(doc.category);
      }
    } else if (documents.length > 0 && !activeWorkspaceDocId) {
      setActiveWorkspaceDocId(documents[0].id);
    }
  }, [passedDocId, documents]);

  // Compute active document object
  const activeDoc = useMemo(() => {
    return documents.find(d => d.id === activeWorkspaceDocId) || documents[0];
  }, [documents, activeWorkspaceDocId]);

  // Left panel filtered documents
  const filteredDocs = useMemo(() => {
    return documents.filter(doc => {
      if (activeCategory === 'All') return true;
      return doc.category === activeCategory;
    });
  }, [documents, activeCategory]);

  // Icon mapping helper
  const getDocIcon = (fileType) => {
    if (fileType === 'excel' || fileType === 'csv') {
      return <FileSpreadsheet className="text-emerald-500 shrink-0" size={13} />;
    }
    if (fileType === 'image') {
      return <Image className="text-blue-500 shrink-0" size={13} />;
    }
    return <FileText className="text-blue-500 shrink-0" size={13} />;
  };

  // Field change updates inside forms (persists to localStorage)
  const handleFieldChange = (field, val) => {
    if (!activeDoc) return;
    const updated = documents.map(d => {
      if (d.id === activeDoc.id) {
        const u = { ...d, [field]: val };
        
        // Recalculate amount if item attributes are changed (for invoice types)
        if (field === 'items') {
          if (activeDoc.category === 'Bank Statement') {
            // bank statement totals are bank ledger reconciliation lists
          } else {
            const taxable = val.reduce((sum, item) => sum + (parseFloat(item.qty || 0) * parseFloat(item.rate || 0)), 0);
            const tax = val.reduce((sum, item) => sum + (parseFloat(item.qty || 0) * parseFloat(item.rate || 0) * (parseFloat(item.taxRate || 0) / 100)), 0);
            u.taxableAmount = taxable;
            u.taxAmount = tax;
            u.amount = taxable + tax + (parseFloat(u.roundOff || 0));
          }
        }
        return u;
      }
      return d;
    });
    syncDocuments(updated);
  };

  // --- Dynamic Items List helpers ---
  const handleAddItem = () => {
    if (!activeDoc) return;
    const updatedItems = [
      ...(activeDoc.items || []),
      { id: Date.now(), name: 'New Item', qty: 1, rate: 0.00, taxRate: 18 }
    ];
    handleFieldChange('items', updatedItems);
  };

  const handleDeleteItem = (itemId) => {
    if (!activeDoc) return;
    const updatedItems = (activeDoc.items || []).filter(item => item.id !== itemId);
    handleFieldChange('items', updatedItems);
  };

  const handleItemPropertyChange = (itemId, prop, val) => {
    if (!activeDoc) return;
    const updatedItems = (activeDoc.items || []).map(item => {
      if (item.id === itemId) {
        return { ...item, [prop]: val };
      }
      return item;
    });
    handleFieldChange('items', updatedItems);
  };

  // --- Bank Statement transaction additions ---
  const handleAddBankTransaction = () => {
    if (!activeDoc) return;
    const updatedItems = [
      ...(activeDoc.items || []),
      { id: Date.now(), date: '19-06-2026', particulars: 'New TransactionParticulars', chqNo: '—', debit: 0.00, credit: 0.00, balance: 0.00 }
    ];
    handleFieldChange('items', updatedItems);
  };

  // --- Bulk selectors ---
  const handleWorkspaceSelectAll = (e) => {
    if (e.target.checked) {
      setCheckedWorkspaceIds(filteredDocs.map(d => d.id));
    } else {
      setCheckedWorkspaceIds([]);
    }
  };

  const handleWorkspaceSelectRow = (id) => {
    setCheckedWorkspaceIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // --- Action Button triggers ---
  const handleActionApprove = () => {
    if (!activeDoc) return;
    const updated = documents.map(d => d.id === activeDoc.id ? { ...d, status: 'Approved' } : d);
    syncDocuments(updated);
    toast.success(`Approved voucher "${activeDoc.filename}" successfully`);
  };

  const handleActionPushToTally = () => {
    if (!activeDoc) return;
    const updated = documents.map(d => d.id === activeDoc.id ? { ...d, status: 'Posted' } : d);
    syncDocuments(updated);
    toast.success(`Voucher "${activeDoc.filename}" posted to Tally server!`);
  };

  const handleActionSaveDraft = () => {
    if (!activeDoc) return;
    const updated = documents.map(d => d.id === activeDoc.id ? { ...d, status: 'Draft' } : d);
    syncDocuments(updated);
    toast.success(`Saved draft of "${activeDoc.filename}"`);
  };

  // --- Dynamic Styles ---
  const getCategoryStyles = (cat) => {
    const stylesMap = {
      'Sales Invoice': 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/15 dark:text-emerald-400 dark:border-emerald-800',
      'Purchase Invoice': 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/15 dark:text-blue-400 dark:border-blue-800',
      'Payment': 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/15 dark:text-amber-400 dark:border-amber-800',
      'Receipt': 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/15 dark:text-teal-400 dark:border-teal-800',
      'Contra': 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/40 dark:text-slate-300 dark:border-slate-800',
      'Credit Note': 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/15 dark:text-sky-400 dark:border-sky-800',
      'Debit Note': 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/15 dark:text-red-400 dark:border-red-800',
      'Bank Statement': 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/15 dark:text-indigo-400 dark:border-indigo-800'
    };
    return stylesMap[cat] || 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800';
  };

  return (
    <div className="flex flex-col gap-2 h-full overflow-y-auto px-4 py-2 text-[11px] text-slate-700 dark:text-slate-200 bg-slate-50/50 dark:bg-slate-950/10">
      
      {/* --- TOP TABS CATEGORIES NAVIGATION BAR --- */}
      <div className="flex items-center gap-4.5 border-b border-slate-200 dark:border-slate-800 overflow-x-auto shrink-0 pb-1.5 pt-0.5">
        {tabCategories.map((catName) => {
          const isActive = activeCategory === catName;
          return (
            <button
              key={catName}
              onClick={() => {
                setActiveCategory(catName);
                if (filteredDocs.length > 0) {
                  // select first doc matching category
                  const match = documents.find(d => catName === 'All' ? true : d.category === catName);
                  if (match) setActiveWorkspaceDocId(match.id);
                }
              }}
              className={`pb-1 text-[11px] font-bold tracking-wide whitespace-nowrap transition-all uppercase border-b-2 -mb-2 flex items-center gap-1.5 ${
                isActive 
                  ? 'border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-400 font-bold' 
                  : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
            >
              <span>{catName}</span>
            </button>
          );
        })}
      </div>

      {/* --- WORKSPACE LAYOUT CONTAINER --- */}
      {activeDoc ? (
        <div className="flex flex-col gap-3 flex-grow mt-0.5">
          {/* Workspace Title Header Toolbar */}
          <div className="flex items-center justify-between gap-3 border-b pb-2 border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/bulk-upload')}
                className="p-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center justify-center bg-white dark:bg-slate-900"
                title="Back to Document Listing"
              >
                <ArrowLeft size={14} />
              </button>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <span>{activeDoc.category}</span>
                <span className="px-2 py-0.5 bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400 border border-green-200 dark:border-green-800/60 rounded text-[9.5px] font-extrabold uppercase">
                  AI Processed
                </span>
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleActionPushToTally}
                className="h-8 px-3 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition flex items-center gap-1.5 font-bold shadow-2xs text-[11px]"
              >
                <Send size={11} className="text-blue-500" />
                <span>Push to Tally</span>
              </button>
              
              <button
                onClick={handleActionSaveDraft}
                className="h-8 px-3 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition font-bold shadow-2xs text-[11px]"
              >
                <span>Save Draft</span>
              </button>

              <button
                onClick={handleActionApprove}
                className="h-8 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center gap-1.5 font-bold shadow-xs text-[11px]"
              >
                <Check size={12} />
                <span>Approve</span>
              </button>
            </div>
          </div>

          {/* Three Panels Flex/Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch flex-grow min-h-[500px]">
            
            {/* --- LEFT PANEL: Uploaded Documents scrollable list (col-span-3) --- */}
            <div className="lg:col-span-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-3 flex flex-col justify-between shadow-3xs min-h-[380px]">
              <div>
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 border-b pb-2 mb-2 border-slate-100 dark:border-slate-800">
                  Uploaded Documents ({filteredDocs.length})
                </h3>
                
                {/* Scrollable list */}
                <div className="space-y-2 max-h-[440px] overflow-y-auto pr-1 themed-scrollbar">
                  {filteredDocs.map((doc) => {
                    const isSelected = doc.id === activeDoc.id;
                    const isChecked = checkedWorkspaceIds.includes(doc.id);
                    return (
                      <div
                        key={doc.id}
                        onClick={() => setActiveWorkspaceDocId(doc.id)}
                        className={`p-2.5 border rounded-lg cursor-pointer transition-all flex items-start gap-2.5 ${
                          isSelected 
                            ? 'border-blue-500 bg-blue-50/20 dark:bg-blue-950/10 ring-1 ring-blue-500/10 shadow-xs' 
                            : 'border-slate-100 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-950/10 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 dark:border-slate-700 text-blue-600 cursor-pointer h-3.5 w-3.5 mt-0.5"
                          checked={isChecked}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleWorkspaceSelectRow(doc.id);
                          }}
                        />
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            {getDocIcon(doc.fileType)}
                            <h4 className="font-bold text-slate-900 dark:text-slate-100 truncate" title={doc.filename}>
                              {doc.filename}
                            </h4>
                          </div>
                          
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold mt-1.5">{doc.uploadDate}</p>
                          
                          <div className="flex items-center justify-between gap-2 mt-2">
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">{doc.confidence}% Confidence</span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border border-blue-200/50 dark:border-blue-900/50 ${
                              doc.status === 'Posted' ? 'text-blue-700 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/30' :
                              doc.status === 'Approved' ? 'text-green-705 bg-green-50 dark:text-green-400 dark:bg-green-950/30' :
                              'text-amber-705 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/30'
                            }`}>
                              {doc.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Left Panel Footer selection */}
              <div className="border-t pt-2 mt-3 flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 dark:border-slate-700 text-blue-600 cursor-pointer h-3.5 w-3.5"
                    onChange={handleWorkspaceSelectAll}
                    checked={filteredDocs.length > 0 && filteredDocs.every(d => checkedWorkspaceIds.includes(d.id))}
                  />
                  <span>{checkedWorkspaceIds.length} of {filteredDocs.length} selected</span>
                </div>
                
                {checkedWorkspaceIds.length > 0 && (
                  <button
                    onClick={() => setCheckedWorkspaceIds([])}
                    className="text-rose-600 hover:text-rose-700 bg-transparent transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* --- CENTER PANEL: Dynamic Voucher Form (col-span-6) --- */}
            <div className="lg:col-span-6 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-4 flex flex-col justify-between shadow-3xs min-h-[420px]">
              <div>
                <div className="flex items-center justify-between border-b pb-2 mb-3 border-slate-100 dark:border-slate-800">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>{activeDoc.category} Details</span>
                    <span className="px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-800 rounded text-[9.5px] font-extrabold uppercase">
                      AI Extracted
                    </span>
                  </h3>
                  <div className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800 flex items-center gap-1 font-bold text-[10px] text-emerald-700">
                    <CheckCircle2 size={11} />
                    <span>Score {activeDoc.confidence}%</span>
                  </div>
                </div>

                {/* Voucher Category Form Switcher */}
                <div className="space-y-3.5 max-h-[430px] overflow-y-auto pr-1 themed-scrollbar">
                  
                  {/* CATEGORY 1: SALES INVOICE & CREDIT NOTE FORM */}
                  {(activeDoc.category === 'Sales Invoice' || activeDoc.category === 'Credit Note') && (
                    <div className="space-y-3 text-xs">
                      <div className="grid grid-cols-2 gap-3.5">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Invoice No. *</label>
                          <input
                            type="text"
                            value={activeDoc.docNo || ''}
                            onChange={(e) => handleFieldChange('docNo', e.target.value)}
                            className="w-full h-8 rounded-lg border px-3 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Reference No.</label>
                          <input
                            type="text"
                            value={activeDoc.refNo || ''}
                            onChange={(e) => handleFieldChange('refNo', e.target.value)}
                            className="w-full h-8 rounded-lg border px-3 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3.5">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Invoice Date *</label>
                          <div className="relative">
                            <input
                              type="text"
                              value={activeDoc.docDate || ''}
                              onChange={(e) => handleFieldChange('docDate', e.target.value)}
                              className="w-full h-8 rounded-lg border px-3 pr-8 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500"
                            />
                            <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Due Date</label>
                          <div className="relative">
                            <input
                              type="text"
                              value={activeDoc.dueDate || ''}
                              onChange={(e) => handleFieldChange('dueDate', e.target.value)}
                              className="w-full h-8 rounded-lg border px-3 pr-8 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500"
                            />
                            <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3.5">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Party Ledger *</label>
                          <div className="flex items-center gap-1">
                            <select
                              value={activeDoc.partyLedger || ''}
                              onChange={(e) => handleFieldChange('partyLedger', e.target.value)}
                              className="w-full h-8 rounded-lg border px-2.5 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500 font-medium"
                            >
                              <option value="ABC Traders (Sundry Debtors)">ABC Traders (Sundry Debtors)</option>
                              <option value="XYZ Enterprises (Sundry Debtors)">XYZ Enterprises (Sundry Debtors)</option>
                              <option value="LMN Industries (Sundry Debtors)">LMN Industries (Sundry Debtors)</option>
                            </select>
                            <button type="button" onClick={() => toast.info('Add new Ledger account')} className="h-8 w-8 shrink-0 flex items-center justify-center border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                              <Plus size={13} />
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Sales Ledger *</label>
                          <div className="flex items-center gap-1">
                            <select
                              value={activeDoc.salesLedger || ''}
                              onChange={(e) => handleFieldChange('salesLedger', e.target.value)}
                              className="w-full h-8 rounded-lg border px-2.5 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500 font-medium"
                            >
                              <option value="Sales (18%)">Sales (18%)</option>
                              <option value="Sales Return">Sales Return</option>
                              <option value="General Income">General Income</option>
                            </select>
                            <button type="button" onClick={() => toast.info('Add new Ledger account')} className="h-8 w-8 shrink-0 flex items-center justify-center border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                              <Plus size={13} />
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3.5">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">GSTIN</label>
                          <div className="relative">
                            <input
                              type="text"
                              value={activeDoc.gstin || ''}
                              onChange={(e) => handleFieldChange('gstin', e.target.value)}
                              className="w-full h-8 rounded-lg border pl-3 pr-14 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-1 py-0.2 rounded border border-emerald-100/50">
                              ✓ Validated
                            </span>
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Currency</label>
                          <input
                            type="text"
                            value={activeDoc.currency || 'INR'}
                            onChange={(e) => handleFieldChange('currency', e.target.value)}
                            className="w-full h-8 rounded-lg border px-3 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Place of Supply</label>
                        <select
                          value={activeDoc.placeOfSupply || ''}
                          onChange={(e) => handleFieldChange('placeOfSupply', e.target.value)}
                          className="w-full h-8 rounded-lg border px-2.5 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500"
                        >
                          <option value="Madhya Pradesh (23)">Madhya Pradesh (23)</option>
                          <option value="Maharashtra (27)">Maharashtra (27)</option>
                          <option value="Delhi (07)">Delhi (07)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Narration</label>
                        <input
                          type="text"
                          value={activeDoc.narration || ''}
                          onChange={(e) => handleFieldChange('narration', e.target.value)}
                          className="w-full h-8 rounded-lg border px-3 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  )}

                  {/* CATEGORY 2: PURCHASE INVOICE & DEBIT NOTE FORM */}
                  {(activeDoc.category === 'Purchase Invoice' || activeDoc.category === 'Debit Note') && (
                    <div className="space-y-3 text-xs">
                      <div className="grid grid-cols-2 gap-3.5">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Purchase Invoice No. *</label>
                          <input
                            type="text"
                            value={activeDoc.docNo || ''}
                            onChange={(e) => handleFieldChange('docNo', e.target.value)}
                            className="w-full h-8 rounded-lg border px-3 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Reference No.</label>
                          <input
                            type="text"
                            value={activeDoc.refNo || ''}
                            onChange={(e) => handleFieldChange('refNo', e.target.value)}
                            className="w-full h-8 rounded-lg border px-3 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3.5">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Purchase Date *</label>
                          <div className="relative">
                            <input
                              type="text"
                              value={activeDoc.docDate || ''}
                              onChange={(e) => handleFieldChange('docDate', e.target.value)}
                              className="w-full h-8 rounded-lg border px-3 pr-8 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500"
                            />
                            <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Due Date</label>
                          <div className="relative">
                            <input
                              type="text"
                              value={activeDoc.dueDate || ''}
                              onChange={(e) => handleFieldChange('dueDate', e.target.value)}
                              className="w-full h-8 rounded-lg border px-3 pr-8 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500"
                            />
                            <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3.5">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Party Ledger (Supplier) *</label>
                          <div className="flex items-center gap-1">
                            <select
                              value={activeDoc.partyLedger || ''}
                              onChange={(e) => handleFieldChange('partyLedger', e.target.value)}
                              className="w-full h-8 rounded-lg border px-2.5 text-xs outline-none bg-slate-55 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500 font-medium"
                            >
                              <option value="PQR Solutions (Sundry Creditors)">PQR Solutions (Sundry Creditors)</option>
                              <option value="ABC Traders (Sundry Creditors)">ABC Traders (Sundry Creditors)</option>
                              <option value="XYZ Enterprises (Sundry Creditors)">XYZ Enterprises (Sundry Creditors)</option>
                            </select>
                            <button type="button" onClick={() => toast.info('Add new Ledger account')} className="h-8 w-8 shrink-0 flex items-center justify-center border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                              <Plus size={13} />
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Purchase Ledger *</label>
                          <div className="flex items-center gap-1">
                            <select
                              value={activeDoc.purchaseLedger || ''}
                              onChange={(e) => handleFieldChange('purchaseLedger', e.target.value)}
                              className="w-full h-8 rounded-lg border px-2.5 text-xs outline-none bg-slate-55 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500 font-medium"
                            >
                              <option value="Purchase (18%)">Purchase (18%)</option>
                              <option value="Purchase Return">Purchase Return</option>
                              <option value="General Expenses">General Expenses</option>
                            </select>
                            <button type="button" onClick={() => toast.info('Add new Ledger account')} className="h-8 w-8 shrink-0 flex items-center justify-center border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                              <Plus size={13} />
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3.5">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Supplier GSTIN</label>
                          <input
                            type="text"
                            value={activeDoc.gstin || ''}
                            onChange={(e) => handleFieldChange('gstin', e.target.value)}
                            className="w-full h-8 rounded-lg border px-3 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Currency</label>
                          <input
                            type="text"
                            value={activeDoc.currency || 'INR'}
                            onChange={(e) => handleFieldChange('currency', e.target.value)}
                            className="w-full h-8 rounded-lg border px-3 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Narration</label>
                        <input
                          type="text"
                          value={activeDoc.narration || ''}
                          onChange={(e) => handleFieldChange('narration', e.target.value)}
                          className="w-full h-8 rounded-lg border px-3 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  )}

                  {/* CATEGORY 3: PAYMENT / RECEIPT VOUCHERS FORM */}
                  {(activeDoc.category === 'Payment' || activeDoc.category === 'Receipt') && (
                    <div className="space-y-3 text-xs">
                      <div className="grid grid-cols-2 gap-3.5">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Voucher No. *</label>
                          <input
                            type="text"
                            value={activeDoc.docNo || ''}
                            onChange={(e) => handleFieldChange('docNo', e.target.value)}
                            className="w-full h-8 rounded-lg border px-3 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Ref/Txn No.</label>
                          <input
                            type="text"
                            value={activeDoc.refNo || ''}
                            onChange={(e) => handleFieldChange('refNo', e.target.value)}
                            className="w-full h-8 rounded-lg border px-3 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3.5">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Voucher Date *</label>
                          <div className="relative">
                            <input
                              type="text"
                              value={activeDoc.docDate || ''}
                              onChange={(e) => handleFieldChange('docDate', e.target.value)}
                              className="w-full h-8 rounded-lg border px-3 pr-8 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500"
                            />
                            <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Currency</label>
                          <input
                            type="text"
                            value={activeDoc.currency || 'INR'}
                            onChange={(e) => handleFieldChange('currency', e.target.value)}
                            className="w-full h-8 rounded-lg border px-3 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3.5">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Party Ledger *</label>
                          <select
                            value={activeDoc.partyLedger || ''}
                            onChange={(e) => handleFieldChange('partyLedger', e.target.value)}
                            className="w-full h-8 rounded-lg border px-2.5 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500 font-medium"
                          >
                            <option value="ABC Traders (Sundry Creditors)">ABC Traders (Sundry Creditors)</option>
                            <option value="LMN Industries (Sundry Debtors)">LMN Industries (Sundry Debtors)</option>
                            <option value="XYZ Enterprises (Sundry Debtors)">XYZ Enterprises (Sundry Debtors)</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Bank / Cash Ledger *</label>
                          <select
                            value={activeDoc.bankLedger || ''}
                            onChange={(e) => handleFieldChange('bankLedger', e.target.value)}
                            className="w-full h-8 rounded-lg border px-2.5 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500 font-medium"
                          >
                            <option value="HDFC Bank A/c">HDFC Bank A/c</option>
                            <option value="SBI Bank A/c">SBI Bank A/c</option>
                            <option value="Cash A/c">Cash A/c</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3.5">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Amount (₹) *</label>
                          <input
                            type="number"
                            value={activeDoc.amount || 0}
                            onChange={(e) => handleFieldChange('amount', parseFloat(e.target.value) || 0)}
                            className="w-full h-8 rounded-lg border px-3 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500 font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Narration</label>
                          <input
                            type="text"
                            value={activeDoc.narration || ''}
                            onChange={(e) => handleFieldChange('narration', e.target.value)}
                            className="w-full h-8 rounded-lg border px-3 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* CATEGORY 4: CONTRA VOUCHERS FORM */}
                  {activeDoc.category === 'Contra' && (
                    <div className="space-y-3 text-xs">
                      <div className="grid grid-cols-2 gap-3.5">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Contra Voucher No. *</label>
                          <input
                            type="text"
                            value={activeDoc.docNo || ''}
                            onChange={(e) => handleFieldChange('docNo', e.target.value)}
                            className="w-full h-8 rounded-lg border px-3 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Voucher Date</label>
                          <div className="relative">
                            <input
                              type="text"
                              value={activeDoc.docDate || ''}
                              onChange={(e) => handleFieldChange('docDate', e.target.value)}
                              className="w-full h-8 rounded-lg border px-3 pr-8 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500"
                            />
                            <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3.5">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">From Account (Source) *</label>
                          <select
                            value={activeDoc.fromLedger || ''}
                            onChange={(e) => handleFieldChange('fromLedger', e.target.value)}
                            className="w-full h-8 rounded-lg border px-2.5 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500 font-medium"
                          >
                            <option value="Cash A/c">Cash A/c</option>
                            <option value="State Bank of India">State Bank of India</option>
                            <option value="HDFC Bank A/c">HDFC Bank A/c</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">To Account (Destination) *</label>
                          <select
                            value={activeDoc.toLedger || ''}
                            onChange={(e) => handleFieldChange('toLedger', e.target.value)}
                            className="w-full h-8 rounded-lg border px-2.5 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500 font-medium"
                          >
                            <option value="State Bank of India">State Bank of India</option>
                            <option value="Cash A/c">Cash A/c</option>
                            <option value="HDFC Bank A/c">HDFC Bank A/c</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3.5">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Amount (₹) *</label>
                          <input
                            type="number"
                            value={activeDoc.amount || 0}
                            onChange={(e) => handleFieldChange('amount', parseFloat(e.target.value) || 0)}
                            className="w-full h-8 rounded-lg border px-3 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500 font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Narration</label>
                          <input
                            type="text"
                            value={activeDoc.narration || ''}
                            onChange={(e) => handleFieldChange('narration', e.target.value)}
                            className="w-full h-8 rounded-lg border px-3 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* CATEGORY 6: BANK STATEMENT / BANKING FORM */}
                  {activeDoc.category === 'Bank Statement' && (
                    <div className="space-y-3 text-xs">
                      <div className="grid grid-cols-2 gap-3.5">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Statement Bank *</label>
                          <input
                            type="text"
                            value={activeDoc.vendor || ''}
                            onChange={(e) => handleFieldChange('vendor', e.target.value)}
                            className="w-full h-8 rounded-lg border px-3 text-xs outline-none bg-slate-50 dark:bg-slate-950/45 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Reconciliation Date</label>
                          <div className="relative">
                            <input
                              type="text"
                              value={activeDoc.docDate || ''}
                              onChange={(e) => handleFieldChange('docDate', e.target.value)}
                              className="w-full h-8 rounded-lg border px-3 pr-8 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500"
                            />
                            <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-500 mb-1 block uppercase">Banking Narration</label>
                        <input
                          type="text"
                          value={activeDoc.narration || ''}
                          onChange={(e) => handleFieldChange('narration', e.target.value)}
                          className="w-full h-8 rounded-lg border px-3 text-xs outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  )}

                  {/* --- ITEM DETAILS TABLE (Only for Invoices & Statements) --- */}
                  {activeDoc.items && activeDoc.items.length > 0 && (
                    <div className="mt-4.5 pt-4 border-t border-slate-100 dark:border-slate-800/80">
                      <h4 className="text-[11px] font-bold text-slate-800 dark:text-slate-200 mb-2 uppercase tracking-wide">
                        Items / Particulars Breakdown
                      </h4>
                      
                      <div className="border border-slate-100 dark:border-slate-800 rounded-lg overflow-hidden">
                        <table className="w-full text-left border-collapse text-[10px]">
                          <thead>
                            <tr className="bg-slate-50/70 dark:bg-slate-950/40 border-b text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 font-bold uppercase">
                              <th className="py-1.5 px-2 w-8 text-center">#</th>
                              <th className="py-1.5 px-2">Item Name / Particulars</th>
                              {activeDoc.category === 'Bank Statement' ? (
                                <>
                                  <th className="py-1.5 px-2 text-right">Debit</th>
                                  <th className="py-1.5 px-2 text-right">Credit</th>
                                  <th className="py-1.5 px-2 text-right pr-3">Balance</th>
                                </>
                              ) : (
                                <>
                                  <th className="py-1.5 px-2">HSN/SAC</th>
                                  <th className="py-1.5 px-2 w-14 text-center">Qty</th>
                                  <th className="py-1.5 px-2 w-20 text-right">Rate</th>
                                  <th className="py-1.5 px-2 w-14 text-center">Tax %</th>
                                  <th className="py-1.5 px-2 text-right">Tax Amt</th>
                                  <th className="py-1.5 px-2 text-right w-24 pr-3">Amount</th>
                                </>
                              )}
                              <th className="py-1.5 px-2 w-8 text-center"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/85">
                            {activeDoc.items.map((item, idx) => {
                              const amount = (item.qty || 0) * (item.rate || 0);
                              const taxAmt = amount * ((item.taxRate || 0) / 100);
                              return (
                                <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20">
                                  <td className="py-1.5 px-2 text-center text-slate-400 font-bold">{idx + 1}</td>
                                  
                                  <td className="py-1 px-2">
                                    <input
                                      type="text"
                                      value={item.name || item.particulars || ''}
                                      onChange={(e) => handleItemPropertyChange(item.id, item.particulars ? 'particulars' : 'name', e.target.value)}
                                      className="w-full h-7 border rounded px-1.5 text-[10px] outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800"
                                    />
                                  </td>

                                  {activeDoc.category === 'Bank Statement' ? (
                                    <>
                                      <td className="py-1 px-2">
                                        <input
                                          type="number"
                                          value={item.debit || 0}
                                          onChange={(e) => handleItemPropertyChange(item.id, 'debit', parseFloat(e.target.value) || 0)}
                                          className="w-full h-7 border rounded px-1.5 text-right text-[10px] outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800"
                                        />
                                      </td>
                                      <td className="py-1 px-2">
                                        <input
                                          type="number"
                                          value={item.credit || 0}
                                          onChange={(e) => handleItemPropertyChange(item.id, 'credit', parseFloat(e.target.value) || 0)}
                                          className="w-full h-7 border rounded px-1.5 text-right text-[10px] outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800"
                                        />
                                      </td>
                                      <td className="py-1 px-2 text-right font-bold text-slate-900 dark:text-slate-200 pr-3">
                                        ₹ {(item.balance || 0).toLocaleString()}
                                      </td>
                                    </>
                                  ) : (
                                    <>
                                      <td className="py-1 px-2 w-20">
                                        <input
                                          type="text"
                                          value={item.hsn || ''}
                                          onChange={(e) => handleItemPropertyChange(item.id, 'hsn', e.target.value)}
                                          className="w-full h-7 border rounded px-1.5 text-[10px] outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800"
                                        />
                                      </td>
                                      <td className="py-1 px-1.5">
                                        <input
                                          type="number"
                                          value={item.qty || 0}
                                          onChange={(e) => handleItemPropertyChange(item.id, 'qty', parseInt(e.target.value) || 0)}
                                          className="w-full h-7 border rounded px-1 text-center text-[10px] outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800"
                                        />
                                      </td>
                                      <td className="py-1 px-1.5">
                                        <input
                                          type="number"
                                          value={item.rate || 0}
                                          onChange={(e) => handleItemPropertyChange(item.id, 'rate', parseFloat(e.target.value) || 0)}
                                          className="w-full h-7 border rounded px-1 text-right text-[10px] outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800"
                                        />
                                      </td>
                                      <td className="py-1 px-1.5">
                                        <select
                                          value={item.taxRate || 0}
                                          onChange={(e) => handleItemPropertyChange(item.id, 'taxRate', parseInt(e.target.value) || 0)}
                                          className="w-full h-7 border rounded text-center text-[10px] outline-none bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800"
                                        >
                                          <option value="0">0%</option>
                                          <option value="5">5%</option>
                                          <option value="12">12%</option>
                                          <option value="18">18%</option>
                                          <option value="28">28%</option>
                                        </select>
                                      </td>
                                      <td className="py-1 px-2 text-right font-semibold text-slate-500 dark:text-slate-400">
                                        ₹ {taxAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </td>
                                      <td className="py-1 px-2 text-right font-bold text-slate-900 dark:text-slate-100 pr-3">
                                        ₹ {(amount + taxAmt).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </td>
                                    </>
                                  )}

                                  <td className="py-1 px-2 text-center">
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteItem(item.id)}
                                      className="p-1 hover:text-rose-500 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition"
                                      title="Delete Item"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          type="button"
                          onClick={activeDoc.category === 'Bank Statement' ? handleAddBankTransaction : handleAddItem}
                          className="px-2.5 py-1 border border-slate-200 dark:border-slate-800 text-[10px] font-bold text-blue-600 hover:bg-slate-50 dark:hover:bg-slate-800 rounded flex items-center gap-1 shadow-3xs bg-white dark:bg-slate-900"
                        >
                          <Plus size={11} />
                          <span>Add Row</span>
                        </button>
                        
                        {activeDoc.category !== 'Bank Statement' && (
                          <button
                            type="button"
                            onClick={() => toast.info('Discount ledger field added')}
                            className="px-2.5 py-1 border border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 rounded flex items-center gap-1 shadow-3xs bg-white dark:bg-slate-900"
                          >
                            <Plus size={11} />
                            <span>Add Discount</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* --- BILL SUMMARY BLOCK --- */}
                  {activeDoc.category !== 'Bank Statement' && (
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-3 mt-4 flex justify-between items-start text-xs">
                      <div className="text-[10px] text-slate-400">
                        * All values auto-recalculate based on item values.
                      </div>
                      
                      <div className="w-64 space-y-1.5 text-right font-medium">
                        <div className="flex justify-between items-center text-slate-500">
                          <span>Total Amount (Before Tax)</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            ₹ {(activeDoc.taxableAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-slate-500">
                          <span>Total Tax Amount</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            ₹ {(activeDoc.taxAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-slate-500">
                          <span>Round Off</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            ₹ {(activeDoc.roundOff || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-sm font-bold border-t pt-1.5 border-slate-100 dark:border-slate-800 text-slate-950 dark:text-white">
                          <span>Grand Total</span>
                          <span className="text-blue-600 dark:text-blue-400 font-black">
                            ₹ {(activeDoc.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              </div>

              {/* Bottom Buttons inside Form container */}
              <div className="border-t pt-3 mt-4 flex items-center justify-center gap-3">
                <button
                  onClick={handleActionSaveDraft}
                  className="h-8.5 px-4 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition font-bold shadow-3xs text-[11px]"
                >
                  Save Draft
                </button>
                <button
                  onClick={() => toast.loading('Re-extracting details with AI OCR engines...')}
                  className="h-8.5 px-4 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition font-bold shadow-3xs text-[11px]"
                >
                  Reprocess OCR
                </button>
                <button
                  onClick={handleActionApprove}
                  className="h-8.5 px-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition font-bold shadow-sm text-[11px]"
                >
                  Approve
                </button>
                <button
                  onClick={handleActionPushToTally}
                  className="h-8.5 px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-bold shadow-sm text-[11px]"
                >
                  Push to Tally
                </button>
              </div>
            </div>

            {/* --- RIGHT PANEL: AI Preview & Scanned Documents Preview (col-span-3) --- */}
            <div className="lg:col-span-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-3 flex flex-col justify-between shadow-3xs min-h-[380px]">
              <div>
                {/* Right Panel Tabs */}
                <div className="flex border-b border-slate-100 dark:border-slate-800 mb-3 bg-slate-50/50 dark:bg-slate-950/20 p-0.5 rounded-lg">
                  <button
                    onClick={() => setActiveRightTab('ai-preview')}
                    className={`flex-1 py-1 text-center font-bold transition rounded-md text-[10.5px] ${
                      activeRightTab === 'ai-preview' 
                        ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-3xs' 
                        : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                    }`}
                  >
                    AI Preview
                  </button>
                  
                  <button
                    onClick={() => setActiveRightTab('doc-preview')}
                    className={`flex-1 py-1 text-center font-bold transition rounded-md text-[10.5px] ${
                      activeRightTab === 'doc-preview' 
                        ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-3xs' 
                        : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                    }`}
                  >
                    Document Scan
                  </button>
                </div>

                {/* Tab content 1: AI Preview checks */}
                {activeRightTab === 'ai-preview' && (
                  <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1 themed-scrollbar text-[11px]">
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-2 uppercase tracking-wide text-[10px]">
                        Extracted Data
                      </h4>
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Voucher No.</span>
                          <span className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                            {activeDoc.docNo || '—'}
                            <CheckCircle2 size={11} className="text-emerald-500" />
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Date</span>
                          <span className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                            {activeDoc.docDate || '—'}
                            <CheckCircle2 size={11} className="text-emerald-500" />
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Party/Account</span>
                          <span className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 truncate max-w-[140px]" title={activeDoc.vendor}>
                            {activeDoc.vendor || '—'}
                            <CheckCircle2 size={11} className="text-emerald-500" />
                          </span>
                        </div>
                        {activeDoc.gstin && (
                          <div className="flex justify-between items-center">
                            <span className="text-slate-400">GSTIN</span>
                            <span className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                              {activeDoc.gstin}
                              <CheckCircle2 size={11} className="text-emerald-500" />
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Voucher Total</span>
                          <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            ₹ {(activeDoc.amount || 0).toLocaleString()}
                            <CheckCircle2 size={11} className="text-emerald-500" />
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Confidence Score</span>
                          <span className="font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                            {activeDoc.confidence}%
                            <CheckCircle2 size={11} className="text-emerald-500" />
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Validation checklist */}
                    <div className="border-t pt-3 border-slate-100 dark:border-slate-800">
                      <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-2 uppercase tracking-wide text-[10px]">
                        Validation Checks
                      </h4>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Party Ledger</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            Matched
                            <CheckCircle size={11} className="text-emerald-500" />
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">GSTIN Format</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            Valid
                            <CheckCircle size={11} className="text-emerald-500" />
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Items/Calculations</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            Verified
                            <CheckCircle size={11} className="text-emerald-500" />
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Duplicate Check</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            Not Found
                            <CheckCircle size={11} className="text-emerald-500" />
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* AI Suggestions alert callout box */}
                    <div className="border-t pt-3 border-slate-100 dark:border-slate-800">
                      <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-2 uppercase tracking-wide text-[10px]">
                        AI Recommendations
                      </h4>
                      <div className="p-2.5 rounded-lg bg-green-50/70 border border-green-200 text-green-700 dark:bg-green-950/20 dark:text-green-400 dark:border-green-800 flex items-start gap-2">
                        <CheckCircle className="shrink-0 mt-0.5" size={13} />
                        <span>OCR verification score is optimal. Verified voucher formats map completely to ledger database rules. Ready for posting.</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab content 2: Styled Document Scan Preview */}
                {activeRightTab === 'doc-preview' && (
                  <div className="border rounded-lg bg-slate-50 dark:bg-slate-950/30 border-slate-200 dark:border-slate-800 p-3 h-[420px] overflow-y-auto themed-scrollbar flex flex-col justify-between text-[9px] text-slate-700 dark:text-slate-300 shadow-inner font-mono">
                    <div className="space-y-4">
                      {/* Document Scanned Header */}
                      <div className="flex justify-between items-start border-b pb-2 border-slate-200 dark:border-slate-800">
                        <div>
                          <h4 className="text-[11px] font-black uppercase text-slate-900 dark:text-white leading-tight">
                            {activeDoc.vendor}
                          </h4>
                          <p className="text-[8px] text-slate-400 mt-0.5">123, Commercial Sector, Area Road, IN</p>
                        </div>
                        <div className="text-right">
                          <span className="font-bold px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-[7px] uppercase font-mono">
                            SCANNED PREVIEW
                          </span>
                        </div>
                      </div>

                      {/* Doc Particulars */}
                      <div className="grid grid-cols-2 gap-2 text-[8.5px] font-mono">
                        <div>
                          <p className="text-slate-400">Bill To:</p>
                          <p className="font-bold text-slate-855 dark:text-slate-200">Finbook Advisors LLP</p>
                          <p className="text-[7.5px] text-slate-400">Indore, MP, India</p>
                        </div>
                        <div className="text-right">
                          <p><span className="text-slate-400">Doc No:</span> <span className="font-bold">{activeDoc.docNo}</span></p>
                          <p><span className="text-slate-400">Date:</span> <span className="font-bold">{activeDoc.docDate}</span></p>
                          {activeDoc.refNo && <p><span className="text-slate-400">Ref:</span> <span className="font-bold">{activeDoc.refNo}</span></p>}
                        </div>
                      </div>

                      {/* Items table preview */}
                      {activeDoc.items && activeDoc.items.length > 0 ? (
                        <div className="border border-slate-200 dark:border-slate-800 rounded overflow-hidden">
                          <table className="w-full text-left border-collapse text-[8px] font-mono">
                            <thead>
                              <tr className="bg-slate-200/50 dark:bg-slate-800 border-b text-slate-500 border-slate-200 dark:border-slate-800 font-bold uppercase">
                                <th className="p-1">Description</th>
                                <th className="p-1 text-center">Qty</th>
                                <th className="p-1 text-right">Amount</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                              {activeDoc.items.map((it) => (
                                <tr key={it.id}>
                                  <td className="p-1 font-bold text-slate-800 dark:text-slate-200 truncate max-w-[130px]">{it.name || it.particulars}</td>
                                  <td className="p-1 text-center text-slate-500">{it.qty !== undefined ? it.qty : '—'}</td>
                                  <td className="p-1 text-right font-bold">
                                    ₹ {(it.qty !== undefined ? (it.qty * it.rate) : (it.debit || it.credit || 0)).toLocaleString()}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="border border-slate-200 dark:border-slate-800 p-3 text-center text-slate-400 font-semibold uppercase tracking-wider rounded">
                          Transaction Particulars: {activeDoc.narration}
                        </div>
                      )}
                    </div>

                    {/* Total summary block preview */}
                    <div className="border-t pt-2 border-slate-200 dark:border-slate-800 flex justify-between items-center text-[10px] font-bold text-slate-900 dark:text-white">
                      <span>Grand Total:</span>
                      <span className="text-slate-950 dark:text-white">₹ {(activeDoc.amount || 0).toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* --- BOTTOM TIMELINE STEPPER PANEL --- */}
          <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-3 shadow-3xs shrink-0 mt-1">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2.5">
              Processing History & Logs
            </h4>
            
            {/* Horizontal Timeline steps */}
            <div className="flex items-center justify-between gap-2 max-w-4xl mx-auto px-4 py-1">
              {/* Step 1: Uploaded */}
              <div className="flex flex-col items-center text-center relative flex-1">
                <div className="h-5 w-5 rounded-full bg-emerald-500 text-white flex items-center justify-center border border-emerald-600 shadow-3xs z-10">
                  <Check size={11} strokeWidth={3} />
                </div>
                <span className="text-[9.5px] font-bold text-slate-800 dark:text-slate-200 mt-1">Uploaded</span>
                <span className="text-[8px] text-slate-400 mt-0.5">{activeDoc.uploadDate}</span>
                <div className="absolute top-2.5 left-1/2 w-full h-0.5 bg-emerald-500 z-0" />
              </div>

              {/* Step 2: AI Processing */}
              <div className="flex flex-col items-center text-center relative flex-1">
                <div className="h-5 w-5 rounded-full bg-emerald-500 text-white flex items-center justify-center border border-emerald-600 shadow-3xs z-10">
                  <Check size={11} strokeWidth={3} />
                </div>
                <span className="text-[9.5px] font-bold text-slate-800 dark:text-slate-200 mt-1">AI Processing</span>
                <span className="text-[8px] text-slate-400 mt-0.5">{activeDoc.uploadDate}</span>
                <div className="absolute top-2.5 left-1/2 w-full h-0.5 bg-emerald-500 z-0" />
              </div>

              {/* Step 3: Data Extracted */}
              <div className="flex flex-col items-center text-center relative flex-1">
                <div className="h-5 w-5 rounded-full bg-emerald-500 text-white flex items-center justify-center border border-emerald-600 shadow-3xs z-10">
                  <Check size={11} strokeWidth={3} />
                </div>
                <span className="text-[9.5px] font-bold text-slate-800 dark:text-slate-200 mt-1">Extracted</span>
                <span className="text-[8px] text-slate-400 mt-0.5">19-06-2026 10:31 AM</span>
                <div className="absolute top-2.5 left-1/2 w-full h-0.5 bg-emerald-500 z-0" />
              </div>

              {/* Step 4: Validated */}
              <div className="flex flex-col items-center text-center relative flex-1">
                <div className="h-5 w-5 rounded-full bg-emerald-500 text-white flex items-center justify-center border border-emerald-600 shadow-3xs z-10">
                  <Check size={11} strokeWidth={3} />
                </div>
                <span className="text-[9.5px] font-bold text-slate-800 dark:text-slate-200 mt-1">Validated</span>
                <span className="text-[8px] text-slate-400 mt-0.5">19-06-2026 10:31 AM</span>
                <div className="absolute top-2.5 left-1/2 w-full h-0.5 bg-emerald-500 z-0" />
              </div>

              {/* Step 5: Ready for Review */}
              <div className="flex flex-col items-center text-center relative">
                <div className="h-5 w-5 rounded-full bg-blue-600 text-white flex items-center justify-center border border-blue-700 shadow-3xs z-10 font-bold text-[9px]">
                  5
                </div>
                <span className="text-[9.5px] font-bold text-slate-800 dark:text-slate-200 mt-1">Review Ready</span>
                <span className="text-[8px] text-slate-400 mt-0.5">19-06-2026 10:31 AM</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-grow flex items-center justify-center p-12">
          <div className="text-center max-w-sm">
            <Info size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No documents found</h3>
            <p className="text-slate-400 dark:text-slate-500 mt-1 text-[11px]">
              No documents are currently queueing for AI processing. Go to the Bulk Upload tab to upload files.
            </p>
            <button
              onClick={() => navigate('/bulk-upload')}
              className="mt-4 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs"
            >
              Upload Documents
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
