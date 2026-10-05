import { request } from "./axios_helper";

const API_BASE = "/api";

export const listStores = ({ companyId, active } = {}) => {
  const query = new URLSearchParams();
  if (companyId) query.set("companyId", companyId);
  if (active !== undefined) query.set("active", String(active));
  return request("GET", `${API_BASE}/stores?${query.toString()}`, null, {
    skipAuthRedirect: true,
    skipBackendErrorDialog: true,
  });
};

export const getStore = (storeId) =>
  request("GET", `${API_BASE}/stores/${encodeURIComponent(storeId)}`, null, {
    skipAuthRedirect: true,
    skipBackendErrorDialog: true,
  });

export const createStore = (data) =>
  request("POST", `${API_BASE}/stores`, data, {
    headers: { "Idempotency-Key": crypto.randomUUID() },
    skipAuthRedirect: true,
    skipBackendErrorDialog: true,
  });

export const updateStore = (storeId, data) =>
  request("PUT", `${API_BASE}/stores/${encodeURIComponent(storeId)}`, data, {
    headers: { "Idempotency-Key": crypto.randomUUID() },
    skipAuthRedirect: true,
    skipBackendErrorDialog: true,
  });

export const deleteStore = (storeId) =>
  request("DELETE", `${API_BASE}/stores/${encodeURIComponent(storeId)}`, null, {
    skipAuthRedirect: true,
    skipBackendErrorDialog: true,
  });
