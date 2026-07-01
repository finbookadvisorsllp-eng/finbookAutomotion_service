// Centralised runtime configuration for the LiveTally frontend.
//
// All environment-specific values are read from Vite env vars (import.meta.env.*)
// and defined in exactly one place. Nothing company-specific is hardcoded in
// source. Values live in a git-ignored `.env` (see `.env.example`).
//
// NOTE: Vite inlines `VITE_*` variables into the client bundle at build time, so
// they are visible to anyone who loads the app — they are configuration, not
// secrets. True secrets must stay on the backend. We keep the company id out of
// source and git so it is not published to the repository.

const env = import.meta.env

// Base URL of the aman backend API (/api/v3).
export const API_BASE_URL = (env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/v3').trim()

// Default company id used before the user picks one in the company switcher.
// No hardcoded fallback: when unset, the app relies on the selected/stored id.
export const DEFAULT_COMPANY_ID = (env.VITE_DEFAULT_COMPANY_ID || '').trim()

export default { API_BASE_URL, DEFAULT_COMPANY_ID }
