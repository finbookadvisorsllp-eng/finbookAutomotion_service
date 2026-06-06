import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { Plus, Trash2, RotateCcw, Save, AlertCircle } from 'lucide-react';

export const DEFAULT_BUCKETS = [
  { id: 1, from: 0, to: 30 },
  { id: 2, from: 31, to: 60 },
  { id: 3, from: 61, to: 90 },
  { id: 4, from: 91, to: null },
];

export default function CustomizeAgingModal({ isOpen, onClose, currentBuckets, onSave }) {
  const [buckets, setBuckets] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setBuckets(JSON.parse(JSON.stringify(currentBuckets || DEFAULT_BUCKETS)));
      setError(null);
    }
  }, [isOpen, currentBuckets]);

  const handleUpdate = (index, field, value) => {
    const newBuckets = [...buckets];
    newBuckets[index][field] = value === '' ? null : Number(value);
    setBuckets(newBuckets);
    setError(null);
  };

  const handleAdd = () => {
    const lastBucket = buckets[buckets.length - 1];
    let nextFrom = 0;
    if (lastBucket) {
      nextFrom = lastBucket.to !== null ? lastBucket.to + 1 : (lastBucket.from + 30);
      // If the previous last bucket was "Above", we need to cap it so we can add a new one
      if (lastBucket.to === null) {
        lastBucket.to = lastBucket.from + 29;
        nextFrom = lastBucket.to + 1;
      }
    }
    
    setBuckets([
      ...buckets,
      { id: Date.now(), from: nextFrom, to: null }
    ]);
    setError(null);
  };

  const handleRemove = (index) => {
    const newBuckets = buckets.filter((_, i) => i !== index);
    if (newBuckets.length > 0) {
      newBuckets[newBuckets.length - 1].to = null; // Ensure last is always "Above"
    }
    setBuckets(newBuckets);
    setError(null);
  };

  const handleReset = () => {
    setBuckets(JSON.parse(JSON.stringify(DEFAULT_BUCKETS)));
    setError(null);
  };

  const validateBuckets = () => {
    if (buckets.length === 0) return "Please add at least one bucket.";
    
    for (let i = 0; i < buckets.length; i++) {
      const b = buckets[i];
      if (b.from === null || b.from < 0) return `Row ${i + 1}: 'From' value must be 0 or positive.`;
      if (i < buckets.length - 1) {
        if (b.to === null) return `Row ${i + 1}: 'To' value cannot be empty unless it's the last bucket.`;
        if (b.to < b.from) return `Row ${i + 1}: 'To' cannot be less than 'From'.`;
      }
      
      if (i > 0) {
        const prev = buckets[i - 1];
        if (b.from !== prev.to + 1) {
          return `Row ${i + 1}: Must start exactly 1 day after the previous bucket ends (Expected ${prev.to + 1}).`;
        }
      }
    }
    return null;
  };

  const handleSave = () => {
    const validationError = validateBuckets();
    if (validationError) {
      setError(validationError);
      return;
    }
    
    // Ensure the last bucket has to = null
    const finalBuckets = [...buckets];
    finalBuckets[finalBuckets.length - 1].to = null;
    
    onSave(finalBuckets);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Customize Aging Buckets" size="md">
      <div className="space-y-6">
        
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-4 items-center mb-3 px-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">From (Days)</span>
            <span className="w-8"></span>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">To (Days)</span>
            <span className="w-8"></span>
          </div>
          
          <div className="space-y-3">
            {buckets.map((b, idx) => (
              <div key={b.id} className="grid grid-cols-[1fr_auto_1fr_auto] gap-4 items-center group">
                <input 
                  type="number" 
                  value={b.from} 
                  onChange={(e) => handleUpdate(idx, 'from', e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 focus:outline-none focus:border-blue-500 transition-colors"
                />
                <span className="text-slate-400 font-black">→</span>
                
                {idx === buckets.length - 1 ? (
                  <div className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-500 flex items-center justify-center">
                    Above
                  </div>
                ) : (
                  <input 
                    type="number" 
                    value={b.to || ''} 
                    onChange={(e) => handleUpdate(idx, 'to', e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                )}
                
                <button 
                  onClick={() => handleRemove(idx)}
                  disabled={buckets.length === 1}
                  className="w-8 h-8 flex items-center justify-center rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          
          <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between">
            <button 
              onClick={handleAdd}
              className="flex items-center gap-1.5 text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors"
            >
              <Plus size={16} /> Add Bucket
            </button>
            <button 
              onClick={handleReset}
              className="flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
            >
              <RotateCcw size={14} /> Reset to Default
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg text-red-600 dark:text-red-400 text-sm font-semibold animate-fade-in">
            <AlertCircle size={16} className="shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button 
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-colors"
          >
            <Save size={16} /> Save Configuration
          </button>
        </div>

      </div>
    </Modal>
  );
}
