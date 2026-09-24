import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Landmark, Layers, GitBranch, Search, Filter, ChevronDown, ChevronRight,
  CheckCircle2, AlertCircle, Sparkles, Plus, Check, X, RefreshCw,
  MoreVertical, ArrowLeft, Eye, Edit3, Trash2, Sliders, FileText, CheckCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import bankRulesApi from '../../services/bankRulesApi';
import bankStatementAiApi from '../../services/bankStatementAiApi';
import SmartLedgerDropdown, { findBestLedgerMatch } from './SmartLedgerDropdown';

// Memory cache so returning to Ledger Mapping tab or switching bank accounts is 0ms instant without re-analyzing
const ledgerMappingsCache = new Map();
const patternRulesCache = new Map();
const partyLedgerOverridesCache = new Map();
const customPatternIndexesCache = new Map();
const appliedPatternIdsCache = new Map();

export const getBankPrefix = (bankLedger) => {
  if (!bankLedger) return 'BANK';
  const u = String(bankLedger).toUpperCase();
  for (const code of ['ICICI', 'HDFC', 'KOTAK', 'SBI', 'AXIS', 'PNB', 'BOB', 'BOI', 'CANARA', 'UNION', 'YES', 'INDUSIND', 'IDFC', 'FEDERAL']) {
    if (u.includes(code)) return code;
  }
  const words = u.match(/[A-Za-z0-9]+/g) || [];
  for (const w of words) {
    if (!['BANK', 'ACCOUNT', 'AC', 'DR', 'CR', 'LIMITED', 'LTD', 'PVT', 'CURRENT'].includes(w)) {
      return w.slice(0, 6);
    }
  }
  return (words[0] || 'BANK').slice(0, 6);
};

const reDigitsCount = (str) => (String(str).match(/\d/g) || []).length;

export const BANK_STOP_WORDS = new Set([
  'BANK', 'NEFT', 'RTGS', 'UPI', 'IMPS', 'CLG', 'CTS', 'CHQ', 'CHEQUE',
  'TRANSFER', 'PAYMENT', 'RECEIVED', 'TRF', 'INFT', 'INF', 'IFT', 'PAID',
  'LTD', 'PVT', 'PVTLTD', 'LIMITED', 'PRIVATE', 'CR', 'DR', 'TXN', 'REF',
  'RRN', 'MOB', 'NA', 'NIL', 'NULL', 'BY', 'TO', 'FOR', 'INR', 'SUCCESS', 'SETTLEMENT', 'CHARGES',
  'PAY', 'CLEAR', 'AS', 'ON', 'PAY CLEAR', 'PAY CLEAR AS ON', 'FEE', 'FEES', 'TAX', 'GST', 'SMS',
  'INTEREST', 'INT', 'SAVINGS', 'MONTHLY', 'REVERSAL', 'RETURN', 'CHARGEBACK', 'SLB', 'SLBL', 'SLBN',
  'SELF', 'OWN', 'A/C', 'ACC', 'ACCOUNT'
]);

export const isStopPhrase = (str) => {
  if (!str) return true;
  const clean = str.trim().toUpperCase();
  if (BANK_STOP_WORDS.has(clean)) return true;
  const words = clean.split(/[\s_-]+/);
  return words.length > 0 && words.every(w => BANK_STOP_WORDS.has(w));
};

export const analyzeNarrationTokens = (narration) => {
  if (!narration) return { sep: '/', skeleton: 'TRANSACTION PATTERN', channel: 'OTHER', txnIdPos: -1, txnIdRegex: '\\d+', partyPos: -1, otherFields: [], tokens: [] };
  const s = narration.trim();
  const candSeps = ['/', '-', ':', '|', ';'];
  let bestSep = '/';
  let maxCount = 0;
  for (const sep of candSeps) {
    const cnt = s.split(sep).length - 1;
    if (cnt > maxCount) {
      maxCount = cnt;
      bestSep = sep;
    }
  }
  const sep = maxCount >= 2 ? bestSep : (s.includes('/') ? '/' : (s.includes('-') ? '-' : (s.includes(' ') ? ' ' : '/')));
  const rawParts = sep === ' ' ? s.split(/\s+/).filter(Boolean) : s.split(sep).map(p => p.trim()).filter(Boolean);

  let channel = 'OTHER';
  const u = s.toUpperCase();
  if (u.includes('UPI') || u.includes('@') || u.includes('PAYTM') || u.includes('BHIM') || u.includes('GPAY') || u.includes('PHONEPE')) channel = 'UPI';
  else if (u.includes('NEFT')) channel = 'NEFT';
  else if (u.includes('RTGS')) channel = 'RTGS';
  else if (u.includes('IMPS') || u.includes('MMT')) channel = 'IMPS';
  else if (u.includes('CLG')) channel = 'CLG';
  else if (u.includes('CTS') || u.includes('CHQ') || u.includes('CHEQUE')) channel = 'CHQ';
  else if (u.includes('INF') || u.includes('INFT') || u.includes('TRF') || u.includes('TRANSFER')) channel = 'TRANSFER';
  else if (u.includes('SALARY') || u.includes('SAL/')) channel = 'SALARY';
  else if (u.includes('REFUND') || u.includes('REV') || u.includes('REVERSAL')) channel = 'REFUND';
  else if (u.includes('CHG') || u.includes('CHARGE') || u.includes('FEE') || u.includes('GST') || u.includes('SMS')) channel = 'CHARGES';
  else if (u.includes('INT') || u.includes('INTEREST')) channel = 'INTEREST';
  else if (u.includes('CASH') || u.includes('CDM') || u.includes('CWDR')) channel = 'CASH';
  else if (u.includes('ATM') || u.includes('NFS')) channel = 'ATM';
  else if (u.includes('POS') || u.includes('SWIPE') || u.includes('ECOM')) channel = 'POS';
  else if (u.includes('NACH') || u.includes('ACH')) channel = 'NACH';
  else if (u.includes('ECS')) channel = 'ECS';

  const roles = new Array(rawParts.length).fill(null);
  let txnIdPos = -1;
  let txnIdRegex = '\\d+';
  let partyPos = -1;

  rawParts.forEach((p, idx) => {
    const pu = p.toUpperCase();
    if (['UPI', 'NEFT', 'RTGS', 'IMPS', 'MMT', 'CLG', 'CTS', 'CHQ', 'INFT', 'INF', 'TRF', 'POS', 'ATM', 'ACH', 'NACH'].includes(pu)) {
      roles[idx] = 'CHANNEL';
    }
  });

  rawParts.forEach((p, idx) => {
    if (!roles[idx] && p.includes('@')) roles[idx] = 'VPA';
  });

  rawParts.forEach((p, idx) => {
    if (!roles[idx]) {
      const pu = p.toUpperCase();
      if (/^[A-Z]{4}0[A-Z0-9]{6}$/.test(pu)) roles[idx] = 'IFSC';
      else if (/^[A-Z]{3,4}$/.test(pu) && ['ICIC', 'HDFC', 'SBIN', 'UTIB', 'KKBK', 'PUNB', 'BARB', 'YESB', 'AXIS', 'SBI'].includes(pu)) roles[idx] = 'BANK_CODE';
    }
  });

  for (let idx = 0; idx < rawParts.length; idx++) {
    if (!roles[idx]) {
      const p = rawParts[idx].trim();
      const digitCount = (p.match(/\d/g) || []).length;
      const letterCount = (p.match(/[A-Za-z]/g) || []).length;
      const hasSpaces = p.includes(' ');

      if (/^\d{12}$/.test(p)) {
        roles[idx] = 'TXN_ID';
        txnIdPos = idx;
        txnIdRegex = '\\d{12}';
        break;
      } else if (/^[A-Z]{4}[0-9A-Z]{7,18}$/i.test(p)) {
        roles[idx] = 'TXN_ID';
        txnIdPos = idx;
        txnIdRegex = '[A-Z]{4}[0-9A-Z]+';
        break;
      } else if (/^\d{6,18}$/.test(p)) {
        roles[idx] = 'TXN_ID';
        txnIdPos = idx;
        txnIdRegex = '\\d+';
        break;
      } else if (!hasSpaces && (digitCount >= 4 || (digitCount >= 2 && letterCount >= 1 && p.length >= 8)) && /^[A-Za-z0-9_-]{6,35}$/.test(p)) {
        roles[idx] = 'TXN_ID';
        txnIdPos = idx;
        txnIdRegex = '[A-Za-z0-9_-]+';
        break;
      }
    }
  }

  const candParties = [];
  rawParts.forEach((p, idx) => {
    if (!roles[idx]) {
      const pTrim = p.trim();
      const digitCount = (pTrim.match(/\d/g) || []).length;
      const letterCount = (pTrim.match(/[A-Za-z]/g) || []).length;
      const hasLetters = letterCount > 0;
      const isStop = isStopPhrase(pTrim);

      // Party candidate must NOT be an alphanumeric reference code (e.g. 0807i..., POD119..., N2232...)
      // A reference code has >= 4 digits or digits >= letters without spaces
      const isRefCode = !pTrim.includes(' ') && (digitCount >= 4 || (digitCount > 0 && digitCount >= letterCount && pTrim.length >= 6));

      if (hasLetters && !isStop && !isRefCode && pTrim.length >= 2) {
        const hasSpaces = pTrim.includes(' ');
        // Score: multi-word names or names with spaces have high party priority
        const score = (hasSpaces ? 50 : 0) + letterCount - (digitCount * 5);
        candParties.push({ idx, text: pTrim, score, hasSpaces, letterCount });
      }
    }
  });

  if (candParties.length > 0) {
    if (channel === 'UPI' && txnIdPos >= 0) {
      const afterTxn = candParties.filter(c => c.idx > txnIdPos);
      if (afterTxn.length > 0) {
        afterTxn.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.idx - b.idx));
        partyPos = afterTxn[0].idx;
      } else {
        candParties.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.idx - b.idx));
        partyPos = candParties[0].idx;
      }
      roles[partyPos] = 'PARTY';
    } else {
      candParties.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.idx - b.idx));
      partyPos = candParties[0].idx;
      roles[partyPos] = 'PARTY';
    }
  }

  const otherFields = [];
  const skeletonParts = [];
  const tokens = [];

  rawParts.forEach((p, idx) => {
    const r = roles[idx];
    let skel = p;
    let type = 'FIXED';
    let role = 'Static Token';
    if (r === 'CHANNEL') {
      skel = p.toUpperCase();
      type = 'CHANNEL';
      role = 'Transaction Channel';
    } else if (r === 'TXN_ID') {
      skel = channel === 'NEFT' || channel === 'RTGS' ? '{UTR}' : '{TxnId}';
      type = 'TXN_ID';
      role = 'Transaction ID / Reference';
    } else if (r === 'PARTY') {
      skel = '{Party}';
      type = 'PARTY';
      role = 'Party / Ledger Candidate';
    } else if (r === 'VPA') {
      skel = '{VPA}';
      type = 'VPA';
      role = 'Virtual Payment Address';
      otherFields.push({ token: idx, label: 'VPA', type: 'VPA' });
    } else if (r === 'IFSC') {
      skel = '{IFSC}';
      type = 'IFSC';
      role = 'Bank IFSC Code';
      otherFields.push({ token: idx, label: 'IFSC', type: 'IFSC' });
    } else if (r === 'BANK_CODE') {
      skel = '{BankCode}';
      type = 'BANK_CODE';
      role = 'Bank Identifier';
      otherFields.push({ token: idx, label: 'Bank Code', type: 'BANK_CODE' });
    } else if (/\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/.test(p)) {
      skel = '{Date}';
      type = 'DATE';
      role = 'Transaction Date';
      otherFields.push({ token: idx, label: 'Date', type: 'DATE' });
    } else if (/^\d{9,}$/.test(p) || (reDigitsCount(p) >= 8 && /^\d{4,}[A-Za-z0-9]+$/i.test(p))) {
      skel = '{AccNo}';
      type = 'ACC_NO';
      role = 'Account / System Number';
      otherFields.push({ token: idx, label: 'Account No', type: 'ACC_NO' });
    } else if (/^\d+$/.test(p)) {
      skel = '{Number}';
      type = 'NUMBER';
      role = 'Numeric Code';
      otherFields.push({ token: idx, label: 'Number', type: 'NUMBER' });
    } else {
      skel = '{Remittance}';
      type = 'REMITTANCE';
      role = 'Remittance / Remark';
      otherFields.push({ token: idx, label: 'Remittance', type: 'REMITTANCE' });
    }
    skeletonParts.push(skel);
    tokens.push({
      index: idx,
      name: skel,
      type,
      role,
      isParty: idx === partyPos,
      isTxnId: idx === txnIdPos,
      sampleValue: p
    });
  });

  return {
    sep,
    channel,
    skeleton: skeletonParts.join(` ${sep} `),
    structSig: `${sep}__party${partyPos}`,
    txnIdPos,
    txnIdRegex,
    partyPos,
    otherFields,
    tokens
  };
};

// High-speed memoization cache for narration tokenization
const narrationAnalysisCache = new Map();
function getCachedNarrationAnalysis(narr) {
  if (!narr) return analyzeNarrationTokens('');
  let cached = narrationAnalysisCache.get(narr);
  if (!cached) {
    cached = analyzeNarrationTokens(narr);
    narrationAnalysisCache.set(narr, cached);
  }
  return cached;
}

// Default Indian Banking Transaction Taxonomy from bank.json (Taxonomy only - patterns & positions are dynamically discovered from uploaded statement)
export const DEFAULT_TRANSACTION_TYPES = [
  { type: 'UPI', label: 'UPI', desc: 'Unified Payments Interface (P2P / P2M / VPA)' },
  { type: 'NEFT', label: 'NEFT', desc: 'National Electronic Fund Transfer' },
  { type: 'RTGS', label: 'RTGS', desc: 'Real Time Gross Settlement (High Value)' },
  { type: 'IMPS', label: 'IMPS', desc: 'Immediate Payment Service (MMT / IMPS)' },
  { type: 'TRANSFER', label: 'TRANSFER', desc: 'Internal / Fund Transfer (INF / INFT / TRF)' },
  { type: 'CLG', label: 'CLG', desc: 'Cheque Clearing / CTS Outward & Inward' },
  { type: 'CHQ', label: 'CHEQUE', desc: 'Cheque Issuance / Deposit / Clearing' },
  { type: 'NACH', label: 'NACH', desc: 'National Automated Clearing House (SIP / EMI)' },
  { type: 'ECS', label: 'ECS', desc: 'Electronic Clearing Service (Mandate)' },
  { type: 'CASH', label: 'CASH', desc: 'Cash Deposit / CDM / CWDR / Cash Branch' },
  { type: 'ATM', label: 'ATM', desc: 'ATM Cash Withdrawal / NFS' },
  { type: 'POS', label: 'POS / CARD', desc: 'Point of Sale / Debit Card Swipe / ECOM' },
  { type: 'CHARGES', label: 'CHARGES', desc: 'Bank Service Charges, SMS & GST' },
  { type: 'INTEREST', label: 'INTEREST', desc: 'Bank Interest Credit (Savings / FD)' },
  { type: 'SALARY', label: 'SALARY', desc: 'Salary Credit / Corporate Disbursement' },
  { type: 'REFUND', label: 'REFUND', desc: 'Refund / Reversal / Chargeback' },
  { type: 'OTHER', label: 'OTHER', desc: 'Miscellaneous Bank Transactions' }
];

