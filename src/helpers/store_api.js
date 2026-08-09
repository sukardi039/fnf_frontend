import { request } from "./axios_helper";

export const listStores = ({ companyId, active = true } = {}) => {
  const query = new URLSearchParams();
  if (companyId) query.set("companyId", companyId);
  query.set("active", String(active));
  return request("GET", `/api/v1/stores?${query.toString()}`, null, {
    skipAuthRedirect: true,
    skipBackendErrorDialog: true,
  });
};

export const getStore = (storeId) =>
  request("GET", `/api/v1/stores/${encodeURIComponent(storeId)}`, null, {
    skipAuthRedirect: true,
    skipBackendErrorDialog: true,
  });

export const createStore = (data) =>
  request("POST", "/api/v1/stores", data, {
    headers: { "Idempotency-Key": crypto.randomUUID() },
    skipAuthRedirect: true,
    skipBackendErrorDialog: true,
  });

export const updateStore = (storeId, data) =>
  request("PUT", `/api/v1/stores/${encodeURIComponent(storeId)}`, data, {
    headers: { "Idempotency-Key": crypto.randomUUID() },
    skipAuthRedirect: true,
    skipBackendErrorDialog: true,
  });

export const deleteStore = (storeId) =>
  request("DELETE", `/api/v1/stores/${encodeURIComponent(storeId)}`, null, {
    skipAuthRedirect: true,
    skipBackendErrorDialog: true,
  });
