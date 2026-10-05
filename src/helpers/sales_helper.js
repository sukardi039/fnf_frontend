import { request } from "./axios_helper";

const API_BASE = "/api";

/**
 * Fetch today's sales summary for the dashboard.
 *
 * @param {Object} params
 * @param {string} params.date - ISO date (YYYY-MM-DD)
 * @param {string} [params.storeId]
 */
export const getSalesSummary = (params = {}) => {
  const query = new URLSearchParams();
  if (params.date) query.set("date", params.date);
  if (params.storeId) query.set("storeId", params.storeId);
  const qs = query.toString();
  return request("GET", `${API_BASE}/sales/summary${qs ? `?${qs}` : ""}`);
};

/**
 * Fetch hourly sales trend for the current day.
 *
 * @param {Object} params
 * @param {string} params.date - ISO date (YYYY-MM-DD)
 * @param {string} [params.storeId]
 */
export const getHourlySalesTrend = (params = {}) => {
  const query = new URLSearchParams();
  if (params.date) query.set("date", params.date);
  if (params.storeId) query.set("storeId", params.storeId);
  const qs = query.toString();
  return request(
    "GET",
    `${API_BASE}/sales/hourly-trend${qs ? `?${qs}` : ""}`,
  );
};

/**
 * Fetch top selling products for the current day.
 *
 * @param {Object} params
 * @param {string} params.date - ISO date (YYYY-MM-DD)
 * @param {string} [params.storeId]
 * @param {number} [params.limit=5]
 */
export const getTopSellingProducts = (params = {}) => {
  const query = new URLSearchParams();
  if (params.date) query.set("date", params.date);
  if (params.storeId) query.set("storeId", params.storeId);
  query.set("limit", String(params.limit ?? 5));
  const qs = query.toString();
  return request("GET", `${API_BASE}/sales/top-products?${qs}`);
};
