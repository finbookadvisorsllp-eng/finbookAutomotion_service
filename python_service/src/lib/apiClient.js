import axios from 'axios';
import { useAppStore } from '../stores/useAppStore';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Pre-configured Axios instance.
 * - Attaches JWT token from Zustand store on every request.
 * - Handles 401 by clearing auth and redirecting to login.
 */
const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Request Interceptor: attach auth token ───────────────────────────────────
apiClient.interceptors.request.use(
  (config) => {
    const token = useAppStore.getState().token;
    if (token) config.headers.Authorization = `Bearer ${token}`;

    // Attach selected company as header for multi-tenant scoping
    const company = useAppStore.getState().selectedCompany;
    if (company) config.headers['X-Company-Id'] = company;

    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response Interceptor: handle 401 ────────────────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAppStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
