import React, { useState, useEffect, useMemo } from 'react';
import { Search, RefreshCw, Plus, X, BookOpen, Package, User, Users, Percent, IndianRupee, Info, AlertTriangle, CheckCircle2, Coins, ShieldCheck, FileSpreadsheet, ClipboardList, Settings, Landmark, Edit3, FolderTree, Layers, Tag, Send, CloudUpload, Database, FileText, ArrowUpRight, Trash2, Box, Calendar, Hash, Building2 } from 'lucide-react';


import { toast } from 'sonner';
import { motion } from 'motion/react';
import DataTable from '../ui/DataTable';
import StatCard from '../ui/StatCard';
import Badge from '../ui/Badge';
import salesApi from '../../services/salesApi';
import fundflowApi from '../../services/fundflowApi';
import apiClient from '../../lib/apiClient';
import LedgerMasterForm, { normalizeState } from './LedgerMasterForm';
import CostCenterMasterForm from './CostCenterMasterForm';
import CostCategoryMasterForm from './CostCategoryMasterForm';
import CostCentreClassMasterForm from './CostCentreClassMasterForm';
import LedgerGroupMasterForm from './LedgerGroupMasterForm';
import StockCategoryMasterForm from './StockCategoryMasterForm';
import StockGroupMasterForm from './StockGroupMasterForm';
import StockItemMasterForm from './StockItemMasterForm';
import UnitMasterForm from './UnitMasterForm';
import BomMasterForm from './BomMasterForm';
import VoucherTypeMasterForm from './VoucherTypeMasterForm';
import TDSMasterForm from './TDSMasterForm';
import TCSMasterForm from './TCSMasterForm';
import GodownMasterForm from './GodownMasterForm';
import { useAppStore } from '../../stores/useAppStore';


export const MASTER_GROUPS = [
  {
    id: 'accounting',
    label: 'Accounting',
    icon: FolderTree,
    tabs: [
      { id: 'Ledger Group', label: 'Ledger Groups' },
      { id: 'Party Ledger', label: 'Ledgers' }
    ]
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: Package,
    tabs: [
      { id: 'Stock Group', label: 'Stock Groups' },
      { id: 'Stock Category', label: 'Stock Categories' },
      { id: 'Item Master', label: 'Stock Items' },
      { id: 'Unit', label: 'Units' },
      { id: 'Godown', label: 'Godowns' },
      { id: 'BOM', label: 'Bill of Materials (BOM)' }
    ]
  },
  {
    id: 'cost_analysis',
    label: 'Cost & Analysis',
    icon: Layers,
    tabs: [
      { id: 'Cost Center', label: 'Cost Centre' }
    ]
  },
  {
    id: 'tax_compliance',
    label: 'Tax & Compliance',
    icon: Percent,
    tabs: [
      { id: 'TDS Master', label: 'TDS Master' },
      { id: 'TCS Master', label: 'TCS Master' }
    ]
  },
  {
    id: 'voucher_config',
    label: 'Voucher Configuration',
    icon: FileText,
    tabs: [
      { id: 'Voucher Types', label: 'Voucher Types' }
    ]
  }
];

export const resolveParentName = (parentNameField, parentIdField) => {
  const cleanStr = (val) => {
    if (val && typeof val === 'string' && val.trim()) {
      const s = val.trim();
      if (!s.match(/^[0-9a-fA-F]{24}$/)) return s;
    }
    return null;
  };
  return cleanStr(parentNameField) || cleanStr(parentIdField) || 'Primary';
};

export const getScaledKpiCount = (countOnPage, pageLength, totalServerCount) => {
  if (!pageLength || pageLength === 0) return 0;
  if (!totalServerCount || totalServerCount <= pageLength) return countOnPage;
  const ratio = totalServerCount / pageLength;
  return Math.round(countOnPage * ratio);
};

