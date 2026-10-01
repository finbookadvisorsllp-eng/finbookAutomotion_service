import { findBestLedgerMatch } from './SmartLedgerDropdown';

const BANK_STOP_TOKENS = new Set([
  'upi', 'neft', 'rtgs', 'imps', 'clg', 'cts', 'chq', 'cheque', 'trf', 'transfer',
  'payment', 'pay', 'receipt', 'received', 'cr', 'dr', 'inft', 'inf', 'ift', 'mmt',
  'atm', 'wdl', 'dep', 'pos', 'ach', 'sip', 'na', 'coll', 'by', 'to', 'for', 'on',
  'from', 'as', 'slb', 'slbl', 'slbn', 'chg', 'charge', 'charges', 'fee', 'tax', 'gst',
  'hdfc', 'icic', 'icici', 'sbin', 'sbi', 'axis', 'utib', 'punb', 'pnb', 'kkbk', 'kotak',
  'barb', 'bob', 'cnrb', 'canara', 'ubin', 'union', 'idfb', 'idfc', 'yesb', 'yes',
  'okaxis', 'okicici', 'okhdfcbank', 'oksbi', 'ibl', 'ybl', 'axl', 'cr trf', 'dr trf'
]);

/**
 * Resolves the effective party ledger for an item using assigned partyLedger, againstLedger,
 * or live matching against company master ledgers and heuristics.
 */
export function getBatchItemEffectiveParty(item, allLedgersList = []) {
  if (!item) return '';

  // 1. Explicitly assigned partyLedger
  if (item.partyLedger && String(item.partyLedger).trim() && item.partyLedger !== 'Unmapped' && item.partyLedger !== '—') {
    return String(item.partyLedger).trim();
  }

  // 2. Fallback againstLedger
  if (item.againstLedger && String(item.againstLedger).trim() && item.againstLedger !== 'Unmapped' && item.againstLedger !== '—') {
    return String(item.againstLedger).trim();
  }

  // 3. Match candidate against master ledgers
  const cand = item.extractedParty && String(item.extractedParty).trim();
  if (cand && cand !== '—' && allLedgersList && allLedgersList.length > 0) {
    const candLower = cand.toLowerCase();
    const directMatch = allLedgersList.find(l => l.toLowerCase() === candLower);
    if (directMatch) return directMatch;

    const bestMatch = findBestLedgerMatch(cand, allLedgersList);
    if (bestMatch && bestMatch.score >= 70 && bestMatch.ledger) {
      if (!bestMatch.isAmbiguous) {
        return bestMatch.ledger;
      }
    }
  }

  // 4. Smart Narration Token Scanner & Bank Heuristics
  const narr = (item.narration || '').trim();
  if (narr && allLedgersList && allLedgersList.length > 0) {
    const narrLower = narr.toLowerCase();

    // 4a. Heuristic 1: Bank Charges / SMS / Fees / Service Charges
    if (/\b(sms|charges?|service\s*charges?|commission|comm|chg|min\s*bal|consolidated\s*chg|annual\s*fee|card\s*fee)\b/i.test(narrLower)) {
      const chargesLedger = allLedgersList.find(l => {
        const low = l.toLowerCase();
        return low.includes('bank charge') || low.includes('bank charges') || low.includes('service charge') || low === 'charges';
      });
      if (chargesLedger) return chargesLedger;
    }

    // 4b. Heuristic 2: Interest
    if (/\b(int\.coll|interest|int\s*coll|int\s*paid|int\s*rec|sb\s*int|fd\s*int)\b/i.test(narrLower)) {
      const intLedger = allLedgersList.find(l => {
        const low = l.toLowerCase();
        return low.includes('interest') && (item.voucherType === 'Receipt' ? (!low.includes('paid')) : true);
      });
      if (intLedger) return intLedger;
    }

    // 4c. Heuristic 3: Cash Deposit / Cash Withdrawal / ATM
    if (/\b(cash\s*dep|cash\s*wdl|atm\s*wdl|cash\s*deposit|cash\s*withdrawal|by\s*cash|to\s*cash|self\s*cash)\b/i.test(narrLower)) {
      const cashLedger = allLedgersList.find(l => {
        const low = l.toLowerCase();
        return low === 'cash' || low.includes('cash in hand') || low.includes('petty cash');
      });
      if (cashLedger) return cashLedger;
    }

    // 4d. Smart Narration Token Scanner
    const segments = narr.split(/[\/\-_:;*|]+/).map(s => s.trim()).filter(Boolean);

    for (const seg of segments) {
      if (!/[a-z]/i.test(seg) || seg.length < 3) continue;
      if (BANK_STOP_TOKENS.has(seg.toLowerCase())) continue;

      const direct = allLedgersList.find(l => l.toLowerCase() === seg.toLowerCase());
      if (direct) return direct;

      const m = findBestLedgerMatch(seg, allLedgersList);
      if (m && m.score >= 70 && m.ledger && !m.isAmbiguous) {
        return m.ledger;
      }
    }

    for (let i = 0; i < segments.length - 1; i++) {
      const s1 = segments[i];
      const s2 = segments[i + 1];
      if (BANK_STOP_TOKENS.has(s1.toLowerCase()) || BANK_STOP_TOKENS.has(s2.toLowerCase())) continue;
      if (!/[a-z]/i.test(s1) || !/[a-z]/i.test(s2)) continue;
      const combined = `${s1} ${s2}`.trim();
      if (combined.length >= 4) {
        const direct = allLedgersList.find(l => l.toLowerCase() === combined.toLowerCase());
        if (direct) return direct;
        const m = findBestLedgerMatch(combined, allLedgersList);
        if (m && m.score >= 70 && m.ledger && !m.isAmbiguous) {
          return m.ledger;
        }
      }
    }
  }

  return '';
}

