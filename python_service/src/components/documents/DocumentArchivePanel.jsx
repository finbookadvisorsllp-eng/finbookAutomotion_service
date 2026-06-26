import React, { useState, useEffect } from 'react';
import { Search, Download, ExternalLink, FileText } from 'lucide-react';
import { toast } from 'sonner';

// Import backend API clients
import salesApi from '../../services/salesApi';
import purchaseApi from '../../services/purchaseApi';
import fundflowApi from '../../services/fundflowApi';

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

      // 3. Fetch OCR Entries from localStorage
      let mappedOcr = [];
      const savedOcr = localStorage.getItem('fb_bulk_documents');
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
    { label: 'Total Archives', count: allArchives.length, color: 'text-blue-600 dark:text-blue-400 bg-blue-500/10' },
    { label: 'Manual Vouchers', count: allArchives.filter(a => a.category === 'Manual Entry').length, color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' },
    { label: 'Bulk Batches', count: allArchives.filter(a => a.category === 'Bulk Upload').length, color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10' },
    { label: 'OCR Scans', count: allArchives.filter(a => a.category === 'OCR Upload').length, color: 'text-rose-600 dark:text-rose-400 bg-rose-500/10' }
  ];

  return (
    <div className="flex flex-col gap-2.5 h-full overflow-y-auto pr-1 text-[13px] text-slate-700 dark:text-slate-200">
      
      {/* Header Banner */}
      <div className="rounded-lg border px-3 py-2 flex items-center justify-between shrink-0 bg-white dark:bg-[var(--app-panel-bg)] border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-[var(--app-heading)]">Document Archive</h1>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Store and retrieve every uploaded document, ledger attachment and OCR scan.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 shrink-0">
        {stats.map((s, idx) => (
          <div key={idx} className="p-2 border rounded bg-white dark:bg-slate-955/20 border-slate-200 dark:border-slate-800 flex flex-col justify-between">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 uppercase font-semibold tracking-wider leading-none block">{s.label}</span>
            <span className="text-[15px] font-bold mt-1 text-slate-900 dark:text-slate-100 block leading-none">{s.count}</span>
          </div>
        ))}
      </div>



      {/* Category Filters */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 border-b border-slate-200 dark:border-slate-800 shrink-0">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-2.5 py-1 text-[11px] font-bold tracking-wide whitespace-nowrap transition-all uppercase border-b-2 -mb-1 ${
              activeCategory === cat 
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 font-bold' 
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Status Filters */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-1 shrink-0">
        {statuses.map(st => (
          <button
            key={st}
            onClick={() => setActiveStatus(st)}
            className={`px-3 py-1 text-[10.5px] font-bold tracking-wide whitespace-nowrap transition-all uppercase rounded-full border ${
              activeStatus === st 
                ? 'bg-blue-600 border-blue-600 text-white shadow-sm' 
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-700'
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Search Toolbar */}
      <div className="border rounded px-2.5 py-2 flex items-center justify-between bg-white dark:bg-slate-950/20 border-slate-200 dark:border-slate-800 shrink-0">
        <div className="relative max-w-xs flex-1 group">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
          <input
            type="text"
            placeholder="Search archived files..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-7 pl-8 pr-2.5 rounded border text-[11px] outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Archives Table */}
      <div className="border rounded flex-1 overflow-hidden flex flex-col bg-white dark:bg-slate-955/10 border-slate-200 dark:border-slate-800">
        <div className="overflow-auto themed-scrollbar flex-1">
          <table className="w-full text-left border-collapse min-w-[900px] text-[13px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/60 border-b text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800">
                <th className="p-2 w-12 text-center">Sr.</th>
                <th className="p-2 border-r border-slate-200 dark:border-slate-800 w-[240px]">Document Name</th>
                <th className="p-2 border-r border-slate-200 dark:border-slate-800">Category</th>
                <th className="p-2 border-r border-slate-200 dark:border-slate-800">Voucher Type</th>
                <th className="p-2 border-r border-slate-200 dark:border-slate-800">Linked Voucher</th>
                <th className="p-2 border-r border-slate-200 dark:border-slate-800 text-center">Upload Date</th>
                <th className="p-2 border-r border-slate-200 dark:border-slate-800">Uploaded By</th>
                <th className="p-2 border-r border-slate-200 dark:border-slate-800 text-center">Status</th>
                <th className="p-2 text-center w-28">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400 font-medium">
                    Loading archived files...
                  </td>
                </tr>
              ) : filteredArchives.length > 0 ? (
                filteredArchives.map((item, index) => {
                  const statusColors = item.status === 'posted_to_tally'
                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' 
                    : item.status === 'approved'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                    : item.status === 'rejected'
                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                    : item.status === 'pending_approval'
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                    : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20'; // draft

                  const statusLabels = {
                    'draft': 'Draft',
                    'pending_approval': 'Pending Approval',
                    'approved': 'Approved',
                    'posted_to_tally': 'Posted To Tally',
                    'rejected': 'Rejected'
                  };

                  return (
                    <tr key={item.id} className="border-b hover:bg-slate-50/50 dark:hover:bg-slate-900/10 font-medium text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800">
                      <td className="p-2 text-center text-slate-500">{index + 1}</td>
                      <td className="p-2 border-r font-semibold text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-1.5">
                          <FileText size={13} className="text-slate-400" />
                          <span className="truncate max-w-[200px]">{item.name}</span>
                          <span className="text-[10px] text-slate-500 font-semibold shrink-0">({item.size})</span>
                        </div>
                      </td>
                      <td className="p-2 border-r border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">{item.category}</td>
                      <td className="p-2 border-r border-slate-200 dark:border-slate-800 text-blue-600 dark:text-blue-400 font-semibold">{item.type}</td>
                      <td className="p-2 border-r border-slate-200 dark:border-slate-800 font-semibold text-slate-900 dark:text-slate-100">{item.linkedVoucher}</td>
                      <td className="p-2 border-r border-slate-200 dark:border-slate-800 text-center text-slate-500">{item.date}</td>
                      <td className="p-2 border-r border-slate-200 dark:border-slate-800 text-slate-550 dark:text-slate-400">{item.uploadedBy}</td>
                      <td className="p-2 border-r border-slate-200 dark:border-slate-800 text-center">
                        <span className={`px-1.5 py-0.2 rounded border text-[11px] font-semibold ${statusColors}`}>
                          {statusLabels[item.status] || item.status}
                        </span>
                      </td>
                      <td className="p-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => toast.info(`Previewing ${item.name}`)}
                            className="px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold"
                          >
                            Preview
                          </button>
                          <button
                            onClick={() => handleDownload(item.name)}
                            className="p-1 text-slate-400 hover:text-blue-500"
                            title="Download"
                          >
                            <Download size={12} />
                          </button>
                          <button
                            onClick={() => toast.info(`Linked voucher: ${item.linkedVoucher}`)}
                            className="p-1 text-slate-400 hover:text-indigo-400"
                            title="Open Voucher"
                          >
                            <ExternalLink size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400 font-medium">
                    No documents match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
