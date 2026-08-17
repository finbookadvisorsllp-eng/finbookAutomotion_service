import React, { useState, useEffect, useMemo } from 'react';
import { 
  Package, Search, ChevronDown, Check, ArrowLeft, Save, 
  CheckCircle2, AlertCircle, Settings, Sliders, Plus, Trash2,
  Layers, FileText, Percent, Tag, ShieldCheck, X, Calendar,
  Coins, Box, Database, DollarSign, ListFilter, Sparkles, Building
} from 'lucide-react';
import { toast } from 'sonner';

/**
 * StockItemMasterForm
 * 7-Tab ERP Inventory Configuration Screen matching MongoDB nested structure.
 * Tabs: Basic Information, Units, Tax & HSN, Inventory, Pricing, BOM, Advanced.
 */
export default function StockItemMasterForm({
  initialData = null,
  isEdit = false,
  stockGroupsList = [],
  stockCategoriesList = [],
  unitsList = ['Nos', 'Kg', 'Gram', 'Litre', 'Meter', 'Box', 'Packet', 'Pcs', 'Set'],
  godownList = ['Main Godown', 'Warehouse A', 'Store Room', 'Factory Shopfloor'],
  stateList = ['Maharashtra', 'Delhi', 'Gujarat', 'Karnataka', 'Tamil Nadu', 'Uttar Pradesh', 'West Bengal'],
  stockItemsList = [],
  onSave,
  onClose
}) {
  // Active Tab State (1 to 7)
  const [activeTab, setActiveTab] = useState('basic');

  // Configure Form Modal State & Persistence
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [config, setConfig] = useState(() => {
    const saved = localStorage.getItem('stock_item_form_config');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      cfgUnits: true,
      cfgTax: true,
      cfgInventory: true,
      cfgPricing: true,
      cfgBom: true,
      cfgAdvanced: true
    };
  });

  useEffect(() => {
    localStorage.setItem('stock_item_form_config', JSON.stringify(config));
  }, [config]);

  // Form State
  const [formData, setFormData] = useState({
    // 1. BASIC INFORMATION & CLASSIFICATION
    itemName: '',
    itemCode: '',
    nameAliases: [],
    brand: '',
    description: '',
    manufacturer: '',
    modelNumber: '',
    partNumber: '',
    barcode: '',
    remarks: '',

    stockGroupId: '',
    stockGroupName: stockGroupsList.length > 0 ? (stockGroupsList[0].groupName || stockGroupsList[0].name || stockGroupsList[0]) : 'Primary / General',
    stockGroupPath: '',
    stockCategoryId: '',
    stockCategoryName: 'Not Applicable',
    status: 'ACTIVE',

    // 2. UNIT CONFIGURATION
    baseUnit: 'Nos',
    alternateUnit: 'Not Applicable',
    conversionFactor: '',
    vatBaseUnit: 'Nos',
    baseUnitSymbol: '',
    alternateUnitSymbol: '',
    decimalPlaces: 2,
    isSimpleUnit: true,
    isCompoundUnit: false,

    // 3. OPENING INVENTORY
    openingQuantity: 0,
    openingRate: 0,
    openingValue: 0,
    asOfDate: new Date().toISOString().split('T')[0],
    reorderLevel: 0,
    reorderQuantity: 0,
    minimumStockLevel: 0,
    maximumStockLevel: 0,
    negativeStockAllowed: false,

    // 4. PRICING & VALUATION
    purchasePrice: 0,
    salesPrice: 0,
    mrp: 0,
    standardCost: 0,
    standardSellingPrice: 0,
    priceEffectiveFrom: new Date().toISOString().split('T')[0],
    costingMethod: 'FIFO',
    valuationMethod: 'Last Sale Price',
    mrpFromDate: new Date().toISOString().split('T')[0],
    mrpTotalVerCount: 1,
    mrpVerCount: 1,

    // 5. GST & HSN DETAILS
    hsnCode: '',
    hsnClassificationName: '',
    hsnDescription: '',
    applicableFrom: new Date().toISOString().split('T')[0],
    srcOfHsnDetails: 'Specified in Stock Item',
    taxability: 'Taxable',
    gstRate: '18%',
    cgstRate: '9%',
    sgstRate: '9%',
    igstRate: '18%',
    cessRate: '0%',
    stateCessRate: '0%',
    sourceOfGstDetails: 'Specified in Stock Item',
    reverseChargeApplicable: false,

    // 6. TRACKING & BATCHES
    trackBatches: false,
    trackExpiry: false,
    trackManufacturingDate: false,
    trackSerialNumbers: false,

    // 7. PERISHABLE SETTINGS
    isPerishable: false,
    shelfLifeDays: 0,
    expiryWarningDays: 0,

    // 8. SERIAL NUMBER SETTINGS
    serialEnabled: false,
    serialPrefix: '',
    serialStartingNumber: '',

    // 9. BOM
    bomEnabled: false,
    bomName: '',
    bomBasicQty: 1,

    // 10. ADDITIONAL INFO
    countryOfOrigin: '',
    productType: '',
    notes: '',

    // 11. ADVANCED FLAGS
    isCostCenter: false,
    isCostTrackingOn: false,
    treatSalesAsManufactured: false,
    treatPurchaseAsConsumed: false,
    treatRejectAsScrap: false,
    allowUseOfExpiredItems: false,
    ignoreBatches: false
  });

  // Dynamic Repeatable Sub-Tables State
  const [batches, setBatches] = useState([]);
  const [mrpRates, setMrpRates] = useState([]);
  const [bomItems, setBomItems] = useState([]);

  // Dropdown search queries & states
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);

  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  // Errors
  const [errors, setErrors] = useState({});

  const GST_RATES = ['0%', '5%', '12%', '18%', '28%'];

  const fmtRate = (val, fallback = '0%') => {
    if (val === null || val === undefined || val === '') return fallback;
    const str = String(val).trim();
    if (str.endsWith('%')) return str;
    const num = parseFloat(str);
    return isNaN(num) ? fallback : `${num}%`;
  };

  // Pre-fill on Edit / Auto-generate code on Create
  useEffect(() => {
    if (isEdit && initialData) {
      setFormData(prev => ({
        ...prev,
        // SECTION 1: BASIC INFO & CLASSIFICATION
        itemName: initialData.itemName || initialData.name || '',
        itemCode: initialData.itemCode || initialData.code || '',
        nameAliases: initialData.nameAliases || [],
        brand: initialData.brand ?? initialData.basicInfo?.brand ?? '',
        description: initialData.basicInfo?.description ?? initialData.description ?? '',
        manufacturer: initialData.basicInfo?.manufacturer ?? initialData.manufacturer ?? '',
        modelNumber: initialData.basicInfo?.modelNumber ?? initialData.modelNumber ?? '',
        partNumber: initialData.basicInfo?.partNumber ?? initialData.partNumber ?? '',
        barcode: initialData.basicInfo?.barcode ?? initialData.barcode ?? '',
        remarks: initialData.basicInfo?.remarks ?? initialData.remarks ?? '',

        stockGroupId: initialData.stockGroupId || '',
        stockGroupName: initialData.stockGroupName || initialData.group || (stockGroupsList.length > 0 ? (typeof stockGroupsList[0] === 'string' ? stockGroupsList[0] : (stockGroupsList[0].groupName || stockGroupsList[0].name)) : 'Primary / General'),
        stockGroupPath: initialData.stockGroupPath || '',
        stockCategoryId: initialData.stockCategoryId || '',
        stockCategoryName: (initialData.stockCategoryName && initialData.stockCategoryName !== 'Not Applicable') ? initialData.stockCategoryName : (initialData.category && initialData.category !== 'Not Applicable') ? initialData.category : '',
        status: (initialData.status || 'ACTIVE').toUpperCase(),

        // SECTION 2: UNIT CONFIGURATION
        baseUnit: (typeof initialData.unit === 'object' ? initialData.unit.baseUnit : null) || initialData.baseUnit || (typeof initialData.unit === 'string' ? initialData.unit : null) || initialData.uom || 'Nos',
        alternateUnit: (typeof initialData.unit === 'object' ? initialData.unit.alternateUnit : null) || initialData.alternateUnit || 'Not Applicable',
        conversionFactor: (typeof initialData.unit === 'object' ? initialData.unit.conversionFactor : null) ?? initialData.conversionFactor ?? '',
        vatBaseUnit: (typeof initialData.unit === 'object' ? initialData.unit.vatBaseUnit : null) || initialData.vatBaseUnit || initialData.baseUnit || 'Nos',

        baseUnitSymbol: initialData.unit?.baseUnitSymbol ?? initialData.baseUnitSymbol ?? '',
        alternateUnitSymbol: initialData.unit?.alternateUnitSymbol ?? initialData.alternateUnitSymbol ?? '',
        decimalPlaces: initialData.unit?.decimalPlaces ?? initialData.decimalPlaces ?? 2,
        isSimpleUnit: initialData.unit?.isSimpleUnit ?? initialData.isSimpleUnit ?? true,
        isCompoundUnit: initialData.unit?.isCompoundUnit ?? initialData.isCompoundUnit ?? false,

        // SECTION 3: OPENING INVENTORY
        openingQuantity: initialData.inventory?.openingStock?.quantity ?? initialData.inventory?.openingStock?.qty ?? initialData.openingQty ?? initialData.openingQuantity ?? initialData.qty ?? 0,
        openingRate: initialData.inventory?.openingStock?.rate ?? initialData.purchasePrice ?? initialData.openingRate ?? initialData.rate ?? 0,
        openingValue: initialData.inventory?.openingStock?.value ?? initialData.inventory?.openingStock?.amount ?? initialData.openingValue ?? initialData.value ?? 0,
        asOfDate: initialData.inventory?.openingStock?.asOfDate ?? initialData.asOfDate ?? initialData.openingStockDate ?? new Date().toISOString().split('T')[0],
        reorderLevel: initialData.inventory?.reorderLevel ?? initialData.reorderLevel ?? 0,
        reorderQuantity: initialData.inventory?.reorderQuantity ?? initialData.reorderQuantity ?? 0,
        minimumStockLevel: initialData.inventory?.minimumStockLevel ?? initialData.minimumStockLevel ?? 0,
        maximumStockLevel: initialData.inventory?.maximumStockLevel ?? initialData.maximumStockLevel ?? 0,
        negativeStockAllowed: initialData.inventory?.negativeStockAllowed ?? initialData.flags?.ignoreNegativeStock ?? initialData.negativeStockAllowed ?? false,

        // SECTION 4: PRICING & VALUATION
        purchasePrice: initialData.purchasePrice ?? initialData.pricing?.purchasePrice ?? initialData.inventory?.openingStock?.rate ?? initialData.openingRate ?? 0,
        salesPrice: initialData.salesPrice ?? initialData.pricing?.salesPrice ?? 0,
        mrp: initialData.mrp ?? initialData.pricing?.mrp ?? initialData.pricing?.MRP?.rates?.[0]?.mrpRate ?? 0,
        standardCost: initialData.pricing?.standardCost ?? initialData.standardCost ?? 0,
        standardSellingPrice: initialData.pricing?.standardSellingPrice ?? initialData.standardSellingPrice ?? 0,
        priceEffectiveFrom: initialData.pricing?.priceEffectiveFrom ?? initialData.priceEffectiveFrom ?? new Date().toISOString().split('T')[0],
        costingMethod: initialData.pricing?.costingMethod ?? initialData.costingMethod ?? 'FIFO',
        valuationMethod: initialData.pricing?.valuationMethod ?? initialData.valuationMethod ?? 'Last Sale Price',
        mrpFromDate: initialData.pricing?.MRP?.fromDate ?? initialData.mrpFromDate ?? new Date().toISOString().split('T')[0],
        mrpTotalVerCount: initialData.pricing?.MRP?.totalVerCount ?? initialData.mrpTotalVerCount ?? 1,
        mrpVerCount: initialData.pricing?.MRP?.verCount ?? initialData.mrpVerCount ?? 1,

        // SECTION 5: GST & HSN
        hsnCode: initialData.hsnSacDetails?.hsnCode ?? initialData.hsnSacDetails?.hsn ?? initialData.hsnCode ?? initialData.hsn ?? '',
        hsnClassificationName: initialData.hsnSacDetails?.hsnClassificationName ?? initialData.hsnClassificationName ?? '',
        hsnDescription: initialData.hsnSacDetails?.description ?? initialData.hsnDescription ?? '',
        applicableFrom: initialData.hsnSacDetails?.applicableFrom ?? initialData.gstSettings?.applicableFrom ?? initialData.applicableFrom ?? new Date().toISOString().split('T')[0],
        srcOfHsnDetails: initialData.hsnSacDetails?.srcOfHsnDetails ?? initialData.hsnSacDetails?.srcOfHsnDetails ?? 'Specified in Stock Item',
        taxability: initialData.gstSettings?.taxability ?? initialData.taxabilityType ?? initialData.taxability ?? 'Taxable',
        gstRate: fmtRate(initialData.gstSettings?.gstRate ?? initialData.gstRate ?? initialData.gst, '18%'),
        cgstRate: fmtRate(initialData.gstSettings?.cgstRate ?? initialData.cgstRate, '9%'),
        sgstRate: fmtRate(initialData.gstSettings?.sgstRate ?? initialData.sgstRate, '9%'),
        igstRate: fmtRate(initialData.gstSettings?.igstRate ?? initialData.igstRate, '18%'),
        cessRate: fmtRate(initialData.gstSettings?.cessRate ?? initialData.cessRate, '0%'),
        stateCessRate: fmtRate(initialData.gstSettings?.stateCessRate ?? initialData.stateCessRate, '0%'),
        sourceOfGstDetails: initialData.gstSettings?.sourceOfGstDetails ?? initialData.sourceOfGstDetails ?? 'Specified in Stock Item',
        reverseChargeApplicable: initialData.gstSettings?.reverseChargeApplicable ?? initialData.reverseChargeApplicable ?? false,

        // SECTION 6: TRACKING
        trackBatches: initialData.tracking?.trackBatches ?? initialData.flags?.isBatchWise ?? initialData.trackBatches ?? false,
        trackExpiry: initialData.tracking?.trackExpiry ?? initialData.flags?.isPerishable ?? initialData.trackExpiry ?? false,
        trackManufacturingDate: initialData.tracking?.trackManufacturingDate ?? initialData.trackManufacturingDate ?? false,
        trackSerialNumbers: initialData.tracking?.trackSerialNumbers ?? initialData.trackSerialNumbers ?? false,

        // SECTION 7: PERISHABLE SETTINGS
        isPerishable: initialData.perishableSettings?.isPerishable ?? initialData.flags?.isPerishable ?? initialData.isPerishable ?? false,
        shelfLifeDays: initialData.perishableSettings?.shelfLifeDays ?? initialData.shelfLifeDays ?? 0,
        expiryWarningDays: initialData.perishableSettings?.expiryWarningDays ?? initialData.expiryWarningDays ?? 0,

        // SECTION 8: SERIAL NUMBER SETTINGS
        serialEnabled: initialData.serialNumberSettings?.enabled ?? initialData.serialEnabled ?? false,
        serialPrefix: initialData.serialNumberSettings?.prefix ?? initialData.serialPrefix ?? '',
        serialStartingNumber: initialData.serialNumberSettings?.startingNumber ?? initialData.serialStartingNumber ?? '',

        // SECTION 9: BOM
        bomEnabled: initialData.bom?.enabled ?? (initialData.BOM && initialData.BOM.length > 0) ?? false,
        bomName: initialData.bom?.bomName || initialData.BOM?.[0]?.componentListName || initialData.bomName || '',
        bomBasicQty: initialData.bom?.bomBasicQty || initialData.BOM?.[0]?.componentBasicQty || initialData.bomBasicQty || 1,

        // SECTION 10: ADDITIONAL INFO
        countryOfOrigin: initialData.additionalInfo?.countryOfOrigin ?? initialData.countryOfOrigin ?? '',
        productType: initialData.additionalInfo?.productType ?? initialData.productType ?? '',
        notes: initialData.additionalInfo?.notes ?? initialData.notes ?? '',

        // ADVANCED FLAGS
        isCostCenter: initialData.flags?.isCostCenter ?? initialData.isCostCenter ?? false,
        isCostTrackingOn: initialData.flags?.isCostTrackingOn ?? initialData.flags?.isCostTrachingOn ?? false,
        treatSalesAsManufactured: initialData.flags?.treatSalesAsManufactured ?? initialData.treatSalesAsManufactured ?? false,
        treatPurchaseAsConsumed: initialData.flags?.treatPurchaseAsConsumed ?? initialData.treatPurchaseAsConsumed ?? false,
        treatRejectAsScrap: initialData.flags?.treatRejectAsScrap ?? initialData.treatRejectAsScrap ?? false,
        allowUseOfExpiredItems: initialData.flags?.allowUseOfExpiredItems ?? initialData.allowUseOfExpiredItems ?? false,
        ignoreBatches: initialData.flags?.ignoreBatches ?? initialData.ignoreBatches ?? false,
        ignoreGodowns: initialData.flags?.ignoreGodowns ?? initialData.ignoreGodowns ?? false,
        calcOnMrp: initialData.flags?.calcOnMrp ?? initialData.calcOnMrp ?? false,
        isAdditionalTax: initialData.flags?.isAdditionalTax ?? initialData.isAdditionalTax ?? false,
        isCessExempted: initialData.flags?.isCessExempted ?? initialData.isCessExempted ?? false
      }));

      // Prefill Batches with Amount Auto-calculation
      if (initialData.batches && Array.isArray(initialData.batches) && initialData.batches.length > 0) {
        setBatches(initialData.batches.map((b, i) => {
          const q = parseFloat(b.quantity || b.qty) || 0;
          const r = parseFloat(b.rate) || 0;
          return {
            id: i + 1,
            batchName: b.batchName || `BATCH-${i + 1}`,
            manufacturingDate: b.manufacturingDate || b.mfdOn || '',
            expiryDate: b.expiryDate || b.expOn || '',
            quantity: q,
            rate: r,
            amount: parseFloat(b.amount || b.value) || (q * r)
          };
        }));
      }

      // Prefill MRP Rates
      const rawMrpRates = initialData.mrpRates || initialData.pricing?.MRP?.rates || [];
      if (Array.isArray(rawMrpRates) && rawMrpRates.length > 0) {
        setMrpRates(rawMrpRates.map((r, idx) => ({
          id: r.id || idx + 1,
          stateName: r.stateName || r.state || 'Maharashtra',
          mrpRate: r.mrpRate || r.mrp || 0
        })));
      }

      // Prefill BOM Components
      const rawBomComponents = initialData.bom?.components || initialData.BOM?.[0]?.items || [];
      if (Array.isArray(rawBomComponents) && rawBomComponents.length > 0) {
        setBomItems(rawBomComponents.map((b, i) => ({
          id: i + 1,
          stockItemId: b.stockItemId || '',
          stockItemName: b.stockItemName || b.name || '',
          quantity: parseFloat(b.quantity || b.qty) || 1,
          unit: b.unit || 'Nos',
          wastagePercent: parseFloat(b.wastagePercent) || 0
        })));
      }
    } else {
      const nextNum = Math.floor(1000 + Math.random() * 9000);
      setFormData(prev => ({
        ...prev,
        itemCode: `ITEM-${nextNum}`
      }));
    }
  }, [isEdit, initialData]);

  // Validation
  const validate = () => {
    const newErrors = {};
    if (!formData.itemName || !formData.itemName.trim()) {
      newErrors.itemName = 'Stock Item Name is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };



  // Save Handler
  const handleSubmit = (e) => {
    if (e) e.preventDefault();


    if (!validate()) {
      toast.error('Please fill required fields.');
      return;
    }

    // Build Complete MongoDB Compatible Document
    const payload = {
      _id: initialData?._id || initialData?.id,
      id: initialData?._id || initialData?.id,
      sourceCollection: initialData?.sourceCollection || 'stockitems_entry',
      itemName: (formData.itemName || '').trim(),
      itemCode: (formData.itemCode || '').trim(),
      name: (formData.itemName || '').trim(),
      code: (formData.itemCode || '').trim(),

      stockGroupId: formData.stockGroupId || 'GRP-001',
      stockGroupName: formData.stockGroupName,
      group: formData.stockGroupName,
      stockGroupPath: `Primary > ${formData.stockGroupName}`,

      stockCategoryId: formData.stockCategoryId || 'SCAT-001',
      stockCategoryName: formData.stockCategoryName,
      category: formData.stockCategoryName,

      // Top-level Basic Info
      brand: formData.brand || '',
      description: formData.description || '',
      manufacturer: formData.manufacturer || '',
      modelNumber: formData.modelNumber || '',
      partNumber: formData.partNumber || '',
      barcode: formData.barcode || '',
      remarks: formData.remarks || '',

      basicInfo: {
        brand: formData.brand || '',
        description: formData.description || '',
        manufacturer: formData.manufacturer || '',
        modelNumber: formData.modelNumber || '',
        partNumber: formData.partNumber || '',
        barcode: formData.barcode || '',
        remarks: formData.remarks || ''
      },

      // Top-level Units
      baseUnit: formData.baseUnit,
      alternateUnit: formData.alternateUnit,
      conversionFactor: formData.conversionFactor,
      vatBaseUnit: formData.vatBaseUnit,
      uom: formData.baseUnit,

      unit: {
        baseUnit: formData.baseUnit,
        alternateUnit: formData.alternateUnit,
        conversionFactor: formData.conversionFactor,
        vatBaseUnit: formData.vatBaseUnit,
        baseUnitSymbol: formData.baseUnitSymbol || '',
        alternateUnitSymbol: formData.alternateUnitSymbol || '',
        decimalPlaces: formData.decimalPlaces ?? 2,
        isSimpleUnit: formData.isSimpleUnit ?? true,
        isCompoundUnit: formData.isCompoundUnit ?? false
      },

      // GST & HSN
      hsnCode: formData.hsnCode || '',
      hsn: formData.hsnCode || '',
      hsnClassificationName: formData.hsnClassificationName || '',
      hsnDescription: formData.hsnDescription || '',
      applicableFrom: formData.applicableFrom,
      srcOfHsnDetails: formData.srcOfHsnDetails,
      taxability: formData.taxability,
      gstRate: formData.gstRate,
      cgstRate: formData.cgstRate,
      sgstRate: formData.sgstRate,
      igstRate: formData.igstRate,
      cessRate: formData.cessRate,
      stateCessRate: formData.stateCessRate,
      sourceOfGstDetails: formData.sourceOfGstDetails,
      reverseChargeApplicable: formData.reverseChargeApplicable,

      gstSettings: {
        taxability: formData.taxability,
        gstRate: formData.gstRate,
        cgstRate: formData.cgstRate,
        sgstRate: formData.sgstRate,
        igstRate: formData.igstRate,
        cessRate: formData.cessRate,
        stateCessRate: formData.stateCessRate,
        sourceOfGstDetails: formData.sourceOfGstDetails,
        reverseChargeApplicable: formData.reverseChargeApplicable
      },

      hsnSacDetails: {
        hsnCode: formData.hsnCode || '',
        hsn: formData.hsnCode || '',
        hsnClassificationName: formData.hsnClassificationName || '',
        description: formData.hsnDescription || '',
        applicableFrom: formData.applicableFrom,
        srcOfHsnDetails: formData.srcOfHsnDetails
      },

      // Opening Stock & Inventory Levels
      openingQuantity: parseFloat(formData.openingQuantity) || 0,
      openingRate: parseFloat(formData.openingRate) || 0,
      openingValue: parseFloat(formData.openingValue) || 0,
      asOfDate: formData.asOfDate,
      reorderLevel: parseFloat(formData.reorderLevel) || 0,
      reorderQuantity: parseFloat(formData.reorderQuantity) || 0,
      minimumStockLevel: parseFloat(formData.minimumStockLevel) || 0,
      maximumStockLevel: parseFloat(formData.maximumStockLevel) || 0,
      negativeStockAllowed: formData.negativeStockAllowed,

      inventory: {
        openingStock: {
          quantity: parseFloat(formData.openingQuantity) || 0,
          rate: parseFloat(formData.openingRate) || 0,
          value: parseFloat(formData.openingValue) || 0,
          asOfDate: formData.asOfDate
        },
        reorderLevel: parseFloat(formData.reorderLevel) || 0,
        reorderQuantity: parseFloat(formData.reorderQuantity) || 0,
        minimumStockLevel: parseFloat(formData.minimumStockLevel) || 0,
        maximumStockLevel: parseFloat(formData.maximumStockLevel) || 0,
        negativeStockAllowed: formData.negativeStockAllowed
      },

      // Tracking
      tracking: {
        trackBatches: formData.trackBatches,
        trackExpiry: formData.trackExpiry,
        trackManufacturingDate: formData.trackManufacturingDate,
        trackSerialNumbers: formData.trackSerialNumbers
      },

      // Perishable & Serial Settings
      perishableSettings: {
        isPerishable: formData.isPerishable,
        shelfLifeDays: parseFloat(formData.shelfLifeDays) || 0,
        expiryWarningDays: parseFloat(formData.expiryWarningDays) || 0
      },

      serialNumberSettings: {
        enabled: formData.serialEnabled,
        prefix: formData.serialPrefix || '',
        startingNumber: formData.serialStartingNumber || ''
      },

      // Pricing
      purchasePrice: parseFloat(formData.purchasePrice) || 0,
      salesPrice: parseFloat(formData.salesPrice) || 0,
      mrp: parseFloat(formData.mrp) || (mrpRates.length > 0 ? parseFloat(mrpRates[0].mrpRate) : 0) || 0,
      standardCost: parseFloat(formData.standardCost) || 0,
      standardSellingPrice: parseFloat(formData.standardSellingPrice) || 0,
      priceEffectiveFrom: formData.priceEffectiveFrom,
      costingMethod: formData.costingMethod,
      valuationMethod: formData.valuationMethod,
      mrpRates: mrpRates,
      mrpFromDate: formData.mrpFromDate,
      mrpTotalVerCount: formData.mrpTotalVerCount,
      mrpVerCount: formData.mrpVerCount,

      pricing: {
        purchasePrice: parseFloat(formData.purchasePrice) || 0,
        salesPrice: parseFloat(formData.salesPrice) || 0,
        mrp: parseFloat(formData.mrp) || (mrpRates.length > 0 ? parseFloat(mrpRates[0].mrpRate) : 0) || 0,
        standardCost: parseFloat(formData.standardCost) || 0,
        standardSellingPrice: parseFloat(formData.standardSellingPrice) || 0,
        priceEffectiveFrom: formData.priceEffectiveFrom,
        costingMethod: formData.costingMethod,
        valuationMethod: formData.valuationMethod,
        MRP: {
          fromDate: formData.mrpFromDate,
          totalVerCount: formData.mrpTotalVerCount,
          verCount: formData.mrpVerCount,
          rates: mrpRates
        }
      },

      // BOM
      bom: {
        enabled: formData.bomEnabled,
        bomName: formData.bomName,
        bomBasicQty: parseFloat(formData.bomBasicQty) || 1,
        components: bomItems
      },

      BOM: bomItems && bomItems.length > 0 ? [
        {
          componentListName: formData.bomName || 'Assembly BOM',
          componentBasicQty: parseFloat(formData.bomBasicQty) || 1,
          items: bomItems
        }
      ] : [],

      batches: formData.trackBatches ? batches : [],

      // Additional Info
      countryOfOrigin: formData.countryOfOrigin || '',
      productType: formData.productType || '',
      notes: formData.notes || '',

      additionalInfo: {
        countryOfOrigin: formData.countryOfOrigin || '',
        productType: formData.productType || '',
        notes: formData.notes || ''
      },

      flags: {
        isBatchWise: formData.trackBatches || formData.isBatchWise,
        isPerishable: formData.isPerishable,
        isSerialWise: formData.isSerialWise,
        ignoreNegativeStock: formData.ignoreNegativeStock,
        isCostCenter: formData.isCostCenter,
        isCostTrackingOn: formData.isCostTrackingOn,
        treatSalesAsManufactured: formData.treatSalesAsManufactured,
        treatPurchaseAsConsumed: formData.treatPurchaseAsConsumed,
        treatRejectAsScrap: formData.treatRejectAsScrap,
        allowUseOfExpiredItems: formData.allowUseOfExpiredItems,
        ignoreBatches: formData.ignoreBatches,
        ignoreGodowns: formData.ignoreGodowns,
        calcOnMrp: formData.calcOnMrp,
        isAdditionalTax: formData.isAdditionalTax,
        isCessExempted: formData.isCessExempted
      },

      status: formData.status
    };

    onSave(payload);
    toast.success(isEdit ? 'Stock Item Master updated!' : 'Stock Item Master created!');
  };


  // Field Update Helper

  const updateField = (key, val) => {
    setFormData(prev => {
      const next = { ...prev, [key]: val };

      if (key === 'alternateUnit') {
        if (['not applicable', 'none', 'n/a', ''].includes(String(val).trim().toLowerCase())) {
          next.conversionFactor = '';
        }
      }

      if (key === 'openingQuantity' || key === 'openingRate') {

        const qty = parseFloat(key === 'openingQuantity' ? val : prev.openingQuantity) || 0;
        const rate = parseFloat(key === 'openingRate' ? val : prev.openingRate) || 0;
        next.openingValue = Math.round(qty * rate * 100) / 100;
      }

      if (key === 'gstRate' || key === 'taxability') {
        const rateNum = parseFloat((key === 'gstRate' ? val : prev.gstRate).replace('%', '')) || 0;
        const taxable = (key === 'taxability' ? val : prev.taxability) === 'Taxable';
        if (!taxable || rateNum === 0) {
          next.cgstRate = '0%';
          next.sgstRate = '0%';
          next.igstRate = '0%';
        } else {
          const half = (rateNum / 2).toFixed(1).replace('.0', '');
          next.cgstRate = `${half}%`;
          next.sgstRate = `${half}%`;
          next.igstRate = `${rateNum}%`;
        }
      }

      return next;
    });

    if (errors[key]) {
      setErrors(prev => ({ ...prev, [key]: null }));
    }
  };

  // Batch Handlers
  const addBatchRow = () => {
    setBatches(prev => [
      ...prev,
      {
        id: Date.now(),
        batchName: `BATCH-00${prev.length + 1}`,
        godownName: godownList[0] || 'Main Godown',
        mfdOn: '',
        expiryPeriod: '12 Months',
        openingBalance: 0,
        openingRate: 0,
        openingValue: 0
      }
    ]);
  };

  const updateBatchRow = (id, field, val) => {
    setBatches(prev => prev.map(b => {
      if (b.id === id) {
        const next = { ...b, [field]: val };
        if (field === 'openingBalance' || field === 'openingRate') {
          const qty = parseFloat(field === 'openingBalance' ? val : b.openingBalance) || 0;
          const rate = parseFloat(field === 'openingRate' ? val : b.openingRate) || 0;
          next.openingValue = Math.round(qty * rate * 100) / 100;
        }
        return next;
      }
      return b;
    }));
  };

  const deleteBatchRow = (id) => {
    setBatches(prev => prev.filter(b => b.id !== id));
  };

  // MRP Rate Handlers
  const addMrpRow = () => {
    setMrpRates(prev => [
      ...prev,
      { id: Date.now(), stateName: stateList[0] || 'Maharashtra', priorStateName: 'All States', mrpRate: 0 }
    ]);
  };

  const updateMrpRow = (id, field, val) => {
    setMrpRates(prev => prev.map(r => (r.id === id ? { ...r, [field]: val } : r)));
  };

  const deleteMrpRow = (id) => {
    setMrpRates(prev => prev.filter(r => r.id !== id));
  };

  // BOM Handlers
  const addBomItemRow = () => {
    setBomItems(prev => [
      ...prev,
      {
        id: Date.now(),
        stockItemName: stockItemsList[0]?.name || 'Raw Component',
        natureOfItem: 'Component',
        godownName: godownList[0] || 'Main Godown',
        actualQty: 1,
        addlCostAllocPerc: 0
      }
    ]);
  };

  const updateBomItemRow = (id, field, val) => {
    setBomItems(prev => prev.map(b => (b.id === id ? { ...b, [field]: val } : b)));
  };

  const deleteBomItemRow = (id) => {
    setBomItems(prev => prev.filter(b => b.id !== id));
  };

  // Filtered Stock Groups
  const filteredGroups = useMemo(() => {
    const list = Array.isArray(stockGroupsList) ? stockGroupsList : [];
    const groupNames = list.map(g => typeof g === 'string' ? g : (g.groupName || g.stockGroupName || g.name || '')).filter(Boolean);
    const options = Array.from(new Set(groupNames.length > 0 ? groupNames : ['Primary / General']));
    const q = groupSearchQuery.toLowerCase().trim();
    if (!q) return options;
    return options.filter(n => n.toLowerCase().includes(q));
  }, [stockGroupsList, groupSearchQuery]);

  // Derived Safe Unit Options
  const unitOptions = useMemo(() => {
    const list = Array.isArray(unitsList) ? unitsList : [];
    const extracted = list.map(u => {
      if (typeof u === 'string') return u.trim();
      if (typeof u === 'object' && u !== null) {
        return (u.unitName || u.symbol || u.name || '').trim();
      }
      return '';
    }).filter(Boolean);

    const defaults = ['Nos', 'Kg', 'Kilogram', 'Gram', 'Grams', 'Litre', 'Meter', 'Box', 'Packet', 'Pcs', 'Set'];
    const activeFormUnits = [formData?.baseUnit, formData?.alternateUnit, formData?.vatBaseUnit]
      .filter(u => u && !['not applicable', 'none', 'n/a', ''].includes(String(u).trim().toLowerCase()));

    return Array.from(new Set([...extracted, ...defaults, ...activeFormUnits]));
  }, [unitsList, formData?.baseUnit, formData?.alternateUnit, formData?.vatBaseUnit]);


  // Handle Stock Group Selection with Parent Link
  const handleSelectGroup = (grpName) => {
    const list = Array.isArray(stockGroupsList) ? stockGroupsList : [];
    const grpObj = list.find(g => (typeof g === 'string' ? g : (g.groupName || g.stockGroupName || g.name)) === grpName);
    const parentGrp = typeof grpObj === 'object' && grpObj ? (grpObj.parentGroup || grpObj.parentGroupName || grpObj.parent || 'Primary') : 'Primary';
    const fullPath = parentGrp && parentGrp !== 'Primary' ? `${parentGrp} > ${grpName}` : `Primary > ${grpName}`;
    const grpId = typeof grpObj === 'object' && grpObj ? (grpObj._id || grpObj.id || grpObj.stockGroupId || 'GRP-001') : 'GRP-001';

    setFormData(prev => ({
      ...prev,
      stockGroupName: grpName,
      stockGroupId: grpId,
      stockGroupPath: fullPath
    }));
    setShowGroupDropdown(false);
    setGroupSearchQuery('');
  };


  // Filtered Stock Categories
  const filteredCategories = useMemo(() => {
    const catNames = stockCategoriesList.map(c => typeof c === 'string' ? c : (c.stockCategoryName || c.name || '')).filter(Boolean);
    const options = Array.from(new Set(['Not Applicable', ...catNames]));
    const q = categorySearchQuery.toLowerCase().trim();
    if (!q) return options;
    return options.filter(n => n.toLowerCase().includes(q));
  }, [stockCategoriesList, categorySearchQuery]);

  // Tabs Definition
  const TABS = [
    { id: 'basic', label: 'Basic Info', icon: Package },
    { id: 'units', label: 'Units', icon: Layers, enabled: config.cfgUnits },
    { id: 'tax', label: 'Tax & HSN', icon: Percent, enabled: config.cfgTax },
    { id: 'inventory', label: 'Inventory', icon: FileText, enabled: config.cfgInventory },
    { id: 'pricing', label: 'Pricing', icon: DollarSign, enabled: config.cfgPricing },
    { id: 'bom', label: 'BOM', icon: Box, enabled: config.cfgBom },
    { id: 'advanced', label: 'Advanced', icon: Sliders, enabled: config.cfgAdvanced }
  ].filter(t => t.enabled !== false);

  return (
    <div className="h-full w-full flex flex-col bg-[var(--app-content-bg)] text-[var(--app-text)] font-sans overflow-hidden animate-in fade-in duration-300">
      
      {/* 1. STICKY TOP HEADER BAR */}
      <div className="shrink-0 px-6 py-3 border-b border-[var(--app-border)] bg-[var(--app-panel-bg)] flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg border border-[var(--app-border)] hover:bg-[var(--app-control-hover)] text-[var(--app-text)] transition-colors"
            title="Back to Stock Items List"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--app-muted)]">
              <span>Masters</span>
              <span>/</span>
              <span>Stock Item</span>
              <span>/</span>
              <span className="text-[var(--app-accent)] font-bold">{isEdit ? 'Edit' : 'Create'}</span>
            </div>
            <h1 className="text-base md:text-xl font-extrabold text-[var(--app-heading)] tracking-tight">
              {isEdit ? 'Edit Stock Item Master' : 'Create Stock Item Master'}
            </h1>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowConfigModal(true)}
            className="px-3.5 py-1.5 rounded-lg border border-[var(--app-accent-soft)] bg-[var(--app-accent-soft)] text-[var(--app-accent)] hover:opacity-90 transition-all text-xs font-bold flex items-center gap-1.5 shadow-2xs"
            title="Configure form tab visibility"
          >
            <Settings size={14} />
            <span>Configure Form</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg border border-[var(--app-border)] text-xs font-semibold text-[var(--app-text)] hover:bg-[var(--app-control-hover)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-4 py-1.5 rounded-lg bg-[var(--app-accent)] text-white text-xs font-bold shadow-xs hover:opacity-90 transition-all flex items-center gap-1.5"
          >
            <CheckCircle2 size={14} />
            <span>{isEdit ? 'Update Stock Item' : 'Save Stock Item'}</span>
          </button>
        </div>
      </div>

      {/* 2. COMPACT 7-TAB HORIZONTAL NAVIGATION BAR */}
      <div className="shrink-0 px-6 bg-[var(--app-panel-bg)] border-b border-[var(--app-border)] flex items-center gap-1 overflow-x-auto no-scrollbar pt-2">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 border-b-2 whitespace-nowrap ${
                isActive 
                  ? 'border-[var(--app-accent)] bg-[var(--app-content-bg)] text-[var(--app-accent)] shadow-2xs' 
                  : 'border-transparent text-[var(--app-muted)] hover:text-[var(--app-heading)] hover:bg-[var(--app-control-hover)]'
              }`}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 3. TAB FORM CONTENT BODY */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-6 w-full space-y-5">

        {/* ========================================================================= */}
        {/* TAB 1: BASIC INFORMATION                                                  */}
        {/* ========================================================================= */}
        {activeTab === 'basic' && (
          <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-5 shadow-xs space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2.5">
              <div className="flex items-center gap-2 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
                <Package size={15} />
                <span>BASIC ITEM IDENTIFICATION</span>
              </div>
              <span className="text-[10px] font-semibold text-[var(--app-muted)]">* Required fields</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
              {/* Stock Item Name * */}
              <div className="md:col-span-2 space-y-1">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                  Stock Item Name <span className="text-red-500">*</span>
                </label>
                <input
                  autoFocus
                  type="text"
                  value={formData.itemName}
                  onChange={(e) => updateField('itemName', e.target.value)}
                  placeholder="e.g. Laptop Dell Inspiron 15, 100A TP MCCB, Plastic Bottle 500 ML"
                  className={`w-full h-9.5 rounded-lg border bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] outline-none transition-all ${
                    errors.itemName 
                      ? 'border-red-500 focus:border-red-500 ring-1 ring-red-500/20' 
                      : 'border-[var(--app-border)] focus:border-[var(--app-accent)]'
                  }`}
                />
                {errors.itemName && (
                  <p className="text-[10px] font-bold text-red-500 flex items-center gap-1 mt-0.5">
                    <AlertCircle size={11} />
                    <span>{errors.itemName}</span>
                  </p>
                )}
              </div>

              {/* Item Code */}
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                  Item Code / SKU
                </label>
                <input
                  type="text"
                  value={formData.itemCode}
                  onChange={(e) => updateField('itemCode', e.target.value.toUpperCase())}
                  placeholder="e.g. ITEM-0001"
                  className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-mono font-bold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                />
              </div>

              {/* Status */}
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => updateField('status', e.target.value)}
                  className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2.5 text-xs font-bold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>

              {/* Stock Group * */}
              <div className="md:col-span-2 space-y-1 relative">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                  Stock Group <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowGroupDropdown(p => !p)}
                    className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] flex items-center justify-between outline-none hover:border-[var(--app-accent)]"
                  >
                    <span className="truncate">{formData.stockGroupName}</span>
                    <ChevronDown size={14} className="text-[var(--app-muted)] shrink-0" />
                  </button>

                  {showGroupDropdown && (
                    <div className="absolute left-0 right-0 top-10 z-30 rounded-xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] shadow-xl p-2 space-y-2">
                      <div className="relative">
                        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--app-muted)]" />
                        <input
                          type="text"
                          value={groupSearchQuery}
                          onChange={(e) => setGroupSearchQuery(e.target.value)}
                          placeholder="Search stock group..."
                          className="w-full h-7.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] pl-7 pr-2 text-xs text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                        />
                      </div>

                      <div className="max-h-40 overflow-y-auto no-scrollbar space-y-0.5">
                        {filteredGroups.map(grpName => (
                          <button
                            key={grpName}
                            type="button"
                            onClick={() => handleSelectGroup(grpName)}

                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                              formData.stockGroupName === grpName 
                                ? 'bg-[var(--app-accent-soft)] text-[var(--app-accent)] font-bold' 
                                : 'hover:bg-[var(--app-control-hover)] text-[var(--app-text)]'
                            }`}
                          >
                            <span>{grpName}</span>
                            {formData.stockGroupName === grpName && <Check size={12} />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Brand */}
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                  Brand / Make
                </label>
                <input
                  type="text"
                  value={formData.brand}
                  onChange={(e) => updateField('brand', e.target.value)}
                  placeholder="e.g. Dell, Samsung, Finbook"
                  className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                />
              </div>

              {/* Manufacturer */}
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                  Manufacturer
                </label>
                <input
                  type="text"
                  value={formData.manufacturer}
                  onChange={(e) => updateField('manufacturer', e.target.value)}
                  placeholder="e.g. Dell India Pvt Ltd"
                  className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                />
              </div>

              {/* Model Number */}
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                  Model Number
                </label>
                <input
                  type="text"
                  value={formData.modelNumber}
                  onChange={(e) => updateField('modelNumber', e.target.value)}
                  placeholder="e.g. Inspiron-15-3000"
                  className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                />
              </div>

              {/* Part Number */}
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                  Part Number
                </label>
                <input
                  type="text"
                  value={formData.partNumber}
                  onChange={(e) => updateField('partNumber', e.target.value)}
                  placeholder="e.g. PN-990011"
                  className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                />
              </div>

              {/* Barcode */}
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                  Barcode / EAN
                </label>
                <input
                  type="text"
                  value={formData.barcode}
                  onChange={(e) => updateField('barcode', e.target.value)}
                  placeholder="e.g. 8901234567890"
                  className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-mono font-bold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                />
              </div>

              {/* Description */}
              <div className="md:col-span-2 space-y-1">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                  Item Description
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  placeholder="Detailed description of the stock item"
                  className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                />
              </div>

              {/* Remarks */}
              <div className="md:col-span-2 space-y-1">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                  Remarks / Notes
                </label>
                <input
                  type="text"
                  value={formData.remarks}
                  onChange={(e) => updateField('remarks', e.target.value)}
                  placeholder="Internal notes or handling instructions"
                  className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                />
              </div>
            </div>
          </div>

        )}

        {/* ========================================================================= */}
        {/* TAB 2: UNIT CONFIGURATION                                                 */}
        {/* ========================================================================= */}
        {activeTab === 'units' && (
          <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-5 shadow-xs space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2.5">
              <div className="flex items-center gap-2 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
                <Layers size={15} />
                <span>UNIT & MEASUREMENT CONFIGURATION</span>
              </div>
              <span className="text-[10px] font-medium text-[var(--app-muted)]">Unit Master Mapping</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {/* Base Unit * */}
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                  Base Unit <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.baseUnit}
                  onChange={(e) => updateField('baseUnit', e.target.value)}
                  className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2.5 text-xs font-bold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                >
                  {unitOptions.map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>

              {/* Alternate Unit */}
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                  Alternate Unit
                </label>
                <select
                  value={formData.alternateUnit}
                  onChange={(e) => updateField('alternateUnit', e.target.value)}
                  className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2.5 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                >
                  <option value="Not Applicable">Not Applicable</option>
                  {unitOptions.map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>

              {/* Conversion Factor */}
              {formData.alternateUnit && !['not applicable', 'none', 'n/a', ''].includes(String(formData.alternateUnit).trim().toLowerCase()) && (
                <div className="space-y-1 animate-in fade-in duration-200">
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                    Conversion Factor
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[var(--app-muted)] whitespace-nowrap">1 {formData.baseUnit} =</span>
                    <input
                      type="number"
                      value={formData.conversionFactor}
                      onChange={(e) => updateField('conversionFactor', e.target.value)}
                      placeholder="e.g. 1000"
                      className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-bold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                    />
                    <span className="text-xs font-semibold text-[var(--app-muted)]">{formData.alternateUnit}</span>
                  </div>
                </div>
              )}


              {/* Base Unit Symbol */}
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                  Base Unit Symbol
                </label>
                <input
                  type="text"
                  value={formData.baseUnitSymbol}
                  onChange={(e) => updateField('baseUnitSymbol', e.target.value)}
                  placeholder="e.g. kg, pcs, g"
                  className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                />
              </div>

              {/* Alternate Unit Symbol */}
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                  Alternate Unit Symbol
                </label>
                <input
                  type="text"
                  value={formData.alternateUnitSymbol}
                  onChange={(e) => updateField('alternateUnitSymbol', e.target.value)}
                  placeholder="e.g. g, box, pkt"
                  className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                />
              </div>

              {/* Decimal Places */}
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                  Decimal Places
                </label>
                <input
                  type="number"
                  min="0"
                  max="4"
                  value={formData.decimalPlaces}
                  onChange={(e) => updateField('decimalPlaces', e.target.value)}
                  placeholder="2"
                  className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-bold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                />
              </div>

              {/* Unit Type Switches */}
              <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <label className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] cursor-pointer select-none">
                  <span className="font-semibold text-[var(--app-heading)] text-[11px]">Simple Unit</span>
                  <input
                    type="checkbox"
                    checked={formData.isSimpleUnit}
                    onChange={(e) => updateField('isSimpleUnit', e.target.checked)}
                    className="w-4 h-4 rounded accent-[var(--app-accent)] cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] cursor-pointer select-none">
                  <span className="font-semibold text-[var(--app-heading)] text-[11px]">Compound Unit</span>
                  <input
                    type="checkbox"
                    checked={formData.isCompoundUnit}
                    onChange={(e) => updateField('isCompoundUnit', e.target.checked)}
                    className="w-4 h-4 rounded accent-[var(--app-accent)] cursor-pointer"
                  />
                </label>
              </div>
            </div>
          </div>

        )}

        {/* ========================================================================= */}
        {/* TAB 3: TAX & HSN                                                          */}
        {/* ========================================================================= */}
        {activeTab === 'tax' && (
          <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-5 shadow-xs space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2.5">
              <div className="flex items-center gap-2 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
                <Percent size={15} />
                <span>GST & HSN / SAC TAX CONFIGURATION</span>
              </div>
              <span className="text-[10px] font-medium text-[var(--app-muted)]">Automatic Tax Splits</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {/* HSN Code */}
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                  HSN / SAC Code
                </label>
                <input
                  type="text"
                  value={formData.hsnCode}
                  onChange={(e) => updateField('hsnCode', e.target.value)}
                  placeholder="e.g. 84713010, 3923"
                  className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-mono font-bold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                />
              </div>

              {/* HSN Classification Name */}
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                  HSN Classification Name
                </label>
                <input
                  type="text"
                  value={formData.hsnClassificationName}
                  onChange={(e) => updateField('hsnClassificationName', e.target.value)}
                  placeholder="e.g. Computer Equipment & Accessories"
                  className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                />
              </div>

              {/* Applicable From Date */}
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                  Applicable From
                </label>
                <input
                  type="date"
                  value={formData.applicableFrom}
                  onChange={(e) => updateField('applicableFrom', e.target.value)}
                  className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                />
              </div>

              {/* GST Taxability */}
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                  GST Taxability
                </label>
                <select
                  value={formData.taxability}
                  onChange={(e) => updateField('taxability', e.target.value)}
                  className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2.5 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                >
                  <option value="Taxable">Taxable</option>
                  <option value="Exempt">Exempt</option>
                  <option value="Nil Rated">Nil Rated</option>
                </select>
              </div>

              {/* GST Rate */}
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                  GST Rate
                </label>
                <select
                  disabled={formData.taxability !== 'Taxable'}
                  value={formData.gstRate}
                  onChange={(e) => updateField('gstRate', e.target.value)}
                  className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2.5 text-xs font-bold text-[var(--app-accent)] outline-none focus:border-[var(--app-accent)] disabled:opacity-50"
                >
                  {GST_RATES.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {/* State Cess Rate */}
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                  State Cess Rate (%)
                </label>
                <input
                  type="text"
                  value={formData.stateCessRate}
                  onChange={(e) => updateField('stateCessRate', e.target.value)}
                  placeholder="0%"
                  className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                />
              </div>

              {/* Source of GST Details */}
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                  Source of GST Details
                </label>
                <select
                  value={formData.sourceOfGstDetails}
                  onChange={(e) => updateField('sourceOfGstDetails', e.target.value)}
                  className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2.5 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                >
                  <option value="Specified in Stock Item">Specified in Stock Item</option>
                  <option value="Use Company Details">Use Company Details</option>
                  <option value="Specified in Stock Group">Specified in Stock Group</option>
                </select>
              </div>

              {/* Reverse Charge Applicable */}
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2.5 p-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] cursor-pointer w-full h-9.5">
                  <input
                    type="checkbox"
                    checked={formData.reverseChargeApplicable}
                    onChange={(e) => updateField('reverseChargeApplicable', e.target.checked)}
                    className="w-4 h-4 rounded accent-[var(--app-accent)] cursor-pointer"
                  />
                  <span className="font-semibold text-[var(--app-heading)] text-[11px]">Reverse Charge Applicable (RCM)</span>
                </label>
              </div>

              {/* HSN Description */}
              <div className="md:col-span-3 space-y-1">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                  HSN / SAC Description
                </label>
                <input
                  type="text"
                  value={formData.hsnDescription}
                  onChange={(e) => updateField('hsnDescription', e.target.value)}
                  placeholder="Detailed description of HSN classification or goods category"
                  className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                />
              </div>
            </div>

            {formData.taxability === 'Taxable' && (
              <div className="p-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-control-bg)] flex items-center justify-between text-xs font-semibold text-[var(--app-muted)]">
                <span>Auto Calculated Tax Split:</span>
                <div className="flex items-center gap-5">
                  <span>CGST: <strong className="text-[var(--app-heading)]">{formData.cgstRate}</strong></span>
                  <span>SGST: <strong className="text-[var(--app-heading)]">{formData.sgstRate}</strong></span>
                  <span>IGST: <strong className="text-[var(--app-accent)]">{formData.igstRate}</strong></span>
                  <span>Cess: <strong className="text-[var(--app-heading)]">{formData.cessRate}</strong></span>
                </div>
              </div>
            )}
          </div>

        )}

        {/* ========================================================================= */}
        {/* TAB 4: INVENTORY & BATCHES                                                */}
        {/* ========================================================================= */}
        {activeTab === 'inventory' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Opening Stock Card */}
            <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2.5">
                <div className="flex items-center gap-2 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
                  <FileText size={15} />
                  <span>OPENING STOCK BALANCE</span>
                </div>
                <span className="text-[10px] font-medium text-[var(--app-muted)]">Valuation: Qty × Rate</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                <div className="space-y-1">
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                    Opening Quantity
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={formData.openingQuantity}
                      onChange={(e) => updateField('openingQuantity', e.target.value)}
                      placeholder="0"
                      className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-bold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                    />
                    <span className="text-xs font-bold text-[var(--app-muted)] whitespace-nowrap">{formData.baseUnit}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                    Opening Rate (₹)
                  </label>
                  <input
                    type="number"
                    value={formData.openingRate}
                    onChange={(e) => updateField('openingRate', e.target.value)}
                    placeholder="0.00"
                    className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-bold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                    Opening Value (₹ - Auto)
                  </label>
                  <input
                    readOnly
                    type="text"
                    value={`₹ ${formData.openingValue.toLocaleString('en-IN')}`}
                    className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-extrabold text-emerald-600 dark:text-emerald-400 outline-none cursor-default"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                    Opening Stock Date
                  </label>
                  <input
                    type="date"
                    value={formData.asOfDate}
                    onChange={(e) => updateField('asOfDate', e.target.value)}
                    className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                  />
                </div>

                {/* Stock Level Controls */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                    Reorder Level
                  </label>
                  <input
                    type="number"
                    value={formData.reorderLevel}
                    onChange={(e) => updateField('reorderLevel', e.target.value)}
                    placeholder="0"
                    className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                    Reorder Quantity
                  </label>
                  <input
                    type="number"
                    value={formData.reorderQuantity}
                    onChange={(e) => updateField('reorderQuantity', e.target.value)}
                    placeholder="0"
                    className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                    Minimum Stock Level
                  </label>
                  <input
                    type="number"
                    value={formData.minimumStockLevel}
                    onChange={(e) => updateField('minimumStockLevel', e.target.value)}
                    placeholder="0"
                    className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                    Maximum Stock Level
                  </label>
                  <input
                    type="number"
                    value={formData.maximumStockLevel}
                    onChange={(e) => updateField('maximumStockLevel', e.target.value)}
                    placeholder="0"
                    className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                  />
                </div>
              </div>
            </div>


            {/* Tracking Switches Card */}
            <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2.5">
                <div className="flex items-center gap-2 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
                  <Sliders size={15} />
                  <span>INVENTORY TRACKING CONFIGURATION</span>
                </div>
                <span className="text-[10px] font-medium text-[var(--app-muted)]">Batch & Serial Toggles</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                <label className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] hover:bg-[var(--app-control-hover)] cursor-pointer select-none">
                  <span className="font-semibold text-[var(--app-heading)] text-[11px]">Track Batches</span>
                  <input
                    type="checkbox"
                    checked={formData.trackBatches}
                    onChange={(e) => updateField('trackBatches', e.target.checked)}
                    className="w-4 h-4 rounded accent-[var(--app-accent)] cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] hover:bg-[var(--app-control-hover)] cursor-pointer select-none">
                  <span className="font-semibold text-[var(--app-heading)] text-[11px]">Track Expiry Date</span>
                  <input
                    type="checkbox"
                    checked={formData.trackExpiry}
                    onChange={(e) => updateField('trackExpiry', e.target.checked)}
                    className="w-4 h-4 rounded accent-[var(--app-accent)] cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] hover:bg-[var(--app-control-hover)] cursor-pointer select-none">
                  <span className="font-semibold text-[var(--app-heading)] text-[11px]">Track Manufacturing Date</span>
                  <input
                    type="checkbox"
                    checked={formData.trackManufacturingDate}
                    onChange={(e) => updateField('trackManufacturingDate', e.target.checked)}
                    className="w-4 h-4 rounded accent-[var(--app-accent)] cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] hover:bg-[var(--app-control-hover)] cursor-pointer select-none">
                  <span className="font-semibold text-[var(--app-heading)] text-[11px]">Serial Number Tracking</span>
                  <input
                    type="checkbox"
                    checked={formData.isSerialWise}
                    onChange={(e) => updateField('isSerialWise', e.target.checked)}
                    className="w-4 h-4 rounded accent-[var(--app-accent)] cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] hover:bg-[var(--app-control-hover)] cursor-pointer select-none">
                  <span className="font-semibold text-[var(--app-heading)] text-[11px]">Perishable Stock</span>
                  <input
                    type="checkbox"
                    checked={formData.isPerishable}
                    onChange={(e) => updateField('isPerishable', e.target.checked)}
                    className="w-4 h-4 rounded accent-[var(--app-accent)] cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] hover:bg-[var(--app-control-hover)] cursor-pointer select-none">
                  <span className="font-semibold text-[var(--app-heading)] text-[11px]">Allow Negative Stock</span>
                  <input
                    type="checkbox"
                    checked={formData.negativeStockAllowed}
                    onChange={(e) => updateField('negativeStockAllowed', e.target.checked)}
                    className="w-4 h-4 rounded accent-[var(--app-accent)] cursor-pointer"
                  />
                </label>
              </div>
            </div>


            {/* Perishable Settings Sub-Card */}
            {(formData.trackExpiry || formData.isPerishable) && (
              <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-5 shadow-xs space-y-3 animate-in fade-in duration-200">
                <div className="text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
                  PERISHABLE STOCK & SHELF LIFE SETTINGS
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                      Shelf Life (Days)
                    </label>
                    <input
                      type="number"
                      value={formData.shelfLifeDays}
                      onChange={(e) => updateField('shelfLifeDays', e.target.value)}
                      placeholder="e.g. 90"
                      className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-bold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                      Expiry Warning Alert (Days Before Expiry)
                    </label>
                    <input
                      type="number"
                      value={formData.expiryWarningDays}
                      onChange={(e) => updateField('expiryWarningDays', e.target.value)}
                      placeholder="e.g. 15"
                      className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-bold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Serial Number Settings Sub-Card */}
            {(formData.trackSerialNumbers || formData.isSerialWise) && (
              <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-5 shadow-xs space-y-3 animate-in fade-in duration-200">
                <div className="text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
                  SERIAL NUMBER AUTO-GENERATION CONFIGURATION
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                      Serial Number Prefix
                    </label>
                    <input
                      type="text"
                      value={formData.serialPrefix}
                      onChange={(e) => updateField('serialPrefix', e.target.value)}
                      placeholder="e.g. SN-LAP-"
                      className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-mono font-bold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                      Starting Serial Number
                    </label>
                    <input
                      type="text"
                      value={formData.serialStartingNumber}
                      onChange={(e) => updateField('serialStartingNumber', e.target.value)}
                      placeholder="e.g. 0001"
                      className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-mono font-bold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                    />
                  </div>
                </div>
              </div>
            )}


            {/* Dynamic Repeatable Batch Table */}
            {formData.trackBatches && (
              <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-5 shadow-xs space-y-4 animate-in fade-in duration-300">
                <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2.5">
                  <div className="flex items-center gap-2 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
                    <Database size={15} />
                    <span>BATCH-WISE OPENING BREAKDOWN</span>
                  </div>
                  <button
                    type="button"
                    onClick={addBatchRow}
                    className="px-3 py-1 rounded-lg bg-[var(--app-accent-soft)] text-[var(--app-accent)] font-bold text-xs hover:opacity-90 transition-all flex items-center gap-1"
                  >
                    <Plus size={13} />
                    <span>Add Batch</span>
                  </button>
                </div>

                <div className="overflow-x-auto no-scrollbar">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--app-border)] text-[10px] font-extrabold uppercase text-[var(--app-muted)] bg-[var(--app-control-bg)]">
                        <th className="p-2.5 rounded-l-lg">Batch Name</th>
                        <th className="p-2.5">Godown</th>
                        <th className="p-2.5">Mfg Date</th>
                        <th className="p-2.5">Expiry Period</th>
                        <th className="p-2.5">Opening Qty</th>
                        <th className="p-2.5">Rate (₹)</th>
                        <th className="p-2.5">Value (₹)</th>
                        <th className="p-2.5 text-center rounded-r-lg">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--app-border)]">
                      {batches.map((b) => (
                        <tr key={b.id} className="hover:bg-[var(--app-control-hover)] transition-colors">
                          <td className="p-2">
                            <input
                              type="text"
                              value={b.batchName}
                              onChange={(e) => updateBatchRow(b.id, 'batchName', e.target.value)}
                              placeholder="Batch Name"
                              className="w-full h-8 rounded border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2 text-xs font-semibold"
                            />
                          </td>
                          <td className="p-2">
                            <select
                              value={b.godownName}
                              onChange={(e) => updateBatchRow(b.id, 'godownName', e.target.value)}
                              className="w-full h-8 rounded border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2 text-xs font-medium"
                            >
                              {godownList.map(g => (
                                <option key={g} value={g}>{g}</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2">
                            <input
                              type="date"
                              value={b.mfdOn}
                              onChange={(e) => updateBatchRow(b.id, 'mfdOn', e.target.value)}
                              className="w-full h-8 rounded border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2 text-xs"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={b.expiryPeriod}
                              onChange={(e) => updateBatchRow(b.id, 'expiryPeriod', e.target.value)}
                              placeholder="e.g. 12 Months"
                              className="w-full h-8 rounded border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2 text-xs"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              value={b.openingBalance}
                              onChange={(e) => updateBatchRow(b.id, 'openingBalance', e.target.value)}
                              className="w-full h-8 rounded border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2 text-xs font-bold"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              value={b.openingRate}
                              onChange={(e) => updateBatchRow(b.id, 'openingRate', e.target.value)}
                              className="w-full h-8 rounded border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2 text-xs font-bold"
                            />
                          </td>
                          <td className="p-2 font-bold text-emerald-600 dark:text-emerald-400">
                            ₹ {b.openingValue}
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => deleteBatchRow(b.id)}
                              className="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                              title="Delete Batch"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: PRICING & VALUATION                                                */}
        {/* ========================================================================= */}
        {activeTab === 'pricing' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Costing & Valuation Methods */}
            <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2.5">
                <div className="flex items-center gap-2 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
                  <DollarSign size={15} />
                  <span>VALUATION & COSTING METHODS</span>
                </div>
                <span className="text-[10px] font-medium text-[var(--app-muted)]">Inventory Valuation</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="space-y-1">
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                    Costing Method
                  </label>
                  <select
                    value={formData.costingMethod}
                    onChange={(e) => updateField('costingMethod', e.target.value)}
                    className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2.5 text-xs font-bold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                  >
                    <option value="FIFO">FIFO (First In First Out)</option>
                    <option value="LIFO">LIFO (Last In First Out)</option>
                    <option value="Average Cost">Average Cost</option>
                    <option value="Monthly Avg Cost">Monthly Avg Cost</option>
                    <option value="At Zero Cost">At Zero Cost</option>
                    <option value="Last Price">Last Price</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                    Valuation Method
                  </label>
                  <select
                    value={formData.valuationMethod}
                    onChange={(e) => updateField('valuationMethod', e.target.value)}
                    className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2.5 text-xs font-bold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                  >
                    <option value="Last Sale Price">Last Sale Price</option>
                    <option value="At Cost">At Cost</option>
                    <option value="Default Price">Default Price</option>
                    <option value="Basic Price">Basic Price</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                    Price Effective From
                  </label>
                  <input
                    type="date"
                    value={formData.priceEffectiveFrom}
                    onChange={(e) => updateField('priceEffectiveFrom', e.target.value)}
                    className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                  />
                </div>

                {/* Purchase Price */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                    Default Purchase Price (₹)
                  </label>
                  <input
                    type="number"
                    value={formData.purchasePrice}
                    onChange={(e) => updateField('purchasePrice', e.target.value)}
                    placeholder="0.00"
                    className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-bold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                  />
                </div>

                {/* Sales Price */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                    Default Selling Price (₹)
                  </label>
                  <input
                    type="number"
                    value={formData.salesPrice}
                    onChange={(e) => updateField('salesPrice', e.target.value)}
                    placeholder="0.00"
                    className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-bold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                  />
                </div>

                {/* MRP */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                    Maximum Retail Price / MRP (₹)
                  </label>
                  <input
                    type="number"
                    value={formData.mrp}
                    onChange={(e) => updateField('mrp', e.target.value)}
                    placeholder="0.00"
                    className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-bold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                  />
                </div>

                {/* Standard Cost */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                    Standard Cost (₹)
                  </label>
                  <input
                    type="number"
                    value={formData.standardCost}
                    onChange={(e) => updateField('standardCost', e.target.value)}
                    placeholder="0.00"
                    className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                  />
                </div>

                {/* Standard Selling Price */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                    Standard Selling Price (₹)
                  </label>
                  <input
                    type="number"
                    value={formData.standardSellingPrice}
                    onChange={(e) => updateField('standardSellingPrice', e.target.value)}
                    placeholder="0.00"
                    className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                  />
                </div>
              </div>
            </div>


            {/* State-wise MRP Table */}
            <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2.5">
                <div className="flex items-center gap-2 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
                  <Coins size={15} />
                  <span>STATE-WISE MRP RATES</span>
                </div>
                <button
                  type="button"
                  onClick={addMrpRow}
                  className="px-3 py-1 rounded-lg bg-[var(--app-accent-soft)] text-[var(--app-accent)] font-bold text-xs hover:opacity-90 transition-all flex items-center gap-1"
                >
                  <Plus size={13} />
                  <span>Add State Rate</span>
                </button>
              </div>

              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--app-border)] text-[10px] font-extrabold uppercase text-[var(--app-muted)] bg-[var(--app-control-bg)]">
                      <th className="p-2.5 rounded-l-lg">State Name</th>
                      <th className="p-2.5">Prior State</th>
                      <th className="p-2.5">MRP Rate (₹)</th>
                      <th className="p-2.5 text-center rounded-r-lg">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--app-border)]">
                    {mrpRates.map((r) => (
                      <tr key={r.id} className="hover:bg-[var(--app-control-hover)] transition-colors">
                        <td className="p-2">
                          <select
                            value={r.stateName}
                            onChange={(e) => updateMrpRow(r.id, 'stateName', e.target.value)}
                            className="w-full h-8 rounded border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2 text-xs font-semibold"
                          >
                            {stateList.map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={r.priorStateName}
                            onChange={(e) => updateMrpRow(r.id, 'priorStateName', e.target.value)}
                            className="w-full h-8 rounded border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2 text-xs"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            value={r.mrpRate}
                            onChange={(e) => updateMrpRow(r.id, 'mrpRate', e.target.value)}
                            className="w-full h-8 rounded border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2 text-xs font-bold"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => deleteMrpRow(r.id)}
                            className="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 6: BILL OF MATERIALS (BOM)                                            */}
        {/* ========================================================================= */}
        {activeTab === 'bom' && (
          <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-5 shadow-xs space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2.5">
              <div className="flex items-center gap-2 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
                <Box size={15} />
                <span>BILL OF MATERIALS (BOM) CONFIGURATION</span>
              </div>
              <button
                type="button"
                onClick={addBomItemRow}
                className="px-3 py-1 rounded-lg bg-[var(--app-accent-soft)] text-[var(--app-accent)] font-bold text-xs hover:opacity-90 transition-all flex items-center gap-1"
              >
                <Plus size={13} />
                <span>Add Component</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                  Component List Name
                </label>
                <input
                  type="text"
                  value={formData.bomName}
                  onChange={(e) => updateField('bomName', e.target.value)}
                  placeholder="e.g. Standard Assembly BOM"
                  className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                  Component Basic Quantity
                </label>
                <input
                  type="number"
                  value={formData.bomBasicQty}
                  onChange={(e) => updateField('bomBasicQty', e.target.value)}
                  placeholder="1"
                  className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-bold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                />
              </div>
            </div>

            {/* BOM Components Table */}
            <div className="overflow-x-auto no-scrollbar pt-2">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--app-border)] text-[10px] font-extrabold uppercase text-[var(--app-muted)] bg-[var(--app-control-bg)]">
                    <th className="p-2.5 rounded-l-lg">Stock Item</th>
                    <th className="p-2.5">Nature of Item</th>
                    <th className="p-2.5">Godown</th>
                    <th className="p-2.5">Actual Qty</th>
                    <th className="p-2.5">Addl Cost %</th>
                    <th className="p-2.5 text-center rounded-r-lg">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--app-border)]">
                  {bomItems.map((bi) => (
                    <tr key={bi.id} className="hover:bg-[var(--app-control-hover)] transition-colors">
                      <td className="p-2">
                        <input
                          type="text"
                          value={bi.stockItemName}
                          onChange={(e) => updateBomItemRow(bi.id, 'stockItemName', e.target.value)}
                          placeholder="Component Name"
                          className="w-full h-8 rounded border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2 text-xs font-semibold"
                        />
                      </td>
                      <td className="p-2">
                        <select
                          value={bi.natureOfItem}
                          onChange={(e) => updateBomItemRow(bi.id, 'natureOfItem', e.target.value)}
                          className="w-full h-8 rounded border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2 text-xs font-medium"
                        >
                          <option value="Component">Component</option>
                          <option value="By-Product">By-Product</option>
                          <option value="Co-Product">Co-Product</option>
                          <option value="Scrap">Scrap</option>
                        </select>
                      </td>
                      <td className="p-2">
                        <select
                          value={bi.godownName}
                          onChange={(e) => updateBomItemRow(bi.id, 'godownName', e.target.value)}
                          className="w-full h-8 rounded border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2 text-xs font-medium"
                        >
                          {godownList.map(g => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          value={bi.actualQty}
                          onChange={(e) => updateBomItemRow(bi.id, 'actualQty', e.target.value)}
                          className="w-full h-8 rounded border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2 text-xs font-bold"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          value={bi.addlCostAllocPerc}
                          onChange={(e) => updateBomItemRow(bi.id, 'addlCostAllocPerc', e.target.value)}
                          className="w-full h-8 rounded border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2 text-xs"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => deleteBomItemRow(bi.id)}
                          className="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 7: ADVANCED INVENTORY BEHAVIOUR & ADDITIONAL INFO                     */}
        {/* ========================================================================= */}
        {activeTab === 'advanced' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Additional Information Card */}
            <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2.5">
                <div className="flex items-center gap-2 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
                  <FileText size={15} />
                  <span>ADDITIONAL PRODUCT DETAILS</span>
                </div>
                <span className="text-[10px] font-medium text-[var(--app-muted)]">Origin & Categorization</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                    Country of Origin
                  </label>
                  <input
                    type="text"
                    value={formData.countryOfOrigin}
                    onChange={(e) => updateField('countryOfOrigin', e.target.value)}
                    placeholder="e.g. India, Germany, USA"
                    className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                    Product Type
                  </label>
                  <input
                    type="text"
                    value={formData.productType}
                    onChange={(e) => updateField('productType', e.target.value)}
                    placeholder="e.g. Finished Goods, Raw Material, Trading Item"
                    className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                  />
                </div>

                <div className="md:col-span-2 space-y-1">
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)]">
                    Additional Notes
                  </label>
                  <textarea
                    rows="2"
                    value={formData.notes}
                    onChange={(e) => updateField('notes', e.target.value)}
                    placeholder="Any extra specifications or details about this item..."
                    className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] p-3 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)] resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Advanced Flags Card */}
            <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2.5">
                <div className="flex items-center gap-2 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
                  <Sliders size={15} />
                  <span>ADVANCED INVENTORY FLAGS & BEHAVIOUR</span>
                </div>
                <span className="text-[10px] font-medium text-[var(--app-muted)]">Tally / ERP Options</span>
              </div>


            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              <label className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] hover:bg-[var(--app-control-hover)] cursor-pointer select-none">
                <span className="font-semibold text-[var(--app-heading)] text-[11px]">Cost Center Enabled</span>
                <input
                  type="checkbox"
                  checked={formData.isCostCenter}
                  onChange={(e) => updateField('isCostCenter', e.target.checked)}
                  className="w-4 h-4 rounded accent-[var(--app-accent)] cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] hover:bg-[var(--app-control-hover)] cursor-pointer select-none">
                <span className="font-semibold text-[var(--app-heading)] text-[11px]">Treat Sales as Manufactured</span>
                <input
                  type="checkbox"
                  checked={formData.treatSalesAsManufactured}
                  onChange={(e) => updateField('treatSalesAsManufactured', e.target.checked)}
                  className="w-4 h-4 rounded accent-[var(--app-accent)] cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] hover:bg-[var(--app-control-hover)] cursor-pointer select-none">
                <span className="font-semibold text-[var(--app-heading)] text-[11px]">Treat Purchase as Consumed</span>
                <input
                  type="checkbox"
                  checked={formData.treatPurchaseAsConsumed}
                  onChange={(e) => updateField('treatPurchaseAsConsumed', e.target.checked)}
                  className="w-4 h-4 rounded accent-[var(--app-accent)] cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] hover:bg-[var(--app-control-hover)] cursor-pointer select-none">
                <span className="font-semibold text-[var(--app-heading)] text-[11px]">Treat Rejects as Scrap</span>
                <input
                  type="checkbox"
                  checked={formData.treatRejectAsScrap}
                  onChange={(e) => updateField('treatRejectAsScrap', e.target.checked)}
                  className="w-4 h-4 rounded accent-[var(--app-accent)] cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] hover:bg-[var(--app-control-hover)] cursor-pointer select-none">
                <span className="font-semibold text-[var(--app-heading)] text-[11px]">Allow Use of Expired Items</span>
                <input
                  type="checkbox"
                  checked={formData.allowUseOfExpiredItems}
                  onChange={(e) => updateField('allowUseOfExpiredItems', e.target.checked)}
                  className="w-4 h-4 rounded accent-[var(--app-accent)] cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] hover:bg-[var(--app-control-hover)] cursor-pointer select-none">
                <span className="font-semibold text-[var(--app-heading)] text-[11px]">Ignore Batches in Vouchers</span>
                <input
                  type="checkbox"
                  checked={formData.ignoreBatches}
                  onChange={(e) => updateField('ignoreBatches', e.target.checked)}
                  className="w-4 h-4 rounded accent-[var(--app-accent)] cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] hover:bg-[var(--app-control-hover)] cursor-pointer select-none">
                <span className="font-semibold text-[var(--app-heading)] text-[11px]">Ignore Godowns in Vouchers</span>
                <input
                  type="checkbox"
                  checked={formData.ignoreGodowns}
                  onChange={(e) => updateField('ignoreGodowns', e.target.checked)}
                  className="w-4 h-4 rounded accent-[var(--app-accent)] cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] hover:bg-[var(--app-control-hover)] cursor-pointer select-none">
                <span className="font-semibold text-[var(--app-heading)] text-[11px]">Calculate Tax on MRP</span>
                <input
                  type="checkbox"
                  checked={formData.calcOnMrp}
                  onChange={(e) => updateField('calcOnMrp', e.target.checked)}
                  className="w-4 h-4 rounded accent-[var(--app-accent)] cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] hover:bg-[var(--app-control-hover)] cursor-pointer select-none">
                <span className="font-semibold text-[var(--app-heading)] text-[11px]">Is Cess Exempted</span>
                <input
                  type="checkbox"
                  checked={formData.isCessExempted}
                  onChange={(e) => updateField('isCessExempted', e.target.checked)}
                  className="w-4 h-4 rounded accent-[var(--app-accent)] cursor-pointer"
                />
              </label>
            </div>
          </div>
        </div>
      )}


      </div>

      {/* 4. STICKY BOTTOM ACTION BAR */}
      <div className="shrink-0 px-6 py-3 border-t border-[var(--app-border)] bg-[var(--app-panel-bg)] flex items-center justify-between shadow-lg">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-lg border border-[var(--app-border)] text-xs font-semibold text-[var(--app-text)] hover:bg-[var(--app-control-hover)] transition-colors"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={handleSubmit}
          className="px-5 py-2 rounded-lg bg-[var(--app-accent)] text-white text-xs font-bold shadow-sm hover:opacity-90 transition-all flex items-center gap-1.5"
        >
          <CheckCircle2 size={14} />
          <span>{isEdit ? 'Update Stock Item' : 'Save Stock Item'}</span>
        </button>
      </div>

      {/* 5. CONFIGURE FORM MODAL DIALOG */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-3">
              <div className="flex items-center gap-2 text-[var(--app-heading)] font-extrabold text-sm">
                <Settings size={16} className="text-[var(--app-accent)]" />
                <span>Configure Stock Item Visible Tabs</span>
              </div>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="p-1 rounded-lg border border-[var(--app-border)] hover:bg-[var(--app-control-hover)] text-[var(--app-muted)] hover:text-[var(--app-heading)]"
              >
                <X size={15} />
              </button>
            </div>

            <p className="text-xs text-[var(--app-muted)]">
              Enable or disable optional form tabs. Active tabs will appear in the top tab bar.
            </p>

            <div className="space-y-2 text-xs">
              <label className="flex items-center justify-between p-2.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-control-bg)] cursor-pointer">
                <span className="font-semibold text-[var(--app-heading)]">Units Tab</span>
                <input
                  type="checkbox"
                  checked={config.cfgUnits}
                  onChange={(e) => setConfig(prev => ({ ...prev, cfgUnits: e.target.checked }))}
                  className="w-4 h-4 rounded accent-[var(--app-accent)]"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-control-bg)] cursor-pointer">
                <span className="font-semibold text-[var(--app-heading)]">Tax & HSN Tab</span>
                <input
                  type="checkbox"
                  checked={config.cfgTax}
                  onChange={(e) => setConfig(prev => ({ ...prev, cfgTax: e.target.checked }))}
                  className="w-4 h-4 rounded accent-[var(--app-accent)]"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-control-bg)] cursor-pointer">
                <span className="font-semibold text-[var(--app-heading)]">Inventory & Batches Tab</span>
                <input
                  type="checkbox"
                  checked={config.cfgInventory}
                  onChange={(e) => setConfig(prev => ({ ...prev, cfgInventory: e.target.checked }))}
                  className="w-4 h-4 rounded accent-[var(--app-accent)]"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-control-bg)] cursor-pointer">
                <span className="font-semibold text-[var(--app-heading)]">Pricing & Valuation Tab</span>
                <input
                  type="checkbox"
                  checked={config.cfgPricing}
                  onChange={(e) => setConfig(prev => ({ ...prev, cfgPricing: e.target.checked }))}
                  className="w-4 h-4 rounded accent-[var(--app-accent)]"
                />
              </label>

              <div className="flex items-center justify-between p-2.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-control-bg)]">
                <span className="font-semibold text-[var(--app-heading)]">BOM (Bill of Materials) Master Enabled</span>
                <select
                  value={config.cfgBom ? 'Yes' : 'No'}
                  onChange={(e) => setConfig(prev => ({ ...prev, cfgBom: e.target.value === 'Yes' }))}
                  className="h-8 px-3 rounded-lg border border-[var(--app-border)] bg-[var(--app-panel-bg)] text-xs font-bold text-[var(--app-accent)] outline-none focus:border-[var(--app-accent)]"
                >
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>


              <label className="flex items-center justify-between p-2.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-control-bg)] cursor-pointer">
                <span className="font-semibold text-[var(--app-heading)]">Advanced Inventory Behaviour Tab</span>
                <input
                  type="checkbox"
                  checked={config.cfgAdvanced}
                  onChange={(e) => setConfig(prev => ({ ...prev, cfgAdvanced: e.target.checked }))}
                  className="w-4 h-4 rounded accent-[var(--app-accent)]"
                />
              </label>
            </div>

            <div className="pt-3 border-t border-[var(--app-border)] flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowConfigModal(false);
                  toast.success('Form tab settings updated!');
                }}
                className="px-4 py-2 rounded-xl bg-[var(--app-accent)] text-white text-xs font-bold shadow-xs hover:opacity-90"
              >
                Apply Settings
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