/**
 * Determines effective status ('saved', 'already_processed', 'ready', 'review_required')
 * for an item in a statement batch.
 */
export function getBatchItemEffectiveStatus(item, allLedgersList = []) {
  if (!item) return 'review_required';

  if (item.status === 'saved' || Boolean(item.saved_voucher_id)) {
    return 'saved';
  }
  if (item.status === 'already_processed') {
    return 'already_processed';
  }

  // Any user-verified or user-edited item is 100% READY
  if (item.status === 'user_edited' || item.status === 'user_verified' || Number(item.confidence) === 100) {
    return 'ready';
  }

  const effParty = getBatchItemEffectiveParty(item, allLedgersList);
  const hasParty = Boolean(effParty && effParty !== 'Unmapped' && effParty !== '—');
  if (!hasParty) return 'review_required';

  const cand = item.extractedParty && String(item.extractedParty).trim();
  const liveMatch = (cand && cand !== '—' && allLedgersList && allLedgersList.length > 0)
    ? findBestLedgerMatch(cand, allLedgersList)
    : null;

  // Ambiguous party candidate in master list requires user review
  if (liveMatch && liveMatch.isAmbiguous) {
    return 'review_required';
  }

  return 'ready';
}

/**
 * Dynamically computes matching summary counts for any statement document batch.
 * Guarantees 100% synchronization between BankPanel statement table rows and BankAiReviewPanel.
 */
export function calculateBatchSummary(batch, allLedgersList = []) {
  const items = batch?.items || [];
  if (!items.length) {
    const s = batch?.summary || {};
    const saved = s.saved_count || 0;
    const pushed = s.tally_pushed_count || 0;
    return {
      total_count: s.total_count || 0,
      ready_count: s.ready_count || 0,
      review_required_count: s.review_required_count || 0,
      already_processed_count: s.already_processed_count || 0,
      saved_count: saved,
      tally_pushed_count: pushed,
      tally_pending_count: s.tally_pending_count ?? (saved > pushed ? saved - pushed : 0)
    };
  }

  let ready_count = 0;
  let review_required_count = 0;
  let already_processed_count = 0;
  let saved_count = 0;
  let tally_pushed_count = 0;
  let tally_pending_count = 0;

  items.forEach(it => {
    const isSaved = it.status === 'saved' || Boolean(it.saved_voucher_id);
    const hasXml = Boolean(
      it.tallyXml || 
      it.tally_xml || 
      String(it.tallyPushStatus || '').toUpperCase() === 'POSTED_TO_TALLY' ||
      String(it.tallyPushStatus || '').toUpperCase() === 'PUSHED' ||
      String(it.status || '').toUpperCase() === 'POSTED_TO_TALLY'
    );

    if (isSaved) {
      saved_count++;
      if (hasXml) tally_pushed_count++;
      else tally_pending_count++;
    } else {
      const eff = getBatchItemEffectiveStatus(it, allLedgersList);
      if (eff === 'ready' || eff === 'user_edited') ready_count++;
      else if (eff === 'review_required') review_required_count++;
      else if (eff === 'already_processed') already_processed_count++;
    }
  });

  return {
    total_count: items.length,
    ready_count,
    review_required_count,
    already_processed_count,
    saved_count,
    tally_pushed_count,
    tally_pending_count
  };
}
