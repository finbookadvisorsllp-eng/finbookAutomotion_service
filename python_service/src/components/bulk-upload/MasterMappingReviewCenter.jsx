import React, { useState, useMemo } from 'react';
import {
  Database, CheckCircle2, AlertCircle, Wand2, Plus, ArrowRight,
  Search, Check, RefreshCw, X, Shield, Filter
} from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '../../lib/apiClient';

export default function MasterMappingReviewCenter({
  uploadId,
  validationResults = [],
  partyLedgers = [],
  stockItems = [],
  bankLedgers = [],
  costCenters = [],
  onMappingApproved,
  onClose
}) {
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [processingId, setProcessingId] = useState(null);
  const [customMappings, setCustomMappings] = useState({});

  // Filter unmapped master issues
  const masterIssues = useMemo(() => {
    return validationResults.filter(issue => {
      const fieldLower = (issue.field || '').toLowerCase();
      const isMasterField = fieldLower.includes('party') ||
                            fieldLower.includes('item') ||
                            fieldLower.includes('ledger') ||
                            fieldLower.includes('bank') ||
                            fieldLower.includes('cost');
      return isMasterField && !issue.isResolved;
    });
  }, [validationResults]);

  const filteredIssues = useMemo(() => {
    return masterIssues.filter(issue => {
      if (activeCategory !== 'All') {
        const catLower = (issue.category || issue.field || '').toLowerCase();
        if (!catLower.includes(activeCategory.toLowerCase())) return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (issue.currentValue || '').toLowerCase().includes(q) ||
               (issue.suggestedValue || '').toLowerCase().includes(q) ||
               (issue.title || '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [masterIssues, activeCategory, searchQuery]);

  const handleApproveMapping = async (issue, targetMaster = null) => {
    const masterToSave = targetMaster || customMappings[issue.id] || issue.suggestedValue;
    if (!masterToSave) {
      toast.error('Please select or enter a master name to map.');
      return;
    }

    setProcessingId(issue.id);
    try {
      const categoryMap = {
        'Party/Ledger': 'party',
        'Inventory': 'item',
        'Bank': 'bank',
        'Cost Center': 'cost_center'
      };
      const categoryKey = categoryMap[issue.category] || 'party';

      const res = await apiClient.post('/bulk-upload/master-mappings/approve', {
        upload_id: uploadId,
        uploaded_value: issue.currentValue,
        approved_master_name: masterToSave,
        category: categoryKey
      });

      if (res.data && res.data.success) {
        toast.success(`Approved alias: "${issue.currentValue}" -> "${masterToSave}"`);
        if (onMappingApproved) {
          onMappingApproved(issue, masterToSave);
        }
      } else {
        toast.error('Failed to approve mapping.');
      }
    } catch (err) {
      console.error('Failed to approve master mapping:', err);
      toast.error('Error approving master mapping.');
    } finally {
      setProcessingId(null);
    }
  };

  const getAvailableMasterOptions = (category) => {
    const catLower = (category || '').toLowerCase();
    if (catLower.includes('party') || catLower.includes('ledger')) return partyLedgers;
    if (catLower.includes('inventory') || catLower.includes('item')) return stockItems;
    if (catLower.includes('bank')) return bankLedgers;
    if (catLower.includes('cost')) return costCenters;
    return [...partyLedgers, ...stockItems];
  };

  return (
    <div className="flex flex-col h-full bg-[#121218] text-slate-100 font-sans text-xs select-none">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-[#1a1a24]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Database size={16} />
          </div>
          <div>
            <h2 className="text-sm font-black text-white flex items-center gap-2">
              Master Mapping Review Center
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {masterIssues.length} Unmapped Values
              </span>
            </h2>
            <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
              Review unmatched uploaded names. Approved mappings are automatically saved as company aliases for future uploads.
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
        >
          <X size={16} />
        </button>
      </div>

      {/* Toolbar */}
      <div className="px-5 py-3 border-b border-slate-800 bg-[#161620] flex items-center justify-between gap-4">
        {/* Category Tabs */}
        <div className="flex items-center gap-1 bg-slate-900/60 p-1 rounded-lg border border-slate-800">
          {['All', 'Party', 'Item', 'Bank', 'Cost Center'].map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1 rounded-md text-[11px] font-bold transition ${
                activeCategory === cat
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
          <input
            type="text"
            placeholder="Search unmapped values..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-8 pl-8 pr-3 bg-slate-900 border border-slate-800 rounded-lg text-[11px] text-white outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Main Content List */}
      <div className="flex-1 overflow-y-auto p-5 space-y-3 themed-scrollbar">
        {filteredIssues.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
            <CheckCircle2 size={36} className="text-emerald-400 mb-2" />
            <h3 className="text-sm font-black text-white">All Master Mappings Resolved!</h3>
            <p className="text-[11px] text-slate-500 mt-1 max-w-sm">
              All uploaded party ledgers, stock items, and bank accounts match existing company master data.
            </p>
          </div>
        ) : (
          filteredIssues.map((issue) => {
            const masterOptions = getAvailableMasterOptions(issue.category);
            const currentSelected = customMappings[issue.id] || issue.suggestedValue || '';

            return (
              <div
                key={issue.id}
                className="bg-[#181822] border border-slate-800/80 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:border-slate-700 transition"
              >
                {/* Uploaded Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      {issue.category || 'Master'}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">Row {issue.row}</span>
                  </div>
                  <h4 className="text-xs font-black text-white truncate">
                    Uploaded: <span className="text-indigo-300 font-mono">"{issue.currentValue}"</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 font-semibold mt-0.5 truncate">
                    {issue.whatIsWrong || 'Unmapped value requires master association.'}
                  </p>
                </div>

                {/* Master Match Dropdown & Actions */}
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <div className="flex flex-col gap-1 w-full md:w-56">
                    <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Select Master Data</span>
                    <select
                      value={currentSelected}
                      onChange={(e) => setCustomMappings({ ...customMappings, [issue.id]: e.target.value })}
                      className="h-8 px-2 bg-slate-900 border border-slate-700 rounded-lg text-[11px] text-white outline-none focus:border-indigo-500"
                    >
                      <option value="">-- Choose Master --</option>
                      {issue.suggestedValue && (
                        <option value={issue.suggestedValue}>
                          ⭐ {issue.suggestedValue} ({Math.round((issue.confidence || 0.9) * 100)}% match)
                        </option>
                      )}
                      {masterOptions.map((m, idx) => (
                        <option key={idx} value={typeof m === 'string' ? m : (m.name || m.ledgerName)}>
                          {typeof m === 'string' ? m : (m.name || m.ledgerName)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={() => handleApproveMapping(issue, currentSelected)}
                    disabled={processingId === issue.id || !currentSelected}
                    className="h-8 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-[11px] font-black cursor-pointer transition border-none flex items-center gap-1.5 shrink-0 mt-3 md:mt-0"
                  >
                    {processingId === issue.id ? (
                      <RefreshCw size={12} className="animate-spin" />
                    ) : (
                      <Check size={12} />
                    )}
                    <span>Approve & Save Alias</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
