import React, { useState, useEffect } from 'react';
import { 
  Box, ArrowLeft, Save, Plus, Trash2, Layers, CheckCircle2, Sliders 
} from 'lucide-react';
import { toast } from 'sonner';

/**
 * BOMMasterForm - Full Page Form for Creating & Editing Bill of Materials (BOM) Masters.
 */
export default function BOMMasterForm({
  initialData = null,
  isEdit = false,
  stockItemsList = [],
  onSave,
  onClose
}) {
  const [formData, setFormData] = useState({
    bomName: '',
    finishedItemName: '',
    basicQty: 1,
    unit: 'Pcs',
    notes: '',
    status: 'ACTIVE'
  });

  const [components, setComponents] = useState([
    { id: 1, stockItemName: '', natureOfItem: 'Component', actualQty: 1, unit: 'Pcs', godownName: 'Main Location' }
  ]);

  useEffect(() => {
    if (initialData) {
      setFormData({
        bomName: initialData.bomName || initialData.name || '',
        finishedItemName: initialData.finishedItemName || initialData.stockItemName || '',
        basicQty: initialData.basicQty || 1,
        unit: initialData.unit || 'Pcs',
        notes: initialData.notes || '',
        status: initialData.status || 'ACTIVE'
      });
      if (initialData.items && Array.isArray(initialData.items) && initialData.items.length > 0) {
        setComponents(initialData.items.map((item, idx) => ({
          id: idx + 1,
          stockItemName: item.stockItemName || item.name || '',
          natureOfItem: item.natureOfItem || 'Component',
          actualQty: item.actualQty || 1,
          unit: item.unit || 'Pcs',
          godownName: item.godownName || 'Main Location'
        })));
      }
    }
  }, [initialData]);

  const updateField = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const addComponentRow = () => {
    setComponents(prev => [
      ...prev,
      { id: Date.now(), stockItemName: '', natureOfItem: 'Component', actualQty: 1, unit: 'Pcs', godownName: 'Main Location' }
    ]);
  };

  const updateComponentRow = (id, key, val) => {
    setComponents(prev => prev.map(c => c.id === id ? { ...c, [key]: val } : c));
  };

  const deleteComponentRow = (id) => {
    if (components.length <= 1) {
      toast.error('BOM assembly must have at least one component');
      return;
    }
    setComponents(prev => prev.filter(c => c.id !== id));
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!formData.bomName.trim()) {
      toast.error('BOM Name is required');
      return;
    }
    if (!formData.finishedItemName.trim()) {
      toast.error('Target Finished Stock Item is required');
      return;
    }

    const payload = {
      ...formData,
      items: components,
      componentsCount: components.length
    };

    if (onSave) {
      onSave(payload);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--app-panel-bg)] text-[var(--app-text)] overflow-hidden font-sans">
      
      {/* Header Bar */}
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
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--app-muted)]">
              Masters / {isEdit ? 'Edit BOM' : 'Create BOM'}
            </span>
            <h1 className="text-base md:text-lg font-extrabold tracking-tight text-[var(--app-heading)] truncate">
              {isEdit ? `Edit BOM: ${formData.bomName}` : 'Create Bill of Materials (BOM) Master'}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
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
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[var(--app-accent)] text-white text-xs font-bold shadow-xs hover:opacity-90 transition-all"
          >
            <CheckCircle2 size={14} />
            <span>{isEdit ? 'Update BOM' : 'Save BOM Master'}</span>
          </button>
        </div>
      </div>

      {/* Form Content */}
      <form onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 no-scrollbar">
        
        {/* Assembly Basic Details */}
        <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2.5">
            <div className="flex items-center gap-2 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
              <Box size={15} />
              <span>BOM Assembly Basic Details</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                BOM Assembly Name *
              </label>
              <input
                type="text"
                required
                value={formData.bomName}
                onChange={(e) => updateField('bomName', e.target.value)}
                placeholder="e.g. Standard Computer Assembly BOM"
                className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-bold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                Target Finished Stock Item *
              </label>
              <input
                type="text"
                required
                list="stock-item-options"
                value={formData.finishedItemName}
                onChange={(e) => updateField('finishedItemName', e.target.value)}
                placeholder="Select or type finished item name"
                className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-semibold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
              />
              <datalist id="stock-item-options">
                {stockItemsList.map(item => (
                  <option key={item._id || item.id || item.name} value={item.name || item.itemName} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--app-muted)] mb-1">
                Output Basic Quantity
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  value={formData.basicQty}
                  onChange={(e) => updateField('basicQty', e.target.value)}
                  className="w-full h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-3 text-xs font-mono font-bold text-[var(--app-heading)] outline-none focus:border-[var(--app-accent)]"
                />
                <input
                  type="text"
                  value={formData.unit}
                  onChange={(e) => updateField('unit', e.target.value)}
                  placeholder="Pcs"
                  className="w-24 h-9.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2 text-xs font-bold text-[var(--app-heading)] outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Component Items Breakdown Table */}
        <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-panel-bg)] p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-2.5">
            <div className="flex items-center gap-2 text-[var(--app-accent)] font-bold text-xs uppercase tracking-wider">
              <Layers size={15} />
              <span>BOM Components Breakdown ({components.length} items)</span>
            </div>
            <button
              type="button"
              onClick={addComponentRow}
              className="px-3 py-1 rounded-lg bg-[var(--app-accent-soft)] text-[var(--app-accent)] font-bold text-xs hover:opacity-90 transition-all flex items-center gap-1"
            >
              <Plus size={13} />
              <span>Add Component</span>
            </button>
          </div>

          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--app-border)] text-[10px] font-extrabold uppercase text-[var(--app-muted)] bg-[var(--app-control-bg)]">
                  <th className="p-2.5 rounded-l-lg">Component Stock Item Name</th>
                  <th className="p-2.5">Nature of Item</th>
                  <th className="p-2.5">Godown Location</th>
                  <th className="p-2.5">Required Quantity</th>
                  <th className="p-2.5 text-center rounded-r-lg">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--app-border)]">
                {components.map((c) => (
                  <tr key={c.id} className="hover:bg-[var(--app-control-hover)] transition-colors">
                    <td className="p-2">
                      <input
                        type="text"
                        list="stock-item-options"
                        value={c.stockItemName}
                        onChange={(e) => updateComponentRow(c.id, 'stockItemName', e.target.value)}
                        placeholder="Select Component Stock Item"
                        className="w-full h-8.5 rounded border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2 text-xs font-semibold text-[var(--app-heading)]"
                      />
                    </td>
                    <td className="p-2">
                      <select
                        value={c.natureOfItem}
                        onChange={(e) => updateComponentRow(c.id, 'natureOfItem', e.target.value)}
                        className="w-full h-8.5 rounded border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2 text-xs font-medium"
                      >
                        <option value="Component">Component</option>
                        <option value="By-Product">By-Product</option>
                        <option value="Co-Product">Co-Product</option>
                        <option value="Scrap">Scrap</option>
                      </select>
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={c.godownName}
                        onChange={(e) => updateComponentRow(c.id, 'godownName', e.target.value)}
                        placeholder="Main Location"
                        className="w-full h-8.5 rounded border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2 text-xs"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        step="0.01"
                        value={c.actualQty}
                        onChange={(e) => updateComponentRow(c.id, 'actualQty', e.target.value)}
                        className="w-full h-8.5 rounded border border-[var(--app-border)] bg-[var(--app-control-bg)] px-2 text-xs font-mono font-bold"
                      />
                    </td>
                    <td className="p-2 text-center">
                      <button
                        type="button"
                        onClick={() => deleteComponentRow(c.id)}
                        className="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                        title="Remove Component"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </form>
    </div>
  );
}
