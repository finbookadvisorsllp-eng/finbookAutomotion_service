import React, { useState, useEffect, useMemo } from 'react';
import { Search, RefreshCw, Plus, X, BookOpen, Package, User, Users, Percent, IndianRupee, Info, AlertTriangle, CheckCircle2, Coins, ShieldCheck, FileSpreadsheet, ClipboardList, Settings, Landmark } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import DataTable from '../ui/DataTable';
import StatCard from '../ui/StatCard';
import Badge from '../ui/Badge';
import salesApi from '../../services/salesApi';
import fundflowApi from '../../services/fundflowApi';

const MasterDataPanel = ({ mode: propMode, isDark }) => {
  const [activeTab, setActiveTab] = useState(propMode || 'Party Ledger');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyUnsynced, setOnlyUnsynced] = useState(false);
  const [loading, setLoading] = useState(false);

  // Dynamic Tabs State
  const [openTabs, setOpenTabs] = useState(() => {
    const isStockMode = propMode === 'Stock Ledger' || propMode === 'Item Master';
    const targetId = isStockMode ? 'Stock Ledger' : 'Party Ledger';
    return [
      { id: targetId, title: targetId, type: 'list', isStock: isStockMode }
    ];
  });

  const currentTabObj = openTabs.find(t => t.id === activeTab) || openTabs[0];
  const isStock = currentTabObj?.isStock ?? (activeTab === 'Stock Ledger' || activeTab === 'Item Master');
  const isDetailView = currentTabObj?.type === 'detail';

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
        ...l,
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
        ...s,
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
      const isStockMode = propMode === 'Stock Ledger' || propMode === 'Item Master';
      const targetId = isStockMode ? 'Stock Ledger' : 'Party Ledger';
      setOpenTabs([
        { id: targetId, title: targetId, type: 'list', isStock: isStockMode }
      ]);
      setActiveTab(targetId);
    }
    fetchMasterData();
  }, [propMode]);

  const handleRowClick = (row) => {
    const tabId = isStock ? `stock-${row.sr}` : `ledger-${row.ledger}`;
    const tabTitle = isStock ? row.name : row.ledger;
    
    // Check if tab already exists
    const exists = openTabs.find(t => t.id === tabId);
    if (!exists) {
      const newTab = {
        id: tabId,
        title: tabTitle,
        type: 'detail',
        isStock,
        row,
      };
      setOpenTabs(prev => [...prev, newTab]);
    }
    setActiveTab(tabId);
  };

  const handleCloseTab = (e, tabId) => {
    e.stopPropagation();
    const tabIndex = openTabs.findIndex(t => t.id === tabId);
    const newTabs = openTabs.filter(t => t.id !== tabId);
    setOpenTabs(newTabs);
    
    // If the closed tab was active, switch to another tab
    if (activeTab === tabId) {
      const fallbackTab = newTabs[tabIndex - 1] || newTabs[0];
      setActiveTab(fallbackTab.id);
    }
  };

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


  // Statistics Display Config
  const ledgerStats = [
    { label: 'Total Ledgers', value: partyDataList.length, icon: Users },
    { label: 'Sundry Debtors', value: partyDataList.filter(p => p.parentGroup === 'Sundry Debtors').length, icon: User },
    { label: 'Sundry Creditors', value: partyDataList.filter(p => p.parentGroup === 'Sundry Creditors').length, icon: BookOpen },
    { label: 'Unsynced', value: partyDataList.filter(p => !p.isSynced).length, icon: AlertTriangle },
  ];

  const stockStats = [
    { label: 'Total Items', value: stockDataList.length, icon: Package },
    { label: 'Active Items', value: stockDataList.filter(s => s.qty > 0).length, icon: CheckCircle2 },
    { label: 'Out of Stock', value: stockDataList.filter(s => s.qty === 0).length, icon: AlertTriangle },
    { label: 'Stock Value', value: `₹${stockDataList.reduce((acc, s) => acc + s.value, 0).toLocaleString('en-IN')}`, icon: Coins },
  ];

  const activeStats = isStock ? stockStats : ledgerStats;

  // Filtered rows (search + unsynced) for the active tab.
  const rows = useMemo(() => {
    const list = isStock ? stockDataList : partyDataList;
    const q = searchQuery.trim().toLowerCase();
    return list.filter((r) => {
      if (onlyUnsynced && r.isSynced) return false;
      if (!q) return true;
      return isStock
        ? `${r.name}${r.group}${r.hsn}`.toLowerCase().includes(q)
        : `${r.ledger}${r.parentGroup}${r.gst}`.toLowerCase().includes(q);
    });
  }, [isStock, stockDataList, partyDataList, searchQuery, onlyUnsynced]);

  const ledgerColumns = [
    { key: 'sr', header: 'Sr', width: '52px', align: 'center', render: (_r, i) => <span style={{ color: 'var(--app-muted)' }}>{i + 1}</span> },
    { key: 'ledger', header: 'Ledger', sortable: true, render: (r) => <span className="font-bold" style={{ color: 'var(--app-heading)' }}>{r.ledger}</span> },
    { key: 'parentGroup', header: 'Parent Group', sortable: true, render: (r) => <Badge tone="neutral">{r.parentGroup}</Badge> },
    { key: 'subGroup', header: 'Sub Group', render: (r) => <span style={{ color: 'var(--app-muted)' }}>{r.subGroup}</span> },
    { key: 'gst', header: 'GST Number', render: (r) => <span className="font-mono font-semibold">{r.gst}</span> },
    { key: 'name', header: 'Name', sortable: true, render: (r) => <span style={{ color: 'var(--app-heading)' }}>{r.name}</span> },
    { key: 'pos', header: 'Place of Supply', render: (r) => <span style={{ color: 'var(--app-muted)' }}>{r.pos}</span> },
    { key: 'type', header: 'GST Reg', render: (r) => <span style={{ color: 'var(--app-muted)' }}>{r.type}</span> },
    { key: 'add1', header: 'Address', render: (r) => <span className="truncate block max-w-[220px]" title={r.add1} style={{ color: 'var(--app-muted)' }}>{r.add1}</span> },
    { key: 'city', header: 'City', render: (r) => <span style={{ color: 'var(--app-muted)' }}>{r.city}</span> },
    { key: 'isSynced', header: 'Sync', align: 'center', sortable: true, sortValue: (r) => (r.isSynced ? 1 : 0), render: (r) => <Badge tone={r.isSynced ? 'success' : 'warning'}>{r.isSynced ? 'Synced' : 'Pending'}</Badge> },
  ];

  const stockColumns = [
    { key: 'sr', header: 'Sr', width: '52px', align: 'center', render: (_r, i) => <span style={{ color: 'var(--app-muted)' }}>{i + 1}</span> },
    { key: 'name', header: 'Item Name', sortable: true, render: (r) => <span className="font-bold" style={{ color: 'var(--app-heading)' }}>{r.name}</span> },
    { key: 'group', header: 'Stock Group', sortable: true, render: (r) => <Badge tone="neutral">{r.group}</Badge> },
    { key: 'uom', header: 'UOM', render: (r) => <span style={{ color: 'var(--app-muted)' }}>{r.uom}</span> },
    { key: 'hsn', header: 'HSN', render: (r) => <span className="font-mono font-semibold">{r.hsn}</span> },
    { key: 'gstRate', header: 'GST', render: (r) => <span className="font-semibold" style={{ color: 'var(--app-accent)' }}>{r.gstRate}</span> },
    { key: 'qty', header: 'Opening Qty', align: 'right', sortable: true, sortValue: (r) => r.qty, render: (r) => <span className="font-semibold tabular-nums" style={{ color: 'var(--app-heading)' }}>{r.qty}</span> },
    { key: 'rate', header: 'Rate', align: 'right', sortable: true, sortValue: (r) => r.rate, render: (r) => <span className="tabular-nums">₹{(r.rate ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span> },
    { key: 'value', header: 'Opening Value', align: 'right', sortable: true, sortValue: (r) => r.value, render: (r) => <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">₹{(r.value ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span> },
    { key: 'isSynced', header: 'Sync', align: 'center', sortable: true, sortValue: (r) => (r.isSynced ? 1 : 0), render: (r) => <Badge tone={r.isSynced ? 'success' : 'warning'}>{r.isSynced ? 'Synced' : 'Pending'}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-2.5 h-full animate-in fade-in duration-500 overflow-hidden p-1 text-[13px] text-[var(--app-text)]">
      
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
          className="px-3.5 py-1.5 m3-interactive bg-[var(--app-accent)] hover:opacity-90 text-white font-bold text-[10.5px] rounded-lg flex items-center gap-1 transition-all uppercase shrink-0 shadow-sm"
        >
          {showCreateForm ? <X size={12} /> : <Plus size={12} />}
          {showCreateForm ? 'Close Form' : isStock ? 'New Stock Item' : 'New Party Ledger'}
        </button>
      </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-1 border-b shrink-0 px-1 mt-1" style={{ borderColor: 'var(--app-border)' }}>
        {openTabs.map((t) => {
          const isActive = activeTab === t.id;
          return (
            <div
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 border-t border-x rounded-t-xl text-[12px] font-bold cursor-pointer transition-all select-none ${
                isActive
                  ? 'bg-[var(--app-panel-bg)] border-[var(--app-border)] text-[var(--app-accent)] border-b-transparent z-10'
                  : 'bg-[var(--app-content-bg)]/40 border-transparent text-[var(--app-muted)] hover:bg-[var(--app-content-bg)]/80 hover:text-[var(--app-text)]'
              }`}
              style={{
                marginBottom: '-1px',
                borderColor: isActive ? 'var(--app-border)' : 'transparent',
                borderBottomColor: isActive ? 'var(--app-panel-bg)' : 'transparent',
              }}
            >
              {t.isStock ? <Package size={13} /> : <BookOpen size={13} />}
              <span className="truncate max-w-[120px]">{t.title}</span>
              {t.type === 'detail' && (
                <button
                  onClick={(e) => handleCloseTab(e, t.id)}
                  className="p-0.5 rounded-full hover:bg-[var(--app-control-hover)] hover:text-red-500 transition-colors ml-1"
                >
                  <X size={10} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {!isDetailView ? (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 shrink-0">
            {activeStats.map((s, i) => (
              <StatCard key={s.label} index={i} label={s.label} value={s.value} icon={s.icon} />
            ))}
          </div>

          {/* Master table */}
          <div className="flex-1 min-h-0">
            <DataTable
              minWidth={isStock ? '1000px' : '1400px'}
              data={rows}
              rowKey={(r) => r.sr}
              loading={loading}
              emptyText={isStock ? 'No stock items found.' : 'No party ledgers found.'}
              columns={isStock ? stockColumns : ledgerColumns}
              search={{ value: searchQuery, onChange: setSearchQuery, placeholder: isStock ? 'Search stock items…' : 'Search party ledgers…' }}
              onRowClick={(row) => handleRowClick(row)}
              filters={
                <>
                  <label className="flex items-center gap-1.5 cursor-pointer select-none px-1">
                    <input type="checkbox" checked={onlyUnsynced} onChange={(e) => setOnlyUnsynced(e.target.checked)} className="w-3.5 h-3.5 rounded accent-[var(--app-accent)] cursor-pointer" />
                    <span className="text-[11px] font-semibold whitespace-nowrap" style={{ color: 'var(--app-muted)' }}>Unsynced Only</span>
                  </label>
                  <button type="button" title="Refresh" aria-label="Refresh" onClick={() => { setSearchQuery(''); setOnlyUnsynced(false); fetchMasterData(); toast.info('Lists refreshed from Tally cache'); }} className="h-8 w-8 flex items-center justify-center border rounded-lg text-[var(--app-muted)] border-[var(--app-border)] hover:bg-[var(--app-control-hover)] transition-colors">
                    <RefreshCw size={13} />
                  </button>
                </>
              }
            />
          </div>
        </>
      ) : (
        <div className="flex-1 min-h-0">
          <MasterDetailsView
            isStock={isStock}
            row={currentTabObj.row}
            onClose={(e) => handleCloseTab(e, currentTabObj.id)}
          />
        </div>
      )}

      {/* Create modals */}
      <div className="contents">
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
                    className="px-5 py-1.5 m3-interactive bg-[var(--app-cta)] hover:opacity-90 text-white rounded-full shadow-sm transition-all font-bold"
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
                    className="px-5 py-1.5 m3-interactive bg-[var(--app-cta)] hover:opacity-90 text-white rounded-full shadow-sm transition-all font-bold"
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

/* --- Master Details View --- */

const MasterDetailsView = ({ isStock, row, onClose }) => {
  const [activeSubTab, setActiveSubTab] = useState('profile');
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isStock || !row?.ledger) return;
    setLoading(true);
    fundflowApi.getPartyDetails(row.ledger)
      .then(res => {
        if (res.success && res.data) setDetails(res.data);
        else setDetails(null);
      })
      .catch(() => setDetails(null))
      .finally(() => setLoading(false));
  }, [row?.ledger, isStock]);

  const SectionHead = ({ title }) => (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-[10px] font-black uppercase tracking-[0.12em]" style={{ color: 'var(--app-accent)' }}>{title}</span>
      <div className="flex-1 h-px" style={{ backgroundColor: 'var(--app-border)' }} />
    </div>
  );

  const Field = ({ label, value, mono }) => (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9.5px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted)' }}>{label}</span>
      <span className={`text-[12.5px] font-bold leading-tight ${mono ? 'font-mono' : ''}`} style={{ color: 'var(--app-heading)' }}>{value || '—'}</span>
    </div>
  );

  const fmtBalance = (bal) => {
    if (bal === undefined || bal === null) return '₹ 0.00 Dr';
    const isCr = bal < 0;
    const abs = Math.abs(bal);
    return `₹ ${abs.toLocaleString('en-IN', { minimumFractionDigits: 2 })} ${isCr ? 'Cr' : 'Dr'}`;
  };

  const syncTone = row.isSynced ? 'success' : 'warning';
  const syncLabel = row.isSynced ? 'Synced' : 'Pending';

  // Calculate Voucher stats if available
  const pendingBillsList = details?.pendingBills || [];
  const totalVouchersCount = pendingBillsList.length;
  const totalBillVal = pendingBillsList.reduce((sum, b) => sum + (parseFloat(b.billAmount) || 0), 0);
  const totalPaidVal = pendingBillsList.reduce((sum, b) => sum + (parseFloat(b.paidAmount) || 0), 0);
  const totalPendingVal = pendingBillsList.reduce((sum, b) => sum + (parseFloat(b.pendingAmount) || 0), 0);

  const pendingBillsColumns = [
    { key: 'date', header: 'Date', render: (b) => <span className="font-semibold" style={{ color: 'var(--app-muted)' }}>{b.date || '—'}</span> },
    { key: 'billNo', header: 'Voucher / Bill No', render: (b) => <span className="font-bold" style={{ color: 'var(--app-heading)' }}>{b.billNo || '—'}</span> },
    { key: 'source', header: 'Source / Type', render: (b) => <Badge tone="neutral">{b.source ? b.source.replace(/_/g, ' ') : 'Voucher'}</Badge> },
    { key: 'billAmount', header: 'Bill Value', align: 'right', render: (b) => <span className="font-bold">₹ {b.billAmount ? b.billAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}</span> },
    { key: 'paidAmount', header: 'Paid Amount', align: 'right', render: (b) => <span className="font-semibold" style={{ color: 'var(--app-muted)' }}>₹ {b.paidAmount ? b.paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}</span> },
    { key: 'pendingAmount', header: 'Outstanding Amount', align: 'right', render: (b) => <span className="font-bold text-red-500">₹ {b.pendingAmount ? b.pendingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}</span> },
    { key: 'dueDate', header: 'Due Date', render: (b) => <span className="font-semibold" style={{ color: 'var(--app-muted)' }}>{b.dueDate || '—'}</span> },
  ];

  return (
    <div className="h-full flex flex-col rounded-xl border bg-[var(--app-panel-bg)] border-[var(--app-border)] shadow-sm animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between shrink-0 bg-[var(--app-content-bg)]/40" style={{ borderColor: 'var(--app-border)' }}>
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="px-2.5 py-1.5 border rounded-lg text-[11px] font-bold uppercase tracking-wider hover:bg-[var(--app-control-hover)] transition-colors"
            style={{ borderColor: 'var(--app-border)', color: 'var(--app-muted)' }}
          >
            ← Back
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-extrabold text-[var(--app-heading)] tracking-tight">
                {isStock ? row.name : row.ledger}
              </h2>
              <Badge tone={syncTone}>{syncLabel}</Badge>
            </div>
            <p className="text-[10px] text-[var(--app-muted)] mt-0.5">
              {isStock ? `Stock Item Group: ${row.group}` : `Ledger Group: ${row.parentGroup}`}
            </p>
          </div>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex items-center gap-4 px-4 py-2 border-b shrink-0 bg-[var(--app-panel-bg)]" style={{ borderColor: 'var(--app-border)' }}>
        <button
          onClick={() => setActiveSubTab('profile')}
          className={`pb-1 text-[12px] font-extrabold tracking-tight border-b-2 transition-all ${
            activeSubTab === 'profile' ? 'border-[var(--app-accent)] text-[var(--app-accent)]' : 'border-transparent text-[var(--app-muted)]'
          }`}
        >
          {isStock ? 'Item Overview' : 'Profile & Settings'}
        </button>
        <button
          onClick={() => setActiveSubTab('vouchers')}
          className={`pb-1 text-[12px] font-extrabold tracking-tight border-b-2 transition-all ${
            activeSubTab === 'vouchers' ? 'border-[var(--app-accent)] text-[var(--app-accent)]' : 'border-transparent text-[var(--app-muted)]'
          }`}
        >
          {isStock ? 'Inventory & Pricing' : 'Transactions & Vouchers'}
        </button>
      </div>

      {/* Scrollable details container */}
      <div className="flex-1 overflow-y-auto p-5 no-scrollbar">

        {loading ? (
          <div className="h-full flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-[var(--app-accent)] border-t-transparent animate-spin" />
              <span className="text-[11px] font-semibold" style={{ color: 'var(--app-muted)' }}>Fetching live database logs…</span>
            </div>
          </div>
        ) : (
          <>
            {activeSubTab === 'profile' && !isStock && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                
                {/* Left Column */}
                <div className="space-y-5">
                  <div>
                    <SectionHead title="Basic Information" />
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Ledger Name" value={row.ledger} />
                      <Field label="Parent Group" value={row.parentGroup} />
                      <Field label="Sub Group" value={row.subGroup} />
                      <Field label="Registration Type" value={row.type} />
                    </div>
                  </div>

                  <div>
                    <SectionHead title="Tax Information" />
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="GSTIN" value={row.gst} mono />
                      <Field label="Place of Supply" value={row.pos} />
                    </div>
                  </div>

                  <div>
                    <SectionHead title="Mailing & Address" />
                    <div className="space-y-3">
                      <Field label="Mailing Name" value={row.name} />
                      {(row.add1 && row.add1 !== '—') && (
                        <Field label="Address" value={`${row.add1} ${row.add2 && row.add2 !== '—' ? row.add2 : ''}`} />
                      )}
                      {(row.city && row.city !== '—') && <Field label="City" value={row.city} />}
                      {(row.emailAddress || row.email) && (
                        <Field label="Email" value={row.emailAddress || row.email} />
                      )}
                      {(row.mobileNumber || row.phone) && (
                        <Field label="Mobile Number" value={row.mobileNumber || row.phone} />
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-5">
                  <div>
                    <SectionHead title="Tally Accounting Profile" />
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Opening Balance" value={fmtBalance(row.openingBalance || details?.openingBalance)} />
                      <Field label="Current Outstanding" value={fmtBalance(details?.outstandingBalance ?? 0)} />
                      <Field label="Maintain Bill-wise" value={row.maintainBillWise ? 'Yes' : 'No'} />
                      {row.creditPeriod && <Field label="Credit Period" value={`${row.creditPeriod} days`} />}
                      {row.creditLimit && <Field label="Credit Limit" value={`₹ ${parseFloat(row.creditLimit).toLocaleString('en-IN')}`} />}
                    </div>
                  </div>

                  {(row.bankName || row.accountNumber || details?.bankName || details?.accountNumber) && (
                    <div>
                      <SectionHead title="Linked Bank Account" />
                      <div className="grid grid-cols-2 gap-4">
                        <Field label="Bank Name" value={row.bankName || details?.bankName} />
                        <Field label="Account Number" value={row.accountNumber || details?.accountNumber} mono />
                        {(row.ifscCode || details?.ifscCode) && (
                          <Field label="IFSC Code" value={row.ifscCode || details?.ifscCode} mono />
                        )}
                        {(row.branch || details?.branch) && (
                          <Field label="Branch" value={row.branch || details?.branch} />
                        )}
                      </div>
                    </div>
                  )}
                </div>

              </div>
            )}

            {activeSubTab === 'vouchers' && !isStock && (
              <div className="space-y-5">
                
                {/* Transaction Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 shrink-0">
                  <StatCard label="Pending Vouchers" value={totalVouchersCount} icon={ClipboardList} index={0} />
                  <StatCard label="Total Bill Value" value={`₹ ${totalBillVal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} icon={IndianRupee} index={1} />
                  <StatCard label="Total Paid Amount" value={`₹ ${totalPaidVal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} icon={CheckCircle2} index={2} />
                  <StatCard label="Outstanding Amount" value={`₹ ${totalPendingVal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} icon={AlertTriangle} index={3} />
                </div>

                {/* Vouchers Table */}
                <div className="border rounded-xl overflow-hidden" style={{ borderColor: 'var(--app-border)' }}>
                  <DataTable
                    columns={pendingBillsColumns}
                    data={pendingBillsList}
                    loading={false}
                    emptyText="No pending vouchers or transaction logs found for this ledger in the active financial year."
                    minWidth="800px"
                  />
                </div>
              </div>
            )}

            {activeSubTab === 'profile' && isStock && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {/* Left Column */}
                <div>
                  <SectionHead title="Basic Specifications" />
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Item Name" value={row.name} />
                    <Field label="Stock Group" value={row.group} />
                    {row.brand && <Field label="Brand" value={row.brand} />}
                    <Field label="Unit of Measure" value={row.uom} />
                  </div>
                </div>

                {/* Right Column */}
                <div>
                  <SectionHead title="Tax Classification" />
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="HSN / SAC Code" value={row.hsn} mono />
                    <Field label="GST Rate" value={row.gstRate} />
                    {row.taxabilityType && <Field label="Taxability Type" value={row.taxabilityType} />}
                  </div>
                </div>
              </div>
            )}

            {activeSubTab === 'vouchers' && isStock && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {/* Left Column */}
                <div>
                  <SectionHead title="Stock Inventory Profile" />
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Opening Quantity" value={row.qty ? `${row.qty} ${row.uom}` : `0 ${row.uom}`} />
                    <Field label="Purchase Cost / Rate" value={row.rate ? `₹ ${row.rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'} mono />
                    <Field label="Opening Stock Value" value={row.value ? `₹ ${row.value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'} mono />
                    {row.sku && <Field label="SKU / Barcode" value={row.sku} mono />}
                  </div>
                </div>

                {/* Right Column */}
                <div>
                  <SectionHead title="Pricing & Description" />
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      {row.salesPrice && (
                        <Field label="Standard Sales Price" value={`₹ ${row.salesPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} mono />
                      )}
                      {row.mrp && (
                        <Field label="Maximum Retail Price (MRP)" value={`₹ ${row.mrp.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} mono />
                      )}
                    </div>
                    {row.description && <Field label="Item Description" value={row.description} />}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

      </div>

    </div>
  );
};

export default MasterDataPanel;

