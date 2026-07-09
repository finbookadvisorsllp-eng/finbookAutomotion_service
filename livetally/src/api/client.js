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

// Stream a Server-Sent-Events endpoint (POST). Parses `event:`/`data:` frames and
// invokes `onEvent(eventName, dataObject)` for each. Used by the AI CFO chat so
// answers render token-by-token in real time. Resolves when the stream ends.
export async function apiStream(path, body, { onEvent, signal } = {}) {
  const headers = { 'Content-Type': 'application/json', 'x-company-id': getCompanyId() }
  const token = auth.getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(BASE_URL + path, {
    method: 'POST', headers, body: JSON.stringify(body), signal,
  })
  if (!res.ok || !res.body) {
    let detail
    try { detail = (await res.json())?.detail } catch { /* not json */ }
    const err = new Error(detail || `Stream failed (${res.status})`)
    err.status = res.status
    throw err
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let sep
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, sep)
      buffer = buffer.slice(sep + 2)
      let event = 'message'
      let data = ''
      for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim()
        else if (line.startsWith('data:')) data += line.slice(5).trim()
      }
      if (data) {
        let parsed
        try { parsed = JSON.parse(data) } catch { parsed = null }
        if (parsed !== null) onEvent?.(event, parsed)
      }
    }
  }
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
