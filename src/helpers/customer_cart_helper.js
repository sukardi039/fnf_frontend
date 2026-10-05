import { request } from "./axios_helper";

const API_BASE = "/api";

export const createCustomerCart = (data) =>
  request("POST", `${API_BASE}/carts`, data, {
    headers: { "Idempotency-Key": crypto.randomUUID() },
    skipAuthRedirect: true,
    skipBackendErrorDialog: true,
  });

export const addCustomerCartItem = (cartId, data) =>
  request("POST", `${API_BASE}/carts/${cartId}/items`, data, {
    headers: { "Idempotency-Key": crypto.randomUUID() },
    skipAuthRedirect: true,
    skipBackendErrorDialog: true,
  });

export const checkoutCustomerCart = (data) =>
  request("POST", `${API_BASE}/checkout`, data, {
    headers: { "Idempotency-Key": crypto.randomUUID() },
    skipAuthRedirect: true,
    skipBackendErrorDialog: true,
  });

export const listCustomerTransactions = (params = {}) => {
  const query = new URLSearchParams();
  if (params.customerId) query.set("customerId", params.customerId);
  if (params.status) query.set("status", params.status);
  if (params.page !== undefined) query.set("page", String(params.page));
  if (params.size !== undefined) query.set("size", String(params.size));
  const qs = query.toString();
  return request("GET", `${API_BASE}/transactions${qs ? `?${qs}` : ""}`, null, {
    skipAuthRedirect: true,
    skipBackendErrorDialog: true,
  });
};
