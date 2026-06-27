


import React, { useState, useRef, useEffect, createContext, useContext } from 'react';
import {
  Plus, Minus, X, Settings, ChevronDown, Search,
  Calendar, Save, Send, Layout, Hash, Trash2, Eye,
  Landmark, Wallet, ArrowRightLeft, ArrowRight,
  FileText, BookText, RefreshCw, CheckCircle2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useFundFlowStore } from '../../stores/useFundFlowStore';
import { useAppStore } from '../../stores/useAppStore';
import fundflowApi from '../../services/fundflowApi';

const ThemeContext = createContext(null);

const typeToDisplay = {
  cash_payment: 'Payment',
  bank_payment: 'Receipt',
  contra: 'Contra'
};

const displayToType = {
  Payment: 'cash_payment',
  Receipt: 'bank_payment',
  Contra: 'contra'
};

const CreateFundFlow = ({ isDark, onBack, voucherType = 'cash_payment', onSaveSuccess }) => {
  const {
    form,
    loading,
    setFormValue,
    resetForm,
    saveDraft,
    pushToReview,
    masterData,
    fetchMasterData,
    selectedPartyDetails,
    fetchPartyDetails,
    fetchCashBankBalance,
    fetchNextVoucherNumber
  } = useFundFlowStore();

  const getNormalizedType = (val) => {
    if (!val) return '';
    const found = (masterData?.voucherTypesFull || []).find(v => v.name === val);
    if (found) {
      const parent = found.parent;
      if (parent === 'Sales') return 'sales_invoice';
      if (parent === 'Sales Order') return 'sales_order';
      if (parent === 'Credit Note') return 'credit_note';
      if (parent === 'Purchase') return 'purchase_invoice';
      if (parent === 'Purchase Order') return 'purchase_order';
      if (parent === 'Debit Note') return 'debit_note';
      if (parent === 'Payment') return 'cash_payment';
      if (parent === 'Receipt') return 'bank_payment';
      if (parent === 'Contra') return 'contra';
    }
    const lower = val.toLowerCase();
    if (lower === 'sales' || lower.includes('sales_invoice') || lower.includes('sales invoice')) return 'sales_invoice';
    if (lower.includes('sales_order') || lower.includes('sales order') || lower === 'deliv') return 'sales_order';
    if (lower.includes('credit_note') || lower.includes('credit note')) return 'credit_note';
    if (lower === 'purchase' || lower.includes('purchase_invoice') || lower.includes('purchase invoice')) return 'purchase_invoice';
    if (lower.includes('purchase_order') || lower.includes('purchase order')) return 'purchase_order';
    if (lower.includes('debit_note') || lower.includes('debit note')) return 'debit_note';
    if (lower === 'payment' || lower.includes('cash_payment') || lower.includes('cash payment')) return 'cash_payment';
    if (lower === 'receipt' || lower.includes('bank_payment') || lower.includes('bank payment')) return 'bank_payment';
    if (lower === 'contra') return 'contra';
    return val;
  };

  const getVoucherTypeOptions = () => {
    const norm = getNormalizedType(form.voucherType || voucherType);
    let parent = 'Payment';
    if (norm === 'bank_payment') parent = 'Receipt';
    else if (norm === 'contra') parent = 'Contra';

    const dynamicVoucherTypes = (masterData?.voucherTypesFull || [])
      .filter(vt => vt.parent === parent)
      .map(vt => vt.name);

    return dynamicVoucherTypes.length > 0 ? dynamicVoucherTypes : [parent];
  };

  const getSelectValue = () => {
    const val = form.voucherType || voucherType;
    const options = getVoucherTypeOptions();
    if (options.includes(val)) return val;
    const norm = getNormalizedType(val);
    if (norm === 'cash_payment') {
      const match = options.find(opt => opt === 'Payment' || opt === 'Payment Voucher');
      if (match) return match;
    }
    if (norm === 'bank_payment') {
      const match = options.find(opt => opt === 'Receipt' || opt === 'Receipt Voucher');
      if (match) return match;
    }
    if (norm === 'contra') {
      const match = options.find(opt => opt === 'Contra');
      if (match) return match;
    }
    return val;
  };

  const navigate = useNavigate();
  const activeType = getNormalizedType(form.voucherType || voucherType);
  const isPaymentOrReceipt = activeType === 'cash_payment' || activeType === 'bank_payment';

  const handleCancel = () => {
    if (onBack) {
      onBack(activeType);
    }
  };

  const appCompanies = useAppStore(s => s.companies) || [];
  const selectedCompany = useAppStore(s => s.selectedCompany) || '';

  // Fetch master data on mount
  useEffect(() => {
    fetchMasterData();
  }, [fetchMasterData]);

  // Sync voucherType on mount
  useEffect(() => {
    if (!form._id) {
      resetForm(voucherType);
    }
  }, [voucherType, resetForm, form._id]);

  // Auto-fill Voucher Number series-wise on new entry only
  useEffect(() => {
    if (!form._id) {
      fetchNextVoucherNumber(activeType);
    }
  }, [activeType, form._id, fetchNextVoucherNumber]);

  // Default company selection from AppStore on mount
  useEffect(() => {
    if (!form.company && selectedCompany) {
      setFormValue('company', selectedCompany);
    }
  }, [selectedCompany, form.company, setFormValue]);

  const ledgersRaw = masterData?.ledgers || [];

  const finalCashLedgers = ledgersRaw.filter(l => l.groupName === 'Cash-in-Hand');
  const finalBankLedgers = ledgersRaw.filter(l => l.groupName === 'Bank Accounts' || l.groupName === 'Bank OD A/c');
  const cashAndBankLedgers = [...finalCashLedgers, ...finalBankLedgers];

  // Payment mode state ('cash' or 'bank')
  const isBankInit = form.bankLedger || (form.againstLedger && finalBankLedgers.some(b => b.name === form.againstLedger));
  const [paymentMode, setPaymentMode] = useState(isBankInit ? 'bank' : 'cash');

  useEffect(() => {
    const isBank = form.bankLedger || (form.againstLedger && finalBankLedgers.some(b => b.name === form.againstLedger));
    setPaymentMode(isBank ? 'bank' : 'cash');
  }, [form.bankLedger, form.againstLedger, finalBankLedgers]);

  const [showBillAllocation, setShowBillAllocation] = useState(false);
  const [showBankInstrument, setShowBankInstrument] = useState(false);
  const [partyDetailsCache, setPartyDetailsCache] = useState({});
  const [activeAllocationRowIndex, setActiveAllocationRowIndex] = useState(0);

  // Auto-fetch and cache party details for ledgerRows to show View Bills count
  useEffect(() => {
    const cacheParties = async () => {
      const finalPartyLedgersList = (masterData?.ledgers || []).filter(l => {
        const g = l.groupName ? l.groupName.toLowerCase().trim() : '';
        return g === 'sundry debtors' || g === 'sundry creditors';
      });

      for (const row of form.ledgerRows || []) {
        if (row.ledgerName && !partyDetailsCache[row.ledgerName]) {
          const isParty = finalPartyLedgersList.some(l => l.name === row.ledgerName);
          if (isParty) {
            try {
              const res = await fundflowApi.getPartyDetails(row.ledgerName);
              if (res.success && res.data) {
                setPartyDetailsCache(prev => ({ ...prev, [row.ledgerName]: res.data }));
              }
            } catch (err) {
              console.error("Failed to fetch party details for cache:", err);
            }
          }
        }
      }
    };
    cacheParties();
  }, [form.ledgerRows, masterData?.ledgers]);

  useEffect(() => {
    if (form.instNumber || form.utr || form.transType) {
      setShowBankInstrument(true);
    }
  }, [form.instNumber, form.utr, form.transType]);

  const isCreditor = (selectedPartyDetails?.groupName || form.ledgerGroup || '') === 'Sundry Creditors';
  const hasOutstandingBills = !!(selectedPartyDetails?.pendingBills && selectedPartyDetails.pendingBills.length > 0);

  const amountVal = parseFloat(form.amount) || 0;
  const totalAllocated = (form.billRows || []).reduce((acc, r) => acc + (parseFloat(r.allocationAmount) || 0), 0);

  let advanceReceipt = 0;
  let difference = 0;
  if (activeType === 'bank_payment') {
    const excess = Math.max(0, amountVal - totalAllocated);
    advanceReceipt = form.excessOption ? excess : 0;
    difference = amountVal - totalAllocated - advanceReceipt;
  } else if (activeType === 'cash_payment') {
    difference = amountVal - totalAllocated;
  }

  const isUnbalanced = isPaymentOrReceipt && hasOutstandingBills && Math.abs(difference) > 0.01;

  // Dynamically update showBillAllocation based on party Ledger selection
  useEffect(() => {
    if (isPaymentOrReceipt) {
      setShowBillAllocation(true);
    }
  }, [isPaymentOrReceipt]);

  // Ensure at least one row in ledgerRows (Transaction Details) by default
  useEffect(() => {
    if (isPaymentOrReceipt) {
      if (!form.ledgerRows || form.ledgerRows.length === 0) {
        setFormValue('ledgerRows', [{
          id: Date.now(),
          ledgerName: '',
          description: '',
          amount: 0,
          costCenter: ''
        }]);
      }
    }
  }, [isPaymentOrReceipt, form.ledgerRows?.length]);

  // Load all pending bills when a party is selected
  useEffect(() => {
    if (isPaymentOrReceipt && selectedPartyDetails) {
      const pendingBills = (selectedPartyDetails.pendingBills || []).filter(b => (parseFloat(b.pendingAmount) || 0) > 0.01);
      if (pendingBills.length > 0) {
        if (pendingBills.length === 1) {
          const singleBill = pendingBills[0];
          const paymentAmount = parseFloat(form.amount) || 0;
          const alloc = activeType === 'bank_payment' ? Math.min(paymentAmount, singleBill.pendingAmount) : paymentAmount;
          setFormValue('billRows', [{
            id: Date.now(),
            billType: 'Against Ref',
            billNo: singleBill.billNo,
            billRef: singleBill.billNo,
            date: singleBill.date || '',
            dueDate: singleBill.dueDate || '',
            billAmount: singleBill.billAmount || 0,
            pendingAmount: singleBill.pendingAmount || 0,
            allocationAmount: alloc,
            allocatedAmount: alloc
          }]);
        } else {
          // Initialize billRows with all pending bills
          const existingNos = (form.billRows || []).map(r => r.billNo);
          const needsInit = pendingBills.some(b => !existingNos.includes(b.billNo)) || (form.billRows || []).length === 0;
          if (needsInit) {
            const initialRows = pendingBills.map((bill, idx) => ({
              id: Date.now() + idx,
              billType: 'Against Ref',
              billNo: bill.billNo,
              billRef: bill.billNo,
              date: bill.date || '',
              dueDate: bill.dueDate || '',
              billAmount: bill.billAmount || 0,
              pendingAmount: bill.pendingAmount || 0,
              allocationAmount: 0,
              allocatedAmount: 0
            }));
            setFormValue('billRows', initialRows);
          }
        }
      } else {
        setFormValue('billRows', []);
      }
    } else if (isPaymentOrReceipt) {
      setFormValue('billRows', []);
    }
  }, [isPaymentOrReceipt, selectedPartyDetails]);

  // Auto-allocate single outstanding bill when payment amount changes
  useEffect(() => {
    if (isPaymentOrReceipt && selectedPartyDetails) {
      const pendingBills = (selectedPartyDetails.pendingBills || []).filter(b => (parseFloat(b.pendingAmount) || 0) > 0.01);
      if (pendingBills.length === 1) {
        const singleBill = pendingBills[0];
        const paymentAmount = parseFloat(form.amount) || 0;
        const currentAlloc = parseFloat(form.billRows?.[0]?.allocationAmount) || 0;
        const targetAlloc = activeType === 'bank_payment' ? Math.min(paymentAmount, singleBill.pendingAmount) : paymentAmount;
        if (currentAlloc !== targetAlloc) {
          setFormValue('billRows', [{
            id: form.billRows?.[0]?.id || Date.now(),
            billType: 'Against Ref',
            billNo: singleBill.billNo,
            billRef: singleBill.billNo,
            date: singleBill.date || '',
            dueDate: singleBill.dueDate || '',
            billAmount: singleBill.billAmount || 0,
            pendingAmount: singleBill.pendingAmount || 0,
            allocationAmount: targetAlloc,
            allocatedAmount: targetAlloc
          }]);
        }
      }
    }
  }, [isPaymentOrReceipt, form.amount, selectedPartyDetails]);


  const handlePaymentModeChange = (mode) => {
    setPaymentMode(mode);
    if (mode === 'cash') {
      const firstCash = form.cashLedger || finalCashLedgers[0]?.name || '';
      setFormValue('cashLedger', firstCash);
      setFormValue('bankLedger', '');
      setFormValue('againstLedger', firstCash);
      if (firstCash) {
        fetchCashBankBalance(firstCash, 'cash');
      }
    } else {
      const firstBank = form.bankLedger || finalBankLedgers[0]?.name || '';
      setFormValue('bankLedger', firstBank);
      setFormValue('cashLedger', '');
      setFormValue('againstLedger', firstBank);
      if (firstBank) {
        fetchCashBankBalance(firstBank, 'bank');
      }
    }
  };

  const finalPartyLedgers = ledgersRaw.filter(l => {
    const g = l.groupName ? l.groupName.toLowerCase().trim() : '';
    return g === 'sundry debtors' || g === 'sundry creditors';
  });

  // Default ledger selections when masterData or activeType changes
  useEffect(() => {
    if (masterData?.ledgers && masterData.ledgers.length > 0 && !form._id) {
      if (activeType === 'cash_payment' && !form.againstLedger) {
        const firstCash = masterData.ledgers.find(l => l.groupName === 'Cash-in-Hand')?.name;
        if (firstCash) {
          setFormValue('againstLedger', firstCash);
          setFormValue('cashLedger', firstCash);
          fetchCashBankBalance(firstCash, 'cash');
        }
      } else if (activeType === 'bank_payment' && !form.againstLedger) {
        const firstBank = masterData.ledgers.find(l => l.groupName === 'Bank Accounts' || l.groupName === 'Bank OD A/c')?.name;
        if (firstBank) {
          setFormValue('againstLedger', firstBank);
          setFormValue('bankLedger', firstBank);
          fetchCashBankBalance(firstBank, 'bank');
        }
      }
    }
  }, [masterData?.ledgers, activeType, form._id, form.againstLedger, setFormValue, fetchCashBankBalance]);

  // Sync costCenterApplicable, gstApplicable, tdsApplicable from selectedPartyDetails
  useEffect(() => {
    if (selectedPartyDetails) {
      setFormValue('costCenterApplicable', !!selectedPartyDetails.isCostCentresOn);
      setFormValue('gstApplicable', !!selectedPartyDetails.gstApplicable);
      setFormValue('tdsApplicable', !!selectedPartyDetails.tdsApplicable);
    }
  }, [selectedPartyDetails, setFormValue]);

  const validateForm = () => {
    if (activeType === 'contra') {
      if (!form.sourceLedger) {
        toast.error('Source Ledger is required');
        return false;
      }
      if (!form.destinationLedger) {
        toast.error('Destination Ledger is required');
        return false;
      }
      const transferAmt = parseFloat(form.transferAmount) || 0;
      if (transferAmt <= 0) {
        toast.error('Transfer Amount must be greater than zero');
        return false;
      }
      return true;
    }

    if (!form.againstLedger) {
      toast.error('Cash/Bank Ledger is required');
      return false;
    }
    const amt = parseFloat(form.amount) || 0;
    if (amt <= 0) {
      toast.error('Amount must be greater than zero');
      return false;
    }

    const isBank = paymentMode === 'bank';
    const balance = parseFloat(isBank ? form.bankBalance : form.openingBalance) || 0;
    if (activeType === 'cash_payment') {
      if (amt > balance) {
        toast.error(`Amount (₹${amt}) cannot exceed available ${isBank ? 'Bank' : 'Cash'} Balance (₹${balance})`);
        return false;
      }
    }

    // Bill Allocation Validations for Payment/Receipt Vouchers with Outstanding Bills
    if (isPaymentOrReceipt && hasOutstandingBills) {
      const billRows = form.billRows || [];
      if (billRows.length === 0) {
        toast.error(activeType === 'bank_payment' ? 'Allocated amount must match receipt amount.' : 'Allocated amount must match transaction amount.');
        return false;
      }

      let totalAllocated = 0;
      for (let i = 0; i < billRows.length; i++) {
        const row = billRows[i];
        if (!row.billNo && row.billType === 'Against Ref') {
          toast.error(activeType === 'bank_payment' ? `Please select an Invoice Reference in row ${i + 1}` : `Please select a Bill Reference in row ${i + 1}`);
          return false;
        }
        if (!row.billRef && row.billType !== 'Against Ref' && row.billType !== 'On Account') {
          toast.error(activeType === 'bank_payment' ? `Please enter an Invoice Reference in row ${i + 1}` : `Please enter a Bill Reference in row ${i + 1}`);
          return false;
        }
        const allocAmt = parseFloat(row.allocationAmount) || 0;
        if (allocAmt < 0) {
          toast.error(`Allocation amount in row ${i + 1} cannot be negative`);
          return false;
        }
        totalAllocated += allocAmt;
      }

      const voucherAmount = parseFloat(form.amount) || 0;
      if (activeType === 'bank_payment') {
        if (Math.abs(totalAllocated - voucherAmount) > 0.01) {
          toast.error('Total Allocated Receipt Amount must be equal to Total Receipt Amount.');
          return false;
        }
      } else {
        if (Math.abs(totalAllocated - voucherAmount) > 0.01) {
          toast.error('Allocated amount must match transaction amount.');
          return false;
        }
      }
    }

    return true;
  };

  const handleSaveDraft = async () => {
    if (!validateForm()) return;
    const res = await saveDraft();
    if (res.success) {
      toast.success('Draft saved successfully');
      if (onSaveSuccess) onSaveSuccess(res.data?._id || res.data?.id || form._id);
      else if (onBack) onBack(activeType);
    } else {
      toast.error(res.message || 'Failed to save draft');
    }
  };

  const handlePushToReview = async () => {
    if (!validateForm()) return;
    const res = await pushToReview();
    if (res.success) {
      toast.success('Pushed for approval successfully');
      if (onSaveSuccess) onSaveSuccess(res.data?._id || res.data?.id || form._id);
      else if (onBack) onBack(activeType);
    } else {
      toast.error(res.message || 'Failed to push for approval');
    }
  };

  const handlePostToTally = () => {
    if (form.status !== 'approved') {
      toast.warning('Voucher must be approved in the Approval Center before posting to Tally.');
      return;
    }
    toast.success("Successfully posted voucher to Tally database!");
    if (onSaveSuccess) onSaveSuccess(form._id);
    else if (onBack) onBack(activeType);
  };

  // Row operations for Bill Allocations
  const addBillRow = () => {
    const newBillRows = [
      ...(form.billRows || []),
      {
        id: Date.now(),
        billType: 'Against Ref',
        billNo: '',
        billRef: '',
        date: '',
        dueDate: '',
        billAmount: 0,
        pendingAmount: 0,
        allocationAmount: 0,
        allocatedAmount: 0
      }
    ];
    setFormValue('billRows', newBillRows);
  };

  const removeBillRow = (id) => {
    const newBillRows = (form.billRows || []).filter(r => r.id !== id && r._id !== id);
    if (newBillRows.length === 1 && !isPaymentOrReceipt) {
      const mainAmount = parseFloat(form.amount) || 0;
      newBillRows[0] = {
        ...newBillRows[0],
        allocationAmount: mainAmount,
        allocatedAmount: mainAmount
      };
    }
    setFormValue('billRows', newBillRows);

    if (isPaymentOrReceipt) {
      const total = newBillRows.reduce((sum, r) => sum + (parseFloat(r.allocationAmount) || 0), 0);
      setFormValue('amount', total);
    }
  };

  const updateBillRow = (index, key, val) => {
    const newBillRows = [...(form.billRows || [])];
    newBillRows[index] = { ...newBillRows[index], [key]: val };
    setFormValue('billRows', newBillRows);
  };

  const handleBillRefChange = (index, billNo) => {
    const newBillRows = [...(form.billRows || [])];
    const selectedBill = (selectedPartyDetails?.pendingBills || []).find(b => b.billNo === billNo);

    const mainAmount = parseFloat(form.amount) || 0;
    const defaultAlloc = newBillRows.length === 1 ? mainAmount : 0;

    if (selectedBill) {
      newBillRows[index] = {
        ...newBillRows[index],
        billNo: selectedBill.billNo,
        billRef: selectedBill.billNo,
        date: selectedBill.date || '',
        dueDate: selectedBill.dueDate || '',
        billAmount: selectedBill.billAmount || 0,
        pendingAmount: selectedBill.pendingAmount || 0,
        allocationAmount: defaultAlloc,
        allocatedAmount: defaultAlloc
      };
    } else {
      newBillRows[index] = {
        ...newBillRows[index],
        billNo: '',
        billRef: '',
        date: '',
        dueDate: '',
        billAmount: 0,
        pendingAmount: 0,
        allocationAmount: defaultAlloc,
        allocatedAmount: defaultAlloc
      };
    }
    setFormValue('billRows', newBillRows);
  };

  const handleAllocationChange = (index, val) => {
    const newBillRows = [...(form.billRows || [])];
    let numVal = parseFloat(val) || 0;

    if (activeType === 'bank_payment') {
      const pending = parseFloat(newBillRows[index].pendingAmount) || 0;
      if (numVal > pending) {
        numVal = pending;
        toast.warning(`Amount Received cannot exceed Outstanding Amount (₹${pending.toLocaleString('en-IN')})`);
      }
    }

    newBillRows[index] = {
      ...newBillRows[index],
      allocationAmount: numVal,
      allocatedAmount: numVal
    };
    setFormValue('billRows', newBillRows);

    if (isPaymentOrReceipt) {
      const total = newBillRows.reduce((sum, r) => sum + (parseFloat(r.allocationAmount) || 0), 0);
      setFormValue('amount', total);
    }
  };

  const handleAgainstLedgerChange = (val) => {
    setFormValue('againstLedger', val);
    const isBankLedger = finalBankLedgers.some(b => b.name === val);
    if (isBankLedger) {
      setPaymentMode('bank');
      setFormValue('bankLedger', val);
      setFormValue('cashLedger', '');
      fetchCashBankBalance(val, 'bank');
    } else {
      setPaymentMode('cash');
      setFormValue('cashLedger', val);
      setFormValue('bankLedger', '');
      fetchCashBankBalance(val, 'cash');
    }
  };

  const handleAiAutoAllocate = () => {
    const pendingBills = selectedPartyDetails?.pendingBills || [];
    if (pendingBills.length === 0) {
      toast.error(activeType === 'bank_payment' ? "No pending invoices available to allocate." : "No pending bills available to allocate.");
      return;
    }
    const toastId = toast.loading(activeType === 'bank_payment' ? "AI is allocating receipts to pending invoices..." : "AI is allocating payments to pending bills...");
    setTimeout(() => {
      // Sort pending bills by date ascending (oldest first)
      const sortedBills = [...pendingBills].sort((a, b) => {
        const dateA = a.date ? new Date(a.date) : new Date(0);
        const dateB = b.date ? new Date(b.date) : new Date(0);
        return dateA - dateB;
      });

      let remainingToAllocate = parseFloat(form.amount) || 0;
      const newBillRows = sortedBills.map((bill, idx) => {
        const pending = parseFloat(bill.pendingAmount) || 0;
        const alloc = Math.min(remainingToAllocate, pending);
        remainingToAllocate = Math.max(0, remainingToAllocate - alloc);
        return {
          id: Date.now() + idx,
          billType: 'Against Ref',
          billNo: bill.billNo,
          billRef: bill.billNo,
          date: bill.date || '',
          dueDate: bill.dueDate || '',
          billAmount: bill.billAmount || 0,
          pendingAmount: pending,
          allocationAmount: alloc,
          allocatedAmount: alloc
        };
      });
      setFormValue('billRows', newBillRows);
      toast.success(activeType === 'bank_payment' ? "Receipts successfully allocated against pending invoices!" : "Payments successfully allocated against pending bills!", { id: toastId });
    }, 800);
  };

  // --- Ledger Rows Helpers (Transaction Details Table) ---
  const addLedgerRow = () => {
    const newRows = [
      ...(form.ledgerRows || []),
      { id: Date.now(), ledgerName: '', description: '', amount: 0, costCenter: '' }
    ];
    setFormValue('ledgerRows', newRows);
  };

  const updateLedgerRow = (index, key, val) => {
    const newRows = [...(form.ledgerRows || [])];
    newRows[index] = { ...newRows[index], [key]: val };
    setFormValue('ledgerRows', newRows);
  };

  const removeLedgerRow = (id) => {
    let newRows = (form.ledgerRows || []).filter(r => r.id !== id);
    if (newRows.length === 0) {
      newRows = [{ id: Date.now(), ledgerName: '', description: '', amount: 0, costCenter: '' }];
    }
    setFormValue('ledgerRows', newRows);
  };

  const theme = {

    bg: 'var(--app-content-bg)',
    panel: 'var(--app-panel-bg)',
    border: isDark ? '#334155' : '#cbd5e1',
    headerBg: 'var(--app-table-head-bg)',
    text: isDark ? '#f8fafc' : '#0f172a',
    inputBg: 'var(--app-control-bg)',
    mutedText: isDark ? '#94a3b8' : '#475569',
    accent: 'var(--app-accent)',
    accentSoft: 'var(--app-accent-soft)',
    accentGradient: 'var(--app-accent-gradient)',
    scrollbarThumb: isDark ? 'rgba(9, 182, 185, 0.3)' : '#cbd5e1',
    scrollbarTrack: isDark ? 'transparent' : '#f1f5f9'
  };

  // --- Voucher type labels ---
  const typeLabels = {
    cash_payment: 'Payment',
    bank_payment: 'Receipt',
    contra: 'Contra'
  };
  const typeIcons = {
    cash_payment: Wallet,
    bank_payment: Landmark,
    contra: ArrowRightLeft
  };
  const TypeIcon = typeIcons[activeType] || Wallet;

  // --- Determine visible sections per voucher type ---
  const showContraTransfer = activeType === 'contra';

  // Dynamic Cost Centers & Categories options
  const costCategoriesOptions = masterData?.costCategories || [];
  const selectedCat = form.costCategory || (form.costCenters?.[0]?.category || '');
  const filteredCostCenters = (masterData?.costCenters || [])
    .filter(cc => !selectedCat || cc.category === selectedCat)
    .map(cc => cc.name);

  // Compute live bill allocations sum
  const billTotal = (form.billRows || []).reduce((acc, row) => acc + (parseFloat(row.billAmount) || 0), 0);

  const getBalancePanel = () => {
    const isBank = paymentMode === 'bank';
    const openingBal = parseFloat(isBank ? form.bankBalance : form.openingBalance) || 0;
    const amountVal = parseFloat(form.amount) || 0;

    let closingBal = openingBal;
    if (activeType === 'cash_payment') {
      closingBal = openingBal - amountVal;
    } else if (activeType === 'bank_payment') {
      closingBal = openingBal + amountVal;
    }

    const formatCur = (val) => `₹ ${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    if (activeType === 'contra') {
      const sourceBal = parseFloat(form.openingBalance) || 0;
      const destBal = parseFloat(form.bankBalance) || 0;
      const transferAmt = parseFloat(form.transferAmount) || 0;
      const receivedAmt = parseFloat(form.amountReceived) || 0;

      const sourceClosing = sourceBal - transferAmt;
      const destClosing = destBal + receivedAmt;

      return (
        <div className="rounded-xl border p-2 shadow-sm" style={{ borderColor: theme.border, backgroundColor: theme.panel }}>
          <h3 className="text-[8.5px] font-black uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
            <Wallet size={10} /> Live Balance Panel (Contra)
          </h3>
          <div className="grid grid-cols-2 gap-2 text-[9px]">
            <div className="flex flex-col gap-1 border-r pr-2" style={{ borderColor: theme.border }}>
              <span className="text-[7.5px] font-black uppercase text-emerald-500 truncate">Source: {form.sourceLedger || 'Select Source'}</span>
              <div className="flex justify-between">
                <span className="text-slate-400">Opening:</span>
                <span style={{ color: theme.text }}>{formatCur(sourceBal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Transfer:</span>
                <span className="text-red-500">-{formatCur(transferAmt)}</span>
              </div>
              <div className="flex justify-between font-extrabold border-t pt-0.5" style={{ borderColor: theme.border }}>
                <span className="text-slate-400">Closing:</span>
                <span style={{ color: theme.text }}>{formatCur(sourceClosing)}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1 pl-2">
              <span className="text-[7.5px] font-black uppercase text-blue-500 truncate">Dest: {form.destinationLedger || 'Select Dest'}</span>
              <div className="flex justify-between">
                <span className="text-slate-400">Opening:</span>
                <span style={{ color: theme.text }}>{formatCur(destBal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Received:</span>
                <span className="text-emerald-500">+{formatCur(receivedAmt)}</span>
              </div>
              <div className="flex justify-between font-extrabold border-t pt-0.5" style={{ borderColor: theme.border }}>
                <span className="text-slate-400">Closing:</span>
                <span style={{ color: theme.text }}>{formatCur(destClosing)}</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="rounded-xl border p-2 shadow-sm" style={{ borderColor: theme.border, backgroundColor: theme.panel }}>
        <h3 className="text-[8.5px] font-black uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
          <Wallet size={10} /> Live Balance Panel ({isBank ? 'Bank' : 'Cash'})
        </h3>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="flex flex-col gap-0.5">
            <span className="text-[7.5px] font-black uppercase tracking-wider text-slate-400">Opening Balance</span>
            <span className="text-[10.5px] font-extrabold" style={{ color: theme.text }}>{formatCur(openingBal)}</span>
          </div>
          <div className="flex flex-col gap-0.5 border-x px-1" style={{ borderColor: theme.border }}>
            <span className="text-[7.5px] font-black uppercase tracking-wider text-slate-400">Voucher Amount</span>
            <span className={`text-[10.5px] font-black ${activeType === 'cash_payment' ? 'text-red-500' : 'text-emerald-500'}`}>
              {activeType === 'cash_payment' ? '-' : '+'} {formatCur(amountVal)}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[7.5px] font-black uppercase tracking-wider text-slate-400">Closing Balance</span>
            <span className={`text-[10.5px] font-black ${closingBal < 0 ? 'text-rose-500' : 'text-[#09B6B9]'}`}>{formatCur(closingBal)}</span>
          </div>
        </div>
      </div>
    );
  };

  const getAccountingPreview = () => {
    const amt = parseFloat(form.amount) || 0;
    const formatCur = (val) => `₹ ${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    let debitLeg = { ledger: '', amount: 0 };
    let creditLeg = { ledger: '', amount: 0 };

    if (activeType === 'cash_payment') {
      debitLeg = { ledger: form.partyLedger || 'Party/Expense Ledger', amount: amt };
      creditLeg = { ledger: form.againstLedger || (paymentMode === 'bank' ? 'Bank Ledger' : 'Cash Ledger'), amount: amt };
    } else if (activeType === 'bank_payment') {
      debitLeg = { ledger: form.againstLedger || (paymentMode === 'bank' ? 'Bank Ledger' : 'Cash Ledger'), amount: amt };
      creditLeg = { ledger: form.partyLedger || 'Party/Revenue Ledger', amount: amt };
    } else if (activeType === 'contra') {
      const sourceAmt = parseFloat(form.transferAmount) || 0;
      const destAmt = parseFloat(form.amountReceived) || 0;
      debitLeg = { ledger: form.destinationLedger || 'Destination Cash/Bank', amount: destAmt };
      creditLeg = { ledger: form.sourceLedger || 'Source Cash/Bank', amount: sourceAmt };
    }

    return (
      <div className="rounded-xl border p-2 shadow-sm" style={{ borderColor: theme.border, backgroundColor: theme.panel }}>
        <h3 className="text-[8.5px] font-black uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
          <ArrowRightLeft size={10} /> Accounting Entry Preview
        </h3>
        <div className="bg-slate-900/90 dark:bg-slate-950/80 rounded-lg p-2 font-mono text-[9.5px] space-y-1 border border-slate-800 shadow-inner">
          <div className="flex justify-between items-center text-indigo-400">
            <span className="truncate max-w-[70%]">
              <span className="font-extrabold text-indigo-500 mr-1.5">Dr</span>
              {debitLeg.ledger}
            </span>
            <span>{formatCur(debitLeg.amount)}</span>
          </div>
          <div className="flex justify-between items-center text-emerald-400 pl-4">
            <span className="truncate max-w-[70%]">
              <span className="font-extrabold text-emerald-500 mr-1.5">Cr</span>
              {creditLeg.ledger}
            </span>
            <span>{formatCur(creditLeg.amount)}</span>
          </div>
        </div>
      </div>
    );
  };

  const getVoucherSummary = () => {
    if (!isPaymentOrReceipt || !form.partyLedger) return null;

    const currentBal = selectedPartyDetails
      ? `₹ ${(selectedPartyDetails.outstandingBalance || 0).toLocaleString('en-IN')} ${selectedPartyDetails.outstandingType || ''}`
      : '₹ 0.00';

    const pendingBills = selectedPartyDetails?.pendingBills || [];
    const totalOutstanding = pendingBills.reduce((acc, b) => acc + (parseFloat(b.pendingAmount) || 0), 0);
    const amountVal = parseFloat(form.amount) || 0;
    const allocatedAmount = (form.billRows || []).reduce((acc, r) => acc + (parseFloat(r.allocationAmount) || 0), 0);

    let advanceReceipt = 0;
    let difference = 0;

    if (activeType === 'bank_payment') {
      const excess = Math.max(0, amountVal - allocatedAmount);
      advanceReceipt = form.excessOption ? excess : 0;
      difference = amountVal - allocatedAmount - advanceReceipt;
    } else {
      difference = amountVal - allocatedAmount;
    }

    const remainingOutstanding = Math.max(0, totalOutstanding - allocatedAmount);
    const status = difference === 0 ? 'Balanced' : 'Unbalanced';

    const formatCur = (val) => `₹ ${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    return (
      <div className="rounded-xl border p-3 shadow-sm animate-in fade-in duration-200" style={{ borderColor: theme.border, backgroundColor: theme.panel }}>
        <h3 className="text-[8.5px] font-black uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1">
          <BookText size={10} /> Voucher Summary
        </h3>
        <div className="flex flex-col gap-2 text-[10px]">
          <div className="flex justify-between items-center py-0.5 border-b border-dashed" style={{ borderColor: theme.border }}>
            <span className="text-slate-400 font-bold">Current Balance:</span>
            <span className="font-extrabold" style={{ color: theme.text }}>{currentBal}</span>
          </div>
          <div className="flex justify-between items-center py-0.5 border-b border-dashed" style={{ borderColor: theme.border }}>
            <span className="text-slate-400 font-bold">Total Outstanding:</span>
            <span className="font-extrabold" style={{ color: theme.text }}>{formatCur(totalOutstanding)}</span>
          </div>
          <div className="flex justify-between items-center py-0.5 border-b border-dashed" style={{ borderColor: theme.border }}>
            <span className="text-slate-400 font-bold">{activeType === 'bank_payment' ? 'Receipt Amount:' : 'Payment Amount:'}</span>
            <span className="font-black text-indigo-600 dark:text-indigo-400">{formatCur(amountVal)}</span>
          </div>
          <div className="flex justify-between items-center py-0.5 border-b border-dashed" style={{ borderColor: theme.border }}>
            <span className="text-slate-400 font-bold">Allocated Amount:</span>
            <span className="font-black text-emerald-600 dark:text-emerald-400">{formatCur(allocatedAmount)}</span>
          </div>
          {activeType === 'bank_payment' && (
            <div className="flex justify-between items-center py-0.5 border-b border-dashed" style={{ borderColor: theme.border }}>
              <span className="text-slate-400 font-bold">Advance Receipt:</span>
              <span className="font-extrabold text-[#09B6B9]">{formatCur(advanceReceipt)}</span>
            </div>
          )}
          <div className="flex justify-between items-center py-0.5 border-b border-dashed" style={{ borderColor: theme.border }}>
            <span className="text-slate-400 font-bold">Remaining Outstanding:</span>
            <span className="font-extrabold" style={{ color: theme.text }}>{formatCur(remainingOutstanding)}</span>
          </div>
          <div className="flex justify-between items-center py-0.5 border-b border-dashed" style={{ borderColor: theme.border }}>
            <span className="text-slate-400 font-bold">Difference:</span>
            <span className={`font-black ${difference === 0 ? 'text-slate-600 dark:text-slate-300' : 'text-rose-500'}`}>
              {formatCur(difference)}
            </span>
          </div>
          <div className="flex justify-between items-center py-1 mt-1">
            <span className="text-slate-400 font-black uppercase tracking-wider text-[8px]">Status:</span>
            <span className={`px-2 py-0.5 text-[8.5px] font-black uppercase tracking-wider shadow-sm text-white ${status === 'Balanced' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
              {status}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const handleVoucherTypeSwitch = (typeId) => {
    if (['cash_payment', 'bank_payment', 'contra'].includes(typeId)) {
      resetForm(typeId);
    } else if (typeId === 'sales_invoice') {
      navigate('/sales/inbox', { state: { openManual: true } });
    } else if (typeId === 'purchase_invoice') {
      navigate('/purchase/inbox', { state: { openManual: true } });
    }
  };

  return (
    <ThemeContext.Provider value={{ isDark, theme }}>
      <div className="flex flex-col h-full overflow-hidden" style={{ backgroundColor: theme.bg }}>
        <style>{`
          .themed-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
          .themed-scrollbar::-webkit-scrollbar-track { background: ${theme.scrollbarTrack}; }
          .themed-scrollbar::-webkit-scrollbar-thumb { background: ${theme.scrollbarThumb}; border-radius: 0px; }
          .themed-scrollbar::-webkit-scrollbar-thumb:hover { background: ${theme.accent}; }
          .no-scrollbar::-webkit-scrollbar { display: none; }
        `}</style>

        {/* Top Header Row (Same style as Purchase) */}
        <div className="flex items-center justify-between px-4 py-1.5 bg-white dark:bg-[#0d0f12] border-b shrink-0" style={{ borderColor: theme.border }}>
          <div className="flex items-center gap-2">
            <h1 className="text-[12px] md:text-[13px] font-black uppercase tracking-tight text-slate-800 dark:text-slate-200">
              {activeType === 'cash_payment' ? 'CREATE PAYMENT VOUCHER' :
                activeType === 'bank_payment' ? 'CREATE RECEIPT VOUCHER' : 'CREATE CONTRA VOUCHER'}
            </h1>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleSaveDraft}
              disabled={loading.save}
              className="px-3 py-1 rounded-none border text-[9.5px] font-black transition-all hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1"
              style={{ borderColor: theme.border, backgroundColor: theme.inputBg }}
            >
              Draft
            </button>
            <button
              onClick={handlePushToReview}
              disabled={loading.save || isUnbalanced}
              className={`px-3 py-1 rounded-none text-[9.5px] font-black transition-all shadow-sm uppercase tracking-wider flex items-center gap-1 ${(loading.save || isUnbalanced)
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-50'
                  : 'hover:scale-[1.02] text-slate-800 bg-[#FCD34D] hover:bg-[#FBBF24]'
                }`}
            >
              Review
            </button>
            <button
              onClick={handlePostToTally}
              disabled={isUnbalanced}
              className={`px-3 py-1 rounded-none text-[9.5px] font-black shadow-sm transition-all uppercase tracking-wider ${isUnbalanced
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-50'
                  : 'hover:scale-[1.02] text-white bg-blue-600 hover:bg-blue-700'
                }`}
            >
              Post Tally
            </button>
            <button
              onClick={handleCancel}
              className="px-3 py-1 rounded-none border text-[9.5px] font-black hover:bg-red-50 hover:text-red-500 transition-all uppercase tracking-wider text-slate-400"
              style={{ borderColor: theme.border }}
            >
              Cancel
            </button>
            <button className="p-1.5 rounded-none border text-slate-400 hover:text-indigo-600 transition-all" style={{ borderColor: theme.border }}>
              <Settings size={12} />
            </button>
            <button
              onClick={handleCancel}
              className="p-1.5 rounded-none border text-slate-400 hover:text-red-500 transition-all hover:bg-red-50"
              style={{ borderColor: theme.border, backgroundColor: theme.inputBg }}
            >
              <X size={12} strokeWidth={3} />
            </button>
          </div>
        </div>

        {/* Voucher Types & Summary Row (Same style as Purchase) */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-0.75 bg-white dark:bg-[#0d0f12] border-b shrink-0" style={{ borderColor: theme.border }}>
          {/* Voucher Types Switcher */}
          {!onSaveSuccess && (
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {[
                { id: 'sales_invoice', label: 'Sales Voucher', section: 'SALES', icon: FileText },
                { id: 'purchase_invoice', label: 'Purchase Voucher', section: 'PURCHASE', icon: BookText },
                { id: 'cash_payment', label: 'Payments', section: 'PAYMENTS', icon: ArrowRightLeft },
                { id: 'bank_payment', label: 'Receipts', section: 'RECEIPTS', icon: Landmark },
                { id: 'contra', label: 'Contra', section: 'CONTRA', icon: ArrowRightLeft }
              ].map(type => {
                const isSelected = activeType === type.id;
                return (
                  <button
                    key={type.id}
                    onClick={() => handleVoucherTypeSwitch(type.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-none border text-left min-w-[120px] shrink-0 transition-all ${isSelected
                      ? 'bg-[#09B6B9]/10 border-[#09B6B9] text-[#09B6B9] shadow-sm'
                      : 'bg-white dark:bg-[#12161a] border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50'
                      }`}
                  >
                    <type.icon size={11} className={isSelected ? 'text-[#09B6B9]' : 'text-slate-400'} />
                    <div>
                      <span className="text-[7px] block font-black tracking-wider opacity-60 uppercase">{type.section}</span>
                      <span className="text-[9px] font-black">{type.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Amount Summary Cards */}
          {(activeType === 'cash_payment' || activeType === 'bank_payment') ? (() => {
            const totalLedgerAmountVal = (form.ledgerRows || []).reduce((acc, r) => acc + (parseFloat(r.amount) || 0), 0);
            const totalBillAmountVal = (form.billRows || []).reduce((acc, r) => acc + (parseFloat(r.pendingAmount || r.billAmount) || 0), 0);
            const totalAllocatedVal = (form.billRows || []).reduce((acc, r) => acc + (parseFloat(r.allocationAmount) || 0), 0);
            const totalUnallocatedVal = Math.max(0, totalLedgerAmountVal - totalAllocatedVal);
            const isValidated = Math.abs(totalLedgerAmountVal - totalAllocatedVal) < 0.01 && totalLedgerAmountVal > 0;

            return (
              <div className="flex items-center flex-wrap gap-1 text-[9.5px]">
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-none bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[7.5px]">TOTAL LEDGER AMOUNT (₹):</span>
                  <span className="font-black text-slate-700 dark:text-slate-300">
                    ₹ {totalLedgerAmountVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-none bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[7.5px]">
                    {activeType === 'cash_payment' ? 'TOTAL BILL AMOUNT (₹):' : 'TOTAL INVOICE AMOUNT (₹):'}
                  </span>
                  <span className="font-black text-slate-700 dark:text-slate-300">
                    ₹ {totalBillAmountVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-none bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[7.5px]">TOTAL ALLOCATED AMOUNT (₹):</span>
                  <span className="font-black text-slate-700 dark:text-slate-300">
                    ₹ {totalAllocatedVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-none bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[7.5px]">REMAINING UNALLOCATED (₹):</span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400">
                    ₹ {totalUnallocatedVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-none shadow-md text-white ${isValidated ? 'bg-emerald-600' : 'bg-rose-600'}`}>
                  <span className="text-[7.5px] font-black uppercase tracking-wider opacity-85">VALIDATION STATUS:</span>
                  <span className="font-black text-[10px] flex items-center gap-1">
                    {isValidated ? (
                      <>
                        <CheckCircle2 size={10} className="text-white" /> Balanced
                      </>
                    ) : 'Unbalanced'}
                  </span>
                </div>
              </div>
            );
          })() : (
            <div className="flex items-center flex-wrap gap-1 text-[9.5px]">
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-none bg-slate-50 dark:bg-[#12161a] border border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[7.5px]">Total Debit:</span>
                <span className="font-black text-slate-700 dark:text-slate-300">
                  ₹ {(form.totalDebit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-none bg-slate-50 dark:bg-[#12161a] border border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[7.5px]">Total Credit:</span>
                <span className="font-black text-slate-700 dark:text-slate-300">
                  ₹ {(form.totalCredit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-none bg-slate-50 dark:bg-[#12161a] border border-slate-100 dark:border-slate-800">
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[7.5px]">Difference:</span>
                <span className="font-black text-slate-700 dark:text-slate-300">
                  ₹ {(form.difference || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-none shadow-md text-white ${form.difference === 0 ? 'bg-emerald-600' : 'bg-rose-600'}`}>
                <span className="text-[7.5px] font-black uppercase tracking-wider opacity-85">Status:</span>
                <span className="font-black text-[10px]">
                  {form.difference === 0 ? 'Balanced' : 'Unbalanced'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Main Body Two-Column Grid Wrapper */}
        <div className="flex-1 p-1.5 overflow-y-auto themed-scrollbar bg-white dark:bg-[#0b0c10]">
          {isPaymentOrReceipt ? (() => {
            if (activeType === 'cash_payment' || activeType === 'bank_payment') {
              const totalLedgerAmountVal = (form.ledgerRows || []).reduce((acc, r) => acc + (parseFloat(r.amount) || 0), 0);
              const totalBillAmountVal = (form.billRows || []).reduce((acc, r) => acc + (parseFloat(r.pendingAmount || r.billAmount) || 0), 0);
              const totalAllocatedVal = (form.billRows || []).reduce((acc, r) => acc + (parseFloat(r.allocationAmount) || 0), 0);
              const totalUnallocatedVal = Math.max(0, totalLedgerAmountVal - totalAllocatedVal);
              const isValidated = Math.abs(totalLedgerAmountVal - totalAllocatedVal) < 0.01 && totalLedgerAmountVal > 0;

              const paymentAccountOptions = [...finalCashLedgers, ...finalBankLedgers];

              const activeLedgerRow = form.ledgerRows?.[activeAllocationRowIndex];
              const activeLedgerName = activeLedgerRow?.ledgerName;
              const hasBillsToAllocate = selectedPartyDetails && selectedPartyDetails.pendingBills?.length > 0;

              return (
                <div className="flex flex-col gap-2 pb-2 w-full text-slate-800 dark:text-slate-200">


                  {/* Voucher Details Card */}
                  <div className="rounded-lg border p-2.5 shadow-sm bg-white dark:bg-[#12161a]" style={{ borderColor: theme.border }}>
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-12 md:col-span-3">
                        <InputField
                          label="1. Voucher Date *"
                          type="date"
                          value={form.voucherDate || ''}
                          onChange={val => setFormValue('voucherDate', val)}
                          Icon={Calendar}
                          compact
                        />
                      </div>
                      <div className="col-span-12 md:col-span-3">
                        <SearchableDropdown
                          label="2. Voucher Type *"
                          placeholder="Select Type"
                          value={getSelectValue()}
                          onChange={val => setFormValue('voucherType', val)}
                          options={getVoucherTypeOptions()}
                          compact
                        />
                      </div>
                      <div className="col-span-12 md:col-span-3 relative">
                        <label className="text-[9px] font-black uppercase tracking-tighter absolute -top-2 left-2 px-1 z-10 text-slate-600 dark:text-slate-400" style={{ backgroundColor: isDark ? '#12161a' : '#fff' }}>
                          3. Voucher Reference Number
                        </label>
                        <select
                          value={form.voucherNumberSeries === 'Manual' ? 'Manual' : 'Default'}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormValue('voucherNumberSeries', val);
                            if (val !== 'Manual') {
                              fetchNextVoucherNumber(activeType);
                            }
                          }}
                          className="w-full h-7 px-2 rounded-sm border text-[10px] font-bold outline-none bg-white dark:bg-[#12161a]"
                          style={{ borderColor: theme.border, color: theme.text }}
                        >
                          <option value="Default">Auto (System Generated)</option>
                          <option value="Manual">Manual</option>
                        </select>
                      </div>

                      <div className="col-span-12 md:col-span-3">
                        <InputField
                          label="Voucher No."
                          placeholder={form.voucherNumberSeries === 'Manual' ? 'Enter No.' : 'Auto'}
                          value={form.voucherNumber || ''}
                          readOnly={form.voucherNumberSeries !== 'Manual'}
                          onChange={val => setFormValue('voucherNumber', val)}
                          compact
                        />
                      </div>

                      <div className="col-span-12 md:col-span-6">
                        <SearchableDropdown
                          label={activeType === 'cash_payment' ? "4. Payment Account *" : "4. Receipt Account *"}
                          placeholder="Select Cash/Bank Ledger..."
                          value={form.againstLedger || ''}
                          onChange={handleAgainstLedgerChange}
                          options={paymentAccountOptions}
                          compact
                        />
                      </div>
                      <div className="col-span-12 md:col-span-6">
                        <InputField
                          label="5. Account Balance"
                          value={form.againstLedger ? `₹ ${(paymentMode === 'bank' ? form.bankBalance : form.openingBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} Dr` : '₹ 0.00'}
                          readOnly
                          compact
                        />
                      </div>
                    </div>
                  </div>

                  {/* Transaction Details Card */}
                  <div className="rounded-lg border p-2.5 shadow-sm bg-white dark:bg-[#12161a]" style={{ borderColor: theme.border }}>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Transaction Details
                      </h3>
                      <label className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={form.costCenterApplicable || false}
                          onChange={e => {
                            const checked = e.target.checked;
                            setFormValue('costCenterApplicable', checked);
                          }}
                          className="w-3.5 h-3.5 rounded accent-indigo-500 cursor-pointer"
                        />
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          Enable Cost Center Allocation
                        </span>
                      </label>
                    </div>

                    <div className="overflow-visible border rounded-none" style={{ borderColor: theme.border }}>
                      <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                          <tr style={{ backgroundColor: theme.headerBg }}>
                            <th className="p-1 border text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 w-12 text-center" style={{ borderColor: theme.border }}>#</th>
                            <th className="p-1 border text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400" style={{ borderColor: theme.border }}>Ledger Name *</th>
                            {form.costCenterApplicable && (
                              <th className="p-1 border text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 w-48" style={{ borderColor: theme.border }}>Cost Center (Optional)</th>
                            )}
                            <th className="p-1 border text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400" style={{ borderColor: theme.border }}>Description</th>
                            <th className="p-1 border text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 w-44 text-right" style={{ borderColor: theme.border }}>Amount (₹)</th>
                            <th className="p-1 border text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 w-60 text-center" style={{ borderColor: theme.border }}>
                              {activeType === 'cash_payment' ? 'Outstanding Bills' : 'Outstanding Invoices'} (From Selected Ledger)
                            </th>
                            <th className="p-1 border text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 w-16 text-center" style={{ borderColor: theme.border }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(form.ledgerRows || []).map((row, idx) => {
                            const isParty = finalPartyLedgers.some(l => l.name === row.ledgerName);
                            const cachedDetails = partyDetailsCache[row.ledgerName];
                            const pendingBillsCount = cachedDetails?.pendingBills?.length || 0;
                            const hasOutstanding = isParty && pendingBillsCount > 0;

                            return (
                              <tr key={row.id || idx} className="hover:bg-slate-50/20">
                                <td className="p-1 border text-center text-[10px] font-bold text-slate-400" style={{ borderColor: theme.border }}>
                                  {idx + 1}
                                </td>
                                <td className="p-1 border relative z-10 focus-within:z-50" style={{ borderColor: theme.border }}>
                                  <SearchableDropdown
                                    placeholder="Select Ledger..."
                                    compact
                                    options={ledgersRaw.map(l => (typeof l === 'string' ? l : l.name)).filter(Boolean)}
                                    value={row.ledgerName || ''}
                                    onChange={val => {
                                      updateLedgerRow(idx, 'ledgerName', val);
                                      const party = finalPartyLedgers.find(l => l.name === val);
                                      if (party) {
                                        fetchPartyDetails(val);
                                        setActiveAllocationRowIndex(idx);
                                      }
                                    }}
                                  />
                                </td>
                                {form.costCenterApplicable && (
                                  <td className="p-1 border" style={{ borderColor: theme.border }}>
                                    <select
                                      value={row.costCenter || ''}
                                      onChange={e => updateLedgerRow(idx, 'costCenter', e.target.value)}
                                      className="w-full h-7 px-1.5 border text-[10px] font-bold outline-none rounded-sm"
                                      style={{ borderColor: theme.border, color: theme.text, backgroundColor: theme.inputBg }}
                                    >
                                      <option value="">Select Cost Center</option>
                                      {(masterData?.costCenters || []).map((cc, i) => (
                                        <option key={i} value={cc.name || cc}>{cc.name || cc}</option>
                                      ))}
                                    </select>
                                  </td>
                                )}
                                <td className="p-1 border" style={{ borderColor: theme.border }}>
                                  <input
                                    type="text"
                                    placeholder="Enter description"
                                    value={row.description || ''}
                                    onChange={e => updateLedgerRow(idx, 'description', e.target.value)}
                                    className="w-full h-7 px-1.5 border text-[10px] font-bold outline-none rounded-sm"
                                    style={{ borderColor: theme.border, color: theme.text, backgroundColor: theme.inputBg }}
                                  />
                                </td>
                                <td className="p-1 border text-right" style={{ borderColor: theme.border }}>
                                  <input
                                    type="number"
                                    placeholder="0.00"
                                    value={row.amount || ''}
                                    onChange={e => {
                                      const val = e.target.value;
                                      updateLedgerRow(idx, 'amount', val);
                                    }}
                                    className="w-full h-7 px-1.5 border text-[10px] font-black outline-none rounded-sm text-right"
                                    style={{ borderColor: theme.border, color: theme.text, backgroundColor: theme.inputBg }}
                                  />
                                </td>
                                <td className="p-1 border text-center" style={{ borderColor: theme.border }}>
                                  {hasOutstanding ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        fetchPartyDetails(row.ledgerName);
                                        setActiveAllocationRowIndex(idx);
                                        setShowBillAllocation(true);
                                      }}
                                      className="text-[10px] font-black text-blue-600 dark:text-blue-400 hover:underline hover:scale-105 transition-all"
                                    >
                                      {activeType === 'cash_payment' ? 'View Bills' : 'View Invoices'} ({pendingBillsCount})
                                    </button>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                                <td className="p-1 border text-center" style={{ borderColor: theme.border }}>
                                  <button
                                    type="button"
                                    onClick={() => removeLedgerRow(row.id)}
                                    className="text-red-500 hover:text-red-700 transition-colors p-1"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      <button
                        type="button"
                        onClick={addLedgerRow}
                        className="px-2.5 py-1 rounded border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 text-[10px] font-black uppercase flex items-center gap-1 transition-all"
                      >
                        <Plus size={8} strokeWidth={3} /> Add Row
                      </button>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Total Ledger Amount:</span>
                        <span className="text-[12.5px] font-black text-blue-900 dark:text-blue-400">
                          ₹ {totalLedgerAmountVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Outstanding Bills Card */}
                  {showBillAllocation && (
                    <div className="rounded-lg border p-2.5 shadow-sm bg-white dark:bg-[#12161a]" style={{ borderColor: theme.border }}>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          {activeType === 'cash_payment' ? 'Outstanding Bills Allocation' : 'Outstanding Sales Invoices Allocation'} (Auto Fetched)
                        </h3>
                        {hasBillsToAllocate && (
                          <button
                            type="button"
                            onClick={handleAiAutoAllocate}
                            className="px-2.5 py-1 border border-indigo-600/35 bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600/20 text-[9.5px] font-black uppercase rounded transition-all"
                          >
                            {activeType === 'cash_payment' ? 'Auto Allocate Bills' : 'Auto Allocate Receipts'}
                          </button>
                        )}
                      </div>

                        <div className="flex flex-col gap-2">
                          <div className="overflow-x-auto themed-scrollbar border rounded-none" style={{ borderColor: theme.border }}>
                            <table className="w-full text-left border-collapse min-w-[800px]">
                              <thead>
                                <tr style={{ backgroundColor: theme.headerBg }}>
                                  <th className="p-1 border text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 w-12 text-center" style={{ borderColor: theme.border }}>#</th>
                                  <th className="p-1 border text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400" style={{ borderColor: theme.border }}>
                                    {activeType === 'cash_payment' ? 'Bill Reference Number' : 'Invoice Reference Number'}
                                  </th>
                                  <th className="p-1 border text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 w-32" style={{ borderColor: theme.border }}>
                                    {activeType === 'cash_payment' ? 'Bill Date' : 'Invoice Date'}
                                  </th>
                                  {activeType === 'cash_payment' ? (
                                    <>
                                      <th className="p-1 border text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 w-44 text-right" style={{ borderColor: theme.border }}>Bill Amount (₹)</th>
                                      <th className="p-1 border text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 w-32" style={{ borderColor: theme.border }}>Due Date</th>
                                      <th className="p-1 border text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 w-44 text-right" style={{ borderColor: theme.border }}>Amount Allocation (₹)</th>
                                    </>
                                  ) : (
                                    <>
                                      <th className="p-1 border text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 w-40 text-right" style={{ borderColor: theme.border }}>Invoice Amount (₹)</th>
                                      <th className="p-1 border text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 w-40 text-right" style={{ borderColor: theme.border }}>Outstanding Amount (₹)</th>
                                      <th className="p-1 border text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 w-40 text-right" style={{ borderColor: theme.border }}>Amount Received (₹)</th>
                                    </>
                                  )}
                                </tr>
                              </thead>  
                              <tbody>
                                {!activeLedgerName ? (
                                  <tr>
                                    <td colSpan={6} className="p-3 text-center text-[10px] text-slate-400 italic font-black uppercase text-rose-500 dark:text-rose-400" style={{ borderColor: theme.border }}>
                                      No Outstanding allocations bills found.
                                    </td>
                                  </tr>
                                ) : !hasBillsToAllocate ? (
                                  <tr>
                                    <td colSpan={6} className="p-3 text-center text-[10px] text-slate-400 italic font-black uppercase text-rose-500 dark:text-rose-400" style={{ borderColor: theme.border }}>
                                      {activeType === 'cash_payment' ? `No pending bills available to allocate for "${activeLedgerName}".` : "No Outstanding Sales Invoices Found"}
                                    </td>
                                  </tr>
                                ) : (
                                  (form.billRows || []).map((row, idx) => {
                                    return (
                                      <tr key={row.id || idx} className="hover:bg-slate-50/20">
                                        <td className="p-1 border text-center text-[10px] font-bold text-slate-400" style={{ borderColor: theme.border }}>
                                          {idx + 1}
                                        </td>
                                        <td className="p-1 border font-bold text-[10px]" style={{ borderColor: theme.border, color: theme.text }}>
                                          {row.billNo || '—'}
                                        </td>
                                        <td className="p-1 border text-slate-500 text-[10px] font-bold" style={{ borderColor: theme.border }}>
                                          {row.date || '—'}
                                        </td>
                                        {activeType === 'cash_payment' ? (
                                          <>
                                            <td className="p-1 border text-right font-bold text-[10px]" style={{ borderColor: theme.border, color: theme.text }}>
                                              ₹ {(row.pendingAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="p-1 border text-slate-500 text-[10px] font-bold" style={{ borderColor: theme.border }}>
                                              {row.dueDate || '—'}
                                            </td>
                                          </>
                                        ) : (
                                          <>
                                            <td className="p-1 border text-right font-bold text-[10px]" style={{ borderColor: theme.border, color: theme.text }}>
                                              ₹ {(row.billAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="p-1 border text-right font-bold text-[10px]" style={{ borderColor: theme.border, color: theme.text }}>
                                              ₹ {(row.pendingAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </td>
                                          </>
                                        )}
                                        <td className="p-1 border text-right" style={{ borderColor: theme.border }}>
                                          <input
                                            type="number"
                                            placeholder="0.00"
                                            value={row.allocationAmount || ''}
                                            onChange={e => handleAllocationChange(idx, e.target.value)}
                                            className="w-full h-7 px-1.5 border text-[10px] font-black outline-none rounded-sm text-right"
                                            style={{
                                              borderColor: theme.border,
                                              color: theme.text,
                                              backgroundColor: theme.inputBg
                                            }}
                                          />
                                        </td>
                                      </tr>
                                    );
                                  })
                                )}
                              </tbody>
                            </table>
                          </div>

                          <div className="flex justify-between items-center px-2.5 py-1.5 border rounded-sm bg-slate-50 dark:bg-slate-900/10 text-[10px] font-black text-slate-700 dark:text-slate-300" style={{ borderColor: theme.border }}>
                            <div className="flex gap-1 items-center">
                              <span className="uppercase text-slate-400 tracking-wider">
                                {activeType === 'cash_payment' ? 'Total Bill Amount (₹)' : 'Total Outstanding Amount (₹)'}
                              </span>
                              <span className="text-[11.5px] text-[#1E3A8A] dark:text-blue-400">
                                ₹ {totalBillAmountVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div className="flex gap-1 items-center">
                              <span className="uppercase text-slate-400 tracking-wider">
                                {activeType === 'cash_payment' ? 'Total Allocated Amount (₹)' : 'Total Received Amount (₹)'}
                              </span>
                              <span className="text-[11.5px] text-[#1E3A8A] dark:text-blue-400">
                                ₹ {totalAllocatedVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div className="flex gap-1 items-center">
                              <span className="uppercase text-slate-400 tracking-wider">
                                {activeType === 'cash_payment' ? 'Remaining Unallocated (₹)' : 'Remaining Unallocated Amount (₹)'}
                              </span>
                              <span className={`text-[11.5px] ${totalUnallocatedVal === 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                                ₹ {totalUnallocatedVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                  {/* Instrument / Payment Details Card */}
                  <div className="rounded-lg border p-2.5 shadow-sm bg-white dark:bg-[#12161a]" style={{ borderColor: theme.border }}>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                      {activeType === 'cash_payment' ? 'Instrument / Payment Details (Optional)' : 'Instrument / Receipt Details (Optional)'}
                    </h3>
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-12 md:col-span-2">
                        <SearchableDropdown
                          label={activeType === 'cash_payment' ? "Payment Mode" : "Receipt Mode"}
                          placeholder="Select"
                          value={form.transType || (paymentMode === 'cash' ? 'Cash' : 'Bank')}
                          onChange={val => {
                            setFormValue('transType', val);
                          }}
                          options={['Cash', 'Bank', 'Others']}
                          compact
                        />
                      </div>
                      <div className="col-span-12 md:col-span-2">
                        <InputField
                          label="Instrument Date"
                          type="date"
                          value={form.instDate || ''}
                          onChange={val => setFormValue('instDate', val)}
                          Icon={Calendar}
                          compact
                        />
                      </div>
                      <div className="col-span-12 md:col-span-2">
                        <InputField
                          label="Instrument No."
                          placeholder="Enter Instrument No."
                          value={form.instNumber || ''}
                          onChange={val => setFormValue('instNumber', val)}
                          compact
                        />
                      </div>
                      <div className="col-span-12 md:col-span-4">
                        <InputField
                          label="Narration"
                          placeholder="Enter narration (optional)"
                          value={form.narration || ''}
                          onChange={val => setFormValue('narration', val)}
                          compact
                        />
                      </div>
                      <div className="col-span-12 md:col-span-2">
                        <InputField
                          label="Amount (₹)"
                          value={totalLedgerAmountVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          readOnly
                          compact
                        />
                      </div>
                      {(form.transType || (paymentMode === 'cash' ? 'Cash' : 'Bank')) === 'Bank' && (
                        <>
                          <div className="col-span-12 md:col-span-4">
                            <InputField
                              label="Bank Name"
                              placeholder="Enter Bank Name"
                              value={form.bankName || ''}
                              onChange={val => setFormValue('bankName', val)}
                              compact
                            />
                          </div>
                          <div className="col-span-12 md:col-span-4">
                            <InputField
                              label="IFSC Code"
                              placeholder="Enter IFSC Code"
                              value={form.ifscCode || ''}
                              onChange={val => setFormValue('ifscCode', val)}
                              compact
                            />
                          </div>
                          <div className="col-span-12 md:col-span-4">
                            <InputField
                              label="Account Number"
                              placeholder="Enter Account Number"
                              value={form.accountNumber || ''}
                              onChange={val => setFormValue('accountNumber', val)}
                              compact
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Footer Message */}
                  <div className={`flex items-center gap-1.5 font-bold text-[11px] p-1.5 border border-dashed rounded ${isValidated
                      ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50/20 dark:bg-emerald-950/10 border-emerald-500/20'
                      : 'text-rose-600 dark:text-rose-400 bg-rose-50/20 dark:bg-rose-950/10 border-rose-500/20'
                    }`}>
                    {isValidated ? <CheckCircle2 size={12} /> : <X size={12} />}
                    <span>
                      {isValidated
                        ? "Total Ledger Amount is equal to Total Allocated Amount. You can review and post the voucher."
                        : (activeType === 'cash_payment'
                          ? "Outstanding allocations must match the ledger row amounts."
                          : "Total Allocated Receipt Amount must be equal to Total Receipt Amount.")
                      }
                    </span>
                  </div>
                </div>
              );
            }

            const partyOutstanding = selectedPartyDetails?.pendingBills && selectedPartyDetails.pendingBills.length > 0
              ? selectedPartyDetails.pendingBills.reduce((acc, b) => acc + (parseFloat(b.pendingAmount) || 0), 0)
              : (selectedPartyDetails?.outstandingBalance || 0);

            const totalAllocated = (form.billRows || []).reduce((acc, r) => acc + (parseFloat(r.allocationAmount) || 0), 0);
            const totalUnallocated = Math.max(0, partyOutstanding - totalAllocated);

            const tableHeaderActions = (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={addBillRow}
                  className="px-2.5 py-1 rounded-none border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 text-[9.5px] font-black uppercase flex items-center gap-1 transition-all"
                >
                  <Plus size={10} strokeWidth={3} /> Add Line
                </button>
                <button
                  type="button"
                  onClick={() => toast.info('Add Ledger option clicked (Not implemented)')}
                  className="px-2.5 py-1 rounded-none border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 text-[9.5px] font-black uppercase flex items-center gap-1 transition-all"
                >
                  <Plus size={10} strokeWidth={3} /> Add Ledger
                </button>
                <button
                  type="button"
                  onClick={() => toast.info('Add Item option clicked (Not implemented)')}
                  className="px-2.5 py-1 rounded-none border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 text-[9.5px] font-black uppercase flex items-center gap-1 transition-all"
                >
                  <Plus size={10} strokeWidth={3} /> Add Item
                </button>
              </div>
            );

            return (
              <div className="flex flex-col gap-3 pb-4 w-full">
                {/* Voucher Details Card */}
                <FormSection title="Voucher Details" zIndex={100}>
                  <div className="flex flex-col gap-3">
                    {/* Row 1 */}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5">
                      <InputField
                        label="Voucher No."
                        placeholder={form.voucherNumberSeries === 'Manual' ? 'Enter Voucher No.' : 'Auto'}
                        value={form.voucherNumber || ''}
                        readOnly={form.voucherNumberSeries !== 'Manual'}
                        onChange={val => setFormValue('voucherNumber', val)}
                        compact
                      />
                      <InputField
                        label="* Voucher Date"
                        type="date"
                        value={form.voucherDate || ''}
                        onChange={val => setFormValue('voucherDate', val)}
                        Icon={Calendar}
                        compact
                      />
                      <SearchableDropdown
                        label={activeType === 'bank_payment' ? "* Receipt Mode" : "* Payment Mode"}
                        placeholder="Select Cash/Bank"
                        value={paymentMode === 'bank' ? 'Bank' : 'Cash'}
                        onChange={val => handlePaymentModeChange(val.toLowerCase())}
                        options={['Cash', 'Bank']}
                        compact
                      />
                      {paymentMode === 'bank' && (
                        <SearchableDropdown
                          label="* Bank Account"
                          placeholder="Select Bank Account"
                          value={form.againstLedger || ''}
                          onChange={handleAgainstLedgerChange}
                          options={finalBankLedgers}
                          compact
                        />
                      )}
                      <InputField
                        label="Reference No."
                        placeholder="e.g. PAY-001"
                        value={form.referenceNumber || ''}
                        onChange={val => setFormValue('referenceNumber', val)}
                        compact
                      />
                    </div>

                    {/* Party Details (Merged Inside Voucher Details) */}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5 items-end pt-2 border-t border-dashed" style={{ borderColor: theme.border }}>
                      <SearchableDropdown
                        label="* Party Ledger"
                        placeholder="Select Party Ledger"
                        value={form.partyLedger || ''}
                        onChange={val => {
                          setFormValue('partyLedger', val);
                          fetchPartyDetails(val);
                        }}
                        options={finalPartyLedgers}
                        compact
                      />
                      <InputField
                        label="Ledger Group"
                        value={selectedPartyDetails?.groupName || ''}
                        readOnly
                        compact
                      />
                      <InputField
                        label="GST Number"
                        value={selectedPartyDetails?.gstin || ''}
                        readOnly
                        compact
                      />
                      <InputField
                        label="Current Balance"
                        value={selectedPartyDetails ? `₹ ${(selectedPartyDetails.outstandingBalance || 0).toLocaleString('en-IN')} ${selectedPartyDetails.outstandingType || ''}` : ''}
                        readOnly
                        compact
                      />
                      <div className="flex items-center gap-2">
                        <InputField
                          label={activeType === 'bank_payment' ? "Outstanding Invoices" : "Outstanding Bills"}
                          value={String(selectedPartyDetails?.pendingBills?.length || 0)}
                          readOnly
                          compact
                        />
                        {selectedPartyDetails?.pendingBills?.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setShowBillAllocation(true)}
                            className="px-3 py-1.5 border text-[9px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all flex items-center gap-1 shrink-0 mt-1"
                            style={{ borderColor: theme.border }}
                          >
                            <Eye size={10} /> {activeType === 'bank_payment' ? "View Invoices" : "View Bills"}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Bank instrument details */}
                    {paymentMode === 'bank' && (
                      <div className="pt-2 border-t border-dashed flex flex-col gap-2.5" style={{ borderColor: theme.border }}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          <SearchableDropdown
                            label="* Transaction Type"
                            placeholder="Select Transaction Type"
                            value={form.transType || ''}
                            onChange={val => setFormValue('transType', val)}
                            options={['Inter Bank Transfer', 'NEFT', 'RTGS', 'IMPS', 'UPI', 'Cheque', 'DD']}
                            compact
                          />
                          <InputField
                            label="* Amount"
                            type="number"
                            placeholder="0"
                            value={form.amount || '0'}
                            readOnly
                            align="right"
                            compact
                          />
                        </div>
                        {form.transType && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                            {/* Cheque / DD fields */}
                            {(form.transType === 'Cheque' || form.transType === 'DD') && (
                              <>
                                <InputField
                                  label="* Cheque/DD No."
                                  placeholder="Enter Cheque/DD No."
                                  value={form.instNumber || ''}
                                  onChange={val => setFormValue('instNumber', val)}
                                  compact
                                />
                                <InputField
                                  label="* Cheque/DD Date"
                                  type="date"
                                  value={form.instDate || ''}
                                  onChange={val => setFormValue('instDate', val)}
                                  Icon={Calendar}
                                  compact
                                />
                                <InputField
                                  label="* Bank Name"
                                  placeholder="Enter Bank Name"
                                  value={form.bankName || ''}
                                  onChange={val => setFormValue('bankName', val)}
                                  compact
                                />
                              </>
                            )}

                            {/* UPI fields */}
                            {form.transType === 'UPI' && (
                              <>
                                <InputField
                                  label="* Transaction ID / UPI Ref"
                                  placeholder="Enter Transaction ID"
                                  value={form.instNumber || ''}
                                  onChange={val => setFormValue('instNumber', val)}
                                  compact
                                />
                                <InputField
                                  label="* Transaction Date"
                                  type="date"
                                  value={form.instDate || ''}
                                  onChange={val => setFormValue('instDate', val)}
                                  Icon={Calendar}
                                  compact
                                />
                              </>
                            )}

                            {/* NEFT / RTGS / IMPS / Inter Bank Transfer fields */}
                            {(form.transType === 'NEFT' || form.transType === 'RTGS' || form.transType === 'IMPS' || form.transType === 'Inter Bank Transfer') && (
                              <>
                                <InputField
                                  label="* UTR / Instrument No."
                                  placeholder="Enter UTR/Inst No."
                                  value={form.instNumber || ''}
                                  onChange={val => setFormValue('instNumber', val)}
                                  compact
                                />
                                <InputField
                                  label="* Instrument Date"
                                  type="date"
                                  value={form.instDate || ''}
                                  onChange={val => setFormValue('instDate', val)}
                                  Icon={Calendar}
                                  compact
                                />
                                <InputField
                                  label="* Bank Name"
                                  placeholder="Enter Bank Name"
                                  value={form.bankName || ''}
                                  onChange={val => setFormValue('bankName', val)}
                                  compact
                                />
                                <InputField
                                  label="* Account No."
                                  placeholder="Enter Account No."
                                  value={form.accountNumber || ''}
                                  onChange={val => setFormValue('accountNumber', val)}
                                  compact
                                />
                                <InputField
                                  label="* IFSC Code"
                                  placeholder="Enter IFSC Code"
                                  value={form.ifscCode || ''}
                                  onChange={val => setFormValue('ifscCode', val)}
                                  compact
                                />
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Row 3 */}
                    <div className="grid grid-cols-1 gap-2.5 pt-2 border-t border-dashed" style={{ borderColor: theme.border }}>
                      <InputField
                        label="Narration"
                        placeholder="Enter detailed narration here..."
                        value={form.narration || ''}
                        onChange={val => setFormValue('narration', val)}
                        compact
                      />
                    </div>
                  </div>
                </FormSection>

                {/* Transaction Details Table */}
                <FormSection title="Transaction Details" zIndex={92}>
                  <div className="overflow-x-auto themed-scrollbar border" style={{ borderColor: theme.border }}>
                    <table className="w-full text-left border-collapse min-w-[800px]">
                      <thead>
                        <tr style={{ backgroundColor: theme.headerBg }}>
                          <th className="p-2 border text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 w-12 text-center" style={{ borderColor: theme.border }}>#</th>
                          <th className="p-2 border text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400" style={{ borderColor: theme.border }}>Ledger Name *</th>
                          <th className="p-2 border text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400" style={{ borderColor: theme.border }}>Description</th>
                          <th className="p-2 border text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 w-44 text-right" style={{ borderColor: theme.border }}>Amount (₹)</th>
                          <th className="p-2 border text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 w-40" style={{ borderColor: theme.border }}>Cost Center</th>
                          <th className="p-2 border text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 w-16 text-center" style={{ borderColor: theme.border }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(form.ledgerRows || []).map((row, idx) => (
                          <tr key={row.id || idx} className="hover:bg-slate-50/20">
                            <td className="p-1 border text-center" style={{ borderColor: theme.border }}>
                              <span className="text-[11px] font-bold text-slate-400">{idx + 1}</span>
                            </td>
                            <td className="p-1 border" style={{ borderColor: theme.border }}>
                              <select
                                value={row.ledgerName || ''}
                                onChange={e => updateLedgerRow(idx, 'ledgerName', e.target.value)}
                                className="w-full h-7 px-2 border text-[11px] font-bold outline-none rounded-none"
                                style={{ borderColor: isDark ? '#475569' : '#94a3b8', color: theme.text, backgroundColor: theme.inputBg }}
                              >
                                <option value="" disabled style={{ color: '#94a3b8' }}>Select Ledger...</option>
                                {ledgersRaw.map((l, i) => {
                                  const name = typeof l === 'string' ? l : l.name;
                                  return <option key={i} value={name}>{name}</option>;
                                })}
                              </select>
                            </td>
                            <td className="p-1 border" style={{ borderColor: theme.border }}>
                              <input
                                type="text"
                                placeholder="Enter description"
                                value={row.description || ''}
                                onChange={e => updateLedgerRow(idx, 'description', e.target.value)}
                                className="w-full h-7 px-2 border text-[11px] font-bold outline-none rounded-none"
                                style={{ borderColor: isDark ? '#475569' : '#94a3b8', color: theme.text, backgroundColor: theme.inputBg }}
                              />
                            </td>
                            <td className="p-1 border text-right" style={{ borderColor: theme.border }}>
                              <input
                                type="number"
                                placeholder="0.00"
                                value={row.amount || ''}
                                onChange={e => updateLedgerRow(idx, 'amount', e.target.value)}
                                className="w-full h-7 px-2 border text-[11px] font-black outline-none rounded-none text-right"
                                style={{ borderColor: isDark ? '#475569' : '#94a3b8', color: theme.text, backgroundColor: theme.inputBg }}
                              />
                            </td>
                            <td className="p-1 border" style={{ borderColor: theme.border }}>
                              <select
                                value={row.costCenter || ''}
                                onChange={e => updateLedgerRow(idx, 'costCenter', e.target.value)}
                                className="w-full h-7 px-2 border text-[11px] font-bold outline-none rounded-none"
                                style={{ borderColor: isDark ? '#475569' : '#94a3b8', color: theme.text, backgroundColor: theme.inputBg }}
                              >
                                <option value="">Select...</option>
                                {(masterData?.costCenters || []).map((cc, i) => (
                                  <option key={i} value={cc.name || cc}>{cc.name || cc}</option>
                                ))}
                              </select>
                            </td>
                            <td className="p-1 border text-center" style={{ borderColor: theme.border }}>
                              <button
                                type="button"
                                onClick={() => removeLedgerRow(row.id)}
                                className="text-red-500 hover:text-red-700 transition-colors p-1"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <button
                      type="button"
                      onClick={addLedgerRow}
                      className="px-3 py-1.5 rounded-none border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 text-[9.5px] font-black uppercase flex items-center gap-1 transition-all"
                    >
                      <Plus size={10} strokeWidth={3} /> Add Ledger
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Ledger Amount:</span>
                      <span className="text-[14px] font-black text-emerald-600 dark:text-emerald-400">
                        ₹ {(form.ledgerRows || []).reduce((acc, r) => acc + (parseFloat(r.amount) || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </FormSection>

                {/* Receipt/Payment Allocation Details Card */}
                {activeType === 'bank_payment' ? (
                  hasOutstandingBills ? (
                    <FormSection
                      title="Receipt Allocation"
                      zIndex={90}
                      showCheckbox={true}
                      checkboxChecked={showBillAllocation}
                      onCheckboxChange={(checked) => {
                        setShowBillAllocation(checked);
                      }}
                    >
                      <div className="flex flex-col gap-3">
                        <div className="overflow-x-auto themed-scrollbar border" style={{ borderColor: theme.border }}>
                          <table className="w-full text-left border-collapse min-w-[800px]">
                            <thead>
                              <tr style={{ backgroundColor: theme.headerBg }}>
                                <th className="p-2 border text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 w-16 text-center" style={{ borderColor: theme.border }}>#</th>
                                <th className="p-2 border text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400" style={{ borderColor: theme.border }}>Invoice No</th>
                                <th className="p-2 border text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 w-36" style={{ borderColor: theme.border }}>Invoice Date</th>
                                <th className="p-2 border text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 w-48 text-right" style={{ borderColor: theme.border }}>Pending Amount (₹)</th>
                                <th className="p-2 border text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 w-48 text-right" style={{ borderColor: theme.border }}>Receiving Amount (₹)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(form.billRows || []).map((row, idx) => {
                                return (
                                  <tr key={row.id || idx} className="hover:bg-slate-50/20">
                                    <td className="p-2 border text-center" style={{ borderColor: theme.border }}>
                                      <span className="text-[11px] font-bold text-slate-400">{idx + 1}</span>
                                    </td>
                                    <td className="p-2 border font-bold text-[11px]" style={{ borderColor: theme.border, color: theme.text }}>
                                      {row.billNo || '—'}
                                    </td>
                                    <td className="p-2 border text-slate-500 text-[11px] font-bold" style={{ borderColor: theme.border }}>
                                      {row.date || '—'}
                                    </td>
                                    <td className="p-2 border text-right font-bold text-[11px]" style={{ borderColor: theme.border, color: theme.text }}>
                                      ₹ {(row.pendingAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-2 border text-right" style={{ borderColor: theme.border }}>
                                      <input
                                        type="number"
                                        placeholder="0.00"
                                        value={row.allocationAmount || ''}
                                        onChange={e => handleAllocationChange(idx, e.target.value)}
                                        className="w-full h-8 px-2 border text-[11px] font-black outline-none rounded-none text-right"
                                        style={{
                                          borderColor: isDark ? '#475569' : '#94a3b8',
                                          color: theme.text,
                                          backgroundColor: theme.inputBg
                                        }}
                                      />
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Overpayment Options selector for Receipts */}
                        {parseFloat(form.amount) > totalAllocated && (
                          <div className="p-3 border border-dashed flex flex-col md:flex-row justify-between items-center gap-3 bg-amber-50/10 dark:bg-amber-950/5" style={{ borderColor: '#f59e0b40' }}>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[10px] font-black uppercase tracking-wider text-amber-500">Excess Receipt Detected</span>
                              <span className="text-[11px] font-bold" style={{ color: theme.text }}>
                                Receipt amount is ₹ {(parseFloat(form.amount) - totalAllocated).toLocaleString('en-IN', { minimumFractionDigits: 2 })} more than invoice allocations.
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[9.5px] font-black uppercase text-slate-400">Handle excess as:</span>
                              <select
                                value={form.excessOption || ''}
                                onChange={e => setFormValue('excessOption', e.target.value)}
                                className="h-8 px-2 border text-[11px] font-black outline-none rounded-none w-48"
                                style={{
                                  borderColor: isDark ? '#475569' : '#cbd5e1',
                                  color: theme.text,
                                  backgroundColor: theme.inputBg
                                }}
                              >
                                <option value="" disabled style={{ color: '#94a3b8' }}>Select option...</option>
                                <option value="advance">Keep As Advance</option>
                                <option value="on_account">On Account Receipt</option>
                                <option value="refund">Refund Later</option>
                              </select>
                            </div>
                          </div>
                        )}

                        {/* Bottom Allocation actions and totals */}
                        <div className="flex flex-col md:flex-row justify-between items-end gap-4 mt-4">
                          <div>
                            <button
                              type="button"
                              onClick={handleAiAutoAllocate}
                              className="px-4 py-2 border border-indigo-600/35 bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600/20 text-[10px] font-black uppercase flex items-center gap-1.5 transition-all shadow-sm"
                            >
                              AI-Auto Allocate Pending
                            </button>
                          </div>
                          <div className="flex flex-col items-end gap-2 text-right">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Receipt:</span>
                              <span className="text-[14px] font-black" style={{ color: theme.text }}>
                                ₹ {totalAllocated.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Unallocated:</span>
                              <span className="text-[14px] font-black text-rose-500">
                                ₹ {totalUnallocated.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </FormSection>
                  ) : form.partyLedger ? (
                    <div className="text-center py-2.5">
                      <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/10 border border-dashed border-amber-200/50 p-3">
                        No pending invoices available for allocation.
                      </p>
                    </div>
                  ) : (
                    <div className="text-center py-2.5">
                      <p className="text-[11px] font-bold text-slate-400 italic">
                        Please select a party ledger.
                      </p>
                    </div>
                  )
                ) : (
                  <FormSection
                    title="Bill Allocation"
                    zIndex={90}
                    showCheckbox={true}
                    checkboxChecked={showBillAllocation}
                    onCheckboxChange={(checked) => {
                      setShowBillAllocation(checked);
                    }}
                  >
                    {!form.partyLedger ? (
                      <div className="p-2 text-center text-[10px] text-slate-400 font-medium italic">
                        Please select a party ledger.
                      </div>
                    ) : selectedPartyDetails?.pendingBills && selectedPartyDetails.pendingBills.length > 0 ? (
                      <div className="flex flex-col gap-3">
                        <div className="overflow-x-auto themed-scrollbar border" style={{ borderColor: theme.border }}>
                          <table className="w-full text-left border-collapse min-w-[800px]">
                            <thead>
                              <tr style={{ backgroundColor: theme.headerBg }}>
                                <th className="p-2 border text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 w-16 text-center" style={{ borderColor: theme.border }}>#</th>
                                <th className="p-2 border text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400" style={{ borderColor: theme.border }}>Bill No</th>
                                <th className="p-2 border text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 w-36" style={{ borderColor: theme.border }}>Bill Date</th>
                                <th className="p-2 border text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 w-48 text-right" style={{ borderColor: theme.border }}>Pending Amount (₹)</th>
                                <th className="p-2 border text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 w-48 text-right" style={{ borderColor: theme.border }}>Paying Amount (₹)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(form.billRows || []).map((row, idx) => {
                                return (
                                  <tr key={row.id || idx} className="hover:bg-slate-50/20">
                                    <td className="p-2 border text-center" style={{ borderColor: theme.border }}>
                                      <span className="text-[11px] font-bold text-slate-400">{idx + 1}</span>
                                    </td>
                                    <td className="p-2 border font-bold text-[11px]" style={{ borderColor: theme.border, color: theme.text }}>
                                      {row.billNo || '—'}
                                    </td>
                                    <td className="p-2 border text-slate-500 text-[11px] font-bold" style={{ borderColor: theme.border }}>
                                      {row.date || '—'}
                                    </td>
                                    <td className="p-2 border text-right font-bold text-[11px]" style={{ borderColor: theme.border, color: theme.text }}>
                                      ₹ {(row.pendingAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-2 border text-right" style={{ borderColor: theme.border }}>
                                      <input
                                        type="number"
                                        placeholder="0.00"
                                        value={row.allocationAmount || ''}
                                        onChange={e => handleAllocationChange(idx, e.target.value)}
                                        className="w-full h-8 px-2 border text-[11px] font-black outline-none rounded-none text-right"
                                        style={{
                                          borderColor: isDark ? '#475569' : '#94a3b8',
                                          color: theme.text,
                                          backgroundColor: theme.inputBg
                                        }}
                                      />
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Bottom Allocation actions and totals */}
                        <div className="flex flex-col md:flex-row justify-between items-end gap-4 mt-4">
                          <div>
                            <button
                              type="button"
                              onClick={handleAiAutoAllocate}
                              className="px-4 py-2 border border-indigo-600/35 bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600/20 text-[10px] font-black uppercase flex items-center gap-1.5 transition-all shadow-sm"
                            >
                              AI-Auto Allocate Pending
                            </button>
                          </div>
                          <div className="flex flex-col items-end gap-2 text-right">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Payment:</span>
                              <span className="text-[14px] font-black" style={{ color: theme.text }}>
                                ₹ {totalAllocated.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Unallocated:</span>
                              <span className="text-[14px] font-black text-rose-500">
                                ₹ {totalUnallocated.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-2.5">
                        <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/10 border border-dashed border-amber-200/50 p-3">
                          No pending bills for this party
                        </p>
                      </div>
                    )}
                  </FormSection>
                )}

                {/* Lower Section 3-Column Grid for Cost Center, GST, and TDS */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  {/* Cost Center Card */}
                  <FormSection
                    title="Cost Center Allocation"
                    showCheckbox={true}
                    checkboxChecked={form.costCenterApplicable || false}
                    onCheckboxChange={(checked) => {
                      setFormValue('costCenterApplicable', checked);
                      if (!checked) {
                        setFormValue('costCategory', '');
                        setFormValue('costCenter', '');
                        setFormValue('costAmount', 0);
                        setFormValue('costCenters', []);
                      } else {
                        const categories = masterData?.costCategories || [];
                        const centers = masterData?.costCenters || [];
                        const defaultCategory = categories[0] || 'Primary Cost Category';
                        const filtered = centers.filter(c => c.category === defaultCategory);
                        const defaultCenter = (filtered[0] || centers[0])?.name || '';
                        const amt = parseFloat(form.amount) || 0;
                        setFormValue('costCategory', defaultCategory);
                        setFormValue('costCenter', defaultCenter);
                        setFormValue('costAmount', amt);
                        setFormValue('costCenters', [{ category: defaultCategory, name: defaultCenter, amount: amt }]);
                      }
                    }}
                    zIndex={30}
                  >
                    <div className="grid grid-cols-1 gap-2.5">
                      <SearchableDropdown
                        label="Cost Category"
                        placeholder="Select Category"
                        value={form.costCategory || (form.costCenters?.[0]?.category || '')}
                        onChange={val => {
                          setFormValue('costCategory', val);
                          const currentCenter = form.costCenter || (form.costCenters?.[0]?.name || '');
                          const currentAmount = parseFloat(form.costAmount || (form.costCenters?.[0]?.amount || 0));
                          setFormValue('costCenters', [{ category: val, name: currentCenter, amount: currentAmount }]);
                        }}
                        options={costCategoriesOptions}
                        compact
                      />
                      <SearchableDropdown
                        label="Cost Center"
                        placeholder="Select Center"
                        value={form.costCenter || (form.costCenters?.[0]?.name || '')}
                        onChange={val => {
                          setFormValue('costCenter', val);
                          const currentCategory = form.costCategory || (form.costCenters?.[0]?.category || '');
                          const currentAmount = parseFloat(form.costAmount || (form.costCenters?.[0]?.amount || 0));
                          setFormValue('costCenters', [{ category: currentCategory, name: val, amount: currentAmount }]);
                        }}
                        options={filteredCostCenters}
                        compact
                      />
                      <InputField
                        label="Allocation Amount (₹)"
                        type="number"
                        placeholder="0.00"
                        value={form.costAmount || (form.costCenters?.[0]?.amount || '')}
                        onChange={val => {
                          setFormValue('costAmount', val);
                          const currentCategory = form.costCategory || (form.costCenters?.[0]?.category || '');
                          const currentCenter = form.costCenter || (form.costCenters?.[0]?.name || '');
                          setFormValue('costCenters', [{ category: currentCategory, name: currentCenter, amount: parseFloat(val) || 0 }]);
                        }}
                        align="right"
                        compact
                      />
                    </div>
                  </FormSection>

                  {/* GST Details Card */}
                  <FormSection
                    title="GST Details"
                    showCheckbox={true}
                    checkboxChecked={form.gstApplicable || false}
                    onCheckboxChange={(checked) => {
                      setFormValue('gstApplicable', checked);
                      if (!checked) {
                        setFormValue('gstLedger', '');
                        setFormValue('gstRate', '');
                      } else {
                        const defaultGstLedger = masterData?.gstLedgers?.[0] || 'CGST @ 9%';
                        const defaultGstRate = masterData?.gstRates?.[0] || '18%';
                        setFormValue('gstLedger', typeof defaultGstLedger === 'object' ? defaultGstLedger.name : defaultGstLedger);
                        setFormValue('gstRate', defaultGstRate);
                      }
                    }}
                    zIndex={20}
                  >
                    <div className="grid grid-cols-1 gap-2.5">
                      <SearchableDropdown
                        label="GST Ledger"
                        placeholder="GST Ledger"
                        value={form.gstLedger || ''}
                        onChange={val => setFormValue('gstLedger', val)}
                        options={masterData?.gstLedgers || []}
                        compact
                      />
                      <SearchableDropdown
                        label="GST Rate"
                        placeholder="GST Rate"
                        value={form.gstRate || ''}
                        onChange={val => setFormValue('gstRate', val)}
                        options={masterData?.gstRates || []}
                        compact
                      />
                    </div>
                  </FormSection>

                  {/* TDS Details Card */}
                  <FormSection
                    title="TDS Details"
                    showCheckbox={true}
                    checkboxChecked={form.tdsApplicable || false}
                    onCheckboxChange={(checked) => {
                      setFormValue('tdsApplicable', checked);
                      if (!checked) {
                        setFormValue('tdsLedger', '');
                        setFormValue('tdsRate', '');
                      } else {
                        const defaultTdsLedger = masterData?.tdsLedgers?.[0] || 'TDS Payable';
                        const defaultTdsRate = masterData?.tdsRates?.[0] || '10%';
                        setFormValue('tdsLedger', typeof defaultTdsLedger === 'object' ? defaultTdsLedger.name : defaultTdsLedger);
                        setFormValue('tdsRate', defaultTdsRate);
                      }
                    }}
                    zIndex={10}
                  >
                    <div className="grid grid-cols-1 gap-2.5">
                      <SearchableDropdown
                        label="TDS Ledger"
                        placeholder="TDS Ledger"
                        value={form.tdsLedger || ''}
                        onChange={val => setFormValue('tdsLedger', val)}
                        options={masterData?.tdsLedgers || []}
                        compact
                      />
                      <SearchableDropdown
                        label="TDS %"
                        placeholder="TDS %"
                        value={form.tdsRate || ''}
                        onChange={val => setFormValue('tdsRate', val)}
                        options={masterData?.tdsRates || []}
                        compact
                      />
                    </div>
                  </FormSection>
                </div>
              </div>
            );
          })() : activeType === 'contra' ? (() => {
            const getAccountType = (ledgerName) => {
              const ledger = ledgersRaw.find(l => (l.name || l) === ledgerName);
              if (!ledger) return '--';
              const g = ledger.groupName || '';
              if (g === 'Cash-in-Hand') return 'Cash';
              if (g === 'Bank Accounts' || g === 'Bank OD A/c') return 'Bank';
              return '--';
            };

            const sourceAmt = parseFloat(form.transferAmount) || 0;
            const destAmt = parseFloat(form.amountReceived) || 0;
            const differenceVal = Math.abs(sourceAmt - destAmt);
            const isBalanced = differenceVal === 0 && sourceAmt > 0;
            const statusLabel = isBalanced ? "Balanced" : "Unbalanced";

            const formatCur = (val) => `₹ ${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

            return (
              <div className="flex flex-col gap-2 pb-2 w-full">
                {/* Voucher Details Card */}
                <FormSection title="Voucher Details" zIndex={100} defaultOpen={true}>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                    <InputField
                      label="Voucher No."
                      placeholder={form.voucherNumberSeries === 'Manual' ? 'Enter Voucher No.' : 'Auto'}
                      value={form.voucherNumber || ''}
                      readOnly={form.voucherNumberSeries !== 'Manual'}
                      onChange={val => setFormValue('voucherNumber', val)}
                      compact
                    />
                    <InputField
                      label="Date"
                      type="date"
                      value={form.voucherDate || ''}
                      onChange={val => setFormValue('voucherDate', val)}
                      Icon={Calendar}
                      compact
                    />
                    <SearchableDropdown
                      label="Voucher Type"
                      placeholder="Select Type"
                      value={getSelectValue()}
                      onChange={val => setFormValue('voucherType', val)}
                      options={getVoucherTypeOptions()}
                      compact
                    />
                    <InputField
                      label="Narration"
                      placeholder="Enter narration (optional)"
                      value={form.narration || ''}
                      onChange={val => setFormValue('narration', val)}
                      compact
                    />
                  </div>
                </FormSection>

                {/* Accounts & Voucher Summary Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 items-stretch animate-in fade-in duration-200">
                  {/* Accounts Card */}
                  <div className="lg:col-span-8 flex flex-col">
                    <FormSection title="ACCOUNTS" zIndex={90} className="h-full flex-1">
                      <div className="flex flex-col md:flex-row items-center gap-2">
                        {/* Green DR Panel */}
                        <div
                          className="flex-1 w-full rounded-lg border p-2.5 flex flex-col gap-2"
                          style={{
                            borderColor: isDark ? 'rgba(16, 185, 129, 0.2)' : '#a7f3d0',
                            backgroundColor: isDark ? 'rgba(16, 185, 129, 0.03)' : '#f0fdf4'
                          }}
                        >
                          <h4 className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                            (DR) SOURCE ACCOUNT
                          </h4>
                          <div className="flex flex-col gap-2">
                            <SearchableDropdown
                              label="Ledger Name *"
                              placeholder="Select Ledger (Cash/Bank)"
                              value={form.sourceLedger || ''}
                              onChange={val => {
                                setFormValue('sourceLedger', val);
                                fetchCashBankBalance(val, 'cash');
                              }}
                              options={cashAndBankLedgers}
                              compact
                            />
                            <InputField
                              label="Account Type"
                              value={getAccountType(form.sourceLedger)}
                              readOnly
                              disabled
                              compact
                            />
                            <InputField
                              label="Amount (₹) *"
                              type="number"
                              placeholder="Enter amount"
                              value={form.transferAmount || ''}
                              onChange={val => setFormValue('transferAmount', val)}
                              compact
                            />
                          </div>
                        </div>

                        {/* Middle Arrow */}
                        <ArrowRight className="text-slate-400 shrink-0 hidden md:block" size={20} />
                        <ChevronDown className="text-slate-400 shrink-0 md:hidden" size={20} />

                        {/* Blue CR Panel */}
                        <div
                          className="flex-1 w-full rounded-lg border p-2.5 flex flex-col gap-2"
                          style={{
                            borderColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#bfdbfe',
                            backgroundColor: isDark ? 'rgba(59, 130, 246, 0.03)' : '#eff6ff'
                          }}
                        >
                          <h4 className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
                            (CR) DESTINATION ACCOUNT
                          </h4>
                          <div className="flex flex-col gap-2">
                            <SearchableDropdown
                              label="Ledger Name *"
                              placeholder="Select Ledger (Cash/Bank)"
                              value={form.destinationLedger || ''}
                              onChange={val => {
                                setFormValue('destinationLedger', val);
                                fetchCashBankBalance(val, 'bank');
                              }}
                              options={cashAndBankLedgers}
                              compact
                            />
                            <InputField
                              label="Account Type"
                              value={getAccountType(form.destinationLedger)}
                              readOnly
                              disabled
                              compact
                            />
                            <InputField
                              label="Amount (₹) *"
                              type="number"
                              placeholder="Enter amount"
                              value={form.amountReceived || ''}
                              onChange={val => setFormValue('amountReceived', val)}
                              compact
                            />
                          </div>
                        </div>
                      </div>
                    </FormSection>
                  </div>

                  {/* Voucher Summary Card */}
                  <div className="lg:col-span-4 flex flex-col">
                    <FormSection title="VOUCHER SUMMARY" zIndex={80} className="h-full flex-1">
                      <div className="flex flex-col gap-1.5 text-[10px] h-full justify-between py-1">
                        <div className="flex flex-col gap-2">
                          <div className="flex justify-between items-center py-1 border-b border-dashed" style={{ borderColor: theme.border }}>
                            <span className="text-slate-400 font-bold">Source Amount (Dr)</span>
                            <span className="font-extrabold text-emerald-600 dark:text-emerald-400">{formatCur(sourceAmt)}</span>
                          </div>
                          <div className="flex justify-between items-center py-1 border-b border-dashed" style={{ borderColor: theme.border }}>
                            <span className="text-slate-400 font-bold">Destination Amount (Cr)</span>
                            <span className="font-extrabold text-blue-600 dark:text-blue-400">{formatCur(destAmt)}</span>
                          </div>
                          <div className="flex justify-between items-center py-1 border-b border-dashed" style={{ borderColor: theme.border }}>
                            <span className="text-slate-400 font-bold">Difference</span>
                            <span className="font-extrabold text-rose-500">{formatCur(differenceVal)}</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center pt-2">
                          <span className="text-slate-400 font-black uppercase tracking-wider text-[8px]">Status</span>
                          <span className={`px-2 py-0.5 text-[8.5px] font-black uppercase tracking-wider shadow-sm text-white ${isBalanced ? 'bg-emerald-600' : 'bg-rose-600'}`}>
                            {statusLabel}
                          </span>
                        </div>
                      </div>
                    </FormSection>
                  </div>
                </div>

                {/* Instrument Details Card */}
                <FormSection title="INSTRUMENT DETAILS (If Applicable)" zIndex={70}>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                    <SearchableDropdown
                      label="Instrument Type"
                      placeholder="Select"
                      value={form.transType || ''}
                      onChange={val => setFormValue('transType', val)}
                      options={['Cheque', 'DD', 'NEFT/RTGS', 'UPI', 'Others']}
                      compact
                    />
                    <InputField
                      label="Instrument No."
                      placeholder="Enter instrument no."
                      value={form.instNumber || ''}
                      onChange={val => setFormValue('instNumber', val)}
                      compact
                    />
                    <InputField
                      label="Instrument Date"
                      type="date"
                      value={form.instDate || ''}
                      onChange={val => setFormValue('instDate', val)}
                      Icon={Calendar}
                      compact
                    />
                    <InputField
                      label="Remarks"
                      placeholder="Enter remarks (optional)"
                      value={form.remarks || ''}
                      onChange={val => setFormValue('remarks', val)}
                      compact
                    />
                  </div>
                </FormSection>
              </div>
            );
          })() : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5">


              {/* Column 1: Core Fields (7/12 on lg desktop) */}
              <div className="col-span-1 lg:col-span-7 flex flex-col gap-2 pb-2">

                {/* Voucher Details Card */}
                <FormSection title="Voucher Details" zIndex={100} defaultOpen={true}>
                  {activeType === 'contra' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                      <InputField
                        label="Voucher No."
                        placeholder={form.voucherNumberSeries === 'Manual' ? 'Enter Voucher No.' : 'Auto'}
                        value={form.voucherNumber || ''}
                        readOnly={form.voucherNumberSeries !== 'Manual'}
                        onChange={val => setFormValue('voucherNumber', val)}
                        compact
                      />
                      <InputField
                        label="Date"
                        type="date"
                        value={form.voucherDate || ''}
                        onChange={val => setFormValue('voucherDate', val)}
                        Icon={Calendar}
                        compact
                      />
                      <SearchableDropdown
                        label="Voucher Type"
                        placeholder="Select Type"
                        value={getSelectValue()}
                        onChange={val => setFormValue('voucherType', val)}
                        options={getVoucherTypeOptions()}
                        compact
                      />
                      <InputField
                        label="Narration"
                        placeholder="Enter narration (optional)"
                        value={form.narration || ''}
                        onChange={val => setFormValue('narration', val)}
                        compact
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                      <InputField label="Voucher Date" type="date" value={form.voucherDate || ''} onChange={val => setFormValue('voucherDate', val)} Icon={Calendar} compact />
                      <InputField label="Voucher Number" value={form.voucherNumber || 'AUTO'} readOnly Icon={Hash} compact />
                      <SearchableDropdown
                        label="Voucher Type"
                        placeholder="Select Type"
                        value={getSelectValue()}
                        onChange={val => setFormValue('voucherType', val)}
                        options={getVoucherTypeOptions()}
                        compact
                      />
                      <InputField label="Reference Number" placeholder="e.g. REF-001" value={form.referenceNumber || ''} onChange={val => setFormValue('referenceNumber', val)} compact />
                    </div>
                  )}
                </FormSection>

                {/* Transaction Details Card */}
                <FormSection title="Transaction Details" zIndex={90} defaultOpen={true}>
                  {showContraTransfer ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {/* Contra Source (From) */}
                      <div className="rounded-lg border p-2" style={{ borderColor: theme.border, backgroundColor: isDark ? 'rgba(16, 185, 129, 0.03)' : '#f0fdf4' }}>
                        <h4 className="text-[10px] font-black uppercase tracking-wider text-emerald-600 mb-1.5 flex items-center gap-1">
                          <Wallet size={11} /> Source (From)
                        </h4>
                        <div className="space-y-2">
                          <SearchableDropdown
                            placeholder="Source Ledger (Cash / Bank)"
                            value={form.sourceLedger || ''}
                            onChange={val => {
                              setFormValue('sourceLedger', val);
                              fetchCashBankBalance(val, 'cash');
                            }}
                            options={cashAndBankLedgers}
                            compact
                          />
                          <InputField label="Transfer Amount (₹)" type="number" placeholder="0.00" value={form.transferAmount || ''} onChange={val => setFormValue('transferAmount', val)} align="right" compact />
                        </div>
                      </div>

                      {/* Contra Destination (To) */}
                      <div className="rounded-lg border p-2" style={{ borderColor: theme.border, backgroundColor: isDark ? 'rgba(59, 130, 246, 0.03)' : '#eff6ff' }}>
                        <h4 className="text-[10px] font-black uppercase tracking-wider text-blue-600 mb-1.5 flex items-center gap-1">
                          <Landmark size={11} /> Destination (To)
                        </h4>
                        <div className="space-y-2">
                          <SearchableDropdown
                            placeholder="Destination Ledger (Cash / Bank)"
                            value={form.destinationLedger || ''}
                            onChange={val => {
                              setFormValue('destinationLedger', val);
                              fetchCashBankBalance(val, 'bank');
                            }}
                            options={cashAndBankLedgers}
                            compact
                          />
                          <InputField label="Amount Received (₹)" type="number" placeholder="0.00" value={form.amountReceived || ''} onChange={val => setFormValue('amountReceived', val)} align="right" compact />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {/* Payment Mode (Cash/Bank Selection) */}
                        <div className="flex flex-col gap-1">
                          <label className="text-[9px] md:text-[10px] font-black uppercase tracking-widest leading-none mb-1.5" style={{ color: theme.mutedText }}>Payment Mode</label>
                          <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg w-max border" style={{ borderColor: theme.border }}>
                            <button
                              type="button"
                              onClick={() => handlePaymentModeChange('cash')}
                              className={`px-4 py-1.5 rounded-md text-[10px] font-black tracking-wider uppercase transition-all duration-200 ${paymentMode === 'cash' ? 'bg-[#09B6B9] text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                              Cash
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePaymentModeChange('bank')}
                              className={`px-4 py-1.5 rounded-md text-[10px] font-black tracking-wider uppercase transition-all duration-200 ${paymentMode === 'bank' ? 'bg-[#09B6B9] text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                              Bank
                            </button>
                          </div>
                        </div>

                        {/* Cash or Bank Ledger Dropdown */}
                        {paymentMode === 'cash' ? (
                          <SearchableDropdown
                            label="Cash Ledger"
                            placeholder="Select Cash Ledger"
                            value={form.cashLedger || ''}
                            onChange={val => {
                              setFormValue('cashLedger', val);
                              setFormValue('againstLedger', val);
                              fetchCashBankBalance(val, 'cash');
                            }}
                            options={finalCashLedgers}
                            compact
                          />
                        ) : (
                          <SearchableDropdown
                            label="Bank Ledger"
                            placeholder="Select Bank Ledger"
                            value={form.bankLedger || ''}
                            onChange={val => {
                              setFormValue('bankLedger', val);
                              setFormValue('againstLedger', val);
                              fetchCashBankBalance(val, 'bank');
                            }}
                            options={finalBankLedgers}
                            compact
                          />
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {/* Party Ledger Dropdown */}
                        <SearchableDropdown
                          label={activeType === 'cash_payment' ? 'Party Ledger (Debit/Dr)' : 'Party Ledger (Credit/Cr)'}
                          placeholder="Select Party Ledger"
                          value={form.partyLedger || ''}
                          onChange={val => {
                            setFormValue('partyLedger', val);
                            fetchPartyDetails(val);
                          }}
                          options={finalPartyLedgers}
                          compact
                        />

                        {/* Payment Amount Input */}
                        <InputField
                          label="Payment Amount (₹)"
                          type="number"
                          placeholder="0.00"
                          value={form.amount || ''}
                          onChange={val => {
                            setFormValue('amount', val);
                            const numVal = parseFloat(val) || 0;
                            if (form.billRows && form.billRows.length === 1) {
                              const updatedRows = [...form.billRows];
                              updatedRows[0] = {
                                ...updatedRows[0],
                                allocationAmount: numVal,
                                allocatedAmount: numVal
                              };
                              setFormValue('billRows', updatedRows);
                            }
                          }}
                          align="right"
                          compact
                        />
                      </div>

                      {/* Compact Party Balance Banner */}
                      {selectedPartyDetails && (() => {
                        const partyOutstanding = selectedPartyDetails.pendingBills && selectedPartyDetails.pendingBills.length > 0
                          ? selectedPartyDetails.pendingBills.reduce((acc, b) => acc + (parseFloat(b.pendingAmount) || 0), 0)
                          : (selectedPartyDetails.outstandingBalance || 0);
                        return (
                          <div className="p-2.5 rounded-lg border flex flex-col gap-1.5 text-xs font-bold animate-in fade-in slide-in-from-top-1 duration-200"
                            style={{ backgroundColor: isDark ? 'rgba(9, 182, 185, 0.03)' : '#f0f9fa', borderColor: isDark ? 'rgba(9, 182, 185, 0.1)' : '#cffafe' }}>
                            <div className="flex justify-between items-center text-[10px]">
                              <div className="flex gap-1.5 items-center">
                                <span className="text-[9px] font-black uppercase text-[#09B6B9] tracking-wider">Group:</span>
                                <span style={{ color: theme.text }}>{selectedPartyDetails.groupName}</span>
                              </div>
                              <div className="flex gap-1.5 items-center">
                                <span className="text-[9px] font-black uppercase text-[#09B6B9] tracking-wider">Ledger Balance:</span>
                                <span style={{ color: theme.text }}>
                                  ₹ {selectedPartyDetails.outstandingBalance?.toLocaleString('en-IN')} ({selectedPartyDetails.outstandingType})
                                </span>
                              </div>
                            </div>
                            <div className="flex justify-between items-center border-t pt-1" style={{ borderColor: isDark ? 'rgba(9, 182, 185, 0.08)' : '#cffafe' }}>
                              <span className="text-[9px] font-black uppercase text-indigo-500 tracking-wider">Party Outstanding:</span>
                              <span className="text-[11.5px] font-black text-indigo-600 dark:text-indigo-400">
                                ₹ {partyOutstanding.toLocaleString('en-IN')}
                              </span>
                            </div>
                          </div>
                        );
                      })()}
                      {/* Bank instrument details are shown directly inside the Transaction Details card when Bank is active */}
                      {paymentMode === 'bank' && (
                        <div className="mt-1.5 p-2 rounded-lg border border-dashed bg-slate-50/20 dark:bg-slate-800/5 animate-in fade-in duration-200" style={{ borderColor: theme.border }}>
                          <h4 className="text-[9.5px] md:text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
                            <Landmark size={11} /> Bank Instrument Details
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            <SearchableDropdown label="Trans Type" placeholder="Type" value={form.transType || ''} onChange={val => setFormValue('transType', val)} options={['NEFT', 'RTGS', 'IMPS', 'UPI', 'Cheque', 'DD']} compact />
                            <InputField label="Instrument No" placeholder="Ref No" value={form.instNumber || ''} onChange={val => setFormValue('instNumber', val)} compact />
                            <InputField label="Instrument Date" type="date" value={form.instDate || ''} onChange={val => setFormValue('instDate', val)} Icon={Calendar} compact />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
                            <InputField label="UTR Number" placeholder="UTR..." value={form.utr || ''} onChange={val => setFormValue('utr', val)} compact />
                            <InputField label="IFSC Code" placeholder="IFSC..." value={form.ifscCode || ''} onChange={val => setFormValue('ifscCode', val)} compact />
                            <InputField label="Branch Name" placeholder="Branch..." value={form.branchName || ''} onChange={val => setFormValue('branchName', val)} compact />
                          </div>
                        </div>
                      )}

                      {/* Manual Toggles for Collapsibles */}
                      <div className="mt-1.5 pt-1.5 border-t flex flex-wrap items-center justify-between gap-2" style={{ borderColor: theme.border }}>
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Additional Details</span>
                        <div className="flex flex-wrap gap-2">
                          {isCreditor && (
                            <label className="flex items-center gap-1.5 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={showBillAllocation}
                                onChange={e => {
                                  const checked = e.target.checked;
                                  setShowBillAllocation(checked);
                                  if (checked) {
                                    const voucherAmount = parseFloat(form.amount) || 0;
                                    if (!form.billRows || form.billRows.length === 0) {
                                      setFormValue('billRows', [{
                                        id: Date.now(),
                                        billType: 'Against Ref',
                                        billNo: '',
                                        billRef: '',
                                        date: '',
                                        dueDate: '',
                                        billAmount: 0,
                                        pendingAmount: 0,
                                        allocationAmount: voucherAmount,
                                        allocatedAmount: voucherAmount
                                      }]);
                                    } else if (form.billRows.length === 1) {
                                      const updatedRows = [...form.billRows];
                                      updatedRows[0] = {
                                        ...updatedRows[0],
                                        allocationAmount: voucherAmount,
                                        allocatedAmount: voucherAmount
                                      };
                                      setFormValue('billRows', updatedRows);
                                    }
                                  }
                                }}
                                className="w-3.5 h-3.5 rounded accent-indigo-500 cursor-pointer"
                              />
                              <span className="text-[9.5px] md:text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-slate-200">Bill Allocation</span>
                            </label>
                          )}
                          <label className="flex items-center gap-1.5 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={form.costCenterApplicable || false}
                              onChange={e => {
                                const val = e.target.checked;
                                setFormValue('costCenterApplicable', val);
                                if (!val) {
                                  setFormValue('costCategory', '');
                                  setFormValue('costCenter', '');
                                  setFormValue('costAmount', 0);
                                  setFormValue('costCenters', []);
                                } else {
                                  const categories = masterData?.costCategories || [];
                                  const centers = masterData?.costCenters || [];
                                  const defaultCategory = categories[0] || 'Primary Cost Category';
                                  const filtered = centers.filter(c => c.category === defaultCategory);
                                  const defaultCenter = (filtered[0] || centers[0])?.name || '';
                                  const amt = parseFloat(form.amount) || 0;
                                  setFormValue('costCategory', defaultCategory);
                                  setFormValue('costCenter', defaultCenter);
                                  setFormValue('costAmount', amt);
                                  setFormValue('costCenters', [{ category: defaultCategory, name: defaultCenter, amount: amt }]);
                                }
                              }}
                              className="w-3.5 h-3.5 rounded accent-indigo-500 cursor-pointer"
                            />
                            <span className="text-[9.5px] md:text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-slate-200">Cost Center</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={form.gstApplicable || false}
                              onChange={e => {
                                const val = e.target.checked;
                                setFormValue('gstApplicable', val);
                                if (!val) {
                                  setFormValue('gstLedger', '');
                                  setFormValue('gstRate', '');
                                } else {
                                  const defaultGstLedger = masterData?.gstLedgers?.[0] || 'CGST @ 9%';
                                  const defaultGstRate = masterData?.gstRates?.[0] || '18%';
                                  setFormValue('gstLedger', typeof defaultGstLedger === 'object' ? defaultGstLedger.name : defaultGstLedger);
                                  setFormValue('gstRate', defaultGstRate);
                                }
                              }}
                              className="w-3.5 h-3.5 rounded accent-indigo-500 cursor-pointer"
                            />
                            <span className="text-[9.5px] md:text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-slate-200">GST</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={form.tdsApplicable || false}
                              onChange={e => {
                                const val = e.target.checked;
                                setFormValue('tdsApplicable', val);
                                if (!val) {
                                  setFormValue('tdsLedger', '');
                                  setFormValue('tdsRate', '');
                                } else {
                                  const defaultTdsLedger = masterData?.tdsLedgers?.[0] || 'TDS Payable';
                                  const defaultTdsRate = masterData?.tdsRates?.[0] || '10%';
                                  setFormValue('tdsLedger', typeof defaultTdsLedger === 'object' ? defaultTdsLedger.name : defaultTdsLedger);
                                  setFormValue('tdsRate', defaultTdsRate);
                                }
                              }}
                              className="w-3.5 h-3.5 rounded accent-indigo-500 cursor-pointer"
                            />
                            <span className="text-[9.5px] md:text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-slate-200">TDS</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  )}
                </FormSection>

                {/* Narration Card */}
                <FormSection title="Narration" zIndex={10} defaultOpen={true}>
                  <textarea
                    className="w-full h-8 md:h-10 rounded-lg border p-1.5 text-xs md:text-[12.5px] font-bold outline-none transition-all focus:border-indigo-400 resize-none shadow-sm placeholder:text-slate-300"
                    placeholder="Enter detailed narration here..."
                    value={form.narration || ''}
                    onChange={e => setFormValue('narration', e.target.value)}
                    style={{ backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }}
                  />
                </FormSection>
              </div>

              {/* Column 2: Live Panels and Collapsibles (5/12 on lg desktop) */}
              <div className="col-span-1 lg:col-span-5 flex flex-col gap-2 pb-2">

                {/* Live Balances Panel */}
                {getBalancePanel()}

                {/* Accounting Entry Preview */}
                {getAccountingPreview()}

                {/* Voucher Summary Panel */}
                {getVoucherSummary()}

                {/* Container for Collapsible Details (No independent scrollbars - renders directly in layout) */}
                <div className="flex flex-col gap-2">



                  {/* Bill Allocation collapsible */}
                  {isCreditor && (
                    <FormSection
                      title="Bill Allocation"
                      zIndex={60}
                      showCheckbox={true}
                      checkboxChecked={showBillAllocation}
                      onCheckboxChange={(checked) => {
                        setShowBillAllocation(checked);
                        if (checked) {
                          const voucherAmount = parseFloat(form.amount) || 0;
                          if (!form.billRows || form.billRows.length === 0) {
                            setFormValue('billRows', [{
                              id: Date.now(),
                              billType: 'Against Ref',
                              billNo: '',
                              billRef: '',
                              date: '',
                              dueDate: '',
                              billAmount: 0,
                              pendingAmount: 0,
                              allocationAmount: voucherAmount,
                              allocatedAmount: voucherAmount
                            }]);
                          } else if (form.billRows.length === 1) {
                            const updatedRows = [...form.billRows];
                            updatedRows[0] = {
                              ...updatedRows[0],
                              allocationAmount: voucherAmount,
                              allocatedAmount: voucherAmount
                            };
                            setFormValue('billRows', updatedRows);
                          }
                        }
                      }}
                      headerAction={
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            addBillRow();
                          }}
                          className="px-2 py-0.5 rounded-none border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 text-[9.5px] font-black uppercase flex items-center gap-1 transition-all mr-2"
                        >
                          <Plus size={10} strokeWidth={3} /> Add Row
                        </button>
                      }
                    >
                      <div className="overflow-visible space-y-2">
                        {(form.billRows || []).map((row, idx) => {
                          const outstandingAfter = Math.max(0, (parseFloat(row.pendingAmount) || 0) - (parseFloat(row.allocationAmount) || 0));
                          const pendingBills = selectedPartyDetails?.pendingBills || [];
                          const isSingle = (form.billRows || []).length === 1;

                          if (isSingle) {
                            return (
                              <div
                                key={row.id || idx}
                                className="p-2 rounded-none border flex flex-col gap-2 relative transition-all duration-200"
                                style={{ borderColor: theme.border, backgroundColor: theme.inputBg }}
                              >
                                {/* Row 1: Bill Type & Reference Selector */}
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-[8px] font-black uppercase text-slate-400">Bill Type</span>
                                    <select
                                      value={row.billType || ''}
                                      onChange={e => {
                                        const val = e.target.value;
                                        updateBillRow(idx, 'billType', val);
                                        const mainAmount = parseFloat(form.amount) || 0;
                                        if (val === 'Advance') {
                                          const ref = `ADV-${form.voucherNumber || 'Draft'}`;
                                          updateBillRow(idx, 'billRef', ref);
                                          updateBillRow(idx, 'billNo', ref);
                                          updateBillRow(idx, 'allocationAmount', mainAmount);
                                          updateBillRow(idx, 'allocatedAmount', mainAmount);
                                        } else if (val === 'On Account') {
                                          updateBillRow(idx, 'billRef', 'On Account');
                                          updateBillRow(idx, 'billNo', 'On Account');
                                          updateBillRow(idx, 'allocationAmount', mainAmount);
                                          updateBillRow(idx, 'allocatedAmount', mainAmount);
                                        } else {
                                          updateBillRow(idx, 'billRef', '');
                                          updateBillRow(idx, 'billNo', '');
                                          updateBillRow(idx, 'allocationAmount', mainAmount);
                                          updateBillRow(idx, 'allocatedAmount', mainAmount);
                                        }
                                        // Reset invoice details
                                        updateBillRow(idx, 'date', '');
                                        updateBillRow(idx, 'dueDate', '');
                                        updateBillRow(idx, 'billAmount', 0);
                                        updateBillRow(idx, 'pendingAmount', 0);
                                      }}
                                      className="w-full h-7.5 px-1.5 rounded-none border text-[11px] font-bold outline-none"
                                      style={{ borderColor: theme.border, color: theme.text, backgroundColor: theme.panel }}
                                    >
                                      <option value="Against Ref">Against Reference</option>
                                      <option value="Advance">Advance</option>
                                      <option value="New Ref">New Reference</option>
                                      <option value="On Account">On Account</option>
                                    </select>
                                  </div>
                                  <div className="flex flex-col gap-0.5">
                                    {row.billType !== 'On Account' && (
                                      <>
                                        <span className="text-[8px] font-black uppercase text-slate-400">Bill Reference</span>
                                        {row.billType === 'Against Ref' ? (
                                          <select
                                            value={row.billNo || ''}
                                            onChange={e => handleBillRefChange(idx, e.target.value)}
                                            className="w-full h-7.5 px-1.5 rounded-none border text-[11px] font-bold outline-none"
                                            style={{ borderColor: theme.border, color: theme.text, backgroundColor: theme.panel }}
                                          >
                                            <option value="" disabled style={{ color: '#94a3b8' }}>
                                              Select Bill...
                                            </option>
                                            {pendingBills.map(b => (
                                              <option key={b.billNo} value={b.billNo}>
                                                {b.billNo}
                                              </option>
                                            ))}
                                          </select>
                                        ) : (
                                          <input
                                            type="text"
                                            placeholder="Ref No"
                                            value={row.billRef || ''}
                                            onChange={e => {
                                              updateBillRow(idx, 'billRef', e.target.value);
                                              updateBillRow(idx, 'billNo', e.target.value);
                                            }}
                                            className="w-full h-7.5 px-1.5 rounded-none border text-[11px] font-bold outline-none"
                                            style={{ borderColor: theme.border, color: theme.text, backgroundColor: theme.panel }}
                                          />
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>

                                {/* Row 2: Selected Invoice Information Panel */}
                                {row.billType === 'Against Ref' && row.billNo && (
                                  <div className="p-2 rounded-none bg-slate-900/10 dark:bg-slate-950/40 text-[10.5px] border border-dashed flex flex-col gap-1" style={{ borderColor: theme.border }}>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-bold">
                                      <div className="flex justify-between col-span-2">
                                        <span className="text-slate-400 font-semibold">Invoice No:</span>
                                        <span style={{ color: theme.text }}>{row.billNo}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-slate-400 font-semibold">Invoice Date:</span>
                                        <span style={{ color: theme.text }}>{row.date ? toDisplayDate(row.date) : '-'}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-slate-400 font-semibold">Due Date:</span>
                                        <span style={{ color: theme.text }}>{row.dueDate ? toDisplayDate(row.dueDate) : '-'}</span>
                                      </div>
                                      <div className="flex justify-between col-span-2 border-t pt-1" style={{ borderColor: theme.border }}>
                                        <span className="text-slate-400 font-semibold">Original Invoice Amount:</span>
                                        <span style={{ color: theme.text }}>{row.billAmount ? `₹${row.billAmount.toLocaleString('en-IN')}` : '-'}</span>
                                      </div>
                                      <div className="flex justify-between col-span-2 border-t pt-1" style={{ borderColor: theme.border }}>
                                        <span className="text-indigo-500 font-extrabold uppercase text-[8px] tracking-wider">Outstanding Before Payment:</span>
                                        <span className="font-black text-indigo-500 dark:text-indigo-400">
                                          ₹ {row.pendingAmount ? row.pendingAmount.toLocaleString('en-IN') : '-'}
                                        </span>
                                      </div>
                                      <div className="flex justify-between col-span-2 border-t pt-1" style={{ borderColor: theme.border }}>
                                        <span className="text-slate-400 font-semibold">Payment Amount:</span>
                                        <span className="font-extrabold" style={{ color: theme.text }}>
                                          ₹ {form.amount ? parseFloat(form.amount).toLocaleString('en-IN') : '0.00'}
                                        </span>
                                      </div>
                                      <div className="flex justify-between col-span-2 border-t pt-1" style={{ borderColor: theme.border }}>
                                        <span className="text-emerald-500 font-extrabold uppercase text-[8px] tracking-wider">Outstanding After Payment:</span>
                                        <span className="font-black text-emerald-500">
                                          ₹ {outstandingAfter.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {row.billType === 'Against Ref' && !row.billNo && (
                                  <div className="p-2 rounded-none bg-slate-50/50 dark:bg-slate-800/10 text-center text-slate-400 text-[10.5px] border border-dashed" style={{ borderColor: theme.border }}>
                                    Please select a Bill Reference above to view invoice details and calculated outstanding.
                                  </div>
                                )}

                                {/* Simplifed read-only values for non-Against Ref single rows */}
                                {row.billType !== 'Against Ref' && (
                                  <div className="p-2 rounded-none bg-slate-900/10 dark:bg-slate-950/40 text-[10.5px] border border-dashed flex flex-col gap-1" style={{ borderColor: theme.border }}>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-bold">
                                      <div className="flex justify-between col-span-2">
                                        <span className="text-slate-400 font-semibold">Bill Type:</span>
                                        <span style={{ color: theme.text }}>{row.billType}</span>
                                      </div>
                                      {row.billType !== 'On Account' && (
                                        <div className="flex justify-between col-span-2">
                                          <span className="text-slate-400 font-semibold">Reference Name:</span>
                                          <span style={{ color: theme.text }}>{row.billRef || '-'}</span>
                                        </div>
                                      )}
                                      <div className="flex justify-between col-span-2 border-t pt-1" style={{ borderColor: theme.border }}>
                                        <span className="text-slate-400 font-semibold">Payment Amount:</span>
                                        <span className="font-extrabold" style={{ color: theme.text }}>
                                          ₹ {form.amount ? parseFloat(form.amount).toLocaleString('en-IN') : '0.00'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          }

                          return (
                            <div
                              key={row.id || idx}
                              className="p-2 rounded-none border flex flex-col gap-2 relative transition-all duration-200"
                              style={{ borderColor: theme.border, backgroundColor: theme.inputBg }}
                            >
                              {/* Row 1: Bill Type & Reference Selector */}
                              <div className="grid grid-cols-2 gap-2">
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[8px] font-black uppercase text-slate-400">Bill Type</span>
                                  <select
                                    value={row.billType || ''}
                                    onChange={e => {
                                      const val = e.target.value;
                                      updateBillRow(idx, 'billType', val);
                                      if (val === 'Advance') {
                                        const ref = `ADV-${form.voucherNumber || 'Draft'}`;
                                        updateBillRow(idx, 'billRef', ref);
                                        updateBillRow(idx, 'billNo', ref);
                                      } else if (val === 'On Account') {
                                        updateBillRow(idx, 'billRef', 'On Account');
                                        updateBillRow(idx, 'billNo', 'On Account');
                                      } else {
                                        updateBillRow(idx, 'billRef', '');
                                        updateBillRow(idx, 'billNo', '');
                                      }
                                      // Reset invoice details
                                      updateBillRow(idx, 'date', '');
                                      updateBillRow(idx, 'dueDate', '');
                                      updateBillRow(idx, 'billAmount', 0);
                                      updateBillRow(idx, 'pendingAmount', 0);
                                    }}
                                    className="w-full h-7.5 px-1.5 rounded-none border text-[11px] font-bold outline-none"
                                    style={{ borderColor: theme.border, color: theme.text, backgroundColor: theme.panel }}
                                  >
                                    <option value="Against Ref">Against Reference</option>
                                    <option value="Advance">Advance</option>
                                    <option value="New Ref">New Reference</option>
                                    <option value="On Account">On Account</option>
                                  </select>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                  {row.billType !== 'On Account' && (
                                    <>
                                      <span className="text-[8px] font-black uppercase text-slate-400">Bill Reference</span>
                                      {row.billType === 'Against Ref' ? (
                                        <select
                                          value={row.billNo || ''}
                                          onChange={e => handleBillRefChange(idx, e.target.value)}
                                          className="w-full h-7.5 px-1.5 rounded-none border text-[11px] font-bold outline-none"
                                          style={{ borderColor: theme.border, color: theme.text, backgroundColor: theme.panel }}
                                        >
                                          <option value="" disabled style={{ color: '#94a3b8' }}>
                                            Select Bill...
                                          </option>
                                          {pendingBills.map(b => (
                                            <option key={b.billNo} value={b.billNo}>
                                              {b.billNo}
                                            </option>
                                          ))}
                                        </select>
                                      ) : (
                                        <input
                                          type="text"
                                          placeholder="Ref No"
                                          value={row.billRef || ''}
                                          onChange={e => {
                                            updateBillRow(idx, 'billRef', e.target.value);
                                            updateBillRow(idx, 'billNo', e.target.value);
                                          }}
                                          className="w-full h-7.5 px-1.5 rounded-none border text-[11px] font-bold outline-none"
                                          style={{ borderColor: theme.border, color: theme.text, backgroundColor: theme.panel }}
                                        />
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Row 2: Selected Invoice Information Panel */}
                              {row.billType === 'Against Ref' && row.billNo && (
                                <div className="p-2 rounded-none bg-slate-900/10 dark:bg-slate-950/40 text-[10.5px] border border-dashed flex flex-col gap-1" style={{ borderColor: theme.border }}>
                                  <h5 className="text-[8px] font-black uppercase tracking-wider text-indigo-500">Selected Invoice Information Panel</h5>
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-bold">
                                    <div className="flex justify-between">
                                      <span className="text-slate-400 font-semibold">Invoice:</span>
                                      <span style={{ color: theme.text }}>{row.billNo}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-400 font-semibold">Invoice Date:</span>
                                      <span style={{ color: theme.text }}>{row.date ? toDisplayDate(row.date) : '-'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-400 font-semibold">Due Date:</span>
                                      <span style={{ color: theme.text }}>{row.dueDate ? toDisplayDate(row.dueDate) : '-'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-400 font-semibold">Original Amount:</span>
                                      <span style={{ color: theme.text }}>{row.billAmount ? `₹${row.billAmount.toLocaleString('en-IN')}` : '-'}</span>
                                    </div>
                                    <div className="flex justify-between col-span-2 border-t pt-1 mt-0.5" style={{ borderColor: theme.border }}>
                                      <span className="text-indigo-500 font-extrabold uppercase text-[8px] tracking-wider">Selected Bill Outstanding:</span>
                                      <span className="font-black text-indigo-500 dark:text-indigo-400">
                                        ₹ {row.pendingAmount ? row.pendingAmount.toLocaleString('en-IN') : '-'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Row 3: Payment Allocation Amount, Outstanding After & Delete Button */}
                              <div className="flex items-end justify-between gap-3 pt-1 border-t" style={{ borderColor: theme.border }}>
                                <div className="flex-1 grid grid-cols-2 gap-2">
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-[8px] font-black uppercase text-slate-400">Payment Amount</span>
                                    <input
                                      type="number"
                                      value={row.allocationAmount || ''}
                                      onChange={e => handleAllocationChange(idx, e.target.value)}
                                      placeholder="0.00"
                                      className="w-full h-7.5 px-1.5 rounded-none border text-[11px] font-black outline-none focus:border-indigo-500 text-right"
                                      style={{ borderColor: theme.border, color: theme.text, backgroundColor: theme.panel }}
                                    />
                                  </div>
                                  <div className="flex flex-col justify-end pb-1.5 text-right">
                                    {row.billType === 'Against Ref' ? (
                                      <>
                                        <span className="text-[7.5px] font-black uppercase text-emerald-500">Outstanding After</span>
                                        <span className="text-[11.5px] font-black text-emerald-500">
                                          ₹ {outstandingAfter.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </span>
                                      </>
                                    ) : (
                                      <div className="flex flex-col items-end">
                                        <span className="text-[7.5px] font-black uppercase text-slate-400">Type</span>
                                        <span className="text-[11px] font-black" style={{ color: theme.text }}>{row.billType}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => removeBillRow(row.id || row._id)}
                                  className="w-7.5 h-7.5 rounded-none border border-red-200 bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-red-500 hover:bg-red-50 hover:text-red-600 transition-all shrink-0"
                                >
                                  <Minus size={12} strokeWidth={3} />
                                </button>
                              </div>
                            </div>
                          );
                        })}

                        {/* Summary Indicator Bar */}
                        {form.billRows && form.billRows.length > 1 && (() => {
                          const totalAllocated = (form.billRows || []).reduce((acc, r) => acc + (parseFloat(r.allocationAmount) || 0), 0);
                          const voucherAmount = parseFloat(form.amount) || 0;
                          const remainingUnallocated = Math.round((voucherAmount - totalAllocated) * 100) / 100;
                          return (
                            <div className="mt-2.5 px-3 py-2 flex flex-wrap items-center justify-between border rounded-none shadow-sm text-[10px] md:text-[11px] font-black uppercase tracking-widest gap-2" style={{ borderColor: theme.border, backgroundColor: theme.headerBg }}>
                              <div className="flex items-center gap-1.5">
                                <span style={{ color: theme.mutedText }}>Total Allocated Amount:</span>
                                <span className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-none border border-indigo-500/10">
                                  ₹ {totalAllocated.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span style={{ color: theme.mutedText }}>Remaining Amount:</span>
                                <span className={`px-2 py-0.5 rounded-none border shadow-sm ${Math.abs(remainingUnallocated) < 0.01 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 font-extrabold' : 'bg-rose-500/10 border-rose-500/20 text-rose-500 font-extrabold'}`}>
                                  ₹ {remainingUnallocated.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </FormSection>
                  )}

                  {/* Cost Center Allocation Collapsible */}
                  <FormSection
                    title="Cost Center Allocation"
                    zIndex={50}
                    showCheckbox={true}
                    checkboxChecked={form.costCenterApplicable || false}
                    onCheckboxChange={(checked) => {
                      setFormValue('costCenterApplicable', checked);
                      if (!checked) {
                        setFormValue('costCategory', '');
                        setFormValue('costCenter', '');
                        setFormValue('costAmount', 0);
                        setFormValue('costCenters', []);
                      } else {
                        const categories = masterData?.costCategories || [];
                        const centers = masterData?.costCenters || [];
                        const defaultCategory = categories[0] || 'Primary Cost Category';
                        const filtered = centers.filter(c => c.category === defaultCategory);
                        const defaultCenter = (filtered[0] || centers[0])?.name || '';
                        const amt = parseFloat(form.amount) || 0;
                        setFormValue('costCategory', defaultCategory);
                        setFormValue('costCenter', defaultCenter);
                        setFormValue('costAmount', amt);
                        setFormValue('costCenters', [{ category: defaultCategory, name: defaultCenter, amount: amt }]);
                      }
                    }}
                  >
                    <div className="grid grid-cols-1 gap-3">
                      <SearchableDropdown
                        label="Cost Category"
                        placeholder="Select Category"
                        value={form.costCategory || (form.costCenters?.[0]?.category || '')}
                        onChange={val => {
                          setFormValue('costCategory', val);
                          const currentCenter = form.costCenter || (form.costCenters?.[0]?.name || '');
                          const currentAmount = parseFloat(form.costAmount || (form.costCenters?.[0]?.amount || 0));
                          setFormValue('costCenters', [{ category: val, name: currentCenter, amount: currentAmount }]);
                        }}
                        options={costCategoriesOptions}
                        compact
                      />
                      <SearchableDropdown
                        label="Cost Center"
                        placeholder="Select Center"
                        value={form.costCenter || (form.costCenters?.[0]?.name || '')}
                        onChange={val => {
                          setFormValue('costCenter', val);
                          const currentCategory = form.costCategory || (form.costCenters?.[0]?.category || '');
                          const currentAmount = parseFloat(form.costAmount || (form.costCenters?.[0]?.amount || 0));
                          setFormValue('costCenters', [{ category: currentCategory, name: val, amount: currentAmount }]);
                        }}
                        options={filteredCostCenters}
                        compact
                      />
                      <InputField
                        label="Allocation Amount (₹)"
                        type="number"
                        placeholder="0.00"
                        value={form.costAmount || (form.costCenters?.[0]?.amount || '')}
                        onChange={val => {
                          setFormValue('costAmount', val);
                          const currentCategory = form.costCategory || (form.costCenters?.[0]?.category || '');
                          const currentCenter = form.costCenter || (form.costCenters?.[0]?.name || '');
                          setFormValue('costCenters', [{ category: currentCategory, name: currentCenter, amount: parseFloat(val) || 0 }]);
                        }}
                        align="right"
                        compact
                      />
                    </div>
                  </FormSection>

                  {/* GST Details Card */}
                  <FormSection
                    title="GST Details"
                    zIndex={42}
                    showCheckbox={true}
                    checkboxChecked={form.gstApplicable || false}
                    onCheckboxChange={(checked) => {
                      setFormValue('gstApplicable', checked);
                      if (!checked) {
                        setFormValue('gstLedger', '');
                        setFormValue('gstRate', '');
                      } else {
                        const defaultGstLedger = masterData?.gstLedgers?.[0] || 'CGST @ 9%';
                        const defaultGstRate = masterData?.gstRates?.[0] || '18%';
                        setFormValue('gstLedger', typeof defaultGstLedger === 'object' ? defaultGstLedger.name : defaultGstLedger);
                        setFormValue('gstRate', defaultGstRate);
                      }
                    }}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <SearchableDropdown
                        label="GST Ledger"
                        placeholder="GST Ledger"
                        value={form.gstLedger || ''}
                        onChange={val => setFormValue('gstLedger', val)}
                        options={masterData?.gstLedgers || []}
                        compact
                      />
                      <SearchableDropdown
                        label="GST Rate"
                        placeholder="GST Rate"
                        value={form.gstRate || ''}
                        onChange={val => setFormValue('gstRate', val)}
                        options={masterData?.gstRates || []}
                        compact
                      />
                    </div>
                  </FormSection>

                  {/* TDS Details Card */}
                  <FormSection
                    title="TDS Details"
                    zIndex={40}
                    showCheckbox={true}
                    checkboxChecked={form.tdsApplicable || false}
                    onCheckboxChange={(checked) => {
                      setFormValue('tdsApplicable', checked);
                      if (!checked) {
                        setFormValue('tdsLedger', '');
                        setFormValue('tdsRate', '');
                      } else {
                        const defaultTdsLedger = masterData?.tdsLedgers?.[0] || 'TDS Payable';
                        const defaultTdsRate = masterData?.tdsRates?.[0] || '10%';
                        setFormValue('tdsLedger', typeof defaultTdsLedger === 'object' ? defaultTdsLedger.name : defaultTdsLedger);
                        setFormValue('tdsRate', defaultTdsRate);
                      }
                    }}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <SearchableDropdown
                        label="TDS Ledger"
                        placeholder="TDS Ledger"
                        value={form.tdsLedger || ''}
                        onChange={val => setFormValue('tdsLedger', val)}
                        options={masterData?.tdsLedgers || []}
                        compact
                      />
                      <SearchableDropdown
                        label="TDS %"
                        placeholder="TDS %"
                        value={form.tdsRate || ''}
                        onChange={val => setFormValue('tdsRate', val)}
                        options={masterData?.tdsRates || []}
                        compact
                      />
                    </div>
                  </FormSection>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </ThemeContext.Provider>
  );
};

const toDisplayDate = (val) => {
  if (!val) return "";
  const datePart = val.split(/[T ]/)[0];
  if (datePart.includes('-')) {
    const parts = datePart.split('-');
    if (parts[0].length === 4 && parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return datePart;
  }
  return datePart;
};

const toDbDate = (val) => {
  if (!val) return "";
  const datePart = val.split(/[T ]/)[0];
  if (datePart.includes('-')) {
    const parts = datePart.split('-');
    if (parts[2]?.length === 4 && parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return datePart;
  }
  return datePart;
};

// --- Reusable Sub-Components (Declared outside to prevent focus-loss on re-render) ---

const FormSection = ({
  title,
  children,
  headerAction,
  zIndex = 1,
  showCheckbox = false,
  checkboxChecked = false,
  onCheckboxChange,
  className = ""
}) => {
  const { isDark, theme } = useContext(ThemeContext) || {};

  if (!theme) return null;

  const isContentVisible = !showCheckbox || checkboxChecked;

  return (
    <div
      className={`p-2.5 border rounded-none mb-0 shrink-0 flex flex-col gap-2 relative ${className}`}
      style={{ borderColor: theme.border, backgroundColor: theme.panel, zIndex: isContentVisible ? zIndex : 1 }}
    >
      <div className="flex items-center justify-between mb-0.5">
        <div className="flex items-center gap-2">
          {showCheckbox && (
            <input
              type="checkbox"
              checked={checkboxChecked}
              onChange={(e) => {
                onCheckboxChange && onCheckboxChange(e.target.checked);
              }}
              className="w-3.5 h-3.5 rounded-none accent-[#09B6B9] cursor-pointer"
            />
          )}
          <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
            {title}
          </h3>
        </div>
        {headerAction}
      </div>
      {isContentVisible && (
        <div className="overflow-visible animate-in fade-in duration-200">
          {children}
        </div>
      )}
    </div>
  );
};

const SearchableDropdown = ({ label, placeholder, options = [], value, onChange, compact }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);
  const { isDark, theme } = useContext(ThemeContext) || {};

  useEffect(() => {
    if (isOpen) {
      const handleClickOutside = (event) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
          setIsOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  if (!theme) return null;

  const filtered = options.filter(o => {
    if (!o) return false;
    if (typeof o === 'string') {
      return o.toLowerCase().includes(search.toLowerCase());
    } else {
      const nameMatch = (o.name || '').toLowerCase().includes(search.toLowerCase());
      const gstinMatch = (o.gstin || '').toLowerCase().includes(search.toLowerCase());
      const phoneMatch = (o.phone || '').toLowerCase().includes(search.toLowerCase());
      const groupMatch = (o.groupName || '').toLowerCase().includes(search.toLowerCase());
      return nameMatch || gstinMatch || phoneMatch || groupMatch;
    }
  });

  return (
    <div className="relative flex flex-col gap-1 w-full group" ref={dropdownRef} style={{ zIndex: isOpen ? 50 : 1 }}>
      {label && (
        <label className="text-[9px] font-black uppercase tracking-tighter absolute -top-2 left-2 px-1 z-10 text-slate-600 dark:text-slate-400 group-focus-within:text-indigo-600 transition-colors" style={{ backgroundColor: theme.panel }}>
          {label.startsWith('*') ? (
            <>
              <span className="text-red-500 mr-1">*</span>
              {label.slice(1).trim()}
            </>
          ) : label}
        </label>
      )}
      <div className="relative flex-1">
        <div
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full ${compact ? 'h-7 px-1.5' : 'h-10 px-2'} rounded-sm border flex items-center justify-between cursor-pointer transition-all duration-300 group/input ${isOpen ? 'border-indigo-500' : 'hover:border-indigo-400'}`}
          style={{ backgroundColor: theme.inputBg, borderColor: isOpen ? theme.accent : theme.border }}
        >
          <span className={`${compact ? 'text-[10px]' : 'text-[11px]'} font-bold truncate transition-colors ${value ? (isDark ? 'text-indigo-400' : 'text-indigo-600') : 'text-slate-400'}`}>
            {value || placeholder}
          </span>
          <div className="flex items-center gap-1 text-slate-400 group-hover/input:text-indigo-500 transition-colors">
            {value && <X size={11} className="hover:text-red-500 transition-colors" onClick={(e) => { e.stopPropagation(); onChange && onChange(''); }} />}
            <ChevronDown size={12} className={`transition-transform duration-300 ease-out ${isOpen ? 'rotate-180 text-indigo-500' : ''}`} />
          </div>
        </div>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 rounded-sm border shadow-2xl z-50 overflow-hidden" style={{ backgroundColor: isDark ? '#1e293b' : '#fff', borderColor: theme.border }}>
            <div className="p-1.5 border-b" style={{ borderColor: theme.border }}>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={11} />
                <input
                  type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search by Name, GSTIN, Phone..."
                  className="w-full h-8 px-8 text-[11px] font-semibold outline-none transition-all border focus:border-indigo-500 rounded-sm"
                  style={{ backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }}
                  autoFocus
                />
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto themed-scrollbar p-1">
              {filtered.length > 0 ? filtered.map((opt, i) => {
                const optVal = typeof opt === 'string' ? opt : opt.name;
                const displayLabel = typeof opt === 'string' ? opt : (
                  <div className="flex flex-col py-0.5">
                    <span className="text-[11px] font-bold">{opt.name}</span>
                    <span className="text-[9px] font-semibold text-slate-400 tracking-wider">
                      {opt.groupName}{opt.gstin ? ` | GSTIN: ${opt.gstin}` : ''}{opt.phone ? ` | Ph: ${opt.phone}` : ''}
                    </span>
                  </div>
                );
                return (
                  <button key={i} onClick={() => { onChange && onChange(optVal); setIsOpen(false); setSearch(''); }}
                    className="w-full text-left px-2 py-1 text-[11px] font-bold hover:bg-indigo-50/50 transition-colors border-b last:border-0"
                    style={{ color: theme.text, borderColor: theme.border }}
                  >
                    {displayLabel}
                  </button>
                );
              }) : (
                <div className="px-3 py-2 text-[11px] text-center" style={{ color: theme.mutedText }}>No results</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const InputField = ({ label, placeholder, value, onChange, type = 'text', readOnly, Icon, align, compact }) => {
  const { isDark, theme } = useContext(ThemeContext) || {};

  const handleTextChange = (e) => {
    const isBackspace = e.nativeEvent.inputType === "deleteContentBackward";
    let raw = e.target.value.replace(/[^0-9]/g, '');
    if (raw.length > 8) raw = raw.slice(0, 8);

    let formatted = "";
    if (raw.length <= 2) {
      if (raw.length === 2 && !isBackspace) {
        formatted = `${raw}-`;
      } else {
        formatted = raw;
      }
    } else if (raw.length <= 4) {
      if (raw.length === 4 && !isBackspace) {
        formatted = `${raw.slice(0, 2)}-${raw.slice(2, 4)}-`;
      } else {
        formatted = `${raw.slice(0, 2)}-${raw.slice(2)}`;
      }
    } else {
      formatted = `${raw.slice(0, 2)}-${raw.slice(2, 4)}-${raw.slice(4)}`;
    }

    if (formatted.length === 10) {
      onChange && onChange(toDbDate(formatted));
    } else {
      onChange && onChange(formatted);
    }
  };

  if (!theme) return null;

  return (
    <div className="relative flex flex-col gap-1 w-full group">
      {label && (
        <label className="text-[9px] font-black uppercase tracking-tighter absolute -top-2 left-2 px-1 z-10 text-slate-600 dark:text-slate-400 group-focus-within:text-indigo-600 transition-colors" style={{ backgroundColor: theme.panel }}>
          {label.startsWith('*') ? (
            <>
              <span className="text-red-500 mr-1">*</span>
              {label.slice(1).trim()}
            </>
          ) : label}
        </label>
      )}
      <div className="relative">
        {type === 'date' ? (
          <>
            <input
              type="text"
              value={toDisplayDate(value)}
              onChange={handleTextChange}
              placeholder="dd-mm-yyyy"
              readOnly={readOnly}
              className={`w-full ${compact ? 'h-7 px-1.5 text-[10px]' : 'h-10 px-2 text-[11px]'} rounded-sm border font-bold outline-none transition-all duration-300 focus:ring-0 ${isDark ? 'placeholder:text-white/10' : 'placeholder:text-slate-300'} ${align === 'right' ? 'text-right' : ''} ${readOnly ? (isDark ? 'cursor-not-allowed opacity-60 bg-slate-800/20' : 'cursor-not-allowed bg-slate-50/50') : 'hover:border-indigo-300'}`}
              style={{ backgroundColor: readOnly ? theme.headerBg : theme.inputBg, borderColor: theme.border, color: readOnly ? theme.accent : theme.text }}
            />
            {Icon && !readOnly && (
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center cursor-pointer">
                <Icon size={12} className="text-slate-400 hover:text-indigo-500 transition-colors pointer-events-none" />
                <input
                  type="date"
                  value={toDbDate(value)}
                  onChange={(e) => onChange && onChange(e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  style={{ width: '15px', height: '15px', right: 0 }}
                />
              </div>
            )}
          </>
        ) : (
          <input
            type={type}
            value={value}
            onChange={(e) => onChange && onChange(e.target.value)}
            readOnly={readOnly}
            placeholder={placeholder}
            className={`w-full ${compact ? 'h-7 px-1.5 text-[10px]' : 'h-10 px-2 text-[11px]'} rounded-sm border font-bold outline-none transition-all duration-300 focus:ring-0 ${isDark ? 'placeholder:text-white/10' : 'placeholder:text-slate-300'} ${align === 'right' ? 'text-right' : ''} ${readOnly ? (isDark ? 'cursor-not-allowed opacity-60 bg-slate-800/20' : 'cursor-not-allowed bg-slate-50/50') : 'hover:border-indigo-300'}`}
            style={{ backgroundColor: readOnly ? theme.headerBg : theme.inputBg, borderColor: theme.border, color: readOnly ? theme.accent : theme.text }}
          />
        )}
        {type !== 'date' && Icon && <Icon className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={12} />}
      </div>
    </div>
  );
};

const SummaryBar = ({ entries, total }) => {
  const { theme } = useContext(ThemeContext) || {};
  if (!theme) return null;
  return (
    <div className="mt-2.5 h-9 px-3.5 flex items-center justify-between border rounded-none shadow-sm text-[10px] md:text-[11px] font-black uppercase tracking-widest overflow-x-auto no-scrollbar" style={{ borderColor: theme.border, backgroundColor: theme.headerBg }}>
      <div className="flex items-center gap-1.5 shrink-0">
        <span style={{ color: theme.mutedText }}>Entries</span>
        <span className="bg-indigo-500/10 text-indigo-600 px-2 py-0.5 rounded-none text-[11px] border border-indigo-500/10">{entries}</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span style={{ color: theme.mutedText }}>Total</span>
        <span className="bg-indigo-600 text-white px-2 py-0.5 rounded-none text-[11px] border border-indigo-600 shadow-md shadow-indigo-200/50">{total}</span>
      </div>
    </div>
  );
};

export default CreateFundFlow;
