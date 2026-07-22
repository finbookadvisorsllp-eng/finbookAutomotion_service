import { useMemo, useState } from 'react'
import { Plus, X, Pencil, Eye, RefreshCw, Building2, CheckCircle, Calendar, Layers } from 'lucide-react'
import { useCompanies, useCreateCompany } from './hooks'
import { toast } from 'sonner'
import DataTable from '../ui/DataTable'
import StatCard from '../ui/StatCard'
import Badge from '../ui/Badge'
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
    { label: 'Active Companies', value: rows.length, icon: Building2 },
    { label: 'Registered GSTINs', value: rows.filter(r => r.gstNumber !== 'N/A').length, icon: CheckCircle },
    { label: 'Fiscal Years Active', value: '1 FY', icon: Calendar },
    { label: 'Tenant Slots', value: 'Unlimited', icon: Layers },
  ];

  const columns = [
    { key: 'id', header: 'Sr', width: '52px', align: 'center', render: (r) => <span style={{ color: 'var(--app-muted)' }}>{r.id}</span> },
    { key: 'businessName', header: 'Company Name', sortable: true, render: (r) => <span className="font-bold" style={{ color: 'var(--app-heading)' }}>{r.businessName}</span> },
    { key: 'gstNumber', header: 'GSTIN', sortable: true, render: (r) => <span className="font-mono font-semibold">{r.gstNumber}</span> },
    { key: 'state', header: 'State', render: (r) => <span style={{ color: 'var(--app-muted)' }}>{r.state}</span> },
    { key: 'financialYear', header: 'Financial Year', render: (r) => <span className="font-semibold">{r.financialYear}</span> },
    { key: 'status', header: 'Status', align: 'center', render: () => <Badge tone="success">active</Badge> },
    { key: 'act', header: '', align: 'center', width: '90px', render: (r) => (
      <div className="flex items-center justify-center gap-1">
        <button onClick={() => handleIconClick('edit', r)} title="Edit" aria-label="Edit" className="p-1 rounded-md hover:bg-[var(--app-control-hover)] hover:text-[var(--app-accent)]" style={{ color: 'var(--app-muted)' }}><Pencil size={11} /></button>
        <button onClick={() => handleIconClick('view', r)} title="View" aria-label="View" className="p-1 rounded-md hover:bg-[var(--app-control-hover)] hover:text-[var(--app-accent)]" style={{ color: 'var(--app-muted)' }}><Eye size={12} /></button>
      </div>
    ) },
  ];

  return (
    <div className="flex flex-col gap-2.5 h-full overflow-hidden p-1 text-[13px] text-[var(--app-text)]">

      {/* Header */}
      <div className="rounded-xl border px-3 py-2.5 flex items-center justify-between gap-3 shrink-0 bg-[var(--app-panel-bg)] border-[var(--app-border)] shadow-sm">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: 'var(--app-accent-gradient)', boxShadow: 'var(--app-shadow)' }}>
            <Building2 size={17} strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <h1 className="text-[17px] font-extrabold tracking-tight text-[var(--app-heading)] leading-none">Company Management</h1>
            <p className="text-[10px] text-[var(--app-muted)] mt-1 truncate">Configure tenants, businesses, GSTIN registrations and fiscal scopes.</p>
          </div>
        </div>
        <button onClick={() => setShowCreateForm(p => !p)} className="h-8 px-3 m3-interactive bg-[var(--app-accent)] hover:opacity-90 text-white font-bold text-[11px] rounded-lg flex items-center gap-1.5 transition-all shrink-0 shadow-xs">
          {showCreateForm ? <X size={13} /> : <Plus size={13} />}
          {showCreateForm ? 'Close' : 'Create Company'}
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 shrink-0">
        {stats.map((s, i) => <StatCard key={s.label} index={i} label={s.label} value={s.value} icon={s.icon} />)}
      </div>

      <AddCompanyModal open={showCreateForm} onClose={() => setShowCreateForm(false)} formValues={formValues} onFieldChange={handleFieldChange} onSave={handleSaveCompany} />

      {/* Company table */}
      <div className="flex-1 min-h-0">
        <DataTable
          minWidth="900px"
          data={filteredRows}
          rowKey={(r) => r.id}
          emptyText="No registered companies found."
          columns={columns}
          search={{ value: search, onChange: setSearch, placeholder: 'Search companies…' }}
          filters={<button type="button" onClick={() => refetch()} title="Refresh" aria-label="Refresh" className="h-8 w-8 flex items-center justify-center border rounded-lg text-[var(--app-muted)] border-[var(--app-border)] hover:bg-[var(--app-control-hover)] transition-colors"><RefreshCw size={13} /></button>}
        />
      </div>
    </div>
  )
}

export default CompaniesPanel
