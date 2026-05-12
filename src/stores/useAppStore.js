import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Single client-state store: theme, selected company, and auth.
// Server state belongs in React Query, not here.
const defaultCompanies = ['Data Uncyclable', 'Finolax Advisors', 'Greenline Ventures', 'Apex Holdings']

export const useAppStore = create(
  persist(
    (set) => ({
      // theme
      mode: 'light',
      toggleMode: () => set((s) => ({ mode: s.mode === 'dark' ? 'light' : 'dark' })),
      setMode: (mode) => set({ mode }),

      // active company (tenant scope for API calls)
      companies: defaultCompanies,
      selectedCompany: defaultCompanies[0],
      setSelectedCompany: (selectedCompany) => set({ selectedCompany }),
      setCompanies: (companies) => set({ companies }),

      // auth
      token: null,
      user: null,
      setAuth: ({ token, user }) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
    }),
    {
      name: 'fb-app-store',
      partialize: (s) => ({
        mode: s.mode,
        selectedCompany: s.selectedCompany,
        token: s.token,
        user: s.user,
      }),
    }
  )
)

// Convenience selectors — keep components subscribed to the minimum slice.
export const useIsDark = () => useAppStore((s) => s.mode === 'dark')
export const useSelectedCompany = () => useAppStore((s) => s.selectedCompany)
export const useAuthToken = () => useAppStore((s) => s.token)
