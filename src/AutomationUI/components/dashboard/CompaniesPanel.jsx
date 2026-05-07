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
} from 'lucide-react'
import AddCompanyModal from './AddCompanyModal'

const initialRows = [
  {
    id: 1,
    subscription: 'Subscribed\nvalid till Dec 17 2024',
    businessName: 'FRIENDS GRAFIX',
    gstNumber: '23AAFFF6731J1L7',
    state: 'Madhya Pradesh',
    accountants: '',
    owner: '',
    credits: 'unlimited',
    status: 'active',
  },
]

const emptyForm = {
  gstNo: '',
  panNo: '',
  businessName: '',
  address: '',
  locality: '',
  state: '',
  city: '',
  country: 'India',
  industry: '',
}

function CompaniesPanel({ onIconAction }) {
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState(initialRows)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formValues, setFormValues] = useState(emptyForm)

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

  const handleSaveCompany = () => {
    const nextId = rows.length + 1
    const companyName = formValues.businessName || `Company ${nextId}`
    const gst = formValues.gstNo || `GST-${nextId}`
    setRows((prev) => [
      ...prev,
      {
        id: nextId,
        subscription: 'Subscribed\nvalid till Dec 17 2024',
        businessName: companyName,
        gstNumber: gst,
        state: formValues.state || 'Madhya Pradesh',
        accountants: '',
        owner: '',
        credits: 'unlimited',
        status: 'active',
      },
    ])
    setIsModalOpen(false)
    setFormValues(emptyForm)
    handleIconClick('save-company', { companyName, gst })
  }

  return (
    <section className="rounded-xl border overflow-hidden rise-in" style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-panel-bg)' }}>
      <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--app-border)' }}>
        <div className="flex items-center gap-3">
          <h2 className="text-[15px] font-semibold tracking-tight" style={{ color: 'var(--app-heading)' }}>
            Companies
          </h2>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-[11.5px] font-semibold text-white shadow-sm focus-ring"
            style={{ background: 'var(--app-accent-gradient)' }}
            aria-label="Add company"
          >
            <Plus size={12} /> New company
          </button>
          <button
            type="button"
            onClick={() => handleIconClick('add-document', null)}
            className="inline-flex h-7 items-center gap-1 rounded-md border px-2.5 text-[11.5px] font-medium focus-ring"
            style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)', backgroundColor: 'var(--app-control-bg)' }}
            aria-label="Add document"
          >
            <FilePlus2 size={11} /> Document
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--app-muted)' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="h-8 w-[220px] rounded-lg border pl-8 pr-2.5 text-[12px] outline-none focus-ring"
              style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-control-bg)', color: 'var(--app-heading)' }}
            />
          </div>
          <button
            type="button"
            onClick={() => handleIconClick('sync', null)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border focus-ring transition-colors hover:bg-[var(--app-control-hover)]"
            style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)', backgroundColor: 'var(--app-control-bg)' }}
            aria-label="Sync"
          >
            <RefreshCw size={13} />
          </button>
          <button
            type="button"
            onClick={() => handleIconClick('settings', null)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border focus-ring transition-colors hover:bg-[var(--app-control-hover)]"
            style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)', backgroundColor: 'var(--app-control-bg)' }}
            aria-label="Settings"
          >
            <Settings2 size={13} />
          </button>
        </div>
      </div>

      <div className="themed-scrollbar overflow-x-auto">
        <table className="min-w-[1180px] w-full border-collapse text-[11px]">
          <thead style={{ backgroundColor: 'var(--app-table-head-bg)', color: 'var(--app-heading)' }}>
            <tr>
              <th className="w-8 border-b border-r px-2 py-1.5" style={{ borderColor: 'var(--app-row-border)' }}>
                <input type="checkbox" />
              </th>
              <th className="border-b border-r px-2 py-1.5 text-left" style={{ borderColor: 'var(--app-row-border)' }}>Sr No.</th>
              <th className="border-b border-r px-2 py-1.5 text-left" style={{ borderColor: 'var(--app-row-border)' }}>Subscriptions</th>
              <th className="border-b border-r px-2 py-1.5 text-left" style={{ borderColor: 'var(--app-row-border)' }}>Business Name</th>
              <th className="border-b border-r px-2 py-1.5 text-left" style={{ borderColor: 'var(--app-row-border)' }}>GST Number</th>
              <th className="border-b border-r px-2 py-1.5 text-left" style={{ borderColor: 'var(--app-row-border)' }}>State</th>
              <th className="border-b border-r px-2 py-1.5 text-left" style={{ borderColor: 'var(--app-row-border)' }}>Accountants</th>
              <th className="border-b border-r px-2 py-1.5 text-left" style={{ borderColor: 'var(--app-row-border)' }}>Business Owner</th>
              <th className="border-b border-r px-2 py-1.5 text-left" style={{ borderColor: 'var(--app-row-border)' }}>Credits Available</th>
              <th className="border-b border-r px-2 py-1.5 text-left" style={{ borderColor: 'var(--app-row-border)' }}>Status</th>
              <th className="border-b px-2 py-1.5 text-left" style={{ borderColor: 'var(--app-row-border)' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={row.id} className="transition hover:bg-[var(--app-row-hover)]">
                <td className="border-b border-r px-2 py-1.5 text-center" style={{ borderColor: 'var(--app-row-border)' }}>
                  <input type="checkbox" />
                </td>
                <td className="border-b border-r px-2 py-1.5 text-center" style={{ borderColor: 'var(--app-row-border)', color: 'var(--app-heading)' }}>
                  {row.id}
                </td>
                <td className="border-b border-r px-2 py-1.5" style={{ borderColor: 'var(--app-row-border)' }}>
                  <span className="inline-block rounded-md border px-2.5 py-0.5 text-center leading-4" style={{ borderColor: '#00b16a', color: '#00a363' }}>
                    {row.subscription.split('\n').map((line) => (
                      <span key={line} className="block">{line}</span>
                    ))}
                  </span>
                </td>
                <td className="border-b border-r px-2 py-1.5" style={{ borderColor: 'var(--app-row-border)', color: 'var(--app-heading)' }}>{row.businessName}</td>
                <td className="border-b border-r px-2 py-1.5" style={{ borderColor: 'var(--app-row-border)', color: 'var(--app-heading)' }}>{row.gstNumber}</td>
                <td className="border-b border-r px-2 py-1.5" style={{ borderColor: 'var(--app-row-border)', color: 'var(--app-heading)' }}>{row.state}</td>
                <td className="border-b border-r px-2 py-1.5" style={{ borderColor: 'var(--app-row-border)', color: 'var(--app-heading)' }}>{row.accountants}</td>
                <td className="border-b border-r px-2 py-1.5" style={{ borderColor: 'var(--app-row-border)', color: 'var(--app-heading)' }}>{row.owner}</td>
                <td className="border-b border-r px-2 py-1.5" style={{ borderColor: 'var(--app-row-border)', color: 'var(--app-heading)' }}>{row.credits}</td>
                <td className="border-b border-r px-2 py-1.5" style={{ borderColor: 'var(--app-row-border)', color: 'var(--app-heading)' }}>{row.status}</td>
                <td className="border-b px-2 py-1.5" style={{ borderColor: 'var(--app-row-border)' }}>
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => handleIconClick('download', row)} className="inline-flex h-5 w-5 items-center justify-center rounded-full border" style={{ borderColor: '#cbeedc', color: '#22a566' }}><ArrowDownToLine size={10} /></button>
                    <button type="button" onClick={() => handleIconClick('edit', row)} className="inline-flex h-5 w-5 items-center justify-center rounded-full border" style={{ borderColor: '#d3ecd9', color: '#31af5f' }}><Pencil size={10} /></button>
                    <button type="button" onClick={() => handleIconClick('delete', row)} className="inline-flex h-5 w-5 items-center justify-center rounded-full border" style={{ borderColor: '#f3d3d3', color: '#d36666' }}><Trash2 size={10} /></button>
                    <button type="button" onClick={() => handleIconClick('view', row)} className="inline-flex h-5 w-5 items-center justify-center rounded-full border" style={{ borderColor: '#cae6f8', color: '#4e9dcf' }}><Eye size={10} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-center gap-3 border-t px-4 py-1.5 text-[11px]" style={{ borderColor: 'var(--app-row-border)', color: 'var(--app-text)' }}>
        <span>1 - 1 of 1</span>
        <button type="button" onClick={() => handleIconClick('prev-page', null)}>{'<'}</button>
        <button type="button" onClick={() => handleIconClick('next-page', null)}>{'>'}</button>
        <select
          defaultValue="10"
          className="rounded border px-2 py-0.5 text-xs outline-none"
          style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-control-bg)', color: 'var(--app-heading)' }}
        >
          <option value="10">10</option>
          <option value="20">20</option>
          <option value="50">50</option>
        </select>
      </div>

      <AddCompanyModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        formValues={formValues}
        onFieldChange={(key, value) => setFormValues((prev) => ({ ...prev, [key]: value }))}
        onSave={handleSaveCompany}
      />
    </section>
  )
}

export default CompaniesPanel
