import { X, ChevronDown } from 'lucide-react'

function AddCompanyModal({ open, onClose, formValues, onFieldChange, onSave }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center  backdrop-blur-[2px] px-4">
      <div
        className="w-full max-w-[760px] rounded-xl border shadow-[0_20px_40px_rgba(15,23,42,0.22)]"
        style={{ backgroundColor: 'var(--app-panel-bg)', borderColor: 'var(--app-border)' }}
      >
        <div className="flex items-center justify-between px-5 py-3">
          <h2 className="text-xl font-semibold" style={{ color: '#2e3aa8' }}>
            Add Company
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border"
            style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 pb-5">
          <div className="mb-4 rounded-md bg-[#eaf0ff]">
            <img
              src="https://images.unsplash.com/photo-1586281380349-632531db7ed4?q=80&w=1200&auto=format&fit=crop"
              alt="Add company banner"
              className="h-[120px] w-full rounded-md object-cover"
            />
          </div>

          <p className="mb-2 text-xs font-medium" style={{ color: 'var(--app-text)' }}>
            Fetch GST data
          </p>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <input
              value={formValues.gstNo}
              onChange={(e) => onFieldChange('gstNo', e.target.value)}
              placeholder="GST No."
              className="rounded border px-3 py-2 text-sm outline-none"
              style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-control-bg)', color: 'var(--app-heading)' }}
            />
            <input
              value={formValues.panNo}
              onChange={(e) => onFieldChange('panNo', e.target.value)}
              placeholder="PAN No."
              className="rounded border px-3 py-2 text-sm outline-none"
              style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-control-bg)', color: 'var(--app-heading)' }}
            />
            <input
              value={formValues.businessName}
              onChange={(e) => onFieldChange('businessName', e.target.value)}
              placeholder="Business Name"
              className="rounded border px-3 py-2 text-sm outline-none"
              style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-control-bg)', color: 'var(--app-heading)' }}
            />
            <input
              value={formValues.address}
              onChange={(e) => onFieldChange('address', e.target.value)}
              placeholder="Address"
              className="rounded border px-3 py-2 text-sm outline-none"
              style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-control-bg)', color: 'var(--app-heading)' }}
            />
            <input
              value={formValues.locality}
              onChange={(e) => onFieldChange('locality', e.target.value)}
              placeholder="Locality"
              className="rounded border px-3 py-2 text-sm outline-none"
              style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-control-bg)', color: 'var(--app-heading)' }}
            />
            <div className="relative">
              <select
                value={formValues.state}
                onChange={(e) => onFieldChange('state', e.target.value)}
                className="w-full appearance-none rounded border px-3 py-2 pr-8 text-sm outline-none"
                style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-control-bg)', color: 'var(--app-heading)' }}
              >
                <option value="">State</option>
                <option value="Madhya Pradesh">Madhya Pradesh</option>
                <option value="Gujarat">Gujarat</option>
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--app-text)' }} />
            </div>
            <div className="relative">
              <select
                value={formValues.city}
                onChange={(e) => onFieldChange('city', e.target.value)}
                className="w-full appearance-none rounded border px-3 py-2 pr-8 text-sm outline-none"
                style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-control-bg)', color: 'var(--app-heading)' }}
              >
                <option value="">City</option>
                <option value="Indore">Indore</option>
                <option value="Bhopal">Bhopal</option>
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--app-text)' }} />
            </div>
            <div className="relative">
              <select
                value={formValues.country}
                onChange={(e) => onFieldChange('country', e.target.value)}
                className="w-full appearance-none rounded border px-3 py-2 pr-8 text-sm outline-none"
                style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-control-bg)', color: 'var(--app-heading)' }}
              >
                <option value="">Country</option>
                <option value="India">India</option>
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--app-text)' }} />
            </div>
            <div className="relative">
              <select
                value={formValues.industry}
                onChange={(e) => onFieldChange('industry', e.target.value)}
                className="w-full appearance-none rounded border px-3 py-2 pr-8 text-sm outline-none"
                style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-control-bg)', color: 'var(--app-heading)' }}
              >
                <option value="">Industry</option>
                <option value="Consulting">Consulting</option>
                <option value="Retail">Retail</option>
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--app-text)' }} />
            </div>
          </div>

          <div className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={onSave}
              className="rounded-lg px-5 py-2 text-sm font-semibold text-white shadow-sm focus-ring"
              style={{ background: 'var(--app-accent-gradient)' }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AddCompanyModal
