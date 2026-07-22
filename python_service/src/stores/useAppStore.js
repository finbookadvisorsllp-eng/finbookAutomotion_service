import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Single client-state store: theme, selected company, and auth.
// Server state belongs in React Query, not here.
const defaultCompanies = []

export const useAppStore = create(
  persist(
    (set) => ({
      // theme
      mode: 'light',
      toggleMode: () => set((s) => ({ mode: s.mode === 'dark' ? 'light' : 'dark' })),
      setMode: (mode) => set({ mode }),

      // sidebar collapsed (persisted so it sticks across reloads)
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      // active company (tenant scope for API calls)
      companies: [],
      selectedCompany: '', // acts as orgDbName for backend database mapping
      orgId: null,
      orgName: null,
      setSelectedCompany: (selectedCompany) => set({ selectedCompany }),
      setCompanies: (companies) => set({ companies }),
      setOrg: ({ orgId, orgDbName, orgName }) =>
        set({ orgId, selectedCompany: orgDbName, orgName }),
      clearOrg: () => set({ orgId: null, selectedCompany: '', orgName: null }),

      // approval center view state ('list' | 'detail')
      approvalCenterView: 'list',
      setApprovalCenterView: (approvalCenterView) => set({ approvalCenterView }),

      // auth
      token: null,
      refreshToken: null,
      tokenExpiresAt: null,
      user: null,
      role: null,
      permissions: [],
      setAuth: ({ token, refreshToken, user, tokenExpiresAt, role, permissions }) =>
        set({
          token,
          refreshToken,
          user,
          tokenExpiresAt: tokenExpiresAt || null,
          role: role || null,
          permissions: permissions || [],
        }),
      logout: () =>
        set({
          token: null,
          refreshToken: null,
          tokenExpiresAt: null,
          user: null,
          role: null,
          permissions: [],
          orgId: null,
          selectedCompany: '',
          orgName: null,
        }),
    }),
    {
      name: 'fb-app-store',

      partialize: (s) => ({
        mode: s.mode,
        sidebarCollapsed: s.sidebarCollapsed,
        selectedCompany: s.selectedCompany,
        orgId: s.orgId,
        orgName: s.orgName,
        companies: s.companies,
        token: s.token,
        refreshToken: s.refreshToken,
        tokenExpiresAt: s.tokenExpiresAt,
        user: s.user,
        role: s.role,
        permissions: s.permissions,
      }),
    }

  )
)

// Convenience selectors — keep components subscribed to the minimum slice.
export const useIsDark = () => useAppStore((s) => s.mode === 'dark')
export const useSelectedCompany = () => useAppStore((s) => s.selectedCompany)
export const useAuthToken = () => useAppStore((s) => s.token)
