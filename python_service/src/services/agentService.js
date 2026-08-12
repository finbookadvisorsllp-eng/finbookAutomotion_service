import apiClient from '../lib/apiClient';

/**
 * Service wrapper for interacting with the AI Agent Platform endpoints.
 */
export const agentService = {
  /**
   * Fetches active AI Agent Platform configuration from backend.
   */
  async getAgentConfig() {
    const response = await apiClient.get('/agent/config');
    return response.data;
  },

  /**
   * Triggers the AI Agent Platform execution for a specified date and company.
   * @param {Object} payload - { company_id, execution_date, execution_time, goal }
   */
  async runAgentWorkflow(payload = {}) {
    const response = await apiClient.post('/agent/run', payload);
    return response.data;
  },

  /**
   * Lists historical AI Accounting Intelligence Reports.
   * @param {Object} params - { company_id, limit }
   */
  async listReports(params = {}) {
    const response = await apiClient.get('/agent/reports', { params });
    return response.data;
  },

  /**
   * Retrieves a specific saved AI Report by ID.
   * @param {string} reportId 
   * @param {Object} params - { company_id }
   */
  async getReportById(reportId, params = {}) {
    const response = await apiClient.get(`/agent/reports/${reportId}`, { params });
    return response.data;
  },
};

export default agentService;
