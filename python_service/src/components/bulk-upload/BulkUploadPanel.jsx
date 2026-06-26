import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  UploadCloud, FileText, CheckCircle2, AlertCircle, Trash2, Send,
  FileSpreadsheet, Image, ChevronRight, ChevronLeft, RefreshCw, Check,
  Search, Filter, Info, Eye, Edit2, MoreVertical, Plus, X, FolderOpen, Scan,
  SlidersHorizontal, Download, LayoutList, Grid, Database, Calendar, ArrowLeft,
  Settings, CheckCircle, ShieldAlert, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

export default function BulkUploadPanel() {
  const navigate = useNavigate();
  const location = useLocation();

  // --- States ---
  const [selectedBatchId, setSelectedBatchId] = useState(() => {
    return location.state?.selectedBatchId || null;
  });
  const [search, setSearch] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [vendorFilter, setVendorFilter] = useState('All Vendors/Customers');
  const [dateRange, setDateRange] = useState('');

  useEffect(() => {
    if (location.state?.selectedBatchId) {
      setSelectedBatchId(location.state.selectedBatchId);
      // Clear location state
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);

  // Table Selection & Pagination
  const [checkedBatchIds, setCheckedBatchIds] = useState([]);
  const [checkedRecordIds, setCheckedRecordIds] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Cell editing state
  const [editingCell, setEditingCell] = useState(null); // { recordId, columnKey }

  const fileInputRef = useRef(null);

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

  // --- Default Mock Batches ---
  const defaultBatches = [
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
      status: 'Posted',
      records: [
        { id: 1, date: '2026-06-20', docNo: 'TXN-87612', category: 'Payment', partyName: 'ABC Traders', gstin: '22AAAAA1111A1Z5', taxableValue: 10000, taxAmount: 0, totalAmount: 10000, status: 'Valid', errorMessage: '' },
        { id: 2, date: '2026-06-20', docNo: 'TXN-90817', category: 'Receipt', partyName: 'LMN Industries', gstin: '22CCCCC3333C3Z7', taxableValue: 8500, taxAmount: 0, totalAmount: 8500, status: 'Valid', errorMessage: '' },
        { id: 3, date: '2026-06-19', docNo: 'TXN-11002', category: 'Contra', partyName: 'Cash A/c', gstin: '', taxableValue: 12000, taxAmount: 0, totalAmount: 12000, status: 'Valid', errorMessage: '' },
        { id: 4, date: '2026-06-18', docNo: 'TXN-09880', category: 'Payment', partyName: 'LMN Industries', gstin: '22CCCCC3333C3Z7', taxableValue: 7200, taxAmount: 0, totalAmount: 7200, status: 'Valid', errorMessage: '' },
        { id: 5, date: '2026-06-18', docNo: 'TXN-90114', category: 'Receipt', partyName: 'ABC Traders', gstin: '22AAAAA1111A1Z5', taxableValue: 19500, taxAmount: 0, totalAmount: 19500, status: 'Valid', errorMessage: '' }
      ]
    },
    {
      id: 'BATCH-004',
      filename: 'Debit_Notes_Q1.xlsx',
      totalRecords: 3,
      uploadDate: '20-06-2026 05:40 PM',
      status: 'Failed',
      records: [
        { id: 1, date: '2026-06-18', docNo: 'DN-001', category: 'Debit Note', partyName: 'ABC Traders', gstin: '22AAAAA1111A1Z5', taxableValue: 1250, taxAmount: 0, totalAmount: 1250, status: 'Valid', errorMessage: '' },
        { id: 2, date: '2026-06-17', docNo: 'DN-002', category: 'Debit Note', partyName: 'XYZ Enterprises', gstin: '22BBBBB2222B2Z6', taxableValue: 2500, taxAmount: 450, totalAmount: 2950, status: 'Invalid', errorMessage: 'Original reference invoice not found' },
        { id: 3, date: '2026-06-16', docNo: 'DN-003', category: 'Debit Note', partyName: 'PQR Solutions', gstin: '22CCCCC3333C3Z7', taxableValue: 5000, taxAmount: 900, totalAmount: 5900, status: 'Valid', errorMessage: '' }
      ]
    }
  ];

  // --- Load and Sync Batches State ---
  const [batches, setBatches] = useState(() => {
    const saved = localStorage.getItem('fb_bulk_batches');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error loading batches from local storage', e);
      }
    }
    return defaultBatches;
  });

  // Open Batch Review: resets all filters to avoid hiding data!
  const openBatchReview = (batchId) => {
    setSelectedBatchId(batchId);
    setSearch('');
    setStatusFilter('All Status');
    setVendorFilter('All Vendors/Customers');
    setDateRange('');
    setActiveCategory('All');
    setCurrentPage(1);
    setCheckedRecordIds([]);
  };

  const activeBatch = useMemo(() => {
    return batches.find(b => b.id === selectedBatchId) || null;
  }, [batches, selectedBatchId]);

  // --- CSV Parser Helper ---
  const parseCSV = (text) => {
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) return null;

    const parseLine = (line) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const rawHeaders = parseLine(lines[0]);
    const headers = rawHeaders.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseLine(lines[i]);
      const row = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] !== undefined ? values[idx] : '';
      });
      rows.push(row);
    }
    return { headers, rows };
  };

  const mapCSVRowToRecord = (row, index) => {
    // Make key search case-insensitive for both Excel JSON and CSV rows
    const dateKey = Object.keys(row).find(k => k.toLowerCase().includes('date'));
    const docNoKey = Object.keys(row).find(k => {
      const kl = k.toLowerCase();
      return kl.includes('docno') || kl.includes('invoiceno') || kl.includes('voucherno') || kl.includes('number') || kl.includes('ref');
    });
    const categoryKey = Object.keys(row).find(k => {
      const kl = k.toLowerCase();
      return kl.includes('category') || kl.includes('vouchertype') || kl.includes('type');
    });
    const partyKey = Object.keys(row).find(k => {
      const kl = k.toLowerCase();
      return kl.includes('party') || kl.includes('customer') || kl.includes('vendor') || kl.includes('ledger') || kl.includes('name');
    });
    const gstinKey = Object.keys(row).find(k => {
      const kl = k.toLowerCase();
      return kl.includes('gstin') || kl.includes('gst') || kl.includes('gstno');
    });
    const taxableKey = Object.keys(row).find(k => {
      const kl = k.toLowerCase();
      return kl.includes('taxable') || kl.includes('value') || kl.includes('rate') || kl.includes('subtotal');
    });
    const taxKey = Object.keys(row).find(k => {
      const kl = k.toLowerCase();
      return kl.includes('tax') || kl.includes('gstamount') || kl.includes('cgst') || kl.includes('sgst') || kl.includes('igst');
    });
    const totalKey = Object.keys(row).find(k => {
      const kl = k.toLowerCase();
      return kl.includes('total') || kl.includes('amount') || kl.includes('net');
    });

    const date = dateKey ? String(row[dateKey]).trim() : new Date().toISOString().split('T')[0];
    const docNo = docNoKey ? String(row[docNoKey]).trim() : `INV-${Math.floor(1000 + Math.random() * 9000)}`;
    const category = categoryKey ? String(row[categoryKey]).trim() : 'Sales Invoice';
    const partyName = partyKey ? String(row[partyKey]).trim() : 'ABC Traders';
    const gstin = gstinKey ? String(row[gstinKey]).trim() : '';
    
    // Safely parse numbers from Excel cell values (could be direct floats or formatted strings)
    const taxableValue = parseFloat(taxableKey ? String(row[taxableKey]).replace(/[^0-9.]/g, '') : 0) || 0;
    const taxAmount = parseFloat(taxKey ? String(row[taxKey]).replace(/[^0-9.]/g, '') : 0) || 0;
    const totalAmount = parseFloat(totalKey ? String(row[totalKey]).replace(/[^0-9.]/g, '') : 0) || (taxableValue + taxAmount);

    let record = {
      id: index + 1,
      date,
      docNo,
      category,
      partyName,
      gstin,
      taxableValue,
      taxAmount,
      totalAmount,
      status: 'Valid',
      errorMessage: ''
    };

    return validateRecord(record);
  };

  const validateRecord = (record) => {
    let status = 'Valid';
    let errorMessage = '';

    const date = record.date ? String(record.date).trim() : '';
    const docNo = record.docNo ? String(record.docNo).trim() : '';
    const partyName = record.partyName ? String(record.partyName).trim() : '';
    const gstin = record.gstin ? String(record.gstin).trim() : '';

    if (!date) {
      status = 'Invalid';
      errorMessage = 'Date is required';
    } else if (!docNo) {
      status = 'Invalid';
      errorMessage = 'Document No is required';
    } else if (!partyName) {
      status = 'Invalid';
      errorMessage = 'Party Name is required';
    } else if (!gstin && ['Sales Invoice', 'Purchase Invoice', 'Credit Note', 'Debit Note'].includes(record.category)) {
      status = 'Warning';
      errorMessage = 'GSTIN is empty for business customer';
    } else if (gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin)) {
      status = 'Warning';
      errorMessage = 'GSTIN format is invalid';
    }

    return { ...record, status, errorMessage };
  };

  // --- Dynamic Mock Data Generator for Excel Mocks ---
  const generateMockRecords = (filename, count = 10) => {
    const categories = ['Sales Invoice', 'Purchase Invoice', 'Payment', 'Receipt', 'Contra', 'Credit Note', 'Debit Note', 'Bank Statement'];
    let defaultCategory = 'Sales Invoice';
    const lowerName = filename.toLowerCase();

    if (lowerName.includes('purchase')) defaultCategory = 'Purchase Invoice';
    else if (lowerName.includes('pay')) defaultCategory = 'Payment';
    else if (lowerName.includes('rec')) defaultCategory = 'Receipt';
    else if (lowerName.includes('contra')) defaultCategory = 'Contra';
    else if (lowerName.includes('bank') || lowerName.includes('statement')) defaultCategory = 'Bank Statement';
    else if (lowerName.includes('credit')) defaultCategory = 'Credit Note';
    else if (lowerName.includes('debit')) defaultCategory = 'Debit Note';

    const partyPool = ['ABC Traders', 'XYZ Enterprises', 'LMN Industries', 'PQR Solutions', 'New Horizon Ltd', 'Apex Tech', 'Alpha Services', 'Beta Corp', 'Gamma Systems', 'Delta Partners'];

    const records = [];
    for (let i = 1; i <= count; i++) {
      const partyName = partyPool[Math.floor(Math.random() * partyPool.length)];
      const docNo = (defaultCategory === 'Bank Statement' ? 'TXN-' : 'INV-') + Math.floor(1000 + Math.random() * 9000);
      const taxableValue = Math.floor(Math.random() * 450 + 50) * 100;
      const taxAmount = ['Payment', 'Receipt', 'Contra', 'Bank Statement'].includes(defaultCategory) ? 0 : Math.round(taxableValue * 0.18);
      const totalAmount = taxableValue + taxAmount;
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      let record = {
        id: i,
        date,
        docNo,
        category: defaultCategory,
        partyName,
        gstin: ['Payment', 'Receipt', 'Contra', 'Bank Statement'].includes(defaultCategory) ? '' : '22' + String.fromCharCode(65 + Math.floor(Math.random() * 26)).repeat(5) + Math.floor(1000 + Math.random() * 9000) + 'A1Z' + Math.floor(Math.random() * 9),
        taxableValue,
        taxAmount,
        totalAmount,
        status: 'Valid',
        errorMessage: ''
      };

      if (i === 3 && ['Sales Invoice', 'Purchase Invoice', 'Credit Note', 'Debit Note'].includes(defaultCategory)) {
        record.gstin = ''; // cause validation warning
      }

      records.push(validateRecord(record));
    }
    return records;
  };

  // --- Dynamic Stats calculation ---
  const stats = useMemo(() => {
    if (selectedBatchId && activeBatch && Array.isArray(activeBatch.records)) {
      const total = activeBatch.records.length;
      const valid = activeBatch.records.filter(r => r.status === 'Valid').length;
      const warning = activeBatch.records.filter(r => r.status === 'Warning').length;
      const invalid = activeBatch.records.filter(r => r.status === 'Invalid').length;
      const uniqueCats = new Set(activeBatch.records.map(r => r.category)).size;
      const totalAmount = activeBatch.records.reduce((sum, r) => sum + (parseFloat(r.totalAmount) || 0), 0);

      return {
        total,
        valid,
        warning,
        invalid,
        uniqueCats,
        totalAmount
      };
    } else {
      const totalBatches = batches.length;
      const pendingReview = batches.filter(b => b.status === 'Pending Approval').length;
      const approved = batches.filter(b => b.status === 'Approved').length;
      const posted = batches.filter(b => b.status === 'Posted').length;
      const failed = batches.filter(b => b.status === 'Failed').length;
      const totalRecords = batches.reduce((sum, b) => sum + (b.totalRecords || 0), 0);

      return {
        totalBatches,
        pendingReview,
        approved,
        posted,
        failed,
        totalRecords
      };
    }
  }, [batches, selectedBatchId, activeBatch]);

  // --- Unique vendors dynamically populated ---
  const uniqueVendors = useMemo(() => {
    let recordsPool = [];
    if (selectedBatchId && activeBatch && Array.isArray(activeBatch.records)) {
      recordsPool = activeBatch.records;
    } else {
      batches.forEach(b => {
        if (Array.isArray(b.records)) {
          recordsPool = recordsPool.concat(b.records);
        }
      });
    }
    const vendors = recordsPool.map(r => r.partyName).filter(Boolean);
    return Array.from(new Set(vendors));
  }, [batches, selectedBatchId, activeBatch]);

  // --- Filters logic ---
  const filteredBatches = useMemo(() => {
    return batches.filter(batch => {
      if (statusFilter !== 'All Status' && batch.status !== statusFilter) return false;

      if (activeCategory !== 'All') {
        const hasCategory = Array.isArray(batch.records) && batch.records.some(r => r.category === activeCategory);
        if (!hasCategory) return false;
      }

      if (vendorFilter !== 'All Vendors/Customers') {
        const hasVendor = Array.isArray(batch.records) && batch.records.some(r => r.partyName === vendorFilter);
        if (!hasVendor) return false;
      }

      if (dateRange && !batch.uploadDate.includes(dateRange)) return false;

      if (search) {
        const query = search.toLowerCase();
        const matchId = batch.id.toLowerCase().includes(query);
        const matchFilename = batch.filename.toLowerCase().includes(query);
        const matchStatus = batch.status.toLowerCase().includes(query);
        if (!matchId && !matchFilename && !matchStatus) return false;
      }

      return true;
    });
  }, [batches, statusFilter, activeCategory, vendorFilter, dateRange, search]);

  const filteredRecords = useMemo(() => {
    if (!activeBatch || !Array.isArray(activeBatch.records)) return [];
    return activeBatch.records.filter(rec => {
      if (activeCategory !== 'All' && rec.category !== activeCategory) return false;

      if (statusFilter !== 'All Status') {
        if (rec.status !== statusFilter) return false;
      }

      if (vendorFilter !== 'All Vendors/Customers' && rec.partyName !== vendorFilter) return false;

      if (search) {
        const query = search.toLowerCase();
        const matchParty = rec.partyName.toLowerCase().includes(query);
        const matchDocNo = rec.docNo.toLowerCase().includes(query);
        const matchCategory = rec.category.toLowerCase().includes(query);
        const matchStatus = rec.status.toLowerCase().includes(query);
        if (!matchParty && !matchDocNo && !matchCategory && !matchStatus) return false;
      }

      return true;
    });
  }, [activeBatch, activeCategory, statusFilter, vendorFilter, search]);

  // Pagination bounds
  const paginatedBatches = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredBatches.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredBatches, currentPage]);

  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredRecords.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredRecords, currentPage]);

  const totalPages = useMemo(() => {
    const totalCount = selectedBatchId ? filteredRecords.length : filteredBatches.length;
    return Math.max(1, Math.ceil(totalCount / itemsPerPage));
  }, [selectedBatchId, filteredRecords, filteredBatches]);

  // --- Upload triggers ---
  const handleBrowse = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const extension = file.name.split('.').pop().toLowerCase();

      if (!['csv', 'xlsx', 'xls'].includes(extension)) {
        toast.error('Please upload only Excel (.xlsx, .xls) or CSV (.csv) files.');
        return;
      }

      if (extension === 'csv') {
        const reader = new FileReader();
        reader.onload = (evt) => {
          const text = evt.target.result;
          const parsed = parseCSV(text);
          if (parsed && parsed.rows.length > 0) {
            const records = parsed.rows.map((row, index) => mapCSVRowToRecord(row, index));
            const newBatchId = `BATCH-${Math.floor(100 + Math.random() * 900)}`;
            const newBatch = {
              id: newBatchId,
              filename: file.name,
              totalRecords: records.length,
              uploadDate: new Date().toLocaleString('en-IN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
              }).replace(/\//g, '-'),
              status: 'Pending Approval',
              records: records
            };

            setBatches(prev => {
              const updated = [newBatch, ...prev];
              localStorage.setItem('fb_bulk_batches', JSON.stringify(updated));
              return updated;
            });
            setShowUploadModal(false);
            toast.success(`Successfully parsed ${records.length} records from CSV into new Batch ${newBatchId}!`);
            openBatchReview(newBatchId);
          } else {
            createMockBatch(file);
          }
        };
        reader.readAsText(file);
      } else if (['xlsx', 'xls'].includes(extension)) {
        // ACTUAL EXCEL FILE PARSING IN BROWSER USING SHEETJS (XLSX)
        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const data = new Uint8Array(evt.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

            if (jsonRows && jsonRows.length > 0) {
              const records = jsonRows.map((row, index) => mapCSVRowToRecord(row, index));
              const newBatchId = `BATCH-${Math.floor(100 + Math.random() * 900)}`;
              const newBatch = {
                id: newBatchId,
                filename: file.name,
                totalRecords: records.length,
                uploadDate: new Date().toLocaleString('en-IN', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true
                }).replace(/\//g, '-'),
                status: 'Pending Approval',
                records: records
              };

              setBatches(prev => {
                const updated = [newBatch, ...prev];
                localStorage.setItem('fb_bulk_batches', JSON.stringify(updated));
                return updated;
              });
              setShowUploadModal(false);
              toast.success(`Successfully parsed ${records.length} records from Excel sheet "${sheetName}"!`);
              openBatchReview(newBatchId);
            } else {
              toast.error('The selected Excel sheet was empty. Generating mock data.');
              createMockBatch(file);
            }
          } catch (err) {
            console.error('SheetJS Excel Parsing error', err);
            toast.error('Could not parse Excel contents. Generating mock data instead.');
            createMockBatch(file);
          }
        };
        reader.readAsArrayBuffer(file);
      }
    }
  };

  const createMockBatch = (file) => {
    const newBatchId = `BATCH-${Math.floor(100 + Math.random() * 900)}`;
    const recordCount = Math.floor(Math.random() * 8) + 8; // 8 to 15 records
    const records = generateMockRecords(file.name, recordCount);

    const newBatch = {
      id: newBatchId,
      filename: file.name,
      totalRecords: records.length,
      uploadDate: new Date().toLocaleString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).replace(/\//g, '-'),
      status: 'Pending Approval',
      records: records
    };

    setBatches(prev => {
      const updated = [newBatch, ...prev];
      localStorage.setItem('fb_bulk_batches', JSON.stringify(updated));
      return updated;
    });
    setShowUploadModal(false);

    toast.loading('Analyzing spreadsheet data...');
    setTimeout(() => {
      toast.dismiss();
      toast.success(`Extracted ${records.length} mock records from Excel into new Batch ${newBatchId}!`);
      openBatchReview(newBatchId);
    }, 1000);
  };

  const handleReset = () => {
    setSearch('');
    setStatusFilter('All Status');
    setVendorFilter('All Vendors/Customers');
    setDateRange('');
    setActiveCategory('All');
    setCheckedBatchIds([]);
    setCheckedRecordIds([]);
    setCurrentPage(1);
    toast.info('Quick filters reset');
  };

  const handleRestoreDefaults = () => {
    localStorage.removeItem('fb_bulk_batches');
    setBatches(defaultBatches);
    setSelectedBatchId(null);
    setCurrentPage(1);
    toast.success('Restored default mock database batches successfully!');
  };

  // --- Inline spreadsheet editing handlers ---
  const updateRecordCell = (recordId, columnKey, value) => {
    if (!selectedBatchId) return;
    setBatches(prevBatches => {
      const updatedBatches = prevBatches.map(batch => {
        if (batch.id === selectedBatchId) {
          const updatedRecords = batch.records.map(rec => {
            if (rec.id === recordId) {
              let updatedRec = { ...rec, [columnKey]: value };

              // Recalculations
              if (columnKey === 'taxableValue') {
                const taxRate = ['Sales Invoice', 'Purchase Invoice', 'Credit Note', 'Debit Note'].includes(updatedRec.category) ? 0.18 : 0;
                const tax = Math.round(parseFloat(value) * taxRate * 100) / 100;
                updatedRec.taxAmount = tax;
                updatedRec.totalAmount = parseFloat(value) + tax;
              } else if (columnKey === 'taxAmount') {
                updatedRec.totalAmount = parseFloat(updatedRec.taxableValue || 0) + parseFloat(value);
              } else if (columnKey === 'totalAmount') {
                updatedRec.taxAmount = Math.max(0, parseFloat(value) - parseFloat(updatedRec.taxableValue || 0));
              } else if (columnKey === 'category') {
                // Recalculate tax if we change from non-gst to gst category or vice-versa
                const taxRate = ['Sales Invoice', 'Purchase Invoice', 'Credit Note', 'Debit Note'].includes(value) ? 0.18 : 0;
                const tax = Math.round(parseFloat(updatedRec.taxableValue || 0) * taxRate * 100) / 100;
                updatedRec.taxAmount = tax;
                updatedRec.totalAmount = parseFloat(updatedRec.taxableValue || 0) + tax;
              }

              updatedRec = validateRecord(updatedRec);
              return updatedRec;
            }
            return rec;
          });

          return {
            ...batch,
            records: updatedRecords,
            totalRecords: updatedRecords.length
          };
        }
        return batch;
      });
      localStorage.setItem('fb_bulk_batches', JSON.stringify(updatedBatches));
      return updatedBatches;
    });
  };

  // Add / Delete record inside active batch spreadsheet
  const handleAddRow = () => {
    if (!selectedBatchId || !activeBatch) return;

    const nextId = activeBatch.records.length > 0
      ? Math.max(...activeBatch.records.map(r => r.id)) + 1
      : 1;

    const newRecord = {
      id: nextId,
      date: new Date().toISOString().split('T')[0],
      docNo: `INV-${Math.floor(1000 + Math.random() * 9000)}`,
      category: activeCategory !== 'All' ? activeCategory : 'Sales Invoice',
      partyName: 'ABC Traders',
      gstin: '22AAAAA1111A1Z5',
      taxableValue: 0,
      taxAmount: 0,
      totalAmount: 0,
      status: 'Valid',
      errorMessage: ''
    };

    setBatches(prevBatches => {
      const updatedBatches = prevBatches.map(batch => {
        if (batch.id === selectedBatchId) {
          const records = [...batch.records, newRecord];
          return {
            ...batch,
            records,
            totalRecords: records.length
          };
        }
        return batch;
      });
      localStorage.setItem('fb_bulk_batches', JSON.stringify(updatedBatches));
      return updatedBatches;
    });

    toast.success('Added new empty transaction row to spreadsheet');
    setEditingCell({ recordId: nextId, columnKey: 'date' });
  };

  const handleDeleteRow = (recordId) => {
    if (!selectedBatchId) return;
    setBatches(prevBatches => {
      const updatedBatches = prevBatches.map(batch => {
        if (batch.id === selectedBatchId) {
          const records = batch.records.filter(r => r.id !== recordId);
          return {
            ...batch,
            records,
            totalRecords: records.length
          };
        }
        return batch;
      });
      localStorage.setItem('fb_bulk_batches', JSON.stringify(updatedBatches));
      return updatedBatches;
    });
    toast.success('Removed row from batch');
  };

  const handlePostBatch = () => {
    if (!selectedBatchId || !activeBatch) return;

    const hasInvalid = activeBatch.records.some(r => r.status === 'Invalid');
    if (hasInvalid) {
      toast.error('Cannot post batch with invalid records. Please fix all red error rows first.');
      return;
    }

    setBatches(prevBatches => {
      const updatedBatches = prevBatches.map(batch => {
        if (batch.id === selectedBatchId) {
          return {
            ...batch,
            status: 'Posted'
          };
        }
        return batch;
      });
      localStorage.setItem('fb_bulk_batches', JSON.stringify(updatedBatches));
      return updatedBatches;
    });

    toast.success(`Batch "${activeBatch.filename}" successfully posted to Tally!`);
    setSelectedBatchId(null);
    setCurrentPage(1);
  };

  // --- Selection handlers ---
  const handleSelectAll = (e) => {
    if (selectedBatchId) {
      if (e.target.checked) {
        setCheckedRecordIds(paginatedRecords.map(r => r.id));
      } else {
        setCheckedRecordIds([]);
      }
    } else {
      if (e.target.checked) {
        setCheckedBatchIds(paginatedBatches.map(b => b.id));
      } else {
        setCheckedBatchIds([]);
      }
    }
  };

  const handleSelectRow = (id) => {
    if (selectedBatchId) {
      setCheckedRecordIds(prev =>
        prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      );
    } else {
      setCheckedBatchIds(prev =>
        prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      );
    }
  };

  // --- Dynamic Style Helpers ---
  const getBatchStatusStyles = (stat) => {
    const stylesMap = {
      'Pending Review': 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/15 dark:text-amber-400 dark:border-amber-800',
      'Pending Approval': 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/15 dark:text-amber-400 dark:border-amber-800',
      'Approved': 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/15 dark:text-purple-400 dark:border-purple-800',
      'Posted': 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/15 dark:text-blue-400 dark:border-blue-800',
      'Failed': 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/15 dark:text-red-400 dark:border-red-800'
    };
    return stylesMap[stat] || 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800';
  };

  const getDocIcon = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    if (['xlsx', 'xls', 'csv'].includes(ext)) {
      return <FileSpreadsheet className="text-emerald-500 shrink-0" size={13} />;
    }
    return <FileText className="text-blue-500 shrink-0" size={13} />;
  };

  // Cell renderer helper
  const renderCell = (record, columnKey, type = 'text') => {
    const isEditing = editingCell && editingCell.recordId === record.id && editingCell.columnKey === columnKey;

    const handleBlur = (value) => {
      updateRecordCell(record.id, columnKey, value);
      setEditingCell(null);
    };

    const handleKeyDown = (e, value) => {
      if (e.key === 'Enter') {
        updateRecordCell(record.id, columnKey, value);
        setEditingCell(null);
      } else if (e.key === 'Escape') {
        setEditingCell(null);
      }
    };

    const value = record[columnKey];

    if (isEditing) {
      if (columnKey === 'category') {
        return (
          <select
            autoFocus
            defaultValue={value}
            onBlur={(e) => handleBlur(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, e.target.value)}
            className="w-full h-7 bg-white dark:bg-slate-800 text-[11px] p-0.5 border border-blue-500 outline-none rounded font-semibold text-slate-850 dark:text-slate-100"
          >
            {tabCategories.slice(1).map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        );
      }

      return (
        <input
          autoFocus
          type={type}
          defaultValue={value}
          onBlur={(e) => {
            let val = e.target.value;
            if (type === 'number') val = parseFloat(val) || 0;
            handleBlur(val);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              let val = e.target.value;
              if (type === 'number') val = parseFloat(val) || 0;
              handleBlur(val);
            } else if (e.key === 'Escape') {
              setEditingCell(null);
            }
          }}
          className="w-full h-7 bg-white dark:bg-slate-800 text-[11px] p-1 border border-blue-500 outline-none rounded font-semibold text-slate-850 dark:text-slate-100"
        />
      );
    }

    let displayValue = value;
    if (columnKey === 'taxableValue' || columnKey === 'taxAmount' || columnKey === 'totalAmount') {
      displayValue = `₹ ${(parseFloat(value) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    return (
      <div
        onDoubleClick={() => setEditingCell({ recordId: record.id, columnKey })}
        className="w-full h-full min-h-[24px] px-2 py-1.5 cursor-cell hover:bg-slate-50 dark:hover:bg-slate-800/40 select-none truncate flex items-center justify-between group"
      >
        <span className="truncate">{displayValue || <span className="text-slate-300 dark:text-slate-650 italic">empty</span>}</span>
        <Edit2 size={9} className="text-slate-400 dark:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity ml-1.5 shrink-0" />
      </div>
    );
  };

  const renderStatusBadge = (record) => {
    if (record.status === 'Valid') {
      return (
        <div className="flex items-center justify-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold uppercase text-[9px]">
          <CheckCircle size={11} />
          <span>Valid</span>
        </div>
      );
    }
    if (record.status === 'Warning') {
      return (
        <div
          className="flex items-center justify-center gap-1 text-amber-500 hover:text-amber-600 font-bold uppercase text-[9px] cursor-help"
          title={record.errorMessage}
        >
          <AlertTriangle size={11} />
          <span className="underline decoration-dotted truncate max-w-[90px]">{record.errorMessage || 'Warning'}</span>
        </div>
      );
    }
    return (
      <div
        className="flex items-center justify-center gap-1 text-rose-600 dark:text-rose-400 font-bold uppercase text-[9px] cursor-help"
        title={record.errorMessage}
      >
        <AlertCircle size={11} />
        <span className="underline decoration-dotted truncate max-w-[90px]">{record.errorMessage || 'Invalid'}</span>
      </div>
    );
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
              className={`pb-1 text-[11px] font-bold tracking-wide whitespace-nowrap transition-all uppercase border-b-2 -mb-2 flex items-center gap-1.5 cursor-pointer ${
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
          <div className="flex items-center gap-2">
            {selectedBatchId && (
              <button
                onClick={() => {
                  setSelectedBatchId(null);
                  handleReset(); // Reset filters when going back
                }}
                className="p-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center justify-center bg-white dark:bg-slate-900 cursor-pointer"
                title="Back to Batches"
              >
                <ArrowLeft size={13} />
              </button>
            )}
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <span>{selectedBatchId ? 'Batch Review' : 'Bulk Upload'}</span>
              {selectedBatchId && activeBatch && (
                <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 select-all font-mono">
                  {activeBatch.id} - {activeBatch.filename}
                </span>
              )}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {selectedBatchId && activeBatch ? (
              <>
                <button
                  onClick={handleAddRow}
                  className="h-8 px-3 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition flex items-center gap-1.5 font-bold shadow-xs text-xs cursor-pointer"
                >
                  <Plus size={13} className="text-blue-500 animate-pulse" />
                  <span>Add Transaction Row</span>
                </button>

                <button
                  onClick={handlePostBatch}
                  className={`h-8 px-3 rounded-lg transition flex items-center gap-1.5 font-bold shadow-xs text-xs cursor-pointer ${
                    activeBatch.status === 'Posted'
                      ? 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed dark:bg-slate-800 dark:border-slate-700'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                  disabled={activeBatch.status === 'Posted'}
                >
                  <Send size={12} />
                  <span>Approve & Post Batch</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowUploadModal(true)}
                className="h-8 px-3 border border-blue-200 dark:border-blue-900 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900 hover:bg-blue-50/50 dark:hover:bg-slate-800/50 rounded-lg transition flex items-center gap-1.5 font-bold shadow-xs text-xs cursor-pointer"
              >
                <UploadCloud size={13} className="text-blue-500" />
                <span>Upload Excel / CSV</span>
              </button>
            )}
          </div>
        </div>

        {/* KPI Stats Cards Row */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 shrink-0">
          {/* Card 1 */}
          <div className="p-2 border rounded-lg bg-blue-50/55 border-blue-100/70 dark:bg-blue-950/15 dark:border-blue-900/35 shadow-3xs flex items-center justify-between h-[58px] transition-all">
            <div className="min-w-0 flex-1">
              <span className="text-[9px] font-bold text-slate-455 dark:text-slate-500 uppercase tracking-wide leading-none block truncate">
                {selectedBatchId ? 'Total Batch Records' : 'Total Batches'}
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-lg font-black text-slate-900 dark:text-white leading-none">
                  {selectedBatchId ? stats.total : (stats.totalBatches + 48).toLocaleString()}
                </span>
                <span className="text-[8px] text-slate-400 dark:text-slate-500 leading-none">
                  {selectedBatchId ? 'Uploaded' : 'All Time'}
                </span>
              </div>
            </div>
            <div className="h-6 w-6 rounded-md bg-blue-100/50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 shrink-0">
              <FileSpreadsheet size={12} />
            </div>
          </div>

          {/* Card 2 */}
          <div className="p-2 border rounded-lg bg-emerald-50/55 border-emerald-100/70 dark:bg-emerald-950/15 dark:border-emerald-900/35 shadow-3xs flex items-center justify-between h-[58px] transition-all">
            <div className="min-w-0 flex-1">
              <span className="text-[9px] font-bold text-slate-455 dark:text-slate-500 uppercase tracking-wide leading-none block truncate">
                {selectedBatchId ? 'Valid Records' : 'Total Records'}
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-lg font-black text-slate-900 dark:text-white leading-none">
                  {selectedBatchId ? stats.valid : (stats.totalRecords + 1102).toLocaleString()}
                </span>
                <span className="text-[8px] text-slate-400 dark:text-slate-500 leading-none">
                  {selectedBatchId ? 'Ready' : 'Across Batches'}
                </span>
              </div>
            </div>
            <div className="h-6 w-6 rounded-md bg-emerald-100/50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 shrink-0">
              <CheckCircle2 size={12} />
            </div>
          </div>

          {/* Card 3 */}
          <div className="p-2 border rounded-lg bg-amber-50/55 border-amber-100/70 dark:bg-amber-950/15 dark:border-amber-900/35 shadow-3xs flex items-center justify-between h-[58px] transition-all">
            <div className="min-w-0 flex-1">
              <span className="text-[9px] font-bold text-slate-455 dark:text-slate-500 uppercase tracking-wide leading-none block truncate">
                {selectedBatchId ? 'Validation Warnings' : 'Pending Approval'}
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-lg font-black text-slate-900 dark:text-white leading-none">
                  {selectedBatchId ? stats.warning : (stats.pendingReview + 12)}
                </span>
                <span className="text-[8px] text-slate-400 dark:text-slate-500 leading-none">
                  {selectedBatchId ? 'Verify Details' : 'Needs Approval'}
                </span>
              </div>
            </div>
            <div className="h-6 w-6 rounded-md bg-amber-100/50 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 shrink-0">
              <AlertTriangle size={12} />
            </div>
          </div>

          {/* Card 4 */}
          <div className="p-2 border rounded-lg bg-red-50/55 border-red-100/70 dark:bg-red-950/15 dark:border-red-900/35 shadow-3xs flex items-center justify-between h-[58px] transition-all">
            <div className="min-w-0 flex-1">
              <span className="text-[9px] font-bold text-slate-455 dark:text-slate-500 uppercase tracking-wide leading-none block truncate">
                {selectedBatchId ? 'Validation Errors' : 'Approved Batches'}
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-lg font-black text-slate-900 dark:text-white leading-none">
                  {selectedBatchId ? stats.invalid : (stats.approved + 28)}
                </span>
                <span className="text-[8px] text-slate-400 dark:text-slate-500 leading-none">
                  {selectedBatchId ? 'Must Fix' : 'Verified'}
                </span>
              </div>
            </div>
            <div className="h-6 w-6 rounded-md bg-red-100/50 dark:bg-red-900/30 flex items-center justify-center text-red-650 shrink-0">
              <AlertCircle size={12} />
            </div>
          </div>

          {/* Card 5 */}
          <div className="p-2 border rounded-lg bg-purple-50/55 border-purple-100/70 dark:bg-purple-950/15 dark:border-purple-900/35 shadow-3xs flex items-center justify-between h-[58px] transition-all">
            <div className="min-w-0 flex-1">
              <span className="text-[9px] font-bold text-slate-455 dark:text-slate-500 uppercase tracking-wide leading-none block truncate">
                {selectedBatchId ? 'Voucher Types' : 'Posted Batches'}
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-lg font-black text-slate-900 dark:text-white leading-none">
                  {selectedBatchId ? stats.uniqueCats : (stats.posted + 15)}
                </span>
                <span className="text-[8px] text-slate-400 dark:text-slate-500 leading-none">
                  {selectedBatchId ? 'Categories' : 'Synced to Tally'}
                </span>
              </div>
            </div>
            <div className="h-6 w-6 rounded-md bg-purple-100/50 dark:bg-purple-900/30 flex items-center justify-center text-purple-650 shrink-0">
              <SlidersHorizontal size={12} />
            </div>
          </div>

          {/* Card 6 */}
          <div className="p-2 border rounded-lg bg-slate-50 border-slate-100 dark:bg-slate-950/15 dark:border-slate-900/35 shadow-3xs flex items-center justify-between h-[58px] transition-all">
            <div className="min-w-0 flex-1">
              <span className="text-[9px] font-bold text-slate-455 dark:text-slate-500 uppercase tracking-wide leading-none block truncate">
                {selectedBatchId ? 'Total Batch Value' : 'Failed / Rejected'}
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-[12px] font-black text-slate-900 dark:text-white leading-none">
                  {selectedBatchId 
                    ? `₹ ${stats.totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` 
                    : (stats.failed + 3)
                  }
                </span>
                <span className="text-[8px] text-slate-400 dark:text-slate-500 leading-none">
                  {selectedBatchId ? 'Cumulative' : 'Voucher Errors'}
                </span>
              </div>
            </div>
            <div className="h-6 w-6 rounded-md bg-slate-200/50 dark:bg-slate-800/30 flex items-center justify-center text-slate-600 shrink-0">
              {selectedBatchId ? <Database size={12} /> : <ShieldAlert size={12} />}
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
              placeholder={selectedBatchId ? "Search batch records..." : "Search batches..."}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-7.5 pl-8 pr-2.5 rounded-lg border text-[11px] outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500 transition-colors font-semibold"
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
              className="h-7.5 rounded-lg border px-2 text-[11px] outline-none bg-white dark:bg-slate-950/40 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 font-semibold cursor-pointer w-[140px]"
            >
              {selectedBatchId ? (
                <>
                  <option value="All Status">All Row Status</option>
                  <option value="Valid">Valid</option>
                  <option value="Warning">Warning</option>
                  <option value="Invalid">Invalid</option>
                </>
              ) : (
                <>
                  <option value="All Status">All Batch Status</option>
                  <option value="Pending Approval">Pending Approval</option>
                  <option value="Approved">Approved</option>
                  <option value="Posted">Posted</option>
                  <option value="Failed">Failed</option>
                </>
              )}
            </select>

            <select
              value={activeCategory}
              onChange={(e) => {
                setActiveCategory(e.target.value);
                setCurrentPage(1);
              }}
              className="h-7.5 rounded-lg border px-2 text-[11px] outline-none bg-white dark:bg-slate-950/40 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 font-semibold cursor-pointer w-[125px]"
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
              className="h-7.5 rounded-lg border px-2 text-[11px] outline-none bg-white dark:bg-slate-950/40 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 font-semibold cursor-pointer w-[160px]"
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
                className="h-7.5 rounded-lg border pl-2.5 pr-7 text-[11px] outline-none bg-white dark:bg-slate-950/45 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 font-semibold w-[130px] appearance-none cursor-pointer"
              >
                <option value="">Upload Date</option>
                <option value="23-06-2026">23-06-2026</option>
                <option value="22-06-2026">22-06-2026</option>
                <option value="21-06-2026">21-06-2026</option>
                <option value="20-06-2026">20-06-2026</option>
              </select>
              <Calendar className="absolute right-2.5 pointer-events-none text-slate-400" size={12} />
            </div>

            <button
              onClick={handleReset}
              className="text-[11px] font-bold text-blue-600 hover:text-blue-700 bg-transparent transition-colors px-1 cursor-pointer"
            >
              Reset
            </button>
            <button
              onClick={handleRestoreDefaults}
              className="text-[11px] font-bold text-slate-500 hover:text-slate-700 bg-transparent transition-colors px-1 cursor-pointer"
              title="Reset all batch data to default mock records"
            >
              Restore Defaults
            </button>
          </div>
        </div>

        {/* --- MAIN INTERACTIVE VIEW AREA (Table Container) --- */}
        <div className="border rounded-lg flex-1 overflow-hidden flex flex-col bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800/80 shadow-3xs min-h-[300px]">

          {!selectedBatchId ? (
            /* --- batches List View --- */
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse min-w-[800px] text-[11px] whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-slate-950/30 border-b text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 font-semibold uppercase tracking-wider">
                    <th className="py-2.5 px-3 w-9 text-center">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 cursor-pointer h-3.5 w-3.5"
                        onChange={handleSelectAll}
                        checked={paginatedBatches.length > 0 && paginatedBatches.every(b => checkedBatchIds.includes(b.id))}
                      />
                    </th>
                    <th className="py-2.5 px-3 font-semibold">Batch ID</th>
                    <th className="py-2.5 px-3 font-semibold">File Name</th>
                    <th className="py-2.5 px-3 font-semibold text-center">Total Records</th>
                    <th className="py-2.5 px-3 font-semibold text-center">Upload Date</th>
                    <th className="py-2.5 px-3 font-semibold text-center">Status</th>
                    <th className="py-2.5 px-3 font-semibold text-center w-28">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {paginatedBatches.length > 0 ? (
                    paginatedBatches.map((batch) => {
                      const isChecked = checkedBatchIds.includes(batch.id);
                      return (
                        <tr
                          key={batch.id}
                          onClick={() => openBatchReview(batch.id)}
                          className={`hover:bg-slate-50/40 dark:hover:bg-slate-900/30 cursor-pointer transition-colors ${
                            isChecked ? 'bg-blue-50/10 dark:bg-blue-950/5' : ''
                          }`}
                        >
                          <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 cursor-pointer h-3.5 w-3.5"
                              checked={isChecked}
                              onChange={() => handleSelectRow(batch.id)}
                            />
                          </td>
                          <td className="py-2 px-3 font-bold text-blue-600 dark:text-blue-400 font-mono text-[10px]">
                            {batch.id}
                          </td>
                          <td className="py-2 px-3 text-slate-900 dark:text-slate-100 font-semibold">
                            <div className="flex items-center gap-1.5">
                              {getDocIcon(batch.filename)}
                              <span className="truncate max-w-[240px]" title={batch.filename}>{batch.filename}</span>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-center text-slate-900 dark:text-slate-100 font-bold">
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 font-bold text-[10px]">
                              {batch.totalRecords || (Array.isArray(batch.records) ? batch.records.length : 0)}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center text-slate-500 dark:text-slate-400 font-semibold">
                            {batch.uploadDate}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded border text-[9px] font-extrabold uppercase ${getBatchStatusStyles(batch.status)}`}>
                              {batch.status}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-2 text-slate-400 dark:text-slate-500">
                              <button
                                onClick={() => openBatchReview(batch.id)}
                                className="p-1 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition cursor-pointer"
                                title="Open Batch Review"
                              >
                                <Eye size={13} />
                              </button>
                              <button
                                onClick={() => {
                                  setBatches(prev => {
                                    const updated = prev.filter(b => b.id !== batch.id);
                                    localStorage.setItem('fb_bulk_batches', JSON.stringify(updated));
                                    return updated;
                                  });
                                  toast.success(`Removed batch ${batch.id}`);
                                }}
                                className="p-1 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition cursor-pointer"
                                title="Delete Batch"
                              >
                                <Trash2 size={13} />
                              </button>
                              <button className="p-1 hover:text-slate-700 dark:hover:text-slate-300 rounded transition cursor-pointer">
                                <MoreVertical size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-slate-400 dark:text-slate-500 font-medium">
                        <div className="flex flex-col items-center justify-center gap-1">
                          <Info size={24} className="text-slate-355 dark:text-slate-700" />
                          <span>No batches matching the criteria were found.</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            /* --- Spreadsheet-style Batch Review View --- */
            <div className="flex-1 flex flex-col min-w-0">
              <div className="overflow-auto flex-1 max-h-[500px]">
                <table className="w-full text-left border-collapse table-fixed min-w-[1100px] text-[11px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <colgroup>
                    <col className="w-9" />
                    <col className="w-9" />
                    <col className="w-[85px]" />
                    <col className="w-[95px]" />
                    <col className="w-[110px]" />
                    <col className="w-[180px]" />
                    <col className="w-[130px]" />
                    <col className="w-[100px]" />
                    <col className="w-[100px]" />
                    <col className="w-[100px]" />
                    <col className="w-[110px]" />
                    <col className="w-[60px]" />
                  </colgroup>
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-950/50 text-slate-650 dark:text-slate-300 border-b border-slate-250 dark:border-slate-850 font-bold uppercase tracking-wider text-[10px] select-none text-center">
                      <th className="border-r border-slate-200 dark:border-slate-800 p-1 w-9 text-center bg-slate-50 dark:bg-slate-950 text-slate-400">
                        {/* Empty cell for spreadsheet corner */}
                      </th>
                      <th className="border-r border-slate-200 dark:border-slate-800 p-1 w-9 text-center">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 cursor-pointer h-3.5 w-3.5"
                          onChange={handleSelectAll}
                          checked={paginatedRecords.length > 0 && paginatedRecords.every(r => checkedRecordIds.includes(r.id))}
                        />
                      </th>
                      <th className="border-r border-slate-200 dark:border-slate-800 py-1.5 px-2 font-bold text-left">Date</th>
                      <th className="border-r border-slate-200 dark:border-slate-800 py-1.5 px-2 font-bold text-left">Invoice No</th>
                      <th className="border-r border-slate-200 dark:border-slate-800 py-1.5 px-2 font-bold text-left">Voucher Type</th>
                      <th className="border-r border-slate-200 dark:border-slate-800 py-1.5 px-2 font-bold text-left">Party / Ledger Name</th>
                      <th className="border-r border-slate-200 dark:border-slate-800 py-1.5 px-2 font-bold text-left">GSTIN</th>
                      <th className="border-r border-slate-200 dark:border-slate-800 py-1.5 px-2 font-bold text-right">Taxable Value</th>
                      <th className="border-r border-slate-200 dark:border-slate-800 py-1.5 px-2 font-bold text-right">Tax (GST)</th>
                      <th className="border-r border-slate-200 dark:border-slate-800 py-1.5 px-2 font-bold text-right">Total Amount</th>
                      <th className="border-r border-slate-200 dark:border-slate-800 py-1.5 px-2 font-bold text-center">Status</th>
                      <th className="py-1.5 px-2 font-bold text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {paginatedRecords.length > 0 ? (
                      paginatedRecords.map((record, index) => {
                        const isChecked = checkedRecordIds.includes(record.id);
                        const rowNumber = (currentPage - 1) * itemsPerPage + index + 1;
                        
                        // Row highlight styling based on status
                        let rowStatusClass = "";
                        if (record.status === 'Invalid') rowStatusClass = "bg-rose-50/15 dark:bg-rose-950/5";
                        else if (record.status === 'Warning') rowStatusClass = "bg-amber-50/15 dark:bg-amber-950/5";

                        return (
                          <tr
                            key={record.id}
                            className={`hover:bg-slate-50/20 dark:hover:bg-slate-900/10 transition-colors ${rowStatusClass} ${
                              isChecked ? 'bg-blue-50/10 dark:bg-blue-950/5 border-l-2 border-l-blue-500' : ''
                            }`}
                          >
                            {/* Excel Leftmost Row Index (S.No.) */}
                            <td className="border-r border-slate-200 dark:border-slate-800 py-1.5 text-center font-mono font-bold bg-slate-50/80 dark:bg-slate-950/50 text-slate-400 select-none text-[10px]">
                              {rowNumber}
                            </td>
                            <td className="border-r border-slate-200 dark:border-slate-800 py-1.5 text-center">
                              <input
                                type="checkbox"
                                className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 cursor-pointer h-3.5 w-3.5"
                                checked={isChecked}
                                onChange={() => handleSelectRow(record.id)}
                              />
                            </td>
                            {/* Cells */}
                            <td className="border-r border-slate-200 dark:border-slate-800 p-0 text-slate-900 dark:text-slate-100">
                              {renderCell(record, 'date', 'date')}
                            </td>
                            <td className="border-r border-slate-200 dark:border-slate-800 p-0 font-semibold text-slate-700 dark:text-slate-300">
                              {renderCell(record, 'docNo', 'text')}
                            </td>
                            <td className="border-r border-slate-200 dark:border-slate-800 p-0 text-slate-900 dark:text-slate-100">
                              {renderCell(record, 'category', 'select')}
                            </td>
                            <td className="border-r border-slate-200 dark:border-slate-800 p-0 font-bold text-slate-900 dark:text-slate-100">
                              {renderCell(record, 'partyName', 'text')}
                            </td>
                            <td className="border-r border-slate-200 dark:border-slate-800 p-0 font-mono text-slate-700 dark:text-slate-300">
                              {renderCell(record, 'gstin', 'text')}
                            </td>
                            <td className="border-r border-slate-200 dark:border-slate-800 p-0 text-right font-bold text-slate-900 dark:text-white">
                              {renderCell(record, 'taxableValue', 'number')}
                            </td>
                            <td className="border-r border-slate-200 dark:border-slate-800 p-0 text-right font-bold text-slate-900 dark:text-white">
                              {renderCell(record, 'taxAmount', 'number')}
                            </td>
                            <td className="border-r border-slate-200 dark:border-slate-800 p-0 text-right font-black text-slate-905 dark:text-white bg-slate-50/20 dark:bg-slate-950/20">
                              {renderCell(record, 'totalAmount', 'number')}
                            </td>
                            <td className="border-r border-slate-200 dark:border-slate-800 py-1.5 text-center font-bold">
                              {renderStatusBadge(record)}
                            </td>
                            <td className="py-1 px-2 text-center">
                              <div className="flex items-center justify-center gap-1.5 text-slate-400 dark:text-slate-500">
                                <button
                                  onClick={() => handleDeleteRow(record.id)}
                                  className="p-1 hover:text-rose-500 dark:hover:text-rose-450 hover:bg-slate-100 dark:hover:bg-slate-850 rounded transition cursor-pointer"
                                  title="Delete Record Row"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={12} className="p-12 text-center text-slate-400 dark:text-slate-500 font-medium">
                          <div className="flex flex-col items-center justify-center gap-1">
                            <Info size={24} className="text-slate-300 dark:text-slate-700" />
                            <span>No spreadsheet records matched your query. Double-click cells to edit or add a row.</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Spreadsheet editing hint bar */}
              <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-500 flex justify-between items-center font-semibold">
                <div className="flex items-center gap-1.5 text-slate-450">
                  <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span>
                  <span>Spreadsheet Mode: Double-click any cell to edit details. Taxable/Tax/Total will auto-calculate!</span>
                </div>
                <div>
                  <span>Batch Status: <span className="font-extrabold uppercase text-blue-600">{activeBatch?.status || 'Pending Approval'}</span></span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer Navigation Page indices */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 shrink-0 pb-1 mt-1">
          <div className="text-slate-500 dark:text-slate-400 font-medium">
            Showing <span className="font-bold text-slate-900 dark:text-white">
              {((currentPage - 1) * itemsPerPage) + (selectedBatchId ? (filteredRecords.length > 0 ? 1 : 0) : (filteredBatches.length > 0 ? 1 : 0))}
            </span> to{' '}
            <span className="font-bold text-slate-900 dark:text-white">
              {Math.min(currentPage * itemsPerPage, selectedBatchId ? filteredRecords.length : filteredBatches.length)}
            </span>{' '}
            of <span className="font-bold text-slate-900 dark:text-white">
              {selectedBatchId ? filteredRecords.length : filteredBatches.length}
            </span> entries
            {!selectedBatchId && activeCategory === 'All' && search === '' && statusFilter === 'All Status' && (
              <span className="text-slate-400 text-xs"> (Filtered from 48 total)</span>
            )}
          </div>

          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="h-7 w-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-40 cursor-pointer"
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
                  className={`h-7 w-7 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white font-bold shadow-2xs'
                      : 'border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="h-7 w-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-40 cursor-pointer"
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
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <UploadCloud size={16} className="text-blue-500 animate-pulse" />
                  <span>Upload Batches (Excel / CSV)</span>
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
                    <p className="text-[12px] text-slate-500 dark:text-slate-400">Drag & drop spreadsheet files here or</p>

                    <div className="flex items-center gap-2 mt-4 flex-wrap justify-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={handleBrowse}
                        className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors shadow-sm cursor-pointer animate-pulse"
                      >
                        Choose File
                      </button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept=".csv, .xlsx, .xls"
                        className="hidden"
                      />
                      <button
                        type="button"
                        className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                        onClick={() => toast.info('Initiated importing batch folder')}
                      >
                        <FolderOpen size={13} />
                        <span>Folder Import</span>
                      </button>
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-400 dark:text-slate-500 text-center mt-3 leading-none">
                    Supports Microsoft Excel (.xlsx, .xls) and CSV (.csv) (Max 100MB)
                  </div>
                </div>

                {/* Right Side: Description & illustration */}
                <div className="flex items-center gap-6 bg-white dark:bg-slate-900">
                  <svg className="w-32 h-32 text-emerald-500/80 shrink-0" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="25" y="15" width="55" height="75" rx="8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 3" className="text-slate-255 dark:text-slate-755" />
                    <rect x="40" y="30" width="55" height="75" rx="8" fill="white" className="dark:fill-slate-800" stroke="currentColor" strokeWidth="1.8" />
                    {/* spreadsheet lines grid */}
                    <line x1="45" y1="46" x2="90" y2="46" stroke="currentColor" strokeWidth="1" strokeLinecap="round" className="text-slate-200 dark:text-slate-700" />
                    <line x1="45" y1="58" x2="90" y2="58" stroke="currentColor" strokeWidth="1" strokeLinecap="round" className="text-slate-200 dark:text-slate-700" />
                    <line x1="45" y1="70" x2="90" y2="70" stroke="currentColor" strokeWidth="1" strokeLinecap="round" className="text-slate-200 dark:text-slate-700" />
                    <line x1="45" y1="82" x2="90" y2="82" stroke="currentColor" strokeWidth="1" strokeLinecap="round" className="text-slate-200 dark:text-slate-700" />
                    <line x1="60" y1="38" x2="60" y2="95" stroke="currentColor" strokeWidth="1" strokeLinecap="round" className="text-slate-200 dark:text-slate-700" />
                    <line x1="75" y1="38" x2="75" y2="95" stroke="currentColor" strokeWidth="1" strokeLinecap="round" className="text-slate-200 dark:text-slate-700" />
                    <rect x="45" y="38" width="45" height="8" rx="1.5" fill="currentColor" className="text-emerald-100 dark:text-emerald-950/40" />
                  </svg>

                  <div className="flex flex-col">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2.5">
                      Batch Processing Features:
                    </h4>
                    <ul className="space-y-2">
                      <li className="flex items-start gap-2 text-slate-600 dark:text-slate-400">
                        <Check size={14} className="text-emerald-600 mt-0.5 shrink-0" />
                        <span>Excel & CSV validation rules</span>
                      </li>
                      <li className="flex items-start gap-2 text-slate-600 dark:text-slate-400">
                        <Check size={14} className="text-emerald-600 mt-0.5 shrink-0" />
                        <span>Interactive spreadsheet editor</span>
                      </li>
                      <li className="flex items-start gap-2 text-slate-600 dark:text-slate-400">
                        <Check size={14} className="text-emerald-600 mt-0.5 shrink-0" />
                        <span>Inline error detection</span>
                      </li>
                      <li className="flex items-start gap-2 text-slate-600 dark:text-slate-400">
                        <Check size={14} className="text-emerald-600 mt-0.5 shrink-0" />
                        <span>Direct Tally posting</span>
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
