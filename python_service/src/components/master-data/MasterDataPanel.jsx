import React, { useState, useEffect } from 'react';
import { Search, HelpCircle, ChevronLeft, ChevronRight, ChevronDown, RefreshCw, Settings, Plus, X, BookOpen, Package, User, ShieldCheck, Landmark, FileSpreadsheet, Percent, IndianRupee, Info } from 'lucide-react';
import { toast } from 'sonner';
import salesApi from '../../services/salesApi';
import fundflowApi from '../../services/fundflowApi';

const MasterDataPanel = ({ mode: propMode, isDark }) => {
  const [activeTab, setActiveTab] = useState(propMode || 'Party Ledger');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [pageSize, setPageSize] = useState(10);
  const [onlyUnsynced, setOnlyUnsynced] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchMasterData = async () => {
    setLoading(true);
    try {
      const [ledgersRes, stockRes] = await Promise.all([
        fundflowApi.getLedgers().catch(() => ({ data: { ledgers: [] } })),
        salesApi.getStockItems().catch(() => ({ data: [] }))
      ]);

      // Map Ledgers
      const rawLedgers = ledgersRes.data?.ledgers || [];
      const mappedLedgers = rawLedgers.map((l, index) => ({
        sr: index + 1,
        ledger: l.ledgerName || l.name || '',
        parentGroup: l.groupName || 'Sundry Debtors',
        subGroup: l.groupName || 'Sundry Debtors',
        gst: l.gstin || 'N/A',
        name: l.ledgerName || l.name || '',
        pos: l.gstState || '—',
        type: l.registrationType || 'Regular',
        add1: l.add1 || '—',
        add2: l.add2 || '—',
        city: l.city || '—',
        isSynced: l.isSynced ?? true
      }));
      setPartyDataList(mappedLedgers);

      // Map Stock Items
      const rawStock = stockRes.data || [];
      const mappedStock = rawStock.map((s, index) => ({
        sr: index + 1,
        name: s.name || '',
        group: s.group || 'General',
        uom: s.unit || 'Nos',
        hsn: s.hsnCode || 'N/A',
        gstRate: s.gstRate ? `${s.gstRate}%` : '0%',
        qty: s.qty ?? 0,
        rate: s.rate ?? 0,
        value: s.value ?? 0,
        isSynced: s.isSynced ?? true
      }));
      setStockDataList(mappedStock);
    } catch (err) {
      console.error('Error fetching master data:', err);
      toast.error('Failed to load master data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (propMode) {
      setActiveTab(propMode);
    }
    fetchMasterData();
  }, [propMode]);

  // Form states
  const [ledgerForm, setLedgerForm] = useState({
    ledgerName: '',
    aliasName: '',
    parentGroup: 'Sundry Debtors',
    openingBalance: '',
    balanceType: 'Dr',
    mailingName: '',
    mobileNumber: '',
    address: '',
    emailAddress: '',
    gstApplicable: true,
    gstin: '',
    registrationType: 'Regular',
    pos: 'Maharashtra (27)',
    panNumber: '',
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    branch: '',
    maintainBillWise: true,
    creditPeriod: '',
    creditLimit: '',
    notes: '',
    status: 'Active'
  });

  const [itemForm, setItemForm] = useState({
    itemName: '',
    stockGroup: 'Computer Accessories',
    uom: 'Nos',
    brand: '',
    hsnCode: '',
    gstRate: '18%',
    taxabilityType: 'Taxable',
    purchasePrice: '',
    salesPrice: '',
    mrp: '',
    openingQty: '',
    sku: '',
    description: ''
  });

  // Data states
  const [partyDataList, setPartyDataList] = useState([]);
  const [stockDataList, setStockDataList] = useState([]);

  const handleCreateLedger = (e) => {
    e.preventDefault();
    if (!ledgerForm.ledgerName) {
      toast.error('Ledger Name is required');
      return;
    }
    const newLedger = {
      sr: partyDataList.length + 1,
      ledger: ledgerForm.ledgerName.toUpperCase(),
      parentGroup: ledgerForm.parentGroup,
      subGroup: ledgerForm.parentGroup,
      gst: ledgerForm.gstin || 'N/A',
      name: ledgerForm.mailingName || ledgerForm.ledgerName,
      pos: ledgerForm.pos.split(' (')[0],
      type: ledgerForm.registrationType,
      add1: ledgerForm.address || '—',
      add2: '—',
      city: ledgerForm.address ? ledgerForm.address.split(',').slice(-2, -1)[0]?.trim() || '—' : '—',
      isSynced: false
    };
    setPartyDataList(prev => [...prev, newLedger]);
    setLedgerForm({
      ledgerName: '',
      aliasName: '',
      parentGroup: 'Sundry Debtors',
      openingBalance: '',
      balanceType: 'Dr',
      mailingName: '',
      mobileNumber: '',
      address: '',
      emailAddress: '',
      gstApplicable: true,
      gstin: '',
      registrationType: 'Regular',
      pos: 'Maharashtra (27)',
      panNumber: '',
      bankName: '',
      accountNumber: '',
      ifscCode: '',
      branch: '',
      maintainBillWise: true,
      creditPeriod: '',
      creditLimit: '',
      notes: '',
      status: 'Active'
    });
    setShowCreateForm(false);
    toast.success('Party Ledger created successfully!');
  };

  const handleCreateItem = (e) => {
    e.preventDefault();
    if (!itemForm.itemName) {
      toast.error('Item Name is required');
      return;
    }
    const qty = parseFloat(itemForm.openingQty) || 0;
    const purchasePrice = parseFloat(itemForm.purchasePrice) || 0;
    const val = qty * purchasePrice;
    
    const newItem = {
      sr: stockDataList.length + 1,
      name: itemForm.itemName.toUpperCase(),
      group: itemForm.stockGroup,
      uom: itemForm.uom,
      hsn: itemForm.hsnCode || 'N/A',
      gstRate: itemForm.gstRate,
      qty,
      rate: purchasePrice,
      value: val,
      isSynced: false
    };
    setStockDataList(prev => [...prev, newItem]);
    setItemForm({
      itemName: '',
      stockGroup: 'Computer Accessories',
      uom: 'Nos',
      brand: '',
      hsnCode: '',
      gstRate: '18%',
      taxabilityType: 'Taxable',
      purchasePrice: '',
      salesPrice: '',
      mrp: '',
      openingQty: '',
      sku: '',
      description: ''
    });
    setShowCreateForm(false);
    toast.success('Stock Item created successfully!');
  };

  const isStock = activeTab === 'Stock Ledger' || activeTab === 'Item Master';

  // Statistics Display Config
  const ledgerStats = [
    { label: 'Total Party Ledgers', count: partyDataList.length, color: 'text-[var(--app-accent)] dark:text-[var(--app-accent)]', countColor: 'text-[var(--app-accent)] dark:text-[var(--app-accent)]', cardBg: 'bg-[var(--app-accent-soft)] border-[var(--app-border)] dark:bg-[var(--app-accent-soft)] dark:border-[var(--app-border)]' },
    { label: 'Sundry Debtors', count: partyDataList.filter(p => p.parentGroup === 'Sundry Debtors').length, color: 'text-emerald-800 dark:text-emerald-300', countColor: 'text-emerald-950 dark:text-emerald-50', cardBg: 'bg-emerald-50/80 border-emerald-200/80 dark:bg-emerald-950/20 dark:border-emerald-900/30' },
    { label: 'Sundry Creditors', count: partyDataList.filter(p => p.parentGroup === 'Sundry Creditors').length, color: 'text-[var(--app-accent)] dark:text-[var(--app-accent)]', countColor: 'text-[var(--app-accent)] dark:text-[var(--app-accent)]', cardBg: 'bg-[var(--app-accent-soft)] border-[var(--app-border)] dark:bg-[var(--app-accent-soft)] dark:border-[var(--app-border)]' },
    { label: 'Unsynced Ledgers', count: partyDataList.filter(p => !p.isSynced).length, color: 'text-amber-800 dark:text-amber-300', countColor: 'text-amber-950 dark:text-amber-50', cardBg: 'bg-amber-50/80 border-amber-200/80 dark:bg-amber-950/20 dark:border-amber-900/30' }
  ];

  const stockStats = [
    { label: 'Total Stock Items', count: stockDataList.length, color: 'text-[var(--app-accent)] dark:text-[var(--app-accent)]', countColor: 'text-[var(--app-accent)] dark:text-[var(--app-accent)]', cardBg: 'bg-[var(--app-accent-soft)] border-[var(--app-border)] dark:bg-[var(--app-accent-soft)] dark:border-[var(--app-border)]' },
    { label: 'Active Items', count: stockDataList.filter(s => s.qty > 0).length, color: 'text-emerald-800 dark:text-emerald-300', countColor: 'text-emerald-950 dark:text-emerald-50', cardBg: 'bg-emerald-50/80 border-emerald-200/80 dark:bg-emerald-950/20 dark:border-emerald-900/30' },
    { label: 'Out of Stock', count: stockDataList.filter(s => s.qty === 0).length, color: 'text-rose-800 dark:text-rose-300', countColor: 'text-rose-950 dark:text-rose-50', cardBg: 'bg-rose-50/80 border-rose-200/80 dark:bg-rose-950/20 dark:border-rose-900/30' },
    { label: 'Total Stock Value', count: `₹${stockDataList.reduce((acc, s) => acc + s.value, 0).toLocaleString('en-IN')}`, color: 'text-[var(--app-accent)] dark:text-[var(--app-accent)]', countColor: 'text-[var(--app-accent)] dark:text-[var(--app-accent)]', cardBg: 'bg-[var(--app-accent-soft)] border-[var(--app-border)] dark:bg-[var(--app-accent-soft)] dark:border-[var(--app-border)] font-semibold' }
  ];

  const activeStats = isStock ? stockStats : ledgerStats;

  const IconButton = ({ icon: Icon, color, onClick, label, isPrimary, border }) => {
    const toneMap = {
      purple:  '#8B5CF6',
      blue:    '#38bdf8',
      emerald: '#10B981',
      slate:   'var(--app-text)',
    };
    const tone = toneMap[color] || 'var(--app-text)';

    if (label) {
      return (
        <button
          onClick={onClick}
          className="h-8 px-3 rounded flex items-center gap-1.5 font-semibold text-[11px] uppercase transition-all shadow-sm active:scale-95 text-white"
          style={{
            background: isPrimary 
              ? 'var(--app-accent-gradient)' 
              : 'linear-gradient(135deg, #475569 0%, #334155 100%)'
          }}
        >
          <Icon size={12} strokeWidth={2.5} />
          {label}
        </button>
      );
    }

    return (
      <button
        onClick={onClick}
        title={Icon?.displayName}
        aria-label={Icon?.displayName}
        className="h-8 w-8 rounded border flex items-center justify-center transition-all active:scale-90 hover:bg-[var(--app-control-hover)] shadow-sm"
        style={{
          borderColor: border ? tone + '40' : 'var(--app-border)',
          color: tone,
          backgroundColor: 'var(--app-control-bg)',
        }}
      >
        <Icon size={13} strokeWidth={2.5} />
      </button>
    );
  };

  const TableHead = ({ label, center, width, borderRight }) => (
    <th 
      className={`p-2 border-b text-[11px] font-bold tracking-tight uppercase ${center ? 'text-center' : ''} ${borderRight ? 'border-r border-[var(--app-border)]' : ''}`} 
      style={{ 
        borderColor: 'var(--app-row-border)', 
        color: 'var(--app-muted)', 
        width: width, 
        minWidth: width,
        backgroundColor: 'var(--app-table-head-bg)'
      }}
    >
      {label}
    </th>
  );

  const renderPartyLedgerTable = () => {
    const filteredParty = partyDataList.filter(item => {
      if (onlyUnsynced && item.isSynced) return false;
      return (
        item.ledger.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.parentGroup.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.gst.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });

    return (
      <div className="flex-1 overflow-auto themed-scrollbar">
        <table className="w-full text-left border-collapse min-w-[1500px] text-[13px]">
          <thead className="sticky top-0 z-10">
            <tr style={{ backgroundColor: 'var(--app-table-head-bg)' }}>
              <TableHead label="Sr No" borderRight width="60px" />
              <TableHead label="Ledger" borderRight width="220px" />
              <TableHead label="Parent Group" borderRight width="130px" />
              <TableHead label="Sub Group" borderRight width="130px" />
              <TableHead label="GST Number" borderRight width="150px" />
              <TableHead label="Name" borderRight width="180px" />
              <TableHead label="Place of Supply" borderRight width="130px" />
              <TableHead label="GST Registration" borderRight width="130px" />
              <TableHead label="Address 1" borderRight width="250px" />
              <TableHead label="Address 2" borderRight width="250px" />
              <TableHead label="City" borderRight width="120px" />
              <TableHead label="Sync Status" width="100px" center />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={12} className="p-8 text-center text-slate-400 font-semibold animate-pulse">
                  Loading party ledgers from Tally database...
                </td>
              </tr>
            ) : filteredParty.length > 0 ? (
              filteredParty.map((row, index) => (
                <tr 
                  key={row.sr} 
                  className="border-b transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-900/10 font-medium text-[var(--app-text)]" 
                  style={{ 
                    backgroundColor: index % 2 === 0 ? 'transparent' : 'var(--app-table-head-bg)', 
                    borderColor: 'var(--app-row-border)' 
                  }}
                >
                  <td className="p-2 border-r text-center text-slate-500 border-[var(--app-border)]">{index + 1}</td>
                  <td className="p-2 border-r font-bold text-[var(--app-heading)] border-[var(--app-border)]">{row.ledger}</td>
                  <td className="p-2 border-r border-[var(--app-border)]">{row.parentGroup}</td>
                  <td className="p-2 border-r border-[var(--app-border)] text-slate-500">{row.subGroup}</td>
                  <td className="p-2 border-r font-mono border-[var(--app-border)] font-semibold">{row.gst}</td>
                  <td className="p-2 border-r border-[var(--app-border)] text-[var(--app-heading)]">{row.name}</td>
                  <td className="p-2 border-r border-[var(--app-border)] text-slate-500">{row.pos}</td>
                  <td className="p-2 border-r border-[var(--app-border)] text-slate-500">{row.type}</td>
                  <td className="p-2 border-r border-[var(--app-border)] text-slate-500 truncate max-w-[240px]">{row.add1}</td>
                  <td className="p-2 border-r border-[var(--app-border)] text-slate-500 truncate max-w-[240px]">{row.add2}</td>
                  <td className="p-2 border-r border-[var(--app-border)] text-slate-500">{row.city}</td>
                  <td className="p-2 text-center">
                    <span className={`px-1.5 py-0.5 rounded border text-[10.5px] font-bold ${
                      row.isSynced 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-250 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30' 
                        : 'bg-amber-50 text-amber-700 border-amber-250 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30'
                    }`}>
                      {row.isSynced ? 'Synced' : 'Pending'}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={12} className="p-8 text-center text-slate-400 font-medium">
                  No party ledgers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  const renderStockTable = () => {
    const filteredStock = stockDataList.filter(item => {
      if (onlyUnsynced && item.isSynced) return false;
      return (
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.group.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.hsn.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });

    return (
      <div className="flex-1 overflow-auto themed-scrollbar">
        <table className="w-full text-left border-collapse min-w-[1000px] text-[13px]">
          <thead className="sticky top-0 z-10">
            <tr style={{ backgroundColor: 'var(--app-table-head-bg)' }}>
              <TableHead label="Sr No" borderRight width="60px" />
              <TableHead label="Item Name" borderRight width="280px" />
              <TableHead label="Stock Group" borderRight width="180px" />
              <TableHead label="Unit (UOM)" borderRight width="120px" />
              <TableHead label="HSN Code" borderRight width="140px" />
              <TableHead label="GST Rate" borderRight width="120px" />
              <TableHead label="Opening Qty" borderRight width="120px" center />
              <TableHead label="Rate (₹)" borderRight width="140px" center />
              <TableHead label="Opening Value (₹)" borderRight width="160px" center />
              <TableHead label="Sync Status" width="100px" center />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} className="p-8 text-center text-slate-400 font-semibold animate-pulse">
                  Loading stock items from Tally database...
                </td>
              </tr>
            ) : filteredStock.length > 0 ? (
              filteredStock.map((row, index) => (
                <tr 
                  key={row.sr} 
                  className="border-b transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-900/10 font-medium text-[var(--app-text)]" 
                  style={{ 
                    backgroundColor: index % 2 === 0 ? 'transparent' : 'var(--app-table-head-bg)', 
                    borderColor: 'var(--app-row-border)' 
                  }}
                >
                  <td className="p-2 border-r text-center text-slate-500 border-[var(--app-border)]">{index + 1}</td>
                  <td className="p-2 border-r font-bold text-[var(--app-heading)] border-[var(--app-border)]">{row.name}</td>
                  <td className="p-2 border-r border-[var(--app-border)]">{row.group}</td>
                  <td className="p-2 border-r border-[var(--app-border)]">{row.uom}</td>
                  <td className="p-2 border-r font-mono border-[var(--app-border)] font-semibold">{row.hsn}</td>
                  <td className="p-2 border-r font-semibold text-[var(--app-accent)] border-[var(--app-border)]">{row.gstRate}</td>
                  <td className="p-2 border-r text-right font-semibold text-[var(--app-heading)] border-[var(--app-border)]">{row.qty}</td>
                  <td className="p-2 border-r text-right border-[var(--app-border)]">₹{(row.rate ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td className="p-2 border-r text-right font-bold text-emerald-600 dark:text-emerald-400 border-[var(--app-border)]">₹{(row.value ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td className="p-2 text-center">
                    <span className={`px-1.5 py-0.5 rounded border text-[10.5px] font-bold ${
                      row.isSynced 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-250 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30' 
                        : 'bg-amber-50 text-amber-700 border-amber-250 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30'
                    }`}>
                      {row.isSynced ? 'Synced' : 'Pending'}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={10} className="p-8 text-center text-slate-400 font-medium">
                  No stock items found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  const renderLedgerForm = () => (
    <form
      onSubmit={handleCreateLedger}
      className="space-y-2 bg-[var(--app-panel-bg)]"
    >
      <div className="flex items-center justify-between border-b pb-1.5 mb-2.5 border-[var(--app-border)]">
        <h3 className="text-[14px] font-bold text-[var(--app-heading)] uppercase tracking-wider">Create Party Ledger</h3>
        <button type="button" onClick={() => setShowCreateForm(false)} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
      </div>

      <div className="space-y-2">
        <div>
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Ledger Name *</label>
          <input
            type="text"
            placeholder="e.g. A K TRADING"
            value={ledgerForm.ledgerName}
            onChange={(e) => setLedgerForm(prev => ({ ...prev, ledgerName: e.target.value }))}
            className="w-full h-8 rounded border px-2.5 text-[13px] outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
            required
          />
        </div>

        <div>
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Parent Group</label>
          <select
            value={ledgerForm.parentGroup}
            onChange={(e) => setLedgerForm(prev => ({ ...prev, parentGroup: e.target.value }))}
            className="w-full h-8 rounded border px-2 text-[13px] outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
          >
            <option value="Sundry Debtors">Sundry Debtors</option>
            <option value="Sundry Creditors">Sundry Creditors</option>
          </select>
        </div>

        <div>
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">GSTIN Number</label>
          <input
            type="text"
            placeholder="e.g. 07DDTPAD879K1Z7"
            value={ledgerForm.gstin}
            onChange={(e) => setLedgerForm(prev => ({ ...prev, gstin: e.target.value }))}
            className="w-full h-8 rounded border px-2.5 text-[13px] outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
          />
        </div>

        <div>
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Place of Supply</label>
          <select
            value={ledgerForm.pos}
            onChange={(e) => setLedgerForm(prev => ({ ...prev, pos: e.target.value }))}
            className="w-full h-8 rounded border px-2 text-[13px] outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
          >
            <option value="Delhi">Delhi</option>
            <option value="Madhya Pradesh">Madhya Pradesh</option>
            <option value="Maharashtra">Maharashtra</option>
            <option value="Gujarat">Gujarat</option>
          </select>
        </div>

        <div>
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Address Line 1</label>
          <input
            type="text"
            placeholder="e.g. RIGHT PORTION 1st Floor, KH N.589"
            value={ledgerForm.add1}
            onChange={(e) => setLedgerForm(prev => ({ ...prev, add1: e.target.value }))}
            className="w-full h-8 rounded border px-2.5 text-[13px] outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
          />
        </div>

        <div>
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">City</label>
          <input
            type="text"
            placeholder="e.g. Delhi"
            value={ledgerForm.city}
            onChange={(e) => setLedgerForm(prev => ({ ...prev, city: e.target.value }))}
            className="w-full h-8 rounded border px-2.5 text-[13px] outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
          />
        </div>
      </div>

      <div className="flex gap-2 pt-3 border-t border-[var(--app-border)]">
        <button
          type="button"
          onClick={() => setShowCreateForm(false)}
          className="h-8 flex-1 rounded border text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors uppercase font-bold text-[11px] border-[var(--app-border)]"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="h-8 flex-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase text-[11px] shadow transition-colors"
        >
          Save Ledger
        </button>
      </div>
    </form>
  );

  return (
    <div className="flex flex-col gap-2.5 h-full animate-in fade-in duration-500 overflow-y-auto pr-1 text-[13px] text-[var(--app-text)]">
      
      {/* Title Header */}
      <div 
        className="rounded-xl border px-3 py-2 flex items-center justify-between shrink-0 bg-[var(--app-panel-bg)] border-[var(--app-border)] shadow-sm"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div 
            className="h-8 w-8 rounded-lg bg-[var(--app-accent-soft)] text-[var(--app-accent)] dark:bg-[var(--app-accent-soft)] dark:text-[var(--app-accent)] flex items-center justify-center shrink-0"
          >
            {isStock ? <Package size={15} /> : <BookOpen size={15} />}
          </div>
          <div className="min-w-0">
            <h1 className="text-[18px] md:text-[20px] font-extrabold tracking-tight text-[var(--app-heading)] truncate">
              {isStock ? 'Item Master' : 'Ledger Master'}
            </h1>
            <p className="text-[11px] text-[var(--app-muted)] mt-0.5 hidden sm:block truncate">
              {isStock ? 'View, configure and provision inventory products, stock groups, HSN classifications, and UOM units.' : 'Manage client ledger categories, sundry debtor accounts, tax profiles, and place of supply mappings.'}
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowCreateForm(p => !p)}
          className="px-3.5 py-1.5 bg-[var(--app-accent)] hover:opacity-90 text-white font-bold text-[10.5px] rounded-lg flex items-center gap-1 transition-all uppercase shrink-0 shadow-sm"
        >
          {showCreateForm ? <X size={12} /> : <Plus size={12} />}
          {showCreateForm ? 'Close Form' : isStock ? 'New Stock Item' : 'New Party Ledger'}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 shrink-0">
        {activeStats.map((s, idx) => (
          <div key={idx} className={`p-2 border rounded-xl flex flex-col justify-between transition-all ${s.cardBg}`}>
            <span className={`text-[10px] uppercase font-bold tracking-wider leading-none block ${s.color}`}>{s.label}</span>
            <span className={`text-[15px] font-extrabold mt-1 block leading-none ${s.countColor}`}>{s.count}</span>
          </div>
        ))}
      </div>

      {/* Toolbar filters */}
      <div className="border rounded px-2.5 py-2 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 bg-[var(--app-panel-bg)] border-[var(--app-border)] shrink-0">
        {/* Search */}
        <div className="relative w-full md:max-w-xs flex-1 group">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
          <input
            type="text"
            placeholder={isStock ? "Search stock items..." : "Search party ledgers..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-7 pl-8 pr-2.5 rounded border text-[14px] outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 cursor-pointer group select-none">
            <input 
              type="checkbox" 
              checked={onlyUnsynced}
              onChange={(e) => setOnlyUnsynced(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-slate-300 accent-[var(--app-accent)] cursor-pointer" 
            />
            <span className="text-[12px] font-semibold text-slate-500 group-hover:text-slate-800 transition-colors">Unsynced Only</span>
          </label>

          <button
            onClick={() => {
              setSearchQuery('');
              setOnlyUnsynced(false);
              fetchMasterData();
              toast.info('Lists refreshed from Tally cache');
            }}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 border rounded text-[var(--app-muted)] border-[var(--app-border)]"
            type="button"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Main Grid: Left Table List, Right Creation Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 flex-1 overflow-hidden">
        
        {/* Table List Column */}
        <div className="lg:col-span-12 flex flex-col border rounded-xl overflow-hidden bg-[var(--app-panel-bg)] border-[var(--app-border)] shadow-sm">
          {isStock ? renderStockTable() : renderPartyLedgerTable()}

          {/* Pagination Footer */}
          <div 
            className="flex items-center justify-center gap-4 py-2 border-t shrink-0 relative text-[12px] font-semibold" 
            style={{ borderColor: 'var(--app-row-border)', backgroundColor: 'var(--app-table-head-bg)' }}
          >
            <span className="text-[11px] font-bold text-[var(--app-accent)] dark:text-[var(--app-accent)]">
              1 - {isStock ? stockDataList.length : partyDataList.length} of {isStock ? stockDataList.length : partyDataList.length}
            </span>
            
            <div className="flex items-center gap-1">
              <button className="text-slate-300 hover:text-slate-500 p-1"><ChevronLeft size={14} /></button>
              <button className="text-slate-300 hover:text-slate-500 p-1"><ChevronRight size={14} /></button>
            </div>
            
            <div className="relative">
              <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="border rounded px-2 py-1 flex items-center gap-2 transition-all shadow-sm"
                style={{ 
                  backgroundColor: 'var(--app-control-bg)', 
                  borderColor: isDropdownOpen ? 'var(--app-accent)' : 'var(--app-border)' 
                }}
              >
                <span className="text-[11px] font-bold w-4 text-left" style={{ color: 'var(--app-text)' }}>{pageSize}</span>
                <ChevronDown size={12} className="transition-transform" style={{ color: 'var(--app-muted)', transform: isDropdownOpen ? 'rotate(180deg)' : 'none' }} />
              </button>

              {isDropdownOpen && (
                <div 
                  className="absolute bottom-full left-0 mb-1 w-full border rounded-lg shadow-lg overflow-hidden py-1 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200" 
                  style={{ backgroundColor: 'var(--app-panel-bg)', borderColor: 'var(--app-border)' }}
                >
                  {[10, 50, 100].map((size) => (
                    <button
                      key={size}
                      onClick={() => {
                        setPageSize(size);
                        setIsDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-[11px] font-bold transition-colors"
                      style={{ 
                        backgroundColor: size === pageSize ? 'var(--app-accent-soft)' : 'transparent',
                        color: size === pageSize ? (isDark ? '#38bdf8' : 'var(--app-accent)') : 'var(--app-text)'
                      }}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stock Item Pop-up Modal */}
        {showCreateForm && isStock && (
          <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center bg-black/50 backdrop-blur-[2px] p-0 md:p-4 overflow-y-auto">
            <div className="bg-[var(--app-panel-bg)] border-0 md:border border-[var(--app-border)] rounded-none md:rounded-xl shadow-2xl max-w-6xl w-full h-full md:h-auto md:max-h-[95vh] flex flex-col my-0 md:my-4 overflow-hidden">
              {/* Header */}
              <div className="px-4 py-2.5 border-b border-[var(--app-border)] flex justify-between items-center shrink-0 bg-[var(--app-panel-bg)] rounded-t-none md:rounded-t-xl">
                <div>
                  <h2 className="text-base md:text-lg font-bold text-slate-900 dark:text-white">Add New Item</h2>
                  <p className="text-[10px] md:text-xs text-[var(--app-muted)] mt-0.5">Create a new stock item in one view</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-[var(--app-muted)] transition-colors p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleCreateItem} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {/* Fields - grouped into 3 columns, no scrolling needed on typical displays */}
                <div className="flex-1 p-3 md:p-4 space-y-3 overflow-y-auto md:overflow-visible">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    
                    {/* Column 1: Basic Details */}
                    <div className="space-y-3">
                      <div className="space-y-2 border rounded-xl p-3 bg-[var(--app-content-bg)] border-[var(--app-border)]">
                        <div className="flex items-center gap-1.5 text-[var(--app-accent)] dark:text-[var(--app-accent)] font-bold border-b border-[var(--app-border)] pb-1 mb-2">
                          <Package size={13} />
                          <span className="text-[11px] uppercase tracking-wider">1. Basic Details</span>
                        </div>
                        
                        <div>
                          <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">Item Name *</label>
                          <input
                            type="text"
                            required
                            value={itemForm.itemName}
                            onChange={(e) => setItemForm(prev => ({ ...prev, itemName: e.target.value }))}
                            placeholder="e.g. HP Keyboard"
                            className="w-full h-8 rounded-lg border px-2.5 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                          />
                        </div>
                        
                        <div>
                          <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">Item Group *</label>
                          <select
                            value={itemForm.stockGroup}
                            onChange={(e) => setItemForm(prev => ({ ...prev, stockGroup: e.target.value }))}
                            className="w-full h-8 rounded-lg border px-1.5 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                          >
                            <option value="Computer Accessories">Computer Accessories</option>
                            <option value="Computer Hardware">Computer Hardware</option>
                            <option value="Accessories">Accessories</option>
                            <option value="Printers">Printers</option>
                            <option value="Services">Services</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">Unit of Measure *</label>
                          <select
                            value={itemForm.uom}
                            onChange={(e) => setItemForm(prev => ({ ...prev, uom: e.target.value }))}
                            className="w-full h-8 rounded-lg border px-1.5 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                          >
                            <option value="Nos">Nos</option>
                            <option value="Pcs">Pcs</option>
                            <option value="Box">Box</option>
                            <option value="Hours">Hours</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">Brand (Optional)</label>
                          <input
                            type="text"
                            value={itemForm.brand}
                            onChange={(e) => setItemForm(prev => ({ ...prev, brand: e.target.value }))}
                            placeholder="e.g. HP"
                            className="w-full h-8 rounded-lg border px-2.5 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Column 2: Tax Details & Inventory Details */}
                    <div className="space-y-3">
                      {/* Section 2: Tax Details */}
                      <div className="space-y-2 border rounded-xl p-3 bg-[var(--app-content-bg)] border-[var(--app-border)]">
                        <div className="flex items-center gap-1.5 text-[var(--app-accent)] dark:text-[var(--app-accent)] font-bold border-b border-[var(--app-border)] pb-1 mb-2">
                          <Percent size={13} />
                          <span className="text-[11px] uppercase tracking-wider">2. Tax Details</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">HSN / SAC Code</label>
                            <input
                              type="text"
                              value={itemForm.hsnCode}
                              onChange={(e) => setItemForm(prev => ({ ...prev, hsnCode: e.target.value }))}
                              placeholder="e.g. 8471"
                              className="w-full h-8 rounded-lg border px-2.5 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                            />
                          </div>

                          <div>
                            <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">GST Rate (%) *</label>
                            <select
                              value={itemForm.gstRate}
                              onChange={(e) => setItemForm(prev => ({ ...prev, gstRate: e.target.value }))}
                              className="w-full h-8 rounded-lg border px-1.5 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                            >
                              <option value="18%">18%</option>
                              <option value="12%">12%</option>
                              <option value="5%">5%</option>
                              <option value="0%">0% Exempt</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">Taxability Type</label>
                          <select
                            value={itemForm.taxabilityType}
                            onChange={(e) => setItemForm(prev => ({ ...prev, taxabilityType: e.target.value }))}
                            className="w-full h-8 rounded-lg border px-1.5 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                          >
                            <option value="Taxable">Taxable</option>
                            <option value="Exempt">Exempt</option>
                            <option value="Nil Rated">Nil Rated</option>
                            <option value="Non-GST">Non-GST</option>
                          </select>
                        </div>
                      </div>

                      {/* Section 4: Inventory Details */}
                      <div className="space-y-2 border rounded-xl p-3 bg-[var(--app-content-bg)] border-[var(--app-border)]">
                        <div className="flex items-center gap-1.5 text-[var(--app-accent)] dark:text-[var(--app-accent)] font-bold border-b border-[var(--app-border)] pb-1 mb-2">
                          <Package size={13} />
                          <span className="text-[11px] uppercase tracking-wider">4. Inventory Details</span>
                        </div>

                        <div>
                          <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">Opening Stock *</label>
                          <div className="flex rounded-lg border border-[var(--app-border)] overflow-hidden bg-[var(--app-content-bg)] focus-within:border-[var(--app-accent)] transition-colors">
                            <input
                              type="text"
                              required
                              value={itemForm.openingQty}
                              onChange={(e) => setItemForm(prev => ({ ...prev, openingQty: e.target.value }))}
                              placeholder="100.00"
                              className="flex-1 h-8 px-2.5 text-xs bg-transparent outline-none text-[var(--app-heading)]"
                            />
                            <div className="flex items-center justify-center px-3 bg-[var(--app-control-hover)] text-xs font-semibold text-[var(--app-muted)] border-l border-[var(--app-border)] select-none">
                              {itemForm.uom}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Column 3: Pricing Details & Additional Details */}
                    <div className="space-y-3">
                      {/* Section 3: Pricing Details */}
                      <div className="space-y-2 border rounded-xl p-3 bg-[var(--app-content-bg)] border-[var(--app-border)]">
                        <div className="flex items-center gap-1.5 text-[var(--app-accent)] dark:text-[var(--app-accent)] font-bold border-b border-[var(--app-border)] pb-1 mb-2">
                          <IndianRupee size={13} />
                          <span className="text-[11px] uppercase tracking-wider">3. Pricing Details</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">Purchase Price *</label>
                            <input
                              type="text"
                              required
                              value={itemForm.purchasePrice}
                              onChange={(e) => setItemForm(prev => ({ ...prev, purchasePrice: e.target.value }))}
                              placeholder="500.00"
                              className="w-full h-8 rounded-lg border px-2.5 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                            />
                          </div>

                          <div>
                            <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">Sales Price *</label>
                            <input
                              type="text"
                              required
                              value={itemForm.salesPrice}
                              onChange={(e) => setItemForm(prev => ({ ...prev, salesPrice: e.target.value }))}
                              placeholder="700.00"
                              className="w-full h-8 rounded-lg border px-2.5 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">MRP (₹) (Optional)</label>
                          <input
                            type="text"
                            value={itemForm.mrp}
                            onChange={(e) => setItemForm(prev => ({ ...prev, mrp: e.target.value }))}
                            placeholder="750.00"
                            className="w-full h-8 rounded-lg border px-2.5 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                          />
                        </div>
                      </div>

                      {/* Section 5: Additional Details */}
                      <div className="space-y-2 border rounded-xl p-3 bg-[var(--app-content-bg)] border-[var(--app-border)]">
                        <div className="flex items-center gap-1.5 text-[var(--app-accent)] dark:text-[var(--app-accent)] font-bold border-b border-[var(--app-border)] pb-1 mb-2">
                          <Info size={13} />
                          <span className="text-[11px] uppercase tracking-wider">5. Additional Details</span>
                        </div>

                        <div>
                          <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">SKU / Barcode</label>
                          <input
                            type="text"
                            value={itemForm.sku}
                            onChange={(e) => setItemForm(prev => ({ ...prev, sku: e.target.value }))}
                            placeholder="HP-KB-001"
                            className="w-full h-8 rounded-lg border px-2.5 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                          />
                        </div>

                        <div>
                          <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">Description (Optional)</label>
                          <textarea
                            rows={1.5}
                            value={itemForm.description}
                            onChange={(e) => setItemForm(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="HP Wired USB Keyboard"
                            className="w-full rounded-lg border px-2 py-1 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)] resize-none"
                          />
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Modal Footer Buttons */}
                <div className="flex justify-end gap-2 p-3 md:p-4 border-t border-[var(--app-border)] text-[10px] font-bold uppercase tracking-wider shrink-0 bg-[var(--app-panel-bg)] rounded-b-none md:rounded-b-xl">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="px-4 py-1.5 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-[var(--app-text)] transition-colors"
                    style={{ borderColor: 'var(--app-border)' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-1.5 bg-[var(--app-accent)] hover:opacity-90 text-white rounded-lg shadow-sm transition-all font-bold"
                  >
                    Save Item
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* Ledger Pop-up Modal */}
        {showCreateForm && !isStock && (
          <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center bg-black/50 backdrop-blur-[2px] p-0 md:p-4 overflow-y-auto">
            <div className="bg-[var(--app-panel-bg)] border-0 md:border border-[var(--app-border)] rounded-none md:rounded-xl shadow-2xl max-w-6xl w-full h-full md:h-auto md:max-h-[95vh] flex flex-col my-0 md:my-4 overflow-hidden">
              {/* Header */}
              <div className="px-4 py-2.5 border-b border-[var(--app-border)] flex justify-between items-center shrink-0 bg-[var(--app-panel-bg)] rounded-t-none md:rounded-t-xl">
                <div>
                  <h2 className="text-base md:text-lg font-bold text-slate-900 dark:text-white">Create New Ledger</h2>
                  <p className="text-[10px] md:text-xs text-[var(--app-muted)] mt-0.5">Add a new ledger account in one view</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-[var(--app-muted)] transition-colors p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleCreateLedger} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {/* Fields - grouped into 3 columns, no scrolling needed on typical displays */}
                <div className="flex-1 p-3 md:p-4 space-y-3 overflow-y-auto md:overflow-visible">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    
                    {/* Column 1: Basic Details & Accounting Settings */}
                    <div className="space-y-3">
                      {/* Section 1: Basic Details */}
                      <div className="space-y-2 border rounded-xl p-3 bg-[var(--app-content-bg)] border-[var(--app-border)]">
                        <div className="flex items-center gap-1.5 text-[var(--app-accent)] dark:text-[var(--app-accent)] font-bold border-b border-[var(--app-border)] pb-1 mb-2">
                          <BookOpen size={13} />
                          <span className="text-[11px] uppercase tracking-wider">1. Basic Details</span>
                        </div>
                        
                        <div>
                          <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">Ledger Name *</label>
                          <input
                            type="text"
                            required
                            value={ledgerForm.ledgerName}
                            onChange={(e) => setLedgerForm(prev => ({ ...prev, ledgerName: e.target.value }))}
                            placeholder="e.g. ABC Traders"
                            className="w-full h-8 rounded-lg border px-2.5 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                          />
                        </div>
                        
                        <div>
                          <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">Alias Name</label>
                          <input
                            type="text"
                            value={ledgerForm.aliasName}
                            onChange={(e) => setLedgerForm(prev => ({ ...prev, aliasName: e.target.value }))}
                            placeholder="e.g. ABC Traders"
                            className="w-full h-8 rounded-lg border px-2.5 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                          />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">Under Group *</label>
                            <select
                              value={ledgerForm.parentGroup}
                              onChange={(e) => setLedgerForm(prev => ({ ...prev, parentGroup: e.target.value }))}
                              className="w-full h-8 rounded-lg border px-1.5 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                            >
                              <option value="Sundry Debtors">Sundry Debtors</option>
                              <option value="Sundry Creditors">Sundry Creditors</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">Opening Bal</label>
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">₹</span>
                              <input
                                type="text"
                                value={ledgerForm.openingBalance}
                                onChange={(e) => setLedgerForm(prev => ({ ...prev, openingBalance: e.target.value }))}
                                placeholder="50,000"
                                className="w-full h-8 rounded-lg border pl-5 pr-1.5 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                              />
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">Balance Type</label>
                          <div className="flex items-center gap-3 mt-1.5">
                            <label className="flex items-center gap-1 cursor-pointer text-xs font-semibold select-none">
                              <input
                                type="radio"
                                name="balanceType"
                                value="Dr"
                                checked={ledgerForm.balanceType === 'Dr'}
                                onChange={(e) => setLedgerForm(prev => ({ ...prev, balanceType: e.target.value }))}
                                className="accent-[var(--app-accent)] h-3.5 w-3.5"
                              />
                              <span>Dr</span>
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer text-xs font-semibold select-none">
                              <input
                                type="radio"
                                name="balanceType"
                                value="Cr"
                                checked={ledgerForm.balanceType === 'Cr'}
                                onChange={(e) => setLedgerForm(prev => ({ ...prev, balanceType: e.target.value }))}
                                className="accent-[var(--app-accent)] h-3.5 w-3.5"
                              />
                              <span>Cr</span>
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* Section 5: Accounting Settings */}
                      <div className="space-y-2 border rounded-xl p-3 bg-[var(--app-content-bg)] border-[var(--app-border)]">
                        <div className="flex items-center gap-1.5 text-[var(--app-accent)] dark:text-[var(--app-accent)] font-bold border-b border-[var(--app-border)] pb-1 mb-2">
                          <Settings size={13} />
                          <span className="text-[11px] uppercase tracking-wider">5. Settings</span>
                        </div>
                        
                        <div className="flex items-center justify-between pb-1">
                          <label className="text-xs font-semibold text-[var(--app-text)]">Bill-wise Details</label>
                          <button
                            type="button"
                            onClick={() => setLedgerForm(prev => ({ ...prev, maintainBillWise: !prev.maintainBillWise }))}
                            className={`relative inline-flex h-4.5 w-8 items-center rounded-full transition-colors focus:outline-none ${
                              ledgerForm.maintainBillWise ? 'bg-[var(--app-accent)]' : 'bg-[var(--app-control-hover)]'
                            }`}
                          >
                            <span
                              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                ledgerForm.maintainBillWise ? 'translate-x-4' : 'translate-x-0.5'
                              }`}
                            />
                          </button>
                        </div>

                        {ledgerForm.maintainBillWise && (
                          <div className="grid grid-cols-2 gap-2 animate-in fade-in duration-200">
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">Credit Period</label>
                              <input
                                type="number"
                                value={ledgerForm.creditPeriod}
                                onChange={(e) => setLedgerForm(prev => ({ ...prev, creditPeriod: e.target.value }))}
                                placeholder="30 days"
                                className="w-full h-8 rounded-lg border px-2 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">Credit Limit</label>
                              <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">₹</span>
                                <input
                                  type="text"
                                  value={ledgerForm.creditLimit}
                                  onChange={(e) => setLedgerForm(prev => ({ ...prev, creditLimit: e.target.value }))}
                                  placeholder="5,000,000"
                                  className="w-full h-8 rounded-lg border pl-5 pr-1.5 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Column 2: Contact Details & Banking Details */}
                    <div className="space-y-3">
                      {/* Section 2: Contact Details */}
                      <div className="space-y-2 border rounded-xl p-3 bg-[var(--app-content-bg)] border-[var(--app-border)]">
                        <div className="flex items-center gap-1.5 text-[var(--app-accent)] dark:text-[var(--app-accent)] font-bold border-b border-[var(--app-border)] pb-1 mb-2">
                          <User size={13} />
                          <span className="text-[11px] uppercase tracking-wider">2. Contact Details</span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">Mailing Name</label>
                            <input
                              type="text"
                              value={ledgerForm.mailingName}
                              onChange={(e) => setLedgerForm(prev => ({ ...prev, mailingName: e.target.value }))}
                              placeholder="e.g. ABC Traders"
                              className="w-full h-8 rounded-lg border px-2.5 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">Mobile Number</label>
                            <input
                              type="text"
                              value={ledgerForm.mobileNumber}
                              onChange={(e) => setLedgerForm(prev => ({ ...prev, mobileNumber: e.target.value }))}
                              placeholder="9876543210"
                              className="w-full h-8 rounded-lg border px-2.5 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">Email Address</label>
                          <input
                            type="email"
                            value={ledgerForm.emailAddress}
                            onChange={(e) => setLedgerForm(prev => ({ ...prev, emailAddress: e.target.value }))}
                            placeholder="info@abctraders.com"
                            className="w-full h-8 rounded-lg border px-2.5 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                          />
                        </div>

                        <div>
                          <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">Address</label>
                          <textarea
                            rows={1.5}
                            value={ledgerForm.address}
                            onChange={(e) => setLedgerForm(prev => ({ ...prev, address: e.target.value }))}
                            placeholder="12, Business Street, Mumbai"
                            className="w-full rounded-lg border px-2 py-1 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)] resize-none"
                          />
                        </div>
                      </div>

                      {/* Section 4: Banking Details */}
                      <div className="space-y-2 border rounded-xl p-3 bg-[var(--app-content-bg)] border-[var(--app-border)]">
                        <div className="flex items-center gap-1.5 text-[var(--app-accent)] dark:text-[var(--app-accent)] font-bold border-b border-[var(--app-border)] pb-1 mb-2">
                          <Landmark size={13} />
                          <span className="text-[11px] uppercase tracking-wider">4. Banking Details</span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">Bank Name</label>
                            <input
                              type="text"
                              value={ledgerForm.bankName}
                              onChange={(e) => setLedgerForm(prev => ({ ...prev, bankName: e.target.value }))}
                              placeholder="HDFC Bank"
                              className="w-full h-8 rounded-lg border px-2.5 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">Account No</label>
                            <input
                              type="text"
                              value={ledgerForm.accountNumber}
                              onChange={(e) => setLedgerForm(prev => ({ ...prev, accountNumber: e.target.value }))}
                              placeholder="50200012345"
                              className="w-full h-8 rounded-lg border px-2.5 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">IFSC Code</label>
                            <input
                              type="text"
                              value={ledgerForm.ifscCode}
                              onChange={(e) => setLedgerForm(prev => ({ ...prev, ifscCode: e.target.value }))}
                              placeholder="HDFC0001234"
                              className="w-full h-8 rounded-lg border px-2.5 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">Branch</label>
                            <input
                              type="text"
                              value={ledgerForm.branch}
                              onChange={(e) => setLedgerForm(prev => ({ ...prev, branch: e.target.value }))}
                              placeholder="Mumbai"
                              className="w-full h-8 rounded-lg border px-2.5 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Column 3: GST & Tax Details & Additional Details */}
                    <div className="space-y-3">
                      {/* Section 3: GST & Tax Details */}
                      <div className="space-y-2 border rounded-xl p-3 bg-[var(--app-content-bg)] border-[var(--app-border)]">
                        <div className="flex items-center gap-1.5 text-[var(--app-accent)] dark:text-[var(--app-accent)] font-bold border-b border-[var(--app-border)] pb-1 mb-2">
                          <ShieldCheck size={13} />
                          <span className="text-[11px] uppercase tracking-wider">3. Tax Details</span>
                        </div>
                        
                        <div className="flex items-center justify-between pb-1">
                          <label className="text-xs font-semibold text-[var(--app-text)]">GST Applicable</label>
                          <button
                            type="button"
                            onClick={() => setLedgerForm(prev => ({ ...prev, gstApplicable: !prev.gstApplicable }))}
                            className={`relative inline-flex h-4.5 w-8 items-center rounded-full transition-colors focus:outline-none ${
                              ledgerForm.gstApplicable ? 'bg-[var(--app-accent)]' : 'bg-[var(--app-control-hover)]'
                            }`}
                          >
                            <span
                              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                ledgerForm.gstApplicable ? 'translate-x-4' : 'translate-x-0.5'
                              }`}
                            />
                          </button>
                        </div>

                        {ledgerForm.gstApplicable && (
                          <div className="space-y-2 animate-in fade-in duration-200">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">GSTIN</label>
                                <input
                                  type="text"
                                  value={ledgerForm.gstin}
                                  onChange={(e) => setLedgerForm(prev => ({ ...prev, gstin: e.target.value }))}
                                  placeholder="27ABCDE1234F"
                                  className="w-full h-8 rounded-lg border px-2 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">Reg Type</label>
                                <select
                                  value={ledgerForm.registrationType}
                                  onChange={(e) => setLedgerForm(prev => ({ ...prev, registrationType: e.target.value }))}
                                  className="w-full h-8 rounded-lg border px-1.5 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                                >
                                  <option value="Regular">Regular</option>
                                  <option value="Composition">Composition</option>
                                  <option value="Unregistered">Unregistered</option>
                                  <option value="Consumer">Consumer</option>
                                </select>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">State</label>
                                <select
                                  value={ledgerForm.pos}
                                  onChange={(e) => setLedgerForm(prev => ({ ...prev, pos: e.target.value }))}
                                  className="w-full h-8 rounded-lg border px-1.5 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                                >
                                  <option value="Maharashtra (27)">Maharashtra</option>
                                  <option value="Delhi (07)">Delhi</option>
                                  <option value="Madhya Pradesh (23)">Madhya Pradesh</option>
                                  <option value="Gujarat (24)">Gujarat</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">PAN Number</label>
                                <input
                                  type="text"
                                  value={ledgerForm.panNumber}
                                  onChange={(e) => setLedgerForm(prev => ({ ...prev, panNumber: e.target.value }))}
                                  placeholder="ABCDE1234F"
                                  className="w-full h-8 rounded-lg border px-2.5 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Section 6: Additional Details */}
                      <div className="space-y-2 border rounded-xl p-3 bg-[var(--app-content-bg)] border-[var(--app-border)]">
                        <div className="flex items-center gap-1.5 text-[var(--app-accent)] dark:text-[var(--app-accent)] font-bold border-b border-[var(--app-border)] pb-1 mb-2">
                          <FileSpreadsheet size={13} />
                          <span className="text-[11px] uppercase tracking-wider">6. Additional</span>
                        </div>
                        
                        <div>
                          <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">Status</label>
                          <select
                            value={ledgerForm.status}
                            onChange={(e) => setLedgerForm(prev => ({ ...prev, status: e.target.value }))}
                            className="w-full h-8 rounded-lg border px-1.5 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                          >
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">Notes</label>
                          <textarea
                            rows={1.5}
                            value={ledgerForm.notes}
                            onChange={(e) => setLedgerForm(prev => ({ ...prev, notes: e.target.value }))}
                            placeholder="Preferred customer notes..."
                            className="w-full rounded-lg border px-2 py-1 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)] resize-none"
                          />
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Modal Footer Buttons */}
                <div className="flex justify-end gap-2 p-3 md:p-4 border-t border-[var(--app-border)] text-[10px] font-bold uppercase tracking-wider shrink-0 bg-[var(--app-panel-bg)] rounded-b-none md:rounded-b-xl">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="px-4 py-1.5 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-[var(--app-text)] transition-colors"
                    style={{ borderColor: 'var(--app-border)' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-1.5 bg-[var(--app-accent)] hover:opacity-90 text-white rounded-lg shadow-sm transition-all font-bold"
                  >
                    Save Ledger
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MasterDataPanel;
