import { request } from "./axios_helper";

const API_BASE = "/api";

/**
 * List stores scoped to the authenticated user's company.
 *
 * @param {Object} params
 * @param {string} [params.companyId]
 * @param {boolean} [params.active=true]
 */
export const listStores = ({ companyId, active = true } = {}) => {
  const query = new URLSearchParams();
  if (companyId) query.set("companyId", companyId);
  query.set("active", String(active));
  return request("GET", `${API_BASE}/stores?${query.toString()}`);
};
