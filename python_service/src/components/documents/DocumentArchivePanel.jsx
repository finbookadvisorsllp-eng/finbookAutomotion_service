import React, { useState, useEffect } from 'react';
import { Download, ExternalLink, FileText, FileSignature, Layers, ScanLine } from 'lucide-react';
import { toast } from 'sonner';
import DataTable from '../ui/DataTable';
import StatCard from '../ui/StatCard';
import Badge from '../ui/Badge';

// Import backend API clients
import salesApi from '../../services/salesApi';
import purchaseApi from '../../services/purchaseApi';
import fundflowApi from '../../services/fundflowApi';

const STATUS_LABEL = { draft: 'Draft', pending_approval: 'Pending Approval', approved: 'Approved', posted_to_tally: 'Posted To Tally', rejected: 'Rejected' };
const STATUS_TONE = { draft: 'neutral', pending_approval: 'warning', approved: 'success', posted_to_tally: 'accent', rejected: 'danger' };

export default function DocumentArchivePanel() {
  const [archives, setArchives] = useState([]);
  const [manuallyArchived, setManuallyArchived] = useState([]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All Documents');
  const [activeStatus, setActiveStatus] = useState('All Statuses');
  const [activeSource, setActiveSource] = useState('All Sources');
  const [activeOcr, setActiveOcr] = useState('All OCR Status');
  const [activeInvoiceStatus, setActiveInvoiceStatus] = useState('All Invoice Status');
  const [loading, setLoading] = useState(false);

  const categories = ['All Documents', 'Manual Entry', 'Bulk Upload', 'OCR Upload'];
  const statuses = ['All Statuses', 'Draft', 'Pending Approval', 'Approved', 'Posted To Tally', 'Rejected'];
  const sources = ['All Sources', 'Direct Upload', 'OCR Scanner', 'Email Ingestion', 'WhatsApp Web'];
  const ocrStatuses = ['All OCR Status', 'OCR Scanned', 'Non-OCR Manual'];
  const invoiceStatuses = ['All Invoice Status', 'Invoice Created', 'Unlinked File'];

  const getStatusKey = (statusText) => {
    if (!statusText) return 'pending_approval';
    const s = statusText.toLowerCase();
    if (s.includes('draft')) return 'draft';
    if (s.includes('approval') || s.includes('review') || s.includes('pending')) return 'pending_approval';
    if (s.includes('approved')) return 'approved';
    if (s.includes('reject') || s.includes('fail')) return 'rejected';
    if (s.includes('post') || s.includes('sync')) return 'posted_to_tally';
    return 'pending_approval';
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const activeCompanyId = localStorage.getItem('selectedCompanyId') || localStorage.getItem('companyId') || localStorage.getItem('orgId') || '';

      // 1. Fetch Manual Entries with actual file attachments from backend
      const [salesRes, purchaseRes, fundflowRes] = await Promise.all([
        salesApi.list({ limit: 150 }).catch(() => ({ data: [] })),
        purchaseApi.list({ limit: 150 }).catch(() => ({ data: [] })),
        fundflowApi.list({ limit: 150 }).catch(() => ({ data: [] }))
      ]);

      // Only include sales vouchers with actual file attachments
      const salesList = (salesRes.data || [])
        .filter(v => v.attachmentUrl || v.fileUrl || v.documentUrl || v.fileName || v.attachment)
        .map(v => {
          const status = (v.status || 'draft').toLowerCase();
          const fileName = v.fileName || v.attachmentName || (v.attachmentUrl ? v.attachmentUrl.split('/').pop() : `${v.invoiceNumber || 'sales_invoice'}.pdf`);
          const invNo = v.voucherNumber || v.invoiceNumber || 'SI-' + (v._id || v.id);
          return {
            id: v._id || v.id,
            name: fileName,
            category: 'Manual Entry',
            type: 'Sales Invoice Attachment',
            linkedVoucher: invNo,
            source: v.source || 'Direct Upload',
            isOcrScanned: Boolean(v.isOcrScanned),
            hasInvoice: true,
            date: v.voucherDate || v.invoiceDate || '—',
            uploadedBy: v.createdBy || 'User Operator',
            status: status,
            size: v.fileSize || '1.2 MB',
            companyId: v.organizationId || v.companyId || activeCompanyId
          };
        });

      // Only include purchase vouchers with actual file attachments
      const purchaseList = (purchaseRes.data || [])
        .filter(v => v.attachmentUrl || v.fileUrl || v.documentUrl || v.fileName || v.attachment)
        .map(v => {
          const status = (v.status || 'draft').toLowerCase();
          const fileName = v.fileName || v.attachmentName || (v.attachmentUrl ? v.attachmentUrl.split('/').pop() : `${v.invoiceNumber || 'purchase_invoice'}.pdf`);
          const invNo = v.voucherNumber || v.invoiceNumber || 'PI-' + (v._id || v.id);
          return {
            id: v._id || v.id,
            name: fileName,
            category: 'Manual Entry',
            type: 'Purchase Bill Attachment',
            linkedVoucher: invNo,
            source: v.source || 'Direct Upload',
            isOcrScanned: Boolean(v.isOcrScanned),
            hasInvoice: true,
            date: v.voucherDate || v.invoiceDate || '—',
            uploadedBy: v.createdBy || 'User Operator',
            status: status,
            size: v.fileSize || '950 KB',
            companyId: v.organizationId || v.companyId || activeCompanyId
          };
        });

      // Only include fundflow vouchers with actual file attachments
      const fundflowList = (fundflowRes.data || [])
        .filter(v => v.attachmentUrl || v.fileUrl || v.documentUrl || v.fileName || v.attachment)
        .map(v => {
          const status = (v.status || 'draft').toLowerCase();
          const type = v.voucherType === 'cash_payment' ? 'Payment Receipt' : (v.voucherType === 'bank_payment' ? 'Bank Receipt' : 'Contra Receipt');
          const fileName = v.fileName || v.attachmentName || `receipt_${v._id || v.id}.pdf`;
          const invNo = v.voucherNumber || 'FF-' + (v._id || v.id);
          return {
            id: v._id || v.id,
            name: fileName,
            category: 'Manual Entry',
            type: type,
            linkedVoucher: invNo,
            source: v.source || 'Direct Upload',
            isOcrScanned: false,
            hasInvoice: true,
            date: v.voucherDate || '—',
            uploadedBy: v.createdBy || 'User Operator',
            status: status,
            size: v.fileSize || '320 KB',
            companyId: v.organizationId || v.companyId || activeCompanyId
          };
        });

      // 2. Fetch Bulk Uploaded Documents from localStorage
      let mappedBulk = [];
      const savedBulk = localStorage.getItem('fb_bulk_batches');
      if (savedBulk) {
        try {
          const parsedBulk = JSON.parse(savedBulk);
          mappedBulk = parsedBulk
            .filter(b => !b.companyId || !activeCompanyId || String(b.companyId) === String(activeCompanyId))
            .map(b => {
              let st = (b.status || 'Pending Approval').toLowerCase();
              if (st.includes('post') || st.includes('sync')) st = 'posted_to_tally';
              else if (st.includes('approved')) st = 'approved';
              else if (st.includes('reject') || st.includes('fail')) st = 'rejected';
              else st = 'pending_approval';

              const hasInv = st === 'posted_to_tally' || st === 'approved';

              return {
                id: b.id,
                name: b.filename || 'bulk_data_batch.xlsx',
                category: 'Bulk Upload',
                type: 'Excel Batch Upload',
                linkedVoucher: b.id,
                source: b.source || 'Direct Upload',
                isOcrScanned: false,
                hasInvoice: hasInv,
                date: b.uploadDate || '—',
                uploadedBy: b.uploadedBy || 'User Operator',
                status: st,
                size: b.size || '2.4 MB',
                companyId: b.companyId || activeCompanyId
              };
            });
        } catch (e) {}
      }

      // Fetch individual Bulk Upload files
      const savedBulkDocs = localStorage.getItem('fb_bulk_upload_documents');
      if (savedBulkDocs) {
        try {
          const parsedBulkDocs = JSON.parse(savedBulkDocs);
          parsedBulkDocs
            .filter(doc => !doc.companyId || !activeCompanyId || String(doc.companyId) === String(activeCompanyId))
            .forEach(doc => {
              let st = (doc.status || 'Pending Approval').toLowerCase();
              if (st === 'under review' || st === 'ready for review') st = 'pending_approval';
              else if (st.includes('post') || st.includes('sync') || st === 'posted') st = 'posted_to_tally';
              else if (st.includes('approved')) st = 'approved';
              else if (st.includes('reject') || st.includes('fail')) st = 'rejected';
              else st = 'pending_approval';

              const hasInv = Boolean(doc.docNo || st === 'posted_to_tally' || st === 'approved');

              mappedBulk.push({
                id: doc.id,
                name: doc.name || doc.filename || 'bulk_document.xlsx',
                category: 'Bulk Upload',
                type: doc.category || 'Excel Spreadsheet',
                linkedVoucher: doc.docNo || doc.id,
                source: doc.source || 'Direct Upload',
                isOcrScanned: false,
                hasInvoice: hasInv,
                date: doc.docDate || doc.uploadDate || '—',
                uploadedBy: doc.uploadedBy || 'User Operator',
                status: st,
                size: doc.size || '1.5 MB',
                companyId: doc.companyId || activeCompanyId
              });
            });
        } catch (e) {
          console.error('Error loading bulk upload documents in archive', e);
        }
      }

      // 3. Fetch OCR Scanned Documents from localStorage
      let mappedOcr = [];
      const savedOcr = localStorage.getItem('fb_ocr_documents');
      if (savedOcr) {
        try {
          const parsedOcr = JSON.parse(savedOcr);
          mappedOcr = parsedOcr
            .filter(doc => !doc.companyId || !activeCompanyId || String(doc.companyId) === String(activeCompanyId))
            .map(doc => {
              let st = (doc.status || 'Pending Approval').toLowerCase();
              if (st === 'under review' || st === 'ready for review') st = 'pending_approval';
              else if (st.includes('post') || st.includes('sync') || st === 'posted') st = 'posted_to_tally';
              else if (st.includes('approved')) st = 'approved';
              else if (st.includes('reject') || st.includes('fail')) st = 'rejected';
              else st = 'pending_approval';

              const hasInv = Boolean(doc.docNo || st === 'posted_to_tally' || st === 'approved');

              return {
                id: doc.id,
                name: doc.filename || doc.name || 'ocr_scanned_invoice.pdf',
                category: 'OCR Upload',
                type: doc.category || 'Scanned PDF / Image',
                linkedVoucher: doc.docNo || 'OCR-' + doc.id,
                source: doc.source || (doc.channel === 'email' ? 'Email Ingestion' : (doc.channel === 'whatsapp' ? 'WhatsApp Web' : 'OCR Scanner')),
                isOcrScanned: true,
                hasInvoice: hasInv,
                date: doc.docDate || doc.uploadDate || '—',
                uploadedBy: doc.uploadedBy || 'OCR Scanner',
                status: st,
                size: doc.size || '800 KB',
                companyId: doc.companyId || activeCompanyId
              };
            });
        } catch (e) {}
      }

      // 4. Fetch My Documents uploads
      let mappedMyDocs = [];
      const savedMyDocs = localStorage.getItem('fb_my_documents');
      if (savedMyDocs) {
        try {
          const parsedMyDocs = JSON.parse(savedMyDocs);
          mappedMyDocs = parsedMyDocs
            .filter(doc => !doc.companyId || !activeCompanyId || String(doc.companyId) === String(activeCompanyId))
            .map(doc => ({
              id: doc.id,
              name: doc.filename || doc.name || 'user_document.pdf',
              category: 'Manual Entry',
              type: doc.category || 'Uploaded File',
              linkedVoucher: doc.invoiceNo || doc.id,
              source: doc.source || 'Direct Upload',
              isOcrScanned: Boolean(doc.isOcrScanned),
              hasInvoice: Boolean(doc.invoiceNo),
              date: doc.uploadDate || '—',
              uploadedBy: doc.uploadedBy || 'User Operator',
              status: 'approved',
              size: doc.size || '1.1 MB',
              companyId: doc.companyId || activeCompanyId
            }));
        } catch (e) {}
      }

      const merged = [...salesList, ...purchaseList, ...fundflowList, ...mappedBulk, ...mappedOcr, ...mappedMyDocs];
      setArchives(merged);
    } catch (e) {
      console.error('Error fetching archive data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const onCompanyChanged = () => fetchData();
    window.addEventListener('company-changed', onCompanyChanged);
    return () => window.removeEventListener('company-changed', onCompanyChanged);
  }, []);

  const handleDelete = (id) => {
    if (confirm('Are you sure you want to delete this document from the archive?')) {
      setArchives(prev => prev.filter(a => a.id !== id));
      setManuallyArchived(prev => prev.filter(a => a.id !== id));
      toast.success('Document deleted from archive');
    }
  };

  const handleDownload = (name) => {
    toast.success(`Downloading ${name}...`);
  };

  const allArchives = [...manuallyArchived, ...archives];

  // Filter logic
  const filteredArchives = allArchives.filter(item => {
    // 1. Search Query Filter
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) || 
                          item.linkedVoucher.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    


    // 3. Status Filter
    if (activeStatus !== 'All Statuses') {
      const statusMap = {
        'Draft': 'draft',
        'Pending Approval': 'pending_approval',
        'Approved': 'approved',
        'Posted To Tally': 'posted_to_tally',
        'Rejected': 'rejected'
      };
      if (item.status !== statusMap[activeStatus]) return false;
    }

    // 4. Source Channel Filter
    if (activeSource !== 'All Sources') {
      if (item.source !== activeSource) return false;
    }

    // 5. OCR Status Filter
    if (activeOcr !== 'All OCR Status') {
      if (activeOcr === 'OCR Scanned' && !item.isOcrScanned) return false;
      if (activeOcr === 'Non-OCR Manual' && item.isOcrScanned) return false;
    }

    // 6. Invoice Status Filter
    if (activeInvoiceStatus !== 'All Invoice Status') {
      if (activeInvoiceStatus === 'Invoice Created' && !item.hasInvoice) return false;
      if (activeInvoiceStatus === 'Unlinked File' && item.hasInvoice) return false;
    }

    return true;
  });

  const stats = [
    { label: 'Total Archives', value: allArchives.length, icon: FileText },
    { label: 'OCR Scanned', value: allArchives.filter(a => a.isOcrScanned).length, icon: ScanLine },
    { label: 'Invoices Created', value: allArchives.filter(a => a.hasInvoice).length, icon: FileSignature },
    { label: 'Direct / External Uploads', value: allArchives.filter(a => a.source !== 'OCR Scanner').length, icon: Layers },
  ];

  const docColumns = [
    { key: 'sr', header: 'Sr', width: '48px', align: 'center', render: (_r, i) => <span style={{ color: 'var(--app-muted)' }}>{i + 1}</span> },
    { key: 'name', header: 'Document Name', sortable: true, render: (r) => (
      <div className="flex items-center gap-1.5">
        <FileText size={13} style={{ color: 'var(--app-muted)' }} />
        <span className="font-semibold truncate max-w-[180px]" style={{ color: 'var(--app-heading)' }} title={r.name}>{r.name}</span>
        <span className="text-[10px] shrink-0 font-mono" style={{ color: 'var(--app-muted)' }}>({r.size})</span>
      </div>
    ) },
    { key: 'source', header: 'Channel Source', sortable: true, render: (r) => {
      const src = r.source || 'Direct Upload';
      const isEmail = src.includes('Email');
      const isWa = src.includes('WhatsApp');
      const isOcr = src.includes('OCR');
      return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-bold ${
          isWa ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' :
          isEmail ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' :
          isOcr ? 'bg-purple-500/10 text-purple-600 border border-purple-500/20' :
          'bg-blue-500/10 text-blue-600 border border-blue-500/20'
        }`}>
          {src}
        </span>
      );
    } },
    { key: 'isOcrScanned', header: 'OCR Status', align: 'center', sortable: true, render: (r) => (
      <Badge tone={r.isOcrScanned ? 'accent' : 'neutral'}>
        {r.isOcrScanned ? 'OCR Scanned' : 'Non-OCR Manual'}
      </Badge>
    ) },
    { key: 'hasInvoice', header: 'Invoice Status', align: 'center', sortable: true, render: (r) => (
      <Badge tone={r.hasInvoice ? 'success' : 'warning'}>
        {r.hasInvoice ? `Invoice Created (${r.linkedVoucher})` : 'Unlinked File'}
      </Badge>
    ) },
    { key: 'date', header: 'Upload Date', align: 'center', sortable: true, render: (r) => <span style={{ color: 'var(--app-muted)' }}>{r.date}</span> },
    { key: 'uploadedBy', header: 'Uploaded By', render: (r) => <span style={{ color: 'var(--app-text)' }}>{r.uploadedBy}</span> },
    { key: 'status', header: 'Status', align: 'center', sortable: true, render: (r) => <Badge tone={STATUS_TONE[r.status] || 'neutral'}>{STATUS_LABEL[r.status] || r.status}</Badge> },
    { key: 'act', header: '', align: 'center', width: '124px', render: (r) => (
      <div className="flex items-center justify-center gap-1">
        <button onClick={() => toast.info(`Previewing ${r.name}`)} className="px-1.5 py-0.5 rounded-md border border-[var(--app-border)] hover:bg-[var(--app-control-hover)] text-[var(--app-text)] text-[10px] font-bold">Preview</button>
        <button onClick={() => handleDownload(r.name)} title="Download" aria-label="Download" className="p-1 rounded-md hover:bg-[var(--app-control-hover)] hover:text-[var(--app-accent)]" style={{ color: 'var(--app-muted)' }}><Download size={12} /></button>
        <button onClick={() => toast.info(`Linked voucher: ${r.linkedVoucher}`)} title="Open Voucher" aria-label="Open Voucher" className="p-1 rounded-md hover:bg-[var(--app-control-hover)] hover:text-[var(--app-accent)]" style={{ color: 'var(--app-muted)' }}><ExternalLink size={12} /></button>
      </div>
    ) },
  ];

  return (
    <div className="flex flex-col gap-2.5 h-full overflow-hidden p-1 text-[13px] text-[var(--app-text)]">

      {/* Header */}
      <div className="rounded-xl border px-3 py-2.5 flex items-center gap-2.5 shrink-0 bg-[var(--app-panel-bg)] border-[var(--app-border)] shadow-sm">
        <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: 'var(--app-accent-gradient)', boxShadow: 'var(--app-shadow)' }}>
          <FileText size={17} strokeWidth={2.2} />
        </div>
        <div className="min-w-0">
          <h1 className="text-[17px] font-extrabold tracking-tight text-[var(--app-heading)] leading-none">Document Archive</h1>
          <p className="text-[10px] text-[var(--app-muted)] mt-1 truncate">Store and retrieve every uploaded document, ledger attachment, OCR scan, email and WhatsApp feed.</p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 shrink-0">
        {stats.map((s, i) => <StatCard key={s.label} index={i} label={s.label} value={s.value} icon={s.icon} />)}
      </div>



      {/* Filter Toolbar: Channel Source, OCR Status, Invoice Linkage, and Lifecycle Status */}
      <div className="flex items-center gap-2 overflow-x-auto shrink-0 pb-1 flex-wrap">
        {/* Source Dropdown Filter */}
        <select
          value={activeSource}
          onChange={(e) => setActiveSource(e.target.value)}
          className="h-7 px-2.5 text-[11px] font-bold rounded-lg border outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)] cursor-pointer"
        >
          {sources.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* OCR Status Dropdown Filter */}
        <select
          value={activeOcr}
          onChange={(e) => setActiveOcr(e.target.value)}
          className="h-7 px-2.5 text-[11px] font-bold rounded-lg border outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)] cursor-pointer"
        >
          {ocrStatuses.map(o => <option key={o} value={o}>{o}</option>)}
        </select>

        {/* Invoice Linkage Dropdown Filter */}
        <select
          value={activeInvoiceStatus}
          onChange={(e) => setActiveInvoiceStatus(e.target.value)}
          className="h-7 px-2.5 text-[11px] font-bold rounded-lg border outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)] cursor-pointer font-bold text-[var(--app-accent)]"
        >
          {invoiceStatuses.map(inv => <option key={inv} value={inv}>{inv}</option>)}
        </select>

        <span className="text-[var(--app-border)] font-light">|</span>

        {/* Status pills */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {statuses.map(st => (
            <button
              key={st}
              onClick={() => setActiveStatus(st)}
              className={`px-2.5 py-0.5 text-[10px] font-bold tracking-wide whitespace-nowrap transition-all uppercase rounded-full border ${
                activeStatus === st ? 'bg-[var(--app-accent)] border-[var(--app-accent)] text-white shadow-xs' : 'bg-[var(--app-panel-bg)] border-[var(--app-border)] text-[var(--app-muted)] hover:text-[var(--app-heading)]'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Archive table */}
      <div className="flex-1 min-h-0">
        <DataTable
          minWidth="1050px"
          data={filteredArchives}
          rowKey={(r) => r.id}
          loading={loading}
          emptyText="No documents match the selected source, OCR status, or invoice filters."
          columns={docColumns}
          search={{ value: search, onChange: setSearch, placeholder: 'Search archived files or invoices…' }}
        />
      </div>
    </div>
  );
}