const MasterDataPanel = ({ mode: propMode, isDark }) => {
  const selectedCompany = useAppStore(s => s.selectedCompany);
  const orgId = useAppStore(s => s.orgId);

  const getCompanyHeaders = () => {
    const activeComp = selectedCompany || localStorage.getItem('selectedCompanyId') || localStorage.getItem('activeCompany') || '';
    const activeOrg = orgId || localStorage.getItem('orgId') || '';
    const activeFy = localStorage.getItem('selectedFy') || 'FY 2024-25';
    const headers = {};
    if (activeComp) {
      headers['x-company-id'] = activeComp;
      headers['x-company'] = activeComp;
    }
    if (activeOrg) {
      headers['x-organization-id'] = activeOrg;
    }
    if (activeFy) {
      headers['x-financial-year'] = activeFy;
      headers['x-fy'] = activeFy;
    }
    return headers;
  };

  const [activeTab, setActiveTab] = useState(propMode || 'Party Ledger');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyUnsynced, setOnlyUnsynced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [masterSourceTab, setMasterSourceTab] = useState('synced'); // 'synced' (Existing/Tally) vs 'web_entry' (Web Form Entries)

  // Detail Tab View State
  const [openTabs, setOpenTabs] = useState(() => [
    { id: propMode || 'Party Ledger', title: propMode || 'Party Ledger', type: 'list' }
  ]);

  const currentTabObj = openTabs.find(t => t.id === activeTab) || openTabs[0];
  const isDetailView = currentTabObj?.type === 'detail';

  // Master Modes & Tabs Definition
  const MASTER_TABS = [
    { id: 'Party Ledger', label: 'Ledgers', fullTitle: 'Ledger Master' },
    { id: 'Ledger Group', label: 'Ledger Group', fullTitle: 'Ledger Group Master' },
    { id: 'Item Master', label: 'Item Master', fullTitle: 'Stock Item Master' },
    { id: 'Stock Group', label: 'Stock Group', fullTitle: 'Stock Group Master' },
    { id: 'Stock Category', label: 'Stock Category', fullTitle: 'Stock Category Master' },
    { id: 'Unit Master', label: 'Unit', fullTitle: 'Unit Master' },
    { id: 'Godown Master', label: 'Godown', fullTitle: 'Godown Master' },
    { id: 'Cost Center', label: 'Cost Center', fullTitle: 'Cost Center Master' },
    { id: 'BOM Master', label: 'Bill of Materials (BOM)', fullTitle: 'BOM Master' },
    { id: 'Voucher Types', label: 'Voucher Types', fullTitle: 'Voucher Types Master' },
    { id: 'TDS Master', label: 'TDS Master', fullTitle: 'TDS Master' },
    { id: 'TCS Master', label: 'TCS Master', fullTitle: 'TCS Master' },
  ];


  const isLedgerGroup = activeTab === 'Ledger Group' || activeTab === 'Ledger Groups';
  const isStockGroup = activeTab === 'Stock Group' || activeTab === 'Stock Groups';
  const isStockCategory = activeTab === 'Stock Category' || activeTab === 'Stock Categories';
  const isUnit = activeTab === 'Unit Master' || activeTab === 'Unit' || activeTab === 'Units';
  const isGodown = activeTab === 'Godown Master' || activeTab === 'Godown' || activeTab === 'Godowns' || propMode === 'Godown Master' || propMode === 'Godown';
  const isCostCenter = activeTab === 'Cost Center' || activeTab === 'Cost Centre' || propMode === 'Cost Center';
  const isStock = activeTab === 'Stock Ledger' || activeTab === 'Item Master' || activeTab === 'Stock Items' || activeTab === 'Stock Item';
  const isBom = activeTab === 'BOM Master' || activeTab === 'BOM' || activeTab === 'Bill of Materials (BOM)' || propMode === 'BOM Master' || propMode === 'BOM';
  const isVoucherType = activeTab === 'Voucher Types' || activeTab === 'Voucher Type' || propMode === 'Voucher Types';
  const isTds = activeTab === 'TDS Master' || activeTab === 'TDS' || propMode === 'TDS Master' || propMode === 'TDS';
  const isTcs = activeTab === 'TCS Master' || activeTab === 'TCS' || propMode === 'TCS Master' || propMode === 'TCS';


  // Master Collections State (Fetched Dynamically from Connected Database)
  const [costCentersList, setCostCentersList] = useState([]);
  const [ledgerGroupsList, setLedgerGroupsList] = useState([]);
  const [stockCategoriesList, setStockCategoriesList] = useState([]);
  const [editingStockCategory, setEditingStockCategory] = useState(null);
  const [editingLedgerGroup, setEditingLedgerGroup] = useState(null);
  const [stockGroupsList, setStockGroupsList] = useState([]);
  const [editingStockGroup, setEditingStockGroup] = useState(null);
  const [unitsList, setUnitsList] = useState([]);
  const [editingUnit, setEditingUnit] = useState(null);
  const [godownsList, setGodownsList] = useState([]);
  const [editingGodown, setEditingGodown] = useState(null);
  const [costCategories, setCostCategories] = useState([]);
  const [editingCostCenter, setEditingCostCenter] = useState(null);
  const [costCenterSubTab, setCostCenterSubTab] = useState('cost_centres'); // 'cost_centres' | 'cost_categories' | 'cost_centre_classes'
  const [costCategoriesList, setCostCategoriesList] = useState([]);
  const [costCentreClassesList, setCostCentreClassesList] = useState([]);
  const [editingCostCategory, setEditingCostCategory] = useState(null);
  const [editingCostCentreClass, setEditingCostCentreClass] = useState(null);
  const [bomsList, setBomsList] = useState([]);
  const [editingBom, setEditingBom] = useState(null);
  const [voucherTypesList, setVoucherTypesList] = useState([]);
  const [editingVoucherType, setEditingVoucherType] = useState(null);
  const [showVoucherTypeModal, setShowVoucherTypeModal] = useState(false);
  const [tdsList, setTdsList] = useState([]);
  const [editingTds, setEditingTds] = useState(null);
  const [tcsList, setTcsList] = useState([]);
  const [editingTcs, setEditingTcs] = useState(null);


  // Server-side Pagination & Total Counts State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(200);
  const [totalPages, setTotalPages] = useState(1);
  const [serverLedgerCounts, setServerLedgerCounts] = useState({ total: 0, web: 0, synced: 0 });
  const [serverMasterCounts, setServerMasterCounts] = useState({});

  const updateServerCounts = (tabKey, total, synced, web) => {
    if (total === undefined || total === null) return;
    setServerMasterCounts(prev => ({
      ...prev,
      [tabKey]: {
        total: total,
        synced: synced ?? total,
        web: web ?? 0
      }
    }));
  };



  // Tally XML Preview States
  const [showXmlPreviewModal, setShowXmlPreviewModal] = useState(false);
  const [previewXmlContent, setPreviewXmlContent] = useState('');
  const [previewXmlFileName, setPreviewXmlFileName] = useState('');
  const [selectedLedgerKeys, setSelectedLedgerKeys] = useState([]);

  // XML Handler Functions
  const handleGenerateMasterXml = async (row) => {
    setLoading(true);
    try {
      const activeCompanyId = localStorage.getItem('selectedCompanyId') || localStorage.getItem('activeCompany') || '';
      const headers = activeCompanyId ? { 'x-company-id': activeCompanyId } : {};
      const masterId = row._id || row.id || row.ledgerGuid || row.itemGuid || row.sr;
      const collectionName = row.sourceCollection || (
        isBom ? 'boms_entry' :
        isStockCategory ? 'stockcategories_entry' :
        isUnit ? 'units_entry' :
        isGodown ? 'godownEntries' :
        isCostCenter ? 'costcenters_entry' :
        isStockGroup ? 'stockgroups_entry' :
        isLedgerGroup ? 'groups_entry' :
        isStock ? 'stockitems_entry' : 'ledgers_entry'
      );
      const masterName = row.godownName || row.bomName || row.ledgerName || row.itemName || row.unitName || row.groupName || row.costCenterName || row.name || row.ledger || 'Master Record';


      let res;
      try {
        res = await apiClient.post('/masters/tally-xml', {
          collectionName,
          id: masterId,
          name: masterName
        }, { headers });
      } catch (err) {
        if (collectionName === 'ledgers_entry' || collectionName === 'ledgers') {
          res = await apiClient.get(`/ledgers/${masterId}/tally-xml`, { headers });
        } else {
          throw err;
        }
      }

      if (res.data && res.data.success) {
        setPreviewXmlContent(res.data.xml);
        setPreviewXmlFileName(res.data.fileName || `${masterName.replace(/\s+/g, '_')}_Tally.xml`);
        setShowXmlPreviewModal(true);
        toast.success('Tally XML generated successfully!');
      } else {
        toast.error(res?.data?.message || 'Failed to generate Tally XML');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error generating Tally XML: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };


  const handleBulkGenerateLedgerXml = async () => {
    if (selectedLedgerKeys.length === 0) return;
    setLoading(true);
    try {
      const activeCompanyId = localStorage.getItem('selectedCompanyId') || localStorage.getItem('activeCompany') || '';
      const headers = activeCompanyId ? { 'x-company-id': activeCompanyId } : {};
      const selectedRows = rows.filter(r => selectedLedgerKeys.includes(r.sr || r.stockCategoryName || r.groupName || r.costCenterName));
      const ids = selectedRows.map(r => r._id || r.id || r.ledgerGuid || r.name || r.ledger);
      
      const res = await apiClient.post('/ledgers/tally-xml/batch', { ids }, { headers });
      if (res.data && res.data.success) {
        setPreviewXmlContent(res.data.xml);
        setPreviewXmlFileName(res.data.fileName || `Selected_Ledgers_Tally.xml`);
        setShowXmlPreviewModal(true);
        toast.success('Bulk Tally XML generated successfully!');
      } else {
        toast.error('Failed to generate Bulk Tally XML');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error generating Bulk Tally XML: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleCopyXml = () => {
    navigator.clipboard.writeText(previewXmlContent);
    toast.success('XML copied to clipboard!');
  };

  const handleDownloadXml = () => {
    const blob = new Blob([previewXmlContent], { type: 'text/xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', previewXmlFileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`XML downloaded as ${previewXmlFileName}`);
  };

  // Quick Modal States for Ledger Group & Stock Group Creation
  const [newGroupForm, setNewGroupForm] = useState({ groupName: '', parentGroup: 'Primary', nature: 'Assets' });
  const [newStockGroupForm, setNewStockGroupForm] = useState({ groupName: '', parentGroup: 'Primary', hsnCode: '', gstRate: '18%' });

  const toggleCostCenterStatus = (row) => {
    setCostCentersList(prev => prev.map(c => {
      if (c.sr === row.sr || c.costCenterName === row.costCenterName) {
        const nextStatus = c.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
        toast.info(`Cost Center "${c.costCenterName}" set to ${nextStatus}`);
        return { ...c, status: nextStatus };
      }
      return c;
    }));
  };

  const handleAddCostCategory = (newCat) => {
    if (!costCategories.includes(newCat)) {
      setCostCategories(prev => [...prev, newCat]);
    }
  };

  const fetchMasterData = async (forceRefresh = false) => {
    const isCached =
      (isPartyLedger && partyDataList.length > 0) ||
      (isStock && stockDataList.length > 0) ||
      (isVoucherType && voucherTypesList.length > 0) ||
      (isLedgerGroup && ledgerGroupsList.length > 0) ||
      (isStockGroup && stockGroupsList.length > 0) ||
      (isStockCategory && stockCategoriesList.length > 0) ||
      (isUnit && unitsList.length > 0) ||
      (isCostCenter && costCentersList.length > 0) ||
      (isBom && bomsList.length > 0);

    if (!isCached) {
      setLoading(true);
    }

    try {
      const headers = getCompanyHeaders();
      const currentFy = localStorage.getItem('selectedFy') || 'FY 2024-25';
      const isAll = pageSize === 'all' || pageSize >= 5000;
      const currentLimit = typeof pageSize === 'number' ? pageSize : 200;
      const params = {
        page: currentPage,
        limit: isAll ? 5000 : currentLimit,
        search: searchQuery,
        financial_year: currentFy,
        fy: currentFy
      };
      if (isAll) {
        params.all = true;
      }

      // 1. Fetch active tab specific data first for instant UI response
      if (isPartyLedger) {
        apiClient.get('/ledgers', { headers, params }).then(res => {
          const ledgersRes = res.data || {};
          if (ledgersRes.total !== undefined) {
            if (!searchQuery) {
              setServerLedgerCounts({
                total: ledgersRes.total,
                web: ledgersRes.totalWeb,
                synced: ledgersRes.totalSynced
              });
              updateServerCounts('Party Ledger', ledgersRes.total, ledgersRes.totalSynced, ledgersRes.totalWeb);
            }
            setTotalPages(ledgersRes.totalPages || 1);
          }

          const rawLedgers = Array.isArray(ledgersRes.data) ? ledgersRes.data : (ledgersRes.data?.ledgers || []);
          const mappedLedgers = rawLedgers.map((l, index) => {
            const isString = typeof l === 'string';
            const nameStr = isString ? l : (l.ledgerName || l.name || '');
            return {
              ...(isString ? {} : l),
              sr: (currentPage - 1) * currentLimit + index + 1,
              ledger: nameStr,
              parentGroup: isString ? 'Sundry Debtors' : (l.groupName || l.parentGroup || 'Sundry Debtors'),
              subGroup: isString ? 'Sundry Debtors' : (l.groupName || l.subGroup || 'Sundry Debtors'),
              gst: isString ? 'N/A' : (l.partyDetails?.gstin || l.gstin || 'N/A'),
              name: nameStr,
              pos: isString ? '—' : (l.partyDetails?.gstState || l.gstState || '—'),
              type: isString ? 'Regular' : (l.registrationType || 'Regular'),
              add1: isString ? '—' : (l.add1 || '—'),
              add2: isString ? '—' : (l.add2 || '—'),
              city: isString ? '—' : (l.city || '—'),
              isSynced: isString ? true : (l.isSynced ?? !l.isWebEntry),
              isWebEntry: isString ? false : !!l.isWebEntry,
              sourceCollection: isString ? 'ledgers' : (l.sourceCollection || (l.isWebEntry ? 'ledgers_entry' : 'ledgers'))
            };
          });
          setPartyDataList(mappedLedgers);
          setLoading(false);
        }).catch(err => {
          console.error('Error fetching ledgers:', err);
          setLoading(false);
        });
      }

      if (isStock || (isBom && stockDataList.length === 0) || (forceRefresh && isStock)) {
        apiClient.get('/masters/stock-items', { headers, params }).then(res => {
          if (res.data?.total !== undefined && !searchQuery) {
            updateServerCounts('Item Master', res.data.total, res.data.totalSynced ?? res.data.total, res.data.totalWeb ?? 0);
            updateServerCounts('Stock Items', res.data.total, res.data.totalSynced ?? res.data.total, res.data.totalWeb ?? 0);
          }
          if (res.data?.totalPages !== undefined) {
            setTotalPages(res.data.totalPages || 1);
          }
          const rawStock = Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
          const mappedStock = rawStock.map((s, index) => {
            const isString = typeof s === 'string';
            const nameStr = isString ? s : (s.itemName || s.name || '');
            const isWeb = isString ? false : (!!s.isWebEntry || s.sourceCollection === 'stockitems_entry');
            return {
              ...(isString ? {} : s),
              sr: (currentPage - 1) * currentLimit + index + 1,
              name: nameStr,
              itemName: nameStr,
              itemCode: isString ? '' : (s.itemCode || s.stockItemCode || s.sku || ''),
              group: isString ? 'General' : (s.stockGroupName || s.group || s.stockGroup || 'General'),
              stockGroupName: isString ? 'General' : (s.stockGroupName || s.group || s.stockGroup || 'General'),
              category: isString ? 'Not Applicable' : (s.stockCategoryName || s.category || s.stockCategory || 'Not Applicable'),
              stockCategoryName: isString ? 'Not Applicable' : (s.stockCategoryName || s.category || s.stockCategory || 'Not Applicable'),
              uom: isString ? 'Nos' : (s.unitName || s.uom || (typeof s.unit === 'object' ? s.unit?.baseUnit : s.unit) || s.baseUnit || 'Nos'),
              hsn: isString ? 'N/A' : (s.tax?.hsnCode || s.hsnSacDetails?.hsnCode || s.hsnCode || s.hsn || s.tax?.sacCode || 'N/A'),
              gstRate: isString ? '0%' : (s.tax?.gstRate ? `${s.tax.gstRate}%` : (s.gstSettings?.gstRate ? `${s.gstSettings.gstRate}%` : (s.gstRate ? (String(s.gstRate).endsWith('%') ? s.gstRate : `${s.gstRate}%`) : '0%'))),
              qty: isString ? 0 : (s.inventory?.openingStock?.quantity ?? s.inventory?.openingQuantity ?? s.openingQty ?? s.qty ?? s.closingBalance?.quantity ?? s.stockQty ?? 0),
              rate: isString ? 0 : (s.inventory?.openingStock?.rate ?? s.pricing?.purchaseRate ?? s.openingRate ?? s.rate ?? s.closingBalance?.rate ?? 0),
              value: isString ? 0 : (s.inventory?.openingStock?.value ?? s.inventory?.openingValue ?? s.openingValue ?? s.value ?? s.closingBalance?.amount ?? 0),
              status: isString ? 'ACTIVE' : (s.status || 'ACTIVE').toUpperCase(),
              isSynced: !isWeb,
              isWebEntry: isWeb,
              sourceCollection: isString ? 'stockItems' : (s.sourceCollection || (isWeb ? 'stockitems_entry' : 'stockItems'))
            };
          });
          setStockDataList(mappedStock);
          if (isStock) setLoading(false);
        }).catch(err => {
          console.error('Error fetching stock items from /masters/stock-items:', err);
          salesApi.getStockItems().then(stockRes => {
            const rawStock = Array.isArray(stockRes.data) ? stockRes.data : (stockRes.data?.stockItems || []);
            const mappedStock = rawStock.map((s, index) => {
              const isString = typeof s === 'string';
              const nameStr = isString ? s : (s.itemName || s.name || '');
              return {
                ...(isString ? {} : s),
                sr: (currentPage - 1) * currentLimit + index + 1,
                name: nameStr,
                group: isString ? 'General' : (s.group || s.stockGroup || 'General'),
                uom: isString ? 'Nos' : (s.unit || s.uom || 'Nos'),
                hsn: isString ? 'N/A' : (s.hsnCode || s.hsn || 'N/A'),
                gstRate: isString ? '0%' : (s.gstRate ? `${s.gstRate}%` : '0%'),
                qty: isString ? 0 : (s.qty ?? 0),
                rate: isString ? 0 : (s.rate ?? 0),
                value: isString ? 0 : (s.value ?? 0),
                isSynced: isString ? true : (s.isSynced ?? !s.isWebEntry),
                isWebEntry: isString ? false : !!s.isWebEntry,
                sourceCollection: isString ? 'stockItems' : (s.sourceCollection || (s.isWebEntry ? 'stockitems_entry' : 'stockItems'))
              };
            });
            setStockDataList(mappedStock);
            if (isStock) setLoading(false);
          }).catch(e => {
            console.error('Error fetching fallback stock items:', e);
            if (isStock) setLoading(false);
          });
        });
      }

      if (isVoucherType) {
        apiClient.get('/masters/voucher-types', { headers, params }).then(res => {
          if (res.data?.total !== undefined && !searchQuery) {
            updateServerCounts('Voucher Types', res.data.total, res.data.totalSynced ?? res.data.total, res.data.totalWeb ?? 0);
          }
          if (res.data?.totalPages !== undefined) {
            setTotalPages(res.data.totalPages || 1);
          }
          const rawVTypes = res.data?.data || [];
          setVoucherTypesList(rawVTypes.map((vt, i) => ({
            ...vt,
            sr: (currentPage - 1) * currentLimit + i + 1,
            voucherTypeName: vt.voucherTypeName || vt.name || '',
            voucherTypeCode: vt.voucherTypeCode || vt.code || `VCH-000${i + 1}`,
            parent: vt.parent || vt.parentGroup || 'Sales',
            numberingMethod: vt.numberingMethod || 'Automatic',
            status: vt.status || 'ACTIVE',
            isWebEntry: !!vt.isWebEntry,
            sourceCollection: vt.sourceCollection || (vt.isWebEntry ? 'vouchertypes_entry' : 'voucherTypes')
          })));
          setLoading(false);
        }).catch(err => {
          console.error('Error fetching voucher types:', err);
          setLoading(false);
        });
      }

      if (isLedgerGroup) {
        apiClient.get('/masters/ledger-groups', { headers, params }).then(res => {
          if (res.data?.total !== undefined && !searchQuery) {
            updateServerCounts('Ledger Group', res.data.total, res.data.totalSynced ?? res.data.total, res.data.totalWeb ?? 0);
          }
          if (res.data?.totalPages !== undefined) {
            setTotalPages(res.data.totalPages || 1);
          }
          const rawGroups = res.data?.data || [];
          setLedgerGroupsList(rawGroups.map((g, i) => ({
            ...g,
            sr: (currentPage - 1) * currentLimit + i + 1,
            groupName: g.groupName || g.name,
            groupCode: g.groupCode || `GRP00${i + 1}`,
            parentGroup: resolveParentName(g.parentGroupName, g.parentGroup),
            parentGroupName: resolveParentName(g.parentGroupName, g.parentGroup),
            nature: g.nature || g.classification || 'EXPENSES',
            subType: g.subType || 'INDIRECT_EXPENSES',
            status: g.status || 'ACTIVE',
            isReserved: g.isReserved ?? false,
            isWebEntry: !!g.isWebEntry,
            sourceCollection: g.sourceCollection || (g.isWebEntry ? 'groups_entry' : 'groups')
          })));
          setLoading(false);
        }).catch(err => {
          console.error('Error fetching ledger groups:', err);
          setLoading(false);
        });
      }

      if (isStockGroup) {
        apiClient.get('/masters/stock-groups', { headers, params }).then(res => {
          if (res.data?.total !== undefined && !searchQuery) {
            updateServerCounts('Stock Group', res.data.total, res.data.totalSynced ?? res.data.total, res.data.totalWeb ?? 0);
          }
          if (res.data?.totalPages !== undefined) {
            setTotalPages(res.data.totalPages || 1);
          }
          const rawSg = res.data?.data || [];
          setStockGroupsList(rawSg.map((sg, i) => ({
            ...sg,
            sr: (currentPage - 1) * currentLimit + i + 1,
            groupName: sg.groupName || sg.name,
            parentGroup: resolveParentName(sg.parentGroupName, sg.parentGroup),
            parentGroupName: resolveParentName(sg.parentGroupName, sg.parentGroup),
            hsnCode: sg.hsnCode || '—',
            gstRate: sg.gstRate ? `${sg.gstRate}%` : '18%',
            isWebEntry: !!sg.isWebEntry,
            sourceCollection: sg.sourceCollection || (sg.isWebEntry ? 'stockgroups_entry' : 'stockGroups')
          })));
          setLoading(false);
        }).catch(err => {
          console.error('Error fetching stock groups:', err);
          setLoading(false);
        });
      }

      if (isStockCategory) {
        apiClient.get('/masters/stock-categories', { headers, params }).then(res => {
          if (res.data?.total !== undefined && !searchQuery) {
            updateServerCounts('Stock Category', res.data.total, res.data.totalSynced ?? res.data.total, res.data.totalWeb ?? 0);
          }
          if (res.data?.totalPages !== undefined) {
            setTotalPages(res.data.totalPages || 1);
          }
          const rawSc = res.data?.data || [];
          setStockCategoriesList(rawSc.map((sc, i) => ({
            ...sc,
            sr: (currentPage - 1) * currentLimit + i + 1,
            stockCategoryName: sc.categoryName || sc.stockCategoryName || sc.name || '',
            stockCategoryCode: sc.stockCategoryCode || `SCAT-000${i + 1}`,
            parentCategory: resolveParentName(sc.parentCategoryName, sc.parentCategory),
            parentCategoryName: resolveParentName(sc.parentCategoryName, sc.parentCategory),
            status: sc.status || 'ACTIVE',
            isWebEntry: !!sc.isWebEntry,
            sourceCollection: sc.sourceCollection || (sc.isWebEntry ? 'stockcategories_entry' : 'stockCategories')
          })));
          setLoading(false);
        }).catch(err => {
          console.error('Error fetching stock categories:', err);
          setLoading(false);
        });
      }

      if (isUnit) {
        apiClient.get('/masters/units', { headers, params }).then(res => {
          if (res.data?.total !== undefined && !searchQuery) {
            updateServerCounts('Unit', res.data.total, res.data.totalSynced ?? res.data.total, res.data.totalWeb ?? 0);
          }
          if (res.data?.totalPages !== undefined) {
            setTotalPages(res.data.totalPages || 1);
          }
          const rawUnits = res.data?.data || [];
          setUnitsList(rawUnits.map((u, i) => {
            const isObj = typeof u === 'object';
            return {
              ...(isObj ? u : {}),
              sr: (currentPage - 1) * currentLimit + i + 1,
              unitName: isObj ? (u.unitName || u.name || u.symbol || '') : u,
              symbol: isObj ? (u.symbol || u.unitSymbol || u.unitName || u.name || '') : u,
              unitCode: isObj ? (u.unitCode || u.code || `UNIT-000${i + 1}`) : `UNIT-000${i + 1}`,
              conversion: isObj && u.conversion ? u.conversion : { isBaseUnit: true, baseUnit: null, conversionFactor: 0, decimalPlaces: 2 },
              status: isObj && u.status ? u.status : 'ACTIVE',
              isWebEntry: isObj ? !!u.isWebEntry : false,
              sourceCollection: isObj ? (u.sourceCollection || (u.isWebEntry ? 'units_entry' : 'units')) : 'units'
            };
          }));
          setLoading(false);
        }).catch(err => {
          console.error('Error fetching units:', err);
          setLoading(false);
        });
      }

      if (isCostCenter) {
        apiClient.get('/masters/cost-centers', { headers, params }).then(res => {
          if (res.data?.total !== undefined && !searchQuery) {
            updateServerCounts('Cost Center', res.data.total, res.data.totalSynced ?? res.data.total, res.data.totalWeb ?? 0);
          }
          if (res.data?.totalPages !== undefined) {
            setTotalPages(res.data.totalPages || 1);
          }
          const rawCc = res.data?.data || [];
          setCostCentersList(rawCc.map((cc, i) => ({
            ...cc,
            sr: (currentPage - 1) * currentLimit + i + 1,
            costCenterName: cc.costCenterName || cc.name || '',
            costCenterCode: cc.costCenterCode || `CC-000${i + 1}`,
            costCategoryId: cc.costCategoryName || cc.costCategoryId || cc.costCategory || 'Primary Cost Category',
            parentId: resolveParentName(cc.parentName, cc.parentId),
            parentName: resolveParentName(cc.parentName, cc.parentId),
            status: cc.status || 'ACTIVE',
            isWebEntry: !!cc.isWebEntry,
            sourceCollection: cc.sourceCollection || (cc.isWebEntry ? 'costcenters_entry' : 'costCenters')
          })));
          setLoading(false);
        }).catch(err => {
          console.error('Error fetching cost centers:', err);
          setLoading(false);
        });
      }

      if (isGodown) {
        apiClient.get('/masters/godown-entries', { headers, params }).then(res => {
          if (res.data?.total !== undefined && !searchQuery) {
            updateServerCounts('Godown', res.data.total, res.data.totalSynced ?? res.data.total, res.data.totalWeb ?? 0);
          }
          if (res.data?.totalPages !== undefined) {
            setTotalPages(res.data.totalPages || 1);
          }
          const rawGodowns = res.data?.data || [];
          setGodownsList(rawGodowns.map((g, i) => ({
            ...g,
            sr: (currentPage - 1) * currentLimit + i + 1,
            godownName: g.godownName || g.name || '',
            alias: g.alias || '',
            parentGodown: resolveParentName(g.parentName, g.parentGodown),
            parentName: resolveParentName(g.parentName, g.parentGodown),
            locationType: g.locationType || 'Warehouse',
            stateName: g.stateName || g.state || '—',
            status: (g.status || 'ACTIVE').toUpperCase(),
            tallySyncStatus: g.tallySync?.syncStatus || (g.isSynced ? 'SYNCED' : 'NOT_SYNCED'),
            isWebEntry: !!g.isWebEntry,
            sourceCollection: g.sourceCollection || (g.isWebEntry ? 'godownEntries' : 'godowns')
          })));
          setLoading(false);
        }).catch(err => {
          if (res.data?.totalPages !== undefined) {
            setTotalPages(res.data.totalPages || 1);
          }
          const rawGodowns = res.data?.data || [];
          setGodownsList(rawGodowns.map((g, i) => ({
            ...g,
            sr: (currentPage - 1) * currentLimit + i + 1,
            godownName: g.godownName || g.name || '',
            alias: g.alias || '',
            parentGodown: resolveParentName(g.parentName, g.parentGodown),
            parentName: resolveParentName(g.parentName, g.parentGodown),
            locationType: g.locationType || 'Warehouse',
            stateName: g.stateName || g.state || '—',
            status: (g.status || 'ACTIVE').toUpperCase(),
            tallySyncStatus: g.tallySync?.syncStatus || (g.isSynced ? 'SYNCED' : 'NOT_SYNCED'),
            isWebEntry: !!g.isWebEntry,
            sourceCollection: g.sourceCollection || (g.isWebEntry ? 'godownEntries' : 'godowns')
          })));
          setLoading(false);
        }).catch(err => {
          console.error('Error fetching godowns:', err);
          setLoading(false);
        });
      }

      // 2. Fetch specialized master collections (Voucher Types, BOM, Units, Groups, Cost Centers) in background
      salesApi.getMasterData(headers).then(masterDataRes => {
        const masterData = masterDataRes?.data || masterDataRes || {};

        // Map Ledger Groups Collection
        const rawLedgerGroups = masterData.ledgerGroups || [];
        if (rawLedgerGroups.length > 0) {
          setLedgerGroupsList(rawLedgerGroups.map((g, i) => ({
            ...g,
            sr: i + 1,
            groupName: g.groupName || g.name,
            groupCode: g.groupCode || `GRP00${i + 1}`,
            parentGroup: g.parentGroup || g.parentGroupName || 'Primary',
            nature: g.nature || g.classification || 'EXPENSES',
            subType: g.subType || 'INDIRECT_EXPENSES',
            status: g.status || 'ACTIVE',
            isReserved: g.isReserved ?? false,
            isWebEntry: !!g.isWebEntry,
            sourceCollection: g.sourceCollection || (g.isWebEntry ? 'groups_entry' : 'groups')
          })));
        }

        // Map Stock Groups
        const rawStockGroups = masterData.stockGroups || [];
        if (rawStockGroups.length > 0) {
          setStockGroupsList(rawStockGroups.map((sg, i) => ({
            ...sg,
            sr: i + 1,
            groupName: sg.groupName || sg.name,
            parentGroup: sg.parentGroup || 'Primary',
            hsnCode: sg.hsnCode || '—',
            gstRate: sg.gstRate ? `${sg.gstRate}%` : '18%',
            isWebEntry: !!sg.isWebEntry,
            sourceCollection: sg.sourceCollection || (sg.isWebEntry ? 'stockgroups_entry' : 'stockGroups')
          })));
        }

        // Map Cost Centers
        const rawCostCenters = masterData.costCenters || [];
        const mappedCostCenters = rawCostCenters.map((cc, i) => ({
          ...cc,
          sr: i + 1,
          costCenterName: cc.costCenterName || cc.name || '',
          costCenterCode: cc.costCenterCode || `CC-000${i + 1}`,
          costCategoryId: cc.costCategoryName || cc.costCategoryId || cc.costCategory || 'Primary Cost Category',
          parentId: cc.parentName || cc.parentId || 'Primary / None',
          status: cc.status || 'ACTIVE',
          isWebEntry: !!cc.isWebEntry,
          sourceCollection: cc.sourceCollection || (cc.isWebEntry ? 'costcenters_entry' : 'costCenters')
        }));
        setCostCentersList(mappedCostCenters);

        // Map Cost Categories & compute associated Cost Centres count & list
        const categoryMap = {};
        mappedCostCenters.forEach((cc) => {
          const catKey = (cc.costCategoryId || 'Primary Cost Category').trim();
          if (!categoryMap[catKey]) {
            categoryMap[catKey] = [];
          }
          if (cc.costCenterName) {
            categoryMap[catKey].push(cc.costCenterName);
          }
        });

        const rawCategories = masterData.costCategories || [];
        const categoryNamesList = rawCategories.map((c) =>
          typeof c === 'string' ? c : (c.categoryName || c.costCategoryName || c.name || '')
        ).filter(Boolean);

        if (!categoryNamesList.includes('Primary Cost Category')) {
          categoryNamesList.push('Primary Cost Category');
        }

        setCostCategories(categoryNamesList);

        let categoryObjects = rawCategories.map((cat, i) => {
          const cName = typeof cat === 'string' ? cat : (cat.categoryName || cat.costCategoryName || cat.name || 'Primary Cost Category');
          const associated = categoryMap[cName] || categoryMap[cName.toLowerCase()] || [];
          return {
            ...(typeof cat === 'object' ? cat : { categoryName: cat }),
            sr: i + 1,
            categoryName: cName,
            costCentersCount: associated.length,
            associatedCenters: associated,
            status: cat.status || 'ACTIVE',
            isWebEntry: !!cat.isWebEntry,
            sourceCollection: cat.sourceCollection || (cat.isWebEntry ? 'costcategories_entry' : 'costCategories')
          };
        });

        if (!categoryObjects.some((c) => c.categoryName === 'Primary Cost Category')) {
          const associatedPrimary = categoryMap['Primary Cost Category'] || [];
          categoryObjects.unshift({
            sr: 1,
            categoryName: 'Primary Cost Category',
            alias: 'Primary',
            costCentersCount: associatedPrimary.length,
            associatedCenters: associatedPrimary,
            allocateRevenueItems: true,
            allocateNonRevenueItems: false,
            status: 'ACTIVE',
            isWebEntry: false,
            sourceCollection: 'costCategories'
          });
          categoryObjects = categoryObjects.map((c, idx) => ({ ...c, sr: idx + 1 }));
        }

        setCostCategoriesList(categoryObjects);

        // Map Stock Categories
        const rawStockCategories = masterData.stockCategories || [];
        setStockCategoriesList(rawStockCategories.map((sc, i) => ({
          ...sc,
          sr: i + 1,
          stockCategoryName: sc.categoryName || sc.stockCategoryName || sc.name || '',
          stockCategoryCode: sc.stockCategoryCode || `SCAT-000${i + 1}`,
          parentCategory: sc.parentCategoryName || sc.parentCategory || sc.parentName || 'Primary / Root Category',
          status: sc.status || 'ACTIVE',
          isWebEntry: !!sc.isWebEntry,
          sourceCollection: sc.sourceCollection || (sc.isWebEntry ? 'stockcategories_entry' : 'stockCategories')
        })));

        // Map Units
        const rawUnits = masterData.units || masterData.unitMaster || masterData.unitsList || [];
        if (rawUnits.length > 0) {
          setUnitsList(rawUnits.map((u, i) => {
            const isObj = typeof u === 'object';
            return {
              ...(isObj ? u : {}),
              sr: i + 1,
              unitName: isObj ? (u.unitName || u.name || u.symbol || '') : u,
              symbol: isObj ? (u.symbol || u.unitSymbol || u.unitName || u.name || '') : u,
              unitCode: isObj ? (u.unitCode || u.code || `UNIT-000${i + 1}`) : `UNIT-000${i + 1}`,
              conversion: isObj && u.conversion ? u.conversion : { isBaseUnit: true, baseUnit: null, conversionFactor: 0, decimalPlaces: 2 },
              status: isObj && u.status ? u.status : 'ACTIVE',
              isWebEntry: isObj ? !!u.isWebEntry : false,
              sourceCollection: isObj ? (u.sourceCollection || (u.isWebEntry ? 'units_entry' : 'units')) : 'units'
            };
          }));
        }

        // Map Godowns (Existing Data from godowns vs Web Entries from godownEntries)
        const rawGodowns = masterData.godowns || [];
        setGodownsList(rawGodowns.map((g, i) => ({
          ...g,
          sr: i + 1,
          godownName: g.godownName || g.name || '',
          alias: g.alias || '',
          parentGodown: g.parentName || g.parentGodown || g.parentCategory || 'Primary',
          locationType: g.locationType || 'Warehouse',
          stateName: g.stateName || g.state || '—',
          status: (g.status || 'ACTIVE').toUpperCase(),
          tallySyncStatus: g.tallySync?.syncStatus || (g.isSynced ? 'SYNCED' : 'NOT_SYNCED'),
          isWebEntry: !!g.isWebEntry,
          sourceCollection: g.sourceCollection || (g.isWebEntry ? 'godownEntries' : 'godowns')
        })));


        // Map BOMs

        const rawBoms = masterData.boms || [];
        setBomsList(rawBoms.map((b, i) => ({
          ...b,
          sr: i + 1,
          bomName: b.bomName || b.name || '',
          finishedItemName: b.finishedItemName || b.stockItemName || '',
          basicQty: b.basicQty ? `${b.basicQty} ${b.unit || ''}` : '1 Pcs',
          componentsCount: b.componentsCount || (b.items ? b.items.length : 0),
          status: b.status || 'ACTIVE',
          isWebEntry: !!b.isWebEntry,
          sourceCollection: b.sourceCollection || (b.isWebEntry ? 'boms_entry' : 'stockItems')
        })));

        // Map Voucher Types
        const rawVoucherTypes = masterData.voucherTypesFullList || masterData.voucherTypesFull || [];
        if (rawVoucherTypes.length > 0) {
          setVoucherTypesList(rawVoucherTypes.map((vt, i) => {
            const isObj = typeof vt === 'object';
            return {
              ...(isObj ? vt : {}),
              sr: i + 1,
              voucherTypeName: isObj ? (vt.voucherTypeName || vt.name || '') : vt,
              voucherTypeCode: isObj ? (vt.voucherTypeCode || vt.code || `VCH-000${i + 1}`) : `VCH-000${i + 1}`,
              parent: isObj ? (vt.parent || vt.parentGroup || 'Sales') : 'Sales',
              numberingMethod: isObj ? (vt.numberingMethod || vt.numbering || 'Automatic') : 'Automatic',
              status: isObj && vt.status ? vt.status : 'ACTIVE',
              isWebEntry: isObj ? !!vt.isWebEntry : false,
              sourceCollection: isObj ? (vt.sourceCollection || (vt.isWebEntry ? 'vouchertypes_entry' : 'voucherTypes')) : 'voucherTypes'
            };
          }));
        }

        // Map TDS Masters
        const rawTds = masterData.tdsMasters || masterData.tds || [];
        setTdsList(rawTds.map((t, i) => ({
          ...t,
          sr: i + 1,
          tdsName: t.tdsName || t.name || '',
          sectionCode: t.sectionCode || t.section || '194J',
          applicableRate: t.applicableRate ?? t.rate ?? 10,
          thresholdLimit: t.thresholdLimit ?? t.threshold ?? 50000,
          deducteeTypes: Array.isArray(t.deducteeTypes) ? t.deducteeTypes : (t.deducteeTypes ? [t.deducteeTypes] : ['Company Resident', 'Individual/HUF']),
          status: t.status || 'ACTIVE',
          isWebEntry: !!t.isWebEntry,
          sourceCollection: t.sourceCollection || (t.isWebEntry ? 'tds_entry' : 'tdsMasters')
        })));

        // Map TCS Masters
        const rawTcs = masterData.tcsMasters || masterData.tcs || [];
        setTcsList(rawTcs.map((t, i) => ({
          ...t,
          sr: i + 1,
          tcsName: t.tcsName || t.name || '',
          sectionCode: t.sectionCode || t.section || '206C(1H)',
          applicableRate: t.applicableRate ?? t.rate ?? 0.1,
          thresholdLimit: t.thresholdLimit ?? t.threshold ?? 5000000,
          buyerTypes: Array.isArray(t.buyerTypes) ? t.buyerTypes : (t.buyerTypes ? [t.buyerTypes] : ['Company Resident', 'Resident Buyer']),
          status: t.status || 'ACTIVE',
          isWebEntry: !!t.isWebEntry,
          sourceCollection: t.sourceCollection || (t.isWebEntry ? 'tcs_entry' : 'tcsMasters')
        })));
      }).catch(err => {
        console.error('Error fetching master data prefetch:', err);
      }).finally(() => {
        setLoading(false);
      });

    } catch (err) {
      console.error('Error in fetchMasterData execution:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (propMode) {
      const isCostCenterMode = propMode === 'Cost Center';
      const isStockMode = propMode === 'Stock Ledger' || propMode === 'Item Master';
      const targetId = isCostCenterMode ? 'Cost Center' : isStockMode ? 'Stock Ledger' : 'Party Ledger';
      setOpenTabs([
        { id: targetId, title: targetId, type: 'list', isStock: isStockMode, isCostCenter: isCostCenterMode }
      ]);
      setActiveTab(targetId);
    }
  }, [propMode]);

  const clearAllStateLists = () => {
    setPartyDataList([]);
    setStockDataList([]);
    setVoucherTypesList([]);
    setLedgerGroupsList([]);
    setStockGroupsList([]);
    setStockCategoriesList([]);
    setUnitsList([]);
    setGodownsList([]);
    setCostCentersList([]);
    setCostCategoriesList([]);
    setCostCentreClassesList([]);
    setBomsList([]);
    setTdsList([]);
    setTcsList([]);
  };

  useEffect(() => {
    clearAllStateLists();
    setCurrentPage(1);
    fetchMasterData(true);
  }, [selectedCompany, orgId]);

  useEffect(() => {
    fetchMasterData();
  }, [currentPage, pageSize, activeTab, searchQuery]);

  useEffect(() => {
    const handleAutoRefresh = () => {
      clearAllStateLists();
      setCurrentPage(1);
      fetchMasterData(true);
    };
    window.addEventListener('company-changed', handleAutoRefresh);
    window.addEventListener('auth-changed', handleAutoRefresh);
    window.addEventListener('fy-changed', handleAutoRefresh);
    return () => {
      window.removeEventListener('company-changed', handleAutoRefresh);
      window.removeEventListener('auth-changed', handleAutoRefresh);
      window.removeEventListener('fy-changed', handleAutoRefresh);
    };
  }, []);

  useEffect(() => {
    setSelectedLedgerKeys([]);
    setCurrentPage(1);
  }, [activeTab, masterSourceTab, searchQuery, pageSize]);

  const handleRowClick = (row) => {
    if (isStock) {
      setEditingStockItem(row);
      setShowCreateForm(true);
      return;
    }
    // For party ledgers: Open "+ Add Ledger" form in Edit mode populated with all details
    setEditingLedger(row);
    setShowCreateForm(true);
  };

  const handleCloseTab = (e, tabId) => {
    e.stopPropagation();
    const tabIndex = openTabs.findIndex(t => t.id === tabId);
    const newTabs = openTabs.filter(t => t.id !== tabId);
    setOpenTabs(newTabs);
    
    // If the closed tab was active, switch to another tab
    if (activeTab === tabId) {
      const fallbackTab = newTabs[tabIndex - 1] || newTabs[0];
      setActiveTab(fallbackTab.id);
    }
  };

  // Form states
  const [ledgerForm, setLedgerForm] = useState({
    ledgerName: '',
    aliasName: '',
    parentGroup: 'Sundry Debtors',
    openingBalance: '',
    balanceType: 'Dr',
    mailingName: '',
    mobileNumber: '',
    address: '',
    emailAddress: '',
    gstApplicable: true,
    gstin: '',
    registrationType: 'Regular',
    pos: 'Maharashtra (27)',
    panNumber: '',
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    branch: '',
    maintainBillWise: true,
    creditPeriod: '',
    creditLimit: '',
    notes: '',
    status: 'Active'
  });

  const [itemForm, setItemForm] = useState({
    itemName: '',
    stockGroup: 'Computer Accessories',
    uom: 'Nos',
    brand: '',
    hsnCode: '',
    gstRate: '18%',
    taxabilityType: 'Taxable',
    purchasePrice: '',
    salesPrice: '',
    mrp: '',
    openingQty: '',
    sku: '',
    description: ''
  });

  // Data states
  const [partyDataList, setPartyDataList] = useState([]);
  const [stockDataList, setStockDataList] = useState([]);
  const [editingLedger, setEditingLedger] = useState(null);
  const [editingStockItem, setEditingStockItem] = useState(null);

  const handleSaveLedgerFromForm = async (savedLedger) => {
    try {
      const headers = getCompanyHeaders();
      const res = await apiClient.post('/ledgers', savedLedger, { headers });
      
      if (res.data && res.data.success) {
        toast.success('Ledger saved to active company database successfully!');
        fetchMasterData();
        setShowCreateForm(false);
        setEditingLedger(null);
      } else {
        toast.error(res?.data?.message || 'Failed to save ledger');
      }
    } catch (err) {
      console.error('Error saving ledger to active company database:', err);
      toast.error(err.response?.data?.detail || err.response?.data?.message || 'Failed to save ledger to database');
    }
  };

  // 1. Save / Update Stock Item -> POST or PUT /masters/stock-items
  const handleSaveStockItem = async (savedItem) => {
    try {
      const itemId = savedItem._id || savedItem.id || editingStockItem?._id || editingStockItem?.id;
      let res;
      if (itemId) {
        res = await apiClient.put(`/masters/stock-items/${itemId}`, savedItem);
      } else {
        res = await apiClient.post('/masters/stock-items', savedItem);
      }
      if (res.data && res.data.success) {
        toast.success(itemId ? 'Stock item updated successfully!' : 'Stock item saved to database successfully!');
        setMasterSourceTab('web_entry');
        fetchMasterData(true);
        setShowCreateForm(false);
        setEditingStockItem(null);
      } else {
        toast.error(res?.data?.message || 'Failed to save stock item');
      }
    } catch (err) {
      console.error('Error saving stock item to database:', err);
      toast.error(err.response?.data?.detail || err.response?.data?.message || 'Failed to save stock item');
    }
  };

  // 2. Save Unit -> POST /masters/units (saves to units_entry)
  const handleSaveUnit = async (savedUnit) => {
    try {
      const res = await apiClient.post('/masters/units', savedUnit);
      if (res.data && res.data.success) {
        toast.success('Unit saved to database successfully!');
        setMasterSourceTab('web_entry');
        fetchMasterData(true);
        setShowCreateForm(false);
        setEditingUnit(null);
      } else {
        toast.error(res?.data?.message || 'Failed to save unit');
      }
    } catch (err) {
      console.error('Error saving unit to database:', err);
      toast.error(err.response?.data?.detail || err.response?.data?.message || 'Failed to save unit');
    }
  };

  // 3. Save Stock Group -> POST /masters/stock-groups (saves to stockgroups_entry)
  const handleSaveStockGroup = async (savedGroup) => {
    try {
      const res = await apiClient.post('/masters/stock-groups', savedGroup);
      if (res.data && res.data.success) {
        toast.success('Stock group saved to database successfully!');
        setMasterSourceTab('web_entry');
        fetchMasterData(true);
        setShowCreateForm(false);
        setEditingStockGroup(null);
      } else {
        toast.error(res?.data?.message || 'Failed to save stock group');
      }
    } catch (err) {
      console.error('Error saving stock group to database:', err);
      toast.error(err.response?.data?.detail || err.response?.data?.message || 'Failed to save stock group');
    }
  };

  // 4. Save Stock Category -> POST /masters/stock-categories (saves to stockcategories_entry)
  const handleSaveStockCategory = async (savedCategory) => {
    try {
      const res = await apiClient.post('/masters/stock-categories', savedCategory);
      if (res.data && res.data.success) {
        toast.success('Stock category saved to database successfully!');
        setMasterSourceTab('web_entry');
        fetchMasterData(true);
        setShowCreateForm(false);
        setEditingStockCategory(null);
      } else {
        toast.error(res?.data?.message || 'Failed to save stock category');
      }
    } catch (err) {
      console.error('Error saving stock category to database:', err);
      toast.error(err.response?.data?.detail || err.response?.data?.message || 'Failed to save stock category');
    }
  };

  // 5. Save Ledger Group -> POST /masters/ledger-groups (saves to groups_entry)
  const handleSaveLedgerGroup = async (savedGroup) => {
    try {
      const res = await apiClient.post('/masters/ledger-groups', savedGroup);
      if (res.data && res.data.success) {
        toast.success('Ledger group saved to database successfully!');
        setMasterSourceTab('web_entry');
        fetchMasterData(true);
        setShowCreateForm(false);
        setEditingLedgerGroup(null);
      } else {
        toast.error(res?.data?.message || 'Failed to save ledger group');
      }
    } catch (err) {
      console.error('Error saving ledger group to database:', err);
      toast.error(err.response?.data?.detail || err.response?.data?.message || 'Failed to save ledger group');
    }
  };

  // 6. Save Cost Center -> POST /masters/cost-centers (saves to costcenters_entry)
  const handleSaveCostCenter = async (savedCc) => {
    try {
      const res = await apiClient.post('/masters/cost-centers', savedCc);
      if (res.data && res.data.success) {
        toast.success('Cost center saved to database successfully!');
        setMasterSourceTab('web_entry');
        fetchMasterData(true);
        setShowCreateForm(false);
        setEditingCostCenter(null);
      } else {
        toast.error(res?.data?.message || 'Failed to save cost center');
      }
    } catch (err) {
      console.error('Error saving cost center to database:', err);
      toast.error(err.response?.data?.detail || err.response?.data?.message || 'Failed to save cost center');
    }
  };


  const handleCreateItem = async (e) => {
    if (e) e.preventDefault();
    if (!itemForm.itemName) {
      toast.error('Item Name is required');
      return;
    }
    await handleSaveStockItem({
      itemName: itemForm.itemName,
      stockGroupName: itemForm.stockGroup,
      uom: itemForm.uom,
      brand: itemForm.brand,
      hsnCode: itemForm.hsnCode,
      gstRate: parseFloat(itemForm.gstRate) || 18,
      taxabilityType: itemForm.taxabilityType,
      purchasePrice: parseFloat(itemForm.purchasePrice) || 0,
      salesPrice: parseFloat(itemForm.salesPrice) || 0,
      mrp: parseFloat(itemForm.mrp) || 0,
      openingQty: parseFloat(itemForm.openingQty) || 0
    });
  };

  // Push Web Entry Master Record to Tally
  const handlePushToTally = async (item, collectionName, masterName) => {
    try {
      const activeCompanyId = localStorage.getItem('selectedCompanyId') || localStorage.getItem('activeCompany') || '';
      const targetCol = collectionName || item.sourceCollection || (
        isBom ? 'boms_entry' :
        isStockCategory ? 'stockcategories_entry' :
        isUnit ? 'units_entry' :
        isGodown ? 'godownEntries' :
        isCostCenter ? 'costcenters_entry' :
        isStockGroup ? 'stockgroups_entry' :
        isLedgerGroup ? 'groups_entry' :
        isStock ? 'stockitems_entry' : 'ledgers_entry'
      );
      const itemId = item._id || item.id || item.sr;
      const itemName = masterName || item.godownName || item.bomName || item.ledgerName || item.itemName || item.unitName || item.groupName || item.costCenterName || item.name || 'Master Record';

      const res = await apiClient.post('/masters/push-to-tally', {
        collectionName: targetCol,
        id: itemId,
        name: itemName
      }, {
        headers: activeCompanyId ? { 'x-company-id': activeCompanyId } : {}
      });

      if (res.data && res.data.success) {
        toast.success(`🎉 Master "${itemName}" pushed to Tally successfully!`);
        fetchMasterData(true);
      } else {
        toast.error(res?.data?.message || 'Failed to push to Tally');
      }
    } catch (err) {
      console.error('Error pushing master to Tally:', err);
      toast.error(err.response?.data?.detail || err.response?.data?.message || 'Failed to push to Tally');
    }
  };

  const handlePushAllToTally = async () => {
    try {
      const activeList = isBom
        ? bomsList
        : isStockCategory
          ? stockCategoriesList
          : isGodown
            ? godownsList
            : isUnit
              ? unitsList
              : isCostCenter
                ? costCentersList
                : isStockGroup
                  ? stockGroupsList
                  : isLedgerGroup
                    ? ledgerGroupsList
                    : isStock
                      ? stockDataList
                      : partyDataList;

      const webEntries = activeList.filter(r => r.isWebEntry);
      if (webEntries.length === 0) {
        toast.info('No web form entries found to push.');
        return;
      }

      toast.loading('Pushing web entries to Tally...');
      for (const item of webEntries) {
        await handlePushToTally(item);
      }
      toast.dismiss();
      toast.success(`🚀 All ${webEntries.length} web form entries pushed to Tally!`);
    } catch (err) {
      toast.dismiss();
      console.error('Error pushing all web entries to Tally:', err);
    }
  };

  // Delete Web Entry Master Record
  const handleDeleteWebEntry = async (item) => {
    const itemName = item.godownName || item.bomName || item.ledgerName || item.itemName || item.unitName || item.groupName || item.costCenterName || item.name || item.ledger || 'Master Record';
    const collectionName = item.sourceCollection || (
      isBom ? 'boms_entry' :
      isStockCategory ? 'stockcategories_entry' :
      isUnit ? 'units_entry' :
      isGodown ? 'godownEntries' :
      isCostCenter ? 'costcenters_entry' :
      isStockGroup ? 'stockgroups_entry' :
      isLedgerGroup ? 'groups_entry' :
      isStock ? 'stockitems_entry' : 'ledgers_entry'
    );


    const itemId = item._id || item.id;

    if (!window.confirm(`Are you sure you want to delete "${itemName}" from web form entries?`)) {
      return;
    }

    try {
      const activeCompanyId = localStorage.getItem('selectedCompanyId') || localStorage.getItem('activeCompany') || '';
      const res = await apiClient.delete('/masters/entry', {
        params: { collectionName, id: itemId },
        headers: activeCompanyId ? { 'x-company-id': activeCompanyId } : {}
      });

      if (res.data && res.data.success) {
        toast.success(`🗑️ Master "${itemName}" deleted successfully!`);
        fetchMasterData(true);
      } else {
        toast.error(res?.data?.message || 'Failed to delete entry');
      }
    } catch (err) {
      console.error('Error deleting web entry master:', err);
      toast.error(err.response?.data?.detail || err.response?.data?.message || 'Failed to delete web entry master');
    }
  };


  // Active filtered source list for KPI cards matching the sub-tab (synced vs web_entry)
  const activeSourceList = useMemo(() => {
    const list = isTds
      ? tdsList
      : isTcs
        ? tcsList
        : isVoucherType
          ? voucherTypesList
          : isBom
            ? bomsList
            : isStockCategory
              ? stockCategoriesList
              : isGodown
                ? godownsList
                : isCostCenter
                  ? (costCenterSubTab === 'cost_categories' ? costCategoriesList : (costCenterSubTab === 'cost_centre_classes' ? costCentreClassesList : costCentersList))
                  : isUnit
                    ? unitsList
                    : isStockGroup
                      ? stockGroupsList
                      : isLedgerGroup
                        ? ledgerGroupsList
                        : isStock
                          ? stockDataList
                          : partyDataList;
    return list.filter(r => masterSourceTab === 'web_entry' ? (!!r.isWebEntry && !r.isSystemPredefined) : (!r.isWebEntry || !!r.isSystemPredefined));
  }, [masterSourceTab, isTds, tdsList, isTcs, tcsList, isVoucherType, voucherTypesList, isBom, bomsList, isStockCategory, stockCategoriesList, isGodown, godownsList, isCostCenter, costCenterSubTab, costCentersList, costCategoriesList, costCentreClassesList, isUnit, unitsList, isStockGroup, stockGroupsList, isLedgerGroup, ledgerGroupsList, isStock, stockDataList, partyDataList]);

  const isPartyLedger = !isLedgerGroup && !isStockGroup && !isStockCategory && !isUnit && !isGodown && !isCostCenter && !isStock && !isBom && !isVoucherType && !isTds && !isTcs;

  const activeTabKey = isPartyLedger
    ? 'Party Ledger'
    : (isLedgerGroup
      ? 'Ledger Group'
      : (isStockGroup
        ? 'Stock Group'
        : (isStockCategory
          ? 'Stock Category'
          : (isUnit
            ? 'Unit'
            : (isGodown
              ? 'Godown'
              : (isCostCenter
                ? 'Cost Center'
                : (isStock
                  ? 'Item Master'
                  : (isBom
                    ? 'BOM'
                    : (isVoucherType
                      ? 'Voucher Types'
                      : (isTds
                        ? 'TDS Master'
                        : (isTcs ? 'TCS Master' : activeTab)))))))))));

  const currentTabCounts = isPartyLedger
    ? serverLedgerCounts
    : (serverMasterCounts[activeTabKey] || serverMasterCounts[activeTab] || {});

  const syncedCount = isPartyLedger
    ? (serverLedgerCounts.synced ?? activeSourceList.length)
    : (currentTabCounts?.synced ?? activeSourceList.length);

  const webEntryCount = isPartyLedger
    ? (serverLedgerCounts.web ?? 0)
    : (currentTabCounts?.web ?? 0);

  const activeMasterCount = currentTabCounts && currentTabCounts.total !== undefined
    ? (masterSourceTab === 'web_entry' ? (currentTabCounts.web || 0) : (currentTabCounts.synced ?? currentTabCounts.total ?? 0))
    : activeSourceList.length;

  // Statistics Display Config (uses activeSourceList with getScaledKpiCount scaling)
  const tdsStats = useMemo(() => {
    const totalCount = activeMasterCount || activeSourceList.length;
    const pageLen = activeSourceList.length;
    const activeOnPage = activeSourceList.filter(t => String(t.status || 'ACTIVE').toUpperCase() !== 'INACTIVE').length;
    const scaledActive = getScaledKpiCount(activeOnPage, pageLen, totalCount);
    return [
      { label: 'Total TDS Masters', value: totalCount.toLocaleString('en-IN'), icon: FileText },
      { label: 'Active Rates', value: scaledActive.toLocaleString('en-IN'), icon: CheckCircle2 },
      { label: 'Avg Rate %', value: pageLen > 0 ? (activeSourceList.reduce((acc, curr) => acc + (parseFloat(curr.applicableRate ?? curr.rate) || 0), 0) / pageLen).toFixed(1) + '%' : '0%', icon: Percent },
      { label: 'Sections Configured', value: new Set(activeSourceList.map(t => t.sectionCode || t.section)).size, icon: Tag },
    ];
  }, [activeSourceList, activeMasterCount]);

  const tcsStats = useMemo(() => {
    const totalCount = activeMasterCount || activeSourceList.length;
    const pageLen = activeSourceList.length;
    const activeOnPage = activeSourceList.filter(t => String(t.status || 'ACTIVE').toUpperCase() !== 'INACTIVE').length;
    const scaledActive = getScaledKpiCount(activeOnPage, pageLen, totalCount);
    return [
      { label: 'Total TCS Masters', value: totalCount.toLocaleString('en-IN'), icon: FileText },
      { label: 'Active Rates', value: scaledActive.toLocaleString('en-IN'), icon: CheckCircle2 },
      { label: 'Avg Rate %', value: pageLen > 0 ? (activeSourceList.reduce((acc, curr) => acc + (parseFloat(curr.applicableRate ?? curr.rate) || 0), 0) / pageLen).toFixed(1) + '%' : '0%', icon: Percent },
      { label: 'Sections Configured', value: new Set(activeSourceList.map(t => t.sectionCode || t.section)).size, icon: Tag },
    ];
  }, [activeSourceList, activeMasterCount]);

  const voucherTypeStats = useMemo(() => {
    const totalCount = activeMasterCount || activeSourceList.length;
    const pageLen = activeSourceList.length;
    const activeOnPage = activeSourceList.filter(v => String(v.status || 'ACTIVE').toUpperCase() !== 'INACTIVE').length;
    const scaledActive = getScaledKpiCount(activeOnPage, pageLen, totalCount);
    const autoOnPage = activeSourceList.filter(v => String(v.numberingMethod || 'Automatic').toLowerCase().includes('auto')).length;
    const scaledAuto = getScaledKpiCount(autoOnPage, pageLen, totalCount);
    const scaledManual = totalCount - scaledAuto;
    return [
      { label: 'Total Voucher Types', value: totalCount.toLocaleString('en-IN'), icon: FileText },
      { label: 'Active Types', value: scaledActive.toLocaleString('en-IN'), icon: CheckCircle2 },
      { label: 'Automatic Numbering', value: scaledAuto.toLocaleString('en-IN'), icon: Hash },
      { label: 'Manual Numbering', value: scaledManual.toLocaleString('en-IN'), icon: Settings },
    ];
  }, [activeSourceList, activeMasterCount]);

  const bomStats = useMemo(() => {
    const totalCount = activeMasterCount || activeSourceList.length;
    const pageLen = activeSourceList.length;
    const activeOnPage = activeSourceList.filter(b => (b.status || 'ACTIVE').toUpperCase() !== 'INACTIVE').length;
    const scaledActive = getScaledKpiCount(activeOnPage, pageLen, totalCount);
    const finishedOnPage = activeSourceList.filter(b => b.finishedItemName).length;
    const scaledFinished = getScaledKpiCount(finishedOnPage, pageLen, totalCount);
    const compsOnPage = activeSourceList.reduce((acc, b) => acc + (b.componentsCount || (b.items ? b.items.length : 0)), 0);
    const scaledComps = getScaledKpiCount(compsOnPage, pageLen, totalCount);
    return [
      { label: 'Total BOM Masters', value: totalCount.toLocaleString('en-IN'), icon: Box },
      { label: 'Active Assemblies', value: scaledActive.toLocaleString('en-IN'), icon: CheckCircle2 },
      { label: 'Finished Stock Items', value: scaledFinished.toLocaleString('en-IN'), icon: Package },
      { label: 'Total Components', value: scaledComps.toLocaleString('en-IN'), icon: Layers },
    ];
  }, [activeSourceList, activeMasterCount]);

  const godownStats = useMemo(() => {
    const totalCount = activeMasterCount || activeSourceList.length;
    const pageLen = activeSourceList.length;
    const primaryOnPage = activeSourceList.filter(g => {
      const p = (g.parentGodown || g.parentName || '').toString().toLowerCase();
      return !p || p === 'primary' || p === 'primary / root godown' || p === 'root' || g.isPrimary;
    }).length;
    const scaledPrimary = getScaledKpiCount(primaryOnPage, pageLen, totalCount);
    const scaledSub = totalCount - scaledPrimary;
    const activeOnPage = activeSourceList.filter(g => (g.status || 'ACTIVE').toUpperCase() !== 'INACTIVE').length;
    const scaledActive = getScaledKpiCount(activeOnPage, pageLen, totalCount);
    return [
      { label: 'Total Godowns', value: totalCount.toLocaleString('en-IN'), icon: Building2 },
      { label: 'Primary Godowns', value: scaledPrimary.toLocaleString('en-IN'), icon: Layers },
      { label: 'Sub-Godowns', value: scaledSub.toLocaleString('en-IN'), icon: FolderTree },
      { label: 'Active Godowns', value: scaledActive.toLocaleString('en-IN'), icon: CheckCircle2 },
    ];
  }, [activeSourceList, activeMasterCount]);

  const ledgerStats = useMemo(() => {
    const totalCount = activeMasterCount || activeSourceList.length;
    const pageLen = activeSourceList.length;
    const debtorsOnPage = activeSourceList.filter(p => p.parentGroup === 'Sundry Debtors').length;
    const scaledDebtors = getScaledKpiCount(debtorsOnPage, pageLen, totalCount);
    const creditorsOnPage = activeSourceList.filter(p => p.parentGroup === 'Sundry Creditors').length;
    const scaledCreditors = getScaledKpiCount(creditorsOnPage, pageLen, totalCount);
    const unsyncedOnPage = activeSourceList.filter(p => !p.isSynced).length;
    const scaledUnsynced = getScaledKpiCount(unsyncedOnPage, pageLen, totalCount);
    return [
      { label: 'Total Ledgers', value: totalCount.toLocaleString('en-IN'), icon: Users },
      { label: 'Sundry Debtors', value: scaledDebtors.toLocaleString('en-IN'), icon: User },
      { label: 'Sundry Creditors', value: scaledCreditors.toLocaleString('en-IN'), icon: BookOpen },
      { label: 'Unsynced', value: scaledUnsynced.toLocaleString('en-IN'), icon: AlertTriangle },
    ];
  }, [activeSourceList, activeMasterCount]);

  const ledgerGroupStats = useMemo(() => {
    const totalCount = activeMasterCount || activeSourceList.length;
    const pageLen = activeSourceList.length;
    const primaryOnPage = activeSourceList.filter(g => {
      const p = (g.parentGroup || g.parentGroupName || '').toString().toLowerCase();
      return !p || p === 'primary' || p === 'primary / root group' || p === 'root' || g.isPrimary;
    }).length;
    const scaledPrimary = getScaledKpiCount(primaryOnPage, pageLen, totalCount);
    const scaledSub = totalCount - scaledPrimary;
    const activeOnPage = activeSourceList.filter(g => (g.status || 'ACTIVE').toUpperCase() !== 'INACTIVE').length;
    const scaledActive = getScaledKpiCount(activeOnPage, pageLen, totalCount);
    return [
      { label: 'Total Ledger Groups', value: totalCount.toLocaleString('en-IN'), icon: Layers },
      { label: 'Primary Groups', value: scaledPrimary.toLocaleString('en-IN'), icon: BookOpen },
      { label: 'Sub Groups', value: scaledSub.toLocaleString('en-IN'), icon: Users },
      { label: 'Active Groups', value: scaledActive.toLocaleString('en-IN'), icon: CheckCircle2 },
    ];
  }, [activeSourceList, activeMasterCount]);

  const stockStats = useMemo(() => {
    const totalCount = activeMasterCount || activeSourceList.length;
    const pageLen = activeSourceList.length;
    const activeOnPage = activeSourceList.filter(s => (s.status || 'ACTIVE').toUpperCase() !== 'INACTIVE').length;
    const scaledActive = getScaledKpiCount(activeOnPage, pageLen, totalCount);
    const outOfStockOnPage = activeSourceList.filter(s => (s.qty ?? s.inventory?.openingStock?.quantity ?? 0) <= 0).length;
    const scaledOutOfStock = getScaledKpiCount(outOfStockOnPage, pageLen, totalCount);
    const pageStockValue = activeSourceList.reduce((acc, s) => acc + (s.value ?? s.inventory?.openingStock?.value ?? 0), 0);
    const scaledStockValue = getScaledKpiCount(pageStockValue, pageLen, totalCount);
    return [
      { label: 'Total Items', value: totalCount.toLocaleString('en-IN'), icon: Package },
      { label: 'Active Items', value: scaledActive.toLocaleString('en-IN'), icon: CheckCircle2 },
      { label: 'Out of Stock', value: scaledOutOfStock.toLocaleString('en-IN'), icon: AlertTriangle },
      { label: 'Stock Value', value: `₹${scaledStockValue.toLocaleString('en-IN')}`, icon: Coins },
    ];
  }, [activeSourceList, activeMasterCount]);

  const stockGroupStats = useMemo(() => {
    const totalCount = activeMasterCount || activeSourceList.length;
    const pageLen = activeSourceList.length;
    const primaryOnPage = activeSourceList.filter(g => {
      const p = (g.parentGroup || g.parentGroupName || '').toString().toLowerCase();
      return !p || p === 'primary' || p === 'primary / root group' || p === 'root' || g.isPrimary;
    }).length;
    const scaledPrimary = getScaledKpiCount(primaryOnPage, pageLen, totalCount);
    const scaledSub = totalCount - scaledPrimary;
    const activeOnPage = activeSourceList.filter(g => (g.status || 'ACTIVE').toUpperCase() !== 'INACTIVE').length;
    const scaledActive = getScaledKpiCount(activeOnPage, pageLen, totalCount);
    return [
      { label: 'Total Stock Groups', value: totalCount.toLocaleString('en-IN'), icon: Layers },
      { label: 'Primary Groups', value: scaledPrimary.toLocaleString('en-IN'), icon: Package },
      { label: 'Sub Groups', value: scaledSub.toLocaleString('en-IN'), icon: FolderTree },
      { label: 'Active Groups', value: scaledActive.toLocaleString('en-IN'), icon: CheckCircle2 },
    ];
  }, [activeSourceList, activeMasterCount]);

  const stockCategoryStats = useMemo(() => {
    const totalCount = activeMasterCount || activeSourceList.length;
    const pageLen = activeSourceList.length;
    const primaryOnPage = activeSourceList.filter(c => {
      const p = (c.parentCategory || c.parentCategoryName || '').toString().toLowerCase();
      return !p || p === 'primary' || p === 'primary / root category' || p === 'root' || c.isPrimary;
    }).length;
    const scaledPrimary = getScaledKpiCount(primaryOnPage, pageLen, totalCount);
    const scaledSub = totalCount - scaledPrimary;
    const activeOnPage = activeSourceList.filter(c => (c.status || 'ACTIVE').toUpperCase() !== 'INACTIVE').length;
    const scaledActive = getScaledKpiCount(activeOnPage, pageLen, totalCount);
    return [
      { label: 'Total Stock Categories', value: totalCount.toLocaleString('en-IN'), icon: FolderTree },
      { label: 'Primary Categories', value: scaledPrimary.toLocaleString('en-IN'), icon: Layers },
      { label: 'Sub Categories', value: scaledSub.toLocaleString('en-IN'), icon: Tag },
      { label: 'Active Categories', value: scaledActive.toLocaleString('en-IN'), icon: CheckCircle2 },
    ];
  }, [activeSourceList, activeMasterCount]);

  const costCenterStats = useMemo(() => {
    const totalCount = activeMasterCount || activeSourceList.length;
    const pageLen = activeSourceList.length;
    if (costCenterSubTab === 'cost_categories') {
      const totalCentersAllocated = activeSourceList.reduce((acc, c) => acc + (c.costCentersCount || (c.associatedCenters || []).length || 0), 0);
      return [
        { label: 'Total Cost Categories', value: pageLen.toLocaleString('en-IN'), icon: FolderTree },
        { label: 'Active Categories', value: activeSourceList.filter(c => (c.status || 'ACTIVE').toUpperCase() !== 'INACTIVE').length.toLocaleString('en-IN'), icon: CheckCircle2 },
        { label: 'Allocated Cost Centres', value: totalCentersAllocated.toLocaleString('en-IN'), icon: Layers },
        { label: 'Revenue Allocation', value: activeSourceList.filter(c => c.allocateRevenueItems).length.toLocaleString('en-IN'), icon: CheckCircle2 },
      ];
    }
    if (costCenterSubTab === 'cost_centre_classes') {
      return [
        { label: 'Total Classes', value: pageLen.toLocaleString('en-IN'), icon: Layers },
        { label: 'Active Classes', value: activeSourceList.filter(c => (c.status || 'ACTIVE').toUpperCase() !== 'INACTIVE').length.toLocaleString('en-IN'), icon: CheckCircle2 },
        { label: 'Categories Linked', value: new Set(activeSourceList.map(c => c.categoryName || c.costCategoryName).filter(Boolean)).size.toLocaleString('en-IN'), icon: FolderTree },
        { label: 'Sub-Classes', value: '0', icon: Tag },
      ];
    }
    const activeOnPage = activeSourceList.filter(c => (c.status || 'ACTIVE').toUpperCase() !== 'INACTIVE').length;
    const scaledActive = getScaledKpiCount(activeOnPage, pageLen, totalCount);
    const subOnPage = activeSourceList.filter(c => c.parentId && c.parentId !== 'Primary / None' && c.parentId !== 'Primary').length;
    const scaledSub = getScaledKpiCount(subOnPage, pageLen, totalCount);

    return [
      { label: 'Total Cost Centers', value: totalCount.toLocaleString('en-IN'), icon: Layers },
      { label: 'Active', value: scaledActive.toLocaleString('en-IN'), icon: CheckCircle2 },
      { label: 'Cost Categories', value: costCategories.length.toLocaleString('en-IN'), icon: FolderTree },
      { label: 'Sub-Centers', value: scaledSub.toLocaleString('en-IN'), icon: Users },
    ];
  }, [costCenterSubTab, activeSourceList, activeMasterCount, costCategories]);

  // Helper to determine if a unit is Compound vs Simple according to MongoDB doc
  const checkIsCompoundUnit = (u) => {
    if (!u || typeof u !== 'object') return false;
    const uType = String(u.unitType || u.type || '').toLowerCase();
    if (uType === 'compound') return true;
    if (uType === 'simple') return false;

    if (u.flags?.isCompound === true) return true;
    if (u.flags?.isCompound === false) return false;

    if (u.firstUnit || u.compound?.firstUnit) return true;

    const cFactor = Number(u.conversionFactor || u.compound?.conversionFactor || u.conversion?.conversionFactor);
    if (cFactor && cFactor > 1 && (u.secondUnit || u.compound?.secondUnit || u.conversion?.baseUnit)) {
      return true;
    }

    return false;
  };

  // Statistics Display Config
  const unitStats = useMemo(() => {
    const compoundCount = activeSourceList.filter(u => checkIsCompoundUnit(u)).length;
    const simpleCount = activeSourceList.length - compoundCount;
    return [
      { label: 'Total Units', value: (activeMasterCount || activeSourceList.length).toLocaleString('en-IN'), icon: Layers },
      { label: 'Simple Units', value: simpleCount, icon: Package },
      { label: 'Compound Units', value: compoundCount, icon: Tag },
      { label: 'Active Units', value: activeSourceList.filter(u => (typeof u === 'object' ? (u.status || 'ACTIVE').toUpperCase() !== 'INACTIVE' : true)).length, icon: CheckCircle2 },
    ];
  }, [activeSourceList, activeMasterCount]);


  const activeStats = isTds
    ? tdsStats
    : isTcs
      ? tcsStats
      : isVoucherType
        ? voucherTypeStats
        : isBom
          ? bomStats
          : isGodown
            ? godownStats
            : isStockCategory
              ? stockCategoryStats
              : isCostCenter
                ? costCenterStats
                : isUnit
                  ? unitStats
                  : isStockGroup
                    ? stockGroupStats
                    : isLedgerGroup
                      ? ledgerGroupStats
                      : isStock
                        ? stockStats
                        : ledgerStats;



  const toggleLedgerGroupStatus = (row) => {
    setLedgerGroupsList(prev => prev.map(g => {
      if (g.sr === row.sr || g.groupName === row.groupName) {
        const nextStatus = g.status === 'INACTIVE' ? 'ACTIVE' : 'INACTIVE';
        toast.info(`Ledger Group "${g.groupName}" status set to ${nextStatus}`);
        return { ...g, status: nextStatus };
      }
      return g;
    }));
  };

  // Helper to safely format string values from primitive values or objects
  const safeStr = (val, fallback = '') => {
    if (val === null || val === undefined) return fallback;
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return String(val);
    if (typeof val === 'object') {
      const str = val.groupName || val.categoryName || val.costCenterName || val.unitName || val.baseUnit || val.unit || val.uom || val.classification || val.name || val.symbol || val.statusName || val.code || val.rate;
      if (str && typeof str !== 'object') return String(str);
      return fallback;
    }
    return fallback;
  };

  const ledgerGroupColumns = [
    { key: 'sr', header: 'Sr', width: '52px', align: 'center', render: (_r, i) => <span style={{ color: 'var(--app-muted)' }}>{i + 1}</span> },
    { key: 'groupName', header: 'Group Name', sortable: true, render: (r) => <span className="font-bold text-[var(--app-heading)]">{safeStr(r.groupName || r.name)}</span> },
    { key: 'groupCode', header: 'Group Code', sortable: true, render: (r) => <span className="font-mono font-semibold">{safeStr(r.groupCode, `GRP00${r.sr}`)}</span> },
    { key: 'parentGroup', header: 'Parent Group', sortable: true, render: (r) => <Badge tone="neutral">{safeStr(r.parentGroup, 'Primary')}</Badge> },
    { key: 'nature', header: 'Classification', sortable: true, render: (r) => <span className="font-semibold text-[var(--app-accent)]">{safeStr(r.nature, 'EXPENSES')}</span> },
    { key: 'status', header: 'Status', align: 'center', sortable: true, render: (r) => (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toggleLedgerGroupStatus(r);
        }}
        title="Click to toggle status"
      >
        <Badge tone={safeStr(r.status) === 'INACTIVE' ? 'neutral' : 'success'}>{safeStr(r.status, 'ACTIVE')}</Badge>
      </button>
    ) },
    { 
      key: 'actions', 
      header: 'Actions', 
      align: 'center', 
      render: (r) => renderPushAction(r, (row) => {
        setEditingLedgerGroup(row);
        setShowCreateForm(true);
      }, "Edit Ledger Group")
    },
  ];

  const toggleStockGroupStatus = (row) => {
    setStockGroupsList(prev => prev.map(g => {
      if (g.sr === row.sr || g.groupName === row.groupName) {
        const nextStatus = g.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
        toast.info(`Stock Group "${g.groupName || g.name}" set to ${nextStatus}`);
        return { ...g, status: nextStatus };
      }
      return g;
    }));
  };

  const stockGroupColumns = [
    { key: 'sr', header: 'Sr', width: '52px', align: 'center', render: (_r, i) => <span style={{ color: 'var(--app-muted)' }}>{i + 1}</span> },
    { key: 'groupName', header: 'Stock Group Name', sortable: true, render: (r) => <span className="font-bold text-[var(--app-heading)]">{safeStr(r.groupName || r.name)}</span> },
    { key: 'groupCode', header: 'Group Code', sortable: true, render: (r) => <span className="font-mono font-semibold">{safeStr(r.groupCode || r.code, '—')}</span> },
    { key: 'parentGroup', header: 'Parent Group', sortable: true, render: (r) => <Badge tone="neutral">{safeStr(r.parentGroup || r.parentGroupName, 'Primary')}</Badge> },
    { key: 'baseUnits', header: 'Base Unit', render: (r) => <span className="font-semibold">{safeStr(r.baseUnits || r.unit, 'Nos')}</span> },
    { key: 'status', header: 'Status', align: 'center', sortable: true, render: (r) => (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toggleStockGroupStatus(r);
        }}
        title="Click to toggle status"
      >
        <Badge tone={safeStr(r.status) === 'ACTIVE' ? 'success' : 'neutral'}>{safeStr(r.status, 'ACTIVE')}</Badge>
      </button>
    ) },
    { 
      key: 'actions', 
      header: 'Actions', 
      align: 'center', 
      render: (r) => renderPushAction(r, (row) => {
        setEditingStockGroup(row);
        setShowCreateForm(true);
      }, "Edit Stock Group")
    },
  ];

  // Reusable Action Button Renderer with "Tally XML", "Push to Tally", "Edit", and "Delete"
  const renderPushAction = (r, onEdit, editLabel = "Edit") => {
    return (
      <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        {r.isWebEntry && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleGenerateMasterXml(r);
              }}
              className="px-2 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 border border-[var(--app-border)] hover:bg-[var(--app-control-hover)] text-[var(--app-text)] transition-colors cursor-pointer"
              title="Generate & View Tally XML"
            >
              <FileText size={12} className="text-[var(--app-accent)]" />
              <span>Tally XML</span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handlePushToTally(r, r.sourceCollection);
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 transition-all shadow-2xs cursor-pointer ${
                r.status === 'PUSHED_TO_TALLY' || r.tallyStatus === 'Pushed' || r.isSynced
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
              }`}
              title={r.status === 'PUSHED_TO_TALLY' ? 'Pushed to Tally' : 'Push this master record to Tally'}
            >
              {r.status === 'PUSHED_TO_TALLY' || r.tallyStatus === 'Pushed' || r.isSynced ? (
                <>
                  <CheckCircle2 size={12} />
                  <span>Pushed</span>
                </>
              ) : (
                <>
                  <Send size={12} />
                  <span>Push to Tally</span>
                </>
              )}
            </button>

            {onEdit && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(r);
                }}
                className="p-1.5 rounded-lg border border-[var(--app-border)] hover:bg-[var(--app-control-hover)] text-[var(--app-accent)] transition-colors inline-flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                title={editLabel}
              >
                <Edit3 size={13} />
                <span>Edit</span>
              </button>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteWebEntry(r);
              }}
              className="p-1.5 rounded-lg border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 transition-colors inline-flex items-center gap-1 text-[11px] font-bold cursor-pointer"
              title="Delete Web Form Entry"
            >
              <Trash2 size={13} />
              <span>Delete</span>
            </button>
          </>
        )}

        {!r.isWebEntry && onEdit && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(r);
            }}
            className="p-1.5 rounded-lg border border-[var(--app-border)] hover:bg-[var(--app-control-hover)] text-[var(--app-accent)] transition-colors inline-flex items-center gap-1 text-[11px] font-bold cursor-pointer"
            title={editLabel}
          >
            <Edit3 size={13} />
            <span>Edit</span>
          </button>
        )}
      </div>
    );
  };


  // Active master list based on active top tab
  const activeMasterList = useMemo(() => {
    if (isTds) return tdsList;
    if (isTcs) return tcsList;
    if (isVoucherType) return voucherTypesList;
    if (isBom) return bomsList;
    if (isStockCategory) return stockCategoriesList;
    if (isUnit) return unitsList;
    if (isGodown) return godownsList;
    if (isCostCenter) return (costCenterSubTab === 'cost_categories' ? costCategoriesList : (costCenterSubTab === 'cost_centre_classes' ? costCentreClassesList : costCentersList));
    if (isLedgerGroup) return ledgerGroupsList;
    if (isStockGroup) return stockGroupsList;
    if (isStock) return stockDataList;
    return partyDataList;
  }, [isTds, tdsList, isTcs, tcsList, isVoucherType, voucherTypesList, isBom, bomsList, isStockCategory, stockCategoriesList, isUnit, unitsList, isGodown, godownsList, isCostCenter, costCenterSubTab, costCentersList, costCategoriesList, costCentreClassesList, isLedgerGroup, ledgerGroupsList, isStockGroup, stockGroupsList, isStock, stockDataList, partyDataList]);




  // Filtered rows for the active tab & source sub-tab.
  const rows = useMemo(() => {
    // First split by masterSourceTab ('synced' vs 'web_entry')
    const sourceFiltered = activeMasterList.filter(r => masterSourceTab === 'web_entry' ? (!!r.isWebEntry && !r.isSystemPredefined) : (!r.isWebEntry || !!r.isSystemPredefined));

    if (onlyUnsynced) {
      return sourceFiltered.filter(r => !r.isSynced);
    }
    return sourceFiltered;
  }, [activeMasterList, masterSourceTab, onlyUnsynced]);


  const limitVal = typeof pageSize === 'number' ? pageSize : 200;

  const calculatedTotalPages = totalPages;

  const safeCurrentPage = currentPage;

  const displayRows = rows;

  const ledgerColumns = [
    { key: 'sr', header: 'Sr', width: '52px', align: 'center', render: (_r, i) => <span style={{ color: 'var(--app-muted)' }}>{i + 1}</span> },
    { key: 'ledger', header: 'Ledger', sortable: true, render: (r) => <span className="font-bold" style={{ color: 'var(--app-heading)' }}>{safeStr(r.ledger || r.name)}</span> },
    { key: 'parentGroup', header: 'Parent Group', sortable: true, render: (r) => <Badge tone="neutral">{safeStr(r.parentGroup)}</Badge> },
    { key: 'ledgerType', header: 'Ledger Type', sortable: true, render: (r) => <Badge tone="accent">{safeStr(r.ledgerType, '—')}</Badge> },
    { key: 'subGroup', header: 'Sub Group', render: (r) => <span style={{ color: 'var(--app-muted)' }}>{safeStr(r.subGroup)}</span> },
    { key: 'gst', header: 'GST Number', render: (r) => <span className="font-mono font-semibold">{safeStr(r.gst, 'N/A')}</span> },
    { key: 'name', header: 'Name', sortable: true, render: (r) => <span style={{ color: 'var(--app-heading)' }}>{safeStr(r.name || r.ledger)}</span> },
    { key: 'pos', header: 'Place of Supply', render: (r) => <span style={{ color: 'var(--app-muted)' }}>{safeStr(normalizeState(r.pos || r.gstState || r.partyDetails?.gstState), '—')}</span> },
    { key: 'type', header: 'GST Reg', render: (r) => <span style={{ color: 'var(--app-muted)' }}>{safeStr(r.type, 'Regular')}</span> },
    { key: 'add1', header: 'Address', render: (r) => <span className="truncate block max-w-[220px]" title={safeStr(r.add1)} style={{ color: 'var(--app-muted)' }}>{safeStr(r.add1, '—')}</span> },
    { key: 'city', header: 'City', render: (r) => <span style={{ color: 'var(--app-muted)' }}>{safeStr(r.city, '—')}</span> },
    { key: 'isSynced', header: 'Sync', align: 'center', sortable: true, sortValue: (r) => (r.isSynced ? 1 : 0), render: (r) => <Badge tone={r.isSynced ? 'success' : 'warning'}>{r.isSynced ? 'Synced' : 'Pending'}</Badge> },
    { 
      key: 'actions', 
      header: 'Actions', 
      align: 'center', 
      render: (r) => renderPushAction(r, (row) => {
        setEditingLedger(row);
        setShowCreateForm(true);
      }, "Edit Ledger Master")
    },
  ];

  const toggleStockItemStatus = (row) => {
    setStockDataList(prev => prev.map(s => {
      if (s.sr === row.sr || s.name === row.name) {
        const nextStatus = safeStr(s.status) === 'INACTIVE' ? 'ACTIVE' : 'INACTIVE';
        toast.info(`Stock Item "${safeStr(s.name)}" set to ${nextStatus}`);
        return { ...s, status: nextStatus };
      }
      return s;
    }));
  };

  const stockColumns = [
    { key: 'sr', header: 'Sr', width: '52px', align: 'center', render: (_r, i) => <span style={{ color: 'var(--app-muted)' }}>{i + 1}</span> },
    { key: 'name', header: 'Item Name', sortable: true, render: (r) => <span className="font-bold" style={{ color: 'var(--app-heading)' }}>{safeStr(r.name || r.itemName)}</span> },
    { key: 'itemCode', header: 'Item Code', sortable: true, render: (r) => <span className="font-mono font-semibold">{safeStr(r.itemCode || r.code, '—')}</span> },
    { key: 'group', header: 'Stock Group', sortable: true, render: (r) => <Badge tone="neutral">{safeStr(r.stockGroupName || r.group || r.stockGroup, 'General')}</Badge> },
    { key: 'category', header: 'Stock Category', sortable: true, render: (r) => <Badge tone="neutral">{safeStr(r.stockCategoryName || r.category || r.stockCategory, 'Not Applicable')}</Badge> },
    { key: 'uom', header: 'Base Unit', render: (r) => <span style={{ color: 'var(--app-muted)' }}>{safeStr(typeof r.unit === 'object' ? r.unit?.baseUnit : (r.uom || r.unit || r.baseUnit), 'Nos')}</span> },
    { key: 'hsn', header: 'HSN', render: (r) => <span className="font-mono font-semibold">{safeStr(r.hsnSacDetails?.hsnCode || r.hsnSacDetails?.hsn || r.hsnCode || r.hsn, '—')}</span> },
    { key: 'gstRate', header: 'GST', render: (r) => {
      const raw = r.gstSettings?.gstRate ?? r.gstRate ?? r.gst;
      const str = raw !== undefined && raw !== null && raw !== '' ? (String(raw).endsWith('%') ? String(raw) : `${raw}%`) : '18%';
      return <span className="font-semibold" style={{ color: 'var(--app-accent)' }}>{str}</span>;
    } },

    { key: 'status', header: 'Status', align: 'center', sortable: true, render: (r) => (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toggleStockItemStatus(r);
        }}
        title="Click to toggle status"
      >
        <Badge tone={safeStr(r.status) === 'INACTIVE' ? 'neutral' : 'success'}>{safeStr(r.status, 'ACTIVE')}</Badge>
      </button>
    ) },
    { 
      key: 'actions', 
      header: 'Actions', 
      align: 'center', 
      render: (r) => renderPushAction(r, (row) => {
        setEditingStockItem(row);
        setShowCreateForm(true);
      }, "Edit Stock Item Master")
    },
  ];

  const costCenterColumns = [
    { key: 'sr', header: 'Sr', width: '52px', align: 'center', render: (_r, i) => <span style={{ color: 'var(--app-muted)' }}>{i + 1}</span> },
    { key: 'costCenterName', header: 'Cost Center Name', sortable: true, render: (r) => <span className="font-bold text-[var(--app-heading)]">{safeStr(r.costCenterName || r.name)}</span> },
    { key: 'costCenterCode', header: 'Cost Center Code', sortable: true, render: (r) => <span className="font-mono font-semibold">{safeStr(r.costCenterCode, '—')}</span> },
    { key: 'costCategoryId', header: 'Cost Category', sortable: true, render: (r) => <Badge tone="neutral">{safeStr(r.costCategoryId || r.costCategoryName, 'Primary')}</Badge> },
    { key: 'parentId', header: 'Parent Cost Center', render: (r) => <span className="text-[var(--app-muted)] font-medium">{safeStr(r.parentId || r.parentName, 'Primary / None')}</span> },
    { key: 'status', header: 'Status', align: 'center', sortable: true, render: (r) => (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toggleCostCenterStatus(r);
        }}
        title="Click to toggle status"
      >
        <Badge tone={safeStr(r.status) === 'ACTIVE' ? 'success' : 'neutral'}>{safeStr(r.status, 'ACTIVE')}</Badge>
      </button>
    ) },
    { 
      key: 'actions', 
      header: 'Actions', 
      align: 'center', 
      render: (r) => renderPushAction(r, (row) => {
        setEditingCostCenter(row);
        setShowCreateForm(true);
      }, "Edit Cost Center")
    },
  ];

  const costCategoryColumns = [
    { key: 'sr', header: 'Sr', width: '52px', align: 'center', render: (_r, i) => <span style={{ color: 'var(--app-muted)' }}>{i + 1}</span> },
    { key: 'categoryName', header: 'Cost Category Name', sortable: true, render: (r) => <span className="font-bold text-[var(--app-heading)]">{safeStr(r.categoryName || r.costCategoryName || r.name)}</span> },
    { key: 'alias', header: 'Alias', sortable: true, render: (r) => <span className="font-medium text-[var(--app-heading)]">{safeStr(r.alias, '—')}</span> },
    { 
      key: 'costCentersCount', 
      header: 'Associated Cost Centres', 
      align: 'center', 
      render: (r) => {
        const centers = r.associatedCenters || [];
        const count = r.costCentersCount || centers.length || 0;
        return (
          <div className="flex flex-col items-center gap-0.5 py-0.5">
            <Badge tone={count > 0 ? 'info' : 'neutral'}>
              {count} {count === 1 ? 'center' : 'centers'}
            </Badge>
            {centers.length > 0 && (
              <span 
                className="text-[11px] font-medium text-[var(--app-muted)] max-w-[190px] truncate block" 
                title={`Allocated Cost Centres:\n• ${centers.join('\n• ')}`}
              >
                {centers.join(', ')}
              </span>
            )}
          </div>
        );
      } 
    },
    { key: 'allocateRevenueItems', header: 'Revenue Allocation', align: 'center', render: (r) => <Badge tone={r.allocateRevenueItems ? 'success' : 'neutral'}>{r.allocateRevenueItems ? 'Allocated' : 'No'}</Badge> },
    { key: 'allocateNonRevenueItems', header: 'Non-Revenue Allocation', align: 'center', render: (r) => <Badge tone={r.allocateNonRevenueItems ? 'success' : 'neutral'}>{r.allocateNonRevenueItems ? 'Allocated' : 'No'}</Badge> },
    { key: 'status', header: 'Status', align: 'center', sortable: true, render: (r) => (
      <Badge tone={safeStr(r.status) === 'ACTIVE' ? 'success' : 'neutral'}>{safeStr(r.status, 'ACTIVE')}</Badge>
    ) },
    { 
      key: 'actions', 
      header: 'Actions', 
      align: 'center', 
      render: (r) => renderPushAction(r, (row) => {
        setEditingCostCategory(row);
        setShowCreateForm(true);
      }, "Edit Cost Category")
    },
  ];

  const costCentreClassColumns = [
    { key: 'sr', header: 'Sr', width: '52px', align: 'center', render: (_r, i) => <span style={{ color: 'var(--app-muted)' }}>{i + 1}</span> },
    { key: 'className', header: 'Class Name', sortable: true, render: (r) => <span className="font-bold text-[var(--app-heading)]">{safeStr(r.className || r.name)}</span> },
    { key: 'alias', header: 'Alias', sortable: true, render: (r) => <span className="font-medium text-[var(--app-heading)]">{safeStr(r.alias, '—')}</span> },
    { key: 'allocationsCount', header: 'Allocations', align: 'center', render: (r) => <Badge tone="accent">{safeStr(r.allocationsCount || (r.allocations ? r.allocations.length : 0))} rules</Badge> },
    { key: 'status', header: 'Status', align: 'center', sortable: true, render: (r) => (
      <Badge tone={safeStr(r.status) === 'ACTIVE' ? 'success' : 'neutral'}>{safeStr(r.status, 'ACTIVE')}</Badge>
    ) },
    { 
      key: 'actions', 
      header: 'Actions', 
      align: 'center', 
      render: (r) => renderPushAction(r, (row) => {
        setEditingCostCentreClass(row);
        setShowCreateForm(true);
      }, "Edit Cost Centre Class")
    },
  ];

  const toggleStockCategoryStatus = (row) => {
    setStockCategoriesList(prev => prev.map(c => {
      if (c.sr === row.sr || c.stockCategoryName === row.stockCategoryName) {
        const nextStatus = safeStr(c.status) === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
        toast.info(`Stock Category "${safeStr(c.stockCategoryName || c.name)}" set to ${nextStatus}`);
        return { ...c, status: nextStatus };
      }
      return c;
    }));
  };

  const stockCategoryColumns = [
    { key: 'sr', header: 'Sr', width: '52px', align: 'center', render: (_r, i) => <span style={{ color: 'var(--app-muted)' }}>{i + 1}</span> },
    { key: 'stockCategoryName', header: 'Stock Category Name', sortable: true, render: (r) => <span className="font-bold text-[var(--app-heading)]">{safeStr(r.stockCategoryName || r.categoryName || r.name)}</span> },
    { key: 'stockCategoryCode', header: 'Category Code', sortable: true, render: (r) => <span className="font-mono font-semibold">{safeStr(r.stockCategoryCode || r.code, '—')}</span> },
    { key: 'parentCategory', header: 'Parent Category', sortable: true, render: (r) => <Badge tone="neutral">{safeStr(r.parentCategory || r.parentCategoryName || r.parentName, 'Primary')}</Badge> },
    { key: 'status', header: 'Status', align: 'center', sortable: true, render: (r) => (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toggleStockCategoryStatus(r);
        }}
        title="Click to toggle status"
      >
        <Badge tone={safeStr(r.status) === 'ACTIVE' ? 'success' : 'neutral'}>{safeStr(r.status, 'ACTIVE')}</Badge>
      </button>
    ) },
    { 
      key: 'actions', 
      header: 'Actions', 
      align: 'center', 
      render: (r) => renderPushAction(r, (row) => {
        setEditingStockCategory(row);
        setShowCreateForm(true);
      }, "Edit Stock Category")
    },
  ];

  const toggleUnitStatus = (row) => {
    setUnitsList(prev => prev.map(u => {
      if (u.sr === row.sr || u.unitName === row.unitName) {
        const nextStatus = safeStr(u.status) === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
        toast.info(`Unit "${safeStr(u.unitName || u.name)}" set to ${nextStatus}`);
        return { ...u, status: nextStatus };
      }
      return u;
    }));
  };

  const unitColumns = [
    { key: 'sr', header: 'Sr', width: '52px', align: 'center', render: (_r, i) => <span style={{ color: 'var(--app-muted)' }}>{i + 1}</span> },
    { key: 'unitName', header: 'Unit Name', sortable: true, render: (r) => <span className="font-bold text-[var(--app-heading)]">{safeStr(r.name || r.unitName || r.symbol)}</span> },
    { key: 'formalName', header: 'Formal Name', sortable: true, render: (r) => <span className="font-medium text-[var(--app-heading)]">{safeStr(r.formalName || r.formal_name, '—')}</span> },
    { key: 'type', header: 'Type', render: (r) => {
      const isComp = checkIsCompoundUnit(r);
      return <Badge tone={isComp ? 'warning' : 'neutral'}>{isComp ? 'Compound' : 'Simple'}</Badge>;
    } },
    { key: 'decimalPlaces', header: 'Decimal Places', align: 'center', sortable: true, render: (r) => <span className="font-mono font-bold text-xs text-[var(--app-heading)]">{r.decimalPlaces ?? 2}</span> },
    { key: 'conversion', header: 'Conversion', render: (r) => {
      const isComp = checkIsCompoundUnit(r);
      if (!isComp) return <span className="text-xs text-[var(--app-muted)]">—</span>;

      const first = safeStr(r.firstUnitName || r.firstUnit || r.compound?.firstUnit || r.name || r.symbol);
      const factor = r.conversionFactor || r.compound?.conversionFactor || r.conversion?.conversionFactor || 1;
      const second = safeStr(r.secondUnitName || r.secondUnit || r.compound?.secondUnit || r.conversion?.baseUnit);

      if (first && second) {
        return <span className="text-xs font-bold text-[var(--app-accent)]">{`1 ${first} = ${factor} ${second}`}</span>;
      }
      return <span className="text-xs text-[var(--app-muted)]">—</span>;
    } },


    { key: 'status', header: 'Status', align: 'center', sortable: true, render: (r) => (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toggleUnitStatus(r);
        }}
        title="Click to toggle status"
      >
        <Badge tone={safeStr(r.status) === 'ACTIVE' ? 'success' : 'neutral'}>{safeStr(r.status, 'ACTIVE')}</Badge>
      </button>
    ) },
    { 
      key: 'actions', 
      header: 'Actions', 
      align: 'center', 
      render: (r) => renderPushAction(r, (row) => {
        setEditingUnit(row);
        setShowCreateForm(true);
      }, "Edit Unit Master")
    },
  ];

  const handleSaveBom = async (savedBom) => {
    try {
      const res = await apiClient.post('/masters/boms', savedBom);
      if (res.data && res.data.success) {
        toast.success('BOM Master saved to database successfully!');
        fetchMasterData();
        setShowCreateForm(false);
        setEditingBom(null);
      } else {
        toast.error(res?.data?.message || 'Failed to save BOM master');
      }
    } catch (err) {
      console.error('Error saving BOM master to database:', err);
      toast.error(err.response?.data?.detail || err.response?.data?.message || 'Failed to save BOM master');
    }
  };



  const bomColumns = [
    { key: 'sr', header: 'Sr', width: '52px', align: 'center', render: (_r, i) => <span style={{ color: 'var(--app-muted)' }}>{i + 1}</span> },
    { key: 'bomName', header: 'BOM Name', sortable: true, render: (r) => <span className="font-bold text-[var(--app-heading)]">{safeStr(r.bomName || r.name)}</span> },
    { key: 'finishedItemName', header: 'Target Stock Item', sortable: true, render: (r) => <Badge tone="accent">{safeStr(r.finishedItemName || r.stockItemName, 'General Item')}</Badge> },
    { key: 'basicQty', header: 'Basic Qty', align: 'center', render: (r) => <span className="font-mono font-semibold">{safeStr(r.basicQty, '1 Pcs')}</span> },
    { key: 'componentsCount', header: 'Components', align: 'center', render: (r) => <Badge tone="neutral">{safeStr(r.componentsCount || (r.items ? r.items.length : 0), '1')} items</Badge> },
    { key: 'status', header: 'Status', align: 'center', sortable: true, render: (r) => (
      <Badge tone={safeStr(r.status) === 'ACTIVE' ? 'success' : 'neutral'}>{safeStr(r.status, 'ACTIVE')}</Badge>
    ) },
    { 
      key: 'actions', 
      header: 'Actions', 
      align: 'center', 
      render: (r) => renderPushAction(r, (row) => {
        setEditingBom(row);
        setShowCreateForm(true);
      }, "Edit BOM Master")
    },
  ];

  // Full Page View for BOM Create/Edit Form
  if (showCreateForm && isBom) {
    return (
      <div className="h-full flex flex-col overflow-hidden animate-in fade-in duration-300">
        <BomMasterForm
          initialData={editingBom}
          isEdit={!!editingBom}
          stockItemsList={stockDataList}
          unitsList={unitsList}
          godownsList={godownsList}
          bomsList={bomsList}
          onSave={() => {
            setShowCreateForm(false);
            setEditingBom(null);
            fetchMasterData(true);
          }}
          onClose={() => {
            setShowCreateForm(false);
            setEditingBom(null);
          }}
        />
      </div>
    );
  }

  const handleSaveGodown = async (savedGodown) => {
    try {
      const res = await apiClient.post('/masters/godown-entries', savedGodown);
      if (res.data && res.data.success) {
        toast.success('Godown Master saved to database successfully!');
        fetchMasterData();
        setShowCreateForm(false);
        setEditingGodown(null);
      } else {
        toast.error(res?.data?.message || 'Failed to save godown');
      }
    } catch (err) {
      console.error('Error saving godown to database:', err);
      toast.error(err.response?.data?.detail || err.response?.data?.message || 'Failed to save godown');
    }
  };

  const godownColumns = [
    { key: 'sr', header: 'Sr', width: '52px', align: 'center', render: (_r, i) => <span style={{ color: 'var(--app-muted)' }}>{i + 1}</span> },
    { key: 'godownName', header: 'Godown Name', sortable: true, render: (r) => <span className="font-bold text-[var(--app-heading)]">{safeStr(r.godownName || r.name)}</span> },
    { key: 'alias', header: 'Alias', sortable: true, render: (r) => <span className="font-medium text-[var(--app-heading)]">{safeStr(r.alias, '—')}</span> },
    { key: 'parentGodown', header: 'Parent Godown', sortable: true, render: (r) => <Badge tone={r.parentGodown === 'Primary' ? 'neutral' : 'accent'}>{safeStr(r.parentGodown, 'Primary')}</Badge> },
    { key: 'locationType', header: 'Location Type', align: 'center', render: (r) => <Badge tone="info">{safeStr(r.locationType, 'Warehouse')}</Badge> },
    { key: 'stateName', header: 'State', render: (r) => <span className="font-medium text-xs">{safeStr(r.stateName || r.state, '—')}</span> },
    { key: 'status', header: 'Status', align: 'center', sortable: true, render: (r) => (
      <Badge tone={safeStr(r.status) === 'ACTIVE' ? 'success' : 'neutral'}>{safeStr(r.status, 'ACTIVE')}</Badge>
    ) },
    { key: 'tallySyncStatus', header: 'Tally Sync Status', align: 'center', render: (r) => (
      <Badge tone={safeStr(r.tallySyncStatus) === 'SYNCED' ? 'success' : (safeStr(r.tallySyncStatus) === 'FAILED' ? 'danger' : 'warning')}>
        {safeStr(r.tallySyncStatus, 'NOT_SYNCED')}
      </Badge>
    ) },
    { 
      key: 'actions', 
      header: 'Actions', 
      align: 'center', 
      render: (r) => renderPushAction(r, (row) => {
        setEditingGodown(row);
        setShowCreateForm(true);
      }, "Edit Godown Master")
    },
  ];

  // Full Page View for Godown Create/Edit Form
  if (showCreateForm && isGodown) {
    return (
      <div className="h-full flex flex-col overflow-hidden animate-in fade-in duration-300">
        <GodownMasterForm
          initialData={editingGodown}
          isEdit={!!editingGodown}
          godownsList={godownsList}
          onSave={handleSaveGodown}
          onClose={() => {
            setShowCreateForm(false);
            setEditingGodown(null);
          }}
        />
      </div>
    );
  }


  // Full Page View for Unit Create/Edit Form
  if (showCreateForm && isUnit) {
    return (
      <div className="h-full flex flex-col overflow-hidden animate-in fade-in duration-300">
        <UnitMasterForm
          initialData={editingUnit}
          isEdit={!!editingUnit}
          unitsList={unitsList}
          onSave={handleSaveUnit}
          onClose={() => {
            setShowCreateForm(false);
            setEditingUnit(null);
          }}
        />
      </div>
    );
  }

  // Full Page View for Stock Category Create/Edit Form
  if (showCreateForm && isStockCategory) {
    return (
      <div className="h-full flex flex-col overflow-hidden animate-in fade-in duration-300">
        <StockCategoryMasterForm
          initialData={editingStockCategory}
          isEdit={!!editingStockCategory}
          stockCategoriesList={stockCategoriesList}
          onSave={handleSaveStockCategory}
          onClose={() => {
            setShowCreateForm(false);
            setEditingStockCategory(null);
          }}
        />
      </div>
    );
  }

  // Full Page View for Stock Group Create/Edit Form
  if (showCreateForm && isStockGroup) {
    return (
      <div className="h-full flex flex-col overflow-hidden animate-in fade-in duration-300">
        <StockGroupMasterForm
          initialData={editingStockGroup}
          isEdit={!!editingStockGroup}
          stockGroupsList={stockGroupsList}
          onSave={handleSaveStockGroup}
          onClose={() => {
            setShowCreateForm(false);
            setEditingStockGroup(null);
          }}
        />
      </div>
    );
  }

  // Full Page View for Cost Center / Category / Class Create/Edit Form
  if (showCreateForm && isCostCenter) {
    if (costCenterSubTab === 'cost_categories') {
      return (
        <div className="h-full flex flex-col overflow-hidden animate-in fade-in duration-300">
          <CostCategoryMasterForm
            initialData={editingCostCategory}
            isEdit={!!editingCostCategory}
            costCategoriesList={costCategoriesList}
            onSave={() => {
              setShowCreateForm(false);
              setEditingCostCategory(null);
              fetchMasterData(true);
            }}
            onClose={() => {
              setShowCreateForm(false);
              setEditingCostCategory(null);
            }}
          />
        </div>
      );
    }

    if (costCenterSubTab === 'cost_centre_classes') {
      return (
        <div className="h-full flex flex-col overflow-hidden animate-in fade-in duration-300">
          <CostCentreClassMasterForm
            initialData={editingCostCentreClass}
            isEdit={!!editingCostCentreClass}
            costCategoriesList={costCategoriesList}
            costCentersList={costCentersList}
            costCentreClassesList={costCentreClassesList}
            onSave={() => {
              setShowCreateForm(false);
              setEditingCostCentreClass(null);
              fetchMasterData(true);
            }}
            onClose={() => {
              setShowCreateForm(false);
              setEditingCostCentreClass(null);
            }}
          />
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col overflow-hidden animate-in fade-in duration-300">
        <CostCenterMasterForm
          initialData={editingCostCenter}
          isEdit={!!editingCostCenter}
          costCategories={costCategories}
          costCentersList={costCentersList}
          onSave={handleSaveCostCenter}
          onAddCostCategory={handleAddCostCategory}
          onClose={() => {
            setShowCreateForm(false);
            setEditingCostCenter(null);
          }}
        />
      </div>
    );
  }

  // Full Page View for Ledger Group Create/Edit Form
  if (showCreateForm && isLedgerGroup) {
    return (
      <div className="h-full flex flex-col overflow-hidden animate-in fade-in duration-300">
        <LedgerGroupMasterForm
          initialData={editingLedgerGroup}
          isEdit={!!editingLedgerGroup}
          ledgerGroupsList={ledgerGroupsList}
          onSave={handleSaveLedgerGroup}
          onClose={() => {
            setShowCreateForm(false);
            setEditingLedgerGroup(null);
          }}
        />
      </div>
    );
  }

  // Full Page View for Stock Item Create/Edit Form
  if (showCreateForm && isStock) {
    return (
      <div className="h-full flex flex-col overflow-hidden animate-in fade-in duration-300">
        <StockItemMasterForm
          initialData={editingStockItem}
          isEdit={!!editingStockItem}
          stockGroupsList={stockGroupsList}
          stockCategoriesList={stockCategoriesList}
          unitsList={unitsList}
          stockItemsList={stockDataList}
          onSave={handleSaveStockItem}
          onClose={() => {
            setShowCreateForm(false);
            setEditingStockItem(null);
          }}
        />

      </div>
    );
  }

  // Full Page View for TDS Master Create/Edit Form
  if (showCreateForm && isTds) {
    return (
      <div className="h-full flex flex-col overflow-hidden animate-in fade-in duration-300">
        <TDSMasterForm
          initialData={editingTds}
          isEdit={!!editingTds}
          onSave={() => {
            setShowCreateForm(false);
            setEditingTds(null);
            fetchMasterData(true);
          }}
          onClose={() => {
            setShowCreateForm(false);
            setEditingTds(null);
          }}
        />
      </div>
    );
  }

  // Full Page View for TCS Master Create/Edit Form
  if (showCreateForm && isTcs) {
    return (
      <div className="h-full flex flex-col overflow-hidden animate-in fade-in duration-300">
        <TCSMasterForm
          initialData={editingTcs}
          isEdit={!!editingTcs}
          onSave={() => {
            setShowCreateForm(false);
            setEditingTcs(null);
            fetchMasterData(true);
          }}
          onClose={() => {
            setShowCreateForm(false);
            setEditingTcs(null);
          }}
        />
      </div>
    );
  }

  // Full Page View for Ledger Create/Edit Form
  if (showCreateForm && !isStock && !isCostCenter && !isLedgerGroup && !isStockGroup && !isStockCategory && !isUnit && !isGodown && !isBom && !isTds && !isTcs) {

    return (
      <div className="h-full flex flex-col overflow-hidden animate-in fade-in duration-300">
        <LedgerMasterForm
          initialData={editingLedger}
          isEdit={!!editingLedger}
          costCentersList={costCentersList}
          ledgerGroupsList={ledgerGroupsList}
          partyDataList={partyDataList}
          tdsList={tdsList}
          tcsList={tcsList}
          onSave={handleSaveLedgerFromForm}
          onClose={() => {
            setShowCreateForm(false);
            setEditingLedger(null);
          }}
        />
      </div>
    );
  }

  const voucherTypeColumns = [
    { key: 'sr', header: 'Sr', width: '52px', align: 'center', render: (_r, i) => <span style={{ color: 'var(--app-muted)' }}>{i + 1}</span> },
    { key: 'voucherTypeName', header: 'Voucher Type Name', sortable: true, render: (r) => <span className="font-bold text-[var(--app-heading)]">{safeStr(r.voucherTypeName || r.name)}</span> },
    { key: 'voucherTypeCode', header: 'Code', sortable: true, render: (r) => <span className="font-mono font-semibold">{safeStr(r.voucherTypeCode || r.code, '—')}</span> },
    { key: 'parent', header: 'Parent Type', sortable: true, render: (r) => <Badge tone="neutral">{safeStr(r.parent || r.parentGroup, 'Sales')}</Badge> },
    { key: 'numberingMethod', header: 'Numbering Method', sortable: true, render: (r) => <span className="font-semibold text-[var(--app-accent)]">{safeStr(r.numberingMethod, 'Automatic')}</span> },
    { key: 'status', header: 'Status', align: 'center', sortable: true, render: (r) => <Badge tone={safeStr(r.status) === 'INACTIVE' ? 'neutral' : 'success'}>{safeStr(r.status, 'ACTIVE')}</Badge> },
    { 
      key: 'actions', 
      header: 'Actions', 
      align: 'center', 
      render: (r) => renderPushAction(r, (row) => {
        setEditingVoucherType(row);
        setShowVoucherTypeModal(true);
      }, "Edit Voucher Type")
    },
  ];

  const tdsColumns = [
    { key: 'sr', header: 'Sr', width: '52px', align: 'center', render: (_r, i) => <span style={{ color: 'var(--app-muted)' }}>{i + 1}</span> },
    { key: 'tdsName', header: 'TDS Name / Nature', sortable: true, render: (r) => (
      <div className="flex flex-col gap-0.5">
        <span className="font-bold text-[var(--app-heading)]">{safeStr(r.tdsName || r.name)}</span>
        <span className="text-[10px] text-[var(--app-muted)] font-medium">{safeStr(r.statutorySectionMapping || `Sec ${r.sectionCode || r.section}`)}</span>
      </div>
    )},
    { key: 'sectionCode', header: 'Section', sortable: true, render: (r) => <Badge tone="accent">Sec {safeStr(r.sectionCode || r.section, '—')}</Badge> },
    { key: 'applicableRate', header: 'Rate (%)', align: 'center', render: (r) => <span className="font-mono font-bold text-[var(--app-accent)]">{safeStr(r.applicableRate ?? r.rate, 0)}%</span> },
    { key: 'thresholdLimit', header: 'Threshold Limit', align: 'center', render: (r) => <span className="font-mono font-semibold">₹{(parseFloat(r.thresholdLimit ?? r.threshold) || 0).toLocaleString('en-IN')}</span> },
    { key: 'deducteeTypes', header: 'Deductee Types', render: (r) => <span className="text-xs">{Array.isArray(r.deducteeTypes) ? r.deducteeTypes.join(', ') : safeStr(r.deducteeTypes, '—')}</span> },
    { key: 'source', header: 'Source', align: 'center', render: (r) => <Badge tone={r.isSystemPredefined ? 'info' : 'warning'}>{r.isSystemPredefined ? 'Statutory' : 'Custom Web Entry'}</Badge> },
    { key: 'status', header: 'Status', align: 'center', sortable: true, render: (r) => <Badge tone={safeStr(r.status) === 'INACTIVE' ? 'neutral' : 'success'}>{safeStr(r.status, 'ACTIVE')}</Badge> },
    { 
      key: 'actions', 
      header: 'Actions', 
      align: 'center', 
      render: (r) => renderPushAction(r, (row) => {
        setEditingTds(row);
        setShowCreateForm(true);
      }, "Edit TDS Master")
    },
  ];

  const tcsColumns = [
    { key: 'sr', header: 'Sr', width: '52px', align: 'center', render: (_r, i) => <span style={{ color: 'var(--app-muted)' }}>{i + 1}</span> },
    { key: 'tcsName', header: 'TCS Name / Nature', sortable: true, render: (r) => (
      <div className="flex flex-col gap-0.5">
        <span className="font-bold text-[var(--app-heading)]">{safeStr(r.tcsName || r.name)}</span>
        <span className="text-[10px] text-[var(--app-muted)] font-medium">{safeStr(r.statutorySectionMapping || `Sec ${r.sectionCode || r.section}`)}</span>
      </div>
    )},
    { key: 'sectionCode', header: 'Section', sortable: true, render: (r) => <Badge tone="accent">Sec {safeStr(r.sectionCode || r.section, '—')}</Badge> },
    { key: 'applicableRate', header: 'Rate (%)', align: 'center', render: (r) => <span className="font-mono font-bold text-[var(--app-accent)]">{safeStr(r.applicableRate ?? r.rate, 0)}%</span> },
    { key: 'thresholdLimit', header: 'Threshold Limit', align: 'center', render: (r) => <span className="font-mono font-semibold">₹{(parseFloat(r.thresholdLimit ?? r.threshold) || 0).toLocaleString('en-IN')}</span> },
    { key: 'buyerTypes', header: 'Buyer Types', render: (r) => <span className="text-xs">{Array.isArray(r.buyerTypes) ? r.buyerTypes.join(', ') : safeStr(r.buyerTypes, '—')}</span> },
    { key: 'source', header: 'Source', align: 'center', render: (r) => <Badge tone={r.isSystemPredefined ? 'info' : 'warning'}>{r.isSystemPredefined ? 'Statutory' : 'Custom Web Entry'}</Badge> },
    { key: 'status', header: 'Status', align: 'center', sortable: true, render: (r) => <Badge tone={safeStr(r.status) === 'INACTIVE' ? 'neutral' : 'success'}>{safeStr(r.status, 'ACTIVE')}</Badge> },
    { 
      key: 'actions', 
      header: 'Actions', 
      align: 'center', 
      render: (r) => renderPushAction(r, (row) => {
        setEditingTcs(row);
        setShowCreateForm(true);
      }, "Edit TCS Master")
    },
  ];

  // Active Columns Selection
  const currentColumns = isTds
    ? tdsColumns
    : isTcs
      ? tcsColumns
      : isVoucherType
        ? voucherTypeColumns
        : isBom
          ? bomColumns
          : isStockCategory
            ? stockCategoryColumns
            : isUnit
              ? unitColumns
              : isGodown
                ? godownColumns
                : isCostCenter 
                  ? (costCenterSubTab === 'cost_categories' ? costCategoryColumns : (costCenterSubTab === 'cost_centre_classes' ? costCentreClassColumns : costCenterColumns))
                  : isStockGroup 
                    ? stockGroupColumns 
                    : isLedgerGroup 
                      ? ledgerGroupColumns 
                      : isStock 
                        ? stockColumns 
                        : ledgerColumns;


  if (showVoucherTypeModal) {
    return (
      <VoucherTypeMasterForm
        onClose={() => {
          setShowVoucherTypeModal(false);
          setEditingVoucherType(null);
        }}
        initialData={editingVoucherType}
        voucherTypesList={voucherTypesList}
        onSaveSuccess={fetchMasterData}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2.5 h-full animate-in fade-in duration-500 overflow-hidden p-1 text-[13px] text-[var(--app-text)]">
      
      {/* Tally-Style Grouped Master Category Navigation Bar */}
      <div className="flex flex-col gap-2 shrink-0">
        
        {/* Row 1: Master Category Groups */}
        <div className="flex items-center justify-between border-b border-[var(--app-border)] bg-[var(--app-panel-bg)] px-4 py-2 rounded-xl shadow-2xs">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mr-1 shrink-0">
              Masters Group:
            </span>
            {MASTER_GROUPS.map(group => {
              const IconComp = group.icon;
              const isGroupActive = group.tabs.some(t => 
                activeTab === t.id || 
                (t.id === 'Party Ledger' && (activeTab === 'Ledger Master' || activeTab === 'Party Ledger')) || 
                (t.id === 'Item Master' && (activeTab === 'Stock Ledger' || activeTab === 'Item Master'))
              );

              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => {
                    const firstTab = group.tabs[0].id;
                    setActiveTab(firstTab);
                    setShowCreateForm(false);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    isGroupActive
                      ? 'bg-[var(--app-accent)] text-white shadow-xs'
                      : 'bg-[var(--app-control-bg)] hover:bg-[var(--app-control-hover)] text-[var(--app-muted)] hover:text-[var(--app-heading)] border border-[var(--app-border)]'
                  }`}
                >
                  <IconComp size={13} />
                  <span>{group.label}</span>
                </button>
              );
            })}
          </div>

          {/* Right Side Actions: Refresh + Add Button */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                fetchMasterData(true);
                toast.info('Refreshed master lists');
              }}
              className="h-8 px-2.5 rounded-lg border border-[var(--app-border)] hover:bg-[var(--app-control-hover)] text-[var(--app-muted)] hover:text-[var(--app-heading)] text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Refresh Master Data"
            >
              <RefreshCw size={13} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (isVoucherType) {
                  setEditingVoucherType(null);
                  setShowVoucherTypeModal(true);
                  return;
                }
                if (isTds) setEditingTds(null);
                if (isTcs) setEditingTcs(null);
                if (isCostCenter) {
                  if (costCenterSubTab === 'cost_categories') setEditingCostCategory(null);
                  else if (costCenterSubTab === 'cost_centre_classes') setEditingCostCentreClass(null);
                  else setEditingCostCenter(null);
                }
                setShowCreateForm(p => !p);
              }}
              className="h-8 px-3.5 bg-[var(--app-accent)] hover:opacity-90 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition-all shadow-xs shrink-0"
            >
              {showCreateForm ? <X size={13} /> : <Plus size={13} />}
              <span>
                {showCreateForm 
                  ? 'Close Form' 
                  : isTds
                    ? 'Add TDS Master'
                    : isTcs
                      ? 'Add TCS Master'
                      : isVoucherType
                        ? 'Add Voucher Type'
                        : isBom
                          ? 'Add BOM'
                          : isStockCategory
                            ? 'Add Stock Category'
                            : isUnit
                              ? 'Add Unit'
                              : isGodown
                                ? 'Add Godown'
                                : isCostCenter 
                                  ? (costCenterSubTab === 'cost_categories' ? 'Add Cost Category' : (costCenterSubTab === 'cost_centre_classes' ? 'Add Cost Centre Class' : 'Add Cost Centre'))
                                  : isStockGroup 
                                    ? 'Add Stock Group' 
                                    : isStock 
                                      ? 'Add Stock Item' 
                                      : isLedgerGroup 
                                        ? 'Add Ledger Group' 
                                        : 'Add Ledger'
                }
              </span>
            </button>
          </div>
        </div>

        {/* Row 2: Sub-Tabs of Active Category Group */}
        <div className="flex items-center gap-4 border-b border-[var(--app-border)] bg-[var(--app-panel-bg)] px-4 py-1.5 rounded-xl shadow-2xs overflow-x-auto no-scrollbar">
          {(() => {
            const activeGroup = MASTER_GROUPS.find(g => 
              g.tabs.some(t => 
                activeTab === t.id || 
                (t.id === 'Party Ledger' && (activeTab === 'Ledger Master' || activeTab === 'Party Ledger')) || 
                (t.id === 'Item Master' && (activeTab === 'Stock Ledger' || activeTab === 'Item Master'))
              )
            ) || MASTER_GROUPS[0];

            return activeGroup.tabs.map(tab => {
              const isActive = activeTab === tab.id || (tab.id === 'Party Ledger' && (activeTab === 'Ledger Master' || activeTab === 'Party Ledger')) || (tab.id === 'Item Master' && (activeTab === 'Stock Ledger' || activeTab === 'Item Master'));
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    setShowCreateForm(false);
                  }}
                  className={`relative py-1 text-xs transition-all cursor-pointer whitespace-nowrap ${
                    isActive 
                      ? 'text-[var(--app-accent)] font-extrabold' 
                      : 'text-[var(--app-muted)] hover:text-[var(--app-heading)] font-semibold'
                  }`}
                >
                  <span>{tab.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="activeMasterTabUnderline"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--app-accent)] rounded-full"
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    />
                  )}
                </button>
              );
            });
          })()}
        </div>

      </div>

      {/* Sub-Tab Navigation inside Cost Centre Module */}
      {isCostCenter && (
        <div className="flex items-center gap-2 border-b border-[var(--app-border)] bg-[var(--app-panel-bg)] px-4 py-2 shrink-0 rounded-xl shadow-2xs">
          <button
            type="button"
            onClick={() => {
              setCostCenterSubTab('cost_centres');
              setShowCreateForm(false);
            }}
            className={`px-3.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              costCenterSubTab === 'cost_centres'
                ? 'bg-[var(--app-accent)] text-white shadow-xs'
                : 'hover:bg-[var(--app-control-hover)] text-[var(--app-muted)] font-semibold'
            }`}
          >
            Cost Centres
          </button>

          <button
            type="button"
            onClick={() => {
              setCostCenterSubTab('cost_categories');
              setShowCreateForm(false);
              apiClient.get('/masters/cost-categories', { headers: getCompanyHeaders() }).then(res => {
                const raw = res.data?.data || res.data || [];
                setCostCategoriesList(mapCostCategoriesData(raw, costCentersList));
              }).catch(() => {
                setCostCategoriesList(mapCostCategoriesData([], costCentersList));
              });
            }}
            className={`px-3.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              costCenterSubTab === 'cost_categories'
                ? 'bg-[var(--app-accent)] text-white shadow-xs'
                : 'hover:bg-[var(--app-control-hover)] text-[var(--app-muted)] font-semibold'
            }`}
          >
            Cost Categories
          </button>

          <button
            type="button"
            onClick={() => {
              setCostCenterSubTab('cost_centre_classes');
              setShowCreateForm(false);
              apiClient.get('/masters/cost-centre-classes', { headers: getCompanyHeaders() }).then(res => {
                setCostCentreClassesList(res.data?.data || []);
              });
            }}
            className={`px-3.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              costCenterSubTab === 'cost_centre_classes'
                ? 'bg-[var(--app-accent)] text-white shadow-xs'
                : 'hover:bg-[var(--app-control-hover)] text-[var(--app-muted)] font-semibold'
            }`}
          >
            Cost Centre Classes
          </button>
        </div>
      )}

      {showCreateForm && isStock ? (
        <div className="flex-1 min-h-0 py-1">
          <StockItemMasterForm
            initialData={editingStockItem}
            isEdit={!!editingStockItem}
            stockGroupsList={stockGroupsList}
            stockCategoriesList={stockCategoriesList}
            unitsList={unitsList}
            godownList={godownsList}
            onSave={handleSaveStockItem}
            onClose={() => {
              setShowCreateForm(false);
              setEditingStockItem(null);
            }}
          />
        </div>
      ) : !isDetailView ? (
        <>
          {/* Two Sub-Tabs Bar: Existing/Synced Data vs Web Form Entries (*_entry) */}
          <div className="flex flex-wrap items-center justify-between bg-[var(--app-panel-bg)] border border-[var(--app-border)] rounded-xl p-1.5 shrink-0 gap-2 shadow-2xs">
            <div className="flex items-center gap-1.5 bg-[var(--app-content-bg)] p-1 rounded-lg border border-[var(--app-border)]">
              <button
                type="button"
                onClick={() => setMasterSourceTab('synced')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  masterSourceTab === 'synced'
                    ? 'bg-[var(--app-accent)] text-white shadow-xs'
                    : 'text-[var(--app-muted)] hover:bg-[var(--app-control-hover)] hover:text-[var(--app-heading)]'
                }`}
              >
                <Database size={13} />
                <span>Existing Data (Database)</span>
                <span className={`px-2 py-0.5 text-[10px] rounded-full font-bold ${
                  masterSourceTab === 'synced' ? 'bg-white/20 text-white' : 'bg-[var(--app-control-hover)] text-[var(--app-muted)]'
                }`}>
                  {syncedCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setMasterSourceTab('web_entry')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  masterSourceTab === 'web_entry'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-[var(--app-muted)] hover:bg-[var(--app-control-hover)] hover:text-[var(--app-heading)]'
                }`}
              >
                <FileText size={13} />
                <span>Web Form Entries (*_entry)</span>
                <span className={`px-2 py-0.5 text-[10px] rounded-full font-bold ${
                  masterSourceTab === 'web_entry' ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                }`}>
                  {webEntryCount}
                </span>
              </button>
            </div>

            {/* Header Bulk Push Action */}
            {masterSourceTab === 'web_entry' && webEntryCount > 0 && (
              <button
                type="button"
                onClick={handlePushAllToTally}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              >
                <CloudUpload size={14} />
                <span>Push All Web Entries to Tally</span>
              </button>
            )}
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 shrink-0">
            {activeStats.map((s, i) => (
              <StatCard key={s.label} index={i} label={s.label} value={s.value} icon={s.icon} />
            ))}
          </div>

          {/* Master table */}
          <div className="flex-1 min-h-0">
            <DataTable
              minWidth={isStockCategory || isGodown || isCostCenter || isLedgerGroup || isStockGroup ? '900px' : isStock ? '1000px' : '1400px'}
              data={displayRows}
              rowKey={(r) => r.sr || r.godownName || r.stockCategoryName || r.groupName || r.costCenterName}
              loading={loading}
              selectable={activeTab === 'Party Ledger'}
              selectedKeys={selectedLedgerKeys}
              onToggleRow={(key) => setSelectedLedgerKeys(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])}
              onToggleAll={(checked) => setSelectedLedgerKeys(checked ? displayRows.map(r => r.sr || r.godownName || r.stockCategoryName || r.groupName || r.costCenterName) : [])}
              actions={
                activeTab === 'Party Ledger' && selectedLedgerKeys.length > 0 && (
                  <button
                    type="button"
                    onClick={handleBulkGenerateLedgerXml}
                    className="px-3 py-1.5 bg-[var(--app-accent)] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                  >
                    <FileText size={14} />
                    <span>Export {selectedLedgerKeys.length} Selected (Tally XML)</span>
                  </button>
                )
              }
              emptyText={
                isGodown
                  ? 'No godowns found.'
                  : isStockCategory
                    ? 'No stock categories found.'
                    : isCostCenter 
                      ? (costCenterSubTab === 'cost_categories' ? 'No cost categories found.' : (costCenterSubTab === 'cost_centre_classes' ? 'No cost centre classes found.' : 'No cost centers found.')) 
                      : isStockGroup 
                        ? 'No stock groups found.' 
                        : isLedgerGroup 
                          ? 'No ledger groups found.' 
                          : isStock 
                            ? 'No stock items found.' 
                            : 'No party ledgers found.'
              }
              columns={currentColumns}
              search={{ 
                value: searchQuery, 
                onChange: setSearchQuery, 
                placeholder: isGodown
                  ? 'Search godowns by name, alias or location type…'
                  : isStockCategory
                    ? 'Search stock categories by name, code or parent…'
                    : isCostCenter 
                      ? 'Search cost centers by name, code or category…' 
                      : isStockGroup 
                        ? 'Search stock groups…' 
                        : isLedgerGroup 
                          ? 'Search ledger groups…' 
                          : isStock 
                            ? 'Search stock items…' 
                            : 'Search party ledgers…' 
              }}
              onRowClick={(row) => (!isGodown && !isStockCategory && !isCostCenter && !isLedgerGroup && !isStockGroup) && handleRowClick(row)}
              filters={

                <div className="flex items-center gap-2.5 flex-wrap">
                  {/* Financial Year Indicator Badge */}
                  <span className="px-2 py-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] text-[var(--app-accent)] font-extrabold text-[11px] flex items-center gap-1 shrink-0 shadow-2xs">
                    <Calendar size={12} />
                    <span>{localStorage.getItem('selectedFy') || 'FY 2024-25'}</span>
                  </span>

                  {/* Top Page Size Selector */}
                  <div className="flex items-center gap-1 text-[11px] text-[var(--app-muted)] font-semibold shrink-0">
                    <span>Show:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                        setPageSize(val);
                        setCurrentPage(1);
                      }}
                      className="h-7 px-1.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] text-[var(--app-heading)] font-bold outline-none cursor-pointer hover:border-[var(--app-accent)] text-[11px]"
                    >
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={200}>200</option>
                      <option value={500}>500</option>
                      <option value={1000}>1000</option>
                      <option value="all">All (5k)</option>
                    </select>
                  </div>

                  {/* Top Page Navigation Controls for Master Data Tabs */}
                  {calculatedTotalPages >= 1 && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={safeCurrentPage <= 1 || loading}
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        className="h-7 px-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] hover:bg-[var(--app-control-hover)] text-[var(--app-heading)] font-bold text-xs disabled:opacity-40 cursor-pointer"
                        title="Previous Page"
                      >
                        &lsaquo; Prev
                      </button>

                      <span className="px-2 py-1 bg-[var(--app-accent-soft)] text-[var(--app-accent)] rounded-lg font-black text-xs">
                        {safeCurrentPage} / {calculatedTotalPages}
                      </span>

                      <button
                        type="button"
                        disabled={safeCurrentPage >= calculatedTotalPages || loading}
                        onClick={() => setCurrentPage(p => Math.min(calculatedTotalPages, p + 1))}
                        className="h-7 px-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] hover:bg-[var(--app-control-hover)] text-[var(--app-heading)] font-bold text-xs disabled:opacity-40 cursor-pointer"
                        title="Next Page"
                      >
                        Next &rsaquo;
                      </button>
                    </div>
                  )}

                  {/* Unsynced Only Checkbox Filter */}
                  {(!isStockCategory && !isCostCenter && !isLedgerGroup && !isStockGroup) && (
                    <label className="flex items-center gap-1 cursor-pointer select-none px-1 shrink-0">
                      <input type="checkbox" checked={onlyUnsynced} onChange={(e) => setOnlyUnsynced(e.target.checked)} className="w-3.5 h-3.5 rounded accent-[var(--app-accent)] cursor-pointer" />
                      <span className="text-[11px] font-semibold" style={{ color: 'var(--app-muted)' }}>Unsynced</span>
                    </label>
                  )}

                  {/* Refresh Button */}
                  <button type="button" title="Refresh List" aria-label="Refresh List" onClick={() => { setSearchQuery(''); setOnlyUnsynced(false); fetchMasterData(true); toast.info('Lists refreshed'); }} className="h-7 w-7 flex items-center justify-center border rounded-lg text-[var(--app-muted)] border-[var(--app-border)] hover:bg-[var(--app-control-hover)] transition-colors shrink-0">
                    <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
                  </button>
                </div>
              }
            />
          
          </div>
        </>
      ) : (
        <div className="flex-1 min-h-0">
          <MasterDetailsView
            isStock={isStock}
            row={currentTabObj.row}
            onClose={(e) => handleCloseTab(e, currentTabObj.id)}
          />
        </div>
      )}

      {/* Create modals */}
      <div className="contents">
        {/* Stock Item Form renders full page inside main container above */}

        {/* XML Preview Modal */}
        {showXmlPreviewModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-3xl rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] shadow-2xl p-5 space-y-4 flex flex-col max-h-[85vh]"
            >
              <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-3 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-[var(--app-accent-soft)] text-[var(--app-accent)]">
                    <FileText size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-[var(--app-heading)]">Tally XML Preview</h3>
                    <p className="text-[10px] text-[var(--app-muted)]">Manual Import Template: {previewXmlFileName}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowXmlPreviewModal(false)}
                  className="p-1 text-[var(--app-muted)] hover:text-[var(--app-heading)] rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-hidden flex flex-col border border-[var(--app-border)] rounded-xl bg-slate-900 text-slate-100 p-3 font-mono text-[11px] relative">
                <div className="flex justify-between items-center bg-slate-800 text-slate-400 px-3 py-1 rounded-t-lg -mx-3 -mt-3 border-b border-slate-700 shrink-0 text-[10px] uppercase font-bold tracking-wider">
                  <span>XML Content</span>
                  <span className="text-[9px] lowercase opacity-60">tally import structure</span>
                </div>
                <pre className="flex-1 overflow-auto mt-2 p-1 whitespace-pre-wrap select-all selection:bg-indigo-500 selection:text-white no-scrollbar">
                  {previewXmlContent}
                </pre>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[var(--app-border)] shrink-0">
                <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                  <Info size={12} />
                  <span>Use Tally import feature (Import Data &gt; Masters) for this XML file.</span>
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCopyXml}
                    className="h-8.5 px-3.5 rounded-lg border border-[var(--app-border)] text-xs font-bold text-[var(--app-heading)] hover:bg-[var(--app-control-hover)] transition-all cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <ClipboardList size={13} />
                    <span>Copy XML</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadXml}
                    className="h-8.5 px-4 bg-[var(--app-accent)] hover:opacity-90 text-white font-extrabold text-xs rounded-lg transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <CloudUpload size={13} />
                    <span>Download XML</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
};

