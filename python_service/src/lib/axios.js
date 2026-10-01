import axios from 'axios'
import { env } from '../config/env'
import { useAppStore } from '../stores/useAppStore'

// Central axios instance. All feature `api.js` files import from here.
const api = axios.create({
  baseURL: env.VITE_API_BASE_URL,
  timeout: 120000,
  headers: { 'Content-Type': 'application/json' },
})

// Attach auth + tenant scope on every request.
api.interceptors.request.use((config) => {
  const { token, selectedCompany, orgId, orgName } = useAppStore.getState()
  const activeCompanyId = orgId || localStorage.getItem('selectedCompanyId') || localStorage.getItem('companyId') || localStorage.getItem('activeCompany')
  const activeCompanyName = orgName || localStorage.getItem('companyName')

  if (token) config.headers.Authorization = `Bearer ${token}`
  if (selectedCompany) config.headers['X-Company'] = selectedCompany
  if (activeCompanyId) config.headers['X-Company-Id'] = activeCompanyId
  if (activeCompanyName) config.headers['X-Company-Name'] = activeCompanyName
  return config
})

// Normalize errors and handle expired sessions globally.
api.interceptors.response.use(
  (res) => res,
  (error) => {
    // Preserve active session state; only logout when user manually clicks Logout button!
    return Promise.reject(error)
  }
)

export default api
