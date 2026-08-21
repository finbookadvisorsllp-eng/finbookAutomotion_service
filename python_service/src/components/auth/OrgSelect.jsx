import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import { Building2, ArrowRight, Loader2, LogOut } from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import { authApi } from '../../services/authApi'
import Button from '../ui/Button'

export default function OrgSelect() {
  const navigate = useNavigate()
  const logout = useAppStore((s) => s.logout)
  const setAuth = useAppStore((s) => s.setAuth)
  const setOrg = useAppStore((s) => s.setOrg)
  const token = useAppStore((s) => s.token)
  const refreshToken = useAppStore((s) => s.refreshToken)
  const user = useAppStore((s) => s.user)
  const isDark = useAppStore((s) => s.mode === 'dark')

  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectingId, setSelectingId] = useState(null)

  useEffect(() => {
    // Decode token or call /me to fetch latest list of orgs from the user context
    if (!token) {
      navigate('/login')
      return
    }

    setLoading(true)
    authApi
      .me()
      .then((res) => {
        // Since we are unscoped, we will fetch the list of orgs via user context login
        // But wait! me() returns the claims. The claims might not contain full organization data details.
        // During login, Login.jsx stored the full organizations list. But if the user refreshed, we can fetch
        // user details. Let's make sure we query or fall back.
        // Wait, the login API response returned `organizations` which has the list of OrgData!
        // Let's check where Login.jsx stores them or if we can get them.
        // Actually, we can fetch user profile or get the org list from the store or from database.
        // Let's fetch details.
        // If claims don't have it, let's look at the stored state.
        // Wait! We can call a helper or store them in app store temporarily during login.
        // Yes, let's write a simple store field for temporary orgs list, or we can just fetch them.
        // Wait, how do we get the organization list?
        // Let's look at what claims has: claims.organizations is not in claims since claims is short.
        // But login API response returned `organizations`.
        // Let's modify useAppStore.js to store `organizationsList` temporarily!
        // Let's check `useAppStore.js` and see if we can read it.
        // Or, we can just save it in localStorage or a React state, or read from useAppStore.
        // Yes, let's store it in `companies` array in the store!useAppStore has a `companies` array.
        // Yes! useAppStore has `companies: []` and `setCompanies: (companies) => set({ companies })`!
        // We can just use the existing `companies` array to store the organizations returned by login!
        // This is perfect! No store modifications needed, completely reuses the existing `companies` slice.
        const storedOrgs = useAppStore.getState().companies || []
        if (storedOrgs.length > 0) {
          setOrgs(storedOrgs)
          setLoading(false)
          handleSelectOrg(storedOrgs[0])
        } else {
          toast.error('Session expired, please login again')
          handleLogout()
        }
      })
      .catch((err) => {
        toast.error('Failed to load workspaces')
        setLoading(false)
      })
  }, [token, navigate])

  const handleSelectOrg = async (org) => {
    setSelectingId(org.id)
    try {
      const res = await authApi.selectOrg(org.id)
      const { token: orgToken, refreshToken: orgRefresh, organization } = res.data

      // Decode token to extract role, permissions, and expiry
      const base64Url = orgToken.split('.')[1]
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
      const claims = JSON.parse(window.atob(base64))
      const expiry = claims ? claims.exp * 1000 : null

      // Save scoped auth and selected organization context
      setAuth({
        token: orgToken,
        refreshToken: orgRefresh,
        user,
        tokenExpiresAt: expiry,
        role: claims?.role,
        permissions: claims?.permissions,
      })

      setOrg({
        orgId: organization.id,
        orgDbName: organization.dbName,
        orgName: organization.displayName || organization.name,
      })

      // Sync localStorage and trigger global auto-fetch events
      const compIdVal = organization.dbName || organization.name || organization.id
      localStorage.setItem('selectedCompanyId', compIdVal)
      localStorage.setItem('activeCompany', compIdVal)
      localStorage.setItem('orgId', organization.id)
      window.dispatchEvent(new Event('company-changed'))
      window.dispatchEvent(new Event('auth-changed'))

      toast.success(`Switched to ${organization.displayName || organization.name}`)
      navigate('/home')
    } catch (err) {
      toast.error(err?.response?.data?.detail ?? 'Failed to enter workspace')
    } finally {
      setSelectingId(null)
    }
  }

  const handleLogout = () => {
    if (refreshToken) {
      authApi.logout(refreshToken).catch(() => {})
    }
    logout()
    navigate('/login')
  }

  const cardStyle = (orgId) => ({
    backgroundColor: 'var(--app-panel-bg)',
    borderColor: selectingId === orgId ? 'var(--app-accent)' : 'var(--app-border)',
    color: 'var(--app-heading)',
  })

  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden ${
        isDark ? 'dark' : ''
      }`}
      style={{ backgroundColor: 'var(--app-bg)', color: 'var(--app-heading)' }}
    >
      <div className="absolute inset-0 app-grid-bg opacity-30 pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md rounded-2xl border p-8 space-y-6 relative z-10"
        style={{
          borderColor: 'var(--app-border)',
          backgroundColor: 'var(--app-panel-bg)',
          boxShadow: 'var(--app-shadow)',
        }}
      >
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-[22px] font-extrabold tracking-tight">Select Workspace</h1>
            <p className="text-[12px] mt-1.5 style={{ color: 'var(--app-muted)' }}">
              Choose an organization to launch TallyHub
            </p>
          </div>
          <button
            onClick={handleLogout}
            title="Sign Out"
            className="p-2.5 rounded-lg border hover:bg-red-500/10 hover:border-red-500/30 transition-all"
            style={{ borderColor: 'var(--app-border)', color: 'var(--app-muted)' }}
          >
            <LogOut size={15} />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <Loader2 size={24} className="animate-spin text-[var(--app-accent)]" />
            <span className="text-[12px]" style={{ color: 'var(--app-muted)' }}>
              Loading workspaces...
            </span>
          </div>
        ) : orgs.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-[13px] font-medium" style={{ color: 'var(--app-muted)' }}>
              No active workspaces linked to this account.
            </p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--app-muted)' }}>
              Please contact your administrator.
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
            {orgs.map((org, index) => (
              <motion.div
                key={org.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => selectingId === null && handleSelectOrg(org)}
                className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer hover:shadow-md transition-all group ${
                  selectingId === org.id ? 'ring-2 ring-[var(--app-accent-soft)]' : ''
                }`}
                style={cardStyle(org.id)}
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: 'var(--app-accent-soft)',
                      color: 'var(--app-accent)',
                    }}
                  >
                    <Building2 size={18} strokeWidth={2} />
                  </div>
                  <div>
                    <h3 className="text-[13.5px] font-bold tracking-tight">{org.displayName}</h3>
                    <p className="text-[11px]" style={{ color: 'var(--app-muted)' }}>
                      slug: {org.slug}
                    </p>
                  </div>
                </div>
                <div>
                  {selectingId === org.id ? (
                    <Loader2 size={15} className="animate-spin text-[var(--app-accent)]" />
                  ) : (
                    <ArrowRight
                      size={15}
                      className="opacity-0 group-hover:opacity-100 transform translate-x-[-4px] group-hover:translate-x-0 transition-all text-[var(--app-accent)]"
                    />
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  )
}
