import axios from 'axios'
import { env } from '../config/env'
import { useAppStore } from '../stores/useAppStore'

// Central axios instance. All feature `api.js` files import from here.
const api = axios.create({
  baseURL: env.VITE_API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

// Attach auth + tenant scope on every request.
api.interceptors.request.use((config) => {
  const { token, selectedCompany } = useAppStore.getState()
  if (token) config.headers.Authorization = `Bearer ${token}`
  if (selectedCompany) config.headers['X-Company'] = selectedCompany
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
