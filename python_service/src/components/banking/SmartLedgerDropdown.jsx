import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown, Check, Sparkles, X, Plus, AlertCircle } from 'lucide-react';

/**
 * Jaro-Winkler string similarity computation for fuzzy matching on the client.
 */
export function jaroWinkler(s1, s2) {
  if (!s1 || !s2) return 0;
  s1 = s1.toLowerCase();
  s2 = s2.toLowerCase();
  if (s1 === s2) return 1.0;

  const len1 = s1.length;
  const len2 = s2.length;
  const matchDistance = Math.floor(Math.max(len1, len2) / 2) - 1;
  const s1Matches = new Array(len1).fill(false);
  const s2Matches = new Array(len2).fill(false);

  let matches = 0;
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, len2);
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  let k = 0;
  let transpositions = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }
  transpositions /= 2;

  const jaro = (matches / len1 + matches / len2 + (matches - transpositions) / matches) / 3.0;
  let prefix = 0;
  for (let i = 0; i < Math.min(4, Math.min(len1, len2)); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }
  return jaro + prefix * 0.1 * (1.0 - jaro);
}

const ledgerMatchCache = new Map();

/**
 * High-precision ledger matcher to resolve an extracted bank party against Tally Master ledgers.
 * Returns the best matching ledger and confidence score (70-100), or null if no acceptable match.
 */
