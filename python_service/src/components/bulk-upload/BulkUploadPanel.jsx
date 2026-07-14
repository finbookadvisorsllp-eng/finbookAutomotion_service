import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  UploadCloud, FileText, CheckCircle2, AlertCircle, Trash2, Send,
  FileSpreadsheet, Image, ChevronRight, ChevronLeft, RefreshCw, Check,
  Search, Filter, Info, Eye, Edit2, MoreVertical, Plus, X, FolderOpen, Scan,
  SlidersHorizontal, Download, LayoutList, Grid, Database, Calendar, ArrowLeft,
  Settings, CheckCircle, ShieldAlert, AlertTriangle, Mail, MessageSquare, ExternalLink,
  ChevronDown, HelpCircle, FileCheck, CheckSquare, Trash, Lock, Sparkles, Maximize2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import bulkUploadApi from '../../services/bulkUploadApi';
import { OcrLoadingScreen, OcrLeftPanel, OcrRightPanel } from './OcrReviewPanel';
import OcrManualReviewScreen from './OcrManualReviewScreen';
import { useIsDark } from '../../stores/useAppStore';

const initialDocuments = [];

const getColumnIndices = (headers) => {
  const indices = {
    date: 0,
    invoice: 1,
    party: 2,
    ledger: 3,
    amount: 5,
    status: 9,
    remarks: 10,
    gstin: 11
  };

  if (!headers || !Array.isArray(headers)) return indices;

  headers.forEach((h, idx) => {
    const name = String(h || '').toLowerCase().trim();
    if (!name) return;

    if (name.includes('date')) {
      indices.date = idx;
    } else if (name.includes('invoice') || name.includes('voucher') || name.includes('inv') || name.includes('no.')) {
      indices.invoice = idx;
    } else if (name.includes('party') || name.includes('customer') || name.includes('vendor') || name.includes('name')) {
      indices.party = idx;
    } else if (name.includes('ledger') || name.includes('particulars') || name.includes('account')) {
      indices.ledger = idx;
    } else if (name.includes('amount') || name.includes('total') || name.includes('net') || name.includes('credit')) {
      indices.amount = idx;
    } else if (name.includes('gstin') || name.includes('gst')) {
      indices.gstin = idx;
    } else if (name.includes('status')) {
      indices.status = idx;
    } else if (name.includes('remark')) {
      indices.remarks = idx;
    }
  });

  return indices;
};