/* --- Master Details View --- */

const MasterDetailsView = ({ isStock, row, onClose }) => {
  const [activeSubTab, setActiveSubTab] = useState('profile');
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isStock || !row?.ledger) return;
    setLoading(true);
    fundflowApi.getPartyDetails(row.ledger)
      .then(res => {
        if (res.success && res.data) setDetails(res.data);
        else setDetails(null);
      })
      .catch(() => setDetails(null))
      .finally(() => setLoading(false));
  }, [row?.ledger, isStock]);

  const SectionHead = ({ title }) => (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-[10px] font-black uppercase tracking-[0.12em]" style={{ color: 'var(--app-accent)' }}>{title}</span>
      <div className="flex-1 h-px" style={{ backgroundColor: 'var(--app-border)' }} />
    </div>
  );

  const Field = ({ label, value, mono }) => (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9.5px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted)' }}>{label}</span>
      <span className={`text-[12.5px] font-bold leading-tight ${mono ? 'font-mono' : ''}`} style={{ color: 'var(--app-heading)' }}>{value || '—'}</span>
    </div>
  );

  const fmtBalance = (bal) => {
    if (bal === undefined || bal === null) return '₹ 0.00 Dr';
    const isCr = bal < 0;
    const abs = Math.abs(bal);
    return `₹ ${abs.toLocaleString('en-IN', { minimumFractionDigits: 2 })} ${isCr ? 'Cr' : 'Dr'}`;
  };

  const syncTone = row.isSynced ? 'success' : 'warning';
  const syncLabel = row.isSynced ? 'Synced' : 'Pending';

  // Calculate Voucher stats if available
  const pendingBillsList = details?.pendingBills || [];
  const totalVouchersCount = pendingBillsList.length;
  const totalBillVal = pendingBillsList.reduce((sum, b) => sum + (parseFloat(b.billAmount) || 0), 0);
  const totalPaidVal = pendingBillsList.reduce((sum, b) => sum + (parseFloat(b.paidAmount) || 0), 0);
  const totalPendingVal = pendingBillsList.reduce((sum, b) => sum + (parseFloat(b.pendingAmount) || 0), 0);

  const pendingBillsColumns = [
    { key: 'date', header: 'Date', render: (b) => <span className="font-semibold" style={{ color: 'var(--app-muted)' }}>{b.date || '—'}</span> },
    { key: 'billNo', header: 'Voucher / Bill No', render: (b) => <span className="font-bold" style={{ color: 'var(--app-heading)' }}>{b.billNo || '—'}</span> },
    { key: 'source', header: 'Source / Type', render: (b) => <Badge tone="neutral">{b.source ? b.source.replace(/_/g, ' ') : 'Voucher'}</Badge> },
    { key: 'billAmount', header: 'Bill Value', align: 'right', render: (b) => <span className="font-bold">₹ {b.billAmount ? b.billAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}</span> },
    { key: 'paidAmount', header: 'Paid Amount', align: 'right', render: (b) => <span className="font-semibold" style={{ color: 'var(--app-muted)' }}>₹ {b.paidAmount ? b.paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}</span> },
    { key: 'pendingAmount', header: 'Outstanding Amount', align: 'right', render: (b) => <span className="font-bold text-red-500">₹ {b.pendingAmount ? b.pendingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}</span> },
    { key: 'dueDate', header: 'Due Date', render: (b) => <span className="font-semibold" style={{ color: 'var(--app-muted)' }}>{b.dueDate || '—'}</span> },
  ];

  return (
    <div className="h-full flex flex-col rounded-xl border bg-[var(--app-panel-bg)] border-[var(--app-border)] shadow-sm animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between shrink-0 bg-[var(--app-content-bg)]/40" style={{ borderColor: 'var(--app-border)' }}>
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="px-2.5 py-1.5 border rounded-lg text-[11px] font-bold uppercase tracking-wider hover:bg-[var(--app-control-hover)] transition-colors"
            style={{ borderColor: 'var(--app-border)', color: 'var(--app-muted)' }}
          >
            ← Back
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-extrabold text-[var(--app-heading)] tracking-tight">
                {isStock ? row.name : row.ledger}
              </h2>
              <Badge tone={syncTone}>{syncLabel}</Badge>
            </div>
            <p className="text-[10px] text-[var(--app-muted)] mt-0.5">
              {isStock ? `Stock Item Group: ${row.group}` : `Ledger Group: ${row.parentGroup}`}
            </p>
          </div>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex items-center gap-4 px-4 py-2 border-b shrink-0 bg-[var(--app-panel-bg)]" style={{ borderColor: 'var(--app-border)' }}>
        <button
          onClick={() => setActiveSubTab('profile')}
          className={`pb-1 text-[12px] font-extrabold tracking-tight border-b-2 transition-all ${
            activeSubTab === 'profile' ? 'border-[var(--app-accent)] text-[var(--app-accent)]' : 'border-transparent text-[var(--app-muted)]'
          }`}
        >
          {isStock ? 'Item Overview' : 'Profile & Settings'}
        </button>
        <button
          onClick={() => setActiveSubTab('vouchers')}
          className={`pb-1 text-[12px] font-extrabold tracking-tight border-b-2 transition-all ${
            activeSubTab === 'vouchers' ? 'border-[var(--app-accent)] text-[var(--app-accent)]' : 'border-transparent text-[var(--app-muted)]'
          }`}
        >
          {isStock ? 'Inventory & Pricing' : 'Transactions & Vouchers'}
        </button>
      </div>

      {/* Scrollable details container */}
      <div className="flex-1 overflow-y-auto p-5 no-scrollbar">

        {loading ? (
          <div className="h-full flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-[var(--app-accent)] border-t-transparent animate-spin" />
              <span className="text-[11px] font-semibold" style={{ color: 'var(--app-muted)' }}>Fetching live database logs…</span>
            </div>
          </div>
        ) : (
          <>
            {activeSubTab === 'profile' && !isStock && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                
                {/* Left Column */}
                <div className="space-y-5">
                  <div>
                    <SectionHead title="Basic Information" />
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Ledger Name" value={row.ledger} />
                      <Field label="Parent Group" value={row.parentGroup} />
                      <Field label="Sub Group" value={row.subGroup} />
                      <Field label="Registration Type" value={row.type} />
                    </div>
                  </div>

                  <div>
                    <SectionHead title="Tax Information" />
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="GSTIN" value={row.gst} mono />
                      <Field label="Place of Supply" value={row.pos} />
                    </div>
                  </div>

                  <div>
                    <SectionHead title="Mailing & Address" />
                    <div className="space-y-3">
                      <Field label="Mailing Name" value={row.name} />
                      {(row.add1 && row.add1 !== '—') && (
                        <Field label="Address" value={`${row.add1} ${row.add2 && row.add2 !== '—' ? row.add2 : ''}`} />
                      )}
                      {(row.city && row.city !== '—') && <Field label="City" value={row.city} />}
                      {(row.emailAddress || row.email) && (
                        <Field label="Email" value={row.emailAddress || row.email} />
                      )}
                      {(row.mobileNumber || row.phone) && (
                        <Field label="Mobile Number" value={row.mobileNumber || row.phone} />
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-5">
                  <div>
                    <SectionHead title="Tally Accounting Profile" />
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Opening Balance" value={fmtBalance(row.openingBalance || details?.openingBalance)} />
                      <Field label="Current Outstanding" value={fmtBalance(details?.outstandingBalance ?? 0)} />
                      <Field label="Maintain Bill-wise" value={row.maintainBillWise ? 'Yes' : 'No'} />
                      {row.creditPeriod && <Field label="Credit Period" value={`${row.creditPeriod} days`} />}
                      {row.creditLimit && <Field label="Credit Limit" value={`₹ ${parseFloat(row.creditLimit).toLocaleString('en-IN')}`} />}
                    </div>
                  </div>

                  {(row.bankName || row.accountNumber || details?.bankName || details?.accountNumber) && (
                    <div>
                      <SectionHead title="Linked Bank Account" />
                      <div className="grid grid-cols-2 gap-4">
                        <Field label="Bank Name" value={row.bankName || details?.bankName} />
                        <Field label="Account Number" value={row.accountNumber || details?.accountNumber} mono />
                        {(row.ifscCode || details?.ifscCode) && (
                          <Field label="IFSC Code" value={row.ifscCode || details?.ifscCode} mono />
                        )}
                        {(row.branch || details?.branch) && (
                          <Field label="Branch" value={row.branch || details?.branch} />
                        )}
                      </div>
                    </div>
                  )}
                </div>

              </div>
            )}

            {activeSubTab === 'vouchers' && !isStock && (
              <div className="space-y-5">
                
                {/* Transaction Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 shrink-0">
                  <StatCard label="Pending Vouchers" value={totalVouchersCount} icon={ClipboardList} index={0} />
                  <StatCard label="Total Bill Value" value={`₹ ${totalBillVal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} icon={IndianRupee} index={1} />
                  <StatCard label="Total Paid Amount" value={`₹ ${totalPaidVal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} icon={CheckCircle2} index={2} />
                  <StatCard label="Outstanding Amount" value={`₹ ${totalPendingVal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} icon={AlertTriangle} index={3} />
                </div>

                {/* Vouchers Table */}
                <div className="border rounded-xl overflow-hidden" style={{ borderColor: 'var(--app-border)' }}>
                  <DataTable
                    columns={pendingBillsColumns}
                    data={pendingBillsList}
                    loading={false}
                    emptyText="No pending vouchers or transaction logs found for this ledger in the active financial year."
                    minWidth="800px"
                  />
                </div>
              </div>
            )}

            {activeSubTab === 'profile' && isStock && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {/* Left Column */}
                <div>
                  <SectionHead title="Basic Specifications" />
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Item Name" value={row.name} />
                    <Field label="Stock Group" value={row.group} />
                    {row.brand && <Field label="Brand" value={row.brand} />}
                    <Field label="Unit of Measure" value={row.uom} />
                  </div>
                </div>

                {/* Right Column */}
                <div>
                  <SectionHead title="Tax Classification" />
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="HSN / SAC Code" value={row.hsn} mono />
                    <Field label="GST Rate" value={row.gstRate} />
                    {row.taxabilityType && <Field label="Taxability Type" value={row.taxabilityType} />}
                  </div>
                </div>
              </div>
            )}

            {activeSubTab === 'vouchers' && isStock && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {/* Left Column */}
                <div>
                  <SectionHead title="Stock Inventory Profile" />
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Opening Quantity" value={row.qty ? `${row.qty} ${row.uom}` : `0 ${row.uom}`} />
                    <Field label="Purchase Cost / Rate" value={row.rate ? `₹ ${row.rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'} mono />
                    <Field label="Opening Stock Value" value={row.value ? `₹ ${row.value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'} mono />
                    {row.sku && <Field label="SKU / Barcode" value={row.sku} mono />}
                  </div>
                </div>

                {/* Right Column */}
                <div>
                  <SectionHead title="Pricing & Description" />
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      {row.salesPrice && (
                        <Field label="Standard Sales Price" value={`₹ ${row.salesPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} mono />
                      )}
                      {row.mrp && (
                        <Field label="Maximum Retail Price (MRP)" value={`₹ ${row.mrp.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} mono />
                      )}
                    </div>
                    {row.description && <Field label="Item Description" value={row.description} />}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

      </div>

    </div>
  );
};

export default MasterDataPanel;

