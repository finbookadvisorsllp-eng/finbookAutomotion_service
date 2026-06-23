import React, { useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UploadCloud, FileText, CheckCircle2, AlertCircle, Trash2, Send,
  FileSpreadsheet, Image, ChevronRight, ChevronLeft, RefreshCw, Check,
  Search, Filter, Info, Eye, Edit2, MoreVertical, Plus, X, FolderOpen, Scan,
  SlidersHorizontal, Download, LayoutList, Grid, Database, Calendar, ArrowLeft,
  Settings, CheckCircle, ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

export default function BulkUploadPanel() {
  const navigate = useNavigate();

  // --- States ---
  const [search, setSearch] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  
  // Voucher Categories Horizontal Navigation Tab (All, Sales Invoice, etc.)
  const [activeCategory, setActiveCategory] = useState('All');

  // Quick Filters
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [vendorFilter, setVendorFilter] = useState('All Vendors/Customers');
  const [dateRange, setDateRange] = useState('');

  // Table Selection & Pagination
  const [checkedIds, setCheckedIds] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fileInputRef = useRef(null);

  // Categories list matching screenshot horizontal navigation
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

  // --- Load from localStorage or Fallback to Default Mock Database ---
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

  const [documents, setDocuments] = useState(() => {
    const saved = localStorage.getItem('fb_bulk_documents');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error loading documents from local storage', e);
      }
    }
    return defaultDocs;
  });

  const syncDocuments = (updated) => {
    setDocuments(updated);
    localStorage.setItem('fb_bulk_documents', JSON.stringify(updated));
  };

  // --- Dynamic unique vendors list ---
  const uniqueVendors = useMemo(() => {
    const vendors = documents.map(d => d.vendor).filter(Boolean);
    return Array.from(new Set(vendors));
  }, [documents]);

  // --- Document File Type Icon Generator ---
  const getDocIcon = (fileType) => {
    if (fileType === 'excel' || fileType === 'csv') {
      return <FileSpreadsheet className="text-emerald-555 shrink-0" size={13} />;
    }
    if (fileType === 'image') {
      return <Image className="text-blue-500 shrink-0" size={13} />;
    }
    return <FileText className="text-blue-500 shrink-0" size={13} />;
  };

  // --- Dynamic Stats Offset matching screenshot counts ---
  const stats = useMemo(() => {
    const totalCount = documents.length + 1233; // 1248 with 15 mock docs
    const syncedCount = documents.filter(d => d.status === 'Posted').length + 1099; // 1102
    const aiCount = documents.filter(d => d.confidence > 90).length + 1019; // 1033
    const approvedCount = documents.filter(d => d.status === 'Approved').length + 865; // 872
    const postedCount = documents.filter(d => d.status === 'Posted').length + 731; // 734
    const failedCount = documents.filter(d => d.status === 'Failed').length + 30; // 31

    return {
      total: totalCount,
      synced: syncedCount,
      ai: aiCount,
      approved: approvedCount,
      posted: postedCount,
      failed: failedCount
    };
  }, [documents]);

  // --- Dynamic Filtering Logic for Table ---
  const filteredDocs = useMemo(() => {
    return documents.filter(doc => {
      // Category Navigation Tab Filter (All, Sales Invoice, etc.)
      let categoryMatch = true;
      if (activeCategory !== 'All') {
        categoryMatch = doc.category === activeCategory;
      }

      // Status selector Filter
      if (statusFilter !== 'All Status' && doc.status !== statusFilter) return false;

      // Vendor Filter
      if (vendorFilter !== 'All Vendors/Customers' && doc.vendor !== vendorFilter) return false;

      // Search bar filter query
      if (search) {
        const query = search.toLowerCase();
        const matchFilename = doc.filename.toLowerCase().includes(query);
        const matchVendor = doc.vendor.toLowerCase().includes(query);
        const matchDocNo = doc.docNo.toLowerCase().includes(query);
        if (!matchFilename && !matchVendor && !matchDocNo) return false;
      }

      // Date Range Filter
      if (dateRange) {
        const query = dateRange.toLowerCase();
        if (query && !doc.docDate.includes(query)) return false;
      }

      return categoryMatch;
    });
  }, [documents, activeCategory, statusFilter, vendorFilter, search, dateRange]);

  // Pagination bounds
  const paginatedDocs = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredDocs.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredDocs, currentPage]);

  const totalPages = Math.max(1, Math.ceil(filteredDocs.length / itemsPerPage));

  // --- Upload handlers ---
  const handleBrowse = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const extension = file.name.split('.').pop().toLowerCase();
      let category = 'Sales Invoice';
      let fileType = 'pdf';
      let docNo = 'INV-' + Math.floor(Math.random() * 900 + 100);

      if (['xlsx', 'xls', 'csv'].includes(extension)) {
        category = 'Bank Statement';
        fileType = 'excel';
        docNo = 'BS-' + Math.floor(Math.random() * 900 + 100);
      } else if (file.name.toLowerCase().includes('pay')) {
        category = 'Payment';
        docNo = 'PAY-' + Math.floor(Math.random() * 900 + 100);
      } else if (file.name.toLowerCase().includes('rec')) {
        category = 'Receipt';
        docNo = 'REC-' + Math.floor(Math.random() * 900 + 100);
      }

      const newDocId = 'doc-' + Date.now();
      const newDoc = {
        id: newDocId,
        filename: file.name,
        fileType: fileType,
        category: category,
        uploadDate: new Date().toLocaleString('en-IN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }).replace(/\//g, '-'),
        vendor: 'New Partner Inc.',
        docNo: docNo,
        refNo: 'REF-' + Math.floor(Math.random() * 8000 + 1000),
        docDate: '19-06-2026',
        dueDate: '19-07-2026',
        partyLedger: 'New Partner Inc. (Sundry Debtors)',
        salesLedger: 'Sales (18%)',
        purchaseLedger: 'Purchase (18%)',
        gstin: '22GSTIN' + Math.floor(Math.random() * 90000 + 10000) + 'A1Z1',
        currency: 'INR',
        placeOfSupply: 'Madhya Pradesh (23)',
        narration: `AI Processed ${file.name} automatically.`,
        items: [
          { id: 1, name: 'Item Alpha', qty: 2, rate: 150.00, taxRate: 18 }
        ],
        taxableAmount: 300.00,
        taxAmount: 54.00,
        roundOff: 0.00,
        amount: 354.00,
        confidence: Math.floor(Math.random() * 5 + 95), // 95 - 99%
        status: 'Draft',
        createdBy: 'Admin User'
      };

      const updatedDocs = [newDoc, ...documents];
      syncDocuments(updatedDocs);
      setShowUploadModal(false);
      
      // Auto processing callback simulation -> redirect to processing workspace route
      toast.loading('AI automatically extracting document parameters...');
      setTimeout(() => {
        toast.dismiss();
        toast.success(`AI successfully processed "${file.name}"! Opening AI Processing Center...`);
        // Navigate to the separate AI Processing Center route with state
        navigate('/automation/ai-processing', { state: { selectedDocId: newDocId } });
      }, 1200);
    }
  };

  const handleReset = () => {
    setSearch('');
    setStatusFilter('All Status');
    setVendorFilter('All Vendors/Customers');
    setDateRange('');
    setActiveCategory('All');
    setCheckedIds([]);
    setCurrentPage(1);
    toast.info('Quick filters reset');
  };

  // --- Table Row Selectors ---
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setCheckedIds(paginatedDocs.map(d => d.id));
    } else {
      setCheckedIds([]);
    }
  };

  const handleSelectRow = (id) => {
    setCheckedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
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

  const getStatusStyles = (stat) => {
    const stylesMap = {
      'Approved': 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/15 dark:text-green-400 dark:border-green-800',
      'Under Review': 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/15 dark:text-purple-400 dark:border-purple-800',
      'Posted': 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/15 dark:text-blue-400 dark:border-blue-800',
      'Draft': 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/15 dark:text-amber-400 dark:border-amber-800',
      'Failed': 'bg-red-50 text-red-705 border-red-200 dark:bg-red-950/15 dark:text-red-400 dark:border-red-800'
    };
    return stylesMap[stat] || 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800';
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
                setCurrentPage(1);
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

      <div className="flex flex-col gap-2 flex-grow">
        {/* Header Row */}
        <div className="flex items-center justify-between gap-2 py-0.5 mt-0.5">
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">Bulk Upload</h1>
          
          <button
            onClick={() => setShowUploadModal(true)}
            className="h-8 px-3 border border-blue-200 dark:border-blue-900 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900 hover:bg-blue-50/50 dark:hover:bg-slate-800/50 rounded-lg transition flex items-center gap-1.5 font-bold shadow-xs text-xs"
          >
            <UploadCloud size={13} className="text-blue-500" />
            <span>Upload Documents</span>
          </button>
        </div>

        {/* KPI Stats Cards Row */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 shrink-0">
          {/* Total Documents */}
          <div className="p-2 border rounded-lg bg-blue-50/55 border-blue-100/70 dark:bg-blue-950/15 dark:border-blue-900/35 shadow-3xs flex items-center justify-between h-[58px] transition-all">
            <div className="min-w-0 flex-1">
              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide leading-none block truncate">Total Documents</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-lg font-black text-slate-900 dark:text-white leading-none">{stats.total.toLocaleString()}</span>
                <span className="text-[8px] text-slate-400 dark:text-slate-500 leading-none">All Time</span>
              </div>
            </div>
            <div className="h-6 w-6 rounded-md bg-blue-100/50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 shrink-0">
              <FileText size={12} />
            </div>
          </div>

          {/* Synced from Tally */}
          <div className="p-2 border rounded-lg bg-emerald-50/55 border-emerald-100/70 dark:bg-emerald-950/15 dark:border-emerald-900/35 shadow-3xs flex items-center justify-between h-[58px] transition-all">
            <div className="min-w-0 flex-1">
              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide leading-none block truncate">Synced from Tally</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-lg font-black text-slate-900 dark:text-white leading-none">{stats.synced.toLocaleString()}</span>
                <span className="text-[8px] text-slate-400 dark:text-slate-500 leading-none">This Month</span>
              </div>
            </div>
            <div className="h-6 w-6 rounded-md bg-emerald-100/50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 shrink-0">
              <Database size={12} />
            </div>
          </div>

          {/* AI Processed */}
          <div className="p-2 border rounded-lg bg-purple-50/55 border-purple-100/70 dark:bg-purple-950/15 dark:border-purple-900/35 shadow-3xs flex items-center justify-between h-[58px] transition-all">
            <div className="min-w-0 flex-1">
              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide leading-none block truncate">AI Processed</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-lg font-black text-slate-900 dark:text-white leading-none">{stats.ai.toLocaleString()}</span>
                <span className="text-[8px] text-slate-400 dark:text-slate-500 leading-none">This Month</span>
              </div>
            </div>
            <div className="h-6 w-6 rounded-md bg-purple-100/50 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 shrink-0">
              <SlidersHorizontal size={12} />
            </div>
          </div>

          {/* Approved */}
          <div className="p-2 border rounded-lg bg-green-50/55 border-green-100/70 dark:bg-green-950/15 dark:border-green-900/35 shadow-3xs flex items-center justify-between h-[58px] transition-all">
            <div className="min-w-0 flex-1">
              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide leading-none block truncate">Approved</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-lg font-black text-slate-900 dark:text-white leading-none">{stats.approved}</span>
                <span className="text-[8px] text-slate-400 dark:text-slate-500 leading-none">This Month</span>
              </div>
            </div>
            <div className="h-6 w-6 rounded-md bg-green-100/50 dark:bg-green-900/30 flex items-center justify-center text-green-600 shrink-0">
              <CheckCircle2 size={12} />
            </div>
          </div>

          {/* Posted to Tally */}
          <div className="p-2 border rounded-lg bg-blue-50/55 border-blue-100/70 dark:bg-blue-950/15 dark:border-blue-900/35 shadow-3xs flex items-center justify-between h-[58px] transition-all">
            <div className="min-w-0 flex-1">
              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide leading-none block truncate">Posted to Tally</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-lg font-black text-slate-900 dark:text-white leading-none">{stats.posted}</span>
                <span className="text-[8px] text-slate-400 dark:text-slate-500 leading-none">This Month</span>
              </div>
            </div>
            <div className="h-6 w-6 rounded-md bg-blue-100/50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 shrink-0">
              <Send size={12} />
            </div>
          </div>

          {/* Failed / Rejected */}
          <div className="p-2 border rounded-lg bg-red-50/55 border-red-100/70 dark:bg-red-950/15 dark:border-red-900/35 shadow-3xs flex items-center justify-between h-[58px] transition-all">
            <div className="min-w-0 flex-1">
              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide leading-none block truncate">Failed / Rejected</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-lg font-black text-slate-900 dark:text-white leading-none">{stats.failed}</span>
                <span className="text-[8px] text-slate-400 dark:text-slate-500 leading-none">This Month</span>
              </div>
            </div>
            <div className="h-6 w-6 rounded-md bg-red-100/50 dark:bg-red-900/30 flex items-center justify-center text-rose-600 shrink-0">
              <AlertCircle size={12} />
            </div>
          </div>
        </div>

        {/* Filters row */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 shadow-3xs shrink-0">
          {/* Search documents */}
          <div className="relative max-w-xs flex-1 group">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
            <input
              type="text"
              placeholder="Search documents..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-7.5 pl-8 pr-2.5 rounded-lg border text-[11px] outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Dropdowns */}
          <div className="flex flex-wrap items-center gap-2 flex-1 lg:justify-end">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="h-7.5 rounded-lg border px-2 text-[11px] outline-none bg-white dark:bg-slate-950/40 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 w-[105px]"
            >
              <option value="All Status">All Status</option>
              <option value="Approved">Approved</option>
              <option value="Under Review">Under Review</option>
              <option value="Posted">Posted</option>
              <option value="Draft">Draft</option>
              <option value="Failed">Failed</option>
            </select>

            <select
              value={activeCategory}
              onChange={(e) => {
                setActiveCategory(e.target.value);
                setCurrentPage(1);
              }}
              className="h-7.5 rounded-lg border px-2 text-[11px] outline-none bg-white dark:bg-slate-950/40 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 w-[120px]"
            >
              <option value="All">All Categories</option>
              {tabCategories.slice(1).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <select
              value={vendorFilter}
              onChange={(e) => {
                setVendorFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="h-7.5 rounded-lg border px-2 text-[11px] outline-none bg-white dark:bg-slate-950/40 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 w-[170px]"
            >
              <option value="All Vendors/Customers">All Vendors/Customers</option>
              {uniqueVendors.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>

            <div className="relative flex items-center">
              <select
                value={dateRange}
                onChange={(e) => {
                  setDateRange(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-7.5 rounded-lg border pl-2.5 pr-7 text-[11px] outline-none bg-white dark:bg-slate-950/45 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 w-[140px] appearance-none cursor-pointer"
              >
                <option value="">Select Date Range</option>
                <option value="19-06-2026">19-06-2026</option>
                <option value="18-06-2026">18-06-2026</option>
                <option value="17-06-2026">17-06-2026</option>
              </select>
              <Calendar className="absolute right-2.5 pointer-events-none text-slate-400" size={12} />
            </div>

            <button
              onClick={handleReset}
              className="text-[11px] font-bold text-blue-600 hover:text-blue-700 bg-transparent transition-colors px-1"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Table Container */}
        <div className="border rounded-lg flex-1 overflow-hidden flex flex-col bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800/80 shadow-3xs min-h-[250px]">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse min-w-[1000px] text-[11px] whitespace-nowrap">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-950/30 border-b text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 font-semibold uppercase tracking-wider">
                  <th className="py-2 px-2.5 w-9 text-center">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 cursor-pointer h-3.5 w-3.5"
                      onChange={handleSelectAll}
                      checked={paginatedDocs.length > 0 && paginatedDocs.every(d => checkedIds.includes(d.id))}
                    />
                  </th>
                  <th className="py-2 px-2.5 font-semibold">Document Name</th>
                  <th className="py-2 px-2.5 font-semibold">Category</th>
                  <th className="py-2 px-2.5 font-semibold">Vendor / Customer</th>
                  <th className="py-2 px-2.5 font-semibold">Document No.</th>
                  <th className="py-2 px-2.5 font-semibold text-right">Amount</th>
                  <th className="py-2 px-2.5 font-semibold text-center">Status</th>
                  <th className="py-2 px-2.5 font-semibold text-center">Confidence</th>
                  <th className="py-2 px-2.5 font-semibold">Created By</th>
                  <th className="py-2 px-2.5 font-semibold text-center w-20">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {paginatedDocs.length > 0 ? (
                  paginatedDocs.map((doc) => {
                    const isChecked = checkedIds.includes(doc.id);
                    return (
                      <tr
                        key={doc.id}
                        className={`hover:bg-slate-50/30 dark:hover:bg-slate-900/30 transition-colors ${
                          isChecked ? 'bg-blue-50/10 dark:bg-blue-950/5' : ''
                        }`}
                      >
                        <td className="py-1.5 px-2.5 text-center">
                          <input
                            type="checkbox"
                            className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 cursor-pointer h-3.5 w-3.5"
                            checked={isChecked}
                            onChange={() => handleSelectRow(doc.id)}
                          />
                        </td>
                        <td className="py-1.5 px-2.5 font-semibold text-slate-950 dark:text-slate-100">
                          <div className="flex items-center gap-1.5">
                            {getDocIcon(doc.fileType)}
                            <span className="truncate max-w-[160px] font-semibold" title={doc.filename}>{doc.filename}</span>
                          </div>
                        </td>
                        <td className="py-1.5 px-2.5">
                          <span className={`px-2 py-0.5 rounded border text-[9px] font-extrabold uppercase ${getCategoryStyles(doc.category)}`}>
                            {doc.category}
                          </span>
                        </td>
                        <td className="py-1.5 px-2.5 text-slate-900 dark:text-slate-200 font-semibold">{doc.vendor}</td>
                        <td className="py-1.5 px-2.5 text-slate-600 dark:text-slate-400 font-semibold">{doc.docNo}</td>
                        <td className="py-1.5 px-2.5 text-right text-slate-950 dark:text-white font-bold">
                          ₹ {doc.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-1.5 px-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded border text-[9px] font-extrabold uppercase ${getStatusStyles(doc.status)}`}>
                            {doc.status}
                          </span>
                        </td>
                        <td className="py-1.5 px-2.5 text-center text-slate-900 dark:text-slate-100 font-bold">{doc.confidence}%</td>
                        <td className="py-1.5 px-2.5 text-slate-500 dark:text-slate-400 font-semibold text-[10px]">{doc.createdBy}</td>
                        <td className="py-1.5 px-2.5 text-center">
                          <div className="flex items-center justify-center gap-2 text-slate-400 dark:text-slate-500">
                            <button
                              onClick={() => {
                                // Navigate to the workspace route with current document focused
                                navigate('/automation/ai-processing', { state: { selectedDocId: doc.id } });
                              }}
                              className="p-0.5 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition"
                              title="View in AI Processing Workspace"
                            >
                              <Eye size={13} />
                            </button>
                            <button
                              onClick={() => toast.info(`Editing details of ${doc.filename}`)}
                              className="p-0.5 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition"
                              title="Edit Details"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              onClick={() => {
                                const updated = documents.filter(d => d.id !== doc.id);
                                syncDocuments(updated);
                                toast.success(`Removed document ${doc.filename}`);
                              }}
                              className="p-0.5 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition"
                              title="Delete Record"
                            >
                              <Trash2 size={13} />
                            </button>
                            <button className="p-0.5 hover:text-slate-700 dark:hover:text-slate-300 rounded transition">
                              <MoreVertical size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-400 dark:text-slate-500 font-medium">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <Info size={24} className="text-slate-300 dark:text-slate-700" />
                        <span>No uploaded documents found.</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Navigation Page indices */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 shrink-0 pb-1 mt-1">
          <div className="text-slate-500 dark:text-slate-400 font-medium">
            Showing <span className="font-bold text-slate-900 dark:text-white">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
            <span className="font-bold text-slate-900 dark:text-white">
              {Math.min(currentPage * itemsPerPage, filteredDocs.length)}
            </span>{' '}
            of <span className="font-bold text-slate-900 dark:text-white">{filteredDocs.length}</span> entries
            {activeCategory === 'All' && search === '' && statusFilter === 'All Status' && (
              <span className="text-slate-400 text-xs"> (Filtered from 1,248 total)</span>
            )}
          </div>

          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="h-7 w-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-40"
            >
              <ChevronLeft size={13} />
            </button>

            {Array.from({ length: totalPages }).map((_, index) => {
              const pageNum = index + 1;
              const isActive = pageNum === currentPage;
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`h-7 w-7 text-xs font-bold rounded-lg transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white font-bold shadow-2xs'
                      : 'border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            {totalPages > 5 && (
              <>
                <span className="px-0.5 text-slate-400">...</span>
                <button
                  onClick={() => setCurrentPage(125)}
                  className="h-7 w-7 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  125
                </button>
              </>
            )}

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="h-7 w-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-40"
            >
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* --- POPUP UPLOAD MODAL DIALOG --- */}
      <AnimatePresence>
        {showUploadModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-100">
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-4xl w-full overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Upload Documents
                </h3>
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-white dark:bg-slate-900">
                {/* Left Side: Drag and drop / file browser choice */}
                <div className="flex flex-col">
                  <div
                    onClick={handleBrowse}
                    className="border border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-800/10 border-blue-200 dark:border-slate-700 bg-blue-50/5 dark:bg-slate-900/10 min-h-[148px]"
                  >
                    <UploadCloud size={40} className="text-blue-500 mb-2" />
                    <p className="text-[12px] text-slate-500 dark:text-slate-400">Drag & drop files here or</p>
                    
                    <div className="flex items-center gap-2 mt-4 flex-wrap justify-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={handleBrowse}
                        className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors shadow-sm animate-pulse"
                      >
                        Choose Files
                      </button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      <button
                        type="button"
                        className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
                        onClick={() => toast.info('Folder upload initiated')}
                      >
                        <FolderOpen size={13} />
                        <span>Upload Folder</span>
                      </button>
                      <button
                        type="button"
                        className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
                        onClick={() => toast.info('Scanner connected')}
                      >
                        <Scan size={13} />
                        <span>Scan Document</span>
                      </button>
                    </div>
                  </div>
                  
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 text-center mt-3 leading-none">
                    Supports PDF, JPG, PNG, Excel, CSV, ZIP (Max 100MB)
                  </div>
                </div>

                {/* Right Side: AI description list + inline SVG graphic illustration */}
                <div className="flex items-center gap-6 bg-white dark:bg-slate-900">
                  {/* Inline Document Illustration */}
                  <svg className="w-32 h-32 text-blue-500/80 shrink-0" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="25" y="15" width="55" height="75" rx="8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 3" className="text-slate-200 dark:text-slate-700" />
                    <rect x="40" y="30" width="55" height="75" rx="8" fill="white" className="dark:fill-slate-800" stroke="currentColor" strokeWidth="1.8" />
                    <line x1="52" y1="48" x2="83" y2="48" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="text-slate-100 dark:text-slate-700" />
                    <line x1="52" y1="58" x2="72" y2="58" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="text-slate-200 dark:text-slate-700" />
                    <line x1="52" y1="68" x2="80" y2="68" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="text-slate-200 dark:text-slate-700" />
                    <rect x="52" y="78" width="12" height="6" rx="2" fill="currentColor" className="text-blue-100 dark:text-blue-900/40" />
                    <rect x="68" y="78" width="12" height="6" rx="2" fill="currentColor" className="text-emerald-100 dark:text-emerald-900/40" />
                  </svg>

                  {/* Feature checklist */}
                  <div className="flex flex-col">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2.5">
                      AI will automatically:
                    </h4>
                    <ul className="space-y-2">
                      <li className="flex items-start gap-2 text-slate-600 dark:text-slate-400">
                        <Check size={14} className="text-blue-600 mt-0.5 shrink-0 animate-bounce" />
                        <span>Extract document data</span>
                      </li>
                      <li className="flex items-start gap-2 text-slate-600 dark:text-slate-400">
                        <Check size={14} className="text-blue-600 mt-0.5 shrink-0" />
                        <span>Identify voucher type</span>
                      </li>
                      <li className="flex items-start gap-2 text-slate-600 dark:text-slate-400">
                        <Check size={14} className="text-blue-600 mt-0.5 shrink-0" />
                        <span>Validate with masters</span>
                      </li>
                      <li className="flex items-start gap-2 text-slate-600 dark:text-slate-400">
                        <Check size={14} className="text-blue-600 mt-0.5 shrink-0" />
                        <span>Create vouchers</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
