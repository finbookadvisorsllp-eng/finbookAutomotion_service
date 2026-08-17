import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  BookOpen, User, MapPin, ShieldCheck, Landmark, Percent, FileText, Settings, 
  Plus, X, Search, ChevronDown, Check, Sparkles, Calendar, Hash, ArrowLeft, Save, 
  RotateCcw, Info, CheckCircle2, Layers, SlidersHorizontal
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';



// Predefined Tally & Indian Bank Names
const PREDEFINED_BANKS = [

  'State Bank of India (SBI)',
  'HDFC Bank',
  'ICICI Bank',
  'Axis Bank',
  'Punjab National Bank (PNB)',
  'Bank of Baroda',
  'Canara Bank',
  'Union Bank of India',
  'Bank of India',
  'Indian Bank',
  'Kotak Mahindra Bank',
  'IndusInd Bank',
  'Yes Bank',
  'IDBI Bank',
  'Central Bank of India',
  'Indian Overseas Bank',
  'UCO Bank',
  'Punjab & Sind Bank',
  'Bank of Maharashtra',
  'Bandhan Bank',
  'Federal Bank',
  'IDFC FIRST Bank',
  'Jammu & Kashmir Bank',
  'Karnataka Bank',
  'Karur Vysya Bank',
  'South Indian Bank',
  'City Union Bank',
  'RBL Bank',
  'DBS Bank India',
  'HSBC Bank',
  'Standard Chartered Bank',
  'Citibank'
];

const INDIA_STATES = [
  'Jammu & Kashmir (01)',
  'Himachal Pradesh (02)',
  'Punjab (03)',
  'Chandigarh (04)',
  'Uttarakhand (05)',
  'Haryana (06)',
  'Delhi (07)',
  'Rajasthan (08)',
  'Uttar Pradesh (09)',
  'Bihar (10)',
  'Sikkim (11)',
  'Arunachal Pradesh (12)',
  'Nagaland (13)',
  'Manipur (14)',
  'Mizoram (15)',
  'Tripura (16)',
  'Meghalaya (17)',
  'Assam (18)',
  'West Bengal (19)',
  'Jharkhand (20)',
  'Odisha (21)',
  'Chhattisgarh (22)',
  'Madhya Pradesh (23)',
  'Gujarat (24)',
  'Dadra & Nagar Haveli and Daman & Diu (26)',
  'Maharashtra (27)',
  'Andhra Pradesh (28)',
  'Karnataka (29)',
  'Goa (30)',
  'Lakshadweep (31)',
  'Kerala (32)',
  'Tamil Nadu (33)',
  'Puducherry (34)',
  'Andaman & Nicobar Islands (35)',
  'Telangana (36)',
  'Ladakh (38)',
  'Other Territory (97)'
];

export const normalizeState = (rawState) => {
  if (!rawState) return '';
  const str = String(rawState).trim();
  if (!str) return '';

  // 1. Direct exact match in INDIA_STATES
  const exact = INDIA_STATES.find(s => s.toLowerCase() === str.toLowerCase());
  if (exact) return exact;

  // 2. Match by State Code in parentheses e.g. "23" -> "Madhya Pradesh (23)"
  const codeMatch = str.match(/\b\d{1,2}\b/);
  if (codeMatch) {
    const codeNum = parseInt(codeMatch[0], 10);
    const codePadded = String(codeNum).padStart(2, '0');
    const byCode = INDIA_STATES.find(s => s.endsWith(`(${codePadded})`));
    if (byCode) return byCode;
  }

  // 3. Match by State Name e.g. "Madhya Pradesh" or "Delhi"
  const stateNameClean = str.split('(')[0].trim().toLowerCase();
  const byName = INDIA_STATES.find(s => {
    const sName = s.split('(')[0].trim().toLowerCase();
    return sName === stateNameClean || sName.includes(stateNameClean) || stateNameClean.includes(sName);
  });
  if (byName) return byName;

  return str;
};

const COUNTRIES = ['India', 'United States', 'United Kingdom', 'United Arab Emirates', 'Singapore', 'Australia', 'Canada'];
const CITIES_BY_STATE = {
  'Jammu & Kashmir (01)': ['Srinagar', 'Jammu', 'Anantnag'],
  'Himachal Pradesh (02)': ['Shimla', 'Dharamshala', 'Mandi', 'Solan'],
  'Punjab (03)': ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Mohali'],
  'Chandigarh (04)': ['Chandigarh'],
  'Uttarakhand (05)': ['Dehradun', 'Haridwar', 'Roorkee', 'Haldwani'],
  'Haryana (06)': ['Gurugram', 'Faridabad', 'Panipat', 'Ambala', 'Karnal'],
  'Delhi (07)': ['New Delhi', 'North Delhi', 'South Delhi', 'East Delhi', 'West Delhi'],
  'Rajasthan (08)': ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Bikaner', 'Ajmer'],
  'Uttar Pradesh (09)': ['Noida', 'Lucknow', 'Kanpur', 'Agra', 'Varanasi', 'Ghaziabad', 'Prayagraj'],
  'Bihar (10)': ['Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur'],
  'Sikkim (11)': ['Gangtok'],
  'Arunachal Pradesh (12)': ['Itanagar'],
  'Nagaland (13)': ['Kohima', 'Dimapur'],
  'Manipur (14)': ['Imphal'],
  'Mizoram (15)': ['Aizawl'],
  'Tripura (16)': ['Agartala'],
  'Meghalaya (17)': ['Shillong'],
  'Assam (18)': ['Guwahati', 'Silchar', 'Dibrugarh', 'Jorhat'],
  'West Bengal (19)': ['Kolkata', 'Howrah', 'Siliguri', 'Durgapur', 'Asansol'],
  'Jharkhand (20)': ['Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro'],
  'Odisha (21)': ['Bhubaneswar', 'Cuttack', 'Rourkela', 'Puri'],
  'Chhattisgarh (22)': ['Raipur', 'Bhilai', 'Bilaspur'],
  'Madhya Pradesh (23)': ['Indore', 'Bhopal', 'Gwalior', 'Jabalpur', 'Ujjain'],
  'Gujarat (24)': ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Gandhinagar'],
  'Dadra & Nagar Haveli and Daman & Diu (26)': ['Daman', 'Diu', 'Silvassa'],
  'Maharashtra (27)': ['Mumbai', 'Pune', 'Nagpur', 'Thane', 'Nashik', 'Aurangabad', 'Solapur'],
  'Andhra Pradesh (28)': ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Tirupati', 'Nellore'],
  'Karnataka (29)': ['Bengaluru', 'Mysuru', 'Hubballi', 'Mangaluru', 'Belagavi'],
  'Goa (30)': ['Panaji', 'Margao', 'Vasco da Gama'],
  'Lakshadweep (31)': ['Kavaratti'],
  'Kerala (32)': ['Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur'],
  'Tamil Nadu (33)': ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem'],
  'Puducherry (34)': ['Puducherry'],
  'Andaman & Nicobar Islands (35)': ['Port Blair'],
  'Telangana (36)': ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar'],
  'Ladakh (38)': ['Leh', 'Kargil']
};

/**
 * LedgerMasterForm
 * Reusable, responsive, enterprise-grade accounting Ledger Create/Edit form.
 */
const resolveGroupName = (data) => {
  if (!data) return 'Sundry Debtors';
  const isObjectId = (str) => typeof str === 'string' && /^[0-9a-fA-F]{24}$/.test(str);
  if (data.groupName && typeof data.groupName === 'string' && !isObjectId(data.groupName)) {
    return data.groupName;
  }
  if (data.parentGroup && typeof data.parentGroup === 'string' && !isObjectId(data.parentGroup)) {
    return data.parentGroup;
  }
  if (data.subGroup && typeof data.subGroup === 'string' && !isObjectId(data.subGroup)) {
    return data.subGroup;
  }
  if (typeof data.parentGroup === 'object' && data.parentGroup?.groupName) {
    return data.parentGroup.groupName;
  }
  if (data.groupId && typeof data.groupId === 'string' && !isObjectId(data.groupId)) {
    return data.groupId;
  }
  return 'Sundry Debtors';
};

