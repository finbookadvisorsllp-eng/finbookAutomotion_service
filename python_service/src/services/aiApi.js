import apiClient from '../lib/apiClient';

const CHAT_BASE = '/chat';

export const aiApi = {
  /**
   * Fetch company summary metrics, suggestion chips, and session histories on load
   */
  getPageLoadData: () =>
    apiClient.get(`${CHAT_BASE}/page-load`).then((r) => r.data),

  /**
   * Submit a chat message to the AI agent
   */
  sendMessage: (sessionId, message) =>
    apiClient.post(`${CHAT_BASE}/message`, { session_id: sessionId, message }).then((r) => r.data),

  /**
   * Get the current chat session state
   */
  getSession: (sessionId) =>
    apiClient.get(`${CHAT_BASE}/session/${sessionId}`).then((r) => r.data),

  /**
   * Get ledger credit details and outstanding balances
   */
  getLedgerDetails: (name) =>
    apiClient.get(`${CHAT_BASE}/ledger/${encodeURIComponent(name)}`).then((r) => r.data),

  /**
   * Get fundflow party details (outstanding bills)
   */
  getFundFlowPartyDetails: (name) =>
    apiClient.get(`/fundflow/party-details`, { params: { partyName: name } }).then((r) => r.data),

  /**
   * Reset session history and active draft
   */
  resetSession: (sessionId) =>
    apiClient.post(`${CHAT_BASE}/reset/${sessionId}`).then((r) => r.data),

  /**
   * Sync active draft modifications from the UI back to the backend session
   */
  updateDraft: (sessionId, draft) =>
    apiClient.post(`${CHAT_BASE}/draft/update-body?session_id=${sessionId}`, { draft }).then((r) => r.data),

  /**
   * Direct manual save/post draft to persistent database
   */
  saveDraft: (sessionId) =>
    apiClient.post(`${CHAT_BASE}/draft/save?session_id=${sessionId}`).then((r) => r.data),

  /**
   * Approve and post payment voucher draft to Tally
   */
  approvePaymentVoucher: (sessionId, draft) =>
    apiClient.post(`/voucher/payment`, { session_id: sessionId, draft }).then((r) => r.data),

  /**
   * Load an existing saved voucher by voucher number back into the active draft session
   */
  loadDraft: (sessionId, voucherNumber, voucherType) =>
    apiClient.get(`${CHAT_BASE}/draft/load`, {
      params: { session_id: sessionId, voucher_number: voucherNumber, voucher_type: voucherType },
    }).then((r) => r.data),

  /**
   * Delete conversation session
   */
  deleteSession: (sessionId) =>
    apiClient.delete(`${CHAT_BASE}/session/${sessionId}`).then((r) => r.data),
};

export default aiApi;
