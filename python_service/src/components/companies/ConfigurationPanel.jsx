import React, { useState } from 'react';
import { Settings, Search, Plus, X, Trash2, Pencil, CheckCircle, RefreshCw, Sliders, Database, Layers, Terminal } from 'lucide-react';
import { toast } from 'sonner';

export default function ConfigurationPanel() {
  const [activeSection, setActiveSection] = useState('General Settings');

  const sections = [
    'General Settings',
    'Voucher Settings',
    'GST Settings',
    'Number Series',
    'Approval Workflow',
    'AI Settings',
    'OCR Settings',
    'Document Settings',
    'Tally Settings',
    'Notification Settings'
  ];

  // Forms state
  const [generalConfig, setGeneralConfig] = useState({
    systemName: 'Finbook AI Automation Platform',
    timezone: 'Asia/Kolkata (GMT+05:30)',
    dateFormat: 'DD-MM-YYYY',
    currency: 'INR (₹)'
  });

  const [tallyConfig, setTallyConfig] = useState({
    serverIp: '127.0.0.1',
    port: '9000',
    companyName: 'Finbook Advisors LLP',
    username: 'admin',
    password: '••••••••',
    autoSync: true
  });

  const [ocrConfig, setOcrConfig] = useState({
    minConfidence: 85,
    autoExtractLines: true,
    enginePreference: 'Vision OCR v4.2-Pro'
  });

  const handleSave = (e) => {
    e.preventDefault();
    toast.success(`${activeSection} saved successfully!`);
  };

  const stats = [
    { label: 'Active Parameters', count: '14 system vars', color: 'text-[var(--app-accent)] dark:text-[var(--app-accent)] bg-[var(--app-accent-soft)]' },
    { label: 'OCR Model Version', count: 'v4.2-Pro', color: 'text-[var(--app-accent)] dark:text-[var(--app-accent)] bg-[var(--app-accent-soft)]' },
    { label: 'Tally Port Sync', count: 'Port 9000', color: 'text-[var(--app-accent)] dark:text-[var(--app-accent)] bg-[var(--app-accent-soft)]' },
    { label: 'System status', count: '100% Operational', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' }
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden text-[13px] text-[var(--app-text)]">
      
      {/* Title Header */}
      <div className="rounded-lg border px-3 py-2 flex items-center justify-between shrink-0 bg-[var(--app-panel-bg)] border-[var(--app-border)] mb-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--app-heading)]">System Configuration</h1>
          <p className="text-[11px] text-[var(--app-muted)] mt-0.5">
            Configure system execution parameters, notification channels, Tally settings and OCR thresholds.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 shrink-0 mb-2.5">
        {stats.map((s, idx) => (
          <div key={idx} className="p-2 border rounded bg-[var(--app-panel-bg)] border-[var(--app-border)] flex flex-col justify-between">
            <span className="text-[11px] text-[var(--app-muted)] uppercase font-semibold tracking-wider leading-none block">{s.label}</span>
            <span className="text-[15px] font-bold mt-1 text-[var(--app-heading)] block leading-none">{s.count}</span>
          </div>
        ))}
      </div>

      {/* Main Grid: Left Settings Menu, Right Form */}
      <div className="flex-1 flex gap-3 overflow-hidden min-h-0 relative pb-14">
        
        {/* Left Settings Menu */}
        <div className="w-56 shrink-0 border rounded bg-[var(--app-panel-bg)] border-[var(--app-border)] flex flex-col p-1.5 overflow-y-auto">
          {sections.map(section => {
            const isActive = section === activeSection;
            return (
              <button
                key={section}
                onClick={() => setActiveSection(section)}
                className={`w-full text-left px-3 py-2 rounded text-[12.5px] font-semibold transition-colors ${
                  isActive 
                    ? 'bg-[var(--app-accent)] text-white font-bold' 
                    : 'text-[var(--app-text)] hover:bg-slate-100 dark:hover:bg-slate-900/50'
                }`}
              >
                {section}
              </button>
            );
          })}
        </div>

        {/* Right Configuration Form */}
        <div className="flex-1 border rounded bg-[var(--app-panel-bg)] border-[var(--app-border)] p-4 overflow-y-auto flex flex-col justify-between">
          <form onSubmit={handleSave} className="space-y-4">
            <h3 className="text-sm font-bold text-[var(--app-heading)] border-b pb-1.5 border-[var(--app-border)] uppercase tracking-wider">{activeSection}</h3>

            {activeSection === 'General Settings' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[12px] font-semibold text-slate-500 mb-0.5 block">System Name</label>
                  <input
                    type="text"
                    value={generalConfig.systemName}
                    onChange={(e) => setGeneralConfig(prev => ({ ...prev, systemName: e.target.value }))}
                    className="w-full h-8 rounded border px-2.5 text-[13px] outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)]"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-slate-500 mb-0.5 block">Timezone</label>
                  <input
                    type="text"
                    value={generalConfig.timezone}
                    onChange={(e) => setGeneralConfig(prev => ({ ...prev, timezone: e.target.value }))}
                    className="w-full h-8 rounded border px-2.5 text-[13px] outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)]"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-slate-500 mb-0.5 block">Date Format</label>
                  <input
                    type="text"
                    value={generalConfig.dateFormat}
                    onChange={(e) => setGeneralConfig(prev => ({ ...prev, dateFormat: e.target.value }))}
                    className="w-full h-8 rounded border px-2.5 text-[13px] outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)]"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-slate-500 mb-0.5 block">Base Currency</label>
                  <input
                    type="text"
                    value={generalConfig.currency}
                    onChange={(e) => setGeneralConfig(prev => ({ ...prev, currency: e.target.value }))}
                    className="w-full h-8 rounded border px-2.5 text-[13px] outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)]"
                  />
                </div>
              </div>
            )}

            {activeSection === 'Tally Settings' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[12px] font-semibold text-slate-500 mb-0.5 block">Tally Server IP Address</label>
                  <input
                    type="text"
                    value={tallyConfig.serverIp}
                    onChange={(e) => setTallyConfig(prev => ({ ...prev, serverIp: e.target.value }))}
                    className="w-full h-8 rounded border px-2.5 text-[13px] outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)]"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-slate-500 mb-0.5 block">Vite / Tally Connector Port</label>
                  <input
                    type="text"
                    value={tallyConfig.port}
                    onChange={(e) => setTallyConfig(prev => ({ ...prev, port: e.target.value }))}
                    className="w-full h-8 rounded border px-2.5 text-[13px] outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)]"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-slate-500 mb-0.5 block">Tally Default Company</label>
                  <input
                    type="text"
                    value={tallyConfig.companyName}
                    onChange={(e) => setTallyConfig(prev => ({ ...prev, companyName: e.target.value }))}
                    className="w-full h-8 rounded border px-2.5 text-[13px] outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)]"
                  />
                </div>
                <div className="flex items-center justify-between border rounded p-3 border-[var(--app-border)]/80">
                  <div className="flex flex-col">
                    <span className="font-semibold text-[var(--app-heading)] text-[12px]">Auto Sync Trigger</span>
                    <span className="text-[10px] text-slate-400">Trigger sync runs automatically</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={tallyConfig.autoSync}
                    onChange={(e) => setTallyConfig(prev => ({ ...prev, autoSync: e.target.checked }))}
                    className="w-3.5 h-3.5 accent-[var(--app-accent)] cursor-pointer"
                  />
                </div>
              </div>
            )}

            {activeSection === 'OCR Settings' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[12px] font-semibold text-slate-500 mb-0.5 block">Minimum Classification Confidence (%)</label>
                  <input
                    type="number"
                    value={ocrConfig.minConfidence}
                    onChange={(e) => setOcrConfig(prev => ({ ...prev, minConfidence: parseInt(e.target.value) || 0 }))}
                    className="w-full h-8 rounded border px-2.5 text-[13px] outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)]"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-slate-500 mb-0.5 block">OCR Engine Preference</label>
                  <select
                    value={ocrConfig.enginePreference}
                    onChange={(e) => setOcrConfig(prev => ({ ...prev, enginePreference: e.target.value }))}
                    className="w-full h-8 rounded border px-2 text-[13px] outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)]"
                  >
                    <option value="Vision OCR v4.2-Pro">Vision OCR v4.2-Pro</option>
                    <option value="Tesseract-Light">Tesseract-Light</option>
                  </select>
                </div>
                <div className="flex items-center justify-between border rounded p-3 border-[var(--app-border)]/80 md:col-span-2">
                  <div className="flex flex-col">
                    <span className="font-semibold text-[var(--app-heading)] text-[12px]">Auto Extract Line Items</span>
                    <span className="text-[10px] text-slate-400">Perform itemized inventory table classification</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={ocrConfig.autoExtractLines}
                    onChange={(e) => setOcrConfig(prev => ({ ...prev, autoExtractLines: e.target.checked }))}
                    className="w-3.5 h-3.5 accent-[var(--app-accent)] cursor-pointer"
                  />
                </div>
              </div>
            )}

            {!['General Settings', 'Tally Settings', 'OCR Settings'].includes(activeSection) && (
              <div className="p-8 text-center text-slate-400 font-semibold border border-dashed rounded border-[var(--app-border)]">
                Configurations for {activeSection} are managed by default profiles. Contact Super Admin to request edits.
              </div>
            )}
            
            {/* Fixed save button at the bottom of the form container */}
            <div className="absolute bottom-0 left-0 right-0 h-12 border-t flex items-center justify-end px-4 bg-[var(--app-content-bg)] border-[var(--app-border)]/80">
              <button
                type="submit"
                className="h-8 px-6 bg-[var(--app-accent)] hover:opacity-90 text-white font-bold uppercase text-[11.5px] shadow rounded transition-all"
              >
                Save {activeSection}
              </button>
            </div>
          </form>
        </div>

      </div>

    </div>
  );
}
