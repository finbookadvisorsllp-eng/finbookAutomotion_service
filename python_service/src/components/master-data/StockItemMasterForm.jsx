import React, { useState, useEffect, useMemo } from 'react';
import { 
  Package, Layers, Percent, Tag, Box, Settings2, ChevronLeft, ChevronRight, 
  Save, X, Info, Check, AlertCircle, Barcode, ChevronDown, ChevronUp, ArrowLeft, RefreshCw, Sliders, ExternalLink, Filter, Sparkles, CheckSquare, Square, Search
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  STOCK_ITEM_FEATURES, 
  BUSINESS_TYPES, 
  FEATURE_GROUPS, 
  getEffectiveFeatureSettings 
} from './stockItemFeatureConfig';

/**
 * StockItemMasterForm
 * Universal Stock Item Master with Rich Universal Accounting & Inventory Fields across all tabs,
 * Business-Type driven automatic feature activation, and clean Checkbox-based Advanced Settings.
 */
export default function StockItemMasterForm({
  initialData = null,
  isEdit = false,
  stockGroupsList = [],
  stockCategoriesList = [],
  unitsList = [],
  godownList = [],
  onSave,
  onClose
}) {
  // 6 Horizontal Tab Keys
  const TABS = [
    { id: 'basic', label: 'Basic Information', icon: Package },
    { id: 'classification', label: 'Classification & Valuation', icon: Layers },
    { id: 'inventory', label: 'Inventory & Godowns', icon: Box },
    { id: 'tax', label: 'Tax & GST', icon: Percent },
    { id: 'pricing', label: 'Pricing & Discounts', icon: Tag },
    { id: 'advanced', label: 'Advanced Settings', icon: Settings2 },
  ];

  const [activeTab, setActiveTab] = useState('basic');

  // Business Type & Feature Overrides State
  const [businessType, setBusinessType] = useState('GENERAL_TRADING');
  const [featureOverrides, setFeatureOverrides] = useState({});

  // Feature Configuration Modal & Expandable Accordion State
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [featureSearchQuery, setFeatureSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState({
    identification: false,
    units: false,
    tracking: false,
    control: false,
    pricing: false,
    manufacturing: false
  });

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const expandAllGroups = () => {
    const all = {};
    FEATURE_GROUPS.forEach(g => { all[g.id] = true; });
    setExpandedGroups(all);
  };

  const collapseAllGroups = () => {
    const none = {};
    FEATURE_GROUPS.forEach(g => { none[g.id] = false; });
    setExpandedGroups(none);
  };

  // Compute effective features dynamically
  const effectiveFeatures = useMemo(() => {
    return getEffectiveFeatureSettings({
      businessType,
      companySettings: {},
      featureOverrides
    });
  }, [businessType, featureOverrides]);

  // Count active features
  const activeFeaturesCount = useMemo(() => {
    return Object.values(effectiveFeatures).filter(Boolean).length;
  }, [effectiveFeatures]);

  // Normalized dropdown options helper
  const parsedGroups = useMemo(() => {
    return stockGroupsList.map(g => typeof g === 'string' ? { id: g, name: g } : { id: g._id || g.id || g.groupName || g.name, name: g.groupName || g.name });
  }, [stockGroupsList]);

  const parsedCategories = useMemo(() => {
    return stockCategoriesList.map(c => typeof c === 'string' ? { id: c, name: c } : { id: c._id || c.id || c.stockCategoryName || c.categoryName || c.name, name: c.stockCategoryName || c.categoryName || c.name });
  }, [stockCategoriesList]);

  const parsedUnits = useMemo(() => {
    const defaultList = ['Nos', 'Pcs', 'Kg', 'Ltr', 'Mtr', 'Box', 'Set', 'Bag', 'Packet', 'Gram', 'Doz'];
    const merged = unitsList.length > 0 ? unitsList : defaultList;
    return merged.map(u => typeof u === 'string' ? { id: u, name: u } : { id: u._id || u.id || u.unitName || u.symbol || u.name, name: u.unitName || u.symbol || u.name });
  }, [unitsList]);

  const parsedGodowns = useMemo(() => {
    const defaultGodowns = ['Main Location', 'Central Warehouse', 'Retail Shop Store', 'Branch Godown'];
    const merged = godownList.length > 0 ? godownList : defaultGodowns;
    return merged.map(g => typeof g === 'string' ? { id: g, name: g } : { id: g._id || g.id || g.godownName || g.name, name: g.godownName || g.name });
  }, [godownList]);

  // Form State
  const [formData, setFormData] = useState({
    // TAB 1: BASIC INFORMATION
    itemName: '',
    alias: '',
    itemCode: '',
    status: 'ACTIVE',
    description: '',
    remarks: '',
    itemNature: 'Goods', // 'Goods' | 'Service'

    // Additional Identification (Controlled by features)
    barcode: '',
    brand: '',
    manufacturer: '',
    modelNumber: '',
    partNumber: '',

    // Warranty Details (Controlled by warranty feature)
    warrantyEnabled: false,
    warrantyPeriod: '',
    warrantyUnit: 'Months',

    // TAB 2: CLASSIFICATION & VALUATION
    stockGroupId: '',
    stockGroupName: 'General',
    stockCategoryId: '',
    stockCategoryName: 'Not Applicable',
    valuationMethod: 'Avg. Cost', // 'Avg. Cost' | 'FIFO' | 'LIFO' | 'Monthly Avg. Cost' | 'Standard Cost'
    costingMethod: 'Avg. Cost',

    // TAB 3: INVENTORY & GODOWNS
    unitId: '',
    unitName: 'Nos',
    maintainInventory: true,
    allowNegativeStock: false,
    treatSalesAsManufactured: false,
    openingQuantity: 0,
    openingRate: 0,
    openingValue: 0,
    alternateUnitName: '',
    packSize: '',
    unitsPerPack: 1,
    defaultGodownId: '',
    defaultGodownName: 'Main Location',
    reorderLevel: 0,
    minimumStock: 0,
    maximumStock: 0,

    // Tracking
    maintainBatch: false,
    trackExpiry: false,
    trackManufacturingDate: false,
    serialTracking: false,
    serialPrefix: '',
    startingSerialNo: '',

    // TAB 4: TAX & GST
    taxability: 'Taxable', // 'Taxable' | 'Exempt' | 'Nil Rated' | 'Non-GST'
    hsnCode: '',
    sacCode: '',
    gstRate: '18%',
    cgstRate: '9%',
    sgstRate: '9%',
    igstRate: '18%',
    cessRate: '0%',
    reverseCharge: false,
    isNonGst: false,

    // TAB 5: PRICING & DISCOUNTS
    purchaseRate: '',
    salesRate: '',
    minSalesRate: '',
    mrp: '',
    standardCost: '',
    tradeDiscountPercent: '',

    // TAB 6: MANUFACTURING
    enableBOM: false,
    bomId: ''
  });

  const [errors, setErrors] = useState({});

  // Auto-calculate GST Breakup Rates whenever GST Rate changes
  useEffect(() => {
    const rawRate = parseFloat(String(formData.gstRate).replace('%', '')) || 0;
    const halfRate = (rawRate / 2).toFixed(1) + '%';
    setFormData(prev => ({
      ...prev,
      igstRate: `${rawRate}%`,
      cgstRate: halfRate,
      sgstRate: halfRate
    }));
  }, [formData.gstRate]);

  // Auto-calculate Opening Value whenever Quantity or Rate changes
  useEffect(() => {
    const qty = parseFloat(formData.openingQuantity) || 0;
    const rate = parseFloat(formData.openingRate) || 0;
    setFormData(prev => ({ ...prev, openingValue: (qty * rate).toFixed(2) }));
  }, [formData.openingQuantity, formData.openingRate]);

  // Initialize data for Edit Mode
  useEffect(() => {
    if (initialData) {
      const rawNature = String(initialData.itemNature || 'Goods').toUpperCase();
      const normNature = rawNature.includes('SERVICE') ? 'Service' : 'Goods';

      const normType = String(initialData.businessType || 'GENERAL_TRADING').toUpperCase().replace(/[\s-]/g, '_');
      setBusinessType(normType);
      setFeatureOverrides(initialData.featureOverrides || {});

      const rawGst = initialData.tax?.gstRate ?? initialData.gstRate ?? '18%';
      const cleanGst = String(rawGst).endsWith('%') ? String(rawGst) : `${rawGst}%`;

      setFormData(prev => ({
        ...prev,
        itemName: initialData.itemName || initialData.name || '',
        alias: initialData.alias || '',
        itemCode: initialData.itemCode || initialData.stockItemCode || initialData.sku || '',
        status: (initialData.status || 'ACTIVE').toUpperCase(),
        description: initialData.description || '',
        remarks: initialData.remarks || '',
        itemNature: normNature,

        barcode: initialData.identification?.barcode ?? initialData.barcode ?? '',
        brand: initialData.identification?.brand ?? initialData.brand ?? '',
        manufacturer: initialData.identification?.manufacturer ?? initialData.manufacturer ?? '',
        modelNumber: initialData.identification?.modelNumber ?? initialData.modelNumber ?? '',
        partNumber: initialData.identification?.partNumber ?? initialData.partNumber ?? '',

        warrantyEnabled: initialData.warranty?.enabled ?? initialData.warrantyEnabled ?? false,
        warrantyPeriod: initialData.warranty?.period ?? initialData.warrantyPeriod ?? '',
        warrantyUnit: initialData.warranty?.unit ?? initialData.warrantyUnit ?? 'Months',

        stockGroupId: initialData.stockGroupId || '',
        stockGroupName: initialData.stockGroupName || initialData.group || initialData.stockGroup || 'General',
        stockCategoryId: initialData.stockCategoryId || '',
        stockCategoryName: initialData.stockCategoryName || initialData.category || initialData.stockCategory || 'Not Applicable',
        valuationMethod: initialData.valuationMethod || 'Avg. Cost',
        costingMethod: initialData.costingMethod || 'Avg. Cost',

        unitId: initialData.unitId || '',
        unitName: initialData.unitName || (typeof initialData.unit === 'object' ? initialData.unit?.baseUnit : initialData.unit) || initialData.uom || initialData.baseUnit || 'Nos',
        maintainInventory: initialData.inventory?.maintainInventory ?? initialData.maintainInventory ?? true,
        allowNegativeStock: initialData.inventory?.allowNegativeStock ?? initialData.allowNegativeStock ?? false,
        treatSalesAsManufactured: initialData.inventory?.treatSalesAsManufactured ?? false,
        openingQuantity: initialData.inventory?.openingQuantity ?? initialData.openingQty ?? initialData.qty ?? 0,
        openingRate: initialData.inventory?.openingRate ?? initialData.openingRate ?? initialData.rate ?? initialData.purchasePrice ?? 0,
        openingValue: initialData.inventory?.openingValue ?? initialData.openingValue ?? initialData.value ?? 0,
        alternateUnitName: initialData.inventory?.alternateUnitName ?? initialData.alternateUnitName ?? '',
        packSize: initialData.inventory?.packSize ?? initialData.packSize ?? '',
        unitsPerPack: initialData.inventory?.unitsPerPack ?? initialData.unitsPerPack ?? 1,
        defaultGodownId: initialData.inventory?.defaultGodownId || '',
        defaultGodownName: initialData.inventory?.defaultGodownName ?? initialData.defaultGodownName ?? initialData.defaultGodown ?? 'Main Location',
        reorderLevel: initialData.inventory?.reorderLevel ?? initialData.reorderLevel ?? 0,
        minimumStock: initialData.inventory?.minimumStock ?? initialData.minimumStock ?? 0,
        maximumStock: initialData.inventory?.maximumStock ?? initialData.maximumStock ?? 0,

        maintainBatch: initialData.tracking?.maintainBatch ?? initialData.maintainBatch ?? initialData.flags?.isBatchWise ?? false,
        trackExpiry: initialData.tracking?.trackExpiry ?? initialData.trackExpiry ?? false,
        trackManufacturingDate: initialData.tracking?.trackManufacturingDate ?? initialData.trackManufacturingDate ?? false,
        serialTracking: initialData.tracking?.serialTracking ?? initialData.serialTracking ?? initialData.flags?.isSerialWise ?? false,
        serialPrefix: initialData.tracking?.serialPrefix ?? initialData.serialPrefix ?? '',
        startingSerialNo: initialData.tracking?.startingSerialNo ?? initialData.startingSerialNo ?? '',

        taxability: initialData.tax?.taxability ?? initialData.taxability ?? 'Taxable',
        hsnCode: initialData.tax?.hsnCode ?? initialData.hsnCode ?? initialData.hsn ?? '',
        sacCode: initialData.tax?.sacCode ?? initialData.sacCode ?? '',
        gstRate: cleanGst,
        cessRate: initialData.tax?.cessRate ?? initialData.cessRate ?? '0%',
        reverseCharge: initialData.tax?.reverseCharge ?? initialData.reverseCharge ?? false,
        isNonGst: initialData.tax?.isNonGst ?? initialData.isNonGst ?? false,

        purchaseRate: initialData.pricing?.purchaseRate ?? initialData.purchasePrice ?? initialData.purchaseRate ?? '',
        salesRate: initialData.pricing?.salesRate ?? initialData.salesPrice ?? initialData.salesRate ?? '',
        minSalesRate: initialData.pricing?.minSalesRate ?? initialData.minSalesRate ?? '',
        mrp: initialData.pricing?.mrp ?? initialData.mrp ?? '',
        standardCost: initialData.pricing?.standardCost ?? initialData.standardCost ?? '',
        tradeDiscountPercent: initialData.pricing?.tradeDiscountPercent ?? initialData.tradeDiscountPercent ?? '',

        enableBOM: initialData.manufacturing?.enableBOM ?? initialData.enableBOM ?? false,
        bomId: initialData.manufacturing?.bomId ?? initialData.bomId ?? ''
      }));
    }
  }, [initialData]);

  const isGoods = String(formData.itemNature).toUpperCase() === 'GOODS' || String(formData.itemNature).toUpperCase() === 'GOOD';

  // Tab Navigation Buttons
  const activeTabIndex = TABS.findIndex(t => t.id === activeTab);

  const handlePrevTab = () => {
    if (activeTabIndex > 0) {
      setActiveTab(TABS[activeTabIndex - 1].id);
    }
  };

  const handleNextTab = () => {
    if (activeTabIndex < TABS.length - 1) {
      setActiveTab(TABS[activeTabIndex + 1].id);
    }
  };

  // Toggle Feature Override in Advanced Tab
  const handleToggleFeature = (featureKey) => {
    const currentValue = effectiveFeatures[featureKey];
    const nextValue = !currentValue;

    setFeatureOverrides(prev => ({
      ...prev,
      [featureKey]: nextValue
    }));
  };

  // Reset Overrides
  const handleResetOverrides = () => {
    setFeatureOverrides({});
    toast.info(`Reset custom overrides to inherit defaults from "${BUSINESS_TYPES.find(b => b.id === businessType)?.label}".`);
  };

  // Dynamic Form Validation
  const validateForm = () => {
    const newErrors = {};

    if (!formData.itemName || !formData.itemName.trim()) {
      newErrors.itemName = 'Stock Item Name is required';
      setActiveTab('basic');
    }

    if (formData.itemNature === 'Goods' && (!formData.stockGroupName || !formData.stockGroupName.trim())) {
      newErrors.stockGroupName = 'Stock Group is required for Goods';
      if (!newErrors.itemName) setActiveTab('classification');
    }

    if (formData.itemNature === 'Goods' && formData.maintainInventory && (!formData.unitName || !formData.unitName.trim())) {
      newErrors.unitName = 'Primary Unit of Measure is required';
      if (!newErrors.itemName && !newErrors.stockGroupName) setActiveTab('inventory');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Please fix validation errors in the highlighted fields');
      return;
    }

    const isGoods = formData.itemNature === 'Goods';

    const payload = {
      _id: initialData?._id || initialData?.id,
      id: initialData?._id || initialData?.id,
      sourceCollection: initialData?.sourceCollection || 'stockitems_entry',
      itemName: formData.itemName.trim(),
      alias: formData.alias.trim(),
      itemCode: formData.itemCode.trim(),
      itemNature: formData.itemNature,
      status: formData.status,
      description: formData.description.trim(),
      remarks: formData.remarks.trim(),

      businessType: businessType,
      featureOverrides: featureOverrides,
      effectiveFeatures: effectiveFeatures,

      identification: {
        barcode: effectiveFeatures.barcode ? formData.barcode.trim() : '',
        brand: effectiveFeatures.brand ? formData.brand.trim() : '',
        manufacturer: effectiveFeatures.manufacturer ? formData.manufacturer.trim() : '',
        modelNumber: effectiveFeatures.model ? formData.modelNumber.trim() : '',
        partNumber: effectiveFeatures.partNumber ? formData.partNumber.trim() : ''
      },

      stockGroupId: formData.stockGroupId,
      stockGroupName: formData.stockGroupName,
      stockCategoryId: formData.stockCategoryId,
      stockCategoryName: formData.stockCategoryName,
      valuationMethod: formData.valuationMethod,
      costingMethod: formData.costingMethod,

      unitId: formData.unitId,
      unitName: formData.unitName,
      inventory: {
        maintainInventory: isGoods ? formData.maintainInventory : false,
        allowNegativeStock: isGoods ? formData.allowNegativeStock : false,
        treatSalesAsManufactured: isGoods ? formData.treatSalesAsManufactured : false,
        openingQuantity: isGoods && formData.maintainInventory ? parseFloat(formData.openingQuantity) || 0 : 0,
        openingRate: isGoods && formData.maintainInventory ? parseFloat(formData.openingRate) || 0 : 0,
        openingValue: isGoods && formData.maintainInventory ? parseFloat(formData.openingValue) || 0 : 0,
        alternateUnitName: effectiveFeatures.alternateUnit ? formData.alternateUnitName : '',
        packSize: effectiveFeatures.packaging ? formData.packSize.trim() : '',
        unitsPerPack: effectiveFeatures.packaging ? parseFloat(formData.unitsPerPack) || 0 : 0,
        defaultGodownId: formData.defaultGodownId,
        defaultGodownName: formData.defaultGodownName,
        reorderLevel: effectiveFeatures.reorderLevel ? parseFloat(formData.reorderLevel) || 0 : 0,
        minimumStock: effectiveFeatures.minimumStock ? parseFloat(formData.minimumStock) || 0 : 0,
        maximumStock: effectiveFeatures.maximumStock ? parseFloat(formData.maximumStock) || 0 : 0
      },

      tracking: {
        maintainBatch: isGoods && formData.maintainInventory && effectiveFeatures.batchTracking ? formData.maintainBatch : false,
        trackExpiry: isGoods && formData.maintainInventory && effectiveFeatures.batchTracking && effectiveFeatures.expiryTracking ? formData.trackExpiry : false,
        trackManufacturingDate: isGoods && formData.maintainInventory && effectiveFeatures.batchTracking && effectiveFeatures.manufacturingDate ? formData.trackManufacturingDate : false,
        serialTracking: isGoods && formData.maintainInventory && effectiveFeatures.serialTracking ? formData.serialTracking : false,
        serialPrefix: formData.serialPrefix.trim(),
        startingSerialNo: formData.startingSerialNo.trim()
      },

      tax: {
        taxability: formData.taxability,
        hsnCode: isGoods ? formData.hsnCode.trim() : '',
        sacCode: !isGoods ? formData.sacCode.trim() : '',
        gstRate: formData.gstRate,
        cgstRate: formData.cgstRate,
        sgstRate: formData.sgstRate,
        igstRate: formData.igstRate,
        cessRate: formData.cessRate,
        reverseCharge: formData.reverseCharge,
        isNonGst: formData.isNonGst
      },

      pricing: {
        purchaseRate: parseFloat(formData.purchaseRate) || 0,
        salesRate: parseFloat(formData.salesRate) || 0,
        minSalesRate: parseFloat(formData.minSalesRate) || 0,
        mrp: effectiveFeatures.mrp ? parseFloat(formData.mrp) || 0 : 0,
        standardCost: effectiveFeatures.standardCost ? parseFloat(formData.standardCost) || 0 : 0,
        tradeDiscountPercent: parseFloat(formData.tradeDiscountPercent) || 0
      },

      manufacturing: {
        enableBOM: isGoods && effectiveFeatures.bom ? formData.enableBOM : false,
        bomId: formData.bomId
      },
      warranty: {
        enabled: effectiveFeatures.warranty ? formData.warrantyEnabled : false,
        period: effectiveFeatures.warranty ? formData.warrantyPeriod : '',
        unit: effectiveFeatures.warranty ? formData.warrantyUnit : 'Months'
      },

      openingQty: isGoods && formData.maintainInventory ? parseFloat(formData.openingQuantity) || 0 : 0,
      openingRate: isGoods && formData.maintainInventory ? parseFloat(formData.openingRate) || 0 : 0,
      openingValue: isGoods && formData.maintainInventory ? parseFloat(formData.openingValue) || 0 : 0,
      hsnCode: isGoods ? formData.hsnCode.trim() : formData.sacCode.trim(),
      hsn: isGoods ? formData.hsnCode.trim() : formData.sacCode.trim(),
      gstRate: formData.gstRate,
      purchasePrice: parseFloat(formData.purchaseRate) || 0,
      salesPrice: parseFloat(formData.salesRate) || 0,
      mrp: effectiveFeatures.mrp ? parseFloat(formData.mrp) || 0 : 0,
      barcode: effectiveFeatures.barcode ? formData.barcode.trim() : '',
      brand: effectiveFeatures.brand ? formData.brand.trim() : ''
    };

    onSave(payload);
  };

  return (
    <div className="w-full flex-1 flex flex-col bg-[var(--app-panel-bg)] border border-[var(--app-border)] rounded-2xl shadow-sm overflow-hidden transition-all min-h-[85vh] my-1">
      
      {/* Top Header Bar */}
      <div className="px-6 py-3.5 border-b border-[var(--app-border)] flex flex-wrap justify-between items-center bg-[var(--app-panel-bg)] shrink-0 gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl border border-[var(--app-border)] hover:bg-[var(--app-control-hover)] text-[var(--app-heading)] transition-all flex items-center gap-1.5 font-bold text-xs cursor-pointer shadow-2xs"
            title="Back to Stock Item List"
          >
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>

          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--app-accent)]/20 to-[var(--app-accent)]/5 text-[var(--app-accent)] flex items-center justify-center font-bold shadow-2xs">
            <Package size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base md:text-lg font-bold text-[var(--app-heading)] tracking-tight">
                {isEdit ? 'Edit Stock Item Master' : 'Create Stock Item Master'}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-[var(--app-accent)]/15 text-[var(--app-accent)] font-extrabold text-[10px] uppercase tracking-wider">
                {BUSINESS_TYPES.find(b => b.id === businessType)?.label || 'General Trading'}
              </span>
            </div>
            <p className="text-xs text-[var(--app-muted)] mt-0.5">
              {activeFeaturesCount} features active
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowConfigModal(true)}
            className="px-3.5 py-1.5 rounded-xl border border-[var(--app-accent-soft)] bg-[var(--app-accent-soft)] text-[var(--app-accent)] hover:opacity-90 transition-all text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Configure active item features & accounting controls"
          >
            <Settings2 size={14} />
            <span>Configure Features</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-[var(--app-muted)] hover:text-[var(--app-heading)] hover:bg-[var(--app-control-hover)] transition-colors cursor-pointer"
            title="Close Form"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Horizontal Tabs Header Bar */}
      <div className="flex items-center border-b border-[var(--app-border)] bg-[var(--app-content-bg)] px-4 overflow-x-auto shrink-0 scrollbar-none gap-1">
        {TABS.map((tab) => {
          const IconComponent = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'border-[var(--app-accent)] text-[var(--app-accent)] bg-[var(--app-panel-bg)] shadow-xs rounded-t-lg'
                  : 'border-transparent text-[var(--app-muted)] hover:text-[var(--app-heading)] hover:bg-[var(--app-control-hover)]/60'
              }`}
            >
              <IconComponent size={15} />
              <span>{tab.label}</span>
              {tab.id === 'advanced' && Object.keys(featureOverrides).length > 0 && (
                <span className="px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[9px] font-extrabold">
                  {Object.keys(featureOverrides).length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Full-Width Content Container */}
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex-1 px-6 py-5 overflow-y-auto space-y-6">
          
          {/* TAB 1: BASIC INFORMATION */}
          {activeTab === 'basic' && (
            <div className="w-full space-y-5">
              <div className="p-5 rounded-2xl border border-[var(--app-border)] bg-[var(--app-content-bg)] space-y-4 shadow-2xs">
                <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2.5">
                  <span className="text-xs font-bold text-[var(--app-accent)] uppercase tracking-wider flex items-center gap-2">
                    <Package size={15} /> Basic Product Identity
                  </span>
                  <span className="text-[11px] text-[var(--app-muted)] font-semibold">* Mandatory fields</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-5">
                  {/* Stock Item Name */}
                  <div className="md:col-span-2 lg:col-span-2">
                    <label className="text-xs font-bold text-[var(--app-heading)] mb-1.5 block">
                    Item Name <span className="text-red-500">*</span>
                  </label>
                    <input
                      type="text"
                      required
                      value={formData.itemName}
                      onChange={(e) => setFormData(prev => ({ ...prev, itemName: e.target.value }))}
                      placeholder="e.g. Dell Inspiron 15 Laptop"
                      className={`w-full h-10 rounded-xl border px-3.5 text-xs font-semibold outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] transition-all ${
                        errors.itemName ? 'border-red-500 ring-1 ring-red-500' : 'border-[var(--app-border)] focus:border-[var(--app-accent)]'
                      }`}
                    />
                    {errors.itemName && <p className="text-[10px] text-red-500 mt-1 font-semibold">{errors.itemName}</p>}
                  </div>

                  {/* Alias */}
                  <div>
                    <label className="text-xs font-bold text-[var(--app-heading)] mb-1.5 block">Alias / Short Name</label>
                    <input
                      type="text"
                      value={formData.alias}
                      onChange={(e) => setFormData(prev => ({ ...prev, alias: e.target.value }))}
                      placeholder="e.g. DELL-INSP-15"
                      className="w-full h-10 rounded-xl border border-[var(--app-border)] px-3.5 text-xs outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[var(--app-accent)]"
                    />
                  </div>

                  {/* Item Code / SKU */}
                  <div>
                    <label className="text-xs font-bold text-[var(--app-heading)] mb-1.5 block">Item Code / SKU</label>
                    <input
                      type="text"
                      value={formData.itemCode}
                      onChange={(e) => setFormData(prev => ({ ...prev, itemCode: e.target.value }))}
                      placeholder="e.g. SK-DELL-1002"
                      className="w-full h-10 rounded-xl border border-[var(--app-border)] px-3.5 text-xs font-mono font-semibold outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[var(--app-accent)]"
                    />
                  </div>

                  {/* Item Nature */}
                  <div>
                    <label className="text-xs font-bold text-[var(--app-heading)] mb-1.5 block">Item Nature *</label>
                    <select
                      value={formData.itemNature}
                      onChange={(e) => setFormData(prev => ({ ...prev, itemNature: e.target.value }))}
                      className="w-full h-10 rounded-xl border border-[var(--app-border)] px-3.5 text-xs font-bold outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[var(--app-accent)]"
                    >
                      <option value="Goods">Goods (Physical Inventory)</option>
                      <option value="Service">Service (Non-Physical)</option>
                    </select>
                  </div>

                  {/* Status */}
                  <div>
                    <label className="text-xs font-bold text-[var(--app-heading)] mb-1.5 block">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                      className="w-full h-10 rounded-xl border border-[var(--app-border)] px-3.5 text-xs font-semibold outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[var(--app-accent)]"
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                  </div>

                  {/* Description */}
                  <div className="md:col-span-3 lg:col-span-4">
                    <label className="text-xs font-bold text-[var(--app-heading)] mb-1.5 block">Item Description</label>
                    <textarea
                      rows={2}
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Detailed item description for sales invoices and catalogues..."
                      className="w-full rounded-xl border border-[var(--app-border)] p-3 text-xs outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[var(--app-accent)] resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Dynamic Product Identification Card */}
              {(effectiveFeatures.barcode || effectiveFeatures.brand || effectiveFeatures.manufacturer || effectiveFeatures.model || effectiveFeatures.partNumber) && (
                <div className="p-5 rounded-2xl border border-[var(--app-border)] bg-[var(--app-content-bg)] space-y-4 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2.5">
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                      <Barcode size={15} /> Product Identification & Brand Details
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-5">
                    {effectiveFeatures.barcode && (
                      <div>
                        <label className="text-xs font-bold text-[var(--app-heading)] mb-1.5 block flex items-center gap-1.5">
                          <Barcode size={13} /> Barcode / EAN
                        </label>
                        <input
                          type="text"
                          value={formData.barcode}
                          onChange={(e) => setFormData(prev => ({ ...prev, barcode: e.target.value }))}
                          placeholder="e.g. 8901234567890"
                          className="w-full h-10 rounded-xl border border-[var(--app-border)] px-3.5 text-xs font-mono font-semibold outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[var(--app-accent)]"
                        />
                      </div>
                    )}

                    {effectiveFeatures.brand && (
                      <div>
                        <label className="text-xs font-bold text-[var(--app-heading)] mb-1.5 block">Brand / Make</label>
                        <input
                          type="text"
                          value={formData.brand}
                          onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))}
                          placeholder="e.g. Dell / Samsung"
                          className="w-full h-10 rounded-xl border border-[var(--app-border)] px-3.5 text-xs outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[var(--app-accent)]"
                        />
                      </div>
                    )}

                    {effectiveFeatures.manufacturer && (
                      <div>
                        <label className="text-xs font-bold text-[var(--app-heading)] mb-1.5 block">Manufacturer</label>
                        <input
                          type="text"
                          value={formData.manufacturer}
                          onChange={(e) => setFormData(prev => ({ ...prev, manufacturer: e.target.value }))}
                          placeholder="e.g. Dell India Pvt Ltd"
                          className="w-full h-10 rounded-xl border border-[var(--app-border)] px-3.5 text-xs outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[var(--app-accent)]"
                        />
                      </div>
                    )}

                    {effectiveFeatures.model && (
                      <div>
                        <label className="text-xs font-bold text-[var(--app-heading)] mb-1.5 block">Model Number</label>
                        <input
                          type="text"
                          value={formData.modelNumber}
                          onChange={(e) => setFormData(prev => ({ ...prev, modelNumber: e.target.value }))}
                          placeholder="e.g. Inspiron-15-5510"
                          className="w-full h-10 rounded-xl border border-[var(--app-border)] px-3.5 text-xs outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[var(--app-accent)]"
                        />
                      </div>
                    )}

                    {effectiveFeatures.partNumber && (
                      <div>
                        <label className="text-xs font-bold text-[var(--app-heading)] mb-1.5 block">Part Number</label>
                        <input
                          type="text"
                          value={formData.partNumber}
                          onChange={(e) => setFormData(prev => ({ ...prev, partNumber: e.target.value }))}
                          placeholder="e.g. PN-99042-X"
                          className="w-full h-10 rounded-xl border border-[var(--app-border)] px-3.5 text-xs font-mono outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[var(--app-accent)]"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Dynamic Warranty Card */}
              {effectiveFeatures.warranty && (
                <div className="p-5 rounded-2xl border border-[var(--app-border)] bg-[var(--app-content-bg)] space-y-4 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2.5">
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                      <Check size={15} /> Warranty & Guarantee Setup
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-center">
                    <div>
                      <label className="text-xs font-bold text-[var(--app-heading)] mb-1.5 block">Warranty Applicable</label>
                      <select
                        value={formData.warrantyEnabled ? 'YES' : 'NO'}
                        onChange={(e) => setFormData(prev => ({ ...prev, warrantyEnabled: e.target.value === 'YES' }))}
                        className="w-full h-10 rounded-xl border border-[var(--app-border)] px-3.5 text-xs font-bold outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[var(--app-accent)]"
                      >
                        <option value="NO">NO</option>
                        <option value="YES">YES</option>
                      </select>
                    </div>

                    {formData.warrantyEnabled && (
                      <>
                        <div>
                          <label className="text-xs font-bold text-[var(--app-heading)] mb-1.5 block">Warranty Period</label>
                          <input
                            type="number"
                            value={formData.warrantyPeriod}
                            onChange={(e) => setFormData(prev => ({ ...prev, warrantyPeriod: e.target.value }))}
                            placeholder="e.g. 12"
                            className="w-full h-10 rounded-xl border border-[var(--app-border)] px-3.5 text-xs outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[var(--app-accent)]"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-bold text-[var(--app-heading)] mb-1.5 block">Warranty Unit</label>
                          <select
                            value={formData.warrantyUnit}
                            onChange={(e) => setFormData(prev => ({ ...prev, warrantyUnit: e.target.value }))}
                            className="w-full h-10 rounded-xl border border-[var(--app-border)] px-3.5 text-xs outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[var(--app-accent)]"
                          >
                            <option value="Months">Months</option>
                            <option value="Years">Years</option>
                            <option value="Days">Days</option>
                          </select>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CLASSIFICATION & VALUATION */}
          {activeTab === 'classification' && (
            <div className="w-full space-y-5">
              <div className="p-5 rounded-2xl border border-[var(--app-border)] bg-[var(--app-content-bg)] space-y-4 shadow-2xs">
                <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2.5">
                  <span className="text-xs font-bold text-[var(--app-accent)] uppercase tracking-wider flex items-center gap-2">
                    <Layers size={15} /> Universal Stock Group, Category & Inventory Valuation Method
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                  {/* Stock Group */}
                  <div>
                    <label className="text-xs font-bold text-[var(--app-heading)] mb-1.5 block">
                      Group {isGoods && <span className="text-red-500">*</span>}
                    </label>
                    <select
                      value={formData.stockGroupName}
                      onChange={(e) => {
                        const selectedName = e.target.value;
                        const match = parsedGroups.find(g => g.name === selectedName);
                        setFormData(prev => ({
                          ...prev,
                          stockGroupName: selectedName,
                          stockGroupId: match ? match.id : ''
                        }));
                      }}
                      className={`w-full h-10 rounded-xl border px-3.5 text-xs font-semibold outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] transition-all ${
                        errors.stockGroupName ? 'border-red-500 ring-1 ring-red-500' : 'border-[var(--app-border)] focus:border-[var(--app-accent)]'
                      }`}
                    >
                      <option value="General">General</option>
                      <option value="Primary">Primary</option>
                      {parsedGroups.map(g => (
                        <option key={g.id} value={g.name}>{g.name}</option>
                      ))}
                    </select>
                    {errors.stockGroupName && <p className="text-[10px] text-red-500 mt-1 font-semibold">{errors.stockGroupName}</p>}
                  </div>

                  {/* Stock Category */}
                  <div>
                    <label className="text-xs font-bold text-[var(--app-heading)] mb-1.5 block">Category</label>
                    <select
                      value={formData.stockCategoryName}
                      onChange={(e) => {
                        const selectedName = e.target.value;
                        const match = parsedCategories.find(c => c.name === selectedName);
                        setFormData(prev => ({
                          ...prev,
                          stockCategoryName: selectedName,
                          stockCategoryId: match ? match.id : ''
                        }));
                      }}
                      className="w-full h-10 rounded-xl border border-[var(--app-border)] px-3.5 text-xs font-semibold outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[var(--app-accent)]"
                    >
                      <option value="Not Applicable">Not Applicable</option>
                      {parsedCategories.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Universal Inventory Valuation Method */}
                  <div>
                    <label className="text-xs font-bold text-[var(--app-heading)] mb-1.5 block">Valuation Method</label>
                    <select
                      value={formData.valuationMethod}
                      onChange={(e) => setFormData(prev => ({ ...prev, valuationMethod: e.target.value }))}
                      className="w-full h-10 rounded-xl border border-[var(--app-border)] px-3.5 text-xs font-semibold outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[var(--app-accent)]"
                    >
                      <option value="Avg. Cost">Avg. Cost (Weighted Average)</option>
                      <option value="FIFO">FIFO (First In First Out)</option>
                      <option value="LIFO">LIFO (Last In First Out)</option>
                      <option value="Monthly Avg. Cost">Monthly Avg. Cost</option>
                      <option value="Standard Cost">Standard Cost</option>
                      <option value="Last Purchase Cost">Last Purchase Cost</option>
                    </select>
                  </div>

                  {/* Universal Costing Method */}
                  <div>
                    <label className="text-xs font-bold text-[var(--app-heading)] mb-1.5 block">Costing Method</label>
                    <select
                      value={formData.costingMethod}
                      onChange={(e) => setFormData(prev => ({ ...prev, costingMethod: e.target.value }))}
                      className="w-full h-10 rounded-xl border border-[var(--app-border)] px-3.5 text-xs font-semibold outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[var(--app-accent)]"
                    >
                      <option value="Avg. Cost">Avg. Cost</option>
                      <option value="FIFO">FIFO</option>
                      <option value="LIFO">LIFO</option>
                      <option value="At Zero Cost">At Zero Cost</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: INVENTORY & GODOWNS */}
          {activeTab === 'inventory' && (
            <div className="w-full space-y-5">
              {!isGoods ? (
                <div className="p-8 text-center border border-[var(--app-border)] rounded-2xl bg-[var(--app-content-bg)] space-y-3">
                  <Box className="mx-auto text-[var(--app-muted)]" size={36} />
                  <h3 className="text-base font-bold text-[var(--app-heading)]">Service Item Selected</h3>
                  <p className="text-xs text-[var(--app-muted)] max-w-md mx-auto">
                    Inventory tracking, opening balances, batch details, and godowns are not applicable for Service nature items.
                  </p>
                </div>
              ) : (
                <>
                  {/* Core Measurement Units & Opening Balance Card */}
                  <div className="p-5 rounded-2xl border border-[var(--app-border)] bg-[var(--app-content-bg)] space-y-4 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2.5">
                      <span className="text-xs font-bold text-[var(--app-accent)] uppercase tracking-wider flex items-center gap-2">
                        <Box size={15} /> Measurement Units & Opening Stock Balance
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-5">
                      {/* Maintain Inventory */}
                      <div>
                        <label className="text-xs font-bold text-[var(--app-heading)] mb-1.5 block">Maintain Inventory *</label>
                        <select
                          value={formData.maintainInventory ? 'YES' : 'NO'}
                          onChange={(e) => setFormData(prev => ({ ...prev, maintainInventory: e.target.value === 'YES' }))}
                          className="w-full h-10 rounded-xl border border-[var(--app-border)] px-3.5 text-xs font-bold outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[var(--app-accent)]"
                        >
                          <option value="YES">YES</option>
                          <option value="NO">NO</option>
                        </select>
                      </div>

                      {/* Primary Unit */}
                      <div>
                        <label className="text-xs font-bold text-[var(--app-heading)] mb-1.5 block">
                          Primary Unit (UOM) <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={formData.unitName}
                          onChange={(e) => {
                            const selectedName = e.target.value;
                            const match = parsedUnits.find(u => u.name === selectedName);
                            setFormData(prev => ({
                              ...prev,
                              unitName: selectedName,
                              unitId: match ? match.id : ''
                            }));
                          }}
                          className={`w-full h-10 rounded-xl border px-3.5 text-xs font-semibold outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] transition-all ${
                            errors.unitName ? 'border-red-500 ring-1 ring-red-500' : 'border-[var(--app-border)] focus:border-[var(--app-accent)]'
                          }`}
                        >
                          <option value="">Select Primary Unit...</option>
                          {parsedUnits.map(u => (
                            <option key={u.id} value={u.name}>{u.name}</option>
                          ))}
                        </select>
                        {errors.unitName && <p className="text-[10px] text-red-500 mt-1 font-semibold">{errors.unitName}</p>}
                      </div>

                      {/* Universal Allow Negative Stock */}
                      <div>
                        <label className="text-xs font-bold text-[var(--app-heading)] mb-1.5 block">Allow Negative Stock</label>
                        <select
                          value={formData.allowNegativeStock ? 'YES' : 'NO'}
                          onChange={(e) => setFormData(prev => ({ ...prev, allowNegativeStock: e.target.value === 'YES' }))}
                          className="w-full h-10 rounded-xl border border-[var(--app-border)] px-3.5 text-xs font-semibold outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[var(--app-accent)]"
                        >
                          <option value="NO">NO (Prevent Sales when Zero)</option>
                          <option value="YES">YES (Allow Negative Stock)</option>
                        </select>
                      </div>

                      {/* Alternate Unit (Dynamic) */}
                      {effectiveFeatures.alternateUnit && (
                        <div>
                          <label className="text-xs font-bold text-[var(--app-heading)] mb-1.5 block">Alternate Unit (UOM)</label>
                          <select
                            value={formData.alternateUnitName}
                            onChange={(e) => setFormData(prev => ({ ...prev, alternateUnitName: e.target.value }))}
                            className="w-full h-10 rounded-xl border border-[var(--app-border)] px-3.5 text-xs outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[var(--app-accent)]"
                          >
                            <option value="">Not Applicable</option>
                            {parsedUnits.map(u => (
                              <option key={u.id} value={u.name}>{u.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Packaging Details (Dynamic) */}
                    {effectiveFeatures.packaging && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-3 border-t border-[var(--app-border)]">
                        <div>
                          <label className="text-xs font-bold text-[var(--app-heading)] mb-1.5 block">Pack Size</label>
                          <input
                            type="text"
                            value={formData.packSize}
                            onChange={(e) => setFormData(prev => ({ ...prev, packSize: e.target.value }))}
                            placeholder="e.g. 10 x 100g / Box of 24"
                            className="w-full h-10 rounded-xl border border-[var(--app-border)] px-3.5 text-xs outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[var(--app-accent)]"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-[var(--app-heading)] mb-1.5 block">Units Per Pack</label>
                          <input
                            type="number"
                            value={formData.unitsPerPack}
                            onChange={(e) => setFormData(prev => ({ ...prev, unitsPerPack: e.target.value }))}
                            placeholder="e.g. 24"
                            className="w-full h-10 rounded-xl border border-[var(--app-border)] px-3.5 text-xs outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[var(--app-accent)]"
                          />
                        </div>
                      </div>
                    )}

                    {/* Opening Balance fields */}
                    {formData.maintainInventory && (
                      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-5 pt-3 border-t border-[var(--app-border)]">
                        <div>
                          <label className="text-xs font-bold text-[var(--app-heading)] mb-1.5 block">Opening Quantity</label>
                          <div className="flex rounded-xl border border-[var(--app-border)] overflow-hidden bg-[var(--app-panel-bg)]">
                            <input
                              type="number"
                              step="any"
                              value={formData.openingQuantity}
                              onChange={(e) => setFormData(prev => ({ ...prev, openingQuantity: e.target.value }))}
                              placeholder="0.00"
                              className="flex-1 h-10 px-3.5 text-xs font-semibold bg-transparent outline-none text-[var(--app-heading)]"
                            />
                            <div className="flex items-center justify-center px-3.5 bg-[var(--app-control-hover)] text-xs font-bold text-[var(--app-muted)] border-l border-[var(--app-border)]">
                              {formData.unitName || 'Nos'}
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-bold text-[var(--app-heading)] mb-1.5 block">Opening Rate (₹)</label>
                          <input
                            type="number"
                            step="any"
                            value={formData.openingRate}
                            onChange={(e) => setFormData(prev => ({ ...prev, openingRate: e.target.value }))}
                            placeholder="0.00"
                            className="w-full h-10 rounded-xl border border-[var(--app-border)] px-3.5 text-xs font-semibold outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[var(--app-accent)]"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-bold text-[var(--app-heading)] mb-1.5 block">Opening Value (₹)</label>
                          <input
                            type="number"
                            readOnly
                            value={formData.openingValue}
                            className="w-full h-10 rounded-xl border border-[var(--app-border)] px-3.5 text-xs font-extrabold outline-none bg-[var(--app-control-hover)] text-[var(--app-heading)] cursor-not-allowed"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-bold text-[var(--app-heading)] mb-1.5 block">Default Godown / Warehouse</label>
                          <select
                            value={formData.defaultGodownName}
                            onChange={(e) => {
                              const selectedName = e.target.value;
                              const match = parsedGodowns.find(g => g.name === selectedName);
                              setFormData(prev => ({
                                ...prev,
                                defaultGodownName: selectedName,
                                defaultGodownId: match ? match.id : ''
                              }));
                            }}
                            className="w-full h-10 rounded-xl border border-[var(--app-border)] px-3.5 text-xs font-semibold outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[var(--app-accent)]"
                          >
                            {parsedGodowns.map(g => (
                              <option key={g.id} value={g.name}>{g.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Stock Control & Planning (Dynamic) */}
                  {(effectiveFeatures.reorderLevel || effectiveFeatures.minimumStock || effectiveFeatures.maximumStock) && (
                    <div className="p-5 rounded-2xl border border-[var(--app-border)] bg-[var(--app-content-bg)] space-y-4 shadow-2xs">
                      <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2.5">
                        <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-2">
                          <Sliders size={15} /> Stock Level Controls & Reorder Thresholds
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        {effectiveFeatures.reorderLevel && (
                          <div>
                            <label className="text-xs font-bold text-[var(--app-heading)] mb-1.5 block">Reorder Level Quantity</label>
                            <input
                              type="number"
                              value={formData.reorderLevel}
                              onChange={(e) => setFormData(prev => ({ ...prev, reorderLevel: e.target.value }))}
                              placeholder="0.00"
                              className="w-full h-10 rounded-xl border border-[var(--app-border)] px-3.5 text-xs font-semibold outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[var(--app-accent)]"
                            />
                          </div>
                        )}

                        {effectiveFeatures.minimumStock && (
                          <div>
                            <label className="text-xs font-bold text-[var(--app-heading)] mb-1.5 block">Minimum Safety Stock</label>
                            <input
                              type="number"
                              value={formData.minimumStock}
                              onChange={(e) => setFormData(prev => ({ ...prev, minimumStock: e.target.value }))}
                              placeholder="0.00"
                              className="w-full h-10 rounded-xl border border-[var(--app-border)] px-3.5 text-xs font-semibold outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[var(--app-accent)]"
                            />
                          </div>
                        )}

                        {effectiveFeatures.maximumStock && (
                          <div>
                            <label className="text-xs font-bold text-[var(--app-heading)] mb-1.5 block">Maximum Capacity Stock</label>
                            <input
                              type="number"
                              value={formData.maximumStock}
                              onChange={(e) => setFormData(prev => ({ ...prev, maximumStock: e.target.value }))}
                              placeholder="0.00"
                              className="w-full h-10 rounded-xl border border-[var(--app-border)] px-3.5 text-xs font-semibold outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[var(--app-accent)]"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Batch Tracking & Serial Tracking (Dynamic) */}
                  {(effectiveFeatures.batchTracking || effectiveFeatures.serialTracking) && (
                    <div className="p-5 rounded-2xl border border-[var(--app-border)] bg-[var(--app-content-bg)] space-y-4 shadow-2xs">
                      <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2.5">
                        <span className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider flex items-center gap-2">
                          <Tag size={15} /> Batch & Serial Number Tracking
                        </span>
                      </div>

                      {effectiveFeatures.batchTracking && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-center">
                          <div>
                            <label className="text-xs font-bold text-[var(--app-heading)] mb-1.5 block">Maintain Batch Details</label>
                            <select
                              value={formData.maintainBatch ? 'YES' : 'NO'}
                              onChange={(e) => setFormData(prev => ({ ...prev, maintainBatch: e.target.value === 'YES' }))}
                              className="w-full h-10 rounded-xl border border-[var(--app-border)] px-3.5 text-xs font-bold outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[var(--app-accent)]"
                            >
                              <option value="NO">NO</option>
                              <option value="YES">YES</option>
                            </select>
                          </div>

                          {formData.maintainBatch && effectiveFeatures.expiryTracking && (
                            <div>
                              <label className="text-xs font-bold text-[var(--app-heading)] mb-1.5 block">Track Expiry Date</label>
                              <select
                                value={formData.trackExpiry ? 'YES' : 'NO'}
                                onChange={(e) => setFormData(prev => ({ ...prev, trackExpiry: e.target.value === 'YES' }))}
                                className="w-full h-10 rounded-xl border border-[var(--app-border)] px-3.5 text-xs font-bold outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[var(--app-accent)]"
                              >
                                <option value="NO">NO</option>
                                <option value="YES">YES</option>
                              </select>
                            </div>
                          )}

                          {formData.maintainBatch && effectiveFeatures.manufacturingDate && (
                            <div>
                              <label className="text-xs font-bold text-[var(--app-heading)] mb-1.5 block">Track Manufacturing Date</label>
                              <select
                                value={formData.trackManufacturingDate ? 'YES' : 'NO'}
                                onChange={(e) => setFormData(prev => ({ ...prev, trackManufacturingDate: e.target.value === 'YES' }))}
                                className="w-full h-10 rounded-xl border border-[var(--app-border)] px-3.5 text-xs font-bold outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[var(--app-accent)]"
                              >
                                <option value="NO">NO</option>
                                <option value="YES">YES</option>
                              </select>
                            </div>
                          )}
                        </div>
                      )}

                      {effectiveFeatures.serialTracking && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-3 border-t border-[var(--app-border)]">
                          <div>
                            <label className="text-xs font-bold text-[var(--app-heading)] mb-1.5 block">Serial Number Tracking</label>
                            <select
                              value={formData.serialTracking ? 'YES' : 'NO'}
                              onChange={(e) => setFormData(prev => ({ ...prev, serialTracking: e.target.value === 'YES' }))}
                              className="w-full h-10 rounded-xl border border-[var(--app-border)] px-3.5 text-xs font-bold outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[var(--app-accent)]"
                            >
                              <option value="NO">NO</option>
                              <option value="YES">YES</option>
                            </select>
                          </div>

                          {formData.serialTracking && (
                            <>
                              <div>
                                <label className="text-xs font-bold text-[var(--app-heading)] mb-1.5 block">Serial Prefix (Optional)</label>
                                <input
                                  type="text"
                                  value={formData.serialPrefix}
                                  onChange={(e) => setFormData(prev => ({ ...prev, serialPrefix: e.target.value }))}
                                  placeholder="e.g. SN-2026-"
                                  className="w-full h-10 rounded-xl border border-[var(--app-border)] px-3.5 text-xs font-mono outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[var(--app-accent)]"
                                />
                              </div>

                              <div>
                                <label className="text-xs font-bold text-[var(--app-heading)] mb-1.5 block">Starting Serial No</label>
                                <input
                                  type="text"
                                  value={formData.startingSerialNo}
                                  onChange={(e) => setFormData(prev => ({ ...prev, startingSerialNo: e.target.value }))}
                                  placeholder="e.g. 10001"
                                  className="w-full h-10 rounded-xl border border-[var(--app-border)] px-3.5 text-xs font-mono outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[var(--app-accent)]"
                                />
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* TAB 4: TAX & GST */}
          {activeTab === 'tax' && (
            <div className="w-full space-y-5">
              <div className="p-5 rounded-2xl border border-[var(--app-border)] bg-[var(--app-content-bg)] space-y-4 shadow-2xs">
                <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2.5">
                  <span className="text-xs font-bold text-[var(--app-accent)] uppercase tracking-wider flex items-center gap-2">
                    <Percent size={15} /> GST Taxability & Statutory Rates
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                  {/* Taxability */}
                  <div>
                    <label className="text-xs font-bold text-[var(--app-heading)] mb-1.5 block">Taxability Type *</label>
                    <select
                      value={formData.taxability}
                      onChange={(e) => setFormData(prev => ({ ...prev, taxability: e.target.value }))}
                      className="w-full h-10 rounded-xl border border-[var(--app-border)] px-3.5 text-xs font-bold outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[var(--app-accent)]"
                    >
                      <option value="Taxable">Taxable</option>
                      <option value="Exempt">Exempt</option>
                      <option value="Nil Rated">Nil Rated</option>
                      <option value="Non-GST">Non-GST</option>
                    </select>
                  </div>

                  {/* GST Rate */}
                  <div>
                    <label className="text-xs font-bold text-[var(--app-heading)] mb-1.5 block">GST Rate (%) *</label>
                    <select
                      value={formData.gstRate}
                      onChange={(e) => setFormData(prev => ({ ...prev, gstRate: e.target.value }))}
                      className="w-full h-10 rounded-xl border border-[var(--app-border)] px-3.5 text-xs font-bold outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[var(--app-accent)]"
                    >
                      <option value="18%">18% Standard</option>
                      <option value="12%">12% Reduced</option>
                      <option value="5%">5% Essential</option>
                      <option value="28%">28% Luxury</option>
                      <option value="0%">0% Exempt</option>
                    </select>
                  </div>

                  {/* HSN / SAC Code */}
                  <div>
                    <label className="text-xs font-bold text-[var(--app-heading)] mb-1.5 block">
                      {isGoods ? 'HSN Code' : 'SAC Code'}
                    </label>
                    {isGoods ? (
                      <input
                        type="text"
                        value={formData.hsnCode}
                        onChange={(e) => setFormData(prev => ({ ...prev, hsnCode: e.target.value }))}
                        placeholder="e.g. 84713010"
                        className="w-full h-10 rounded-xl border border-[var(--app-border)] px-3.5 text-xs font-mono font-semibold outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[var(--app-accent)]"
                      />
                    ) : (
                      <input
                        type="text"
                        value={formData.sacCode}
                        onChange={(e) => setFormData(prev => ({ ...prev, sacCode: e.target.value }))}
                        placeholder="e.g. 998313"
                        className="w-full h-10 rounded-xl border border-[var(--app-border)] px-3.5 text-xs font-mono font-semibold outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[var(--app-accent)]"
                      />
                    )}
                  </div>

                  {/* Cess Rate */}
                  <div>
                    <label className="text-xs font-bold text-[var(--app-heading)] mb-1.5 block">Cess Rate (%)</label>
                    <input
                      type="text"
                      value={formData.cessRate}
                      onChange={(e) => setFormData(prev => ({ ...prev, cessRate: e.target.value }))}
                      placeholder="e.g. 0%"
                      className="w-full h-10 rounded-xl border border-[var(--app-border)] px-3.5 text-xs outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[var(--app-accent)]"
                    />
                  </div>
                </div>

                {/* Statutory Tax Rate Breakup Display */}
                <div className="grid grid-cols-3 gap-4 p-3.5 rounded-xl bg-[var(--app-panel-bg)] border border-[var(--app-border)] text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-[var(--app-muted)] uppercase block">CGST (Central Tax)</span>
                    <span className="font-mono font-extrabold text-[var(--app-heading)]">{formData.cgstRate}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-[var(--app-muted)] uppercase block">SGST (State Tax)</span>
                    <span className="font-mono font-extrabold text-[var(--app-heading)]">{formData.sgstRate}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-[var(--app-muted)] uppercase block">IGST (Integrated Tax)</span>
                    <span className="font-mono font-extrabold text-[var(--app-accent)]">{formData.igstRate}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: PRICING & DISCOUNTS */}
          {activeTab === 'pricing' && (
            <div className="w-full space-y-5">
              <div className="p-5 rounded-2xl border border-[var(--app-border)] bg-[var(--app-content-bg)] space-y-4 shadow-2xs">
                <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2.5">
                  <span className="text-xs font-bold text-[var(--app-accent)] uppercase tracking-wider flex items-center gap-2">
                    <Tag size={15} /> Standard Rates, MRP & Default Trade Discounts
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                  {/* Purchase Rate */}
                  <div>
                    <label className="text-xs font-bold text-[var(--app-heading)] mb-1.5 block">Standard Purchase Rate (₹)</label>
                    <input
                      type="number"
                      step="any"
                      value={formData.purchaseRate}
                      onChange={(e) => setFormData(prev => ({ ...prev, purchaseRate: e.target.value }))}
                      placeholder="0.00"
                      className="w-full h-10 rounded-xl border border-[var(--app-border)] px-3.5 text-xs font-semibold outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[var(--app-accent)]"
                    />
                  </div>

                  {/* Sales Rate */}
                  <div>
                    <label className="text-xs font-bold text-[var(--app-heading)] mb-1.5 block">Standard Sales Rate (₹)</label>
                    <input
                      type="number"
                      step="any"
                      value={formData.salesRate}
                      onChange={(e) => setFormData(prev => ({ ...prev, salesRate: e.target.value }))}
                      placeholder="0.00"
                      className="w-full h-10 rounded-xl border border-[var(--app-border)] px-3.5 text-xs font-semibold outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[var(--app-accent)]"
                    />
                  </div>

                  {/* Min Sales Rate / Floor Price */}
                  <div>
                    <label className="text-xs font-bold text-[var(--app-heading)] mb-1.5 block">Minimum Selling Price (₹)</label>
                    <input
                      type="number"
                      step="any"
                      value={formData.minSalesRate}
                      onChange={(e) => setFormData(prev => ({ ...prev, minSalesRate: e.target.value }))}
                      placeholder="0.00"
                      className="w-full h-10 rounded-xl border border-[var(--app-border)] px-3.5 text-xs font-semibold outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[var(--app-accent)]"
                    />
                  </div>

                  {/* Default Trade Discount */}
                  <div>
                    <label className="text-xs font-bold text-[var(--app-heading)] mb-1.5 block">Default Trade Discount (%)</label>
                    <input
                      type="number"
                      step="any"
                      value={formData.tradeDiscountPercent}
                      onChange={(e) => setFormData(prev => ({ ...prev, tradeDiscountPercent: e.target.value }))}
                      placeholder="e.g. 5%"
                      className="w-full h-10 rounded-xl border border-[var(--app-border)] px-3.5 text-xs font-semibold outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[var(--app-accent)]"
                    />
                  </div>

                  {/* MRP (Dynamic) */}
                  {effectiveFeatures.mrp && (
                    <div>
                      <label className="text-xs font-bold text-[var(--app-heading)] mb-1.5 block flex items-center justify-between">
                        <span>Maximum Retail Price (₹)</span>
                        <span className="text-[10px] text-emerald-600 font-bold">MRP Active</span>
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={formData.mrp}
                        onChange={(e) => setFormData(prev => ({ ...prev, mrp: e.target.value }))}
                        placeholder="0.00"
                        className="w-full h-10 rounded-xl border border-[var(--app-border)] px-3.5 text-xs font-bold outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[var(--app-accent)]"
                      />
                    </div>
                  )}

                  {/* Standard Cost (Dynamic) */}
                  {effectiveFeatures.standardCost && (
                    <div>
                      <label className="text-xs font-bold text-[var(--app-heading)] mb-1.5 block flex items-center justify-between">
                        <span>Standard Cost Ref (₹)</span>
                        <span className="text-[10px] text-blue-600 font-bold">Active</span>
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={formData.standardCost}
                        onChange={(e) => setFormData(prev => ({ ...prev, standardCost: e.target.value }))}
                        placeholder="0.00"
                        className="w-full h-10 rounded-xl border border-[var(--app-border)] px-3.5 text-xs font-semibold outline-none bg-[var(--app-panel-bg)] text-[var(--app-heading)] focus:border-[var(--app-accent)]"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: ADVANCED SETTINGS (COMPACT ACCORDION & CONFIGURATION PANEL) */}
          {activeTab === 'advanced' && (
            <div className="w-full space-y-4 animate-in fade-in duration-200">
              
              {/* Header Bar: Presets & Controls */}
              <div className="p-4 rounded-2xl border border-[var(--app-border)] bg-[var(--app-content-bg)] space-y-3 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-bold text-[var(--app-heading)] uppercase tracking-wider flex items-center gap-2">
                      <Sparkles size={15} className="text-[var(--app-accent)]" />
                      Feature Configuration &amp; Industry Presets
                    </h3>
                    <p className="text-[11px] text-[var(--app-muted)] mt-0.5">
                      Configure active features across form tabs ({activeFeaturesCount} currently active).
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={expandAllGroups}
                      className="px-2.5 py-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] hover:bg-[var(--app-control-hover)] text-[var(--app-heading)] text-[11px] font-semibold transition-all cursor-pointer"
                    >
                      Expand All
                    </button>
                    <button
                      type="button"
                      onClick={collapseAllGroups}
                      className="px-2.5 py-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] hover:bg-[var(--app-control-hover)] text-[var(--app-heading)] text-[11px] font-semibold transition-all cursor-pointer"
                    >
                      Collapse All
                    </button>
                    {Object.keys(featureOverrides).length > 0 && (
                      <button
                        type="button"
                        onClick={handleResetOverrides}
                        className="px-2.5 py-1 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer hover:opacity-90 transition-all"
                      >
                        <RefreshCw size={11} />
                        <span>Reset ({Object.keys(featureOverrides).length})</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Preset Dropdown & Quick Search Filter */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] block">
                      Industry Preset
                    </label>
                    <select
                      value={businessType}
                      onChange={(e) => {
                        setBusinessType(e.target.value);
                        toast.success(`Business Type set to "${BUSINESS_TYPES.find(b => b.id === e.target.value)?.label}" defaults`);
                      }}
                      className="w-full h-9 rounded-xl border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-bold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] cursor-pointer"
                    >
                      {BUSINESS_TYPES.map(b => (
                        <option key={b.id} value={b.id}>{b.label} — {b.description}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] block">
                      Search / Filter Features
                    </label>
                    <div className="relative">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--app-muted)]" />
                      <input
                        type="text"
                        value={featureSearchQuery}
                        onChange={(e) => setFeatureSearchQuery(e.target.value)}
                        placeholder="Type to filter features..."
                        className="w-full h-9 rounded-xl border border-[var(--app-border)] bg-[var(--app-control-bg)] pl-8 pr-3 text-xs text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Collapsible Feature Accordion Groups */}
              <div className="space-y-3">
                {FEATURE_GROUPS.map((group) => {
                  const groupFeatures = group.features.map(k => STOCK_ITEM_FEATURES[k]).filter(Boolean);
                  const matchingFeatures = groupFeatures.filter(f => {
                    if (!featureSearchQuery.trim()) return true;
                    const q = featureSearchQuery.toLowerCase();
                    return f.label.toLowerCase().includes(q) || f.description.toLowerCase().includes(q);
                  });

                  if (matchingFeatures.length === 0) return null;

                  const isExpanded = expandedGroups[group.id] || !!featureSearchQuery.trim();
                  const activeInGroup = groupFeatures.filter(f => effectiveFeatures[f.key]).length;

                  return (
                    <div key={group.id} className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-content-bg)] overflow-hidden shadow-2xs transition-all">
                      {/* Accordion Header Bar */}
                      <button
                        type="button"
                        onClick={() => toggleGroup(group.id)}
                        className="w-full px-4 py-3 bg-[var(--app-panel-bg)] hover:bg-[var(--app-control-hover)]/60 flex items-center justify-between text-left transition-colors cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <h4 className="text-xs font-extrabold text-[var(--app-heading)] uppercase tracking-wider">{group.title}</h4>
                          <span className="text-[10px] text-[var(--app-muted)] truncate hidden sm:inline">— {group.description}</span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                            activeInGroup > 0
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                              : 'bg-[var(--app-control-bg)] border-[var(--app-border)] text-[var(--app-muted)]'
                          }`}>
                            {activeInGroup} / {groupFeatures.length} Active
                          </span>
                          {isExpanded ? <ChevronUp size={15} className="text-[var(--app-muted)]" /> : <ChevronDown size={15} className="text-[var(--app-muted)]" />}
                        </div>
                      </button>

                      {/* Accordion Content Body */}
                      {isExpanded && (
                        <div className="p-4 border-t border-[var(--app-border)] grid grid-cols-1 md:grid-cols-2 gap-3 animate-in fade-in duration-150">
                          {matchingFeatures.map((feature) => {
                            const featureKey = feature.key;
                            const isEnabled = Boolean(effectiveFeatures[featureKey]);
                            const isOverridden = featureOverrides[featureKey] !== undefined && featureOverrides[featureKey] !== null;
                            const isDisabled = feature.dependsOn && !effectiveFeatures[feature.dependsOn];

                            return (
                              <label
                                key={featureKey}
                                className={`p-3 rounded-xl border transition-all flex items-start gap-3 select-none ${
                                  isDisabled ? 'opacity-40 cursor-not-allowed bg-[var(--app-panel-bg)]' : 'cursor-pointer'
                                } ${
                                  isEnabled
                                    ? 'border-emerald-500/30 bg-emerald-500/10 text-[var(--app-heading)] shadow-2xs'
                                    : 'border-[var(--app-border)] bg-[var(--app-panel-bg)] hover:bg-[var(--app-control-hover)]/40 text-[var(--app-muted)]'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  disabled={isDisabled}
                                  checked={isEnabled}
                                  onChange={() => handleToggleFeature(featureKey)}
                                  className="w-4 h-4 mt-0.5 rounded accent-[var(--app-accent)] cursor-pointer"
                                />

                                <div className="space-y-0.5 flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-[var(--app-heading)] truncate">{feature.label}</span>
                                    <span className="text-[9px] font-extrabold text-[var(--app-muted)] bg-[var(--app-control-bg)] px-1.5 py-0.5 rounded border border-[var(--app-border)] uppercase">
                                      {feature.tab} Tab
                                    </span>
                                    {isOverridden && (
                                      <span className="text-[8px] font-extrabold text-amber-700 dark:text-amber-300 bg-amber-500/10 px-1 py-0.2 rounded border border-amber-500/20">
                                        Override
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-[var(--app-muted)]">{feature.description}</p>
                                  {isDisabled && (
                                    <p className="text-[9px] text-rose-500 font-bold">Requires {STOCK_ITEM_FEATURES[feature.dependsOn]?.label}</p>
                                  )}
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Manufacturing BOM Shortcut (If Active) */}
              {effectiveFeatures.bom && (
                <div className="p-4 rounded-2xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/60 dark:bg-indigo-950/30 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                      <ExternalLink size={16} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-indigo-950 dark:text-indigo-200">Bill of Materials (BOM) Feature Active</div>
                      <div className="text-[11px] text-indigo-700 dark:text-indigo-300">Link assembly components and raw materials for production.</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toast.info('Manage complete BOM component assemblies via the BOM Master module.')}
                    className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                  >
                    <span>Manage BOM</span>
                  </button>
                </div>
              )}

            </div>
          )}

        </div>

        {/* Footer Navigation Bar */}
        <div className="px-6 py-3.5 border-t border-[var(--app-border)] flex justify-between items-center bg-[var(--app-panel-bg)] shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={activeTabIndex === 0}
              onClick={handlePrevTab}
              className="px-3.5 py-1.5 rounded-xl border border-[var(--app-border)] hover:bg-[var(--app-control-hover)] text-[var(--app-heading)] text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft size={14} />
              <span>Previous</span>
            </button>
            <button
              type="button"
              disabled={activeTabIndex === TABS.length - 1}
              onClick={handleNextTab}
              className="px-3.5 py-1.5 rounded-xl border border-[var(--app-border)] hover:bg-[var(--app-control-hover)] text-[var(--app-heading)] text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl border border-[var(--app-border)] hover:bg-[var(--app-control-hover)] text-[var(--app-heading)] text-xs font-bold transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-1.5 rounded-full bg-[var(--app-accent)] text-white text-xs font-extrabold shadow-sm hover:opacity-95 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Save size={14} />
              <span>{isEdit ? 'Update Stock Item' : 'Save Stock Item'}</span>
            </button>
          </div>
        </div>

      </form>

      {/* FEATURE CONFIGURATION MODAL DIALOG */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-6 shadow-2xl space-y-5 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-3 shrink-0">
              <div className="flex items-center gap-2.5 text-[var(--app-heading)] font-extrabold text-sm">
                <Settings2 size={18} className="text-[var(--app-accent)]" />
                <span>Configure Item Master Features</span>
              </div>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="p-1 rounded-lg border border-[var(--app-border)] hover:bg-[var(--app-control-hover)] text-[var(--app-muted)] hover:text-[var(--app-heading)]"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Subheader & Presets */}
            <div className="space-y-3 shrink-0">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] block">Industry Business Preset</label>
                  <select
                    value={businessType}
                    onChange={(e) => {
                      setBusinessType(e.target.value);
                      toast.success(`Loaded defaults for ${BUSINESS_TYPES.find(b => b.id === e.target.value)?.label}`);
                    }}
                    className="h-9 px-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-control-bg)] text-xs font-bold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] cursor-pointer"
                  >
                    {BUSINESS_TYPES.map(b => (
                      <option key={b.id} value={b.id}>{b.label}</option>
                    ))}
                  </select>
                </div>

                <div className="relative flex-1 max-w-xs">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--app-muted)]" />
                  <input
                    type="text"
                    value={featureSearchQuery}
                    onChange={(e) => setFeatureSearchQuery(e.target.value)}
                    placeholder="Search feature..."
                    className="w-full h-9 rounded-xl border border-[var(--app-border)] bg-[var(--app-control-bg)] pl-9 pr-3 text-xs text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                  />
                </div>
              </div>
            </div>

            {/* Scrollable Feature Checkboxes */}
            <div className="flex-1 overflow-y-auto no-scrollbar space-y-4 pr-1">
              {FEATURE_GROUPS.map((group) => {
                const groupFeatures = group.features.map(k => STOCK_ITEM_FEATURES[k]).filter(Boolean);
                const matchingFeatures = groupFeatures.filter(f => {
                  if (!featureSearchQuery.trim()) return true;
                  const q = featureSearchQuery.toLowerCase();
                  return f.label.toLowerCase().includes(q) || f.description.toLowerCase().includes(q);
                });

                if (matchingFeatures.length === 0) return null;

                return (
                  <div key={group.id} className="rounded-xl border border-[var(--app-border)] bg-[var(--app-content-bg)] p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2">
                      <h4 className="text-xs font-bold text-[var(--app-heading)] uppercase tracking-wider">{group.title}</h4>
                      <span className="text-[10px] text-[var(--app-muted)] font-semibold">{group.description}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {matchingFeatures.map((feature) => {
                        const featureKey = feature.key;
                        const isEnabled = Boolean(effectiveFeatures[featureKey]);
                        const isOverridden = featureOverrides[featureKey] !== undefined && featureOverrides[featureKey] !== null;
                        const isDisabled = feature.dependsOn && !effectiveFeatures[feature.dependsOn];

                        return (
                          <label
                            key={featureKey}
                            className={`p-2.5 rounded-xl border transition-all flex items-start gap-2.5 select-none ${
                              isDisabled ? 'opacity-40 cursor-not-allowed bg-[var(--app-panel-bg)]' : 'cursor-pointer'
                            } ${
                              isEnabled
                                ? 'border-emerald-500/30 bg-emerald-500/10 text-[var(--app-heading)] font-semibold'
                                : 'border-[var(--app-border)] bg-[var(--app-panel-bg)] hover:bg-[var(--app-control-hover)]/40 text-[var(--app-muted)]'
                            }`}
                          >
                            <input
                              type="checkbox"
                              disabled={isDisabled}
                              checked={isEnabled}
                              onChange={() => handleToggleFeature(featureKey)}
                              className="w-4 h-4 mt-0.5 rounded accent-[var(--app-accent)] cursor-pointer"
                            />
                            <div className="space-y-0.5 flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-[var(--app-heading)] truncate">{feature.label}</span>
                                {isOverridden && (
                                  <span className="text-[8px] font-extrabold text-amber-700 dark:text-amber-300 bg-amber-500/10 px-1 py-0.2 rounded border border-amber-500/20">
                                    Override
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-[var(--app-muted)] line-clamp-1">{feature.description}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-[var(--app-border)] flex items-center justify-between shrink-0">
              <span className="text-xs font-semibold text-[var(--app-muted)]">
                Active Features: <strong className="text-[var(--app-accent)]">{activeFeaturesCount}</strong>
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowConfigModal(false);
                  toast.success('Configuration applied to form!');
                }}
                className="px-4 py-2 rounded-xl bg-[var(--app-accent)] text-white text-xs font-bold shadow-xs hover:opacity-90 transition-all"
              >
                Apply Configuration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
