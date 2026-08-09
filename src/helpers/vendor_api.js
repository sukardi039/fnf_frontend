import { request } from "./axios_helper";

export const listVendors = ({ active = true } = {}) => {
  const query = new URLSearchParams();
  query.set("active", String(active));
  return request("GET", `/api/v1/vendors?${query.toString()}`, null, {
    skipAuthRedirect: true,
    skipBackendErrorDialog: true,
  });
};

export const getVendor = (vendorId) =>
  request("GET", `/api/v1/vendors/${encodeURIComponent(vendorId)}`, null, {
    skipAuthRedirect: true,
    skipBackendErrorDialog: true,
  });

export const createVendor = (data) =>
  request("POST", "/api/v1/vendors", data, {
    headers: { "Idempotency-Key": crypto.randomUUID() },
    skipAuthRedirect: true,
    skipBackendErrorDialog: true,
  });

export const updateVendor = (vendorId, data) =>
  request("PUT", `/api/v1/vendors/${encodeURIComponent(vendorId)}`, data, {
    headers: { "Idempotency-Key": crypto.randomUUID() },
    skipAuthRedirect: true,
    skipBackendErrorDialog: true,
  });

export const deleteVendor = (vendorId) =>
  request("DELETE", `/api/v1/vendors/${encodeURIComponent(vendorId)}`, null, {
    skipAuthRedirect: true,
    skipBackendErrorDialog: true,
  });
