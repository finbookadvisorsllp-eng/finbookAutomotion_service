import apiClient from '../lib/apiClient';

/**
 * Service handlers for shared authentication and organization-based login.
 * Calls endpoints under the central `/api/auth` prefix.
 */
export const authApi = {
  /**
   * Submit credentials to authenticate the user session.
   * @param {string} email
   * @param {string} password
   */
  login: (email, password) =>
    apiClient.post('/auth/login', { email, password }).then((r) => r.data),

  /**
   * Switch the active organization scope.
   * @param {string} organizationId
   */
  selectOrg: (organizationId) =>
    apiClient
      .post('/auth/switch-organization', { organizationId })
      .then((r) => r.data),

  /**
   * Silent renewal of an expired session token using the refresh token.
   * @param {string} refreshToken
   */
  refresh: (refreshToken) =>
    apiClient.post('/auth/refresh-token', { refreshToken }).then((r) => r.data),

  /**
   * Terminate active user session and revoke refresh tokens.
   * @param {string} refreshToken
   */
  logout: (refreshToken) =>
    apiClient.post('/auth/logout', { refreshToken }).then((r) => r.data),

  /**
   * Fetch details of the currently authenticated user session.
   */
  me: () => apiClient.get('/auth/me').then((r) => r.data),

  /**
   * Register a new organization and admin user.
   * @param {Object} payload
   */
  registerOrganization: (payload) =>
    apiClient.post('/auth/register-organization', payload).then((r) => r.data),
};

export default authApi;
