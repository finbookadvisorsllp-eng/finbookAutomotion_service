// Central API client for the aman backend (/api/v3).
// Injects auth + tenant headers, appends the financial-year query param, and
// unwraps the { success, data, pagination, meta } envelope.

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/v3'
const DEFAULT_COMPANY_ID = import.meta.env.VITE_DEFAULT_COMPANY_ID || '6a182ee36efd32db3c490a6c'

const TOKEN_KEY = 'aman_token'
const COMPANY_KEY = 'aman_company_id'

export const auth = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setToken: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

export const getCompanyId = () => localStorage.getItem(COMPANY_KEY) || DEFAULT_COMPANY_ID
export const setCompanyId = (id) => localStorage.setItem(COMPANY_KEY, id)

function buildUrl(path, params = {}) {
  const url = new URL(BASE_URL + path)
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v)
  })
  return url.toString()
}

async function request(path, { method = 'GET', params, body } = {}) {
  const headers = { 'Content-Type': 'application/json', 'x-company-id': getCompanyId() }
  const token = auth.getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(buildUrl(path, params), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  let payload
  try { payload = await res.json() } catch { payload = null }

  if (!res.ok || (payload && payload.success === false)) {
    const message = payload?.detail || payload?.error?.message || payload?.message || res.statusText
    const err = new Error(message || `Request failed (${res.status})`)
    err.status = res.status
    err.payload = payload
    throw err
  }
  return payload // { success, data, pagination, meta }
}

// Return only the `data` field (most common case).
export async function apiGet(path, params) {
  const r = await request(path, { params })
  return r?.data
}

// Return the full envelope (when you need pagination/meta).
export async function apiGetFull(path, params) {
  return request(path, { params })
}

export async function apiPost(path, body, params) {
  const r = await request(path, { method: 'POST', body, params })
  return r?.data ?? r
}

export default { apiGet, apiGetFull, apiPost, auth, getCompanyId, setCompanyId }
