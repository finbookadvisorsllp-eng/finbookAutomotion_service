// Central API client for the aman backend (/api/v3).
// Injects auth + tenant headers, appends the financial-year query param, and
// unwraps the { success, data, pagination, meta } envelope.

import { API_BASE_URL, DEFAULT_COMPANY_ID } from '../config'

const BASE_URL = API_BASE_URL

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

export async function apiPut(path, body, params) {
  const r = await request(path, { method: 'PUT', body, params })
  return r?.data ?? r
}

export async function apiDelete(path, params) {
  const r = await request(path, { method: 'DELETE', params })
  return r?.data ?? r
}

// Download a binary file (PDF/Excel/CSV) from an endpoint that returns raw bytes.
// Sends the same auth + tenant headers, honours the server Content-Disposition
// filename, and triggers a browser save. Used by the report export buttons.
export async function apiDownload(path, params = {}, fallbackName = 'export') {
  const headers = { 'x-company-id': getCompanyId() }
  const token = auth.getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(buildUrl(path, params), { headers })
  if (!res.ok) {
    let detail
    try { detail = (await res.json())?.detail } catch { /* not json */ }
    throw new Error(detail || `Export failed (${res.status})`)
  }

  const blob = await res.blob()
  const cd = res.headers.get('Content-Disposition') || ''
  const star = cd.match(/filename\*=UTF-8''([^;]+)/i)
  const plain = cd.match(/filename="?([^";]+)"?/i)
  const filename = star ? decodeURIComponent(star[1]) : (plain ? plain[1] : fallbackName)

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export default { apiGet, apiGetFull, apiPost, apiPut, apiDelete, apiDownload, auth, getCompanyId, setCompanyId }
