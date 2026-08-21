import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  BookOpen, User, MapPin, ShieldCheck, Landmark, Percent, FileText, Settings, 
  Plus, X, Search, ChevronDown, Check, Calendar, ArrowLeft, Save, 
  RotateCcw, CheckCircle2, Layers, SlidersHorizontal, FolderTree, Package,
  FileCheck, Coins, Globe
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

// Reusable Header Line YES / NO Toggle Switch Component
const HeaderToggleSwitch = ({ checked, onChange, label = '' }) => {
  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className="flex items-center gap-2 cursor-pointer select-none shrink-0"
    >
      {label && <span className="text-[11px] font-extrabold uppercase text-[var(--app-muted)]">{label}</span>}
      <span className={`text-[10px] font-black tracking-wider px-2 py-0.5 rounded-md transition-colors ${
        checked ? 'bg-emerald-500 text-white shadow-2xs' : 'bg-gray-200 dark:bg-gray-800 text-gray-500'
      }`}>
        {checked ? 'YES' : 'NO'}
      </span>
      <button
        type="button"
        tabIndex={-1}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
          checked ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
};

// Reusable Direct UI YES / NO Toggle Switch Component (for inline grid items)
const ToggleSwitch = ({ label, icon: Icon, checked, onChange, tooltip, disabled = false }) => {
  return (
    <div
      onClick={() => !disabled && onChange(!checked)}
      className={`p-2 rounded-xl border transition-all select-none flex items-center justify-between gap-2 ${
        disabled ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700' : 'cursor-pointer'
      } ${
        checked
          ? 'bg-emerald-500/10 border-emerald-500/35 text-emerald-800 dark:text-emerald-300 shadow-2xs'
          : 'bg-[var(--app-control-bg)] border-[var(--app-border)] text-[var(--app-muted)] hover:border-[var(--app-accent)]/40 hover:text-[var(--app-heading)]'
      }`}
      title={tooltip || label}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        {Icon && <Icon size={14} className={checked ? 'text-emerald-600 dark:text-emerald-400 shrink-0' : 'text-[var(--app-muted)] shrink-0'} />}
        <span className="font-extrabold text-[11px] truncate">{label}</span>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <span className={`text-[9px] font-black tracking-wider px-1.5 py-0.5 rounded transition-colors ${
          checked ? 'bg-emerald-500 text-white' : 'bg-gray-200 dark:bg-gray-800 text-gray-500'
        }`}>
          {checked ? 'YES' : 'NO'}
        </span>
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          className={`relative inline-flex h-4.5 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            checked ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
              checked ? 'translate-x-3.5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
    </div>
  );
};

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

  const exact = INDIA_STATES.find(s => s.toLowerCase() === str.toLowerCase());
  if (exact) return exact;

  const codeMatch = str.match(/\b\d{1,2}\b/);
  if (codeMatch) {
    const codeNum = parseInt(codeMatch[0], 10);
    const codePadded = String(codeNum).padStart(2, '0');
    const byCode = INDIA_STATES.find(s => s.endsWith(`(${codePadded})`));
    if (byCode) return byCode;
  }

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

// Standard Tally Prime Hierarchy (15 Primary Groups & Predefined Sub-Groups)
export const TALLY_PRIMARY_GROUPS_MAP = {
  'Current Assets': ['Current Assets', 'Bank Accounts', 'Cash-in-hand', 'Deposits (Asset)', 'Loans & Advances (Asset)', 'Stock-in-hand', 'Sundry Debtors'],
  'Current Liabilities': ['Current Liabilities', 'Duties & Taxes', 'Provisions', 'Sundry Creditors'],
  'Capital Account': ['Capital Account', 'Reserves & Surplus'],
  'Direct Expenses': ['Direct Expenses', 'Freight & Cartage', 'Wages & Factory Labor', 'Power & Fuel', 'Customs Duty'],
  'Indirect Expenses': ['Indirect Expenses', 'Administrative Expenses', 'Selling & Distribution Expenses', 'Financial Charges', 'Rent & Taxes', 'Salaries & Bonus', 'Office Expenses', 'Legal & Professional Fees', 'Discount Allowed'],
  'Direct Incomes': ['Direct Incomes', 'Service Charges Direct', 'Job Work Charges Received'],
  'Indirect Incomes': ['Indirect Incomes', 'Interest Received', 'Discount Received', 'Commission Received', 'Rent Received', 'Gain on Exchange'],
  'Fixed Assets': ['Fixed Assets', 'Plant & Machinery', 'Furniture & Fixtures', 'Computers & Printers', 'Vehicles', 'Office Equipment', 'Land & Buildings'],
  'Loans (Liability)': ['Loans (Liability)', 'Bank OD A/c', 'Secured Loans', 'Unsecured Loans'],
  'Purchase Accounts': ['Purchase Accounts', 'Local Purchases', 'Interstate Purchases', 'Import Purchases', 'Purchase Returns'],
  'Sales Accounts': ['Sales Accounts', 'Local Sales', 'Interstate Sales', 'Export Sales', 'Sales Returns'],
  'Investments': ['Investments', 'Mutual Funds', 'Shares & Equity', 'Fixed Deposits', 'Government Bonds'],
  'Branch / Divisions': ['Branch / Divisions', 'Head Office', 'Regional Branch'],
  'Misc. Expenses (Asset)': ['Misc. Expenses (Asset)'],
  'Suspense A/c': ['Suspense A/c']
};

export const GROUP_TO_LEDGER_TYPE_MAP = {
  'Bank Accounts': 'Bank Accounts',
  'Bank OD A/c': 'Bank OD A/c',
  'Cash-in-hand': 'Cash-in-hand',
  'Duties & Taxes': 'Duties & Taxes',
  'Sundry Debtors': 'Current Assets',
  'Sundry Creditors': 'Current Liabilities',
  'Direct Expenses': 'Direct Expenses',
  'Indirect Expenses': 'Indirect Expenses',
  'Direct Incomes': 'Direct Incomes',
  'Indirect Incomes': 'Indirect Incomes',
  'Capital Account': 'Capital Account',
  'Fixed Assets': 'Fixed Assets',
  'Current Assets': 'Current Assets',
  'Current Liabilities': 'Current Liabilities',
  'Loans & Advances (Asset)': 'Loans & Advances',
  'Secured Loans': 'Secured Loans',
  'Unsecured Loans': 'Unsecured Loans',
  'Investments': 'Investments',
  'Provisions': 'Provisions',
  'Reserves & Surplus': 'Reserves & Surplus',
  'Purchase Accounts': 'Purchase Accounts',
  'Sales Accounts': 'Sales Accounts',
  'Branch / Divisions': 'Branch / Divisions',
  'Suspense A/c': 'Suspense A/c'
};

export const deriveLedgerTypeFromGroup = (parentGroup, subGroup = '') => {
  const pName = String(parentGroup || '').trim();
  const sName = String(subGroup || '').trim();

  // 1. SUB-GROUP SPECIFIC MATCH FIRST (Sub-Group MUST take precedence!)
  if (sName) {
    const sLower = sName.toLowerCase();
    if (sLower === 'bank accounts' || sLower.includes('bank account') || sLower === 'bank') {
      return 'Bank Accounts';
    }
    if (sLower === 'bank od a/c' || sLower.includes('bank od') || sLower.includes('overdraft')) {
      return 'Bank OD A/c';
    }
    if (sLower === 'cash-in-hand' || sLower.includes('cash-in-hand') || sLower.includes('petty cash')) {
      return 'Cash-in-hand';
    }
    if (sLower === 'duties & taxes' || sLower.includes('duties') || sLower.includes('taxes') || sLower.includes('gst') || sLower.includes('tds') || sLower.includes('tcs')) {
      return 'Duties & Taxes';
    }
    if (sLower === 'sundry debtors' || sLower.includes('debtor')) {
      return 'Current Assets';
    }
    if (sLower === 'sundry creditors' || sLower.includes('creditor')) {
      return 'Current Liabilities';
    }
    if (sLower === 'fixed assets' || sLower.includes('fixed asset')) {
      return 'Fixed Assets';
    }
    if (sLower === 'capital account' || sLower.includes('capital')) {
      return 'Capital Account';
    }
    if (sLower === 'sales accounts' || sLower.includes('sale')) {
      return 'Sales Accounts';
    }
    if (sLower === 'purchase accounts' || sLower.includes('purchase')) {
      return 'Purchase Accounts';
    }
    if (sLower === 'indirect expenses' || sLower.includes('indirect exp')) {
      return 'Indirect Expenses';
    }
    if (sLower === 'direct expenses' || sLower.includes('direct exp')) {
      return 'Direct Expenses';
    }
    if (sLower === 'indirect incomes' || sLower.includes('indirect inc')) {
      return 'Indirect Incomes';
    }
    if (sLower === 'direct incomes' || sLower.includes('direct inc')) {
      return 'Direct Incomes';
    }

    for (const [grp, type] of Object.entries(GROUP_TO_LEDGER_TYPE_MAP)) {
      if (grp.toLowerCase() === sLower) {
        return type;
      }
    }
  }

  // 2. PARENT GROUP MATCH SECOND
  if (pName) {
    const pLower = pName.toLowerCase();
    for (const [grp, type] of Object.entries(GROUP_TO_LEDGER_TYPE_MAP)) {
      if (grp.toLowerCase() === pLower) {
        return type;
      }
    }
  }

  return 'Current Assets';
};

export const isObjectId = (str) => typeof str === 'string' && /^[0-9a-fA-F]{24}$/.test(str.trim());

export const getGroupNameFromList = (val, ledgerGroupsList = []) => {
  if (!val) return '';
  if (typeof val === 'object' && val !== null) {
    return val.groupName || val.name || val.parentGroup || '';
  }
  const str = String(val).trim();
  if (!str) return '';

  if (!isObjectId(str)) return str;

  const found = (ledgerGroupsList || []).find(g => {
    if (!g || typeof g === 'string') return false;
    const gid = String(g._id || g.id || '').trim();
    return gid === str;
  });

  if (found) {
    return found.groupName || found.name || found.parentGroup || str;
  }

  return str;
};

export const resolveGroupHierarchy = (selectedGroupName, ledgerGroupsList = []) => {
  if (!selectedGroupName) return { parentGroup: 'Current Assets', subGroup: 'Sundry Debtors' };

  const rawName = getGroupNameFromList(selectedGroupName, ledgerGroupsList);
  const cleanName = isObjectId(rawName) ? 'Sundry Debtors' : rawName;

  const foundInList = (ledgerGroupsList || []).find(g => {
    if (!g) return false;
    const name = typeof g === 'string' ? g : (g.groupName || g.name);
    return name && name.toLowerCase().trim() === cleanName.toLowerCase().trim();
  });

  if (foundInList && typeof foundInList === 'object') {
    const rawParent = foundInList.parentGroup || foundInList.parent;
    if (rawParent && rawParent !== 'Primary' && rawParent !== '0') {
      const resolvedParent = getGroupNameFromList(rawParent, ledgerGroupsList);
      const cleanParent = isObjectId(resolvedParent) ? 'Current Assets' : resolvedParent;
      return {
        parentGroup: cleanParent,
        subGroup: cleanName
      };
    }
  }

  const primaryMatch = Object.keys(TALLY_PRIMARY_GROUPS_MAP).find(
    p => p.toLowerCase() === cleanName.toLowerCase()
  );
  if (primaryMatch) {
    return {
      parentGroup: primaryMatch,
      subGroup: primaryMatch
    };
  }

  for (const [pGroup, subList] of Object.entries(TALLY_PRIMARY_GROUPS_MAP)) {
    if (subList.some(s => s.toLowerCase() === cleanName.toLowerCase())) {
      return {
        parentGroup: pGroup,
        subGroup: cleanName
      };
    }
  }

  return {
    parentGroup: cleanName,
    subGroup: cleanName
  };
};

const resolveGroupName = (data, ledgerGroupsList = []) => {
  if (!data) return 'Sundry Debtors';
  const candidates = [
    data.subGroup,
    data.groupName,
    data.parentGroup,
    data.groupId,
    data.group
  ];

  for (const cand of candidates) {
    if (cand) {
      const resolved = getGroupNameFromList(cand, ledgerGroupsList);
      if (resolved && !isObjectId(resolved)) {
        return resolved;
      }
    }
  }

  return 'Sundry Debtors';
};

const extractLedgerFormData = (data, ledgerGroupsList = []) => {
  const grp = resolveGroupName(data, ledgerGroupsList);
  const hierarchy = resolveGroupHierarchy(grp, ledgerGroupsList);
  const rawParent = data?.parentGroup ? getGroupNameFromList(data.parentGroup, ledgerGroupsList) : hierarchy.parentGroup;
  const rawSub = data?.subGroup ? getGroupNameFromList(data.subGroup, ledgerGroupsList) : hierarchy.subGroup;

  const parentGrp = isObjectId(rawParent) ? hierarchy.parentGroup : rawParent;
  const subGrp = isObjectId(rawSub) ? hierarchy.subGroup : rawSub;

  if (!data) {
    const defaultType = deriveLedgerTypeFromGroup(parentGrp, subGrp);
    return {
      ledgerName: '',
      alias: '',
      ledgerCode: '',
      ledgerType: defaultType,
      groupId: subGrp || parentGrp,
      parentGroup: parentGrp,
      subGroup: subGrp || parentGrp,
      openingBalanceAmount: '',
      openingBalanceType: 'Dr',
      openingBalanceDate: new Date().toISOString().split('T')[0],
      status: 'Active',

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

      isBillWiseOn: true,
      creditPeriod: '',
      creditLimit: '',

      provideBankDetails: false,
      bankName: '',
      branchName: '',
      accountNumber: '',
      ifscCode: '',
      accountType: 'Savings Account',
      virtualPaymentAddress: '',
      paymentFavouring: '',
      preferredPaymentMode: 'NEFT / RTGS',

      isCostCentresOn: false,
      costCenterId: '',

      affectsStock: false,
      inventoryConfig: {
        costingMethod: 'Avg. Cost',
        valuationMethod: 'Default'
      },

      isInterestOn: false,
      interestRate: '',
      interestCalculationMethod: '365-Day Year',
      interestPeriod: 'Per Annum',
      interestCalculateOn: 'Net Balance',
      interestApplicableFrom: new Date().toISOString().split('T')[0],

      tdsApplicable: false,
      tcsApplicable: false,
      tdsMasterId: '',
      tdsNatureName: '',
      tdsSectionCode: '',
      deducteeType: 'Company Resident',
      tcsMasterId: '',
      tcsNatureName: '',
      tcsSectionCode: '',
      buyerType: 'Company Resident',

      // Minimal Practical Advanced Settings
      allowNegativeBalance: false,
      micrCode: '',
      swiftCode: '',
      foreignCurrencyApplicable: false,
      currency: 'INR',

      notes: ''
    };
  }

  const pd = data.partyDetails || {};
  const bd = data.bankDetails || {};
  const bal = data.balances?.openingBalance || {};
  const adv = data.advancedSettings || {};

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

  const derivedLedgerType = deriveLedgerTypeFromGroup(parentGrp, subGrp);

  return {
    ledgerName: data.ledgerName || data.ledger || data.name || '',
    alias: data.alias || data.aliasName || (Array.isArray(data.nameAliases) ? data.nameAliases[0] : (typeof data.nameAliases === 'string' ? data.nameAliases : '')) || '',
    ledgerCode: data.ledgerCode || '',
    ledgerType: data.ledgerType || derivedLedgerType,
    groupId: subGrp || parentGrp,
    parentGroup: parentGrp,
    subGroup: subGrp || parentGrp,
    openingBalanceAmount: data.openingBalanceAmount ?? data.openingBalance ?? bal.amount ?? '',
    openingBalanceType: opBalType,
    openingBalanceDate: data.openingBalanceDate || bal.asOfDate || new Date().toISOString().split('T')[0],
    status: data.status || 'Active',

    partyType: data.partyType || pd.partyType || (parentGrp === 'Sundry Creditors' || subGrp === 'Sundry Creditors' ? 'Vendor' : 'Customer'),
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

    isBillWiseOn: data.isBillWiseOn ?? data.flags?.isBillWiseOn ?? data.maintainBillWise ?? true,
    creditPeriod: data.creditPeriod || data.terms?.creditPeriod || '',
    creditLimit: data.creditLimit || data.terms?.creditLimit || '',

    provideBankDetails: data.provideBankDetails ?? (!!(data.bankName || bd.bankName || data.accountNumber || bd.accountNumber) || parentGrp === 'Bank Accounts' || subGrp === 'Bank Accounts' || parentGrp === 'Bank OD A/c' || subGrp === 'Bank OD A/c'),
    bankName: data.bankName || bd.bankName || '',
    branchName: data.branchName || data.branch || bd.branchName || '',
    accountNumber: data.accountNumber || bd.accountNumber || '',
    ifscCode: data.ifscCode || bd.ifscCode || '',
    accountType: data.accountType || bd.accountType || 'Savings Account',
    virtualPaymentAddress: data.virtualPaymentAddress || bd.virtualPaymentAddress || '',
    paymentFavouring: data.paymentFavouring || bd.paymentFavouring || '',
    preferredPaymentMode: data.preferredPaymentMode || bd.preferredPaymentMode || 'NEFT / RTGS',

    isCostCentresOn: data.isCostCentresOn ?? data.flags?.isCostCentresOn ?? (data.costCenterId || data.costCenterName ? true : false),
    costCenterId: data.costCenterId || data.costCenterName || data.costCenter || '',

    affectsStock: data.affectsStock ?? data.flags?.affectsStock ?? false,
    inventoryConfig: data.inventoryConfig || { costingMethod: 'Avg. Cost', valuationMethod: 'Default' },

    isInterestOn: data.isInterestOn ?? data.flags?.isInterestOn ?? data.interestDetails?.isInterestOn ?? false,
    interestRate: data.interestRate || data.interestDetails?.interestRate || '',
    interestCalculationMethod: data.interestCalculationMethod || data.interestDetails?.calculationMethod || '365-Day Year',
    interestPeriod: data.interestPeriod || data.interestDetails?.interestPeriod || 'Per Annum',
    interestCalculateOn: data.interestCalculateOn || data.interestDetails?.calculateOn || 'Net Balance',
    interestApplicableFrom: data.interestApplicableFrom || data.interestDetails?.applicableFrom || new Date().toISOString().split('T')[0],

    tdsApplicable: data.tdsApplicable ?? data.tdsDetails?.tdsApplicable ?? false,
    tcsApplicable: data.tcsApplicable ?? data.tdsDetails?.tcsApplicable ?? false,
    tdsMasterId: data.tdsMasterId || data.tdsDetails?.tdsMasterId || '',
    tdsNatureName: data.tdsNatureName || data.tdsDetails?.tdsNatureName || '',
    tdsSectionCode: data.tdsSectionCode || data.tdsDetails?.tdsSectionCode || data.tdsSectionId || '',
    deducteeType: data.deducteeType || data.tdsDetails?.deducteeType || data.tdsDeducteeTypeId || 'Company Resident',

    tcsMasterId: data.tcsMasterId || data.tcsDetails?.tcsMasterId || '',
    tcsNatureName: data.tcsNatureName || data.tcsDetails?.tcsNatureName || '',
    tcsSectionCode: data.tcsSectionCode || data.tcsDetails?.tcsSectionCode || '',
    buyerType: data.buyerType || data.tcsDetails?.buyerType || data.tcsCollectorType || 'Company Resident',

    // Minimal Practical Advanced Settings
    allowNegativeBalance: adv.allowNegativeBalance ?? data.allowNegativeBalance ?? false,
    micrCode: adv.micrCode || data.micrCode || bd.micrCode || '',
    swiftCode: adv.swiftCode || data.swiftCode || bd.swiftCode || '',
    foreignCurrencyApplicable: adv.foreignCurrencyApplicable ?? data.foreignCurrencyApplicable ?? false,
    currency: adv.currency || data.currency || 'INR',

    notes: data.notes || ''
  };
};

export default function LedgerMasterForm({ 
  initialData = null, 
  isEdit = false, 
  costCentersList = [], 
  ledgerGroupsList = [], 
  partyDataList = [], 
  tdsList = [], 
  tcsList = [], 
  onSave, 
  onClose 
}) {
  // Form State
  const [formData, setFormData] = useState(() => extractLedgerFormData(initialData, ledgerGroupsList));

  // Collapsible Advanced Settings state (default collapsed)
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  // Dynamic state for custom user-added groups & ledger types
  const [customGroups, setCustomGroups] = useState([]);
  const [customLedgerTypes, setCustomLedgerTypes] = useState([]);

  // Dynamically build group options from DB collections & props
  const groupOptions = useMemo(() => {
    const set = new Set();

    (ledgerGroupsList || []).forEach(g => {
      const name = typeof g === 'string' ? getGroupNameFromList(g, ledgerGroupsList) : (g.groupName || g.name || getGroupNameFromList(g.parentGroup, ledgerGroupsList));
      if (name && typeof name === 'string' && !isObjectId(name)) {
        set.add(name);
      }
    });

    (partyDataList || []).forEach(l => {
      const g1 = getGroupNameFromList(l.groupName || l.parentGroup || l.subGroup, ledgerGroupsList);
      if (g1 && typeof g1 === 'string' && !isObjectId(g1)) {
        set.add(g1);
      }
    });

    if (initialData) {
      const currentGroup = resolveGroupName(initialData, ledgerGroupsList);
      if (currentGroup && typeof currentGroup === 'string' && !isObjectId(currentGroup)) {
        set.add(currentGroup);
      }
    }
    (customGroups || []).forEach(g => {
      if (g && !isObjectId(g)) set.add(g);
    });

    if (set.size === 0) {
      Object.keys(TALLY_PRIMARY_GROUPS_MAP).forEach(g => set.add(g));
    }

    return Array.from(set).filter(s => s && !isObjectId(s)).sort();
  }, [ledgerGroupsList, partyDataList, initialData, customGroups]);

  // Dynamically build ledger type options
  const ledgerTypeOptions = useMemo(() => {
    const set = new Set();

    Object.values(GROUP_TO_LEDGER_TYPE_MAP).forEach(t => set.add(t));
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

    return Array.from(set).sort();
  }, [partyDataList, initialData?.ledgerType, customLedgerTypes, formData?.ledgerType]);

  // Sync Form Data when initialData changes on Edit
  useEffect(() => {
    if (initialData) {
      const extracted = extractLedgerFormData(initialData, ledgerGroupsList);
      setFormData(extracted);
      if (extracted.groupId && !groupOptions.includes(extracted.groupId)) {
        setCustomGroups(prev => [...prev, extracted.groupId]);
      }
    }
  }, [initialData]);

  // Modal State for custom group creation
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupParent, setNewGroupParent] = useState('Primary');

  // Helper updater
  const updateField = (key, val) => {
    setFormData(prev => {
      const updated = { ...prev, [key]: val };

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

  // Group & Sub-Group Dropdown states
  const [groupSearchOpen, setGroupSearchOpen] = useState(false);
  const [groupQuery, setGroupQuery] = useState('');
  const groupDropdownRef = useRef(null);

  const [subGroupSearchOpen, setSubGroupSearchOpen] = useState(false);
  const [subGroupQuery, setSubGroupQuery] = useState('');
  const subGroupDropdownRef = useRef(null);
  const [customSubGroups, setCustomSubGroups] = useState([]);

  useEffect(() => {
    const handleMousedown = (e) => {
      if (groupDropdownRef.current && !groupDropdownRef.current.contains(e.target)) {
        setGroupSearchOpen(false);
      }
      if (subGroupDropdownRef.current && !subGroupDropdownRef.current.contains(e.target)) {
        setSubGroupSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleMousedown);
    return () => document.removeEventListener('mousedown', handleMousedown);
  }, []);

  // Primary Groups List (Tally 15 Primary Groups)
  const primaryGroupOptions = useMemo(() => {
    const set = new Set();
    Object.keys(TALLY_PRIMARY_GROUPS_MAP).forEach(p => set.add(p));

    (ledgerGroupsList || []).forEach(g => {
      if (!g) return;
      const pName = typeof g === 'object' ? getGroupNameFromList(g.parentGroup || g.parent, ledgerGroupsList) : '';
      if (pName && pName !== 'Primary' && !isObjectId(pName)) {
        set.add(pName);
      }
    });

    return Array.from(set).filter(s => s && !isObjectId(s)).sort();
  }, [ledgerGroupsList]);

  // Sub-Groups List (Filtered dynamically based on selected Primary Group)
  const subGroupOptions = useMemo(() => {
    const selectedParent = getGroupNameFromList(formData.parentGroup || 'Current Assets', ledgerGroupsList);
    const set = new Set();

    // 1. Add predefined sub-groups for selected parent group
    const primaryMatch = Object.keys(TALLY_PRIMARY_GROUPS_MAP).find(
      p => p.toLowerCase() === selectedParent.toLowerCase()
    );
    if (primaryMatch && TALLY_PRIMARY_GROUPS_MAP[primaryMatch]) {
      TALLY_PRIMARY_GROUPS_MAP[primaryMatch].forEach(sg => {
        if (!isObjectId(sg)) set.add(sg);
      });
    }

    // 2. Add custom sub-groups from DB under selected parent group
    (ledgerGroupsList || []).forEach(g => {
      if (!g) return;
      const gName = typeof g === 'string' ? g : (g.groupName || g.name);
      const pName = typeof g === 'object' ? getGroupNameFromList(g.parentGroup || g.parent, ledgerGroupsList) : '';

      if (pName && pName.toLowerCase().trim() === selectedParent.toLowerCase().trim() && gName && !isObjectId(gName)) {
        set.add(gName);
      }
    });

    // 3. Allow selecting parent group itself as sub group if no child groups
    if (selectedParent) {
      set.add(selectedParent);
    }

    (customSubGroups || []).forEach(sg => {
      if (sg && !isObjectId(sg)) set.add(sg);
    });

    if (formData.subGroup && !isObjectId(formData.subGroup)) {
      set.add(formData.subGroup);
    }

    return Array.from(set).filter(s => s && !isObjectId(s)).sort();
  }, [formData.parentGroup, formData.subGroup, ledgerGroupsList, customSubGroups]);

  const filteredGroups = useMemo(() => {
    const q = groupQuery.trim().toLowerCase();
    if (!q) return primaryGroupOptions;
    return primaryGroupOptions.filter(g => g.toLowerCase().includes(q));
  }, [groupQuery, primaryGroupOptions]);

  const filteredSubGroups = useMemo(() => {
    const q = subGroupQuery.trim().toLowerCase();
    if (!q) return subGroupOptions;
    return subGroupOptions.filter(sg => sg.toLowerCase().includes(q));
  }, [subGroupQuery, subGroupOptions]);

  // Handle Primary Group Selection
  const handleGroupSelect = (primaryGrp) => {
    // Find available sub-groups under selected primary group
    const subList = TALLY_PRIMARY_GROUPS_MAP[primaryGrp] || [primaryGrp];
    const defaultSub = subList[0] || primaryGrp;
    const autoType = deriveLedgerTypeFromGroup(primaryGrp, defaultSub);

    setFormData(prev => ({
      ...prev,
      parentGroup: primaryGrp,
      subGroup: defaultSub,
      groupId: defaultSub,
      ledgerType: autoType
    }));
    setGroupSearchOpen(false);
    setGroupQuery('');
  };

  // Handle Sub-Group Selection
  const handleSubGroupSelect = (subGrp) => {
    const hierarchy = resolveGroupHierarchy(subGrp, ledgerGroupsList);
    const parentG = hierarchy.parentGroup || formData.parentGroup || 'Current Assets';
    const autoType = deriveLedgerTypeFromGroup(parentG, subGrp);

    setFormData(prev => ({
      ...prev,
      subGroup: subGrp,
      parentGroup: parentG,
      groupId: subGrp,
      ledgerType: autoType
    }));
    setSubGroupSearchOpen(false);
    setSubGroupQuery('');
  };

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

  // Form Submit Handler
  const handleSubmit = (e, keepOpen = false) => {
    if (e) e.preventDefault();

    if (!formData.ledgerName.trim()) {
      toast.error('Ledger Name is required');
      return;
    }

    if (!formData.parentGroup) {
      toast.error('Under / Primary Group is required');
      return;
    }

    const legacyMappedData = {
      ...formData,
      _id: initialData?._id || initialData?.id,
      id: initialData?._id || initialData?.id,
      sourceCollection: initialData?.sourceCollection || 'ledgers_entry',
      ledger: formData.ledgerName,
      name: formData.contactPerson || formData.ledgerName,
      parentGroup: formData.parentGroup,
      subGroup: formData.subGroup || formData.parentGroup,
      groupName: formData.subGroup || formData.parentGroup,
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
      flags: {
        isBillWiseOn: formData.isBillWiseOn,
        isCostCentresOn: formData.isCostCentresOn,
        affectsStock: formData.affectsStock,
        isInterestOn: formData.isInterestOn,
        tdsApplicable: formData.tdsApplicable,
        tcsApplicable: formData.tcsApplicable,
        gstApplicable: formData.gstApplicable
      },
      interestDetails: {
        isInterestOn: formData.isInterestOn,
        interestRate: formData.interestRate,
        calculationMethod: formData.interestCalculationMethod,
        interestPeriod: formData.interestPeriod,
        calculateOn: formData.interestCalculateOn,
        applicableFrom: formData.interestApplicableFrom
      },
      advancedSettings: {
        micrCode: formData.micrCode,
        swiftCode: formData.swiftCode,
        allowNegativeBalance: formData.allowNegativeBalance,
        foreignCurrencyApplicable: formData.foreignCurrencyApplicable,
        currency: formData.currency
      },
      isSynced: false
    };

    if (onSave) {
      onSave(legacyMappedData);
    }

    toast.success(isEdit ? 'Ledger updated successfully!' : 'Ledger created successfully!');

    if (keepOpen) {
      setFormData(prev => ({
        ...extractLedgerFormData(null),
        groupId: prev.groupId,
        parentGroup: prev.parentGroup,
        subGroup: prev.subGroup
      }));
    } else if (onClose) {
      onClose();
    }
  };

  const handleAddNewGroup = () => {
    if (!newGroupName.trim()) {
      toast.error('Group name cannot be empty');
      return;
    }
    const createdName = newGroupName.trim();
    setCustomGroups(prev => [...prev, createdName]);
    updateField('parentGroup', createdName);
    updateField('subGroup', createdName);
    setNewGroupName('');
    setShowCreateGroupModal(false);
    toast.success(`Group "${createdName}" added!`);
  };

  return (
    <div className="flex flex-col h-full bg-[var(--app-panel-bg)] text-[var(--app-text)] overflow-hidden font-sans">
      
      {/* Top Header Bar */}
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
                Ledgers
              </span>
            </div>
            <h1 className="text-base md:text-lg font-extrabold tracking-tight text-[var(--app-heading)] truncate">
              {isEdit ? `Edit: ${formData.ledgerName || 'Ledger'}` : 'Create Ledger'}
            </h1>
          </div>
        </div>

        {/* Top Header Actions */}
        <div className="flex items-center gap-2 shrink-0">
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
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[var(--app-accent)] text-white text-xs font-bold shadow-xs hover:opacity-90 transition-all cursor-pointer"
          >
            <Save size={13} />
            {isEdit ? 'Update Ledger' : 'Save Ledger'}
          </button>
        </div>
      </div>

      {/* Main Form Scrollable Container */}
      <form onSubmit={(e) => handleSubmit(e, false)} className="flex-1 min-h-0 overflow-y-auto p-3 md:p-4 space-y-3.5 no-scrollbar">
        
        {/* ============================================================ */}
        {/* SECTION 1: BASIC INFORMATION (ALWAYS VISIBLE - NO TOGGLES)   */}
        {/* ============================================================ */}
        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-3.5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2">
            <div className="flex items-center gap-2 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
              <BookOpen size={15} />
              <span>1. Basic Information</span>
            </div>
            <span className="text-[10px] text-[var(--app-muted)] font-medium">* Required Fields</span>
          </div>

          <div className="space-y-3 text-xs">
            {/* Row 1: Ledger Name * & Alias */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                  Ledger Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.ledgerName}
                  onChange={(e) => updateField('ledgerName', e.target.value)}
                  placeholder="e.g. Acme Corporation Pvt Ltd / Cash Account / SBI Current A/c"
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

            {/* Row 2: Ledger Code, Under / Primary Group *, Sub-Group & Ledger Type */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
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

              {/* Primary Parent Group * */}
              <div className="relative" ref={groupDropdownRef}>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                  Under / Primary Group <span className="text-rose-500">*</span>
                </label>

                <div
                  onClick={() => setGroupSearchOpen(prev => !prev)}
                  className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 flex items-center justify-between text-xs font-bold text-[var(--app-heading)] cursor-pointer hover:border-[var(--app-accent)] transition-all"
                >
                  <span className="truncate">{formData.parentGroup || 'Current Assets'}</span>
                  <ChevronDown size={14} className="text-[var(--app-muted)] shrink-0" />
                </div>

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
                          placeholder="Search primary group…"
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
                          const isSel = grp === formData.parentGroup;
                          return (
                            <button
                              key={grp}
                              type="button"
                              onClick={() => handleGroupSelect(grp)}
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

              {/* Sub-Group / Child Group */}
              <div className="relative" ref={subGroupDropdownRef}>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1 flex items-center justify-between">
                  <span>Sub-Group / Child Group</span>
                  <span className="text-[9px] text-[var(--app-accent)] font-bold">Tally Sub-Group</span>
                </label>

                <div
                  onClick={() => setSubGroupSearchOpen(prev => !prev)}
                  className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 flex items-center justify-between text-xs font-bold text-[var(--app-heading)] cursor-pointer hover:border-[var(--app-accent)] transition-all"
                >
                  <span className="truncate">{formData.subGroup || formData.parentGroup}</span>
                  <ChevronDown size={14} className="text-[var(--app-muted)] shrink-0" />
                </div>

                <AnimatePresence>
                  {subGroupSearchOpen && (
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
                          value={subGroupQuery}
                          onChange={(e) => setSubGroupQuery(e.target.value)}
                          placeholder={`Search sub-group under ${formData.parentGroup || 'group'}…`}
                          className="w-full bg-transparent text-xs outline-none text-[var(--app-heading)]"
                        />
                      </div>

                      <div className="max-h-52 overflow-y-auto no-scrollbar space-y-0.5">
                        {filteredSubGroups.length === 0 && (
                          <div className="p-3 text-center text-xs text-[var(--app-muted)]">
                            No sub-group found matching "{subGroupQuery}"
                          </div>
                        )}

                        {filteredSubGroups.map(sg => {
                          const isSel = sg === formData.subGroup;
                          return (
                            <button
                              key={sg}
                              type="button"
                              onClick={() => handleSubGroupSelect(sg)}
                              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left text-xs font-medium transition-colors ${
                                isSel 
                                  ? 'bg-[var(--app-accent-soft)] text-[var(--app-accent)] font-bold' 
                                  : 'text-[var(--app-heading)] hover:bg-[var(--app-control-hover)]'
                              }`}
                            >
                              <span>{sg}</span>
                              {isSel && <Check size={13} />}
                            </button>
                          );
                        })}
                      </div>

                      <div className="mt-1 pt-1 border-t border-[var(--app-border)]">
                        <button
                          type="button"
                          onClick={() => {
                            if (subGroupQuery.trim()) {
                              const createdSg = subGroupQuery.trim();
                              setCustomSubGroups(prev => [...prev, createdSg]);
                              handleSubGroupSelect(createdSg);
                              toast.success(`Sub-Group "${createdSg}" added!`);
                            }
                          }}
                          className="w-full py-1.5 px-2 rounded-lg bg-[var(--app-control-hover)] hover:bg-[var(--app-accent-soft)] hover:text-[var(--app-accent)] text-[11px] font-bold text-center text-[var(--app-muted)] transition-colors flex items-center justify-center gap-1"
                        >
                          <Plus size={12} />
                          <span>Add Sub-Group "{subGroupQuery || 'Custom'}"</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Ledger Type */}
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1 flex items-center justify-between">
                  <span>Ledger Type</span>
                  <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold">Tally Derived</span>
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

            {/* Row 3: Opening Balance, Balance Type, As On Date & Status */}
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
        {/* SECTION 2: PARTY / CONTACT DETAILS (ALWAYS VISIBLE - MAIN UI) */}
        {/* ============================================================ */}
        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-3.5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2">
            <div className="flex items-center gap-2 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
              <User size={15} />
              <span>2. Party / Contact Details</span>
            </div>
            <span className="text-[10px] text-[var(--app-muted)] font-medium">Contact & Identification</span>
          </div>

          <div className="space-y-3 text-xs">
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
        </div>

        {/* ============================================================ */}
        {/* SECTION 3: ADDRESS & LOCATION (ALWAYS VISIBLE - MAIN UI)     */}
        {/* ============================================================ */}
        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-3.5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2">
            <div className="flex items-center gap-2 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
              <MapPin size={15} />
              <span>3. Address & Location</span>
            </div>
            <span className="text-[10px] text-[var(--app-muted)] font-medium">Mailing & Registered Address</span>
          </div>

          <div className="space-y-3 text-xs">
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
        </div>

        {/* ============================================================ */}
        {/* SECTION 4: GST CONFIGURATION (HEADER TOGGLE SWITCH)         */}
        {/* ============================================================ */}
        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-3.5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2">
            <div className="flex items-center gap-2 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
              <ShieldCheck size={15} />
              <span>4. GST Configuration</span>
            </div>
            <HeaderToggleSwitch
              checked={formData.gstApplicable}
              onChange={(val) => updateField('gstApplicable', val)}
            />
          </div>

          {formData.gstApplicable && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1 animate-in fade-in duration-200">
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
                  GST Place of Supply / State
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
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* SECTION 5: BILL-BY-BILL & CREDIT CONFIGURATION (HEADER TOGGLE) */}
        {/* ============================================================ */}
        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-3.5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2">
            <div className="flex items-center gap-2 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
              <FileText size={15} />
              <span>5. Bill-by-Bill & Credit Configuration</span>
            </div>
            <HeaderToggleSwitch
              checked={formData.isBillWiseOn}
              onChange={(val) => updateField('isBillWiseOn', val)}
            />
          </div>

          {formData.isBillWiseOn && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1 animate-in fade-in duration-200">
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                  Default Credit Period (Days)
                </label>
                <input
                  type="number"
                  value={formData.creditPeriod}
                  onChange={(e) => updateField('creditPeriod', e.target.value)}
                  placeholder="e.g. 30"
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
                    placeholder="e.g. 1000000"
                    className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] pl-6 pr-3 text-xs font-mono font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* SECTION 6: BANK & ELECTRONIC PAYMENT DETAILS (HEADER TOGGLE) */}
        {/* ============================================================ */}
        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-3.5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2">
            <div className="flex items-center gap-2 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
              <Landmark size={15} />
              <span>6. Bank & Electronic Payment Details</span>
            </div>
            <HeaderToggleSwitch
              checked={formData.provideBankDetails}
              onChange={(val) => updateField('provideBankDetails', val)}
            />
          </div>

          {formData.provideBankDetails && (
            <div className="space-y-3 pt-1 animate-in fade-in duration-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    list="predefined-bank-options"
                    value={formData.bankName}
                    onChange={(e) => updateField('bankName', e.target.value)}
                    placeholder="e.g. State Bank of India, HDFC"
                    className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                  />
                  <datalist id="predefined-bank-options">
                    {PREDEFINED_BANKS.map((b) => (
                      <option key={b} value={b} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                    Account Holder / Favouring Name
                  </label>
                  <input
                    type="text"
                    value={formData.paymentFavouring}
                    onChange={(e) => updateField('paymentFavouring', e.target.value)}
                    placeholder="e.g. Acme Corp Pvt Ltd"
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

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
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
                    Account Type
                  </label>
                  <select
                    value={formData.accountType}
                    onChange={(e) => updateField('accountType', e.target.value)}
                    className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2.5 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                  >
                    <option value="Savings Account">Savings Account</option>
                    <option value="Current Account">Current Account</option>
                    <option value="Overdraft (OD)">Overdraft (OD)</option>
                    <option value="Cash Credit (CC)">Cash Credit (CC)</option>
                  </select>
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
                    Preferred Payment Mode
                  </label>
                  <select
                    value={formData.preferredPaymentMode}
                    onChange={(e) => updateField('preferredPaymentMode', e.target.value)}
                    className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2.5 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                  >
                    <option value="NEFT / RTGS">NEFT / RTGS</option>
                    <option value="Cheque">Cheque</option>
                    <option value="UPI / VPA">UPI / VPA</option>
                    <option value="IMPS">IMPS</option>
                    <option value="E-Transfer">E-Transfer</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* SECTION 7: COST CENTRE, INVENTORY & INTEREST (COMPACT INLINE) */}
        {/* ============================================================ */}
        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-3.5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2">
            <div className="flex items-center gap-2 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
              <FolderTree size={15} />
              <span>7. Cost Centre, Inventory & Interest Features</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {/* Cost Centre Compact Inline Toggle */}
            <div className="space-y-1.5">
              <ToggleSwitch
                label="Cost Centres Applicable?"
                icon={FolderTree}
                checked={formData.isCostCentresOn}
                onChange={(val) => updateField('isCostCentresOn', val)}
              />
              {formData.isCostCentresOn && (
                <div className="animate-in fade-in duration-150">
                  <select
                    value={formData.costCenterId || ''}
                    onChange={(e) => updateField('costCenterId', e.target.value)}
                    className="w-full h-8 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2.5 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                  >
                    <option value="">-- Default Cost Centre --</option>
                    {costCenterOptions.map(cc => (
                      <option key={cc.value} value={cc.value}>{cc.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Inventory Values Affected Compact Inline Toggle */}
            <div className="space-y-1.5">
              <ToggleSwitch
                label="Inventory Values Affected?"
                icon={Package}
                checked={formData.affectsStock}
                onChange={(val) => updateField('affectsStock', val)}
              />
              {formData.affectsStock && (
                <div className="grid grid-cols-2 gap-1.5 animate-in fade-in duration-150">
                  <select
                    value={formData.inventoryConfig?.costingMethod || 'Avg. Cost'}
                    onChange={(e) => updateField('inventoryConfig', { ...formData.inventoryConfig, costingMethod: e.target.value })}
                    className="w-full h-8 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2 text-[11px] font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                  >
                    <option value="Avg. Cost">Avg. Cost</option>
                    <option value="FIFO">FIFO</option>
                    <option value="LIFO">LIFO</option>
                  </select>
                  <select
                    value={formData.inventoryConfig?.valuationMethod || 'Default'}
                    onChange={(e) => updateField('inventoryConfig', { ...formData.inventoryConfig, valuationMethod: e.target.value })}
                    className="w-full h-8 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2 text-[11px] font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                  >
                    <option value="Default">Default Val.</option>
                    <option value="Zero Cost">Zero Cost</option>
                  </select>
                </div>
              )}
            </div>

            {/* Interest Applicable Compact Inline Toggle */}
            <div className="space-y-1.5">
              <ToggleSwitch
                label="Interest Applicable?"
                icon={Percent}
                checked={formData.isInterestOn}
                onChange={(val) => updateField('isInterestOn', val)}
              />
              {formData.isInterestOn && (
                <div className="grid grid-cols-2 gap-1.5 animate-in fade-in duration-150">
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      value={formData.interestRate}
                      onChange={(e) => updateField('interestRate', e.target.value)}
                      placeholder="Rate %"
                      className="w-full h-8 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] pl-2 pr-4 text-[11px] font-mono font-bold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                    />
                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[var(--app-muted)]">%</span>
                  </div>
                  <select
                    value={formData.interestCalculationMethod}
                    onChange={(e) => updateField('interestCalculationMethod', e.target.value)}
                    className="w-full h-8 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-1.5 text-[11px] font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                  >
                    <option value="365-Day Year">365-Day</option>
                    <option value="360-Day Year">360-Day</option>
                    <option value="30-Day Month">30-Day</option>
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* SECTION 8: TDS CONFIGURATION (HEADER TOGGLE SWITCH)         */}
        {/* ============================================================ */}
        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-3.5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2">
            <div className="flex items-center gap-2 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
              <FileCheck size={15} />
              <span>8. TDS Configuration</span>
            </div>
            <HeaderToggleSwitch
              checked={formData.tdsApplicable}
              onChange={(val) => {
                if (!val) {
                  setFormData(prev => ({ ...prev, tdsApplicable: false, tdsMasterId: '', tdsNatureName: '', tdsSectionCode: '' }));
                } else {
                  const firstTds = tdsList[0];
                  setFormData(prev => ({
                    ...prev,
                    tdsApplicable: true,
                    tdsMasterId: firstTds?._id || firstTds?.id || '',
                    tdsNatureName: firstTds?.tdsName || firstTds?.name || '',
                    tdsSectionCode: firstTds?.sectionCode || firstTds?.section || '194C',
                    deducteeType: Array.isArray(firstTds?.deducteeTypes) ? firstTds.deducteeTypes[0] : (firstTds?.deducteeTypes || prev.deducteeType || 'Company Resident')
                  }));
                }
              }}
            />
          </div>

          {formData.tdsApplicable && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1 animate-in fade-in duration-200">
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                  TDS Nature / Section Master <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.tdsMasterId || ''}
                  onChange={(e) => {
                    const selId = e.target.value;
                    const selectedMaster = tdsList.find(t => (t._id || t.id) === selId);
                    setFormData(prev => ({
                      ...prev,
                      tdsMasterId: selId,
                      tdsNatureName: selectedMaster?.tdsName || selectedMaster?.name || prev.tdsNatureName,
                      tdsSectionCode: selectedMaster?.sectionCode || selectedMaster?.section || prev.tdsSectionCode,
                      deducteeType: Array.isArray(selectedMaster?.deducteeTypes) ? selectedMaster.deducteeTypes[0] : (selectedMaster?.deducteeTypes || prev.deducteeType || 'Company Resident')
                    }));
                  }}
                  className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                >
                  {tdsList.length === 0 && <option value="">No TDS Masters found (Create TDS Master first)</option>}
                  {tdsList.map(t => (
                    <option key={t._id || t.id || t.tdsName} value={t._id || t.id}>
                      {t.tdsName || t.name} (Sec: {t.sectionCode || t.section || '—'}) - Rate: {t.applicableRate || t.rate || 0}%
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                  Deductee Type <span className="text-rose-500">*</span>
                </label>
                {(() => {
                  const activeMaster = tdsList.find(t => (t._id || t.id) === formData.tdsMasterId);
                  const allowedTypes = Array.isArray(activeMaster?.deducteeTypes) && activeMaster.deducteeTypes.length > 0
                    ? activeMaster.deducteeTypes
                    : ['Company Resident', 'Non-Company Resident (Individual/HUF)', 'Partnership Firm', 'Non-Resident'];
                  
                  return (
                    <select
                      value={formData.deducteeType || allowedTypes[0]}
                      onChange={(e) => updateField('deducteeType', e.target.value)}
                      className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                    >
                      {allowedTypes.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  );
                })()}
              </div>
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* SECTION 9: TCS CONFIGURATION (HEADER TOGGLE SWITCH)         */}
        {/* ============================================================ */}
        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-3.5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2">
            <div className="flex items-center gap-2 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
              <Coins size={15} />
              <span>9. TCS Configuration</span>
            </div>
            <HeaderToggleSwitch
              checked={formData.tcsApplicable}
              onChange={(val) => {
                if (!val) {
                  setFormData(prev => ({ ...prev, tcsApplicable: false, tcsMasterId: '', tcsNatureName: '', tcsSectionCode: '' }));
                } else {
                  const firstTcs = tcsList[0];
                  setFormData(prev => ({
                    ...prev,
                    tcsApplicable: true,
                    tcsMasterId: firstTcs?._id || firstTcs?.id || '',
                    tcsNatureName: firstTcs?.tcsName || firstTcs?.name || '',
                    tcsSectionCode: firstTcs?.sectionCode || firstTcs?.section || '206C(1H)',
                    buyerType: Array.isArray(firstTcs?.buyerTypes) ? firstTcs.buyerTypes[0] : (firstTcs?.buyerTypes || prev.buyerType || 'Company Resident')
                  }));
                }
              }}
            />
          </div>

          {formData.tcsApplicable && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1 animate-in fade-in duration-200">
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                  TCS Nature / Section Master <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.tcsMasterId || ''}
                  onChange={(e) => {
                    const selId = e.target.value;
                    const selectedMaster = tcsList.find(t => (t._id || t.id) === selId);
                    setFormData(prev => ({
                      ...prev,
                      tcsMasterId: selId,
                      tcsNatureName: selectedMaster?.tcsName || selectedMaster?.name || prev.tcsNatureName,
                      tcsSectionCode: selectedMaster?.sectionCode || selectedMaster?.section || prev.tcsSectionCode,
                      buyerType: Array.isArray(selectedMaster?.buyerTypes) ? selectedMaster.buyerTypes[0] : (selectedMaster?.buyerTypes || prev.buyerType || 'Company Resident')
                    }));
                  }}
                  className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                >
                  {tcsList.length === 0 && <option value="">No TCS Masters found (Create TCS Master first)</option>}
                  {tcsList.map(t => (
                    <option key={t._id || t.id || t.tcsName} value={t._id || t.id}>
                      {t.tcsName || t.name} (Sec: {t.sectionCode || t.section || '—'}) - Rate: {t.applicableRate || t.rate || 0}%
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                  Buyer Type <span className="text-rose-500">*</span>
                </label>
                {(() => {
                  const activeMaster = tcsList.find(t => (t._id || t.id) === formData.tcsMasterId);
                  const allowedTypes = Array.isArray(activeMaster?.buyerTypes) && activeMaster.buyerTypes.length > 0
                    ? activeMaster.buyerTypes
                    : ['Company Resident', 'Individual / HUF', 'Partnership Firm', 'Resident Buyer'];
                  
                  return (
                    <select
                      value={formData.buyerType || allowedTypes[0]}
                      onChange={(e) => updateField('buyerType', e.target.value)}
                      className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                    >
                      {allowedTypes.map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  );
                })()}
              </div>
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* SECTION 10: ADVANCED SETTINGS (COMPACT MINIMAL ACCORDION)   */}
        {/* ============================================================ */}
        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-3.5 shadow-2xs space-y-3">
          <div 
            onClick={() => setIsAdvancedOpen(prev => !prev)}
            className="flex items-center justify-between border-b border-[var(--app-border)] pb-2 cursor-pointer select-none hover:opacity-90 transition-opacity"
          >
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-md bg-[var(--app-accent-soft)] text-[var(--app-accent)]">
                <SlidersHorizontal size={15} />
              </div>
              <div>
                <span className="text-[var(--app-heading)] font-extrabold text-xs uppercase tracking-wider">
                  Advanced Settings
                </span>
                <p className="text-[10px] text-[var(--app-muted)]">
                  Optional bank codes, foreign currency & balance control rules
                </p>
              </div>
            </div>

            <button
              type="button"
              className="px-3 py-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] text-xs font-bold text-[var(--app-heading)] flex items-center gap-1.5 hover:bg-[var(--app-control-hover)] transition-colors shrink-0"
            >
              <span>{isAdvancedOpen ? 'Collapse' : 'Expand'}</span>
              <ChevronDown size={14} className={`transition-transform duration-200 ${isAdvancedOpen ? 'rotate-180 text-[var(--app-accent)]' : ''}`} />
            </button>
          </div>

          {isAdvancedOpen && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs pt-1 animate-in fade-in duration-200">
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                  MICR Code
                </label>
                <input
                  type="text"
                  value={formData.micrCode}
                  onChange={(e) => updateField('micrCode', e.target.value)}
                  placeholder="e.g. 400240002"
                  className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-mono text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                  SWIFT / BIC Code
                </label>
                <input
                  type="text"
                  value={formData.swiftCode}
                  onChange={(e) => updateField('swiftCode', e.target.value.toUpperCase())}
                  placeholder="e.g. HDFCINBB"
                  className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-mono text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                  Allow Negative Balance
                </label>
                <select
                  value={formData.allowNegativeBalance ? 'Yes' : 'No'}
                  onChange={(e) => updateField('allowNegativeBalance', e.target.value === 'Yes')}
                  className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2.5 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] cursor-pointer"
                >
                  <option value="No">No (Warn / Block)</option>
                  <option value="Yes">Yes (Allow Negative)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                  Foreign Currency
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={formData.foreignCurrencyApplicable ? 'Yes' : 'No'}
                    onChange={(e) => updateField('foreignCurrencyApplicable', e.target.value === 'Yes')}
                    className="h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2 text-xs font-semibold text-[var(--app-heading)] outline-none cursor-pointer shrink-0"
                  >
                    <option value="No">No (INR)</option>
                    <option value="Yes">Yes</option>
                  </select>
                  {formData.foreignCurrencyApplicable && (
                    <input
                      type="text"
                      value={formData.currency}
                      onChange={(e) => updateField('currency', e.target.value.toUpperCase())}
                      placeholder="USD"
                      className="w-full h-8.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2.5 text-xs font-bold text-[var(--app-heading)] outline-none"
                    />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* SECTION 11: INTERNAL NOTES (ALWAYS VISIBLE AT BOTTOM)        */}
        {/* ============================================================ */}
        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-3.5 shadow-2xs space-y-2">
          <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1 flex items-center gap-1.5">
            <BookOpen size={13} className="text-[var(--app-accent)]" />
            <span>11. Internal Accounting Notes & Remarks</span>
          </label>
          <textarea
            rows={2.5}
            value={formData.notes}
            onChange={(e) => updateField('notes', e.target.value)}
            placeholder="Special credit terms, reference contracts, or internal remarks..."
            className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] p-2.5 text-xs text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] resize-none font-medium"
          />
        </div>

      </form>

      {/* Sticky Bottom Action Bar */}
      <div className="shrink-0 px-4 py-3 border-t border-[var(--app-border)] bg-[var(--app-panel-bg)] flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-[var(--app-border)] text-xs font-semibold text-[var(--app-text)] hover:bg-[var(--app-control-hover)] transition-colors"
          >
            Cancel
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
            className="px-5 py-2 rounded-lg bg-[var(--app-accent)] text-white text-xs font-bold shadow-sm hover:opacity-90 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <CheckCircle2 size={14} />
            <span>{isEdit ? 'Update Ledger Master' : 'Save Ledger Master'}</span>
          </button>
        </div>
      </div>

      {/* Inline Modal: Create Custom Accounting Group */}
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
