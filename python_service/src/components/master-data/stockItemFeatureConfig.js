/**
 * stockItemFeatureConfig.js
 * Centralized feature configuration system for Stock Item Master.
 * 3-Level Resolution Hierarchy: Item Manual Override > Company Settings > Business Type Defaults > System Default.
 */

// Supported Business Types
export const BUSINESS_TYPES = [
  { id: 'GENERAL_TRADING', label: 'General / Simple Trading', description: 'Core basic stock item fields' },
  { id: 'RETAIL', label: 'Retail Store', description: 'Barcode, MRP & Reorder Level enabled' },
  { id: 'WHOLESALE', label: 'Wholesale Business', description: 'Alternate Units & Packaging Details enabled' },
  { id: 'DISTRIBUTION', label: 'Distribution & Logistics', description: 'Multi-Godown, Min/Max stock & Reorder Level enabled' },
  { id: 'FMCG', label: 'FMCG Goods', description: 'Barcode, Batch Tracking, Expiry & MRP enabled' },
  { id: 'PHARMA', label: 'Pharma / Medical', description: 'Batch Tracking, Expiry Date, MRP & Barcode enabled' },
  { id: 'MANUFACTURING', label: 'Manufacturing & Assembly', description: 'Bill of Materials (BOM), Alternate Unit & Min/Max Stock enabled' },
  { id: 'ELECTRONICS', label: 'Electronics & Equipment', description: 'Brand, Model, Part No, Barcode, Serial Tracking & Warranty enabled' },
];

// Feature Registry Definition
export const STOCK_ITEM_FEATURES = {
  // Section A: Additional Identification (Basic Info tab)
  barcode: {
    key: 'barcode',
    label: 'Enable Barcode / EAN',
    description: 'Show Barcode / EAN field in Basic Information',
    tab: 'basic',
    section: 'identification'
  },
  brand: {
    key: 'brand',
    label: 'Enable Brand / Make',
    description: 'Show Brand / Make field in Basic Information',
    tab: 'basic',
    section: 'identification'
  },
  manufacturer: {
    key: 'manufacturer',
    label: 'Enable Manufacturer',
    description: 'Show Manufacturer name field in Basic Information',
    tab: 'basic',
    section: 'identification'
  },
  model: {
    key: 'model',
    label: 'Enable Model Information',
    description: 'Show Model Number field in Basic Information',
    tab: 'basic',
    section: 'identification'
  },
  partNumber: {
    key: 'partNumber',
    label: 'Enable Part Number',
    description: 'Show Part Number field in Basic Information',
    tab: 'basic',
    section: 'identification'
  },
  warranty: {
    key: 'warranty',
    label: 'Enable Warranty Details',
    description: 'Show Warranty Period & Warranty Unit in Basic Information',
    tab: 'basic',
    section: 'warranty'
  },

  // Section B: Units & Packaging (Inventory tab)
  alternateUnit: {
    key: 'alternateUnit',
    label: 'Enable Alternate Unit',
    description: 'Show secondary Alternate Unit dropdown in Inventory',
    tab: 'inventory',
    section: 'units'
  },
  packaging: {
    key: 'packaging',
    label: 'Enable Packaging Details',
    description: 'Show Pack Size and Units Per Pack in Inventory',
    tab: 'inventory',
    section: 'units'
  },

  // Section C: Inventory Tracking (Inventory tab)
  multipleGodown: {
    key: 'multipleGodown',
    label: 'Enable Multiple Godown Tracking',
    description: 'Show Default Godown location in Inventory',
    tab: 'inventory',
    section: 'tracking'
  },
  batchTracking: {
    key: 'batchTracking',
    label: 'Enable Batch-wise Tracking',
    description: 'Enable batch tracking configuration in Inventory',
    tab: 'inventory',
    section: 'tracking'
  },
  expiryTracking: {
    key: 'expiryTracking',
    label: 'Enable Expiry Tracking',
    description: 'Track expiry date for batches (Requires Batch Tracking)',
    tab: 'inventory',
    section: 'tracking',
    dependsOn: 'batchTracking'
  },
  manufacturingDate: {
    key: 'manufacturingDate',
    label: 'Enable Manufacturing Date',
    description: 'Track manufacturing date for batches (Requires Batch Tracking)',
    tab: 'inventory',
    section: 'tracking',
    dependsOn: 'batchTracking'
  },
  serialTracking: {
    key: 'serialTracking',
    label: 'Enable Serial Number Tracking',
    description: 'Enable serial number tracking configuration in Inventory',
    tab: 'inventory',
    section: 'tracking'
  },

  // Section D: Stock Control (Inventory tab)
  reorderLevel: {
    key: 'reorderLevel',
    label: 'Enable Reorder Level',
    description: 'Set reorder quantity threshold in Inventory',
    tab: 'inventory',
    section: 'control'
  },
  minimumStock: {
    key: 'minimumStock',
    label: 'Enable Minimum Stock',
    description: 'Set minimum safety stock level in Inventory',
    tab: 'inventory',
    section: 'control'
  },
  maximumStock: {
    key: 'maximumStock',
    label: 'Enable Maximum Stock',
    description: 'Set maximum stock capacity limit in Inventory',
    tab: 'inventory',
    section: 'control'
  },

  // Section E: Pricing & Costing (Pricing tab)
  mrp: {
    key: 'mrp',
    label: 'Enable MRP',
    description: 'Show Maximum Retail Price (MRP) input in Pricing',
    tab: 'pricing',
    section: 'pricing'
  },
  standardCost: {
    key: 'standardCost',
    label: 'Enable Standard Cost',
    description: 'Show Standard Cost reference input in Pricing',
    tab: 'pricing',
    section: 'pricing'
  },

  // Section F: Manufacturing
  bom: {
    key: 'bom',
    label: 'Enable Bill of Materials (BOM)',
    description: 'Show Manage BOM link for manufactured products',
    tab: 'advanced',
    section: 'manufacturing'
  }
};