const LedgerMappingRow = React.memo(function LedgerMappingRow({
  row,
  onSelectLedger,
  normalizedAllLedgers,
  isUpdating
}) {
  const conf = Number(row.confidence) || 0;
  const partyText = row.extractedParty || row.extractedPattern || '—';

  const handleLedgerChange = useCallback((newVal) => {
    if (onSelectLedger) onSelectLedger(row, newVal);
  }, [row, onSelectLedger]);

  // Determine whether System Auto vs User Verified (2 bases requested by user)
  const isUserVerified = row.mappingMethod === 'User Confirmed' || 
                         row.mappingMethod === 'User Mapped' || 
                         row.mappingMethod === 'User Verified' ||
                         row.isUserEdited ||
                         row.status === 'user_edited' ||
                         row.status === 'saved';

  const hasLedger = !!(row.suggestedLedger && row.suggestedLedger !== 'Unmapped');

  return (
    <tr className="hover:bg-blue-50/20 transition-colors">
      {/* Column 1: EXTRACTED PARTY ONLY (No other information) */}
      <td className="py-2 px-3 align-middle">
        <span className="text-xs font-bold text-slate-900 tracking-tight block truncate max-w-[230px]" title={partyText}>
          {partyText}
        </span>
      </td>

      {/* Column 2: DESCRIPTION / NARRATION */}
      <td className="py-2 px-3 align-middle">
        <span className="font-mono text-[10.5px] text-slate-600 block break-words line-clamp-2 leading-tight" title={row.narration}>
          {row.narration || row.sampleNarration || '—'}
        </span>
      </td>

      {/* Column 3: LEDGER SELECTION (Smart Dropdown) */}
      <td className="py-2 px-3 align-middle">
        <div className="min-w-[180px] max-w-[280px]">
          <SmartLedgerDropdown
            value={row.suggestedLedger || ''}
            onChange={handleLedgerChange}
            options={normalizedAllLedgers}
            extractedParty={partyText}
            narration={row.narration}
            voucherType={row.voucherType}
            confidence={row.confidence}
            disabled={isUpdating}
          />
        </div>
      </td>

      {/* Column 4: CONFIDENCE SCORE */}
      <td className="py-2 px-3 text-center align-middle">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold font-mono border shadow-2xs ${
            conf >= 90
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : conf >= 60
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${conf >= 90 ? 'bg-emerald-500' : conf >= 60 ? 'bg-amber-500' : 'bg-rose-500'}`} />
          <span>{conf}%</span>
        </span>
      </td>

      {/* Column 5: MAPPING METHOD (2 bases: System Auto vs User Verified) */}
      <td className="py-2 px-3 text-center align-middle">
        {isUserVerified ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs">
            <Check size={11} strokeWidth={2.5} />
            <span>User Verified</span>
          </span>
        ) : hasLedger ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
            <Sparkles size={11} />
            <span>System (Auto)</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
            <span>Unmapped</span>
          </span>
        )}
      </td>
    </tr>
  );
});

export default function BankRuleMappingModal({
  isOpen = true,
  onClose,
  currentBankLedger,
  availableBankLedgers = [],
  allLedgersList = [],
  batchId,
  initialMappings = null,
  onRulesApplied
}) {
  // Shared context for both tabs
  const [selectedBankLedger, setSelectedBankLedger] = useState(
    currentBankLedger || availableBankLedgers[0] || 'BANK AC'
  );
  const [isBankSelectorOpen, setIsBankSelectorOpen] = useState(false);

  // Main navigation: exactly TWO tabs
  const [activeTab, setActiveTab] = useState('ledger_mapping'); // 'ledger_mapping' | 'pattern_mapping'

  // --- TAB 1: LEDGER MAPPING STATE ---
  const [ledgerMappings, setLedgerMappings] = useState(() => {
    if (initialMappings && initialMappings.length > 0) return initialMappings;
    const cached = ledgerMappingsCache.get(currentBankLedger || 'default');
    return cached || [];
  });
  const [loadingLedgerMappings, setLoadingLedgerMappings] = useState(() => {
    if (initialMappings && initialMappings.length > 0) return false;
    const cached = ledgerMappingsCache.get(currentBankLedger || 'default');
    return !cached;
  });
  const [mappingSearch, setMappingSearch] = useState('');
  const [mappingFilter, setMappingFilter] = useState('all'); // all, mapped, unmapped, confirmed
  const [expandedRows, setExpandedRows] = useState({});
  const [updatingPatternId, setUpdatingPatternId] = useState(null);
  const [mappingPage, setMappingPage] = useState(1);
  const [mappingPageSize, setMappingPageSize] = useState('all');

  // --- TAB 2: PATTERN MAPPING STATE ---
  const [rules, setRules] = useState(() => {
    const cached = patternRulesCache.get(currentBankLedger || 'default');
    return cached?.rules || [];
  });
  const [suggestions, setSuggestions] = useState(() => {
    const cached = patternRulesCache.get(currentBankLedger || 'default');
    return cached?.suggestions || [];
  });
  const [loadingPatterns, setLoadingPatterns] = useState(() => {
    const cached = patternRulesCache.get(currentBankLedger || 'default');
    return !cached;
  });
  const [patternSearch, setPatternSearch] = useState('');
  const [patternFilter, setPatternFilter] = useState('all'); // all, system, bank_specific, customer_custom, ai_discovered, unmapped
  const [patternPage, setPatternPage] = useState(1);
  const [patternPageSize, setPatternPageSize] = useState(25);

  // Stable normalized array of ledgers for 0-overhead SmartLedgerDropdown rendering
  const normalizedAllLedgers = useMemo(() => {
    if (!allLedgersList || allLedgersList.length === 0) return [];
    if (typeof allLedgersList[0] === 'string') return allLedgersList;
    return Array.from(
      new Set(
        allLedgersList.map(l => (typeof l === 'object' ? l.name || l.ledgerName : l)).filter(Boolean)
      )
    );
  }, [allLedgersList]);

  // Hierarchy & Interactive Token Indexing state
  const [selectedTxnType, setSelectedTxnType] = useState('ALL');
  const [customPatternIndexes, setCustomPatternIndexes] = useState(() => {
    return customPatternIndexesCache.get(currentBankLedger || 'default') || {};
  });
  const [partyLedgerOverrides, setPartyLedgerOverrides] = useState(() => {
    return partyLedgerOverridesCache.get(currentBankLedger || 'default') || {};
  });
  const [inspectingPartyModal, setInspectingPartyModal] = useState(null);

  // Pattern Mapping UI state matching layout
  const [selectedPatternId, setSelectedPatternId] = useState(null);
  const [appliedPatternIds, setAppliedPatternIds] = useState(() => {
    return appliedPatternIdsCache.get(currentBankLedger || 'default') || new Set(['NEFT', 'CLG']);
  });
  const [patternStatusFilter, setPatternStatusFilter] = useState('all'); // all, applied, not_applied
  const [hoveredPartyNarrations, setHoveredPartyNarrations] = useState(null);
  const [expandedPartyNarrations, setExpandedPartyNarrations] = useState(null);

  // Sync caches when selectedBankLedger changes
  useEffect(() => {
    const key = selectedBankLedger || 'default';
    if (customPatternIndexesCache.has(key)) {
      setCustomPatternIndexes(customPatternIndexesCache.get(key));
    }
    if (partyLedgerOverridesCache.has(key)) {
      setPartyLedgerOverrides(partyLedgerOverridesCache.get(key));
    }
    if (appliedPatternIdsCache.has(key)) {
      setAppliedPatternIds(appliedPatternIdsCache.get(key));
    }
  }, [selectedBankLedger]);

  const handleUpdatePatternIndex = (patId, field, newIndex) => {
    setCustomPatternIndexes(prev => {
      const next = {
        ...prev,
        [patId]: {
          ...(prev[patId] || {}),
          [field]: Number(newIndex)
        }
      };
      customPatternIndexesCache.set(selectedBankLedger || 'default', next);
      return next;
    });
  };

  const handlePartyLedgerOverride = (patId, partyName, ledgerName) => {
    setPartyLedgerOverrides(prev => {
      const next = {
        ...prev,
        [`${patId}_${partyName}`]: ledgerName
      };
      partyLedgerOverridesCache.set(selectedBankLedger || 'default', next);
      return next;
    });
  };

  const getEffectivePatternData = (pat) => {
    const custom = customPatternIndexes[pat.id];
    let partyPos = custom?.partyPosition !== undefined ? custom.partyPosition : (pat.partyPosition !== undefined ? pat.partyPosition : -1);
    const txnIdPos = custom?.txnIdPosition !== undefined ? custom.txnIdPosition : (pat.txnIdPosition !== undefined ? pat.txnIdPosition : -1);
    const vpaPos = custom?.vpaPosition !== undefined ? custom.vpaPosition : (pat.vpaPosition !== undefined ? pat.vpaPosition : -1);

    const txns = pat.transactions || [];
    const sep = (pat.separator && pat.separator.includes(',')) ? pat.separator.split(',')[0].trim() : (pat.separator || '/');

    // Auto Reverse-Index Matching: If user hasn't explicitly set party position,
    // evaluate each token index against master ledgers and pick the index that matches most frequently
    if (custom?.partyPosition === undefined && txns.length > 0 && normalizedAllLedgers.length > 0) {
      const posScores = {};
      const sampleTxns = txns.slice(0, 25);
      sampleTxns.forEach(tx => {
        const narr = tx.narration || tx.sampleNarration || tx.raw_narration || '';
        if (!narr) return;
        const txAnalysis = getCachedNarrationAnalysis(narr);
        const txSep = txAnalysis.sep || sep;
        const parts = txSep === ' ' ? narr.trim().split(/\s+/) : narr.split(txSep);
        parts.forEach((p, idx) => {
          const pTrim = p.trim();
          if (pTrim.length >= 3 && !isStopPhrase(pTrim) && /[a-z]/i.test(pTrim)) {
            const m = findBestLedgerMatch(pTrim, normalizedAllLedgers);
            if (m && m.score >= 70) {
              posScores[idx] = (posScores[idx] || 0) + (m.score >= 90 ? 10 : 5);
            }
          }
        });
      });
      const sortedPos = Object.entries(posScores).sort((a, b) => b[1] - a[1]);
      if (sortedPos.length > 0 && sortedPos[0][1] >= 10) {
        partyPos = Number(sortedPos[0][0]);
      }
    }

    // Calculate sample narration tokens to safely clamp partyPos within existing bounds
    const sampleNarrForClamp = (pat.raw?.sampleNarrations && pat.raw.sampleNarrations[0]) ||
      (txns && txns[0]?.narration) || pat.pattern || '';
    const actualParts = sampleNarrForClamp ? (sep === ' ' ? sampleNarrForClamp.trim().split(/\s+/) : sampleNarrForClamp.split(sep).map(s => s.trim())) : [];
    const actualTokenCount = actualParts.length;

    // Safety clamp: partyPos must NEVER exceed the actual token count of the narration
    if (actualTokenCount > 0 && (partyPos >= actualTokenCount || partyPos < 0)) {
      let bestPos = -1;
      let bestScore = -1;
      actualParts.forEach((p, idx) => {
        const pTrim = p.trim();
        if (pTrim.length >= 3 && !isStopPhrase(pTrim) && /[a-z]/i.test(pTrim)) {
          const m = findBestLedgerMatch(pTrim, normalizedAllLedgers);
          const score = m ? m.score : 0;
          if (score > bestScore) {
            bestScore = score;
            bestPos = idx;
          }
        }
      });
      partyPos = bestPos >= 0 ? bestPos : (actualTokenCount > 3 ? 3 : 0);
    }

    let sampleParty = pat.extractedParty || '';
    let partiesList = pat.distinctParties || [];

    if (txns.length > 0) {
      const partyMap = {};
      txns.forEach(tx => {
        const narr = tx.narration || tx.sampleNarration || tx.raw_narration || '';
        const txAnalysis = getCachedNarrationAnalysis(narr);
        const txSep = txAnalysis.sep || sep;
        const parts = txSep === ' ' ? narr.trim().split(/\s+/) : narr.split(txSep);
        let pCand = (partyPos >= 0 && partyPos < parts.length) ? parts[partyPos].trim() : '';
        if (pCand && pCand.length >= 2) {
          if (!partyMap[pCand]) {
            const overrideKey = `${pat.id}_${pCand}`;
            const userOverride = partyLedgerOverrides[overrideKey];
            const txMapped = tx.mappedLedger || tx.partyLedger || tx.suggestedLedger;
            const validTxMapped = (txMapped && txMapped !== 'Unmapped') ? txMapped : null;
            const match = findBestLedgerMatch(pCand, normalizedAllLedgers);

            let initialLedger = 'Unmapped';
            let initialConf = 0;

            if (userOverride) {
              initialLedger = userOverride;
              initialConf = 100;
            } else if (isStopPhrase(pCand) || !/[a-z]/i.test(pCand)) {
              initialLedger = 'Unmapped';
              initialConf = 0;
            } else if (match && match.score >= 70) {
              initialLedger = match.ledger;
              initialConf = match.score;
            } else if (validTxMapped && /[a-z]/i.test(pCand)) {
              const pLow = pCand.toLowerCase().replace(/[^a-z0-9]/g, '');
              const txLow = validTxMapped.toLowerCase().replace(/[^a-z0-9]/g, '');
              if (pLow.length >= 4 && (txLow.includes(pLow) || pLow.includes(txLow))) {
                const ratio = Math.min(pLow.length, txLow.length) / Math.max(pLow.length, txLow.length);
                if (ratio >= 0.4) {
                  initialLedger = validTxMapped;
                  initialConf = tx.confidence || 85;
                }
              }
            }

            partyMap[pCand] = {
              party: pCand,
              count: 1,
              mappedLedger: initialLedger,
              confidence: initialConf,
              sampleTransactions: [tx]
            };
          } else {
            partyMap[pCand].count += 1;
            if (partyMap[pCand].sampleTransactions.length < 10) {
              partyMap[pCand].sampleTransactions.push(tx);
            }
          }
        }
      });
      const recomputed = Object.values(partyMap).sort((a, b) => b.count - a.count);
      if (recomputed.length > 0) {
        partiesList = recomputed;
        sampleParty = recomputed[0].party;
      } else if (txns[0]?.narration) {
        const parts = sep === ' ' ? txns[0].narration.trim().split(/\s+/) : txns[0].narration.split(sep);
        sampleParty = (partyPos >= 0 && partyPos < parts.length) ? parts[partyPos].trim() : '';
      }
    }

    // Apply any local ledger overrides or resolve unmapped from master data
    const updatedParties = (partiesList || []).map(p => {
      const overrideKey = `${pat.id}_${p.party}`;
      if (partyLedgerOverrides[overrideKey]) {
        return { ...p, mappedLedger: partyLedgerOverrides[overrideKey], confidence: 100 };
      }
      if (!p.mappedLedger || p.mappedLedger === 'Unmapped') {
        if (!isStopPhrase(p.party) && /[a-z]/i.test(p.party)) {
          const match = findBestLedgerMatch(p.party, normalizedAllLedgers);
          if (match && match.score >= 70) {
            return { ...p, mappedLedger: match.ledger, confidence: match.score };
          }
        }
      }
      return p;
    });

    return {
      partyPosition: partyPos,
      txnIdPosition: txnIdPos,
      vpaPosition: vpaPos,
      sampleParty: sampleParty || (updatedParties[0]?.party || (txns.length > 0 ? `Token [${partyPos}]` : 'Awaiting statement')),
      distinctParties: updatedParties
    };
  };

  // Apply custom token index & auto-map transactions to Tally Master
  const handleApplyPatternIndexing = async (pat) => {
    const effective = getEffectivePatternData(pat);
    const raw = pat.raw || pat;

    // Collect all party→master ledger mappings from the expanded panel (only mapped ones)
    const partyLedgerMappings = (effective.distinctParties || [])
      .filter(dp => dp.mappedLedger && dp.mappedLedger !== 'Unmapped')
      .map(dp => ({
        party: dp.party,
        mappedLedger: dp.mappedLedger,
        confidence: dp.confidence || 100
      }));

    try {
      let updatedBatch = null;
      if (raw.id && !raw.id.startsWith('pat_default_')) {
        const approveRes = await bankRulesApi.approveSuggestion(raw.id || raw._id || pat.id, {
          candidatePattern: raw.pattern || pat.pattern || pat.txnType,
          matchType: 'contains',
          partyLedger: (partyLedgerMappings.length === 1)
            ? partyLedgerMappings[0].mappedLedger
            : (effective.distinctParties?.length === 1 && effective.distinctParties[0].mappedLedger !== 'Unmapped'
              ? effective.distinctParties[0].mappedLedger
              : ''),
          partyPosition: effective.partyPosition,
          txnIdPosition: effective.txnIdPosition,
          vpaPosition: effective.vpaPosition,
          transactionType: pat.txnType || pat.channel || raw.txnType || raw.transactionType || '',
          bankLedger: selectedBankLedger,
          batch_id: batchId,
          scope: 'bank_specific',
          partyLedgerMappings: partyLedgerMappings  // ← full list for bulk alias save
        });

        updatedBatch = approveRes?.updated_batch || null;
        const aliasesSaved = approveRes?.aliases_saved || 0;
        const reprocessed = approveRes?.reprocessed_count || 0;
        const toastParts = [`Applied Index [${effective.partyPosition}] for ${pat.txnType || pat.patternName}.`];
        if (reprocessed > 0) toastParts.push(`Auto-mapped ${reprocessed} transaction(s).`);
        if (aliasesSaved > 0) toastParts.push(`Saved ${aliasesSaved} party→ledger mapping(s).`);
        toast.success(toastParts.join(' '));
      }

      // If updatedBatch wasn't returned in response directly, fetch fresh review draft from server
      if (!updatedBatch && batchId) {
        try {
          const fresh = await bankStatementAiApi.getBatchReview(batchId);
          if (fresh?.data) updatedBatch = fresh.data;
        } catch (e) { }
      }

      if (onRulesApplied) onRulesApplied(updatedBatch);

      // Update local ledger mappings for all transactions of this pattern/type
      if (pat.transactions && pat.transactions.length > 0) {
        const pPos = effective.partyPosition;
        const sep = pat.separator || '/';
        const partyLedgerLookup = {};
        (effective.distinctParties || []).forEach(dp => {
          if (dp.mappedLedger && dp.mappedLedger !== 'Unmapped') {
            partyLedgerLookup[dp.party.toLowerCase().trim()] = {
              ledger: dp.mappedLedger,
              confidence: dp.confidence || 95
            };
          }
        });

        setLedgerMappings(prev => {
          const updated = prev.map(m => {
            if (pat.transactions.some(t => (t.item_id && t.item_id === m.item_id) || (t.id && t.id === m.id))) {
              const narr = m.narration || m.sampleNarration || '';
              const parts = sep === ' ' ? narr.trim().split(/\s+/) : narr.split(sep);
              const extracted = (pPos >= 0 && pPos < parts.length) ? parts[pPos].trim() : m.extractedParty;
              const mappedInfo = extracted ? partyLedgerLookup[extracted.toLowerCase().trim()] : null;
              return {
                ...m,
                extractedParty: extracted || m.extractedParty,
                partyPosition: pPos,
                suggestedLedger: mappedInfo?.ledger || m.suggestedLedger,
                confidence: mappedInfo ? mappedInfo.confidence : m.confidence,
                mappingMethod: mappedInfo ? 'User Verified' : m.mappingMethod,
                isUserEdited: !!mappedInfo
              };
            }
            return m;
          });
          ledgerMappingsCache.set(selectedBankLedger, updated);
          return updated;
        });

        // Save pattern overrides permanently so returning to Pattern Mapping preserves applied ledgers
        const updatedOverrides = { ...partyLedgerOverrides };
        (effective.distinctParties || []).forEach(dp => {
          if (dp.mappedLedger && dp.mappedLedger !== 'Unmapped') {
            updatedOverrides[`${pat.id}_${dp.party}`] = dp.mappedLedger;
          }
        });
        setPartyLedgerOverrides(updatedOverrides);
        partyLedgerOverridesCache.set(selectedBankLedger || 'default', updatedOverrides);
        setAppliedPatternIds(prev => {
          const next = new Set([...prev, pat.id, pat.txnType, pat.channel]);
          appliedPatternIdsCache.set(selectedBankLedger || 'default', next);
          return next;
        });
      }
    } catch (err) {
      toast.success(`Applied Party Index [${effective.partyPosition}] for ${pat.txnType || pat.patternName}!`);
    }
  };

  // Modal State for Add Custom Pattern
  const [isAddPatternOpen, setIsAddPatternOpen] = useState(false);
  const [newPatternName, setNewPatternName] = useState('');
  const [newPatternString, setNewPatternString] = useState('');
  const [newSampleNarration, setNewSampleNarration] = useState('');
  const [newMatchType, setNewMatchType] = useState('contains'); // contains, startswith, exact, regex
  const [newTxnType, setNewTxnType] = useState('UPI');
  const [newPartyText, setNewPartyText] = useState('');
  const [newPartyLedger, setNewPartyLedger] = useState('');
  const [newDirection, setNewDirection] = useState('any'); // any, debit, credit
  const [testingPattern, setTestingPattern] = useState(false);
  const [patternTestResult, setPatternTestResult] = useState(null);
  const [savingPattern, setSavingPattern] = useState(false);

  // Sync prop changes
  useEffect(() => {
    if (currentBankLedger) {
      setSelectedBankLedger(currentBankLedger);
    }
  }, [currentBankLedger]);

  // Sync initialMappings changes
  const lastInitialMappingsRef = useRef(null);
  useEffect(() => {
    if (initialMappings && initialMappings.length > 0 && initialMappings !== lastInitialMappingsRef.current) {
      lastInitialMappingsRef.current = initialMappings;
      setLedgerMappings(initialMappings);
      setLoadingLedgerMappings(false);
      ledgerMappingsCache.set(selectedBankLedger || currentBankLedger, initialMappings);
    }
  }, [initialMappings, selectedBankLedger, currentBankLedger]);

  // When a new document is uploaded, batchId changes -> clear stale cache and re-fetch both tabs
  const lastBatchIdRef = useRef(null);
  useEffect(() => {
    if (batchId && batchId !== lastBatchIdRef.current) {
      lastBatchIdRef.current = batchId;
      ledgerMappingsCache.delete(selectedBankLedger || currentBankLedger);
      patternRulesCache.delete(selectedBankLedger || currentBankLedger);
      fetchLedgerMappings(false);
      fetchPatterns(false);
    }
  }, [batchId]);

  // Load Tab 1 Ledger Mappings
  const fetchLedgerMappings = async (silent = false) => {
    if (!selectedBankLedger) return;
    const hasData = ledgerMappings.length > 0;
    if (!silent && !hasData) {
      setLoadingLedgerMappings(true);
    }
    try {
      const res = await bankRulesApi.getLedgerMappings(selectedBankLedger, {
        batch_id: batchId,
        search: mappingSearch,
        filter: mappingFilter
      });
      if (res?.success && res.data) {
        setLedgerMappings(res.data);
        ledgerMappingsCache.set(selectedBankLedger, res.data);
      }
    } catch (err) {
      console.error('Failed to fetch ledger mappings:', err);
    } finally {
      setLoadingLedgerMappings(false);
    }
  };

  // Load Tab 2 Patterns & AI suggestions (cached by bank account)
  const fetchPatterns = async (silent = false) => {
    if (!selectedBankLedger) return;
    const cached = patternRulesCache.get(selectedBankLedger);
    if (!silent && combinedPatterns.length === 0 && (!cached || (!cached.rules?.length && !cached.suggestions?.length))) {
      setLoadingPatterns(true);
    }
    try {
      const [rulesRes, suggRes] = await Promise.all([
        bankRulesApi.getRules(selectedBankLedger, { search: patternSearch }),
        bankRulesApi.getSuggestions(selectedBankLedger, { batch_id: batchId })
      ]);
      const loadedRules = Array.isArray(rulesRes) ? rulesRes : (rulesRes?.data || []);
      const loadedSuggestions = Array.isArray(suggRes) ? suggRes : (suggRes?.data || []);

      setRules(loadedRules);
      setSuggestions(loadedSuggestions);
      patternRulesCache.set(selectedBankLedger, { rules: loadedRules, suggestions: loadedSuggestions });
    } catch (err) {
      console.warn('Failed to fetch patterns (using cached data):', err);
      if (!patternRulesCache.has(selectedBankLedger) && (!ledgerMappings || ledgerMappings.length === 0)) {
        if (!silent) toast.error('Could not load transaction patterns');
      }
    } finally {
      setLoadingPatterns(false);
    }
  };

  // Keep selectedBankLedger in sync if props update
  useEffect(() => {
    if (currentBankLedger && currentBankLedger !== selectedBankLedger) {
      setSelectedBankLedger(currentBankLedger);
    } else if ((!selectedBankLedger || selectedBankLedger === 'BANK AC') && availableBankLedgers?.length > 0) {
      const preferred = availableBankLedgers.find(bl => bl !== 'BANK AC') || availableBankLedgers[0];
      if (preferred) setSelectedBankLedger(preferred);
    }
  }, [currentBankLedger, availableBankLedgers]);

  useEffect(() => {
    if (activeTab === 'ledger_mapping') {
      const cached = ledgerMappingsCache.get(selectedBankLedger);
      if (cached && cached.length > 0) {
        setLedgerMappings(cached);
        setLoadingLedgerMappings(false);
      } else if (initialMappings && initialMappings.length > 0) {
        setLedgerMappings(initialMappings);
        setLoadingLedgerMappings(false);
        ledgerMappingsCache.set(selectedBankLedger, initialMappings);
      } else {
        fetchLedgerMappings(false);
      }
    } else {
      // Tab 2 Pattern Mapping: If already loaded once for this bank account, show instantly
      const cached = patternRulesCache.get(selectedBankLedger);
      if (cached && (cached.rules?.length > 0 || cached.suggestions?.length > 0)) {
        setRules(cached.rules);
        setSuggestions(cached.suggestions);
        setLoadingPatterns(false);
      } else {
        fetchPatterns(true);
      }
    }
  }, [selectedBankLedger, activeTab, mappingFilter, batchId]);

  // Debounced search for Ledger Mappings
  useEffect(() => {
    const t = setTimeout(() => {
      if (activeTab === 'ledger_mapping') {
        fetchLedgerMappings(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [mappingSearch]);

  // Toggle expandable row accordion
  const toggleRowExpansion = (patternId) => {
    setExpandedRows(prev => ({
      ...prev,
      [patternId]: !prev[patternId]
    }));
  };

  // Handle User Confirmation / Change of Ledger in Tab 1
  const handleSelectLedgerForPattern = useCallback(async (mappingItem, newLedger) => {
    if (!newLedger || newLedger === mappingItem.suggestedLedger) return;
    setUpdatingPatternId(mappingItem.patternId);
    try {
      const isExact = newLedger && mappingItem.extractedParty &&
        (newLedger.trim().toUpperCase() === (mappingItem.extractedParty || mappingItem.extractedPattern || '').trim().toUpperCase());
      const txIds = mappingItem.item_id ? [mappingItem.item_id] : (mappingItem.transactions || []).map(t => t.item_id);
      const res = await bankRulesApi.confirmLedgerMapping({
        bankLedger: selectedBankLedger,
        pattern: mappingItem.extractedParty || mappingItem.extractedPattern,
        selectedLedger: newLedger,
        transactionIds: txIds,
        createRule: false
      });
      if (res?.success) {
        toast.success(`Mapped to "${newLedger}"`);
        // Update local state and memory cache instantly
        setLedgerMappings(prev => {
          const updated = prev.map(m => {
            if (m.patternId === mappingItem.patternId) {
              return {
                ...m,
                suggestedLedger: newLedger,
                confidence: 100,
                mappingMethod: 'User Verified',
                isUserEdited: true
              };
            }
            return m;
          });
          ledgerMappingsCache.set(selectedBankLedger || 'default', updated);
          return updated;
        });
        if (onRulesApplied) onRulesApplied();
      }
    } catch (err) {
      toast.error('Failed to save verified ledger mapping');
    } finally {
      setUpdatingPatternId(null);
    }
  }, [selectedBankLedger, onRulesApplied]);

  // Save new custom pattern
  const handleSaveCustomPattern = async (e) => {
    e.preventDefault();
    if (!newPatternString.trim()) {
      toast.error('Pattern description is required');
      return;
    }
    if (!newPartyLedger) {
      toast.error('Please select a target counterpart ledger');
      return;
    }

    setSavingPattern(true);
    try {
      const payload = {
        name: newPatternName.trim() || `Pattern: ${newPatternString.trim()}`,
        bankLedger: selectedBankLedger,
        pattern: newPatternString.trim(),
        matchType: newMatchType,
        partyLedger: newPartyLedger,
        voucherType: 'Auto',
        direction: newDirection,
        scope: 'customer_specific',
        status: 'active'
      };
      const res = await bankRulesApi.createRule(payload);
      if (res?.success) {
        toast.success('Custom pattern rule saved successfully!');
        setIsAddPatternOpen(false);
        // Reset form
        setNewPatternName('');
        setNewPatternString('');
        setNewSampleNarration('');
        setNewPartyText('');
        setNewPartyLedger('');
        setPatternTestResult(null);
        fetchPatterns();
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save custom pattern');
    } finally {
      setSavingPattern(false);
    }
  };

  // Test Pattern against real statement transactions
  const handleTestPattern = async () => {
    if (!newPatternString.trim()) {
      toast.error('Please enter a pattern or keyword to test');
      return;
    }
    setTestingPattern(true);
    setPatternTestResult(null);
    try {
      const res = await bankRulesApi.testRule({
        bankLedger: selectedBankLedger,
        pattern: newPatternString.trim(),
        matchType: newMatchType,
        partyLedger: newPartyLedger,
        voucherType: 'Auto',
        direction: newDirection,
        batch_id: batchId,
        sample_narrations: newSampleNarration ? [newSampleNarration] : undefined
      });
      if (res?.success) {
        setPatternTestResult(res.data);
        if (res.data?.matched_count > 0) {
          toast.success(`Matched ${res.data.matched_count} transaction(s)!`);
        } else {
          toast.info('No matching transactions found for this pattern test.');
        }
      }
    } catch (err) {
      toast.error('Failed to test pattern');
    } finally {
      setTestingPattern(false);
    }
  };

  // Approve AI Suggestion as Reusable Rule
  const handleApproveSuggestion = async (pat) => {
    const raw = pat.raw || pat;
    const effective = getEffectivePatternData(pat);
    try {
      const res = await bankRulesApi.approveSuggestion(raw.id || raw._id, {
        candidatePattern: raw.pattern || raw.candidatePattern || pat.pattern,
        matchType: raw.regexRule ? 'regex' : 'contains',
        partyLedger: (effective.distinctParties && effective.distinctParties.length === 1 && effective.distinctParties[0].mappedLedger !== 'Unmapped')
          ? effective.distinctParties[0].mappedLedger
          : '',
        regexRule: raw.regexRule,
        partyPosition: effective.partyPosition,
        txnIdPosition: effective.txnIdPosition,
        vpaPosition: effective.vpaPosition,
        bankLedger: selectedBankLedger,
        scope: 'bank_specific'
      });
      if (res?.success) {
        const pName = pat.patternName || pat.pattern;
        if (res.reprocessed_count > 0) {
          toast.success(`Approved pattern "${pName}" & auto-mapped ${res.reprocessed_count} transaction(s)!`);
        } else {
          toast.success(`Approved reusable pattern "${pName}" into active rule!`);
        }
        fetchPatterns();
        if (onRulesApplied) onRulesApplied();
      }
    } catch (err) {
      toast.error('Failed to approve reusable rule');
    }
  };

  // Reject AI Suggestion
  const handleRejectSuggestion = async (suggId) => {
    try {
      const res = await bankRulesApi.rejectSuggestion(suggId);
      if (res?.success) {
        toast.info('Pattern suggestion rejected');
        fetchPatterns();
      }
    } catch (err) {
      toast.error('Failed to reject suggestion');
    }
  };

  // Toggle Rule Status
  const handleToggleRuleStatus = async (ruleId) => {
    try {
      const res = await bankRulesApi.toggleRuleStatus(ruleId);
      if (res?.success) {
        toast.success('Pattern status updated');
        fetchPatterns();
      }
    } catch (err) {
      toast.error('Failed to toggle status');
    }
  };

  // Delete Rule
  const handleDeleteRule = async (ruleId, patternName) => {
    if (!window.confirm(`Delete rule "${patternName}"?`)) return;
    try {
      const res = await bankRulesApi.deleteRule(ruleId);
      if (res?.success) {
        toast.success('Pattern rule deleted');
        fetchPatterns();
      }
    } catch (err) {
      toast.error('Failed to delete rule');
    }
  };

  // Enrich Ledger Mappings with AI-resolved party ledgers matching Tab 2 logic
  const enrichedLedgerMappings = useMemo(() => {
    if (!ledgerMappings || ledgerMappings.length === 0) return [];
    return ledgerMappings.map((m) => {
      // If already confirmed by user or has an applied pattern rule, keep it
      if (m.suggestedLedger && m.suggestedLedger !== 'Unmapped' && (m.mappingMethod === 'User Confirmed' || m.mappingMethod === 'AI Pattern Applied')) {
        return m;
      }

      const narr = m.narration || m.sampleNarration || '';
      const analysis = getCachedNarrationAnalysis(narr);
      const txSep = analysis.sep || '/';
      const parts = txSep === ' ' ? narr.trim().split(/\s+/) : narr.split(txSep).map(s => s.trim());

      let pCand = m.extractedParty || '';
      if ((!pCand || isStopPhrase(pCand) || pCand.length < 2) && analysis.partyPos >= 0 && analysis.partyPos < parts.length) {
        pCand = parts[analysis.partyPos];
      }

      let resLedger = m.suggestedLedger;
      let resConf = m.confidence;
      let resMethod = m.mappingMethod;

      if (pCand && pCand.length >= 2 && !isStopPhrase(pCand) && /[A-Za-z]/.test(pCand)) {
        const match = findBestLedgerMatch(pCand, normalizedAllLedgers);
        if (match && match.score >= 70) {
          resLedger = match.ledger;
          resConf = match.score;
          resMethod = match.score >= 90 ? 'System • Exact Match' : 'AI Suggested';
        }
      }

      return {
        ...m,
        extractedParty: pCand || m.extractedParty,
        suggestedLedger: resLedger || '',
        confidence: resLedger ? resConf : (m.confidence || 0),
        mappingMethod: resLedger ? resMethod : (m.mappingMethod || 'Unmapped')
      };
    });
  }, [ledgerMappings, normalizedAllLedgers]);

  // Real-time search & filter for Tab 1
  const filteredMappings = useMemo(() => {
    let list = enrichedLedgerMappings;
    if (mappingSearch && mappingSearch.trim()) {
      const q = mappingSearch.toLowerCase().trim();
      list = list.filter(m => {
        const party = String(m.extractedParty || m.partyText || '').toLowerCase();
        const ledger = String(m.suggestedLedger || '').toLowerCase();
        const narr = String(m.narration || m.sampleNarration || '').toLowerCase();
        const ref = String(m.referenceNumber || '').toLowerCase();
        return party.includes(q) || ledger.includes(q) || narr.includes(q) || ref.includes(q);
      });
    }

    if (mappingFilter && mappingFilter !== 'all') {
      if (mappingFilter === 'mapped') {
        list = list.filter(m => m.suggestedLedger && m.suggestedLedger !== 'Unmapped');
      } else if (mappingFilter === 'unmapped') {
        list = list.filter(m => !m.suggestedLedger || m.suggestedLedger === 'Unmapped');
      } else if (mappingFilter === 'confirmed') {
        list = list.filter(m => m.mappingMethod === 'User Confirmed' || m.mappingMethod === 'System • Exact Match');
      }
    }

    return list;
  }, [enrichedLedgerMappings, mappingSearch, mappingFilter]);

  // Paginated Ledger Mappings
  const paginatedMappings = useMemo(() => {
    if (mappingPageSize === 'all') {
      return filteredMappings;
    }
    const size = Number(mappingPageSize) || 50;
    const start = (mappingPage - 1) * size;
    return filteredMappings.slice(start, start + size);
  }, [filteredMappings, mappingPage, mappingPageSize]);

  const totalMappingPages = useMemo(() => {
    if (mappingPageSize === 'all') return 1;
    const size = Number(mappingPageSize) || 50;
    return Math.max(1, Math.ceil(filteredMappings.length / size));
  }, [filteredMappings.length, mappingPageSize]);

  // Combine Default Taxonomy Library & Statement Patterns for Tab 2
  const allCombinedPatterns = useMemo(() => {
    let list = [];
    const bankCode = getBankPrefix(selectedBankLedger);
    // Dynamic structural grouping: txnType -> Map of structSig -> patternGroup
    const typePatternGroups = new Map();

    const hasStatementTxns = ledgerMappings && ledgerMappings.length > 0;

    // 1. Group transactions into Transaction Types & Distinct Structural Patterns
    // Prioritize backend AI pattern discovery suggestions (derived with Master-First Reverse Index matching)
    if (suggestions && suggestions.length > 0) {
      suggestions.forEach(s => {
        let type = (s.transactionType || s.txnType || s.channel || 'OTHER').toUpperCase();
        if (type === 'INTERNAL_TRANSFER' || type === 'OTHER_TRANSFER') type = 'TRANSFER';
        if (type === 'BANK_CHARGES') type = 'CHARGES';
        if (type === 'CHEQUE') type = 'CHQ';
        if (type === 'MANDATE') type = 'NACH';
        if (type === 'CARD') type = 'POS';

        if (!typePatternGroups.has(type)) {
          typePatternGroups.set(type, new Map());
        }
        const structMap = typePatternGroups.get(type);
        const sig = s.candidatePattern || s.pattern || `sig_${s.id}`;
        if (!structMap.has(sig) && (s.matchingCount > 0 || s.frequency > 0)) {
          structMap.set(sig, {
            id: s._id || s.id,
            txnType: type,
            separator: s.separator || '/',
            skeleton: s.pattern || s.candidatePattern,
            partyPosition: s.partyPosition !== undefined ? s.partyPosition : -1,
            txnIdPosition: s.txnIdPosition !== undefined ? s.txnIdPosition : -1,
            matchingCount: s.matchingCount || s.frequency || 0,
            transactions: s.transactions || [],
            sampleNarrations: s.sampleNarrations || [],
            tokens: s.tokens || [],
            raw: s,
            distinctPartiesMap: (s.distinctParties || []).reduce((acc, dp) => {
              acc[dp.party] = dp;
              return acc;
            }, {})
          });
        }
      });
    } else if (hasStatementTxns) {
      // Fallback to client-side grouping only when suggestions haven't loaded yet
      ledgerMappings.forEach((m) => {
        const narr = m.narration || m.sampleNarration || '';
        const analysis = getCachedNarrationAnalysis(narr);
        let txnType = (analysis.channel || m.channel || 'OTHER').toUpperCase();
        if (txnType === 'MANDATE') txnType = 'NACH';
        if (txnType === 'CARD') txnType = 'POS';

        if (!typePatternGroups.has(txnType)) {
          typePatternGroups.set(txnType, new Map());
        }
        const structMap = typePatternGroups.get(txnType);
        const sig = `${txnType}__party${analysis.partyPos >= 0 ? analysis.partyPos : 'none'}`;

        if (!structMap.has(sig)) {
          structMap.set(sig, {
            txnType: txnType,
            separator: analysis.sep || '/',
            separators: new Set([analysis.sep || '/']),
            skeleton: analysis.skeleton,
            partyPosition: analysis.partyPos >= 0 ? analysis.partyPos : -1,
            txnIdPosition: analysis.txnIdPos >= 0 ? analysis.txnIdPos : -1,
            matchingCount: 0,
            transactions: [],
            sampleNarrations: [],
            tokens: analysis.tokens,
            distinctPartiesMap: {}
          });
        }

        const g = structMap.get(sig);
        g.matchingCount += 1;
        g.transactions.push(m);
        if (analysis.sep) g.separators.add(analysis.sep);
        if (narr && g.sampleNarrations.length < 5) {
          g.sampleNarrations.push(narr);
        }

        // Extract party candidate dynamically using this specific transaction's own narration separator
        const txSep = analysis.sep || g.separator || '/';
        const parts = txSep === ' ' ? narr.trim().split(/\s+/) : narr.split(txSep);
        const pCand = (g.partyPosition >= 0 && g.partyPosition < parts.length) ? parts[g.partyPosition].trim() : (m.extractedParty || '');
        if (pCand && pCand.length >= 2) {
          if (!g.distinctPartiesMap[pCand]) {
            const match = findBestLedgerMatch(pCand, normalizedAllLedgers);
            const mPartyLedger = m.partyLedger || m.suggestedLedger;
            let initialLedger = 'Unmapped';
            let initialConf = 0;

            if (isStopPhrase(pCand) || !/[a-z]/i.test(pCand)) {
              initialLedger = 'Unmapped';
              initialConf = 0;
            } else if (match && match.score >= 70) {
              initialLedger = match.ledger;
              initialConf = match.score;
            } else if (mPartyLedger && /[a-z]/i.test(pCand)) {
              const pLow = pCand.toLowerCase().replace(/[^a-z0-9]/g, '');
              const mLow = mPartyLedger.toLowerCase().replace(/[^a-z0-9]/g, '');
              if (pLow.length >= 4 && (mLow.includes(pLow) || pLow.includes(mLow))) {
                const ratio = Math.min(pLow.length, mLow.length) / Math.max(pLow.length, mLow.length);
                if (ratio >= 0.4) {
                  initialLedger = mPartyLedger;
                  initialConf = m.confidence || 85;
                }
              }
            }

            g.distinctPartiesMap[pCand] = {
              party: pCand,
              mappedLedger: initialLedger,
              count: 1,
              confidence: initialConf,
              sampleTransactions: [m]
            };
          } else {
            g.distinctPartiesMap[pCand].count += 1;
            if (g.distinctPartiesMap[pCand].sampleTransactions.length < 10) {
              g.distinctPartiesMap[pCand].sampleTransactions.push(m);
            }
          }
        }
      });
    }

    // 2. Add all default transaction types from DEFAULT_TRANSACTION_TYPES
    // If multiple patterns exist for a transaction type (e.g. UPI Pattern A, Pattern B, Pattern C):
    // List each pattern with its own transaction count, token breakdown, and party index.
    // If no transactions exist, show default library entry with 0 count.
    DEFAULT_TRANSACTION_TYPES.forEach((def, defIdx) => {
      const structMap = typePatternGroups.get(def.type);

      if (structMap && structMap.size > 0) {
        // Sort patterns for this transaction type by matchingCount descending (most frequent first)
        const sortedGroups = Array.from(structMap.values()).sort((a, b) => b.matchingCount - a.matchingCount);

        sortedGroups.forEach((g, gIdx) => {
          const patLetter = String.fromCharCode(65 + gIdx); // Pattern A, Pattern B, Pattern C...
          const patId = `PAT-${bankCode}-${def.type}-${patLetter}`;
          const dList = Object.values(g.distinctPartiesMap).sort((a, b) => b.count - a.count);

          list.push({
            id: g.id || `pat_live_${def.type.toLowerCase()}_${patLetter.toLowerCase()}`,
            patternId: patId,
            patternName: `${def.label} • Pattern ${patLetter} (AI Detected)`,
            txnType: def.type,
            typeLabel: def.label,
            typeDesc: def.desc,
            separator: g.separators ? Array.from(g.separators).join(', ') : (g.separator || '/'),
            pattern: g.skeleton || `${def.label} Pattern ${patLetter}`,
            partyPosition: g.partyPosition,
            txnIdPosition: g.txnIdPosition,
            matchingCount: g.matchingCount,
            distinctPartiesCount: dList.length,
            distinctParties: dList,
            extractedParty: dList.length > 0 ? dList[0].party : '',
            mappedLedger: dList.length === 1 ? dList[0].mappedLedger : (dList.length > 1 ? `${dList.length} Ledgers` : 'Unmapped'),
            tokens: g.tokens || [],
            transactions: g.transactions || [],
            sampleNarrations: g.sampleNarrations || [],
            isAi: true,
            isPatternA: (gIdx === 0),
            isDefaultLibrary: false,
            status: 'active'
          });
        });
      } else {
        // Default library entry with 0 transactions awaiting statement upload
        const patId = `DEF-${bankCode}-${def.type}`;
        list.push({
          id: `pat_default_${def.type.toLowerCase()}`,
          patternId: patId,
          patternName: `${def.label} • Default Library`,
          txnType: def.type,
          typeLabel: def.label,
          typeDesc: def.desc,
          separator: '—',
          pattern: 'Awaiting statement upload',
          partyPosition: -1,
          txnIdPosition: -1,
          matchingCount: 0,
          distinctPartiesCount: 0,
          distinctParties: [],
          extractedParty: '—',
          mappedLedger: 'Unmapped',
          tokens: [],
          transactions: [],
          sampleNarrations: [],
          isAi: false,
          isPatternA: false,
          isDefaultLibrary: true,
          status: 'library'
        });
      }
    });

    // Also include any non-default transaction types discovered dynamically
    typePatternGroups.forEach((structMap, typeKey) => {
      const alreadyIncluded = DEFAULT_TRANSACTION_TYPES.some(d => d.type === typeKey);
      if (!alreadyIncluded && structMap && structMap.size > 0) {
        const sortedGroups = Array.from(structMap.values()).sort((a, b) => b.matchingCount - a.matchingCount);
        sortedGroups.forEach((g, gIdx) => {
          const patLetter = String.fromCharCode(65 + gIdx);
          const patId = `PAT-${bankCode}-${typeKey}-${patLetter}`;
          const dList = Object.values(g.distinctPartiesMap).sort((a, b) => b.count - a.count);
          list.push({
            id: g.id || `pat_live_${typeKey.toLowerCase()}_${patLetter.toLowerCase()}`,
            patternId: patId,
            patternName: `${typeKey} • Pattern ${patLetter} (AI Detected)`,
            txnType: typeKey,
            typeLabel: typeKey,
            typeDesc: `${typeKey} Transactions`,
            separator: g.separators ? Array.from(g.separators).join(', ') : (g.separator || '/'),
            pattern: g.skeleton || `${typeKey} Pattern ${patLetter}`,
            partyPosition: g.partyPosition,
            txnIdPosition: g.txnIdPosition,
            matchingCount: g.matchingCount,
            distinctPartiesCount: dList.length,
            distinctParties: dList,
            extractedParty: dList.length > 0 ? dList[0].party : '',
            mappedLedger: dList.length === 1 ? dList[0].mappedLedger : (dList.length > 1 ? `${dList.length} Ledgers` : 'Unmapped'),
            tokens: g.tokens || [],
            transactions: g.transactions || [],
            sampleNarrations: g.sampleNarrations || [],
            isAi: true,
            isPatternA: (gIdx === 0),
            isDefaultLibrary: false,
            status: 'active'
          });
        });
      }
    });

    // Sort list: active patterns with transactions first (descending count), then 0-count default types
    return list.sort((a, b) => b.matchingCount - a.matchingCount);
  }, [ledgerMappings, suggestions, rules, selectedBankLedger, normalizedAllLedgers]);

  // Available transaction types for dynamic filtering
  const availableTxnTypes = useMemo(() => {
    const types = new Map();
    (allCombinedPatterns || []).forEach(p => {
      const t = (p.txnType || 'OTHER').toUpperCase();
      types.set(t, (types.get(t) || 0) + 1);
    });
    return Array.from(types.entries()).sort((a, b) => b[1] - a[1]);
  }, [allCombinedPatterns]);

  // Transaction type counts & summaries for Level 1 selection
  const transactionTypeSummaries = useMemo(() => {
    const map = new Map();
    (allCombinedPatterns || []).forEach(p => {
      const type = (p.transactionType || p.txnType || p.channel || 'OTHER').toUpperCase();
      if (!map.has(type)) {
        map.set(type, {
          type,
          count: 0,
          patternsCount: 0,
          patterns: []
        });
      }
      const item = map.get(type);
      item.patternsCount += 1;
      item.patterns.push(p);
      item.count += (p.matchingCount || 0);
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [allCombinedPatterns]);

  // Combined & filtered patterns for Tab 2
  const combinedPatterns = useMemo(() => {
    let list = allCombinedPatterns || [];

    // Filter by Level 1 Selected Transaction Type
    if (selectedTxnType !== 'ALL') {
      // Specific type selected (could be 0-count from dropdown) — show it
      list = list.filter(p => (p.transactionType || p.txnType || p.channel || '').toUpperCase() === selectedTxnType.toUpperCase());
    } else {
      // "All Types" selected — only show types that have actual transactions (count > 0)
      // 0-count default library types are accessible only via the dropdown filter
      list = list.filter(p => (p.matchingCount || 0) > 0);
    }

    // Apply Filter
    if (patternFilter !== 'all') {
      if (patternFilter === 'system') list = list.filter(p => p.source === 'System');
      else if (patternFilter === 'bank_specific') list = list.filter(p => p.source === 'Bank-specific');
      else if (patternFilter === 'customer_custom') list = list.filter(p => p.source === 'Customer Custom');
      else if (patternFilter === 'ai_discovered') list = list.filter(p => p.isAi);
      else if (patternFilter === 'unmapped') list = list.filter(p => p.distinctParties?.some(dp => !dp.mappedLedger || dp.mappedLedger === 'Unmapped') || p.mappedLedger === 'Unmapped');
      else if (patternFilter.startsWith('type_')) {
        const t = patternFilter.replace('type_', '').toUpperCase();
        list = list.filter(p => (p.txnType || '').toUpperCase() === t);
      }
    }

    // Apply Status Filter
    if (patternStatusFilter === 'applied') {
      list = list.filter(p => appliedPatternIds.has(p.id) || appliedPatternIds.has(p.txnType) || appliedPatternIds.has(p.channel));
    } else if (patternStatusFilter === 'not_applied') {
      list = list.filter(p => !appliedPatternIds.has(p.id) && !appliedPatternIds.has(p.txnType) && !appliedPatternIds.has(p.channel));
    }

    // Apply Search — if searching, include 0-count defaults too so user can find them
    if (patternSearch.trim()) {
      const q = patternSearch.toLowerCase();
      // Re-start from full list for search so 0-count defaults are also searched
      const searchBase = allCombinedPatterns || [];
      return searchBase.filter(p =>
        p.patternId?.toLowerCase().includes(q) ||
        (p.pattern || '').toLowerCase().includes(q) ||
        (p.txnType || '').toLowerCase().includes(q) ||
        p.distinctParties?.some(dp => dp.party?.toLowerCase().includes(q) || dp.mappedLedger?.toLowerCase().includes(q)) ||
        (p.mappedLedger || '').toLowerCase().includes(q) ||
        (p.typeDesc || '').toLowerCase().includes(q)
      );
    }

    return list || [];
  }, [allCombinedPatterns, selectedTxnType, patternFilter, patternSearch, patternStatusFilter, appliedPatternIds]);

  const paginatedPatterns = useMemo(() => {
    const safeList = combinedPatterns || [];
    if (patternPageSize === 'all') return safeList;
    const size = Number(patternPageSize) || 25;
    const start = (patternPage - 1) * size;
    return safeList.slice(start, start + size);
  }, [combinedPatterns, patternPage, patternPageSize]);

  // Selected pattern for Right Detail Drawer (only shown when selectedPatternId is active)
  const selectedPattern = useMemo(() => {
    if (!combinedPatterns || combinedPatterns.length === 0 || !selectedPatternId) return null;
    return combinedPatterns.find(p => p.id === selectedPatternId) || null;
  }, [combinedPatterns, selectedPatternId]);

  const totalPatternPages = useMemo(() => {
    if (patternPageSize === 'all') return 1;
    const size = Number(patternPageSize) || 25;
    return Math.max(1, Math.ceil((combinedPatterns?.length || 0) / size));
  }, [combinedPatterns?.length, patternPageSize]);

  // Helper for transaction type avatar color & letter matching screenshot
  const getTypeBadgeConfig = useCallback((txnType) => {
    const t = (txnType || 'OTHER').toUpperCase();
    if (t.includes('NEFT')) return { letter: 'N', bg: 'bg-[#2563EB]', text: 'text-white' };
    if (t.includes('CLG')) return { letter: 'C', bg: 'bg-[#6366F1]', text: 'text-white' };
    if (t.includes('UPI')) return { letter: 'U', bg: 'bg-[#06B6D4]', text: 'text-white' };
    if (t.includes('TRANSFER') || t.includes('TRF')) return { letter: 'T', bg: 'bg-[#F59E0B]', text: 'text-white' };
    if (t.includes('IMPS')) return { letter: 'I', bg: 'bg-[#EC4899]', text: 'text-white' };
    if (t.includes('RTGS')) return { letter: 'R', bg: 'bg-[#10B981]', text: 'text-white' };
    if (t.includes('CHQ') || t.includes('CTS')) return { letter: 'C', bg: 'bg-[#8B5CF6]', text: 'text-white' };
    return { letter: t.charAt(0) || 'O', bg: 'bg-[#64748B]', text: 'text-white' };
  }, []);

  if (!isOpen) return null;

  // Back button handler: if on pattern_mapping goes back to ledger_mapping, else closes modal
  const handleBack = () => {
    if (activeTab === 'pattern_mapping') {
      setActiveTab('ledger_mapping');
    } else {
      onClose?.();
    }
  };

  return (
    <div className="flex flex-col gap-1.5 h-full w-full overflow-hidden bg-[var(--app-content-bg)] text-[var(--app-heading)]">

      {/* ── TOP HEADER (Compact, Zero wasted space: Back Button, Tab Switcher & Bank Context) ── */}
      <div className="flex items-center justify-between gap-3 shrink-0 px-2.5 py-1.5 border-b bg-white rounded-xl shadow-2xs" style={{ borderColor: 'var(--app-border)' }}>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-all cursor-pointer shadow-2xs border-slate-200 shrink-0"
            title={activeTab === 'pattern_mapping' ? 'Back to Ledger Mapping' : 'Back to Review'}
          >
            <ArrowLeft size={13} />
            <span>Back</span>
          </button>

          {/* Inline Segmented Tab Switcher */}
          <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('ledger_mapping')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'ledger_mapping'
                  ? 'bg-white text-[#2563EB] shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers size={13} />
              <span>Ledger Mapping</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                activeTab === 'ledger_mapping' ? 'bg-blue-50 text-blue-600' : 'bg-slate-200 text-slate-600'
              }`}>
                {ledgerMappings.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('pattern_mapping')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'pattern_mapping'
                  ? 'bg-white text-[#2563EB] shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <GitBranch size={13} />
              <span>Pattern Mapping</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                activeTab === 'pattern_mapping' ? 'bg-blue-50 text-blue-600' : 'bg-slate-200 text-slate-600'
              }`}>
                {combinedPatterns.length}
              </span>
            </button>
          </div>
        </div>

        {/* Bank Account Shared Context */}
        <div className="flex items-center gap-2">
          {/* Bank Account Selector Card */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsBankSelectorOpen(!isBankSelectorOpen)}
              className="flex items-center gap-2 px-2.5 py-1 rounded-lg border bg-white hover:bg-slate-50 transition-all cursor-pointer shadow-2xs border-slate-200"
            >
              <Landmark size={14} className="text-slate-500 shrink-0" />
              <span className="text-[10px] font-semibold text-slate-400 uppercase">Bank:</span>
              <span className="text-xs font-black text-slate-800 truncate max-w-[180px]">
                {selectedBankLedger}
              </span>
              <ChevronDown size={13} className="text-slate-400 ml-0.5 shrink-0" />
            </button>

            {/* Dropdown Menu */}
            {isBankSelectorOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setIsBankSelectorOpen(false)} />
                <div
                  className="absolute right-0 mt-1 w-64 bg-white border rounded-xl shadow-xl z-30 py-1 max-h-60 overflow-y-auto"
                  style={{ borderColor: 'var(--app-border)' }}
                >
                  {availableBankLedgers.length > 0 ? (
                    availableBankLedgers.map(bl => (
                      <button
                        key={bl}
                        onClick={() => {
                          setSelectedBankLedger(bl);
                          setIsBankSelectorOpen(false);
                        }}
                        className={`w-full text-left px-3.5 py-1.5 text-xs font-bold hover:bg-slate-50 flex items-center justify-between transition-colors ${selectedBankLedger === bl ? 'text-[#2563EB] bg-blue-50' : 'text-slate-800'
                          }`}
                      >
                        <span className="truncate">{bl}</span>
                        {selectedBankLedger === bl && <Check size={13} />}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-xs text-slate-400">No bank ledgers available</div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── TAB CONTENT CARD CONTAINER ── */}
      <div className="flex-1 flex flex-col min-h-0 bg-white rounded-2xl border shadow-sm overflow-hidden" style={{ borderColor: 'var(--app-border)' }}>

        {/* ═════════════════════════════════════════════════════════════════════════════════ */}
        {/* TAB 1: LEDGER MAPPING                                                             */}
        {/* ═════════════════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'ledger_mapping' && (
          <div className="flex-1 flex flex-col min-h-0 h-full overflow-hidden bg-white">
            {/* Filter Bar: strictly row-wise, ultra-compact, zero wasted vertical space */}
            <div className="flex items-center justify-between gap-2.5 px-3 py-1.5 border-b shrink-0 bg-white" style={{ borderColor: 'var(--app-border)' }}>
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                {/* Search Box */}
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="absolute left-2.5 top-2 text-slate-400" size={13} />
                  <input
                    type="text"
                    value={mappingSearch}
                    onChange={(e) => setMappingSearch(e.target.value)}
                    placeholder="Search pattern, party or ledger..."
                    className="w-full h-7.5 pl-8 pr-2.5 border rounded-lg text-xs font-medium outline-none bg-slate-50 text-slate-800 focus:bg-white focus:border-[#2563EB] transition-colors"
                    style={{ borderColor: 'var(--app-border)' }}
                  />
                </div>

                {/* Filter Dropdown */}
                <div className="flex items-center gap-1.5 h-7.5 px-2.5 border rounded-lg bg-slate-50 text-slate-700 shrink-0" style={{ borderColor: 'var(--app-border)' }}>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Filter:</span>
                  <select
                    value={mappingFilter}
                    onChange={(e) => setMappingFilter(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer pr-1"
                  >
                    <option value="all">All ({ledgerMappings.length})</option>
                    <option value="mapped">Mapped Ledgers</option>
                    <option value="unmapped">Unmapped / Review</option>
                    <option value="confirmed">User Verified</option>
                  </select>
                </div>

                {/* Refresh */}
                <button
                  onClick={fetchLedgerMappings}
                  disabled={loadingLedgerMappings}
                  className="w-7.5 h-7.5 flex items-center justify-center border rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all cursor-pointer shrink-0"
                  style={{ borderColor: 'var(--app-border)' }}
                  title="Refresh Mappings"
                >
                  <RefreshCw size={13} className={loadingLedgerMappings ? 'animate-spin text-[#2563EB]' : ''} />
                </button>
              </div>

              {/* Status Counters */}
              <div className="flex items-center gap-2 shrink-0">
                {enrichedLedgerMappings.filter(m => m.suggestedLedger && m.suggestedLedger !== 'Unmapped').length > 0 && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {enrichedLedgerMappings.filter(m => m.suggestedLedger && m.suggestedLedger !== 'Unmapped').length} Auto-Mapped
                  </span>
                )}
              </div>
            </div>

            {/* ── Table with 5 Columns: Extracted Party alone, Description/Narration separate column ── */}
            <div className="flex-1 overflow-auto min-h-0">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-slate-50 border-b z-10" style={{ borderColor: 'var(--app-border)' }}>
                  <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-2 px-3 w-[24%]">EXTRACTED PARTY</th>
                    <th className="py-2 px-3 w-[32%]">DESCRIPTION / NARRATION</th>
                    <th className="py-2 px-3 w-[24%]">LEDGER SELECTION</th>
                    <th className="py-2 px-3 w-[10%] text-center">CONFIDENCE SCORE</th>
                    <th className="py-2 px-3 w-[10%] text-center">MAPPING METHOD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100" style={{ borderColor: 'var(--app-border)' }}>
                  {loadingLedgerMappings && ledgerMappings.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-16 text-center text-xs font-semibold text-slate-500">
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="animate-spin text-[#2563EB]" size={16} />
                          <span>Loading statement transactions...</span>
                        </div>
                      </td>
                    </tr>
                  ) : paginatedMappings.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-16 text-center text-xs font-medium text-slate-500">
                        No transactions found for {selectedBankLedger}. Upload a statement to automatically identify patterns.
                      </td>
                    </tr>
                  ) : (
                    paginatedMappings.map((row) => (
                      <LedgerMappingRow
                        key={row.patternId || row.item_id}
                        row={row}
                        onSelectLedger={handleSelectLedgerForPattern}
                        normalizedAllLedgers={normalizedAllLedgers}
                        isUpdating={updatingPatternId === row.patternId}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Card Footer with Pagination & View Options */}
            <div className="flex items-center justify-between px-3 py-1.5 border-t shrink-0 text-xs text-slate-500 flex-wrap gap-2 bg-white" style={{ borderColor: 'var(--app-border)' }}>
              <div className="flex items-center gap-3">
                <div>
                  {mappingPageSize === 'all' ? (
                    <span>
                      Showing all <span className="font-bold text-slate-800">{filteredMappings.length}</span> transactions
                      {filteredMappings.length !== ledgerMappings.length && (
                        <span className="ml-1 text-slate-400">(filtered from {ledgerMappings.length})</span>
                      )}
                    </span>
                  ) : (
                    <span>
                      Showing <span className="font-bold text-slate-800">{paginatedMappings.length}</span> of <span className="font-bold text-slate-800">{filteredMappings.length}</span> transactions • Page {mappingPage} of {totalMappingPages}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 text-[11px]">
                  <span>Show:</span>
                  <select
                    value={mappingPageSize}
                    onChange={(e) => {
                      setMappingPageSize(e.target.value === 'all' ? 'all' : Number(e.target.value));
                      setMappingPage(1);
                    }}
                    className="h-6 px-1.5 rounded border bg-slate-50 text-slate-700 font-semibold text-[11px] outline-none cursor-pointer"
                    style={{ borderColor: 'var(--app-border)' }}
                  >
                    <option value="all">All ({filteredMappings.length})</option>
                    <option value={100}>100 per page</option>
                    <option value={50}>50 per page</option>
                    <option value={25}>25 per page</option>
                  </select>
                </div>
              </div>

              {totalMappingPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setMappingPage(p => Math.max(1, p - 1))}
                    disabled={mappingPage === 1}
                    className="w-6 h-6 flex items-center justify-center border rounded hover:bg-slate-100 disabled:opacity-40 cursor-pointer font-bold text-xs"
                    style={{ borderColor: 'var(--app-border)' }}
                  >
                    ‹
                  </button>
                  <span className="w-6 h-6 flex items-center justify-center bg-[#2563EB] text-white rounded font-black text-xs">
                    {mappingPage}
                  </span>
                  <button
                    onClick={() => setMappingPage(p => Math.min(totalMappingPages, p + 1))}
                    disabled={mappingPage >= totalMappingPages}
                    className="w-6 h-6 flex items-center justify-center border rounded hover:bg-slate-100 disabled:opacity-40 cursor-pointer font-bold text-xs"
                    style={{ borderColor: 'var(--app-border)' }}
                  >
                    ›
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════════════════════════ */}
        {/* TAB 2: PATTERN MAPPING                                                            */}
        {/* ═════════════════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'pattern_mapping' && (
          <div className="flex-1 flex flex-col min-h-0 h-full overflow-hidden bg-white">
            {/* Filter Bar: strictly row-wise, ultra-compact, zero wasted vertical space */}
            <div className="flex items-center justify-between gap-2.5 px-3 py-1.5 border-b shrink-0 bg-white" style={{ borderColor: 'var(--app-border)' }}>
              <div className="flex items-center gap-2.5 flex-1 min-w-0 flex-wrap sm:flex-nowrap">
                {/* Search Box */}
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="absolute left-2.5 top-2 text-slate-400" size={13} />
                  <input
                    type="text"
                    value={patternSearch}
                    onChange={(e) => setPatternSearch(e.target.value)}
                    placeholder="Search patterns or transaction type..."
                    className="w-full h-7.5 pl-8 pr-2.5 border rounded-lg text-xs font-medium outline-none bg-slate-50 text-slate-800 focus:bg-white focus:border-[#2563EB] transition-colors"
                    style={{ borderColor: 'var(--app-border)' }}
                  />
                </div>

                {/* Transaction Type Filter Dropdown - Row-wise inline */}
                <div className="flex items-center gap-1.5 h-7.5 px-2.5 border rounded-lg bg-slate-50 text-slate-700 shrink-0" style={{ borderColor: 'var(--app-border)' }}>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Type:</span>
                  <select
                    value={selectedTxnType}
                    onChange={(e) => { setSelectedTxnType(e.target.value); setPatternPage(1); }}
                    className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer pr-1"
                  >
                    <option value="ALL">All ({combinedPatterns.length})</option>
                    {transactionTypeSummaries.map(s => (
                      <option key={s.type} value={s.type}>{s.type} ({s.count})</option>
                    ))}
                  </select>
                </div>

                {/* Status Filter Dropdown - Row-wise inline */}
                <div className="flex items-center gap-1.5 h-7.5 px-2.5 border rounded-lg bg-slate-50 text-slate-700 shrink-0" style={{ borderColor: 'var(--app-border)' }}>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Status:</span>
                  <select
                    value={patternStatusFilter}
                    onChange={(e) => setPatternStatusFilter(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer pr-1"
                  >
                    <option value="all">All</option>
                    <option value="applied">Applied</option>
                    <option value="not_applied">Not Applied</option>
                  </select>
                </div>
              </div>

              {/* + Add Custom Pattern Button */}
              <button
                type="button"
                onClick={() => {
                  setIsAddPatternOpen(true);
                  setPatternTestResult(null);
                }}
                className="flex items-center gap-1.5 px-3 h-7.5 rounded-lg text-xs font-bold bg-[#2563EB] hover:bg-blue-700 text-white shadow-xs transition-all cursor-pointer shrink-0"
              >
                <Plus size={13} strokeWidth={2.5} />
                <span>Add Custom Pattern</span>
              </button>
            </div>

            {/* Main Content: Single Full-Width Pattern Table with Accordion */}
            <div className="flex-1 flex min-h-0 overflow-hidden bg-slate-50/20">
              {/* Full-Width Pattern Table */}
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="flex-1 overflow-y-auto min-h-0">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-white border-b z-10" style={{ borderColor: 'var(--app-border)' }}>
                      <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="py-2 px-3">Pattern / Transaction Type</th>
                        <th className="py-2 px-2.5">Transactions</th>
                        <th className="py-2 px-2.5">Party Index</th>
                        <th className="py-2 px-2.5">Status</th>
                        <th className="py-2 px-2.5">Details</th>
                        <th className="py-2 px-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {loadingPatterns && combinedPatterns.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-xs font-medium text-slate-400">
                            <RefreshCw className="animate-spin text-[#2563EB] inline-block mr-2" size={15} />
                            Loading transaction patterns...
                          </td>
                        </tr>
                      ) : paginatedPatterns.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-xs font-medium text-slate-400">
                            No patterns found for current filters.
                          </td>
                        </tr>
                      ) : (
                        paginatedPatterns.map((pat) => {
                          const effective = getEffectivePatternData(pat);
                          const badgeCfg = getTypeBadgeConfig(pat.txnType);
                          const isApplied = appliedPatternIds.has(pat.id) || appliedPatternIds.has(pat.txnType) || appliedPatternIds.has(pat.channel);
                          const isSelected = selectedPattern?.id === pat.id;
                          const sampleNarr = (pat.raw?.sampleNarrations && pat.raw.sampleNarrations[0]) ||
                            (pat.transactions && pat.transactions[0]?.narration) || pat.pattern || '';

                          return (
                            <React.Fragment key={pat.id}>
                             <tr
                               className={`hover:bg-blue-50/20 transition-colors ${isSelected ? 'bg-blue-50/60' : ''}`}
                             >
                              {/* 1. Pattern / Transaction Type */}
                              <td className="py-1.5 px-3">
                                <div className="flex items-center gap-2">
                                  <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 shadow-2xs ${badgeCfg.bg} ${badgeCfg.text}`}>
                                    {badgeCfg.letter}
                                  </div>
                                  <span className="font-bold text-xs text-slate-800 tracking-wide uppercase">
                                    {pat.txnType}
                                  </span>

                                  {/* Eye icon: on hover show full description */}
                                  <div className="relative group/eye inline-flex items-center" onClick={(e) => e.stopPropagation()}>
                                    <button
                                      type="button"
                                      className="p-0.5 rounded text-slate-400 hover:text-[#2563EB] hover:bg-blue-50 transition-colors cursor-pointer"
                                      title={sampleNarr || pat.pattern || 'No narration description'}
                                    >
                                      <Eye size={12} />
                                    </button>
                                    <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 hidden group-hover/eye:flex flex-col z-50 w-72 p-2 bg-slate-900/95 text-white rounded-xl shadow-2xl backdrop-blur-xs text-[11px] pointer-events-none border border-slate-700">
                                      <span className="text-[9px] font-black uppercase tracking-wider text-blue-400 mb-0.5">
                                        Full Description / Narration
                                      </span>
                                      <span className="font-mono text-slate-100 break-words leading-relaxed select-all">
                                        {sampleNarr || pat.pattern || 'No narration description'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* 2. Transactions */}
                              <td className="py-1.5 px-2.5">
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-600 border border-blue-100">
                                  {pat.matchingCount || 0} txns
                                </span>
                              </td>

                              {/* 3. Party Index */}
                              <td className="py-1.5 px-2.5">
                                <span className="text-xs font-medium text-slate-600">
                                  {effective.partyPosition >= 0 ? `Position ${effective.partyPosition}` : '—'}
                                </span>
                              </td>

                              {/* 4. Status */}
                              <td className="py-1.5 px-2.5">
                                {isApplied ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <Check size={11} strokeWidth={3} />
                                    <span>Applied</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                    <AlertCircle size={11} />
                                    <span>Not Applied</span>
                                  </span>
                                )}
                              </td>

                              {/* 5. Details: Click opens details drawer */}
                              <td className="py-1.5 px-2.5">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedPatternId(prev => prev === pat.id ? null : pat.id);
                                  }}
                                  className={`text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors px-2 py-0.5 rounded-md ${
                                    isSelected
                                      ? 'bg-blue-100/70 text-blue-700 font-black'
                                      : 'text-[#2563EB] hover:bg-blue-50 hover:text-blue-800'
                                  }`}
                                >
                                  <span>{isSelected ? 'Hide Details' : 'View Details'}</span>
                                  <ChevronRight size={12} className={`transition-transform duration-150 ${isSelected ? 'rotate-90' : ''}`} />
                                </button>
                              </td>

                              {/* 6. Action */}
                              <td className="py-1.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                {isApplied ? (
                                  <button
                                    type="button"
                                    onClick={() => handleApplyPatternIndexing(pat)}
                                    className="inline-flex items-center justify-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-all cursor-pointer"
                                  >
                                    <Check size={11} strokeWidth={3} />
                                    <span>Applied</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleApplyPatternIndexing(pat);
                                      setAppliedPatternIds(prev => new Set([...prev, pat.id, pat.txnType]));
                                    }}
                                    disabled={pat.matchingCount === 0}
                                    className="px-3.5 py-0.5 rounded-lg text-xs font-bold bg-[#2563EB] hover:bg-blue-700 text-white shadow-xs transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                  >
                                    Apply
                                  </button>
                                )}
                              </td>
                            </tr>

                            {/* ─── Inline Accordion Expansion ─── */}
                            {isSelected && (() => {
                              const eff = getEffectivePatternData(pat);
                              const isAppl = appliedPatternIds.has(pat.id) || appliedPatternIds.has(pat.txnType) || appliedPatternIds.has(pat.channel);
                              const distList = eff.distinctParties || [];
                              const sampNarr = (pat.raw?.sampleNarrations && pat.raw.sampleNarrations[0]) || (pat.transactions && pat.transactions[0]?.narration) || pat.pattern || '';
                              const sampNarrList = ((pat.sampleNarrations && pat.sampleNarrations.length > 0) ? pat.sampleNarrations : (pat.transactions && pat.transactions.length > 0) ? pat.transactions.map(t => t.narration) : [sampNarr]).filter(Boolean).slice(0, 3);
                              const tokList = pat.tokens && pat.tokens.length > 0 ? pat.tokens : (pat.raw?.tokens || []);
                              const sep2 = (pat.separator && pat.separator.includes(',')) ? pat.separator.split(',')[0].trim() : (pat.separator || '/');
                              const realPts = sampNarr ? (sep2 === ' ' ? sampNarr.trim().split(/\s+/) : sampNarr.split(sep2).map(s => s.trim())) : [];
                              let maxToks = realPts.length;
                              (pat.transactions || []).forEach(tx => { const n = tx.narration || tx.sampleNarration || ''; if (n) { const p = sep2 === ' ' ? n.trim().split(/\s+/) : n.split(sep2); if (p.length > maxToks) maxToks = p.length; } });
                              const dynCnt = Math.max(maxToks, 1);
                              const badgeCfg2 = getTypeBadgeConfig(pat.txnType);
                              return (
                                <tr key={`${pat.id}-acc`} className="bg-slate-50/70">
                                  <td colSpan={6} className="p-3">
                                    <div className="rounded-2xl border-2 border-blue-200/90 bg-white shadow-md overflow-hidden transition-all">
                                      {/* Header Bar */}
                                      <div className="bg-gradient-to-r from-blue-50/90 via-indigo-50/40 to-slate-50 px-4 py-3 border-b border-blue-100 flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 shadow-xs ${badgeCfg2.bg} ${badgeCfg2.text}`}>{badgeCfg2.letter}</div>
                                          <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <span className="text-xs font-black text-slate-900 uppercase tracking-wide">{pat.txnType} Pattern</span>
                                              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100/70 text-blue-700 border border-blue-200">{pat.matchingCount || 0} transactions</span>
                                              {isAppl ? (
                                                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                                                  <Check size={11} strokeWidth={3} /> Applied
                                                </span>
                                              ) : (
                                                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                                                  <AlertCircle size={11} /> Unapplied
                                                </span>
                                              )}
                                            </div>
                                            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">Sample Narration:</span>
                                              <span className="font-mono text-slate-700 bg-slate-100/90 px-2 py-0.5 rounded text-[10.5px] border border-slate-200/70 truncate max-w-xl select-all" title={sampNarr}>
                                                {sampNarr || 'No sample narration'}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); setSelectedPatternId(null); }}
                                          className="p-1.5 rounded-xl hover:bg-slate-200/80 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer shrink-0"
                                          title="Close Details"
                                        >
                                          <X size={16} />
                                        </button>
                                      </div>

                                      {/* Grid: Left (Tokens + Rule) | Right (Scrollable Extracted Values Box) */}
                                      <div className="grid grid-cols-1 xl:grid-cols-2 divide-y xl:divide-y-0 xl:divide-x divide-slate-100">
                                        {/* LEFT COLUMN: Tokens & Rule */}
                                        <div className="p-4 space-y-4">
                                          {/* 1. Detected Pattern Tokens */}
                                          <div>
                                            <div className="flex items-center justify-between mb-2">
                                              <div className="flex items-center gap-2">
                                                <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center text-[10.5px] font-black">1</span>
                                                <span className="text-xs font-black text-slate-800 uppercase tracking-wider">Detected Pattern Tokens</span>
                                              </div>
                                              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">Click token → set Party</span>
                                            </div>

                                            {/* Token Chips */}
                                            <div className="flex flex-wrap gap-2">
                                              {Array.from({ length: dynCnt }).map((_, idx) => {
                                                const isParty2 = idx === eff.partyPosition;
                                                const tokVal = (realPts[idx] !== undefined && realPts[idx] !== '') ? realPts[idx] : (tokList[idx]?.sampleValue || '');
                                                if (!tokVal) return null;
                                                const mMatch = tokVal && /[a-z]/i.test(tokVal) && !isStopPhrase(tokVal) ? findBestLedgerMatch(tokVal, normalizedAllLedgers) : null;
                                                const isMM = mMatch && mMatch.score >= 70;
                                                const lbl = idx === 0 && pat.txnType ? pat.txnType : tokVal;
                                                return (
                                                  <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      handleUpdatePatternIndex(pat.id, 'partyPosition', idx);
                                                    }}
                                                    className={`group inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium cursor-pointer transition-all duration-150 text-left shadow-2xs ${
                                                      isParty2
                                                        ? 'bg-blue-50/90 border-2 border-blue-600 text-blue-950 shadow-sm ring-2 ring-blue-100'
                                                        : isMM
                                                          ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 hover:bg-emerald-100/80 hover:border-emerald-400'
                                                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                                                    }`}
                                                    title={`Index [${idx}]: "${tokVal}"${isMM ? ` (Master Match: ${mMatch.ledger} ${mMatch.score}%)` : ''}`}
                                                  >
                                                    <span
                                                      className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black shrink-0 ${
                                                        isParty2
                                                          ? 'bg-blue-600 text-white'
                                                          : isMM
                                                            ? 'bg-emerald-600 text-white'
                                                            : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                                                      }`}
                                                    >
                                                      {idx}
                                                    </span>
                                                    <span className="font-mono text-[11px] font-bold max-w-[200px] truncate" title={lbl}>
                                                      {lbl}
                                                    </span>
                                                    {isParty2 && (
                                                      <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-blue-600 text-white uppercase tracking-wider shrink-0">
                                                        Party
                                                      </span>
                                                    )}
                                                    {!isParty2 && isMM && (
                                                      <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-600 text-white uppercase tracking-wider shrink-0">
                                                        Match
                                                      </span>
                                                    )}
                                                  </button>
                                                );
                                              })}
                                            </div>

                                            {/* Active Party Helper Callout */}
                                            {eff.partyPosition >= 0 && (
                                              <div className="mt-2.5 flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50/70 border border-blue-200 text-[11px] text-blue-900">
                                                <CheckCircle2 size={13} className="text-blue-600 shrink-0" />
                                                <span className="truncate">
                                                  Selected Party Source: <strong className="font-black text-blue-700">Index #{eff.partyPosition}</strong>
                                                  {realPts[eff.partyPosition] ? ` — "${realPts[eff.partyPosition]}"` : ''}
                                                </span>
                                              </div>
                                            )}
                                          </div>

                                          {/* 2. Extraction Rule */}
                                          <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                              <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center text-[10.5px] font-black">2</span>
                                              <span className="text-xs font-black text-slate-800 uppercase tracking-wider">Extraction Rule</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50/80 rounded-xl border border-slate-200">
                                              <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Party Name Index</label>
                                                <select
                                                  value={eff.partyPosition}
                                                  onClick={e => e.stopPropagation()}
                                                  onChange={(e) => handleUpdatePatternIndex(pat.id, 'partyPosition', e.target.value)}
                                                  className="w-full h-8 px-2.5 rounded-lg border text-xs font-semibold bg-white text-slate-800 outline-none focus:border-blue-600 cursor-pointer shadow-2xs"
                                                  style={{ borderColor: 'var(--app-border)' }}
                                                >
                                                  <option value={-1}>None</option>
                                                  {Array.from({ length: dynCnt }).map((_, idx) => {
                                                    const sv = realPts[idx] || (tokList[idx]?.sampleValue) || '';
                                                    if (!sv) return null;
                                                    const m = sv && /[a-z]/i.test(sv) && !isStopPhrase(sv) ? findBestLedgerMatch(sv, normalizedAllLedgers) : null;
                                                    const sfx = m && m.score >= 70 ? ` ★ ${m.ledger} (${m.score}%)` : '';
                                                    return <option key={idx} value={idx}>Position {idx} — "{sv.length > 18 ? sv.slice(0, 16) + '...' : sv}"{sfx}</option>;
                                                  })}
                                                </select>
                                              </div>
                                              <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Txn ID Index</label>
                                                <select
                                                  value={eff.txnIdPosition}
                                                  onClick={e => e.stopPropagation()}
                                                  onChange={(e) => handleUpdatePatternIndex(pat.id, 'txnIdPosition', e.target.value)}
                                                  className="w-full h-8 px-2.5 rounded-lg border text-xs font-semibold bg-white text-slate-800 outline-none focus:border-blue-600 cursor-pointer shadow-2xs"
                                                  style={{ borderColor: 'var(--app-border)' }}
                                                >
                                                  <option value={-1}>None</option>
                                                  {Array.from({ length: dynCnt }).map((_, idx) => {
                                                    const sv = realPts[idx] || (tokList[idx]?.sampleValue) || '';
                                                    if (!sv) return null;
                                                    return <option key={idx} value={idx}>Position {idx} — "{sv.length > 18 ? sv.slice(0, 16) + '...' : sv}"</option>;
                                                  })}
                                                </select>
                                              </div>
                                              <div className="col-span-2 flex items-center justify-between pt-1 border-t border-slate-200/70 text-[11px]">
                                                <div className="flex items-center gap-2">
                                                  <span className="font-semibold text-slate-500">Separator:</span>
                                                  <span className="px-2 py-0.5 rounded-md border bg-white text-slate-800 font-mono font-bold border-slate-200">
                                                    {pat.separator === '/' ? '/ (Forward Slash)' : (pat.separator || '/ (Forward Slash)')}
                                                  </span>
                                                </div>
                                                <span className="text-[10px] text-slate-400 flex items-center gap-1 font-medium">
                                                  <AlertCircle size={12} className="text-blue-600" /> Delimiter + fuzzy
                                                </span>
                                              </div>
                                            </div>
                                          </div>
                                        </div>

                                        {/* RIGHT COLUMN: Extracted Values (Scrollable Box) */}
                                        <div className="p-4 space-y-3 flex flex-col justify-between">
                                          <div>
                                            <div className="flex items-center justify-between mb-2">
                                              <div className="flex items-center gap-2">
                                                <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center text-[10.5px] font-black">3</span>
                                                <span className="text-xs font-black text-slate-800 uppercase tracking-wider">Extracted Values</span>
                                              </div>
                                              <div className="flex items-center gap-1.5">
                                                <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                                  {distList.length} Unique Parties
                                                </span>
                                                <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                                  {pat.matchingCount || 0} Total Txns
                                                </span>
                                              </div>
                                            </div>

                                            {/* Scrollable Box Container */}
                                            <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
                                              <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-100">
                                                <table className="w-full text-left text-xs border-collapse">
                                                  <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-xs border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                                    <tr>
                                                      <th className="py-2 px-3">Extracted Party</th>
                                                      <th className="py-2 px-2 text-center w-14">Txns</th>
                                                      <th className="py-2 px-3">Master Ledger Mapping</th>
                                                      <th className="py-2 px-2 text-center w-16">Conf.</th>
                                                    </tr>
                                                  </thead>
                                                  <tbody className="divide-y divide-slate-100 bg-white">
                                                    {distList.length > 0 ? (
                                                      distList.map((dp, i) => {
                                                        const pNarrs = (() => {
                                                          if (dp.sampleTransactions && dp.sampleTransactions.length > 0) { const l = dp.sampleTransactions.map(t => t.narration || t.sampleNarration || t.raw_narration).filter(Boolean); if (l.length > 0) return l; }
                                                          if (pat?.transactions && pat.transactions.length > 0) { const pu = (dp.party || '').toUpperCase(); const ml = pat.transactions.filter(t => (t.narration || '').toUpperCase().includes(pu)).map(t => t.narration).filter(Boolean); if (ml.length > 0) return ml; }
                                                          return sampNarrList.length > 0 ? sampNarrList : [sampNarr].filter(Boolean);
                                                        })();
                                                        const isExp = expandedPartyNarrations === dp.party;
                                                        return (
                                                          <React.Fragment key={i}>
                                                            <tr className={`hover:bg-blue-50/30 transition-colors ${isExp ? 'bg-blue-50/60' : ''}`}>
                                                              <td className="py-2 px-3 font-bold text-slate-800 text-[11px] align-middle">
                                                                <div className="break-words whitespace-normal leading-snug">{dp.party}</div>
                                                              </td>
                                                              <td className="py-2 px-2 text-center align-middle">
                                                                <div className="inline-flex items-center gap-1 justify-center">
                                                                  <span className="font-bold font-mono text-[11px] text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                                                                    {dp.count}
                                                                  </span>
                                                                  <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                      e.stopPropagation();
                                                                      setExpandedPartyNarrations(prev => prev === dp.party ? null : dp.party);
                                                                    }}
                                                                    className={`p-1 rounded-md cursor-pointer transition-colors ${
                                                                      isExp ? 'bg-blue-100 text-blue-700' : 'text-slate-400 hover:text-blue-600 hover:bg-slate-100'
                                                                    }`}
                                                                    title="View sample narrations"
                                                                  >
                                                                    <Eye size={12} />
                                                                  </button>
                                                                </div>
                                                              </td>
                                                              <td className="py-1.5 px-3 align-middle" onClick={e => e.stopPropagation()}>
                                                                <SmartLedgerDropdown
                                                                  value={dp.mappedLedger === 'Unmapped' ? '' : (dp.mappedLedger || '')}
                                                                  onChange={(newLedger) => handlePartyLedgerOverride(pat.id, dp.party, newLedger)}
                                                                  options={normalizedAllLedgers}
                                                                  extractedParty={dp.party}
                                                                  narration={pNarrs[0] || sampNarr}
                                                                  confidence={dp.mappedLedger && dp.mappedLedger !== 'Unmapped' ? (dp.confidence || 0) : 0}
                                                                />
                                                              </td>
                                                              <td className="py-2 px-2 text-center align-middle">
                                                                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                  {dp.confidence || 95}%
                                                                </span>
                                                              </td>
                                                            </tr>
                                                            {isExp && (
                                                              <tr className="bg-blue-50/50 border-y border-blue-200">
                                                                <td colSpan={4} className="p-3">
                                                                  <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-blue-200/60">
                                                                    <span className="text-[11px] font-bold text-blue-700 flex items-center gap-1.5">
                                                                      <Eye size={12} /> Narrations matching "{dp.party}" ({pNarrs.length}):
                                                                    </span>
                                                                    <button
                                                                      type="button"
                                                                      onClick={(e) => { e.stopPropagation(); setExpandedPartyNarrations(null); }}
                                                                      className="text-[10px] font-bold text-slate-500 hover:text-slate-800 px-1.5 py-0.5 rounded hover:bg-blue-100 cursor-pointer"
                                                                    >
                                                                      ✕ Close
                                                                    </button>
                                                                  </div>
                                                                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                                                                    {pNarrs.map((narr, nIdx) => (
                                                                      <div key={nIdx} className="p-2 rounded-lg bg-white border border-blue-100 font-mono text-[10.5px] text-slate-800 break-words leading-relaxed select-all shadow-2xs">
                                                                        {narr}
                                                                      </div>
                                                                    ))}
                                                                  </div>
                                                                </td>
                                                              </tr>
                                                            )}
                                                          </React.Fragment>
                                                        );
                                                      })
                                                    ) : (
                                                      <tr>
                                                        <td colSpan={4} className="py-8 text-center text-slate-400 italic text-xs">
                                                          No parties extracted. Check party index selection.
                                                        </td>
                                                      </tr>
                                                    )}
                                                  </tbody>
                                                </table>
                                              </div>
                                            </div>
                                          </div>

                                          {/* Apply Pattern Mapping Button */}
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleApplyPatternIndexing(pat);
                                              setAppliedPatternIds(prev => new Set([...prev, pat.id, pat.txnType]));
                                            }}
                                            className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-[#2563EB] hover:bg-blue-700 active:bg-blue-800 text-white shadow-sm hover:shadow transition-all cursor-pointer flex items-center justify-center gap-1.5"
                                          >
                                            <Check size={14} strokeWidth={2.5} />
                                            <span>Apply Pattern Mapping ({pat.matchingCount || 0} Transactions)</span>
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })()}
                          </React.Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Left Table Pagination Footer */}
                <div className="flex items-center justify-between px-3 py-1.5 border-t shrink-0 text-xs text-slate-500 bg-white" style={{ borderColor: 'var(--app-border)' }}>
                  <div>
                    Showing <span className="font-bold text-slate-800">{paginatedPatterns.length}</span> of <span className="font-bold text-slate-800">{combinedPatterns.length}</span> patterns
                  </div>
                  {totalPatternPages > 1 && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setPatternPage(p => Math.max(1, p - 1))}
                        disabled={patternPage === 1}
                        className="w-6 h-6 flex items-center justify-center border rounded hover:bg-slate-50 disabled:opacity-40 cursor-pointer font-bold text-xs"
                        style={{ borderColor: 'var(--app-border)' }}
                      >
                        ‹
                      </button>
                      <span className="px-1 text-[11px] font-semibold">Page {patternPage} of {totalPatternPages}</span>
                      <button
                        onClick={() => setPatternPage(p => Math.min(totalPatternPages, p + 1))}
                        disabled={patternPage >= totalPatternPages}
                        className="w-6 h-6 flex items-center justify-center border rounded hover:bg-slate-50 disabled:opacity-40 cursor-pointer font-bold text-xs"
                        style={{ borderColor: 'var(--app-border)' }}
                      >
                        ›
                      </button>
                    </div>
                  )}
                </div>
            </div>
          </div>
        </div>
        )}
      </div>

      {/* Floating Unclipped Tooltip for Hovering on Party Eye Icon */}
      {hoveredPartyNarrations && (
        <div
          className="fixed z-[9999] w-[420px] max-w-[92vw] bg-white text-slate-800 rounded-xl shadow-2xl border border-slate-200 p-3 pointer-events-none transition-all duration-150 animate-in fade-in"
          style={{
            top: Math.max(16, Math.min(window.innerHeight - 290, hoveredPartyNarrations.rect.top - 10)),
            left: Math.max(16, hoveredPartyNarrations.rect.left - 430),
          }}
        >
          <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-100">
            <div className="flex items-center gap-1.5">
              <Eye size={13} className="text-[#2563EB]" />
              <span className="text-[10.5px] font-black uppercase text-blue-600 tracking-wider">
                Full Narration Descriptions ({hoveredPartyNarrations.narrations.length} txns)
              </span>
            </div>
            <span className="text-[10px] font-bold text-slate-700 font-mono truncate max-w-[150px] bg-slate-100 px-1.5 py-0.5 rounded">
              {hoveredPartyNarrations.party}
            </span>
          </div>

          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {hoveredPartyNarrations.narrations.map((narr, idx) => (
              <div
                key={idx}
                className="p-2 rounded-lg bg-slate-50 border border-slate-200/80 font-mono text-[10.5px] text-slate-700 break-words leading-relaxed select-all"
              >
                {narr}
              </div>
            ))}
          </div>
          <div className="mt-1.5 text-[9.5px] text-slate-400 italic text-right">
            Click eye icon to keep open in table
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: ADD CUSTOM PATTERN                                                         */}
      {/* ═════════════════════════════════════════════════════════════════════════════════ */}
      {isAddPatternOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-xl bg-[var(--app-panel-bg)] rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            style={{ borderColor: 'var(--app-border)' }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b shrink-0" style={{ borderColor: 'var(--app-border)' }}>
              <div>
                <h3 className="text-base font-black text-[var(--app-heading)]">Add Custom Pattern Rule</h3>
                <p className="text-xs text-[var(--app-muted)]">Create a deterministic pattern match for {selectedBankLedger}</p>
              </div>
              <button
                onClick={() => setIsAddPatternOpen(false)}
                className="p-1 rounded-lg hover:bg-[var(--app-control-hover)] text-[var(--app-muted)] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveCustomPattern} className="p-5 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-[var(--app-muted)] uppercase tracking-wider block mb-1">
                    Bank Account
                  </label>
                  <input
                    type="text"
                    disabled
                    value={selectedBankLedger}
                    className="w-full h-8 px-3 rounded-lg border text-xs font-bold bg-[var(--app-control-bg)] text-[var(--app-heading)] opacity-80 cursor-not-allowed"
                    style={{ borderColor: 'var(--app-border)' }}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[var(--app-muted)] uppercase tracking-wider block mb-1">
                    Rule Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={newPatternName}
                    onChange={(e) => setNewPatternName(e.target.value)}
                    placeholder="e.g. Vendor UPI Match"
                    className="w-full h-8 px-3 rounded-lg border text-xs font-medium outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[#2563EB]"
                    style={{ borderColor: 'var(--app-border)' }}
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-[var(--app-muted)] uppercase tracking-wider block mb-1">
                  Narration Pattern / Keyword *
                </label>
                <input
                  type="text"
                  required
                  value={newPatternString}
                  onChange={(e) => setNewPatternString(e.target.value)}
                  placeholder="e.g. AMRAPUR MEDICAL, ashokgupta1924@, CLG/..."
                  className="w-full h-8 px-3 rounded-lg border text-xs font-bold outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[#2563EB]"
                  style={{ borderColor: 'var(--app-border)' }}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-[var(--app-muted)] uppercase tracking-wider block mb-1">Match Type</label>
                  <select
                    value={newMatchType}
                    onChange={(e) => setNewMatchType(e.target.value)}
                    className="w-full h-8 px-2 rounded-lg border text-xs font-bold outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[#2563EB]"
                    style={{ borderColor: 'var(--app-border)' }}
                  >
                    <option value="contains">Contains Keyword</option>
                    <option value="startswith">Starts With</option>
                    <option value="exact">Exact Match</option>
                    <option value="regex">Regex Pattern</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[var(--app-muted)] uppercase tracking-wider block mb-1">Txn Type</label>
                  <select
                    value={newTxnType}
                    onChange={(e) => setNewTxnType(e.target.value)}
                    className="w-full h-8 px-2 rounded-lg border text-xs font-bold outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[#2563EB]"
                    style={{ borderColor: 'var(--app-border)' }}
                  >
                    <option value="UPI">UPI</option>
                    <option value="NEFT">NEFT</option>
                    <option value="IMPS">IMPS</option>
                    <option value="RTGS">RTGS</option>
                    <option value="Bank Charges">Bank Charges</option>
                    <option value="POS">POS</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[var(--app-muted)] uppercase tracking-wider block mb-1">Direction</label>
                  <select
                    value={newDirection}
                    onChange={(e) => setNewDirection(e.target.value)}
                    className="w-full h-8 px-2 rounded-lg border text-xs font-bold outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[#2563EB]"
                    style={{ borderColor: 'var(--app-border)' }}
                  >
                    <option value="any">Any (Debit/Credit)</option>
                    <option value="debit">Payment Only</option>
                    <option value="credit">Receipt Only</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-[var(--app-muted)] uppercase tracking-wider block mb-1">
                  Target Counterpart Ledger *
                </label>
                <select
                  required
                  value={newPartyLedger}
                  onChange={(e) => setNewPartyLedger(e.target.value)}
                  className="w-full h-8 px-3 rounded-lg border text-xs font-bold outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[#2563EB]"
                  style={{ borderColor: 'var(--app-border)' }}
                >
                  <option value="">-- Select Master Ledger --</option>
                  {allLedgersList.map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-[var(--app-muted)] uppercase tracking-wider block mb-1">
                  Sample Narration for Testing (Optional)
                </label>
                <input
                  type="text"
                  value={newSampleNarration}
                  onChange={(e) => setNewSampleNarration(e.target.value)}
                  placeholder="e.g. UPI/456789/AMRAPUR MEDICAL/amrapur@okhdfc"
                  className="w-full h-8 px-3 rounded-lg border text-xs font-mono outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[#2563EB]"
                  style={{ borderColor: 'var(--app-border)' }}
                />
              </div>

              {/* Test Result Simulation */}
              {patternTestResult && (
                <div className="p-3 rounded-xl border bg-[var(--app-control-bg)] text-xs space-y-1" style={{ borderColor: 'var(--app-border)' }}>
                  <div className="flex items-center justify-between font-bold">
                    <span>Test Result:</span>
                    <span className={patternTestResult.matched_count > 0 ? 'text-emerald-600' : 'text-amber-600'}>
                      {patternTestResult.matched_count} matching transaction(s) found
                    </span>
                  </div>
                  {patternTestResult.sample_matches?.length > 0 && (
                    <div className="text-[10.5px] font-mono text-[var(--app-muted)] truncate">
                      Sample match: "{patternTestResult.sample_matches[0]}"
                    </div>
                  )}
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'var(--app-border)' }}>
                <button
                  type="button"
                  onClick={handleTestPattern}
                  disabled={testingPattern || !newPatternString.trim()}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border text-xs font-bold hover:bg-[var(--app-control-hover)] transition-all cursor-pointer disabled:opacity-50"
                  style={{ borderColor: 'var(--app-border)' }}
                >
                  <Sparkles size={13} className={testingPattern ? 'animate-spin' : 'text-[#2563EB]'} />
                  <span>{testingPattern ? 'Testing...' : 'Test Pattern'}</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddPatternOpen(false)}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-bold hover:bg-[var(--app-control-hover)] text-[var(--app-muted)] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingPattern || !newPatternString.trim() || !newPartyLedger}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider bg-[#2563EB] text-white shadow-xs hover:opacity-90 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {savingPattern ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} strokeWidth={3} />}
                    <span>Save Pattern</span>
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: INSPECT CONTRIBUTING TRANSACTIONS                                         */}
      {/* ═════════════════════════════════════════════════════════════════════════════════ */}
      {inspectingPartyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[var(--app-panel-bg)] border border-[var(--app-border)] rounded-2xl max-w-3xl w-full max-h-[80vh] flex flex-col shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between p-4 border-b border-[var(--app-border)] shrink-0">
              <div>
                <h3 className="text-sm font-black text-[var(--app-heading)] flex items-center gap-2">
                  <Eye size={15} className="text-[#2563EB]" />
                  <span>Contributing Transactions — {inspectingPartyModal.party}</span>
                </h3>
                <p className="text-xs text-[var(--app-muted)] mt-0.5">
                  Pattern: <span className="font-bold text-[var(--app-heading)]">{inspectingPartyModal.patternName}</span> • {inspectingPartyModal.transactions?.length || 0} matching transactions
                </p>
              </div>
              <button
                onClick={() => setInspectingPartyModal(null)}
                className="p-1.5 rounded-lg hover:bg-[var(--app-control-hover)] text-[var(--app-muted)] transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              {(!inspectingPartyModal.transactions || inspectingPartyModal.transactions.length === 0) ? (
                <div className="py-12 text-center text-xs text-[var(--app-muted)]">
                  No detailed transaction records available for inspection.
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--app-border)] text-[10px] font-black uppercase text-[var(--app-muted)] bg-[var(--app-control-bg)]">
                      <th className="py-2 px-2.5 w-[15%]">DATE</th>
                      <th className="py-2 px-2.5 w-[20%]">REF / UTR</th>
                      <th className="py-2 px-2.5 w-[15%] text-right">AMOUNT</th>
                      <th className="py-2 px-3 w-[50%]">RAW BANK NARRATION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--app-border)] font-mono text-[11px]">
                    {inspectingPartyModal.transactions.map((tx, idx) => (
                      <tr key={idx} className="hover:bg-[var(--app-content-bg)]/40 transition-colors">
                        <td className="py-2 px-2.5 text-[var(--app-muted)]">{tx.date || '—'}</td>
                        <td className="py-2 px-2.5 font-bold text-[#2563EB]">{tx.reference || tx.reference_number || tx.item_id || '—'}</td>
                        <td className="py-2 px-2.5 text-right font-bold text-[var(--app-heading)]">
                          {tx.withdrawal_amount ? `-₹${tx.withdrawal_amount}` : (tx.deposit_amount ? `+₹${tx.deposit_amount}` : (tx.amount ? `₹${tx.amount}` : '—'))}
                        </td>
                        <td className="py-2 px-3 text-[var(--app-heading)] break-all">{tx.narration || tx.raw_narration || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="p-3.5 border-t border-[var(--app-border)] flex justify-end shrink-0">
              <button
                onClick={() => setInspectingPartyModal(null)}
                className="px-4 py-1.5 bg-[#2563EB] text-white rounded-lg text-xs font-black uppercase tracking-wider hover:opacity-90 transition-all cursor-pointer shadow-xs"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
