import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, XCircle, Send, FileText, AlertTriangle, Plus, X, Layers, User, Search, Eye, HelpCircle, 
  Download, ArrowLeft, Sparkles, Pencil, ChevronDown, Trash2, ZoomIn, ZoomOut, Maximize2, Check, ChevronRight, 
  MessageSquare, ExternalLink, Calendar, MoreVertical, UploadCloud
} from 'lucide-react';
import ObjectDoodle from '../ui/ObjectDoodle';
import DataTable from '../ui/DataTable';
import Badge, { statusTone } from '../ui/Badge';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { useAppStore } from '../../stores/useAppStore';

// Import backend API clients
import salesApi from '../../services/salesApi';
import purchaseApi from '../../services/purchaseApi';
import fundflowApi from '../../services/fundflowApi';

// Define standard status text styles
const statusTextColors = {
  'Ready to Post': 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/40',
  'Needs Review': 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-emerald-950/20',
  'Mapping Missing': 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-450 dark:border-rose-900/40',
  'High Risk': 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-rose-900/40',
  'Approved': 'bg-emerald-50 text-emerald-700 border-emerald-250 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-rose-900/40',
  'Rejected': 'bg-rose-50 text-rose-705 border-rose-250 dark:bg-rose-900/20 dark:text-rose-450 dark:border-rose-900/40',
  'Synced': 'bg-[var(--app-accent-soft)] text-[var(--app-accent)] border-[var(--app-border)] dark:bg-[var(--app-accent-soft)] dark:text-[var(--app-accent)] dark:border-[var(--app-border)]',
  'Pending Approval': 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-955/15 dark:text-amber-400 dark:border-amber-800'
};

// Mock Fallback Data
const defaultMockManualEntries = [
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
    source: 'Manual Voucher Entry',
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
    source: 'Manual Voucher Entry',
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
    source: 'Manual Voucher Entry',
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
    source: 'Manual Voucher Entry',
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
    source: 'Manual Voucher Entry',
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
    source: 'Manual Voucher Entry',
    details: { 
      ledger: 'Sales Returns', 
      tax: 'CGST/SGST (18%)', 
      taxAmount: 4881.36,
      taxableValue: 27118.64,
      attachments: 'credit_note_06.pdf', 
      comments: 'Returned damaged stock.' 
    } 
  }
];

const defaultMockBulkBatches = [
  {
    id: 'BATCH-001',
    filename: 'Q2_Sales_Invoice_Dump.csv',
    totalRecords: 12,
    uploadDate: '23-06-2026 04:15 PM',
    status: 'Pending Approval',
    records: [
      { id: 1, date: '2026-06-19', docNo: 'INV-1001', category: 'Sales Invoice', partyName: 'ABC Traders', gstin: '22AAAAA1111A1Z5', taxableValue: 20000, taxAmount: 3600, totalAmount: 23600, status: 'Valid', errorMessage: '' },
      { id: 2, date: '2026-06-19', docNo: 'INV-1002', category: 'Sales Invoice', partyName: 'XYZ Enterprises', gstin: '22BBBBB2222B2Z6', taxableValue: 15000, taxAmount: 2700, totalAmount: 17700, status: 'Valid', errorMessage: '' },
      { id: 3, date: '2026-06-18', docNo: 'INV-1003', category: 'Sales Invoice', partyName: 'LMN Industries', gstin: '22CCCCC3333C3Z7', taxableValue: 8000, taxAmount: 1440, totalAmount: 9440, status: 'Warning', errorMessage: 'GSTIN mismatch with ledger master' },
      { id: 4, date: '2026-06-18', docNo: 'INV-1004', category: 'Sales Invoice', partyName: 'PQR Solutions', gstin: '22DDDDD4444D4Z8', taxableValue: 45000, taxAmount: 8100, totalAmount: 53100, status: 'Valid', errorMessage: '' },
      { id: 5, date: '2026-06-17', docNo: 'INV-1005', category: 'Sales Invoice', partyName: 'New Horizon Ltd', gstin: '', taxableValue: 12000, taxAmount: 0, totalAmount: 12000, status: 'Warning', errorMessage: 'GSTIN is empty for business customer' },
      { id: 6, date: '2026-06-17', docNo: 'INV-1006', category: 'Sales Invoice', partyName: 'Apex Tech', gstin: '22EEEEE5555E5Z9', taxableValue: 30000, taxAmount: 5400, totalAmount: 35400, status: 'Valid', errorMessage: '' },
      { id: 7, date: '2026-06-16', docNo: 'INV-1007', category: 'Sales Invoice', partyName: 'Alpha Services', gstin: '22FFFFF6666F6ZA', taxableValue: 5000, taxAmount: 900, totalAmount: 5900, status: 'Valid', errorMessage: '' },
      { id: 8, date: '2026-06-16', docNo: 'INV-1008', category: 'Sales Invoice', partyName: 'Beta Corp', gstin: '22GGGGG7777G7ZB', taxableValue: 22000, taxAmount: 3960, totalAmount: 25960, status: 'Valid', errorMessage: '' },
      { id: 9, date: '2026-06-15', docNo: 'INV-1009', category: 'Sales Invoice', partyName: 'Gamma Systems', gstin: '22HHHHH8888H8ZC', taxableValue: 17500, taxAmount: 3150, totalAmount: 20650, status: 'Valid', errorMessage: '' },
      { id: 10, date: '2026-06-15', docNo: 'INV-1010', category: 'Sales Invoice', partyName: 'Delta Partners', gstin: '22IIIII9999I9ZD', taxableValue: 9500, taxAmount: 1710, totalAmount: 11210, status: 'Valid', errorMessage: '' },
      { id: 11, date: '2026-06-14', docNo: 'INV-1011', category: 'Sales Invoice', partyName: 'Epsilon Tech', gstin: '22JJJJJ1010J1ZE', taxableValue: 64000, taxAmount: 11520, totalAmount: 75520, status: 'Valid', errorMessage: '' },
      { id: 12, date: '2026-06-14', docNo: 'INV-1012', category: 'Sales Invoice', partyName: 'Zeta Consulting', gstin: '22KKKKK1111K1ZF', taxableValue: 11000, taxAmount: 1980, totalAmount: 12980, status: 'Valid', errorMessage: '' }
    ]
  },
  {
    id: 'BATCH-002',
    filename: 'Purchases_June_2026.xlsx',
    totalRecords: 8,
    uploadDate: '22-06-2026 11:30 AM',
    status: 'Approved',
    records: [
      { id: 1, date: '2026-06-20', docNo: 'PI-901', category: 'Purchase Invoice', partyName: 'XYZ Enterprises', gstin: '22BBBBB2222B2Z6', taxableValue: 18000, taxAmount: 3240, totalAmount: 21240, status: 'Valid', errorMessage: '' },
      { id: 2, date: '2026-06-20', docNo: 'PI-902', category: 'Purchase Invoice', partyName: 'PQR Solutions', gstin: '22DDDDD4444D4Z8', taxableValue: 35000, taxAmount: 6300, totalAmount: 41300, status: 'Valid', errorMessage: '' },
      { id: 3, date: '2026-06-19', docNo: 'PI-903', category: 'Purchase Invoice', partyName: 'ABC Traders', gstin: '22AAAAA1111A1Z5', taxableValue: 7000, taxAmount: 1260, totalAmount: 8260, status: 'Valid', errorMessage: '' },
      { id: 4, date: '2026-06-19', docNo: 'PI-904', category: 'Purchase Invoice', partyName: 'LMN Industries', gstin: '22CCCCC3333C3Z7', taxableValue: 12500, taxAmount: 2250, totalAmount: 14750, status: 'Valid', errorMessage: '' },
      { id: 5, date: '2026-06-18', docNo: 'PI-905', category: 'Purchase Invoice', partyName: 'Apex Tech', gstin: '22EEEEE5555E5Z9', taxableValue: 24000, taxAmount: 4320, totalAmount: 28320, status: 'Valid', errorMessage: '' },
      { id: 6, date: '2026-06-17', docNo: 'PI-906', category: 'Purchase Invoice', partyName: 'Beta Corp', gstin: '22GGGGG7777G7ZB', taxableValue: 9500, taxAmount: 1710, totalAmount: 11210, status: 'Valid', errorMessage: '' },
      { id: 7, date: '2026-06-17', docNo: 'PI-907', category: 'Purchase Invoice', partyName: 'Alpha Services', gstin: '22FFFFF6666F6ZA', taxableValue: 48000, taxAmount: 8640, totalAmount: 56640, status: 'Valid', errorMessage: '' },
      { id: 8, date: '2026-06-16', docNo: 'PI-908', category: 'Purchase Invoice', partyName: 'New Horizon Ltd', gstin: '', taxableValue: 15000, taxAmount: 0, totalAmount: 15000, status: 'Warning', errorMessage: 'GSTIN is empty for business customer' }
    ]
  },
  {
    id: 'BATCH-003',
    filename: 'Bank_Statement_HDFC.csv',
    totalRecords: 5,
    uploadDate: '21-06-2026 09:10 AM',
    status: 'Posted To Tally',
    records: [
      { id: 1, date: '2026-06-20', docNo: 'TXN-87612', category: 'Payment', partyName: 'ABC Traders', gstin: '22AAAAA1111A1Z5', taxableValue: 10000, taxAmount: 0, totalAmount: 10000, status: 'Valid', errorMessage: '' },
      { id: 2, date: '2026-06-20', docNo: 'TXN-90817', category: 'Receipt', partyName: 'LMN Industries', gstin: '22CCCCC3333C3Z7', taxableValue: 8500, taxAmount: 0, totalAmount: 8500, status: 'Valid', errorMessage: '' },
      { id: 3, date: '2026-06-19', docNo: 'TXN-11002', category: 'Contra', partyName: 'Cash A/c', gstin: '', taxableValue: 12000, taxAmount: 0, totalAmount: 12000, status: 'Valid', errorMessage: '' },
      { id: 4, date: '2026-06-18', docNo: 'TXN-09880', category: 'Payment', partyName: 'LMN Industries', gstin: '22CCCCC3333C3Z7', taxableValue: 7200, taxAmount: 0, totalAmount: 7200, status: 'Valid', errorMessage: '' },
      { id: 5, date: '2026-06-18', docNo: 'TXN-90114', category: 'Receipt', partyName: 'ABC Traders', gstin: '22AAAAA1111A1Z5', taxableValue: 19500, taxAmount: 0, totalAmount: 19500, status: 'Valid', errorMessage: '' }
    ]
  }
];