// Feature Category Groups for Advanced Tab UI
export const FEATURE_GROUPS = [
  {
    id: 'identification',
    title: 'Additional Identification',
    description: 'Brand, Model, Part Number, Barcode & Product Identity',
    features: ['barcode', 'brand', 'manufacturer', 'model', 'partNumber', 'warranty']
  },
  {
    id: 'units',
    title: 'Units & Packaging',
    description: 'Alternate Measurement Units and Packaging Sizing',
    features: ['alternateUnit', 'packaging']
  },
  {
    id: 'tracking',
    title: 'Inventory Tracking',
    description: 'Multiple Godowns, Batches, Expiry & Serial Numbers',
    features: ['multipleGodown', 'batchTracking', 'expiryTracking', 'manufacturingDate', 'serialTracking']
  },
  {
    id: 'control',
    title: 'Stock Control & Planning',
    description: 'Reorder Levels, Safety Minimum & Capacity Maximum Stock',
    features: ['reorderLevel', 'minimumStock', 'maximumStock']
  },
  {
    id: 'pricing',
    title: 'Pricing & Valuation',
    description: 'Maximum Retail Price (MRP) & Standard Cost References',
    features: ['mrp', 'standardCost']
  },
  {
    id: 'manufacturing',
    title: 'Manufacturing & Assembly',
    description: 'Bill of Materials (BOM) linking for manufactured items',
    features: ['bom']
  }
];

