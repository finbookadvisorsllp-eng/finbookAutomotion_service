import React, { useState } from 'react';
import { Plug, Wifi, Database, Activity, RefreshCw, AlertCircle, Terminal } from 'lucide-react';
import { toast } from 'sonner';
import DataTable from '../ui/DataTable';
import StatCard from '../ui/StatCard';
import Badge from '../ui/Badge';

export default function TallyConnectorPanel() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Connected');

  const [form, setForm] = useState({
    serverIp: '127.0.0.1',
    port: '9000',
    companyName: 'Finbook Advisors LLP',
    username: 'admin',
    password: '••••••••',
    syncMode: 'XML API',
    autoSync: true
  });

  const [logs, setLogs] = useState([
    { id: 'log-1', date: '19-06-2026 15:42', operation: 'Voucher Post', type: 'Sales', status: 'Success', message: 'Posted sales voucher SI-2026-0001 successfully.' },
    { id: 'log-2', date: '19-06-2026 15:40', operation: 'Master Sync', type: 'Ledger Master', status: 'Success', message: 'Synced 18 newly added client ledger masters.' },
    { id: 'log-3', date: '19-06-2026 15:30', operation: 'Voucher Post', type: 'Purchase', status: 'Success', message: 'Posted purchase invoice PI-2026-0007 successfully.' },
    { id: 'log-4', date: '19-06-2026 15:22', operation: 'Voucher Post', type: 'Payment', status: 'Failure', message: 'ODBC connection timeout error. Retrying sync...' }
  ]);

  const handleTestConnection = () => {
    toast.promise(new Promise((resolve) => setTimeout(resolve, 1000)), {
      loading: `Testing XML connection at http://${form.serverIp}:${form.port}...`,
      success: () => { setConnectionStatus('Connected'); return `Successfully pinged Tally Company: "${form.companyName}"!`; },
      error: 'Connection failed.'
    });
  };

  const handleSyncNow = () => {
    setIsSyncing(true);
    toast.promise(new Promise((resolve) => setTimeout(resolve, 1500)), {
      loading: 'Dispatching Tally XML payload...',
      success: () => {
        setIsSyncing(false);
        setLogs(prev => [{ id: 'log-' + Date.now(), date: '19-06-2026 15:45', operation: 'Manual Sync', type: 'All Vouchers', status: 'Success', message: 'Manual trigger sync completed successfully.' }, ...prev]);
        return 'Sync complete! All approved records posted to Tally.';
      },
      error: () => { setIsSyncing(false); return 'Sync failed.'; }
    });
  };

  const handleSave = (e) => {
    e.preventDefault();
    toast.success('Tally Connector configuration saved successfully!');
  };

  const stats = [
    { label: 'Connection Status', value: connectionStatus, icon: Wifi, insight: `http://${form.serverIp}:${form.port}` },
    { label: 'Last Sync', value: 'Today, 15:42', icon: RefreshCw, insight: 'Auto check every 5m' },
    { label: 'Masters Synced', value: '412 ledgers', icon: Database, insight: 'Sync health 100%' },
    { label: 'Vouchers Synced', value: '4,289 entries', icon: Activity, insight: 'Post success 99.8%' },
    { label: 'Failed Records', value: '1 failure', icon: AlertCircle, insight: 'Awaiting retry' },
  ];

  const Field = ({ label, ...props }) => (
    <div>
      <label className="text-[11px] font-semibold mb-0.5 block" style={{ color: 'var(--app-muted)' }}>{label}</label>
      <input {...props} className="w-full h-8 rounded-lg border px-2.5 text-[13px] outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)] transition-colors" />
    </div>
  );

  const logColumns = [
    { key: 'date', header: 'Date', sortable: true, width: '130px', render: (l) => <span className="font-mono text-[11px]" style={{ color: 'var(--app-muted)' }}>{l.date}</span> },
    { key: 'operation', header: 'Operation', sortable: true, render: (l) => <span className="font-semibold" style={{ color: 'var(--app-heading)' }}>{l.operation}</span> },
    { key: 'type', header: 'Type', sortable: true, render: (l) => <span style={{ color: 'var(--app-muted)' }}>{l.type}</span> },
    { key: 'status', header: 'Status', align: 'center', sortable: true, render: (l) => <Badge tone={l.status === 'Success' ? 'success' : 'danger'}>{l.status}</Badge> },
    { key: 'message', header: 'Message', render: (l) => <span className="text-[11px] leading-snug" style={{ color: 'var(--app-muted)' }}>{l.message}</span> },
  ];

  return (
    <div className="flex flex-col gap-2.5 h-full overflow-hidden p-1 text-[13px] text-[var(--app-text)]">

      {/* Header */}
      <div className="rounded-xl border px-3 py-2.5 flex items-center gap-2.5 shrink-0 bg-[var(--app-panel-bg)] border-[var(--app-border)] shadow-sm">
        <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: 'var(--app-accent-gradient)', boxShadow: 'var(--app-shadow)' }}>
          <Plug size={17} strokeWidth={2.2} />
        </div>
        <div className="min-w-0">
          <h1 className="text-[17px] font-extrabold tracking-tight text-[var(--app-heading)] leading-none">Tally Connector</h1>
          <p className="text-[10px] text-[var(--app-muted)] mt-1 truncate">Configure the ODBC / XML gateway and monitor data-sync activity.</p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 shrink-0">
        {stats.map((s, i) => <StatCard key={s.label} index={i} label={s.label} value={s.value} icon={s.icon} insight={s.insight} />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 min-h-0">

        {/* Config form */}
        <form onSubmit={handleSave} className="lg:col-span-5 flex flex-col gap-2 border rounded-xl p-3 bg-[var(--app-panel-bg)] border-[var(--app-border)] shadow-sm overflow-y-auto themed-scrollbar">
          <h3 className="text-[12px] font-bold uppercase tracking-wider text-[var(--app-heading)] border-b pb-2 border-[var(--app-border)] flex items-center gap-1.5 shrink-0">
            <Plug size={13} className="text-[var(--app-accent)]" /> Tally Sync Settings
          </h3>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Tally Server IP" value={form.serverIp} onChange={(e) => setForm(p => ({ ...p, serverIp: e.target.value }))} />
            <Field label="XML Server Port" value={form.port} onChange={(e) => setForm(p => ({ ...p, port: e.target.value }))} />
          </div>
          <Field label="Tally Active Company Name" value={form.companyName} onChange={(e) => setForm(p => ({ ...p, companyName: e.target.value }))} />
          <div className="grid grid-cols-2 gap-2">
            <Field label="ODBC Username" value={form.username} onChange={(e) => setForm(p => ({ ...p, username: e.target.value }))} />
            <Field label="ODBC Password" type="password" value={form.password} onChange={(e) => setForm(p => ({ ...p, password: e.target.value }))} />
          </div>

          <label className="flex items-center justify-between border-t border-b py-2 my-1 border-[var(--app-border)] cursor-pointer">
            <span className="flex flex-col">
              <span className="font-semibold text-[var(--app-heading)]">Auto Sync Schedule</span>
              <span className="text-[10px]" style={{ color: 'var(--app-muted)' }}>Trigger sync every 5 minutes</span>
            </span>
            <input type="checkbox" checked={form.autoSync} onChange={(e) => setForm(p => ({ ...p, autoSync: e.target.checked }))} className="w-3.5 h-3.5 accent-[var(--app-accent)] rounded cursor-pointer" />
          </label>

          <div className="flex gap-1.5 pt-1 mt-auto">
            <button type="button" onClick={handleTestConnection} className="flex-1 h-8 text-[11px] uppercase font-bold rounded-lg border border-[var(--app-border)] hover:bg-[var(--app-control-hover)] text-[var(--app-text)] transition-colors">Test</button>
            <button type="submit" className="flex-1 h-8 text-[11px] uppercase font-bold rounded-lg border border-[var(--app-border)] bg-[var(--app-control-bg)] hover:bg-[var(--app-control-hover)] text-[var(--app-heading)] transition-colors">Save</button>
            <button type="button" onClick={handleSyncNow} disabled={isSyncing} className="flex-1 h-8 text-[11px] uppercase font-bold rounded-lg m3-interactive bg-[var(--app-accent)] hover:opacity-90 text-white shadow-sm flex items-center justify-center gap-1 transition-all disabled:opacity-60">
              {isSyncing ? <RefreshCw className="animate-spin" size={11} /> : <Database size={11} />} Sync Now
            </button>
          </div>
        </form>

        {/* Sync logs */}
        <div className="lg:col-span-7 min-h-0 flex flex-col">
          <DataTable
            title="Connection Sync Logs"
            icon={Terminal}
            minWidth="560px"
            data={logs}
            rowKey={(l) => l.id}
            emptyText="No sync activity yet."
            columns={logColumns}
          />
        </div>
      </div>
    </div>
  );
}
