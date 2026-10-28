import React, { useState, useMemo, useRef } from 'react';
import {
  Search,
  Filter,
  Calendar,
  ChevronDown,
  Upload,
  Landmark,
  FileText,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  Users,
  TrendingUp,
  Award,
  BarChart3,
  PieChart,
  Trash2,
  RefreshCw,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  Building2,
  Send,
  Download,
  AlertCircle
} from 'lucide-react';
import Badge from '../ui/Badge';

const SLICE_COLORS = [
  '#4F46E5', // Indigo
  '#0EA5E9', // Sky
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#64748B', // Slate
];

export default function BankReconciliationDashboard({
  vouchers = [],
  selectedBank = '',
  setSelectedBank,
  dynamicBanks = [],
  dynamicBankLedgers = [],
  onUploadStatement,
  onDeleteVoucher,
  deletingId,
  onBulkDelete,
  selectedRows = [],
  setSelectedRows,
  loading = false,
}) {
  // ── Filters State ──
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedPartyLedger, setSelectedPartyLedger] = useState('ALL');
  const [selectedVoucherType, setSelectedVoucherType] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, PUSHED, PENDING, FAILED

  // Middle card states
  const [chartMetric, setChartMetric] = useState('count'); // 'count' | 'amount'
  const [chartType, setChartType] = useState('pie'); // 'pie' | 'bar'
  const [hoveredSlice, setHoveredSlice] = useState(null);

  // Table sorting
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // Table search & party focus
  const [tableSearch, setTableSearch] = useState('');
  const [focusedParty, setFocusedParty] = useState(null);

  // Column-level search / filters
  const [colFilters, setColFilters] = useState({
    voucherNumber: '',
    date: '',
    description: '',
    amount: '',
    type: '',
    party: '',
    status: '',
  });

  const handleColFilterChange = (key, value) => {
    setColFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearColFilters = () => {
    setColFilters({
      voucherNumber: '',
      date: '',
      description: '',
      amount: '',
      type: '',
      party: '',
      status: '',
    });
  };

  const hasActiveColFilters = Object.values(colFilters).some((v) => Boolean(v && String(v).trim()));

  // Reference for scrolling to vouchers table
  const vouchersTableRef = useRef(null);

  // ── Helpers ──
  const parseDate = (d) => {
    if (!d) return null;
    if (d instanceof Date) return isNaN(d.getTime()) ? null : d;
    const str = String(d).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      const parsed = new Date(str);
      return isNaN(parsed.getTime()) ? null : parsed;
    }
    const dmy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (dmy) {
      const parsed = new Date(parseInt(dmy[3], 10), parseInt(dmy[2], 10) - 1, parseInt(dmy[1], 10));
      return isNaN(parsed.getTime()) ? null : parsed;
    }
    const parsed = new Date(str);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  // Find min and max date across all available vouchers for default display
  const dateRangeSummary = useMemo(() => {
    let minD = null;
    let maxD = null;
    vouchers.forEach((v) => {
      const parsed = parseDate(v.rawDate || v.date);
      if (parsed) {
        if (!minD || parsed < minD) minD = parsed;
        if (!maxD || parsed > maxD) maxD = parsed;
      }
    });

    const fmt = (d) =>
      d
        ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : '—';

    return {
      minDate: minD,
      maxDate: maxD,
      label: minD && maxD ? `${fmt(minD)}  →  ${fmt(maxD)}` : 'All Dates',
    };
  }, [vouchers]);

  // Unique Party Ledgers for filter dropdown
  const allPartyLedgersList = useMemo(() => {
    const set = new Set();
    vouchers.forEach((v) => {
      const p = (v.party || '').trim();
      if (p && p !== '—' && p.toLowerCase() !== 'unmapped') {
        set.add(p);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [vouchers]);

  // ── Base Filtered Vouchers (affected by top filter bar) ──
  const filteredVouchers = useMemo(() => {
    return vouchers.filter((v) => {
      // 1. Bank Account filter
      if (selectedBank) {
        const b = (v.bankLedger || '').toLowerCase();
        const sel = selectedBank.toLowerCase();
        if (!b.includes(sel) && !sel.includes(b)) return false;
      }

      // 2. Search query (party, narration, voucherNumber, bankLedger, amount)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchParty = (v.party || '').toLowerCase().includes(q);
        const matchDesc = (v.description || '').toLowerCase().includes(q);
        const matchNum = (v.voucherNumber || '').toLowerCase().includes(q);
        const matchAmt = String(v.amount || '').toLowerCase().includes(q);
        const matchBank = (v.bankLedger || '').toLowerCase().includes(q);
        if (!matchParty && !matchDesc && !matchNum && !matchAmt && !matchBank) return false;
      }

      // 3. Date From & To
      if (dateFrom || dateTo) {
        const d = parseDate(v.rawDate || v.date);
        if (d) {
          if (dateFrom) {
            const df = new Date(dateFrom);
            df.setHours(0, 0, 0, 0);
            if (d < df) return false;
          }
          if (dateTo) {
            const dt = new Date(dateTo);
            dt.setHours(23, 59, 59, 999);
            if (d > dt) return false;
          }
        }
      }

      // 4. Party Ledger filter
      if (selectedPartyLedger !== 'ALL') {
        if ((v.party || '').toLowerCase() !== selectedPartyLedger.toLowerCase()) return false;
      }

      // 5. Voucher Type filter
      if (selectedVoucherType !== 'ALL') {
        if ((v.type || '').toUpperCase() !== selectedVoucherType.toUpperCase()) return false;
      }

      return true;
    });
  }, [vouchers, selectedBank, searchQuery, dateFrom, dateTo, selectedPartyLedger, selectedVoucherType]);

  // ── Party Wise Aggregation & Repeated Transactions ──
  const {
    partyStatsList,
    top5Parties,
    totalRepeatedTxnsCount,
    uniquePartiesWithRepeatsCount,
    totalTxnAmount,
    highestRepeatedParty,
    highestAmountParty,
    dominantTypeInfo,
    multiDatePartiesCount,
  } = useMemo(() => {
    const partyMap = {};
    let totalAmt = 0;
    const typeCountMap = { Payment: 0, Receipt: 0, Contra: 0 };

    filteredVouchers.forEach((v) => {
      const rawAmt = typeof v.rawAmount === 'number' ? v.rawAmount : parseFloat(String(v.amount).replace(/,/g, '')) || 0;
      totalAmt += rawAmt;

      const vType = v.type || 'Payment';
      if (typeCountMap[vType] !== undefined) {
        typeCountMap[vType] += 1;
      } else {
        typeCountMap[vType] = 1;
      }

      const pName = (v.party || '').trim();
      if (!pName || pName === '—' || pName.toLowerCase() === 'unmapped') return;

      if (!partyMap[pName]) {
        partyMap[pName] = {
          name: pName,
          count: 0,
          totalAmount: 0,
          dates: new Set(),
          transactions: [],
        };
      }
      partyMap[pName].count += 1;
      partyMap[pName].totalAmount += rawAmt;
      if (v.rawDate || v.date) partyMap[pName].dates.add(v.rawDate || v.date);
      partyMap[pName].transactions.push(v);
    });

    const allParties = Object.values(partyMap);

    // Repeated parties (count > 1)
    const repeated = allParties.filter((p) => p.count > 1);
    const repeatedTxnsCount = repeated.reduce((acc, p) => acc + p.count, 0);

    // Sort by count descending for Top 5
    const sortedByCount = [...allParties].sort((a, b) => b.count - a.count || b.totalAmount - a.totalAmount);
    const top5 = sortedByCount.slice(0, 5);

    // Highest repeated party
    const topRepeated = sortedByCount[0] || null;

    // Highest amount party
    const sortedByAmt = [...allParties].sort((a, b) => b.totalAmount - a.totalAmount);
    const topAmount = sortedByAmt[0] || null;

    // Dominant type info
    const totalTxns = filteredVouchers.length;
    let dominantType = 'Payment';
    let maxTypeCount = 0;
    Object.entries(typeCountMap).forEach(([t, cnt]) => {
      if (cnt > maxTypeCount) {
        maxTypeCount = cnt;
        dominantType = t;
      }
    });
    const dominantPct = totalTxns > 0 ? Math.round((maxTypeCount / totalTxns) * 100) : 0;

    // Parties having transactions on multiple dates
    const multiDates = allParties.filter((p) => p.dates.size > 1).length;

    return {
      partyStatsList: allParties,
      top5Parties: top5,
      totalRepeatedTxnsCount: repeatedTxnsCount,
      uniquePartiesWithRepeatsCount: repeated.length,
      totalTxnAmount: totalAmt,
      highestRepeatedParty: topRepeated,
      highestAmountParty: topAmount,
      dominantTypeInfo: { type: dominantType, count: maxTypeCount, percent: dominantPct },
      multiDatePartiesCount: multiDates,
    };
  }, [filteredVouchers]);

  // Vouchers filtered by everything except voucher type (to calculate counts on the voucher type filter pills)
  const vouchersBeforeTypeFilter = useMemo(() => {
    return vouchers.filter((v) => {
      if (selectedBank) {
        const b = (v.bankLedger || '').toLowerCase();
        const sel = selectedBank.toLowerCase();
        if (!b.includes(sel) && !sel.includes(b)) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchParty = (v.party || '').toLowerCase().includes(q);
        const matchDesc = (v.description || '').toLowerCase().includes(q);
        const matchNum = (v.voucherNumber || '').toLowerCase().includes(q);
        const matchAmt = String(v.amount || '').toLowerCase().includes(q);
        const matchBank = (v.bankLedger || '').toLowerCase().includes(q);
        if (!matchParty && !matchDesc && !matchNum && !matchAmt && !matchBank) return false;
      }
      if (dateFrom || dateTo) {
        const d = parseDate(v.rawDate || v.date);
        if (d) {
          if (dateFrom) {
            const df = new Date(dateFrom);
            df.setHours(0, 0, 0, 0);
            if (d < df) return false;
          }
          if (dateTo) {
            const dt = new Date(dateTo);
            dt.setHours(23, 59, 59, 999);
            if (d > dt) return false;
          }
        }
      }
      if (selectedPartyLedger !== 'ALL') {
        if ((v.party || '').toLowerCase() !== selectedPartyLedger.toLowerCase()) return false;
      }
      return true;
    });
  }, [vouchers, selectedBank, searchQuery, dateFrom, dateTo, selectedPartyLedger]);

  const voucherTypeCounts = useMemo(() => {
    const counts = { ALL: vouchersBeforeTypeFilter.length, Payment: 0, Receipt: 0, Contra: 0 };
    vouchersBeforeTypeFilter.forEach((v) => {
      const t = v.type || 'Payment';
      if (counts[t] !== undefined) counts[t] += 1;
      else counts[t] = 1;
    });
    return counts;
  }, [vouchersBeforeTypeFilter]);

  // Status statistics for the cards (based on filteredVouchers)
  const statusStats = useMemo(() => {
    const total = filteredVouchers.length;
    const pushed = filteredVouchers.filter((v) => (v.statusCode || '').toLowerCase() === 'pushed').length;
    const pending = filteredVouchers.filter((v) => (v.statusCode || '').toLowerCase() === 'pending').length;
    const failed = filteredVouchers.filter((v) => (v.statusCode || '').toLowerCase() === 'failed').length;
    return { total, pushed, pending, failed };
  }, [filteredVouchers]);

  // ── Table Specific Filtering (Status, Focused Party, and Table Search) ──
  const tableDisplayVouchers = useMemo(() => {
    let result = filteredVouchers;

    // Focus on single party from "View Details" click
    if (focusedParty) {
      result = result.filter((v) => (v.party || '').trim().toLowerCase() === focusedParty.toLowerCase());
    }

    // Status filter
    if (statusFilter !== 'ALL') {
      result = result.filter((v) => (v.statusCode || '').toUpperCase() === statusFilter.toUpperCase());
    }

    // Local table search
    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase().trim();
      result = result.filter((v) =>
        Object.values(v).some((val) => String(val || '').toLowerCase().includes(q))
      );
    }

    // Column-level filters (Instant live filtering per column)
    if (colFilters.voucherNumber.trim()) {
      const q = colFilters.voucherNumber.toLowerCase().trim();
      result = result.filter((v) => (v.voucherNumber || '').toLowerCase().includes(q));
    }

    if (colFilters.date.trim()) {
      const q = colFilters.date.toLowerCase().trim();
      const dmyMatch = q.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
      const isoQuery = dmyMatch ? `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}` : null;

      result = result.filter((v) => {
        const dStr = String(v.date || '').toLowerCase();
        const rawStr = String(v.rawDate || '').toLowerCase();
        if (dStr.includes(q) || rawStr.includes(q)) return true;
        if (isoQuery && (dStr.includes(isoQuery) || rawStr.includes(isoQuery))) return true;
        return false;
      });
    }

    if (colFilters.description.trim()) {
      const q = colFilters.description.toLowerCase().trim();
      result = result.filter((v) => (v.description || '').toLowerCase().includes(q));
    }

    if (colFilters.amount.trim()) {
      const q = colFilters.amount.toLowerCase().trim().replace(/,/g, '').replace(/[₹rs\s]/gi, '');
      result = result.filter((v) => {
        const cleanAmt = String(v.amount || '').replace(/,/g, '').toLowerCase();
        const rawAmt = String(v.rawAmount || '').toLowerCase();
        return cleanAmt.includes(q) || rawAmt.includes(q);
      });
    }

    if (colFilters.type) {
      const q = colFilters.type.toLowerCase();
      result = result.filter((v) => (v.type || '').toLowerCase() === q);
    }

    if (colFilters.party.trim()) {
      const q = colFilters.party.toLowerCase().trim();
      result = result.filter((v) => (v.party || '').toLowerCase().includes(q));
    }

    if (colFilters.status) {
      const q = colFilters.status.toLowerCase();
      result = result.filter((v) => (v.statusCode || '').toLowerCase() === q);
    }

    // Sorting
    if (sortConfig.key) {
      result = [...result].sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];

        if (sortConfig.key === 'amount') {
          aVal = typeof a.rawAmount === 'number' ? a.rawAmount : parseFloat(String(aVal).replace(/,/g, '')) || 0;
          bVal = typeof b.rawAmount === 'number' ? b.rawAmount : parseFloat(String(bVal).replace(/,/g, '')) || 0;
          return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
        }

        if (sortConfig.key === 'date') {
          const aD = parseDate(a.rawDate || a.date);
          const bD = parseDate(b.rawDate || b.date);
          if (aD && bD) return sortConfig.direction === 'asc' ? aD - bD : bD - aD;
        }

        aVal = String(aVal || '').toLowerCase();
        bVal = String(bVal || '').toLowerCase();
        return sortConfig.direction === 'asc'
          ? aVal.localeCompare(bVal, undefined, { numeric: true })
          : bVal.localeCompare(aVal, undefined, { numeric: true });
      });
    }

    return result;
  }, [filteredVouchers, focusedParty, statusFilter, tableSearch, colFilters, sortConfig]);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setDateFrom('');
    setDateTo('');
    setSelectedPartyLedger('ALL');
    setSelectedVoucherType('ALL');
    setStatusFilter('ALL');
    setFocusedParty(null);
    setTableSearch('');
    clearColFilters();
  };

  const handlePartyFocus = (partyName) => {
    if (focusedParty === partyName) {
      setFocusedParty(null);
    } else {
      setFocusedParty(partyName);
      if (vouchersTableRef.current) {
        vouchersTableRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  // ── Pie/Donut Chart Geometry for Top 5 Parties ──
  const pieSlices = useMemo(() => {
    if (!top5Parties || top5Parties.length === 0) return [];

    const totalVal = top5Parties.reduce((sum, p) => sum + (chartMetric === 'count' ? p.count : p.totalAmount), 0);
    if (totalVal <= 0) return [];

    let currentAngle = -90; // start at 12 o'clock
    return top5Parties.map((p, idx) => {
      const val = chartMetric === 'count' ? p.count : p.totalAmount;
      const fraction = val / totalVal;
      const angle = fraction * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      currentAngle = endAngle;

      const pct = Math.round(fraction * 100);

      // SVG Donut slice coordinates (R_outer = 45, R_inner = 28, center = 50,50)
      const rad = Math.PI / 180;
      const R_out = 45;
      const R_in = 28;

      const x1 = 50 + R_out * Math.cos(startAngle * rad);
      const y1 = 50 + R_out * Math.sin(startAngle * rad);
      const x2 = 50 + R_out * Math.cos(endAngle * rad);
      const y2 = 50 + R_out * Math.sin(endAngle * rad);

      const x3 = 50 + R_in * Math.cos(endAngle * rad);
      const y3 = 50 + R_in * Math.sin(endAngle * rad);
      const x4 = 50 + R_in * Math.cos(startAngle * rad);
      const y4 = 50 + R_in * Math.sin(startAngle * rad);

      const largeArc = angle > 180 ? 1 : 0;

      // Arc path
      const pathData = `
        M ${x1} ${y1}
        A ${R_out} ${R_out} 0 ${largeArc} 1 ${x2} ${y2}
        L ${x3} ${y3}
        A ${R_in} ${R_in} 0 ${largeArc} 0 ${x4} ${y4}
        Z
      `;

      return {
        party: p,
        idx,
        color: SLICE_COLORS[idx % SLICE_COLORS.length],
        pathData,
        value: val,
        percentage: pct,
        startAngle,
        endAngle,
      };
    });
  }, [top5Parties, chartMetric]);

  const maxBarValue = useMemo(() => {
    if (!top5Parties.length) return 10;
    const maxVal = Math.max(...top5Parties.map((p) => (chartMetric === 'count' ? p.count : p.totalAmount)));
    return maxVal > 0 ? maxVal : 10;
  }, [top5Parties, chartMetric]);

  const typeTone = (t) => {
    switch (t) {
      case 'Receipt':
        return 'success';
      case 'Contra':
        return 'accent';
      case 'Payment':
        return 'warning';
      default:
        return 'neutral';
    }
  };

  const allChecked =
    tableDisplayVouchers.length > 0 && selectedRows.length === tableDisplayVouchers.length;

  return (
    <div className="flex-1 h-full overflow-y-auto pr-1 space-y-2.5 themed-scrollbar">
      {/* ── BREADCRUMB & HEADER ── */}
      <div className="rounded-2xl border p-3.5 bg-[var(--app-panel-bg)] shadow-xs" style={{ borderColor: 'var(--app-border)' }}>
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-[11px] font-semibold text-[var(--app-muted)] mb-1.5">
          <span>Bank Statement</span>
          <span>&gt;</span>
          <span className="font-bold text-[var(--app-heading)]">Bank Reconciliation (BRS)</span>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Title & Subtitle */}
          <div>
            <h1 className="text-lg font-black tracking-tight text-[var(--app-heading)]">
              Bank Reconciliation (BRS)
            </h1>
            <p className="text-[11px] font-medium text-[var(--app-muted)] mt-0.5">
              View repeated transactions by party and get quick insights into your bank statement data.
            </p>
          </div>

          {/* Right Header Controls: Bank Account Dropdown, Date Range Badge, Upload Button */}
          <div className="flex items-center gap-2 flex-wrap ml-auto">
            {/* Bank Selector */}
            <div className="relative min-w-[180px]">
              <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-indigo-500 pointer-events-none">
                <Landmark size={13} />
              </div>
              <select
                value={selectedBank}
                onChange={(e) => setSelectedBank(e.target.value)}
                className="w-full h-8.5 pl-7.5 pr-7 rounded-xl border text-xs font-bold appearance-none outline-none cursor-pointer transition-all bg-[var(--app-control-bg)] hover:border-indigo-400"
                style={{ borderColor: 'var(--app-border)', color: 'var(--app-heading)' }}
              >
                <option value="">All Bank Accounts</option>
                {dynamicBanks.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--app-muted)]" size={13} />
            </div>

            {/* Date Range Display Badge */}
            <div
              className="flex items-center gap-1.5 h-8.5 px-2.5 rounded-xl border text-xs font-bold bg-[var(--app-control-bg)]"
              style={{ borderColor: 'var(--app-border)', color: 'var(--app-heading)' }}
              title="Statement date range"
            >
              <Calendar size={13} className="text-indigo-500" />
              <span>{dateRangeSummary.label}</span>
            </div>

            {/* Upload Bank Statement Button */}
            <button
              onClick={onUploadStatement}
              className="flex items-center gap-1.5 h-8.5 px-3.5 rounded-xl text-xs font-black uppercase tracking-wider bg-[var(--app-accent)] text-white shadow-xs hover:opacity-90 transition-all cursor-pointer active:scale-95"
            >
              <Upload size={13} strokeWidth={2.5} />
              <span>Upload Bank Statement</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── FILTER TOOLBAR ── */}
      <div className="rounded-2xl border p-3 bg-[var(--app-panel-bg)] shadow-xs" style={{ borderColor: 'var(--app-border)' }}>
        {/* Main Filter Controls Row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search by Party Name, Ledger, Narration */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--app-muted)]" size={13} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by party, narration, reference or ID..."
              className="w-full h-8.5 pl-8 pr-7 border rounded-xl text-xs font-semibold outline-none transition-colors bg-[var(--app-control-bg)] focus:border-indigo-500"
              style={{ borderColor: 'var(--app-border)', color: 'var(--app-heading)' }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Voucher Type Dropdown (Right next to Search Bar with live counts) */}
          <div className="relative shrink-0 min-w-[155px]">
            <select
              value={selectedVoucherType}
              onChange={(e) => setSelectedVoucherType(e.target.value)}
              className="w-full h-8.5 pl-3 pr-7 rounded-xl border text-xs font-bold appearance-none outline-none cursor-pointer bg-[var(--app-control-bg)] hover:border-indigo-400 transition-colors"
              style={{ borderColor: 'var(--app-border)', color: 'var(--app-heading)' }}
            >
              <option value="ALL">All Types ({voucherTypeCounts.ALL})</option>
              <option value="Payment">Payment ({voucherTypeCounts.Payment || 0})</option>
              <option value="Receipt">Receipt ({voucherTypeCounts.Receipt || 0})</option>
              <option value="Contra">Contra ({voucherTypeCounts.Contra || 0})</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--app-muted)]" size={13} />
          </div>

          {/* Date Range Inputs */}
          <div className="flex items-center gap-1 shrink-0">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-8.5 px-2 rounded-xl border text-xs font-semibold outline-none bg-[var(--app-control-bg)] w-[128px]"
              style={{ borderColor: 'var(--app-border)', color: 'var(--app-heading)' }}
              title="From Date"
            />
            <span className="text-xs text-[var(--app-muted)] font-bold">→</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-8.5 px-2 rounded-xl border text-xs font-semibold outline-none bg-[var(--app-control-bg)] w-[128px]"
              style={{ borderColor: 'var(--app-border)', color: 'var(--app-heading)' }}
              title="To Date"
            />
          </div>

          {/* Party Ledger Dropdown */}
          <div className="relative shrink-0 w-[165px]">
            <select
              value={selectedPartyLedger}
              onChange={(e) => setSelectedPartyLedger(e.target.value)}
              className="w-full h-8.5 pl-2.5 pr-6 rounded-xl border text-xs font-bold appearance-none outline-none cursor-pointer bg-[var(--app-control-bg)] truncate"
              style={{ borderColor: 'var(--app-border)', color: 'var(--app-heading)' }}
            >
              <option value="ALL">All Parties ({allPartyLedgersList.length})</option>
              {allPartyLedgersList.map((pl) => (
                <option key={pl} value={pl}>
                  {pl}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--app-muted)]" size={13} />
          </div>

          {/* Action Buttons: Reset & Apply (Generously spaced and never overlapping) */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleResetFilters}
              title="Reset all filters"
              className="h-8.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1 hover:bg-[var(--app-control-hover)] text-[var(--app-muted)] hover:text-[var(--app-heading)] transition-all cursor-pointer"
              style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-control-bg)' }}
            >
              <RotateCcw size={12} />
              <span>Reset</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (vouchersTableRef.current) {
                  vouchersTableRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
              className="h-8.5 px-3.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-2xs transition-all cursor-pointer"
            >
              <Filter size={12} strokeWidth={2.5} />
              <span>Apply</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 5 SUMMARY KPI CARDS: Total Transactions, Pushed, Pending, Errors, Amount (Without Highlighting Border) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
        {/* 1. Total Transactions */}
        <div
          onClick={() => setStatusFilter('ALL')}
          title="Click to view all saved vouchers"
          className="rounded-2xl border p-3.5 bg-[var(--app-panel-bg)] shadow-2xs transition-all cursor-pointer hover:shadow-xs"
          style={{ borderColor: 'var(--app-border)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold shrink-0">
              <CheckCircle2 size={17} />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-[var(--app-muted)] uppercase tracking-wider block truncate">
                Total Transactions
              </span>
              <span className="text-xl font-black text-[var(--app-heading)] leading-none mt-1 block">
                {statusStats.total.toLocaleString('en-IN')}
              </span>
              <span className="text-[9.5px] font-medium text-[var(--app-muted)] mt-1 block truncate">
                {selectedVoucherType === 'ALL' ? 'All saved vouchers' : `${selectedVoucherType} vouchers`}
              </span>
            </div>
          </div>
        </div>

        {/* 2. Pushed to Tally */}
        <div
          onClick={() => setStatusFilter((prev) => (prev === 'PUSHED' ? 'ALL' : 'PUSHED'))}
          title="Click to filter vouchers pushed to Tally"
          className="rounded-2xl border p-3.5 bg-[var(--app-panel-bg)] shadow-2xs transition-all cursor-pointer hover:shadow-xs"
          style={{ borderColor: 'var(--app-border)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold shrink-0">
              <Send size={17} />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-[var(--app-muted)] uppercase tracking-wider block truncate">
                Pushed to Tally
              </span>
              <span className="text-xl font-black text-emerald-600 leading-none mt-1 block">
                {statusStats.pushed.toLocaleString('en-IN')}
              </span>
              <span className="text-[9.5px] font-medium text-[var(--app-muted)] mt-1 block">
                Synced successfully
              </span>
            </div>
          </div>
        </div>

        {/* 3. Pending Push */}
        <div
          onClick={() => setStatusFilter((prev) => (prev === 'PENDING' ? 'ALL' : 'PENDING'))}
          title="Click to filter vouchers pending push"
          className="rounded-2xl border p-3.5 bg-[var(--app-panel-bg)] shadow-2xs transition-all cursor-pointer hover:shadow-xs"
          style={{ borderColor: 'var(--app-border)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold shrink-0">
              <Download size={17} />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-[var(--app-muted)] uppercase tracking-wider block truncate">
                Pending Push
              </span>
              <span className="text-xl font-black text-amber-600 leading-none mt-1 block">
                {statusStats.pending.toLocaleString('en-IN')}
              </span>
              <span className="text-[9.5px] font-medium text-[var(--app-muted)] mt-1 block">
                Ready for Tally
              </span>
            </div>
          </div>
        </div>

        {/* 4. Errors / Issues */}
        <div
          onClick={() => setStatusFilter((prev) => (prev === 'FAILED' ? 'ALL' : 'FAILED'))}
          title="Click to filter error vouchers"
          className="rounded-2xl border p-3.5 bg-[var(--app-panel-bg)] shadow-2xs transition-all cursor-pointer hover:shadow-xs"
          style={{ borderColor: 'var(--app-border)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center font-bold shrink-0">
              <AlertCircle size={17} />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-[var(--app-muted)] uppercase tracking-wider block truncate">
                Errors / Issues
              </span>
              <span className="text-xl font-black text-rose-600 leading-none mt-1 block">
                {statusStats.failed.toLocaleString('en-IN')}
              </span>
              <span className="text-[9.5px] font-medium text-[var(--app-muted)] mt-1 block">
                {statusStats.failed === 0 ? 'No issues' : 'Needs attention'}
              </span>
            </div>
          </div>
        </div>

        {/* 5. Total Transaction Amount */}
        <div
          className="rounded-2xl border p-3.5 bg-[var(--app-panel-bg)] shadow-2xs transition-all hover:shadow-xs"
          style={{ borderColor: 'var(--app-border)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center font-bold shrink-0">
              <FileText size={17} />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-[var(--app-muted)] uppercase tracking-wider block truncate">
                Total Transaction Amount
              </span>
              <span className="text-xl font-black text-[var(--app-heading)] leading-none mt-1 block truncate">
                ₹ {totalTxnAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
              <span className="text-[9.5px] font-medium text-[var(--app-muted)] mt-1 block">
                Total value
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── MIDDLE ROW: TOP 5 REPEATED PARTIES (PIE/BAR CHART & TABLE) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Top 5 Repeated Parties Chart */}
        <div className="lg:col-span-6 rounded-2xl border p-4 bg-[var(--app-panel-bg)] shadow-xs flex flex-col" style={{ borderColor: 'var(--app-border)' }}>
          <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b" style={{ borderColor: 'var(--app-border)' }}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
                {chartType === 'pie' ? <PieChart size={16} /> : <BarChart3 size={16} />}
              </div>
              <h2 className="text-sm font-black text-[var(--app-heading)]">
                Top 5 Repeated Parties by {chartMetric === 'count' ? 'Transaction Count' : 'Amount'}
              </h2>
            </div>

            {/* Toggles */}
            <div className="flex items-center gap-1.5">
              {/* Pie vs Bar toggle */}
              <div className="flex items-center p-0.5 rounded-lg border bg-[var(--app-control-bg)]" style={{ borderColor: 'var(--app-border)' }}>
                <button
                  onClick={() => setChartType('pie')}
                  className={`p-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                    chartType === 'pie' ? 'bg-blue-600 text-white shadow-2xs' : 'text-[var(--app-muted)] hover:text-[var(--app-heading)]'
                  }`}
                  title="Pie / Donut Chart"
                >
                  <PieChart size={13} />
                </button>
                <button
                  onClick={() => setChartType('bar')}
                  className={`p-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                    chartType === 'bar' ? 'bg-blue-600 text-white shadow-2xs' : 'text-[var(--app-muted)] hover:text-[var(--app-heading)]'
                  }`}
                  title="Horizontal Bar Chart"
                >
                  <BarChart3 size={13} />
                </button>
              </div>

              {/* Count vs Amount toggle */}
              <div className="flex items-center p-0.5 rounded-lg border bg-[var(--app-control-bg)]" style={{ borderColor: 'var(--app-border)' }}>
                <button
                  onClick={() => setChartMetric('count')}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                    chartMetric === 'count' ? 'bg-blue-600 text-white shadow-2xs' : 'text-[var(--app-muted)] hover:text-[var(--app-heading)]'
                  }`}
                >
                  Count
                </button>
                <button
                  onClick={() => setChartMetric('amount')}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                    chartMetric === 'amount' ? 'bg-blue-600 text-white shadow-2xs' : 'text-[var(--app-muted)] hover:text-[var(--app-heading)]'
                  }`}
                >
                  Amount
                </button>
              </div>
            </div>
          </div>

          {/* Chart Canvas Area */}
          <div className="flex-1 flex flex-col justify-center min-h-[260px]">
            {top5Parties.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-[var(--app-muted)] text-xs font-semibold">
                <span>No repeated parties found in the selected range.</span>
              </div>
            ) : chartType === 'pie' ? (
              /* Pie / Donut Chart View (Requested by User) */
              <div className="flex flex-col sm:flex-row items-center justify-around gap-4 py-2">
                {/* SVG Donut */}
                <div className="relative w-44 h-44 shrink-0">
                  <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                    {pieSlices.map((s) => {
                      const isHovered = hoveredSlice?.idx === s.idx;
                      return (
                        <path
                          key={s.party.name}
                          d={s.pathData}
                          fill={s.color}
                          stroke="var(--app-panel-bg)"
                          strokeWidth="1.5"
                          className="cursor-pointer transition-all duration-200"
                          style={{
                            opacity: hoveredSlice && !isHovered ? 0.45 : 1,
                            transform: isHovered ? 'scale(1.04)' : 'scale(1)',
                            transformOrigin: '50px 50px',
                          }}
                          onMouseEnter={() => setHoveredSlice(s)}
                          onMouseLeave={() => setHoveredSlice(null)}
                          onClick={() => handlePartyFocus(s.party.name)}
                        />
                      );
                    })}
                  </svg>
                  {/* Donut Center Info */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
                    {hoveredSlice ? (
                      <>
                        <span className="text-[10px] font-extrabold text-[var(--app-heading)] truncate max-w-[85px]">
                          {hoveredSlice.party.name}
                        </span>
                        <span className="text-[14px] font-black text-blue-600">
                          {hoveredSlice.percentage}%
                        </span>
                        <span className="text-[9px] font-bold text-[var(--app-muted)]">
                          {chartMetric === 'count'
                            ? `${hoveredSlice.value} txns`
                            : `₹ ${hoveredSlice.value.toLocaleString('en-IN')}`}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-base font-black text-[var(--app-heading)]">
                          {chartMetric === 'count'
                            ? top5Parties.reduce((a, b) => a + b.count, 0)
                            : `₹ ${top5Parties.reduce((a, b) => a + b.totalAmount, 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                        </span>
                        <span className="text-[9px] font-bold text-[var(--app-muted)] uppercase tracking-wider">
                          Top 5 Total
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Pie Chart Legend */}
                <div className="flex-1 space-y-2 w-full max-w-[280px]">
                  {pieSlices.map((s) => {
                    const isHovered = hoveredSlice?.idx === s.idx;
                    return (
                      <div
                        key={s.party.name}
                        onMouseEnter={() => setHoveredSlice(s)}
                        onMouseLeave={() => setHoveredSlice(null)}
                        onClick={() => handlePartyFocus(s.party.name)}
                        className={`flex items-center justify-between p-1.5 rounded-lg cursor-pointer transition-all text-xs ${
                          isHovered ? 'bg-[var(--app-control-hover)] shadow-2xs' : 'hover:bg-[var(--app-control-hover)]'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: s.color }}
                          />
                          <span
                            className="font-bold text-[11.5px] text-[var(--app-heading)] truncate"
                            title={s.party.name}
                          >
                            {s.party.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono text-[11px] font-bold text-[var(--app-muted)]">
                            {chartMetric === 'count'
                              ? `${s.party.count}`
                              : `₹ ${s.party.totalAmount.toLocaleString('en-IN')}`}
                          </span>
                          <span className="font-mono text-[10.5px] font-extrabold text-blue-600 bg-blue-500/10 px-1.5 py-0.5 rounded">
                            {s.percentage}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Horizontal Bar Chart View (from Reference Image 2) */
              <div className="space-y-3 py-2">
                {top5Parties.map((p, idx) => {
                  const val = chartMetric === 'count' ? p.count : p.totalAmount;
                  const pct = Math.min(Math.round((val / maxBarValue) * 100), 100);
                  return (
                    <div
                      key={p.name}
                      onClick={() => handlePartyFocus(p.name)}
                      className="group cursor-pointer"
                    >
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span
                          className="font-bold text-[12px] text-[var(--app-heading)] group-hover:text-blue-600 truncate max-w-[280px]"
                          title={p.name}
                        >
                          {p.name}
                        </span>
                        <span className="font-black text-xs text-blue-600">
                          {chartMetric === 'count'
                            ? `${p.count}`
                            : `₹ ${p.totalAmount.toLocaleString('en-IN')}`}
                        </span>
                      </div>
                      <div className="w-full h-5 rounded-md bg-[var(--app-control-bg)] overflow-hidden flex items-center">
                        <div
                          className="h-full rounded-md bg-blue-500 transition-all duration-500 flex items-center justify-end pr-2"
                          style={{ width: `${Math.max(pct, 4)}%` }}
                        >
                          {pct > 15 && (
                            <span className="text-[10px] font-black text-white">
                              {chartMetric === 'count' ? p.count : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Top 5 Repeated Parties Table */}
        <div className="lg:col-span-6 rounded-2xl border p-4 bg-[var(--app-panel-bg)] shadow-xs flex flex-col" style={{ borderColor: 'var(--app-border)' }}>
          <div className="flex items-center justify-between gap-2 mb-3 pb-3 border-b" style={{ borderColor: 'var(--app-border)' }}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold">
                <Award size={16} />
              </div>
              <h2 className="text-sm font-black text-[var(--app-heading)]">Top 5 Repeated Parties</h2>
            </div>
            {focusedParty ? (
              <button
                onClick={() => setFocusedParty(null)}
                className="text-[11px] font-bold text-rose-600 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Clear Focus</span>
                <X size={12} />
              </button>
            ) : (
              <button
                onClick={() => {
                  if (vouchersTableRef.current) {
                    vouchersTableRef.current.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
              >
                View All
              </button>
            )}
          </div>

          {/* Table */}
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b text-[10px] font-bold uppercase tracking-wider text-[var(--app-muted)]" style={{ borderColor: 'var(--app-border)' }}>
                  <th className="py-2 px-2 w-7">#</th>
                  <th className="py-2 px-3">Party / Customer Ledger</th>
                  <th className="py-2 px-3 text-center">Transaction Count</th>
                  <th className="py-2 px-3 text-right">Total Amount</th>
                  <th className="py-2 px-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--app-border)' }}>
                {top5Parties.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[var(--app-muted)] font-semibold">
                      No repeated transactions found.
                    </td>
                  </tr>
                ) : (
                  top5Parties.map((p, idx) => {
                    const isFocused = focusedParty === p.name;
                    return (
                      <tr
                        key={p.name}
                        onClick={() => handlePartyFocus(p.name)}
                        className={`hover:bg-[var(--app-control-hover)]/70 transition-colors cursor-pointer ${
                          isFocused ? 'bg-blue-500/10' : ''
                        }`}
                      >
                        <td className="py-2.5 px-2 font-mono font-bold text-[var(--app-muted)]">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className="font-bold text-[12px] text-[var(--app-heading)] block truncate max-w-[200px]"
                            title={p.name}
                          >
                            {p.name}
                          </span>
                          <span className="inline-block px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-blue-500/10 text-blue-600 border border-blue-500/20 mt-0.5">
                            Customer
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-black text-[13px] text-[var(--app-heading)]">
                          {p.count}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-[12px] text-[var(--app-heading)] tabular-nums">
                          ₹ {p.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePartyFocus(p.name);
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold border transition-all cursor-pointer inline-flex items-center gap-1 ${
                              isFocused
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'border-blue-200 dark:border-blue-800 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/60'
                            }`}
                          >
                            <span>{isFocused ? 'Focused' : 'View Details'}</span>
                            <ChevronDown size={11} className={isFocused ? 'rotate-180' : ''} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── AI INSIGHTS ROW ── */}
      <div className="rounded-2xl border p-4 bg-[var(--app-panel-bg)] shadow-xs" style={{ borderColor: 'var(--app-border)' }}>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="text-indigo-600" size={16} />
          <h2 className="text-xs font-black uppercase tracking-wider text-[var(--app-heading)]">
            AI Insights
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Insight 1 */}
          <div className="p-3 rounded-xl border bg-[var(--app-control-bg)] flex items-start gap-2.5" style={{ borderColor: 'var(--app-border)' }}>
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
              <Users size={14} />
            </div>
            <p className="text-[11px] font-semibold text-[var(--app-text)] leading-snug">
              <strong className="text-[var(--app-heading)]">{highestRepeatedParty?.name || 'Top Party'}</strong> appears in{' '}
              <strong className="text-blue-600">{highestRepeatedParty?.count || 0} transactions</strong>.
            </p>
          </div>

          {/* Insight 2 */}
          <div className="p-3 rounded-xl border bg-[var(--app-control-bg)] flex items-start gap-2.5" style={{ borderColor: 'var(--app-border)' }}>
            <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0 mt-0.5">
              <RefreshCw size={14} />
            </div>
            <p className="text-[11px] font-semibold text-[var(--app-text)] leading-snug">
              <strong className="text-purple-600">{uniquePartiesWithRepeatsCount} parties</strong> have multiple transactions in the selected period.
            </p>
          </div>

          {/* Insight 3 */}
          <div className="p-3 rounded-xl border bg-[var(--app-control-bg)] flex items-start gap-2.5" style={{ borderColor: 'var(--app-border)' }}>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
              <TrendingUp size={14} />
            </div>
            <p className="text-[11px] font-semibold text-[var(--app-text)] leading-snug">
              <strong className="text-emerald-600">{dominantTypeInfo.type}</strong> transactions represent{' '}
              <strong className="text-emerald-600">{dominantTypeInfo.percent}%</strong> of all transactions.
            </p>
          </div>

          {/* Insight 4 */}
          <div className="p-3 rounded-xl border bg-[var(--app-control-bg)] flex items-start gap-2.5" style={{ borderColor: 'var(--app-border)' }}>
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
              <BarChart3 size={14} />
            </div>
            <p className="text-[11px] font-semibold text-[var(--app-text)] leading-snug">
              The highest transaction frequency for a single party is{' '}
              <strong className="text-indigo-600">{highestRepeatedParty?.count || 0}</strong>.
            </p>
          </div>

          {/* Insight 5 */}
          <div className="p-3 rounded-xl border bg-[var(--app-control-bg)] flex items-start gap-2.5" style={{ borderColor: 'var(--app-border)' }}>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
              <Calendar size={14} />
            </div>
            <p className="text-[11px] font-semibold text-[var(--app-text)] leading-snug">
              <strong className="text-amber-600">{multiDatePartiesCount} parties</strong> have transactions on multiple dates.
            </p>
          </div>
        </div>
      </div>

      {/* ── BOTTOM SECTION: SAVED VOUCHERS TABLE (EXISTING TABLE AS REQUESTED) ── */}
      <div
        ref={vouchersTableRef}
        className="rounded-2xl border p-4 bg-[var(--app-panel-bg)] shadow-xs space-y-3.5 scroll-mt-4"
        style={{ borderColor: 'var(--app-border)' }}
      >
        {/* Table Controls Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-black text-[var(--app-heading)]">All Saved Vouchers</h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-black bg-blue-500/10 text-blue-600 border border-blue-500/20">
              {tableDisplayVouchers.length}
            </span>

            {focusedParty && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                <span>Party: {focusedParty}</span>
                <button onClick={() => setFocusedParty(null)} className="hover:text-rose-500">
                  <X size={12} />
                </button>
              </span>
            )}
          </div>

          {/* Status Pills & Table Search & Actions */}
          <div className="flex items-center gap-2 flex-wrap ml-auto">
            {/* Bulk Delete Button if rows checked */}
            {selectedRows.length > 0 && (
              <button
                onClick={onBulkDelete}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 hover:bg-rose-500 hover:text-white transition-all cursor-pointer shadow-xs"
              >
                <Trash2 size={13} />
                <span>Delete Selected ({selectedRows.length})</span>
              </button>
            )}

            {/* Status Pills */}
            <div className="flex items-center gap-1 bg-[var(--app-control-bg)] p-1 rounded-xl border" style={{ borderColor: 'var(--app-border)' }}>
              {[
                { id: 'ALL', label: 'All Status' },
                { id: 'PUSHED', label: 'Pushed' },
                { id: 'PENDING', label: 'Pending' },
                { id: 'FAILED', label: 'Errors' },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStatusFilter(s.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    statusFilter === s.id
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-[var(--app-muted)] hover:text-[var(--app-heading)]'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Local Table Search Box */}
            <div className="relative min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--app-muted)]" size={13} />
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Search transactions..."
                className="w-full h-8 pl-8 pr-7 border rounded-xl text-xs font-semibold outline-none bg-[var(--app-control-bg)]"
                style={{ borderColor: 'var(--app-border)', color: 'var(--app-heading)' }}
              />
              {tableSearch && (
                <button
                  onClick={() => setTableSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Existing Vouchers Table Markup */}
        <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--app-border)' }}>
          <table className="w-full text-left text-xs border-collapse min-w-[950px]">
            <thead className="bg-[var(--app-table-head-bg)] border-b" style={{ borderColor: 'var(--app-border)' }}>
              <tr>
                <th className="py-2.5 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    className="w-3.5 h-3.5 rounded cursor-pointer accent-[var(--app-accent)]"
                    checked={allChecked}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedRows(tableDisplayVouchers.map((v) => v.id));
                      } else {
                        setSelectedRows([]);
                      }
                    }}
                  />
                </th>
                <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px] text-[var(--app-muted)] w-12 text-center">
                  SR
                </th>
                <th
                  onClick={() => handleSort('voucherNumber')}
                  className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px] text-[var(--app-muted)] cursor-pointer select-none hover:text-[var(--app-accent)]"
                >
                  <div className="flex items-center gap-1">
                    <span>VOUCHER NO / SERIES</span>
                    <ArrowUpDown size={10} className="opacity-50" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('date')}
                  className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px] text-[var(--app-muted)] cursor-pointer select-none hover:text-[var(--app-accent)]"
                >
                  <div className="flex items-center gap-1">
                    <span>DATE</span>
                    <ArrowUpDown size={10} className="opacity-50" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('description')}
                  className="py-2.5 px-4 font-bold uppercase tracking-wider text-[10px] text-[var(--app-muted)] cursor-pointer select-none hover:text-[var(--app-accent)] w-[30%]"
                >
                  <div className="flex items-center gap-1">
                    <span>DESCRIPTION</span>
                    <ArrowUpDown size={10} className="opacity-50" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('amount')}
                  className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px] text-[var(--app-muted)] text-right cursor-pointer select-none hover:text-[var(--app-accent)]"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>AMOUNT</span>
                    <ArrowUpDown size={10} className="opacity-50" />
                  </div>
                </th>
                <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px] text-[var(--app-muted)]">
                  TYPE
                </th>
                <th
                  onClick={() => handleSort('party')}
                  className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px] text-[var(--app-muted)] cursor-pointer select-none hover:text-[var(--app-accent)]"
                >
                  <div className="flex items-center gap-1">
                    <span>PARTY LEDGER</span>
                    <ArrowUpDown size={10} className="opacity-50" />
                  </div>
                </th>
                <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px] text-[var(--app-muted)] text-center">
                  STATUS
                </th>
                <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px] text-[var(--app-muted)] text-center w-14">
                  ACTION
                </th>
              </tr>

              {/* Column-Level Search / Filter Row */}
              <tr className="bg-[var(--app-control-bg)]/80 border-b" style={{ borderColor: 'var(--app-border)' }}>
                <th className="py-1.5 px-2 text-center">
                  <Search size={11} className="mx-auto text-[var(--app-muted)]" />
                </th>
                <th className="py-1.5 px-2 text-center">
                  {/* SR */}
                </th>
                <th className="py-1.5 px-2">
                  <input
                    type="text"
                    value={colFilters.voucherNumber}
                    onChange={(e) => handleColFilterChange('voucherNumber', e.target.value)}
                    placeholder="Search voucher..."
                    className="w-full h-7 px-2 border rounded-md text-[11px] font-semibold outline-none bg-[var(--app-panel-bg)] focus:border-indigo-500 transition-colors"
                    style={{ borderColor: 'var(--app-border)', color: 'var(--app-heading)' }}
                  />
                </th>
                <th className="py-1.5 px-2">
                  <input
                    type="text"
                    value={colFilters.date}
                    onChange={(e) => handleColFilterChange('date', e.target.value)}
                    placeholder="Search date..."
                    className="w-full h-7 px-2 border rounded-md text-[11px] font-semibold outline-none bg-[var(--app-panel-bg)] focus:border-indigo-500 transition-colors"
                    style={{ borderColor: 'var(--app-border)', color: 'var(--app-heading)' }}
                  />
                </th>
                <th className="py-1.5 px-2">
                  <input
                    type="text"
                    value={colFilters.description}
                    onChange={(e) => handleColFilterChange('description', e.target.value)}
                    placeholder="Search description..."
                    className="w-full h-7 px-2 border rounded-md text-[11px] font-semibold outline-none bg-[var(--app-panel-bg)] focus:border-indigo-500 transition-colors"
                    style={{ borderColor: 'var(--app-border)', color: 'var(--app-heading)' }}
                  />
                </th>
                <th className="py-1.5 px-2">
                  <input
                    type="text"
                    value={colFilters.amount}
                    onChange={(e) => handleColFilterChange('amount', e.target.value)}
                    placeholder="Search amount..."
                    className="w-full h-7 px-2 text-right border rounded-md text-[11px] font-semibold outline-none bg-[var(--app-panel-bg)] focus:border-indigo-500 transition-colors"
                    style={{ borderColor: 'var(--app-border)', color: 'var(--app-heading)' }}
                  />
                </th>
                <th className="py-1.5 px-2">
                  <select
                    value={colFilters.type}
                    onChange={(e) => handleColFilterChange('type', e.target.value)}
                    className="w-full h-7 px-1 border rounded-md text-[11px] font-bold outline-none cursor-pointer bg-[var(--app-panel-bg)] focus:border-indigo-500 transition-colors"
                    style={{ borderColor: 'var(--app-border)', color: 'var(--app-heading)' }}
                  >
                    <option value="">All</option>
                    <option value="Payment">Payment</option>
                    <option value="Receipt">Receipt</option>
                    <option value="Contra">Contra</option>
                    <option value="Journal">Journal</option>
                  </select>
                </th>
                <th className="py-1.5 px-2">
                  <input
                    type="text"
                    value={colFilters.party}
                    onChange={(e) => handleColFilterChange('party', e.target.value)}
                    placeholder="Search party..."
                    className="w-full h-7 px-2 border rounded-md text-[11px] font-semibold outline-none bg-[var(--app-panel-bg)] focus:border-indigo-500 transition-colors"
                    style={{ borderColor: 'var(--app-border)', color: 'var(--app-heading)' }}
                  />
                </th>
                <th className="py-1.5 px-2">
                  <select
                    value={colFilters.status}
                    onChange={(e) => handleColFilterChange('status', e.target.value)}
                    className="w-full h-7 px-1 border rounded-md text-[11px] font-bold outline-none cursor-pointer bg-[var(--app-panel-bg)] focus:border-indigo-500 text-center transition-colors"
                    style={{ borderColor: 'var(--app-border)', color: 'var(--app-heading)' }}
                  >
                    <option value="">All</option>
                    <option value="pushed">Pushed</option>
                    <option value="pending">Pending</option>
                    <option value="failed">Failed</option>
                  </select>
                </th>
                <th className="py-1.5 px-2 text-center">
                  {hasActiveColFilters && (
                    <button
                      onClick={clearColFilters}
                      title="Clear column filters"
                      className="p-1 rounded-md text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/60 hover:text-rose-600 transition-all cursor-pointer inline-flex items-center justify-center font-bold"
                    >
                      <X size={12} strokeWidth={2.5} />
                    </button>
                  )}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--app-border)' }}>
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-xs font-semibold text-[var(--app-muted)]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw size={20} className="animate-spin text-blue-600" />
                      <span>Loading saved vouchers...</span>
                    </div>
                  </td>
                </tr>
              ) : tableDisplayVouchers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-xs font-semibold text-[var(--app-muted)]">
                    No matching vouchers found.
                  </td>
                </tr>
              ) : (
                tableDisplayVouchers.map((v, i) => {
                  const isChecked = selectedRows.includes(v.id);
                  return (
                    <tr
                      key={v.id}
                      className={`hover:bg-[var(--app-control-hover)]/60 transition-colors ${
                        isChecked ? 'bg-blue-500/5' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="checkbox"
                          className="w-3.5 h-3.5 rounded cursor-pointer accent-[var(--app-accent)]"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedRows((prev) => [...prev, v.id]);
                            } else {
                              setSelectedRows((prev) => prev.filter((x) => x !== v.id));
                            }
                          }}
                        />
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-[var(--app-muted)]">
                        {i + 1}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800 tracking-tight whitespace-nowrap shadow-2xs">
                          {v.voucherNumber || '—'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-[var(--app-muted)] whitespace-nowrap">
                        {v.date}
                      </td>
                      <td className="py-2.5 px-4 font-bold text-[var(--app-heading)] max-w-[280px]">
                        <span className="truncate block" title={v.description}>
                          {v.description}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-black tabular-nums text-[var(--app-heading)]">
                        ₹ {v.amount}
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge tone={typeTone(v.type)}>{v.type}</Badge>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-[var(--app-heading)]">
                        <span className="truncate block max-w-[180px]" title={v.party}>
                          {v.party}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {v.statusCode === 'pushed' ? (
                          <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                            Pushed
                          </span>
                        ) : v.statusCode === 'failed' ? (
                          <span
                            className="inline-block px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-600 border border-rose-500/20 cursor-pointer"
                            title={v.statusError || 'Failed to push'}
                          >
                            Failed
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-600 border border-amber-500/20">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => onDeleteVoucher(v)}
                          disabled={deletingId === v.id}
                          title="Delete Voucher from Database"
                          className="p-1.5 rounded-md text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-600 transition-all cursor-pointer border border-rose-200 dark:border-rose-800/60 active:scale-95 disabled:opacity-50"
                        >
                          {deletingId === v.id ? (
                            <RefreshCw size={13} className="animate-spin text-rose-500" />
                          ) : (
                            <Trash2 size={13} />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
