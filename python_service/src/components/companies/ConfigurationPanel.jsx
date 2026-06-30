import React, { useState } from 'react';
import { Settings, CheckCircle, Sliders, Database, Terminal } from 'lucide-react';
import { toast } from 'sonner';
import StatCard from '../ui/StatCard';

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
    { label: 'Active Parameters', value: '14 vars', icon: Sliders },
    { label: 'OCR Model', value: 'v4.2-Pro', icon: Database },
    { label: 'Tally Port', value: 'Port 9000', icon: Terminal },
    { label: 'System Status', value: '100% OK', icon: CheckCircle },
  ];

  return (
    <div className="flex flex-col gap-2.5 h-full overflow-hidden p-1 text-[13px] text-[var(--app-text)]">

      {/* Header */}
      <div className="rounded-xl border px-3 py-2.5 flex items-center gap-2.5 shrink-0 bg-[var(--app-panel-bg)] border-[var(--app-border)] shadow-sm">
        <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: 'var(--app-accent-gradient)', boxShadow: 'var(--app-shadow)' }}>
          <Settings size={17} strokeWidth={2.2} />
        </div>
        <div className="min-w-0">
          <h1 className="text-[17px] font-extrabold tracking-tight text-[var(--app-heading)] leading-none">System Configuration</h1>
          <p className="text-[10px] text-[var(--app-muted)] mt-1 truncate">Execution parameters, notification channels, Tally settings and OCR thresholds.</p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 shrink-0">
        {stats.map((s, i) => <StatCard key={s.label} index={i} label={s.label} value={s.value} icon={s.icon} />)}
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
                    : 'text-[var(--app-text)] hover:bg-[var(--app-control-hover)]'
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
                  <label className="text-[12px] font-semibold text-[var(--app-muted)] mb-0.5 block">System Name</label>
                  <input
                    type="text"
                    value={generalConfig.systemName}
                    onChange={(e) => setGeneralConfig(prev => ({ ...prev, systemName: e.target.value }))}
                    className="w-full h-8 rounded border px-2.5 text-[13px] outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)]"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-[var(--app-muted)] mb-0.5 block">Timezone</label>
                  <input
                    type="text"
                    value={generalConfig.timezone}
                    onChange={(e) => setGeneralConfig(prev => ({ ...prev, timezone: e.target.value }))}
                    className="w-full h-8 rounded border px-2.5 text-[13px] outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)]"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-[var(--app-muted)] mb-0.5 block">Date Format</label>
                  <input
                    type="text"
                    value={generalConfig.dateFormat}
                    onChange={(e) => setGeneralConfig(prev => ({ ...prev, dateFormat: e.target.value }))}
                    className="w-full h-8 rounded border px-2.5 text-[13px] outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)]"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-[var(--app-muted)] mb-0.5 block">Base Currency</label>
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
                  <label className="text-[12px] font-semibold text-[var(--app-muted)] mb-0.5 block">Tally Server IP Address</label>
                  <input
                    type="text"
                    value={tallyConfig.serverIp}
                    onChange={(e) => setTallyConfig(prev => ({ ...prev, serverIp: e.target.value }))}
                    className="w-full h-8 rounded border px-2.5 text-[13px] outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)]"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-[var(--app-muted)] mb-0.5 block">Vite / Tally Connector Port</label>
                  <input
                    type="text"
                    value={tallyConfig.port}
                    onChange={(e) => setTallyConfig(prev => ({ ...prev, port: e.target.value }))}
                    className="w-full h-8 rounded border px-2.5 text-[13px] outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)]"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-[var(--app-muted)] mb-0.5 block">Tally Default Company</label>
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
                    <span className="text-[10px] text-[var(--app-muted)]">Trigger sync runs automatically</span>
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
                  <label className="text-[12px] font-semibold text-[var(--app-muted)] mb-0.5 block">Minimum Classification Confidence (%)</label>
                  <input
                    type="number"
                    value={ocrConfig.minConfidence}
                    onChange={(e) => setOcrConfig(prev => ({ ...prev, minConfidence: parseInt(e.target.value) || 0 }))}
                    className="w-full h-8 rounded border px-2.5 text-[13px] outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)]"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-semibold text-[var(--app-muted)] mb-0.5 block">OCR Engine Preference</label>
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
                    <span className="text-[10px] text-[var(--app-muted)]">Perform itemized inventory table classification</span>
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
              <div className="p-8 text-center text-[var(--app-muted)] font-semibold border border-dashed rounded border-[var(--app-border)]">
                Configurations for {activeSection} are managed by default profiles. Contact Super Admin to request edits.
              </div>
            )}
            
            {/* Fixed save button at the bottom of the form container */}
            <div className="absolute bottom-0 left-0 right-0 h-12 border-t flex items-center justify-end px-4 bg-[var(--app-content-bg)] border-[var(--app-border)]/80">
              <button
                type="submit"
                className="h-8 px-6 m3-interactive bg-[var(--app-cta)] hover:opacity-90 text-white font-bold uppercase text-[11.5px] shadow rounded-full transition-all"
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