const defaultMockOcrDocs = [
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
      { id: 1, name: 'Cloud Migration Consultancy', qty: 10, rate: 4210.00, taxRate: 18, amount: 42100.00 }
    ],
    taxableAmount: 42100.00,
    taxAmount: 7578.00,
    roundOff: 0.00,
    amount: 49678.00,
    confidence: 98,
    status: 'Pending Approval',
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
      { id: 1, name: 'LED Monitor 24in', qty: 10, rate: 3412.00, taxRate: 18, amount: 34120.00 }
    ],
    taxableAmount: 34120.00,
    taxAmount: 6141.60,
    roundOff: 0.40,
    amount: 40262.00,
    confidence: 95,
    status: 'Pending Approval',
    createdBy: 'Operator 1'
  }
];

export default function ApprovalCenter() {
  const approvalCenterView = useAppStore((s) => s.approvalCenterView);
  const setApprovalCenterView = useAppStore((s) => s.setApprovalCenterView);
  const currentView = approvalCenterView;
  const setCurrentView = setApprovalCenterView;

  // Source-level tab state
  const [activeSourceTab, setActiveSourceTab] = useState('Manual Voucher Entry'); // 'Manual Voucher Entry' | 'Bulk Upload' | 'OCR Upload'
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);

  const [selectedEntryId, setSelectedEntryId] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('Total');
  const [page, setPage] = useState(1);

  // Editable OCR form state
  const [ocrForm, setOcrForm] = useState({
    vendor: '',
    docNo: '',
    docDate: '',
    partyLedger: '',
    amount: '',
    gstin: '',
    narration: ''
  });

  // Mappers for Database Manual Entry Vouchers
  const mapSalesVoucher = (v) => {
    const statusVal = (v.status || 'pending_approval').toLowerCase();
    let typeLabel = 'Sales Voucher';
    if (v.voucherType === 'sales_order') typeLabel = 'Sales Order';
    else if (v.voucherType === 'credit_note') typeLabel = 'Credit Note';

    return {
      id: v._id || v.id,
      voucherNumber: v.invoiceNumber || v.voucherNumber || 'SI-' + (v._id || v.id).slice(-4).toUpperCase(),
      date: v.invoiceDate || v.voucherDate || v.createdAt || '—',
      company: v.partyLedger || v.partyLedgerName || '—',
      type: typeLabel,
      amount: parseFloat(v.grandTotal || v.amount) || 0,
      status: statusVal === 'draft' ? 'Draft' : (statusVal === 'approved' ? 'Approved' : (statusVal === 'posted_to_tally' ? 'Posted To Tally' : (statusVal === 'rejected' ? 'Rejected' : 'Pending Approval'))),
      confidence: 100,
      statusText: statusVal === 'approved' ? 'Approved' : (statusVal === 'posted_to_tally' ? 'Synced' : (statusVal === 'rejected' ? 'Rejected' : 'Ready to Post')),
      source: 'Manual Voucher Entry',
      raw: v
    };
  };

  const mapPurchaseVoucher = (v) => {
    const statusVal = (v.status || 'pending_approval').toLowerCase();
    let typeLabel = 'Purchase Voucher';
    if (v.voucherType === 'purchase_order') typeLabel = 'Purchase Order';
    else if (v.voucherType === 'debit_note') typeLabel = 'Debit Note';

    return {
      id: v._id || v.id,
      voucherNumber: v.invoiceNumber || v.voucherNumber || 'PI-' + (v._id || v.id).slice(-4).toUpperCase(),
      date: v.invoiceDate || v.voucherDate || v.createdAt || '—',
      company: v.partyLedger || v.partyLedgerName || '—',
      type: typeLabel,
      amount: parseFloat(v.grandTotal || v.amount) || 0,
      status: statusVal === 'draft' ? 'Draft' : (statusVal === 'approved' ? 'Approved' : (statusVal === 'posted_to_tally' ? 'Posted To Tally' : (statusVal === 'rejected' ? 'Rejected' : 'Pending Approval'))),
      confidence: 100,
      statusText: statusVal === 'approved' ? 'Approved' : (statusVal === 'posted_to_tally' ? 'Synced' : (statusVal === 'rejected' ? 'Rejected' : 'Ready to Post')),
      source: 'Manual Voucher Entry',
      raw: v
    };
  };

  const mapFundFlowVoucher = (v) => {
    const statusVal = (v.status || 'pending_approval').toLowerCase();
    let typeLabel = 'Payment Voucher';
    if (v.voucherType === 'bank_payment' || v.voucherType === 'receipt') typeLabel = 'Receipt Voucher';
    else if (v.voucherType === 'contra') typeLabel = 'Contra Voucher';

    return {
      id: v._id || v.id,
      voucherNumber: v.voucherNumber || 'FF-' + (v._id || v.id).slice(-4).toUpperCase(),
      date: v.voucherDate || v.createdAt || '—',
      company: v.partyLedger || v.partyLedgerName || v.destinationLedger || '—',
      type: typeLabel,
      amount: parseFloat(v.amount || v.transferAmount) || 0,
      status: statusVal === 'draft' ? 'Draft' : (statusVal === 'approved' ? 'Approved' : (statusVal === 'posted_to_tally' ? 'Posted To Tally' : (statusVal === 'rejected' ? 'Rejected' : 'Pending Approval'))),
      confidence: 100,
      statusText: statusVal === 'approved' ? 'Approved' : (statusVal === 'posted_to_tally' ? 'Synced' : (statusVal === 'rejected' ? 'Rejected' : 'Ready to Post')),
      source: 'Manual Voucher Entry',
      raw: v
    };
  };

  // Main Dynamic Data Load
  const loadAllData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Manual Entries
      const [salesRes, purchaseRes, fundflowRes] = await Promise.all([
        salesApi.list({ limit: 150 }).catch(() => ({ data: [] })),
        purchaseApi.list({ limit: 150 }).catch(() => ({ data: [] })),
        fundflowApi.list({ limit: 150 }).catch(() => ({ data: [] }))
      ]);

      const mappedSales = (salesRes.data || []).map(mapSalesVoucher);
      const mappedPurchase = (purchaseRes.data || []).map(mapPurchaseVoucher);
      const mappedFF = (fundflowRes.data || []).map(mapFundFlowVoucher);

      let manualEntries = [...mappedSales, ...mappedPurchase, ...mappedFF];
      if (manualEntries.length === 0) {
        manualEntries = defaultMockManualEntries;
      }
      // Filter out Draft status from manual entries in approval list
      manualEntries = manualEntries.filter(e => e.status !== 'Draft');

      // 2. Fetch Bulk Upload Batches
      let bulkEntries = [];
      const savedBulk = localStorage.getItem('fb_bulk_batches');
      if (savedBulk) {
        try {
          const parsed = JSON.parse(savedBulk);
          bulkEntries = parsed.map(b => {
            const batchAmount = b.records?.reduce((acc, r) => acc + (parseFloat(r.totalAmount) || 0), 0) || 0;
            const statusVal = (b.status || 'Pending Approval').toLowerCase();
            return {
              id: b.id,
              voucherNumber: b.id,
              date: b.uploadDate || '—',
              company: b.filename,
              type: 'Bulk Batch',
              amount: batchAmount,
              status: statusVal === 'approved' ? 'Approved' : (statusVal.includes('post') || statusVal.includes('sync') ? 'Posted To Tally' : (statusVal.includes('reject') || statusVal.includes('fail') ? 'Rejected' : 'Pending Approval')),
              confidence: 100,
              statusText: statusVal === 'approved' ? 'Approved' : (statusVal.includes('post') || statusVal.includes('sync') ? 'Synced' : (statusVal.includes('reject') || statusVal.includes('fail') ? 'Rejected' : 'Ready to Post')),
              source: 'Bulk Upload',
              raw: b
            };
          });
        } catch (e) {
          console.error(e);
        }
      } else {
        bulkEntries = defaultMockBulkBatches.map(b => {
          const batchAmount = b.records?.reduce((acc, r) => acc + (parseFloat(r.totalAmount) || 0), 0) || 0;
          const statusVal = (b.status || 'Pending Approval').toLowerCase();
          return {
            id: b.id,
            voucherNumber: b.id,
            date: b.uploadDate,
            company: b.filename,
            type: 'Bulk Batch',
            amount: batchAmount,
            status: statusVal === 'approved' ? 'Approved' : (statusVal.includes('post') || statusVal.includes('sync') ? 'Posted To Tally' : (statusVal.includes('reject') || statusVal.includes('fail') ? 'Rejected' : 'Pending Approval')),
            confidence: 100,
            statusText: statusVal === 'approved' ? 'Approved' : (statusVal.includes('post') || statusVal.includes('sync') ? 'Synced' : (statusVal.includes('reject') || statusVal.includes('fail') ? 'Rejected' : 'Ready to Post')),
            source: 'Bulk Upload',
            raw: b
          };
        });
      }

      // 3. Fetch OCR Upload Documents
      let ocrEntries = [];
      const savedOcr = localStorage.getItem('fb_bulk_documents');
      if (savedOcr) {
        try {
          const parsed = JSON.parse(savedOcr);
          ocrEntries = parsed.map(doc => {
            const statusVal = (doc.status || 'Pending Approval').toLowerCase();
            return {
              id: doc.id,
              voucherNumber: doc.docNo || 'OCR-' + doc.id.slice(-4).toUpperCase(),
              date: doc.docDate || doc.uploadDate || '—',
              company: doc.vendor || '—',
              type: doc.category || 'OCR Document',
              amount: parseFloat(doc.amount) || 0,
              status: statusVal === 'approved' ? 'Approved' : (statusVal.includes('post') || statusVal.includes('sync') || statusVal === 'posted' ? 'Posted To Tally' : (statusVal.includes('reject') || statusVal.includes('fail') ? 'Rejected' : 'Pending Approval')),
              confidence: doc.confidence || 95,
              statusText: statusVal === 'approved' ? 'Approved' : (statusVal.includes('post') || statusVal.includes('sync') || statusVal === 'posted' ? 'Synced' : (statusVal.includes('reject') || statusVal.includes('fail') ? 'Rejected' : 'Ready to Post')),
              source: 'OCR Upload',
              raw: doc
            };
          });
        } catch (e) {
          console.error(e);
        }
      } else {
        ocrEntries = defaultMockOcrDocs.map(doc => {
          const statusVal = (doc.status || 'Pending Approval').toLowerCase();
          return {
            id: doc.id,
            voucherNumber: doc.docNo || 'OCR-' + doc.id.slice(-4).toUpperCase(),
            date: doc.docDate || doc.uploadDate || '—',
            company: doc.vendor || '—',
            type: doc.category || 'OCR Document',
            amount: parseFloat(doc.amount) || 0,
            status: statusVal === 'approved' ? 'Approved' : (statusVal.includes('post') || statusVal.includes('sync') || statusVal === 'posted' ? 'Posted To Tally' : (statusVal.includes('reject') || statusVal.includes('fail') ? 'Rejected' : 'Pending Approval')),
            confidence: doc.confidence || 95,
            statusText: statusVal === 'approved' ? 'Approved' : (statusVal.includes('post') || statusVal.includes('sync') || statusVal === 'posted' ? 'Synced' : (statusVal.includes('reject') || statusVal.includes('fail') ? 'Rejected' : 'Ready to Post')),
            source: 'OCR Upload',
            raw: doc
          };
        });
      }

      const allMerged = [...manualEntries, ...bulkEntries, ...ocrEntries];
      setEntries(allMerged);

      // Default the selected entry if it's empty
      if (!selectedEntryId && allMerged.length > 0) {
        setSelectedEntryId(allMerged[0].id);
      }
    } catch (e) {
      console.error('Error fetching approval center entries', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const selectedEntry = entries.find(e => e.id === selectedEntryId) || null;

  // Sync state with OCR review details form
  useEffect(() => {
    if (selectedEntry && selectedEntry.source === 'OCR Upload' && selectedEntry.raw) {
      const doc = selectedEntry.raw;
      setOcrForm({
        vendor: doc.vendor || '',
        docNo: doc.docNo || '',
        docDate: doc.docDate || '',
        partyLedger: doc.partyLedger || '',
        amount: doc.amount || '',
        gstin: doc.gstin || '',
        narration: doc.narration || ''
      });
    }
  }, [selectedEntryId, entries]);

  const handleSaveOcrForm = () => {
    try {
      const savedOcr = localStorage.getItem('fb_bulk_documents');
      let docs = [];
      if (savedOcr) {
        docs = JSON.parse(savedOcr);
      } else {
        docs = defaultMockOcrDocs;
      }
      
      const updatedDocs = docs.map(doc => {
        if (doc.id === selectedEntry.id) {
          return {
            ...doc,
            vendor: ocrForm.vendor,
            docNo: ocrForm.docNo,
            docDate: ocrForm.docDate,
            partyLedger: ocrForm.partyLedger,
            amount: parseFloat(ocrForm.amount) || 0,
            gstin: ocrForm.gstin,
            narration: ocrForm.narration
          };
        }
        return doc;
      });

      localStorage.setItem('fb_bulk_documents', JSON.stringify(updatedDocs));
      toast.success('OCR document details updated successfully!');
      loadAllData();
    } catch (e) {
      console.error(e);
      toast.error('Failed to save changes');
    }
  };

  const handleToggleSelect = (id, e) => {
    e.stopPropagation();
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleApprove = async (id) => {
    const target = entries.find(e => e.id === id);
    if (!target) return;

    if (target.source === 'Manual Voucher Entry') {
      try {
        if (target.type.includes('Sales') || target.type.includes('Credit')) {
          await salesApi.updateStatus(id, 'approved', 'Approved from Approval Center');
        } else if (target.type.includes('Purchase') || target.type.includes('Debit')) {
          await purchaseApi.updateStatus(id, 'approved', 'Approved from Approval Center');
        } else {
          await fundflowApi.updateStatus(id, 'approved', 'Approved from Approval Center');
        }
        toast.success(`Voucher ${target.voucherNumber} approved successfully`);
        loadAllData();
      } catch (e) {
        console.error(e);
        toast.error('Failed to approve voucher');
      }
    } else if (target.source === 'Bulk Upload') {
      const saved = localStorage.getItem('fb_bulk_batches');
      if (saved) {
        const parsed = JSON.parse(saved);
        const updated = parsed.map(b => b.id === id ? { ...b, status: 'Approved' } : b);
        localStorage.setItem('fb_bulk_batches', JSON.stringify(updated));
      }
      toast.success(`Batch ${target.voucherNumber} approved successfully`);
      loadAllData();
    } else if (target.source === 'OCR Upload') {
      const saved = localStorage.getItem('fb_bulk_documents');
      if (saved) {
        const parsed = JSON.parse(saved);
        const updated = parsed.map(d => d.id === id ? { ...d, status: 'Approved' } : d);
        localStorage.setItem('fb_bulk_documents', JSON.stringify(updated));
      }
      toast.success(`OCR Document ${target.voucherNumber} approved successfully`);
      loadAllData();
    }
  };

  const handleReject = async (id) => {
    const target = entries.find(e => e.id === id);
    if (!target) return;

    const reason = prompt('Please enter rejection reason:');
    if (reason === null) return;

    if (target.source === 'Manual Voucher Entry') {
      try {
        if (target.type.includes('Sales') || target.type.includes('Credit')) {
          await salesApi.updateStatus(id, 'rejected', reason || 'Rejected from Approval Center');
        } else if (target.type.includes('Purchase') || target.type.includes('Debit')) {
          await purchaseApi.updateStatus(id, 'rejected', reason || 'Rejected from Approval Center');
        } else {
          await fundflowApi.updateStatus(id, 'rejected', reason || 'Rejected from Approval Center');
        }
        toast.warning(`Voucher ${target.voucherNumber} Rejected`);
        loadAllData();
      } catch (e) {
        console.error(e);
        toast.error('Failed to reject voucher');
      }
    } else if (target.source === 'Bulk Upload') {
      const saved = localStorage.getItem('fb_bulk_batches');
      if (saved) {
        const parsed = JSON.parse(saved);
        const updated = parsed.map(b => b.id === id ? { ...b, status: 'Rejected' } : b);
        localStorage.setItem('fb_bulk_batches', JSON.stringify(updated));
      }
      toast.warning(`Batch ${target.voucherNumber} Rejected`);
      loadAllData();
    } else if (target.source === 'OCR Upload') {
      const saved = localStorage.getItem('fb_bulk_documents');
      if (saved) {
        const parsed = JSON.parse(saved);
        const updated = parsed.map(d => d.id === id ? { ...d, status: 'Rejected' } : d);
        localStorage.setItem('fb_bulk_documents', JSON.stringify(updated));
      }
      toast.warning(`OCR Document ${target.voucherNumber} Rejected`);
      loadAllData();
    }
  };

  const handleSendBack = async (id) => {
    const target = entries.find(e => e.id === id);
    if (!target) return;

    if (target.source === 'Manual Voucher Entry') {
      try {
        if (target.type.includes('Sales') || target.type.includes('Credit')) {
          await salesApi.updateStatus(id, 'pending_approval', 'Sent back for rework');
        } else if (target.type.includes('Purchase') || target.type.includes('Debit')) {
          await purchaseApi.updateStatus(id, 'pending_approval', 'Sent back for rework');
        } else {
          await fundflowApi.updateStatus(id, 'pending_approval', 'Sent back for rework');
        }
        toast.info(`Sent back voucher ${target.voucherNumber} for rework.`);
        loadAllData();
      } catch (e) {
        console.error(e);
      }
    } else {
      toast.info(`Sent back ${target.voucherNumber} for rework.`);
    }
  };

  const handleSyncTally = async (id) => {
    const target = entries.find(e => e.id === id);
    if (!target) return;

    toast.promise(
      new Promise(async (resolve, reject) => {
        setTimeout(async () => {
          if (target.source === 'Manual Voucher Entry') {
            try {
              if (target.type.includes('Sales') || target.type.includes('Credit')) {
                await salesApi.updateStatus(id, 'posted_to_tally', 'Synced to Tally');
              } else if (target.type.includes('Purchase') || target.type.includes('Debit')) {
                await purchaseApi.updateStatus(id, 'posted_to_tally', 'Synced to Tally');
              } else {
                await fundflowApi.updateStatus(id, 'posted_to_tally', 'Synced to Tally');
              }
              resolve();
            } catch (e) {
              reject(e);
            }
          } else if (target.source === 'Bulk Upload') {
            const saved = localStorage.getItem('fb_bulk_batches');
            if (saved) {
              const parsed = JSON.parse(saved);
              const updated = parsed.map(b => b.id === id ? { ...b, status: 'Posted To Tally' } : b);
              localStorage.setItem('fb_bulk_batches', JSON.stringify(updated));
            }
            resolve();
          } else if (target.source === 'OCR Upload') {
            const saved = localStorage.getItem('fb_bulk_documents');
            if (saved) {
              const parsed = JSON.parse(saved);
              const updated = parsed.map(d => d.id === id ? { ...d, status: 'Posted To Tally' } : d);
              localStorage.setItem('fb_bulk_documents', JSON.stringify(updated));
            }
            resolve();
          }
        }, 1000);
      }),
      {
        loading: 'Posting XML payload to Tally Server...',
        success: () => {
          loadAllData();
          return 'Successfully synced with Tally!';
        },
        error: 'Sync failed'
      }
    );
  };

  const handleBulkApprove = () => {
    if (selectedIds.length === 0) return;
    selectedIds.forEach(id => {
      handleApprove(id);
    });
    setSelectedIds([]);
  };

  const handleBulkSyncTally = () => {
    if (selectedIds.length === 0) return;
    selectedIds.forEach(id => {
      handleSyncTally(id);
    });
    setSelectedIds([]);
  };

  // Filter and Search computed arrays
  const sourceFilteredEntries = entries.filter(e => e.source === activeSourceTab);

  const filteredEntries = sourceFilteredEntries.filter(e => {
    // Tab filter (Pending, Approved, Rejected)
    const statusVal = e.status.toLowerCase();
    if (filterTab === 'Pending' && statusVal !== 'pending_approval') return false;
    if (filterTab === 'Approved' && statusVal !== 'approved' && statusVal !== 'posted_to_tally') return false;
    if (filterTab === 'Rejected' && statusVal !== 'rejected') return false;

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

  // Detail pane shared action bar renderer - Optimized heights
  const renderDetailActionBar = (entry) => {
    const isApproved = entry.status === 'Approved' || entry.status === 'Posted To Tally';
    const isPosted = entry.status === 'Posted To Tally';

    return (
      <div className="bg-[var(--app-panel-bg)] border border-[var(--app-border)] rounded-xl p-1.5 flex items-center justify-between gap-2.5 shrink-0 shadow-md">
        <div className="flex items-center gap-1.5">
          {!isPosted && (
            <>
              <button 
                onClick={() => {
                  handleReject(entry.id);
                  setCurrentView('list');
                }}
                className="px-2.5 py-1 border border-red-200 hover:bg-red-50 text-red-500 font-extrabold rounded-lg flex items-center gap-1 text-[11px] transition-all"
              >
                <Trash2 size={12} /> Reject
              </button>
              <button 
                onClick={() => {
                  handleSendBack(entry.id);
                  setCurrentView('list');
                }}
                className="px-2.5 py-1 border border-orange-200 hover:bg-orange-50 text-orange-500 font-extrabold rounded-lg flex items-center gap-1 text-[11px] transition-all"
              >
                <ArrowLeft size={12} /> Send Back
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {!isApproved && (
            <button 
              onClick={() => {
                handleApprove(entry.id);
                setCurrentView('list');
              }}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg flex items-center gap-1 transition-all text-[11px]"
            >
              <Check size={12} /> Approve
            </button>
          )}

          {isApproved && !isPosted && (
            <button 
              onClick={() => {
                handleSyncTally(entry.id);
                setCurrentView('list');
              }}
              className="px-3 py-1 bg-[var(--app-accent)] hover:opacity-90 text-white font-extrabold rounded-lg flex items-center gap-1 transition-all text-[11px]"
            >
              <UploadCloud size={12} /> Post to Tally
            </button>
          )}

          {!isApproved && (
            <button 
              onClick={() => {
                handleApprove(entry.id);
                handleSyncTally(entry.id);
                setCurrentView('list');
              }}
              className="px-3 py-1 bg-[var(--app-accent)] hover:opacity-90 text-white font-extrabold rounded-lg flex items-center gap-1 transition-all text-[11px]"
            >
              <UploadCloud size={12} /> Approve & Push to Tally
            </button>
          )}
        </div>
      </div>
    );
  };

  // Render detail view for Manual Voucher Entry - Spacings Optimized
  const renderManualDetailView = (selectedEntry) => {
    const raw = selectedEntry.raw || {};
    const details = selectedEntry.details || {};
    const ledger = details.ledger || raw.partyLedger || raw.partyLedgerName || '—';
    const amount = selectedEntry.amount;
    const date = selectedEntry.date;
    const type = selectedEntry.type;

    const ledgerRows = [];
    if (type.includes('Sales')) {
      ledgerRows.push({ debit: true, name: ledger, amount: amount });
      const taxableVal = raw.taxableAmount || raw.grandTotal * 0.85 || amount * 0.85;
      const taxVal = amount - taxableVal;
      ledgerRows.push({ debit: false, name: 'Sales Account', amount: taxableVal });
      ledgerRows.push({ debit: false, name: (details.tax || 'IGST (18%)') + ' Output', amount: taxVal });
    } else if (type.includes('Purchase')) {
      const taxableVal = raw.taxableAmount || raw.grandTotal * 0.85 || amount * 0.85;
      const taxVal = amount - taxableVal;
      ledgerRows.push({ debit: true, name: 'Purchase Account', amount: taxableVal });
      ledgerRows.push({ debit: true, name: (details.tax || 'CGST/SGST (18%)') + ' Input', amount: taxVal });
      ledgerRows.push({ debit: false, name: ledger, amount: amount });
    } else if (type.includes('Payment')) {
      ledgerRows.push({ debit: true, name: ledger, amount: amount });
      ledgerRows.push({ debit: false, name: raw.bankLedger || raw.fromLedger || 'Cash/Bank Account', amount: amount });
    } else if (type.includes('Receipt')) {
      ledgerRows.push({ debit: true, name: raw.bankLedger || raw.toLedger || 'Cash/Bank Account', amount: amount });
      ledgerRows.push({ debit: false, name: ledger, amount: amount });
    } else {
      ledgerRows.push({ debit: true, name: raw.toLedger || 'Destination A/c', amount: amount });
      ledgerRows.push({ debit: false, name: raw.fromLedger || 'Source A/c', amount: amount });
    }

    const items = raw.productLines || raw.salesLines || raw.purchaseLines || [];
    const billAllocations = raw.billAllocations || [];

    return (
      <div className="flex flex-col h-full overflow-hidden text-[12px] text-[var(--app-heading)] bg-[#f8fafc] p-1">
        <div className="flex items-center justify-between gap-3 bg-[var(--app-panel-bg)] border border-[var(--app-border)] rounded-xl px-3 py-1 mb-1.5 shrink-0 shadow-sm">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-md font-extrabold text-[var(--app-heading)] dark:text-white leading-none tracking-tight">{selectedEntry.voucherNumber}</h2>
              <span className={`px-1.5 py-0.25 rounded border text-[9px] font-semibold bg-[var(--app-accent-soft)] text-[var(--app-accent)] border-[var(--app-border)] dark:bg-[var(--app-accent-soft)] dark:text-[var(--app-accent)] dark:border-[var(--app-border)]`}>{type}</span>
              <span className={`px-1.5 py-0.25 rounded border text-[9px] font-semibold ${statusTextColors[selectedEntry.statusText] || 'bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)]'}`}>{selectedEntry.statusText}</span>
            </div>
            <p className="text-[10px] text-[var(--app-muted)]">
              Manual Entry Voucher | Created by: <span className="font-semibold text-[var(--app-muted)]">{raw.createdBy || 'Admin'}</span> | Voucher Date: <span className="font-semibold text-[var(--app-muted)]">{date}</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => setCurrentView('list')}
              className="px-2.5 py-1 border border-[var(--app-border)] hover:bg-[var(--app-content-bg)] text-[var(--app-heading)] font-extrabold rounded-lg text-[11px] transition-all flex items-center gap-1"
            >
              <ArrowLeft size={12} /> Back to List
            </button>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-12 gap-2 min-h-0 overflow-hidden mb-1.5">
          {/* Double-entry preview */}
          <div className="col-span-12 lg:col-span-7 flex flex-col gap-1.5 min-h-0">
            <div className="bg-[var(--app-panel-bg)] border border-[var(--app-border)] rounded-xl p-2 shadow-sm flex flex-col min-h-0 flex-1 justify-between">
              <div>
                <h3 className="text-[var(--app-muted)] font-bold text-[9px] tracking-wider uppercase border-b border-[var(--app-border)] pb-0.5 mb-1 shrink-0">DOUBLE-ENTRY ACCOUNTING BREAKDOWN</h3>
                
                <div className="flex justify-between items-center text-[10.5px] shrink-0 mb-1 px-1">
                  <div>
                    <span className="text-[var(--app-muted)] font-medium">Voucher Type</span>
                    <span className="font-bold text-[var(--app-heading)] dark:text-white ml-2">{type}</span>
                  </div>
                  <span className="text-[var(--app-muted)] font-bold">{date}</span>
                </div>

                <div className="space-y-1 px-1 py-1.5 border-t border-b border-[var(--app-border)] shrink-0 text-[12px] font-mono">
                  {ledgerRows.map((row, idx) => (
                    <div key={idx} className={`flex justify-between items-center ${row.debit ? 'text-emerald-500 font-extrabold' : 'text-[var(--app-heading)] pl-4 font-semibold'}`}>
                      <span>{row.debit ? `Dr ${row.name}` : `To ${row.name}`}</span>
                      <span>₹{row.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-1 space-y-1 shrink-0">
                <div className="flex justify-between items-center font-bold px-1 text-[12px] text-[var(--app-heading)] dark:text-white">
                  <span>Total Voucher Value</span>
                  <span className="text-emerald-500 font-extrabold">₹{amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                
                {raw.narration && (
                  <div className="bg-[var(--app-content-bg)] p-2 border rounded-lg text-[var(--app-muted)] text-[11px]">
                    <span className="text-[8px] uppercase font-bold text-[var(--app-muted)] block mb-0.25">Narration / Remarks</span>
                    <span className="font-bold">{raw.narration}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Items or bill allocations */}
          <div className="col-span-12 lg:col-span-5 flex flex-col min-h-0">
            <div className="bg-[var(--app-panel-bg)] border border-[var(--app-border)] rounded-xl p-2.5 shadow-sm flex flex-col min-h-0 flex-1">
              {type.includes('Sales') || type.includes('Purchase') ? (
                <>
                  <h3 className="text-[var(--app-muted)] font-bold text-[9px] tracking-wider uppercase border-b border-[var(--app-border)] pb-0.5 mb-1 shrink-0">INVOICE ITEM BREAKDOWN</h3>
                  <div className="flex-1 overflow-auto themed-scrollbar text-[10.5px] min-h-[80px]">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-[var(--app-border)] text-[var(--app-muted)] font-bold uppercase">
                          <th className="pb-1">Stock Item</th>
                          <th className="pb-1 text-right">Qty</th>
                          <th className="pb-1 text-right">Rate</th>
                          <th className="pb-1 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.length > 0 ? (
                          items.map((it, idx) => (
                            <tr key={idx} className="border-b border-slate-50 font-semibold text-slate-705">
                              <td className="py-1">{it.stockItem || it.name || 'Stock Item'}</td>
                              <td className="py-1 text-right">{it.qty || it.quantity || 1}</td>
                              <td className="py-1 text-right">₹{(it.rate || 0).toLocaleString('en-IN')}</td>
                              <td className="py-1 text-right font-bold text-[var(--app-heading)] dark:text-white">₹{(it.amount || 0).toLocaleString('en-IN')}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="4" className="py-6 text-center text-[var(--app-muted)] font-medium">No items allocated to this voucher.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="text-[var(--app-muted)] font-bold text-[9px] tracking-wider uppercase border-b border-[var(--app-border)] pb-0.5 mb-1 shrink-0">OUTSTANDING BILL ALLOCATIONS</h3>
                  <div className="flex-1 overflow-auto themed-scrollbar text-[10.5px] min-h-[80px]">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-[var(--app-border)] text-[var(--app-muted)] font-bold uppercase">
                          <th className="pb-1">Invoice Ref</th>
                          <th className="pb-1 text-right">Invoice Date</th>
                          <th className="pb-1 text-right">Allocated Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {billAllocations.length > 0 ? (
                          billAllocations.map((alloc, idx) => (
                            <tr key={idx} className="border-b border-slate-50 font-semibold text-slate-705">
                              <td className="py-1 font-mono">{alloc.refNo || alloc.invoiceRefNo || 'Ref'}</td>
                              <td className="py-1 text-right">{alloc.date || alloc.invoiceDate || '—'}</td>
                              <td className="py-1 text-right font-bold text-[var(--app-heading)] dark:text-white">₹{(alloc.allocatedAmount || alloc.amountReceived || alloc.amountPaid || 0).toLocaleString('en-IN')}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="3" className="py-6 text-center text-[var(--app-muted)] font-medium">No outstanding bill allocations.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action bar */}
        {renderDetailActionBar(selectedEntry)}
      </div>
    );
  };

  // Render detail view for Bulk Upload batch - Optimized Spacing
  const renderBulkDetailView = (batchEntry) => {
    const batch = batchEntry.raw;
    if (!batch) return null;

    return (
      <div className="flex flex-col h-full overflow-hidden text-[12px] text-[var(--app-heading)] bg-[#f8fafc] p-1">
        <div className="flex items-center justify-between gap-3 bg-[var(--app-panel-bg)] border border-[var(--app-border)] rounded-xl px-3 py-1 mb-1.5 shrink-0 shadow-sm">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-md font-extrabold text-[var(--app-heading)] dark:text-white leading-none tracking-tight">{batch.id}</h2>
              <span className="px-1.5 py-0.25 rounded border border-[var(--app-border)] text-[var(--app-accent)] bg-[var(--app-accent-soft)] dark:bg-[var(--app-accent-soft)] dark:text-[var(--app-accent)] dark:border-[var(--app-border)] text-[9px] font-semibold">Bulk Upload</span>
              <span className={`px-1.5 py-0.25 rounded border text-[9px] font-semibold ${statusTextColors[batchEntry.statusText] || 'bg-[var(--app-content-bg)] border-[var(--app-border)] text-[var(--app-heading)]'}`}>{batchEntry.statusText}</span>
            </div>
            <p className="text-[10px] text-[var(--app-muted)]">
              Filename: <span className="font-semibold text-[var(--app-text)]">{batch.filename}</span> | Upload Date: <span className="font-semibold text-[var(--app-text)]">{batch.uploadDate}</span>
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setCurrentView('list')}
              className="px-2.5 py-1 border border-[var(--app-border)] hover:bg-[var(--app-content-bg)] text-[var(--app-heading)] font-extrabold rounded-lg text-[11px] transition-all flex items-center gap-1"
            >
              <ArrowLeft size={12} /> Back to List
            </button>
          </div>
        </div>

        {/* Spreadsheet records list */}
        <div className="flex-1 bg-[var(--app-panel-bg)] border border-[var(--app-border)] rounded-xl p-2 shadow-sm flex flex-col min-h-0">
          <h3 className="text-[var(--app-muted)] font-bold text-[9px] tracking-wider uppercase border-b border-[var(--app-border)] pb-0.5 mb-1.5 shrink-0">BATCH RECORDS SPREADSHEET VIEW ({batch.records?.length || 0} rows)</h3>
          
          <div className="flex-1 overflow-auto themed-scrollbar min-h-0">
            <table className="w-full text-left border-collapse min-w-[1000px] text-[10.5px]">
              <thead>
                <tr className="border-b border-[var(--app-border)] text-[var(--app-muted)] font-bold uppercase bg-[var(--app-content-bg)]/50 sticky top-0 z-10 select-none">
                  <th className="py-1.5 px-2">ID</th>
                  <th className="py-1.5 px-2">Date</th>
                  <th className="py-1.5 px-2">Doc No</th>
                  <th className="py-1.5 px-2">Category</th>
                  <th className="py-1.5 px-2">Party Name</th>
                  <th className="py-1.5 px-2">GSTIN</th>
                  <th className="py-1.5 px-2 text-right">Taxable Value</th>
                  <th className="py-1.5 px-2 text-right">Tax Amount</th>
                  <th className="py-1.5 px-2 text-right">Total Amount</th>
                  <th className="py-1.5 px-2 text-center">Status</th>
                  <th className="py-1.5 px-2">Validation Message</th>
                </tr>
              </thead>
              <tbody>
                {batch.records && batch.records.map((r) => (
                  <tr key={r.id} className="border-b border-[var(--app-border)] hover:bg-[var(--app-content-bg)]/50 transition-all font-semibold text-[var(--app-heading)]">
                    <td className="py-1 px-2 font-mono">{r.id}</td>
                    <td className="py-1 px-2 text-[var(--app-muted)]">{r.date}</td>
                    <td className="py-1 px-2 font-mono text-[var(--app-heading)] dark:text-white">{r.docNo}</td>
                    <td className="py-1 px-2">
                      <span className="px-1.5 py-0.25 rounded bg-[var(--app-table-head-bg)] text-[9px]">{r.category}</span>
                    </td>
                    <td className="py-1 px-2 text-[var(--app-heading)] font-bold">{r.partyName}</td>
                    <td className="py-1 px-2 font-mono">{r.gstin || '—'}</td>
                    <td className="py-1 px-2 text-right">₹{r.taxableValue.toLocaleString('en-IN')}</td>
                    <td className="py-1 px-2 text-right text-[var(--app-muted)] font-normal">₹{r.taxAmount.toLocaleString('en-IN')}</td>
                    <td className="py-1 px-2 text-right font-black text-[var(--app-heading)] dark:text-white">₹{r.totalAmount.toLocaleString('en-IN')}</td>
                    <td className="py-1 px-2 text-center">
                      <span className={`px-1 py-0.25 rounded text-[9px] font-bold ${
                        r.status === 'Valid' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400' : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="py-1 px-2 text-rose-500 text-[9.5px] leading-tight font-medium max-w-[200px] truncate" title={r.errorMessage}>{r.errorMessage || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action bar */}
        {renderDetailActionBar(batchEntry)}
      </div>
    );
  };

  // Render detail view for OCR Upload Document - Spacings Optimized
  const renderOcrDetailView = (docEntry) => {
    const doc = docEntry.raw;
    if (!doc) return null;

    return (
      <div className="flex flex-col h-full overflow-hidden text-[12px] text-[var(--app-heading)] bg-[#f8fafc] p-1">
        <div className="flex items-center justify-between gap-3 bg-[var(--app-panel-bg)] border border-[var(--app-border)] rounded-xl px-3 py-1 mb-1.5 shrink-0 shadow-sm">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-md font-extrabold text-[var(--app-heading)] dark:text-white leading-none tracking-tight">{docEntry.voucherNumber}</h2>
              <span className="px-1.5 py-0.25 rounded border border-[var(--app-border)] text-[var(--app-accent)] bg-[var(--app-accent-soft)] dark:bg-[var(--app-accent-soft)] dark:text-[var(--app-accent)] dark:border-[var(--app-border)] text-[9px] font-semibold">{docEntry.type}</span>
              <span className={`px-1.5 py-0.25 rounded border text-[9px] font-semibold ${statusTextColors[docEntry.statusText] || 'bg-[var(--app-content-bg)] border-[var(--app-border)] text-[var(--app-text)]'}`}>{docEntry.statusText}</span>
            </div>
            <p className="text-[10px] text-[var(--app-muted)]">
              OCR Processed Document | Confidence: <span className="text-emerald-500 font-extrabold">{docEntry.confidence}%</span> | Upload Date: <span className="font-semibold text-[var(--app-text)]">{docEntry.date}</span>
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setCurrentView('list')}
              className="px-2.5 py-1 border border-[var(--app-border)] hover:bg-[var(--app-content-bg)] text-[var(--app-heading)] font-extrabold rounded-lg text-[11px] transition-all flex items-center gap-1"
            >
              <ArrowLeft size={12} /> Back to List
            </button>
          </div>
        </div>

        {/* Dual pane content */}
        <div className="flex-1 grid grid-cols-12 gap-2 min-h-0 overflow-hidden mb-1.5">
          {/* Left Pane: Scan Image Preview */}
          <div className="col-span-12 lg:col-span-6 flex flex-col min-h-0">
            <div className="bg-[var(--app-panel-bg)] border border-[var(--app-border)] rounded-xl p-2 shadow-sm flex flex-col min-h-0 flex-1">
              <h3 className="text-[var(--app-muted)] font-bold text-[9px] tracking-wider uppercase border-b border-[var(--app-border)] pb-0.5 mb-1 shrink-0">DOCUMENT PREVIEW</h3>
              
              <div className="flex-1 relative bg-[var(--app-content-bg)] rounded-xl p-2 flex flex-col items-center justify-between border border-[var(--app-border)] min-h-0 overflow-hidden">
                <div className="bg-[var(--app-panel-bg)] border border-[var(--app-border)] rounded-lg shadow-sm w-full p-3 text-[9px] space-y-2 font-sans text-[var(--app-heading)] min-h-0 overflow-y-auto flex flex-col justify-between flex-1 mb-0.5 themed-scrollbar">
                  <div className="flex justify-between items-start border-b border-[var(--app-border)] pb-1.5">
                    <div>
                      <p className="font-extrabold text-[var(--app-heading)] dark:text-white text-[11.5px] leading-tight">{doc.vendor || 'Supplier Company'}</p>
                      <p className="text-[var(--app-muted)] text-[7.5px] mt-0.5 font-semibold">GSTIN: {doc.gstin || '23AAEFFG7311L1Z7'}</p>
                      <p className="text-[var(--app-muted)] text-[7.5px]">Place of Supply: Madhya Pradesh</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-[10px] text-[var(--app-accent)] leading-none uppercase tracking-wider">TAX INVOICE</p>
                      <p className="text-[var(--app-muted)] font-mono text-[7.5px] mt-0.5 font-bold">Ref: #{doc.docNo || 'INV-001'}</p>
                      <p className="text-[var(--app-muted)] font-mono text-[7.5px] font-bold">Date: {doc.docDate || '19-06-2026'}</p>
                    </div>
                  </div>
                  
                  <div className="text-[9px] py-0.5 border-b border-slate-50 pb-1.5">
                    <p className="font-bold text-[var(--app-muted)]">Bill To:</p>
                    <p className="font-extrabold text-slate-855 mt-0.25">{doc.partyLedger || 'Customer Account'}</p>
                    <p className="text-[var(--app-muted)] font-medium">Main Office Street, City, India</p>
                  </div>

                  <div className="border-t border-b border-[var(--app-border)] py-0.5 flex-1 min-h-[60px]">
                    <table className="w-full text-[8.5px]">
                      <thead>
                        <tr className="border-b border-[var(--app-border)] text-[var(--app-muted)] font-bold uppercase text-left">
                          <th className="pb-0.5">DESCRIPTION</th>
                          <th className="pb-0.5 text-right w-10">QTY</th>
                          <th className="pb-0.5 text-right w-16">RATE (₹)</th>
                          <th className="pb-0.5 text-right w-16">AMOUNT (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {doc.items && doc.items.length > 0 ? (
                          doc.items.map((it, idx) => (
                            <tr key={idx} className="font-semibold text-[var(--app-heading)] border-b border-slate-50/50">
                              <td className="py-0.5 leading-normal">{it.name || it.description}</td>
                              <td className="py-0.5 text-right">{it.qty || 1}</td>
                              <td className="py-0.5 text-right">{(it.rate || doc.amount).toLocaleString('en-IN')}</td>
                              <td className="py-0.5 text-right">{((it.qty || 1) * (it.rate || doc.amount)).toLocaleString('en-IN')}</td>
                            </tr>
                          ))
                        ) : (
                          <tr className="font-semibold text-slate-705">
                            <td className="py-1 leading-normal">{doc.narration || 'AI Extracted Voucher Details'}</td>
                            <td className="py-1 text-right">1.0</td>
                            <td className="py-1 text-right">{(doc.amount || 0).toLocaleString('en-IN')}</td>
                            <td className="py-1 text-right">{(doc.amount || 0).toLocaleString('en-IN')}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="space-y-0.5 text-right text-[8.5px] font-semibold text-[var(--app-heading)]">
                    <div className="flex justify-between pl-24">
                      <span className="text-[var(--app-muted)]">Taxable Value</span>
                      <span>₹{(doc.taxableAmount || doc.amount || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between pl-24">
                      <span className="text-[var(--app-muted)]">IGST (18%)</span>
                      <span>₹{(doc.taxAmount || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between pl-24 pt-0.5 border-t border-[var(--app-border)] text-[10px] font-extrabold text-[var(--app-heading)] dark:text-white">
                      <span>GRAND TOTAL</span>
                      <span className="text-[var(--app-accent)] dark:text-[var(--app-accent)] font-black">₹{(doc.amount || 0).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>

                {/* Floating zoom control toolbar */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-slate-900/95 border border-slate-805 px-2.5 py-0.5 rounded-md flex items-center gap-3 text-white shadow-md z-10 text-[9px]">
                  <button onClick={() => toast.success('Zoom Out')} className="hover:text-[var(--app-accent)] transition-colors"><ZoomOut size={11} /></button>
                  <button onClick={() => toast.success('Zoom In')} className="hover:text-[var(--app-accent)] transition-colors"><ZoomIn size={11} /></button>
                  <button onClick={() => toast.success('Toggle Maximize')} className="hover:text-[var(--app-accent)] transition-colors"><Maximize2 size={10} /></button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Pane: Editable Form Fields */}
          <div className="col-span-12 lg:col-span-6 flex flex-col min-h-0">
            <div className="bg-[var(--app-panel-bg)] border border-[var(--app-border)] rounded-xl p-2 shadow-sm flex flex-col min-h-0 flex-1 justify-between">
              <div className="space-y-2 overflow-y-auto pr-1 themed-scrollbar">
                <h3 className="text-[var(--app-muted)] font-bold text-[9px] tracking-wider uppercase border-b border-[var(--app-border)] pb-0.5 mb-1 shrink-0">EDIT EXTRACTED OCR DATA</h3>
                
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="col-span-2 flex flex-col gap-0.5">
                    <label className="text-[var(--app-muted)] font-bold text-[8.5px] uppercase">Supplier (Vendor)</label>
                    <input 
                      type="text" 
                      value={ocrForm.vendor}
                      onChange={(e) => setOcrForm({...ocrForm, vendor: e.target.value})}
                      className="w-full px-2 py-1 border rounded-lg outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)] transition-all font-bold text-[11px]"
                    />
                  </div>

                  <div className="flex flex-col gap-0.5">
                    <label className="text-[var(--app-muted)] font-bold text-[8.5px] uppercase">Invoice No (Doc No)</label>
                    <input 
                      type="text" 
                      value={ocrForm.docNo}
                      onChange={(e) => setOcrForm({...ocrForm, docNo: e.target.value})}
                      className="w-full px-2 py-1 border rounded-lg outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)] transition-all font-mono font-bold text-[11px]"
                    />
                  </div>

                  <div className="flex flex-col gap-0.5">
                    <label className="text-[var(--app-muted)] font-bold text-[8.5px] uppercase">Date</label>
                    <input 
                      type="text" 
                      value={ocrForm.docDate}
                      onChange={(e) => setOcrForm({...ocrForm, docDate: e.target.value})}
                      className="w-full px-2 py-1 border rounded-lg outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)] transition-all font-bold text-[11px]"
                    />
                  </div>

                  <div className="flex flex-col gap-0.5">
                    <label className="text-[var(--app-muted)] font-bold text-[8.5px] uppercase">GSTIN</label>
                    <input 
                      type="text" 
                      value={ocrForm.gstin}
                      onChange={(e) => setOcrForm({...ocrForm, gstin: e.target.value})}
                      className="w-full px-2 py-1 border rounded-lg outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)] transition-all font-mono font-bold text-[11px]"
                    />
                  </div>

                  <div className="flex flex-col gap-0.5">
                    <label className="text-[var(--app-muted)] font-bold text-[8.5px] uppercase">Total Amount</label>
                    <input 
                      type="number" 
                      value={ocrForm.amount}
                      onChange={(e) => setOcrForm({...ocrForm, amount: e.target.value})}
                      className="w-full px-2 py-1 border rounded-lg outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)] transition-all font-bold text-emerald-500 text-[11px]"
                    />
                  </div>

                  <div className="col-span-2 flex flex-col gap-0.5">
                    <label className="text-[var(--app-muted)] font-bold text-[8.5px] uppercase">Ledger Account (Party Ledger)</label>
                    <input 
                      type="text" 
                      value={ocrForm.partyLedger}
                      onChange={(e) => setOcrForm({...ocrForm, partyLedger: e.target.value})}
                      className="w-full px-2 py-1 border rounded-lg outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)] transition-all font-bold text-[var(--app-accent)] text-[11px]"
                    />
                  </div>

                  <div className="col-span-2 flex flex-col gap-0.5">
                    <label className="text-[var(--app-muted)] font-bold text-[8.5px] uppercase">Narration</label>
                    <textarea 
                      value={ocrForm.narration}
                      onChange={(e) => setOcrForm({...ocrForm, narration: e.target.value})}
                      className="w-full h-12 px-2 py-1 border rounded-lg outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)] transition-all font-bold text-[11px]"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-[var(--app-border)] pt-1.5 mt-1.5 flex justify-end">
                <button 
                  onClick={handleSaveOcrForm}
                  className="px-3 py-1 bg-[var(--app-accent)] hover:opacity-90 text-white font-extrabold rounded-lg flex items-center gap-1 text-[11px] transition-all shadow-sm"
                >
                  <Sparkles size={12} /> Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Action bar */}
        {renderDetailActionBar(docEntry)}
      </div>
    );
  };

  // Selector for specialized page view inside Approval Center
  const renderDetailPage = () => {
    if (!selectedEntry) return null;
    
    if (selectedEntry.source === 'Manual Voucher Entry') {
      return renderManualDetailView(selectedEntry);
    } else if (selectedEntry.source === 'Bulk Upload') {
      return renderBulkDetailView(selectedEntry);
    } else if (selectedEntry.source === 'OCR Upload') {
      return renderOcrDetailView(selectedEntry);
    }
    return null;
  };

  const renderListView = () => {
    const SOURCE_TABS = [
      { id: 'Manual Voucher Entry', label: 'Manual Entry', icon: FileText, section: 'MANUAL' },
      { id: 'Bulk Upload', label: 'Bulk Batches', icon: Layers, section: 'BULK' },
      { id: 'OCR Upload', label: 'AI OCR Docs', icon: Sparkles, section: 'OCR' },
    ];
    const lc = (s) => (s || '').toLowerCase();
    const FILTERS = [
      { key: 'Total', label: 'Total', count: sourceFilteredEntries.length, tone: 'var(--app-accent)' },
      { key: 'Pending', label: 'Pending', count: sourceFilteredEntries.filter((e) => lc(e.status) === 'pending_approval' || lc(e.statusText).includes('pending')).length, tone: '#F59E0B' },
      { key: 'Approved', label: 'Approved', count: sourceFilteredEntries.filter((e) => ['approved', 'posted_to_tally'].includes(lc(e.status))).length, tone: '#10B981' },
      { key: 'Rejected', label: 'Rejected', count: sourceFilteredEntries.filter((e) => lc(e.status) === 'rejected').length, tone: '#EF4444' },
    ];
    const filterChips = (
      <div className="flex items-center gap-1">
        {FILTERS.map((f) => {
          const on = filterTab === f.key;
          return (
            <button key={f.key} onClick={() => { setFilterTab(f.key); setPage(1); }}
              className="px-2.5 h-9 rounded-lg text-[11px] font-bold border transition-colors inline-flex items-center gap-1.5"
              style={on ? { backgroundColor: f.tone, color: '#fff', borderColor: 'transparent' } : { backgroundColor: 'var(--app-control-bg)', color: 'var(--app-heading)', borderColor: 'var(--app-border)' }}>
              <span>{f.label}</span><span className="tabular-nums opacity-80">{f.count}</span>
            </button>
          );
        })}
      </div>
    );
    const bulkActions = selectedIds.length > 0 ? (
      <div className="flex items-center gap-2 rounded-lg border px-2.5 h-9" style={{ borderColor: 'var(--app-accent)', backgroundColor: 'var(--app-accent-soft)' }}>
        <span className="text-[10.5px] font-bold" style={{ color: 'var(--app-accent)' }}>{selectedIds.length} selected</span>
        <button onClick={handleBulkApprove} className="text-[10.5px] font-extrabold uppercase text-emerald-600 hover:text-emerald-500">Approve</button>
        <button onClick={handleBulkSyncTally} className="text-[10.5px] font-extrabold uppercase" style={{ color: 'var(--app-accent)' }}>Push</button>
        <button onClick={() => { selectedIds.forEach((id) => handleReject(id)); setSelectedIds([]); }} className="text-[10.5px] font-extrabold uppercase text-rose-500 hover:text-rose-400">Reject</button>
        <button onClick={() => setSelectedIds([])} className="text-[10.5px] font-semibold" style={{ color: 'var(--app-muted)' }}>Clear</button>
      </div>
    ) : null;
    const Act = ({ icon: Icon, onClick, title, cls }) => (
      <button onClick={onClick} title={title} className={`p-1 rounded-lg transition-all hover:scale-110 active:scale-95 text-[var(--app-muted)] hover:bg-[var(--app-control-hover)] ${cls}`}><Icon size={13} /></button>
    );
    const columns = [
      { key: 'voucherNumber', header: activeSourceTab === 'Bulk Upload' ? 'Batch ID' : 'Voucher No', sortable: true, render: (e) => <span className="font-black" style={{ color: 'var(--app-heading)' }}>{e.voucherNumber}</span> },
      { key: 'date', header: 'Date', sortable: true, render: (e) => <span className="font-semibold" style={{ color: 'var(--app-muted)' }}>{e.date}</span> },
      { key: 'company', header: activeSourceTab === 'Bulk Upload' ? 'Filename' : 'Company / Party', sortable: true, render: (e) => <span className="font-bold truncate block max-w-[180px]" title={e.company}>{e.company}</span> },
      { key: 'type', header: 'Type', render: (e) => <Badge tone="accent">{e.type}</Badge> },
      { key: 'amount', header: 'Amount', align: 'right', sortable: true, sortValue: (e) => e.amount, render: (e) => <span className="font-black" style={{ color: 'var(--app-heading)' }}>₹{e.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span> },
      { key: 'confidence', header: 'Confidence', align: 'center', sortable: true, sortValue: (e) => e.confidence, render: (e) => <Badge tone={e.confidence >= 95 ? 'success' : 'warning'}>{e.confidence}%</Badge> },
      { key: 'status', header: 'Status', align: 'center', render: (e) => <Badge tone={statusTone(e.statusText || e.status)}>{e.statusText}</Badge> },
      { key: 'file', header: 'File', render: (e) => <button onClick={() => { setSelectedEntryId(e.id); setCurrentView('detail'); }} className="flex items-center gap-1 font-mono text-[10.5px] hover:underline" style={{ color: 'var(--app-accent)' }}><FileText size={11} /> {e.raw?.filename || e.raw?.details?.attachments || 'document.pdf'}</button> },
      {
        key: 'actions', header: 'Actions', align: 'center', width: '130px', render: (e) => (
          <div className="flex items-center justify-center gap-1">
            <Act icon={Eye} title="Review" cls="hover:text-[var(--app-accent)]" onClick={() => { setSelectedEntryId(e.id); setCurrentView('detail'); }} />
            {e.status === 'Pending Approval' && (<>
              <Act icon={CheckCircle2} title="Approve" cls="hover:text-emerald-500" onClick={() => handleApprove(e.id)} />
              <Act icon={Send} title="Push to Tally" cls="hover:text-[var(--app-accent)]" onClick={() => handleSyncTally(e.id)} />
              <Act icon={XCircle} title="Reject" cls="hover:text-rose-500" onClick={() => handleReject(e.id)} />
            </>)}
            {e.status === 'Approved' && <Act icon={Send} title="Push to Tally" cls="hover:text-[var(--app-accent)]" onClick={() => handleSyncTally(e.id)} />}
          </div>
        ),
      },
    ];

    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex items-center gap-1.5 overflow-x-auto themed-scrollbar pb-2 mb-2.5 shrink-0">
          {SOURCE_TABS.map((tab) => {
            const sel = activeSourceTab === tab.id;
            return (
              <motion.button key={tab.id} whileTap={{ scale: 0.98 }}
                onClick={() => { setActiveSourceTab(tab.id); setPage(1); setSelectedIds([]); const f = entries.find((e) => e.source === tab.id); if (f) setSelectedEntryId(f.id); }}
                className="relative flex items-center gap-2 px-3 py-2 rounded-xl border shrink-0 transition-colors"
                style={{ borderColor: sel ? 'var(--app-accent)' : 'var(--app-border)', backgroundColor: sel ? 'var(--app-accent-soft)' : 'var(--app-control-bg)', color: sel ? 'var(--app-accent)' : 'var(--app-text)' }}>
                <span className="h-6 w-6 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: sel ? 'var(--app-accent)' : 'var(--app-control-hover)', color: sel ? '#fff' : 'var(--app-muted)' }}><tab.icon size={12} strokeWidth={2.4} /></span>
                <span className="text-left leading-tight">
                  <span className="block text-[7.5px] font-extrabold uppercase tracking-wider opacity-70">{tab.section}</span>
                  <span className="block text-[11.5px] font-bold">{tab.label}</span>
                </span>
              </motion.button>
            );
          })}
        </div>

        <div className="flex-1 overflow-hidden">
          <DataTable
            title="Approval Center"
            description="Review and post AI-processed document vouchers to Tally"
            icon={CheckCircle2}
            columns={columns}
            data={filteredEntries}
            rowKey={(e) => e.id}
            loading={loading}
            emptyText="No vouchers found under this source filter."
            minWidth="1040px"
            selectable
            selectedKeys={selectedIds}
            onToggleRow={(id) => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))}
            onToggleAll={(c) => handleSelectAll(c)}
            search={{ value: searchQuery, onChange: (v) => { setSearchQuery(v); setPage(1); }, placeholder: 'Search vouchers…' }}
            filters={filterChips}
            actions={bulkActions}
            pagination={{ page: 1, total: filteredEntries.length, label: `${filteredEntries.length} entr${filteredEntries.length === 1 ? 'y' : 'ies'}`, onPrev: () => {}, onNext: () => {}, disableNext: true }}
          />
        </div>
      </div>
    );
  };

  // eslint-disable-next-line no-unused-vars
  const _legacyListView = () => {
    return (
      <div className="flex flex-col h-full overflow-hidden text-[12.5px] text-[var(--app-heading)] bg-[#f8fafc] p-1.5">
        
        {/* Title Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-1.5 shrink-0 gap-1.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[var(--app-accent-soft)] dark:bg-[var(--app-accent-soft)] text-[var(--app-accent)] dark:text-[var(--app-accent)]">
              <CheckCircle2 size={16} />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-[var(--app-heading)] dark:text-[var(--app-heading)] leading-none">Approval Center</h1>
              <p className="text-[10px] text-[var(--app-muted)] mt-0.5">
                Review and post AI-processed document vouchers to Tally
              </p>
            </div>
          </div>
        </div>

        {/* ─── PRIMARY SOURCE TABS (TallyHub Style) ─── */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5 mb-1.5 shrink-0">
          {[
            { id: 'Manual Voucher Entry', label: 'Manual Entry Vouchers', icon: FileText, section: 'MANUAL' },
            { id: 'Bulk Upload', label: 'Bulk Batch Vouchers', icon: Layers, section: 'BULK' },
            { id: 'OCR Upload', label: 'AI OCR Document Vouchers', icon: Sparkles, section: 'OCR' }
          ].map(tab => {
            const isSelected = activeSourceTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveSourceTab(tab.id);
                  setPage(1);
                  setSelectedIds([]);
                  const firstOfTab = entries.find(e => e.source === tab.id);
                  if (firstOfTab) {
                    setSelectedEntryId(firstOfTab.id);
                  }
                }}
                className={`flex items-center gap-2 px-3 py-1 rounded-lg border text-left min-w-[150px] shrink-0 transition-all duration-200 ${
                  isSelected
                    ? 'bg-[var(--app-accent-soft)] dark:bg-[var(--app-accent-soft)] border-[var(--app-accent)] text-[var(--app-accent)] dark:text-[var(--app-accent)] shadow-sm font-extrabold scale-[1.01]'
                    : 'bg-[var(--app-panel-bg)] hover:bg-[var(--app-content-bg)] border-[var(--app-border)] text-[var(--app-muted)] hover:text-[var(--app-heading)] dark:hover:text-white shadow-sm font-semibold'
                }`}
              >
                <div className={`p-1 rounded-md ${isSelected ? 'bg-[var(--app-accent-soft)] text-[var(--app-accent)] dark:text-[var(--app-accent)]' : 'bg-[var(--app-border)]/50 text-[var(--app-muted)]'}`}>
                  <tab.icon size={12} />
                </div>
                <div className="space-y-0">
                  <span className="text-[7.5px] block font-extrabold tracking-wider opacity-70 uppercase leading-none">{tab.section}</span>
                  <span className="text-[11px] block font-extrabold leading-none">{tab.label}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Main Table Card */}
        <div className="flex-1 flex flex-col bg-[var(--app-panel-bg)] border border-[var(--app-border)] rounded-xl overflow-hidden shadow-sm min-h-0">
          
          {/* Table Controls */}
          <div className="p-1.5 border-b border-[var(--app-border)] shrink-0 flex flex-wrap items-center justify-between gap-2 bg-[var(--app-content-bg)]/50">
            
            {/* Left: Filter Tabs */}
            <div className="flex items-center gap-1">
              <button 
                onClick={() => { setFilterTab('Total'); setPage(1); }} 
                className={`px-2 py-1 rounded-md text-center transition-all text-[11px] font-extrabold ${filterTab === 'Total' ? 'bg-[var(--app-accent)] text-white shadow-sm' : 'bg-[var(--app-panel-bg)] hover:bg-[var(--app-content-bg)] text-[var(--app-heading)] border border-[var(--app-border)]'}`}
              >
                {sourceFilteredEntries.length} Total
              </button>
              <button 
                onClick={() => { setFilterTab('Pending'); setPage(1); }} 
                className={`px-2 py-1 rounded-md text-center transition-all text-[11px] font-extrabold ${filterTab === 'Pending' ? 'bg-amber-500 text-white shadow-sm' : 'bg-[var(--app-panel-bg)] hover:bg-[var(--app-content-bg)] text-[var(--app-heading)] border border-[var(--app-border)]'}`}
              >
                {sourceFilteredEntries.filter(e => e.status.toLowerCase() === 'pending_approval').length} Pending
              </button>
              <button 
                onClick={() => { setFilterTab('Approved'); setPage(1); }} 
                className={`px-2 py-1 rounded-md text-center transition-all text-[11px] font-extrabold ${filterTab === 'Approved' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-[var(--app-panel-bg)] hover:bg-[var(--app-content-bg)] text-[var(--app-heading)] border border-[var(--app-border)]'}`}
              >
                {sourceFilteredEntries.filter(e => e.status.toLowerCase() === 'approved' || e.status.toLowerCase() === 'posted_to_tally').length} Approved
              </button>
              <button 
                onClick={() => { setFilterTab('Rejected'); setPage(1); }} 
                className={`px-2 py-1 rounded-md text-center transition-all text-[11px] font-extrabold ${filterTab === 'Rejected' ? 'bg-rose-600 text-white shadow-sm' : 'bg-[var(--app-panel-bg)] hover:bg-[var(--app-content-bg)] text-[var(--app-heading)] border border-[var(--app-border)]'}`}
              >
                {sourceFilteredEntries.filter(e => e.status.toLowerCase() === 'rejected').length} Rejected
              </button>
            </div>

            {/* Right: Search & Bulk Actions */}
            <div className="flex items-center gap-2">
              {selectedIds.length > 0 && (
                <div className="flex items-center gap-1 bg-[var(--app-accent-soft)] dark:bg-[var(--app-accent-soft)] border border-blue-105 dark:border-[var(--app-border)] px-2 py-0.5 rounded-lg">
                  <span className="text-[10.5px] font-bold text-[var(--app-accent)] dark:text-[var(--app-accent)]">
                    {selectedIds.length} Selected
                  </span>
                  <span className="text-[var(--app-muted)]">|</span>
                  <button 
                    onClick={handleBulkApprove}
                    className="text-[10.5px] font-extrabold text-emerald-500 hover:text-emerald-700 dark:text-emerald-400 uppercase tracking-wider transition-all"
                  >
                    Approve
                  </button>
                  <span className="text-[var(--app-muted)]">•</span>
                  <button 
                    onClick={handleBulkSyncTally}
                    className="text-[10.5px] font-extrabold text-[var(--app-accent)] hover:text-[var(--app-accent)] dark:text-[var(--app-accent)] uppercase tracking-wider transition-all"
                  >
                    Push Tally
                  </button>
                  <span className="text-[var(--app-muted)]">•</span>
                  <button 
                    onClick={() => {
                      selectedIds.forEach(id => handleReject(id));
                      setSelectedIds([]);
                    }}
                    className="text-[10.5px] font-extrabold text-rose-500 hover:text-rose-700 dark:text-rose-400 uppercase tracking-wider transition-all"
                  >
                    Reject
                  </button>
                  <span className="text-[var(--app-muted)]">•</span>
                  <button 
                    onClick={() => setSelectedIds([])}
                    className="text-[10.5px] font-semibold text-[var(--app-muted)] hover:text-[var(--app-heading)] dark:hover:text-white transition-colors"
                  >
                    Clear
                  </button>
                </div>
              )}

              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--app-muted)]" size={12} />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                  className="w-40 sm:w-48 h-7 pl-6 pr-2 rounded-lg border text-[11px] outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)] transition-all"
                />
              </div>
            </div>
          </div>

          {/* The Table - High density cell sizes */}
          <div className="flex-1 overflow-auto themed-scrollbar">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--app-accent)]"></div>
              </div>
            ) : (
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="border-b border-[var(--app-border)] text-[var(--app-muted)] font-bold uppercase text-[10px] bg-[var(--app-content-bg)]/30 sticky top-0 backdrop-blur-sm z-10 select-none">
                    <th className="py-1.5 px-3 w-10">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="w-3 h-3 accent-[var(--app-accent)] rounded cursor-pointer"
                      />
                    </th>
                    <th className="py-1.5 px-3">
                      {activeSourceTab === 'Bulk Upload' ? 'Batch ID' : 'Voucher No'}
                    </th>
                    <th className="py-1.5 px-3">Date</th>
                    <th className="py-1.5 px-3">
                      {activeSourceTab === 'Bulk Upload' ? 'Filename' : 'Company / Party'}
                    </th>
                    <th className="py-1.5 px-3">Type</th>
                    <th className="py-1.5 px-3 text-right">Amount</th>
                    <th className="py-1.5 px-3 text-center">Confidence</th>
                    <th className="py-1.5 px-3">Status</th>
                    <th className="py-1.5 px-3">File Link</th>
                    <th className="py-1.5 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.length > 0 ? (
                    filteredEntries.map((entry) => {
                      const isSelected = selectedIds.includes(entry.id);
                      
                      const typeColors = {
                        'Sales Voucher': 'bg-[var(--app-accent-soft)] text-[var(--app-accent)] border-[var(--app-border)] dark:bg-[var(--app-accent-soft)] dark:text-[var(--app-accent)] dark:border-[var(--app-border)]',
                        'Purchase Voucher': 'bg-[var(--app-accent-soft)] text-[var(--app-accent)] border-[var(--app-border)] dark:bg-[var(--app-accent-soft)] dark:text-[var(--app-accent)] dark:border-[var(--app-border)]',
                        'Payment Voucher': 'bg-[var(--app-accent-soft)] text-[var(--app-accent)] border-[var(--app-border)] dark:bg-[var(--app-accent-soft)] dark:text-[var(--app-accent)] dark:border-[var(--app-border)]',
                        'Contra Voucher': 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40',
                        'Debit Note': 'bg-amber-50 text-amber-700 border-amber-250 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/40',
                        'Credit Note': 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-900/20 dark:text-pink-400 dark:border-pink-900/40',
                        'Bulk Batch': 'bg-[var(--app-accent-soft)] text-[var(--app-accent)] border-blue-150'
                      }[entry.type] || 'bg-[var(--app-table-head-bg)] text-[var(--app-heading)] border-[var(--app-border)]';

                      const rowStatusColors = statusTextColors[entry.statusText] || 'bg-[var(--app-content-bg)] text-slate-705 border-[var(--app-border)]';

                      return (
                        <tr 
                          key={entry.id}
                          className={`border-b border-[var(--app-border)] hover:bg-[var(--app-content-bg)]/50 transition-all font-semibold ${isSelected ? 'bg-[var(--app-accent-soft)] dark:bg-[var(--app-accent-soft)]' : ''}`}
                        >
                          <td className="py-1.5 px-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => handleToggleSelect(entry.id, e)}
                              className="w-3 h-3 accent-[var(--app-accent)] rounded cursor-pointer"
                            />
                          </td>
                          <td className="py-1.5 px-3 font-extrabold text-[var(--app-heading)]">{entry.voucherNumber}</td>
                          <td className="py-1.5 px-3 text-[var(--app-muted)] font-semibold">{entry.date}</td>
                          <td className="py-1.5 px-3 text-slate-805 font-bold max-w-[180px] truncate" title={entry.company}>{entry.company}</td>
                          <td className="py-1.5 px-3">
                            <span className={`px-1.5 py-0.25 rounded-md border text-[8.5px] font-bold ${typeColors}`}>{entry.type}</span>
                          </td>
                          <td className="py-1.5 px-3 text-right font-black text-[var(--app-heading)] dark:text-white text-[12px]">₹{entry.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          <td className="py-1.5 px-3 text-center">
                            <span className={`px-1.5 py-0.25 rounded font-black text-[9.5px] ${entry.confidence >= 95 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400' : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'}`}>
                              {entry.confidence}%
                            </span>
                          </td>
                          <td className="py-1.5 px-3">
                            <span className={`px-1.5 py-0.25 rounded-md border text-[8.5px] font-extrabold ${rowStatusColors}`}>{entry.statusText}</span>
                          </td>
                          <td className="py-1.5 px-3 text-[var(--app-accent)] dark:text-[var(--app-accent)] font-mono text-[10.5px] select-none hover:underline cursor-pointer" onClick={() => { setSelectedEntryId(entry.id); setCurrentView('detail'); }}>
                            <span className="flex items-center gap-1">
                              <FileText size={11} /> {entry.raw?.filename || entry.raw?.details?.attachments || 'document.pdf'}
                            </span>
                          </td>
                          <td className="py-1.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button 
                                onClick={() => { setSelectedEntryId(entry.id); setCurrentView('detail'); }}
                                className="p-1 hover:bg-[var(--app-table-head-bg)] rounded text-[var(--app-muted)] hover:text-[var(--app-heading)] dark:hover:text-white transition-colors"
                                title="Open Document Review"
                              >
                                <Eye size={13} />
                              </button>
                              {entry.status === 'Pending Approval' && (
                                <>
                                  <button 
                                    onClick={() => handleApprove(entry.id)}
                                    className="p-1 hover:bg-emerald-50 dark:hover:bg-emerald-955/30 rounded text-emerald-500 transition-colors"
                                    title="Approve"
                                  >
                                    <CheckCircle2 size={13} />
                                  </button>
                                  <button 
                                    onClick={() => handleSyncTally(entry.id)}
                                    className="p-1 hover:bg-[var(--app-accent-soft)] dark:hover:bg-[var(--app-accent-soft)] rounded text-[var(--app-accent)] transition-colors"
                                    title="Push to Tally"
                                  >
                                    <Send size={13} />
                                  </button>
                                  <button 
                                    onClick={() => handleReject(entry.id)}
                                    className="p-1 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded text-rose-500 transition-colors"
                                    title="Reject"
                                  >
                                    <XCircle size={13} />
                                  </button>
                                </>
                              )}
                              {entry.status === 'Approved' && (
                                <button 
                                  onClick={() => handleSyncTally(entry.id)}
                                  className="p-1 hover:bg-[var(--app-accent-soft)] dark:hover:bg-[var(--app-accent-soft)] rounded text-[var(--app-accent)] transition-colors"
                                  title="Push to Tally"
                                >
                                  <Send size={13} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="10" className="py-10 text-center"><div className="flex flex-col items-center gap-2"><ObjectDoodle name="approve" className="w-28 h-20" /><span className="text-[var(--app-muted)] font-semibold text-[11.5px]">No vouchers found under this source filter.</span></div></td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Table Footer / Pagination */}
          <div className="p-1.5 border-t border-[var(--app-border)] flex items-center justify-between text-[10.5px] font-semibold text-[var(--app-muted)] shrink-0 bg-[var(--app-content-bg)]/50">
            <span>Showing 1 to {filteredEntries.length} of {filteredEntries.length} entries</span>
            <div className="flex items-center gap-1">
              <button disabled className="px-2 py-0.5 rounded border bg-[var(--app-panel-bg)] text-[var(--app-muted)] flex items-center justify-center font-bold text-[9.5px]">PREVIOUS</button>
              <button className="w-5 h-5 rounded bg-[var(--app-accent)] text-white flex items-center justify-center font-bold text-[10px]">1</button>
              <button disabled className="px-2 py-0.5 rounded border bg-[var(--app-panel-bg)] text-[var(--app-muted)] flex items-center justify-center font-bold text-[9.5px]">NEXT</button>
            </div>
          </div>

        </div>

      </div>
    );
  };

  return currentView === 'detail' ? renderDetailPage() : renderListView();
}
