import React, { useState } from 'react';
import { Plug, Wifi, Database, Activity, RefreshCw, CheckCircle2, AlertCircle, Terminal, HardDrive, Plus, X, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function TallyConnectorPanel() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Connected');

  // Config parameters state
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
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 1000)),
      {
        loading: `Testing XML connection at http://${form.serverIp}:${form.port}...`,
        success: () => {
          setConnectionStatus('Connected');
          return `Successfully pinged Tally Company: "${form.companyName}"!`;
        },
        error: 'Connection failed.'
      }
    );
  };

  const handleSyncNow = () => {
    setIsSyncing(true);
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 1500)),
      {
        loading: 'Dispatching Tally XML payload...',
        success: () => {
          setIsSyncing(false);
          const newLog = {
            id: 'log-' + Date.now(),
            date: '19-06-2026 15:45',
            operation: 'Manual Sync',
            type: 'All Vouchers',
            status: 'Success',
            message: 'Manual trigger sync completed successfully.'
          };
          setLogs(prev => [newLog, ...prev]);
          return 'Sync complete! All approved records posted to Tally.';
        },
        error: () => {
          setIsSyncing(false);
          return 'Sync failed.';
        }
      }
    );
  };

  const handleSave = (e) => {
    e.preventDefault();
    toast.success('Tally Connector configuration saved successfully!');
  };

  // Spec Summary Cards: Connection Status, Last Sync, Masters Synced, Vouchers Synced, Failed Records
  const stats = [
    { label: 'Connection Status', value: connectionStatus, desc: `http://${form.serverIp}:${form.port}`, color: 'text-emerald-800 dark:text-emerald-300', countColor: 'text-emerald-950 dark:text-emerald-50', cardBg: 'bg-emerald-50/80 border-emerald-200/80 dark:bg-emerald-950/20 dark:border-emerald-900/30' },
    { label: 'Last Sync', value: 'Today, 15:42', desc: 'Auto check every 5m', color: 'text-[var(--app-accent)] dark:text-[var(--app-accent)]', countColor: 'text-[var(--app-accent)] dark:text-[var(--app-accent)]', cardBg: 'bg-[var(--app-accent-soft)] border-[var(--app-border)] dark:bg-[var(--app-accent-soft)] dark:border-[var(--app-border)]' },
    { label: 'Masters Synced', value: '412 ledgers', desc: 'Sync health: 100%', color: 'text-[var(--app-accent)] dark:text-[var(--app-accent)]', countColor: 'text-[var(--app-accent)] dark:text-[var(--app-accent)]', cardBg: 'bg-[var(--app-accent-soft)] border-[var(--app-border)] dark:bg-[var(--app-accent-soft)] dark:border-[var(--app-border)]' },
    { label: 'Vouchers Synced', value: '4,289 entries', desc: 'Post success: 99.8%', color: 'text-[var(--app-accent)] dark:text-[var(--app-accent)]', countColor: 'text-[var(--app-accent)] dark:text-[var(--app-accent)]', cardBg: 'bg-[var(--app-accent-soft)] border-[var(--app-border)] dark:bg-[var(--app-accent-soft)] dark:border-[var(--app-border)]' },
    { label: 'Failed Records', value: '1 failure', desc: 'Awaiting retry schedule', color: 'text-rose-800 dark:text-rose-300', countColor: 'text-rose-950 dark:text-rose-50', cardBg: 'bg-rose-50/80 border-rose-200/80 dark:bg-rose-950/20 dark:border-rose-900/30' }
  ];

  return (
    <div className="flex flex-col gap-2.5 h-full overflow-y-auto pr-1 text-[13px] text-slate-700 dark:text-slate-200">
      
      {/* Title Header */}
      <div className="rounded-xl border px-3 py-2 flex items-center justify-between shrink-0 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-[18px] md:text-[20px] font-extrabold tracking-tight text-slate-900 dark:text-[var(--app-heading)]">Tally Connector</h1>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Configure integration parameters and monitor data sync logs with Tally ODBC / XML gateway.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-1.5 shrink-0">
        {stats.map((s, idx) => (
          <div key={idx} className={`p-2 border rounded-xl flex flex-col justify-between transition-all ${s.cardBg}`}>
            <span className={`text-[10px] uppercase font-bold tracking-wider leading-none block ${s.color}`}>{s.label}</span>
            <div className={`text-[15px] font-extrabold mt-1 block leading-none ${s.countColor}`}>{s.value}</div>
            <span className="text-[9px] text-slate-400 mt-0.5 block leading-none">{s.desc}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 overflow-hidden">
        
        {/* Left Side: Configuration Form */}
        <div className="lg:col-span-5 flex flex-col border rounded-xl p-3 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shrink-0 shadow-sm">
          <h3 className="text-[14px] font-bold uppercase tracking-wider text-slate-900 dark:text-slate-300 border-b pb-2 mb-2.5 border-slate-200 dark:border-slate-800 flex items-center gap-1.5 shrink-0" style={{ backgroundColor: 'var(--app-table-head-bg)' }}>
            <Plug size={13} className="text-[var(--app-accent)]" /> Tally ODBC Sync Settings
          </h3>

          <form onSubmit={handleSave} className="space-y-2 flex-1">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[12px] font-semibold text-slate-500 mb-0.5 block">Tally Server IP</label>
                <input
                  type="text"
                  value={form.serverIp}
                  onChange={(e) => setForm(prev => ({ ...prev, serverIp: e.target.value }))}
                  className="w-full h-8 rounded border px-2.5 text-[13px] outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800"
                />
              </div>

              <div>
                <label className="text-[12px] font-semibold text-slate-500 mb-0.5 block">XML Server Port</label>
                <input
                  type="text"
                  value={form.port}
                  onChange={(e) => setForm(prev => ({ ...prev, port: e.target.value }))}
                  className="w-full h-8 rounded border px-2.5 text-[13px] outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="text-[12px] font-semibold text-slate-500 mb-0.5 block">Tally Active Company Name</label>
              <input
                type="text"
                value={form.companyName}
                onChange={(e) => setForm(prev => ({ ...prev, companyName: e.target.value }))}
                className="w-full h-8 rounded border px-2.5 text-[13px] outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[12px] font-semibold text-slate-500 mb-0.5 block">ODBC Username</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm(prev => ({ ...prev, username: e.target.value }))}
                  className="w-full h-8 rounded border px-2.5 text-[13px] outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800"
                />
              </div>

              <div>
                <label className="text-[12px] font-semibold text-slate-500 mb-0.5 block">ODBC Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full h-8 rounded border px-2.5 text-[13px] outline-none bg-slate-50 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800"
                />
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-b py-2 my-2 border-slate-100 dark:border-slate-800/80">
              <div className="flex flex-col">
                <span className="font-semibold text-slate-800 dark:text-slate-200">Auto Sync Schedule</span>
                <span className="text-[10px] text-slate-400">Trigger sync every 5 minutes</span>
              </div>
              <input
                type="checkbox"
                checked={form.autoSync}
                onChange={(e) => setForm(prev => ({ ...prev, autoSync: e.target.checked }))}
                className="w-3.5 h-3.5 accent-[var(--app-accent)] rounded cursor-pointer"
              />
            </div>

            <div className="flex gap-1.5 pt-2">
              <button
                type="button"
                onClick={handleTestConnection}
                className="flex-1 py-1 text-[11px] uppercase font-bold rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
              >
                Test Connection
              </button>
              <button
                type="submit"
                className="flex-1 py-1 text-[11px] uppercase font-bold rounded bg-emerald-600 hover:bg-emerald-700 text-white shadow transition-colors"
              >
                Save Settings
              </button>
              <button
                type="button"
                onClick={handleSyncNow}
                disabled={isSyncing}
                className="flex-1 py-1 text-[11px] uppercase font-bold rounded bg-[var(--app-accent)] hover:opacity-90 text-white shadow flex items-center justify-center gap-1 transition-all disabled:opacity-60"
              >
                {isSyncing ? <RefreshCw className="animate-spin" size={11} /> : <Database size={11} />} Sync Now
              </button>
            </div>
          </form>
        </div>

        {/* Right Side: Sync Logs Table */}
        <div className="lg:col-span-7 flex flex-col border rounded-xl overflow-hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="text-[14px] font-bold uppercase tracking-wider text-slate-900 dark:text-slate-300 border-b p-2.5 border-slate-200 dark:border-slate-800 flex items-center gap-1.5 shrink-0" style={{ backgroundColor: 'var(--app-table-head-bg)' }}>
            <Terminal size={13} className="text-[var(--app-accent)]" /> Connection Sync Logs
          </h3>

          <div className="overflow-auto themed-scrollbar flex-1">
            <table className="w-full text-left border-collapse min-w-[500px] text-[13px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/60 border-b text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800" style={{ backgroundColor: 'var(--app-table-head-bg)' }}>
                  <th className="p-2 border-r border-slate-200 dark:border-slate-800 w-[120px]" style={{ color: 'var(--app-muted)' }}>Date</th>
                  <th className="p-2 border-r border-slate-200 dark:border-slate-800" style={{ color: 'var(--app-muted)' }}>Operation</th>
                  <th className="p-2 border-r border-slate-200 dark:border-slate-800 w-[100px]" style={{ color: 'var(--app-muted)' }}>Type</th>
                  <th className="p-2 border-r border-slate-200 dark:border-slate-800 text-center w-[80px]" style={{ color: 'var(--app-muted)' }}>Status</th>
                  <th className="p-2" style={{ color: 'var(--app-muted)' }}>Message</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const statusColors = log.status === 'Success' 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-250 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30' 
                    : 'bg-rose-50 text-rose-700 border-rose-250 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30';

                  return (
                    <tr key={log.id} className="border-b hover:bg-slate-50/50 dark:hover:bg-slate-900/10 font-medium text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800">
                      <td className="p-2 border-r border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-mono text-[11px]">{log.date}</td>
                      <td className="p-2 border-r border-slate-200 dark:border-slate-800 font-semibold text-slate-900 dark:text-slate-100">{log.operation}</td>
                      <td className="p-2 border-r border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">{log.type}</td>
                      <td className="p-2 border-r border-slate-200 dark:border-slate-800 text-center">
                        <span className={`px-1.5 py-0.5 rounded border text-[10.5px] font-bold ${statusColors}`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="p-2 text-slate-500 dark:text-slate-400 text-[11px] leading-snug">{log.message}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
}