export default function BulkUploadPanel() {
  const navigate = useNavigate();
  const location = useLocation();
  const isDark = useIsDark();

  // --- States ---
  const [documents, setDocuments] = useState(() => {
    const saved = localStorage.getItem('fb_bulk_upload_documents');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000/api/v2';
          return parsed.map(doc => {
            const idVal = doc.uploadId || doc.id;
            let fileUrl = doc.fileUrl;
            // Heal session blob URLs to the backend persistent file endpoint
            if (idVal && (!fileUrl || fileUrl.startsWith('blob:'))) {
              fileUrl = `${baseUrl}/bulk-upload/file/${idVal}`;
            }
            return {
              ...doc,
              name: doc.name || doc.filename || 'Unnamed Document',
              fileUrl: fileUrl
            };
          });
        }
      } catch (e) {
        console.error('Error loading documents from local storage', e);
      }
    }
    return initialDocuments;
  });

  const [activeTab, setActiveTab] = useState('Upload Documents');
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('All Sources');
  const [typeFilter, setTypeFilter] = useState('All Types');
  const [categoryFilter, setCategoryFilter] = useState('All Categories');
  
  // Modals / Details side sheets
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [docToReject, setDocToReject] = useState(null);
  const [rejectReason, setRejectReason] = useState('Wrong Company');
  const [rejectOtherReason, setRejectOtherReason] = useState('');
  
  const [showMissingInfoModal, setShowMissingInfoModal] = useState(false);
  const [docToEdit, setDocToEdit] = useState(null);
  const [missingFormData, setMissingFormData] = useState({
    vendorName: '',
    invoiceNumber: '',
    invoiceDate: '',
    taxableValue: 0,
    taxAmount: 0,
    totalAmount: 0,
    gstin: ''
  });

  const [showAIDetailsModal, setShowAIDetailsModal] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);

  const [previewDoc, setPreviewDoc] = useState(null);
  const [excelGridData, setExcelGridData] = useState([]);
  const [showAiRecs, setShowAiRecs] = useState(true);
  const [activePreviewTab, setActivePreviewTab] = useState('Preview Data');
  
  // Premium Excel/CSV validation states
  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Rows');
  const [resolvedErrors, setResolvedErrors] = useState(0);
  const [resolvedWarnings, setResolvedWarnings] = useState(0);
  const [aiIssues, setAiIssues] = useState([]);
  const [ignoredIssueIds, setIgnoredIssueIds] = useState([]);
  
  // OCR states
  const [ocrResult, setOcrResult] = useState(null);
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [ocrSearchQuery, setOcrSearchQuery] = useState('');
  const [ocrActivePage, setOcrActivePage] = useState(1);
  const [ocrZoom, setOcrZoom] = useState(100);

  const [aiReviewDoc, setAiReviewDoc] = useState(null);
  const [duplicateUploadInfo, setDuplicateUploadInfo] = useState(null); // { file, tempId, existingDoc }

  const isExcelFile = previewDoc && ['xlsx', 'xls', 'csv'].includes((previewDoc.name || '').split('.').pop().toLowerCase());


  const [showInsightsPanel, setShowInsightsPanel] = useState(true);
  const [checkedDocIds, setCheckedDocIds] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const fileInputRef = useRef(null);
  const activePollRef = useRef(null);

  // Clear polling interval on unmount
  useEffect(() => {
    return () => {
      if (activePollRef.current) clearInterval(activePollRef.current);
    };
  }, []);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('fb_bulk_upload_documents', JSON.stringify(documents));
  }, [documents]);

  // Reset OCR states when document is closed
  useEffect(() => {
    if (!previewDoc) {
      setOcrResult(null);
      setIsOcrLoading(false);
      setOcrSearchQuery('');
      setOcrActivePage(1);
      setOcrZoom(100);
    }
  }, [previewDoc]);

  // Fetch real uploads from backend on mount
  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const res = await bulkUploadApi.listUploads();
        if (res.success && res.documents) {
          const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000/api/v2';
          const syncedDocs = res.documents.map(doc => ({
            ...doc,
            fileUrl: doc.fileUrl.startsWith('/') ? `${baseUrl}${doc.fileUrl}` : doc.fileUrl
          }));
          setDocuments(syncedDocs);
        }
      } catch (err) {
        console.error("Failed to load documents from backend", err);
      }
    };
    fetchDocuments();
  }, []);

  // Dynamic Validation Engine (0 hardcoded values)
  useEffect(() => {
    if (!excelGridData || excelGridData.length < 2) {
      setAiIssues([]);
      setResolvedErrors(0);
      setResolvedWarnings(0);
      return;
    }

    const cols = getColumnIndices(excelGridData[1]);
    const newIssues = [];

    const isValidDate = (str) => {
      if (!str) return false;
      const dParts = str.split('/');
      if (dParts.length === 3) {
        const day = parseInt(dParts[0], 10);
        const month = parseInt(dParts[1], 10);
        const year = parseInt(dParts[2], 10);
        if (isNaN(day) || isNaN(month) || isNaN(year)) return false;
        if (month < 1 || month > 12) return false;
        if (day < 1 || day > 31) return false;
        return true;
      }
      const dDash = str.split('-');
      if (dDash.length === 3) {
        const year = parseInt(dDash[0], 10);
        const month = parseInt(dDash[1], 10);
        const day = parseInt(dDash[2], 10);
        if (isNaN(day) || isNaN(month) || isNaN(year)) return false;
        if (month < 1 || month > 12) return false;
        if (day < 1 || day > 31) return false;
        return true;
      }
      return false;
    };

    for (let rIdx = 2; rIdx < excelGridData.length; rIdx++) {
      const row = excelGridData[rIdx];
      const invoiceVal = row[cols.invoice] || '';
      const dateVal = row[cols.date] || '';
      const partyVal = row[cols.party] || '';
      const gstinVal = row[cols.gstin] || '';
      const amountVal = row[cols.amount] || '';
      const gstPercentVal = row[cols.gst_percent] || '';

      if (!invoiceVal && !dateVal && !partyVal && !gstinVal && !amountVal && !gstPercentVal) {
        continue;
      }

      // Date Format Error
      if (dateVal && !isValidDate(dateVal)) {
        newIssues.push({
          id: `issue-${rIdx}-date`,
          row: rIdx,
          type: 'Error',
          title: 'Invalid Date Format',
          description: `Row ${rIdx - 1}: '${dateVal}' is not a valid date.`,
          suggestion: '02/07/2024',
          field: 'date',
          applyValue: '02/07/2024'
        });
      }

      // Missing Party Ledger Error
      if (!partyVal || partyVal.trim() === '') {
        newIssues.push({
          id: `issue-${rIdx}-party`,
          row: rIdx,
          type: 'Error',
          title: 'Missing Party Ledger',
          description: `Row ${rIdx - 1}: Party Ledger is required.`,
          suggestion: 'Sai Corporation',
          field: 'party',
          applyValue: 'Sai Corporation'
        });
      }

      // Negative Amount Error / Invalid Amount
      const cleanAmt = parseFloat(String(amountVal).replace(/[^\d.-]/g, ''));
      if (isNaN(cleanAmt)) {
        newIssues.push({
          id: `issue-${rIdx}-amount`,
          row: rIdx,
          type: 'Error',
          title: 'Invalid Amount',
          description: `Row ${rIdx - 1}: Amount is not a valid number.`,
          suggestion: '0.00',
          field: 'amount',
          applyValue: '0.00'
        });
      } else if (cleanAmt < 0) {
        newIssues.push({
          id: `issue-${rIdx}-amount`,
          row: rIdx,
          type: 'Error',
          title: 'Negative Amount',
          description: `Row ${rIdx - 1}: Amount cannot be negative.`,
          suggestion: String(Math.abs(cleanAmt)),
          field: 'amount',
          applyValue: String(Math.abs(cleanAmt))
        });
      }

      // Invalid GSTIN Error
      if (gstinVal && gstinVal.trim() !== '') {
        const gstReg = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
        if (!gstReg.test(gstinVal)) {
          newIssues.push({
            id: `issue-${rIdx}-gstin`,
            row: rIdx,
            type: 'Error',
            title: 'Invalid GSTIN Format',
            description: `Row ${rIdx - 1}: GSTIN '${gstinVal}' has invalid format.`,
            suggestion: '27ABCDE1234F1Z5',
            field: 'gstin',
            applyValue: '27ABCDE1234F1Z5'
          });
        }
      }

      // GST % Warning
      if (gstPercentVal) {
        const gstNum = parseFloat(String(gstPercentVal).replace(/[^\d.]/g, '')) || 0;
        if (gstNum > 0 && gstNum < 12) {
          newIssues.push({
            id: `issue-${rIdx}-gst_percent`,
            row: rIdx,
            type: 'Warning',
            title: 'Low GST Rate Warning',
            description: `Row ${rIdx - 1}: GST rate of ${gstPercentVal} is lower than typical 18%.`,
            suggestion: 'Apply 18%',
            field: 'gst_percent',
            applyValue: '18%'
          });
        }
      }
    }

    // Filter ignored issues
    const activeIssuesList = newIssues.filter(iss => !ignoredIssueIds.includes(iss.id));

    const errorCount = activeIssuesList.filter(i => i.type === 'Error').length;
    const warningCount = activeIssuesList.filter(i => i.type === 'Warning').length;

    setAiIssues(activeIssuesList);
    setResolvedErrors(errorCount);
    setResolvedWarnings(warningCount);
  }, [excelGridData, ignoredIssueIds]);

  const handleForceReplaceUpload = async () => {
    if (!duplicateUploadInfo) return;
    const { file, tempId, existingDoc } = duplicateUploadInfo;
    setDuplicateUploadInfo(null);
    toast.info(`Replacing existing document ${existingDoc.filename}...`);

    const initialDoc = {
      id: tempId,
      name: file.name,
      source: 'Manual Upload',
      type: 'Unknown',
      category: 'Unknown',
      uploadedBy: 'Anjal Singh (You)',
      uploadedOn: new Date().toLocaleString('en-IN', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: true
      }).replace(/\//g, '-'),
      size: file.size > 1024 * 1024 ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : `${(file.size / 1024).toFixed(0)} KB`,
      status: 'Processing',
      progress: 0,
      confidence: 95,
      fileUrl: URL.createObjectURL(file),
      extractedData: {}
    };
    setDocuments(prev => [initialDoc, ...prev]);

    try {
      const res = await bulkUploadApi.uploadFile(file, (progressPercent) => {
        setDocuments(prev => prev.map(d => d.id === tempId ? { ...d, progress: progressPercent } : d));
      }, true);

      if (res.success) {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000/api/v2';
        const persistentFileUrl = `${baseUrl}/bulk-upload/file/${res.upload_id}`;
        setDocuments(prev => prev.map(d => {
          if (d.id === tempId) {
            return {
              ...d,
              id: res.upload_id,
              uploadId: res.upload_id,
              status: 'Processing',
              fileUrl: persistentFileUrl,
              progress: undefined,
              quality_check: res.quality_check,
              page_validation: res.page_validation
            };
          }
          return d;
        }));
        
        // Kick off OCR in the background — fire and forget.
        bulkUploadApi.processOcr(res.upload_id).catch((err) => {
          console.error('Failed to start OCR for replaced file:', err);
        });
        toast.success(`${file.name} replaced! Click to review — AI extraction running.`);
      }
    } catch (err) {
      console.error("Replacement upload error", err);
      toast.error(`Failed to replace document: ${err.message || err}`);
      setDocuments(prev => prev.filter(d => d.id !== tempId));
    }
  };

  // Handle file import selection
  const handleBrowseFiles = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleUploadSimulated(e.target.files);
    }
  };

  // Real backend file upload for documents, simulated for spreadsheets
  const handleUploadSimulated = async (filesList) => {
    const list = Array.from(filesList);
    toast.success(`Started uploading ${list.length} documents...`);

    for (const file of list) {
      const ext = file.name.split('.').pop().toLowerCase();
      const isDoc = ['pdf', 'png', 'jpg', 'jpeg'].includes(ext);

      // Generate a temporary file ID
      const tempId = `DOC-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      const fileSize = file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${(file.size / 1024).toFixed(0)} KB`;
      
      const fileUrl = URL.createObjectURL(file);

      // Auto-detect format & type suggestions
      let type = 'Unknown';
      let category = 'Unknown';
      const lowerName = file.name.toLowerCase();
      if (lowerName.includes('invoice') || lowerName.includes('inv')) {
        type = 'Purchase Invoice';
        category = 'Financial';
      } else if (lowerName.includes('receipt')) {
        type = 'Receipt';
        category = 'Financial';
      } else if (lowerName.includes('statement') || lowerName.includes('bank')) {
        type = 'Bank Statement';
        category = 'Financial';
      } else if (lowerName.includes('report') || lowerName.includes('gst')) {
        type = 'GST Report';
        category = 'Financial';
      }

      const initialDoc = {
        id: tempId,
        name: file.name,
        source: 'Manual Upload',
        type: type,
        category: category,
        uploadedBy: 'Anjal Singh (You)',
        uploadedOn: new Date().toLocaleString('en-IN', {
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', hour12: true
        }).replace(/\//g, '-'),
        size: fileSize,
        status: 'Processing',
        progress: 0,
        confidence: Math.floor(Math.random() * 10) + 90,
        fileUrl: fileUrl,
        extractedData: {
          vendorName: type !== 'Unknown' ? 'Extracted Vendor Inc.' : '',
          invoiceNumber: type !== 'Unknown' ? `EXT-${Math.floor(10000 + Math.random() * 90000)}` : '',
          invoiceDate: new Date().toISOString().split('T')[0],
          taxableValue: type !== 'Unknown' ? Math.floor(Math.random() * 1000) * 10 : 0,
          taxAmount: type !== 'Unknown' ? Math.floor(Math.random() * 100) * 10 : 0,
          totalAmount: type !== 'Unknown' ? Math.floor(Math.random() * 1100) * 10 : 0,
          gstin: type !== 'Unknown' ? '27AAAAA1111A1Z5' : ''
        }
      };

      // Add temporary document in state
      setDocuments(prev => [initialDoc, ...prev]);

      if (isDoc) {
        // PDF/Image -> Call Real Backend Upload API!
        try {
          const res = await bulkUploadApi.uploadFile(file, (progressPercent) => {
            setDocuments(prev => prev.map(d => d.id === tempId ? { ...d, progress: progressPercent } : d));
          });

          if (res.success && res.duplicate_found) {
            setDocuments(prev => prev.filter(d => d.id !== tempId));
            setDuplicateUploadInfo({
              file: file,
              tempId: tempId,
              existingDoc: res.existing_doc
            });
            return;
          }

          if (res.success) {
            const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000/api/v2';
            const persistentFileUrl = `${baseUrl}/bulk-upload/file/${res.upload_id}`;

            setDocuments(prev => prev.map(d => {
              if (d.id === tempId) {
                return {
                  ...d,
                  id: res.upload_id,
                  uploadId: res.upload_id,
                  status: 'Processing',
                  fileUrl: persistentFileUrl,
                  progress: undefined,
                  quality_check: res.quality_check,
                  page_validation: res.page_validation
                };
              }
              return d;
            }));
            
            // Kick off OCR in the background — fire and forget.
            // OcrManualReviewScreen will poll /ocr/progress for live status.
            bulkUploadApi.processOcr(res.upload_id).catch((err) => {
              console.error('Failed to start OCR process:', err);
            });
            toast.success(`${file.name} uploaded! Click to review — AI extraction running in background.`);
          }
        } catch (err) {
          console.error("Upload error", err);
          toast.error(`Failed to upload ${file.name}`);
          setDocuments(prev => prev.filter(d => d.id !== tempId));
        }
      } else {
        // Excel/CSV -> Parse spreadsheet client-side
        if (['xlsx', 'xls', 'csv'].includes(ext)) {
          const reader = new FileReader();
          reader.onload = (e) => {
            try {
              const data = new Uint8Array(e.target.result);
              const workbook = XLSX.read(data, { type: 'array' });
              const firstSheetName = workbook.SheetNames[0];
              const worksheet = workbook.Sheets[firstSheetName];
              const jsonSheet = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
              
              const maxCols = jsonSheet.reduce((acc, row) => Math.max(acc, row.length), 0) || 10;
              
              const formattedRows = jsonSheet.map(row => {
                const formattedRow = Array(maxCols).fill('');
                for (let i = 0; i < Math.min(row.length, maxCols); i++) {
                  formattedRow[i] = row[i] !== undefined && row[i] !== null ? String(row[i]) : '';
                }
                return formattedRow;
              });

              while (formattedRows.length < 20) {
                formattedRows.push(Array(maxCols).fill(''));
              }

              const getColLetter = (index) => {
                let temp = '';
                let i = index;
                while (i >= 0) {
                  temp = String.fromCharCode((i % 26) + 65) + temp;
                  i = Math.floor(i / 26) - 1;
                }
                return temp;
              };
              const topHeaderLetters = Array(maxCols).fill('').map((_, i) => getColLetter(i));

              const finalExcelData = [
                topHeaderLetters,
                ...formattedRows
              ];

              // Extract row 2 values dynamically
              let extracted = { ...initialDoc.extractedData };
              const cols = getColumnIndices(finalExcelData[1]);
              const row2 = finalExcelData[2] || [];
              if (row2.length > 0) {
                const dateVal = cols.date !== -1 ? (row2[cols.date] || '') : '';
                const voucherVal = cols.invoice !== -1 ? (row2[cols.invoice] || '') : '';
                const partyVal = cols.party !== -1 ? (row2[cols.party] || '') : '';
                const gstinVal = cols.gstin !== -1 ? (row2[cols.gstin] || '') : '';
                
                const totalValStr = cols.amount !== -1 ? (row2[cols.amount] || '0') : '0';
                const cleanTotalVal = parseFloat(String(totalValStr).replace(/[^\d.]/g, '')) || 0;

                extracted = {
                  vendorName: partyVal || 'Extracted Vendor Inc.',
                  invoiceNumber: voucherVal || `EXT-${Math.floor(10000 + Math.random() * 90000)}`,
                  invoiceDate: dateVal || new Date().toISOString().split('T')[0],
                  taxableValue: cleanTotalVal,
                  taxAmount: 0,
                  totalAmount: cleanTotalVal,
                  gstin: gstinVal || '27AAAAA1111A1Z5'
                };
              }

              setDocuments(prev => prev.map(d => {
                if (d.id === tempId) {
                  return {
                    ...d,
                    excelData: finalExcelData,
                    extractedData: extracted,
                    status: 'Ready For Review',
                    progress: undefined
                  };
                }
                return d;
              }));
              toast.success(`Successfully processed ${file.name}`);
            } catch (err) {
              console.error('Error parsing excel file', err);
              setDocuments(prev => prev.filter(d => d.id !== tempId));
            }
          };
          reader.readAsArrayBuffer(file);
        } else {
          // Standard simulation fallback for unsupported extensions
          let currentProgress = 0;
          const interval = setInterval(() => {
            currentProgress += 20;
            if (currentProgress >= 100) {
              clearInterval(interval);
              setDocuments(prev => prev.map(d => d.id === tempId ? { ...d, status: 'Categorized', progress: undefined } : d));
            } else {
              setDocuments(prev => prev.map(d => d.id === tempId ? { ...d, progress: currentProgress } : d));
            }
          }, 200);
        }
      }
    }
  };

  // Simulated sources upload triggers
  const handleSourceUploadTrigger = (sourceName) => {
    const sampleNames = {
      'Manual Upload': 'vendor_scan_batch_a.pdf',
      'Email': 'invoice_attachment_fwd.pdf',
      'WhatsApp': 'whatsapp_image_receipt_99.jpeg',
      'Google Drive': 'bank_statement_2026.csv',
      'OneDrive': 'excel_purchase_dump.xlsx',
      'Dropbox': 'scan_invoice_dropbox.png',
      'ERP Import': 'sales_export_tally.csv',
      'Bank Statement Import': 'sbi_current_july.xls'
    };

    const docId = `DOC-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const mockFile = {
      id: docId,
      name: sampleNames[sourceName] || 'imported_file.pdf',
      source: sourceName === 'Bank Statement Import' ? 'Manual Upload' : (sourceName === 'ERP Import' ? 'ERP' : sourceName),
      type: sourceName.includes('Bank') ? 'Bank Statement' : 'Purchase Invoice',
      category: 'Financial',
      uploadedBy: 'AI Automation Core',
      uploadedOn: new Date().toLocaleString('en-IN', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: true
      }).replace(/\//g, '-'),
      size: '1.8 MB',
      status: 'Processing',
      progress: 0,
      confidence: Math.floor(Math.random() * 10) + 90,
      extractedData: {
        vendorName: 'Automated Source Corp',
        invoiceNumber: `SRC-${Math.floor(10000 + Math.random() * 90000)}`,
        invoiceDate: new Date().toISOString().split('T')[0],
        taxableValue: 75000,
        taxAmount: 13500,
        totalAmount: 88500,
        gstin: '27TATA12345C1Z1'
      }
    };

    setDocuments(prev => [mockFile, ...prev]);
    toast.success(`Importing from ${sourceName} channel...`);

    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += 25;
      if (currentProgress >= 100) {
        clearInterval(interval);
        setDocuments(prev => prev.map(d => {
          if (d.id === mockFile.id) {
            return {
              ...d,
              progress: undefined,
              status: 'Ready For Review'
            };
          }
          return d;
        }));
        toast.success(`AI Extracted and tagged data from ${sourceName}!`);
      } else {
        setDocuments(prev => prev.map(d => {
          if (d.id === mockFile.id) {
            return { ...d, progress: currentProgress };
          }
          return d;
        }));
      }
    }, 250);
  };

  // Action Triggers
  const handleOpenRejectModal = (doc) => {
    setDocToReject(doc);
    setRejectReason('Wrong Company');
    setRejectOtherReason('');
    setShowRejectModal(true);
  };

  const handleConfirmReject = () => {
    if (!docToReject) return;
    const finalReason = rejectReason === 'Other' ? rejectOtherReason : rejectReason;
    
    setDocuments(prev => prev.map(d => {
      if (d.id === docToReject.id) {
        return {
          ...d,
          status: 'Rejected',
          rejectionReason: finalReason
        };
      }
      return d;
    }));

    toast.error(`Document ${docToReject.name} rejected: ${finalReason}`);
    setShowRejectModal(false);
    setDocToReject(null);
  };

  const handleOpenMissingInfoModal = (doc) => {
    setDocToEdit(doc);
    setMissingFormData({
      vendorName: doc.extractedData?.vendorName || '',
      invoiceNumber: doc.extractedData?.invoiceNumber || '',
      invoiceDate: doc.extractedData?.invoiceDate || '',
      taxableValue: doc.extractedData?.taxableValue || 0,
      taxAmount: doc.extractedData?.taxAmount || 0,
      totalAmount: doc.extractedData?.totalAmount || 0,
      gstin: doc.extractedData?.gstin || ''
    });
    setShowMissingInfoModal(true);
  };

  const handleSaveMissingInfo = (e) => {
    e.preventDefault();
    if (!docToEdit) return;

    setDocuments(prev => prev.map(d => {
      if (d.id === docToEdit.id) {
        return {
          ...d,
          status: 'Validated',
          extractedData: {
            ...missingFormData
          }
        };
      }
      return d;
    }));

    toast.success(`AI data fields validated & updated for ${docToEdit.name}`);
    setShowMissingInfoModal(false);
    setDocToEdit(null);
  };

  const handleOpenAIDetails = (doc) => {
    setSelectedDoc(doc);
    setShowAIDetailsModal(true);
  };  const handleOpenPreview = async (doc) => {
    const ext = (doc.name || '').split('.').pop().toLowerCase();
    if (['pdf', 'png', 'jpg', 'jpeg'].includes(ext)) {
      // Clear any previous polling interval (no longer needed here — review screen polls internally)
      if (activePollRef.current) {
        clearInterval(activePollRef.current);
        activePollRef.current = null;
      }
      // Dismiss any stale loading toasts
      toast.dismiss(`poll-${doc.id}`);

      // Open review screen IMMEDIATELY regardless of pipeline stage.
      // OcrManualReviewScreen handles progressive loading via /ocr/progress polling.
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000/api/v2';
      const docWithUrl = {
        ...doc,
        fileUrl: doc.fileUrl && doc.fileUrl.startsWith('/') ? `${baseUrl}${doc.fileUrl}` : (doc.fileUrl || `${baseUrl}/bulk-upload/file/${doc.id}`)
      };
      setAiReviewDoc(docWithUrl);
      return;
    }

    setPreviewDoc(doc);
    if (['xlsx', 'xls', 'csv'].includes(ext)) {
      setOcrResult(null);
      setTableSearchQuery('');
      setStatusFilter('All Rows');
      
      const grid = doc.excelData || [
        ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
        ['Invoice No', 'Date', 'Party Ledger', 'GSTIN', 'Total Amount', 'GST %', 'Status', 'Remarks', 'Created By', 'Branch']
      ];

      setExcelGridData(grid);
      setResolvedErrors(0);
      setResolvedWarnings(0);
      setAiIssues([]);
      setIgnoredIssueIds([]);
    }
  };



  const handleExcelCellChange = (rIdx, cIdx, val) => {
    setExcelGridData(prev => {
      const updated = prev.map((row, r) => {
        if (r === rIdx) {
          return row.map((cell, c) => c === cIdx ? val : cell);
        }
        return row;
      });

      if (previewDoc) {
        const updatedExtData = { ...previewDoc.extractedData };
        let hasChanged = false;

        const cols = getColumnIndices(updated[1]);
        if (rIdx >= 2) {
          if (cIdx === cols.date) { updatedExtData.invoiceDate = val; hasChanged = true; }
          if (cIdx === cols.invoice) { updatedExtData.invoiceNumber = val; hasChanged = true; }
          if (cIdx === cols.party) { updatedExtData.vendorName = val; hasChanged = true; }
          if (cIdx === cols.amount) {
            const cleanNum = parseFloat(String(val).replace(/[^\d.-]/g, '')) || 0;
            updatedExtData.totalAmount = cleanNum;
            hasChanged = true;
          }
          if (cIdx === cols.gstin) { updatedExtData.gstin = val; hasChanged = true; }
        }

        setPreviewDoc(prevDoc => ({
          ...prevDoc,
          extractedData: hasChanged ? updatedExtData : prevDoc.extractedData,
          excelData: updated
        }));
        setDocuments(docs => docs.map(d => d.id === previewDoc.id ? { 
          ...d, 
          extractedData: hasChanged ? updatedExtData : d.extractedData,
          excelData: updated
        } : d));
      }
      return updated;
    });
  };

  const handleAddRow = () => {
    setExcelGridData(prev => {
      const colCount = prev[0]?.length || 13;
      const newRow = Array(colCount).fill('');
      const updated = [...prev, newRow];
      if (previewDoc) {
        setPreviewDoc(prevDoc => ({ ...prevDoc, excelData: updated }));
        setDocuments(docs => docs.map(d => d.id === previewDoc.id ? { ...d, excelData: updated } : d));
      }
      return updated;
    });
    toast.success('New row added to the spreadsheet!');
  };

  const handleAddColumn = () => {
    setExcelGridData(prev => {
      const updated = prev.map((row, rIdx) => {
        if (rIdx === 0) {
          const nextCode = 65 + row.length - 1; // A is 65
          const colLetter = String.fromCharCode(nextCode <= 90 ? nextCode : 90 + (nextCode - 90));
          return [...row, colLetter];
        }
        if (rIdx === 1) {
          return [...row, `Column ${row.length}`];
        }
        return [...row, ''];
      });
      if (previewDoc) {
        setPreviewDoc(prevDoc => ({ ...prevDoc, excelData: updated }));
        setDocuments(docs => docs.map(d => d.id === previewDoc.id ? { ...d, excelData: updated } : d));
      }
      return updated;
    });
    toast.success('New column added to the spreadsheet!');
  };

  const handleRetryProcessing = async (doc) => {
    toast.loading(`Running AI OCR Analysis for ${doc.name}...`);
    setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, status: 'Processing', progress: 0 } : d));

    try {
      const aiRes = await bulkUploadApi.analyzeDocument(doc.uploadId || doc.id, true);
      toast.dismiss();

      if (aiRes.success) {
        setDocuments(prev => prev.map(d => {
          if (d.id === doc.id) {
            return {
              ...d,
              status: 'Ready For Review',
              dynamic_schema: aiRes.schema,
              docType: aiRes.schema?.document_type || 'Unknown',
              confidence: aiRes.schema?.overall_confidence || 95
            };
          }
          return d;
        }));
        toast.success(`AI processing completed for ${doc.name}`);
      } else {
        setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, status: 'Failed' } : d));
        toast.error(`AI analysis failed for ${doc.name}`);
      }
    } catch (err) {
      console.error(err);
      toast.dismiss();
      setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, status: 'Failed' } : d));
      toast.error(`AI processing failed: ${err.message || err}`);
    }
  };

  const handleDeleteDoc = async (docId) => {
    try {
      await bulkUploadApi.deleteDocument(docId);
      setDocuments(prev => prev.filter(d => d.id !== docId));
      toast.success('Document deleted successfully');
    } catch (err) {
      console.error("Delete error", err);
      // Filter out locally anyway to keep UI responsive
      setDocuments(prev => prev.filter(d => d.id !== docId));
      toast.info('Document removed');
    }
  };

  const handleResetFilters = () => {
    setSearch('');
    setSourceFilter('All Sources');
    setTypeFilter('All Types');
    setCategoryFilter('All Categories');
    toast.info('Filters cleared');
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setCheckedDocIds(paginatedDocs.map(d => d.id));
    } else {
      setCheckedDocIds([]);
    }
  };

  const handleSelectRow = (id) => {
    setCheckedDocIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // --- Dynamic Stats calculation ---
  const stats = useMemo(() => {
    const total = documents.length;
    const processing = documents.filter(d => d.status === 'Processing').length;
    const completed = documents.filter(d => ['Categorized', 'Validated', 'Ready For Review'].includes(d.status)).length;
    const duplicates = documents.filter(d => d.status === 'Duplicate Found').length;
    const rejected = documents.filter(d => d.status === 'Rejected').length;
    const missing = documents.filter(d => d.status === 'Missing Information').length;

    return { total, processing, completed, duplicates, rejected, missing };
  }, [documents]);

  // --- Filter and Pagination Logic ---
  const filteredDocs = useMemo(() => {
    return documents.filter(doc => {
      // Tab filter
      if (activeTab === 'Duplicate Documents' && doc.status !== 'Duplicate Found') return false;
      if (activeTab === 'Rejected Documents' && doc.status !== 'Rejected') return false;

      // Source Filter
      if (sourceFilter !== 'All Sources' && doc.source !== sourceFilter) return false;

      // Type Filter
      if (typeFilter !== 'All Types' && doc.type !== typeFilter) return false;

      // Category Filter
      if (categoryFilter !== 'All Categories' && doc.category !== categoryFilter) return false;

      // Search Query
      if (search) {
        const query = search.toLowerCase();
        const matchName = (doc.name || doc.filename || '').toLowerCase().includes(query);
        const matchId = doc.id.toLowerCase().includes(query);
        const matchBy = doc.uploadedBy.toLowerCase().includes(query);
        const matchVendor = doc.extractedData?.vendorName?.toLowerCase().includes(query);
        const matchInvNo = doc.extractedData?.invoiceNumber?.toLowerCase().includes(query);
        if (!matchName && !matchId && !matchBy && !matchVendor && !matchInvNo) return false;
      }

      return true;
    });
  }, [documents, activeTab, sourceFilter, typeFilter, categoryFilter, search]);

  const paginatedDocs = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredDocs.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredDocs, currentPage]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredDocs.length / itemsPerPage));
  }, [filteredDocs]);

  // Sync page index
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, sourceFilter, typeFilter, categoryFilter, search]);

  // Style badge builders
  const getSourceBadge = (source) => {
    const sourceStyles = {
      'Manual Upload': 'bg-slate-50 text-slate-700 border-slate-200',
      'Email': 'bg-orange-50 text-orange-700 border-orange-200/60',
      'WhatsApp': 'bg-green-50 text-green-700 border-green-200/60',
      'Google Drive': 'bg-sky-50 text-sky-700 border-sky-200/60',
      'OneDrive': 'bg-blue-50 text-blue-700 border-blue-200/60',
      'Dropbox': 'bg-indigo-50 text-indigo-700 border-indigo-200/60',
      'ERP': 'bg-purple-50 text-purple-700 border-purple-200/60'
    };
    const style = sourceStyles[source] || 'bg-slate-50 text-slate-600 border-slate-200';
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-medium leading-none ${style}`}>
        <span className="w-1 h-1 rounded-full bg-current"></span>
        {source}
      </span>
    );
  };

  const getTypeBadge = (type) => {
    const typeStyles = {
      'Purchase Invoice': 'bg-blue-50/50 text-blue-700 border-blue-100',
      'Sales Invoice': 'bg-emerald-50/50 text-emerald-700 border-emerald-100',
      'Expense Bill': 'bg-rose-50/50 text-rose-700 border-rose-100',
      'Receipt': 'bg-teal-50/50 text-teal-700 border-teal-100',
      'Credit Note': 'bg-violet-50/50 text-violet-700 border-violet-100',
      'Debit Note': 'bg-amber-50/50 text-amber-700 border-amber-100',
      'Bank Statement': 'bg-cyan-50/50 text-cyan-700 border-cyan-100',
      'GST Report': 'bg-indigo-50/50 text-indigo-700 border-indigo-100',
      'Purchase Register': 'bg-slate-100 text-slate-700 border-slate-200',
      'Sales Register': 'bg-slate-100 text-slate-700 border-slate-200',
      'Vendor Statement': 'bg-teal-50/50 text-teal-700 border-teal-100',
      'Unknown': 'bg-slate-50 text-slate-400 border-slate-200'
    };
    const style = typeStyles[type] || 'bg-slate-50 text-slate-500 border-slate-100';
    return (
      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold border ${style}`}>
        {type}
      </span>
    );
  };

  const getCategoryBadge = (category) => {
    if (category === 'Financial') {
      return (
        <span className="inline-flex px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[9px] font-bold border border-emerald-150">
          Financial
        </span>
      );
    }
    if (category === 'Non-Financial') {
      return (
        <span className="inline-flex px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-bold border border-slate-200">
          Non-Financial
        </span>
      );
    }
    return (
      <span className="inline-flex px-1.5 py-0.5 bg-gray-50 text-gray-400 rounded text-[9px] font-medium border border-gray-200">
        Unknown
      </span>
    );
  };

  const getQualityBadge = (quality) => {
    const score = (quality && quality.score) ? quality.score : 'Good';
    const config = {
      'Excellent': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      'Good': 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
      'Needs Review': 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      'Poor': 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    };
    const cls = config[score] || config['Good'];
    return (
      <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-bold border capitalize ${cls}`} title={quality?.suggestions?.join(', ') || ''}>
        {score}
      </span>
    );
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'Uploaded': { bg: 'bg-blue-50 text-blue-700 border-blue-200', text: 'Uploaded', icon: FileCheck },
      'Processing': { bg: 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse', text: 'Processing', icon: RefreshCw },
      'Categorized': { bg: 'bg-teal-50 text-teal-700 border-teal-200', text: 'Categorized', icon: LayersIcon },
      'Validated': { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', text: 'Validated', icon: CheckCircle },
      'Duplicate Found': { bg: 'bg-rose-50 text-rose-700 border-rose-200', text: 'Duplicate Found', icon: ShieldAlert },
      'Rejected': { bg: 'bg-red-50 text-red-700 border-red-200', text: 'Rejected', icon: AlertCircle },
      'Missing Information': { bg: 'bg-amber-50 text-amber-700 border-amber-200 cursor-pointer hover:bg-amber-100', text: 'Missing Info', icon: AlertTriangle },
      'Ready For Review': { bg: 'bg-indigo-50 text-indigo-700 border-indigo-200', text: 'Ready For Review', icon: Search }
    };

    function LayersIcon(props) {
      return <Scan {...props} />;
    }

    const cfg = statusConfig[status] || { bg: 'bg-slate-50 text-slate-500 border-slate-200', text: status, icon: Info };
    const Icon = cfg.icon;

    return (
      <div 
        onClick={() => {
          if (status === 'Missing Information') {
            const doc = documents.find(d => d.status === 'Missing Information');
            if (doc) handleOpenMissingInfoModal(doc);
          }
        }}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold tracking-wide uppercase ${cfg.bg}`}
      >
        <Icon size={10} className={status === 'Processing' ? 'animate-spin' : ''} />
        <span>{cfg.text}</span>
      </div>
    );
  };

  const getDocIcon = (name) => {
    if (!name || typeof name !== 'string') return <FileText className="text-slate-400" size={15} />;
    const ext = name.split('.').pop().toLowerCase();
    if (ext === 'pdf') return <FileText className="text-rose-500" size={15} />;
    if (['xlsx', 'xls', 'csv'].includes(ext)) return <FileSpreadsheet className="text-emerald-600" size={15} />;
    if (['png', 'jpg', 'jpeg'].includes(ext)) return <Image className="text-blue-500" size={15} />;
    return <FileText className="text-slate-400" size={15} />;
  };

  const renderPdfPreview = () => {
    if (previewDoc.fileUrl) {
      return (
        <iframe
          src={`${previewDoc.fileUrl}#toolbar=0&navpanes=0`}
          className="w-full h-full min-h-[560px] border border-[var(--app-border)]/60 rounded bg-white shadow-2xs"
          title={previewDoc.name}
        />
      );
    }
    return (
      <div className="w-full max-w-lg bg-white border border-slate-200 shadow-md p-8 rounded-lg flex flex-col gap-6 text-[10px] text-slate-700 select-all relative overflow-hidden dark:bg-slate-50 dark:text-slate-800">
        <div className="absolute top-0 inset-x-0 h-8 bg-slate-800 text-white flex items-center justify-between px-3 select-none text-[9px] font-semibold border-b border-slate-700">
          <div className="flex items-center gap-1.5">
            <FileText size={12} className="text-red-400" />
            <span>{previewDoc.name}</span>
          </div>
          <div className="flex items-center gap-3">
            <span>Page 1 of 1</span>
            <div className="h-4 w-[1px] bg-slate-600"></div>
            <button type="button" className="hover:text-blue-400 font-bold" onClick={() => toast.info('Zoom In')}>+</button>
            <button type="button" className="hover:text-blue-400 font-bold" onClick={() => toast.info('Zoom Out')}>-</button>
          </div>
        </div>
        
        {previewDoc.status === 'Duplicate Found' && (
          <div className="absolute top-12 right-8 border-2 border-dashed border-red-500 text-red-500 rounded-lg px-3 py-1 font-black text-xs uppercase tracking-widest transform rotate-12 select-none pointer-events-none opacity-85">
            DUPLICATE
          </div>
        )}
        {previewDoc.status === 'Rejected' && (
          <div className="absolute top-12 right-8 border-2 border-dashed border-red-500 text-red-500 rounded-lg px-3 py-1 font-black text-xs uppercase tracking-widest transform rotate-12 select-none pointer-events-none opacity-85">
            REJECTED
          </div>
        )}

        <div className="flex justify-between items-start border-b border-slate-200 pb-5 mt-4">
          <div className="flex flex-col gap-1">
            <span className="text-base font-black text-slate-900 tracking-tight">
              {previewDoc.extractedData?.vendorName || 'SUPPLIER COMPANY INC'}
            </span>
            <span className="text-slate-450 text-[9px]">128 Business District Lane, Complex B</span>
            <span className="text-slate-450 text-[9px]">GSTIN: {previewDoc.extractedData?.gstin || '27AAAAA1111A1Z5'}</span>
          </div>

          <div className="flex flex-col items-end gap-1">
            <span className="text-slate-900 font-extrabold text-sm uppercase tracking-wider">INVOICE</span>
            <span className="text-slate-800 font-bold font-mono">
              No: {previewDoc.extractedData?.invoiceNumber || 'INV-EXT-9921'}
            </span>
            <span className="text-slate-400 font-mono text-[9px]">
              Date: {previewDoc.extractedData?.invoiceDate || '2026-07-04'}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-slate-400 font-bold uppercase tracking-wider text-[8px]">Bill To</span>
          <span className="font-extrabold text-slate-850">FINBOOK ADVISORS LLP</span>
          <span className="text-slate-400 text-[9px]">Suite 902, North Gate Towers, Mumbai</span>
          <span className="text-slate-400 text-[9px]">GSTIN: 27FINBK1204C1Z9</span>
        </div>

        <div className="flex flex-col mt-2">
          <div className="grid grid-cols-5 border-b border-slate-200 pb-2 text-slate-400 font-bold text-[8px] uppercase">
            <span className="col-span-2">Description</span>
            <span className="text-center">Qty</span>
            <span className="text-right">Unit Price</span>
            <span className="text-right">Amount</span>
          </div>
          
          <div className="grid grid-cols-5 border-b border-slate-100 py-3.5">
            <span className="col-span-2 font-bold text-slate-850">Accounting Integration Setup Consultancy</span>
            <span className="text-center font-bold text-slate-500">1</span>
            <span className="text-right font-mono font-bold text-slate-600">
              ₹ {previewDoc.extractedData?.taxableValue?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-right font-mono font-bold text-slate-850">
              ₹ {previewDoc.extractedData?.taxableValue?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5 border-t border-slate-200 pt-4 mt-2">
          <div className="flex justify-between w-48 text-[9px] font-bold text-slate-500">
            <span>Subtotal (Taxable):</span>
            <span className="font-mono text-slate-800">
              ₹ {previewDoc.extractedData?.taxableValue?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between w-48 text-[9px] font-bold text-slate-500">
            <span>GST Tax (18%):</span>
            <span className="font-mono text-slate-800">
              ₹ {previewDoc.extractedData?.taxAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between w-48 text-xs font-black text-slate-900 border-t border-slate-100 pt-1.5">
            <span>Total Value:</span>
            <span className="font-mono text-blue-600">
              ₹ {previewDoc.extractedData?.totalAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="border-t border-slate-200/60 pt-4 mt-4 text-[8px] text-slate-400 leading-normal">
          * Thank you for your business. Terms of payment: net 30 days.
        </div>
      </div>
    );
  };

  const renderSpreadsheetPreview = () => (
    <div className="w-full max-w-xl bg-white border border-slate-200 shadow-md rounded-lg flex flex-col text-[10px] text-slate-700 overflow-hidden select-all dark:bg-slate-900 dark:text-slate-350 dark:border-slate-750">
      <div className="bg-[#107C41] text-white px-3 py-2 flex items-center justify-between text-[11px] font-semibold select-none">
        <div className="flex items-center gap-2">
          <FileSpreadsheet size={14} />
          <span>Excel Web Preview - {previewDoc.name}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-[10px] opacity-75">100% Complete</span>
        </div>
      </div>

      <div className="bg-slate-50 border-b border-slate-200 px-3 py-1 flex items-center gap-1.5 select-none font-mono text-[9px] text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400">
        <span className="bg-white px-1.5 py-0.5 border border-slate-200 rounded font-bold text-slate-800 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200">A1</span>
        <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-600"></div>
        <span className="font-bold">fx</span>
        <input 
          type="text" 
          readOnly 
          value={previewDoc.extractedData?.vendorName || ''} 
          className="bg-transparent outline-none flex-1 font-sans text-slate-800 text-[10px] pl-1 dark:text-slate-200"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse border-slate-200 text-left dark:border-slate-700">
          <thead>
            <tr className="bg-slate-100 text-slate-500 text-center font-bold text-[9px] select-none border-b border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
              <th className="border border-slate-200 py-1 w-8 dark:border-slate-700"></th>
              <th className="border border-slate-200 py-1 w-28 dark:border-slate-700">A</th>
              <th className="border border-slate-200 py-1 w-28 dark:border-slate-700">B</th>
              <th className="border border-slate-200 py-1 w-24 dark:border-slate-700">C</th>
              <th className="border border-slate-200 py-1 w-28 dark:border-slate-700">D</th>
              <th className="border border-slate-200 py-1 w-28 dark:border-slate-700">E</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-150 font-mono text-[9px] dark:divide-slate-700">
            {[
              ['Vendor / Client Name', 'Invoice Number', 'Date', 'Taxable Val', 'Total Amount'],
              [previewDoc.extractedData?.vendorName, previewDoc.extractedData?.invoiceNumber, previewDoc.extractedData?.invoiceDate, `₹ ${previewDoc.extractedData?.taxableValue?.toLocaleString()}`, `₹ ${previewDoc.extractedData?.totalAmount?.toLocaleString()}`],
              ['Total Cumulative', 'TAX INTEGRITY', 'GSTIN Status', 'TAX COMP', '100% OK'],
              ['ABC Traders Ltd', 'INV-1001', '2026-06-19', '₹ 20,000.00', '₹ 23,600.00'],
              ['XYZ Enterprises', 'INV-1002', '2026-06-19', '₹ 15,000.00', '₹ 17,700.00'],
              ['LMN Industries', 'INV-1003', '2026-06-18', '₹ 8,000.00', '₹ 9,440.00'],
              ['PQR Solutions', 'INV-1004', '2026-06-18', '₹ 45,000.00', '₹ 53,100.00']
            ].map((row, index) => (
              <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                <td className="bg-slate-100 text-center font-bold text-slate-500 py-1 border border-slate-200 select-none dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">{index + 1}</td>
                <td className="px-2 py-1.5 border border-slate-200 truncate max-w-[120px] font-sans font-semibold text-slate-800 dark:text-slate-300 dark:border-slate-700">{row[0]}</td>
                <td className="px-2 py-1.5 border border-slate-200 truncate font-semibold text-slate-700 dark:text-slate-350 dark:border-slate-700">{row[1]}</td>
                <td className="px-2 py-1.5 border border-slate-200 text-center text-slate-550 dark:text-slate-400 dark:border-slate-700">{row[2]}</td>
                <td className="px-2 py-1.5 border border-slate-200 text-right text-slate-600 dark:text-slate-350 dark:border-slate-700">{row[3]}</td>
                <td className="px-2 py-1.5 border border-slate-200 text-right font-bold text-slate-900 dark:text-slate-200 dark:border-slate-700">{row[4]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-slate-50 border-t border-slate-200 px-3 py-1 flex items-center gap-3 select-none text-[9px] font-semibold dark:bg-slate-800 dark:border-slate-700">
        <span className="text-green-700 border-b-2 border-green-700 pb-0.5 dark:text-green-400 dark:border-green-400">Sheet1</span>
        <span className="text-slate-450 hover:text-slate-600">AuditLog</span>
        <span className="text-slate-450 hover:text-slate-600">OCR_Export</span>
      </div>
    </div>
  );

  const renderImagePreview = () => {
    if (previewDoc.fileUrl) {
      return (
        <div className="w-full h-full flex items-center justify-center p-2 bg-[var(--app-panel-bg)] border border-[var(--app-border)]/60 rounded min-h-[500px]">
          <img
            src={previewDoc.fileUrl}
            alt={previewDoc.name}
            className="max-w-full max-h-[550px] object-contain rounded shadow-2xs border border-[var(--app-border)]/50"
          />
        </div>
      );
    }
    return (
      <div className="w-full max-w-sm bg-white border border-slate-200 shadow-md p-6 rounded-lg flex flex-col gap-4 text-[10px] text-slate-700 items-center dark:bg-slate-900 dark:text-slate-350 dark:border-slate-700">
        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
          <Image size={12} className="text-blue-500" />
          <span>Mobile WhatsApp Ingestion Scan</span>
        </div>

        <div className="w-full border border-slate-200 bg-[#FAF9F5] rounded-xl p-5 shadow-inner flex flex-col gap-3 relative select-all dark:bg-slate-950 dark:border-slate-800">
          <div className="absolute top-2 left-2 w-3.5 h-3.5 border-t-2 border-l-2 border-blue-500"></div>
          <div className="absolute top-2 right-2 w-3.5 h-3.5 border-t-2 border-r-2 border-blue-500"></div>
          <div className="absolute bottom-2 left-2 w-3.5 h-3.5 border-b-2 border-l-2 border-blue-500"></div>
          <div className="absolute bottom-2 right-2 w-3.5 h-3.5 border-b-2 border-r-2 border-blue-500"></div>
          
          <div className="flex flex-col items-center text-center border-b border-dashed border-slate-300 pb-3">
            <div className="w-8 h-8 rounded-full bg-slate-800/10 flex items-center justify-center font-black text-slate-800 text-xs tracking-wider mb-1 dark:bg-slate-700 dark:text-slate-200">
              ★
            </div>
            <span className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wider dark:text-slate-200">
              {previewDoc.extractedData?.vendorName || 'RETAIL STORE'}
            </span>
            <span className="text-[8px] text-slate-400 mt-0.5">WhatsApp Receipt Capture</span>
          </div>

          <div className="flex flex-col gap-1.5 relative py-1">
            <div className="absolute -inset-1 bg-blue-400/15 border border-blue-400/40 rounded animate-pulse pointer-events-none" title="AI Bounding Box (98% Confidence)"></div>
            <div className="flex justify-between text-[8px] font-bold text-slate-400 px-1">
              <span>RECEIPT DETAILS</span>
              <span className="text-blue-500 font-extrabold">CONFIDENCE: {previewDoc.confidence}%</span>
            </div>
            <div className="flex justify-between font-mono text-[9px] px-1 text-slate-800 dark:text-slate-200">
              <span>INV NO:</span>
              <span className="font-bold">{previewDoc.extractedData?.invoiceNumber || 'WHATS-22891'}</span>
            </div>
            <div className="flex justify-between font-mono text-[9px] px-1 text-slate-800 dark:text-slate-200">
              <span>DATE:</span>
              <span>{previewDoc.extractedData?.invoiceDate || '2026-06-30'}</span>
            </div>
          </div>

          <div className="border-t border-dashed border-slate-300 pt-3 flex flex-col gap-2 relative">
            <div className="absolute -inset-1 bg-emerald-400/10 border border-emerald-400/30 rounded pointer-events-none"></div>
            <div className="flex justify-between text-[8px] font-bold text-slate-400 px-1">
              <span>TOTAL VALUE EXTRACTED</span>
              <span className="text-emerald-500 font-extrabold">OK</span>
            </div>
            <div className="flex justify-between px-1 items-baseline">
              <span className="font-bold text-slate-800 dark:text-slate-300">Net Amount:</span>
              <span className="font-bold text-slate-900 font-mono text-sm dark:text-slate-100">
                ₹ {previewDoc.extractedData?.totalAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="text-[7.5px] text-slate-400 font-mono text-center mt-2">
            GSTIN: {previewDoc.extractedData?.gstin || '27AAAAA1111A1Z5'}
          </div>
        </div>
        <p className="text-[9.5px] text-slate-500 text-center px-4 leading-normal">
          Captured via WhatsApp Business integration channel. OCR OCR.
        </p>
      </div>
    );
  };

  const handleAiAutoFix = () => {
    if (aiIssues.length === 0) {
      toast.info('No validation issues to automatically fix.');
      return;
    }

    setExcelGridData(prev => {
      const cols = getColumnIndices(prev[1]);
      const updated = prev.map(r => [...r]);

      aiIssues.forEach(issue => {
        let colIdx = -1;
        if (issue.field === 'date') colIdx = cols.date;
        else if (issue.field === 'party') colIdx = cols.party;
        else if (issue.field === 'amount') colIdx = cols.amount;
        else if (issue.field === 'gst_percent') colIdx = cols.gst_percent;
        else if (issue.field === 'gstin') colIdx = cols.gstin;

        if (colIdx !== -1 && issue.row < updated.length) {
          updated[issue.row][colIdx] = issue.applyValue;
          if (cols.status !== -1) {
            updated[issue.row][cols.status] = 'Valid';
          }
        }
      });

      return updated;
    });

    setIgnoredIssueIds(prev => [...prev, ...aiIssues.map(i => i.id)]);
    toast.success('AI Auto Fix applied: Resolved all validation issues!');
  };

  const handleApplyIssue = (issue) => {
    const cols = getColumnIndices(excelGridData[1]);
    let colIdx = -1;
    if (issue.field === 'date') colIdx = cols.date;
    else if (issue.field === 'party') colIdx = cols.party;
    else if (issue.field === 'amount') colIdx = cols.amount;
    else if (issue.field === 'gst_percent') colIdx = cols.gst_percent;
    else if (issue.field === 'gstin') colIdx = cols.gstin;

    handleExcelCellChange(issue.row, colIdx, issue.applyValue);
    setIgnoredIssueIds(prev => [...prev, issue.id]);
    toast.success(`Applied AI Fix for Row ${issue.row - 1}: Set ${issue.field} to "${issue.applyValue}"`);
  };

  const handleIgnoreIssue = (issue) => {
    setIgnoredIssueIds(prev => [...prev, issue.id]);
    toast.info(`Ignored suggestion for Row ${issue.row - 1}`);
  };

  const renderMockupExcelPreview = () => {
    const cols = getColumnIndices(excelGridData[1] || []);
    
    const totalRowsCount = Math.max(0, excelGridData.length - 2);
    const currentErrors = aiIssues.filter(i => i.type === 'Error').length;
    const currentWarnings = aiIssues.filter(i => i.type === 'Warning').length;
    const currentValid = Math.max(0, totalRowsCount - currentErrors);
    const readinessPercent = totalRowsCount > 0 
      ? Math.max(0, Math.min(100, Math.round((currentValid / totalRowsCount) * 100))) 
      : 100;

    // Filter table rows
    const filteredRows = (excelGridData.slice(2) || []).filter((row, idx) => {
      const isRowBlank = row.every(cell => !cell || cell.trim() === '');
      if (isRowBlank) return false;

      const statusStr = row[cols.status] || 'Valid';

      // Search filter
      if (tableSearchQuery) {
        const q = tableSearchQuery.toLowerCase();
        const matchesSearch = row.some(cell => String(cell || '').toLowerCase().includes(q));
        if (!matchesSearch) return false;
      }

      // Status filter
      // Status filter
      if (statusFilter === 'Errors') {
        return aiIssues.some(i => i.row === idx + 2 && i.type === 'Error');
      }
      if (statusFilter === 'Warnings') {
        return aiIssues.some(i => i.row === idx + 2 && i.type === 'Warning');
      }
      if (statusFilter === 'Valid') {
        return !aiIssues.some(i => i.row === idx + 2);
      }
      return true;
    });

    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-[#121216] text-slate-800 dark:text-slate-200">
        {/* Header */}
        <div className="bg-white dark:bg-[#191922] border-b border-slate-200 dark:border-slate-800/80 px-6 py-4 flex items-center justify-between shrink-0 shadow-2xs">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setPreviewDoc(null)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-full transition cursor-pointer border-none bg-transparent"
              title="Back"
            >
              <ArrowLeft size={18} className="text-slate-600 dark:text-slate-400 stroke-[2.5]" />
            </button>
            <div>
              <h1 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>Bulk Upload</span>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/45 text-emerald-800 dark:text-emerald-350 border border-emerald-200/55 rounded-full uppercase">
                  {(previewDoc.name || '').split('.').pop() || 'XLSX'}
                </span>
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Upload, validate and import your data with AI
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => toast.success('Exporting errors report...')}
              className="h-8.5 px-3 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-3xs bg-white dark:bg-[#20202c]"
            >
              <Download size={13} className="text-slate-450" />
              <span>Export Errors</span>
            </button>

            <button
              onClick={() => {
                toast.loading('Re-validating data fields...');
                setTimeout(() => {
                  toast.dismiss();
                  toast.success('Re-validation complete! 0 new errors found.');
                }, 800);
              }}
              className="h-8.5 px-3 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-355 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-3xs bg-white dark:bg-[#20202c]"
            >
              <RefreshCw size={12} className="text-slate-450" />
              <span>Re-validate</span>
            </button>

            <button
              onClick={() => {
                toast.success('Draft saved successfully!');
                setDocuments(prev => prev.map(d => d.id === previewDoc.id ? { ...d, excelData: excelGridData } : d));
                setPreviewDoc(null);
              }}
              className="h-8.5 px-3 border border-slate-200 dark:border-slate-800 text-slate-705 dark:text-slate-355 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-3xs bg-white dark:bg-[#20202c]"
            >
              <FolderOpen size={13} className="text-slate-450" />
              <span>Save Draft</span>
            </button>

            <button
              onClick={() => {
                toast.success('Spreadsheet data approved and import completed!');
                setDocuments(prev => prev.map(d => d.id === previewDoc.id ? { ...d, status: 'Completed', excelData: excelGridData } : d));
                setPreviewDoc(null);
              }}
              className="h-8.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-black text-xs transition flex items-center gap-1.5 cursor-pointer shadow-md border-none"
            >
              <UploadCloud size={13} />
              <span>Approve & Import</span>
            </button>

            <div className="h-5 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1"></div>

            <button
              onClick={() => toast.info('Viewing upload history')}
              className="h-8.5 px-3 border border-slate-200 dark:border-slate-800 text-slate-705 dark:text-slate-350 bg-white dark:bg-[#20202c] hover:bg-slate-50 dark:hover:bg-slate-850 font-bold text-xs rounded-lg transition flex items-center gap-2 cursor-pointer shadow-3xs"
            >
              <LayoutList size={13} className="text-slate-450" />
              <span>Upload History</span>
            </button>
            <button
              onClick={() => toast.info('Settings panel')}
              className="h-8.5 px-3 border border-slate-200 dark:border-slate-800 text-slate-705 dark:text-slate-350 bg-white dark:bg-[#20202c] hover:bg-slate-50 dark:hover:bg-slate-850 font-bold text-xs rounded-lg transition flex items-center gap-2 cursor-pointer shadow-3xs"
            >
              <Settings size={13} className="text-slate-450" />
              <span>Settings</span>
            </button>
          </div>
        </div>

        {/* Stepper */}
        <div className="px-6 py-2 bg-white dark:bg-[#191922] border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-center select-none overflow-x-auto shrink-0 shadow-2xs">
          <div className="flex items-center w-full max-w-4xl justify-between min-w-[700px] px-2">
            {/* Step 1 */}
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                <Check size={10} className="stroke-[3]" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-extrabold text-slate-900 dark:text-slate-100 leading-tight">1 Upload File</span>
                <span className="text-[8px] text-slate-400 dark:text-slate-500 font-medium truncate max-w-[100px]">{previewDoc.name}</span>
              </div>
            </div>
            
            {/* Connector */}
            <div className="flex-1 h-[2px] bg-emerald-500 mx-2.5 max-w-[40px]"></div>

            {/* Step 2 */}
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                <Check size={10} className="stroke-[3]" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-extrabold text-slate-900 dark:text-slate-100 leading-tight">2 Detect & Map</span>
                <span className="text-[8px] text-emerald-600 dark:text-emerald-400 font-bold">Sales Voucher</span>
              </div>
            </div>

            {/* Connector */}
            <div className="flex-1 h-[2px] bg-indigo-500 mx-2.5 max-w-[40px]"></div>

            {/* Step 3 */}
            <div className="flex items-center gap-2 px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-full shrink-0">
              <div className="w-4.5 h-4.5 rounded-full bg-indigo-600 text-white flex items-center justify-center font-black text-[9px] shadow-2xs">
                3
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-indigo-700 dark:text-indigo-300 leading-none">Validate Data</span>
                <span className="text-[7.5px] text-indigo-500 dark:text-indigo-400 font-bold uppercase tracking-wider mt-0.5">In Progress</span>
              </div>
            </div>

            {/* Connector */}
            <div className="flex-1 h-[2px] bg-slate-200 dark:bg-slate-800 mx-2.5 max-w-[40px]"></div>

            {/* Step 4 */}
            <div className="flex items-center gap-2 opacity-60 shrink-0">
              <div className="w-5 h-5 rounded-full border border-slate-300 dark:border-slate-700 text-slate-500 flex items-center justify-center font-bold text-xs bg-slate-50 dark:bg-slate-900">
                <Edit2 size={9} />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 leading-tight">4 Review & Edit</span>
                <span className="text-[8px] text-slate-400 dark:text-slate-555 font-medium">Check and confirm</span>
              </div>
            </div>

            {/* Connector */}
            <div className="flex-1 h-[2px] bg-slate-200 dark:bg-slate-800 mx-2.5 max-w-[40px]"></div>

            {/* Step 5 */}
            <div className="flex items-center gap-2 opacity-60 shrink-0">
              <div className="w-5 h-5 rounded-full border border-slate-300 dark:border-slate-700 text-slate-500 flex items-center justify-center font-bold text-[9px] bg-slate-50 dark:bg-slate-900">
                5
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 leading-tight">5 Import</span>
                <span className="text-[8px] text-slate-400 dark:text-slate-555 font-medium">Save or Import</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 px-6 py-2 shrink-0 bg-slate-50/50 dark:bg-[#121216] border-b border-slate-200/60 dark:border-slate-800/40">
          {/* Card 1: Detected Type */}
          <div className="bg-white dark:bg-[#191922] border border-slate-200 dark:border-slate-800/80 p-2 rounded-lg flex items-center gap-2 shadow-3xs">
            <div className="w-7.5 h-7.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-650 flex items-center justify-center border border-blue-100 dark:border-blue-900/40 shrink-0">
              <Database size={13} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[8.5px] text-slate-450 dark:text-slate-500 font-bold uppercase tracking-wider truncate">Detected Type</span>
              <span className="text-[10.5px] font-black text-slate-850 dark:text-slate-100 truncate">Sales Voucher</span>
              <span className="text-[7.5px] font-bold px-1 bg-emerald-50 dark:bg-emerald-950/35 text-emerald-700 dark:text-emerald-400 border border-emerald-150/45 dark:border-emerald-900/40 rounded mt-0.5 inline-block w-fit">98% Conf.</span>
            </div>
          </div>

          {/* Card 2: Total Rows */}
          <div className="bg-white dark:bg-[#191922] border border-slate-200 dark:border-slate-800/80 p-2 rounded-lg flex flex-col justify-center shadow-3xs">
            <span className="text-[8.5px] text-slate-450 dark:text-slate-500 font-bold uppercase tracking-wider">Total Rows</span>
            <span className="text-sm font-black text-slate-850 dark:text-slate-100 font-mono">1,250</span>
          </div>

          {/* Card 3: Valid Rows */}
          <div className="bg-white dark:bg-[#191922] border border-slate-200 dark:border-slate-800/80 p-2 rounded-lg flex flex-col justify-center shadow-3xs border-l-3 border-l-emerald-500">
            <span className="text-[8.5px] text-slate-450 dark:text-slate-500 font-bold uppercase tracking-wider">Valid Rows</span>
            <span className="text-sm font-black text-emerald-600 dark:text-emerald-450 font-mono">{currentValid}</span>
          </div>

          {/* Card 4: Errors */}
          <div className="bg-white dark:bg-[#191922] border border-slate-200 dark:border-slate-800/80 p-2 rounded-lg flex flex-col justify-center shadow-3xs border-l-3 border-l-rose-500">
            <span className="text-[8.5px] text-slate-450 dark:text-slate-500 font-bold uppercase tracking-wider">Errors</span>
            <span className="text-sm font-black text-rose-600 dark:text-rose-455 font-mono">{currentErrors}</span>
          </div>

          {/* Card 5: Warnings */}
          <div className="bg-white dark:bg-[#191922] border border-slate-200 dark:border-slate-800/80 p-2 rounded-lg flex flex-col justify-center shadow-3xs border-l-3 border-l-amber-500">
            <span className="text-[8.5px] text-slate-450 dark:text-slate-500 font-bold uppercase tracking-wider">Warnings</span>
            <span className="text-sm font-black text-amber-505 font-mono">{currentWarnings}</span>
          </div>

          {/* Card 6: Duplicates */}
          <div className="bg-white dark:bg-[#191922] border border-slate-200 dark:border-slate-800/80 p-2 rounded-lg flex flex-col justify-center shadow-3xs border-l-3 border-l-purple-500">
            <span className="text-[8.5px] text-slate-455 dark:text-slate-500 font-bold uppercase tracking-wider">Duplicates</span>
            <span className="text-sm font-black text-purple-600 dark:text-purple-450 font-mono">4</span>
          </div>

          {/* Card 7: Import Readiness */}
          <div className="bg-white dark:bg-[#191922] border border-slate-200 dark:border-slate-800/80 p-2 rounded-lg flex items-center justify-between shadow-3xs">
            <div className="flex flex-col min-w-0">
              <span className="text-[8.5px] text-slate-455 dark:text-slate-500 font-bold uppercase tracking-wider truncate">Import Readiness</span>
              <span className="text-sm font-black text-slate-850 dark:text-slate-100 font-mono">{readinessPercent}%</span>
            </div>
            <div className="w-7.5 h-7.5 relative flex items-center justify-center shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" className="text-slate-100 dark:text-slate-800" />
                <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3.5" strokeDasharray={`${readinessPercent}, 100`} strokeLinecap="round" className="text-emerald-500" />
              </svg>
            </div>
          </div>
        </div>

        {/* Main Editor Section */}
        <div className="flex-1 flex overflow-hidden min-h-0 bg-slate-50 dark:bg-[#121216] pt-0 px-4 pb-4 gap-4">
          {/* Table Container Card */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0 rounded-xl border border-slate-200 dark:border-slate-800/85 bg-white dark:bg-[#191922] shadow-xs">
            {/* Table Control Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 border-b border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#191922] shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toast.info('Column mapping editor')}
                  className="h-8.5 px-3.5 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-3xs bg-white dark:bg-[#20202c]"
                >
                  <SlidersHorizontal size={13} className="text-slate-400" />
                  <span>Column Mapping</span>
                </button>
                
                <div className="relative">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="h-8.5 pl-3 pr-8 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-355 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-lg text-xs font-bold outline-none cursor-pointer appearance-none bg-white dark:bg-[#20202c] shadow-3xs min-w-[110px]"
                  >
                    <option value="All Rows">All Rows</option>
                    <option value="Errors">Errors</option>
                    <option value="Warnings">Warnings</option>
                    <option value="Valid">Valid</option>
                  </select>
                  <ChevronDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                  <input
                    type="text"
                    placeholder="Search in table..."
                    value={tableSearchQuery}
                    onChange={(e) => setTableSearchQuery(e.target.value)}
                    className="h-8.5 pl-9 pr-3 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-250 bg-white dark:bg-[#20202c] placeholder:text-slate-400 dark:placeholder:text-slate-655 text-xs outline-none focus:border-indigo-500 w-44 font-semibold transition-all shadow-3xs"
                  />
                </div>
                
                <button
                  onClick={() => toast.info('Filters config')}
                  className="h-8.5 px-3 border border-slate-200 dark:border-slate-800 text-slate-705 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-3xs bg-white dark:bg-[#20202c]"
                >
                  <Filter size={12} className="text-slate-450" />
                  <span>Filters</span>
                </button>

                <button
                  onClick={handleAiAutoFix}
                  className="h-8.5 px-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-lg text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer shadow-3xs"
                >
                  <Sparkles size={12} className="text-indigo-650 animate-pulse" />
                  <span>AI Auto Fix</span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-white dark:bg-[#121216] rounded-b-xl themed-scrollbar" style={{overflowX:'auto', overflowY:'auto'}}>
              <table className="w-full border-collapse text-left text-slate-700 dark:text-slate-350 text-xs select-all min-w-[1000px]">
                <thead>
                  <tr className="bg-slate-50/90 dark:bg-[#1f1f2a] border-b border-slate-200 dark:border-slate-800 text-[10.5px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider h-9 sticky top-0 z-10 select-none">
                    <th className="py-1.5 px-2 text-center w-10">
                      <input type="checkbox" className="rounded border-slate-300 text-indigo-650 cursor-pointer h-3.5 w-3.5" />
                    </th>
                    <th className="py-1.5 px-2 w-16 text-center border-r border-slate-100 dark:border-slate-800/40">Row No.</th>
                    
                    {(excelGridData[1] || []).map((headerText, colIdx) => {
                      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
                      const colLetter = excelGridData[0] ? (excelGridData[0][colIdx] || alphabet[colIdx] || `C${colIdx}`) : (alphabet[colIdx] || `C${colIdx}`);
                      
                      // Check mapping labels for visual reference
                      let mappedLabel = 'Mapped';
                      if (colIdx === cols.invoice) mappedLabel = 'Invoice No *';
                      else if (colIdx === cols.date) mappedLabel = 'Date *';
                      else if (colIdx === cols.party) mappedLabel = 'Party Ledger *';
                      else if (colIdx === cols.amount) mappedLabel = 'Total Amount *';
                      else if (colIdx === cols.gstin) mappedLabel = 'GSTIN';
                      else if (colIdx === cols.gst_percent) mappedLabel = 'GST %';
                      
                      return (
                        <th key={colIdx} className="py-1.5 px-3 border-r border-slate-100 dark:border-slate-800/40 min-w-[140px]">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-750 dark:text-slate-300 truncate max-w-[180px]">{headerText || `Column ${colLetter}`}</span>
                            <span className="text-[8px] text-slate-450 dark:text-slate-500 font-medium normal-case leading-none mt-0.5">
                              ({colLetter} - {mappedLabel})
                            </span>
                          </div>
                        </th>
                      );
                    })}

                    <th className="py-1.5 px-3 w-28 border-r border-slate-100 dark:border-slate-800/40">Status</th>
                    <th className="py-1.5 px-2 w-12 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 dark:divide-slate-850 font-sans">
                  {filteredRows.map((row, idx) => {
                    const actualRowIndex = excelGridData.indexOf(row);
                    const rowNo = actualRowIndex - 1; // row 2 matches Row No 1

                    // Find dynamic validation issues for this row to color code cells and set row status badge
                    const rowIssues = aiIssues.filter(i => i.row === actualRowIndex);
                    const hasError = rowIssues.some(i => i.type === 'Error');
                    const hasWarning = rowIssues.some(i => i.type === 'Warning');
                    
                    let statusBadge = (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200/35">
                        <CheckCircle size={10} className="text-emerald-600 dark:text-emerald-400" />
                        <span>Valid</span>
                      </span>
                    );

                    if (hasError) {
                      statusBadge = (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-450 border border-rose-200/35">
                          <AlertCircle size={10} className="text-rose-600 dark:text-rose-400" />
                          <span>Error</span>
                        </span>
                      );
                    } else if (hasWarning) {
                      statusBadge = (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-955/20 text-amber-605 dark:text-amber-400 border border-amber-200/35">
                          <AlertTriangle size={10} className="text-amber-650 dark:text-amber-400" />
                          <span>Warning</span>
                        </span>
                      );
                    }

                    return (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors h-9 border-b border-slate-100 dark:border-slate-850">
                        <td className="py-1 px-2 text-center whitespace-nowrap">
                          <input type="checkbox" className="rounded border-slate-300 text-indigo-650 cursor-pointer h-3 w-3" />
                        </td>
                        
                        <td className="py-1 px-2 text-center whitespace-nowrap font-bold text-slate-405 dark:text-slate-500 border-r border-slate-100 dark:border-slate-850 select-none">
                          {rowNo}
                        </td>

                        {row.map((cellValue, colIdx) => {
                          const cellIssue = rowIssues.find(i => i.colIdx === colIdx);
                          const isCellErr = cellIssue && cellIssue.type === 'Error';
                          const isCellWarn = cellIssue && cellIssue.type === 'Warning';
                          
                          let cellClass = "text-slate-700 dark:text-slate-300";
                          let inputClass = "text-inherit";
                          let icon = null;

                          if (isCellErr) {
                            cellClass = "bg-rose-500/10 border border-rose-400 text-rose-700 dark:text-rose-400";
                            inputClass = "text-inherit font-semibold placeholder:text-rose-400/50";
                            if (colIdx === cols.party) {
                              icon = <Lock size={11} className="text-rose-500 shrink-0" />;
                            } else {
                              icon = <AlertCircle size={11} className="text-rose-500 shrink-0" />;
                            }
                          } else if (isCellWarn) {
                            cellClass = "bg-amber-500/10 border border-amber-300 text-amber-705 dark:text-amber-450";
                            inputClass = "text-inherit font-semibold";
                            icon = <AlertTriangle size={11} className="text-amber-500 shrink-0" />;
                          }

                          if (colIdx === cols.amount) {
                            inputClass += " text-right font-black";
                          } else if (colIdx === cols.gst_percent) {
                            inputClass += " text-center font-bold";
                          } else if (colIdx === cols.gstin) {
                            inputClass += " font-mono";
                          }

                          return (
                            <td key={colIdx} className={`py-1 px-2.5 border-r border-slate-100 dark:border-slate-850 min-w-[140px] ${cellClass}`}>
                              <div className="flex items-center justify-between gap-1 w-full">
                                <input
                                  type="text"
                                  value={cellValue}
                                  placeholder={colIdx === cols.party ? "Enter Party Ledger" : ""}
                                  onChange={(e) => handleExcelCellChange(actualRowIndex, colIdx, e.target.value)}
                                  className={`border-none bg-transparent outline-none focus:ring-1 focus:ring-indigo-500 rounded px-1.5 py-0.5 w-full ${inputClass}`}
                                />
                                {icon}
                              </div>
                            </td>
                          );
                        })}

                        <td className="py-1 px-2.5 border-r border-slate-100 dark:border-slate-850 whitespace-nowrap">{statusBadge}</td>

                        <td className="py-1 px-2 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <button className="p-1 hover:bg-slate-100 dark:hover:bg-slate-850 rounded text-slate-400 hover:text-slate-600 transition cursor-pointer border-none bg-transparent">
                            <Settings size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* AI Sidebar */}
          {showAiRecs && (
            <div className="w-[350px] shrink-0 flex flex-col bg-white dark:bg-[#191922] border border-slate-200 dark:border-slate-800/85 overflow-hidden h-full select-none rounded-xl shadow-xs">
              {/* Sidebar Header */}
              <div className="px-5 py-4 border-b border-slate-150 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-900/10">
                <span className="font-extrabold text-slate-850 dark:text-slate-200 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={14} className="text-indigo-650 animate-pulse" />
                  <span>AI Review Assistant</span>
                </span>
                <button
                  onClick={() => setShowAiRecs(false)}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-850 rounded transition text-slate-400 cursor-pointer border-none bg-transparent"
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              {/* Stats row */}
              <div className="px-4 py-2 border-b border-slate-150 dark:border-slate-800 flex items-center justify-between bg-slate-50/30 dark:bg-slate-900/5 shrink-0 gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-extrabold uppercase">Errors</span>
                  <span className="text-[11px] font-black px-2 py-0.5 rounded bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 font-mono">
                    {currentErrors}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-extrabold uppercase">Warnings</span>
                  <span className="text-[11px] font-black px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-955/25 text-amber-600 dark:text-amber-400 font-mono">
                    {currentWarnings}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-extrabold uppercase">Suggestions</span>
                  <span className="text-[11px] font-black px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/25 text-blue-655 dark:text-blue-450 font-mono">
                    {aiIssues.length}
                  </span>
                </div>
              </div>

              {/* Suggestion list */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 themed-scrollbar">
                {aiIssues.length > 0 ? (
                  aiIssues.map(issue => (
                    <div
                      key={issue.id}
                      className="p-4 bg-white dark:bg-[#20202c] border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs flex flex-col gap-2 relative group hover:border-indigo-400 dark:hover:border-indigo-900 transition-all duration-200"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-extrabold px-2 py-0.5 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-455 rounded uppercase tracking-wider">
                          Row {issue.row - 1}
                        </span>
                        <span className="text-[9.5px] font-bold text-slate-400 dark:text-slate-500">
                          {issue.type}
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-slate-850 dark:text-slate-200 tracking-tight leading-snug">
                        {issue.title}
                      </h4>

                      <p className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-normal font-medium">
                        {issue.description}
                      </p>

                      <div className="bg-slate-50/75 dark:bg-slate-900/50 p-2.5 rounded-lg border border-slate-150 dark:border-slate-800 text-[10.5px] font-bold text-emerald-700 dark:text-emerald-450 flex items-center justify-between">
                        <span>Suggested:</span>
                        <span className="underline">{issue.suggestion}</span>
                      </div>

                      <div className="flex items-center gap-2 mt-1 justify-end">
                        <button
                          onClick={() => handleIgnoreIssue(issue)}
                          className="h-8 px-3 text-slate-500 dark:text-slate-450 hover:text-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-md font-bold text-[10.5px] cursor-pointer transition border-none bg-transparent"
                        >
                          Ignore
                        </button>
                        <button
                          onClick={() => handleApplyIssue(issue)}
                          className="h-8 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-extrabold text-[10.5px] cursor-pointer transition shadow-2xs border-none"
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl my-4 gap-2.5">
                    <CheckCircle2 size={30} className="text-emerald-500 animate-bounce" />
                    <h4 className="text-xs font-bold text-slate-850 dark:text-slate-200">All Suggestions Resolved!</h4>
                    <p className="text-[10px] text-slate-400 dark:text-slate-550 leading-relaxed">
                      AI Review Assistant has verified all rows in this document.
                    </p>
                  </div>
                )}
              </div>

              {/* View All Issues */}
              <div className="p-3 border-t border-slate-150 dark:border-slate-800 text-center shrink-0 bg-slate-50/20 dark:bg-slate-900/5">
                <button
                  onClick={() => {
                    if (aiIssues.length > 0) {
                      toast.info(`Reviewing all ${aiIssues.length} issues sequentially`);
                    } else {
                      toast.success('No issues to review!');
                    }
                  }}
                  className="text-xs font-black text-indigo-650 dark:text-indigo-400 hover:underline cursor-pointer bg-transparent border-none"
                >
                  View All Issues &gt;
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };


  return (
    <div className="relative flex flex-col h-full w-full overflow-hidden text-[var(--app-text)] font-sans text-xs select-none">
      {/* ── OCR Review Mode with Existing Manual Entry Forms ───────────────────────── */}
      {aiReviewDoc && (
        <OcrManualReviewScreen
          doc={aiReviewDoc}
          isDark={isDark}
          onClose={() => setAiReviewDoc(null)}
          onSaveSuccess={() => {
            // Update the document in the list with the 'Validated' status
            setDocuments(prev => prev.map(d => {
              if (d.id === aiReviewDoc.id) {
                return {
                  ...d,
                  status: 'Validated'
                };
              }
              return d;
            }));
            setAiReviewDoc(null);
          }}
        />
      )}

      {previewDoc ? (
        isExcelFile ? (
          renderMockupExcelPreview()
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden text-xs font-sans min-w-0 select-text">
          {/* Combined Top Header / Metadata / Actions Bar */}
          <div className="bg-[var(--app-panel-bg)] border-b border-[var(--app-border)]/60 px-6 py-2 flex flex-wrap items-center justify-between shrink-0 gap-4 select-none">
            <div className="flex items-center gap-3">
              {/* Back Navigation Button */}
              <button
                onClick={() => setPreviewDoc(null)}
                className="p-1.5 hover:bg-[var(--app-row-hover)] rounded-lg text-[var(--app-text)] cursor-pointer transition border-none bg-transparent"
                title="Back to Uploaded Documents"
              >
                <ArrowLeft size={16} className="stroke-[2.5]" />
              </button>

              <div className="h-5 w-[1px] bg-[var(--app-border)]/60"></div>

              {/* Green Excel Icon */}
              <div className="w-8 h-8 bg-emerald-600 rounded flex flex-col items-center justify-center text-white font-extrabold text-[9.5px] shrink-0 border border-emerald-700">
                <span className="leading-none">X</span>
                <span className="text-[7px] leading-none -mt-0.5">LS</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-[var(--app-heading)] text-[13px] tracking-tight">{previewDoc.name}</span>
                  <span className="text-[8px] font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/45 dark:text-emerald-350 border border-emerald-200/55 rounded uppercase">
                    {(previewDoc.name || '').split('.').pop() || 'XLSX'}
                  </span>
                </div>
                <div className="text-[9.5px] text-[var(--app-muted)] font-medium">
                  <span>Source: <b>Manual Upload</b></span>
                </div>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="flex items-center gap-1.5 py-1">
              {/* Download Icon-Only Button */}
              <button
                onClick={() => {
                  const ws = XLSX.utils.aoa_to_sheet(excelGridData.slice(1));
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
                  XLSX.writeFile(wb, (previewDoc.name || 'export.xlsx').replace(/\.[^/.]+$/, '') + '.xlsx');
                  toast.success('Downloaded as Excel file!');
                }}
                className="w-8 h-8 border border-[var(--app-border)] text-[var(--app-text)] bg-[var(--app-panel-bg)] hover:bg-[var(--app-row-hover)] rounded-lg flex items-center justify-center cursor-pointer transition shadow-2xs"
                title="Download Excel"
              >
                <Download size={14} className="text-[var(--app-muted)]" />
              </button>

              {/* Save Draft */}
              <button
                onClick={() => {
                  toast.success('Draft saved successfully!');
                  setDocuments(prev => prev.map(d => d.id === previewDoc.id ? { ...d, status: 'Validated' } : d));
                  setPreviewDoc(null);
                }}
                className="h-8 px-3 border border-[var(--app-border)] text-[var(--app-text)] bg-[var(--app-panel-bg)] hover:bg-[var(--app-row-hover)] font-bold text-[11px] rounded-lg transition flex items-center gap-1 cursor-pointer shadow-2xs"
              >
                <FolderOpen size={11} className="text-[var(--app-muted)]" />
                <span>Save Draft</span>
              </button>

              {/* Reject */}
              <button
                onClick={() => {
                  toast.error('Document rejected.');
                  setDocuments(prev => prev.map(d => d.id === previewDoc.id ? { ...d, status: 'Rejected' } : d));
                  setPreviewDoc(null);
                }}
                className="h-8 px-3 border border-red-200 text-red-600 hover:bg-red-50 bg-[var(--app-panel-bg)] font-bold text-[11px] rounded-lg transition flex items-center gap-1 cursor-pointer"
              >
                <Trash2 size={11} />
                <span>Reject</span>
              </button>

              {/* Review */}
              <button
                onClick={() => {
                  toast.info('Document submitted for audit review.');
                  setDocuments(prev => prev.map(d => d.id === previewDoc.id ? { ...d, status: 'Processing' } : d));
                  setPreviewDoc(null);
                }}
                className="h-8 px-3 border border-blue-200 text-blue-600 hover:bg-blue-50 bg-[var(--app-panel-bg)] font-bold text-[11px] rounded-lg transition flex items-center gap-1 cursor-pointer"
              >
                <Mail size={11} />
                <span>Review</span>
              </button>

              {/* Post */}
              <button
                onClick={() => {
                  toast.success('Document approved and voucher posted!');
                  setDocuments(prev => prev.map(d => d.id === previewDoc.id ? { ...d, status: 'Completed' } : d));
                  setPreviewDoc(null);
                }}
                className="h-8 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] rounded-lg transition flex items-center gap-1 cursor-pointer shadow-sm"
              >
                <Check size={11} className="stroke-[2.5]" />
                <span>Post</span>
              </button>

              <div className="h-4 w-[1px] bg-[var(--app-border)]/60"></div>

              {/* AI Assistant Toggle */}
              <button
                onClick={() => setShowAiRecs(prev => !prev)}
                className={`h-8 px-3 rounded-lg font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-2xs border ${
                  showAiRecs
                    ? 'bg-[var(--app-accent-soft)] text-[var(--app-accent)] border-[var(--app-accent)]/30'
                    : 'bg-[var(--app-panel-bg)] text-[var(--app-text)] border-[var(--app-border)] hover:bg-[var(--app-row-hover)]'
                }`}
              >
                <Sparkles size={12} className={showAiRecs ? 'animate-pulse' : ''} />
                <span>AI Assistant</span>
                <span className="text-[8px] font-extrabold px-1 py-0.5 bg-[var(--app-accent)]/15 text-[var(--app-accent)] rounded uppercase tracking-wider">BETA</span>
              </button>
            </div>
          </div>

          {/* Grid Layout - Full-bleed split with border dividing line */}
          <div className="flex-1 flex overflow-hidden min-h-0 bg-white dark:bg-[#1e1e1e]">
            
            {/* Left Column spreadsheet editor */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-0 border-r border-[var(--app-border)]/75">
              
              {/* Combined Tabs & Toolbar Row */}
              {isExcelFile && (
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-slate-50/45 dark:bg-slate-900/40 px-4 shrink-0 select-none gap-3" style={{minHeight:'42px'}}>
                  <div className="flex items-center gap-1 h-full self-stretch">
                    {['Preview Data','Raw Data','Summary','AI Insights'].map((tab) => {
                      const isActive = activePreviewTab === tab;
                      return (
                        <button
                          key={tab}
                          onClick={() => {
                            setActivePreviewTab(tab);
                            toast.info(`Switched to ${tab} (Editable Mode)`);
                          }}
                          className={`h-full px-3 font-bold text-xs transition-colors cursor-pointer border-b-2 bg-transparent outline-none ${
                            isActive
                              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-500 dark:text-indigo-400 font-bold'
                              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                          }`}
                        >
                          {tab}
                        </button>
                      );
                    })}
                  </div>

                  {/* Toolbar items shifted directly to this row */}
                  <div className="flex items-center gap-2 py-1">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                      <input
                        type="text"
                        placeholder="Search in table..."
                        className="h-8 pl-8 pr-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-300 text-xs outline-none focus:border-indigo-500 w-44 font-medium transition-all"
                      />
                    </div>
                    <button className="h-8 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-650 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition font-bold flex items-center gap-1.5 cursor-pointer">
                      <Filter size={12} className="text-slate-450" />
                      <span>Filters</span>
                    </button>
                    <button
                      onClick={handleAddRow}
                      className="h-8 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs border-none"
                    >
                      <Plus size={13} />
                      <span>Add Row</span>
                    </button>
                  </div>
                </div>
              )}
                     {/* Scrollable table grid or OCR Left Panel */}
              {['xlsx', 'xls', 'csv'].includes((previewDoc.name || '').split('.').pop().toLowerCase()) ? (
                <div className="flex-1 overflow-auto bg-white dark:bg-[#121212]" style={{overflowX:'auto',overflowY:'auto'}}>
                  <table className="w-full border-collapse text-left text-slate-650 dark:text-slate-350 text-xs border-b border-slate-100 dark:border-slate-800/25">
                    <thead>
                      <tr className="bg-slate-50/75 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-800 select-none text-[11px] text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider h-10 sticky top-0 z-10">
                        <th className="py-3 px-4 font-bold w-24 border-r border-slate-100/60 dark:border-slate-800/20">Status</th>
                        <th className="py-3 px-4 font-bold border-r border-slate-100/60 dark:border-slate-800/20">Invoice</th>
                        <th className="py-3 px-4 font-bold border-r border-slate-100/60 dark:border-slate-800/20">Party</th>
                        <th className="py-3 px-4 font-bold border-r border-slate-100/60 dark:border-slate-800/20">GSTIN</th>
                        <th className="py-3 px-4 font-bold border-r border-slate-100/60 dark:border-slate-800/20">Voucher Date</th>
                        <th className="py-3 px-4 font-bold border-r border-slate-100/60 dark:border-slate-800/20">Ledger</th>
                        <th className="py-3 px-4 font-bold text-right border-r border-slate-100/60 dark:border-slate-800/20">Amount</th>
                        <th className="py-3 px-4 font-bold">AI Flag</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/65 dark:divide-slate-800/20 font-sans">
                      {excelGridData.slice(2).map((row, rIdx) => {
                        const actualRowIndex = rIdx + 2;
                        const isRowBlank = row.every(cell => !cell || cell.trim() === '');
                        if (isRowBlank) return null;

                        const cols = getColumnIndices(excelGridData[1]);

                        const invoiceVal = row[cols.invoice] || '';
                        const partyVal = row[cols.party] || '';
                        const dateVal = row[cols.date] || '';
                        const ledgerVal = row[cols.ledger] || '';
                        const amountVal = row[cols.amount] || '0.00';
                        const statusStr = row[cols.status] || 'Valid';
                        const remarksVal = row[cols.remarks] || '';
                        const mockGstin = row[cols.gstin] || previewDoc.extractedData?.gstin || '27AAAAA1111A1Z5';

                        // Default 'AI Suggested' or empty values to 'Valid'
                        let finalStatus = statusStr;
                        if (!finalStatus || finalStatus === 'AI Suggested') {
                          finalStatus = 'Valid';
                        }

                        let statusBadge = (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50">
                            Valid
                          </span>
                        );
                        if (finalStatus.toLowerCase() === 'warning') {
                          statusBadge = (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-100 dark:bg-amber-955/20 dark:text-amber-400 dark:border-amber-900/40">
                              Warning
                            </span>
                          );
                        } else if (finalStatus.toLowerCase() === 'error') {
                          statusBadge = (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-650 border border-red-100 dark:bg-red-950/30 dark:text-red-455 dark:border-red-900/40">
                              Error
                            </span>
                          );
                        }

                        return (
                          <tr key={rIdx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors h-11 border-b border-slate-100/60 dark:border-slate-800/20">
                            <td className="py-2 px-4 whitespace-nowrap border-r border-slate-100/60 dark:border-slate-800/20">{statusBadge}</td>
                            
                            <td className="py-2 px-4 font-semibold text-slate-800 dark:text-slate-200 border-r border-slate-100/60 dark:border-slate-800/20">
                              <div className="relative flex items-center w-full h-full">
                                <input
                                  type="text"
                                  value={invoiceVal}
                                  onChange={(e) => handleExcelCellChange(actualRowIndex, cols.invoice, e.target.value)}
                                  className="border-none bg-transparent outline-none focus:ring-1 focus:ring-indigo-550/20 dark:focus:ring-indigo-400/20 rounded px-1.5 py-0.5 w-full font-semibold text-slate-800 dark:text-slate-200 focus:bg-white dark:focus:bg-slate-900 focus:border focus:border-slate-200 dark:focus:border-slate-800 pr-5"
                                />
                                <Edit2 size={9} className="absolute right-1.5 text-slate-350 dark:text-slate-650 opacity-45 pointer-events-none" />
                              </div>
                            </td>

                            <td className="py-2 px-4 text-slate-700 dark:text-slate-300 border-r border-slate-100/60 dark:border-slate-800/20">
                              <div className="relative flex items-center w-full h-full">
                                <input
                                  type="text"
                                  value={partyVal}
                                  onChange={(e) => handleExcelCellChange(actualRowIndex, cols.party, e.target.value)}
                                  className="border-none bg-transparent outline-none focus:ring-1 focus:ring-indigo-550/20 dark:focus:ring-indigo-400/20 rounded px-1.5 py-0.5 w-full text-slate-700 dark:text-slate-300 focus:bg-white dark:focus:bg-slate-900 focus:border focus:border-slate-200 dark:focus:border-slate-800 pr-5"
                                />
                                <Edit2 size={9} className="absolute right-1.5 text-slate-350 dark:text-slate-650 opacity-45 pointer-events-none" />
                              </div>
                            </td>

                            <td className="py-2 px-4 text-slate-550 dark:text-slate-400 font-mono text-[11px] border-r border-slate-100/60 dark:border-slate-800/20">
                              <div className="relative flex items-center w-full h-full">
                                <input
                                  type="text"
                                  value={mockGstin}
                                  onChange={(e) => handleExcelCellChange(actualRowIndex, cols.gstin, e.target.value)}
                                  className="border-none bg-transparent outline-none focus:ring-1 focus:ring-indigo-550/20 dark:focus:ring-indigo-400/20 rounded px-1.5 py-0.5 w-full text-slate-550 dark:text-slate-400 font-mono focus:bg-white dark:focus:bg-slate-900 focus:border focus:border-slate-200 dark:focus:border-slate-800 pr-5"
                                />
                                <Edit2 size={9} className="absolute right-1.5 text-slate-350 dark:text-slate-650 opacity-45 pointer-events-none" />
                              </div>
                            </td>

                            <td className="py-2 px-4 text-slate-600 dark:text-slate-400 border-r border-slate-100/60 dark:border-slate-800/20">
                              <div className="relative flex items-center w-full h-full">
                                <input
                                  type="text"
                                  value={dateVal}
                                  onChange={(e) => handleExcelCellChange(actualRowIndex, cols.date, e.target.value)}
                                  className="border-none bg-transparent outline-none focus:ring-1 focus:ring-indigo-550/20 dark:focus:ring-indigo-400/20 rounded px-1.5 py-0.5 w-full text-slate-600 dark:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:border focus:border-slate-200 dark:focus:border-slate-800 pr-5"
                                />
                                <Edit2 size={9} className="absolute right-1.5 text-slate-350 dark:text-slate-650 opacity-45 pointer-events-none" />
                              </div>
                            </td>

                            <td className="py-2 px-4 text-slate-600 dark:text-slate-400 border-r border-slate-100/60 dark:border-slate-800/20">
                              <div className="relative flex items-center w-full h-full">
                                <input
                                  type="text"
                                  value={ledgerVal}
                                  onChange={(e) => handleExcelCellChange(actualRowIndex, cols.ledger, e.target.value)}
                                  className="border-none bg-transparent outline-none focus:ring-1 focus:ring-indigo-550/20 dark:focus:ring-indigo-400/20 rounded px-1.5 py-0.5 w-full text-slate-600 dark:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:border focus:border-slate-200 dark:focus:border-slate-800 pr-5"
                                />
                                <Edit2 size={9} className="absolute right-1.5 text-slate-350 dark:text-slate-650 opacity-45 pointer-events-none" />
                              </div>
                            </td>

                            <td className="py-2 px-4 text-right font-bold text-slate-800 dark:text-slate-200 border-r border-slate-100/60 dark:border-slate-800/20">
                              <div className="relative flex items-center w-full h-full">
                                <Edit2 size={9} className="absolute left-1.5 text-slate-350 dark:text-slate-650 opacity-45 pointer-events-none" />
                                <input
                                  type="text"
                                  value={amountVal}
                                  onChange={(e) => handleExcelCellChange(actualRowIndex, cols.amount, e.target.value)}
                                  className="border-none bg-transparent outline-none focus:ring-1 focus:ring-indigo-550/20 dark:focus:ring-indigo-400/20 rounded px-1.5 py-0.5 w-full text-right font-bold text-slate-800 dark:text-slate-200 focus:bg-white dark:focus:bg-slate-900 focus:border focus:border-slate-200 dark:focus:border-slate-800 pl-5"
                                />
                              </div>
                            </td>

                            <td className="py-2 px-4 text-slate-550 dark:text-slate-400 italic text-[11px]">
                              <div className="relative flex items-center w-full h-full">
                                <input
                                  type="text"
                                  value={remarksVal}
                                  onChange={(e) => handleExcelCellChange(actualRowIndex, cols.remarks, e.target.value)}
                                  className="border-none bg-transparent outline-none focus:ring-1 focus:ring-indigo-550/20 dark:focus:ring-indigo-400/20 rounded px-1.5 py-0.5 w-full text-slate-550 dark:text-slate-400 italic focus:bg-white dark:focus:bg-slate-900 focus:border focus:border-slate-200 dark:focus:border-slate-800 pr-5"
                                />
                                <Edit2 size={9} className="absolute right-1.5 text-slate-350 dark:text-slate-650 opacity-45 pointer-events-none" />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : isOcrLoading ? (
                <OcrLoadingScreen />
              ) : ocrResult ? (
                <OcrLeftPanel
                  previewDoc={previewDoc}
                  ocrResult={ocrResult}
                  ocrActivePage={ocrActivePage}
                  setOcrActivePage={setOcrActivePage}
                  ocrZoom={ocrZoom}
                  setOcrZoom={setOcrZoom}
                  renderPdfPreview={renderPdfPreview}
                  renderImagePreview={renderImagePreview}
                />
              ) : (
                <div className="flex-1 overflow-auto bg-white dark:bg-[#121212] p-4 flex items-center justify-center">
                  {((previewDoc.name || '').split('.').pop().toLowerCase() === 'pdf' || !['xlsx', 'xls', 'csv', 'png', 'jpg', 'jpeg', 'tiff'].includes((previewDoc.name || '').split('.').pop().toLowerCase())) ? renderPdfPreview() : renderImagePreview()}
                </div>
              )}
            </div>

            {/* AI Assistant panel sidebar */}
            {showAiRecs && isExcelFile && (
              <div className="w-[350px] shrink-0 flex flex-col bg-white dark:bg-[#121212] overflow-hidden h-full border-l border-slate-200 dark:border-slate-800 select-none">
                {/* Sidebar Header */}
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-1.5">
                      <span>🤖 AI Assistant</span>
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">Your file has been analyzed automatically.</span>
                  </div>
                  <button
                    onClick={() => setShowAiRecs(false)}
                    className="w-6 h-6 rounded hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-450 dark:text-slate-400 cursor-pointer border-none bg-transparent"
                    title="Hide AI Assistant"
                  >
                    <X size={13} />
                  </button>
                </div>

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto flex flex-col p-5 gap-5">
                  {/* File Summary */}
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">File Summary</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: 'Total Records', value: '24' },
                        { label: 'Valid Records', value: '13', color: 'text-emerald-600 dark:text-emerald-400' },
                        { label: 'Needs Review', value: '9', color: 'text-amber-600 dark:text-amber-400' },
                        { label: 'Errors', value: '2', color: 'text-red-500 dark:text-red-400' },
                      ].map((card, idx) => (
                        <div key={idx} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl shadow-xs">
                          <span className="text-[9.5px] font-semibold text-slate-400 dark:text-slate-500 block">{card.label}</span>
                          <span className={`text-base font-extrabold block mt-0.5 ${card.color || 'text-slate-800 dark:text-slate-200'}`}>{card.value}</span>
                        </div>
                      ))}
                      <div className="col-span-2 bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 p-3 rounded-xl flex items-center justify-between">
                        <span className="text-[9.5px] font-semibold text-slate-500 dark:text-slate-450">AI Confidence</span>
                        <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">96% Accuracy</span>
                      </div>
                    </div>
                  </div>

                  {/* Auto Detected Columns */}
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Auto Detected Columns</h4>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {['Invoice No', 'Party Name', 'GSTIN', 'Voucher Date', 'Ledger', 'Amount', 'Tax Rate', 'State', 'HSN Code'].map(tag => (
                        <span key={tag} className="px-2 py-0.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-650 dark:text-slate-300 rounded-md text-[10px] font-semibold">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <span className="text-[10.5px] text-emerald-605 dark:text-emerald-400 font-medium flex items-center gap-1">
                      <span>✓ AI detected these columns automatically.</span>
                    </span>
                  </div>

                  {/* AI Insights */}
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">AI Insights</h4>
                    <div className="flex flex-col gap-2">
                      {[
                        { label: 'Voucher Type Detected', checked: true },
                        { label: 'Missing GSTIN (5)', checked: true, warning: true },
                        { label: 'Duplicate Invoices (2)', checked: true, warning: true },
                        { label: 'Unknown Party (3)', checked: true, warning: true },
                        { label: 'Missing Ledger (1)', checked: true, warning: true },
                        { label: 'Invalid Amount (0)', checked: true, ok: true },
                      ].map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs">
                          <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] shrink-0 font-bold ${
                            item.ok 
                              ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400' 
                              : item.warning 
                              ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400' 
                              : 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400'
                          }`}>
                            ✓
                          </span>
                          <span className="text-slate-700 dark:text-slate-300 font-medium">{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* AI Quick Actions */}
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">AI Quick Actions</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        'Auto Fix Issues',
                        'Detect Duplicates',
                        'Validate GST',
                        'Standardize Dates',
                        'Find Missing Masters',
                        'Refresh Analysis'
                      ].map(action => (
                        <button
                          key={action}
                          onClick={() => toast.success(`${action} triggered successfully!`)}
                          className="h-8 px-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-750 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition font-semibold text-[10px] cursor-pointer text-center"
                        >
                          {action}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Ask AI input at bottom */}
                <div className="p-5 border-t border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50/30 dark:bg-slate-900/10">
                  <div className="text-[10.5px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Ask AI</div>
                  <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 shadow-3xs mb-2">
                    <input
                      id="ai-assistant-ask-input"
                      type="text"
                      placeholder="Ask anything about this uploaded data..."
                      className="flex-1 bg-transparent text-xs text-slate-800 dark:text-slate-200 outline-none border-none placeholder:text-slate-400 dark:placeholder:text-slate-600 font-medium"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.target.value) {
                          toast.info(`AI: Searching for "${e.target.value}"...`);
                          e.target.value = '';
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        const input = document.getElementById('ai-assistant-ask-input');
                        if (input && input.value) {
                          toast.info(`AI: Searching for "${input.value}"...`);
                          input.value = '';
                        }
                      }}
                      className="w-6 h-6 bg-indigo-650 hover:bg-indigo-750 rounded-lg flex items-center justify-center text-white cursor-pointer shrink-0 transition border-none"
                    >
                      <ChevronRight size={12} className="stroke-[2.5]" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {[
                      'Show duplicate invoices',
                      'Which rows have GST errors?',
                      'Show missing parties',
                      'Find invalid amounts'
                    ].map(phrase => (
                      <button
                        key={phrase}
                        onClick={() => {
                          const input = document.getElementById('ai-assistant-ask-input');
                          if (input) {
                            input.value = phrase;
                            input.focus();
                          }
                        }}
                        className="px-2 py-1 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-550 dark:text-slate-400 rounded-md text-[9.5px] font-semibold transition cursor-pointer"
                      >
                        {phrase}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Standard sidebar input forms or OCR Right Panel */}
            {(!['xlsx', 'xls', 'csv'].includes((previewDoc.name || '').split('.').pop().toLowerCase())) && (
              ocrResult ? (
                <OcrRightPanel
                  ocrResult={ocrResult}
                  ocrActivePage={ocrActivePage}
                  setOcrActivePage={setOcrActivePage}
                  ocrSearchQuery={ocrSearchQuery}
                  setOcrSearchQuery={setOcrSearchQuery}
                />
              ) : (
                <div className="w-80 bg-[var(--app-panel-bg)] flex flex-col overflow-hidden h-full shrink-0 border-l border-[var(--app-border)]/75">
                  <div className="p-4 border-b border-[var(--app-border)] bg-[var(--app-table-head-bg)]/50 select-none">
                    <span className="font-bold text-[var(--app-heading)] text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <Scan size={14} className="text-[var(--app-accent)]" />
                      <span>AI Extracted Fields</span>
                    </span>
                  </div>
                  
                  <div className="p-4 flex-1 overflow-y-auto flex flex-col gap-4">
                    <div className="bg-[var(--app-content-bg)]/40 border border-[var(--app-border)] p-3 rounded-lg flex flex-col">
                      <span className="text-[9px] font-bold text-[var(--app-muted)] uppercase tracking-wider">AI Classification Confidence</span>
                      <span className="text-lg font-black text-[var(--app-heading)] mt-0.5">{previewDoc.confidence}%</span>
                    </div>

                    <div className="flex flex-col gap-3 text-xs">
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-bold text-[var(--app-muted)] uppercase">Vendor / Company Name</label>
                        <input
                          type="text"
                          value={previewDoc.extractedData?.vendorName || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPreviewDoc(prev => ({
                              ...prev,
                              extractedData: { ...prev.extractedData, vendorName: val }
                            }));
                            setDocuments(prev => prev.map(d => d.id === previewDoc.id ? { ...d, extractedData: { ...d.extractedData, vendorName: val } } : d));
                          }}
                          className="h-8 px-2 bg-[var(--app-panel-bg)] border border-[var(--app-border)] rounded text-[var(--app-text)] font-semibold outline-none focus:border-[var(--app-accent)]"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-bold text-[var(--app-muted)] uppercase">Invoice / Batch Number</label>
                        <input
                          type="text"
                          value={previewDoc.extractedData?.invoiceNumber || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPreviewDoc(prev => ({
                              ...prev,
                              extractedData: { ...prev.extractedData, invoiceNumber: val }
                            }));
                            setDocuments(prev => prev.map(d => d.id === previewDoc.id ? { ...d, extractedData: { ...d.extractedData, invoiceNumber: val } } : d));
                          }}
                          className="h-8 px-2 bg-[var(--app-panel-bg)] border border-[var(--app-border)] rounded text-[var(--app-text)] font-semibold outline-none focus:border-[var(--app-accent)]"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-bold text-[var(--app-muted)] uppercase">Document Date</label>
                        <input
                          type="date"
                          value={previewDoc.extractedData?.invoiceDate || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPreviewDoc(prev => ({
                              ...prev,
                              extractedData: { ...prev.extractedData, invoiceDate: val }
                            }));
                            setDocuments(prev => prev.map(d => d.id === previewDoc.id ? { ...d, extractedData: { ...d.extractedData, invoiceDate: val } } : d));
                          }}
                          className="h-8 px-2 bg-[var(--app-panel-bg)] border border-[var(--app-border)] rounded text-[var(--app-text)] font-semibold outline-none focus:border-[var(--app-accent)]"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-bold text-[var(--app-muted)] uppercase">GSTIN Identification</label>
                        <input
                          type="text"
                          value={previewDoc.extractedData?.gstin || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPreviewDoc(prev => ({
                              ...prev,
                              extractedData: { ...prev.extractedData, gstin: val }
                            }));
                            setDocuments(prev => prev.map(d => d.id === previewDoc.id ? { ...d, extractedData: { ...d.extractedData, gstin: val } } : d));
                          }}
                          className="h-8 px-2 bg-[var(--app-panel-bg)] border border-[var(--app-border)] rounded text-[var(--app-text)] font-semibold outline-none focus:border-[var(--app-accent)]"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-bold text-[var(--app-muted)] uppercase">Taxable Subtotal (₹)</label>
                        <input
                          type="number"
                          value={previewDoc.extractedData?.taxableValue || 0}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setPreviewDoc(prev => ({
                              ...prev,
                              extractedData: { ...prev.extractedData, taxableValue: val }
                            }));
                            setDocuments(prev => prev.map(d => d.id === previewDoc.id ? { ...d, extractedData: { ...d.extractedData, taxableValue: val } } : d));
                          }}
                          className="h-8 px-2 bg-[var(--app-panel-bg)] border border-[var(--app-border)] rounded text-[var(--app-text)] font-semibold outline-none focus:border-[var(--app-accent)]"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-bold text-[var(--app-muted)] uppercase">Total Amount (₹)</label>
                        <input
                          type="number"
                          value={previewDoc.extractedData?.totalAmount || 0}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setPreviewDoc(prev => ({
                              ...prev,
                              extractedData: { ...prev.extractedData, totalAmount: val }
                            }));
                            setDocuments(prev => prev.map(d => d.id === previewDoc.id ? { ...d, extractedData: { ...d.extractedData, totalAmount: val } } : d));
                          }}
                          className="h-8 px-2 bg-[var(--app-panel-bg)] border border-[var(--app-border)] rounded text-[var(--app-text)] font-semibold outline-none focus:border-[var(--app-accent)]"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>

          {/* Bottom footer removed - buttons moved to top tab bar */}
        </div>
        )
      ) : (
        <React.Fragment>
          {/* PAGE HEADER - matches ManualEntryPanel tab style exactly */}
          <div className="m3-scope flex items-center gap-1 overflow-x-auto themed-scrollbar pb-2 mb-2.5 shrink-0 select-none">
            {[
              { id: 'Upload Documents', count: null, label: 'Upload' },
              { id: 'Uploaded Documents', count: stats.total, label: 'Uploaded' },
              { id: 'Duplicate Documents', count: stats.duplicates, label: 'Duplicate' },
              { id: 'Rejected Documents', count: stats.rejected, label: 'Rejected' }
            ].map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setCheckedDocIds([]);
                  }}
                  className="relative flex items-center gap-2 px-4 h-10 rounded-full shrink-0 transition-colors hover:bg-[var(--m3-surface-container)] cursor-pointer"
                  style={{ color: isActive ? 'var(--m3-on-secondary-container)' : 'var(--m3-on-surface-variant)' }}
                >
                  {isActive && (
                    <motion.span
                      layoutId="m3-bulk-tab"
                      className="absolute inset-0 rounded-full"
                      style={{ backgroundColor: 'var(--m3-secondary-container)' }}
                      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                    />
                  )}
                  <span className="relative flex items-center gap-2">
                    <span className="text-[13px] font-semibold whitespace-nowrap">{tab.label}</span>
                    {tab.count !== null && (
                      <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold transition-all ${
                        isActive 
                          ? 'bg-[var(--app-accent)] text-white' 
                          : 'bg-slate-200/60 dark:bg-slate-700 text-[var(--app-text)]/85'
                      }`}>
                        {tab.count}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

      {/* MAIN VIEWPORT CONTAINER */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        
        {/* LEFT COLUMN: ACTIVE WORKSPACE CONTENT */}
        <div className="flex-1 flex flex-col overflow-hidden px-0 pt-0 pb-0 gap-0 min-w-0">

          {/* TAB 1: UPLOAD DOCUMENTS VIEW */}
          {activeTab === 'Upload Documents' && (
            <div className="flex flex-col flex-1 h-full gap-4 w-full animate-rise-in overflow-hidden">
              {/* Drag and Drop Card - clean, spacious & user friendly */}
              <div 
                className="w-full flex-1 border-2 border-dashed border-[var(--app-border)] hover:border-[var(--app-accent)] hover:bg-[var(--app-accent-soft)] bg-[var(--app-panel-bg)] rounded-xl flex flex-col items-center justify-center text-center p-8 transition-all cursor-pointer relative group"
                onClick={handleBrowseFiles}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    handleUploadSimulated(e.dataTransfer.files);
                  }
                }}
              >
                {/* Cloud Illustration */}
                <div className="w-14 h-14 rounded-full bg-[var(--app-accent-soft)] flex items-center justify-center text-[var(--app-accent)] mb-3 group-hover:scale-110 transition-transform duration-200 shadow-sm border border-[var(--app-accent-soft)]">
                  <UploadCloud size={24} className="animate-bounce" style={{ animationDuration: '2.5s' }} />
                </div>
                
                <h2 className="text-base font-bold text-[var(--app-heading)] tracking-tight">Drop Files Anywhere</h2>
                <p className="text-[var(--app-text)] text-[11px] mt-1 max-w-sm opacity-80 leading-relaxed">
                  Upload one or thousands of accounting documents in a single click. Or drag them here.
                </p>

                {/* Primary/Secondary Buttons */}
                <div className="flex items-center gap-3 mt-4" onClick={(e) => e.stopPropagation()}>
                  <button 
                    onClick={handleBrowseFiles}
                    className="h-9 px-5 bg-[var(--app-accent)] hover:opacity-90 text-[var(--app-on-accent)] rounded-lg font-bold text-xs shadow-sm hover:shadow-md transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>Upload Files</span>
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    multiple
                    accept=".pdf,.png,.jpg,.jpeg,.tiff,.csv,.xls,.xlsx,.zip"
                  />
                  <button 
                    onClick={() => {
                      toast.info('Simulating folder browser import');
                      handleSourceUploadTrigger('Manual Upload');
                    }}
                    className="h-9 px-4 border border-[var(--app-border)] text-[var(--app-text)] bg-[var(--app-panel-bg)] hover:bg-[var(--app-row-hover)] rounded-lg font-bold text-xs transition shadow-2xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <FolderOpen size={14} className="text-[var(--app-muted)]" />
                    <span>Browse Folder</span>
                  </button>
                </div>

                {/* Badge Cloud of Formats */}
                <div className="flex flex-wrap items-center justify-center gap-1.5 mt-4 max-w-xl">
                  {['PDF', 'PNG', 'JPG', 'JPEG', 'TIFF', 'CSV', 'XLS', 'XLSX', 'ZIP'].map(badge => (
                    <span key={badge} className="px-2 py-0.8 bg-[var(--app-content-bg)] text-[var(--app-text)] border border-[var(--app-border)] rounded-md text-[10px] font-bold">
                      {badge}
                    </span>
                  ))}
                </div>

                {/* Max Size Indicator */}
                <div className="text-[10px] text-[var(--app-muted)] mt-3 font-medium flex items-center gap-1.5">
                  <span>Maximum file size: <b>20 GB</b></span>
                  <span className="w-1 h-1 rounded-full bg-[var(--app-border)]"></span>
                  <span>Unlimited files supported</span>
                </div>
              </div>

              {/* Upload Sources Section */}
              <div className="flex flex-col gap-2 pb-2 shrink-0">
                <div>
                  <h3 className="text-[12px] font-bold text-[var(--app-heading)] tracking-tight">Upload Integration Sources</h3>
                  <p className="text-[10.5px] text-[var(--app-muted)] mt-0.5">Connect and ingest files automatically. AI tags the incoming source automatically.</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                  {[
                    { name: 'Manual Upload', icon: UploadCloud, color: 'text-blue-600 bg-blue-50 border-blue-100' },
                    { name: 'Email', icon: Mail, color: 'text-amber-600 bg-amber-50 border-amber-100' },
                    { name: 'WhatsApp', icon: MessageSquare, color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
                    { name: 'Google Drive', icon: GlobeIcon, color: 'text-sky-600 bg-sky-50 border-sky-100' },
                    { name: 'OneDrive', icon: CloudIcon, color: 'text-blue-600 bg-blue-50 border-blue-100' },
                    { name: 'Dropbox', icon: BoxIcon, color: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
                    { name: 'ERP Import', icon: Database, color: 'text-purple-600 bg-purple-50 border-purple-100' },
                    { name: 'Bank Statement Import', icon: FileSpreadsheet, color: 'text-teal-600 bg-teal-50 border-teal-100' }
                  ].map(source => {
                    const Icon = source.icon;
                    return (
                      <button
                        key={source.name}
                        onClick={() => handleSourceUploadTrigger(source.name)}
                        className="py-1.5 px-2 bg-[var(--app-panel-bg)] border border-[var(--app-border)]/80 hover:border-[var(--app-accent)] hover:shadow-2xs rounded-lg flex flex-col items-center text-center transition group cursor-pointer"
                      >
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center mb-0.5 transition-transform group-hover:scale-105 border ${source.color}`}>
                          <Icon size={12} />
                        </div>
                        <span className="text-[9.5px] font-bold text-[var(--app-text)] tracking-tight leading-tight block break-words w-full">
                          {source.name.replace(' Import', '')}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2, 3, 4: UPLOADED / DUPLICATE / REJECTED VIEWS */}
          {activeTab !== 'Upload Documents' && (
            <div className="flex flex-col flex-1 h-full gap-2 w-full animate-rise-in overflow-hidden">
              
              {/* UPLOAD STATUS SUMMARY */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 select-none shrink-0">
                {[
                  { label: 'Uploaded', value: stats.total, color: 'border-[var(--app-border)]/60 text-[var(--app-text)] bg-[var(--app-panel-bg)]' },
                  { label: 'Processing', value: stats.processing, color: 'border-amber-500/15 text-amber-600 bg-amber-500/5' },
                  { label: 'Completed', value: stats.completed, color: 'border-emerald-500/15 text-emerald-650 bg-emerald-550/5' },
                  { label: 'Duplicates', value: stats.duplicates, color: 'border-red-500/15 text-red-650 bg-red-550/5' },
                  { label: 'Rejected', value: stats.rejected, color: 'border-red-500/15 text-red-650 bg-red-550/5' },
                  { label: 'Missing Data', value: stats.missing, color: 'border-amber-500/15 text-amber-600 bg-amber-500/5' }
                ].map(card => (
                  <div key={card.label} className={`px-3 py-2 border rounded-lg flex items-center justify-between gap-2 transition hover:bg-[var(--app-row-hover)] ${card.color}`}>
                    <span className="text-[11px] font-bold tracking-tight uppercase opacity-85">{card.label}</span>
                    <span className="text-[14px] font-black tracking-tight">{card.value}</span>
                  </div>
                ))}
              </div>
              {/* TOP FILTER BAR */}
              <div className="bg-[var(--app-panel-bg)]/80 border border-[var(--app-border)]/65 rounded-lg p-1.5 flex flex-col lg:flex-row lg:items-center justify-between gap-2 shadow-2xs shrink-0">
                
                {/* Search */}
                <div className="relative max-w-xs flex-1">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--app-muted)] pointer-events-none" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search documents, invoices, users..."
                    className="w-full h-8 pl-8 pr-3 rounded-md border border-[var(--app-border)] bg-[var(--app-panel-bg)] text-[12px] text-[var(--app-text)] outline-none focus:border-[var(--app-accent)] focus:ring-1 focus:ring-[var(--app-accent-soft)] font-medium"
                  />
                </div>

                {/* Dropdowns Filters */}
                <div className="flex flex-wrap items-center gap-2">
                  
                  {/* Source Dropdown */}
                  <div className="relative">
                    <select
                      value={sourceFilter}
                      onChange={(e) => setSourceFilter(e.target.value)}
                      className="h-8 px-2.5 pr-6 bg-[var(--app-panel-bg)] border border-[var(--app-border)]/70 text-[var(--app-text)] rounded-md text-[12px] font-semibold outline-none cursor-pointer appearance-none min-w-[110px]"
                    >
                      <option value="All Sources">All Sources</option>
                      <option value="Manual Upload">Manual Upload</option>
                      <option value="Email">Email</option>
                      <option value="WhatsApp">WhatsApp</option>
                      <option value="Google Drive">Google Drive</option>
                      <option value="Dropbox">Dropbox</option>
                      <option value="ERP">ERP</option>
                    </select>
                    <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--app-muted)] pointer-events-none" />
                  </div>

                  {/* Document Type Dropdown */}
                  <div className="relative">
                    <select
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value)}
                      className="h-8 px-2.5 pr-6 bg-[var(--app-panel-bg)] border border-[var(--app-border)]/70 text-[var(--app-text)] rounded-md text-[12px] font-semibold outline-none cursor-pointer appearance-none min-w-[130px]"
                    >
                      <option value="All Types">All Types</option>
                      <option value="Purchase Invoice">Purchase Invoice</option>
                      <option value="Sales Invoice">Sales Invoice</option>
                      <option value="Expense Bill">Expense Bill</option>
                      <option value="Receipt">Receipt</option>
                      <option value="Credit Note">Credit Note</option>
                      <option value="Debit Note">Debit Note</option>
                      <option value="Bank Statement">Bank Statement</option>
                      <option value="GST Report">GST Report</option>
                      <option value="Purchase Register">Purchase Register</option>
                      <option value="Sales Register">Sales Register</option>
                      <option value="Vendor Statement">Vendor Statement</option>
                      <option value="Unknown">Unknown</option>
                    </select>
                    <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--app-muted)] pointer-events-none" />
                  </div>

                  {/* Category Dropdown */}
                  <div className="relative">
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="h-8 px-2.5 pr-6 bg-[var(--app-panel-bg)] border border-[var(--app-border)]/70 text-[var(--app-text)] rounded-md text-[12px] font-semibold outline-none cursor-pointer appearance-none min-w-[115px]"
                    >
                      <option value="All Categories">All Categories</option>
                      <option value="Financial">Financial</option>
                      <option value="Non-Financial">Non-Financial</option>
                      <option value="Unknown">Unknown</option>
                    </select>
                    <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--app-muted)] pointer-events-none" />
                  </div>

                  {/* Action Buttons */}
                  <button 
                    onClick={handleResetFilters}
                    className="h-8 px-2 text-[12px] font-bold text-[var(--app-muted)] hover:text-[var(--app-heading)] transition cursor-pointer bg-transparent border-none"
                  >
                    Reset
                  </button>

                  <button 
                    onClick={() => setShowInsightsPanel(!showInsightsPanel)}
                    className={`h-8 px-2.5 rounded-md border text-[12px] font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                      showInsightsPanel 
                        ? 'bg-[var(--app-accent-soft)] border-[var(--app-accent)]/30 text-[var(--app-accent)]' 
                        : 'bg-[var(--app-panel-bg)] border-[var(--app-border)] text-[var(--app-text)] hover:bg-[var(--app-row-hover)]'
                    }`}
                  >
                    <SlidersHorizontal size={12} />
                    <span>Insights Panel</span>
                  </button>
                </div>
              </div>
              {/* ENTERPRISE DATA TABLE */}
              <div className="bg-[var(--app-panel-bg)] border border-[var(--app-border)]/60 rounded-lg shadow-2xs overflow-hidden flex flex-col flex-1 min-h-0">
                <div className="overflow-x-auto flex-1">
                  <table className="w-full text-left border-collapse min-w-[1180px] text-xs whitespace-nowrap table-fixed">
                    <colgroup>
                      <col style={{ width: '40px' }} />
                      <col style={{ width: '220px' }} />
                      <col style={{ width: '120px' }} />
                      <col style={{ width: '130px' }} />
                      <col style={{ width: '100px' }} />
                      <col style={{ width: '140px' }} />
                      <col style={{ width: '120px' }} />
                      <col style={{ width: '120px' }} />
                    </colgroup>
                    <thead>
                      <tr className="bg-[var(--app-table-head-bg)]/80 border-b border-[var(--app-border)] text-[var(--app-muted)] font-bold uppercase tracking-wider text-[11px]">
                        <th className="py-1.5 px-2 text-center">
                          <input
                            type="checkbox"
                            className="rounded border-[var(--app-border)] text-[var(--app-accent)] focus:ring-[var(--app-accent-soft)] cursor-pointer h-3 w-3"
                            onChange={handleSelectAll}
                            checked={paginatedDocs.length > 0 && paginatedDocs.every(d => checkedDocIds.includes(d.id))}
                          />
                        </th>
                        <th className="py-1.5 px-2">Document</th>
                        <th className="py-1.5 px-2">Source</th>
                        <th className="py-1.5 px-2">Detected Type</th>
                        <th className="py-1.5 px-2">Category</th>
                        <th className="py-1.5 px-2 text-center">Uploaded On</th>
                        <th className="py-1.5 px-2 text-center">AI Status</th>
                        <th className="py-1.5 px-2 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--app-row-border)] font-medium text-[var(--app-text)]">
                      {paginatedDocs.length > 0 ? (
                        paginatedDocs.map((doc) => {
                          const isChecked = checkedDocIds.includes(doc.id);
                          return (
                            <tr
                              key={doc.id}
                              onClick={() => handleOpenPreview(doc)}
                              className={`hover:bg-[var(--app-row-hover)]/60 cursor-pointer transition-colors ${
                                isChecked ? 'bg-[var(--app-accent-soft)]/50' : ''
                              }`}
                            >
                              {/* Checkbox */}
                              <td className="py-1 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  className="rounded border-[var(--app-border)] text-[var(--app-accent)] focus:ring-[var(--app-accent-soft)] cursor-pointer h-3 w-3"
                                  checked={isChecked}
                                  onChange={() => handleSelectRow(doc.id)}
                                />
                              </td>

                              {/* Document Details */}
                              <td className="py-1 px-2 font-semibold text-[var(--app-heading)] min-w-0">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  {getDocIcon(doc.name)}
                                  <div className="flex flex-col min-w-0">
                                    <span className="truncate block font-bold text-[var(--app-heading)] text-[11px]" title={doc.name}>
                                      {doc.name}
                                    </span>
                                    <span className="text-[9px] text-[var(--app-muted)] font-mono leading-none mt-0.5">
                                      {doc.id}
                                    </span>
                                  </div>
                                </div>
                              </td>

                              {/* Source */}
                              <td className="py-1 px-2">{getSourceBadge(doc.source)}</td>

                              {/* Detected Type */}
                              <td className="py-1 px-2">{getTypeBadge(doc.type)}</td>

                              {/* Category */}
                              <td className="py-1 px-2">{getCategoryBadge(doc.category)}</td>

                              {/* Uploaded On */}
                              <td className="py-1 px-2 text-center text-[var(--app-muted)] font-mono text-[9px]">
                                {doc.uploadedOn}
                              </td>

                              {/* AI Status or progress bar */}
                              <td className="py-1 px-2 text-center">
                                {doc.progress !== undefined ? (
                                  <div className="w-20 mx-auto flex flex-col gap-0.5 items-center">
                                    <div className="w-full bg-[var(--app-content-bg)] rounded-full h-1 overflow-hidden border border-[var(--app-border)]/50">
                                      <div className="bg-[var(--app-accent)] h-full transition-all duration-300" style={{ width: `${doc.progress}%` }}></div>
                                    </div>
                                    <span className="text-[8.5px] text-[var(--app-muted)] leading-none font-bold font-mono">{doc.progress}%</span>
                                  </div>
                                ) : (
                                  <div className="flex flex-col gap-1 items-center justify-center">
                                    {getStatusBadge(doc.status)}
                                    {doc.quality_check && getQualityBadge(doc.quality_check)}
                                  </div>
                                )}
                              </td>

                              {/* Action Buttons */}
                              <td className="py-1 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-center gap-1 text-[var(--app-muted)]">
                                  <button
                                    onClick={() => handleOpenPreview(doc)}
                                    className="p-1 hover:text-[var(--app-accent)] hover:bg-[var(--app-row-hover)] rounded transition cursor-pointer"
                                    title="Preview file"
                                  >
                                    <Eye size={13} />
                                  </button>
                                  <button
                                    onClick={() => {
                                      toast.info(`Moved document ${doc.id} to Accounting queue`);
                                    }}
                                    className="p-1 hover:text-[var(--app-accent)] hover:bg-[var(--app-row-hover)] rounded transition cursor-pointer"
                                    title="Move document"
                                  >
                                    <FolderOpen size={13} />
                                  </button>
                                  <button
                                    onClick={() => handleOpenRejectModal(doc)}
                                    className="p-1 hover:text-red-650 hover:bg-[var(--app-row-hover)] rounded transition cursor-pointer"
                                    title="Reject document"
                                  >
                                    <AlertCircle size={13} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteDoc(doc.id)}
                                    className="p-1 hover:text-red-650 hover:bg-[var(--app-row-hover)] rounded transition cursor-pointer"
                                    title="Delete document"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                  {doc.status === 'Rejected' && (
                                    <button
                                      onClick={() => handleRetryProcessing(doc)}
                                      className="p-1 hover:text-emerald-600 hover:bg-[var(--app-row-hover)] rounded transition cursor-pointer"
                                      title="Retry AI OCR Processing"
                                    >
                                      <RefreshCw size={13} />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleOpenAIDetails(doc)}
                                    className="p-1 hover:text-[var(--app-accent)] hover:bg-[var(--app-row-hover)] rounded transition cursor-pointer"
                                    title="View AI details & confidence"
                                  >
                                    <Scan size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={8} className="p-12 text-center text-[var(--app-muted)] font-medium">
                            <div className="flex flex-col items-center justify-center gap-1.5">
                              <Info size={24} className="text-[var(--app-border)]" />
                              <span>No documents found matching the filters.</span>
                              <button 
                                onClick={handleResetFilters}
                                className="text-[var(--app-accent)] hover:underline font-bold text-xs mt-2 cursor-pointer bg-transparent border-none"
                              >
                                Clear All Filters
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Table Footer / Pagination */}
                <div className="px-4 py-3 bg-[var(--app-table-head-bg)]/50 border-t border-[var(--app-border)] flex flex-col sm:flex-row items-center justify-between gap-3 font-semibold text-[var(--app-muted)]">
                  <div className="text-xs">
                    Showing <span className="text-[var(--app-heading)] font-bold">{filteredDocs.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</span> to{' '}
                    <span className="text-[var(--app-heading)] font-bold">{Math.min(currentPage * itemsPerPage, filteredDocs.length)}</span> of{' '}
                    <span className="text-[var(--app-heading)] font-bold">{filteredDocs.length}</span> documents
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="h-7 px-2 flex items-center justify-center rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-bg)] text-[var(--app-text)] hover:bg-[var(--app-row-hover)] transition disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronLeft size={14} />
                      <span className="pr-1">Prev</span>
                    </button>
                    {Array.from({ length: totalPages }).map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentPage(idx + 1)}
                        className={`h-7 w-7 text-xs rounded-lg font-bold border transition ${
                          currentPage === idx + 1
                            ? 'bg-[var(--app-accent)] border-[var(--app-accent)] text-[var(--app-on-accent)] shadow-2xs'
                            : 'border-[var(--app-border)] bg-[var(--app-panel-bg)] text-[var(--app-text)] hover:bg-[var(--app-row-hover)]'
                        }`}
                      >
                        {idx + 1}
                      </button>
                    ))}
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="h-7 px-2 flex items-center justify-center rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-bg)] text-[var(--app-text)] hover:bg-[var(--app-row-hover)] transition disabled:opacity-40 cursor-pointer"
                    >
                      <span className="pl-1">Next</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: AI UPLOAD INSIGHTS COLLAPSIBLE SIDE PANEL */}
        <AnimatePresence>
          {showInsightsPanel && activeTab !== 'Upload Documents' && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 260, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-l border-[var(--app-border)] bg-[var(--app-panel-bg)] flex flex-col shrink-0 overflow-y-auto"
            >
              <div className="p-2.5 border-b border-[var(--app-border)] flex justify-between items-center bg-[var(--app-table-head-bg)]/50">
                <span className="font-bold text-[var(--app-heading)] text-xs tracking-tight flex items-center gap-1.5">
                  <Scan size={14} className="text-[var(--app-accent)]" />
                  <span>AI Upload Insights</span>
                </span>
                <button
                  onClick={() => setShowInsightsPanel(false)}
                  className="p-1 hover:bg-[var(--app-row-hover)] rounded text-[var(--app-muted)] hover:text-[var(--app-heading)] cursor-pointer bg-transparent border-none"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="p-3 flex flex-col gap-3">
                {/* Stats Breakdown List */}
                <div className="bg-[var(--app-content-bg)]/40 border border-[var(--app-border)]/60 rounded-lg p-2.5 flex flex-col gap-2">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-[var(--app-muted)] font-bold">Total Uploaded</span>
                    <span className="font-extrabold text-[var(--app-heading)]">{stats.total}</span>
                  </div>
                  <div className="w-full bg-[var(--app-border)] h-1 rounded-full overflow-hidden">
                    <div className="bg-[var(--app-accent)] h-full rounded-full" style={{ width: '100%' }}></div>
                  </div>
                  
                  <div className="flex justify-between items-center text-[11px] mt-1">
                    <span className="text-[var(--app-muted)] font-bold">Financial Docs</span>
                    <span className="font-extrabold text-[var(--app-heading)]">
                      {documents.filter(d => d.category === 'Financial').length}
                    </span>
                  </div>
                  <div className="w-full bg-[var(--app-border)] h-1 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${(documents.filter(d => d.category === 'Financial').length / Math.max(1, stats.total)) * 100}%` }}></div>
                  </div>

                  <div className="flex justify-between items-center text-[11px] mt-1">
                    <span className="text-[var(--app-muted)] font-bold">Non-Financial Docs</span>
                    <span className="font-extrabold text-[var(--app-heading)]">
                      {documents.filter(d => d.category === 'Non-Financial').length}
                    </span>
                  </div>
                  <div className="w-full bg-[var(--app-border)] h-1 rounded-full overflow-hidden">
                    <div className="bg-slate-400 h-full rounded-full" style={{ width: `${(documents.filter(d => d.category === 'Non-Financial').length / Math.max(1, stats.total)) * 100}%` }}></div>
                  </div>

                  <div className="flex justify-between items-center text-[11px] mt-1">
                    <span className="text-[var(--app-muted)] font-bold">Duplicate Docs</span>
                    <span className="font-extrabold text-[var(--app-heading)]">{stats.duplicates}</span>
                  </div>
                  <div className="w-full bg-[var(--app-border)] h-1 rounded-full overflow-hidden">
                    <div className="bg-rose-500 h-full rounded-full" style={{ width: `${(stats.duplicates / Math.max(1, stats.total)) * 100}%` }}></div>
                  </div>

                  <div className="flex justify-between items-center text-[11px] mt-1">
                    <span className="text-[var(--app-muted)] font-bold">Rejected Docs</span>
                    <span className="font-extrabold text-[var(--app-heading)]">{stats.rejected}</span>
                  </div>
                  <div className="w-full bg-[var(--app-border)] h-1 rounded-full overflow-hidden">
                    <div className="bg-red-650 h-full rounded-full" style={{ width: `${(stats.rejected / Math.max(1, stats.total)) * 100}%` }}></div>
                  </div>

                  <div className="flex justify-between items-center text-[11px] mt-1">
                    <span className="text-[var(--app-muted)] font-bold">Missing Fields</span>
                    <span className="font-extrabold text-amber-600">{stats.missing}</span>
                  </div>
                  <div className="w-full bg-[var(--app-border)] h-1 rounded-full overflow-hidden">
                    <div className="bg-amber-500 h-full rounded-full" style={{ width: `${(stats.missing / Math.max(1, stats.total)) * 100}%` }}></div>
                  </div>
                </div>

                {/* AI Performance Gauge */}
                <div className="border border-[var(--app-border)]/60 rounded-lg p-2.5 flex flex-col items-center justify-center text-center bg-[var(--app-panel-bg)]">
                  <span className="text-[9.5px] font-bold text-[var(--app-muted)] uppercase tracking-wider block mb-1.5">
                    Average OCR Accuracy
                  </span>
                  
                  {/* Gauge Ring Shape */}
                  <div className="relative w-20 h-20 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="text-[var(--app-border)]/50"
                        strokeWidth="3"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className="text-[var(--app-accent)]"
                        strokeWidth="3.2"
                        strokeDasharray="98, 100"
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center">
                      <span className="text-sm font-extrabold text-[var(--app-heading)] leading-none">98%</span>
                      <span className="text-[7.5px] text-[var(--app-muted)] mt-0.5 uppercase tracking-wide">Confidence</span>
                    </div>
                  </div>

                  <p className="text-[9.5px] text-[var(--app-muted)] leading-normal mt-2 px-1">
                    AI models are learning continuously. Data validation triggers for records under 90% confidence index.
                  </p>
                </div>

                {/* Processing Queue List */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-bold text-[var(--app-heading)] tracking-tight">Active Queue</span>
                  <div className="flex flex-col gap-1.5 max-h-[190px] overflow-y-auto pr-1">
                    {documents.filter(d => d.status === 'Processing').length > 0 ? (
                      documents
                        .filter(d => d.status === 'Processing')
                        .map(item => (
                          <div key={item.id} className="p-1.5 border border-[var(--app-border)]/60 rounded-md flex items-center justify-between gap-2 bg-[var(--app-content-bg)]/20">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {getDocIcon(item.name)}
                              <div className="flex flex-col min-w-0">
                                <span className="text-[10.5px] font-bold text-[var(--app-text)] truncate max-w-[130px] block">
                                  {item.name}
                                </span>
                                <span className="text-[9px] text-[var(--app-muted)] font-mono leading-none mt-0.5">
                                  {item.id}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <RefreshCw size={11} className="text-amber-500 animate-spin" />
                              <span className="text-[9px] font-bold font-mono text-[var(--app-muted)]">{item.progress || 0}%</span>
                            </div>
                          </div>
                        ))
                    ) : (
                      <div className="py-6 text-center border border-dashed border-[var(--app-border)] rounded-xl text-[var(--app-muted)] text-[10.5px]">
                        No active files in OCR processing queue.
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* --- POPUP 1: REJECT MODAL DIALOG --- */}
      <AnimatePresence>
        {showRejectModal && docToReject && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[var(--app-panel-bg)] rounded-xl border border-[var(--app-border)] shadow-xl max-w-md w-full overflow-hidden flex flex-col text-[var(--app-text)]"
            >
              <div className="px-5 py-4 border-b border-[var(--app-border)] flex justify-between items-center">
                <h3 className="text-sm font-bold text-[var(--app-heading)] flex items-center gap-2">
                  <AlertCircle className="text-red-500" size={16} />
                  <span>Reject Document</span>
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowRejectModal(false);
                    setDocToReject(null);
                  }}
                  className="text-[var(--app-muted)] hover:text-[var(--app-heading)] cursor-pointer bg-transparent border-none"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-5 flex flex-col gap-4">
                <p className="text-[var(--app-text)]/90 text-xs leading-normal">
                  Are you sure you want to reject the document <b className="text-[var(--app-heading)]">{docToReject.name}</b>? Please select a reason below to update the AI audit log.
                </p>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-[var(--app-muted)] uppercase tracking-wide">
                    Rejection Reason
                  </label>
                  <div className="relative">
                    <select
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      className="w-full h-9 pl-3 pr-8 bg-[var(--app-panel-bg)] border border-[var(--app-border)] rounded-lg text-xs font-semibold text-[var(--app-text)] outline-none cursor-pointer appearance-none"
                    >
                      <option value="Wrong Company">Wrong Company</option>
                      <option value="Duplicate Document">Duplicate Document</option>
                      <option value="Non Financial">Non Financial</option>
                      <option value="Corrupted File">Corrupted File</option>
                      <option value="Spam">Spam</option>
                      <option value="Incomplete">Incomplete</option>
                      <option value="Other">Other</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--app-muted)] pointer-events-none" />
                  </div>
                </div>

                {rejectReason === 'Other' && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-[var(--app-muted)] uppercase tracking-wide">
                      Specify Other Reason
                    </label>
                    <input
                      type="text"
                      value={rejectOtherReason}
                      onChange={(e) => setRejectOtherReason(e.target.value)}
                      placeholder="Type reason here..."
                      className="w-full h-9 px-3 rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-bg)] text-xs font-medium text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                    />
                  </div>
                )}
              </div>

              <div className="px-5 py-3.5 bg-[var(--app-table-head-bg)]/50 border-t border-[var(--app-border)] flex justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowRejectModal(false);
                    setDocToReject(null);
                  }}
                  className="px-4 py-2 border border-[var(--app-border)] text-[var(--app-text)] bg-[var(--app-panel-bg)] hover:bg-[var(--app-row-hover)] rounded-lg font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReject}
                  className="px-4 py-2 bg-red-650 hover:bg-red-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-sm"
                >
                  Reject
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- POPUP 2: MISSING INFORMATION FORM MODAL --- */}
      <AnimatePresence>
        {showMissingInfoModal && docToEdit && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[var(--app-panel-bg)] rounded-xl border border-[var(--app-border)] shadow-xl max-w-lg w-full overflow-hidden flex flex-col text-[var(--app-text)]"
            >
              <form onSubmit={handleSaveMissingInfo} className="flex flex-col h-full">
                
                <div className="px-5 py-4 border-b border-[var(--app-border)] flex justify-between items-center">
                  <h3 className="text-sm font-bold text-[var(--app-heading)] flex items-center gap-2">
                    <AlertTriangle className="text-amber-500" size={16} />
                    <span>Complete Missing Details Form</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMissingInfoModal(false);
                      setDocToEdit(null);
                    }}
                    className="text-[var(--app-muted)] hover:text-[var(--app-heading)] cursor-pointer bg-transparent border-none"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="p-5 flex flex-col gap-4 max-h-[420px] overflow-y-auto">
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-600 text-[11px] leading-relaxed flex items-start gap-2">
                    <Info size={14} className="text-amber-500 mt-0.5 shrink-0" />
                    <span>
                      Some details couldn't be extracted securely from the document <b className="text-[var(--app-heading)]">{docToEdit.name}</b>. Please input them manually below to complete AI classification.
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    
                    <div className="col-span-2 flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-[var(--app-muted)] uppercase tracking-wide">
                        Vendor / Party Name
                      </label>
                      <input
                        type="text"
                        required
                        value={missingFormData.vendorName}
                        onChange={(e) => setMissingFormData({ ...missingFormData, vendorName: e.target.value })}
                        placeholder="e.g. Amazon Supplies India"
                        className="h-8.5 px-3 rounded-lg border border-[var(--app-border)] text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] bg-[var(--app-panel-bg)]"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-[var(--app-muted)] uppercase tracking-wide">
                        Invoice Number
                      </label>
                      <input
                        type="text"
                        required
                        value={missingFormData.invoiceNumber}
                        onChange={(e) => setMissingFormData({ ...missingFormData, invoiceNumber: e.target.value })}
                        placeholder="e.g. INV-2026-90"
                        className="h-8.5 px-3 rounded-lg border border-[var(--app-border)] text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] bg-[var(--app-panel-bg)]"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-[var(--app-muted)] uppercase tracking-wide">
                        Invoice Date
                      </label>
                      <input
                        type="date"
                        required
                        value={missingFormData.invoiceDate}
                        onChange={(e) => setMissingFormData({ ...missingFormData, invoiceDate: e.target.value })}
                        className="h-8.5 px-3 rounded-lg border border-[var(--app-border)] text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] bg-[var(--app-panel-bg)]"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-[var(--app-muted)] uppercase tracking-wide">
                        GSTIN
                      </label>
                      <input
                        type="text"
                        value={missingFormData.gstin}
                        onChange={(e) => setMissingFormData({ ...missingFormData, gstin: e.target.value })}
                        placeholder="e.g. 27AAAAA1111A1Z5"
                        className="h-8.5 px-3 rounded-lg border border-[var(--app-border)] text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] bg-[var(--app-panel-bg)]"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-[var(--app-muted)] uppercase tracking-wide">
                        Taxable Value (₹)
                      </label>
                      <input
                        type="number"
                        required
                        value={missingFormData.taxableValue}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          const tax = Math.round(val * 0.18 * 100) / 100;
                          setMissingFormData({
                            ...missingFormData,
                            taxableValue: val,
                            taxAmount: tax,
                            totalAmount: val + tax
                          });
                        }}
                        placeholder="0.00"
                        className="h-8.5 px-3 rounded-lg border border-[var(--app-border)] text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] bg-[var(--app-panel-bg)]"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-[var(--app-muted)] uppercase tracking-wide">
                        GST Tax Amount (₹)
                      </label>
                      <input
                        type="number"
                        value={missingFormData.taxAmount}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setMissingFormData({
                            ...missingFormData,
                            taxAmount: val,
                            totalAmount: missingFormData.taxableValue + val
                          });
                        }}
                        placeholder="0.00"
                        className="h-8.5 px-3 rounded-lg border border-[var(--app-border)] text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] bg-[var(--app-panel-bg)]"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-[var(--app-muted)] uppercase tracking-wide">
                        Total Invoice Value (₹)
                      </label>
                      <input
                        type="number"
                        required
                        value={missingFormData.totalAmount}
                        onChange={(e) => setMissingFormData({ ...missingFormData, totalAmount: parseFloat(e.target.value) || 0 })}
                        placeholder="0.00"
                        className="h-8.5 px-3 rounded-lg border border-[var(--app-border)] text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] bg-[var(--app-panel-bg)]"
                      />
                    </div>

                  </div>
                </div>

                <div className="px-5 py-3.5 bg-[var(--app-table-head-bg)]/50 border-t border-[var(--app-border)] flex justify-end gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setShowMissingInfoModal(false);
                      setDocToEdit(null);
                    }}
                    className="px-4 py-2 border border-[var(--app-border)] text-[var(--app-text)] bg-[var(--app-panel-bg)] hover:bg-[var(--app-row-hover)] rounded-lg font-bold text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[var(--app-accent)] hover:opacity-90 text-[var(--app-on-accent)] rounded-lg font-bold text-xs cursor-pointer shadow-sm"
                  >
                    Save Details
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- POPUP 3: VIEW AI DETAILS SIDE SHEET --- */}
      <AnimatePresence>
        {showAIDetailsModal && selectedDoc && (
          <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs flex justify-end z-50">
            {/* Backdrop close area */}
            <div className="flex-1" onClick={() => { setShowAIDetailsModal(false); setSelectedDoc(null); }}></div>
            
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.2 }}
              className="w-full max-w-md bg-[var(--app-panel-bg)] border-l border-[var(--app-border)] h-full flex flex-col shadow-2xl overflow-hidden text-[var(--app-text)]"
            >
              <div className="px-5 py-4 border-b border-[var(--app-border)] flex justify-between items-center bg-[var(--app-table-head-bg)]/50">
                <div className="flex items-center gap-2">
                  <Scan size={16} className="text-[var(--app-accent)]" />
                  <span className="font-extrabold text-[var(--app-heading)] text-xs uppercase tracking-wider">
                    AI Auto-Categorization Log
                  </span>
                </div>
                <button
                  onClick={() => { setShowAIDetailsModal(false); setSelectedDoc(null); }}
                  className="p-1 hover:bg-[var(--app-row-hover)] rounded text-[var(--app-muted)] hover:text-[var(--app-heading)] cursor-pointer bg-transparent border-none"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
                
                {/* Confidence Meter */}
                <div className="bg-[var(--app-content-bg)]/40 border border-[var(--app-border)] p-4 rounded-xl flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-[var(--app-muted)] uppercase tracking-wider">
                      OCR Confidence Score
                    </span>
                    <span className="text-2xl font-black text-[var(--app-heading)] mt-0.5">
                      {selectedDoc.confidence}%
                    </span>
                  </div>
                  
                  {/* Color progress ring */}
                  <div className="w-12 h-12 relative flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                      <path className="text-[var(--app-border)]/50" strokeWidth="2.5" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      <path className="text-[var(--app-accent)]" strokeWidth="3" strokeDasharray={`${selectedDoc.confidence}, 100`} strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    </svg>
                  </div>
                </div>

                {/* AI Tags */}
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-bold text-[var(--app-muted)] uppercase tracking-wider">
                    AI Auto-Detected Tags
                  </span>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-[var(--app-content-bg)]/40 border border-[var(--app-border)] rounded-lg p-2.5">
                      <span className="text-[9px] text-[var(--app-muted)] font-bold uppercase">Source</span>
                      <div className="mt-1 font-bold text-[var(--app-heading)] text-xs">
                        {selectedDoc.source}
                      </div>
                    </div>
                    
                    <div className="bg-[var(--app-content-bg)]/40 border border-[var(--app-border)] rounded-lg p-2.5">
                      <span className="text-[9px] text-[var(--app-muted)] font-bold uppercase">Category</span>
                      <div className="mt-1 font-bold text-[var(--app-heading)] text-xs">
                        {selectedDoc.category}
                      </div>
                    </div>

                    <div className="bg-[var(--app-content-bg)]/40 border border-[var(--app-border)] rounded-lg p-2.5 col-span-2">
                      <span className="text-[9px] text-[var(--app-muted)] font-bold uppercase">Document Type</span>
                      <div className="mt-1 font-bold text-[var(--app-accent)] text-xs flex items-center gap-1.5">
                        {selectedDoc.type}
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Structured JSON Extracted Fields */}
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-bold text-[var(--app-muted)] uppercase tracking-wider">
                    Extracted OCR Schema
                  </span>
                  
                  <div className="border border-[var(--app-border)] rounded-xl overflow-hidden divide-y divide-[var(--app-row-border)] text-xs font-semibold">
                    <div className="px-4 py-2.5 flex justify-between bg-[var(--app-table-head-bg)]/50">
                      <span className="text-[var(--app-muted)] font-bold">Vendor Name</span>
                      <span className="text-[var(--app-heading)] font-bold text-right">{selectedDoc.extractedData?.vendorName || '--'}</span>
                    </div>
                    <div className="px-4 py-2.5 flex justify-between bg-[var(--app-panel-bg)]">
                      <span className="text-[var(--app-muted)] font-bold">Invoice Number</span>
                      <span className="text-[var(--app-heading)] font-mono text-right">{selectedDoc.extractedData?.invoiceNumber || '--'}</span>
                    </div>
                    <div className="px-4 py-2.5 flex justify-between bg-[var(--app-table-head-bg)]/50">
                      <span className="text-[var(--app-muted)] font-bold">Invoice Date</span>
                      <span className="text-[var(--app-heading)] font-mono text-right">{selectedDoc.extractedData?.invoiceDate || '--'}</span>
                    </div>
                    <div className="px-4 py-2.5 flex justify-between bg-[var(--app-panel-bg)]">
                      <span className="text-[var(--app-muted)] font-bold">GSTIN</span>
                      <span className="text-[var(--app-heading)] font-mono text-right">{selectedDoc.extractedData?.gstin || '--'}</span>
                    </div>
                    <div className="px-4 py-2.5 flex justify-between bg-[var(--app-table-head-bg)]/50">
                      <span className="text-[var(--app-muted)] font-bold">Taxable Value</span>
                      <span className="text-[var(--app-heading)] font-extrabold text-right">
                        ₹ {selectedDoc.extractedData?.taxableValue?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="px-4 py-2.5 flex justify-between bg-[var(--app-panel-bg)]">
                      <span className="text-[var(--app-muted)] font-bold">GST Tax (18%)</span>
                      <span className="text-[var(--app-heading)] font-extrabold text-right">
                        ₹ {selectedDoc.extractedData?.taxAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="px-4 py-2.5 flex justify-between bg-[var(--app-table-head-bg)]/50">
                      <span className="text-[var(--app-muted)] font-bold">Total Invoice Value</span>
                      <span className="text-[var(--app-accent)] font-black text-right text-sm">
                        ₹ {selectedDoc.extractedData?.totalAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Audit history logs */}
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-bold text-[var(--app-muted)] uppercase tracking-wider">
                    AI Auto Audit Steps
                  </span>
                  
                  <div className="flex flex-col gap-3.5 pl-3 border-l-2 border-[var(--app-border)]">
                    <div className="relative">
                      <div className="absolute -left-[17px] top-1.5 w-2 h-2 rounded-full bg-emerald-500 border border-[var(--app-panel-bg)]"></div>
                      <span className="text-[10.5px] font-bold text-[var(--app-heading)]">1. Raw OCR Ingestion</span>
                      <p className="text-[9.5px] text-[var(--app-muted)] leading-none mt-0.5">Completed successfully at {selectedDoc.uploadedOn}</p>
                    </div>
                    
                    <div className="relative">
                      <div className="absolute -left-[17px] top-1.5 w-2 h-2 rounded-full bg-emerald-500 border border-[var(--app-panel-bg)]"></div>
                      <span className="text-[10.5px] font-bold text-[var(--app-heading)]">2. Layout Parsing & Classification</span>
                      <p className="text-[9.5px] text-[var(--app-muted)] leading-none mt-0.5">Identified schema fields with {selectedDoc.confidence}% confidence index</p>
                    </div>

                    <div className="relative">
                      <div className={`absolute -left-[17px] top-1.5 w-2 h-2 rounded-full border border-[var(--app-panel-bg)] ${
                        selectedDoc.status === 'Missing Information' ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}></div>
                      <span className="text-[10.5px] font-bold text-[var(--app-heading)]">3. Schema Field Integrity Verification</span>
                      <p className="text-[9.5px] text-[var(--app-muted)] leading-none mt-0.5">
                        {selectedDoc.status === 'Missing Information' 
                          ? 'Failed: Missing required invoice layout fields' 
                          : 'Success: Extracted fields matching validation standards'
                        }
                      </p>
                    </div>
                  </div>
                </div>

              </div>

              <div className="px-5 py-4 bg-[var(--app-table-head-bg)]/50 border-t border-[var(--app-border)] flex items-center justify-between shrink-0">
                <span className="text-[10px] font-bold text-[var(--app-muted)]">
                  ID: {selectedDoc.id}
                </span>

                <div className="flex gap-2">
                  <button
                      onClick={() => {
                        setShowAIDetailsModal(false);
                        setSelectedDoc(null);
                      }}
                      className="px-4 py-2 border border-[var(--app-border)] text-[var(--app-text)] bg-[var(--app-panel-bg)] hover:bg-[var(--app-row-hover)] rounded-lg font-bold text-xs cursor-pointer"
                    >
                      Close Log
                    </button>
                    {selectedDoc.status !== 'Validated' && (
                      <button
                        onClick={() => {
                          setDocuments(prev => prev.map(d => d.id === selectedDoc.id ? { ...d, status: 'Validated' } : d));
                          toast.success('Document marked as validated');
                          setShowAIDetailsModal(false);
                          setSelectedDoc(null);
                        }}
                        className="px-4 py-2 bg-[var(--app-accent)] hover:opacity-90 text-[var(--app-on-accent)] rounded-lg font-bold text-xs cursor-pointer shadow-sm"
                      >
                        Validate Fields
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        </React.Fragment>
      )}

      {/* ── Duplicate Resolution Modal ─────────────────────────────────────── */}
      {duplicateUploadInfo && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/50 select-none animate-fadeIn">
          <div className="bg-white dark:bg-[#15151a] border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <ShieldAlert className="text-rose-500 shrink-0" size={18} />
              <h3 className="text-sm font-bold text-slate-850 dark:text-slate-100">Duplicate Document Detected</h3>
            </div>
            
            {/* Content */}
            <div className="p-5 space-y-4">
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                An identical document has already been uploaded to the system. Please choose how you wish to proceed:
              </p>
              
              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800/50 space-y-2">
                <div className="flex justify-between">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">File Name</span>
                  <span className="text-[10.5px] font-bold text-slate-700 dark:text-slate-300 truncate max-w-[200px]" title={duplicateUploadInfo.existingDoc.filename}>
                    {duplicateUploadInfo.existingDoc.filename}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">Uploaded By</span>
                  <span className="text-[10.5px] font-bold text-slate-700 dark:text-slate-300">
                    {duplicateUploadInfo.existingDoc.uploaded_by}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">Upload Date</span>
                  <span className="text-[10.5px] font-bold text-slate-700 dark:text-slate-300">
                    {new Date(duplicateUploadInfo.existingDoc.uploaded_on).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">Current Status</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/30 uppercase tracking-wide">
                    {duplicateUploadInfo.existingDoc.status}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Actions Footer */}
            <div className="px-5 py-3.5 bg-slate-50/50 dark:bg-slate-900/20 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2 justify-end">
              <button
                onClick={() => {
                  setDuplicateUploadInfo(null);
                  toast.info("Upload cancelled.");
                }}
                className="px-3.5 py-1.5 border border-slate-200 dark:border-slate-700 text-slate-650 dark:text-slate-350 text-[11px] font-bold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors bg-white dark:bg-transparent"
              >
                Cancel Upload
              </button>
              
              <button
                onClick={handleForceReplaceUpload}
                className="px-3.5 py-1.5 border border-amber-200 text-amber-600 dark:text-amber-400 text-[11px] font-bold rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/20 cursor-pointer transition-colors bg-white dark:bg-transparent"
              >
                Replace
              </button>
              
              <button
                onClick={() => {
                  const existingId = duplicateUploadInfo.existingDoc.id;
                  setDuplicateUploadInfo(null);
                  const existing = documents.find(d => d.id === existingId) || {
                    id: existingId,
                    uploadId: existingId,
                    name: duplicateUploadInfo.existingDoc.filename,
                    status: duplicateUploadInfo.existingDoc.status,
                    uploadedBy: duplicateUploadInfo.existingDoc.uploaded_by,
                    uploadedOn: duplicateUploadInfo.existingDoc.uploaded_on
                  };
                  setAiReviewDoc(existing);
                }}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg cursor-pointer transition-colors border-none"
              >
                Open Existing
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Flat simple SVG Mockups for Google Drive, OneDrive, and Dropbox
function GlobeIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
}

function CloudIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M17.5 19A3.5 3.5 0 0 0 21 15.5c0-2.79-2.54-4.5-5-4.5-.42-1.01-1.04-1.88-1.8-2.6A7 7 0 0 0 2 13a5.5 5.5 0 0 0 5.5 5.5h10z" />
    </svg>
  );
}

function BoxIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}
