import React, { useState, useEffect, useMemo } from 'react';
import { Search, RefreshCw, Plus, X, BookOpen, Package, User, Users, Percent, IndianRupee, Info, AlertTriangle, CheckCircle2, Coins, ShieldCheck, FileSpreadsheet, ClipboardList, Settings, Landmark, Edit3, FolderTree, Layers, Tag, Send, CloudUpload, Database, FileText, ArrowUpRight, Trash2, Box } from 'lucide-react';

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
import LedgerGroupMasterForm from './LedgerGroupMasterForm';
import StockCategoryMasterForm from './StockCategoryMasterForm';
import StockGroupMasterForm from './StockGroupMasterForm';
import StockItemMasterForm from './StockItemMasterForm';
import UnitMasterForm from './UnitMasterForm';
import BOMMasterForm from './BOMMasterForm';
import { useAppStore } from '../../stores/useAppStore';

const MasterDataPanel = ({ mode: propMode, isDark }) => {
  const selectedCompany = useAppStore(s => s.selectedCompany);
  const orgId = useAppStore(s => s.orgId);

  const getCompanyHeaders = () => {
    const activeComp = selectedCompany || localStorage.getItem('selectedCompanyId') || localStorage.getItem('activeCompany') || '';
    const activeOrg = orgId || localStorage.getItem('orgId') || '';
    const headers = {};
    if (activeComp) {
      headers['x-company-id'] = activeComp;
      headers['x-company'] = activeComp;
    }
    if (activeOrg) {
      headers['x-organization-id'] = activeOrg;
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
    { id: 'Cost Center', label: 'Cost Center', fullTitle: 'Cost Center Master' },
    { id: 'BOM Master', label: 'Bill of Materials (BOM)', fullTitle: 'BOM Master' },
  ];


  const isLedgerGroup = activeTab === 'Ledger Group';
  const isStockGroup = activeTab === 'Stock Group';
  const isStockCategory = activeTab === 'Stock Category';
  const isUnit = activeTab === 'Unit Master' || activeTab === 'Unit';
  const isCostCenter = activeTab === 'Cost Center' || propMode === 'Cost Center';
  const isStock = activeTab === 'Stock Ledger' || activeTab === 'Item Master';
  const isBom = activeTab === 'BOM Master' || activeTab === 'BOM' || propMode === 'BOM Master' || propMode === 'BOM';


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
  const [costCategories, setCostCategories] = useState([]);
  const [editingCostCenter, setEditingCostCenter] = useState(null);
  const [bomsList, setBomsList] = useState([]);
  const [editingBom, setEditingBom] = useState(null);

  // Server-side Pagination & Total Counts State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(200);
  const [totalPages, setTotalPages] = useState(1);
  const [serverLedgerCounts, setServerLedgerCounts] = useState({ total: 0, web: 0, synced: 0 });



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
        isCostCenter ? 'costcenters_entry' :
        isStockGroup ? 'stockgroups_entry' :
        isLedgerGroup ? 'groups_entry' :
        isStock ? 'stockitems_entry' : 'ledgers_entry'
      );
      const masterName = row.bomName || row.ledgerName || row.itemName || row.unitName || row.groupName || row.costCenterName || row.name || row.ledger || 'Master Record';

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

  const fetchMasterData = async () => {
    setLoading(true);
    try {
      const headers = getCompanyHeaders();
      const params = { page: currentPage, limit: pageSize, search: searchQuery };
      const [ledgersRes, stockRes, masterDataRes] = await Promise.all([
        apiClient.get('/ledgers', { headers, params }).then(r => r.data).catch(() => ({ data: [] })),
        salesApi.getStockItems().catch(() => ({ data: [] })),
        salesApi.getMasterData().catch(() => null)
      ]);

      const masterData = masterDataRes?.data || masterDataRes || {};

      if (ledgersRes.total !== undefined) {
        setServerLedgerCounts({
          total: ledgersRes.total,
          web: ledgersRes.totalWeb,
          synced: ledgersRes.totalSynced
        });
        setTotalPages(ledgersRes.totalPages || 1);
      }

      // 1. Map Ledgers Collection (Both standard 'ledgers' and web 'ledgers_entry')
      const rawLedgers = Array.isArray(ledgersRes.data) ? ledgersRes.data : (ledgersRes.data?.ledgers || masterData.partyLedgers || []);
      const mappedLedgers = rawLedgers.map((l, index) => {
        const isString = typeof l === 'string';
        const nameStr = isString ? l : (l.ledgerName || l.name || '');
        return {
          ...(isString ? {} : l),
          sr: index + 1,
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

      // 2. Map Stock Items Collection
      const rawStock = masterData.stockItemsFull || (Array.isArray(stockRes.data) ? stockRes.data : (stockRes.data?.stockItems || []));
      const mappedStock = rawStock.map((s, index) => {
        const isString = typeof s === 'string';
        const nameStr = isString ? s : (s.itemName || s.name || '');
        return {
          ...(isString ? {} : s),
          sr: index + 1,
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

      // 3. Map Ledger Groups Collection Dynamically
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
      } else {
        // Derive dynamic groups from database ledgers
        const derivedGroupsMap = {};
        mappedLedgers.forEach(l => {
          if (l.parentGroup && !derivedGroupsMap[l.parentGroup]) {
            derivedGroupsMap[l.parentGroup] = {
              groupName: l.parentGroup,
              groupCode: `GRP00${Object.keys(derivedGroupsMap).length + 1}`,
              parentGroup: 'Primary',
              nature: l.parentGroup.includes('Debtor') || l.parentGroup.includes('Asset') ? 'ASSETS' : l.parentGroup.includes('Creditor') || l.parentGroup.includes('Liability') ? 'LIABILITIES' : 'EXPENSES',
              subType: 'PRIMARY',
              status: 'ACTIVE',
              isReserved: true,
              isWebEntry: false,
              sourceCollection: 'groups'
            };
          }
        });
        const derivedGroupsList = Object.values(derivedGroupsMap).map((g, i) => ({ sr: i + 1, ...g }));
        setLedgerGroupsList(derivedGroupsList);
      }

      // 4. Map Stock Groups Collection Dynamically
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
      } else {
        const derivedStockMap = {};
        mappedStock.forEach(s => {
          if (s.group && !derivedStockMap[s.group]) {
            derivedStockMap[s.group] = {
              groupName: s.group,
              parentGroup: 'Primary',
              hsnCode: s.hsn || '—',
              gstRate: s.gstRate || '18%',
              isWebEntry: false,
              sourceCollection: 'stockGroups'
            };
          }
        });
        const derivedStockList = Object.values(derivedStockMap).map((sg, i) => ({ sr: i + 1, ...sg }));
        setStockGroupsList(derivedStockList);
      }

      // 5. Map Cost Centers Collection Dynamically (Unconditional Update)
      const rawCostCenters = masterData.costCenters || [];
      setCostCentersList(rawCostCenters.map((cc, i) => ({
        ...cc,
        sr: i + 1,
        costCenterName: cc.costCenterName || cc.name || '',
        costCenterCode: cc.costCenterCode || `CC-000${i + 1}`,
        costCategoryId: cc.costCategoryName || cc.costCategoryId || cc.costCategory || 'Primary Cost Category',
        parentId: cc.parentName || cc.parentId || 'Primary / None',
        status: cc.status || 'ACTIVE',
        isWebEntry: !!cc.isWebEntry,
        sourceCollection: cc.sourceCollection || (cc.isWebEntry ? 'costcenters_entry' : 'costCenters')
      })));

      // 6. Map Cost Categories Dynamically (Unconditional Update)
      const rawCategories = masterData.costCategories || [];
      setCostCategories(rawCategories.length > 0 ? rawCategories : ['Primary Cost Category']);

      // 7. Map Stock Categories Collection Dynamically (Strict DB Collection Only)
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

      // 8. Map Units Collection Dynamically (or derive from Stock Item collection unit key if units collection is empty)
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
      } else {
        // Fallback: derive dynamic unique units from Stock Item collection unit keys
        const derivedUnitsMap = {};
        const allStockItems = [...mappedStock, ...(stockRes.data || []), ...(masterDataRes?.stockItems || [])];
        allStockItems.forEach(s => {
          const unitVal = typeof s.unit === 'object' 
            ? (s.unit?.baseUnit || s.unit?.unitName || s.unit?.name || '')
            : (s.unit || s.baseUnit || s.uom || s.unitName || '');

          if (unitVal && typeof unitVal === 'string' && unitVal.trim() && !derivedUnitsMap[unitVal.trim()]) {
            const uName = unitVal.trim();
            derivedUnitsMap[uName] = {
              unitName: uName,
              symbol: uName,
              unitCode: `UNIT-000${Object.keys(derivedUnitsMap).length + 1}`,
              conversion: { isBaseUnit: true, baseUnit: null, conversionFactor: 0, decimalPlaces: 0 },
              status: 'ACTIVE'
            };
          }
        });

        const derivedUnitsList = Object.values(derivedUnitsMap).map((u, i) => ({ sr: i + 1, ...u }));
        setUnitsList(derivedUnitsList);
      }

      // 9. Map BOMs Collection Dynamically
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
        sourceCollection: b.sourceCollection || (b.isWebEntry ? 'boms_entry' : 'boms')
      })));


    } catch (err) {
      console.error('Error fetching dynamic master data:', err);
      toast.error('Failed to load master data');
    } finally {
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
    fetchMasterData();
  }, [propMode]);

  useEffect(() => {
    setSelectedLedgerKeys([]);
  }, [activeTab, masterSourceTab, searchQuery]);

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

  // 1. Save Stock Item -> POST /masters/stock-items (saves to stockitems_entry)
  const handleSaveStockItem = async (savedItem) => {
    try {
      const res = await apiClient.post('/masters/stock-items', savedItem);
      if (res.data && res.data.success) {
        toast.success('Stock item saved to database successfully!');
        fetchMasterData();
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
        fetchMasterData();
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
        fetchMasterData();
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
        fetchMasterData();
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
        fetchMasterData();
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
        fetchMasterData();
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
        isCostCenter ? 'costcenters_entry' :
        isStockGroup ? 'stockgroups_entry' :
        isLedgerGroup ? 'groups_entry' :
        isStock ? 'stockitems_entry' : 'ledgers_entry'
      );
      const itemId = item._id || item.id || item.sr;
      const itemName = masterName || item.bomName || item.ledgerName || item.itemName || item.unitName || item.groupName || item.costCenterName || item.name || 'Master Record';

      const res = await apiClient.post('/masters/push-to-tally', {
        collectionName: targetCol,
        id: itemId,
        name: itemName
      }, {
        headers: activeCompanyId ? { 'x-company-id': activeCompanyId } : {}
      });

      if (res.data && res.data.success) {
        toast.success(`🎉 Master "${itemName}" pushed to Tally successfully!`);
        fetchMasterData();
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
    const itemName = item.bomName || item.ledgerName || item.itemName || item.unitName || item.groupName || item.costCenterName || item.name || item.ledger || 'Master Record';
    const collectionName = item.sourceCollection || (
      isBom ? 'boms_entry' :
      isStockCategory ? 'stockcategories_entry' :
      isUnit ? 'units_entry' :
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
        fetchMasterData();
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
    const list = isBom
      ? bomsList
      : isStockCategory
        ? stockCategoriesList
        : isCostCenter
          ? costCentersList
          : isUnit
            ? unitsList
            : isStockGroup
              ? stockGroupsList
              : isLedgerGroup
                ? ledgerGroupsList
                : isStock
                  ? stockDataList
                  : partyDataList;
    return list.filter(r => masterSourceTab === 'web_entry' ? !!r.isWebEntry : !r.isWebEntry);
  }, [masterSourceTab, isBom, bomsList, isStockCategory, stockCategoriesList, isCostCenter, costCentersList, isUnit, unitsList, isStockGroup, stockGroupsList, isLedgerGroup, ledgerGroupsList, isStock, stockDataList, partyDataList]);

  // Statistics Display Config (uses activeSourceList)
  const bomStats = useMemo(() => [
    { label: 'Total BOM Masters', value: activeSourceList.length, icon: Box },
    { label: 'Active Assemblies', value: activeSourceList.filter(b => (b.status || 'ACTIVE').toUpperCase() !== 'INACTIVE').length, icon: CheckCircle2 },
    { label: 'Finished Stock Items', value: activeSourceList.filter(b => b.finishedItemName).length, icon: Package },
    { label: 'Total Components', value: activeSourceList.reduce((acc, b) => acc + (b.componentsCount || (b.items ? b.items.length : 0)), 0), icon: Layers },
  ], [activeSourceList]);

  const ledgerStats = useMemo(() => [
    { label: 'Total Ledgers', value: (serverLedgerCounts.total || activeSourceList.length).toLocaleString('en-IN'), icon: Users },
    { label: 'Sundry Debtors', value: activeSourceList.filter(p => p.parentGroup === 'Sundry Debtors').length, icon: User },
    { label: 'Sundry Creditors', value: activeSourceList.filter(p => p.parentGroup === 'Sundry Creditors').length, icon: BookOpen },
    { label: 'Unsynced', value: activeSourceList.filter(p => !p.isSynced).length, icon: AlertTriangle },
  ], [activeSourceList, serverLedgerCounts.total]);

  const ledgerGroupStats = useMemo(() => [
    { label: 'Total Ledger Groups', value: activeSourceList.length, icon: Layers },
    { label: 'Primary Groups', value: activeSourceList.filter(g => !g.parentGroup || g.parentGroup === 'Primary' || g.parentGroup === 'Primary / Root Group').length, icon: BookOpen },
    { label: 'Sub Groups', value: activeSourceList.filter(g => g.parentGroup && g.parentGroup !== 'Primary' && g.parentGroup !== 'Primary / Root Group').length, icon: Users },
    { label: 'Active Groups', value: activeSourceList.filter(g => (g.status || 'ACTIVE').toUpperCase() !== 'INACTIVE').length, icon: CheckCircle2 },
  ], [activeSourceList]);

  const stockStats = useMemo(() => [
    { label: 'Total Items', value: activeSourceList.length, icon: Package },
    { label: 'Active Items', value: activeSourceList.filter(s => s.qty > 0 || (s.status || 'ACTIVE').toUpperCase() === 'ACTIVE').length, icon: CheckCircle2 },
    { label: 'Out of Stock', value: activeSourceList.filter(s => (s.qty || 0) === 0).length, icon: AlertTriangle },
    { label: 'Stock Value', value: `₹${activeSourceList.reduce((acc, s) => acc + (s.value || 0), 0).toLocaleString('en-IN')}`, icon: Coins },
  ], [activeSourceList]);

  const stockGroupStats = useMemo(() => [
    { label: 'Total Stock Groups', value: activeSourceList.length, icon: Layers },
    { label: 'Primary Groups', value: activeSourceList.filter(g => !g.parentGroup || g.parentGroup === 'Primary' || g.parentGroup === 'Primary / Root Group').length, icon: Package },
    { label: 'Sub Groups', value: activeSourceList.filter(g => g.parentGroup && g.parentGroup !== 'Primary' && g.parentGroup !== 'Primary / Root Group').length, icon: FolderTree },
    { label: 'Active Groups', value: activeSourceList.filter(g => (g.status || 'ACTIVE').toUpperCase() !== 'INACTIVE').length, icon: CheckCircle2 },
  ], [activeSourceList]);

  const stockCategoryStats = useMemo(() => [
    { label: 'Total Stock Categories', value: activeSourceList.length, icon: FolderTree },
    { label: 'Primary Categories', value: activeSourceList.filter(c => !c.parentCategory || c.parentCategory === 'Primary' || c.parentCategory === 'Primary / Root Category').length, icon: Layers },
    { label: 'Sub Categories', value: activeSourceList.filter(c => c.parentCategory && c.parentCategory !== 'Primary' && c.parentCategory !== 'Primary / Root Category').length, icon: Tag },
    { label: 'Active Categories', value: activeSourceList.filter(c => (c.status || 'ACTIVE').toUpperCase() !== 'INACTIVE').length, icon: CheckCircle2 },
  ], [activeSourceList]);

  const costCenterStats = useMemo(() => [
    { label: 'Total Cost Centers', value: activeSourceList.length, icon: Layers },
    { label: 'Active', value: activeSourceList.filter(c => (c.status || 'ACTIVE').toUpperCase() !== 'INACTIVE').length, icon: CheckCircle2 },
    { label: 'Cost Categories', value: costCategories.length, icon: FolderTree },
    { label: 'Sub-Centers', value: activeSourceList.filter(c => c.parentId && c.parentId !== 'Primary / None').length, icon: Users },
  ], [activeSourceList, costCategories]);

  // Statistics Display Config
  const unitStats = useMemo(() => [
    { label: 'Total Units', value: activeSourceList.length, icon: Layers },
    { label: 'Base Units', value: activeSourceList.filter(u => (typeof u === 'object' ? u.conversion?.isBaseUnit !== false : true)).length, icon: Package },
    { label: 'Derived Units', value: activeSourceList.filter(u => (typeof u === 'object' ? u.conversion?.isBaseUnit === false : false)).length, icon: Tag },
    { label: 'Active Units', value: activeSourceList.filter(u => (typeof u === 'object' ? (u.status || 'ACTIVE').toUpperCase() !== 'INACTIVE' : true)).length, icon: CheckCircle2 },
  ], [activeSourceList]);

  const activeStats = isBom
    ? bomStats
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
    if (isBom) return bomsList;
    if (isStockCategory) return stockCategoriesList;
    if (isUnit) return unitsList;
    if (isCostCenter) return costCentersList;
    if (isLedgerGroup) return ledgerGroupsList;
    if (isStockGroup) return stockGroupsList;
    if (isStock) return stockDataList;
    return partyDataList;
  }, [isBom, bomsList, isStockCategory, stockCategoriesList, isUnit, unitsList, isCostCenter, costCentersList, isLedgerGroup, ledgerGroupsList, isStockGroup, stockGroupsList, isStock, stockDataList, partyDataList]);


  // Tab counts
  const syncedCount = useMemo(() => serverLedgerCounts.synced || activeMasterList.filter(r => !r.isWebEntry).length, [activeMasterList, serverLedgerCounts.synced]);
  const webEntryCount = useMemo(() => serverLedgerCounts.web || activeMasterList.filter(r => !!r.isWebEntry).length, [activeMasterList, serverLedgerCounts.web]);

  // Filtered rows for the active tab & source sub-tab.
  const rows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    
    // First split by masterSourceTab ('synced' vs 'web_entry')
    const sourceFiltered = activeMasterList.filter(r => masterSourceTab === 'web_entry' ? !!r.isWebEntry : !r.isWebEntry);

    return sourceFiltered.filter((r) => {
      if (onlyUnsynced && r.isSynced) return false;
      if (!q) return true;
      if (isStockCategory) return `${r.stockCategoryName || r.name} ${r.stockCategoryCode || r.code} ${r.parentCategory || r.parentName}`.toLowerCase().includes(q);
      if (isUnit) return `${typeof r === 'string' ? r : `${r.unitName} ${r.symbol} ${r.unitCode}`}`.toLowerCase().includes(q);
      if (isCostCenter) return `${r.costCenterName} ${r.costCenterCode} ${r.costCategoryId} ${r.parentId}`.toLowerCase().includes(q);
      if (isLedgerGroup) return `${r.groupName} ${r.groupCode} ${r.parentGroup} ${r.nature}`.toLowerCase().includes(q);
      if (isStockGroup) return `${r.groupName} ${r.parentGroup} ${r.hsnCode}`.toLowerCase().includes(q);
      if (isStock) return `${r.name}${r.group}${r.hsn}`.toLowerCase().includes(q);
      return `${r.ledger}${r.parentGroup}${r.gst}`.toLowerCase().includes(q);
    });
  }, [activeMasterList, masterSourceTab, searchQuery, onlyUnsynced, isStockCategory, isUnit, isCostCenter, isLedgerGroup, isStockGroup, isStock]);

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
    { key: 'unitName', header: 'Unit Name', sortable: true, render: (r) => <span className="font-bold text-[var(--app-heading)]">{safeStr(r.unitName || r.name)}</span> },
    { key: 'symbol', header: 'Symbol', sortable: true, render: (r) => <span className="font-bold text-[var(--app-accent)]">{safeStr(r.symbol)}</span> },
    { key: 'unitCode', header: 'Unit Code', sortable: true, render: (r) => <span className="font-mono font-semibold">{safeStr(r.unitCode, '—')}</span> },
    { key: 'type', header: 'Unit Type', render: (r) => <Badge tone={r.conversion?.isBaseUnit !== false ? 'neutral' : 'warning'}>{r.conversion?.isBaseUnit !== false ? 'Base Unit' : 'Derived Unit'}</Badge> },
    { key: 'conversion', header: 'Conversion Rule', render: (r) => <span className="text-xs text-[var(--app-muted)]">{r.conversion?.isBaseUnit !== false ? '—' : `1 ${safeStr(r.conversion?.baseUnit)} = ${safeStr(r.conversion?.conversionFactor)} ${safeStr(r.unitName)}`}</span> },
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
        <BOMMasterForm
          initialData={editingBom}
          isEdit={!!editingBom}
          stockItemsList={stockDataList}
          onSave={handleSaveBom}
          onClose={() => {
            setShowCreateForm(false);
            setEditingBom(null);
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

  // Full Page View for Cost Center Create/Edit Form
  if (showCreateForm && isCostCenter) {
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

  // Full Page View for Ledger Create/Edit Form
  if (showCreateForm && !isStock && !isCostCenter && !isLedgerGroup && !isStockGroup && !isStockCategory && !isUnit && !isBom) {
    return (
      <div className="h-full flex flex-col overflow-hidden animate-in fade-in duration-300">
        <LedgerMasterForm
          initialData={editingLedger}
          isEdit={!!editingLedger}
          costCentersList={costCentersList}
          ledgerGroupsList={ledgerGroupsList}
          partyDataList={partyDataList}
          onSave={handleSaveLedgerFromForm}
          onClose={() => {
            setShowCreateForm(false);
            setEditingLedger(null);
          }}
        />
      </div>
    );
  }

  // Active Columns Selection
  const currentColumns = isBom
    ? bomColumns
    : isStockCategory
      ? stockCategoryColumns
      : isUnit
        ? unitColumns
        : isCostCenter 
          ? costCenterColumns 
          : isStockGroup 
            ? stockGroupColumns 
            : isLedgerGroup 
              ? ledgerGroupColumns 
              : isStock 
                ? stockColumns 
                : ledgerColumns;


  return (
    <div className="flex flex-col gap-2.5 h-full animate-in fade-in duration-500 overflow-hidden p-1 text-[13px] text-[var(--app-text)]">
      
      {/* Top Horizontal Master Navigation Bar (Matches Screenshot 2) */}
      <div className="flex items-center justify-between border-b border-[var(--app-border)] bg-[var(--app-panel-bg)] px-4 py-2 shrink-0 rounded-xl shadow-2xs">
        {/* Left Horizontal Tabs */}
        <div className="flex items-center gap-6 overflow-x-auto no-scrollbar">
          {MASTER_TABS.map(tab => {
            const isActive = activeTab === tab.id || (tab.id === 'Party Ledger' && (activeTab === 'Ledger Master' || activeTab === 'Party Ledger')) || (tab.id === 'Item Master' && (activeTab === 'Stock Ledger' || activeTab === 'Item Master'));
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setShowCreateForm(false);
                }}
                className={`relative py-1.5 text-xs transition-all cursor-pointer whitespace-nowrap ${
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
          })}
        </div>

        {/* Right Side Actions: Refresh + Add Button */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              fetchMasterData();
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
            onClick={() => setShowCreateForm(p => !p)}
            className="h-8 px-3.5 bg-[var(--app-accent)] hover:opacity-90 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition-all shadow-xs shrink-0"
          >
            {showCreateForm ? <X size={13} /> : <Plus size={13} />}
            <span>
              {showCreateForm 
                ? 'Close Form' 
                : isBom
                  ? 'Add BOM'
                  : isStockCategory
                    ? 'Add Stock Category'
                    : isUnit
                      ? 'Add Unit'
                      : isCostCenter 
                        ? 'Add Cost Center' 
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

      {!isDetailView ? (
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
              minWidth={isStockCategory || isCostCenter || isLedgerGroup || isStockGroup ? '900px' : isStock ? '1000px' : '1400px'}
              data={rows}
              rowKey={(r) => r.sr || r.stockCategoryName || r.groupName || r.costCenterName}
              loading={loading}
              selectable={activeTab === 'Party Ledger'}
              selectedKeys={selectedLedgerKeys}
              onToggleRow={(key) => setSelectedLedgerKeys(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])}
              onToggleAll={(checked) => setSelectedLedgerKeys(checked ? rows.map(r => r.sr || r.stockCategoryName || r.groupName || r.costCenterName) : [])}
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
                isStockCategory
                  ? 'No stock categories found.'
                  : isCostCenter 
                    ? 'No cost centers found.' 
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
                placeholder: isStockCategory
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
              onRowClick={(row) => (!isStockCategory && !isCostCenter && !isLedgerGroup && !isStockGroup) && handleRowClick(row)}
              filters={
                <>
                  {(!isStockCategory && !isCostCenter && !isLedgerGroup && !isStockGroup) && (
                    <label className="flex items-center gap-1.5 cursor-pointer select-none px-1">
                      <input type="checkbox" checked={onlyUnsynced} onChange={(e) => setOnlyUnsynced(e.target.checked)} className="w-3.5 h-3.5 rounded accent-[var(--app-accent)] cursor-pointer" />
                      <span className="text-[11px] font-semibold whitespace-nowrap" style={{ color: 'var(--app-muted)' }}>Unsynced Only</span>
                    </label>
                  )}
                  <button type="button" title="Refresh" aria-label="Refresh" onClick={() => { setSearchQuery(''); setOnlyUnsynced(false); fetchMasterData(); toast.info('Lists refreshed'); }} className="h-8 w-8 flex items-center justify-center border rounded-lg text-[var(--app-muted)] border-[var(--app-border)] hover:bg-[var(--app-control-hover)] transition-colors">
                    <RefreshCw size={13} />
                  </button>
                </>
              }
            />

            {/* Pagination Controls for Large Company Masters */}
            {totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-t border-[var(--app-border)] bg-[var(--app-panel-bg)] rounded-b-xl text-xs font-bold shrink-0 mt-2">
                <div className="text-[var(--app-muted)] text-[11px]">
                  Showing Page <span className="text-[var(--app-heading)] font-extrabold">{currentPage}</span> of <span className="text-[var(--app-heading)] font-extrabold">{totalPages}</span> ({(serverLedgerCounts.total || 0).toLocaleString('en-IN')} total items)
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className="px-2.5 py-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] hover:bg-[var(--app-control-hover)] text-[var(--app-heading)] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                  >
                    Previous
                  </button>
                  <span className="px-2.5 py-1 bg-[var(--app-accent-soft)] text-[var(--app-accent)] rounded-lg font-extrabold">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className="px-2.5 py-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] hover:bg-[var(--app-control-hover)] text-[var(--app-heading)] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          
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
        {/* Stock Item Pop-up Modal */}
        {showCreateForm && isStock && (
          <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center bg-black/50 backdrop-blur-[2px] p-0 md:p-4 overflow-y-auto">
            <div className="bg-[var(--app-panel-bg)] border-0 md:border border-[var(--app-border)] rounded-none md:rounded-xl shadow-2xl max-w-6xl w-full h-full md:h-auto md:max-h-[95vh] flex flex-col my-0 md:my-4 overflow-hidden">
              {/* Header */}
              <div className="px-4 py-2.5 border-b border-[var(--app-border)] flex justify-between items-center shrink-0 bg-[var(--app-panel-bg)] rounded-t-none md:rounded-t-xl">
                <div>
                  <h2 className="text-base md:text-lg font-bold text-slate-900 dark:text-white">Add New Item</h2>
                  <p className="text-[10px] md:text-xs text-[var(--app-muted)] mt-0.5">Create a new stock item in one view</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-[var(--app-muted)] transition-colors p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleCreateItem} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {/* Fields - grouped into 3 columns, no scrolling needed on typical displays */}
                <div className="flex-1 p-3 md:p-4 space-y-3 overflow-y-auto md:overflow-visible">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    
                    {/* Column 1: Basic Details */}
                    <div className="space-y-3">
                      <div className="space-y-2 border rounded-xl p-3 bg-[var(--app-content-bg)] border-[var(--app-border)]">
                        <div className="flex items-center gap-1.5 text-[var(--app-accent)] dark:text-[var(--app-accent)] font-bold border-b border-[var(--app-border)] pb-1 mb-2">
                          <Package size={13} />
                          <span className="text-[11px] uppercase tracking-wider">1. Basic Details</span>
                        </div>
                        
                        <div>
                          <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">Item Name *</label>
                          <input
                            type="text"
                            required
                            value={itemForm.itemName}
                            onChange={(e) => setItemForm(prev => ({ ...prev, itemName: e.target.value }))}
                            placeholder="e.g. HP Keyboard"
                            className="w-full h-8 rounded-lg border px-2.5 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                          />
                        </div>
                        
                        <div>
                          <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">Item Group *</label>
                          <select
                            value={itemForm.stockGroup}
                            onChange={(e) => setItemForm(prev => ({ ...prev, stockGroup: e.target.value }))}
                            className="w-full h-8 rounded-lg border px-1.5 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                          >
                            <option value="Computer Accessories">Computer Accessories</option>
                            <option value="Computer Hardware">Computer Hardware</option>
                            <option value="Accessories">Accessories</option>
                            <option value="Printers">Printers</option>
                            <option value="Services">Services</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">Unit of Measure *</label>
                          <select
                            value={itemForm.uom}
                            onChange={(e) => setItemForm(prev => ({ ...prev, uom: e.target.value }))}
                            className="w-full h-8 rounded-lg border px-1.5 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                          >
                            <option value="Nos">Nos</option>
                            <option value="Pcs">Pcs</option>
                            <option value="Box">Box</option>
                            <option value="Hours">Hours</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">Brand (Optional)</label>
                          <input
                            type="text"
                            value={itemForm.brand}
                            onChange={(e) => setItemForm(prev => ({ ...prev, brand: e.target.value }))}
                            placeholder="e.g. HP"
                            className="w-full h-8 rounded-lg border px-2.5 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Column 2: Tax Details & Inventory Details */}
                    <div className="space-y-3">
                      {/* Section 2: Tax Details */}
                      <div className="space-y-2 border rounded-xl p-3 bg-[var(--app-content-bg)] border-[var(--app-border)]">
                        <div className="flex items-center gap-1.5 text-[var(--app-accent)] dark:text-[var(--app-accent)] font-bold border-b border-[var(--app-border)] pb-1 mb-2">
                          <Percent size={13} />
                          <span className="text-[11px] uppercase tracking-wider">2. Tax Details</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">HSN / SAC Code</label>
                            <input
                              type="text"
                              value={itemForm.hsnCode}
                              onChange={(e) => setItemForm(prev => ({ ...prev, hsnCode: e.target.value }))}
                              placeholder="e.g. 8471"
                              className="w-full h-8 rounded-lg border px-2.5 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                            />
                          </div>

                          <div>
                            <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">GST Rate (%) *</label>
                            <select
                              value={itemForm.gstRate}
                              onChange={(e) => setItemForm(prev => ({ ...prev, gstRate: e.target.value }))}
                              className="w-full h-8 rounded-lg border px-1.5 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                            >
                              <option value="18%">18%</option>
                              <option value="12%">12%</option>
                              <option value="5%">5%</option>
                              <option value="0%">0% Exempt</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">Taxability Type</label>
                          <select
                            value={itemForm.taxabilityType}
                            onChange={(e) => setItemForm(prev => ({ ...prev, taxabilityType: e.target.value }))}
                            className="w-full h-8 rounded-lg border px-1.5 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                          >
                            <option value="Taxable">Taxable</option>
                            <option value="Exempt">Exempt</option>
                            <option value="Nil Rated">Nil Rated</option>
                            <option value="Non-GST">Non-GST</option>
                          </select>
                        </div>
                      </div>

                      {/* Section 4: Inventory Details */}
                      <div className="space-y-2 border rounded-xl p-3 bg-[var(--app-content-bg)] border-[var(--app-border)]">
                        <div className="flex items-center gap-1.5 text-[var(--app-accent)] dark:text-[var(--app-accent)] font-bold border-b border-[var(--app-border)] pb-1 mb-2">
                          <Package size={13} />
                          <span className="text-[11px] uppercase tracking-wider">4. Inventory Details</span>
                        </div>

                        <div>
                          <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">Opening Stock *</label>
                          <div className="flex rounded-lg border border-[var(--app-border)] overflow-hidden bg-[var(--app-content-bg)] focus-within:border-[var(--app-accent)] transition-colors">
                            <input
                              type="text"
                              required
                              value={itemForm.openingQty}
                              onChange={(e) => setItemForm(prev => ({ ...prev, openingQty: e.target.value }))}
                              placeholder="100.00"
                              className="flex-1 h-8 px-2.5 text-xs bg-transparent outline-none text-[var(--app-heading)]"
                            />
                            <div className="flex items-center justify-center px-3 bg-[var(--app-control-hover)] text-xs font-semibold text-[var(--app-muted)] border-l border-[var(--app-border)] select-none">
                              {itemForm.uom}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Column 3: Pricing Details & Additional Details */}
                    <div className="space-y-3">
                      {/* Section 3: Pricing Details */}
                      <div className="space-y-2 border rounded-xl p-3 bg-[var(--app-content-bg)] border-[var(--app-border)]">
                        <div className="flex items-center gap-1.5 text-[var(--app-accent)] dark:text-[var(--app-accent)] font-bold border-b border-[var(--app-border)] pb-1 mb-2">
                          <IndianRupee size={13} />
                          <span className="text-[11px] uppercase tracking-wider">3. Pricing Details</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">Purchase Price *</label>
                            <input
                              type="text"
                              required
                              value={itemForm.purchasePrice}
                              onChange={(e) => setItemForm(prev => ({ ...prev, purchasePrice: e.target.value }))}
                              placeholder="500.00"
                              className="w-full h-8 rounded-lg border px-2.5 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                            />
                          </div>

                          <div>
                            <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">Sales Price *</label>
                            <input
                              type="text"
                              required
                              value={itemForm.salesPrice}
                              onChange={(e) => setItemForm(prev => ({ ...prev, salesPrice: e.target.value }))}
                              placeholder="700.00"
                              className="w-full h-8 rounded-lg border px-2.5 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">MRP (₹) (Optional)</label>
                          <input
                            type="text"
                            value={itemForm.mrp}
                            onChange={(e) => setItemForm(prev => ({ ...prev, mrp: e.target.value }))}
                            placeholder="750.00"
                            className="w-full h-8 rounded-lg border px-2.5 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                          />
                        </div>
                      </div>

                      {/* Section 5: Additional Details */}
                      <div className="space-y-2 border rounded-xl p-3 bg-[var(--app-content-bg)] border-[var(--app-border)]">
                        <div className="flex items-center gap-1.5 text-[var(--app-accent)] dark:text-[var(--app-accent)] font-bold border-b border-[var(--app-border)] pb-1 mb-2">
                          <Info size={13} />
                          <span className="text-[11px] uppercase tracking-wider">5. Additional Details</span>
                        </div>

                        <div>
                          <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">SKU / Barcode</label>
                          <input
                            type="text"
                            value={itemForm.sku}
                            onChange={(e) => setItemForm(prev => ({ ...prev, sku: e.target.value }))}
                            placeholder="HP-KB-001"
                            className="w-full h-8 rounded-lg border px-2.5 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                          />
                        </div>

                        <div>
                          <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">Description (Optional)</label>
                          <textarea
                            rows={1.5}
                            value={itemForm.description}
                            onChange={(e) => setItemForm(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="HP Wired USB Keyboard"
                            className="w-full rounded-lg border px-2 py-1 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)] resize-none"
                          />
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Modal Footer Buttons */}
                <div className="flex justify-end gap-2 p-3 md:p-4 border-t border-[var(--app-border)] text-[10px] font-bold uppercase tracking-wider shrink-0 bg-[var(--app-panel-bg)] rounded-b-none md:rounded-b-xl">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="px-4 py-1.5 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-[var(--app-text)] transition-colors"
                    style={{ borderColor: 'var(--app-border)' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-1.5 m3-interactive bg-[var(--app-cta)] hover:opacity-90 text-white rounded-full shadow-sm transition-all font-bold"
                  >
                    Save Item
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

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

