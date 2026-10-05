import { request } from "./axios_helper";

const API_BASE = "/api";

export const listVendors = ({ active = true } = {}) => {
  const query = new URLSearchParams();
  query.set("active", String(active));
  return request("GET", `${API_BASE}/vendors?${query.toString()}`, null, {
    skipAuthRedirect: true,
    skipBackendErrorDialog: true,
  });
};

export const getVendor = (vendorId) =>
  request("GET", `${API_BASE}/vendors/${encodeURIComponent(vendorId)}`, null, {
    skipAuthRedirect: true,
    skipBackendErrorDialog: true,
  });

export const createVendor = (data) =>
  request("POST", `${API_BASE}/vendors`, data, {
    headers: { "Idempotency-Key": crypto.randomUUID() },
    skipAuthRedirect: true,
    skipBackendErrorDialog: true,
  });

export const updateVendor = (vendorId, data) =>
  request("PUT", `${API_BASE}/vendors/${encodeURIComponent(vendorId)}`, data, {
    headers: { "Idempotency-Key": crypto.randomUUID() },
    skipAuthRedirect: true,
    skipBackendErrorDialog: true,
  });

export const deleteVendor = (vendorId) =>
  request("DELETE", `${API_BASE}/vendors/${encodeURIComponent(vendorId)}`, null, {
    skipAuthRedirect: true,
    skipBackendErrorDialog: true,
  });