const extractLedgerFormData = (data) => {
  if (!data) {
    return {
      ledgerName: '',
      alias: '',
      ledgerCode: '',
      ledgerType: '',
      groupId: 'Sundry Debtors',
      openingBalanceAmount: '',
      openingBalanceType: 'Dr',
      openingBalanceDate: new Date().toISOString().split('T')[0],
      status: 'Active',
      isBillWiseOn: true,
      isCostCentresOn: false,
      costCenterId: '',
      affectsStock: false,
      isInterestOn: false,
      forPayroll: false,
      isEcommOperator: false,
      creditPeriod: '',
      creditLimit: '',
      partyType: 'Customer',
      contactPerson: '',
      mobile: '',
      phone: '',
      email: '',
      panNumber: '',
      address: '',
      addressLine2: '',
      countryId: 'India',
      stateId: '',
      cityId: '',
      pinCode: '',
      gstApplicable: true,
      gstin: '',
      gstRegistrationType: 'Regular',
      gstStateId: '',
      gstTypeOfSupply: 'Goods',
      bankName: '',
      branchName: '',
      accountNumber: '',
      ifscCode: '',
      micrCode: '',
      swiftCode: '',
      virtualPaymentAddress: '',
      paymentFavouring: '',
      taxApplicable: false,
      taxType: 'GST',
      gstType: 'CGST',
      gstDutyHead: 'Output Tax',
      cessValuationMethod: 'Based on Value',
      tdsApplicable: false,
      tcsApplicable: false,
      tdsSectionId: '194C',
      tdsDeducteeTypeId: 'Company Resident',
      notes: ''
    };
  }

  const grp = resolveGroupName(data);
  const pd = data.partyDetails || {};
  const bd = data.bankDetails || {};
  const bal = data.balances?.openingBalance || {};

  const addrStr = Array.isArray(pd.address) ? (pd.address[0] || '') : (pd.address || data.address || data.add1 || '');
  const addr2Str = Array.isArray(pd.address) && pd.address.length > 1 ? (pd.address[1] || '') : (data.addressLine2 || data.add2 || '');

  let opBalType = data.openingBalanceType || data.balanceType || bal.type || 'Dr';
  if (typeof opBalType === 'string') {
    const upper = opBalType.toUpperCase();
    if (upper.startsWith('DEBIT') || upper.startsWith('DR')) {
      opBalType = 'Dr';
    } else if (upper.startsWith('CREDIT') || upper.startsWith('CR')) {
      opBalType = 'Cr';
    }
  }

  const gstinVal = data.gstin || data.gst || pd.gstin || '';
  let gstCodeState = '';
  if (gstinVal && typeof gstinVal === 'string' && gstinVal.trim().length >= 2) {
    const twoDigits = gstinVal.trim().substring(0, 2);
    if (/^\d{2}$/.test(twoDigits)) {
      gstCodeState = normalizeState(twoDigits);
    }
  }

  const isInvalidState = (s) => !s || typeof s !== 'string' || ['n/a', 'na', '—', '-', 'undefined', 'null'].includes(s.trim().toLowerCase());

  let matchedState = '';
  if (gstCodeState) {
    matchedState = gstCodeState;
  } else {
    const candidates = [data.stateId, pd.gstState, data.pos, data.state];
    for (const cand of candidates) {
      if (!isInvalidState(cand)) {
        const norm = normalizeState(cand);
        if (norm && INDIA_STATES.includes(norm)) {
          matchedState = norm;
          break;
        } else if (!matchedState && cand) {
          matchedState = cand;
        }
      }
    }
  }

  let matchedGstState = matchedState || gstCodeState;
  if (!matchedGstState) {
    const candidates = [data.gstStateId, pd.gstState, data.pos, data.gstState, data.state];
    for (const cand of candidates) {
      if (!isInvalidState(cand)) {
        const norm = normalizeState(cand);
        if (norm && INDIA_STATES.includes(norm)) {
          matchedGstState = norm;
          break;
        } else if (!matchedGstState && cand) {
          matchedGstState = cand;
        }
      }
    }
  }

  let matchedCity = data.cityId || data.city || pd.city || '';
  if ((!matchedCity || matchedCity === '—') && matchedState && CITIES_BY_STATE[matchedState] && CITIES_BY_STATE[matchedState].length > 0) {
    matchedCity = CITIES_BY_STATE[matchedState][0];
  }

  const derivedLedgerType = data.ledgerType || '';

  return {
    ledgerName: data.ledgerName || data.ledger || data.name || '',
    alias: data.alias || data.aliasName || (Array.isArray(data.nameAliases) ? data.nameAliases[0] : (typeof data.nameAliases === 'string' ? data.nameAliases : '')) || '',
    ledgerCode: data.ledgerCode || '',
    ledgerType: derivedLedgerType,
    groupId: grp,
    openingBalanceAmount: data.openingBalanceAmount ?? data.openingBalance ?? bal.amount ?? '',
    openingBalanceType: opBalType,
    openingBalanceDate: data.openingBalanceDate || bal.asOfDate || new Date().toISOString().split('T')[0],
    status: data.status || 'Active',

    isBillWiseOn: data.isBillWiseOn ?? data.flags?.isBillWiseOn ?? data.maintainBillWise ?? true,
    isCostCentresOn: data.isCostCentresOn ?? data.flags?.isCostCentresOn ?? (data.costCenterId || data.costCenterName ? true : false),
    costCenterId: data.costCenterId || data.costCenterName || data.costCenter || '',
    affectsStock: data.affectsStock ?? data.flags?.affectsStock ?? false,
    isInterestOn: data.isInterestOn ?? data.flags?.isInterestOn ?? false,
    forPayroll: data.forPayroll ?? data.flags?.forPayroll ?? false,
    isEcommOperator: data.isEcommOperator ?? data.flags?.isEcommOperator ?? false,
    creditPeriod: data.creditPeriod || data.terms?.creditPeriod || '',
    creditLimit: data.creditLimit || data.terms?.creditLimit || '',

    partyType: data.partyType || pd.partyType || (grp === 'Sundry Creditors' ? 'Vendor' : 'Customer'),
    contactPerson: data.contactPerson || pd.contactPerson || '',
    mobile: data.mobile || data.mobileNumber || pd.mobile || pd.phone || '',
    phone: data.phone || pd.phone || '',
    email: data.email || data.emailAddress || pd.email || '',
    panNumber: data.panNumber || pd.panNumber || '',

    address: addrStr,
    addressLine2: addr2Str,
    countryId: data.countryId || pd.country || 'India',
    stateId: matchedState,
    cityId: matchedCity,
    pinCode: data.pinCode || data.pincode || pd.pinCode || '',

    gstApplicable: data.gstApplicable ?? data.taxDetails?.gstApplicable ?? true,
    gstin: gstinVal,
    gstRegistrationType: data.gstRegistrationType || data.registrationType || data.type || pd.gstRegistrationType || 'Regular',
    gstStateId: matchedGstState,
    gstTypeOfSupply: data.gstTypeOfSupply || data.taxDetails?.gstTypeOfSupply || 'Goods',

    bankName: data.bankName || bd.bankName || '',
    branchName: data.branchName || data.branch || bd.branchName || '',
    accountNumber: data.accountNumber || bd.accountNumber || '',
    ifscCode: data.ifscCode || bd.ifscCode || '',
    micrCode: data.micrCode || bd.micrCode || '',
    swiftCode: data.swiftCode || bd.swiftCode || '',
    virtualPaymentAddress: data.virtualPaymentAddress || bd.virtualPaymentAddress || '',
    paymentFavouring: data.paymentFavouring || bd.paymentFavouring || '',

    taxApplicable: data.taxApplicable ?? (grp === 'Duties & Taxes'),
    taxType: data.taxType || data.taxDetails?.taxType || 'GST',
    gstType: data.gstType || data.taxDetails?.gstType || 'CGST',
    gstDutyHead: data.gstDutyHead || data.taxDetails?.gstDutyHead || 'Output Tax',
    cessValuationMethod: data.cessValuationMethod || data.taxDetails?.cessValuationMethod || 'Based on Value',

    tdsApplicable: data.tdsApplicable ?? data.tdsDetails?.tdsApplicable ?? false,
    tcsApplicable: data.tcsApplicable ?? data.tdsDetails?.tcsApplicable ?? false,
    tdsSectionId: data.tdsSectionId || data.tdsDetails?.tdsSection || '194C',
    tdsDeducteeTypeId: data.tdsDeducteeTypeId || data.tdsDetails?.tdsDeducteeType || 'Company Resident',
    
    notes: data.notes || ''
  };
};

