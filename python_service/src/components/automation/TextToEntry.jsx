import React, { useState, useEffect, useRef } from 'react';
import {
  Send, Bot, User, RotateCcw, Trash2, Plus, FileText,
  Loader2, Save, CloudUpload, X, RefreshCw, CheckCircle2,
  AlertTriangle, Mic, Paperclip, Check, Sparkles, AlertCircle, Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { aiApi } from '../../services/aiApi';
import { salesApi } from '../../services/salesApi';

const recalculateDraft = (currentDraft, activePartyDetails, pageData, stockItemDetails) => {
  if (!currentDraft) return null;

  const isAccounting = ['payment', 'receipt', 'contra'].includes(currentDraft.voucher_type?.toLowerCase());
  if (isAccounting) {
    const totalAmount = (currentDraft.items || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    return {
      ...currentDraft,
      amount: totalAmount,
      base_amount: totalAmount,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: 0,
      cess_amount: 0
    };
  }

  let baseTotal = 0;
  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;
  let cessTotal = 0;
  let itemAmountTotal = 0;

  // Compare first 2 chars of company and party GSTINs to determine if interstate
  const companyStateCode = pageData?.companyGst?.gstin?.trim().substring(0, 2) || '';
  const partyStateCode = activePartyDetails?.partyDetails?.gstin?.trim().substring(0, 2) || '';
  let isInterstate = false;
  if (companyStateCode && partyStateCode) {
    isInterstate = companyStateCode !== partyStateCode;
  } else {
    const companyState = pageData?.companyGst?.gstState?.trim().toLowerCase() || 'madhya pradesh';
    const partyState = activePartyDetails?.partyDetails?.gstState?.trim().toLowerCase() || '';
    if (partyState) {
      isInterstate = companyState !== partyState;
    }
  }

  // Extract CESS rate from any CESS ledger in additional_charges
  let cessRate = 0;
  let hasCessLedger = false;
  let cessLedgerAmt = 0;
  (currentDraft.additional_charges || []).forEach((c) => {
    const nameUpper = (c.ledger_name || '').toUpperCase();
    if (nameUpper.includes('CESS')) {
      hasCessLedger = true;
      const match = nameUpper.match(/(\d+(?:\.\d+)?)\s*%/);
      if (match) {
        cessRate = parseFloat(match[1]);
      } else {
        cessLedgerAmt += parseFloat(c.amount) || 0;
      }
    }
  });

  // Calculate total additional charges (non-tax ledgers)
  let totalAdditionalCharges = 0;
  (currentDraft.additional_charges || []).forEach((c) => {
    const nameUpper = (c.ledger_name || '').toUpperCase();
    const isTaxLedger = nameUpper.includes('CGST') || nameUpper.includes('SGST') || nameUpper.includes('IGST') || nameUpper.includes('UTGST') || nameUpper.includes('CESS');
    if (!isTaxLedger) {
      totalAdditionalCharges += parseFloat(c.amount) || 0;
    }
  });

  // 1. Calculate sum of base amounts of items
  const items = currentDraft.items || [];
  items.forEach((item) => {
    const qty = parseFloat(item.quantity) || 0;
    const rate = parseFloat(item.rate) || 0;
    const disc = parseFloat(item.discount_percent) || 0;
    const amount = parseFloat((qty * rate * (1 - disc / 100)).toFixed(2));
    itemAmountTotal += amount;
  });

  // 2. Distribute additional charges and calculate tax item-wise
  const itemLen = items.length;
  const updatedItems = items.map((item) => {
    const qty = parseFloat(item.quantity) || 0;
    const rate = parseFloat(item.rate) || 0;
    const disc = parseFloat(item.discount_percent) || 0;
    const amount = parseFloat((qty * rate * (1 - disc / 100)).toFixed(2));

    const ratio = itemAmountTotal > 0 ? (amount / itemAmountTotal) : (1 / itemLen);
    const distributedCharge = parseFloat((ratio * totalAdditionalCharges).toFixed(2));
    const taxableAmount = parseFloat((amount + distributedCharge).toFixed(2));
    const gstRate = parseFloat(item.gst_rate) || 0;

    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    let cess = 0;

    const gstAmt = taxableAmount * gstRate / 100;
    if (isInterstate) {
      igst = parseFloat(gstAmt.toFixed(2));
    } else {
      cgst = parseFloat((gstAmt / 2).toFixed(2));
      sgst = parseFloat((gstAmt / 2).toFixed(2));
    }

    // Calculate CESS
    let lineCessRate = parseFloat(item.cessRate || item.cess_rate) || 0;
    if (lineCessRate <= 0) {
      lineCessRate = cessRate;
    }
    if (lineCessRate > 0) {
      cess = parseFloat((taxableAmount * lineCessRate / 100).toFixed(2));
    }

    cgstTotal += cgst;
    sgstTotal += sgst;
    igstTotal += igst;
    cessTotal += cess;
    baseTotal += taxableAmount;

    return {
      ...item,
      amount,
      ratio: parseFloat(ratio.toFixed(4)),
      distributedCharge,
      taxableAmount,
      cgst,
      sgst,
      igst,
      cess,
      totalTax: parseFloat((cgst + sgst + igst + cess).toFixed(2))
    };
  });

  // Fallback to manual CESS ledger amount if calculated is 0 but ledger is present
  if (cessTotal === 0 && hasCessLedger && cessLedgerAmt > 0) {
    cessTotal = cessLedgerAmt;
  }

  // Update CGST/SGST/IGST/Cess ledger amounts in additional_charges array
  let charges = [...(currentDraft.additional_charges || [])];
  charges = charges.map((c) => {
    const nameUpper = (c.ledger_name || '').toUpperCase();
    const isTaxLedger = nameUpper.includes('CGST') || nameUpper.includes('SGST') || nameUpper.includes('IGST') || nameUpper.includes('UTGST') || nameUpper.includes('CESS');
    if (isTaxLedger) {
      let updatedCharge = { ...c, taxable_value: baseTotal.toFixed(2) };
      if (nameUpper.includes('CGST')) {
        updatedCharge.amount = parseFloat((cgstTotal || 0).toFixed(2));
      } else if (nameUpper.includes('SGST') || nameUpper.includes('UTGST')) {
        updatedCharge.amount = parseFloat((sgstTotal || 0).toFixed(2));
      } else if (nameUpper.includes('IGST')) {
        updatedCharge.amount = parseFloat((igstTotal || 0).toFixed(2));
      } else if (nameUpper.includes('CESS')) {
        updatedCharge.amount = parseFloat((cessTotal || 0).toFixed(2));
      }
      return updatedCharge;
    }
    return c;
  });

  const hsnMap = {};
  updatedItems.forEach((item) => {
    const hsn = (item.hsn || '').trim() || '-';
    if (!hsnMap[hsn]) {
      hsnMap[hsn] = { hsn, taxableValue: 0, cgst: 0, sgst: 0, igst: 0, cess: 0 };
    }
    hsnMap[hsn].taxableValue += item.taxableAmount || 0;
    hsnMap[hsn].cgst += item.cgst || 0;
    hsnMap[hsn].sgst += item.sgst || 0;
    hsnMap[hsn].igst += item.igst || 0;
    hsnMap[hsn].cess += item.cess || 0;
  });

  const hsnTaxDetails = Object.values(hsnMap).map(row => ({
    hsn: row.hsn,
    taxableValue: parseFloat(row.taxableValue.toFixed(2)),
    cgst: parseFloat(row.cgst.toFixed(2)),
    sgst: parseFloat(row.sgst.toFixed(2)),
    igst: parseFloat(row.igst.toFixed(2)),
    cess: parseFloat(row.cess.toFixed(2)),
  }));

  let subTotal = baseTotal + cgstTotal + sgstTotal + igstTotal + cessTotal;
  const beforeRound = subTotal;
  const grandTotal = Math.round(beforeRound);
  const roundOff = grandTotal - beforeRound;

  return {
    ...currentDraft,
    items: updatedItems,
    additional_charges: charges,
    amount: grandTotal,
    base_amount: parseFloat(baseTotal.toFixed(2)),
    cgst_amount: parseFloat(cgstTotal.toFixed(2)),
    sgst_amount: parseFloat(sgstTotal.toFixed(2)),
    igst_amount: parseFloat(igstTotal.toFixed(2)),
    cess_amount: parseFloat(cessTotal.toFixed(2)),
    round_off: parseFloat(roundOff.toFixed(2)),
    hsnTaxDetails
  };
};

export const TextToEntry = () => {
  // --- Workspace & Session States ---
  const [loading, setLoading] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [pageData, setPageData] = useState(null);
  
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('All'); // 'All' | 'Draft' | 'Approved'

  // --- Active Chat Context States ---
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState(null);
  const [draftJson, setDraftJson] = useState(null);
  const [chatState, setChatState] = useState('idle');
  const [metadata, setMetadata] = useState({});
  const [activePartyDetails, setActivePartyDetails] = useState(null);

  // --- Input & Form States ---
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  
  // --- Full Page Worksheet Review Mode ---
  const [isReviewMode, setIsReviewMode] = useState(false);

  const messagesEndRef = useRef(null);

  const [pendingBillsMap, setPendingBillsMap] = useState({});
  const [stockItemDetails, setStockItemDetails] = useState({});

  const getLedgerNameForComponent = (componentType) => {
    const comp = componentType.toUpperCase();
    const charge = (draft?.additional_charges || []).find(c => {
      const name = (c.ledger_name || '').toUpperCase();
      if (comp === 'CGST') return name.includes('CGST');
      if (comp === 'SGST') return name.includes('SGST') || name.includes('UTGST');
      if (comp === 'IGST') return name.includes('IGST');
      if (comp === 'CESS') return name.includes('CESS');
      return false;
    });
    return charge ? charge.ledger_name : '';
  };

  const getLedgerOptions = (componentType) => {
    const comp = componentType.toUpperCase();
    const allList = Array.from(new Set([
      'CGST Output', 'Output SGST', 'IGST Output', 'CGST Input', 'Input SGST', 'IGST Input',
      'CGST Output 9%', 'SGST Output 9%', 'IGST Output 18%', 'CGST Output 6%', 'SGST Output 6%',
      'CGST Output 2.5%', 'SGST Output 2.5%', 'CESS Payable',
      ...(pageData?.allLedgers || [])
    ]));

    let filtered = [];
    if (comp === 'CGST') {
      filtered = allList.filter(x => x.toUpperCase().includes('CGST'));
    } else if (comp === 'SGST') {
      filtered = allList.filter(x => x.toUpperCase().includes('SGST') || x.toUpperCase().includes('UTGST'));
    } else if (comp === 'IGST') {
      filtered = allList.filter(x => x.toUpperCase().includes('IGST'));
    } else if (comp === 'CESS') {
      filtered = allList.filter(x => x.toUpperCase().includes('CESS'));
    }

    if (filtered.length === 0) {
      if (comp === 'CGST') return ['Output CGST 9%', 'CGST Output', 'Input CGST 9%'];
      if (comp === 'SGST') return ['Output SGST 9%', 'SGST Output', 'Input SGST 9%'];
      if (comp === 'IGST') return ['Output IGST 18%', 'IGST Output', 'Input IGST 18%'];
      if (comp === 'CESS') return ['CESS Payable', 'Cess Ledger'];
    }
    return filtered.sort();
  };

  const setLedgerNameForComponent = async (componentType, nextLedgerName) => {
    const comp = componentType.toUpperCase();
    let charges = [...(draft?.additional_charges || [])];

    const idx = charges.findIndex(c => {
      const name = (c.ledger_name || '').toUpperCase();
      if (comp === 'CGST') return name.includes('CGST');
      if (comp === 'SGST') return name.includes('SGST') || name.includes('UTGST');
      if (comp === 'IGST') return name.includes('IGST');
      if (comp === 'CESS') return name.includes('CESS');
      return false;
    });

    let amt = 0;
    if (comp === 'CGST') amt = cgst;
    if (comp === 'SGST') amt = sgst;
    if (comp === 'IGST') amt = igst;
    if (comp === 'CESS') amt = draft?.cess_amount || 0;

    if (idx > -1) {
      if (nextLedgerName) {
        charges[idx] = { ...charges[idx], ledger_name: nextLedgerName, amount: amt };
      } else {
        charges.splice(idx, 1);
      }
    } else if (nextLedgerName) {
      charges.push({
        ledger_name: nextLedgerName,
        amount: amt,
        taxable_value: parseFloat(draft?.base_amount || 0).toFixed(2),
        is_tax: true
      });
    }

    const updatedDraft = {
      ...draft,
      additional_charges: charges
    };
    const recalculated = recalculateDraft(
      updatedDraft,
      activePartyDetails,
      pageData,
      stockItemDetails
    );
    setDraft(recalculated);
    try {
      const res = await aiApi.updateDraft(activeConvId, recalculated);
      setDraft(res.draft);
      setDraftJson(res.draft_json);
    } catch (err) {
      console.error(err);
      toast.error("Failed to sync tax ledger change.");
    }
  };

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // Fetch outstanding bills and balances for fundflow ledger items and payment accounts
  useEffect(() => {
    if (!draft || !['payment', 'receipt', 'contra'].includes(draft.voucher_type?.toLowerCase())) return;
    const items = draft.items || [];
    const ledgersToFetch = new Set();
    items.forEach((it) => {
      if (it.item_name) ledgersToFetch.add(it.item_name);
    });
    if (draft.credit) ledgersToFetch.add(draft.credit);
    if (draft.debit) ledgersToFetch.add(draft.debit);

    ledgersToFetch.forEach(async (name) => {
      if (name && !pendingBillsMap[name]) {
        try {
          const res = await aiApi.getFundFlowPartyDetails(name);
          if (res && res.success && res.data) {
            setPendingBillsMap(prev => ({
              ...prev,
              [name]: res.data
            }));
          }
        } catch (e) {
          console.error("Error fetching fundflow details for " + name, e);
        }
      }
    });
  }, [draft?.items, draft?.voucher_type, draft?.credit, draft?.debit]);

  // Load workspace data and initial sessions on mount
  const loadWorkspaceData = async (selectSessionId = null) => {
    try {
      const data = await aiApi.getPageLoadData();
      setPageData(data);
      setConversations(data.conversations || []);

      try {
        const stockRes = await salesApi.getStockItems();
        if (stockRes && stockRes.success && stockRes.data) {
          const details = {};
          stockRes.data.forEach(item => {
            if (item.name) {
              details[item.name] = {
                hsnCode: item.hsnCode || '',
                gstRate: item.gstRate || 0,
                unit: item.unit || '',
                qty: item.qty || 0
              };
            }
          });
          setStockItemDetails(details);
        }
      } catch (e) {
        console.error("Failed to load stock items:", e);
      }
      
      let targetId = selectSessionId;
      if (!targetId && data.conversations && data.conversations.length > 0) {
        targetId = data.conversations[0].id;
      }
      
      if (targetId) {
        setActiveConvId(targetId);
        await selectSession(targetId);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load accounting workspace metrics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspaceData();
  }, []);

  const draftItemsKey = (draft?.items || []).map(it => `${it.item_name}_${it.hsn || ''}_${it.unit || ''}`).join('|');

  // Auto-populate missing HSN codes and units from stockItemDetails
  useEffect(() => {
    if (!draft || !stockItemDetails || Object.keys(stockItemDetails).length === 0) return;
    let needsUpdate = false;
    const updatedItems = (draft.items || []).map(item => {
      const details = stockItemDetails[item.item_name];
      if (details) {
        let updated = { ...item };
        let changed = false;
        if (!item.hsn && details.hsnCode) {
          updated.hsn = details.hsnCode;
          changed = true;
        }
        if (!item.unit && details.unit) {
          updated.unit = details.unit;
          changed = true;
        }
        if (changed) {
          needsUpdate = true;
          return updated;
        }
      }
      return item;
    });
    if (needsUpdate) {
      const recalculated = recalculateDraft(
        { ...draft, items: updatedItems },
        activePartyDetails,
        pageData,
        stockItemDetails
      );
      setDraft(recalculated);
    }
  }, [stockItemDetails, draftItemsKey, activePartyDetails, pageData]);

  // Fetch session details on activation
  const selectSession = async (sessId) => {
    setLoadingChat(true);
    try {
      const session = await aiApi.getSession(sessId);
      let history = session.history || [];
      if (history.length === 0) {
        history = [
          { id: 'm1', role: 'assistant', content: pageData?.welcomeMessage || 'Hello! I am ready to create a voucher. Please describe the transaction.', timestamp: 'Now' }
        ];
      }
      setMessages(history);
      const activeDraft = session.current_draft;
      setDraft(activeDraft);
      setDraftJson(session.draft_json);
      setChatState(session.state || 'idle');
      setMetadata(session.metadata || {});
      
      // Fetch party details if a party is mapped in the draft
      if (activeDraft && activeDraft.party) {
        fetchPartyDetails(activeDraft.party);
        // Preserve review mode if already active and draft exists
        setIsReviewMode(prev => prev && !!activeDraft);
      } else {
        setActivePartyDetails(null);
        setIsReviewMode(false); // Fallback to chat if no draft
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load chat history.");
    } finally {
      setLoadingChat(false);
    }
  };

  const fetchPartyDetails = async (name) => {
    if (!name) {
      setActivePartyDetails(null);
      return;
    }
    try {
      const details = await aiApi.getLedgerDetails(name);
      setActivePartyDetails(details);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteConversation = async (convId, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this voucher chat?")) return;
    try {
      const data = await aiApi.deleteSession(convId);
      if (data.status === 'success') {
        toast.success("Voucher chat deleted successfully.");
        setConversations(prev => prev.filter(c => c.id !== convId));
        if (activeConvId === convId) {
          setActiveConvId(null);
          setMessages([]);
          setDraft(null);
          setDraftJson(null);
          setChatState('idle');
          setMetadata({});
          setActivePartyDetails(null);
          setIsReviewMode(false);
        }
      } else {
        toast.error("Failed to delete chat.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error deleting chat.");
    }
  };

  // Switch active session
  const handleSelectConversation = (convId) => {
    setActiveConvId(convId);
    selectSession(convId);
  };

  // Start new conversation session
  const handleNewChat = async () => {
    const newSessionId = 'sess_' + Math.random().toString(36).substring(2, 11);
    try {
      setLoadingChat(true);
      await aiApi.resetSession(newSessionId);
      
      const data = await aiApi.getPageLoadData();
      setPageData(data);
      setConversations(data.conversations || []);

      setActiveConvId(newSessionId);
      setMessages([
        { id: 'm1', role: 'assistant', content: data.welcomeMessage || 'Hello! I am ready to create a voucher. Please describe the transaction.', timestamp: 'Now' }
      ]);
      setDraft(null);
      setDraftJson(null);
      setChatState('idle');
      setMetadata({});
      setActivePartyDetails(null);
      setIsReviewMode(false);
      
      toast.success("Started a new chat session.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to create new session.");
    } finally {
      setLoadingChat(false);
    }
  };

  // Submit chat message
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    const userText = inputText;
    setInputText('');

    // Optimistic UI update
    const userMsg = {
      id: 'msg-' + Date.now(),
      role: 'user',
      content: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, userMsg]);
    setIsThinking(true);

    try {
      const res = await aiApi.sendMessage(activeConvId, userText);
      
      setMessages(res.history || []);
      setChatState(res.state);
      setMetadata(res.metadata || {});
      if (res.draft) {
        setDraft(res.draft);
        setDraftJson(res.draft_json);
        fetchPartyDetails(res.draft.party);
        // Switch to review mode only when we have sufficient information
        const isComplete = res.state === 'WAITING_CONFIRMATION' || res.state === 'WAITING_ALLOCATION' || res.state === 'SAVED';
        setIsReviewMode(isComplete);
      } else {
        setDraft(null);
        setDraftJson(null);
        setActivePartyDetails(null);
        setIsReviewMode(false);
      }

      // Reload sidebar to update titles/previews
      const data = await aiApi.getPageLoadData();
      setPageData(data);
      setConversations(data.conversations || []);

    } catch (err) {
      console.error(err);
      toast.error("AI service connection error.");
    } finally {
      setIsThinking(false);
    }
  };

  const handleSuggestionClick = (promptText) => {
    setInputText(promptText);
  };

  const handleResetSession = async () => {
    if (!activeConvId) return;
    try {
      await aiApi.resetSession(activeConvId);
      
      const data = await aiApi.getPageLoadData();
      setPageData(data);

      setMessages([
        { id: 'm1', role: 'assistant', content: data.welcomeMessage || 'Reset successful! How can I assist you with your accounting today?', timestamp: 'Now' }
      ]);
      setDraft(null);
      setDraftJson(null);
      setChatState('idle');
      setMetadata({});
      setActivePartyDetails(null);
      setIsReviewMode(false);
      
      toast.success("Session reset successful.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to reset session.");
    }
  };

  const handleSaveDraft = async () => {
    if (!activeConvId) return;
    try {
      const res = await aiApi.saveDraft(activeConvId);
      toast.success(res.reply || "Voucher Draft saved successfully!");
      
      await selectSession(activeConvId);
      const data = await aiApi.getPageLoadData();
      setPageData(data);
      setConversations(data.conversations || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to save draft.");
    }
  };

  const handleApprove = async () => {
    if (!draft) return;
    setIsThinking(true);
    try {
      const res = await aiApi.approvePaymentVoucher(activeConvId, draft);
      if (res && res.success) {
        toast.success(res.message || "Voucher Approved and Synced to Tally!");
        await selectSession(activeConvId);
        await loadWorkspaceData(activeConvId);
      } else {
        toast.error(res.message || "Approval failed.");
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to approve and post payment.");
    } finally {
      setIsThinking(false);
    }
  };

  const handlePostTally = async () => {
    if (draft && (draft.status === 'Posted' || draft.status === 'POSTED_TO_TALLY')) {
      toast.success("Already posted to Tally ERP!");
      return;
    }
    await handleApprove();
  };

  // --- Manual Edit Form Handlers ---
  const handleHeaderChange = async (field, value) => {
    const updatedDraft = {
      ...draft,
      [field]: value
    };
    const recalculated = recalculateDraft(
      updatedDraft,
      activePartyDetails,
      pageData,
      stockItemDetails
    );
    setDraft(recalculated);
    try {
      const res = await aiApi.updateDraft(activeConvId, recalculated);
      setDraft(res.draft);
      setDraftJson(res.draft_json);
    } catch (err) {
      console.error(err);
      toast.error("Failed to sync header change.");
    }
  };

  const handlePartyChange = async (partyName) => {
    const updatedDraft = {
      ...draft,
      party: partyName
    };
    try {
      const details = await aiApi.getLedgerDetails(partyName);
      setActivePartyDetails(details);
      
      const recalculated = recalculateDraft(
        updatedDraft,
        details,
        pageData,
        stockItemDetails
      );
      setDraft(recalculated);
      
      const res = await aiApi.updateDraft(activeConvId, recalculated);
      setDraft(res.draft);
      setDraftJson(res.draft_json);
    } catch (err) {
      console.error(err);
      toast.error("Failed to sync party change.");
    }
  };

  const handleItemChange = async (index, field, value) => {
    const isAccounting = ['payment', 'receipt', 'contra'].includes(draft.voucher_type?.toLowerCase());
    const updatedItems = draft.items.map((item, idx) => {
      if (idx === index) {
        let updatedItem = { ...item };
        if (typeof field === 'object') {
          updatedItem = { ...updatedItem, ...field };
        } else {
          updatedItem[field] = value;
        }

        if (isAccounting) {
          if (field === 'amount' || (typeof field === 'object' && field.amount !== undefined)) {
            const amtVal = typeof field === 'object' ? field.amount : value;
            updatedItem.rate = parseFloat(amtVal) || 0;
            updatedItem.amount = parseFloat(amtVal) || 0;
          }
        } else {
          const qty = parseFloat(updatedItem.quantity) || 0;
          const rate = parseFloat(updatedItem.rate) || 0;
          const disc = parseFloat(updatedItem.discount_percent) || 0;
          updatedItem.amount = qty * rate * (1 - disc / 100);
        }
        return updatedItem;
      }
      return item;
    });

    const recalculated = recalculateDraft(
      { ...draft, items: updatedItems },
      activePartyDetails,
      pageData,
      stockItemDetails
    );

    setDraft(recalculated);

    try {
      const res = await aiApi.updateDraft(activeConvId, recalculated);
      const mergedItems = res.draft.items.map((bItem, bIdx) => {
        const localItem = recalculated.items[bIdx];
        if (localItem) {
          return {
            ...bItem,
            hsn: bItem.hsn || localItem.hsn || '',
            unit: bItem.unit || localItem.unit || 'Nos'
          };
        }
        return bItem;
      });
      setDraft({
        ...res.draft,
        items: mergedItems
      });
      setDraftJson(res.draft_json);
    } catch (err) {
      console.error(err);
      toast.error("Failed to sync item change.");
    }
  };

  const handleItemDelete = async (index) => {
    const isAccounting = ['payment', 'receipt', 'contra'].includes(draft.voucher_type?.toLowerCase());
    const updatedItems = draft.items.filter((_, idx) => idx !== index);

    const recalculated = recalculateDraft(
      { ...draft, items: updatedItems },
      activePartyDetails,
      pageData,
      stockItemDetails
    );

    setDraft(recalculated);
    try {
      const res = await aiApi.updateDraft(activeConvId, recalculated);
      setDraft(res.draft);
      setDraftJson(res.draft_json);
      toast.success("Item removed");
    } catch (err) {
      console.error(err);
      toast.error("Failed to sync item removal.");
    }
  };

  const handleItemAdd = async () => {
    const isAccounting = ['payment', 'receipt', 'contra'].includes(draft.voucher_type?.toLowerCase());
    let newItem;
    if (isAccounting) {
      newItem = {
        item_name: "",
        quantity: 1,
        rate: 0.0,
        amount: 0.0,
        discount_percent: 0.0,
        gst_rate: 0.0,
        description: ""
      };
    } else {
      const defaultItemName = pageData?.allItems?.[0] || "Laptop";
      const details = stockItemDetails[defaultItemName] || {};
      newItem = {
        item_name: defaultItemName,
        quantity: 1,
        rate: details.rate || 100.0,
        amount: details.rate || 100.0,
        discount_percent: 0.0,
        gst_rate: details.gstRate || 18.0,
        hsn: details.hsnCode || "4819",
        unit: details.unit || "Nos"
      };
    }

    const recalculated = recalculateDraft(
      { ...draft, items: [...(draft.items || []), newItem] },
      activePartyDetails,
      pageData,
      stockItemDetails
    );

    setDraft(recalculated);
    try {
      const res = await aiApi.updateDraft(activeConvId, recalculated);
      setDraft(res.draft);
      setDraftJson(res.draft_json);
      toast.success("Added new row");
    } catch (err) {
      console.error(err);
      toast.error("Failed to add row.");
    }
  };

  // Filter list based on status filter tabs
  const displayedConversations = conversations.filter(c => {
    if (statusFilter === 'Draft') {
      return c.title !== 'New Voucher Chat' && c.status === 'Draft';
    }
    if (statusFilter === 'Approved') {
      return c.status === 'Approved' || c.status === 'Posted';
    }
    return true; // 'All'
  });

  // Calculate CGST / SGST / IGST from precalculated draft fields
  const cgst = draft?.cgst_amount || 0;
  const sgst = draft?.sgst_amount || 0;
  const igst = draft?.igst_amount || 0;
  const taxableVal = draft?.base_amount || 0;

  // Compile validations/badges
  const badges = [];
  if (draft) {
    if (draft.party) badges.push("Party Available");
    if (draft.entry_mode === 'item_invoice' && draft.items && draft.items.length > 0) {
      badges.push("Stock Available");
    }
    if (draft.gst_rate) badges.push("GST Valid");
  }

  // Parse draft progress step
  let draftStep = 1;
  if (draft) {
    if (draft.party) draftStep = 2;
    if (draft.entry_mode === 'item_invoice' && draft.items && draft.items.length > 0) draftStep = 3;
    if (badges.length >= 3) draftStep = 4;
    if (draft.status === 'Saved' || draft.status === 'Posted') draftStep = 5;
  }

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={36} className="animate-spin text-blue-600" />
          <span className="text-[12px] font-bold text-slate-500">Loading AI Bookkeeping Assistant...</span>
        </div>
      </div>
    );
  }

  // ========================================================================
  // RENDER OPTION A: FULL-SCREEN VOUCHER WORKSHEET REVIEW MODE (If isReviewMode = true)
  // ========================================================================
  if (isReviewMode && draft) {
    return (
      <div className="flex h-full w-full overflow-hidden bg-slate-50 text-slate-800 font-sans">
        
        {/* Sidebar remains on the left */}
        <aside className="w-72 border-r flex flex-col shrink-0 bg-white border-slate-200">
          <div className="p-4 border-b border-slate-200 flex flex-col gap-3 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Voucher Chats</span>
              <button 
                onClick={handleNewChat}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-[11px] font-bold hover:bg-blue-700 transition-all shadow-sm"
              >
                <Plus size={12} />
                <span>New Chat</span>
              </button>
            </div>
            <div className="flex bg-slate-100 p-0.5 rounded-lg text-[10.5px] font-bold border border-slate-200 shrink-0">
              <button 
                onClick={() => setStatusFilter('All')} 
                className={`flex-1 py-1 rounded text-center transition-all ${statusFilter === 'All' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                All
              </button>
              <button 
                onClick={() => setStatusFilter('Draft')} 
                className={`flex-1 py-1 rounded text-center transition-all ${statusFilter === 'Draft' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Draft
              </button>
              <button 
                onClick={() => setStatusFilter('Approved')} 
                className={`flex-1 py-1 rounded text-center transition-all ${statusFilter === 'Approved' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Approved
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 themed-scrollbar">
            {displayedConversations.map((conv) => {
              const isActive = conv.id === activeConvId;
              return (
                <div
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all flex flex-col gap-1 ${
                    isActive 
                      ? 'bg-blue-50/70 border-blue-400 shadow-sm' 
                      : 'bg-white border-slate-200 hover:bg-slate-50/60'
                  }`}
                >
                  <div className="flex justify-between items-start gap-1">
                    <span className="text-[11.5px] font-extrabold text-slate-700 truncate max-w-[140px]">{conv.title}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[9px] text-slate-400">{conv.date}</span>
                      <button 
                        onClick={(e) => handleDeleteConversation(conv.id, e)}
                        className="text-slate-400 hover:text-rose-500 p-0.5 rounded transition-all"
                        title="Delete chat"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-400 truncate font-medium">{conv.preview}</div>
                  <div className="flex gap-1.5 mt-1 items-center">
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-blue-50 text-blue-600">
                      {conv.voucherType || 'Voucher'}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-amber-50 text-amber-600">
                      {conv.status || 'Draft'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3 border-t bg-slate-50/50 border-slate-200 grid grid-cols-3 gap-2 text-center text-[9px] shrink-0 font-bold text-slate-500">
            <div>
              <div className="text-slate-800 text-[11px] font-extrabold">{pageData?.partyCount}</div>
              Parties
            </div>
            <div>
              <div className="text-slate-800 text-[11px] font-extrabold">{pageData?.itemCount}</div>
              Items
            </div>
            <div>
              <div className="text-slate-800 text-[11px] font-extrabold">{pageData?.ledgerCount}</div>
              Ledgers
            </div>
          </div>
        </aside>

      {/* Expanded Form Worksheet Dashboard */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 overflow-y-auto themed-scrollbar p-4 space-y-4">
        
        {/* Top Header Row with Actions */}
        <header className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200 shadow-sm shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-extrabold text-slate-800">Review & Save Voucher Draft</span>
              <span className="px-2 py-0.5 text-[9px] font-bold rounded bg-amber-50 border border-amber-200 text-amber-600 uppercase">
                {draft.status || 'Draft'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
              Verify details, make modifications below, and click "Save Draft" to persist your changes.
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsReviewMode(false)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-600 bg-white hover:bg-slate-50 transition-all flex items-center gap-1.5"
            >
              <X size={12} />
              <span>Back to Chat</span>
            </button>
            <button 
              onClick={handleSaveDraft}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition-all shadow-sm flex items-center gap-1.5"
            >
              <Save size={12} />
              <span>Save Draft</span>
            </button>
            <button 
              onClick={handleApprove}
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold transition-all shadow-sm flex items-center gap-1.5"
            >
              <CheckCircle2 size={12} />
              <span>Approve & Post</span>
            </button>
          </div>
        </header>

        {/* Dynamic Grid Layout */}
        <div className="grid grid-cols-4 gap-3">
          
          {/* Columns 1, 2 & 3: Full Manual Entry Worksheet Form */}
          <div className="col-span-3 space-y-3">
            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm space-y-3">
              <div className="text-[11px] uppercase font-extrabold tracking-wider text-slate-400 border-b pb-1">Voucher Details</div>
              
              {/* Header Information */}
              <div className="grid grid-cols-3 gap-3 text-[11px]">
                <div>
                  <label className="text-slate-400 block text-[9.5px] mb-1 font-semibold">Voucher Type</label>
                  <select
                    value={draft.voucher_type}
                    onChange={(e) => handleHeaderChange('voucher_type', e.target.value)}
                    className="w-full h-8 px-2 rounded-md border border-slate-200 bg-white outline-none focus:border-blue-500 font-semibold text-slate-700"
                  >
                    {(pageData?.availableVoucherTypes || pageData?.voucherTypes || ["Sales", "Purchase", "Debit Note", "Credit Note", "Payment", "Receipt", "Contra"]).map(vt => {
                      const value = vt.replace(/\s+Voucher$/i, '').replace(/\s+Bill$/i, '');
                      return (
                        <option key={vt} value={value}>{vt.endsWith('Voucher') || vt.endsWith('Bill') || vt.toLowerCase() === 'contra' ? vt : `${value} Voucher`}</option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block text-[9.5px] mb-1 font-semibold">Voucher Date</label>
                  <input
                    type="date"
                    value={draft.date}
                    onChange={(e) => handleHeaderChange('date', e.target.value)}
                    className="w-full h-8 px-2 rounded-md border border-slate-200 bg-white outline-none focus:border-blue-500 font-semibold text-slate-700 text-center"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block text-[9.5px] mb-1 font-semibold">Voucher Number</label>
                  <input
                    type="text"
                    value={draft.voucher_number || ''}
                    onChange={(e) => handleHeaderChange('voucher_number', e.target.value)}
                    placeholder="Auto Generated"
                    className="w-full h-8 px-2 rounded-md border border-slate-200 bg-white outline-none focus:border-blue-500 font-semibold text-slate-700 text-center"
                  />
                </div>
              </div>

              {draft.voucher_type?.toLowerCase() === 'contra' ? (
                /* Contra Voucher manual UI */
                <div className="border-t pt-3 space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-[11px]">
                    {/* DR SOURCE ACCOUNT */}
                    <div className="bg-slate-50/50 p-4 rounded-lg border border-slate-200/60 space-y-3">
                      <div className="text-[10px] uppercase font-extrabold tracking-wider text-emerald-600 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        <span>(DR) SOURCE ACCOUNT</span>
                      </div>
                      <div>
                        <label className="text-slate-400 block text-[9.5px] mb-1 font-semibold">Ledger Name *</label>
                        <select
                          value={draft.debit || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            const updated = { ...draft, debit: val };
                            setDraft(updated);
                            aiApi.updateDraft(activeConvId, updated).then(res => {
                              setDraft(res.draft);
                              setDraftJson(res.draft_json);
                            });
                          }}
                          className="w-full h-8 px-2 rounded-md border border-slate-200 bg-white outline-none focus:border-blue-500 font-semibold text-slate-700 text-[10.5px]"
                        >
                          <option value="" disabled>-- Select Cash/Bank --</option>
                          {(pageData?.allBanks || []).map((name) => (
                            <option key={name} value={name}>{name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-slate-400 block text-[9.5px] mb-1 font-semibold">Account Type</label>
                        <div className="w-full h-8 px-2 rounded-md border border-slate-100 bg-slate-100/50 flex items-center font-bold text-slate-500 text-[10.5px]">
                          {draft.debit && draft.debit.toLowerCase().includes('cash') ? 'Cash' : 'Bank'}
                        </div>
                      </div>
                      <div>
                        <label className="text-slate-400 block text-[9.5px] mb-1 font-semibold">Amount (₹) *</label>
                        <input
                          type="number"
                          value={draft.amount || ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            const updated = { ...draft, amount: val };
                            if (updated.items && updated.items.length > 0) {
                              updated.items = updated.items.map(item => ({ ...item, amount: val, rate: val }));
                            }
                            setDraft(updated);
                            aiApi.updateDraft(activeConvId, updated).then(res => {
                              setDraft(res.draft);
                              setDraftJson(res.draft_json);
                            });
                          }}
                          placeholder="Enter amount"
                          className="w-full h-8 px-2 rounded-md border border-slate-200 bg-white outline-none focus:border-blue-500 font-bold text-slate-700 text-[10.5px]"
                        />
                      </div>
                    </div>

                    {/* CR DESTINATION ACCOUNT */}
                    <div className="bg-slate-50/50 p-4 rounded-lg border border-slate-200/60 space-y-3">
                      <div className="text-[10px] uppercase font-extrabold tracking-wider text-blue-600 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                        <span>(CR) DESTINATION ACCOUNT</span>
                      </div>
                      <div>
                        <label className="text-slate-400 block text-[9.5px] mb-1 font-semibold">Ledger Name *</label>
                        <select
                          value={draft.credit || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            const updated = { ...draft, credit: val };
                            setDraft(updated);
                            aiApi.updateDraft(activeConvId, updated).then(res => {
                              setDraft(res.draft);
                              setDraftJson(res.draft_json);
                            });
                          }}
                          className="w-full h-8 px-2 rounded-md border border-slate-200 bg-white outline-none focus:border-blue-500 font-semibold text-slate-700 text-[10.5px]"
                        >
                          <option value="" disabled>-- Select Cash/Bank --</option>
                          {(pageData?.allBanks || []).map((name) => (
                            <option key={name} value={name}>{name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-slate-400 block text-[9.5px] mb-1 font-semibold">Account Type</label>
                        <div className="w-full h-8 px-2 rounded-md border border-slate-100 bg-slate-100/50 flex items-center font-bold text-slate-500 text-[10.5px]">
                          {draft.credit && draft.credit.toLowerCase().includes('cash') ? 'Cash' : 'Bank'}
                        </div>
                      </div>
                      <div>
                        <label className="text-slate-400 block text-[9.5px] mb-1 font-semibold">Amount (₹) *</label>
                        <input
                          type="number"
                          value={draft.amount || ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            const updated = { ...draft, amount: val };
                            if (updated.items && updated.items.length > 0) {
                              updated.items = updated.items.map(item => ({ ...item, amount: val, rate: val }));
                            }
                            setDraft(updated);
                            aiApi.updateDraft(activeConvId, updated).then(res => {
                              setDraft(res.draft);
                              setDraftJson(res.draft_json);
                            });
                          }}
                          placeholder="Enter amount"
                          className="w-full h-8 px-2 rounded-md border border-slate-200 bg-white outline-none focus:border-blue-500 font-bold text-slate-700 text-[10.5px]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Status/Validation Badges */}
                  <div className="space-y-1.5">
                    {draft.debit && draft.credit && draft.debit === draft.credit && (
                      <div className="bg-rose-50 border border-rose-200 text-rose-600 rounded-md p-2 text-[10px] font-semibold flex items-center gap-1.5">
                        <AlertCircle size={12} className="text-rose-500 shrink-0" />
                        <span>Validation Error: Source (DR) and Destination (CR) accounts cannot be the same ledger.</span>
                      </div>
                    )}
                    {(!draft.amount || draft.amount <= 0) && (
                      <div className="bg-rose-50 border border-rose-200 text-rose-600 rounded-md p-2 text-[10px] font-semibold flex items-center gap-1.5">
                        <AlertCircle size={12} className="text-rose-500 shrink-0" />
                        <span>Validation Error: Transaction amount must be greater than zero.</span>
                      </div>
                    )}
                    {draft.debit && draft.credit && draft.debit !== draft.credit && draft.amount > 0 && (
                      <div className="bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-md p-2 text-[10px] font-semibold flex items-center gap-1.5">
                        <Check size={12} className="text-emerald-500 shrink-0" />
                        <span>Status: Balanced (DR Amount ₹{draft.amount.toLocaleString('en-IN')} = CR Amount ₹{draft.amount.toLocaleString('en-IN')})</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : ['payment', 'receipt'].includes(draft.voucher_type?.toLowerCase()) ? (
                /* Accounting Voucher (Payment, Receipt) manual UI */
                <div className="border-t pt-3 space-y-4">
                  {/* Mode and Account Header Row */}
                  <div className="grid grid-cols-3 gap-3 text-[11px]">
                    <div>
                      <label className="text-slate-400 block text-[9.5px] mb-1 font-semibold">Payment Mode</label>
                      <select
                        value={
                          draft.voucher_type?.toLowerCase() === 'payment'
                            ? (draft.credit && draft.credit.toLowerCase().includes('cash') ? 'Cash' : 'Bank')
                            : (draft.debit && draft.debit.toLowerCase().includes('cash') ? 'Cash' : 'Bank')
                        }
                        onChange={() => {}} // Read-only / auto inferred
                        className="w-full h-8 px-2 rounded-md border border-slate-200 bg-slate-50 outline-none font-semibold text-slate-500 cursor-not-allowed"
                        disabled
                      >
                        <option value="Cash">Cash</option>
                        <option value="Bank">Bank</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-400 block text-[9.5px] mb-1 font-semibold">
                        {draft.voucher_type?.toLowerCase() === 'receipt' ? 'Receipt Account' : 'Payment Account'} *
                      </label>
                      <select
                        value={
                          draft.voucher_type?.toLowerCase() === 'payment'
                            ? (draft.credit || '')
                            : (draft.debit || '')
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          let updated;
                          if (draft.voucher_type?.toLowerCase() === 'payment') {
                            updated = { ...draft, credit: val };
                          } else {
                            updated = { ...draft, debit: val };
                          }
                          setDraft(updated);
                          aiApi.updateDraft(activeConvId, updated).then(res => {
                            setDraft(res.draft);
                            setDraftJson(res.draft_json);
                          });
                        }}
                        className="w-full h-8 px-2 rounded-md border border-slate-200 bg-white outline-none focus:border-blue-500 font-semibold text-slate-700 text-[10.5px]"
                      >
                        <option value="" disabled>-- Select Cash/Bank Account --</option>
                        {(pageData?.allBanks || []).map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-400 block text-[9.5px] mb-1 font-semibold">Account Balance</label>
                      <div className="w-full h-8 px-2 rounded-md border border-slate-100 bg-slate-50/50 flex items-center font-bold text-slate-600 text-[10.5px]">
                        {(() => {
                          const key = draft.voucher_type?.toLowerCase() === 'payment' ? draft.credit : draft.debit;
                          const balData = pendingBillsMap[key];
                          return balData 
                            ? `₹ ${parseFloat(balData.outstandingBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} ${balData.outstandingType || ''}` 
                            : '₹ 0.00';
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* TRANSACTION DETAILS Table */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400">Transaction Details</span>
                      <button
                        onClick={handleItemAdd}
                        className="flex items-center gap-1 px-2.5 py-0.5 rounded border border-blue-200 bg-blue-50 text-blue-600 text-[9.5px] font-bold hover:bg-blue-100 transition-colors"
                      >
                        <Plus size={10} />
                        <span>Add Row</span>
                      </button>
                    </div>

                    <div className="border border-slate-200 rounded overflow-hidden">
                      <table className="w-full text-left border-collapse text-[10px]">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[8.5px] uppercase font-extrabold text-slate-400">
                            <th className="p-1.5 pl-3 border-r border-slate-200 w-10 text-center">#</th>
                            <th className="p-1.5 border-r border-slate-200">Ledger Name *</th>
                            <th className="p-1.5 border-r border-slate-200">Description</th>
                            <th className="p-1.5 text-center w-36 border-r border-slate-200">Amount (₹)</th>
                            <th className="p-1.5 text-center w-52 border-r border-slate-200">Outstanding Bills</th>
                            <th className="p-1.5 text-center w-12">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {(draft.items || []).map((item, idx) => {
                            const billsData = pendingBillsMap[item.item_name];
                            const outstandingText = billsData 
                              ? `₹ ${Math.abs(billsData.outstandingBalance).toLocaleString('en-IN')} ${billsData.outstandingBalance >= 0 ? 'Dr' : 'Cr'}` 
                              : '₹ 0.00';
                            return (
                              <tr key={idx} className="hover:bg-slate-50/50">
                                <td className="p-1.5 border-r border-slate-100 text-center text-slate-400 font-semibold">{idx + 1}</td>
                                <td className="p-1 border-r border-slate-100">
                                  <select
                                    value={item.item_name}
                                    onChange={(e) => handleItemChange(idx, 'item_name', e.target.value)}
                                    className="w-full h-7 px-1.5 rounded border border-slate-200 bg-white outline-none focus:border-blue-500 font-semibold text-slate-700 text-[10.5px]"
                                  >
                                    <option value="" disabled>-- Select Ledger --</option>
                                    {item.item_name && !(pageData?.allLedgers || []).includes(item.item_name) && (
                                      <option value={item.item_name}>{item.item_name}</option>
                                    )}
                                    {(pageData?.allLedgers || []).map((name) => (
                                      <option key={name} value={name}>{name}</option>
                                    ))}
                                  </select>
                                </td>
                                <td className="p-1 border-r border-slate-100">
                                  <input
                                    type="text"
                                    value={item.description || ''}
                                    onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                                    placeholder="Enter description"
                                    className="w-full h-7 px-2 rounded border border-slate-200 focus:border-blue-500 font-medium text-slate-700 text-[10.5px]"
                                  />
                                </td>
                                <td className="p-1 border-r border-slate-100">
                                  <input
                                    type="number"
                                    value={item.amount || ''}
                                    onChange={(e) => handleItemChange(idx, 'amount', parseFloat(e.target.value) || 0)}
                                    placeholder="0.00"
                                    className="w-full h-7 px-2 rounded border border-slate-200 focus:border-blue-500 font-bold text-slate-700 text-[10.5px] text-center"
                                  />
                                </td>
                                <td className="p-1 border-r border-slate-100 text-center font-bold text-slate-600 text-[10.5px]">
                                  {outstandingText}
                                </td>
                                <td className="p-1 text-center">
                                  <button
                                    onClick={() => handleItemDelete(idx)}
                                    className="p-1 text-rose-500 hover:bg-rose-50 rounded transition-colors"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                          {(!draft.items || draft.items.length === 0) && (
                            <tr>
                              <td colSpan={6} className="text-center py-6 text-slate-400 italic bg-slate-50/50">
                                No transaction rows added. Click "Add Row" to insert an entry.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* OUTSTANDING BILLS ALLOCATION SECTION */}
                  <div className="space-y-2">
                    <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400">Outstanding Bills Allocation</div>
                    {(() => {
                      const allPending = [];
                      (draft.items || []).forEach(item => {
                        const balanceData = pendingBillsMap[item.item_name];
                        if (balanceData && balanceData.pendingBills && balanceData.pendingBills.length > 0) {
                          balanceData.pendingBills.forEach(bill => {
                            allPending.push({ party: item.item_name, bill });
                          });
                        }
                      });

                      if (allPending.length === 0) {
                        return (
                          <div className="bg-slate-50 border border-slate-200 text-slate-400 text-center py-3 text-[9px] uppercase font-extrabold rounded-md tracking-wider">
                            NO PENDING BILLS AVAILABLE TO ALLOCATE.
                          </div>
                        );
                      }

                      return (
                        <div className="border border-slate-200 rounded overflow-hidden">
                          <table className="w-full text-left border-collapse text-[10px]">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200 text-[8.5px] uppercase font-extrabold text-slate-400">
                                <th className="p-1.5 pl-3 border-r border-slate-200 w-10 text-center">#</th>
                                <th className="p-1.5 border-r border-slate-200">Party Ledger</th>
                                <th className="p-1.5 border-r border-slate-200">Bill Reference Number</th>
                                <th className="p-1.5 border-r border-slate-200">Bill Date</th>
                                <th className="p-1.5 text-right w-36 border-r border-slate-200">Bill Amount (₹)</th>
                                <th className="p-1.5 text-right w-36">Amount Allocation (₹)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {allPending.map((p, index) => (
                                <tr key={index} className="hover:bg-slate-50/50 font-medium text-slate-600">
                                  <td className="p-1.5 border-r border-slate-100 text-center text-slate-400 font-semibold">{index + 1}</td>
                                  <td className="p-1.5 border-r border-slate-100 font-semibold text-slate-700">{p.party}</td>
                                  <td className="p-1.5 border-r border-slate-100 font-mono text-[9.5px]">{p.bill.billNo}</td>
                                  <td className="p-1.5 border-r border-slate-100">{p.bill.date || 'N/A'}</td>
                                  <td className="p-1.5 border-r border-slate-100 text-right font-extrabold text-slate-700">
                                    ₹ {parseFloat(p.bill.pendingAmount || p.bill.billAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className="p-1.5 text-right font-extrabold text-blue-600">
                                    ₹ {(() => {
                                      const alloc = (draft.bill_allocations || []).find(a => a.bill === p.bill.billNo);
                                      return parseFloat(alloc ? alloc.amount : p.bill.pendingAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
                                    })()}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                /* Invoice Item / Party Voucher UI (Sales, Purchase, Debit/Credit Note) */
                <>
                  {/* Party Section */}
                  <div className="grid grid-cols-2 gap-3 border-t pt-3 text-[11px]">
                    <div>
                      <label className="text-slate-400 block text-[9.5px] mb-1 font-semibold">Party / Customer Account</label>
                      <select
                        value={draft.party || ''}
                        onChange={(e) => handlePartyChange(e.target.value)}
                        className="w-full h-8 px-2 rounded-md border border-slate-200 bg-white outline-none focus:border-blue-500 font-semibold text-slate-700"
                      >
                        <option value="" disabled>-- Select Party --</option>
                        {pageData?.allParties?.map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </div>
                    
                    {draft.party && (
                      <div className="bg-slate-50 p-2 rounded-md border border-slate-200/60 grid grid-cols-3 gap-2 text-[10px] items-center">
                        <div>
                          <span className="text-slate-400 block text-[8px] font-medium">GSTIN</span>
                          <span className="font-bold text-slate-700">{activePartyDetails?.partyDetails?.gstin || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[8px] font-medium">Supply State</span>
                          <span className="font-bold text-slate-700">{activePartyDetails?.partyDetails?.gstState || 'N/A'}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-400 block text-[8px] font-medium">Outstanding</span>
                          <span className="font-extrabold text-rose-500">
                            {activePartyDetails?.outstandingBalance ? `₹ ${parseFloat(activePartyDetails.outstandingBalance).toLocaleString('en-IN')}` : '₹ 0.00'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Stock Items Spreadsheet */}
                  <div className="border-t pt-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400">Inventory Items ({draft.items?.length || 0})</span>
                      <button
                        onClick={handleItemAdd}
                        className="flex items-center gap-1 px-2.5 py-0.5 rounded border border-blue-200 bg-blue-50 text-blue-600 text-[9.5px] font-bold hover:bg-blue-100 transition-colors"
                      >
                        <Plus size={10} />
                        <span>Add Item Row</span>
                      </button>
                    </div>

                    <div className="border border-slate-200 rounded overflow-hidden">
                      <table className="w-full text-left border-collapse text-[10px]">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[8.5px] uppercase font-extrabold text-slate-400">
                            <th className="p-1.5 pl-3 border-r border-slate-200 w-8 text-center">#</th>
                            <th className="p-1.5 border-r border-slate-200 w-64">Item / Ledger *</th>
                            <th className="p-1.5 text-right w-20 border-r border-slate-200">Stock Qty</th>
                            <th className="p-1.5 text-center w-24 border-r border-slate-200">HSN/SAC</th>
                            <th className="p-1.5 text-center w-16 border-r border-slate-200">GST%</th>
                            <th className="p-1.5 text-right w-20 border-r border-slate-200">Qty</th>
                            <th className="p-1.5 text-center w-24 border-r border-slate-200">Unit</th>
                            <th className="p-1.5 text-right w-28 border-r border-slate-200">Rate (₹)</th>
                            <th className="p-1.5 text-right w-16 border-r border-slate-200">Disc%</th>
                            <th className="p-1.5 text-right w-32 border-r border-slate-200">Amount (₹)</th>
                            <th className="p-1.5 text-center w-10">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {draft.items && draft.items.length > 0 ? (
                            draft.items.map((item, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/50">
                                <td className="p-1.5 pl-3 border-r border-slate-100 text-center text-slate-400 font-semibold">{idx + 1}</td>
                                <td className="p-1 border-r border-slate-100">
                                  <select
                                    value={item.item_name}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const details = stockItemDetails[val] || {};
                                      handleItemChange(idx, {
                                        item_name: val,
                                        hsn: details.hsnCode || '',
                                        gst_rate: details.gstRate !== undefined ? details.gstRate : 18.0,
                                        unit: details.unit || 'Nos',
                                        rate: details.rate || item.rate
                                      });
                                    }}
                                    className="w-full h-7 px-1.5 rounded border border-slate-200 bg-white outline-none focus:border-blue-500 font-semibold text-slate-700 text-[10.5px]"
                                  >
                                    {pageData?.allItems?.map((name) => (
                                      <option key={name} value={name}>{name}</option>
                                    ))}
                                  </select>
                                  <input
                                    type="text"
                                    value={item.description || ''}
                                    onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                                    placeholder="Description"
                                    className="w-full h-6 px-2 border-t rounded outline-none text-[11px] bg-transparent mt-0.5"
                                    style={{ borderColor: 'rgba(226,232,240,0.8)', color: '#64748b' }}
                                  />
                                </td>
                                <td className="p-1 border-r border-slate-100 text-right font-bold text-slate-500 bg-slate-50/20">
                                  {(() => {
                                    if (item.item_name && stockItemDetails[item.item_name]) {
                                      const qty = stockItemDetails[item.item_name].qty ?? 0;
                                      return qty.toLocaleString('en-IN');
                                    }
                                    return '-';
                                  })()}
                                </td>
                                <td className="p-1 border-r border-slate-100">
                                  <input
                                    type="text"
                                    value={item.hsn || ''}
                                    onChange={(e) => handleItemChange(idx, 'hsn', e.target.value)}
                                    placeholder="HSN"
                                    className="w-full h-7 px-2 rounded border border-slate-200 text-center focus:border-blue-500 font-bold text-slate-700 text-[10.5px]"
                                  />
                                </td>
                                <td className="p-1 border-r border-slate-100">
                                  <select
                                    value={item.gst_rate || 0}
                                    onChange={(e) => handleItemChange(idx, 'gst_rate', parseFloat(e.target.value) || 0)}
                                    className="w-full h-7 px-1 rounded border border-slate-200 bg-white outline-none focus:border-blue-500 font-bold text-slate-700 text-[10.5px]"
                                  >
                                    {(pageData?.gstRates || [0, 5, 12, 18, 28]).map(rate => (
                                      <option key={rate} value={rate}>{rate}%</option>
                                    ))}
                                  </select>
                                </td>
                                <td className="p-1 border-r border-slate-100">
                                  <input
                                    type="number"
                                    value={item.quantity || ''}
                                    onChange={(e) => handleItemChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                                    className="w-full h-7 px-1 rounded border border-slate-200 text-right focus:border-blue-500 font-bold text-slate-700 text-[10.5px]"
                                  />
                                </td>
                                <td className="p-1 border-r border-slate-100">
                                  <select
                                    value={item.unit || 'Nos'}
                                    onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                                    className="w-full h-7 px-1 rounded border border-slate-200 bg-white outline-none focus:border-blue-500 font-bold text-slate-700 text-[10.5px]"
                                  >
                                    {(pageData?.units || ['Nos', 'Pcs', 'Kg', 'Ltr', 'Box', 'Mtr']).map(u => (
                                      <option key={u} value={u}>{u}</option>
                                    ))}
                                  </select>
                                </td>
                                <td className="p-1 border-r border-slate-100">
                                  <input
                                    type="number"
                                    value={item.rate || ''}
                                    onChange={(e) => handleItemChange(idx, 'rate', parseFloat(e.target.value) || 0)}
                                    className="w-full h-7 px-1.5 rounded border border-slate-200 text-right focus:border-blue-500 font-bold text-slate-700 text-[10.5px]"
                                  />
                                </td>
                                <td className="p-1 border-r border-slate-100">
                                  <input
                                    type="number"
                                    value={item.discount_percent || ''}
                                    onChange={(e) => handleItemChange(idx, 'discount_percent', parseFloat(e.target.value) || 0)}
                                    className="w-full h-7 px-1 rounded border border-slate-200 text-right focus:border-blue-500 font-bold text-slate-700 text-[10.5px]"
                                  />
                                </td>
                                <td className="p-1.5 text-right font-extrabold text-slate-800 text-[10.5px] pr-2.5 border-r border-slate-100">
                                  ₹ {parseFloat(item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="p-1 text-center">
                                  <button
                                    onClick={() => handleItemDelete(idx)}
                                    className="p-1 text-rose-500 hover:bg-rose-50 rounded transition-colors"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={11} className="p-4 text-center text-slate-400 italic">
                                No items added. Click "Add Item Row" to insert an entry.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  {/* Additional Charges & Tax details Sections */}
                  {!['payment', 'receipt', 'contra'].includes(draft.voucher_type?.toLowerCase()) && (
                    <>
                      {/* 1. Additional Charges Grid (Only manually added non-tax ledgers) */}
                      {(() => {
                        const manualCharges = (draft.additional_charges || []).filter(
                          c => !['CGST','SGST','IGST','UTGST','CESS'].some(t => (c.ledger_name || '').toUpperCase().includes(t))
                        );
                        if (manualCharges.length === 0) return null;
                        const manualTotal = manualCharges.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);
                        return (
                          <div className="border-t pt-3 space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400">Additional Charges ({manualCharges.length})</span>
                            </div>
                            <div className="border border-slate-200 rounded overflow-hidden">
                              <table className="w-full text-left border-collapse text-[10px]">
                                <thead>
                                  <tr className="bg-amber-50 border-b border-slate-200 text-[8.5px] uppercase font-extrabold text-slate-500">
                                    <th className="p-1.5 pl-3 border-r border-slate-200 w-8 text-center">#</th>
                                    <th className="p-1.5 border-r border-slate-200">Ledger Name</th>
                                    <th className="p-1.5 text-right w-28 pr-3">Amount (₹)</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                  {manualCharges.map((charge, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50/50">
                                      <td className="p-1.5 border-r border-slate-100 text-center text-slate-400 font-semibold">{idx + 1}</td>
                                      <td className="p-1.5 border-r border-slate-100 font-semibold text-slate-700">{charge.ledger_name}</td>
                                      <td className="p-1.5 text-right font-extrabold text-slate-800 pr-3">
                                        ₹ {parseFloat(charge.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr className="bg-slate-50 border-t border-slate-200">
                                    <td colSpan={2} className="p-1.5 pl-3 text-[9px] font-extrabold uppercase text-slate-500">Total Additional Charges</td>
                                    <td className="p-1.5 pr-3 text-right font-extrabold text-amber-600">
                                      ₹ {manualTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </div>
                        );
                      })()}

                      {/* 2. HSN & Statutory Tax Ledgers Grid */}
                      {(() => {
                        const companyStateCode = pageData?.companyGst?.gstin?.trim().substring(0, 2) || '';
                        const partyStateCode = activePartyDetails?.partyDetails?.gstin?.trim().substring(0, 2) || '';
                        let isInterstate = false;
                        if (companyStateCode && partyStateCode) {
                          isInterstate = companyStateCode !== partyStateCode;
                        } else {
                          const companyState = pageData?.companyGst?.gstState?.trim().toLowerCase() || 'madhya pradesh';
                          const partyState = activePartyDetails?.partyDetails?.gstState?.trim().toLowerCase() || '';
                          if (partyState) {
                            isInterstate = companyState !== partyState;
                          }
                        }

                        return (
                          <div className="grid grid-cols-2 gap-4 border-t pt-3">
                            {/* Left Column: HSN tax Detailes */}
                            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-extrabold text-[11px] uppercase tracking-wider text-slate-500">HSN tax Detailes</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <label className="flex items-center gap-1 cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={true}
                                      readOnly
                                      className="w-3.5 h-3.5 rounded border-slate-300 accent-blue-600"
                                    />
                                    <span className="text-[10px] font-bold text-slate-600">Round Off</span>
                                  </label>
                                  <div className="px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-600 text-[10px] font-bold">
                                    Total Tax: ₹ {((cgst || 0) + (sgst || 0) + (igst || 0)).toFixed(2)}
                                  </div>
                                </div>
                              </div>

                              <div className="border border-slate-200 rounded overflow-hidden">
                                <table className="w-full text-left border-collapse text-[10px]">
                                  <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-[8.5px] uppercase font-extrabold text-slate-400">
                                      <th className="p-1.5 border-r border-slate-200">Hsn no.</th>
                                      <th className="p-1.5 text-right border-r border-slate-200">Taxable Value</th>
                                      <th className="p-1.5 text-right border-r border-slate-200">CGST</th>
                                      <th className="p-1.5 text-right border-r border-slate-200">SGST</th>
                                      <th className="p-1.5 text-right border-r border-slate-200">IGST</th>
                                      <th className="p-1.5 text-right">Cess</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 bg-white">
                                    {(() => {
                                      const hsnMap = {};
                                      (draft.items || []).forEach(item => {
                                        const hsn = (item.hsn || '').trim() || '-';
                                        if (!hsnMap[hsn]) {
                                          hsnMap[hsn] = { hsn, taxableValue: 0, cgst: 0, sgst: 0, igst: 0, cess: 0 };
                                        }
                                        hsnMap[hsn].taxableValue += parseFloat(item.taxableAmount || item.amount || 0);
                                        hsnMap[hsn].cgst += parseFloat(item.cgst || 0);
                                        hsnMap[hsn].sgst += parseFloat(item.sgst || 0);
                                        hsnMap[hsn].igst += parseFloat(item.igst || 0);
                                        hsnMap[hsn].cess += parseFloat(item.cess || 0);
                                      });
                                      const rows = Object.values(hsnMap);
                                      if (rows.length === 0) {
                                        return (
                                          <tr>
                                            <td colSpan={6} className="p-3 text-center text-slate-400 italic">No HSN tax details available</td>
                                          </tr>
                                        );
                                      }
                                      return (
                                        <>
                                          {rows.map((row, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/50">
                                              <td className="p-1.5 border-r border-slate-100 font-medium text-slate-700">{row.hsn}</td>
                                              <td className="p-1.5 border-r border-slate-100 text-right font-semibold">₹ {row.taxableValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                              <td className="p-1.5 border-r border-slate-100 text-right">₹ {row.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                              <td className="p-1.5 border-r border-slate-100 text-right">₹ {row.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                              <td className="p-1.5 border-r border-slate-100 text-right">₹ {row.igst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                              <td className="p-1.5 text-right">₹ {row.cess.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                            </tr>
                                          ))}
                                          <tr className="bg-slate-50 font-bold border-t border-slate-200 text-slate-700">
                                            <td className="p-1.5 border-r border-slate-200">Total</td>
                                            <td className="p-1.5 border-r border-slate-200 text-right">₹ {rows.reduce((s, r) => s + r.taxableValue, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                            <td className="p-1.5 border-r border-slate-200 text-right">₹ {rows.reduce((s, r) => s + r.cgst, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                            <td className="p-1.5 border-r border-slate-200 text-right">₹ {rows.reduce((s, r) => s + r.sgst, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                            <td className="p-1.5 border-r border-slate-200 text-right">₹ {rows.reduce((s, r) => s + r.igst, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                            <td className="p-1.5 text-right">₹ {rows.reduce((s, r) => s + r.cess, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                          </tr>
                                        </>
                                      );
                                    })()}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            {/* Right Column: Tax & Statutory Ledger Details */}
                            <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="font-extrabold text-[11px] uppercase tracking-wider text-slate-500">Tax & Statutory Ledger Details</span>
                                <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[9px] font-extrabold uppercase tracking-wider">Auto Calculated</span>
                              </div>

                              <div className="border border-slate-200 rounded overflow-hidden">
                                <table className="w-full text-left border-collapse text-[10px]">
                                  <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-[8.5px] uppercase font-extrabold text-slate-400">
                                      <th className="p-1.5 border-r border-slate-200 w-1/3">Tax Component</th>
                                      <th className="p-1.5 border-r border-slate-200">Ledger (Select Ledger)</th>
                                      <th className="p-1.5 text-right">Amount (Auto)</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 bg-white">
                                    {!isInterstate && (
                                      <>
                                        <tr className="hover:bg-slate-50/50">
                                          <td className="p-1.5 border-r border-slate-100 font-bold text-slate-700">CGST <span className="text-[8px] px-1 py-0.2 bg-blue-50 text-blue-600 rounded">Intra</span></td>
                                          <td className="p-1 border-r border-slate-100">
                                            <select
                                              value={getLedgerNameForComponent('CGST')}
                                              onChange={(e) => setLedgerNameForComponent('CGST', e.target.value)}
                                              className="w-full h-6 px-1.5 rounded border border-slate-200 bg-white outline-none focus:border-blue-500 font-semibold text-slate-700 text-[10px]"
                                            >
                                              {getLedgerOptions('CGST').map(opt => (
                                                <option key={opt} value={opt}>{opt}</option>
                                              ))}
                                            </select>
                                          </td>
                                          <td className="p-1.5 text-right font-semibold text-slate-700">₹ {cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                        </tr>
                                        <tr className="hover:bg-slate-50/50">
                                          <td className="p-1.5 border-r border-slate-100 font-bold text-slate-700">SGST <span className="text-[8px] px-1 py-0.2 bg-blue-50 text-blue-600 rounded">Intra</span></td>
                                          <td className="p-1 border-r border-slate-100">
                                            <select
                                              value={getLedgerNameForComponent('SGST')}
                                              onChange={(e) => setLedgerNameForComponent('SGST', e.target.value)}
                                              className="w-full h-6 px-1.5 rounded border border-slate-200 bg-white outline-none focus:border-blue-500 font-semibold text-slate-700 text-[10px]"
                                            >
                                              {getLedgerOptions('SGST').map(opt => (
                                                <option key={opt} value={opt}>{opt}</option>
                                              ))}
                                            </select>
                                          </td>
                                          <td className="p-1.5 text-right font-semibold text-slate-700">₹ {sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                        </tr>
                                      </>
                                    )}
                                    {isInterstate && (
                                      <tr className="hover:bg-slate-50/50">
                                        <td className="p-1.5 border-r border-slate-100 font-bold text-slate-700">IGST <span className="text-[8px] px-1 py-0.2 bg-orange-50 text-orange-600 rounded">Inter</span></td>
                                        <td className="p-1 border-r border-slate-100">
                                          <select
                                            value={getLedgerNameForComponent('IGST')}
                                            onChange={(e) => setLedgerNameForComponent('IGST', e.target.value)}
                                            className="w-full h-6 px-1.5 rounded border border-slate-200 bg-white outline-none focus:border-blue-500 font-semibold text-slate-700 text-[10px]"
                                          >
                                            {getLedgerOptions('IGST').map(opt => (
                                              <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                          </select>
                                        </td>
                                        <td className="p-1.5 text-right font-semibold text-slate-700">₹ {igst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                      </tr>
                                    )}
                                    <tr className="hover:bg-slate-50/50">
                                      <td className="p-1.5 border-r border-slate-100 font-bold text-slate-700">CESS (Cess)</td>
                                      <td className="p-1 border-r border-slate-100">
                                        <select
                                          value={getLedgerNameForComponent('CESS') || 'CESS Payable'}
                                          onChange={(e) => setLedgerNameForComponent('CESS', e.target.value)}
                                          className="w-full h-6 px-1.5 rounded border border-slate-200 bg-white outline-none focus:border-blue-500 font-semibold text-slate-700 text-[10px]"
                                        >
                                          {getLedgerOptions('CESS').map(opt => (
                                            <option key={opt} value={opt}>{opt}</option>
                                          ))}
                                        </select>
                                      </td>
                                      <td className="p-1.5 text-right font-semibold text-slate-700">₹ {(draft.cess_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </>
                  )}
                </>
              )}
                {/* Narration */}
                <div className="border-t pt-3 space-y-2">
                  <div className="text-[11px] uppercase font-extrabold tracking-wider text-slate-400">Narration</div>
                  <textarea
                    value={draft.narration || ''}
                    onChange={(e) => handleHeaderChange('narration', e.target.value)}
                    placeholder="Enter transaction narration..."
                    rows={2}
                    className="w-full p-2 rounded-md border border-slate-200 bg-white outline-none focus:border-blue-500 font-medium text-slate-700 text-[11px] resize-none"
                  />
                </div>

              </div>
            </div>

            {/* Column 4: Summaries & Tally Preview */}
            <div className="col-span-1 space-y-3">
              
              {/* Summary Totals */}
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm space-y-2">
                <div className="text-[11px] uppercase font-extrabold tracking-wider text-slate-400 border-b pb-1">Voucher Summary</div>
                {!['payment', 'receipt', 'contra'].includes(draft.voucher_type?.toLowerCase()) && (
                  <div className="space-y-2 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-medium">Taxable Value</span>
                      <span className="font-semibold text-slate-700">₹ {taxableVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    {cgst > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-medium">CGST</span>
                        <span className="font-semibold text-slate-700">₹ {cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {sgst > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-medium">SGST</span>
                        <span className="font-semibold text-slate-700">₹ {sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {igst > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-medium">IGST</span>
                        <span className="font-semibold text-slate-700">₹ {igst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {/* Additional charges rows in summary */}
                    {(draft.additional_charges || []).filter(c => !['CGST','SGST','IGST','UTGST','CESS'].some(t => (c.ledger_name || '').toUpperCase().includes(t))).length > 0 && (
                      <>
                        <div className="border-t border-dashed border-slate-100 pt-1.5 flex justify-between text-[10px] text-slate-400 font-semibold uppercase tracking-wide">
                          <span>Additional Charges</span>
                        </div>
                        {draft.additional_charges
                          .filter(c => !['CGST','SGST','IGST','UTGST','CESS'].some(t => (c.ledger_name || '').toUpperCase().includes(t)))
                          .map((charge, idx) => (
                            <div key={idx} className="flex justify-between">
                              <span className="font-medium flex items-center gap-1 text-slate-500">
                                {charge.ledger_name}
                              </span>
                              <span className="font-semibold text-slate-700">₹ {parseFloat(charge.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                          ))}
                      </>
                    )}
                  </div>
                )}
                
                <div className="pt-1.5 flex justify-between items-center border-t border-dashed border-slate-200">
                  <span className="font-extrabold uppercase text-slate-700 text-[11px]">Grand Total</span>
                  <span className="text-[15px] font-extrabold text-blue-600">
                    ₹ {draft.amount ? parseFloat(draft.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
                  </span>
                </div>
              </div>

              {/* Tally Preview payload */}
              {draftJson && (
                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm space-y-2">
                  <div className="text-[11px] uppercase font-extrabold tracking-wider text-slate-400 border-b pb-1">Tally JSON Payload</div>
                  <div className="bg-slate-900 text-emerald-400 p-2 rounded-lg text-[9px] font-mono h-[180px] overflow-y-auto themed-scrollbar whitespace-pre-wrap select-all">
                    {JSON.stringify(draftJson, null, 2)}
                  </div>
                </div>
              )}

            </div>

          </div>
        </main>

      </div>
    );
  }

  // ========================================================================
  // RENDER OPTION B: STANDARD CHAT & CONTEXT SIDEBAR LAYOUT
  // ========================================================================
  return (
    <div className="flex h-full w-full overflow-hidden bg-slate-50 text-slate-800 font-sans">
      
      {/* LEFT PANEL: CONVERSATION HISTORY & SIDEBAR */}
      <aside className="w-72 border-r flex flex-col shrink-0 bg-white border-slate-200">
        <div className="p-4 border-b border-slate-200 flex flex-col gap-3 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Voucher Chats</span>
            <button 
              onClick={handleNewChat}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-[11px] font-bold hover:bg-blue-700 transition-all shadow-sm"
            >
              <Plus size={12} />
              <span>New Chat</span>
            </button>
          </div>
          
            <div className="flex bg-slate-100 p-0.5 rounded-lg text-[10.5px] font-bold border border-slate-200 shrink-0">
              <button 
                onClick={() => setStatusFilter('All')} 
                className={`flex-1 py-1 rounded text-center transition-all ${statusFilter === 'All' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                All
              </button>
              <button 
                onClick={() => setStatusFilter('Draft')} 
                className={`flex-1 py-1 rounded text-center transition-all ${statusFilter === 'Draft' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Draft
              </button>
              <button 
                onClick={() => setStatusFilter('Approved')} 
                className={`flex-1 py-1 rounded text-center transition-all ${statusFilter === 'Approved' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Approved
              </button>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1.5 themed-scrollbar">
          {displayedConversations.length === 0 ? (
            <div className="p-6 text-center text-[11px] text-slate-400">
              No matching chats.
            </div>
          ) : (
            displayedConversations.map((conv) => {
              const isActive = conv.id === activeConvId;
              return (
                <div
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all flex flex-col gap-1 ${
                    isActive 
                      ? 'bg-blue-50/70 border-blue-400 shadow-sm' 
                      : 'bg-white border-slate-200 hover:bg-slate-50/60'
                  }`}
                >
                  <div className="flex justify-between items-start gap-1">
                    <span className="text-[11.5px] font-extrabold text-slate-700 truncate max-w-[140px]">{conv.title}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[9px] text-slate-400">{conv.date}</span>
                      <button 
                        onClick={(e) => handleDeleteConversation(conv.id, e)}
                        className="text-slate-400 hover:text-rose-500 p-0.5 rounded transition-all"
                        title="Delete chat"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="text-[10px] text-slate-400 truncate font-medium">{conv.preview}</div>

                  <div className="flex gap-1.5 mt-1 items-center">
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                      conv.voucherType?.includes('Sales') ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'
                    }`}>
                      {conv.voucherType || 'Voucher'}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                      conv.status === 'Draft' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                    }`}>
                      {conv.status || 'Draft'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {pageData && (
          <div className="p-3 border-t bg-slate-50/50 border-slate-200 grid grid-cols-3 gap-2 text-center text-[9px] shrink-0 font-bold text-slate-500">
            <div>
              <div className="text-slate-800 text-[11px] font-extrabold">{pageData.partyCount}</div>
              Parties
            </div>
            <div>
              <div className="text-slate-800 text-[11px] font-extrabold">{pageData.itemCount}</div>
              Items
            </div>
            <div>
              <div className="text-slate-800 text-[11px] font-extrabold">{pageData.ledgerCount}</div>
              Ledgers
            </div>
          </div>
        )}

        <div className="p-3 border-t border-slate-200 shrink-0">
          <button 
            onClick={handleResetSession}
            className="w-full py-1.5 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-500 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5"
          >
            <RotateCcw size={12} />
            <span>Reset Active Chat</span>
          </button>
        </div>
      </aside>

      {/* CENTER PANEL: CHAT WORKSPACE */}
      {activeConvId ? (
        <section className="flex-1 flex flex-col min-w-0 bg-slate-50 relative">
          
          <header className="px-4 py-3 bg-white border-b border-slate-200 flex justify-between items-center shrink-0 shadow-sm">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-extrabold text-slate-800">Anjalee Assistant</span>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] font-semibold text-emerald-600 uppercase tracking-wide">Online</span>
              </div>
              <p className="text-[9.5px] text-slate-400 font-medium">
                {pageData?.companyName || 'Friends Grafix Pvt Ltd'} • {pageData?.financialYear || 'FY 2024-25'}
              </p>
            </div>
            
            {/* Show worksheet button if a draft is available */}
            {draft && (
              <button
                onClick={() => setIsReviewMode(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 text-[10.5px] font-bold transition-all shadow-sm"
              >
                <Eye size={12} />
                <span>Review Worksheet</span>
              </button>
            )}
          </header>

          <div className="bg-white border-b border-slate-200 px-4 py-2 shrink-0 flex items-center gap-2 overflow-x-auto no-scrollbar">
            <span className="text-[9px] uppercase font-extrabold text-slate-400 shrink-0">Draft Progress:</span>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
              <span className={draftStep >= 1 ? 'text-blue-600' : ''}>1. Intent</span>
              <span className="text-slate-300">→</span>
              <span className={draftStep >= 2 ? 'text-blue-600' : ''}>2. Party</span>
              <span className="text-slate-300">→</span>
              <span className={draftStep >= 3 ? 'text-blue-600' : ''}>3. Items</span>
              <span className="text-slate-300">→</span>
              <span className={draftStep >= 4 ? 'text-blue-600' : ''}>4. Validation</span>
              <span className="text-slate-300">→</span>
              <span className={draftStep >= 5 ? 'text-emerald-600' : ''}>5. Ready</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 themed-scrollbar">
            {loadingChat ? (
              <div className="flex h-full w-full items-center justify-center">
                <Loader2 size={24} className="animate-spin text-slate-400" />
              </div>
            ) : (
              messages.map((msg, idx) => {
                const isUser = msg.role === 'user';
                if (isUser) {
                  return (
                    <div key={idx} className="flex gap-2.5 max-w-[80%] ml-auto flex-row-reverse items-start">
                      <div className="h-7 w-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 text-[10px] font-bold">
                        U
                      </div>
                      <div className="flex flex-col items-end">
                        <div className="px-3.5 py-2 rounded-2xl bg-blue-600 text-white text-[11px] font-medium leading-normal shadow-sm">
                          {msg.content}
                        </div>
                        <span className="text-[8.5px] text-slate-400 mt-1 mr-1">{msg.timestamp || 'Just now'}</span>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={idx} className="flex gap-2.5 max-w-[80%] items-start">
                    <div className="h-7 w-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                      <Bot size={13} />
                    </div>
                    <div className="flex flex-col items-start">
                      <div className="px-3.5 py-2 rounded-2xl bg-white border border-slate-200 text-[11px] leading-relaxed text-slate-700 shadow-sm font-medium whitespace-pre-line text-left">
                        {msg.content}
                      </div>
                      <span className="text-[8.5px] text-slate-400 mt-1 ml-1">{msg.timestamp || 'Just now'}</span>
                    </div>
                  </div>
                );
              })
            )}

            {isThinking && (
              <div className="flex items-center gap-2 pl-9 text-[10px] text-slate-400 font-bold">
                <Loader2 size={12} className="animate-spin text-blue-500" />
                <span>Processing instruction...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 bg-white border-t border-slate-200 shrink-0">
            {pageData?.quickSuggestions && (
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-2.5">
                {pageData.quickSuggestions.map((suggest, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSuggestionClick(suggest)}
                    className="px-2.5 py-1 rounded-md border border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-all shrink-0 max-w-[280px] truncate"
                  >
                    {suggest}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={handleSendMessage} className="flex items-center border border-slate-300 rounded-xl p-1 bg-slate-50 focus-within:border-blue-500 focus-within:bg-white transition-all shadow-sm">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Describe transaction (e.g. Sales invoice for ABC 5 laptops)..."
                className="flex-1 h-8 outline-none border-none bg-transparent px-3 text-[11px] font-medium text-slate-800 placeholder-slate-400"
              />
              <button 
                type="button" 
                onClick={() => toast.info("Voice Input activated (UI only)")} 
                className="p-2 text-slate-400 hover:text-blue-600"
              >
                <Mic size={14} />
              </button>
              <button 
                type="submit" 
                disabled={!inputText.trim() || isThinking}
                className="h-8 px-4 rounded-lg bg-blue-600 text-white text-[11px] font-bold hover:bg-blue-700 disabled:opacity-40 transition-colors flex items-center gap-1.5"
              >
                <span>Send</span>
                <Send size={11} />
              </button>
            </form>
          </div>

        </section>
      ) : (
        <section className="flex-1 flex items-center justify-center bg-slate-50 text-slate-400 text-[12px] font-bold">
          Click "New Chat" or select a conversation history to begin.
        </section>
      )}

      {/* RIGHT PANEL: EDITABLE MANUAL ENTRY VOUCHER FORM SIDEBAR */}
      {draft ? (
        <aside className="w-80 border-l flex flex-col shrink-0 bg-white border-slate-200 relative h-full overflow-hidden">
          
          <div className="p-4 border-b border-slate-200 flex items-center justify-between shrink-0">
            <span className="font-extrabold text-[12px] uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <FileText size={14} className="text-blue-600" />
              Voucher Summary Form
            </span>
            <span className="px-2 py-0.5 text-[8.5px] font-bold rounded bg-amber-50 border border-amber-200 text-amber-600 uppercase">
              {draft.status || 'Draft'}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 themed-scrollbar pb-28 text-[11px]">
            
            {/* Header Details */}
            <div className="space-y-3 pb-3 border-b border-slate-100">
              <div className="text-[9px] uppercase font-extrabold tracking-wider text-slate-400">Header details</div>
              
              <div>
                <label className="text-slate-400 block text-[9.5px] mb-1 font-semibold">Voucher Type</label>
                <select
                  value={draft.voucher_type}
                  onChange={(e) => handleHeaderChange('voucher_type', e.target.value)}
                  className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white outline-none focus:border-blue-500 font-semibold text-slate-700"
                >
                  {(pageData?.availableVoucherTypes || pageData?.voucherTypes || ["Sales", "Purchase", "Debit Note", "Credit Note", "Payment", "Receipt", "Contra"]).map(vt => {
                    const value = vt.replace(/\s+Voucher$/i, '').replace(/\s+Bill$/i, '');
                    return (
                      <option key={vt} value={value}>{vt.endsWith('Voucher') || vt.endsWith('Bill') || vt.toLowerCase() === 'contra' ? vt : `${value} Voucher`}</option>
                    );
                  })}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block text-[9.5px] mb-1 font-semibold">Voucher Date</label>
                  <input
                    type="date"
                    value={draft.date}
                    onChange={(e) => handleHeaderChange('date', e.target.value)}
                    className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white outline-none focus:border-blue-500 font-semibold text-slate-700 text-center"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block text-[9.5px] mb-1 font-semibold">Voucher Number</label>
                  <input
                    type="text"
                    value={draft.voucher_number || ''}
                    onChange={(e) => handleHeaderChange('voucher_number', e.target.value)}
                    placeholder="Auto Generated"
                    className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white outline-none focus:border-blue-500 font-semibold text-slate-700 text-center"
                  />
                </div>
              </div>
            </div>

            {draft.voucher_type?.toLowerCase() === 'contra' ? (
              /* Contra Voucher Sidebar View */
              <>
                {/* DR SOURCE ACCOUNT */}
                <div className="space-y-3 pb-3 border-b border-slate-100">
                  <div className="text-[10px] uppercase font-extrabold tracking-wider text-emerald-600 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span>(DR) SOURCE ACCOUNT</span>
                  </div>
                  <div>
                    <label className="text-slate-400 block text-[9.5px] mb-1 font-semibold">Ledger Name *</label>
                    <select
                      value={draft.debit || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        const updated = { ...draft, debit: val };
                        setDraft(updated);
                        aiApi.updateDraft(activeConvId, updated).then(res => {
                          setDraft(res.draft);
                          setDraftJson(res.draft_json);
                        });
                      }}
                      className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white outline-none focus:border-blue-500 font-semibold text-slate-700 text-[10.5px]"
                    >
                      <option value="" disabled>-- Select Cash/Bank --</option>
                      {(pageData?.allBanks || []).map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 block text-[9.5px] mb-1 font-semibold">Account Type</label>
                    <div className="w-full h-8 px-2 rounded-lg border border-slate-100 bg-slate-100/50 flex items-center font-bold text-slate-500 text-[10.5px]">
                      {draft.debit && draft.debit.toLowerCase().includes('cash') ? 'Cash' : 'Bank'}
                    </div>
                  </div>
                  <div>
                    <label className="text-slate-400 block text-[9.5px] mb-1 font-semibold">Amount (₹) *</label>
                    <input
                      type="number"
                      value={draft.amount || ''}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        const updated = { ...draft, amount: val };
                        if (updated.items && updated.items.length > 0) {
                          updated.items = updated.items.map(item => ({ ...item, amount: val, rate: val }));
                        }
                        setDraft(updated);
                        aiApi.updateDraft(activeConvId, updated).then(res => {
                          setDraft(res.draft);
                          setDraftJson(res.draft_json);
                        });
                      }}
                      placeholder="Enter amount"
                      className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white outline-none focus:border-blue-500 font-bold text-slate-700 text-[10.5px]"
                    />
                  </div>
                </div>

                {/* CR DESTINATION ACCOUNT */}
                <div className="space-y-3 pb-3 border-b border-slate-100">
                  <div className="text-[10px] uppercase font-extrabold tracking-wider text-blue-600 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                    <span>(CR) DESTINATION ACCOUNT</span>
                  </div>
                  <div>
                    <label className="text-slate-400 block text-[9.5px] mb-1 font-semibold">Ledger Name *</label>
                    <select
                      value={draft.credit || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        const updated = { ...draft, credit: val };
                        setDraft(updated);
                        aiApi.updateDraft(activeConvId, updated).then(res => {
                          setDraft(res.draft);
                          setDraftJson(res.draft_json);
                        });
                      }}
                      className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white outline-none focus:border-blue-500 font-semibold text-slate-700 text-[10.5px]"
                    >
                      <option value="" disabled>-- Select Cash/Bank --</option>
                      {(pageData?.allBanks || []).map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 block text-[9.5px] mb-1 font-semibold">Account Type</label>
                    <div className="w-full h-8 px-2 rounded-lg border border-slate-100 bg-slate-100/50 flex items-center font-bold text-slate-500 text-[10.5px]">
                      {draft.credit && draft.credit.toLowerCase().includes('cash') ? 'Cash' : 'Bank'}
                    </div>
                  </div>
                  <div>
                    <label className="text-slate-400 block text-[9.5px] mb-1 font-semibold">Amount (₹) *</label>
                    <input
                      type="number"
                      value={draft.amount || ''}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        const updated = { ...draft, amount: val };
                        if (updated.items && updated.items.length > 0) {
                          updated.items = updated.items.map(item => ({ ...item, amount: val, rate: val }));
                        }
                        setDraft(updated);
                        aiApi.updateDraft(activeConvId, updated).then(res => {
                          setDraft(res.draft);
                          setDraftJson(res.draft_json);
                        });
                      }}
                      placeholder="Enter amount"
                      className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white outline-none focus:border-blue-500 font-bold text-slate-700 text-[10.5px]"
                    />
                  </div>
                </div>

                {/* Validation Badges */}
                <div className="space-y-1.5 pt-2 pb-3 border-b border-slate-100">
                  {draft.debit && draft.credit && draft.debit === draft.credit && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-600 rounded-lg p-2 text-[10px] font-semibold flex items-center gap-1.5">
                      <AlertCircle size={12} className="text-rose-500 shrink-0" />
                      <span>DR & CR cannot be the same ledger.</span>
                    </div>
                  )}
                  {(!draft.amount || draft.amount <= 0) && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-600 rounded-lg p-2 text-[10px] font-semibold flex items-center gap-1.5">
                      <AlertCircle size={12} className="text-rose-500 shrink-0" />
                      <span>Amount must be  0.</span>
                    </div>
                  )}
                  {draft.debit && draft.credit && draft.debit !== draft.credit && draft.amount > 0 && (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-lg p-2 text-[10px] font-semibold flex items-center gap-1.5">
                      <Check size={12} className="text-emerald-500 shrink-0" />
                      <span>Balanced</span>
                    </div>
                  )}
                </div>
              </>
            ) : ['payment', 'receipt'].includes(draft.voucher_type?.toLowerCase()) ? (
              /* Accounting Voucher (Payment, Receipt) Sidebar View */
              <>
                {/* Payment/Receipt/Contra Account details */}
                <div className="space-y-3 pb-3 border-b border-slate-100">
                  <div className="text-[9px] uppercase font-extrabold tracking-wider text-slate-400">Payment Accounts</div>
                  
                  <div>
                    <label className="text-slate-400 block text-[9.5px] mb-1 font-semibold">Payment Mode</label>
                    <select
                      value={
                        draft.voucher_type?.toLowerCase() === 'payment'
                          ? (draft.credit && draft.credit.toLowerCase().includes('cash') ? 'Cash' : 'Bank')
                          : (draft.debit && draft.debit.toLowerCase().includes('cash') ? 'Cash' : 'Bank')
                      }
                      onChange={() => {}}
                      className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-slate-50 outline-none font-semibold text-slate-500 cursor-not-allowed text-[10.5px]"
                      disabled
                    >
                      <option value="Cash">Cash</option>
                      <option value="Bank">Bank</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-400 block text-[9.5px] mb-1 font-semibold">
                      {draft.voucher_type?.toLowerCase() === 'receipt' ? 'Receipt Account' : 'Payment Account'} *
                    </label>
                    <select
                      value={
                        draft.voucher_type?.toLowerCase() === 'payment'
                          ? (draft.credit || '')
                          : (draft.debit || '')
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        let updated;
                        if (draft.voucher_type?.toLowerCase() === 'payment') {
                          updated = { ...draft, credit: val };
                        } else {
                          updated = { ...draft, debit: val };
                        }
                        setDraft(updated);
                        aiApi.updateDraft(activeConvId, updated).then(res => {
                          setDraft(res.draft);
                          setDraftJson(res.draft_json);
                        });
                      }}
                      className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white outline-none focus:border-blue-500 font-semibold text-slate-700 text-[10.5px]"
                    >
                      <option value="" disabled>-- Select Cash/Bank Account --</option>
                      {(pageData?.allBanks || []).map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-400 block text-[9.5px] mb-1 font-semibold">Account Balance</label>
                    <div className="w-full h-8 px-2 rounded-lg border border-slate-100 bg-slate-50/50 flex items-center font-bold text-slate-600 text-[10.5px]">
                      {(() => {
                        const key = draft.voucher_type?.toLowerCase() === 'payment' ? draft.credit : draft.debit;
                        const balData = pendingBillsMap[key];
                        return balData 
                          ? `₹ ${parseFloat(balData.outstandingBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} ${balData.outstandingType || ''}` 
                          : '₹ 0.00';
                      })()}
                    </div>
                  </div>
                </div>

                {/* TRANSACTION DETAILS List */}
                <div className="space-y-3 pb-3 border-b border-slate-100">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] uppercase font-extrabold tracking-wider text-slate-400">Transaction Details</span>
                    <button
                      onClick={handleItemAdd}
                      className="flex items-center gap-0.5 px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-600 text-[9.5px] font-bold hover:bg-blue-100 transition-colors"
                    >
                      <Plus size={10} />
                      <span>Add Row</span>
                    </button>
                  </div>

                  <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1 themed-scrollbar">
                    {draft.items && draft.items.length > 0 ? (
                      draft.items.map((item, idx) => {
                        const billsData = pendingBillsMap[item.item_name];
                        const outstandingText = billsData 
                          ? `₹ ${Math.abs(billsData.outstandingBalance).toLocaleString('en-IN')} ${billsData.outstandingBalance >= 0 ? 'Dr' : 'Cr'}` 
                          : '₹ 0.00';
                        return (
                          <div key={idx} className="bg-slate-50 p-2 rounded border border-slate-200 space-y-2 relative font-sans">
                            <div className="flex justify-between items-center gap-1">
                              <select
                                value={item.item_name}
                                onChange={(e) => handleItemChange(idx, 'item_name', e.target.value)}
                                className="flex-1 h-7 px-1.5 rounded border border-slate-200 bg-white text-[10px] font-bold outline-none text-slate-700 focus:border-blue-500"
                              >
                                <option value="" disabled>-- Select Ledger --</option>
                                {item.item_name && !(pageData?.allLedgers || []).includes(item.item_name) && (
                                  <option value={item.item_name}>{item.item_name}</option>
                                )}
                                {(pageData?.allLedgers || []).map((name) => (
                                  <option key={name} value={name}>{name}</option>
                                ))}
                              </select>
                              <button
                                onClick={() => handleItemDelete(idx)}
                                className="p-1 text-rose-500 hover:bg-rose-50 rounded transition-colors"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                            <input
                              type="text"
                              value={item.description || ''}
                              onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                              placeholder="Description"
                              className="w-full h-6 px-1.5 rounded border border-slate-200 outline-none text-[9.5px] bg-white"
                            />
                            <div className="grid grid-cols-2 gap-2 text-[10px]">
                              <div>
                                <label className="text-slate-400 block text-[7.5px] mb-0.5 font-semibold">Amount (₹)</label>
                                <input
                                  type="number"
                                  value={item.amount || ''}
                                  onChange={(e) => handleItemChange(idx, 'amount', parseFloat(e.target.value) || 0)}
                                  placeholder="0.00"
                                  className="w-full h-7 px-2 rounded border border-slate-200 bg-white outline-none focus:border-blue-500 font-bold text-slate-700"
                                />
                              </div>
                              <div className="flex flex-col justify-end text-right">
                                <span className="text-slate-400 text-[7px] font-semibold uppercase">Outstanding</span>
                                <span className="font-bold text-slate-600 text-[9.5px] truncate">{outstandingText}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-[10px] text-slate-400 italic text-center py-4 bg-slate-50 border border-dashed rounded-lg">
                        No transaction rows added. Click "Add Row" above.
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              /* Invoice Voucher Sidebar Fields (Sales, Purchase, etc.) */
              <>
                {/* Party Selection */}
                <div className="space-y-3 pb-3 border-b border-slate-100">
                  <div className="text-[9px] uppercase font-extrabold tracking-wider text-slate-400">Party Account</div>
                  
                  <div>
                    <label className="text-slate-400 block text-[9.5px] mb-1 font-semibold">Select Customer/Supplier</label>
                    <select
                      value={draft.party || ''}
                      onChange={(e) => handlePartyChange(e.target.value)}
                      className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white outline-none focus:border-blue-500 font-semibold text-slate-700"
                    >
                      <option value="" disabled>-- Choose Party --</option>
                      {pageData?.allParties?.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>

                  {draft.party && (
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/60 grid grid-cols-2 gap-y-1.5 text-[10.5px]">
                      <span className="text-slate-400 font-medium">GSTIN:</span>
                      <span className="font-bold text-slate-700 text-right">{activePartyDetails?.partyDetails?.gstin || 'N/A'}</span>
                      
                      <span className="text-slate-400 font-medium">Supply State:</span>
                      <span className="font-bold text-slate-700 text-right">{activePartyDetails?.partyDetails?.gstState || 'N/A'}</span>
                      
                      <span className="text-slate-400 font-medium">Outstanding:</span>
                      <span className="font-extrabold text-rose-500 text-right">
                        {activePartyDetails?.openingBalance ? `₹ ${parseFloat(activePartyDetails.openingBalance).toLocaleString('en-IN')}` : '₹ 0.00'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Items */}
                <div className="space-y-3 pb-3 border-b border-slate-100">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] uppercase font-extrabold tracking-wider text-slate-400">Items ({draft.items?.length || 0})</span>
                    <button
                      onClick={handleItemAdd}
                      className="flex items-center gap-0.5 px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-600 text-[9.5px] font-bold hover:bg-blue-100 transition-colors"
                    >
                      <Plus size={10} />
                      <span>Add Item</span>
                    </button>
                  </div>

                  <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1 themed-scrollbar">
                    {draft.items && draft.items.length > 0 ? (
                      draft.items.map((item, idx) => (
                        <div key={idx} className="bg-slate-50 p-2 rounded border border-slate-200 space-y-1.5 relative">
                          <div className="flex justify-between items-center gap-1">
                            <select
                              value={item.item_name}
                              onChange={(e) => {
                                const val = e.target.value;
                                const details = stockItemDetails[val] || {};
                                handleItemChange(idx, {
                                  item_name: val,
                                  hsn: details.hsnCode || '',
                                  gst_rate: details.gstRate !== undefined ? details.gstRate : 18.0,
                                  unit: details.unit || 'Nos',
                                  rate: details.rate || item.rate
                                });
                              }}
                              className="flex-1 h-7 px-1.5 rounded border border-slate-200 bg-white text-[10px] font-bold outline-none text-slate-700 focus:border-blue-500"
                            >
                              {pageData?.allItems?.map((name) => (
                                <option key={name} value={name}>{name}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleItemDelete(idx)}
                              className="p-1 text-rose-500 hover:bg-rose-50 rounded transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                          <input
                            type="text"
                            value={item.description || ''}
                            onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                            placeholder="Description"
                            className="w-full h-6 px-1.5 rounded border border-slate-200 outline-none text-[9.5px] bg-white"
                          />
                          <div className="grid grid-cols-4 gap-1 text-[8.5px]">
                            <div>
                              <label className="text-slate-400 block text-[7.5px] mb-0.5 font-semibold">HSN/SAC</label>
                              <input
                                type="text"
                                value={item.hsn || ''}
                                onChange={(e) => handleItemChange(idx, 'hsn', e.target.value)}
                                className="w-full h-6 px-1 rounded border border-slate-200 bg-white outline-none text-center font-bold"
                              />
                            </div>
                            <div>
                              <label className="text-slate-400 block text-[7.5px] mb-0.5 font-semibold">GST%</label>
                               <select
                                value={item.gst_rate || 0}
                                onChange={(e) => handleItemChange(idx, 'gst_rate', parseFloat(e.target.value) || 0)}
                                className="w-full h-6 px-1 rounded border border-slate-200 bg-white outline-none font-bold"
                              >
                                {(pageData?.gstRates || [0, 5, 12, 18, 28]).map(rate => (
                                  <option key={rate} value={rate}>{rate}%</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-slate-400 block text-[7.5px] mb-0.5 font-semibold">Unit</label>
                              <select
                                value={item.unit || 'Nos'}
                                onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                                className="w-full h-6 px-1 rounded border border-slate-200 bg-white outline-none font-bold"
                              >
                                {(pageData?.units || ['Nos', 'Pcs', 'Kg', 'Ltr', 'Box', 'Mtr']).map(u => (
                                  <option key={u} value={u}>{u}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-slate-400 block text-[7.5px] mb-0.5 font-semibold text-right">Stock Qty</label>
                              <div className="h-6 flex items-center justify-end font-bold text-slate-500">
                                {(() => {
                                  if (item.item_name && stockItemDetails[item.item_name]) {
                                    return (stockItemDetails[item.item_name].qty ?? 0).toLocaleString('en-IN');
                                  }
                                  return '-';
                                })()}
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-4 gap-1 text-[8.5px]">
                            <div>
                              <label className="text-slate-400 block text-[7.5px] mb-0.5 font-semibold">Qty</label>
                              <input
                                type="number"
                                value={item.quantity || ''}
                                onChange={(e) => handleItemChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                                className="w-full h-6 px-1 rounded border border-slate-200 bg-white outline-none text-center font-bold"
                              />
                            </div>
                            <div>
                              <label className="text-slate-400 block text-[7.5px] mb-0.5 font-semibold">Rate</label>
                              <input
                                type="number"
                                value={item.rate || ''}
                                onChange={(e) => handleItemChange(idx, 'rate', parseFloat(e.target.value) || 0)}
                                className="w-full h-6 px-1 rounded border border-slate-200 bg-white outline-none text-center font-bold"
                              />
                            </div>
                            <div>
                              <label className="text-slate-400 block text-[7.5px] mb-0.5 font-semibold">Disc%</label>
                              <input
                                type="number"
                                value={item.discount_percent || ''}
                                onChange={(e) => handleItemChange(idx, 'discount_percent', parseFloat(e.target.value) || 0)}
                                className="w-full h-6 px-1 rounded border border-slate-200 bg-white outline-none text-center font-bold"
                              />
                            </div>
                            <div>
                              <label className="text-slate-400 block text-[7.5px] mb-0.5 text-right font-medium">Amount</label>
                              <div className="h-6 flex items-center justify-end font-extrabold text-slate-800">
                                ₹{parseFloat(item.amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-[10px] text-slate-400 italic text-center py-4 bg-slate-50 border border-dashed rounded-lg">
                        No items added. Click "Add Item" above.
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Narration */}
            <div className="space-y-2 pb-3 border-b border-slate-100">
              <div className="text-[9px] uppercase font-extrabold tracking-wider text-slate-400">Narration</div>
              <textarea
                value={draft.narration || ''}
                onChange={(e) => handleHeaderChange('narration', e.target.value)}
                placeholder="Enter transaction narration..."
                rows={2}
                className="w-full p-2 rounded-lg border border-slate-200 bg-white outline-none focus:border-blue-500 font-medium text-slate-700 text-[10.5px] resize-none"
              />
            </div>

            {/* Tax & Summary */}
            <div className="space-y-2.5 pb-2">
              <div className="text-[9px] uppercase font-extrabold tracking-wider text-slate-400">Summary</div>
              <div className="space-y-1 text-[10.5px]">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Taxable Value</span>
                  <span className="font-semibold text-slate-700">₹ {taxableVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                {cgst > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-medium">CGST</span>
                    <span className="font-semibold text-slate-700">₹ {cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {sgst > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-medium">SGST</span>
                    <span className="font-semibold text-slate-700">₹ {sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {igst > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-medium">IGST</span>
                    <span className="font-semibold text-slate-700">₹ {igst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
              </div>
              
              <div className="pt-2 flex justify-between items-center border-t border-dashed border-slate-200">
                <span className="font-extrabold uppercase text-slate-700 text-[10.5px]">Grand Total</span>
                <span className="text-[16px] font-extrabold text-blue-600">
                  ₹ {draft.amount ? parseFloat(draft.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
                </span>
              </div>
            </div>

            {/* Badges */}
            {badges.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="flex flex-wrap gap-1">
                  {badges.map((badge, idx) => (
                    <span 
                      key={idx} 
                      className="px-2 py-0.5 rounded text-[8.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"
                    >
                      ✓ {badge}
                    </span>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Sticky Actions */}
          <div className="absolute bottom-0 left-0 right-0 p-3 bg-white border-t border-slate-200 flex flex-col gap-1.5 shadow-[0_-3px_8px_rgba(0,0,0,0.03)] shrink-0">
            <div className="flex gap-2">
              <button 
                onClick={handleSaveDraft}
                className="flex-1 h-7.5 rounded-lg border border-emerald-300 text-emerald-600 text-[10.5px] font-bold hover:bg-emerald-50 transition-colors flex items-center justify-center gap-1"
              >
                <Save size={11} />
                Save Draft
              </button>
              <button 
                onClick={handleApprove}
                className="flex-1 h-7.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[10.5px] font-bold transition-all shadow-sm flex items-center justify-center gap-1"
              >
                <Check size={11} strokeWidth={3} />
                Approve
              </button>
            </div>
            <button 
              onClick={handlePostTally}
              className="w-full h-7.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[10.5px] font-extrabold transition-all"
            >
              Post to Tally ERP
            </button>
          </div>

        </aside>
      ) : (
        <aside className="w-80 border-l flex flex-col shrink-0 bg-white border-slate-200 items-center justify-center p-6 text-center text-slate-400 text-[11px]">
          Describe transaction details in the chat to populate voucher details.
        </aside>
      )}

    </div>
  );
};

export default TextToEntry;