// Level 2: Business Type Default Feature Matrix
export const BUSINESS_TYPE_DEFAULTS = {
  GENERAL_TRADING: {
    barcode: false, brand: false, manufacturer: false, model: false, partNumber: false, warranty: false,
    alternateUnit: false, packaging: false, multipleGodown: false, batchTracking: false, expiryTracking: false,
    manufacturingDate: false, serialTracking: false, reorderLevel: false, minimumStock: false, maximumStock: false,
    mrp: false, standardCost: false, bom: false
  },
  RETAIL: {
    barcode: true, brand: false, manufacturer: false, model: false, partNumber: false, warranty: false,
    alternateUnit: false, packaging: false, multipleGodown: false, batchTracking: false, expiryTracking: false,
    manufacturingDate: false, serialTracking: false, reorderLevel: true, minimumStock: false, maximumStock: false,
    mrp: true, standardCost: false, bom: false
  },
  WHOLESALE: {
    barcode: false, brand: false, manufacturer: false, model: false, partNumber: false, warranty: false,
    alternateUnit: true, packaging: true, multipleGodown: false, batchTracking: false, expiryTracking: false,
    manufacturingDate: false, serialTracking: false, reorderLevel: true, minimumStock: false, maximumStock: false,
    mrp: false, standardCost: false, bom: false
  },
  DISTRIBUTION: {
    barcode: false, brand: false, manufacturer: false, model: false, partNumber: false, warranty: false,
    alternateUnit: true, packaging: true, multipleGodown: true, batchTracking: false, expiryTracking: false,
    manufacturingDate: false, serialTracking: false, reorderLevel: true, minimumStock: true, maximumStock: true,
    mrp: false, standardCost: false, bom: false
  },
  FMCG: {
    barcode: true, brand: false, manufacturer: false, model: false, partNumber: false, warranty: false,
    alternateUnit: true, packaging: true, multipleGodown: false, batchTracking: true, expiryTracking: true,
    manufacturingDate: false, serialTracking: false, reorderLevel: true, minimumStock: false, maximumStock: false,
    mrp: true, standardCost: false, bom: false
  },
  PHARMA: {
    barcode: true, brand: false, manufacturer: false, model: false, partNumber: false, warranty: false,
    alternateUnit: false, packaging: false, multipleGodown: false, batchTracking: true, expiryTracking: true,
    manufacturingDate: false, serialTracking: false, reorderLevel: false, minimumStock: false, maximumStock: false,
    mrp: true, standardCost: false, bom: false
  },
  MANUFACTURING: {
    barcode: false, brand: false, manufacturer: false, model: false, partNumber: false, warranty: false,
    alternateUnit: true, packaging: false, multipleGodown: false, batchTracking: false, expiryTracking: false,
    manufacturingDate: false, serialTracking: false, reorderLevel: true, minimumStock: true, maximumStock: true,
    mrp: false, standardCost: false, bom: true
  },
  ELECTRONICS: {
    barcode: true, brand: true, manufacturer: false, model: true, partNumber: true, warranty: true,
    alternateUnit: false, packaging: false, multipleGodown: false, batchTracking: false, expiryTracking: false,
    manufacturingDate: false, serialTracking: true, reorderLevel: false, minimumStock: false, maximumStock: false,
    mrp: false, standardCost: false, bom: false
  }
};

/**
 * Calculates final effective feature settings based on Business Type, Company Settings, and Item Overrides.
 * Resolution Priority:
 * 1. Stock Item Manual Override (featureOverrides[key] if not null/undefined)
 * 2. Company Feature Configuration (companySettings[key] if not null/undefined)
 * 3. Business Type Defaults (businessTypeDefaults[businessType][key])
 * 4. System Default (false)
 */
export function getEffectiveFeatureSettings({
  businessType = 'GENERAL_TRADING',
  companySettings = {},
  featureOverrides = {}
}) {
  const normType = String(businessType || 'GENERAL_TRADING').toUpperCase().replace(/[\s-]/g, '_');
  const defaults = BUSINESS_TYPE_DEFAULTS[normType] || BUSINESS_TYPE_DEFAULTS.GENERAL_TRADING;

  const result = {};

  Object.keys(STOCK_ITEM_FEATURES).forEach((featureKey) => {
    let isEnabled = false;

    if (featureOverrides && featureOverrides[featureKey] !== undefined && featureOverrides[featureKey] !== null) {
      isEnabled = Boolean(featureOverrides[featureKey]);
    } else if (companySettings && companySettings[featureKey] !== undefined && companySettings[featureKey] !== null) {
      isEnabled = Boolean(companySettings[featureKey]);
    } else if (defaults[featureKey] !== undefined) {
      isEnabled = Boolean(defaults[featureKey]);
    }

    result[featureKey] = isEnabled;
  });

  // Strict Dependency Enforcement:
  // If batchTracking is OFF, expiryTracking and manufacturingDate MUST be OFF.
  if (!result.batchTracking) {
    result.expiryTracking = false;
    result.manufacturingDate = false;
  }

  return result;
}