export default function LedgerMasterForm({ initialData = null, isEdit = false, costCentersList = [], ledgerGroupsList = [], partyDataList = [], onSave, onClose }) {
  const targetGroup = resolveGroupName(initialData);

  const costCenterOptions = useMemo(() => {
    return (costCentersList || []).map(cc => {
      const name = cc.costCenterName || cc.name || cc.costCenterCode || 'Cost Center';
      const code = cc.costCenterCode ? ` (${cc.costCenterCode})` : '';
      const tag = cc.isWebEntry ? ' [Web Entry]' : '';
      return {
        value: name,
        label: `${name}${code}${tag}`
      };
    });
  }, [costCentersList]);

  // Form State
  const [formData, setFormData] = useState(() => extractLedgerFormData(initialData));

  // Dynamic state for custom user-added groups & ledger types
  const [customGroups, setCustomGroups] = useState([]);
  const [customLedgerTypes, setCustomLedgerTypes] = useState([]);

  // Dynamically build group options from DB collections & props (NO hardcoded lock)
  const groupOptions = useMemo(() => {
    const set = new Set();

    (ledgerGroupsList || []).forEach(g => {
      const name = typeof g === 'string' ? g : (g.groupName || g.parentGroup || g.name);
      if (name && typeof name === 'string' && !/^[0-9a-fA-F]{24}$/.test(name)) {
        set.add(name);
      }
    });

    (partyDataList || []).forEach(l => {
      const g1 = l.groupName || l.parentGroup || l.subGroup;
      if (g1 && typeof g1 === 'string' && !/^[0-9a-fA-F]{24}$/.test(g1)) {
        set.add(g1);
      }
    });

    if (initialData) {
      const currentGroup = resolveGroupName(initialData);
      if (currentGroup && typeof currentGroup === 'string' && !/^[0-9a-fA-F]{24}$/.test(currentGroup)) {
        set.add(currentGroup);
      }
    }
    (customGroups || []).forEach(g => set.add(g));

    if (set.size === 0) {
      [
        'Sundry Debtors', 'Sundry Creditors', 'Bank Accounts', 'Bank OD A/c', 'Cash-in-hand',
        'Duties & Taxes', 'Direct Expenses', 'Indirect Expenses', 'Direct Incomes', 'Indirect Incomes',
        'Capital Account', 'Fixed Assets', 'Current Assets', 'Current Liabilities', 'Loans & Advances',
        'Provisions', 'Investments', 'Purchase Accounts', 'Sales Accounts', 'Branch / Divisions'
      ].forEach(g => set.add(g));
    }

    return Array.from(set).sort();
  }, [ledgerGroupsList, partyDataList, initialData, customGroups]);

  // Dynamically build ledger type options from DB ledgers collection & props (NO hardcoded lock)
  const ledgerTypeOptions = useMemo(() => {
    const set = new Set();

    (partyDataList || []).forEach(l => {
      if (l.ledgerType && typeof l.ledgerType === 'string' && l.ledgerType.trim()) {
        set.add(l.ledgerType.trim());
      }
    });

    if (initialData?.ledgerType && typeof initialData.ledgerType === 'string' && initialData.ledgerType.trim()) {
      set.add(initialData.ledgerType.trim());
    }

    (customLedgerTypes || []).forEach(t => set.add(t));
    if (formData?.ledgerType && typeof formData.ledgerType === 'string' && formData.ledgerType.trim()) {
      set.add(formData.ledgerType.trim());
    }

    if (set.size === 0) {
      [
        'Current Assets', 'Current Liabilities', 'Sales Accounts', 'Purchase Accounts',
        'Duties & Taxes', 'Indirect Expenses', 'Direct Expenses', 'Indirect Incomes',
        'Direct Incomes', 'Bank Accounts', 'Bank OD A/c', 'Cash-in-hand', 'Capital Account',
        'Fixed Assets', 'Loans & Advances', 'Provisions', 'Investments', 'Branch / Divisions'
      ].forEach(t => set.add(t));
    }

    return Array.from(set).sort();
  }, [partyDataList, initialData?.ledgerType, customLedgerTypes, formData?.ledgerType]);

  // Sync Form Data when initialData changes on Edit
  useEffect(() => {
    if (initialData) {
      const extracted = extractLedgerFormData(initialData);
      setFormData(extracted);
      if (extracted.groupId && !groupOptions.includes(extracted.groupId)) {
        setCustomGroups(prev => [...prev, extracted.groupId]);
      }
      // Sync form display configuration with the loaded record's features (per-ledger settings)
      const recVisible = initialData.visibleSections || {};
      const recFlags = initialData.flags || {};

      setVisibleSections({
        basicInfo: recVisible.basicInfo ?? true,
        accountingConfig: recVisible.accountingConfig ?? true,
        cfgBillWise: recVisible.cfgBillWise ?? recFlags.isBillWiseOn ?? extracted.isBillWiseOn ?? true,
        cfgCostCentres: recVisible.cfgCostCentres ?? recFlags.isCostCentresOn ?? extracted.isCostCentresOn ?? true,
        cfgAffectsStock: recVisible.cfgAffectsStock ?? recFlags.affectsStock ?? extracted.affectsStock ?? true,
        cfgInterest: recVisible.cfgInterest ?? recFlags.isInterestOn ?? extracted.isInterestOn ?? true,
        cfgPayroll: recVisible.cfgPayroll ?? recFlags.forPayroll ?? extracted.forPayroll ?? true,
        cfgEcomm: recVisible.cfgEcomm ?? recFlags.isEcommOperator ?? extracted.isEcommOperator ?? true,
        partyDetails: recVisible.partyDetails ?? true,
        addressLocation: recVisible.addressLocation ?? true,
        gstDetails: recVisible.gstDetails ?? extracted.gstApplicable ?? true,
        bankDetails: recVisible.bankDetails ?? true,
        taxConfig: recVisible.taxConfig ?? extracted.taxApplicable ?? true,
        tdsTcsDetails: recVisible.tdsTcsDetails ?? (extracted.tdsApplicable || extracted.tcsApplicable) ?? true,
        cfgTds: recVisible.cfgTds ?? extracted.tdsApplicable ?? true,
        cfgTcs: recVisible.cfgTcs ?? extracted.tcsApplicable ?? true,
        internalNotes: recVisible.internalNotes ?? true
      });
    } else {
      setVisibleSections(DEFAULT_VISIBLE_SECTIONS);
    }
  }, [initialData]);

  // UI state for custom group modal & form display config modal
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupParent, setNewGroupParent] = useState('Primary');

  // Form Display Configuration State (ALL ACTIVE BY DEFAULT)
  const DEFAULT_VISIBLE_SECTIONS = {
    basicInfo: true,
    accountingConfig: true,

    // Accounting Sub-feature Checkboxes (ALL ACTIVE BY DEFAULT)
    cfgBillWise: true,
    cfgCostCentres: true,
    cfgAffectsStock: true,
    cfgInterest: true,
    cfgPayroll: true,
    cfgEcomm: true,

    partyDetails: true,
    addressLocation: true,
    gstDetails: true,
    bankDetails: true,
    taxConfig: true,
    
    tdsTcsDetails: true,
    cfgTds: true,
    cfgTcs: true,

    internalNotes: true
  };

  const [visibleSections, setVisibleSections] = useState(() => {
    if (initialData) {
      const extracted = extractLedgerFormData(initialData);
      const recVisible = initialData.visibleSections || {};
      const recFlags = initialData.flags || {};

      return {
        basicInfo: recVisible.basicInfo ?? true,
        accountingConfig: recVisible.accountingConfig ?? true,
        cfgBillWise: recVisible.cfgBillWise ?? recFlags.isBillWiseOn ?? extracted.isBillWiseOn ?? true,
        cfgCostCentres: recVisible.cfgCostCentres ?? recFlags.isCostCentresOn ?? extracted.isCostCentresOn ?? true,
        cfgAffectsStock: recVisible.cfgAffectsStock ?? recFlags.affectsStock ?? extracted.affectsStock ?? true,
        cfgInterest: recVisible.cfgInterest ?? recFlags.isInterestOn ?? extracted.isInterestOn ?? true,
        cfgPayroll: recVisible.cfgPayroll ?? recFlags.forPayroll ?? extracted.forPayroll ?? true,
        cfgEcomm: recVisible.cfgEcomm ?? recFlags.isEcommOperator ?? extracted.isEcommOperator ?? true,
        partyDetails: recVisible.partyDetails ?? true,
        addressLocation: recVisible.addressLocation ?? true,
        gstDetails: recVisible.gstDetails ?? extracted.gstApplicable ?? true,
        bankDetails: recVisible.bankDetails ?? true,
        taxConfig: recVisible.taxConfig ?? extracted.taxApplicable ?? true,
        tdsTcsDetails: recVisible.tdsTcsDetails ?? (extracted.tdsApplicable || extracted.tcsApplicable) ?? true,
        cfgTds: recVisible.cfgTds ?? extracted.tdsApplicable ?? true,
        cfgTcs: recVisible.cfgTcs ?? extracted.tcsApplicable ?? true,
        internalNotes: recVisible.internalNotes ?? true
      };
    }
    return DEFAULT_VISIBLE_SECTIONS;
  });

  const toggleSectionVisibility = (sectionKey) => {
    setVisibleSections(prev => ({ ...prev, [sectionKey]: !prev[sectionKey] }));
  };

  const setAllSectionsVisibility = (val) => {
    const updated = {
      basicInfo: true,
      accountingConfig: val,
      cfgBillWise: val,
      cfgCostCentres: val,
      cfgAffectsStock: val,
      cfgInterest: val,
      cfgPayroll: val,
      cfgEcomm: val,
      partyDetails: val,
      addressLocation: val,
      gstDetails: val,
      bankDetails: val,
      taxConfig: val,
      tdsTcsDetails: val,
      cfgTds: val,
      cfgTcs: val,
      internalNotes: val
    };
    setVisibleSections(updated);
    localStorage.setItem('ledger_form_visible_sections', JSON.stringify(updated));
  };

  // Sync formData toggles when visibleSections config changes
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      isBillWiseOn: visibleSections.cfgBillWise !== false,
      isCostCentresOn: !!visibleSections.cfgCostCentres,
      affectsStock: !!visibleSections.cfgAffectsStock,
      isInterestOn: !!visibleSections.cfgInterest,
      forPayroll: !!visibleSections.cfgPayroll,
      isEcommOperator: !!visibleSections.cfgEcomm,
      tdsApplicable: visibleSections.tdsTcsDetails !== false && visibleSections.cfgTds !== false,
      tcsApplicable: visibleSections.tdsTcsDetails !== false && !!visibleSections.cfgTcs,
      gstApplicable: visibleSections.gstDetails !== false,
      taxApplicable: visibleSections.taxConfig !== false
    }));
  }, [
    visibleSections.cfgBillWise, 
    visibleSections.cfgCostCentres, 
    visibleSections.cfgAffectsStock, 
    visibleSections.cfgInterest, 
    visibleSections.cfgPayroll, 
    visibleSections.cfgEcomm,
    visibleSections.tdsTcsDetails,
    visibleSections.cfgTds,
    visibleSections.cfgTcs,
    visibleSections.gstDetails,
    visibleSections.taxConfig
  ]);

  // Helper updater
  const updateField = (key, val) => {
    setFormData(prev => {
      const updated = { ...prev, [key]: val };

      // When GSTIN changes, auto-derive State & City from GSTIN first 2 digits (State Code)
      if (key === 'gstin' && typeof val === 'string' && val.trim().length >= 2) {
        const prefix = val.trim().substring(0, 2);
        if (/^\d{2}$/.test(prefix)) {
          const autoState = normalizeState(prefix);
          if (autoState) {
            updated.stateId = autoState;
            updated.gstStateId = autoState;
            if (!updated.cityId && CITIES_BY_STATE[autoState] && CITIES_BY_STATE[autoState].length > 0) {
              updated.cityId = CITIES_BY_STATE[autoState][0];
            }
          }
        }
      }

      // When State changes, auto-sync GST Place of Supply and update City datalist suggestion
      if (key === 'stateId' && val) {
        const normState = normalizeState(val);
        updated.stateId = normState;
        updated.gstStateId = normState;
        if (CITIES_BY_STATE[normState] && CITIES_BY_STATE[normState].length > 0) {
          if (!updated.cityId || !CITIES_BY_STATE[normState].includes(updated.cityId)) {
            updated.cityId = CITIES_BY_STATE[normState][0];
          }
        }
      }

      return updated;
    });
  };

  // Group Dropdown state
  const [groupSearchOpen, setGroupSearchOpen] = useState(false);
  const [groupQuery, setGroupQuery] = useState('');
  const groupDropdownRef = useRef(null);

  useEffect(() => {
    const handleMousedown = (e) => {
      if (groupDropdownRef.current && !groupDropdownRef.current.contains(e.target)) {
        setGroupSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleMousedown);
    return () => document.removeEventListener('mousedown', handleMousedown);
  }, []);

  // Filtered Groups
  const filteredGroups = useMemo(() => {
    const q = groupQuery.trim().toLowerCase();
    if (!q) return groupOptions;
    return groupOptions.filter(g => g.toLowerCase().includes(q));
  }, [groupQuery, groupOptions]);

  // Progressive Disclosure Logic: Always show sections in Edit mode or if details exist, or if group matches party/bank
  const selectedGroup = formData.groupId || 'Sundry Debtors';
  const normGroup = selectedGroup.toLowerCase();

  const isPartyApplicable = true;
  const isBankApplicable = true;
  const isTaxApplicableGroup = true;

  // Auto-sync taxApplicable when group changes to Duties & Taxes
  useEffect(() => {
    if (isTaxApplicableGroup && !formData.taxApplicable) {
      updateField('taxApplicable', true);
    }
  }, [isTaxApplicableGroup]);

  // Form Submit Handler
  const handleSubmit = (e, keepOpen = false) => {
    if (e) e.preventDefault();

    if (!formData.ledgerName.trim()) {
      toast.error('Ledger Name is required');
      return;
    }

    if (!formData.groupId) {
      toast.error('Under / Group is required');
      return;
    }

    // Map backwards-compatible fields for callers expecting legacy keys
    const legacyMappedData = {
      ...formData,
      _id: initialData?._id || initialData?.id,
      id: initialData?._id || initialData?.id,
      sourceCollection: initialData?.sourceCollection || 'ledgers_entry',
      ledger: formData.ledgerName,
      name: formData.contactPerson || formData.ledgerName,
      parentGroup: formData.groupId,
      subGroup: formData.groupId,
      openingBalance: formData.openingBalanceAmount,
      balanceType: formData.openingBalanceType,
      mailingName: formData.contactPerson || formData.ledgerName,
      mobileNumber: formData.mobile,
      emailAddress: formData.email,
      add1: formData.address,
      add2: formData.addressLine2,
      pos: formData.stateId.split(' (')[0],
      registrationType: formData.gstRegistrationType,
      gstin: formData.gstin || 'N/A',
      gst: formData.gstin || 'N/A',
      type: formData.gstRegistrationType,
      city: formData.cityId || '—',
      maintainBillWise: formData.isBillWiseOn,
      branch: formData.branchName,
      visibleSections: visibleSections,
      flags: {
        isBillWiseOn: formData.isBillWiseOn,
        isCostCentresOn: formData.isCostCentresOn,
        affectsStock: formData.affectsStock,
        isInterestOn: formData.isInterestOn,
        forPayroll: formData.forPayroll,
        isEcommOperator: formData.isEcommOperator,
        tdsApplicable: formData.tdsApplicable,
        tcsApplicable: formData.tcsApplicable,
        gstApplicable: formData.gstApplicable,
        taxApplicable: formData.taxApplicable
      },
      isSynced: false
    };

    if (onSave) {
      onSave(legacyMappedData);
    }

    toast.success(isEdit ? 'Ledger updated successfully!' : 'Ledger created successfully!');

    if (keepOpen) {
      // Reset form for next ledger creation
      setFormData({
        ledgerName: '',
        alias: '',
        ledgerCode: '',
        groupId: formData.groupId, // Keep current group for rapid entry
        openingBalanceAmount: '',
        openingBalanceType: 'Dr',
        openingBalanceDate: new Date().toISOString().split('T')[0],
        status: 'Active',
        isBillWiseOn: true,
        isCostCentresOn: false,
        affectsStock: false,
        isInterestOn: false,
        forPayroll: false,
        isEcommOperator: false,
        creditPeriod: '',
        creditLimit: '',
        partyType: 'Customer',
        contactPerson: '',
        mobile: '',
        phone: '',
        email: '',
        panNumber: '',
        address: '',
        addressLine2: '',
        countryId: 'India',
        stateId: 'Maharashtra (27)',
        cityId: '',
        pinCode: '',
        gstApplicable: true,
        gstin: '',
        gstRegistrationType: 'Regular',
        gstStateId: 'Maharashtra (27)',
        gstTypeOfSupply: 'Goods',
        bankName: '',
        branchName: '',
        accountNumber: '',
        ifscCode: '',
        micrCode: '',
        swiftCode: '',
        virtualPaymentAddress: '',
        paymentFavouring: '',
        taxApplicable: false,
        taxType: 'GST',
        gstType: 'CGST',
        gstDutyHead: 'Output Tax',
        cessValuationMethod: 'Based on Value',
        tdsApplicable: false,
        tcsApplicable: false,
        tdsSectionId: '194C',
        tdsDeducteeTypeId: 'Company Resident',
        notes: ''
      });
    } else if (onClose) {
      onClose();
    }
  };

  // Add Custom Group Handler
  const handleAddNewGroup = () => {
    if (!newGroupName.trim()) {
      toast.error('Group name cannot be empty');
      return;
    }
    const createdName = newGroupName.trim();
    setCustomGroups(prev => [...prev, createdName]);
    updateField('groupId', createdName);
    setNewGroupName('');
    setShowCreateGroupModal(false);
    toast.success(`Group "${createdName}" added!`);
  };

  return (
    <div className="flex flex-col h-full bg-[var(--app-panel-bg)] text-[var(--app-text)] overflow-hidden font-sans">
      
      {/* 1. Header Bar */}
      <div className="shrink-0 px-4 py-2.5 border-b border-[var(--app-border)] bg-[var(--app-panel-bg)] flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg border border-[var(--app-border)] flex items-center justify-center text-[var(--app-muted)] hover:bg-[var(--app-control-hover)] hover:text-[var(--app-heading)] transition-colors shrink-0"
            title="Go Back"
          >
            <ArrowLeft size={15} />
          </button>
          
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--app-muted)]">
                Ledger Master / {isEdit ? 'Edit Ledger' : 'Create Ledger'}
              </span>
            </div>
            <h1 className="text-base md:text-lg font-extrabold tracking-tight text-[var(--app-heading)] truncate">
              {isEdit ? `Edit: ${formData.ledgerName || 'Ledger'}` : 'Create New Ledger'}
            </h1>
          </div>
        </div>

        {/* Top Header Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowConfigModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--app-accent)]/40 bg-[var(--app-accent-soft)]/50 hover:bg-[var(--app-accent-soft)] text-xs font-bold text-[var(--app-accent)] transition-all shadow-2xs"
            title="Configure visible form sections & fields"
          >
            <SlidersHorizontal size={13} />
            <span>Configure Form</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg border border-[var(--app-border)] text-xs font-semibold text-[var(--app-text)] hover:bg-[var(--app-control-hover)] transition-colors"
          >
            Cancel
          </button>

          {!isEdit && (
            <button
              type="button"
              onClick={(e) => handleSubmit(e, true)}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-[var(--app-accent)]/30 bg-[var(--app-accent-soft)] text-[var(--app-accent)] text-xs font-bold hover:bg-[var(--app-accent-soft)]/80 transition-colors"
            >
              <RotateCcw size={13} />
              Save & New
            </button>
          )}

          <button
            type="button"
            onClick={(e) => handleSubmit(e, false)}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[var(--app-accent)] text-white text-xs font-bold shadow-xs hover:opacity-90 transition-all"
          >
            <Save size={13} />
            {isEdit ? 'Update Ledger' : 'Save Ledger'}
          </button>
        </div>
      </div>

      {/* 2. Main Form Scrollable Container */}
      <form onSubmit={(e) => handleSubmit(e, false)} className="flex-1 min-h-0 overflow-y-auto p-3 md:p-4 space-y-3.5 no-scrollbar">
        
        {/* ============================================================ */}
        {/* SECTION 1: BASIC INFORMATION                                 */}
        {/* ============================================================ */}
        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-3 md:p-3.5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2">
            <div className="flex items-center gap-2 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
              <BookOpen size={14} />
              <span>Basic Information</span>
            </div>
            <span className="text-[10px] text-[var(--app-muted)] font-medium">* Required Fields</span>
          </div>

          <div className="space-y-2.5 text-xs">
            {/* Row 1: Ledger Name (2 cols) & Alias (1 col) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                  Ledger Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.ledgerName}
                  onChange={(e) => updateField('ledgerName', e.target.value)}
                  placeholder="e.g. Acme Corporation Pvt Ltd"
                  className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-medium text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] focus:ring-1 focus:ring-[var(--app-accent)]/20 transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                  Alias / Display Name
                </label>
                <input
                  type="text"
                  value={formData.alias}
                  onChange={(e) => updateField('alias', e.target.value)}
                  placeholder="e.g. Acme Corp"
                  className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-medium text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] transition-all"
                />
              </div>
            </div>

            {/* Row 2: Ledger Code & Under / Group (Searchable) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                  Ledger Code / Account Code
                </label>
                <input
                  type="text"
                  value={formData.ledgerCode}
                  onChange={(e) => updateField('ledgerCode', e.target.value)}
                  placeholder="e.g. LED-1002"
                  className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-mono font-medium text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] transition-all"
                />
              </div>

              <div className="relative" ref={groupDropdownRef}>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                  Under / Ledger Group *
                </label>

                {/* Searchable Dropdown Button Trigger */}
                <div
                  onClick={() => setGroupSearchOpen(prev => !prev)}
                  className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 flex items-center justify-between text-xs font-bold text-[var(--app-heading)] cursor-pointer hover:border-[var(--app-accent)] transition-all"
                >
                  <span className="truncate">{formData.groupId}</span>
                  <ChevronDown size={14} className="text-[var(--app-muted)] shrink-0" />
                </div>

                {/* Dropdown Menu Overlay */}
                <AnimatePresence>
                  {groupSearchOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -4, scale: 0.99 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.99 }}
                      transition={{ duration: 0.12 }}
                      className="absolute z-50 mt-1 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] shadow-xl p-1.5 text-xs"
                    >
                      <div className="mb-1.5 flex items-center gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2.5 py-1.5">
                        <Search size={13} className="text-[var(--app-muted)] shrink-0" />
                        <input
                          autoFocus
                          type="text"
                          value={groupQuery}
                          onChange={(e) => setGroupQuery(e.target.value)}
                          placeholder="Search accounting group…"
                          className="w-full bg-transparent text-xs outline-none text-[var(--app-heading)]"
                        />
                      </div>

                      <div className="max-h-52 overflow-y-auto no-scrollbar space-y-0.5">
                        {filteredGroups.length === 0 && (
                          <div className="p-3 text-center text-xs text-[var(--app-muted)]">
                            No group found matching "{groupQuery}"
                          </div>
                        )}

                        {filteredGroups.map(grp => {
                          const isSel = grp === formData.groupId;
                          return (
                            <button
                              key={grp}
                              type="button"
                              onClick={() => {
                                updateField('groupId', grp);
                                setGroupSearchOpen(false);
                                setGroupQuery('');
                              }}
                              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left text-xs font-medium transition-colors ${
                                isSel 
                                  ? 'bg-[var(--app-accent-soft)] text-[var(--app-accent)] font-bold' 
                                  : 'text-[var(--app-heading)] hover:bg-[var(--app-control-hover)]'
                              }`}
                            >
                              <span>{grp}</span>
                              {isSel && <Check size={13} />}
                            </button>
                          );
                        })}
                      </div>

                      <div className="mt-1 pt-1 border-t border-[var(--app-border)]">
                        <button
                          type="button"
                          onClick={() => {
                            setGroupSearchOpen(false);
                            setShowCreateGroupModal(true);
                          }}
                          className="w-full py-1.5 px-2 rounded-lg bg-[var(--app-control-hover)] hover:bg-[var(--app-accent-soft)] hover:text-[var(--app-accent)] text-[11px] font-bold text-center text-[var(--app-muted)] transition-colors flex items-center justify-center gap-1"
                        >
                          <Plus size={12} />
                          <span>Add New Group "{groupQuery || 'Custom'}"</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                  Ledger Type *
                </label>
                <select
                  value={formData.ledgerType || ''}
                  onChange={(e) => updateField('ledgerType', e.target.value)}
                  className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-bold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] transition-all cursor-pointer"
                >
                  <option value="">-- Select Ledger Type --</option>
                  {ledgerTypeOptions.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 3: Opening Balance, Debit/Credit, Opening Balance Date & Status */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                  Opening Balance
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--app-muted)]">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.openingBalanceAmount}
                    onChange={(e) => updateField('openingBalanceAmount', e.target.value)}
                    placeholder="0.00"
                    className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] pl-6 pr-3 text-xs font-mono font-bold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                  Balance Type
                </label>
                <div className="h-8.5 flex rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] p-0.5">
                  <button
                    type="button"
                    onClick={() => updateField('openingBalanceType', 'Dr')}
                    className={`flex-1 rounded-md text-xs font-bold transition-all ${
                      formData.openingBalanceType === 'Dr'
                        ? 'bg-[var(--app-accent)] text-white shadow-xs'
                        : 'text-[var(--app-muted)] hover:text-[var(--app-heading)]'
                    }`}
                  >
                    Debit (Dr)
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField('openingBalanceType', 'Cr')}
                    className={`flex-1 rounded-md text-xs font-bold transition-all ${
                      formData.openingBalanceType === 'Cr'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-[var(--app-muted)] hover:text-[var(--app-heading)]'
                    }`}
                  >
                    Credit (Cr)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                  As On Date
                </label>
                <input
                  type="date"
                  value={formData.openingBalanceDate}
                  onChange={(e) => updateField('openingBalanceDate', e.target.value)}
                  className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2.5 text-xs font-medium text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => updateField('status', e.target.value)}
                  className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2.5 text-xs font-bold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] transition-all"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* ACCOUNTING FEATURE SECTIONS (Driven by Configure Form)       */}
        {/* ============================================================ */}
        
        {/* 1. Bill-wise Accounting Details */}
        {visibleSections.accountingConfig !== false && visibleSections.cfgBillWise !== false && (
          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-3 md:p-3.5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2">
              <div className="flex items-center gap-2 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
                <FileText size={14} />
                <span>Bill-wise Accounting Details</span>
              </div>
              <span className="text-[10px] text-[var(--app-muted)]">Credit Terms & Limits</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                  Default Credit Period (Days)
                </label>
                <input
                  type="number"
                  value={formData.creditPeriod}
                  onChange={(e) => updateField('creditPeriod', e.target.value)}
                  placeholder="30"
                  className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs outline-none text-[var(--app-heading)] focus:border-[var(--app-accent)] font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                  Default Credit Limit (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--app-muted)]">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.creditLimit}
                    onChange={(e) => updateField('creditLimit', e.target.value)}
                    placeholder="1,000,000"
                    className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] pl-6 pr-3 text-xs font-mono font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* E-Commerce Merchant Details */}
        {visibleSections.accountingConfig !== false && visibleSections.cfgEcomm && (
          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-3 md:p-3.5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2">
              <div className="flex items-center gap-2 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
                <Settings size={14} />
                <span>E-Commerce Merchant Details</span>
              </div>
              <span className="text-[10px] text-[var(--app-muted)] font-medium">Tally ISECOMMOPERATOR</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                  Is E-Commerce Operator? *
                </label>
                <select
                  value={formData.isEcommOperator ? 'Yes' : 'No'}
                  onChange={(e) => updateField('isEcommOperator', e.target.value === 'Yes')}
                  className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2.5 text-xs font-bold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] transition-all"
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>

              {formData.isEcommOperator && (
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                    E-Commerce Operator GSTIN / Merchant ID
                  </label>
                  <input
                    type="text"
                    maxLength={15}
                    value={formData.ecommGstin || ''}
                    onChange={(e) => updateField('ecommGstin', e.target.value.toUpperCase())}
                    placeholder="27AAACE1234F1Z0"
                    className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-mono font-bold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                  />
                </div>
              )}
            </div>
          </div>
        )}



        {/* ============================================================ */}
        {/* SECTION 3: PARTY DETAILS (Progressive Disclosure)            */}
        {/* ============================================================ */}
        {visibleSections.partyDetails !== false && isPartyApplicable && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-3 md:p-3.5 shadow-2xs space-y-3"
          >
            <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2">
              <div className="flex items-center gap-2 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
                <User size={14} />
                <span>Party Contact Details</span>
              </div>
              <span className="text-[10px] text-[var(--app-muted)] font-medium">Shown for {selectedGroup}</span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                    Party Type
                  </label>
                  <select
                    value={formData.partyType}
                    onChange={(e) => updateField('partyType', e.target.value)}
                    className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2.5 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                  >
                    <option value="Customer">Customer</option>
                    <option value="Vendor">Vendor</option>
                    <option value="Both">Both (Customer & Vendor)</option>
                    <option value="Employee">Employee</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                    Contact Person Name
                  </label>
                  <input
                    type="text"
                    value={formData.contactPerson}
                    onChange={(e) => updateField('contactPerson', e.target.value)}
                    placeholder="e.g. Mr. Rajesh Sharma"
                    className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                    Mobile Number
                  </label>
                  <input
                    type="tel"
                    value={formData.mobile}
                    onChange={(e) => updateField('mobile', e.target.value)}
                    placeholder="9876543210"
                    className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                    Phone / Telephone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => updateField('phone', e.target.value)}
                    placeholder="022-28491000"
                    className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateField('email', e.target.value)}
                    placeholder="accounts@acme.com"
                    className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                    PAN Number
                  </label>
                  <input
                    type="text"
                    maxLength={10}
                    value={formData.panNumber}
                    onChange={(e) => updateField('panNumber', e.target.value.toUpperCase())}
                    placeholder="ABCDE1234F"
                    className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-mono font-bold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}


        {/* ============================================================ */}
        {/* SECTION 4: ADDRESS & LOCATION (Progressive Disclosure)       */}
        {/* ============================================================ */}
        {visibleSections.addressLocation !== false && isPartyApplicable && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-3 md:p-3.5 shadow-2xs space-y-3"
          >
            <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2">
              <div className="flex items-center gap-2 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
                <MapPin size={14} />
                <span>Address & Location</span>
              </div>
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                  Address Line 1
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => updateField('address', e.target.value)}
                  placeholder="Plot / Building / Office No. & Street"
                  className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                  Address Line 2
                </label>
                <input
                  type="text"
                  value={formData.addressLine2}
                  onChange={(e) => updateField('addressLine2', e.target.value)}
                  placeholder="Area / Landmark / Industrial Estate"
                  className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                    Country
                  </label>
                  <select
                    value={formData.countryId}
                    onChange={(e) => updateField('countryId', e.target.value)}
                    className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2.5 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                  >
                    {COUNTRIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                    State
                  </label>
                  <select
                    value={formData.stateId || ''}
                    onChange={(e) => {
                      updateField('stateId', e.target.value);
                      updateField('gstStateId', e.target.value);
                    }}
                    className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2.5 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                  >
                    <option value="">-- Select State --</option>
                    {INDIA_STATES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    list="city-options"
                    value={formData.cityId}
                    onChange={(e) => updateField('cityId', e.target.value)}
                    placeholder="City Name"
                    className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                  />
                  <datalist id="city-options">
                    {(CITIES_BY_STATE[formData.stateId] || []).map(city => (
                      <option key={city} value={city} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                    Pincode
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={formData.pinCode}
                    onChange={(e) => updateField('pinCode', e.target.value)}
                    placeholder="400001"
                    className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-mono font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}


        {/* ============================================================ */}
        {/* SECTION 5: GST DETAILS (Driven by Configure Form)           */}
        {/* ============================================================ */}
        {visibleSections.gstDetails !== false && (isPartyApplicable || isTaxApplicableGroup) && (
          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-3 md:p-3.5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2">
              <div className="flex items-center gap-2 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
                <ShieldCheck size={14} />
                <span>GST Identification & Registration</span>
              </div>
              <span className="text-[10px] text-[var(--app-muted)]">GST Master Parameters</span>
            </div>

            <div className="space-y-2.5 text-xs pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                    GSTIN / UIN Number
                  </label>
                  <input
                    type="text"
                    maxLength={15}
                    value={formData.gstin}
                    onChange={(e) => updateField('gstin', e.target.value.toUpperCase())}
                    placeholder="27ABCDE1234F1Z5"
                    className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-mono font-bold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                    GST Registration Type
                  </label>
                  <select
                    value={formData.gstRegistrationType}
                    onChange={(e) => updateField('gstRegistrationType', e.target.value)}
                    className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2.5 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                  >
                    <option value="Regular">Regular</option>
                    <option value="Composition">Composition</option>
                    <option value="Unregistered">Unregistered</option>
                    <option value="Consumer">Consumer</option>
                    <option value="Overseas">Overseas</option>
                    <option value="SEZ">SEZ Developer / Unit</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                    GST Place of Supply (State)
                  </label>
                  <select
                    value={formData.gstStateId || ''}
                    onChange={(e) => updateField('gstStateId', e.target.value)}
                    className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2.5 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                  >
                    <option value="">-- Select State --</option>
                    {INDIA_STATES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                    Type of Supply
                  </label>
                  <select
                    value={formData.gstTypeOfSupply}
                    onChange={(e) => updateField('gstTypeOfSupply', e.target.value)}
                    className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2.5 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                  >
                    <option value="Goods">Goods</option>
                    <option value="Services">Services</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}


        {/* ============================================================ */}
        {/* SECTION 6: BANK DETAILS (Progressive Disclosure)             */}
        {/* ============================================================ */}
        {visibleSections.bankDetails !== false && isBankApplicable && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-3 md:p-3.5 shadow-2xs space-y-3"
          >
            <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2">
              <div className="flex items-center gap-2 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
                <Landmark size={14} />
                <span>Bank Details</span>
              </div>
              <span className="text-[10px] text-[var(--app-muted)]">Bank account & payment info</span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                    Bank Name (Predefined Searchable List)
                  </label>
                  <input
                    type="text"
                    list="predefined-bank-options"
                    value={formData.bankName}
                    onChange={(e) => updateField('bankName', e.target.value)}
                    placeholder="Search Bank Name (e.g. SBI, HDFC, ICICI)"
                    className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] transition-all"
                  />
                  <datalist id="predefined-bank-options">
                    {PREDEFINED_BANKS.map((b) => (
                      <option key={b} value={b} />
                    ))}
                  </datalist>
                </div>


                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                    Branch Name
                  </label>
                  <input
                    type="text"
                    value={formData.branchName}
                    onChange={(e) => updateField('branchName', e.target.value)}
                    placeholder="Fort Branch, Mumbai"
                    className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                    Account Number
                  </label>
                  <input
                    type="text"
                    value={formData.accountNumber}
                    onChange={(e) => updateField('accountNumber', e.target.value)}
                    placeholder="50200012345678"
                    className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-mono font-bold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                    IFSC Code
                  </label>
                  <input
                    type="text"
                    maxLength={11}
                    value={formData.ifscCode}
                    onChange={(e) => updateField('ifscCode', e.target.value.toUpperCase())}
                    placeholder="HDFC0000240"
                    className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-mono font-bold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                    MICR Code
                  </label>
                  <input
                    type="text"
                    value={formData.micrCode}
                    onChange={(e) => updateField('micrCode', e.target.value)}
                    placeholder="400240002"
                    className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-mono text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                    SWIFT Code (International)
                  </label>
                  <input
                    type="text"
                    value={formData.swiftCode}
                    onChange={(e) => updateField('swiftCode', e.target.value.toUpperCase())}
                    placeholder="HDFCINBBXXX"
                    className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-mono text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                    UPI / VPA ID
                  </label>
                  <input
                    type="text"
                    value={formData.virtualPaymentAddress}
                    onChange={(e) => updateField('virtualPaymentAddress', e.target.value)}
                    placeholder="acme@hdfcbank"
                    className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                    Cheque Favouring Name
                  </label>
                  <input
                    type="text"
                    value={formData.paymentFavouring}
                    onChange={(e) => updateField('paymentFavouring', e.target.value)}
                    placeholder="Acme Corp Pvt Ltd"
                    className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}


        {/* ============================================================ */}
        {/* SECTION 7: TAX CONFIGURATION (Driven by Configure Form)       */}
        {/* ============================================================ */}
        {visibleSections.taxConfig !== false && (
          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-3 md:p-3.5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2">
              <div className="flex items-center gap-2 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
                <Percent size={14} />
                <span>Tax & Duty Head Parameters</span>
              </div>
              <span className="text-[10px] text-[var(--app-muted)] font-medium">Duties & Taxes Setup</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs pt-1">
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                  Tax Type
                </label>
                <select
                  value={formData.taxType}
                  onChange={(e) => updateField('taxType', e.target.value)}
                  className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2.5 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                >
                  <option value="GST">GST</option>
                  <option value="TCS">TCS</option>
                  <option value="TDS">TDS</option>
                  <option value="Cess">Cess</option>
                  <option value="Others">Others</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                  GST Type
                </label>
                <select
                  value={formData.gstType}
                  onChange={(e) => updateField('gstType', e.target.value)}
                  className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2.5 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                >
                  <option value="CGST">CGST (Central Tax)</option>
                  <option value="SGST">SGST (State Tax)</option>
                  <option value="IGST">IGST (Integrated Tax)</option>
                  <option value="UTGST">UTGST (Union Territory Tax)</option>
                  <option value="Cess">Cess</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                  GST Duty Head
                </label>
                <select
                  value={formData.gstDutyHead}
                  onChange={(e) => updateField('gstDutyHead', e.target.value)}
                  className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2.5 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                >
                  <option value="Output Tax">Output Tax (Sales)</option>
                  <option value="Input Tax Credit">Input Tax Credit (Purchase)</option>
                  <option value="RCM Tax">RCM Reverse Charge</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                  Cess Valuation Method
                </label>
                <select
                  value={formData.cessValuationMethod}
                  onChange={(e) => updateField('cessValuationMethod', e.target.value)}
                  className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2.5 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                >
                  <option value="Based on Value">Based on Value (%)</option>
                  <option value="Based on Quantity">Based on Quantity (per Unit)</option>
                </select>
              </div>
            </div>
          </div>
        )}


        {/* ============================================================ */}
        {/* SECTION 8: TDS / TCS DETAILS (Driven by Configure Form)      */}
        {/* ============================================================ */}
        
        {/* 1. TDS Accounting Details */}
        {visibleSections.tdsTcsDetails !== false && visibleSections.cfgTds !== false && (
          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-3 md:p-3.5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2">
              <div className="flex items-center gap-2 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
                <FileText size={14} />
                <span>TDS Accounting Details</span>
              </div>
              <span className="text-[10px] text-[var(--app-muted)] font-medium">Tax Deducted at Source</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                  TDS Section
                </label>
                <select
                  value={formData.tdsSectionId}
                  onChange={(e) => updateField('tdsSectionId', e.target.value)}
                  className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2.5 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                >
                  <option value="194C">194C - Payment to Contractors</option>
                  <option value="194J">194J - Professional / Technical Fees</option>
                  <option value="194I">194I - Rent on Land or Building</option>
                  <option value="194H">194H - Commission or Brokerage</option>
                  <option value="194Q">194Q - Purchase of Goods</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                  Deductee Type
                </label>
                <select
                  value={formData.tdsDeducteeTypeId}
                  onChange={(e) => updateField('tdsDeducteeTypeId', e.target.value)}
                  className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2.5 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                >
                  <option value="Company Resident">Company Resident</option>
                  <option value="Non-Company Resident">Non-Company Resident (Individual/HUF)</option>
                  <option value="Partnership Firm">Partnership Firm</option>
                  <option value="Non-Resident">Non-Resident</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* 2. TCS Collection Details */}
        {visibleSections.tdsTcsDetails !== false && visibleSections.cfgTcs && (
          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-3 md:p-3.5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2">
              <div className="flex items-center gap-2 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
                <Percent size={14} />
                <span>TCS Collection Details</span>
              </div>
              <span className="text-[10px] text-[var(--app-muted)] font-medium">Tax Collected at Source</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                  TCS Nature of Goods / Category
                </label>
                <select
                  value={formData.tcsNatureOfGoods || 'Sale of Any Goods (206C 1H)'}
                  onChange={(e) => updateField('tcsNatureOfGoods', e.target.value)}
                  className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2.5 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                >
                  <option value="Sale of Any Goods (206C 1H)">Sale of Any Goods (Sec 206C 1H)</option>
                  <option value="Timber & Forest Produce">Timber & Forest Produce</option>
                  <option value="Scrap Sale">Scrap Sale</option>
                  <option value="Minerals (Coal / Iron Ore)">Minerals (Coal / Iron Ore)</option>
                  <option value="Tendu Leaves">Tendu Leaves</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                  Collector Type / Category
                </label>
                <select
                  value={formData.tcsCollectorType || 'Company Resident'}
                  onChange={(e) => updateField('tcsCollectorType', e.target.value)}
                  className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2.5 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                >
                  <option value="Company Resident">Company Resident</option>
                  <option value="Individual / HUF">Individual / HUF</option>
                  <option value="Partnership Firm">Partnership Firm</option>
                  <option value="Government Body">Government Body</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Additional Notes Box */}
        {visibleSections.internalNotes !== false && (
          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-3 md:p-3.5 shadow-2xs space-y-2">
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] font-bold">
              Internal Accounting Notes & Remarks (Optional)
            </label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              placeholder="Special credit terms, reference contracts, or internal remarks..."
              className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] p-2.5 text-xs text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] resize-none"
            />
          </div>
        )}

      </form>

      {/* 3. Sticky Action Bar */}
      <div className="shrink-0 px-4 py-3 border-t border-[var(--app-border)] bg-[var(--app-panel-bg)] flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-[var(--app-border)] text-xs font-semibold text-[var(--app-text)] hover:bg-[var(--app-control-hover)] transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => setShowConfigModal(true)}
            className="px-3.5 py-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] hover:bg-[var(--app-control-hover)] text-xs font-bold text-[var(--app-heading)] flex items-center gap-1.5 transition-colors"
          >
            <SlidersHorizontal size={13} className="text-[var(--app-accent)]" />
            <span>Configure Form</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {!isEdit && (
            <button
              type="button"
              onClick={(e) => handleSubmit(e, true)}
              className="px-4 py-2 rounded-lg border border-[var(--app-accent)]/40 bg-[var(--app-accent-soft)] text-[var(--app-accent)] text-xs font-bold hover:bg-[var(--app-accent-soft)]/80 transition-colors"
            >
              Save & Create Another
            </button>
          )}

          <button
            type="button"
            onClick={(e) => handleSubmit(e, false)}
            className="px-5 py-2 rounded-lg bg-[var(--app-accent)] text-white text-xs font-bold shadow-sm hover:opacity-90 transition-all flex items-center gap-1.5"
          >
            <CheckCircle2 size={14} />
            <span>{isEdit ? 'Update Ledger Master' : 'Save Ledger Master'}</span>
          </button>
        </div>
      </div>


      {/* ============================================================ */}
      {/* FORM DISPLAY CONFIGURATION MODAL                             */}
      {/* ============================================================ */}
      <AnimatePresence>
        {showConfigModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] shadow-2xl p-4 md:p-5 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-[var(--app-accent-soft)] text-[var(--app-accent)]">
                    <SlidersHorizontal size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm md:text-base font-extrabold text-[var(--app-heading)]">Configure Form Display</h3>
                    <p className="text-[11px] text-[var(--app-muted)]">Select which sections to display or hide in your Ledger Form</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="p-1 text-[var(--app-muted)] hover:text-[var(--app-heading)] rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-2 max-h-[60vh] overflow-y-auto no-scrollbar p-1 text-xs">
                
                {/* Section item 1 */}
                <div className="flex items-center justify-between p-2.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-content-bg)]/40 opacity-70 cursor-not-allowed">
                  <div className="flex items-center gap-2.5">
                    <BookOpen size={15} className="text-[var(--app-accent)]" />
                    <div>
                      <div className="font-bold text-[var(--app-heading)]">Basic Information</div>
                      <div className="text-[10px] text-[var(--app-muted)]">Ledger Name, Group, Opening Balance, Status (Required)</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-accent)] bg-[var(--app-accent-soft)] px-2 py-0.5 rounded-md">Always Active</span>
                </div>

                {/* Section item 2: Accounting Configuration & Sub-features */}
                <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-content-bg)]/40 p-2.5 space-y-2">
                  <div 
                    onClick={() => toggleSectionVisibility('accountingConfig')}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <Settings size={15} className="text-[var(--app-accent)]" />
                      <div>
                        <div className="font-bold text-[var(--app-heading)]">Accounting Configuration</div>
                        <div className="text-[10px] text-[var(--app-muted)]">Enable / Disable Accounting Sub-features below</div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={visibleSections.accountingConfig !== false}
                      onChange={() => {}}
                      className="h-4 w-4 rounded accent-[var(--app-accent)] cursor-pointer"
                    />
                  </div>

                  {/* Sub-feature Checkboxes under Accounting Configuration */}
                  {visibleSections.accountingConfig !== false && (
                    <div className="pl-6 pt-1 space-y-1.5 border-t border-[var(--app-border)]/50">
                      
                      {/* Sub-feature 1: Bill-wise */}
                      <div 
                        onClick={(e) => { e.stopPropagation(); toggleSectionVisibility('cfgBillWise'); }}
                        className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-[var(--app-control-hover)] cursor-pointer"
                      >
                        <span className="text-[11px] font-semibold text-[var(--app-heading)]">• Maintain Bill-wise Details (Credit Period & Limit)</span>
                        <input
                          type="checkbox"
                          checked={visibleSections.cfgBillWise !== false}
                          onChange={() => {}}
                          className="h-3.5 w-3.5 rounded accent-[var(--app-accent)] cursor-pointer"
                        />
                      </div>

                      {/* Sub-feature 2: Cost Centres */}
                      <div 
                        onClick={(e) => { e.stopPropagation(); toggleSectionVisibility('cfgCostCentres'); }}
                        className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-[var(--app-control-hover)] cursor-pointer"
                      >
                        <span className="text-[11px] font-semibold text-[var(--app-heading)]">• Cost Centres Applicable (Cost Category Link)</span>
                        <input
                          type="checkbox"
                          checked={!!visibleSections.cfgCostCentres}
                          onChange={() => {}}
                          className="h-3.5 w-3.5 rounded accent-[var(--app-accent)] cursor-pointer"
                        />
                      </div>

                      {/* Sub-feature 3: Inventory Linkage */}
                      <div 
                        onClick={(e) => { e.stopPropagation(); toggleSectionVisibility('cfgAffectsStock'); }}
                        className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-[var(--app-control-hover)] cursor-pointer"
                      >
                        <span className="text-[11px] font-semibold text-[var(--app-heading)]">• Inventory Values Affected (Stock Item Link)</span>
                        <input
                          type="checkbox"
                          checked={!!visibleSections.cfgAffectsStock}
                          onChange={() => {}}
                          className="h-3.5 w-3.5 rounded accent-[var(--app-accent)] cursor-pointer"
                        />
                      </div>


                      {/* Sub-feature 6: E-Commerce */}
                      <div 
                        onClick={(e) => { e.stopPropagation(); toggleSectionVisibility('cfgEcomm'); }}
                        className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-[var(--app-control-hover)] cursor-pointer"
                      >
                        <span className="text-[11px] font-semibold text-[var(--app-heading)]">• Is E-Commerce Operator (Marketplace GSTIN)</span>
                        <input
                          type="checkbox"
                          checked={!!visibleSections.cfgEcomm}
                          onChange={() => {}}
                          className="h-3.5 w-3.5 rounded accent-[var(--app-accent)] cursor-pointer"
                        />
                      </div>

                    </div>
                  )}
                </div>

                {/* Section item 3 */}
                <div 
                  onClick={() => toggleSectionVisibility('partyDetails')}
                  className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-colors ${
                    visibleSections.partyDetails 
                      ? 'border-[var(--app-accent)] bg-[var(--app-accent-soft)]/20' 
                      : 'border-[var(--app-border)] bg-[var(--app-content-bg)]/30 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <User size={15} className="text-[var(--app-accent)]" />
                    <div>
                      <div className="font-bold text-[var(--app-heading)]">Party Contact Details</div>
                      <div className="text-[10px] text-[var(--app-muted)]">Party Type, Contact Person, Mobile, Email, PAN</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={visibleSections.partyDetails !== false}
                    onChange={() => {}}
                    className="h-4 w-4 rounded accent-[var(--app-accent)] cursor-pointer"
                  />
                </div>

                {/* Section item 4 */}
                <div 
                  onClick={() => toggleSectionVisibility('addressLocation')}
                  className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-colors ${
                    visibleSections.addressLocation 
                      ? 'border-[var(--app-accent)] bg-[var(--app-accent-soft)]/20' 
                      : 'border-[var(--app-border)] bg-[var(--app-content-bg)]/30 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <MapPin size={15} className="text-[var(--app-accent)]" />
                    <div>
                      <div className="font-bold text-[var(--app-heading)]">Address & Location</div>
                      <div className="text-[10px] text-[var(--app-muted)]">Address 1 & 2, Country, State, City, Pincode</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={visibleSections.addressLocation !== false}
                    onChange={() => {}}
                    className="h-4 w-4 rounded accent-[var(--app-accent)] cursor-pointer"
                  />
                </div>

                {/* Section item 5 */}
                <div 
                  onClick={() => toggleSectionVisibility('gstDetails')}
                  className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-colors ${
                    visibleSections.gstDetails 
                      ? 'border-[var(--app-accent)] bg-[var(--app-accent-soft)]/20' 
                      : 'border-[var(--app-border)] bg-[var(--app-content-bg)]/30 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck size={15} className="text-[var(--app-accent)]" />
                    <div>
                      <div className="font-bold text-[var(--app-heading)]">GST Details</div>
                      <div className="text-[10px] text-[var(--app-muted)]">GSTIN Number, Registration Type, Place of Supply</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={visibleSections.gstDetails !== false}
                    onChange={() => {}}
                    className="h-4 w-4 rounded accent-[var(--app-accent)] cursor-pointer"
                  />
                </div>

                {/* Section item 6 */}
                <div 
                  onClick={() => toggleSectionVisibility('bankDetails')}
                  className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-colors ${
                    visibleSections.bankDetails 
                      ? 'border-[var(--app-accent)] bg-[var(--app-accent-soft)]/20' 
                      : 'border-[var(--app-border)] bg-[var(--app-content-bg)]/30 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Landmark size={15} className="text-[var(--app-accent)]" />
                    <div>
                      <div className="font-bold text-[var(--app-heading)]">Bank Details</div>
                      <div className="text-[10px] text-[var(--app-muted)]">Bank Name, Branch, Account No, IFSC, SWIFT, VPA</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={visibleSections.bankDetails !== false}
                    onChange={() => {}}
                    className="h-4 w-4 rounded accent-[var(--app-accent)] cursor-pointer"
                  />
                </div>

                {/* Section item 7 */}
                <div 
                  onClick={() => toggleSectionVisibility('taxConfig')}
                  className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-colors ${
                    visibleSections.taxConfig 
                      ? 'border-[var(--app-accent)] bg-[var(--app-accent-soft)]/20' 
                      : 'border-[var(--app-border)] bg-[var(--app-content-bg)]/30 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Percent size={15} className="text-[var(--app-accent)]" />
                    <div>
                      <div className="font-bold text-[var(--app-heading)]">Tax Configuration</div>
                      <div className="text-[10px] text-[var(--app-muted)]">Tax Type, GST Duty Head, Cess Valuation Method</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={visibleSections.taxConfig !== false}
                    onChange={() => {}}
                    className="h-4 w-4 rounded accent-[var(--app-accent)] cursor-pointer"
                  />
                </div>

                {/* Section item 8: TDS / TCS Details */}
                <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-content-bg)]/40 p-2.5 space-y-2">
                  <div 
                    onClick={() => toggleSectionVisibility('tdsTcsDetails')}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <FileText size={15} className="text-[var(--app-accent)]" />
                      <div>
                        <div className="font-bold text-[var(--app-heading)]">TDS / TCS Details</div>
                        <div className="text-[10px] text-[var(--app-muted)]">Enable / Disable Statutory TDS / TCS Tax Sub-features</div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={visibleSections.tdsTcsDetails !== false}
                      onChange={() => {}}
                      className="h-4 w-4 rounded accent-[var(--app-accent)] cursor-pointer"
                    />
                  </div>

                  {visibleSections.tdsTcsDetails !== false && (
                    <div className="pl-6 pt-1 space-y-1.5 border-t border-[var(--app-border)]/50">
                      <div 
                        onClick={(e) => { e.stopPropagation(); toggleSectionVisibility('cfgTds'); }}
                        className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-[var(--app-control-hover)] cursor-pointer"
                      >
                        <span className="text-[11px] font-semibold text-[var(--app-heading)]">• TDS Deductions Applicable (TDS Section & Deductee Type)</span>
                        <input
                          type="checkbox"
                          checked={visibleSections.cfgTds !== false}
                          onChange={() => {}}
                          className="h-3.5 w-3.5 rounded accent-[var(--app-accent)] cursor-pointer"
                        />
                      </div>

                      <div 
                        onClick={(e) => { e.stopPropagation(); toggleSectionVisibility('cfgTcs'); }}
                        className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-[var(--app-control-hover)] cursor-pointer"
                      >
                        <span className="text-[11px] font-semibold text-[var(--app-heading)]">• TCS Collection Applicable (TCS Nature of Goods & Collector Type)</span>
                        <input
                          type="checkbox"
                          checked={!!visibleSections.cfgTcs}
                          onChange={() => {}}
                          className="h-3.5 w-3.5 rounded accent-[var(--app-accent)] cursor-pointer"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Section item 9 */}
                <div 
                  onClick={() => toggleSectionVisibility('internalNotes')}
                  className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-colors ${
                    visibleSections.internalNotes 
                      ? 'border-[var(--app-accent)] bg-[var(--app-accent-soft)]/20' 
                      : 'border-[var(--app-border)] bg-[var(--app-content-bg)]/30 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Info size={15} className="text-[var(--app-accent)]" />
                    <div>
                      <div className="font-bold text-[var(--app-heading)]">Internal Accounting Notes</div>
                      <div className="text-[10px] text-[var(--app-muted)]">Remarks and special customer notes</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={visibleSections.internalNotes !== false}
                    onChange={() => {}}
                    className="h-4 w-4 rounded accent-[var(--app-accent)] cursor-pointer"
                  />
                </div>

              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[var(--app-border)] text-xs">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAllSectionsVisibility(true)}
                    className="text-[11px] font-bold text-[var(--app-accent)] hover:underline"
                  >
                    Show All
                  </button>
                  <span className="text-[var(--app-muted)]">•</span>
                  <button
                    type="button"
                    onClick={() => setAllSectionsVisibility(false)}
                    className="text-[11px] font-bold text-[var(--app-muted)] hover:text-[var(--app-heading)]"
                  >
                    Hide Optional
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowConfigModal(false);
                    toast.success('Form display configuration updated!');
                  }}
                  className="px-4 py-1.5 rounded-lg bg-[var(--app-accent)] text-white font-bold shadow-xs hover:opacity-90 transition-all"
                >
                  Apply Settings
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* ============================================================ */}
      {/* INLINE MODAL: Create Custom Accounting Group                 */}
      {/* ============================================================ */}
      <AnimatePresence>
        {showCreateGroupModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] shadow-2xl p-4 md:p-5 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-[var(--app-accent-soft)] text-[var(--app-accent)]">
                    <Layers size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-[var(--app-heading)]">Create New Ledger Group</h3>
                    <p className="text-[10px] text-[var(--app-muted)]">Add custom Tally parent/sub ledger group</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateGroupModal(false)}
                  className="p-1 text-[var(--app-muted)] hover:text-[var(--app-heading)] rounded-lg"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                    Group Name *
                  </label>
                  <input
                    autoFocus
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="e.g. VIP Customers, Project Expenses"
                    className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                    Parent Category
                  </label>
                  <select
                    value={newGroupParent}
                    onChange={(e) => setNewGroupParent(e.target.value)}
                    className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2.5 text-xs text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                  >
                    <option value="Primary">Primary</option>
                    <option value="Sundry Debtors">Sundry Debtors</option>
                    <option value="Sundry Creditors">Sundry Creditors</option>
                    <option value="Direct Expenses">Direct Expenses</option>
                    <option value="Indirect Expenses">Indirect Expenses</option>
                    <option value="Current Assets">Current Assets</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--app-border)]">
                <button
                  type="button"
                  onClick={() => setShowCreateGroupModal(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-[var(--app-border)] text-xs font-semibold text-[var(--app-text)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddNewGroup}
                  className="px-4 py-1.5 rounded-lg bg-[var(--app-accent)] text-white text-xs font-bold shadow-xs hover:opacity-90"
                >
                  Add Group
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
