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
  const isExactMatch = !!(
    row.suggestedLedger &&
    partyText !== '—' &&
    row.suggestedLedger.trim().toUpperCase() === partyText.trim().toUpperCase()
  );

  const handleLedgerChange = useCallback((newVal) => {
    if (onSelectLedger) onSelectLedger(row, newVal);
  }, [row, onSelectLedger]);

  return (
    <tr className="hover:bg-[var(--app-content-bg)]/40 transition-colors group">
      {/* Column 1: EXTRACTED PARTY / LEDGER & TRANSACTION DETAILS */}
      <td className="py-3 px-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[12.5px] font-black text-[var(--app-heading)] tracking-tight">
              {partyText}
            </span>
            {isExactMatch && (
              <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                Exact
              </span>
            )}
          </div>
          <div className="text-[10.5px] font-medium text-[var(--app-muted)] truncate max-w-[440px] mt-0.5 flex items-center gap-1.5 flex-wrap">
            {row.date && (
              <span className="font-mono font-bold text-[var(--app-heading)]">{row.date}</span>
            )}
            {row.amount !== undefined && (
              <span className={`font-black font-mono ${row.voucherType === 'Receipt' ? 'text-emerald-600' : 'text-rose-600'}`}>
                {row.voucherType === 'Receipt' ? '+' : '-'} ₹{Number(row.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            )}
            {row.referenceNumber && row.referenceNumber !== '—' && (
              <span className="font-mono text-[10px]">Ref: {row.referenceNumber}</span>
            )}
            {row.narration && (
              <span className="truncate max-w-[260px]" title={row.narration}>• {row.narration}</span>
            )}
          </div>
        </div>
      </td>

      {/* Column 2: LEDGER SELECTION (Smart Dropdown) */}
      <td className="py-3 px-3">
        <div className="min-w-[200px] max-w-[280px]">
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

      {/* Column 3: CONFIDENCE SCORE */}
      <td className="py-3 px-3 text-center">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold font-mono border shadow-xs ${
            conf >= 90
              ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50'
              : conf >= 60
                ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/50'
                : 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/50'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${conf >= 90 ? 'bg-emerald-500' : conf >= 60 ? 'bg-amber-500' : 'bg-rose-500'}`} />
          <span>{conf}%</span>
        </span>
      </td>

      {/* Column 4: MAPPING METHOD */}
      <td className="py-3 px-4 text-center">
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold border shadow-xs ${
            isExactMatch || row.mappingMethod === 'System • Exact Match'
              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25'
              : row.mappingMethod === 'User Confirmed' || row.mappingMethod === 'User Mapped'
                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25'
                : row.mappingMethod === 'AI Suggested' || row.mappingMethod === 'AI Pattern Applied'
                  ? 'bg-purple-500/10 text-purple-600 border-purple-500/25'
                  : 'bg-slate-500/10 text-slate-600 border-slate-500/25'
          }`}
        >
          {isExactMatch ? 'System • Exact Match' : (row.mappingMethod || 'Unmapped')}
        </span>
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
  const [customPatternIndexes, setCustomPatternIndexes] = useState({});
  const [partyLedgerOverrides, setPartyLedgerOverrides] = useState({});
  const [inspectingPartyModal, setInspectingPartyModal] = useState(null);

  const handleUpdatePatternIndex = (patId, field, newIndex) => {
    setCustomPatternIndexes(prev => ({
      ...prev,
      [patId]: {
        ...(prev[patId] || {}),
        [field]: Number(newIndex)
      }
    }));
  };

  const handlePartyLedgerOverride = (patId, partyName, ledgerName) => {
    setPartyLedgerOverrides(prev => ({
      ...prev,
      [`${patId}_${partyName}`]: ledgerName
    }));
  };

  const getEffectivePatternData = (pat) => {
    const custom = customPatternIndexes[pat.id];
    const partyPos = custom?.partyPosition !== undefined ? custom.partyPosition : (pat.partyPosition !== undefined ? pat.partyPosition : -1);
    const txnIdPos = custom?.txnIdPosition !== undefined ? custom.txnIdPosition : (pat.txnIdPosition !== undefined ? pat.txnIdPosition : -1);
    const vpaPos = custom?.vpaPosition !== undefined ? custom.vpaPosition : (pat.vpaPosition !== undefined ? pat.vpaPosition : -1);

    const txns = pat.transactions || [];
    const sep = pat.separator || '/';
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
        } catch (e) {}
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

        setLedgerMappings(prev => prev.map(m => {
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
              mappingMethod: mappedInfo ? 'AI Pattern Applied' : m.mappingMethod
            };
          }
          return m;
        }));
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
    if (!silent && (!cached || (!cached.rules?.length && !cached.suggestions?.length))) {
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
      } else if (ledgerMappings && ledgerMappings.length > 0) {
        // Synthesizes patterns instantly from already loaded statement transactions
        setLoadingPatterns(false);
      } else {
        fetchPatterns(false);
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
        // Update local state instantly
        setLedgerMappings(prev => prev.map(m => {
          if (m.patternId === mappingItem.patternId) {
            return {
              ...m,
              suggestedLedger: newLedger,
              confidence: 100,
              mappingMethod: isExact ? 'System • Exact Match' : 'User Mapped'
            };
          }
          return m;
        }));
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

    // 1. Group loaded statement transactions (Tab 1) into Transaction Types & Distinct Structural Patterns
    if (hasStatementTxns) {
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
    } else if (suggestions && suggestions.length > 0) {
      // ONLY fallback to backend AI suggestions if no statement transactions are in memory
      suggestions.forEach(s => {
        const type = (s.transactionType || s.txnType || s.channel || 'OTHER').toUpperCase();
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
            distinctPartiesMap: (s.distinctParties || []).reduce((acc, dp) => {
              acc[dp.party] = dp;
              return acc;
            }, {})
          });
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
  }, [allCombinedPatterns, selectedTxnType, patternFilter, patternSearch]);

  const paginatedPatterns = useMemo(() => {
    const safeList = combinedPatterns || [];
    if (patternPageSize === 'all') return safeList;
    const size = Number(patternPageSize) || 25;
    const start = (patternPage - 1) * size;
    return safeList.slice(start, start + size);
  }, [combinedPatterns, patternPage, patternPageSize]);

  const totalPatternPages = useMemo(() => {
    if (patternPageSize === 'all') return 1;
    const size = Number(patternPageSize) || 25;
    return Math.max(1, Math.ceil((combinedPatterns?.length || 0) / size));
  }, [combinedPatterns?.length, patternPageSize]);

  if (!isOpen) return null;

  return (
    <div className="flex flex-col gap-3 h-full w-full overflow-hidden bg-[var(--app-content-bg)] text-[var(--app-heading)]">
      
      {/* ── TOP HEADER (Bank Mapping & Shared Bank Context) ── */}
      <div className="flex flex-col gap-3 shrink-0">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[20px] font-black tracking-tight text-[var(--app-heading)]">
              Bank Mapping
            </h1>
            <p className="text-[12.5px] font-medium text-[var(--app-muted)] mt-0.5">
              Automatically identify bank transaction patterns and map them to the correct party ledgers.
            </p>
          </div>

          {/* Bank Account Shared Context & Back Button */}
          <div className="flex items-center gap-2.5">
            {/* Bank Account Selector Card matching screenshot */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsBankSelectorOpen(!isBankSelectorOpen)}
                className="flex items-center gap-3 px-3.5 py-1.5 rounded-xl border bg-[var(--app-panel-bg)] hover:border-[var(--app-accent)] transition-all cursor-pointer shadow-xs min-w-[280px]"
                style={{ borderColor: 'var(--app-border)' }}
              >
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                  <Landmark size={17} />
                </div>
                <div className="text-left flex-1 min-w-0">
                  <span className="text-[10px] font-bold text-[var(--app-muted)] uppercase tracking-wider block">Bank Account</span>
                  <span className="text-[12.5px] font-black text-[var(--app-heading)] block truncate">
                    {selectedBankLedger}
                  </span>
                </div>
                <ChevronDown size={15} className="text-[var(--app-muted)] shrink-0" />
              </button>

              {/* Dropdown Menu */}
              {isBankSelectorOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setIsBankSelectorOpen(false)} />
                  <div
                    className="absolute left-0 mt-1.5 w-full bg-[var(--app-panel-bg)] border rounded-xl shadow-xl z-30 py-1 max-h-60 overflow-y-auto"
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
                          className={`w-full text-left px-3.5 py-2 text-xs font-bold hover:bg-[var(--app-control-hover)] flex items-center justify-between transition-colors ${
                            selectedBankLedger === bl ? 'text-[var(--app-accent)] bg-blue-500/5' : 'text-[var(--app-heading)]'
                          }`}
                        >
                          <span className="truncate">{bl}</span>
                          {selectedBankLedger === bl && <Check size={14} />}
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-xs text-[var(--app-muted)]">No bank ledgers available</div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Back Button */}
            {onClose && (
              <button
                onClick={onClose}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold text-[var(--app-muted)] hover:text-[var(--app-heading)] hover:bg-[var(--app-control-hover)] transition-all cursor-pointer shadow-xs"
                style={{ borderColor: 'var(--app-border)' }}
                title="Return to Review"
              >
                <ArrowLeft size={14} />
                <span>Back</span>
              </button>
            )}
          </div>
        </div>

        {/* ── MAIN NAVIGATION (Only 2 Tabs matching screenshot) ── */}
        <div className="flex items-center gap-1 shrink-0 border-b pb-0.5" style={{ borderColor: 'var(--app-border)' }}>
          <button
            onClick={() => setActiveTab('ledger_mapping')}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'ledger_mapping'
                ? 'bg-[#2563EB] text-white shadow-sm font-black'
                : 'text-[var(--app-muted)] hover:text-[var(--app-heading)] hover:bg-[var(--app-panel-bg)]'
            }`}
          >
            <Layers size={14} />
            <span>Ledger Mapping</span>
          </button>

          <button
            onClick={() => setActiveTab('pattern_mapping')}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'pattern_mapping'
                ? 'bg-[#2563EB] text-white shadow-sm font-black'
                : 'text-[var(--app-muted)] hover:text-[var(--app-heading)] hover:bg-[var(--app-panel-bg)]'
            }`}
          >
            <GitBranch size={14} />
            <span>Pattern Mapping</span>
          </button>
        </div>
      </div>

      {/* ── TAB CONTENT CARD CONTAINER ── */}
      <div className="flex-1 flex flex-col min-h-0 bg-[var(--app-panel-bg)] rounded-2xl border shadow-sm overflow-hidden" style={{ borderColor: 'var(--app-border)' }}>
        
        {/* ═════════════════════════════════════════════════════════════════════════════════ */}
        {/* TAB 1: LEDGER MAPPING                                                             */}
        {/* ═════════════════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'ledger_mapping' && (
          <div className="flex-1 flex flex-col min-h-0 h-full overflow-hidden">
            {/* Card Header with Title, Search & Filter */}
            <div className="flex items-center justify-between gap-3 p-4 border-b shrink-0 flex-wrap" style={{ borderColor: 'var(--app-border)' }}>
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-[15px] font-black text-[var(--app-heading)] tracking-tight">Ledger Mapping</h2>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20">
                    {ledgerMappings.length} Total Transactions
                  </span>
                  {enrichedLedgerMappings.filter(m => m.suggestedLedger && m.suggestedLedger !== 'Unmapped').length > 0 && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                      {enrichedLedgerMappings.filter(m => m.suggestedLedger && m.suggestedLedger !== 'Unmapped').length} Auto-Mapped
                    </span>
                  )}
                </div>
                <p className="text-[11.5px] font-medium text-[var(--app-muted)] mt-0.5">
                  Review and assign party ledgers for transactions extracted from your bank statement.
                </p>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                {/* Search Box */}
                <div className="relative min-w-[240px]">
                  <Search className="absolute left-2.5 top-2.5 text-[var(--app-muted)]" size={13} />
                  <input
                    type="text"
                    value={mappingSearch}
                    onChange={(e) => setMappingSearch(e.target.value)}
                    placeholder="Search pattern, party or ledger..."
                    className="w-full h-8 pl-8 pr-3 border rounded-lg text-[11.5px] font-medium outline-none bg-[var(--app-control-bg)] text-[var(--app-heading)] focus:border-[#2563EB] transition-colors"
                    style={{ borderColor: 'var(--app-border)' }}
                  />
                </div>

                {/* Filter Dropdown */}
                <div className="relative">
                  <select
                    value={mappingFilter}
                    onChange={(e) => setMappingFilter(e.target.value)}
                    className="h-8 pl-2.5 pr-7 border rounded-lg text-[11.5px] font-bold bg-[var(--app-control-bg)] text-[var(--app-heading)] outline-none cursor-pointer focus:border-[#2563EB]"
                    style={{ borderColor: 'var(--app-border)' }}
                  >
                    <option value="all">All Mappings</option>
                    <option value="mapped">Mapped Ledgers</option>
                    <option value="unmapped">Unmapped / Review</option>
                    <option value="confirmed">User Confirmed</option>
                  </select>
                </div>

                {/* Refresh */}
                <button
                  onClick={fetchLedgerMappings}
                  disabled={loadingLedgerMappings}
                  className="p-2 border rounded-lg text-[var(--app-muted)] hover:text-[var(--app-heading)] hover:bg-[var(--app-control-hover)] transition-all cursor-pointer"
                  style={{ borderColor: 'var(--app-border)' }}
                  title="Refresh Mappings"
                >
                  <RefreshCw size={13} className={loadingLedgerMappings ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {/* ── Table with EXACT 4 Primary Columns matching screenshot ── */}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-[var(--app-control-bg)] border-b z-10" style={{ borderColor: 'var(--app-border)' }}>
                  <tr className="text-[10px] font-black text-[var(--app-muted)] uppercase tracking-wider">
                    <th className="py-2.5 px-4 w-[38%]">EXTRACTED PARTY / LEDGER</th>
                    <th className="py-2.5 px-3 w-[28%]">LEDGER SELECTION</th>
                    <th className="py-2.5 px-3 w-[15%] text-center">CONFIDENCE SCORE</th>
                    <th className="py-2.5 px-4 w-[19%] text-center">MAPPING METHOD</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--app-border)' }}>
                  {loadingLedgerMappings && ledgerMappings.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-16 text-center text-xs font-semibold text-[var(--app-muted)]">
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="animate-spin text-[#2563EB]" size={16} />
                          <span>Loading statement transactions...</span>
                        </div>
                      </td>
                    </tr>
                  ) : paginatedMappings.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-16 text-center text-xs font-medium text-[var(--app-muted)]">
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
            <div className="flex items-center justify-between p-3.5 border-t shrink-0 text-xs text-[var(--app-muted)] flex-wrap gap-2" style={{ borderColor: 'var(--app-border)' }}>
              <div className="flex items-center gap-3">
                <div>
                  {mappingPageSize === 'all' ? (
                    <span>
                      Showing all <span className="font-bold text-[var(--app-heading)]">{filteredMappings.length}</span> transactions
                      {filteredMappings.length !== ledgerMappings.length && (
                        <span className="ml-1 text-[var(--app-muted)]">(filtered from {ledgerMappings.length})</span>
                      )}
                    </span>
                  ) : (
                    <span>
                      Showing <span className="font-bold text-[var(--app-heading)]">{paginatedMappings.length}</span> of <span className="font-bold text-[var(--app-heading)]">{filteredMappings.length}</span> transactions • Page {mappingPage} of {totalMappingPages}
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
                    className="h-6 px-2 rounded border bg-[var(--app-control-bg)] text-[var(--app-heading)] font-semibold text-[11px] outline-none cursor-pointer"
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
                    className="w-7 h-7 flex items-center justify-center border rounded-lg hover:bg-[var(--app-control-hover)] disabled:opacity-40 cursor-pointer font-bold"
                    style={{ borderColor: 'var(--app-border)' }}
                  >
                    ‹
                  </button>
                  <span className="w-7 h-7 flex items-center justify-center bg-[#2563EB] text-white rounded-lg font-black text-xs">
                    {mappingPage}
                  </span>
                  <button
                    onClick={() => setMappingPage(p => Math.min(totalMappingPages, p + 1))}
                    disabled={mappingPage >= totalMappingPages}
                    className="w-7 h-7 flex items-center justify-center border rounded-lg hover:bg-[var(--app-control-hover)] disabled:opacity-40 cursor-pointer font-bold"
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
          <div className="flex-1 flex flex-col min-h-0 h-full overflow-hidden">
            {/* Card Header with Title, Search & Add Custom Pattern Button */}
            <div className="flex items-center justify-between gap-3 p-4 border-b shrink-0 flex-wrap" style={{ borderColor: 'var(--app-border)' }}>
              <div>
                <h2 className="text-[15px] font-black text-[var(--app-heading)] tracking-tight">Pattern Mapping</h2>
                <p className="text-[11.5px] font-medium text-[var(--app-muted)]">
                  Transaction taxonomy library, narration pattern indexing & live party extraction for {selectedBankLedger}.
                </p>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                {/* Search */}
                <div className="relative min-w-[220px]">
                  <Search className="absolute left-2.5 top-2.5 text-[var(--app-muted)]" size={13} />
                  <input
                    type="text"
                    value={patternSearch}
                    onChange={(e) => setPatternSearch(e.target.value)}
                    placeholder="Search pattern, keyword or ledger..."
                    className="w-full h-8 pl-8 pr-3 border rounded-lg text-[11.5px] font-medium outline-none bg-[var(--app-control-bg)] text-[var(--app-heading)] focus:border-[#2563EB] transition-colors"
                    style={{ borderColor: 'var(--app-border)' }}
                  />
                </div>

                {/* Scope & Status Filter Dropdown */}
                <select
                  value={patternFilter}
                  onChange={(e) => {
                    setPatternFilter(e.target.value);
                    setPatternPage(1);
                  }}
                  className="h-8 pl-2.5 pr-7 border rounded-lg text-[11.5px] font-bold bg-[var(--app-control-bg)] text-[var(--app-heading)] outline-none cursor-pointer focus:border-[#2563EB]"
                  style={{ borderColor: 'var(--app-border)' }}
                >
                  <option value="all">All Filters ({allCombinedPatterns.length})</option>
                  <option value="ai_discovered">AI Discovered ({suggestions.length})</option>
                  <option value="unmapped">Unmapped Parties</option>
                  <option value="customer_custom">Customer Custom</option>
                  <option value="bank_specific">Bank-specific</option>
                  <option value="system">System Library</option>
                </select>

                {/* Add Custom Pattern Button */}
                <button
                  onClick={() => {
                    setIsAddPatternOpen(true);
                    setPatternTestResult(null);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider bg-[#2563EB] text-white shadow-xs hover:opacity-90 transition-all cursor-pointer shrink-0"
                >
                  <Plus size={14} strokeWidth={3} />
                  <span>Add Custom Pattern</span>
                </button>
              </div>
            </div>

            {/* ═════════════════════════════════════════════════════════════════════════════════ */}
            {/* LEVEL 1: TRANSACTION TYPES HORIZONTAL RAIL (from bank.json taxonomy)            */}
            {/* ═════════════════════════════════════════════════════════════════════════════════ */}
            <div className="px-4 py-2 border-b bg-[var(--app-control-bg)]/60 flex items-center gap-2 overflow-x-auto shrink-0 scrollbar-thin" style={{ borderColor: 'var(--app-border)' }}>
              <span className="text-[10px] font-black uppercase tracking-wider text-[var(--app-muted)] shrink-0 mr-1 flex items-center gap-1">
                <Layers size={12} className="text-[#2563EB]" />
                Txn Types:
              </span>

              {/* All Types Button */}
              <button
                type="button"
                onClick={() => { setSelectedTxnType('ALL'); setPatternPage(1); }}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                  selectedTxnType === 'ALL'
                    ? 'bg-[#2563EB] text-white shadow-xs font-black'
                    : 'bg-[var(--app-panel-bg)] text-[var(--app-muted)] hover:text-[var(--app-heading)] border border-[var(--app-border)]'
                }`}
              >
                <span>All Types</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${selectedTxnType === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-500/10 text-[var(--app-heading)]'}`}>
                  {allCombinedPatterns.reduce((acc, p) => acc + (p.matchingCount || 0), 0)}
                </span>
              </button>

              {/* ACTIVE Type Pills — only types with actual transactions (count > 0) */}
              {transactionTypeSummaries.filter(s => s.count > 0).map((summary) => {
                const isSelected = selectedTxnType.toUpperCase() === summary.type.toUpperCase();
                return (
                  <button
                    key={summary.type}
                    type="button"
                    onClick={() => { setSelectedTxnType(summary.type); setPatternPage(1); }}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-[#2563EB] text-white shadow-xs font-black'
                        : 'bg-[var(--app-panel-bg)] text-[var(--app-muted)] hover:text-[var(--app-heading)] border border-[var(--app-border)]'
                    }`}
                  >
                    <span>{summary.type}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black ${isSelected ? 'bg-white/20 text-white' : 'bg-blue-500/10 text-blue-600'}`}>
                      {summary.count} txns
                    </span>
                  </button>
                );
              })}

              {/* DEFAULT / 0-count types — available in dropdown only */}
              {transactionTypeSummaries.filter(s => s.count === 0).length > 0 && (
                <div className="relative shrink-0 ml-1">
                  <select
                    value={transactionTypeSummaries.filter(s => s.count === 0).some(s => s.type === selectedTxnType) ? selectedTxnType : ''}
                    onChange={(e) => { if (e.target.value) { setSelectedTxnType(e.target.value); setPatternPage(1); } }}
                    className={`h-7 pl-2.5 pr-6 rounded-full text-[11px] font-bold border cursor-pointer outline-none appearance-none transition-all ${
                      transactionTypeSummaries.filter(s => s.count === 0).some(s => s.type === selectedTxnType)
                        ? 'bg-[#2563EB] text-white border-[#2563EB]'
                        : 'bg-[var(--app-panel-bg)] text-[var(--app-muted)] border-[var(--app-border)] hover:border-[#2563EB]'
                    }`}
                    title="Default library types (0 transactions in current statement)"
                  >
                    <option value="">
                      + {transactionTypeSummaries.filter(s => s.count === 0).length} Default Types ▾
                    </option>
                    {transactionTypeSummaries.filter(s => s.count === 0).map(s => (
                      <option key={s.type} value={s.type}>{s.type} — Default Library</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Pattern Table */}
            <div className="flex-1 overflow-y-auto min-h-0">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-[var(--app-control-bg)] border-b z-10" style={{ borderColor: 'var(--app-border)' }}>
                  <tr className="text-[10px] font-black text-[var(--app-muted)] uppercase tracking-wider">
                    <th className="py-3 px-3.5 w-[28%]">TRANSACTION TYPE / PATTERN</th>
                    <th className="py-3 px-2.5 w-[14%] text-center">MATCHING TXNS</th>
                    <th className="py-3 px-3 w-[24%]">PARTY LEDGER INDEX (EDITABLE)</th>
                    <th className="py-3 px-3 w-[22%]">AI EXTRACTED VALUE / MASTER LEDGER</th>
                    <th className="py-3 px-3 w-[12%] text-center">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--app-border)' }}>
                  {loadingPatterns ? (
                    <tr>
                      <td colSpan={5} className="py-16 text-center text-xs font-semibold text-[var(--app-muted)]">
                        <RefreshCw className="animate-spin text-[#2563EB] inline-block mr-2" size={14} />
                        Loading transaction types & pattern library...
                      </td>
                    </tr>
                  ) : paginatedPatterns.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-16 text-center text-xs font-medium text-[var(--app-muted)]">
                        No transaction types found for the selected filter.
                      </td>
                    </tr>
                  ) : (
                    paginatedPatterns.map((pat) => {
                      const isExpanded = !!expandedRows[pat.id];
                      const effective = getEffectivePatternData(pat);
                      const distinctList = effective.distinctParties || [];
                      const sampleNarr = (pat.raw?.sampleNarrations && pat.raw.sampleNarrations[0]) || (pat.transactions && pat.transactions[0]?.narration) || pat.pattern;
                      const tokensList = pat.tokens && pat.tokens.length > 0 ? pat.tokens : (pat.raw?.tokens || []);

                      return (
                        <React.Fragment key={pat.id}>
                          <tr className={`hover:bg-[var(--app-content-bg)]/40 transition-colors ${isExpanded ? 'bg-[var(--app-content-bg)]/30' : ''}`}>
                            {/* 1. TRANSACTION TYPE / PATTERN */}
                            <td className="py-3 px-3.5">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => toggleRowExpansion(pat.id)}
                                  className="p-1 rounded-md hover:bg-[var(--app-control-hover)] text-[var(--app-muted)] hover:text-[var(--app-heading)] transition-colors cursor-pointer shrink-0"
                                  title={isExpanded ? "Collapse Details" : "Expand Token Breakdown & Master Ledgers"}
                                >
                                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </button>
                                <div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="px-2 py-0.5 rounded text-[11px] font-black uppercase bg-[#2563EB]/10 text-[#2563EB] border border-[#2563EB]/25">
                                      {pat.txnType}
                                    </span>
                                    {pat.matchingCount > 0 ? (
                                      <span className="px-1.5 py-0.5 rounded text-[9.5px] font-extrabold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center gap-1">
                                        <Sparkles size={9} /> Pattern A (AI Detected)
                                      </span>
                                    ) : (
                                      <span className="px-1.5 py-0.5 rounded text-[9.5px] font-medium bg-slate-500/10 text-[var(--app-muted)] border border-slate-500/20">
                                        Default Library
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-[var(--app-muted)] font-medium mt-0.5">
                                    {pat.typeDesc || pat.patternName || 'Indian Banking Taxonomy'}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* 2. MATCHING TRANSACTIONS COUNT */}
                            <td className="py-3 px-2.5 text-center">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold border ${
                                pat.matchingCount > 0
                                  ? 'bg-blue-500/10 text-blue-600 border-blue-500/30 font-black'
                                  : 'bg-slate-500/5 text-[var(--app-muted)] border-slate-500/15'
                              }`}>
                                {pat.matchingCount} txns
                              </span>
                            </td>

                            {/* 3. PARTY LEDGER INDEX (EDITABLE MODE) */}
                            <td className="py-3 px-3">
                              {(() => {
                                const sampleNarr = (pat.transactions && pat.transactions[0]?.narration) || (pat.sampleNarrations && pat.sampleNarrations[0]) || pat.pattern || '';
                                const sep = pat.separator || '/';
                                const sampleParts = sampleNarr ? (sep === ' ' ? sampleNarr.trim().split(/\s+/) : sampleNarr.split(sep).map(s => s.trim())) : [];
                                const maxIdx = Math.max(sampleParts.length, 6);

                                return pat.matchingCount > 0 ? (
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <select
                                      value={effective.partyPosition}
                                      onChange={(e) => handleUpdatePatternIndex(pat.id, 'partyPosition', e.target.value)}
                                      className="h-8 px-2.5 rounded-lg border text-xs font-mono font-bold bg-[var(--app-control-bg)] text-[var(--app-heading)] outline-none focus:border-[#2563EB] cursor-pointer shadow-2xs max-w-[210px] truncate"
                                      style={{ borderColor: 'var(--app-border)' }}
                                      title={`Select token position for ${pat.txnType} party ledger`}
                                    >
                                      <option value={-1}>None (-1)</option>
                                      {Array.from({ length: maxIdx }).map((_, idx) => {
                                        const val = sampleParts[idx];
                                        const preview = val ? (val.length > 14 ? val.slice(0, 14) + '...' : val) : '';
                                        return (
                                          <option key={idx} value={idx}>
                                            Position [{idx}]{preview ? ` : "${preview}"` : ''}
                                          </option>
                                        );
                                      })}
                                    </select>
                                    <span className="text-[10px] font-bold text-emerald-600 font-mono uppercase bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                      Party
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-[var(--app-muted)] text-xs italic">
                                    Awaiting statement
                                  </span>
                                );
                              })()}
                            </td>

                            {/* 4. AI EXTRACTED VALUE / MASTER LEDGER */}
                            <td className="py-3 px-3">
                              <div className="flex flex-col">
                                {pat.matchingCount > 0 ? (
                                  <>
                                    <span
                                      className="font-mono text-xs font-bold text-[var(--app-heading)] truncate max-w-[230px]"
                                      title={effective.sampleParty}
                                    >
                                      {effective.sampleParty || '—'}
                                    </span>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className="text-[10px] text-blue-600 font-semibold">
                                        {distinctList.length} {distinctList.length === 1 ? 'party candidate' : 'distinct parties'}
                                      </span>
                                      {distinctList.length > 0 && (
                                        <button
                                          type="button"
                                          onClick={() => toggleRowExpansion(pat.id)}
                                          className="text-[10px] text-[#2563EB] hover:underline font-bold cursor-pointer"
                                        >
                                          {isExpanded ? 'Hide Ledgers' : 'Map to Master →'}
                                        </button>
                                      )}
                                    </div>
                                  </>
                                ) : (
                                  <span className="text-[var(--app-muted)] text-xs italic">
                                    Awaiting statement upload
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* 5. ACTION: APPLY BUTTON */}
                            <td className="py-3 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleApplyPatternIndexing(pat)}
                                disabled={pat.matchingCount === 0}
                                className="px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider bg-[#2563EB] hover:bg-blue-700 text-white shadow-xs transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 mx-auto"
                                title={pat.matchingCount > 0 ? `Apply Party Index [${effective.partyPosition}] for ${pat.txnType} and map to Tally Master` : "Awaiting statement transactions to apply"}
                              >
                                <Check size={12} strokeWidth={3} />
                                <span>Apply</span>
                              </button>
                            </td>
                          </tr>

                          {/* ── EXPANDABLE DETAIL PANEL ── */}
                          {isExpanded && (
                            <tr className="bg-[var(--app-control-bg)]/40 border-b border-t border-[var(--app-border)]">
                              <td colSpan={5} className="p-4">
                                <div className="flex flex-col gap-3.5 max-w-5xl text-[11.5px]">

                                  {/* Observed Token Breakdown & Position Controls */}
                                  <div>
                                    <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                                      <span className="text-[10.5px] font-black uppercase tracking-wider text-[var(--app-muted)]">
                                        Observed Token Breakdown (Position → Value)
                                      </span>
                                      <div className="flex items-center gap-3 flex-wrap">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-[10px] font-bold text-emerald-600 font-mono uppercase bg-emerald-500/10 px-1.5 py-0.5 rounded">Party Index:</span>
                                          <select
                                            value={effective.partyPosition}
                                            onChange={(e) => handleUpdatePatternIndex(pat.id, 'partyPosition', e.target.value)}
                                            className="h-6 px-1.5 rounded border text-[10.5px] font-mono font-bold bg-[var(--app-control-bg)] text-[var(--app-heading)] outline-none cursor-pointer"
                                            style={{ borderColor: 'var(--app-border)' }}
                                          >
                                            <option value={-1}>None (-1)</option>
                                            {Array.from({ length: Math.max(tokensList.length, 6) }).map((_, idx) => (
                                              <option key={idx} value={idx}>Pos [{idx}]</option>
                                            ))}
                                          </select>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-[10px] font-bold text-purple-600 font-mono uppercase bg-purple-500/10 px-1.5 py-0.5 rounded">Txn ID Index:</span>
                                          <select
                                            value={effective.txnIdPosition}
                                            onChange={(e) => handleUpdatePatternIndex(pat.id, 'txnIdPosition', e.target.value)}
                                            className="h-6 px-1.5 rounded border text-[10.5px] font-mono font-bold bg-[var(--app-control-bg)] text-[var(--app-heading)] outline-none cursor-pointer"
                                            style={{ borderColor: 'var(--app-border)' }}
                                          >
                                            <option value={-1}>None (-1)</option>
                                            {Array.from({ length: Math.max(tokensList.length, 6) }).map((_, idx) => (
                                              <option key={idx} value={idx}>Pos [{idx}]</option>
                                            ))}
                                          </select>
                                        </div>
                                        <span className="text-[10.5px] font-bold text-[var(--app-muted)]">
                                          Separator: <strong className="text-[var(--app-heading)] font-mono bg-slate-500/10 px-1.5 py-0.5 rounded">"{pat.separator || '/'}"</strong>
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {(() => {
                                        const activeSep = (pat.separator && pat.separator.includes(',')) ? pat.separator.split(',')[0].trim() : (pat.separator || '/');
                                        const realParts = sampleNarr ? (activeSep === ' ' ? sampleNarr.trim().split(/\s+/) : sampleNarr.split(activeSep).map(s => s.trim())) : [];
                                        const count = Math.max(tokensList.length, realParts.length);
                                        if (count === 0) {
                                          return (
                                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-mono text-[10.5px] font-bold">
                                              Token [Party: {effective.partyPosition}]
                                            </span>
                                          );
                                        }
                                        return Array.from({ length: count }).map((_, idx) => {
                                          const tokMeta = tokensList[idx];
                                          const actualVal = realParts[idx] || tokMeta?.sampleValue || '';
                                          const isParty = idx === effective.partyPosition;
                                          const isTxnId = idx === effective.txnIdPosition;
                                          const roleLabel = isParty
                                            ? 'PARTY'
                                            : isTxnId
                                              ? 'TXN ID'
                                              : (tokMeta?.type === 'CHANNEL' || idx === 0 ? 'CHANNEL' : tokMeta?.type === 'IFSC' ? 'IFSC' : tokMeta?.type === 'VPA' ? 'VPA' : 'TOKEN');

                                          return (
                                            <span
                                              key={idx}
                                              className={`px-2 py-0.5 rounded-md font-mono text-[10.5px] font-bold border transition-all ${
                                                isParty
                                                  ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30 ring-1 ring-emerald-500/20'
                                                  : isTxnId
                                                    ? 'bg-purple-500/10 text-purple-600 border-purple-500/20'
                                                    : 'bg-slate-500/10 text-slate-600 border-slate-500/20'
                                              }`}
                                            >
                                              [Index {idx}: {roleLabel} → {actualVal ? `"${actualVal}"` : `{Pos ${idx}}`}]
                                            </span>
                                          );
                                        });
                                      })()}
                                    </div>
                                  </div>

                                  {/* Extracted Parties & Master Ledger Resolution Table */}
                                  <div className="p-3 rounded-lg border bg-[var(--app-panel-bg)]" style={{ borderColor: 'var(--app-border)' }}>
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-[10.5px] font-black uppercase tracking-wider text-[var(--app-muted)]">
                                        Extracted Parties from Index [{effective.partyPosition}] ({distinctList.length} Distinct Parties)
                                      </span>
                                      <span className="text-[10px] font-bold text-blue-600">
                                        Auto-Mapped to Tally Master Ledgers
                                      </span>
                                    </div>

                                    {distinctList.length > 0 ? (
                                      <div className="max-h-56 overflow-auto rounded border" style={{ borderColor: 'var(--app-border)' }}>
                                        <table className="w-full text-left text-[11px]">
                                          <thead className="bg-[var(--app-control-bg)] border-b sticky top-0" style={{ borderColor: 'var(--app-border)' }}>
                                            <tr className="text-[9.5px] font-bold text-[var(--app-muted)] uppercase">
                                              <th className="py-2 px-2.5 w-[30%]">EXTRACTED PARTY CANDIDATE</th>
                                              <th className="py-2 px-2.5 w-[15%] text-center">TRANSACTIONS</th>
                                              <th className="py-2 px-2.5 w-[40%]">RESOLVED TALLY MASTER LEDGER</th>
                                              <th className="py-2 px-2.5 w-[15%] text-center">CONFIDENCE</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y" style={{ borderColor: 'var(--app-border)' }}>
                                            {distinctList.map((dp, dpIdx) => {
                                              const txnsForParty = dp.sampleTransactions || (pat.transactions || []).filter(t => (t.narration || '').includes(dp.party));
                                              return (
                                                <tr key={dpIdx} className="hover:bg-[var(--app-content-bg)]/40">
                                                  <td className="py-2 px-2.5 font-bold text-[var(--app-heading)]">
                                                    {dp.party}
                                                  </td>
                                                  <td className="py-2 px-2.5 text-center">
                                                    <button
                                                      type="button"
                                                      onClick={() => setInspectingPartyModal({
                                                        party: dp.party,
                                                        patternName: pat.patternName || pat.txnType,
                                                        transactions: txnsForParty
                                                      })}
                                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-mono font-bold bg-blue-500/10 text-blue-600 hover:bg-blue-500 hover:text-white transition-all cursor-pointer"
                                                      title="Inspect contributing transactions"
                                                    >
                                                      <Eye size={11} />
                                                      <span>{dp.count} txns</span>
                                                    </button>
                                                  </td>
                                                  <td className="py-1.5 px-2.5">
                                                    <div className="max-w-[280px]">
                                                      <SmartLedgerDropdown
                                                        value={dp.mappedLedger === 'Unmapped' ? '' : (dp.mappedLedger || '')}
                                                        onChange={(newLedger) => handlePartyLedgerOverride(pat.id, dp.party, newLedger)}
                                                        options={normalizedAllLedgers}
                                                        extractedParty={dp.party}
                                                        narration={sampleNarr}
                                                        confidence={dp.mappedLedger && dp.mappedLedger !== 'Unmapped' ? (dp.confidence || 0) : 0}
                                                      />
                                                    </div>
                                                  </td>
                                                  <td className="py-2 px-2.5 text-center">
                                                    {dp.mappedLedger && dp.mappedLedger !== 'Unmapped' && Number(dp.confidence) > 0 ? (
                                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                                        {dp.confidence}%
                                                      </span>
                                                    ) : (
                                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-500/10 text-[var(--app-muted)] border border-slate-500/20">
                                                        Unmapped (0%)
                                                      </span>
                                                    )}
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    ) : (
                                      <p className="text-[11px] text-[var(--app-muted)] italic">
                                        {pat.matchingCount > 0
                                          ? 'No parties extracted for this index. Change Party Ledger Index above.'
                                          : 'Awaiting statement upload for this transaction type.'}
                                      </p>
                                    )}
                                  </div>

                                  {/* Sample Original Bank Narrations */}
                                  {sampleNarr && (
                                    <div className="p-2.5 rounded-lg border bg-[var(--app-panel-bg)]" style={{ borderColor: 'var(--app-border)' }}>
                                      <span className="text-[10px] font-black uppercase tracking-wider text-[var(--app-muted)] block mb-1">
                                        Sample Original Bank Narration
                                      </span>
                                      <div className="space-y-1">
                                        {((pat.sampleNarrations && pat.sampleNarrations.length > 0)
                                          ? pat.sampleNarrations
                                          : (pat.transactions && pat.transactions.length > 0)
                                            ? pat.transactions.map(t => t.narration)
                                            : [sampleNarr]
                                        ).slice(0, 3).map((sn, sIdx) => (
                                          <div key={sIdx} className="font-mono text-[10.5px] text-[var(--app-muted)] bg-[var(--app-control-bg)]/80 px-2 py-1 rounded border border-[var(--app-border)] truncate" title={sn}>
                                            • {sn}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pattern Card Footer */}
            <div className="flex items-center justify-between p-3.5 border-t shrink-0 text-xs text-[var(--app-muted)] flex-wrap gap-2" style={{ borderColor: 'var(--app-border)' }}>
              <div className="flex items-center gap-3">
                <div>
                  Showing <span className="font-bold text-[var(--app-heading)]">{paginatedPatterns.length}</span> of <span className="font-bold text-[var(--app-heading)]">{combinedPatterns.length}</span> patterns
                  {patternPageSize !== 'all' && (
                    <span> • Page {patternPage} of {totalPatternPages}</span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 border-l pl-3" style={{ borderColor: 'var(--app-border)' }}>
                  <span>Rows:</span>
                  <select
                    value={patternPageSize}
                    onChange={(e) => {
                      setPatternPageSize(e.target.value === 'all' ? 'all' : Number(e.target.value));
                      setPatternPage(1);
                    }}
                    className="border rounded-md px-2 py-0.5 font-bold text-xs bg-[var(--app-control-bg)] text-[var(--app-heading)] cursor-pointer outline-none"
                    style={{ borderColor: 'var(--app-border)' }}
                  >
                    <option value="all">All ({combinedPatterns.length})</option>
                    <option value={10}>10 per page</option>
                    <option value={25}>25 per page</option>
                    <option value={50}>50 per page</option>
                  </select>
                </div>
              </div>

              {patternPageSize !== 'all' && totalPatternPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPatternPage(p => Math.max(1, p - 1))}
                    disabled={patternPage === 1}
                    className="w-7 h-7 flex items-center justify-center border rounded-lg hover:bg-[var(--app-control-hover)] disabled:opacity-40 cursor-pointer font-bold"
                    style={{ borderColor: 'var(--app-border)' }}
                  >
                    ‹
                  </button>
                  <span className="w-7 h-7 flex items-center justify-center bg-[#2563EB] text-white rounded-lg font-black text-xs">
                    {patternPage}
                  </span>
                  <button
                    onClick={() => setPatternPage(p => Math.min(totalPatternPages, p + 1))}
                    disabled={patternPage >= totalPatternPages}
                    className="w-7 h-7 flex items-center justify-center border rounded-lg hover:bg-[var(--app-control-hover)] disabled:opacity-40 cursor-pointer font-bold"
                    style={{ borderColor: 'var(--app-border)' }}
                  >
                    ›
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

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
