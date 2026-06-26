import { X, ChevronDown, Building2, MapPin, Globe } from 'lucide-react'

function AddCompanyModal({ open, onClose, formValues, onFieldChange, onSave }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center bg-black/50 backdrop-blur-[2px] p-0 md:p-4 overflow-y-auto select-none">
      <div className="bg-[var(--app-panel-bg)] border-0 md:border border-[var(--app-border)] rounded-none md:rounded-xl shadow-2xl max-w-5xl w-full h-full md:h-auto md:max-h-[95vh] flex flex-col my-0 md:my-4 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-2.5 border-b border-[var(--app-border)] flex justify-between items-center shrink-0 bg-[var(--app-panel-bg)] rounded-t-none md:rounded-t-xl">
          <div>
            <h2 className="text-base md:text-lg font-bold text-slate-900 dark:text-white">Add Company</h2>
            <p className="text-[10px] md:text-xs text-[var(--app-muted)] mt-0.5">Register a new company profile in one view</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-[var(--app-text)] dark:hover:text-[var(--app-muted)] transition-colors p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={onSave} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Fields - grouped into 3 columns, no scrolling needed on typical displays */}
          <div className="flex-1 p-3 md:p-4 space-y-3 overflow-y-auto md:overflow-visible">
            
            {/* Banner image */}
            <div className="rounded-lg overflow-hidden shrink-0 border border-[var(--app-border)]">
              <img
                src="https://images.unsplash.com/photo-1586281380349-632531db7ed4?q=80&w=1200&auto=format&fit=crop"
                alt="Add company banner"
                className="h-[80px] w-full object-cover"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Column 1: Basic Info */}
              <div className="space-y-3">
                <div className="space-y-2 border rounded-xl p-3 bg-[var(--app-content-bg)] border-[var(--app-border)]">
                  <div className="flex items-center gap-1.5 text-[var(--app-accent)] dark:text-[var(--app-accent)] font-bold border-b border-[var(--app-border)] pb-1 mb-2">
                    <Building2 size={13} />
                    <span className="text-[11px] uppercase tracking-wider font-black">1. Basic Info</span>
                  </div>

                  <div>
                    <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">Business Name *</label>
                    <input
                      type="text"
                      required
                      value={formValues.businessName}
                      onChange={(e) => onFieldChange('businessName', e.target.value)}
                      placeholder="e.g. Acme Corp Industries"
                      className="w-full h-8 rounded-lg border px-2.5 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">Industry</label>
                    <div className="relative">
                      <select
                        value={formValues.industry}
                        onChange={(e) => onFieldChange('industry', e.target.value)}
                        className="w-full appearance-none h-8 rounded-lg border px-2.5 pr-8 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                      >
                        <option value="">Select Industry</option>
                        <option value="Consulting">Consulting</option>
                        <option value="Retail">Retail</option>
                      </select>
                      <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">GST No.</label>
                      <input
                        type="text"
                        value={formValues.gstNo}
                        onChange={(e) => onFieldChange('gstNo', e.target.value)}
                        placeholder="e.g. 23AAFFF..."
                        className="w-full h-8 rounded-lg border px-2 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">PAN No.</label>
                      <input
                        type="text"
                        value={formValues.panNo}
                        onChange={(e) => onFieldChange('panNo', e.target.value)}
                        placeholder="e.g. AAFFF..."
                        className="w-full h-8 rounded-lg border px-2 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Column 2: Address Info */}
              <div className="space-y-3">
                <div className="space-y-2 border rounded-xl p-3 bg-[var(--app-content-bg)] border-[var(--app-border)]">
                  <div className="flex items-center gap-1.5 text-[var(--app-accent)] dark:text-[var(--app-accent)] font-bold border-b border-[var(--app-border)] pb-1 mb-2">
                    <MapPin size={13} />
                    <span className="text-[11px] uppercase tracking-wider font-black">2. Address Info</span>
                  </div>

                  <div>
                    <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">Address</label>
                    <textarea
                      rows={2.5}
                      value={formValues.address}
                      onChange={(e) => onFieldChange('address', e.target.value)}
                      placeholder="e.g. 101, Business Park"
                      className="w-full rounded-lg border px-2.5 py-1.5 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)] resize-none"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">Locality</label>
                    <input
                      type="text"
                      value={formValues.locality}
                      onChange={(e) => onFieldChange('locality', e.target.value)}
                      placeholder="e.g. Vijay Nagar"
                      className="w-full h-8 rounded-lg border px-2.5 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                    />
                  </div>
                </div>
              </div>

              {/* Column 3: Location Details */}
              <div className="space-y-3">
                <div className="space-y-2 border rounded-xl p-3 bg-[var(--app-content-bg)] border-[var(--app-border)]">
                  <div className="flex items-center gap-1.5 text-[var(--app-accent)] dark:text-[var(--app-accent)] font-bold border-b border-[var(--app-border)] pb-1 mb-2">
                    <Globe size={13} />
                    <span className="text-[11px] uppercase tracking-wider font-black">3. Location</span>
                  </div>

                  <div>
                    <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">State</label>
                    <div className="relative">
                      <select
                        value={formValues.state}
                        onChange={(e) => onFieldChange('state', e.target.value)}
                        className="w-full appearance-none h-8 rounded-lg border px-2.5 pr-8 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                      >
                        <option value="">Select State</option>
                        <option value="Madhya Pradesh">Madhya Pradesh</option>
                        <option value="Gujarat">Gujarat</option>
                      </select>
                      <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">City</label>
                    <div className="relative">
                      <select
                        value={formValues.city}
                        onChange={(e) => onFieldChange('city', e.target.value)}
                        className="w-full appearance-none h-8 rounded-lg border px-2.5 pr-8 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                      >
                        <option value="">Select City</option>
                        <option value="Indore">Indore</option>
                        <option value="Bhopal">Bhopal</option>
                      </select>
                      <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] font-bold text-slate-500 mb-0.5 block uppercase tracking-wide">Country</label>
                    <div className="relative">
                      <select
                        value={formValues.country}
                        onChange={(e) => onFieldChange('country', e.target.value)}
                        className="w-full appearance-none h-8 rounded-lg border px-2.5 pr-8 text-xs outline-none bg-[var(--app-content-bg)] text-[var(--app-heading)] border-[var(--app-border)] focus:border-[var(--app-accent)]"
                      >
                        <option value="">Select Country</option>
                        <option value="India">India</option>
                      </select>
                      <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Modal Footer Buttons */}
          <div className="flex justify-end gap-2 p-3 md:p-4 border-t border-[var(--app-border)] text-[10px] font-bold uppercase tracking-wider shrink-0 bg-[var(--app-panel-bg)] rounded-b-none md:rounded-b-xl">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-[var(--app-text)] transition-colors"
              style={{ borderColor: 'var(--app-border)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-1.5 bg-[var(--app-accent)] hover:opacity-90 text-white rounded-lg shadow-sm transition-all font-bold"
            >
              Save Company
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddCompanyModal
