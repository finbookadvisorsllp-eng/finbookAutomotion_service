import React, { useState } from 'react';
import { Archive, Search, Filter, Download, ExternalLink, Calendar, Layers, User, Eye, Trash2, Plus, X, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

const initialArchives = [
  { id: 'doc-1', name: 'Vendor_Invoice_INV291.pdf', category: 'Bulk Upload', type: 'Purchase Voucher', linkedVoucher: 'PI-2026-0007', date: '2026-06-19', uploadedBy: 'Admin Operator', status: 'Posted', size: '1.2 MB' },
  { id: 'doc-2', name: 'Customer_Invoice_Cust98.png', category: 'OCR Upload', type: 'Sales Voucher', linkedVoucher: 'SI-2026-0001', date: '2026-06-19', uploadedBy: 'System AI', status: 'Pending', size: '450 KB' },
  { id: 'doc-3', name: 'Bank_Statement_May2026.csv', category: 'Bank Upload', type: 'Banking', linkedVoucher: '—', date: '2026-06-19', uploadedBy: 'Admin Operator', status: 'Posted', size: '85 KB' },
  { id: 'doc-4', name: 'Receipt_Copy_Fuel.jpg', category: 'Manual Entry Attachments', type: 'Receipt Voucher', linkedVoucher: 'RC-2026-0005', date: '2026-06-19', uploadedBy: 'Operator B', status: 'Posted', size: '320 KB' },
  { id: 'doc-5', name: 'Payment_Advice_HDFC.pdf', category: 'Bulk Upload', type: 'Payment Voucher', linkedVoucher: 'PY-2026-0012', date: '2026-06-18', uploadedBy: 'Operator A', status: 'Pending', size: '950 KB' }
];

export default function DocumentArchivePanel() {
  const [archives, setArchives] = useState(initialArchives);
  const [search, setSearch] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All Documents');

  // Form state
  const [form, setForm] = useState({
    name: '',
    category: 'Bulk Upload',
    type: 'Purchase Voucher',
    linkedVoucher: '',
    uploadedBy: 'Admin Operator',
    size: '1.0 MB'
  });

  const categories = [
    'All Documents', 'Manual Entry Attachments', 'Bulk Upload', 'OCR Upload', 'Bank Upload',
    'Sales', 'Purchase', 'Payment', 'Receipt', 'Contra', 'Posted', 'Pending'
  ];

  const handleDelete = (id) => {
    if (confirm('Are you sure you want to delete this document from the archive?')) {
      setArchives(prev => prev.filter(a => a.id !== id));
      toast.success('Document deleted from archive');
    }
  };

  const handleDownload = (name) => {
    toast.success(`Downloading ${name}...`);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!form.name) {
      toast.error('Document name is required.');
      return;
    }
    const newDoc = {
      id: 'doc-' + Date.now(),
      name: form.name,
      category: form.category,
      type: form.type,
      linkedVoucher: form.linkedVoucher || '—',
      date: new Date().toISOString().split('T')[0],
      uploadedBy: form.uploadedBy,
      status: 'Pending',
      size: form.size
    };
    setArchives(prev => [newDoc, ...prev]);
    setForm({ name: '', category: 'Bulk Upload', type: 'Purchase Voucher', linkedVoucher: '', uploadedBy: 'Admin Operator', size: '1.0 MB' });
    setShowCreateForm(false);
    toast.success('Document registered in archive!');
  };

  // Filter logic
  const filteredArchives = archives.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
    
    // Category mapping matching specifications
    if (activeCategory !== 'All Documents') {
      if (activeCategory === 'Posted' && item.status !== 'Posted') return false;
      if (activeCategory === 'Pending' && item.status !== 'Pending') return false;
      if (activeCategory === 'Manual Entry Attachments' && item.category !== 'Manual Entry Attachments') return false;
      if (activeCategory === 'Bulk Upload' && item.category !== 'Bulk Upload') return false;
      if (activeCategory === 'OCR Upload' && item.category !== 'OCR Upload') return false;
      if (activeCategory === 'Bank Upload' && item.category !== 'Bank Upload') return false;
      
      const vMap = {
        'Sales': 'Sales Voucher',
        'Purchase': 'Purchase Voucher',
        'Payment': 'Payment Voucher',
        'Receipt': 'Receipt Voucher',
        'Contra': 'Contra Voucher'
      };
      if (vMap[activeCategory] && item.type !== vMap[activeCategory]) return false;
    }

    return matchesSearch;
  });

  const stats = [
    { label: 'Total Archives', count: archives.length + 420, color: 'text-blue-600 dark:text-blue-400 bg-blue-500/10' },
    { label: 'Sales Docs', count: archives.filter(a => a.type === 'Sales Voucher').length + 180, color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' },
    { label: 'Purchase Docs', count: archives.filter(a => a.type === 'Purchase Voucher').length + 150, color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10' },
    { label: 'Pending Audit', count: archives.filter(a => a.status === 'Pending').length + 90, color: 'text-rose-600 dark:text-rose-400 bg-rose-500/10' }
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
        <button
          onClick={() => setShowCreateForm(p => !p)}
          className="px-3.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[11px] rounded flex items-center gap-1 transition-all"
        >
          {showCreateForm ? <X size={12} /> : <Plus size={12} />}
          {showCreateForm ? 'Close Form' : 'Archive Document'}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 shrink-0">
        {stats.map((s, idx) => (
          <div key={idx} className="p-2 border rounded bg-white dark:bg-slate-950/20 border-slate-200 dark:border-slate-800 flex flex-col justify-between">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 uppercase font-semibold tracking-wider leading-none block">{s.label}</span>
            <span className="text-[15px] font-bold mt-1 text-slate-900 dark:text-slate-100 block leading-none">{s.count}</span>
          </div>
        ))}
      </div>

      {/* Form Area */}
      <AnimatePresence>
        {showCreateForm && (
          <motion.form
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            onSubmit={handleFormSubmit}
            className="border rounded p-3 space-y-2.5 overflow-hidden shrink-0 bg-white dark:bg-[var(--app-panel-bg)] border-slate-200 dark:border-slate-800"
          >
            <h3 className="text-[16px] font-semibold text-slate-900 dark:text-[var(--app-heading)] uppercase tracking-wider">Archive Document Entry</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
              <div>
                <label className="text-[12px] font-semibold text-slate-500 mb-0.5 block">Document Name *</label>
                <input
                  type="text"
                  placeholder="e.g. statement_may2026.csv"
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full h-8 rounded border px-2.5 text-[13px] outline-none bg-slate-55 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800"
                  required
                />
              </div>

              <div>
                <label className="text-[12px] font-semibold text-slate-500 mb-0.5 block">Source Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full h-8 rounded border px-2 text-[13px] outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800"
                >
                  <option value="Bulk Upload">Bulk Upload</option>
                  <option value="OCR Upload">OCR Upload</option>
                  <option value="Bank Upload">Bank Upload</option>
                  <option value="Manual Entry Attachments">Manual Entry Attachments</option>
                </select>
              </div>

              <div>
                <label className="text-[12px] font-semibold text-slate-500 mb-0.5 block">Voucher Type Context</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full h-8 rounded border px-2 text-[13px] outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800"
                >
                  <option value="Purchase Voucher">Purchase Voucher</option>
                  <option value="Sales Voucher">Sales Voucher</option>
                  <option value="Banking">Banking</option>
                  <option value="Payment Voucher">Payment Voucher</option>
                  <option value="Receipt Voucher">Receipt Voucher</option>
                </select>
              </div>

              <div>
                <label className="text-[12px] font-semibold text-slate-500 mb-0.5 block">Linked Voucher Number</label>
                <input
                  type="text"
                  placeholder="e.g. PI-2026-0007"
                  value={form.linkedVoucher}
                  onChange={(e) => setForm(prev => ({ ...prev, linkedVoucher: e.target.value }))}
                  className="w-full h-8 rounded border px-2.5 text-[13px] outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="h-8 px-4 rounded border text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors uppercase font-bold text-[11px] border-slate-200 dark:border-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-8 px-5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase text-[11px] shadow transition-colors"
              >
                Archive Document
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

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
      <div className="border rounded flex-1 overflow-hidden flex flex-col bg-white dark:bg-slate-950/10 border-slate-200 dark:border-slate-800">
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
              {filteredArchives.length > 0 ? (
                filteredArchives.map((item, index) => {
                  const statusColors = item.status === 'Posted' 
                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' 
                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';

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
                          {item.status}
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
