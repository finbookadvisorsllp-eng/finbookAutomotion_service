import axios from 'axios';
import { useAppStore } from '../stores/useAppStore';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000/api/v2';

/**
 * Parses the base64 URL encoded JWT payload.
 * @param {string} token 
 * @returns {object|null}
 */
function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

/**
 * Pre-configured Axios instance.
 * - Attaches JWT token and Organization headers.
 * - Handles token expiration and silent refresh on 401.
 */
const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// A promise holder to queue requests during active token refresh
let isRefreshing = false;
let refreshSubscribers = [];

function subscribeTokenRefresh(cb) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token) {
  refreshSubscribers.map((cb) => cb(token));
  refreshSubscribers = [];
}

// ─── Request Interceptor ──────────────────────────────────────────────────────
apiClient.interceptors.request.use(
  (config) => {
    // Dynamically adjust prefix for central shared auth endpoints
    if (config.url && config.url.startsWith('/auth/')) {
      config.baseURL = config.baseURL.replace('/api/v2', '/api').replace('/v2', '');
    }

    const token = useAppStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Attach selected company as header for multi-tenant scoping

    const company = useAppStore.getState().selectedCompany;
    if (company) {
      config.headers['X-Company-Id'] = company;
    }

    // Also attach Organization ID header for new IAM model
    const orgId = useAppStore.getState().orgId;
    if (orgId) {
      config.headers['X-Org-Id'] = orgId;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response Interceptor: handle 401 with silent token refresh ────────────────
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Trigger token refresh on 401 Unauthorized errors
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = useAppStore.getState().refreshToken;

      if (!refreshToken) {
        useAppStore.getState().logout();
        window.location.href = '/login';
        return Promise.reject(error);
      }

      if (!isRefreshing) {
        isRefreshing = true;

        // Perform token refresh using a clean axios instance to bypass interceptors
        axios
          .post(`${BASE_URL}/auth/refresh-token`, { refreshToken })
          .then((res) => {
            const { token: newAccessToken } = res.data.data;
            const claims = parseJwt(newAccessToken);
            const expiresAt = claims ? claims.exp * 1000 : null;

            // Update app store
            useAppStore.getState().setAuth({
              token: newAccessToken,
              refreshToken,
              user: useAppStore.getState().user,
              tokenExpiresAt: expiresAt,
              role: claims?.role,
              permissions: claims?.permissions,
            });

            isRefreshing = false;
            onRefreshed(newAccessToken);
          })
          .catch((err) => {
            isRefreshing = false;
            useAppStore.getState().logout();
            window.location.href = '/login';
            return Promise.reject(err);
          });
      }

      // Return a promise that resolves once the refresh is done
      return new Promise((resolve) => {
        subscribeTokenRefresh((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          resolve(apiClient(originalRequest));
        });
      });
    }

    return Promise.reject(error);
  }
);

export default apiClient;
