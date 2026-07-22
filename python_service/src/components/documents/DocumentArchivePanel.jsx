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
  const [loading, setLoading] = useState(false);

  const categories = ['All Documents', 'Manual Entry', 'Bulk Upload', 'OCR Upload'];
  const statuses = ['All Statuses', 'Draft', 'Pending Approval', 'Approved', 'Posted To Tally', 'Rejected'];

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
      // 1. Fetch Manual Entries from backend
      const [salesRes, purchaseRes, fundflowRes] = await Promise.all([
        salesApi.list({ limit: 150 }).catch(() => ({ data: [] })),
        purchaseApi.list({ limit: 150 }).catch(() => ({ data: [] })),
        fundflowApi.list({ limit: 150 }).catch(() => ({ data: [] }))
      ]);

      const salesList = (salesRes.data || []).map(v => {
        const status = (v.status || 'draft').toLowerCase();
        return {
          id: v._id || v.id,
          name: v.invoiceNumber || v.voucherNumber || 'sales_voucher.pdf',
          category: 'Manual Entry',
          type: 'Sales Voucher',
          linkedVoucher: v.voucherNumber || v.invoiceNumber || 'SI-' + (v._id || v.id),
          date: v.voucherDate || v.invoiceDate || '—',
          uploadedBy: 'Admin Operator',
          status: status,
          size: '1.2 MB'
        };
      });

      const purchaseList = (purchaseRes.data || []).map(v => {
        const status = (v.status || 'draft').toLowerCase();
        return {
          id: v._id || v.id,
          name: v.invoiceNumber || v.voucherNumber || 'purchase_voucher.pdf',
          category: 'Manual Entry',
          type: 'Purchase Voucher',
          linkedVoucher: v.voucherNumber || v.invoiceNumber || 'PI-' + (v._id || v.id),
          date: v.voucherDate || v.invoiceDate || '—',
          uploadedBy: 'Admin Operator',
          status: status,
          size: '950 KB'
        };
      });

      const fundflowList = (fundflowRes.data || []).map(v => {
        const status = (v.status || 'draft').toLowerCase();
        const type = v.voucherType === 'cash_payment' ? 'Payment Voucher' : (v.voucherType === 'bank_payment' ? 'Receipt Voucher' : 'Contra Voucher');
        return {
          id: v._id || v.id,
          name: 'fund_flow_' + (v._id || v.id) + '.pdf',
          category: 'Manual Entry',
          type: type,
          linkedVoucher: v.voucherNumber || 'FF-' + (v._id || v.id),
          date: v.voucherDate || '—',
          uploadedBy: 'Admin Operator',
          status: status,
          size: '320 KB'
        };
      });

      // 2. Fetch Bulk Entries from localStorage
      let mappedBulk = [];
      const savedBulk = localStorage.getItem('fb_bulk_batches');
      if (savedBulk) {
        const parsedBulk = JSON.parse(savedBulk);
        mappedBulk = parsedBulk.map(b => {
          let st = (b.status || 'Pending Approval').toLowerCase();
          if (st.includes('post') || st.includes('sync')) st = 'posted_to_tally';
          else if (st.includes('approved')) st = 'approved';
          else if (st.includes('reject') || st.includes('fail')) st = 'rejected';
          else st = 'pending_approval';

          return {
            id: b.id,
            name: b.filename,
            category: 'Bulk Upload',
            type: 'Bulk Batch',
            linkedVoucher: b.id,
            date: b.uploadDate || '—',
            uploadedBy: 'Admin Operator',
            status: st,
            size: '2.4 MB'
          };
        });
      }

      // Fetch individual Bulk Upload files
      const savedBulkDocs = localStorage.getItem('fb_bulk_upload_documents');
      if (savedBulkDocs) {
        try {
          const parsedBulkDocs = JSON.parse(savedBulkDocs);
          parsedBulkDocs.forEach(doc => {
            let st = (doc.status || 'Pending Approval').toLowerCase();
            if (st === 'under review' || st === 'ready for review') st = 'pending_approval';
            else if (st.includes('post') || st.includes('sync') || st === 'posted') st = 'posted_to_tally';
            else if (st.includes('approved')) st = 'approved';
            else if (st.includes('reject') || st.includes('fail')) st = 'rejected';
            else st = 'pending_approval';

            mappedBulk.push({
              id: doc.id,
              name: doc.name || doc.filename || 'bulk_document.xlsx',
              category: 'Bulk Upload',
              type: doc.category || 'Bulk Document',
              linkedVoucher: doc.docNo || doc.id,
              date: doc.docDate || doc.uploadDate || '—',
              uploadedBy: 'Admin Operator',
              status: st,
              size: doc.size || '1.5 MB'
            });
          });
        } catch (e) {
          console.error('Error loading bulk upload documents in archive', e);
        }
      }

      // 3. Fetch OCR Entries from localStorage
      let mappedOcr = [];
      const savedOcr = localStorage.getItem('fb_ocr_documents');
      if (savedOcr) {
        const parsedOcr = JSON.parse(savedOcr);
        mappedOcr = parsedOcr.map(doc => {
          let st = (doc.status || 'Pending Approval').toLowerCase();
          if (st === 'under review' || st === 'ready for review') st = 'pending_approval';
          else if (st.includes('post') || st.includes('sync') || st === 'posted') st = 'posted_to_tally';
          else if (st.includes('approved')) st = 'approved';
          else if (st.includes('reject') || st.includes('fail')) st = 'rejected';
          else st = 'pending_approval';

          return {
            id: doc.id,
            name: doc.filename || 'ocr_document.pdf',
            category: 'OCR Upload',
            type: doc.category || 'OCR Document',
            linkedVoucher: doc.docNo || doc.id,
            date: doc.docDate || doc.uploadDate || '—',
            uploadedBy: 'System AI',
            status: st,
            size: '800 KB'
          };
        });
      }

      const merged = [...salesList, ...purchaseList, ...fundflowList, ...mappedBulk, ...mappedOcr];
      setArchives(merged);
    } catch (e) {
      console.error('Error fetching archive data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
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
    
    // 2. Category Filter
    if (activeCategory !== 'All Documents') {
      if (item.category !== activeCategory) return false;
    }

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

    return true;
  });

  const stats = [
    { label: 'Total Archives', value: allArchives.length, icon: FileText },
    { label: 'Manual Vouchers', value: allArchives.filter(a => a.category === 'Manual Entry').length, icon: FileSignature },
    { label: 'Bulk Batches', value: allArchives.filter(a => a.category === 'Bulk Upload').length, icon: Layers },
    { label: 'OCR Scans', value: allArchives.filter(a => a.category === 'OCR Upload').length, icon: ScanLine },
  ];

  const docColumns = [
    { key: 'sr', header: 'Sr', width: '48px', align: 'center', render: (_r, i) => <span style={{ color: 'var(--app-muted)' }}>{i + 1}</span> },
    { key: 'name', header: 'Document Name', sortable: true, render: (r) => (
      <div className="flex items-center gap-1.5">
        <FileText size={13} style={{ color: 'var(--app-muted)' }} />
        <span className="font-semibold truncate max-w-[200px]" style={{ color: 'var(--app-heading)' }} title={r.name}>{r.name}</span>
        <span className="text-[10px] shrink-0" style={{ color: 'var(--app-muted)' }}>({r.size})</span>
      </div>
    ) },
    { key: 'category', header: 'Category', sortable: true, render: (r) => <span style={{ color: 'var(--app-text)' }}>{r.category}</span> },
    { key: 'type', header: 'Voucher Type', render: (r) => <span className="font-semibold" style={{ color: 'var(--app-accent)' }}>{r.type}</span> },
    { key: 'linkedVoucher', header: 'Linked Voucher', sortable: true, render: (r) => <span className="font-semibold" style={{ color: 'var(--app-heading)' }}>{r.linkedVoucher}</span> },
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
          <p className="text-[10px] text-[var(--app-muted)] mt-1 truncate">Store and retrieve every uploaded document, ledger attachment and OCR scan.</p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 shrink-0">
        {stats.map((s, i) => <StatCard key={s.label} index={i} label={s.label} value={s.value} icon={s.icon} />)}
      </div>

      {/* Category tabs */}
      <div className="flex items-center gap-4 overflow-x-auto border-b border-[var(--app-border)] shrink-0">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`pb-1.5 text-[11px] font-bold tracking-wide whitespace-nowrap transition-all uppercase border-b-2 -mb-px ${
              activeCategory === cat ? 'border-[var(--app-accent)] text-[var(--app-accent)]' : 'border-transparent text-[var(--app-muted)] hover:text-[var(--app-heading)]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Status pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto shrink-0">
        {statuses.map(st => (
          <button
            key={st}
            onClick={() => setActiveStatus(st)}
            className={`px-3 py-1 text-[10.5px] font-bold tracking-wide whitespace-nowrap transition-all uppercase rounded-full border ${
              activeStatus === st ? 'bg-[var(--app-accent)] border-[var(--app-accent)] text-white shadow-sm' : 'bg-[var(--app-panel-bg)] border-[var(--app-border)] text-[var(--app-muted)] hover:text-[var(--app-heading)]'
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Archive table */}
      <div className="flex-1 min-h-0">
        <DataTable
          minWidth="960px"
          data={filteredArchives}
          rowKey={(r) => r.id}
          loading={loading}
          emptyText="No documents match."
          columns={docColumns}
          search={{ value: search, onChange: setSearch, placeholder: 'Search archived files…' }}
        />
      </div>
    </div>
  );
}
