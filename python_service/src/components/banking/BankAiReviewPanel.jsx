import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  FileText, CheckCircle2, AlertCircle, RefreshCw, Check, CheckCheck, Search, Filter,
  Eye, Edit3, X, Sparkles, ArrowRight, ShieldCheck, HelpCircle, Layers, Building, ChevronRight, ChevronLeft, Lock, Plus, Trash2,
  SlidersHorizontal, Building2, Sliders, Save, Send, Code, Copy, FileCode, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import bankStatementAiApi from '../../services/bankStatementAiApi';
import { useFundFlowStore } from '../../stores/useFundFlowStore';
import apiClient from '../../lib/apiClient';
import SmartLedgerDropdown, { findBestLedgerMatch } from './SmartLedgerDropdown';
import { calculateBatchSummary, getBatchItemEffectiveStatus, getBatchItemEffectiveParty } from './bankSummaryHelper';

export default function BankAiReviewPanel({ batchData: initialBatchData, onClose, onRefreshList, onNavigateToAddRule }) {
  const [batchData, setBatchData] = useState(initialBatchData);
  const [activeFilter, setActiveFilter] = useState('all'); // all, ready, review_required, already_processed, saved
  const [voucherTypeFilter, setVoucherTypeFilter] = useState('ALL'); // ALL, Receipt, Payment, Contra
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [editingItem, setEditingItem] = useState(null); // Item open in Split-Screen Drawer
  const [xmlPreviewItem, setXmlPreviewItem] = useState(null); // Item open in XML Modal
  const [copiedXml, setCopiedXml] = useState(false);
  const [savingLoading, setSavingLoading] = useState(false);
  const [savingSingleItemId, setSavingSingleItemId] = useState(null);
  const [pushLoading, setPushLoading] = useState(false);
  const [loadingXmlItemId, setLoadingXmlItemId] = useState(null);
  const [acceptingSuggestedLoading, setAcceptingSuggestedLoading] = useState(false);
  
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
  
  // Shared helpers to resolve party ledger and effective status (100% synchronized with BankPanel)
  const getEffectiveParty = useCallback((item) => {
    return getBatchItemEffectiveParty(item, allLedgersList);
  }, [allLedgersList]);

  const getEffectiveStatus = useCallback((item) => {
    return getBatchItemEffectiveStatus(item, allLedgersList);
  }, [allLedgersList]);

  // Dynamic summary stats strictly synced with shared calculateBatchSummary
  const dynamicSummary = useMemo(() => {
    return calculateBatchSummary(batchData, allLedgersList);
  }, [batchData, allLedgersList]);

  // Helper to resolve voucher type for counting and filtering
  const resolveVoucherType = useCallback((item) => {
    if (!item) return 'Payment';
    if (item.voucherType) {
      const vt = String(item.voucherType).toLowerCase();
      if (vt.includes('contra')) return 'Contra';
      if (vt.includes('receipt')) return 'Receipt';
      if (vt.includes('payment')) return 'Payment';
      return item.voucherType;
    }
    return (Number(item.credit) > 0 && !Number(item.debit)) ? 'Receipt' : 'Payment';
  }, []);

  // Dynamic counting of vouchers by voucher type
  const voucherTypeCounts = useMemo(() => {
    let receipt = 0;
    let payment = 0;
    let contra = 0;
    items.forEach(it => {
      const vt = resolveVoucherType(it);
      if (vt === 'Receipt') receipt++;
      else if (vt === 'Contra') contra++;
      else payment++;
    });
    return {
      all: items.length,
      receipt,
      payment,
      contra
    };
  }, [items, resolveVoucherType]);

  // Filter items using effective status and voucher type
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const eff = getEffectiveStatus(item);
      if (activeFilter === 'ready' && eff !== 'ready' && eff !== 'user_edited') return false;
      if (activeFilter === 'review_required' && eff !== 'review_required') return false;
      if (activeFilter === 'already_processed' && eff !== 'already_processed') return false;
      if (activeFilter === 'saved' && eff !== 'saved') return false;

      if (voucherTypeFilter !== 'ALL') {
        const vt = resolveVoucherType(item);
        if (vt !== voucherTypeFilter) return false;
      }

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
  }, [items, activeFilter, voucherTypeFilter, searchQuery, getEffectiveStatus, resolveVoucherType]);

  // Reset page when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter, voucherTypeFilter, searchQuery]);

  // Paginated slice for instant 60fps rendering
  const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const paginatedItems = useMemo(() => {
    if (pageSize === 'all') return filteredItems;
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  const getItemSuggestedLedger = useCallback((item) => {
    if (!item) return '';
    const rawParty = item.partyLedger || item.againstLedger || '';
    if (rawParty && rawParty !== 'Unmapped' && rawParty !== '—' && !rawParty.includes('-- Select') && rawParty.trim()) {
      return rawParty.trim();
    }
    const eff = getEffectiveParty(item);
    if (eff && eff !== 'Unmapped' && eff !== '—' && !eff.includes('-- Select') && eff.trim()) {
      return eff.trim();
    }
    return '';
  }, [getEffectiveParty]);

  const allEligibleItems = useMemo(() => {
    return filteredItems.filter(i => {
      const eff = getEffectiveStatus(i);
      return eff !== 'already_processed' && eff !== 'saved';
    });
  }, [filteredItems, getEffectiveStatus]);

  const itemsWithSuggestions = useMemo(() => {
    return allEligibleItems.filter(i => Boolean(getItemSuggestedLedger(i)));
  }, [allEligibleItems, getItemSuggestedLedger]);

  const selectedWithSuggestionsCount = useMemo(() => {
    if (!selectedItemIds.length) return 0;
    const selectedSet = new Set(selectedItemIds);
    return itemsWithSuggestions.filter(i => selectedSet.has(i.item_id)).length;
  }, [selectedItemIds, itemsWithSuggestions]);

  const toggleSelectItem = (itemId) => {
    setSelectedItemIds(prev =>
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
  };

  const toggleSelectSuggested = (checked) => {
    if (checked) {
      const suggestedIds = itemsWithSuggestions.map(i => i.item_id);
      setSelectedItemIds(suggestedIds);
    } else {
      setSelectedItemIds([]);
    }
  };

  const toggleSelectAll = (checked) => {
    if (checked) {
      const allIds = allEligibleItems.map(i => i.item_id);
      setSelectedItemIds(allIds);
    } else {
      setSelectedItemIds([]);
    }
  };

  const handleUpdateItemField = async (itemId, field, value) => {
    const isPartyField = field === 'partyLedger' || field === 'againstLedger';

    // 1. Optimistic local update so UI reflects 100% Ready INSTANTLY (0ms lag)
    setBatchData(prev => {
      if (!prev || !prev.items) return prev;
      return {
        ...prev,
        items: prev.items.map(it => {
          if (it.item_id === itemId) {
            return {
              ...it,
              [field]: value,
              ...(isPartyField ? {
                partyLedger: value,
                againstLedger: value,
                status: 'user_edited',
                review_required: false,
                confidence: 100,
                user_reasoning: 'Manually verified & selected by user'
              } : {})
            };
          }
          return it;
        })
      };
    });

    if (editingItem && editingItem.item_id === itemId) {
      setEditingItem(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          [field]: value,
          ...(isPartyField ? {
            partyLedger: value,
            againstLedger: value,
            status: 'user_edited',
            review_required: false,
            confidence: 100,
            user_reasoning: 'Manually verified & selected by user'
          } : {})
        };
      });
    }

    try {
      const bId = batchData.batch_id || batchData._id;
      const res = await bankStatementAiApi.updateTransaction(bId, itemId, { [field]: value });
      if (res.success && res.data) {
        const affCount = res.affectedCount || res.data?.affectedCount || 1;
        if (field === 'partyLedger' && affCount > 1) {
          toast.success(`Mapped "${value}" to ${affCount} transaction(s) across statement without re-upload!`);
          const refreshed = await bankStatementAiApi.getBatchReview(bId);
          if (refreshed?.success && refreshed.data) {
            setBatchData(refreshed.data);
          }
        } else {
          setBatchData(prev => ({
            ...prev,
            items: prev.items.map(i => i.item_id === itemId ? {
              ...res.data,
              confidence: 100,
              status: 'user_edited',
              review_required: false
            } : i)
          }));
        }
        if (editingItem && editingItem.item_id === itemId) {
          setEditingItem({
            ...res.data,
            confidence: 100,
            status: 'user_edited',
            review_required: false
          });
        }
      }
    } catch (err) {
      toast.error('Failed to update transaction field');
    }
  };

  const handleVerifyItem = async (itemId, ledgerToVerify) => {
    const item = (batchData?.items || []).find(i => i.item_id === itemId);
    const ledger = ledgerToVerify || item?.partyLedger || getEffectiveParty(item);
    if (!ledger || ledger === 'Unmapped') {
      toast.error('Please select a valid party ledger first to verify.');
      return;
    }
    await handleUpdateItemField(itemId, 'partyLedger', ledger);
    toast.success(`Verified "${ledger}" — marked 100% Ready!`);
  };

  const handleAcceptSuggestedForSelected = async () => {
    if (!selectedItemIds.length) return;
    const bId = batchData?.batch_id || batchData?._id;
    if (!bId) return;

    const currentItems = batchData.items || [];
    const mappings = [];

    // ONLY select items that actually have a non-empty, valid suggested ledger!
    for (const id of selectedItemIds) {
      const it = currentItems.find(i => i.item_id === id);
      if (!it) continue;
      const effParty = getItemSuggestedLedger(it);
      if (effParty) {
        mappings.push({ item_id: id, partyLedger: effParty });
      }
    }

    if (!mappings.length) {
      toast.error('None of the selected vouchers have an auto-suggested ledger to accept. Unmapped vouchers require manual selection.');
      return;
    }

    setAcceptingSuggestedLoading(true);

    // Instant optimistic update for 0ms UI lag ONLY on items with valid suggested ledger
    const mapLookup = new Map(mappings.map(m => [m.item_id, m.partyLedger]));
    setBatchData(prev => {
      if (!prev || !prev.items) return prev;
      return {
        ...prev,
        items: prev.items.map(it => {
          if (mapLookup.has(it.item_id)) {
            const p = mapLookup.get(it.item_id);
            return {
              ...it,
              partyLedger: p,
              againstLedger: p,
              status: 'user_edited',
              review_required: false,
              confidence: 100,
              user_reasoning: 'Auto-suggested ledger accepted by user'
            };
          }
          // Unmapped items remain completely untouched!
          return it;
        })
      };
    });

    try {
      const res = await bankStatementAiApi.bulkAcceptSuggested(bId, mappings);
      if (res?.success) {
        toast.success(`Accepted suggested ledgers for ${res.accepted_count || mappings.length} voucher(s) — marked 100% Ready!`);
        if (res.data) {
          setBatchData(res.data);
        }
        setSelectedItemIds([]);
      } else {
        toast.error(res?.error || 'Failed to accept suggested ledgers');
      }
    } catch (err) {
      console.error('Failed to bulk accept suggested ledgers:', err);
      toast.error('Failed to accept suggested ledgers');
    } finally {
      setAcceptingSuggestedLoading(false);
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
      // 1. Fast bulk bind: if any selected items need suggested ledgers bound, do it in ONE batch call!
      const unmappedNeedBinding = [];
      const currentItems = batchData.items || [];
      for (const id of selectedItemIds) {
        const it = currentItems.find(i => i.item_id === id);
        if (it && (!it.partyLedger || it.partyLedger === 'Unmapped' || it.partyLedger.includes('-- Select'))) {
          const effParty = getItemSuggestedLedger(it);
          if (effParty) {
            unmappedNeedBinding.push({ item_id: id, partyLedger: effParty });
          }
        }
      }
      if (unmappedNeedBinding.length > 0) {
        try {
          await bankStatementAiApi.bulkAcceptSuggested(bId, unmappedNeedBinding);
        } catch (e) {
          console.warn('Auto-binding suggested ledgers warning:', e);
        }
      }

      // 2. Direct fast save of all selected vouchers in 1 single request
      const res = await bankStatementAiApi.saveVouchers(bId, selectedItemIds);
      if (res && res.success) {
        toast.success(`Successfully saved ${res.saved_count || selectedItemIds.length} accounting voucher(s)!`);
        
        // Refresh batch data
        try {
          const updatedBatch = await bankStatementAiApi.getBatchReview(bId);
          if (updatedBatch?.success && updatedBatch.data) {
            setBatchData(updatedBatch.data);
          }
        } catch (e) {}

        if (res.xmlPayload) {
          setXmlPreviewItem({
            isBatch: true,
            voucherType: 'Combined Batch Tally XML',
            voucherNumber: `${res.saved_count} Saved Vouchers`,
            xmlPayload: res.xmlPayload,
            tallyXml: res.xmlPayload
          });
        }
        setSelectedItemIds([]);
        if (onRefreshList) onRefreshList();
        // Background refresh transactions for BRS tab
        fundFlowStore.fetchTransactions().catch(() => {});
      } else {
        toast.error(res?.error || 'Failed to save vouchers');
      }
    } catch (err) {
      console.error('Failed to save vouchers:', err);
      toast.error(err?.response?.data?.detail || err?.response?.data?.message || err?.message || 'Error saving accounting vouchers');
    } finally {
      setSavingLoading(false);
    }
  };

  const handlePushSelectedVouchers = async () => {
    const bId = batchData.batch_id || batchData._id;
    let itemsToPush = [...selectedItemIds];

    // If user did not select specific checkboxes, automatically push all pending saved vouchers:
    if (itemsToPush.length === 0) {
      const pendingItems = (batchData.items || []).filter(
        i => i.status === 'saved' && String(i.tallyPushStatus || '').toUpperCase() !== 'POSTED_TO_TALLY'
      );
      if (pendingItems.length === 0) {
        toast.info('No pending saved vouchers to push to Tally!');
        return;
      }
      itemsToPush = pendingItems.map(i => i.item_id);
    } else {
      // Check which of the selected items are saved
      const savedSelectedItems = (batchData.items || []).filter(
        i => itemsToPush.includes(i.item_id) && i.status === 'saved'
      );
      
      // If none of the selected items are saved yet, save them first
      if (savedSelectedItems.length === 0) {
        toast.info('Saving selected vouchers before pushing to Tally...');
        const saveRes = await bankStatementAiApi.saveVouchers(bId, itemsToPush);
        if (!saveRes?.success) {
          toast.error(saveRes?.error || 'Failed to save vouchers prior to Tally push');
          return;
        }
      }
    }

    setPushLoading(true);
    try {
      const res = await bankStatementAiApi.pushToTally(bId, itemsToPush);
      // Refresh batch data
      const updatedBatch = await bankStatementAiApi.getBatchReview(bId);
      if (updatedBatch?.success) {
        setBatchData(updatedBatch.data);
      }
      if (res?.xmlPayload) {
        setXmlPreviewItem({
          isBatch: true,
          voucherType: 'Combined Batch Tally XML',
          voucherNumber: `${res.pushed_count || itemsToPush.length} Vouchers`,
          xmlPayload: res.xmlPayload,
          tallyXml: res.xmlPayload
        });
      }
      if (res.success) {
        if (res.pushed_count > 0) {
          toast.success(`Successfully pushed ${res.pushed_count} vouchers to Tally!`);
        } else if (res.already_pushed_count > 0) {
          toast.info(`Selected vouchers (${res.already_pushed_count}) were already pushed to Tally.`);
        }
      } else {
        toast.warning(res.errorMessage || res.message || 'Tally push response received. XML generated.');
      }
      setSelectedItemIds([]);
      if (onRefreshList) onRefreshList();
    } catch (err) {
      // If Tally live server is not reachable, still generate and show the XML!
      try {
        const previewRes = await bankStatementAiApi.previewBatchXml(bId, itemsToPush);
        if (previewRes?.success && previewRes?.xmlPayload) {
          setXmlPreviewItem({
            isBatch: true,
            voucherType: 'Combined Batch Tally XML',
            voucherNumber: `${itemsToPush.length} Vouchers`,
            xmlPayload: previewRes.xmlPayload,
            tallyXml: previewRes.xmlPayload
          });
          toast.warning('Tally HTTP is offline, but combined XML was successfully generated & saved to tally_payloads!');
          const updatedBatch = await bankStatementAiApi.getBatchReview(bId);
          if (updatedBatch?.success) setBatchData(updatedBatch.data);
          setSelectedItemIds([]);
          if (onRefreshList) onRefreshList();
        } else {
          toast.error(err.response?.data?.detail || err.message || 'Error pushing vouchers to Tally');
        }
      } catch (pe) {
        toast.error(err.response?.data?.detail || err.message || 'Error pushing vouchers to Tally');
      }
    } finally {
      setPushLoading(false);
    }
  };

  const handlePreviewBatchXml = async () => {
    const bId = batchData.batch_id || batchData._id;
    try {
      const res = await bankStatementAiApi.previewBatchXml(bId, selectedItemIds.length > 0 ? selectedItemIds : null);
      if (res?.xmlPayload) {
        setXmlPreviewItem({
          isBatch: true,
          voucherType: 'Combined Batch Tally XML',
          voucherNumber: `${res.voucherCount || selectedItemIds.length || dynamicSummary.saved_count || 'Batch'} Vouchers`,
          xmlPayload: res.xmlPayload,
          tallyXml: res.xmlPayload
        });
      } else if (res.allAlreadyPushed) {
        toast.info(res.message || 'All saved vouchers in this batch are already pushed to Tally.');
      } else {
        toast.error(res.errorMessage || 'Could not preview XML. Please ensure vouchers are saved.');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error loading batch XML');
    }
  };

  const handlePreviewItemXml = async (item) => {
    if (!item) return;
    // 1. If XML is already stored on the item, show it immediately!
    if (item.tallyXml || item.tally_xml) {
      setXmlPreviewItem({
        isBatch: false,
        voucherType: item.voucherType || 'Voucher',
        voucherNumber: item.voucherNumber || 'Voucher XML',
        xmlPayload: item.tallyXml || item.tally_xml,
        tallyXml: item.tallyXml || item.tally_xml
      });
      return;
    }

    const bId = batchData.batch_id || batchData._id;
    setLoadingXmlItemId(item.item_id);
    try {
      // 2. If voucher is not saved yet, save it first before generating XML
      if (item.status !== 'saved' && !item.saved_voucher_id) {
        toast.info('Saving voucher to generate Tally XML...');
        const saveRes = await bankStatementAiApi.saveVouchers(bId, [item.item_id]);
        if (!saveRes?.success) {
          toast.error(saveRes?.error || 'Failed to save voucher');
          return;
        }
        const updatedBatch = await bankStatementAiApi.getBatchReview(bId);
        if (updatedBatch?.success) setBatchData(updatedBatch.data);
        if (saveRes.xmlPayload) {
          setXmlPreviewItem({
            isBatch: false,
            voucherType: item.voucherType || 'Voucher',
            voucherNumber: item.voucherNumber || 'Voucher XML',
            xmlPayload: saveRes.xmlPayload,
            tallyXml: saveRes.xmlPayload
          });
          return;
        }
      }

      // 3. Request preview / generation of XML for this single voucher
      const res = await bankStatementAiApi.previewBatchXml(bId, [item.item_id], item.saved_voucher_id ? [item.saved_voucher_id] : null);
      if (res?.xmlPayload) {
        setXmlPreviewItem({
          isBatch: false,
          voucherType: item.voucherType || 'Voucher',
          voucherNumber: item.voucherNumber || 'Pending Voucher XML',
          xmlPayload: res.xmlPayload,
          tallyXml: res.xmlPayload
        });
        // Refresh batch data to keep local state updated with generated XML
        const updatedBatch = await bankStatementAiApi.getBatchReview(bId);
        if (updatedBatch?.success) setBatchData(updatedBatch.data);
      } else {
        toast.error(res?.errorMessage || 'Could not generate XML for this voucher.');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error generating XML');
    } finally {
      setLoadingXmlItemId(null);
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
    const isSaved = item.status === 'saved' || Boolean(item.saved_voucher_id);
    const isPushedToTally = 
      String(item.tallyPushStatus || '').toUpperCase() === 'POSTED_TO_TALLY' ||
      String(item.tallyPushStatus || '').toUpperCase() === 'PUSHED' ||
      String(item.status || '').toUpperCase() === 'POSTED_TO_TALLY';
    const isFailed = String(item.tallyPushStatus || '').toUpperCase() === 'FAILED_TALLY';

    // 1. Saved Vouchers: Show TALLY PUSHED if posted to Tally, otherwise show SAVED
    if (isSaved) {
      if (isPushedToTally) {
        return (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handlePreviewItemXml(item); }}
            title={`Successfully posted to Tally${item.tallyPushedAt ? ` on ${new Date(item.tallyPushedAt).toLocaleTimeString()}` : ''}. Click to view Tally XML!`}
            className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-400 dark:border-emerald-700 flex items-center justify-center gap-1 shadow-xs hover:scale-105 hover:bg-emerald-200 dark:hover:bg-emerald-900 transition-all cursor-pointer"
          >
            {loadingXmlItemId === item.item_id ? (
              <RefreshCw size={10} className="animate-spin text-emerald-600 dark:text-emerald-400" />
            ) : (
              <CheckCircle2 size={10} className="text-emerald-600 dark:text-emerald-400" />
            )}
            <span>TALLY PUSHED</span>
          </button>
        );
      }
      if (item.tallyXml || item.tally_xml) {
        return (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handlePreviewItemXml(item); }}
            title="Saved to MongoDB. Click to view Tally XML"
            className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-300 dark:border-purple-800 flex items-center justify-center gap-1 shadow-xs hover:scale-105 hover:bg-purple-200 dark:hover:bg-purple-900 transition-all cursor-pointer"
          >
            <CheckCircle2 size={10} className="text-purple-600 dark:text-purple-400" />
            <span>SAVED</span>
          </button>
        );
      }
      return (
        <span
          title="Saved in MongoDB"
          className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-300 dark:border-purple-800 flex items-center justify-center gap-1 shadow-xs"
        >
          <CheckCircle2 size={10} className="text-purple-600 dark:text-purple-400" />
          <span>SAVED</span>
        </span>
      );
    }

    // 2. User verified or 100% confident items: Show READY with green styling
    if (item.status === 'user_edited' || item.status === 'user_verified' || Number(item.confidence) === 100 || maybeConfidence === 100) {
      return (
        <span
          title="Manually verified & selected by user • 100% Ready"
          className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 inline-flex items-center justify-center gap-1 whitespace-nowrap shadow-xs"
        >
          <Check size={10} /> READY
        </span>
      );
    }
    if (item.status === 'already_processed') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-300 dark:border-rose-800 inline-flex items-center justify-center gap-1 whitespace-nowrap">
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
          className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 inline-flex items-center justify-center gap-1 whitespace-nowrap"
        >
          <Check size={10} /> READY
        </span>
      );
    }

    // Orange: 60% to 89% -> Review Required (Clickable to quickly verify if candidate is present!)
    if (score >= 60) {
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (item.item_id && maybeParty) {
              handleVerifyItem(item.item_id, maybeParty);
            }
          }}
          title={maybeParty ? `Click to verify and approve "${maybeParty}" as 100% Ready` : reasonText}
          className={`px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-300 dark:border-amber-800 inline-flex flex-col items-center justify-center leading-tight text-center ${maybeParty ? 'hover:bg-amber-200 dark:hover:bg-amber-900 cursor-pointer shadow-2xs' : 'cursor-help'}`}
        >
          <span className="inline-flex items-center gap-0.5"><AlertCircle size={10} /> REVIEW</span>
          <span>REQUIRED</span>
        </button>
      );
    }

    // Red: < 60% (e.g. 45%) -> Review Required
    return (
      <span
        title={reasonText}
        className="px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-300 dark:border-rose-800 inline-flex flex-col items-center justify-center cursor-help leading-tight text-center"
      >
        <span className="inline-flex items-center gap-0.5"><AlertCircle size={10} /> REVIEW</span>
        <span>REQUIRED</span>
      </span>
    );
  };

  // Confidence Score Badge: Green (>=90%), Orange (60-89%), Red (<60%)
  const getConfidenceBadge = (confidence) => {
    const score = Number(confidence) || 0;
    if (score >= 90) {
      return (
        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full font-mono text-[9.5px] font-black bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 whitespace-nowrap">
          {score}%
        </span>
      );
    }
    if (score >= 60) {
      return (
        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full font-mono text-[9.5px] font-black bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-300 dark:border-amber-800 whitespace-nowrap">
          {score}%
        </span>
      );
    }
    return (
      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full font-mono text-[9.5px] font-black bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-300 dark:border-rose-800 whitespace-nowrap">
        {score}%
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-2.5 h-full overflow-hidden bg-[var(--app-panel-bg)] rounded-xl border p-2.5" style={{ borderColor: 'var(--app-border)' }}>
      
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2 border-b shrink-0 gap-2" style={{ borderColor: 'var(--app-border)' }}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-8.5 w-8.5 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-xs shrink-0">
            <Sparkles size={17} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-[15px] font-black text-[var(--app-heading)] tracking-tight whitespace-nowrap">
                AI Bank Statement & Master Mapping Review
              </h1>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/25 text-indigo-600 font-bold text-[10px] whitespace-nowrap">
                <Building2 size={12} />
                <span className="text-[var(--app-muted)] uppercase text-[9px]">Selected Bank Ledger:</span>
                <span className="text-[var(--app-heading)] font-black">{batchData.bank_ledger}</span>
              </div>
            </div>
            <p className="text-[10.5px] font-medium text-[var(--app-muted)] truncate mt-0.5">
              Statement: <span className="font-bold text-[var(--app-heading)]">{batchData.file_name}</span> | Bank Ledger: <span className="font-bold text-indigo-600">{batchData.bank_ledger}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          <button
            onClick={() => onClose && onClose(batchData)}
            className="h-8 px-3 py-1 border rounded-lg text-[10.5px] font-bold uppercase tracking-wider hover:bg-[var(--app-control-hover)] transition-all cursor-pointer whitespace-nowrap inline-flex items-center justify-center"
            style={{ borderColor: 'var(--app-border)', color: 'var(--app-muted)' }}
          >
            ← Back to Bank
          </button>

          <button
            onClick={handleSaveSelectedVouchers}
            disabled={selectedItemIds.length === 0 || savingLoading}
            className="h-8 px-3.5 py-1 rounded-lg text-[10.5px] font-black uppercase tracking-wider bg-[var(--app-accent)] text-white shadow-xs hover:opacity-90 transition-all disabled:opacity-50 cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5"
          >
            {savingLoading ? <RefreshCw className="animate-spin" size={13} /> : <CheckCircle2 size={13} />}
            <span>Approve & Save Vouchers ({selectedItemIds.length})</span>
          </button>
          <button
            onClick={handlePushSelectedVouchers}
            disabled={pushLoading || (selectedItemIds.length === 0 && dynamicSummary.tally_pending_count === 0) || dynamicSummary.review_required_count > 0}
            title={
              dynamicSummary.review_required_count > 0
                ? `${dynamicSummary.review_required_count} voucher(s) still have 'Review Required' status. Map all party ledgers to READY before pushing to Tally.`
                : 'Push vouchers to Tally in ONE single XML request'
            }
            className="h-8 px-3.5 py-1 rounded-lg text-[10.5px] font-black uppercase tracking-wider bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5"
          >
            {pushLoading ? <RefreshCw className="animate-spin" size={12} /> : <Send size={12} />}
            <span>
              {selectedItemIds.length > 0
                ? `Push Selected (${selectedItemIds.length})`
                : `Push to Tally (${dynamicSummary.tally_pending_count} Pending)`}
            </span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 shrink-0">
        {[
          { 
            id: 'all', 
            label: 'Total Statement Items', 
            count: dynamicSummary.total_count, 
            color: 'text-[var(--app-heading)]',
            activeClass: 'bg-indigo-50/90 dark:bg-indigo-950/50 border-indigo-400 ring-2 ring-indigo-500/25 shadow-sm',
            activePill: 'bg-indigo-600 text-white'
          },
          { 
            id: 'ready', 
            label: 'Mapped & Ready', 
            count: dynamicSummary.ready_count, 
            color: 'text-emerald-600 dark:text-emerald-400',
            activeClass: 'bg-emerald-50/90 dark:bg-emerald-950/50 border-emerald-500 ring-2 ring-emerald-500/25 shadow-sm',
            activePill: 'bg-emerald-600 text-white'
          },
          { 
            id: 'review_required', 
            label: 'Review Required', 
            count: dynamicSummary.review_required_count, 
            color: 'text-amber-600 dark:text-amber-400',
            activeClass: 'bg-amber-50/90 dark:bg-amber-950/50 border-amber-500 ring-2 ring-amber-500/25 shadow-sm',
            activePill: 'bg-amber-600 text-white'
          },
          { 
            id: 'already_processed', 
            label: 'Duplicates', 
            count: dynamicSummary.already_processed_count, 
            color: 'text-rose-600 dark:text-rose-400',
            activeClass: 'bg-rose-50/90 dark:bg-rose-950/50 border-rose-500 ring-2 ring-rose-500/25 shadow-sm',
            activePill: 'bg-rose-600 text-white'
          },
          { 
            id: 'saved', 
            label: 'Saved Vouchers', 
            count: dynamicSummary.saved_count, 
            subtext: dynamicSummary.saved_count > 0 
              ? `${dynamicSummary.tally_pushed_count} Pushed • ${dynamicSummary.tally_pending_count} Pending`
              : null,
            color: 'text-purple-600 dark:text-purple-400',
            activeClass: 'bg-purple-50/90 dark:bg-purple-950/50 border-purple-500 ring-2 ring-purple-500/25 shadow-sm',
            activePill: 'bg-purple-600 text-white'
          }
        ].map(kpi => {
          const isActive = activeFilter === kpi.id;
          return (
            <button
              key={kpi.id}
              onClick={() => setActiveFilter(kpi.id)}
              className={`px-3 py-1.5 rounded-lg border transition-all text-left cursor-pointer relative ${
                isActive
                  ? kpi.activeClass
                  : 'bg-[var(--app-panel-bg)] hover:bg-[var(--app-control-hover)]'
              }`}
              style={!isActive ? { borderColor: 'var(--app-border)' } : undefined}
            >
              <div className="flex items-center justify-between gap-1">
                <span className={`text-[9px] uppercase tracking-wider block truncate ${isActive ? 'font-black text-[var(--app-heading)]' : 'font-bold text-[var(--app-muted)]'}`}>
                  {kpi.label}
                </span>
                {isActive && (
                  <span className={`text-[7.5px] font-black uppercase px-1.5 py-0.5 rounded leading-none shrink-0 ${kpi.activePill}`}>
                    Active
                  </span>
                )}
              </div>
              <div className="flex items-baseline justify-between gap-1 mt-0.5">
                <span className={`text-[16px] font-black leading-tight ${kpi.color}`}>{kpi.count}</span>
                {kpi.subtext && (
                  <span className="text-[9px] font-bold text-[var(--app-muted)] truncate">{kpi.subtext}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Warning Banner: shown when review_required items still exist */}
      {dynamicSummary.review_required_count > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 shrink-0">
          <AlertCircle size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="text-[10.5px] font-bold text-amber-800 dark:text-amber-300 flex-1">
            <span className="font-black">{dynamicSummary.review_required_count} voucher(s)</span> still have{' '}
            <span className="font-black">REVIEW REQUIRED</span> status — please map all party ledgers to{' '}
            <span className="font-black text-emerald-700 dark:text-emerald-400">READY</span> before Tally XML can be generated.
          </span>
          <button
            onClick={() => setActiveFilter('review_required')}
            className="text-[9.5px] font-black uppercase tracking-wider px-2 py-1 rounded bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-200 hover:bg-amber-300 dark:hover:bg-amber-700 transition-colors cursor-pointer whitespace-nowrap"
          >
            View Pending →
          </button>
        </div>
      )}

      {/* Voucher Type Small Clickable Cards (Single Line) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 shrink-0">
        {[
          { id: 'ALL', label: 'All Voucher Types', count: voucherTypeCounts.all, color: 'text-[var(--app-heading)]', dot: 'bg-indigo-500', activeClass: 'bg-indigo-50/90 dark:bg-indigo-950/50 border-indigo-400 ring-2 ring-indigo-500/25 shadow-2xs', activePill: 'bg-indigo-600 text-white' },
          { id: 'Receipt', label: 'Receipts (Inflow)', count: voucherTypeCounts.receipt, color: 'text-emerald-500', dot: 'bg-emerald-500', activeClass: 'bg-emerald-50/90 dark:bg-emerald-950/50 border-emerald-500 ring-2 ring-emerald-500/25 shadow-2xs', activePill: 'bg-emerald-600 text-white' },
          { id: 'Payment', label: 'Payments (Outflow)', count: voucherTypeCounts.payment, color: 'text-rose-500', dot: 'bg-rose-500', activeClass: 'bg-rose-50/90 dark:bg-rose-950/50 border-rose-500 ring-2 ring-rose-500/25 shadow-2xs', activePill: 'bg-rose-600 text-white' },
          { id: 'Contra', label: 'Contra (Transfer)', count: voucherTypeCounts.contra, color: 'text-blue-500', dot: 'bg-blue-500', activeClass: 'bg-blue-50/90 dark:bg-blue-950/50 border-blue-500 ring-2 ring-blue-500/25 shadow-2xs', activePill: 'bg-blue-600 text-white' }
        ].map(vtCard => {
          const isSelected = voucherTypeFilter === vtCard.id;
          return (
            <button
              key={vtCard.id}
              onClick={() => setVoucherTypeFilter(prev => prev === vtCard.id && vtCard.id !== 'ALL' ? 'ALL' : vtCard.id)}
              className={`flex items-center justify-between px-2.5 py-1 rounded-md border transition-all text-left cursor-pointer ${
                isSelected
                  ? `${vtCard.activeClass}`
                  : 'bg-[var(--app-panel-bg)] hover:bg-[var(--app-control-hover)]'
              }`}
              style={!isSelected ? { borderColor: 'var(--app-border)' } : undefined}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${vtCard.dot}`} />
                <span className={`text-[9.5px] uppercase tracking-wider truncate ${isSelected ? 'font-black text-[var(--app-heading)]' : 'font-bold text-[var(--app-muted)]'}`}>{vtCard.label}</span>
              </div>
              <div className="flex items-center gap-1.5 ml-1.5 shrink-0">
                <span className={`text-[12px] font-black ${vtCard.color}`}>{vtCard.count}</span>
                {isSelected && (
                  <span className={`text-[7.5px] font-black uppercase px-1.5 py-0.5 rounded leading-none ${vtCard.activePill}`}>Active</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border bg-[var(--app-control-bg)] shrink-0" style={{ borderColor: 'var(--app-border)' }}>
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* 1. Primary: Select Auto-Matched (only items that have suggested ledgers) */}
          <label className="flex items-center gap-1.5 cursor-pointer font-extrabold text-[10.5px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded border border-emerald-300 dark:border-emerald-800 transition-all hover:bg-emerald-100/70 shadow-2xs">
            <input
              type="checkbox"
              onChange={(e) => toggleSelectSuggested(e.target.checked)}
              checked={itemsWithSuggestions.length > 0 && itemsWithSuggestions.every(i => selectedItemIds.includes(i.item_id))}
              className="w-3.5 h-3.5 rounded accent-emerald-600 cursor-pointer"
            />
            <span>Select Auto-Matched ({itemsWithSuggestions.length})</span>
          </label>

          {/* 2. Secondary: Select All Eligible (including unmapped) if there are any unmapped items */}
          {allEligibleItems.length > itemsWithSuggestions.length && (
            <label className="flex items-center gap-1.5 cursor-pointer font-bold text-[10px] text-[var(--app-muted)] hover:text-[var(--app-heading)] transition-colors">
              <input
                type="checkbox"
                onChange={(e) => toggleSelectAll(e.target.checked)}
                checked={allEligibleItems.length > 0 && selectedItemIds.length === allEligibleItems.length}
                className="w-3 h-3 rounded accent-[var(--app-accent)] cursor-pointer"
              />
              <span>All Eligible ({allEligibleItems.length})</span>
            </label>
          )}

          {/* 3. Action button: Only accepts items with actual suggested ledgers */}
          {selectedWithSuggestionsCount > 0 && (
            <button
              onClick={handleAcceptSuggestedForSelected}
              disabled={acceptingSuggestedLoading}
              className="h-7 px-3 py-1 rounded-md text-[10.5px] font-black text-white bg-emerald-600 hover:bg-emerald-700 transition-all cursor-pointer shadow-xs inline-flex items-center gap-1.5 disabled:opacity-50"
              title="Accept auto-suggested ledgers for selected vouchers and mark them 100% Ready (unmapped vouchers will remain untouched)"
            >
              {acceptingSuggestedLoading ? <RefreshCw className="animate-spin" size={12} /> : <CheckCheck size={13} />}
              <span>Accept Suggested ({selectedWithSuggestionsCount})</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative min-w-[220px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--app-muted)]" size={12} />
            <input
              type="text"
              placeholder="Search narration, master, reference..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-7 pl-7.5 pr-2.5 border rounded-md text-[10.5px] font-semibold outline-none focus:border-[var(--app-accent)] bg-[var(--app-panel-bg)]"
              style={{ borderColor: 'var(--app-border)', color: 'var(--app-heading)' }}
            />
          </div>

          <button
            onClick={() => {
              if (onNavigateToAddRule) {
                onNavigateToAddRule();
              }
            }}
            className="h-7 px-2.5 py-1 rounded-md border text-[10.5px] font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors cursor-pointer shadow-2xs whitespace-nowrap inline-flex items-center gap-1.5"
            title="Open Bank Pattern & Party Ledger Mapping Engine"
          >
            <SlidersHorizontal size={12} />
            <span>Add Rule</span>
          </button>
        </div>
      </div>

      {/* Main Review Table matching Manual Entry Form Layout */}
      <div className="flex-1 overflow-auto border rounded-xl" style={{ borderColor: 'var(--app-border)' }}>
        <table className="w-full text-left border-collapse text-[11px] min-w-[1360px]">
          <thead className="sticky top-0 bg-[var(--app-control-bg)] z-10 border-b" style={{ borderColor: 'var(--app-border)' }}>
            <tr>
              <th className="py-2 px-1 w-12 text-center font-black text-[var(--app-muted)] uppercase tracking-wider text-[10px]">SR #</th>
              <th className="py-2 px-1 font-black text-[var(--app-muted)] uppercase tracking-wider w-32 text-center text-[10px]">Voucher Date</th>
              <th className="py-2 px-1.5 font-black text-[var(--app-muted)] uppercase tracking-wider w-24 min-w-[85px] text-[10px]">Voucher Type</th>
              <th className="py-2 px-1 font-black text-[var(--app-muted)] uppercase tracking-wider w-20 text-center text-[10px]">Txn Type</th>
              <th className="py-2 px-1.5 font-black text-[var(--app-muted)] uppercase tracking-wider w-36 max-w-[150px] text-[10px]">Exact Extracted Value</th>
              <th className="py-2 px-1.5 font-black text-[var(--app-muted)] uppercase tracking-wider w-56 min-w-[210px] text-[10px]">Party / Ledger Name</th>
              <th className="py-2 px-2 font-black text-[var(--app-muted)] uppercase tracking-wider min-w-[220px] text-[10px]">Description / Narration</th>
              <th className="py-2 px-1.5 font-black text-[var(--app-muted)] uppercase tracking-wider text-right w-28 text-[10px]">Amount (₹)</th>
              <th className="py-2 px-1 font-black text-[var(--app-muted)] uppercase tracking-wider w-24 text-[10px]">Reference No.</th>
              <th className="py-2 px-1 font-black text-[var(--app-muted)] uppercase tracking-wider text-center w-16 text-[10px]">Confidence</th>
              <th className="py-2 px-1 font-black text-[var(--app-muted)] uppercase tracking-wider text-center w-24 text-[10px]">Status</th>
              <th className="py-2 px-1 font-black text-[var(--app-muted)] uppercase tracking-wider text-center w-22 text-[10px]">Action</th>
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
                const cand = item.extractedParty && String(item.extractedParty).trim();
                const liveMatch = (cand && cand !== '—') ? findBestLedgerMatch(cand, allLedgersList) : null;
                const rawConf = Number(item.confidence) || 0;
                const isUserVerified = item.status === 'user_edited' || item.status === 'user_verified' || rawConf === 100;
                let effConfidence;
                if (isUserVerified) {
                  effConfidence = 100;
                } else if (hasMaster) {
                  if (liveMatch) {
                    effConfidence = liveMatch.isAmbiguous ? Math.min(liveMatch.score, 85) : Math.max(liveMatch.score, rawConf > 0 ? rawConf : 90);
                  } else {
                    effConfidence = Math.max(90, rawConf > 0 ? rawConf : 90);
                  }
                } else {
                  effConfidence = Math.min(rawConf > 0 ? rawConf : 45, 65);
                }
                const currentVType = resolveVoucherType(item);
                const isContra = currentVType === 'Contra';
                const isOutflow = currentVType === 'Payment';
                const isReceipt = currentVType === 'Receipt';
                const rowNumber = pageSize === 'all' ? idx + 1 : (currentPage - 1) * pageSize + idx + 1;
                const txType = extractTxType(item.narration, item);
                const vDate = item.voucherDate || item.date || '';

                return (
                  <tr
                    key={item.item_id}
                    className={`border-b last:border-0 transition-colors ${
                      isSelected
                        ? 'bg-[var(--app-accent-soft)]/20'
                        : isContra
                        ? 'bg-blue-50/60 dark:bg-blue-950/30 hover:bg-blue-100/60 dark:hover:bg-blue-900/40'
                        : (!hasMaster && item.status === 'review_required'
                          ? 'bg-amber-500/5 hover:bg-[var(--app-content-bg)]/60'
                          : 'hover:bg-[var(--app-content-bg)]/60')
                    }`}
                    style={{ borderColor: 'var(--app-border)' }}
                  >
                    {/* 1. SR # with Checkbox combined */}
                    <td className="py-1.5 px-1 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={!canSelect}
                          onChange={() => toggleSelectItem(item.item_id)}
                          className="w-3.5 h-3.5 rounded accent-[var(--app-accent)] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        />
                        <span className="text-[10.5px] font-mono text-[var(--app-muted)] font-bold">
                          {rowNumber}
                        </span>
                      </div>
                    </td>

                    {/* 2. Voucher Date */}
                    <td className="py-1.5 px-1">
                      <input
                        type="date"
                        value={vDate ? (vDate.length === 10 ? vDate : vDate.slice(0, 10)) : ''}
                        onChange={(e) => {
                          handleUpdateItemField(item.item_id, 'date', e.target.value);
                          handleUpdateItemField(item.item_id, 'voucherDate', e.target.value);
                        }}
                        className="w-full h-7 px-1 border rounded text-[10px] font-mono font-bold bg-[var(--app-panel-bg)] text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] text-center"
                        style={{ borderColor: 'var(--app-border)' }}
                      />
                    </td>

                    {/* 3. Voucher Type */}
                    <td className="py-1.5 px-1.5">
                      <select
                        value={currentVType}
                        onChange={(e) => handleUpdateItemField(item.item_id, 'voucherType', e.target.value)}
                        className={`w-full h-6 px-1 pr-3 border rounded text-[9.5px] font-bold outline-none focus:border-[var(--app-accent)] cursor-pointer ${
                          isContra
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border-blue-300 dark:border-blue-800'
                            : isReceipt
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800'
                            : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border-rose-300 dark:border-rose-800'
                        }`}
                      >
                        <option value="Receipt">Receipt</option>
                        <option value="Payment">Payment</option>
                        <option value="Contra">Contra</option>
                      </select>
                    </td>

                    {/* 4. Transaction Type */}
                    <td className="py-1.5 px-1 text-center">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[9.5px] font-black uppercase tracking-wider border ${getTxTypeBadgeClass(txType)}`}>
                        {txType}
                      </span>
                    </td>

                    {/* 5. Exact Extracted Value */}
                    <td className="py-1.5 px-1.5">
                      <div className="w-full max-w-[150px]" title={extractExactValue(item.narration, item)}>
                        <span className="font-mono text-[10px] font-bold text-indigo-700 dark:text-indigo-300 break-words whitespace-normal block bg-indigo-50/80 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800 leading-snug">
                          {extractExactValue(item.narration, item)}
                        </span>
                      </div>
                    </td>

                    {/* 6. Party / Ledger Name */}
                    <td className="py-1.5 px-1.5">
                      <div className="w-full min-w-[200px] max-w-[240px]">
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
                    <td className="py-1.5 px-2 min-w-[220px]">
                      <div className="w-full min-w-[200px]">
                        <div
                          title={item.narration}
                          className="w-full text-[11px] font-medium text-[var(--app-heading)] break-words whitespace-normal leading-snug select-text cursor-text"
                        >
                          {(item.narration || '').replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim()}
                        </div>
                      </div>
                    </td>



                    {/* 8. Amount (₹) */}
                    <td className="py-1.5 px-1.5 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <span className={`px-1 py-0.5 rounded text-[8.5px] font-black uppercase shrink-0 border ${
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
                    <td className="py-1.5 px-1">
                      <input
                        type="text"
                        value={item.referenceNumber || item.instNumber || ''}
                        onChange={(e) => {
                          handleUpdateItemField(item.item_id, 'referenceNumber', e.target.value);
                          handleUpdateItemField(item.item_id, 'instNumber', e.target.value);
                        }}
                        className="w-full h-7 px-1.5 border rounded text-[10px] font-mono font-medium bg-[var(--app-panel-bg)] text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] truncate"
                        style={{ borderColor: 'var(--app-border)' }}
                        placeholder="Ref/UTR"
                      />
                    </td>

                    {/* 10. Confidence */}
                    <td className="py-1.5 px-1 text-center">
                      {getConfidenceBadge(effConfidence)}
                    </td>

                    {/* 11. Status */}
                    <td className="py-1.5 px-1 text-center">
                      {getStatusBadge(item, effConfidence, effParty)}
                    </td>

                    {/* 12. Actions: Save + Eye + XML */}
                    <td className="py-1.5 px-1 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {/* Per-row Save button — visible only for non-saved, non-duplicate items */}
                        {item.status !== 'saved' && item.status !== 'already_processed' && (
                          <button
                            onClick={() => handleSaveSingleVoucher(item.item_id)}
                            disabled={savingSingleItemId === item.item_id || !effParty}
                            title={!effParty ? 'Map a party ledger first to save' : 'Save this voucher to MongoDB'}
                            className="w-6 h-6 rounded-md flex items-center justify-center border border-emerald-400 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:shadow-2xs active:scale-95 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                          >
                            {savingSingleItemId === item.item_id
                              ? <RefreshCw size={10} className="animate-spin" />
                              : <Save size={10} />}
                          </button>
                        )}
                        <button
                          onClick={() => setEditingItem(item)}
                          className="w-6 h-6 rounded-md flex items-center justify-center border border-sky-300 bg-sky-50 text-sky-600 hover:bg-sky-100 hover:shadow-2xs active:scale-95 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-400 transition-all cursor-pointer shrink-0"
                          title="View Full Context"
                        >
                          <Eye size={11} />
                        </button>

                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={12} className="py-10 text-center text-[var(--app-muted)] font-semibold italic">
                  No statement items match the selected filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Table Pagination Bar */}
      {filteredItems.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 border rounded-lg bg-[var(--app-control-bg)] shrink-0 text-[11px]" style={{ borderColor: 'var(--app-border)' }}>
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
                        <div className={`text-[13px] font-extrabold ${editingItem.voucherType === 'Receipt' ? 'text-emerald-500' : editingItem.voucherType === 'Contra' ? 'text-blue-500' : 'text-rose-500'}`}>
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
                        {getConfidenceBadge(editingItem.status === 'user_edited' || editingItem.status === 'user_verified' || Number(editingItem.confidence) === 100 ? 100 : (editingItem.confidence || 90))}
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
                          <option value="Contra">Contra Voucher (Bank Transfer)</option>
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
                        confidence={editingItem.status === 'user_edited' || editingItem.status === 'user_verified' || Number(editingItem.confidence) === 100 ? 100 : (editingItem.confidence || (getEffectiveParty(editingItem) ? 98 : 45))}
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
                      <span>{xmlPreviewItem.isBatch ? 'Single Combined Tally XML (All Vouchers)' : 'Tally XML Voucher Preview'}</span>
                      <span className="px-2 py-0.5 rounded text-[9.5px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        {xmlPreviewItem.isBatch ? xmlPreviewItem.voucherNumber : `${xmlPreviewItem.voucherType || 'Receipt'} #${xmlPreviewItem.voucherNumber || 'AUTO'}`}
                      </span>
                    </h3>
                    <p className="text-[10.5px] text-slate-400 font-medium mt-0.5">
                      Company: <strong className="text-slate-200">{batchData?.bank_ledger || 'Selected Bank'}</strong> {xmlPreviewItem.amount ? <>| Amount: <strong className="text-emerald-400">₹{(xmlPreviewItem.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></> : null}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const xml = xmlPreviewItem.xmlPayload || xmlPreviewItem.tallyXml || xmlPreviewItem.tally_xml || '';
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
                  <code>{xmlPreviewItem.xmlPayload || xmlPreviewItem.tallyXml || xmlPreviewItem.tally_xml || '<!-- Generating Tally XML Preview... -->'}</code>
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
