import { useMemo, useState } from 'react'
import {
  Search,
  Plus,
  FilePlus2,
  ArrowDownToLine,
  Pencil,
  Trash2,
  Eye,
  RefreshCw,
  Settings2,
  Building,
  CheckCircle,
  X,
  ChevronDown
} from 'lucide-react'
import { useCompanies, useCreateCompany } from './hooks'
import { toast } from 'sonner'
import AddCompanyModal from './AddCompanyModal'

const emptyForm = {
  gstNo: '',
  panNo: '',
  businessName: '',
  legalName: '',
  address: '',
  state: 'Madhya Pradesh',
  country: 'India',
  financialYear: '2026-2027',
  contactPerson: '',
  mobile: '',
  email: '',
  status: 'active',
}

function CompaniesPanel({ onIconAction }) {
  const [search, setSearch] = useState('')
  const { data: companyList, refetch } = useCompanies()
  const createCompanyMutation = useCreateCompany()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [formValues, setFormValues] = useState(emptyForm)

  const rows = useMemo(() => {
    if (!companyList) return []
    return companyList.map((company, index) => ({
      id: index + 1,
      mongoId: company.id,
      businessName: company.name,
      legalName: company.name + ' Ltd.',
      gstNumber: company.gstin || 'N/A',
      pan: company.gstin ? company.gstin.substring(2, 12) : 'N/A',
      state: 'Madhya Pradesh',
      country: 'India',
      financialYear: '2026-27',
      contactPerson: 'Anjali Gupta',
      mobile: '+91 98765 43210',
      email: 'contact@friendsgrafix.com',
      status: 'active',
    }))
  }, [companyList])

  const filteredRows = useMemo(() => {
    const value = search.trim().toLowerCase()
    if (!value) return rows
    return rows.filter(
      (row) =>
        row.businessName.toLowerCase().includes(value) ||
        row.gstNumber.toLowerCase().includes(value) ||
        row.state.toLowerCase().includes(value),
    )
  }, [rows, search])

  const handleIconClick = (name, payload) => {
    if (onIconAction) onIconAction(name, payload)
  }

  const handleSaveCompany = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!formValues.businessName) {
      toast.error('Company Name is required.');
      return;
    }
    const companyName = formValues.businessName
    const gst = formValues.gstNo || ''
    try {
      await createCompanyMutation.mutateAsync({ name: companyName, gstin: gst })
      setShowCreateForm(false)
      setFormValues(emptyForm)
      handleIconClick('save-company', { companyName, gst })
      refetch()
    } catch (err) {
      console.error('Failed to save company:', err)
    }
  }

  const handleFieldChange = (key, val) => {
    setFormValues(prev => ({ ...prev, [key]: val }));
  };

  const stats = [
    { label: 'Active Companies', count: rows.length, color: 'text-emerald-800 dark:text-emerald-300', countColor: 'text-emerald-950 dark:text-emerald-50', cardBg: 'bg-emerald-50/80 border-emerald-200/80 dark:bg-emerald-950/20 dark:border-emerald-900/30' },
    { label: 'Registered GSTINs', count: rows.filter(r => r.gstNumber !== 'N/A').length, color: 'text-[var(--app-accent)] dark:text-[var(--app-accent)]', countColor: 'text-[var(--app-accent)] dark:text-[var(--app-accent)]', cardBg: 'bg-[var(--app-accent-soft)] border-[var(--app-border)] dark:bg-[var(--app-accent-soft)] dark:border-[var(--app-border)]' },
    { label: 'Fiscal Years Active', count: '1 FY', color: 'text-[var(--app-accent)] dark:text-[var(--app-accent)]', countColor: 'text-[var(--app-accent)] dark:text-[var(--app-accent)]', cardBg: 'bg-[var(--app-accent-soft)] border-[var(--app-border)] dark:bg-[var(--app-accent-soft)] dark:border-[var(--app-border)]' },
    { label: 'Available Tenant Slots', count: 'Unlimited', color: 'text-[var(--app-accent)] dark:text-[var(--app-accent)]', countColor: 'text-[var(--app-accent)] dark:text-[var(--app-accent)]', cardBg: 'bg-[var(--app-accent-soft)] border-[var(--app-border)] dark:bg-[var(--app-accent-soft)] dark:border-[var(--app-border)]' }
  ];

  return (
    <div className="flex flex-col gap-2.5 h-full overflow-y-auto pr-1 text-[13px] text-[var(--app-text)]">
      
      {/* Title Header */}
      <div className="rounded-xl border px-3 py-2 flex items-center justify-between shrink-0 bg-[var(--app-panel-bg)] border-[var(--app-border)] shadow-sm">
        <div>
          <h1 className="text-[18px] md:text-[20px] font-extrabold tracking-tight text-[var(--app-heading)]">Company Management</h1>
          <p className="text-[11px] text-[var(--app-muted)] mt-0.5">
            Configure system tenants, enterprise businesses, GSTIN registrations, and fiscal scopes.
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(p => !p)}
          className="px-3.5 py-1.5 bg-[var(--app-accent)] hover:opacity-90 text-white font-bold text-[10.5px] rounded-lg flex items-center gap-1 transition-all uppercase shrink-0 shadow-sm"
        >
          {showCreateForm ? <X size={12} /> : <Plus size={12} />}
          {showCreateForm ? 'Close Form' : 'Create Company'}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 shrink-0">
        {stats.map((s, idx) => (
          <div key={idx} className={`p-2 border rounded-xl flex flex-col justify-between transition-all ${s.cardBg}`}>
            <span className={`text-[10px] uppercase font-bold tracking-wider leading-none block ${s.color}`}>{s.label}</span>
            <span className={`text-[15px] font-extrabold mt-1 block leading-none ${s.countColor}`}>{s.count}</span>
          </div>
        ))}
      </div>

      {/* Add Company Popup Modal */}
      <AddCompanyModal
        open={showCreateForm}
        onClose={() => setShowCreateForm(false)}
        formValues={formValues}
        onFieldChange={handleFieldChange}
        onSave={handleSaveCompany}
      />

      {/* Toolbar filters */}
      <div className="border rounded px-2.5 py-2 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 bg-[var(--app-panel-bg)] border-[var(--app-border)] shrink-0">
        
        {/* Search */}
        <div className="relative max-w-xs flex-1 group">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
          <input
            type="text"
            placeholder="Search companies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-7 pl-8 pr-2.5 rounded border text-[11px] outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 border rounded text-[var(--app-muted)] border-[var(--app-border)]"
            type="button"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Company List Table Grid */}
      <div className="border rounded-xl flex-1 overflow-hidden flex flex-col bg-[var(--app-panel-bg)] border-[var(--app-border)] shadow-sm">
        <div className="overflow-auto themed-scrollbar flex-1">
          <table className="w-full text-left border-collapse min-w-[900px] text-[13px]">
            <thead>
              <tr className="bg-[var(--app-content-bg)] border-b text-[var(--app-muted)] border-[var(--app-border)]" style={{ backgroundColor: 'var(--app-table-head-bg)' }}>
                <th className="p-2 w-12 text-center" style={{ color: 'var(--app-muted)' }}>Sr.</th>
                <th className="p-2 border-r border-[var(--app-border)]" style={{ color: 'var(--app-muted)' }}>Company Name</th>
                <th className="p-2 border-r border-[var(--app-border)]" style={{ color: 'var(--app-muted)' }}>GSTIN</th>
                <th className="p-2 border-r border-[var(--app-border)]" style={{ color: 'var(--app-muted)' }}>State</th>
                <th className="p-2 border-r border-[var(--app-border)]" style={{ color: 'var(--app-muted)' }}>Financial Year</th>
                <th className="p-2 border-r border-[var(--app-border)] text-center" style={{ color: 'var(--app-muted)' }}>Status</th>
                <th className="p-2 text-center w-24" style={{ color: 'var(--app-muted)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length > 0 ? (
                filteredRows.map((row) => (
                  <tr key={row.id} className="border-b hover:bg-slate-50/50 dark:hover:bg-slate-900/10 font-medium text-[var(--app-text)] border-[var(--app-border)]">
                    <td className="p-2 text-center text-slate-500">{row.id}</td>
                    
                    <td className="p-2 border-r font-bold text-[var(--app-heading)] border-[var(--app-border)]">
                      {row.businessName}
                    </td>
                    <td className="p-2 border-r text-[var(--app-text)] font-mono font-semibold">{row.gstNumber}</td>
                    <td className="p-2 border-r text-[var(--app-text)]">{row.state}</td>
                    <td className="p-2 border-r text-[var(--app-text)] font-semibold">{row.financialYear}</td>
                    
                    <td className="p-2 border-r text-center">
                      <span className="px-1.5 py-0.5 rounded border bg-emerald-50 text-emerald-700 border-emerald-250 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30 text-[10.5px] font-bold">
                        {row.status}
                      </span>
                    </td>

                    <td className="p-2 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button type="button" onClick={() => handleIconClick('edit', row)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-[var(--app-accent)] rounded transition-colors"><Pencil size={11} /></button>
                        <button type="button" onClick={() => handleIconClick('view', row)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-[var(--app-accent)] rounded transition-colors"><Eye size={12} /></button>
                      </div>
                    </td>

                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 font-medium">
                    No registered companies found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}

export default CompaniesPanel