export function findBestLedgerMatch(target, ledgersList) {
  if (!target || !ledgersList || ledgersList.length === 0) return null;
  const targetText = String(target).trim();
  if (!targetText || targetText.length < 2) return null;

  // Reject purely numeric or symbol strings (references, accounts, UTRs)
  if (!/[a-z]/i.test(targetText)) return null;

  const targetLower = targetText.toLowerCase();
  const cacheKey = `${targetLower}__${ledgersList.length}`;
  if (ledgerMatchCache.has(cacheKey)) {
    return ledgerMatchCache.get(cacheKey);
  }

  const targetAlnum = targetLower.replace(/[^a-z0-9]/g, '');
  if (targetAlnum.length < 3) {
    ledgerMatchCache.set(cacheKey, null);
    return null;
  }

  const STOP = new Set([
    'ltd', 'pvt', 'limited', 'private', 'and', 'the', 'co', 'of', 'for',
    'inc', 'llp', 'llc', 'corp', 'company', 'enterprises', 'agency', 'agencies',
    'traders', 'trading', 'pharma', 'pharmaceuticals',
    'self', 'transfer', 'trf', 'payment', 'receipt', 'pay', 'clear', 'as', 'on',
    'by', 'to', 'from', 'inb', 'inf', 'inft', 'slb', 'slbl', 'slbn', 'upi', 'neft',
    'rtgs', 'imps', 'chq', 'cheque', 'charges', 'chg', 'fee', 'tax', 'gst', 'sms',
    'interest', 'int', 'bank', 'account', 'acc', 'ac'
  ]);

  const targetWords = (targetLower.match(/[a-z0-9]{3,}/g) || []).filter(w => !STOP.has(w));
  // If target contains only stop words (e.g. "Self", "pay clear as on"), it is not a valid party candidate
  if (targetWords.length === 0) return null;

  const coreBrandWords = targetWords.slice(0, 2);

  let bestMatch = null;
  let bestScore = 0;

  for (const rawLedger of ledgersList) {
    const ledger = typeof rawLedger === 'object' ? (rawLedger.name || rawLedger.ledgerName || '') : String(rawLedger || '');
    if (!ledger) continue;

    const lLower = ledger.toLowerCase().trim();
    const lAlnum = lLower.replace(/[^a-z0-9]/g, '');
    const lWords = (lLower.match(/[a-z0-9]{3,}/g) || []).filter(w => !STOP.has(w));

    let score = 0;
    let tag = '';

    // 1. Exact match
    if (lLower === targetLower) {
      score = 100;
      tag = 'Exact Match';
    }
    // 2. Alphanumeric match
    else if (targetAlnum.length >= 4 && lAlnum === targetAlnum) {
      score = 99;
      tag = 'Clean Match';
    }
    // 3. Prefix match
    else if (targetAlnum.length >= 5 && lAlnum.length >= 5 && (lAlnum.startsWith(targetAlnum) || targetAlnum.startsWith(lAlnum))) {
      const lenRatio = Math.min(targetAlnum.length, lAlnum.length) / Math.max(targetAlnum.length, lAlnum.length);
      if (lenRatio >= 0.5) {
        score = 96;
        tag = 'Prefix Match';
      }
    }
    // 4. Substring containment with sufficient length coverage
    else if (targetAlnum.length >= 5 && lAlnum.length >= 5 && (lAlnum.includes(targetAlnum) || targetAlnum.includes(lAlnum))) {
      const lenRatio = Math.min(targetAlnum.length, lAlnum.length) / Math.max(targetAlnum.length, lAlnum.length);
      if (lenRatio >= 0.5) {
        score = 94;
        tag = 'Substring Match';
      }
    }
    // 5. Significant word matching
    else if (targetWords.length >= 1) {
      const allTargetMatch = targetWords.every(tw =>
        lWords.some(lw => lw === tw || lw.startsWith(tw) || tw.startsWith(lw) || lw.includes(tw) || tw.includes(lw))
      );
      if (allTargetMatch) {
        const coverage = targetWords.length / Math.max(lWords.length, 1);
        score = Math.round(90 + Math.min(6, coverage * 6));
        tag = 'Word Match';
      } else {
        const coreMatch = coreBrandWords.length >= 2 && coreBrandWords.every(cw =>
          lLower.includes(cw) || lWords.some(lw => lw.startsWith(cw) || cw.startsWith(lw))
        );
        if (coreMatch) {
          score = 85;
          tag = 'Brand Match';
        }
      }
    }

    // 6. Fuzzy Jaro-Winkler
    if (score < 85 && targetLower.length >= 5 && lLower.length >= 5) {
      const jwRaw = jaroWinkler(targetLower, lLower);
      const jwAlnum = targetAlnum.length >= 5 && lAlnum.length >= 5
        ? jaroWinkler(targetAlnum, lAlnum) : 0;
      const bestJw = Math.max(jwRaw, jwAlnum);
      if (bestJw >= 0.78) {
        const jwScore = Math.round(bestJw * 100);
        if (jwScore > score) {
          score = jwScore;
          tag = `${jwScore}% Match`;
        }
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = { ledger, score, tag };
      if (score === 100) break;
    }
  }

  ledgerMatchCache.set(cacheKey, bestMatch);
  return bestMatch;
}

/**
 * SmartLedgerDropdown:
 * High-performance, searchable combobox dropdown tailored for accounting ledger selection.
 * Automatically computes top AI/fuzzy recommendations based on extracted narration party,
 * pins high-confidence matches at the top with badges, and supports searching across 1,400+ ledgers.
 */
function SmartLedgerDropdown({
  value = '',
  onChange,
  options = [],
  extractedParty = '',
  narration = '',
  voucherType = '',
  confidence = 0,
  reviewReason = '',
  onAddRule,
  disabled = false,
  placeholder = '-- Select Master Party Ledger --',
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 320 });
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const triggerRef = useRef(null);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);

  // Normalize options array into clean string array
  const rawLedgerList = useMemo(() => {
    if (!options || options.length === 0) return [];
    if (typeof options[0] === 'string') return options;
    return Array.from(
      new Set(
        options
          .map(opt => (typeof opt === 'object' ? opt.name || opt.ledgerName : opt))
          .filter(Boolean)
      )
    );
  }, [options]);

  const isUnmapped = !value || String(value).trim() === 'Unmapped';
  const hasSelected = !isUnmapped && Boolean(String(value).trim());

  // Compute smart candidate recommendations strictly LAZY: only when the dropdown is opened
  const recommendations = useMemo(() => {
    if (!isOpen) return [];
    const target = (extractedParty || '').trim();
    if (!target) return [];

    const targetLower = target.toLowerCase();
    const targetAlnum = targetLower.replace(/[^a-z0-9]/g, '');

    // Generic stop words — excluded from word-level matching
    const STOP = new Set([
      'ltd', 'pvt', 'limited', 'private', 'and', 'the', 'co', 'of', 'for',
      'inc', 'llp', 'llc', 'corp', 'company'
    ]);

    // Significant words from target (3+ chars, not stop words)
    const targetWords = (targetLower.match(/[a-z0-9]{3,}/g) || []).filter(w => !STOP.has(w));

    const scored = [];
    for (const ledger of rawLedgerList) {
      const lLower = ledger.toLowerCase();
      const lAlnum = lLower.replace(/[^a-z0-9]/g, '');
      const lWords = (lLower.match(/[a-z0-9]{3,}/g) || []).filter(w => !STOP.has(w));

      // 1. Exact match
      if (lLower === targetLower) {
        scored.push({ ledger, score: 100, tag: 'Exact Match' });
        continue;
      }

      // 2. Alphanumeric exact match (ignores spaces, dashes, special chars)
      if (targetAlnum.length >= 4 && lAlnum === targetAlnum) {
        scored.push({ ledger, score: 99, tag: 'Clean Match' });
        continue;
      }

      // 3. Prefix match — one alnum starts with the other
      if (targetAlnum.length >= 5 && lAlnum.length >= 5) {
        if (lAlnum.startsWith(targetAlnum) || targetAlnum.startsWith(lAlnum)) {
          scored.push({ ledger, score: 97, tag: 'Prefix Match' });
          continue;
        }
      }

      // 4. Substring containment — one fully inside the other
      if (targetAlnum.length >= 5 && lAlnum.length >= 5) {
        if (lAlnum.includes(targetAlnum) || targetAlnum.includes(lAlnum)) {
          scored.push({ ledger, score: 96, tag: 'Substring Match' });
          continue;
        }
      }

      // 5. ALL significant words match — every word from target must appear
      if (targetWords.length >= 1) {
        const allMatch = targetWords.every(tw =>
          lWords.some(lw => lw === tw || lw.startsWith(tw) || tw.startsWith(lw) || lw.includes(tw) || tw.includes(lw))
        );
        if (allMatch) {
          const coverage = targetWords.length / Math.max(lWords.length, 1);
          const score = Math.round(95 + Math.min(4, coverage * 4));
          scored.push({ ledger, score: 95, tag: 'Word Match' });
          continue;
        }
      }

      // 6. Jaro-Winkler — threshold 0.70+ for broad auto-mapping
      if (targetLower.length >= 4 && lLower.length >= 4) {
        const jwRaw = jaroWinkler(targetLower, lLower);
        const jwAlnum = targetAlnum.length >= 4 && lAlnum.length >= 4
          ? jaroWinkler(targetAlnum, lAlnum) : 0;
        const bestJw = Math.max(jwRaw, jwAlnum);
        if (bestJw >= 0.70) {
          const jwScore = Math.round(bestJw * 100);
          scored.push({
            ledger,
            score: jwScore,
            tag: `${jwScore}% Match`
          });
        }
      }
    }

    // Sort desc by score — show all >= 70 (user requested 70% threshold)
    scored.sort((a, b) => b.score - a.score);
    const seen = new Set();
    const result = [];
    for (const item of scored) {
      if (item.score < 70) break;
      if (!seen.has(item.ledger)) {
        seen.add(item.ledger);
        result.push(item);
        if (result.length >= 8) break; // cap at 8 recommendations
      }
    }
    return result;
  }, [isOpen, hasSelected, rawLedgerList, extractedParty]);

  // Compute filtered full ledger list based on search query (LAZY: only when opened)
  const filteredLedgers = useMemo(() => {
    if (!isOpen) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rawLedgerList;
    return rawLedgerList.filter(l => l.toLowerCase().includes(q));
  }, [isOpen, rawLedgerList, searchQuery]);

  // Combined flat list for keyboard navigation (LAZY: only when opened)
  const flatSelectableItems = useMemo(() => {
    if (!isOpen) return [];
    const items = [];
    if (onAddRule) {
      items.push({ type: 'action', value: '__ADD_RULE__', label: '+ Add Rule for this Bank...' });
    }
    recommendations.forEach(r => {
      items.push({ type: 'recommendation', value: r.ledger, label: r.ledger, tag: r.tag, score: r.score });
    });
    filteredLedgers.slice(0, 100).forEach(l => {
      if (!recommendations.some(r => r.ledger === l)) {
        items.push({ type: 'ledger', value: l, label: l });
      }
    });
    return items;
  }, [isOpen, onAddRule, recommendations, filteredLedgers]);

  // Open & calculate popover position relative to trigger button
  const handleOpen = () => {
    if (disabled) return;
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropdownHeight = 320; // approximate max dropdown height
      const openUpwards = spaceBelow < dropdownHeight && rect.top > dropdownHeight;

      setDropdownPos({
        top: openUpwards ? Math.max(10, rect.top - dropdownHeight - 4) : rect.bottom + 4,
        left: Math.max(10, Math.min(rect.left, window.innerWidth - 360)),
        width: Math.max(320, rect.width)
      });
    }
    setSearchQuery('');
    setHighlightedIndex(0);
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleSelect = (ledgerName) => {
    if (ledgerName === '__ADD_RULE__') {
      if (onAddRule) onAddRule();
    } else {
      if (onChange) onChange(ledgerName);
    }
    handleClose();
  };

  // Keyboard navigation inside dropdown
  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        handleOpen();
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      handleClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev + 1 < flatSelectableItems.length ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev - 1 >= 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flatSelectableItems[highlightedIndex]) {
        handleSelect(flatSelectableItems[highlightedIndex].value);
      }
    }
  };

  // Focus input automatically when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Close dropdown on outside click or window resize only (NOT on scroll inside the dropdown)
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e) => {
      if (triggerRef.current && triggerRef.current.contains(e.target)) return;
      if (listRef.current && listRef.current.contains(e.target)) return;
      handleClose();
    };

    const handleScroll = (e) => {
      // Only close if the scroll happened OUTSIDE the dropdown panel itself
      if (listRef.current && listRef.current.contains(e.target)) return;
      handleClose();
    };

    const handleWindowResize = () => handleClose();

    window.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleWindowResize);
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('scroll', handleWindowResize, true);
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [isOpen]);

  const isHighConfidence = Number(confidence) >= 90;

  return (
    <div className={`relative w-full ${className}`}>
      {/* Trigger Button */}
      <div
        ref={triggerRef}
        onClick={handleOpen}
        onKeyDown={handleKeyDown}
        tabIndex={disabled ? -1 : 0}
        role="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`group w-full h-7 px-2 rounded-md text-[11px] font-bold border flex items-center justify-between gap-1 transition-all outline-none cursor-pointer ${
          disabled
            ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800'
            : hasSelected
              ? 'bg-[var(--app-panel-bg)] text-[var(--app-heading)] border-[var(--app-border)] hover:border-[#2563EB]'
              : 'bg-amber-50/70 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-800 hover:border-amber-400'
        } focus:border-[#2563EB]`}
      >
        <div className="flex items-center gap-1 min-w-0 flex-1">
          {hasSelected ? (
            <span className="truncate font-black tracking-tight block text-[var(--app-heading)]">
              {value}
            </span>
          ) : (
            <span className="text-amber-600 dark:text-amber-400 font-bold truncate block text-[10.5px]">
              {placeholder || '-- Select Master Party Ledger --'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <ChevronDown
            size={13}
            className={`${hasSelected ? 'text-[var(--app-muted)]' : 'text-amber-500'} transition-transform duration-150 ${isOpen ? 'rotate-180 text-[#2563EB]' : ''}`}
          />
        </div>
      </div>

      {/* Warning/Review Reason if Unmapped */}
      {!hasSelected && reviewReason && (
        <div className="text-[9px] text-amber-600 dark:text-amber-400 font-medium truncate mt-0.5 max-w-[240px] flex items-center gap-1" title={reviewReason}>
          <span className="text-[8px] leading-none shrink-0">▲</span>
          <span className="truncate">{reviewReason}</span>
        </div>
      )}

      {/* Floating Dropdown Menu rendered via Portal into body to escape overflow clipping */}
      {isOpen &&
        createPortal(
          <div
            ref={listRef}
            style={{
              position: 'fixed',
              top: `${dropdownPos.top}px`,
              left: `${dropdownPos.left}px`,
              width: `${dropdownPos.width}px`,
              zIndex: 9999
            }}
            className="bg-[var(--app-panel-bg)] border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-80 border-slate-300 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-100"
          >
            {/* Search Input Header */}
            <div className="p-2 border-b bg-[var(--app-content-bg)]/60" style={{ borderColor: 'var(--app-border)' }}>
              <div className="relative flex items-center">
                <Search size={13} className="text-[var(--app-muted)] absolute left-2.5 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Search ${rawLedgerList.length} Tally master ledgers...`}
                  className="w-full h-8 pl-8 pr-7 text-xs font-semibold rounded-lg border outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] placeholder:text-[var(--app-muted)] focus:border-[#2563EB]"
                  style={{ borderColor: 'var(--app-border)' }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 p-0.5 text-[var(--app-muted)] hover:text-[var(--app-heading)]"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable Options List */}
            <div className="overflow-y-auto flex-1 p-1 divide-y divide-[var(--app-border)]/40">
              {/* Optional: Add Rule Action */}
              {onAddRule && (
                <div className="pb-1">
                  <button
                    type="button"
                    onClick={() => handleSelect('__ADD_RULE__')}
                    className="w-full px-2.5 py-1.5 rounded-lg text-left text-xs font-black text-[#2563EB] hover:bg-blue-500/10 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Plus size={13} className="shrink-0" />
                    <span>+ Add Reusable Rule for this Bank...</span>
                  </button>
                </div>
              )}

              {/* Section 1: AI Recommended Matches */}
              {recommendations.length > 0 && !searchQuery && (
                <div className="py-1">
                  <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Sparkles size={11} /> Top AI Recommendations
                    </span>
                    <span className="text-[9px] text-[var(--app-muted)] font-mono">
                      for "{extractedParty || 'Transaction'}"
                    </span>
                  </div>
                  {recommendations.map((rec) => {
                    const isSelected = value === rec.ledger;
                    return (
                      <button
                        key={`rec-${rec.ledger}`}
                        type="button"
                        onClick={() => handleSelect(rec.ledger)}
                        className={`w-full px-2.5 py-1.5 rounded-lg text-left text-xs font-bold transition-all flex items-center justify-between group cursor-pointer ${
                          isSelected
                            ? 'bg-[#2563EB] text-white shadow-xs'
                            : 'hover:bg-emerald-500/10 text-[var(--app-heading)]'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="truncate">{rec.ledger}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider shrink-0 ${
                              isSelected
                                ? 'bg-white/20 text-white'
                                : rec.score >= 98
                                  ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30'
                                  : 'bg-blue-500/15 text-blue-600 border border-blue-500/30'
                            }`}
                          >
                            {rec.tag}
                          </span>
                        </div>
                        {isSelected && <Check size={14} className="shrink-0 text-white" />}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Section 2: All Master Ledgers (Filtered) */}
              <div className="py-1">
                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--app-muted)] flex items-center justify-between">
                  <span>Master Ledgers</span>
                  <span className="font-mono text-[9.5px]">
                    {filteredLedgers.length} of {rawLedgerList.length}
                  </span>
                </div>

                {filteredLedgers.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-[var(--app-muted)]">
                    No matching ledgers found for "{searchQuery}"
                  </div>
                ) : (
                  filteredLedgers.slice(0, 100).map((ledger) => {
                    const isSelected = value === ledger;
                    return (
                      <button
                        key={ledger}
                        type="button"
                        onClick={() => handleSelect(ledger)}
                        className={`w-full px-2.5 py-1.5 rounded-lg text-left text-xs font-bold transition-colors flex items-center justify-between group cursor-pointer ${
                          isSelected
                            ? 'bg-[#2563EB] text-white shadow-xs'
                            : 'hover:bg-[var(--app-control-hover)] text-[var(--app-heading)]'
                        }`}
                      >
                        <span className="truncate flex-1">{ledger}</span>
                        {isSelected && <Check size={14} className="shrink-0 text-white" />}
                      </button>
                    );
                  })
                )}
                {filteredLedgers.length > 100 && (
                  <div className="px-3 py-1.5 text-center text-[10px] font-semibold text-[var(--app-muted)] italic">
                    Type to search among {filteredLedgers.length - 100} more ledgers...
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

export default React.memo(SmartLedgerDropdown);
