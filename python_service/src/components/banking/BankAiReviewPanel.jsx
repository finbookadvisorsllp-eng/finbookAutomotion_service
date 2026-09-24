import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  FileText, CheckCircle2, AlertCircle, RefreshCw, Check, Search, Filter,
  Eye, Edit3, X, Sparkles, ArrowRight, ShieldCheck, HelpCircle, Layers, Building, ChevronRight, ChevronLeft, Lock, Plus, Trash2,
  SlidersHorizontal, Building2, Sliders, Save, Send, Code, Copy, FileCode
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import bankStatementAiApi from '../../services/bankStatementAiApi';
import { useFundFlowStore } from '../../stores/useFundFlowStore';
import apiClient from '../../lib/apiClient';
import SmartLedgerDropdown, { findBestLedgerMatch } from './SmartLedgerDropdown';

export default function BankAiReviewPanel({ batchData: initialBatchData, onClose, onRefreshList, onNavigateToAddRule }) {
  const [batchData, setBatchData] = useState(initialBatchData);
  const [activeFilter, setActiveFilter] = useState('all'); // all, ready, review_required, already_processed, saved
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [editingItem, setEditingItem] = useState(null); // Item open in Split-Screen Drawer
  const [xmlPreviewItem, setXmlPreviewItem] = useState(null); // Item open in XML Modal
  const [copiedXml, setCopiedXml] = useState(false);
  const [savingLoading, setSavingLoading] = useState(false);
  const [savingSingleItemId, setSavingSingleItemId] = useState(null);
  
  // Pagination state for ultra-fast rendering of large statements
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50); // 25, 50, 100, 'all'
  const fundFlowStore = useFundFlowStore();

  useEffect(() => {
    if (initialBatchData) {
      setBatchData(initialBatchData);
    }
  }, [initialBatchData]);

  useEffect(() => {
    fundFlowStore.fetchMasterData();
  }, []);

  // Compute all available bank ledgers for the dropdown
  const availableBankLedgers = useMemo(() => {
    const list = [
      ...(fundFlowStore.masterData?.cashBankLedgers || []),
      ...((fundFlowStore.masterData?.ledgers || [])
        .filter(l => {
          const grp = (typeof l === 'object' ? (l.group || l.parent || l.parentGroup || '') : '').toLowerCase();
          return grp.includes('bank') && !grp.includes('cash');
        })
        .map(l => (typeof l === 'object' ? (l.ledgerName || l.name || '') : l))),
      'BANK AC', 'Primary Bank Account', 'HDFC Bank', 'ICICI Bank', 'SBI Bank'
    ];
    if (batchData?.bank_ledger) list.unshift(batchData.bank_ledger);
    return Array.from(new Set(list)).filter(Boolean);
  }, [fundFlowStore.masterData, batchData?.bank_ledger]);

  // Dynamic extraction helpers using backend AI-extracted values
  const extractTxType = (narration = '', item = {}) => {
    const raw = (item.channel || item.transactionType || item.paymentMode || item.instType || '').toUpperCase();
    const narr = (narration || item.narration || '').toUpperCase();

    if (raw.includes('UPI') || narr.startsWith('UPI') || narr.includes('/UPI/')) return 'UPI';
    if (raw.includes('CLG') || raw.includes('CLEARING') || narr.startsWith('CLG') || narr.includes('/CLG/')) return 'CLG';
    if (raw.includes('NEFT') || narr.startsWith('NEFT') || narr.includes('NEFT-') || narr.includes('/NEFT/')) return 'NEFT';
    if (raw.includes('INFT') || raw.includes('INF') || narr.includes('INF/INFT') || narr.includes('/INFT/')) return 'INFT';
    if (raw.includes('RTGS') || narr.startsWith('RTGS') || narr.includes('/RTGS/')) return 'RTGS';
    if (raw.includes('IMPS') || narr.startsWith('IMPS') || narr.includes('/IMPS/')) return 'IMPS';
    if (raw.includes('CHEQUE') || raw.includes('CHQ') || narr.includes('CHEQUE') || narr.includes('CHQ')) return 'CLG';
    if (raw && raw.length <= 6) return raw;
    if (item.channel) return item.channel;
    return item.voucherType === 'Payment' ? 'DR TRF' : 'CR TRF';
  };

  const getTxTypeBadgeClass = (txType) => {
    switch ((txType || '').toUpperCase()) {
      case 'UPI':
        return 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800';
      case 'CLG':
        return 'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800';
      case 'NEFT':
        return 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800';
      case 'INFT':
      case 'INF':
        return 'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-800';
      case 'RTGS':
        return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800';
      case 'IMPS':
        return 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    }
  };

  const extractExactValue = (narration = '', item = {}) => {
    // 1. Primary: AI-extracted party from statement processing
    if (item.extractedParty && String(item.extractedParty).trim() && item.extractedParty !== 'Unmapped') {
      return String(item.extractedParty).trim();
    }
    // 2. Secondary: Assigned party ledger (master-matched)
    if (item.partyLedger && String(item.partyLedger).trim() && item.partyLedger !== 'Unmapped') {
      return String(item.partyLedger).trim();
    }
    // 3. Against ledger from backend
    if (item.againstLedger && String(item.againstLedger).trim() && item.againstLedger !== 'Unmapped') {
      return String(item.againstLedger).trim();
    }
    // 4. Clean narration excerpt as last resort
    return narration ? narration.trim().slice(0, 32) : '—';
  };

  // Precompute sorted master ledger lists once with useMemo to avoid 300+ expensive sorting operations on every render
  const allLedgersList = useMemo(() => {
    return Array.from(new Set([
      ...(fundFlowStore.masterData?.allLedgers || []),
      ...(fundFlowStore.masterData?.partyLedgers || []),
      ...((fundFlowStore.masterData?.ledgers || []).map(l => (typeof l === 'string' ? l : (l.ledgerName || l.name || '')))),
    ])).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [fundFlowStore.masterData]);

  const purchaseOptionsList = useMemo(() => {
    const purchaseParties = (fundFlowStore.masterData?.purchasePartyLedgers || []).filter(Boolean);
    if (!purchaseParties.length) return allLedgersList;
    const purchaseSet = new Set(purchaseParties);
    const otherLedgers = allLedgersList.filter(l => !purchaseSet.has(l));
    return [...[...purchaseParties].sort((a, b) => a.localeCompare(b)), ...otherLedgers];
  }, [fundFlowStore.masterData, allLedgersList]);

  const salesOptionsList = useMemo(() => {
    const salesParties = (fundFlowStore.masterData?.salesPartyLedgers || []).filter(Boolean);
    if (!salesParties.length) return allLedgersList;
    const salesSet = new Set(salesParties);
    const otherLedgers = allLedgersList.filter(l => !salesSet.has(l));
    return [...[...salesParties].sort((a, b) => a.localeCompare(b)), ...otherLedgers];
  }, [fundFlowStore.masterData, allLedgersList]);

  const contraOptionsList = useMemo(() => {
    const cashBankParties = (fundFlowStore.masterData?.cashBankLedgers || []).filter(Boolean);
    if (!cashBankParties.length) return allLedgersList;
    const cashBankSet = new Set(cashBankParties);
    const otherLedgers = allLedgersList.filter(l => !cashBankSet.has(l));
    return [...[...cashBankParties].sort((a, b) => a.localeCompare(b)), ...otherLedgers];
  }, [fundFlowStore.masterData, allLedgersList]);

  const getPartyLedgerOptions = (voucherType, currentParty, exactVal = '') => {
    let list = allLedgersList;
    if (voucherType === 'Payment') list = purchaseOptionsList;
    else if (voucherType === 'Receipt') list = salesOptionsList;
    else if (voucherType === 'Contra') list = contraOptionsList;

    const targetAlnum = (exactVal || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const targetWords = (exactVal || '').toLowerCase().match(/[a-z]{3,}/g) || [];

    if (targetAlnum.length >= 3 || targetWords.length > 0) {
      const topMatches = [];
      const others = [];
      const seen = new Set();

      for (const ledger of list) {
        const lNorm = ledger.toLowerCase().replace(/[^a-z0-9]/g, '');
        const lWords = ledger.toLowerCase().match(/[a-z]{3,}/g) || [];
        const isAlnumMatch = targetAlnum && (lNorm.includes(targetAlnum) || targetAlnum.includes(lNorm));
        const hasDistinctWordMatch = targetWords.some(w => 
          lWords.includes(w) && !['ltd', 'pvt', 'limited', 'private', 'transport', 'indore', 'agency'].includes(w)
        );

        if (isAlnumMatch || hasDistinctWordMatch) {
          topMatches.push(ledger);
          seen.add(ledger);
        } else {
          others.push(ledger);
        }
      }
      list = [...topMatches, ...others];
    }

    if (currentParty && !list.includes(currentParty)) {
      return [currentParty, ...list];
    }
    return list;
  };

  const masterLedgers = allLedgersList;

  const items = batchData?.items || [];
  
  // Helper to extract or auto-resolve party ledger from exact extracted candidate against Tally Masters
  const getEffectiveParty = useCallback((item) => {
    if (!item) return '';
    // 1. Use backend-set partyLedger if valid
    if (item.partyLedger && String(item.partyLedger).trim() && item.partyLedger !== 'Unmapped') {
      return String(item.partyLedger).trim();
    }
    // 2. Use backend-set againstLedger as fallback
    if (item.againstLedger && String(item.againstLedger).trim() && item.againstLedger !== 'Unmapped') {
      return String(item.againstLedger).trim();
    }
    // 3. Live-match extractedParty against loaded master ledgers
    const cand = item.extractedParty && String(item.extractedParty).trim();
    if (cand && cand !== '—') {
      // First check if extractedParty IS already a master ledger name (exact or alnum)
      const candLower = cand.toLowerCase();
      const directMatch = allLedgersList.find(l => l.toLowerCase() === candLower);
      if (directMatch) return directMatch;
      // Then fuzzy match
      const bestMatch = findBestLedgerMatch(cand, allLedgersList);
      if (bestMatch && bestMatch.score >= 70 && bestMatch.ledger) {
        return bestMatch.ledger;
      }
    }
    // 4. Try matching a narration excerpt if nothing else works
    const narrationExcerpt = extractExactValue(item.narration, item);
    if (narrationExcerpt && narrationExcerpt !== '—' && narrationExcerpt.length >= 4) {
      const bestMatch = findBestLedgerMatch(narrationExcerpt, allLedgersList);
      if (bestMatch && bestMatch.score >= 80 && bestMatch.ledger) {
        return bestMatch.ledger;
      }
    }
    return '';
  }, [allLedgersList]);

  // Helper to determine effective status based on dynamic confidence score & party ledger
  const getEffectiveStatus = useCallback((item) => {
    if (!item) return 'review_required';
    if (item.status === 'saved' || item.status === 'already_processed' || item.status === 'user_edited') {
      return item.status;
    }
    const effParty = getEffectiveParty(item);
    const hasParty = Boolean(effParty);
    const rawScore = Number(item.confidence) || 0;
    // Cap confidence at 65% when no party is mapped — a rule-only match is incomplete
    const score = hasParty
      ? (rawScore > 0 ? rawScore : 85)
      : Math.min(rawScore > 0 ? rawScore : 45, 65);
    // Only mark as ready when BOTH party is mapped AND confidence >= 90%
    if (score >= 90 && hasParty) {
      return 'ready';
    }
    if (hasParty && item.status === 'ready') {
      return 'ready';
    }
    return 'review_required';
  }, [getEffectiveParty]);

  // Dynamic summary stats synced with effective status
  const dynamicSummary = useMemo(() => {
    let ready_count = 0;
    let review_required_count = 0;
    let already_processed_count = 0;
    let saved_count = 0;
    items.forEach(it => {
      const eff = getEffectiveStatus(it);
      if (eff === 'ready' || eff === 'user_edited') ready_count++;
      else if (eff === 'review_required') review_required_count++;
      else if (eff === 'already_processed') already_processed_count++;
      else if (eff === 'saved') saved_count++;
    });
    return {
      total_count: items.length,
      ready_count,
      review_required_count,
      already_processed_count,
      saved_count
    };
  }, [items, getEffectiveStatus]);

  // Filter items using effective status
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const eff = getEffectiveStatus(item);
      if (activeFilter === 'ready' && eff !== 'ready' && eff !== 'user_edited') return false;
      if (activeFilter === 'review_required' && eff !== 'review_required') return false;
      if (activeFilter === 'already_processed' && eff !== 'already_processed') return false;
      if (activeFilter === 'saved' && eff !== 'saved') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchNarr = (item.narration || '').toLowerCase().includes(q);
        const matchParty = (item.partyLedger || '').toLowerCase().includes(q);
        const matchNum = (item.voucherNumber || '').toLowerCase().includes(q);
        const matchRef = (item.referenceNumber || item.instNumber || '').toLowerCase().includes(q);
        if (!matchNarr && !matchParty && !matchNum && !matchRef) return false;
      }
      return true;
    });
  }, [items, activeFilter, searchQuery]);

  // Reset page when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter, searchQuery]);

  // Paginated slice for instant 60fps rendering
  const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const paginatedItems = useMemo(() => {
    if (pageSize === 'all') return filteredItems;
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  const toggleSelectItem = (itemId) => {
    setSelectedItemIds(prev =>
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
  };

  const toggleSelectAll = (checked) => {
    if (checked) {
      const saveableIds = filteredItems.filter(i => {
        const eff = getEffectiveStatus(i);
        return eff !== 'already_processed' && eff !== 'saved';
      }).map(i => i.item_id);
      setSelectedItemIds(saveableIds);
    } else {
      setSelectedItemIds([]);
    }
  };

  const handleUpdateItemField = async (itemId, field, value) => {
    try {
      const bId = batchData.batch_id || batchData._id;
      const res = await bankStatementAiApi.updateTransaction(bId, itemId, { [field]: value });
      if (res.success && res.data) {
        if (field === 'partyLedger' && res.data.affectedCount && res.data.affectedCount > 1) {
          toast.success(`Mapped "${value}" to ${res.data.affectedCount} transaction(s) across statement without re-upload!`);
          const refreshed = await bankStatementAiApi.getBatchReview(bId);
          if (refreshed?.success && refreshed.data) {
            setBatchData(refreshed.data);
          }
        } else {
          setBatchData(prev => ({
            ...prev,
            items: prev.items.map(i => i.item_id === itemId ? res.data : i)
          }));
        }
        if (editingItem && editingItem.item_id === itemId) {
          setEditingItem(res.data);
        }
      }
    } catch (err) {
      toast.error('Failed to update transaction field');
    }
  };


  const handleSaveSingleVoucher = async (itemId) => {
    if (!itemId) return;
    const bId = batchData.batch_id || batchData._id;
    const targetItem = (batchData.items || []).find(i => i.item_id === itemId);
    const effParty = targetItem ? (targetItem.partyLedger || getEffectiveParty(targetItem)) : '';
    if (targetItem && (!targetItem.partyLedger || targetItem.partyLedger === 'Unmapped') && effParty) {
      try {
        await bankStatementAiApi.updateTransaction(bId, itemId, { partyLedger: effParty });
        targetItem.partyLedger = effParty;
      } catch (e) {}
    }

    setSavingSingleItemId(itemId);
    try {
      const res = await bankStatementAiApi.saveVouchers(bId, [itemId]);
      if (res.success) {
        const savedVch = (res.saved_vouchers && res.saved_vouchers[0]) || null;
        const vchNo = savedVch?.voucherNumber || '';
        toast.success(vchNo ? `Successfully saved voucher #${vchNo}!` : 'Voucher saved successfully!');

        // Optimistically update the local row
        setBatchData((prev) => {
          if (!prev || !prev.items) return prev;
          const newItems = prev.items.map((it) => {
            if (it.item_id === itemId) {
              return {
                ...it,
                partyLedger: effParty || it.partyLedger,
                status: 'saved',
                voucherNumber: vchNo || it.voucherNumber,
                saved_voucher_id: savedVch?._id || it.saved_voucher_id
              };
            }
            return it;
          });
          const savedCnt = newItems.filter((i) => i.status === 'saved').length;
          return {
            ...prev,
            items: newItems,
            summary: {
              ...(prev.summary || {}),
              saved_count: savedCnt
            }
          };
        });

        // Re-fetch latest batch summary in background
        bankStatementAiApi.getBatchReview(bId).then((updated) => {
          if (updated.success) setBatchData(updated.data);
        }).catch(() => {});

        setSelectedItemIds((prev) => prev.filter((id) => id !== itemId));
        if (onRefreshList) onRefreshList();
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error saving accounting voucher');
    } finally {
      setSavingSingleItemId(null);
    }
  };

  const handleSaveSelectedVouchers = async () => {
    if (selectedItemIds.length === 0) {
      toast.error('Please select at least one voucher to save');
      return;
    }
    const bId = batchData.batch_id || batchData._id;
    setSavingLoading(true);
    try {
      for (const id of selectedItemIds) {
        const it = (batchData.items || []).find(i => i.item_id === id);
        const effParty = it ? (it.partyLedger || getEffectiveParty(it)) : '';
        if (it && (!it.partyLedger || it.partyLedger === 'Unmapped') && effParty) {
          try {
            await bankStatementAiApi.updateTransaction(bId, id, { partyLedger: effParty });
          } catch (e) {}
        }
      }
      const res = await bankStatementAiApi.saveVouchers(bId, selectedItemIds);
      if (res.success) {
        toast.success(`Successfully generated ${res.saved_count} accounting vouchers!`);
        // Refresh batch data
        const updatedBatch = await bankStatementAiApi.getBatchReview(bId);
        if (updatedBatch.success) {
          setBatchData(updatedBatch.data);
        }
        setSelectedItemIds([]);
        if (onRefreshList) onRefreshList();
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error saving accounting vouchers');
    } finally {
      setSavingLoading(false);
    }
  };

  // Status Badge: Perfectly color-synchronized with Confidence score
  const getStatusBadge = (itemOrStatus, maybeConfidence, maybeParty) => {
    if (!itemOrStatus) return null;
    const item = typeof itemOrStatus === 'object' && itemOrStatus !== null ? {
      ...itemOrStatus,
      confidence: itemOrStatus.confidence ?? maybeConfidence,
      partyLedger: itemOrStatus.partyLedger || maybeParty
    } : {
      status: itemOrStatus,
      confidence: maybeConfidence,
      partyLedger: maybeParty
    };
    const status = item.status;
    if (status === 'saved') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 flex items-center justify-center gap-1">
          <CheckCircle2 size={10} /> SAVED
        </span>
      );
    }
    if (status === 'user_edited' || status === 'user_verified') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-300 dark:border-blue-800 flex items-center justify-center gap-1">
          <Edit3 size={10} /> USER VERIFIED
        </span>
      );
    }
    if (status === 'already_processed') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-300 dark:border-rose-800 flex items-center justify-center gap-1">
          <Lock size={10} /> DUPLICATE
        </span>
      );
    }

    const effStatus = getEffectiveStatus(item);
    const score = Number(item.confidence) || Number(maybeConfidence) || 0;
    const reasonText = item.review_reason || item.user_reasoning || 'Review required';

    // Green: >= 90% and Mapped -> Ready
    if (effStatus === 'ready') {
      return (
        <span
          title={reasonText}
          className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 flex items-center justify-center gap-1"
        >
          <Check size={10} /> READY
        </span>
      );
    }

    // Orange: 60% to 89% -> Review Required
    if (score >= 60) {
      return (
        <span
          title={reasonText}
          className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-300 dark:border-amber-800 flex items-center justify-center gap-1 cursor-help"
        >
          <AlertCircle size={10} /> REVIEW REQUIRED
        </span>
      );
    }

    // Red: < 60% (e.g. 45%) -> Review Required
    return (
      <span
        title={reasonText}
        className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-300 dark:border-rose-800 flex items-center justify-center gap-1 cursor-help"
      >
        <AlertCircle size={10} /> REVIEW REQUIRED
      </span>
    );
  };

  // Confidence Score Badge: Green (>=90%), Orange (60-89%), Red (<60%)
  const getConfidenceBadge = (confidence) => {
    const score = Number(confidence) || 0;
    if (score >= 90) {
      return (
        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full font-mono text-[10px] font-black bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
          {score}%
        </span>
      );
    }
    if (score >= 60) {
      return (
        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full font-mono text-[10px] font-black bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
          {score}%
        </span>
      );
    }
    return (
      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full font-mono text-[10px] font-black bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-300 dark:border-rose-800">
        {score}%
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-3 h-full overflow-hidden bg-[var(--app-panel-bg)] rounded-xl border p-3.5" style={{ borderColor: 'var(--app-border)' }}>
      
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b shrink-0" style={{ borderColor: 'var(--app-border)' }}>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shrink-0">
            <Sparkles size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-[16px] font-black text-[var(--app-heading)] tracking-tight">
                AI Bank Statement & Master Mapping Review
              </h1>
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-indigo-500/10 border border-indigo-500/25 text-indigo-600 font-black text-[11px]">
                <Building2 size={13} />
                <span className="text-[var(--app-muted)] font-bold uppercase text-[9.5px]">Selected Bank Ledger:</span>
                <span className="text-[var(--app-heading)] font-black">{batchData.bank_ledger}</span>
              </div>
            </div>
            <p className="text-[11px] font-medium text-[var(--app-muted)] mt-0.5">
              Statement: <span className="font-bold text-[var(--app-heading)]">{batchData.file_name}</span> | Bank Ledger: <span className="font-bold text-indigo-600">{batchData.bank_ledger}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onNavigateToAddRule && (
            <button
              onClick={onNavigateToAddRule}
              className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-[11px] font-bold uppercase tracking-wider text-[#2563EB] border-[#2563EB]/30 hover:bg-[#2563EB]/5 transition-all cursor-pointer"
            >
              <Sliders size={13} />
              <span>Bank Mapping</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="px-3 py-1.5 border rounded-lg text-[11px] font-bold uppercase tracking-wider hover:bg-[var(--app-control-hover)] transition-all cursor-pointer"
            style={{ borderColor: 'var(--app-border)', color: 'var(--app-muted)' }}
          >
            ← Back to Bank
          </button>
          <button
            onClick={async () => {
              if (!window.confirm(`Are you sure you want to delete "${batchData.file_name}"? All extracted drafts will be removed.`)) {
                return;
              }
              try {
                const res = await bankStatementAiApi.deleteBatch(batchData.batch_id || batchData._id);
                if (res?.success) {
                  toast.success(`Deleted statement "${batchData.file_name}" successfully`);
                  onClose?.();
                } else {
                  toast.error(res?.message || 'Failed to delete statement');
                }
              } catch (err) {
                toast.error(err?.response?.data?.detail || 'Failed to delete statement');
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-rose-500/30 rounded-lg text-[11px] font-bold uppercase tracking-wider text-rose-500 hover:bg-rose-500 hover:text-white transition-all cursor-pointer"
          >
            <Trash2 size={13} />
            <span>Delete</span>
          </button>
          <button
            onClick={handleSaveSelectedVouchers}
            disabled={selectedItemIds.length === 0 || savingLoading}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider bg-[var(--app-accent)] text-white shadow-md hover:opacity-90 transition-all disabled:opacity-50 cursor-pointer"
          >
            {savingLoading ? <RefreshCw className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
            <span>Approve & Save Vouchers ({selectedItemIds.length})</span>
          </button>
          <button
            onClick={() => {
              if (selectedItemIds.length === 0) {
                toast.error('Please select at least one voucher to push to Tally');
                return;
              }
              toast.info(`Ready to Push ${selectedItemIds.length} vouchers to Tally!`);
            }}
            disabled={selectedItemIds.length === 0}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md hover:opacity-90 transition-all disabled:opacity-50 cursor-pointer"
            title="Push selected vouchers to Tally"
          >
            <Send size={13} />
            <span>Push to Tally ({selectedItemIds.length})</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 shrink-0">
        {[
          { id: 'all', label: 'Total Statement Items', count: dynamicSummary.total_count, color: 'text-[var(--app-heading)]' },
          { id: 'ready', label: 'Mapped & Ready', count: dynamicSummary.ready_count, color: 'text-emerald-500' },
          { id: 'review_required', label: 'Review Required', count: dynamicSummary.review_required_count, color: 'text-amber-500' },
          { id: 'already_processed', label: 'Duplicates', count: dynamicSummary.already_processed_count, color: 'text-rose-500' },
          { id: 'saved', label: 'Saved Vouchers', count: dynamicSummary.saved_count, color: 'text-purple-500' }
        ].map(kpi => (
          <button
            key={kpi.id}
            onClick={() => setActiveFilter(kpi.id)}
            className={`p-2.5 rounded-xl border transition-all text-left cursor-pointer ${
              activeFilter === kpi.id ? 'ring-2 ring-[var(--app-accent)] bg-[var(--app-control-bg)]' : 'bg-[var(--app-panel-bg)] hover:bg-[var(--app-control-hover)]'
            }`}
            style={{ borderColor: 'var(--app-border)' }}
          >
            <span className="text-[9px] font-bold text-[var(--app-muted)] uppercase tracking-wider block truncate">{kpi.label}</span>
            <span className={`text-[17px] font-black mt-0.5 block ${kpi.color}`}>{kpi.count}</span>
          </button>
        ))}
      </div>

      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 rounded-xl border bg-[var(--app-control-bg)] shrink-0" style={{ borderColor: 'var(--app-border)' }}>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer font-extrabold text-[11px] text-[var(--app-heading)]">
            <input
              type="checkbox"
              onChange={(e) => toggleSelectAll(e.target.checked)}
              checked={selectedItemIds.length > 0 && selectedItemIds.length === filteredItems.filter(i => i.status !== 'already_processed' && i.status !== 'saved').length}
              className="w-4 h-4 rounded accent-[var(--app-accent)]"
            />
            Select All Eligible ({filteredItems.filter(i => i.status !== 'already_processed' && i.status !== 'saved').length})
          </label>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative min-w-[240px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--app-muted)]" size={13} />
            <input
              type="text"
              placeholder="Search narration, master, reference..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-3 border rounded-lg text-[11px] font-semibold outline-none focus:border-[var(--app-accent)] bg-[var(--app-panel-bg)]"
              style={{ borderColor: 'var(--app-border)', color: 'var(--app-heading)' }}
            />
          </div>

          <button
            onClick={() => {
              if (onNavigateToAddRule) {
                onNavigateToAddRule();
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors cursor-pointer shadow-xs"
            title="Open Bank Pattern & Party Ledger Mapping Engine"
          >
            <SlidersHorizontal size={13} />
            <span>Add Rule</span>
          </button>
        </div>
      </div>

      {/* Main Review Table matching Manual Entry Form Layout */}
      <div className="flex-1 overflow-auto border rounded-xl" style={{ borderColor: 'var(--app-border)' }}>
        <table className="w-full text-left border-collapse text-[11px] min-w-[1150px]">
          <thead className="sticky top-0 bg-[var(--app-control-bg)] z-10 border-b" style={{ borderColor: 'var(--app-border)' }}>
            <tr>
              <th className="py-2.5 px-2 w-14 text-center font-black text-[var(--app-muted)] uppercase tracking-wider text-[10px]">SR #</th>
              <th className="py-2.5 px-2 font-black text-[var(--app-muted)] uppercase tracking-wider w-26 text-[10px]">Voucher Date</th>
              <th className="py-2.5 px-2 font-black text-[var(--app-muted)] uppercase tracking-wider w-28 text-[10px]">Voucher Type</th>
              <th className="py-2.5 px-2 font-black text-[var(--app-muted)] uppercase tracking-wider w-20 text-center text-[10px]">Transaction Type</th>
              <th className="py-2.5 px-2 font-black text-[var(--app-muted)] uppercase tracking-wider w-40 text-[10px]">Exact Extracted Value</th>
              <th className="py-2.5 px-2 font-black text-[var(--app-muted)] uppercase tracking-wider w-60 text-[10px]">Party / Ledger Name</th>
              <th className="py-2.5 px-2 font-black text-[var(--app-muted)] uppercase tracking-wider text-[10px]">Description / Narration</th>
              <th className="py-2.5 px-2 font-black text-[var(--app-muted)] uppercase tracking-wider text-right w-28 text-[10px]">Amount (₹)</th>
              <th className="py-2.5 px-2 font-black text-[var(--app-muted)] uppercase tracking-wider w-26 text-[10px]">Reference No.</th>
              <th className="py-2.5 px-2 font-black text-[var(--app-muted)] uppercase tracking-wider text-center w-20 text-[10px]">Confidence</th>
              <th className="py-2.5 px-2 font-black text-[var(--app-muted)] uppercase tracking-wider text-center w-28 text-[10px]">Status</th>
              <th className="py-2.5 px-2 font-black text-[var(--app-muted)] uppercase tracking-wider text-center w-20 text-[10px]">Action</th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.length > 0 ? (
              paginatedItems.map((item, idx) => {
                const isSelected = selectedItemIds.includes(item.item_id);
                const canSelect = item.status !== 'already_processed' && item.status !== 'saved';
                // effParty: prefer backend-mapped partyLedger, then againstLedger, then live-resolve extractedParty against master
                const rawParty = item.partyLedger || item.againstLedger || '';
                const hasValidParty = rawParty && rawParty !== 'Unmapped' && rawParty.trim();
                const effParty = hasValidParty
                  ? rawParty.trim()
                  : getEffectiveParty(item);
                const hasMaster = Boolean(effParty);
                // effConfidence: If no party ledger is mapped, cap at 65% max to reflect incomplete matching.
                // If party is resolved, use the backend confidence (but fall back to 85 if not provided).
                const rawConf = Number(item.confidence) || 0;
                const effConfidence = hasMaster
                  ? (rawConf > 0 ? rawConf : 85)
                  : Math.min(rawConf > 0 ? rawConf : 45, 65);
                const isOutflow = item.voucherType === 'Payment' || (item.debit > 0 && !item.credit);
                const isReceipt = item.voucherType === 'Receipt' || (item.credit > 0 && !item.debit);
                const rowNumber = pageSize === 'all' ? idx + 1 : (currentPage - 1) * pageSize + idx + 1;
                const txType = extractTxType(item.narration, item);
                const vDate = item.voucherDate || item.date || '';

                return (
                  <tr
                    key={item.item_id}
                    className={`border-b last:border-0 transition-colors hover:bg-[var(--app-content-bg)]/60 ${
                      isSelected ? 'bg-[var(--app-accent-soft)]/20' : ''
                    } ${!hasMaster && item.status === 'review_required' ? 'bg-amber-500/5' : ''}`}
                    style={{ borderColor: 'var(--app-border)' }}
                  >
                    {/* 1. SR # with Checkbox combined */}
                    <td className="py-2 px-2 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={!canSelect}
                          onChange={() => toggleSelectItem(item.item_id)}
                          className="w-3.5 h-3.5 rounded accent-[var(--app-accent)] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        />
                        <span className="text-[11px] font-mono text-[var(--app-muted)] font-bold">
                          {rowNumber}
                        </span>
                      </div>
                    </td>

                    {/* 2. Voucher Date */}
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        value={vDate}
                        onChange={(e) => {
                          handleUpdateItemField(item.item_id, 'date', e.target.value);
                          handleUpdateItemField(item.item_id, 'voucherDate', e.target.value);
                        }}
                        className="w-full h-7 px-1.5 border rounded text-[11px] font-mono font-bold bg-[var(--app-panel-bg)] text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] text-center"
                        style={{ borderColor: 'var(--app-border)' }}
                      />
                    </td>

                    {/* 3. Voucher Type */}
                    <td className="py-2 px-2">
                      <select
                        value={item.voucherType || (item.credit > 0 ? 'Receipt' : 'Payment')}
                        onChange={(e) => handleUpdateItemField(item.item_id, 'voucherType', e.target.value)}
                        className={`w-full h-7 px-1.5 border rounded text-[10.5px] font-black outline-none focus:border-[var(--app-accent)] cursor-pointer ${
                          isReceipt
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800'
                            : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border-rose-300 dark:border-rose-800'
                        }`}
                      >
                        <option value="Receipt">Receipt (Inflow)</option>
                        <option value="Payment">Payment (Outflow)</option>
                        <option value="Contra">Contra (Bank Transfer)</option>
                      </select>
                    </td>

                    {/* 4. Transaction Type */}
                    <td className="py-2 px-2 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${getTxTypeBadgeClass(txType)}`}>
                        {txType}
                      </span>
                    </td>

                    {/* 5. Exact Extracted Value */}
                    <td className="py-2 px-2">
                      <div className="max-w-[160px]" title={extractExactValue(item.narration, item)}>
                        <span className="font-mono text-[10.5px] font-bold text-indigo-700 dark:text-indigo-300 truncate block bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                          {extractExactValue(item.narration, item)}
                        </span>
                      </div>
                    </td>

                    {/* 6. Party / Ledger Name */}
                    <td className="py-2 px-2">
                      <div className="min-w-[210px] max-w-[260px]">
                        <SmartLedgerDropdown
                          value={effParty || ''}
                          onChange={(newVal) => handleUpdateItemField(item.item_id, 'partyLedger', newVal)}
                          options={getPartyLedgerOptions(item.voucherType, effParty, item.extractedParty || extractExactValue(item.narration, item))}
                          extractedParty={item.extractedParty || extractExactValue(item.narration, item)}
                          narration={item.narration}
                          voucherType={item.voucherType}
                          confidence={effConfidence}
                          reviewReason={!hasMaster ? (item.review_reason || 'No approved rule or unambiguous ledger...') : ''}
                          onAddRule={onNavigateToAddRule}
                          placeholder="-- Select Master Party Ledger --"
                        />
                      </div>
                    </td>

                    {/* 7. Description / Narration */}
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        readOnly
                        value={item.narration || ''}
                        onKeyDown={(e) => {
                          const allowedKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Tab'];
                          if (allowedKeys.includes(e.key) || ((e.ctrlKey || e.metaKey) && ['c', 'a', 'C', 'A'].includes(e.key))) {
                            return;
                          }
                          e.preventDefault();
                        }}
                        className="w-full h-7 px-2 border rounded text-[10.5px] font-medium bg-[var(--app-panel-bg)] text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] cursor-text truncate"
                        style={{ borderColor: 'var(--app-border)' }}
                        title={item.narration}
                      />
                    </td>

                    {/* 8. Amount (₹) */}
                    <td className="py-2 px-2 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <span className={`px-1 py-0.5 rounded text-[9px] font-black uppercase shrink-0 border ${
                          isReceipt
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
                            : 'bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800'
                        }`}>
                          {isReceipt ? 'CR' : 'DR'}
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          value={item.amount || item.credit || item.debit || ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            handleUpdateItemField(item.item_id, 'amount', val);
                            if (isReceipt) handleUpdateItemField(item.item_id, 'credit', val);
                            else handleUpdateItemField(item.item_id, 'debit', val);
                          }}
                          className={`w-20 h-7 px-1.5 border rounded text-[11px] font-mono font-bold text-right outline-none focus:border-[var(--app-accent)] ${
                            isReceipt ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-200'
                          }`}
                          style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-panel-bg)' }}
                        />
                      </div>
                    </td>

                    {/* 9. Reference No. */}
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        value={item.referenceNumber || item.instNumber || ''}
                        onChange={(e) => {
                          handleUpdateItemField(item.item_id, 'referenceNumber', e.target.value);
                          handleUpdateItemField(item.item_id, 'instNumber', e.target.value);
                        }}
                        className="w-full h-7 px-2 border rounded text-[10.5px] font-mono font-medium bg-[var(--app-panel-bg)] text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] truncate"
                        style={{ borderColor: 'var(--app-border)' }}
                        placeholder="Ref/UTR"
                      />
                    </td>

                    {/* 10. Confidence */}
                    <td className="py-2 px-2 text-center">
                      {getConfidenceBadge(effConfidence)}
                    </td>

                    {/* 11. Status */}
                    <td className="py-2 px-2 text-center">
                      {getStatusBadge(item, effConfidence, effParty)}
                    </td>

                    {/* 12. Actions: Save + Eye Icon buttons */}
                    <td className="py-2 px-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {/* Per-row Save button — visible only for non-saved, non-duplicate items */}
                        {item.status !== 'saved' && item.status !== 'already_processed' && (
                          <button
                            onClick={() => handleSaveSingleVoucher(item.item_id)}
                            disabled={savingSingleItemId === item.item_id || !effParty}
                            title={!effParty ? 'Map a party ledger first to save' : 'Save this voucher to MongoDB'}
                            className="w-6 h-6 rounded-full flex items-center justify-center border border-emerald-400 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 transition-colors mx-auto cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {savingSingleItemId === item.item_id
                              ? <RefreshCw size={10} className="animate-spin" />
                              : <Save size={10} />}
                          </button>
                        )}
                        <button
                          onClick={() => setEditingItem(item)}
                          className="w-6 h-6 rounded-full flex items-center justify-center border border-sky-300 bg-sky-50 text-sky-600 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-400 transition-colors mx-auto cursor-pointer"
                          title="View Full Context"
                        >
                          <Eye size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={12} className="py-12 text-center text-[var(--app-muted)] font-semibold italic">
                  No statement items match the selected filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Table Pagination Bar */}
      {filteredItems.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 border rounded-xl bg-[var(--app-control-bg)] shrink-0 text-[11px]" style={{ borderColor: 'var(--app-border)' }}>
          <div className="flex items-center gap-2 text-[var(--app-muted)] font-semibold">
            <span>
              Showing <strong className="text-[var(--app-heading)] font-black">
                {pageSize === 'all' ? 1 : (currentPage - 1) * pageSize + 1}
              </strong> to <strong className="text-[var(--app-heading)] font-black">
                {pageSize === 'all' ? filteredItems.length : Math.min(currentPage * pageSize, filteredItems.length)}
              </strong> of <strong className="text-[var(--app-heading)] font-black">{filteredItems.length}</strong> items
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Rows Per Page */}
            <div className="flex items-center gap-1.5 font-bold text-[var(--app-muted)]">
              <span>Rows:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  const v = e.target.value === 'all' ? 'all' : Number(e.target.value);
                  setPageSize(v);
                  setCurrentPage(1);
                }}
                className="h-6 px-1.5 rounded border text-[11px] font-bold bg-[var(--app-panel-bg)] text-[var(--app-heading)] outline-none cursor-pointer"
                style={{ borderColor: 'var(--app-border)' }}
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value="all">All ({filteredItems.length})</option>
              </select>
            </div>

            {/* Page Navigation */}
            {pageSize !== 'all' && totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1 rounded border hover:bg-[var(--app-control-hover)] disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                  style={{ borderColor: 'var(--app-border)' }}
                  title="Previous Page"
                >
                  <ChevronLeft size={13} />
                </button>
                <span className="px-2 font-bold text-[var(--app-heading)] text-[10.5px]">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1 rounded border hover:bg-[var(--app-control-hover)] disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                  style={{ borderColor: 'var(--app-border)' }}
                  title="Next Page"
                >
                  <ChevronRight size={13} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}


      {/* Split-Screen Review Detail Modal / Drawer */}
      <AnimatePresence>
        {editingItem && (
          <div className="fixed inset-0 z-[500] flex items-center justify-end p-4 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setEditingItem(null)} />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="relative w-full max-w-5xl h-[92vh] bg-[var(--app-panel-bg)] border border-[var(--app-border)] rounded-2xl shadow-2xl overflow-hidden flex flex-col z-10"
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between p-4 border-b shrink-0 bg-[var(--app-control-bg)]" style={{ borderColor: 'var(--app-border)' }}>
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-[var(--app-accent)] text-white">
                    <Eye size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-[var(--app-heading)] uppercase tracking-tight">
                      Voucher Review & Split-Screen Preview
                    </h3>
                    <p className="text-[10px] text-[var(--app-muted)] font-bold">
                      Item ID: {editingItem.item_id.slice(0, 8)} | Source Document: {editingItem.source_document}
                    </p>
                  </div>
                </div>

                <button onClick={() => setEditingItem(null)} className="p-1.5 rounded-lg text-[var(--app-muted)] hover:text-[var(--app-heading)] hover:bg-[var(--app-control-hover)]">
                  <X size={18} />
                </button>
              </div>

              {/* Split Screen Body */}
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 overflow-hidden divider-x">
                
                {/* LEFT SIDE: Original Bank Statement Document Context */}
                <div className="p-5 overflow-y-auto space-y-4 bg-[var(--app-content-bg)]/30 border-r" style={{ borderColor: 'var(--app-border)' }}>
                  <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--app-border)' }}>
                    <h4 className="text-[11px] font-black uppercase text-[var(--app-accent)] tracking-wider flex items-center gap-1.5">
                      <FileText size={14} /> Original Bank Statement Entry
                    </h4>
                    <span className="text-[10px] font-bold text-[var(--app-muted)] font-mono">Original Document Context</span>
                  </div>

                  <div className="space-y-3">
                    <div className="p-3.5 rounded-xl border bg-[var(--app-panel-bg)] space-y-2 shadow-xs" style={{ borderColor: 'var(--app-border)' }}>
                      <span className="text-[9px] font-bold text-[var(--app-muted)] uppercase tracking-wider block">Statement Narration / Description</span>
                      <p className="text-[12px] font-bold text-[var(--app-heading)] leading-snug break-words">
                        "{editingItem.narration}"
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl border bg-[var(--app-panel-bg)] space-y-1 shadow-xs" style={{ borderColor: 'var(--app-border)' }}>
                        <span className="text-[9px] font-bold text-[var(--app-muted)] uppercase tracking-wider">Statement Date</span>
                        <div className="text-[13px] font-extrabold text-[var(--app-heading)]">{editingItem.voucherDate}</div>
                      </div>
                      <div className="p-3 rounded-xl border bg-[var(--app-panel-bg)] space-y-1 shadow-xs" style={{ borderColor: 'var(--app-border)' }}>
                        <span className="text-[9px] font-bold text-[var(--app-muted)] uppercase tracking-wider">Extracted Amount</span>
                        <div className={`text-[13px] font-extrabold ${editingItem.voucherType === 'Receipt' ? 'text-emerald-500' : 'text-rose-500'}`}>
                          ₹ {(editingItem.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl border bg-[var(--app-panel-bg)] space-y-1 shadow-xs" style={{ borderColor: 'var(--app-border)' }}>
                      <span className="text-[9px] font-bold text-[var(--app-muted)] uppercase tracking-wider">Reference / UTR / Cheque No.</span>
                      <div className="text-[12px] font-bold font-mono text-[var(--app-heading)]">{editingItem.referenceNumber || editingItem.instNumber || '—'}</div>
                    </div>

                    {/* AI Explanation Card */}
                    <div className="p-3.5 rounded-xl border bg-indigo-500/10 border-indigo-500/20 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-indigo-500 flex items-center gap-1">
                          <Sparkles size={12} /> AI Classification Reasoning
                        </span>
                        {getConfidenceBadge(editingItem.confidence)}
                      </div>
                      <p className="text-[11px] font-semibold text-[var(--app-heading)] leading-snug">
                        {editingItem.user_reasoning || 'AI matched transaction narration against active company master ledgers.'}
                      </p>
                      <div className="text-[9.5px] font-bold text-[var(--app-muted)] mt-1">
                        Review Note: {editingItem.review_reason}
                      </div>
                    </div>
                  </div>
                </div>

                {/* RIGHT SIDE: Accounting Voucher Preview matching Manual Voucher Entry fields */}
                <div className="p-5 overflow-y-auto space-y-4 bg-[var(--app-panel-bg)]">
                  <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--app-border)' }}>
                    <h4 className="text-[11px] font-black uppercase text-[var(--app-accent)] tracking-wider flex items-center gap-1.5">
                      <Layers size={14} /> Accounting Voucher Entry Preview
                    </h4>
                    <span className="px-2 py-0.5 rounded text-[9.5px] font-extrabold uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      Draft Voucher
                    </span>
                  </div>

                  {/* Manual Voucher Entry Form Field Mapping */}
                  <div className="space-y-3.5">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[9.5px] font-bold text-[var(--app-muted)] uppercase tracking-wider block mb-1">Voucher Type</label>
                        <select
                          value={editingItem.voucherType}
                          onChange={(e) => handleUpdateItemField(editingItem.item_id, 'voucherType', e.target.value)}
                          className="w-full h-9 px-3 border rounded-xl text-[12px] font-bold outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[var(--app-accent)]"
                          style={{ borderColor: 'var(--app-border)' }}
                        >
                          <option value="Receipt">Receipt Voucher (Money In)</option>
                          <option value="Payment">Payment Voucher (Money Out)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[9.5px] font-bold text-[var(--app-muted)] uppercase tracking-wider block mb-1">Voucher Date</label>
                        <input
                          type="text"
                          value={editingItem.voucherDate}
                          onChange={(e) => handleUpdateItemField(editingItem.item_id, 'voucherDate', e.target.value)}
                          className="w-full h-9 px-3 border rounded-xl text-[12px] font-bold outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[var(--app-accent)] font-mono"
                          style={{ borderColor: 'var(--app-border)' }}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[9.5px] font-bold text-[var(--app-muted)] uppercase tracking-wider block mb-1">Bank Ledger (Dr/Cr Account)</label>
                      <input
                        type="text"
                        disabled
                        value={editingItem.bankLedger}
                        className="w-full h-9 px-3 border rounded-xl text-[12px] font-bold bg-[var(--app-control-bg)] text-[var(--app-heading)] cursor-not-allowed opacity-80"
                        style={{ borderColor: 'var(--app-border)' }}
                      />
                    </div>

                    <div>
                      <label className="text-[9.5px] font-bold text-[var(--app-muted)] uppercase tracking-wider block mb-1">Counterpart Party / Ledger</label>
                      <SmartLedgerDropdown
                        value={editingItem.partyLedger || getEffectiveParty(editingItem) || ''}
                        onChange={(newVal) => handleUpdateItemField(editingItem.item_id, 'partyLedger', newVal)}
                        options={getPartyLedgerOptions(editingItem.voucherType, editingItem.partyLedger || getEffectiveParty(editingItem), extractExactValue(editingItem.narration, editingItem))}
                        extractedParty={extractExactValue(editingItem.narration, editingItem)}
                        narration={editingItem.narration}
                        voucherType={editingItem.voucherType}
                        confidence={editingItem.confidence || (getEffectiveParty(editingItem) ? 98 : 45)}
                        reviewReason={editingItem.partyLedger || getEffectiveParty(editingItem) ? '' : editingItem.review_reason}
                        onAddRule={onNavigateToAddRule}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[9.5px] font-bold text-[var(--app-muted)] uppercase tracking-wider block mb-1">Transaction Amount (₹)</label>
                        <input
                          type="number"
                          value={editingItem.amount}
                          onChange={(e) => handleUpdateItemField(editingItem.item_id, 'amount', parseFloat(e.target.value) || 0)}
                          className="w-full h-9 px-3 border rounded-xl text-[12px] font-bold outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[var(--app-accent)] font-mono"
                          style={{ borderColor: 'var(--app-border)' }}
                        />
                      </div>

                      <div>
                        <label className="text-[9.5px] font-bold text-[var(--app-muted)] uppercase tracking-wider block mb-1">Payment Mode</label>
                        <select
                          value={editingItem.paymentMode || 'NEFT'}
                          onChange={(e) => handleUpdateItemField(editingItem.item_id, 'paymentMode', e.target.value)}
                          className="w-full h-9 px-3 border rounded-xl text-[12px] font-bold outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[var(--app-accent)]"
                          style={{ borderColor: 'var(--app-border)' }}
                        >
                          <option value="NEFT">NEFT</option>
                          <option value="RTGS">RTGS</option>
                          <option value="UPI">UPI</option>
                          <option value="IMPS">IMPS</option>
                          <option value="Cheque">Cheque</option>
                          <option value="Bank Transfer">Bank Transfer</option>
                        </select>
                      </div>
                    </div>

                    {/* Accounting Entry Box */}
                    <div className="p-3.5 rounded-xl border bg-[var(--app-control-bg)] space-y-2" style={{ borderColor: 'var(--app-border)' }}>
                      <span className="text-[9px] font-black uppercase text-[var(--app-accent)] tracking-wider block">Generated Accounting Entry</span>
                      {editingItem.voucherType === 'Receipt' ? (
                        <div className="space-y-1 font-mono text-[11px] font-bold">
                          <div className="flex justify-between text-emerald-600">
                            <span>Dr. {editingItem.bankLedger}</span>
                            <span>₹ {(editingItem.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between pl-4 text-emerald-700">
                            <span>To {editingItem.partyLedger || '[Counterpart Ledger]'}</span>
                            <span>₹ {(editingItem.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1 font-mono text-[11px] font-bold">
                          <div className="flex justify-between text-rose-600">
                            <span>Dr. {editingItem.partyLedger || '[Counterpart Ledger]'}</span>
                            <span>₹ {(editingItem.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between pl-4 text-rose-700">
                            <span>To {editingItem.bankLedger}</span>
                            <span>₹ {(editingItem.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Bank Allocations Breakdown */}
                    <div className="p-3.5 rounded-xl border bg-[var(--app-control-bg)] space-y-2" style={{ borderColor: 'var(--app-border)' }}>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase text-indigo-500 tracking-wider flex items-center gap-1">
                          <Building size={11} /> Bank Allocation (&lt;BANKALLOCATIONS.LIST&gt;)
                        </span>
                        <span className="text-[9px] font-bold text-[var(--app-muted)]">Verified Format</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10.5px]">
                        <div>
                          <span className="text-[9px] text-[var(--app-muted)] font-semibold block">Transaction Type:</span>
                          <span className="font-bold text-[var(--app-heading)]">
                            {editingItem.bankAllocations?.[0]?.transactionType || editingItem.transactionType || 'Inter Bank Transfer'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] text-[var(--app-muted)] font-semibold block">Instrument / UTR:</span>
                          <span className="font-bold font-mono text-[var(--app-heading)]">
                            {editingItem.bankAllocations?.[0]?.instrumentNumber || editingItem.referenceNumber || '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] text-[var(--app-muted)] font-semibold block">Instrument Date:</span>
                          <span className="font-bold font-mono text-[var(--app-heading)]">
                            {editingItem.bankAllocations?.[0]?.instrumentDate || editingItem.voucherDate?.replace(/-/g, '') || '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] text-[var(--app-muted)] font-semibold block">Signed Amount:</span>
                          <span className="font-bold font-mono text-[var(--app-heading)]">
                            ₹ {Math.abs(editingItem.bankAllocations?.[0]?.amount || editingItem.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            {' '}({editingItem.voucherType === 'Receipt' ? 'Dr / Negative' : 'Cr / Positive'})
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bill Allocations Breakdown */}
                    <div className="p-3.5 rounded-xl border bg-[var(--app-control-bg)] space-y-2" style={{ borderColor: 'var(--app-border)' }}>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase text-teal-600 tracking-wider flex items-center gap-1">
                          <FileText size={11} /> Bill Allocation (&lt;BILLALLOCATIONS.LIST&gt;)
                        </span>
                        <span className="text-[9px] font-bold text-[var(--app-muted)]">
                          {editingItem.billAllocations?.length ? `${editingItem.billAllocations.length} Allocation(s)` : 'On Account'}
                        </span>
                      </div>

                      {editingItem.billAllocations && editingItem.billAllocations.length > 0 ? (
                        <div className="space-y-1.5 max-h-36 overflow-y-auto">
                          {editingItem.billAllocations.map((bill, bIdx) => (
                            <div key={bIdx} className="flex items-center justify-between p-2 rounded-lg border bg-[var(--app-panel-bg)] text-[10.5px]" style={{ borderColor: 'var(--app-border)' }}>
                              <div>
                                <span className="font-bold font-mono text-[var(--app-heading)]">{bill.name || bill.billNo || 'On Account'}</span>
                                <span className="ml-2 px-1.5 py-0.5 rounded text-[8.5px] font-extrabold uppercase bg-teal-500/10 text-teal-600 border border-teal-500/20">
                                  {bill.billType || 'Agst Ref'}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="font-bold font-mono text-[var(--app-heading)]">
                                  ₹ {(bill.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </span>
                                {bill.pendingAmount !== undefined && (
                                  <div className="text-[8.5px] text-[var(--app-muted)]">
                                    Open: ₹{bill.pendingAmount}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-2.5 rounded-lg border border-dashed border-amber-500/30 bg-amber-500/5 text-[10.5px] text-amber-700">
                          <span className="font-bold">Allocated as "On Account"</span> (no matching open invoice found; avoids fake invoice numbers).
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 flex items-center justify-between">
                    <button
                      onClick={() => setXmlPreviewItem(editingItem)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-indigo-500/30 text-indigo-600 hover:bg-indigo-500/10 transition-all cursor-pointer"
                    >
                      <Code size={14} />
                      <span>Inspect Tally XML</span>
                    </button>
                    <button
                      onClick={() => setEditingItem(null)}
                      className="px-6 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-[var(--app-accent)] text-white shadow-md hover:opacity-90 transition-all cursor-pointer"
                    >
                      Done Editing
                    </button>
                  </div>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Tally XML Preview Modal */}
      <AnimatePresence>
        {xmlPreviewItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-4xl max-h-[90vh] bg-[#0f172a] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-100"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-900/80">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-indigo-600 text-white">
                    <Code size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-2">
                      <span>Tally XML Voucher Preview</span>
                      <span className="px-2 py-0.5 rounded text-[9.5px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        {xmlPreviewItem.voucherType || 'Receipt'} #{xmlPreviewItem.voucherNumber || 'AUTO'}
                      </span>
                    </h3>
                    <p className="text-[10.5px] text-slate-400 font-medium mt-0.5">
                      Company: <strong className="text-slate-200">{batchData?.bank_ledger || 'Selected Bank'}</strong> | Amount: <strong className="text-emerald-400">₹{(xmlPreviewItem.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const xml = xmlPreviewItem.tallyXml || xmlPreviewItem.tally_xml || '';
                      if (xml) {
                        navigator.clipboard.writeText(xml);
                        setCopiedXml(true);
                        toast.success('Tally XML copied to clipboard');
                        setTimeout(() => setCopiedXml(false), 2500);
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 transition-all cursor-pointer"
                  >
                    {copiedXml ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    <span>{copiedXml ? 'Copied!' : 'Copy XML'}</span>
                  </button>
                  <button
                    onClick={() => setXmlPreviewItem(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* XML Content Body */}
              <div className="flex-1 p-4 overflow-auto bg-[#090d16]">
                <pre className="text-[11.5px] font-mono text-emerald-300 leading-relaxed whitespace-pre font-medium selection:bg-indigo-500 selection:text-white">
                  <code>{xmlPreviewItem.tallyXml || xmlPreviewItem.tally_xml || '<!-- Generating Tally XML Preview... -->'}</code>
                </pre>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between p-3.5 border-t border-slate-700 bg-slate-900 text-[11px] text-slate-400">
                <div className="flex items-center gap-3 font-medium">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
                    Validated Tally Schema
                  </span>
                  <span>•</span>
                  <span>Direct import ready for Tally Prime / ERP 9</span>
                </div>
                <button
                  onClick={() => setXmlPreviewItem(null)}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
